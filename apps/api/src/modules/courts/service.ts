// Owner: Dev A – Phase 6: Courts & Availability Service
import { eq, and, sql, asc, inArray, gte, lt } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { courts, courtTypes, bookings, socialSessions, socialSignups } from '../../db/schema/courts.js';
import { members } from '../../db/schema/members.js';
import {
  Court,
  CourtType,
  CourtWithPublicSlots,
  CourtWithStaffSlots,
  PublicSlot,
  StaffSlot,
} from '@club/contract';
import {
  clubLocalDayBoundsUtc,
  localToUtc,
  toClubLocalDate,
} from '../../core/clubTime.js';
import { Settings } from '../../core/settings.js';
import { AppError } from '../../core/errors.js';

export class CourtsService {
  /**
   * Returns all active/configured court types.
   */
  async listCourtTypes(): Promise<CourtType[]> {
    try {
      const rows = await db.select().from(courtTypes).orderBy(asc(courtTypes.name));
      return rows.map((r) => ({
        id: r.id,
        code: r.code,
        name: r.name,
        basePricePerHourPaise: r.basePricePerHourPaise,
        taxCategory: r.taxCategory,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Updates an existing court type.
   */
  async updateCourtType(
    id: string,
    input: { name?: string; basePricePerHourPaise?: number; taxCategory?: string }
  ): Promise<CourtType> {
    const [existing] = await db.select().from(courtTypes).where(eq(courtTypes.id, id));
    if (!existing) throw new AppError('NOT_FOUND', 'Court type not found', 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.basePricePerHourPaise !== undefined) updates.basePricePerHourPaise = input.basePricePerHourPaise;
    if (input.taxCategory !== undefined) updates.taxCategory = input.taxCategory;

    const [updated] = await db
      .update(courtTypes)
      .set(updates as any)
      .where(eq(courtTypes.id, id))
      .returning();

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      basePricePerHourPaise: updated.basePricePerHourPaise,
      taxCategory: updated.taxCategory,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Lists courts, optionally filtered by court type code.
   */
  async listCourts(courtTypeCode?: string): Promise<Court[]> {
    try {
      const query = db
        .select({
          id: courts.id,
          courtTypeId: courts.courtTypeId,
          courtTypeCode: courtTypes.code,
          courtTypeName: courtTypes.name,
          name: courts.name,
          active: courts.active,
          sortOrder: courts.sortOrder,
          createdAt: courts.createdAt,
          updatedAt: courts.updatedAt,
        })
        .from(courts)
        .innerJoin(courtTypes, eq(courts.courtTypeId, courtTypes.id))
        .orderBy(asc(courts.sortOrder), asc(courts.name));

      const rows = await query;
      const filtered = courtTypeCode
        ? rows.filter((r) => r.courtTypeCode.toLowerCase() === courtTypeCode.toLowerCase())
        : rows;

      return filtered.map((r) => ({
        id: r.id,
        courtTypeId: r.courtTypeId,
        courtTypeCode: r.courtTypeCode,
        courtTypeName: r.courtTypeName,
        name: r.name,
        active: r.active,
        sortOrder: r.sortOrder,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Creates a new court.
   */
  async createCourt(input: {
    courtTypeId: string;
    name: string;
    sortOrder?: number;
    active?: boolean;
  }): Promise<Court> {
    const [ct] = await db.select().from(courtTypes).where(eq(courtTypes.id, input.courtTypeId));
    if (!ct) throw new AppError('NOT_FOUND', 'Court type not found', 404);

    const [row] = await db
      .insert(courts)
      .values({
        courtTypeId: input.courtTypeId,
        name: input.name,
        sortOrder: input.sortOrder ?? 0,
        active: input.active ?? true,
      })
      .returning();

    return {
      id: row.id,
      courtTypeId: row.courtTypeId,
      courtTypeCode: ct.code,
      courtTypeName: ct.name,
      name: row.name,
      active: row.active,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Updates an existing court.
   */
  async updateCourt(
    id: string,
    input: { name?: string; courtTypeId?: string; active?: boolean; sortOrder?: number }
  ): Promise<Court> {
    const [existing] = await db.select().from(courts).where(eq(courts.id, id));
    if (!existing) throw new AppError('NOT_FOUND', 'Court not found', 404);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.courtTypeId !== undefined) {
      const [ct] = await db.select().from(courtTypes).where(eq(courtTypes.id, input.courtTypeId));
      if (!ct) throw new AppError('NOT_FOUND', 'Court type not found', 404);
      updates.courtTypeId = input.courtTypeId;
    }
    if (input.active !== undefined) updates.active = input.active;
    if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

    const [updated] = await db.update(courts).set(updates as any).where(eq(courts.id, id)).returning();
    const [ct] = await db.select().from(courtTypes).where(eq(courtTypes.id, updated.courtTypeId));

    return {
      id: updated.id,
      courtTypeId: updated.courtTypeId,
      courtTypeCode: ct?.code,
      courtTypeName: ct?.name,
      name: updated.name,
      active: updated.active,
      sortOrder: updated.sortOrder,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  /**
   * Builds the single shared availability grid for a given date.
   * If isStaff is true, includes bookedBy details & bookingId.
   * If isStaff is false, strictly strips all personal data (public view).
   */
  async getAvailability(
    dateStr: string,
    courtTypeCode?: string,
    isStaff = false
  ): Promise<{ date: string; courts: CourtWithStaffSlots[] | CourtWithPublicSlots[] }> {
    const allCourts = await this.listCourts(courtTypeCode);
    if (allCourts.length === 0) {
      return { date: dateStr, courts: [] };
    }

    const courtIds = allCourts.map((c) => c.id);
    const { start: dayStartUtc, end: dayEndUtc } = clubLocalDayBoundsUtc(dateStr);

    // Fetch active bookings that overlap this day
    let activeBookings: Array<{
      id: string;
      courtId: string;
      kind: string;
      status: string;
      startAt: Date;
      endAt: Date;
      memberId: string | null;
      memberName: string | null;
      guestName: string | null;
      guestPhone: string | null;
      memberPhone: string | null;
      channel: string;
    }> = [];

    try {
      const bRows = await db
        .select({
          id: bookings.id,
          courtId: bookings.courtId,
          kind: bookings.kind,
          status: bookings.status,
          startAt: bookings.startAt,
          endAt: bookings.endAt,
          memberId: bookings.memberId,
          memberName: members.fullName,
          guestName: bookings.guestName,
          guestPhone: bookings.guestPhone,
          memberPhone: members.phone,
          channel: bookings.channel,
        })
        .from(bookings)
        .leftJoin(members, eq(bookings.memberId, members.id))
        .where(
          and(
            inArray(bookings.courtId, courtIds),
            inArray(bookings.status, ['held', 'confirmed', 'completed', 'no_show']),
            lt(bookings.startAt, dayEndUtc),
            gte(bookings.endAt, dayStartUtc)
          )
        );
      activeBookings = bRows;
    } catch {
      activeBookings = [];
    }

    // Fetch active social sessions on this day
    let activeSocialSessions: Array<{
      id: string;
      courtId: string;
      startAt: Date;
      endAt: Date;
      capacity: number;
      pricePerHeadPaise: number;
      title: string;
      status: string;
      confirmedCount: number;
    }> = [];

    try {
      const sRows = await db
        .select({
          id: socialSessions.id,
          courtId: socialSessions.courtId,
          startAt: socialSessions.startAt,
          endAt: socialSessions.endAt,
          capacity: socialSessions.capacity,
          pricePerHeadPaise: socialSessions.pricePerHeadPaise,
          title: socialSessions.title,
          status: socialSessions.status,
          confirmedCount: sql<number>`COALESCE((
            SELECT count(*)::int FROM ${socialSignups} 
            WHERE ${socialSignups.sessionId} = ${socialSessions.id} 
              AND ${socialSignups.status} = 'confirmed'
          ), 0)`,
        })
        .from(socialSessions)
        .where(
          and(
            inArray(socialSessions.courtId, courtIds),
            eq(socialSessions.status, 'open'),
            lt(socialSessions.startAt, dayEndUtc),
            gte(socialSessions.endAt, dayStartUtc)
          )
        );
      activeSocialSessions = sRows;
    } catch {
      activeSocialSessions = [];
    }

    // Parse club operating hours: 06:00 to 22:00 in half-hour steps
    // 06:00, 06:30, ..., 21:00 (last 60-min session starts at 21:00 and ends at 22:00)
    const slotMinutes = (await Settings.get<number>('booking.slot_minutes')) ?? 30;
    const sessionMinutes = (await Settings.get<number>('booking.session_minutes')) ?? 60;
    const [year, month, day] = dateStr.split('-').map(Number);

    // Generate slot start times: 6:00 AM to 9:30 PM (21:30)
    // 6 * 60 = 360 min; 21 * 60 + 30 = 1290 min
    const slotTimes: Array<{ start: Date; end: Date }> = [];
    for (let m = 6 * 60; m <= 21 * 60 + 30; m += slotMinutes) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      const start = localToUtc(year, month, day, hour, minute);
      const end = new Date(start.getTime() + sessionMinutes * 60 * 1000);
      slotTimes.push({ start, end });
    }

    const resultCourts: any[] = [];

    for (const court of allCourts) {
      const courtBookings = activeBookings.filter((b) => b.courtId === court.id);
      const courtSocials = activeSocialSessions.filter((s) => s.courtId === court.id);

      const slots: any[] = [];

      for (const slot of slotTimes) {
        const slotStartMs = slot.start.getTime();
        const slotEndMs = slot.end.getTime();

        // Check if any booking overlaps with this slot: [b.start, b.end) overlaps with [slot.start, slot.end)
        const overlappingBooking = courtBookings.find(
          (b) => b.startAt.getTime() < slotEndMs && b.endAt.getTime() > slotStartMs
        );

        // Check social session overlap
        const overlappingSocial = courtSocials.find(
          (s) => s.startAt.getTime() < slotEndMs && s.endAt.getTime() > slotStartMs
        );

        let status: 'free' | 'taken' | 'social' | 'held' | 'blocked' = 'free';
        let socialMeta: any = undefined;

        if (overlappingSocial) {
          status = 'social';
          socialMeta = {
            sessionId: overlappingSocial.id,
            title: overlappingSocial.title,
            capacity: overlappingSocial.capacity,
            spotsLeft: Math.max(0, overlappingSocial.capacity - overlappingSocial.confirmedCount),
            pricePerHeadPaise: overlappingSocial.pricePerHeadPaise,
          };
        } else if (overlappingBooking) {
          if (overlappingBooking.kind === 'block') {
            status = 'blocked';
          } else if (overlappingBooking.kind === 'social') {
            status = 'social';
          } else if (overlappingBooking.status === 'held') {
            status = 'held';
          } else {
            status = 'taken';
          }
        }

        const baseSlot: PublicSlot = {
          courtId: court.id,
          courtName: court.name,
          startAt: slot.start.toISOString(),
          endAt: slot.end.toISOString(),
          status,
          ...(socialMeta ? { social: socialMeta } : {}),
        };

        if (isStaff) {
          const staffSlot: StaffSlot = {
            ...baseSlot,
            ...(overlappingBooking
              ? {
                  bookingId: overlappingBooking.id,
                  bookedBy: {
                    memberId: overlappingBooking.memberId ?? undefined,
                    memberName: overlappingBooking.memberName ?? undefined,
                    guestName: overlappingBooking.guestName ?? undefined,
                    phone: overlappingBooking.guestPhone ?? overlappingBooking.memberPhone ?? undefined,
                    channel: overlappingBooking.channel,
                  },
                }
              : {}),
          };
          slots.push(staffSlot);
        } else {
          slots.push(baseSlot);
        }
      }

      resultCourts.push({
        court,
        slots,
      });
    }

    return {
      date: dateStr,
      courts: resultCourts,
    };
  }
}

export const Courts = new CourtsService();
