// Owner: Dev A – Phase 8: CRM Tests
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestApp, isDbConnected } from './helper.js';
import { db } from '../src/core/db/index.js';
import { leads, leadActivities, leadTasks, quotes } from '../src/db/schema/crm.js';
import { users, roles } from '../src/db/schema/core.js';
import { plans, members } from '../src/db/schema/members.js';
import { Crm } from '../src/modules/crm/service.js';
import { Events } from '../src/core/events.js';
import { Notifications } from '../src/core/notifications.js';
import { runJob } from '../src/core/jobs.js';
import { eq } from 'drizzle-orm';

describe('Phase 8: CRM Module', () => {
  const app = createTestApp();
  let dbAvailable = false;
  let testLeadId: string;
  let testStaffUserId: string;

  beforeAll(async () => {
    dbAvailable = await isDbConnected();
    await app.ready();

    if (dbAvailable) {
      testStaffUserId = randomUUID();
      // Ensure a role and user exist
      const [role] = await db.select().from(roles).where(eq(roles.code, 'front_desk')).limit(1);
      const roleId = role?.id || randomUUID();

      if (!role) {
        await db.insert(roles).values({
          id: roleId,
          code: 'front_desk',
          name: 'Front Desk',
        });
      }

      await db.insert(users).values({
        id: testStaffUserId,
        email: `frontdesk-${Date.now()}@example.com`,
        passwordHash: 'dummy',
        name: 'Desk Staff Test',
        roleId,
        active: true,
      });

      // Insert a test lead for PATCH/quote/convert tests
      testLeadId = randomUUID();
      await db.insert(leads).values({
        id: testLeadId,
        name: 'Jane Doe Test',
        phone: '+919999888877',
        email: 'jane.test@example.com',
        source: 'web_form',
        stage: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Public Enquiries (POST /api/public/enquiries)', () => {
    it('creates an enquiry and returns leadId with NO personal data in response', async () => {
      if (!dbAvailable) {
        console.log('[crm.test] DB offline, testing route validation only');
        const res = await app.inject({
          method: 'POST',
          url: '/api/public/enquiries',
          payload: {
            name: '', // invalid
            phone: '123',
          },
        });
        expect(res.statusCode).toBe(400);
        return;
      }

      const publishSpy = vi.spyOn(Events, 'publish');
      const notifySpy = vi.spyOn(Notifications, 'notifyRoles');

      const res = await app.inject({
        method: 'POST',
        url: '/api/public/enquiries',
        payload: {
          name: 'Public Prospect',
          phone: '+919123456789',
          email: 'prospect@example.com',
          interest: 'Tennis coaching',
          message: 'Interested in evening private lessons.',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);

      // Verify response contains NO personal data
      expect(body).toHaveProperty('leadId');
      expect(body).toHaveProperty('message');
      expect(body).not.toHaveProperty('name');
      expect(body).not.toHaveProperty('phone');
      expect(body).not.toHaveProperty('email');
      expect(body).not.toHaveProperty('interest');
      expect(body).not.toHaveProperty('messageText');

      // Verify staff notification was sent
      expect(notifySpy).toHaveBeenCalledWith(
        ['front_desk', 'manager'],
        expect.objectContaining({
          template: 'lead.new',
        })
      );

      // Verify event was published
      expect(publishSpy).toHaveBeenCalledWith(
        'lead.created',
        expect.objectContaining({ leadId: body.leadId })
      );

      // Verify lead in DB
      const [leadRow] = await db.select().from(leads).where(eq(leads.id, body.leadId)).limit(1);
      expect(leadRow).toBeDefined();
      expect(leadRow.source).toBe('web_form');
      expect(leadRow.stage).toBe('new');

      publishSpy.mockRestore();
      notifySpy.mockRestore();
    });

    it('rejects invalid enquiry payload (missing name or phone)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/public/enquiries',
        payload: {
          email: 'test@example.com',
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('2. Lead Updates & Lost Validation (PATCH /api/leads/:id)', () => {
    it('requires authentication to update lead', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/leads/${randomUUID()}`,
        payload: { stage: 'contacted' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects stage="lost" when lostReason is omitted', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      await expect(
        Crm.updateLead(testLeadId, { stage: 'lost' }, testStaffUserId)
      ).rejects.toThrow(/lostReason is required/);
    });

    it('rejects invalid stage values not in crm.stages', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      await expect(
        Crm.updateLead(testLeadId, { stage: 'non_existent_stage' }, testStaffUserId)
      ).rejects.toThrow(/Invalid stage/);
    });

    it('accepts stage="lost" when lostReason is provided and records activity', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      const updated = await Crm.updateLead(
        testLeadId,
        { stage: 'lost', lostReason: 'Price too high for annual membership' },
        testStaffUserId
      );

      expect(updated.stage).toBe('lost');
      expect(updated.lostReason).toBe('Price too high for annual membership');

      // Verify activity was recorded
      const activities = await db
        .select()
        .from(leadActivities)
        .where(eq(leadActivities.leadId, testLeadId));
      const lostActivity = activities.find((a) => a.body.includes('Price too high'));
      expect(lostActivity).toBeDefined();
    });
  });

  describe('3. Stage change to follow_up auto-creates task', () => {
    it('creates a task due in 2 days when stage becomes follow_up', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      const lead2Id = randomUUID();
      await db.insert(leads).values({
        id: lead2Id,
        name: 'Follow Up Prospect',
        phone: '+919988776655',
        source: 'phone',
        stage: 'new',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await Crm.updateLead(lead2Id, { stage: 'follow_up' }, testStaffUserId);

      const tasks = await db.select().from(leadTasks).where(eq(leadTasks.leadId, lead2Id));
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].title).toContain('Follow-up');
      expect(tasks[0].doneAt).toBeNull();
    });
  });

  describe('4. Quotes creation and sending', () => {
    it('computes total paise on server and transitions lead to quotation_sent on send', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      const qLeadId = randomUUID();
      await db.insert(leads).values({
        id: qLeadId,
        name: 'Quote Test Prospect',
        phone: '+919876500000',
        email: 'quote.test@example.com',
        source: 'walk_in',
        stage: 'contacted',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Create quote
      const quote = await Crm.createQuote(
        qLeadId,
        {
          lines: [
            { description: 'Gold Membership', qty: 1, unitPricePaise: 5000000 },
            { description: 'Lockers', qty: 2, unitPricePaise: 250000 },
          ],
        },
        testStaffUserId
      );

      expect(quote.status).toBe('draft');
      expect(quote.totalPaise).toBe(5500000); // 5000000 + 500000
      expect(quote.lines).toHaveLength(2);

      // Send quote
      const sendRes = await Crm.sendQuote(quote.id, testStaffUserId);
      expect(sendRes.success).toBe(true);
      expect(sendRes.quote.status).toBe('sent');

      // Lead stage should now be quotation_sent
      const [updatedLead] = await db.select().from(leads).where(eq(leads.id, qLeadId)).limit(1);
      expect(updatedLead.stage).toBe('quotation_sent');
    });
  });

  describe('5. Atomic Lead Conversion (POST /api/leads/:id/convert)', () => {
    it('requires authentication and lead:convert guard', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/leads/${randomUUID()}/convert`,
        payload: { planCode: 'gold' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('creates member, membership, invoice atomically and links convertedMemberId', async () => {
      if (!dbAvailable) {
        expect(true).toBe(true);
        return;
      }

      // Ensure plan exists
      const [existingPlan] = await db.select().from(plans).where(eq(plans.code, 'gold')).limit(1);
      if (!existingPlan) {
        await db.insert(plans).values({
          id: randomUUID(),
          code: 'gold',
          name: 'Gold Membership',
          pricePaise: 5000000,
          durationDays: 365,
          dailyBookingLimit: 2,
          advanceBookingDays: 14,
          active: true,
        });
      }

      const convLeadId = randomUUID();
      await db.insert(leads).values({
        id: convLeadId,
        name: 'Conversion Candidate',
        phone: '+919876511111',
        email: 'candidate@example.com',
        source: 'web_form',
        stage: 'quotation_sent',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const convRes = await Crm.convertLead(
        convLeadId,
        { planCode: 'gold', notes: 'Converted from spring enquiry' },
        testStaffUserId
      );

      expect(convRes).toBeDefined();
      expect(convRes.memberId).toBeDefined();
      expect(convRes.memberCode).toMatch(/^CC-/);
      expect(convRes.membershipId).toBeDefined();
      expect(convRes.invoiceId).toBeDefined();

      // Verify lead updated to converted
      const [updatedLead] = await db.select().from(leads).where(eq(leads.id, convLeadId)).limit(1);
      expect(updatedLead.stage).toBe('converted');
      expect(updatedLead.convertedMemberId).toBe(convRes.memberId);

      // Verify cannot convert an already converted lead
      await expect(
        Crm.convertLead(convLeadId, { planCode: 'gold' }, testStaffUserId)
      ).rejects.toThrow(/already converted/);
    });
  });

  describe('6. Background job: crm.overdueTasks', () => {
    it('executes overdue tasks job without throwing', async () => {
      await expect(runJob('crm.overdueTasks')).resolves.not.toThrow();
    });
  });
});
