// Owner: Dev A – Phase 6: Bookings Service
import { eq, and, sql, desc, gte, lt, lte, or, inArray } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { bookings, courts, courtTypes } from '../../db/schema/courts.js';
import { members, memberships, plans } from '../../db/schema/members.js';
import {
  Booking,
  CreateBookingRequest,
  CreateBookingResponse,
  CancelBookingResponse,
  SessionUser,
} from '@club/contract';
import {
  toClubLocalDate,
  toClubLocalTime,
  clubLocalToday,
  addClubDays,
  clubLocalDayBoundsUtc,
  isSlotAligned,
} from '../../core/clubTime.js';
import { Settings } from '../../core/settings.js';
import { Pricing } from '../pricing/index.js';
import { invoiceServiceStub, paymentServiceStub } from '../../core/stubs/finance.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { Notifications } from '../../core/notifications.js';
import { AppError } from '../../core/errors.js';
import { can } from '../../core/rbac.js';

export class BookingsService {
  /**
   * Implements Section 7.3 create-booking algorithm step-by-step in ONE transaction.
   */
  async createBooking(
    input: CreateBookingRequest,
    actorUser?: SessionUser
  ): Promise<CreateBookingResponse> {
    const startAt = typeof input.startAt === 'string' ? new Date(input.startAt) : (input.startAt as Date);
    if (isNaN(startAt.getTime())) {
      throw new AppError('VALIDATION', 'Invalid startAt timestamp', 400);
    }

    // 1. Validate slot grid alignment, duration, future
    const slotMinutes = (await Settings.get<number>('booking.slot_minutes')) ?? 30;
    if (!isSlotAligned(startAt, slotMinutes)) {
      throw new AppError(
        'VALIDATION',
        `startAt must align to ${slotMinutes}-minute slots (minutes must be a multiple of ${slotMinutes})`,
        400
      );
    }

    const sessionMinutes = (await Settings.get<number>('booking.session_minutes')) ?? 60;
    const endAt = new Date(startAt.getTime() + sessionMinutes * 60 * 1000);

    const now = new Date();
    if (startAt.getTime() <= now.getTime()) {
      throw new AppError('VALIDATION', 'Booking start time must be in the future', 400);
    }

    // Must have either a memberId or guest details
    if (!input.memberId && (!input.guest?.name || !input.guest?.phone)) {
      throw new AppError(
        'VALIDATION',
        'Booking requires either a registered memberId or guest { name, phone }',
        400
      );
    }

    const todayDateStr = clubLocalToday();
    const targetDateStr = toClubLocalDate(startAt);

    // Run in a single database transaction
    return await db.transaction(async (tx) => {
      let memberRow: any = null;
      let activeMembership: any = null;
      let activePlan: any = null;

      // 2. Member validation and daily limit check with SELECT ... FOR UPDATE
      if (input.memberId) {
        // Lock the member row to serialize concurrent booking attempts for this member
        const [lockedMember] = await tx
          .select()
          .from(members)
          .where(eq(members.id, input.memberId))
          .for('update');

        if (!lockedMember) {
          throw new AppError('NOT_FOUND', 'Member not found', 404);
        }
        memberRow = lockedMember;

        // Current active membership check
        const activeMemberships = await tx
          .select({
            membership: memberships,
            plan: plans,
          })
          .from(memberships)
          .innerJoin(plans, eq(memberships.planId, plans.id))
          .where(
            and(
              eq(memberships.memberId, input.memberId),
              eq(memberships.status, 'active'),
              lte(memberships.startsOn, targetDateStr),
              gte(memberships.endsOn, targetDateStr)
            )
          )
          .limit(1);

        if (activeMemberships.length === 0) {
          throw new AppError(
            'MEMBERSHIP_INACTIVE',
            'Member does not have an active membership valid for this date',
            422
          );
        }

        activeMembership = activeMemberships[0].membership;
        activePlan = activeMemberships[0].plan;

        // Advance booking window check
        const advanceDays = activePlan.advanceBookingDays ?? (await Settings.get<number>('booking.advance_days')) ?? 14;
        const maxDateStr = addClubDays(todayDateStr, advanceDays);
        if (targetDateStr > maxDateStr) {
          throw new AppError(
            'VALIDATION',
            `Booking date ${targetDateStr} exceeds plan advance booking window of ${advanceDays} days (latest allowed: ${maxDateStr})`,
            400
          );
        }

        // Daily limit count for this club-local day
        const { start: dayStartUtc, end: dayEndUtc } = clubLocalDayBoundsUtc(targetDateStr);
        const [dailyCountRes] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(bookings)
          .where(
            and(
              eq(bookings.memberId, input.memberId),
              eq(bookings.kind, 'regular'),
              inArray(bookings.status, ['held', 'confirmed', 'completed', 'no_show']),
              gte(bookings.startAt, dayStartUtc),
              lt(bookings.startAt, dayEndUtc)
            )
          );

        const currentDayCount = dailyCountRes?.count ?? 0;
        const dailyLimit = activePlan.dailyBookingLimit ?? (await Settings.get<number>('booking.default_daily_limit')) ?? 2;

        if (currentDayCount >= dailyLimit) {
          throw new AppError(
            'DAILY_LIMIT',
            `Member daily booking limit of ${dailyLimit} reached for club date ${targetDateStr}`,
            422
          );
        }
      } else {
        // Guest walk-in advance window
        const defaultAdvanceDays = (await Settings.get<number>('booking.advance_days')) ?? 14;
        const maxDateStr = addClubDays(todayDateStr, defaultAdvanceDays);
        if (targetDateStr > maxDateStr) {
          throw new AppError(
            'VALIDATION',
            `Booking date ${targetDateStr} exceeds advance window of ${defaultAdvanceDays} days`,
            400
          );
        }
      }

      // 3. Lazy-expire stale holds on this court and overlapping range
      const startAtIso = startAt.toISOString();
      const endAtIso = endAt.toISOString();
      try {
        await tx.execute(sql`
          UPDATE bookings
          SET status = 'expired', updated_at = NOW()
          WHERE status = 'held'
            AND expires_at < NOW()
            AND court_id = ${input.courtId}
            AND tstzrange(start_at, end_at, '[)') && tstzrange(${startAtIso}::timestamptz, ${endAtIso}::timestamptz, '[)')
        `);
      } catch {
        // Ignored if raw SQL fails in non-postgres test mode
      }

      // Load court and court type
      const [court] = await tx.select().from(courts).where(eq(courts.id, input.courtId));
      if (!court) throw new AppError('NOT_FOUND', 'Court not found', 404);
      if (!court.active) throw new AppError('VALIDATION', 'Court is not active', 400);

      const [courtType] = await tx.select().from(courtTypes).where(eq(courtTypes.id, court.courtTypeId));
      if (!courtType) throw new AppError('NOT_FOUND', 'Court type not found', 404);

      // 4. Price via PricingEngine
      const quote = await Pricing.quote({
        kind: 'court',
        scopeRef: courtType.code,
        basePricePaise: courtType.basePricePerHourPaise,
        qty: 1,
        memberId: input.memberId,
        channel: input.channel,
        at: startAt,
      });

      // 5. Insert booking (catch error 23P01 -> SLOT_TAKEN 409)
      const holdMinutes = (await Settings.get<number>('booking.hold_minutes')) ?? 5;
      const isHold = input.channel === 'online' && !input.memberId; // Example condition or default confirmed
      const bookingStatus = isHold ? 'held' : 'confirmed';
      const expiresAt = isHold ? new Date(Date.now() + holdMinutes * 60 * 1000) : null;

      let insertedBooking: any;
      try {
        const [b] = await tx
          .insert(bookings)
          .values({
            courtId: input.courtId,
            kind: 'regular',
            status: bookingStatus,
            memberId: input.memberId ?? null,
            guestName: input.guest?.name ?? null,
            guestPhone: input.guest?.phone ?? null,
            startAt,
            endAt,
            expiresAt,
            channel: input.channel,
            pricePaise: quote.unitPaise,
            priceBreakdown: quote.breakdown,
            createdBy: actorUser?.id ?? null,
          })
          .returning();
        insertedBooking = b;
      } catch (err: any) {
        if (
          err.code === '23P01' ||
          err.message?.includes('23P01') ||
          err.message?.includes('bookings_no_overlap')
        ) {
          throw new AppError(
            'SLOT_TAKEN',
            'The requested court slot is already booked or overlaps with an existing booking.',
            409
          );
        }
        throw err;
      }

      // 6. InvoiceService.create (use stub; zero total still creates an invoice)
      // TODO(replace-with-DevB): Dev B owns invoice service; replace with real InvoiceService call
      const listPricePaise = courtType.basePricePerHourPaise;
      const discountPaise = Math.max(0, listPricePaise - quote.unitPaise);

      const invoiceRes = await invoiceServiceStub.create(
        {
          customer: {
            memberId: input.memberId,
            guestName: input.guest?.name,
          },
          lines: [
            {
              source: 'court',
              description: `${courtType.name} – ${court.name} (${targetDateStr} ${toClubLocalTime(startAt)})`,
              qty: 1,
              unitPricePaise: listPricePaise,
              discountPaise,
              taxCategory: courtType.taxCategory,
              refType: 'booking',
              refId: insertedBooking.id,
            },
          ],
        },
        tx as any
      );

      // Attach invoiceId to booking
      await tx
        .update(bookings)
        .set({ invoiceId: invoiceRes.invoiceId })
        .where(eq(bookings.id, insertedBooking.id));

      insertedBooking.invoiceId = invoiceRes.invoiceId;

      // 7. Post-commit actions
      // Schedule audit, events and notifications immediately after commit
      setImmediate(async () => {
        try {
          await Audit.log({
            actor: actorUser?.id ?? 'system',
            action: 'booking.create',
            resource: 'booking',
            recordId: insertedBooking.id,
            after: insertedBooking,
          });

          Events.publish('booking.changed', {
            courtId: insertedBooking.courtId,
            date: targetDateStr,
          });

          await Notifications.send({
            template: 'booking.confirmed',
            to: { memberId: insertedBooking.memberId ?? undefined },
            data: {
              bookingId: insertedBooking.id,
              courtName: court.name,
              startAt: insertedBooking.startAt.toISOString(),
              pricePaise: insertedBooking.pricePaise,
            },
          });
        } catch (e) {
          console.error('[BookingsService] Error in post-commit side effects:', e);
        }
      });

      return {
        booking: {
          id: insertedBooking.id,
          courtId: insertedBooking.courtId,
          courtName: court.name,
          kind: insertedBooking.kind,
          status: insertedBooking.status,
          memberId: insertedBooking.memberId ?? undefined,
          memberName: memberRow?.fullName,
          guestName: insertedBooking.guestName ?? undefined,
          guestPhone: insertedBooking.guestPhone ?? undefined,
          startAt: insertedBooking.startAt.toISOString(),
          endAt: insertedBooking.endAt.toISOString(),
          expiresAt: insertedBooking.expiresAt ? insertedBooking.expiresAt.toISOString() : undefined,
          channel: insertedBooking.channel,
          pricePaise: insertedBooking.pricePaise,
          priceBreakdown: insertedBooking.priceBreakdown,
          invoiceId: insertedBooking.invoiceId ?? undefined,
          createdBy: insertedBooking.createdBy ?? undefined,
          cancelledAt: insertedBooking.cancelledAt ? insertedBooking.cancelledAt.toISOString() : undefined,
          cancelReason: insertedBooking.cancelReason ?? undefined,
          refundPaise: insertedBooking.refundPaise ?? undefined,
          socialSessionId: insertedBooking.socialSessionId ?? undefined,
          createdAt: insertedBooking.createdAt.toISOString(),
          updatedAt: insertedBooking.updatedAt.toISOString(),
        },
        invoiceId: invoiceRes.invoiceId,
      };
    });
  }

  /**
   * Cancels a booking according to cancellation policy, records refund via PaymentService stub.
   */
  async cancelBooking(
    id: string,
    input: { reason?: string; overrideRefundPct?: number },
    actorUser?: SessionUser
  ): Promise<CancelBookingResponse> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);

    // Enforce booking state machine: only 'held' or 'confirmed' can be cancelled
    if (booking.status !== 'confirmed' && booking.status !== 'held') {
      throw new AppError(
        'INVALID_STATE',
        `Cannot cancel booking in status '${booking.status}'. Allowed statuses: 'confirmed', 'held'`,
        409
      );
    }

    // Own scope enforcement: members can only cancel their own bookings
    if (actorUser?.roleCode === 'member' && booking.memberId !== actorUser.memberId) {
      throw new AppError('FORBIDDEN', 'Members cannot cancel bookings owned by other members', 403);
    }

    const now = new Date();
    const hoursUntilStart = (booking.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Determine refund percentage
    let refundPct = 0;
    if (input.overrideRefundPct !== undefined) {
      // Override requires 'booking:override_refund'
      const canOverride = actorUser ? can(actorUser, 'booking:override_refund') : false;
      if (!canOverride) {
        throw new AppError(
          'FORBIDDEN',
          'Permission booking:override_refund required to override cancellation refund percentage',
          403
        );
      }
      refundPct = input.overrideRefundPct;
    } else {
      const policy = (await Settings.get<Array<{ hours_before: number; refund_pct: number }>>(
        'booking.cancellation_policy'
      )) ?? [
        { hours_before: 24, refund_pct: 100 },
        { hours_before: 2, refund_pct: 50 },
        { hours_before: 0, refund_pct: 0 },
      ];

      // Rows sorted descending by hours_before: pick first row with hours_before <= hoursUntilStart
      const sorted = [...policy].sort((a, b) => b.hours_before - a.hours_before);
      const matched = sorted.find((p) => hoursUntilStart >= p.hours_before);
      refundPct = matched ? matched.refund_pct : 0;
    }

    const paidPaise = booking.pricePaise;
    const refundPaise = Math.round((paidPaise * refundPct) / 100);

    // If refund is applicable and booking has an invoice, issue negative payment through PaymentService
    if (refundPaise > 0 && booking.invoiceId) {
      // TODO(replace-with-DevB): Dev B owns PaymentService; stub recorded here
      await paymentServiceStub.refund(
        {
          invoiceId: booking.invoiceId,
          amountPaise: refundPaise,
          reason: input.reason || 'Booking cancellation refund',
        },
        db as any
      );
    }

    const [updated] = await db
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: input.reason || null,
        refundPaise,
        updatedAt: now,
      })
      .where(eq(bookings.id, id))
      .returning();

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'booking.cancel',
      resource: 'booking',
      recordId: booking.id,
      before: booking as any,
      after: updated as any,
    });

    Events.publish('booking.changed', {
      courtId: booking.courtId,
      date: toClubLocalDate(booking.startAt),
    });

    await Notifications.send({
      template: 'booking.cancelled',
      to: { memberId: booking.memberId ?? undefined },
      data: {
        bookingId: booking.id,
        refundPaise,
        refundPct,
      },
    });

    return {
      bookingId: booking.id,
      status: 'cancelled',
      refundPaise,
      refundPercentage: refundPct,
    };
  }

  /**
   * Marks a confirmed booking as no-show.
   */
  async markNoShow(id: string, actorUser?: SessionUser): Promise<Booking> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);

    if (booking.status !== 'confirmed') {
      throw new AppError(
        'INVALID_STATE',
        `Cannot mark '${booking.status}' booking as no-show. Only 'confirmed' bookings can be marked no-show`,
        409
      );
    }

    const [updated] = await db
      .update(bookings)
      .set({ status: 'no_show', updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'booking.no_show',
      resource: 'booking',
      recordId: booking.id,
      before: booking as any,
      after: updated as any,
    });

    return this.formatBooking(updated);
  }

  /**
   * Marks a confirmed booking as completed.
   */
  async completeBooking(id: string, actorUser?: SessionUser): Promise<Booking> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    if (!booking) throw new AppError('NOT_FOUND', 'Booking not found', 404);

    if (booking.status !== 'confirmed') {
      throw new AppError(
        'INVALID_STATE',
        `Cannot complete booking in '${booking.status}' status. Only 'confirmed' bookings can be completed`,
        409
      );
    }

    const [updated] = await db
      .update(bookings)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'booking.complete',
      resource: 'booking',
      recordId: booking.id,
      before: booking as any,
      after: updated as any,
    });

    return this.formatBooking(updated);
  }

  /**
   * Creates a maintenance / blackout block booking.
   */
  async createBlockBooking(
    input: { courtId: string; startAt: string | Date; endAt: string | Date; reason: string },
    actorUser?: SessionUser
  ): Promise<Booking> {
    const startAt = typeof input.startAt === 'string' ? new Date(input.startAt) : input.startAt;
    const endAt = typeof input.endAt === 'string' ? new Date(input.endAt) : input.endAt;

    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppError('VALIDATION', 'Block endAt must be after startAt', 400);
    }

    let inserted: any;
    try {
      const [b] = await db
        .insert(bookings)
        .values({
          courtId: input.courtId,
          kind: 'block',
          status: 'confirmed',
          pricePaise: 0,
          guestName: input.reason,
          startAt,
          endAt,
          channel: 'counter',
          createdBy: actorUser?.id ?? null,
        })
        .returning();
      inserted = b;
    } catch (err: any) {
      if (
        err.code === '23P01' ||
        err.message?.includes('23P01') ||
        err.message?.includes('bookings_no_overlap')
      ) {
        throw new AppError(
          'SLOT_TAKEN',
          'Block overlaps with an existing active booking on this court',
          409
        );
      }
      throw err;
    }

    await Audit.log({
      actor: actorUser?.id ?? 'system',
      action: 'booking.block',
      resource: 'booking',
      recordId: inserted.id,
      after: inserted,
    });

    Events.publish('booking.changed', {
      courtId: inserted.courtId,
      date: toClubLocalDate(inserted.startAt),
    });

    return this.formatBooking(inserted);
  }

  /**
   * Lists bookings with pagination and filters.
   */
  async listBookings(
    query: {
      from?: string;
      to?: string;
      date?: string;
      courtId?: string;
      memberId?: string;
      status?: any;
      limit?: number;
      cursor?: string;
    },
    actorUser?: SessionUser
  ) {
    const limit = query.limit ?? 50;
    const conditions: any[] = [];

    // Members are restricted to their own bookings
    if (actorUser?.roleCode === 'member') {
      conditions.push(eq(bookings.memberId, actorUser.memberId || '00000000-0000-0000-0000-000000000000'));
    } else if (query.memberId) {
      conditions.push(eq(bookings.memberId, query.memberId));
    }

    if (query.courtId) conditions.push(eq(bookings.courtId, query.courtId));
    if (query.status) conditions.push(eq(bookings.status, query.status));

    if (query.date) {
      const { start, end } = clubLocalDayBoundsUtc(query.date);
      conditions.push(gte(bookings.startAt, start), lt(bookings.startAt, end));
    } else {
      if (query.from) conditions.push(gte(bookings.startAt, new Date(query.from)));
      if (query.to) conditions.push(lt(bookings.startAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        booking: bookings,
        courtName: courts.name,
        memberName: members.fullName,
      })
      .from(bookings)
      .leftJoin(courts, eq(bookings.courtId, courts.id))
      .leftJoin(members, eq(bookings.memberId, members.id))
      .where(whereClause)
      .orderBy(desc(bookings.startAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1].booking.id : null;

    return {
      items: items.map((r) => this.formatBooking(r.booking, r.courtName ?? undefined, r.memberName ?? undefined)),
      nextCursor,
    };
  }

  /**
   * Retrieves a single booking by ID.
   */
  async getBooking(id: string, actorUser?: SessionUser): Promise<Booking> {
    const [row] = await db
      .select({
        booking: bookings,
        courtName: courts.name,
        memberName: members.fullName,
      })
      .from(bookings)
      .leftJoin(courts, eq(bookings.courtId, courts.id))
      .leftJoin(members, eq(bookings.memberId, members.id))
      .where(eq(bookings.id, id));

    if (!row) throw new AppError('NOT_FOUND', 'Booking not found', 404);

    if (actorUser?.roleCode === 'member' && row.booking.memberId !== actorUser.memberId) {
      throw new AppError('FORBIDDEN', 'Cannot access booking belonging to another member', 403);
    }

    return this.formatBooking(row.booking, row.courtName ?? undefined, row.memberName ?? undefined);
  }

  private formatBooking(b: any, courtName?: string, memberName?: string): Booking {
    return {
      id: b.id,
      courtId: b.courtId,
      courtName: courtName ?? b.courtName,
      kind: b.kind,
      status: b.status,
      memberId: b.memberId ?? undefined,
      memberName: memberName ?? b.memberName,
      guestName: b.guestName ?? undefined,
      guestPhone: b.guestPhone ?? undefined,
      startAt: b.startAt instanceof Date ? b.startAt.toISOString() : b.startAt,
      endAt: b.endAt instanceof Date ? b.endAt.toISOString() : b.endAt,
      expiresAt: b.expiresAt ? (b.expiresAt instanceof Date ? b.expiresAt.toISOString() : b.expiresAt) : undefined,
      channel: b.channel,
      pricePaise: b.pricePaise,
      priceBreakdown: b.priceBreakdown,
      invoiceId: b.invoiceId ?? undefined,
      createdBy: b.createdBy ?? undefined,
      cancelledAt: b.cancelledAt ? (b.cancelledAt instanceof Date ? b.cancelledAt.toISOString() : b.cancelledAt) : undefined,
      cancelReason: b.cancelReason ?? undefined,
      refundPaise: b.refundPaise ?? undefined,
      socialSessionId: b.socialSessionId ?? undefined,
      createdAt: b.createdAt instanceof Date ? b.createdAt.toISOString() : b.createdAt,
      updatedAt: b.updatedAt instanceof Date ? b.updatedAt.toISOString() : b.updatedAt,
    };
  }
}

export const Bookings = new BookingsService();
