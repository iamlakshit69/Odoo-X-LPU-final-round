// Owner: Dev A – Phase 10: Demo Scenes 1, 2, 5, 7 Automated Script
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestApp, isDbConnected } from './helper.js';
import { db } from '../src/core/db/index.js';
import { courtTypes, courts } from '../src/db/schema/courts.js';
import { auditLog } from '../src/db/schema/core.js';
import { Members, getPlanEntitlements } from '../src/modules/members/service.js';
import { Bookings } from '../src/modules/bookings/service.js';
import { Crm } from '../src/modules/crm/service.js';
import { clubLocalToday, addClubDays } from '../src/core/clubTime.js';
import { SessionUser } from '@club/contract';
import { desc } from 'drizzle-orm';

describe('Phase 10: Demo Scenes Scripted Walkthrough (Scenes 1, 2, 5, 7)', () => {
  const app = createTestApp();
  let dbAvailable = false;

  const staffUser: SessionUser = {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'frontdesk@championsclub.in',
    name: 'Sunita Rao',
    roleId: '10000000-0000-0000-0000-000000000003',
    roleCode: 'front_desk',
    active: true,
  };

  beforeAll(async () => {
    dbAvailable = await isDbConnected();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // Scene 1: New member walks in
  describe('Scene 1: New Member Walk-in Workflow', () => {
    it('executes Scene 1: creates member, derives entitlements, creates invoice, and verifies active plan', async () => {
      // 1. Entitlements display for Silver plan
      const entitlements = getPlanEntitlements('silver');
      expect(entitlements.courtRate).toContain('40% off peak');
      expect(entitlements.shopDiscountBps).toBe(1000);
      expect(entitlements.barDiscountBps).toBe(500);

      if (!dbAvailable) {
        console.log('[DemoScene1] DB offline, skipping persistence checks');
        return;
      }

      // 2. Front desk registers member "Aarav Mehta" on Silver
      const newMemberRes = await Members.createMember(
        {
          fullName: 'Aarav Mehta',
          phone: '+919876599999',
          email: 'aarav.mehta@example.com',
          planCode: 'silver',
        },
        staffUser.id
      );

      expect(newMemberRes.member.fullName).toBe('Aarav Mehta');
      expect(newMemberRes.member.memberCode).toMatch(/^CC-/);
      expect(newMemberRes.invoiceId).toBeDefined();

      // 3. Member card verification
      const planInfo = await Members.getActivePlan(newMemberRes.member.id);
      expect(planInfo.planCode).toBe('silver');
      expect(planInfo.status).toBe('active');
      expect(planInfo.dailyBookingLimit).toBe(2);
    });
  });

  // Scene 2: 6 pm rush & concurrency race
  describe('Scene 2: 6 PM Rush, Daily Limit & Concurrency Race', () => {
    it('executes Scene 2: Gold member free booking, walk-in rate, daily limit block, and slot race', async () => {
      if (!dbAvailable) {
        console.log('[DemoScene2] DB offline, skipping concurrency checks');
        return;
      }

      // Setup a test court
      const courtTypeId = randomUUID();
      const courtId = randomUUID();

      await db.insert(courtTypes).values({
        id: courtTypeId,
        code: `demo-court-type-${Date.now()}`,
        name: 'Demo Court Type',
        basePricePerHourPaise: 150000, // ₹1,500
        taxCategory: 'standard',
      });

      await db.insert(courts).values({
        id: courtId,
        courtTypeId,
        name: 'Demo Show Court',
        active: true,
        sortOrder: 1,
      });

      // Setup a Gold member with limit 2
      const goldMemberRes = await Members.createMember(
        {
          fullName: 'Gold Rush Member',
          phone: '+919876588888',
          planCode: 'gold',
        },
        staffUser.id
      );

      const targetDate = addClubDays(clubLocalToday(), 1);
      const slot1Time = new Date(`${targetDate}T12:30:00.000Z`); // 18:00 IST
      const slot2Time = new Date(`${targetDate}T13:30:00.000Z`); // 19:00 IST
      const slot3Time = new Date(`${targetDate}T14:30:00.000Z`); // 20:00 IST

      // 1. Gold member booking: free price (0 paise)
      const b1 = await Bookings.createBooking(
        {
          courtId,
          startAt: slot1Time.toISOString(),
          channel: 'counter',
          memberId: goldMemberRes.member.id,
        },
        staffUser
      );
      expect(b1.booking.pricePaise).toBe(0);

      // 2. Second booking for same Gold member
      const b2 = await Bookings.createBooking(
        {
          courtId,
          startAt: slot2Time.toISOString(),
          channel: 'counter',
          memberId: goldMemberRes.member.id,
        },
        staffUser
      );
      expect(b2.booking.status).toBe('confirmed');

      // 3. Third booking on same day exceeds daily limit -> DAILY_LIMIT (422)
      await expect(
        Bookings.createBooking(
          {
            courtId,
            startAt: slot3Time.toISOString(),
            channel: 'counter',
            memberId: goldMemberRes.member.id,
          },
          staffUser
        )
      ).rejects.toThrow(/Daily booking limit/);

      // 4. Concurrency race on another slot: 5 parallel attempts for the same court slot
      const raceSlotTime = new Date(`${addClubDays(clubLocalToday(), 2)}T12:30:00.000Z`);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }).map((_, i) =>
          Bookings.createBooking(
            {
              courtId,
              startAt: raceSlotTime.toISOString(),
              channel: 'counter',
              guest: {
                name: `Racer ${i}`,
                phone: `+91999900000${i}`,
              },
            },
            staffUser
          )
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(4);
      for (const rej of rejected) {
        expect((rej as PromiseRejectedResult).reason.message).toMatch(/already booked|overlap/i);
      }

      // 5. Cancel first booking with refund
      const cancelRes = await Bookings.cancelBooking(b1.booking.id, {}, staffUser);
      expect(cancelRes.status).toBe('cancelled');
    });
  });

  // Scene 5: Stranger online
  describe('Scene 5: Stranger Online (Public Enquiry, Follow-up, Quote, Convert)', () => {
    it('executes Scene 5: public enquiry, lead stage follow-up, quote send, and conversion', async () => {
      if (!dbAvailable) {
        console.log('[DemoScene5] DB offline, skipping CRM pipeline checks');
        expect(true).toBe(true);
        return;
      }

      // 1. Stranger submits public enquiry
      const enquiryRes = await Crm.createEnquiry({
        name: 'Stranger Online',
        phone: '+919876577777',
        email: 'stranger@example.com',
        interest: 'Badminton coaching',
        message: 'Looking for trial sessions for child.',
      });

      expect(enquiryRes.leadId).toBeDefined();
      expect(enquiryRes.message).toContain('successfully');

      // 2. Staff views and moves lead to follow_up (auto creates task)
      const leadDetail = await Crm.getLead(enquiryRes.leadId);
      expect(leadDetail.stage).toBe('new');

      await Crm.updateLead(enquiryRes.leadId, { stage: 'follow_up' }, staffUser.id);
      const afterFollowUp = await Crm.getLead(enquiryRes.leadId);
      expect(afterFollowUp.stage).toBe('follow_up');
      expect(afterFollowUp.tasks.length).toBeGreaterThanOrEqual(1);

      // 3. Staff creates and sends quote
      const quote = await Crm.createQuote(
        enquiryRes.leadId,
        {
          lines: [
            { description: 'Junior Annual Membership', qty: 1, unitPricePaise: 1200000 },
          ],
        },
        staffUser.id
      );
      expect(quote.totalPaise).toBe(1200000);

      const sendQuoteRes = await Crm.sendQuote(quote.id, staffUser.id);
      expect(sendQuoteRes.success).toBe(true);

      // 4. Stranger converts to Junior member
      const convertRes = await Crm.convertLead(
        enquiryRes.leadId,
        { planCode: 'junior' },
        staffUser.id
      );

      expect(convertRes.memberId).toBeDefined();
      expect(convertRes.memberCode).toMatch(/^CC-/);

      const convertedLead = await Crm.getLead(enquiryRes.leadId);
      expect(convertedLead.stage).toBe('converted');
      expect(convertedLead.convertedMemberId).toBe(convertRes.memberId);
    });
  });

  // Scene 7: Admin
  describe('Scene 7: Admin Settings & Audit Verification', () => {
    it('executes Scene 7: verifies audit entries exist for performed operations', async () => {
      if (!dbAvailable) {
        console.log('[DemoScene7] DB offline, skipping audit persistence check');
        expect(true).toBe(true);
        return;
      }

      const recentAuditRows = await db
        .select()
        .from(auditLog)
        .orderBy(desc(auditLog.at))
        .limit(20);

      expect(recentAuditRows.length).toBeGreaterThan(0);
      const actions = recentAuditRows.map((r) => r.action);
      expect(actions.some((a) => a.startsWith('member.') || a.startsWith('booking.') || a.startsWith('lead.'))).toBe(true);
    });
  });
});
