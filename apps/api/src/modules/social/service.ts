// Owner: Dev A – Phase 7: Social Play Service
import { eq, and, sql, asc, gte, lt, lte } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { socialSessions, socialSignups, courts, courtTypes, bookings } from '../../db/schema/courts.js';
import { members, memberships } from '../../db/schema/members.js';
import {
  SocialSession,
  SocialSignup,
  SessionUser,
} from '@club/contract';
import { clubLocalDayBoundsUtc, toClubLocalDate } from '../../core/clubTime.js';
import { invoiceServiceStub, paymentServiceStub } from '../../core/stubs/finance.js';
import { Pricing } from '../pricing/index.js';
import { Settings } from '../../core/settings.js';
import { Audit } from '../../core/audit.js';
import { Events } from '../../core/events.js';
import { Notifications } from '../../core/notifications.js';
import { AppError } from '../../core/errors.js';

export class SocialService {
  /**
   * Lists social sessions with confirmed and waitlist counts.
   */
  async listSessions(query: { from?: string; to?: string; date?: string }): Promise<SocialSession[]> {
    const conditions: any[] = [];
    if (query.date) {
      const { start, end } = clubLocalDayBoundsUtc(query.date);
      conditions.push(gte(socialSessions.startAt, start), lt(socialSessions.startAt, end));
    } else {
      if (query.from) conditions.push(gte(socialSessions.startAt, new Date(query.from)));
      if (query.to) conditions.push(lt(socialSessions.startAt, new Date(query.to)));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const rows = await db
      .select({
        session: socialSessions,
        courtName: courts.name,
        confirmedCount: sql<number>`COALESCE((
          SELECT count(*)::int FROM ${socialSignups}
          WHERE ${socialSignups.sessionId} = ${socialSessions.id}
            AND ${socialSignups.status} = 'confirmed'
        ), 0)`,
        waitlistCount: sql<number>`COALESCE((
          SELECT count(*)::int FROM ${socialSignups}
          WHERE ${socialSignups.sessionId} = ${socialSessions.id}
            AND ${socialSignups.status} = 'waitlisted'
        ), 0)`,
      })
      .from(socialSessions)
      .leftJoin(courts, eq(socialSessions.courtId, courts.id))
      .where(whereClause)
      .orderBy(asc(socialSessions.startAt));

    return rows.map((r) => ({
      id: r.session.id,
      courtId: r.session.courtId,
      courtName: r.courtName ?? undefined,
      startAt: r.session.startAt.toISOString(),
      endAt: r.session.endAt.toISOString(),
      capacity: r.session.capacity,
      pricePerHeadPaise: r.session.pricePerHeadPaise,
      title: r.session.title,
      status: r.session.status as any,
      bookingId: r.session.bookingId ?? undefined,
      confirmedCount: r.confirmedCount,
      waitlistCount: r.waitlistCount,
      createdAt: r.session.createdAt.toISOString(),
      updatedAt: r.session.updatedAt.toISOString(),
    }));
  }

  /**
   * Creates a social session and an associated booking row covering the entire window.
   */
  async createSession(
    input: {
      courtId: string;
      startAt: string | Date;
      endAt: string | Date;
      capacity: number;
      pricePerHeadPaise: number;
      title: string;
    },
    actorUser?: SessionUser
  ): Promise<SocialSession> {
    const startAt = typeof input.startAt === 'string' ? new Date(input.startAt) : input.startAt;
    const endAt = typeof input.endAt === 'string' ? new Date(input.endAt) : input.endAt;

    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppError('VALIDATION', 'endAt must be after startAt', 400);
    }

    return await db.transaction(async (tx) => {
      // 1. Create blocking booking row with kind = 'social'
      let bookingRow: any;
      try {
        const [b] = await tx
          .insert(bookings)
          .values({
            courtId: input.courtId,
            kind: 'social',
            status: 'confirmed',
            pricePaise: 0,
            guestName: input.title,
            startAt,
            endAt,
            channel: 'counter',
            createdBy: actorUser?.id ?? null,
          })
          .returning();
        bookingRow = b;
      } catch (err: any) {
        if (
          err.code === '23P01' ||
          err.message?.includes('23P01') ||
          err.message?.includes('bookings_no_overlap')
        ) {
          throw new AppError(
            'SLOT_TAKEN',
            'Cannot create social session: court is already booked in this time window.',
            409
          );
        }
        throw err;
      }

      // 2. Create social session row
      const [session] = await tx
        .insert(socialSessions)
        .values({
          courtId: input.courtId,
          startAt,
          endAt,
          capacity: input.capacity,
          pricePerHeadPaise: input.pricePerHeadPaise,
          title: input.title,
          status: 'open',
          bookingId: bookingRow.id,
        })
        .returning();

      // Link booking to social session
      await tx
        .update(bookings)
        .set({ socialSessionId: session.id })
        .where(eq(bookings.id, bookingRow.id));

      await Audit.log({
        actor: actorUser?.id ?? 'system',
        action: 'social_session.create',
        resource: 'social_session',
        recordId: session.id,
        after: session,
      });

      Events.publish('booking.changed', {
        courtId: session.courtId,
        date: toClubLocalDate(session.startAt),
      });

      const [court] = await tx.select().from(courts).where(eq(courts.id, session.courtId));

      return {
        id: session.id,
        courtId: session.courtId,
        courtName: court?.name,
        startAt: session.startAt.toISOString(),
        endAt: session.endAt.toISOString(),
        capacity: session.capacity,
        pricePerHeadPaise: session.pricePerHeadPaise,
        title: session.title,
        status: session.status as any,
        bookingId: session.bookingId ?? undefined,
        confirmedCount: 0,
        waitlistCount: 0,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
      };
    });
  }

  /**
   * Signs up a member for a social session (auto-confirms if under capacity, else waitlists).
   * Verifies member is active and checks duplicate signups.
   */
  async signup(
    sessionId: string,
    memberId: string,
    actorUser?: SessionUser
  ): Promise<{ signup: SocialSignup; invoiceId?: string }> {
    return await db.transaction(async (tx) => {
      // Lock session row to ensure atomic capacity counting
      const [session] = await tx
        .select()
        .from(socialSessions)
        .where(eq(socialSessions.id, sessionId))
        .for('update');

      if (!session) throw new AppError('NOT_FOUND', 'Social session not found', 404);
      if (session.status !== 'open') {
        throw new AppError('INVALID_STATE', `Social session is '${session.status}'`, 409);
      }

      const [member] = await tx.select().from(members).where(eq(members.id, memberId));
      if (!member) throw new AppError('NOT_FOUND', 'Member not found', 404);

      // Check active membership
      const targetDateStr = toClubLocalDate(session.startAt);
      const activeMemberships = await tx
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.memberId, memberId),
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

      // Check for existing active signup
      const [existing] = await tx
        .select()
        .from(socialSignups)
        .where(
          and(
            eq(socialSignups.sessionId, sessionId),
            eq(socialSignups.memberId, memberId),
            sql`${socialSignups.status} IN ('confirmed', 'waitlisted')`
          )
        );

      if (existing) {
        throw new AppError('VALIDATION', 'Member is already signed up or waitlisted for this session', 400);
      }

      // Count confirmed signups
      const [confirmedRes] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(socialSignups)
        .where(and(eq(socialSignups.sessionId, sessionId), eq(socialSignups.status, 'confirmed')));

      const confirmedCount = confirmedRes?.count ?? 0;
      let invoiceId: string | undefined = undefined;

      // Price quote via PricingEngine
      const quote = await Pricing.quote({
        kind: 'social',
        scopeRef: 'social',
        basePricePaise: session.pricePerHeadPaise,
        qty: 1,
        memberId,
        channel: 'counter',
        at: session.startAt,
      });

      if (confirmedCount < session.capacity) {
        // Confirmed signup
        const position = confirmedCount + 1;

        // Invoice creation with line source 'social'
        // TODO(replace-with-DevB): In-memory stub used until Dev B delivers real finance service
        const inv = await invoiceServiceStub.create(
          {
            customer: { memberId },
            lines: [
              {
                source: 'social',
                description: `Social Session: ${session.title}`,
                qty: 1,
                unitPricePaise: session.pricePerHeadPaise,
                discountPaise: Math.max(0, session.pricePerHeadPaise - quote.unitPaise),
                taxCategory: 'standard',
                refType: 'social_session',
                refId: session.id,
              },
            ],
          },
          tx as any
        );
        invoiceId = inv.invoiceId;

        const [signup] = await tx
          .insert(socialSignups)
          .values({
            sessionId,
            memberId,
            status: 'confirmed',
            position,
            invoiceId,
          })
          .returning();

        await Audit.log({
          actor: actorUser?.id ?? 'system',
          action: 'social_signup.create',
          resource: 'social_signup',
          recordId: signup.id,
          after: signup,
        });

        Events.publish('booking.changed', {
          courtId: session.courtId,
          date: targetDateStr,
        });

        return {
          signup: {
            id: signup.id,
            sessionId: signup.sessionId,
            memberId: signup.memberId,
            memberName: member.fullName,
            status: 'confirmed',
            position: signup.position,
            invoiceId,
            createdAt: signup.createdAt.toISOString(),
          },
          invoiceId,
        };
      } else {
        // Waitlisted signup
        const [waitlistRes] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(socialSignups)
          .where(and(eq(socialSignups.sessionId, sessionId), eq(socialSignups.status, 'waitlisted')));

        const waitlistCount = waitlistRes?.count ?? 0;
        const position = waitlistCount + 1;

        const [signup] = await tx
          .insert(socialSignups)
          .values({
            sessionId,
            memberId,
            status: 'waitlisted',
            position,
          })
          .returning();

        await Audit.log({
          actor: actorUser?.id ?? 'system',
          action: 'social_signup.waitlist',
          resource: 'social_signup',
          recordId: signup.id,
          after: signup,
        });

        Events.publish('booking.changed', {
          courtId: session.courtId,
          date: targetDateStr,
        });

        return {
          signup: {
            id: signup.id,
            sessionId: signup.sessionId,
            memberId: signup.memberId,
            memberName: member.fullName,
            status: 'waitlisted',
            position: signup.position,
            createdAt: signup.createdAt.toISOString(),
          },
        };
      }
    });
  }

  /**
   * Cancels a member's signup and promotes the next waitlisted member in the same transaction.
   * If confirmed signup was cancelled, refunds through policy and PaymentService stub.
   */
  async cancelSignup(
    sessionId: string,
    memberId: string,
    actorUser?: SessionUser
  ): Promise<{ success: boolean; promotedMemberId?: string | null }> {
    return await db.transaction(async (tx) => {
      // Lock session row
      const [session] = await tx
        .select()
        .from(socialSessions)
        .where(eq(socialSessions.id, sessionId))
        .for('update');

      if (!session) throw new AppError('NOT_FOUND', 'Social session not found', 404);

      const [signup] = await tx
        .select()
        .from(socialSignups)
        .where(
          and(
            eq(socialSignups.sessionId, sessionId),
            eq(socialSignups.memberId, memberId),
            sql`${socialSignups.status} IN ('confirmed', 'waitlisted')`
          )
        );

      if (!signup) {
        throw new AppError('NOT_FOUND', 'Active signup not found for this member and session', 404);
      }

      const wasConfirmed = signup.status === 'confirmed';

      // Refund calculation if was confirmed
      if (wasConfirmed) {
        const now = new Date();
        const hoursUntilStart = (session.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

        const policy = (await Settings.get<Array<{ hours_before: number; refund_pct: number }>>(
          'booking.cancellation_policy'
        )) ?? [
          { hours_before: 24, refund_pct: 100 },
          { hours_before: 2, refund_pct: 50 },
          { hours_before: 0, refund_pct: 0 },
        ];

        const sorted = [...policy].sort((a, b) => b.hours_before - a.hours_before);
        const matched = sorted.find((p) => hoursUntilStart >= p.hours_before);
        const refundPct = matched ? matched.refund_pct : 0;
        const refundPaise = Math.round((session.pricePerHeadPaise * refundPct) / 100);

        if (refundPaise > 0 && signup.invoiceId) {
          // TODO(replace-with-DevB): Dev B owns PaymentService; recorded via stub
          await paymentServiceStub.refund(
            {
              invoiceId: signup.invoiceId,
              amountPaise: refundPaise,
              reason: 'Social session signup cancellation refund',
            },
            tx as any
          );
        }
      }

      await tx
        .update(socialSignups)
        .set({ status: 'cancelled' })
        .where(eq(socialSignups.id, signup.id));

      await Audit.log({
        actor: actorUser?.id ?? 'system',
        action: 'social_signup.cancel',
        resource: 'social_signup',
        recordId: signup.id,
        before: signup,
      });

      let promotedMemberId: string | null = null;

      // If a confirmed signup was cancelled, promote first waitlisted member
      if (wasConfirmed) {
        const [nextInLine] = await tx
          .select()
          .from(socialSignups)
          .where(and(eq(socialSignups.sessionId, sessionId), eq(socialSignups.status, 'waitlisted')))
          .orderBy(asc(socialSignups.position))
          .limit(1);

        if (nextInLine) {
          promotedMemberId = nextInLine.memberId;

          // Create invoice for promoted member
          const inv = await invoiceServiceStub.create(
            {
              customer: { memberId: promotedMemberId },
              lines: [
                {
                  source: 'social',
                  description: `Social Session: ${session.title} (Promoted from waitlist)`,
                  qty: 1,
                  unitPricePaise: session.pricePerHeadPaise,
                  taxCategory: 'standard',
                  refType: 'social_session',
                  refId: session.id,
                },
              ],
            },
            tx as any
          );

          await tx
            .update(socialSignups)
            .set({ status: 'confirmed', invoiceId: inv.invoiceId })
            .where(eq(socialSignups.id, nextInLine.id));

          await Notifications.send({
            template: 'booking.confirmed',
            to: { memberId: promotedMemberId },
            data: {
              title: `Promoted from waitlist for ${session.title}!`,
              sessionId: session.id,
            },
          });
        }
      }

      Events.publish('booking.changed', {
        courtId: session.courtId,
        date: toClubLocalDate(session.startAt),
      });

      return {
        success: true,
        promotedMemberId,
      };
    });
  }
}

export const Social = new SocialService();
