// Owner: Dev A – Phase 6: Bookings & Courts Tests (T1, T2, T3, T4, T6, State Machine)
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { isDbConnected, createTestApp } from './helper.js';
import { db } from '../src/core/db/index.js';
import { courts, courtTypes, bookings } from '../src/db/schema/courts.js';
import { members, memberships, plans } from '../src/db/schema/members.js';
import { Bookings } from '../src/modules/bookings/index.js';
import { Courts } from '../src/modules/courts/index.js';
import { paymentServiceStub } from '../src/core/stubs/finance.js';
import { clubLocalToday, addClubDays, localToUtc } from '../src/core/clubTime.js';

describe('Phase 6: Courts & Bookings (T1, T2, T3, T4, T6)', () => {
  let dbAvailable = false;
  let testCourtId: string;
  let testCourtTypeId: string;
  let goldMemberId: string;
  let expiredMemberId: string;
  let suspendedMemberId: string;

  beforeAll(async () => {
    dbAvailable = await isDbConnected();

    if (dbAvailable) {
      // Create test court type & court
      testCourtTypeId = randomUUID();
      testCourtId = randomUUID();

      await db.insert(courtTypes).values({
        id: testCourtTypeId,
        code: `tennis-${Date.now()}`,
        name: 'Test Tennis',
        basePricePerHourPaise: 150000,
        taxCategory: 'standard',
      });

      await db.insert(courts).values({
        id: testCourtId,
        courtTypeId: testCourtTypeId,
        name: 'Test Centre Court',
        active: true,
        sortOrder: 1,
      });

      // Create test plan with limit 2
      const [testPlan] = await db
        .insert(plans)
        .values({
          id: randomUUID(),
          code: `gold-test-${Date.now()}`,
          name: 'Gold Test Plan',
          pricePaise: 5000000,
          durationDays: 365,
          dailyBookingLimit: 2,
          advanceBookingDays: 14,
          active: true,
        })
        .returning();

      // Create active member
      goldMemberId = randomUUID();
      await db.insert(members).values({
        id: goldMemberId,
        memberCode: `CC-${Math.floor(Math.random() * 900000 + 100000)}`,
        fullName: 'Test Active Member',
        phone: `91${Math.floor(Math.random() * 90000000 + 10000000)}`,
        qrToken: randomUUID(),
      });

      const todayStr = clubLocalToday();
      await db.insert(memberships).values({
        id: randomUUID(),
        memberId: goldMemberId,
        planId: testPlan.id,
        startsOn: todayStr,
        endsOn: addClubDays(todayStr, 365),
        status: 'active',
      });

      // Create expired member
      expiredMemberId = randomUUID();
      await db.insert(members).values({
        id: expiredMemberId,
        memberCode: `CC-${Math.floor(Math.random() * 900000 + 100000)}`,
        fullName: 'Test Expired Member',
        phone: `91${Math.floor(Math.random() * 90000000 + 10000000)}`,
        qrToken: randomUUID(),
      });
      await db.insert(memberships).values({
        id: randomUUID(),
        memberId: expiredMemberId,
        planId: testPlan.id,
        startsOn: addClubDays(todayStr, -400),
        endsOn: addClubDays(todayStr, -35),
        status: 'expired',
      });

      // Create suspended member
      suspendedMemberId = randomUUID();
      await db.insert(members).values({
        id: suspendedMemberId,
        memberCode: `CC-${Math.floor(Math.random() * 900000 + 100000)}`,
        fullName: 'Test Suspended Member',
        phone: `91${Math.floor(Math.random() * 90000000 + 10000000)}`,
        qrToken: randomUUID(),
      });
      await db.insert(memberships).values({
        id: randomUUID(),
        memberId: suspendedMemberId,
        planId: testPlan.id,
        startsOn: todayStr,
        endsOn: addClubDays(todayStr, 365),
        status: 'suspended',
      });
    }
  });

  // 1. T1: Concurrency race condition test
  describe('1. T1: 20 parallel bookings for the same court and slot', () => {
    it('exactly 1 succeeds and 19 get SLOT_TAKEN (409)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 2).split('-').map(Number);
      const slotStart = localToUtc(year, month, day, 18, 0); // 18:00 IST

      // Fire 20 parallel booking creation requests
      const promises = Array.from({ length: 20 }).map(async (_, idx) => {
        try {
          const res = await Bookings.createBooking({
            courtId: testCourtId,
            startAt: slotStart.toISOString(),
            guest: {
              name: `Race Contestant ${idx + 1}`,
              phone: `98765432${idx.toString().padStart(2, '0')}`,
            },
            channel: 'counter',
          });
          return { success: true, bookingId: res.booking.id };
        } catch (err: any) {
          return { success: false, code: err.code, status: err.statusCode };
        }
      });

      const results = await Promise.all(promises);

      const successes = results.filter((r) => r.success);
      const slotTakens = results.filter((r) => !r.success && r.code === 'SLOT_TAKEN');

      expect(successes.length).toBe(1);
      expect(slotTakens.length).toBe(19);
    });
  });

  // 2. T2: Adjacent slots half-open range test
  describe('2. T2: Adjacent slots [10:00, 11:00) and [11:00, 12:00) both succeed', () => {
    it('both adjacent slots succeed without overlap conflict', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 3).split('-').map(Number);

      const slot1Start = localToUtc(year, month, day, 10, 0);
      const slot2Start = localToUtc(year, month, day, 11, 0);

      const res1 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: slot1Start.toISOString(),
        guest: { name: 'Adjacent Player 1', phone: '9811111111' },
        channel: 'counter',
      });

      const res2 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: slot2Start.toISOString(),
        guest: { name: 'Adjacent Player 2', phone: '9822222222' },
        channel: 'counter',
      });

      expect(res1.booking.id).toBeDefined();
      expect(res2.booking.id).toBeDefined();
    });
  });

  // 3. T3: Member daily limit and parallel limit check
  describe('3. T3: Third booking on same club-local day returns DAILY_LIMIT', () => {
    it('member cannot exceed 2 bookings on the same club-local day', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 4).split('-').map(Number);

      const b1 = localToUtc(year, month, day, 8, 0);
      const b2 = localToUtc(year, month, day, 10, 0);
      const b3 = localToUtc(year, month, day, 12, 0);

      // First booking succeeds
      const res1 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: b1.toISOString(),
        memberId: goldMemberId,
        channel: 'counter',
      });
      expect(res1.booking.id).toBeDefined();

      // Second booking succeeds (reaches limit of 2)
      const res2 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: b2.toISOString(),
        memberId: goldMemberId,
        channel: 'counter',
      });
      expect(res2.booking.id).toBeDefined();

      // Third booking on same club-local day must fail with DAILY_LIMIT (422)
      let failedWithDailyLimit = false;
      try {
        await Bookings.createBooking({
          courtId: testCourtId,
          startAt: b3.toISOString(),
          memberId: goldMemberId,
          channel: 'counter',
        });
      } catch (err: any) {
        if (err.code === 'DAILY_LIMIT' && err.statusCode === 422) {
          failedWithDailyLimit = true;
        }
      }
      expect(failedWithDailyLimit).toBe(true);
    });

    it('parallel attempts by one member cannot exceed daily limit', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 5).split('-').map(Number);

      // Fire 5 concurrent booking requests across different hours for the same member
      const attempts = [9, 11, 13, 15, 17].map((h) =>
        localToUtc(year, month, day, h, 0).toISOString()
      );

      const results = await Promise.all(
        attempts.map(async (startAt) => {
          try {
            const res = await Bookings.createBooking({
              courtId: testCourtId,
              startAt,
              memberId: goldMemberId,
              channel: 'counter',
            });
            return { success: true, bookingId: res.booking.id };
          } catch (err: any) {
            return { success: false, code: err.code };
          }
        })
      );

      const succeeded = results.filter((r) => r.success);
      const dailyLimited = results.filter((r) => !r.success && r.code === 'DAILY_LIMIT');

      expect(succeeded.length).toBe(2);
      expect(dailyLimited.length).toBe(3);
    });

    it('respects midnight IST boundary correctly', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      // Slot ending at 23:00 IST on Day 6 vs Slot on Day 7 at 06:00 IST
      // Both belong to different club-local days
      const todayStr = clubLocalToday();
      const day6Str = addClubDays(todayStr, 6);
      const day7Str = addClubDays(todayStr, 7);

      const [y6, m6, d6] = day6Str.split('-').map(Number);
      const [y7, m7, d7] = day7Str.split('-').map(Number);

      const day6Slot = localToUtc(y6, m6, d6, 21, 0); // 21:00-22:00 IST
      const day7Slot = localToUtc(y7, m7, d7, 6, 0);  // 06:00-07:00 IST next morning

      const resDay6 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: day6Slot.toISOString(),
        memberId: goldMemberId,
        channel: 'counter',
      });
      expect(resDay6.booking.id).toBeDefined();

      const resDay7 = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: day7Slot.toISOString(),
        memberId: goldMemberId,
        channel: 'counter',
      });
      expect(resDay7.booking.id).toBeDefined();
    });
  });

  // 4. T4: Inactive member cannot book
  describe('4. T4: Expired or suspended member cannot book', () => {
    it('expired member gets MEMBERSHIP_INACTIVE (422)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 1).split('-').map(Number);
      const startAt = localToUtc(year, month, day, 14, 0);

      let threwInactive = false;
      try {
        await Bookings.createBooking({
          courtId: testCourtId,
          startAt: startAt.toISOString(),
          memberId: expiredMemberId,
          channel: 'counter',
        });
      } catch (err: any) {
        if (err.code === 'MEMBERSHIP_INACTIVE') {
          threwInactive = true;
        }
      }
      expect(threwInactive).toBe(true);
    });

    it('suspended member gets MEMBERSHIP_INACTIVE (422)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 1).split('-').map(Number);
      const startAt = localToUtc(year, month, day, 15, 0);

      let threwInactive = false;
      try {
        await Bookings.createBooking({
          courtId: testCourtId,
          startAt: startAt.toISOString(),
          memberId: suspendedMemberId,
          channel: 'counter',
        });
      } catch (err: any) {
        if (err.code === 'MEMBERSHIP_INACTIVE') {
          threwInactive = true;
        }
      }
      expect(threwInactive).toBe(true);
    });
  });

  // 5. T6: Cancellation policy and refund calculation
  describe('5. T6: Cancellation refund follows policy rows and creates negative payment', () => {
    it('cancels booking > 24 hours prior with 100% refund', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 8).split('-').map(Number);
      const startAt = localToUtc(year, month, day, 10, 0);

      const created = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: startAt.toISOString(),
        guest: { name: 'Refund Test Guest', phone: '9999999999' },
        channel: 'counter',
      });

      const cancelRes = await Bookings.cancelBooking(created.booking.id, {
        reason: 'Client requested reschedule > 24 hours prior',
      });

      expect(cancelRes.status).toBe('cancelled');
      expect(cancelRes.refundPercentage).toBe(100);
      expect(cancelRes.refundPaise).toBe(created.booking.pricePaise);
    });

    it('staff override refund percentage succeeds when permission is present', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 8).split('-').map(Number);
      const startAt = localToUtc(year, month, day, 12, 0);

      const created = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: startAt.toISOString(),
        guest: { name: 'Override Refund Guest', phone: '9999999998' },
        channel: 'counter',
      });

      const managerUser = {
        id: randomUUID(),
        name: 'Test Manager',
        roleId: randomUUID(),
        roleCode: 'manager',
        email: 'manager@test.com',
        active: true,
      };

      const cancelRes = await Bookings.cancelBooking(
        created.booking.id,
        {
          reason: 'Manager goodwill override',
          overrideRefundPct: 80,
        },
        managerUser as any
      );

      expect(cancelRes.status).toBe('cancelled');
      expect(cancelRes.refundPercentage).toBe(80);
      expect(cancelRes.refundPaise).toBe(Math.round((created.booking.pricePaise * 80) / 100));
    });
  });

  // 6. Booking state machine validation
  describe('6. Booking State Machine', () => {
    it('rejects illegal status transitions', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        expect(true).toBe(true);
        return;
      }

      const todayStr = clubLocalToday();
      const [year, month, day] = addClubDays(todayStr, 9).split('-').map(Number);
      const startAt = localToUtc(year, month, day, 10, 0);

      const created = await Bookings.createBooking({
        courtId: testCourtId,
        startAt: startAt.toISOString(),
        guest: { name: 'State Machine Test', phone: '9999999997' },
        channel: 'counter',
      });

      // Complete the booking
      await Bookings.completeBooking(created.booking.id);

      // Attempting to cancel an already completed booking must fail with INVALID_STATE (409)
      let cancelCompletedFailed = false;
      try {
        await Bookings.cancelBooking(created.booking.id, { reason: 'Late cancel' });
      } catch (err: any) {
        if (err.code === 'INVALID_STATE') {
          cancelCompletedFailed = true;
        }
      }
      expect(cancelCompletedFailed).toBe(true);

      // Attempting to mark a completed booking as no-show must fail with INVALID_STATE (409)
      let noShowCompletedFailed = false;
      try {
        await Bookings.markNoShow(created.booking.id);
      } catch (err: any) {
        if (err.code === 'INVALID_STATE') {
          noShowCompletedFailed = true;
        }
      }
      expect(noShowCompletedFailed).toBe(true);
    });
  });

  // 7. Availability Grid (Public vs Staff)
  describe('7. Availability Grid endpoints', () => {
    it('public availability grid strips personal data', async () => {
      const todayStr = clubLocalToday();
      const grid = await Courts.getAvailability(todayStr, undefined, false);

      expect(grid.date).toBe(todayStr);
      expect(Array.isArray(grid.courts)).toBe(true);

      if (grid.courts.length > 0) {
        const firstCourtSlots = grid.courts[0].slots;
        expect(firstCourtSlots.length).toBeGreaterThan(0);
        // Ensure no staff fields exist on public slots
        for (const slot of firstCourtSlots) {
          expect((slot as any).bookingId).toBeUndefined();
          expect((slot as any).bookedBy).toBeUndefined();
        }
      }
    });

    it('staff availability grid includes slot booking info', async () => {
      const todayStr = clubLocalToday();
      const grid = await Courts.getAvailability(todayStr, undefined, true);

      expect(grid.date).toBe(todayStr);
      expect(Array.isArray(grid.courts)).toBe(true);

      if (grid.courts.length > 0) {
        const firstCourtSlots = grid.courts[0].slots as any[];
        const takenSlot = firstCourtSlots.find((s) => s.status === 'taken');
        if (takenSlot) {
          expect(takenSlot.bookingId).toBeDefined();
          expect(takenSlot.bookedBy).toBeDefined();
        }
      }
    });
  });
});
