// Owner: Dev A – Phase 6: Courts + Bookings seed
// Seeds 8 courts (3 tennis, 2 padel, 2 badminton, 1 cricket)
// Seeds realistic bookings relative to "now":
// - Tonight 6 to 9 pm nearly full with 3 free slots
// - Past completed bookings
// - Cancelled bookings with refund
// - Friday social session with capacity 16 (14 confirmed, 2 waitlisted)
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { courtTypes, courts, bookings, socialSessions, socialSignups } from '../schema/courts.js';
import { members } from '../schema/members.js';
import { clubLocalToday, localToUtc, addClubDays, toClubLocalWeekday } from '../../core/clubTime.js';

export async function seedCourts() {
  console.log('[Seed:courts] Starting courts and bookings seed...');

  // 1. Seed Court Types
  const typeDefs = [
    { code: 'tennis',    name: 'Tennis Court',    basePricePerHourPaise: 150000, taxCategory: 'standard' },
    { code: 'padel',     name: 'Padel Court',     basePricePerHourPaise: 200000, taxCategory: 'standard' },
    { code: 'badminton', name: 'Badminton Court',  basePricePerHourPaise: 100000, taxCategory: 'standard' },
    { code: 'cricket',   name: 'Cricket Nets',    basePricePerHourPaise: 120000, taxCategory: 'standard' },
  ];

  for (const t of typeDefs) {
    const existing = await db.select().from(courtTypes).where(eq(courtTypes.code, t.code)).limit(1);
    if (existing.length === 0) {
      await db.insert(courtTypes).values({
        id: randomUUID(),
        code: t.code,
        name: t.name,
        basePricePerHourPaise: t.basePricePerHourPaise,
        taxCategory: t.taxCategory,
      });
    }
  }

  const allTypes = await db.select().from(courtTypes);
  const typeMap = new Map(allTypes.map((t) => [t.code, t.id]));

  // 2. Seed 8 Courts: tennis x3, padel x2, badminton x2, cricket nets x1
  const courtDefs = [
    { typeCode: 'tennis',    name: 'Centre Court (Tennis 1)', sortOrder: 1 },
    { typeCode: 'tennis',    name: 'Court 2 (Tennis 2)',      sortOrder: 2 },
    { typeCode: 'tennis',    name: 'Court 3 (Tennis 3)',      sortOrder: 3 },
    { typeCode: 'padel',     name: 'Padel Court 1',           sortOrder: 4 },
    { typeCode: 'padel',     name: 'Padel Court 2',           sortOrder: 5 },
    { typeCode: 'badminton', name: 'Badminton Court 1',       sortOrder: 6 },
    { typeCode: 'badminton', name: 'Badminton Court 2',       sortOrder: 7 },
    { typeCode: 'cricket',   name: 'Cricket Net 1',           sortOrder: 8 },
  ];

  for (const c of courtDefs) {
    const typeId = typeMap.get(c.typeCode);
    if (!typeId) continue;
    const existing = await db.select().from(courts).where(eq(courts.name, c.name)).limit(1);
    if (existing.length === 0) {
      await db.insert(courts).values({
        id: randomUUID(),
        courtTypeId: typeId,
        name: c.name,
        active: true,
        sortOrder: c.sortOrder,
      });
    }
  }

  const allCourts = await db.select().from(courts).orderBy(courts.sortOrder);
  const allMembers = await db.select().from(members).limit(20);

  // 3. Seed relative bookings
  const todayStr = clubLocalToday();
  const [year, month, day] = todayStr.split('-').map(Number);

  // Tonight 6 to 9 pm: 3 one-hour slots (18:00, 19:00, 20:00)
  // Across 8 courts = 24 slots.
  // We leave exactly 3 free slots (e.g. Court 3 at 20:00, Court 5 at 19:00, Court 8 at 18:00).
  const freeSlots = new Set(['2_20', '4_19', '7_18']); // courtIndex_hour

  const bookingInserts: any[] = [];
  const hours = [18, 19, 20];

  let memberIdx = 0;
  for (let cIdx = 0; cIdx < allCourts.length; cIdx++) {
    const court = allCourts[cIdx];
    for (const h of hours) {
      const slotKey = `${cIdx}_${h}`;
      if (freeSlots.has(slotKey)) {
        continue; // Leave this slot free
      }

      const startAt = localToUtc(year, month, day, h, 0);
      const endAt = localToUtc(year, month, day, h + 1, 0);

      const assignedMember = allMembers.length > 0 ? allMembers[memberIdx % allMembers.length] : null;
      memberIdx++;

      bookingInserts.push({
        id: randomUUID(),
        courtId: court.id,
        kind: 'regular',
        status: 'confirmed',
        memberId: assignedMember?.id ?? null,
        guestName: assignedMember ? null : 'Walk-in Guest',
        guestPhone: assignedMember ? null : '9876543210',
        startAt,
        endAt,
        channel: 'counter',
        pricePaise: 150000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 4. Past completed bookings (yesterday)
  const yesterdayStr = addClubDays(todayStr, -1);
  const [yYear, yMonth, yDay] = yesterdayStr.split('-').map(Number);

  for (let i = 0; i < 4; i++) {
    const court = allCourts[i % allCourts.length];
    const startAt = localToUtc(yYear, yMonth, yDay, 10 + i * 2, 0);
    const endAt = localToUtc(yYear, yMonth, yDay, 11 + i * 2, 0);
    const assignedMember = allMembers.length > 0 ? allMembers[i % allMembers.length] : null;

    bookingInserts.push({
      id: randomUUID(),
      courtId: court.id,
      kind: 'regular',
      status: 'completed',
      memberId: assignedMember?.id ?? null,
      startAt,
      endAt,
      channel: 'counter',
      pricePaise: 150000,
      createdAt: new Date(Date.now() - 86400000),
      updatedAt: new Date(Date.now() - 86400000),
    });
  }

  // 5. Cancelled bookings with refund (yesterday)
  for (let i = 0; i < 2; i++) {
    const court = allCourts[(i + 4) % allCourts.length];
    const startAt = localToUtc(yYear, yMonth, yDay, 16 + i, 0);
    const endAt = localToUtc(yYear, yMonth, yDay, 17 + i, 0);
    const assignedMember = allMembers.length > 0 ? allMembers[i % allMembers.length] : null;

    bookingInserts.push({
      id: randomUUID(),
      courtId: court.id,
      kind: 'regular',
      status: 'cancelled',
      memberId: assignedMember?.id ?? null,
      startAt,
      endAt,
      channel: 'counter',
      pricePaise: 150000,
      refundPaise: 75000, // 50% refund
      cancelReason: 'Member requested cancellation 3 hours prior',
      cancelledAt: new Date(Date.now() - 80000000),
      createdAt: new Date(Date.now() - 90000000),
      updatedAt: new Date(Date.now() - 80000000),
    });
  }

  if (bookingInserts.length > 0) {
    try {
      await db.insert(bookings).values(bookingInserts).onConflictDoNothing();
      console.log(`[Seed:courts] Inserted ${bookingInserts.length} sample bookings`);
    } catch (e) {
      console.warn('[Seed:courts] Sample bookings insert notice:', e);
    }
  }

  // 6. Friday Social Play session
  // Find upcoming or today Friday
  const currentWeekday = toClubLocalWeekday(new Date());
  const daysUntilFriday = (5 - currentWeekday + 7) % 7;
  const fridayStr = addClubDays(todayStr, daysUntilFriday === 0 ? 0 : daysUntilFriday);
  const [fYear, fMonth, fDay] = fridayStr.split('-').map(Number);

  const socialCourt = allCourts[0]; // Centre court
  const sessionStart = localToUtc(fYear, fMonth, fDay, 18, 0);
  const sessionEnd = localToUtc(fYear, fMonth, fDay, 22, 0);

  try {
    // Blocking booking for social session
    const [socialBooking] = await db
      .insert(bookings)
      .values({
        id: randomUUID(),
        courtId: socialCourt.id,
        kind: 'social',
        status: 'confirmed',
        guestName: 'Friday Night Social Mixer',
        startAt: sessionStart,
        endAt: sessionEnd,
        channel: 'counter',
        pricePaise: 0,
      })
      .returning();

    // Social session
    const [session] = await db
      .insert(socialSessions)
      .values({
        id: randomUUID(),
        courtId: socialCourt.id,
        startAt: sessionStart,
        endAt: sessionEnd,
        capacity: 16,
        pricePerHeadPaise: 40000, // ₹400
        title: 'Friday Night Social Mixer',
        status: 'open',
        bookingId: socialBooking.id,
      })
      .returning();

    // Link booking to social session
    await db.update(bookings).set({ socialSessionId: session.id }).where(eq(bookings.id, socialBooking.id));

    // Signups: 14 confirmed, 2 waitlisted (total 16 members)
    const signupInserts: any[] = [];
    const membersForSocial = allMembers.slice(0, 16);

    for (let i = 0; i < membersForSocial.length; i++) {
      const isConfirmed = i < 14;
      signupInserts.push({
        id: randomUUID(),
        sessionId: session.id,
        memberId: membersForSocial[i].id,
        status: isConfirmed ? 'confirmed' : 'waitlisted',
        position: isConfirmed ? i + 1 : i - 13,
      });
    }

    if (signupInserts.length > 0) {
      await db.insert(socialSignups).values(signupInserts).onConflictDoNothing();
      console.log(`[Seed:courts] Seeded Friday Social session with ${signupInserts.length} signups`);
    }
  } catch (e) {
    console.warn('[Seed:courts] Social play seed notice:', e);
  }

  console.log('[Seed:courts] Completed courts and bookings seed.');
}
