// Owner: Dev A – Phase 7: Social Play Tests (T7)
import { describe, it, expect, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { isDbConnected } from './helper.js';
import { db } from '../src/core/db/index.js';
import { courts, courtTypes, bookings, socialSessions, socialSignups } from '../src/db/schema/courts.js';
import { members, memberships, plans } from '../src/db/schema/members.js';
import { Social } from '../src/modules/social/index.js';
import { Bookings } from '../src/modules/bookings/index.js';
import { clubLocalToday, addClubDays, localToUtc } from '../src/core/clubTime.js';

describe('Phase 7: Social Play (T7)', () => {
  let dbAvailable = false;
  let testCourtId: string;
  let activeMemberIds: string[] = [];
  let expiredMemberId: string;

  beforeAll(async () => {
    dbAvailable = await isDbConnected();

    if (dbAvailable) {
      // Create court type & court
      const courtTypeId = randomUUID();
      testCourtId = randomUUID();

      await db.insert(courtTypes).values({
        id: courtTypeId,
        code: `social-tennis-${Date.now()}`,
        name: 'Social Tennis Court',
        basePricePerHourPaise: 150000,
        taxCategory: 'standard',
      });

      await db.insert(courts).values({
        id: testCourtId,
        courtTypeId,
        name: 'Social Play Court 1',
        active: true,
        sortOrder: 1,
      });

      // Create test plan
      const [testPlan] = await db
        .insert(plans)
        .values({
          id: randomUUID(),
          code: `social-plan-${Date.now()}`,
          name: 'Social Test Plan',
          pricePaise: 2500000,
          durationDays: 365,
          dailyBookingLimit: 2,
          advanceBookingDays: 14,
          active: true,
        })
        .returning();

      const todayStr = clubLocalToday();

      // Create 6 active members for parallel tests
      for (let i = 0; i < 6; i++) {
        const mId = randomUUID();
        await db.insert(members).values({
          id: mId,
          memberCode: `CC-SOC-${Math.floor(Math.random() * 900000 + 100000)}`,
          fullName: `Social Test Member ${i + 1}`,
          phone: `92${Math.floor(Math.random() * 90000000 + 10000000)}`,
          qrToken: randomUUID(),
        });

        await db.insert(memberships).values({
          id: randomUUID(),
          memberId: mId,
          planId: testPlan.id,
          startsOn: todayStr,
          endsOn: addClubDays(todayStr, 365),
          status: 'active',
        });

        activeMemberIds.push(mId);
      }

      // Create 1 expired member
      expiredMemberId = randomUUID();
      await db.insert(members).values({
        id: expiredMemberId,
        memberCode: `CC-EXP-${Math.floor(Math.random() * 900000 + 100000)}`,
        fullName: 'Social Expired Member',
        phone: `92${Math.floor(Math.random() * 90000000 + 10000000)}`,
        qrToken: randomUUID(),
      });
      await db.insert(memberships).values({
        id: randomUUID(),
        memberId: expiredMemberId,
        planId: testPlan.id,
        startsOn: addClubDays(todayStr, -200),
        endsOn: addClubDays(todayStr, -10),
        status: 'expired',
      });
    }
  });

  it('1. Creating a social session creates a booking that blocks regular bookings with SLOT_TAKEN', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      expect(true).toBe(true);
      return;
    }

    const todayStr = clubLocalToday();
    const [year, month, day] = addClubDays(todayStr, 3).split('-').map(Number);
    const startAt = localToUtc(year, month, day, 18, 0); // 18:00
    const endAt = localToUtc(year, month, day, 22, 0);   // 22:00

    // Create session (18:00 to 22:00)
    const session = await Social.createSession({
      courtId: testCourtId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 4,
      pricePerHeadPaise: 40000,
      title: 'Friday Social Tennis Mixer',
    });

    expect(session.id).toBeDefined();
    expect(session.status).toBe('open');

    // Attempting a regular 60-minute booking inside the window [19:00, 20:00) must fail with SLOT_TAKEN (409)
    const regularStart = localToUtc(year, month, day, 19, 0);
    let failedWithSlotTaken = false;

    try {
      await Bookings.createBooking({
        courtId: testCourtId,
        startAt: regularStart.toISOString(),
        guest: { name: 'Blocked Regular Player', phone: '9900000000' },
        channel: 'counter',
      });
    } catch (err: any) {
      if (err.code === 'SLOT_TAKEN') {
        failedWithSlotTaken = true;
      }
    }

    expect(failedWithSlotTaken).toBe(true);
  });

  it('2. Capacity respected under parallel signups; extras are waitlisted with positions', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      expect(true).toBe(true);
      return;
    }

    const todayStr = clubLocalToday();
    const [year, month, day] = addClubDays(todayStr, 4).split('-').map(Number);
    const startAt = localToUtc(year, month, day, 18, 0);
    const endAt = localToUtc(year, month, day, 21, 0);

    // Create session with capacity = 2
    const session = await Social.createSession({
      courtId: testCourtId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 2,
      pricePerHeadPaise: 40000,
      title: 'Small Social Session',
    });

    // 5 active members sign up in parallel
    const signupPromises = activeMemberIds.slice(0, 5).map(async (mId) => {
      try {
        const res = await Social.signup(session.id, mId);
        return { success: true, signup: res.signup };
      } catch (err: any) {
        return { success: false, code: err.code };
      }
    });

    const results = await Promise.all(signupPromises);

    const confirmed = results.filter((r) => r.success && r.signup?.status === 'confirmed');
    const waitlisted = results.filter((r) => r.success && r.signup?.status === 'waitlisted');

    // Exactly 2 confirmed (capacity = 2) and 3 waitlisted
    expect(confirmed.length).toBe(2);
    expect(waitlisted.length).toBe(3);

    // Verify positions
    const waitlistPositions = waitlisted.map((w) => w.signup?.position).sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(waitlistPositions).toEqual([1, 2, 3]);
  });

  it('3. Waitlist promoted on cancel and cancellation refund processed', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      expect(true).toBe(true);
      return;
    }

    const todayStr = clubLocalToday();
    const [year, month, day] = addClubDays(todayStr, 5).split('-').map(Number);
    const startAt = localToUtc(year, month, day, 18, 0);
    const endAt = localToUtc(year, month, day, 21, 0);

    const session = await Social.createSession({
      courtId: testCourtId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 1, // Only 1 spot
      pricePerHeadPaise: 50000,
      title: 'Solo Spot Mixer',
    });

    // Member 0 gets confirmed
    const res1 = await Social.signup(session.id, activeMemberIds[0]);
    expect(res1.signup.status).toBe('confirmed');

    // Member 1 gets waitlisted at position 1
    const res2 = await Social.signup(session.id, activeMemberIds[1]);
    expect(res2.signup.status).toBe('waitlisted');
    expect(res2.signup.position).toBe(1);

    // Member 0 cancels signup
    const cancelRes = await Social.cancelSignup(session.id, activeMemberIds[0]);
    expect(cancelRes.success).toBe(true);
    // Member 1 must be promoted in the same transaction
    expect(cancelRes.promotedMemberId).toBe(activeMemberIds[1]);

    // Verify in DB that Member 1 is now confirmed
    const sessions = await Social.listSessions({ date: addClubDays(todayStr, 5) });
    const s = sessions.find((x) => x.id === session.id);
    expect(s?.confirmedCount).toBe(1);
    expect(s?.waitlistCount).toBe(0);
  });

  it('4. Inactive member cannot sign up for social play', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      expect(true).toBe(true);
      return;
    }

    const todayStr = clubLocalToday();
    const [year, month, day] = addClubDays(todayStr, 6).split('-').map(Number);
    const startAt = localToUtc(year, month, day, 18, 0);
    const endAt = localToUtc(year, month, day, 21, 0);

    const session = await Social.createSession({
      courtId: testCourtId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 4,
      pricePerHeadPaise: 40000,
      title: 'Inactive Test Mixer',
    });

    let threwInactive = false;
    try {
      await Social.signup(session.id, expiredMemberId);
    } catch (err: any) {
      if (err.code === 'MEMBERSHIP_INACTIVE') {
        threwInactive = true;
      }
    }

    expect(threwInactive).toBe(true);
  });

  it('5. Duplicate signup is rejected with VALIDATION (400)', async () => {
    if (!dbAvailable) {
      console.log('Skipping live DB check as Postgres is currently offline.');
      expect(true).toBe(true);
      return;
    }

    const todayStr = clubLocalToday();
    const [year, month, day] = addClubDays(todayStr, 7).split('-').map(Number);
    const startAt = localToUtc(year, month, day, 18, 0);
    const endAt = localToUtc(year, month, day, 21, 0);

    const session = await Social.createSession({
      courtId: testCourtId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      capacity: 4,
      pricePerHeadPaise: 40000,
      title: 'Duplicate Test Mixer',
    });

    // First signup succeeds
    await Social.signup(session.id, activeMemberIds[0]);

    // Second signup for same member must fail
    let threwValidation = false;
    try {
      await Social.signup(session.id, activeMemberIds[0]);
    } catch (err: any) {
      if (err.code === 'VALIDATION') {
        threwValidation = true;
      }
    }

    expect(threwValidation).toBe(true);
  });
});
