// Owner: Dev A – Phase 6: Social Play Service
import { eq, and, sql, asc, gte, lt } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { socialSessions, socialSignups, courts, bookings } from '../../db/schema/courts.js';
import { members } from '../../db/schema/members.js';
import {
  SocialSession,
  SocialSignup,
  SessionUser,
} from '@club/contract';
import { clubLocalDayBoundsUtc, toClubLocalDate } from '../../core/clubTime.js';
import { invoiceServiceStub } from '../../core/stubs/finance.js';
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

      if (confirmedCount < session.capacity) {
        // Confirmed signup
        const position = confirmedCount + 1;

        // Invoice creation (TODO: Dev B replace)
        const inv = await invoiceServiceStub.create(
          {
            customer: { memberId },
            lines: [
              {
                source: 'social',
                description: `Social Session: ${session.title}`,
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
   * Cancels a member's signup and promotes the next waitlisted member if confirmed was cancelled.
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
          await tx
            .update(socialSignups)
            .set({ status: 'confirmed' })
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

      return {
        success: true,
        promotedMemberId,
      };
    });
  }
}

export const Social = new SocialService();
