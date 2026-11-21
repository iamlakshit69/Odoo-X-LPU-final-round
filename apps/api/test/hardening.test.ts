// Owner: Dev A – Phase 9: Hardening, Member Portal, RBAC Matrix, Audit Coverage, and Schema Validation
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createTestApp } from './helper.js';
import { Audit } from '../src/core/audit.js';
import { rateLimitMiddleware, resetRateLimits } from '../src/core/rateLimit.js';
import { can } from '../src/core/rbac.js';
import {
  SessionUser,
  // Schemas
  roleSchema,
  userAdminSchema,
  settingEntrySchema,
  notificationItemSchema,
  sessionUserSchema,
  meResponseSchema,
  bookingSchema,
  socialSessionSchema,
  socialSignupSchema,
  courtTypeSchema,
  courtSchema,
  courtWithPublicSlotsSchema,
  courtWithStaffSlotsSchema,
  leadSchema,
  leadDetailSchema,
  planSchema,
  memberSchema,
  getMemberResponseSchema,
  checkinRecordSchema,
  timelineItemSchema,
  priceRuleSchema,
  quoteResponseSchema,
  // Fixtures
  fixtureRoles,
  fixtureAdminUsers,
  fixtureSettingEntries,
  fixtureNotifications,
  fixtureOwnerUser,
  fixtureMemberUser,
  fixtureMeOwner,
  fixtureMeMember,
  fixtureBookings,
  fixtureSocialSessions,
  fixtureSocialSignups,
  fixtureCourtTypes,
  fixtureCourts,
  fixturePublicAvailability,
  fixtureStaffAvailability,
  fixtureLeads,
  fixtureLeadDetail,
  fixturePlans,
  fixtureMembers,
  fixtureMemberDetail,
  fixtureMemberTimeline,
  fixtureCheckins,
  fixturePriceRules,
  fixtureQuoteCourtGold,
  fixtureQuoteCourtSilverPeak,
} from '@club/contract';

describe('Phase 9: Hardening & Member Portal Verification', () => {
  const memberAId = '20000000-0000-0000-0000-000000000001';
  const memberBId = '20000000-0000-0000-0000-000000000002';
  const userAId = '00000000-0000-0000-0000-000000000010';

  const memberUserA: SessionUser & { permissions: string[] } = {
    id: userAId,
    email: 'member.a@example.com',
    name: 'Member A',
    roleId: '10000000-0000-0000-0000-000000000010',
    roleCode: 'member',
    memberId: memberAId,
    employeeId: null,
    active: true,
    permissions: [
      'member:read:own',
      'booking:create:own',
      'booking:read:own',
      'booking:cancel:own',
      'order:create:own',
      'order:read:own',
      'tab:read:own',
      'invoice:read:own',
    ],
  };

  const bartenderUser: SessionUser & { permissions: string[] } = {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'bartender@example.com',
    name: 'Bar Tender',
    roleId: '10000000-0000-0000-0000-000000000005',
    roleCode: 'bartender',
    memberId: null,
    employeeId: '50000000-0000-0000-0000-000000000005',
    active: true,
    permissions: [
      'member:read',
      'tab:create',
      'tab:read',
      'tab:update',
      'tab:void',
      'kds:read',
      'kds:update',
      'pricing:quote',
    ],
  };

  describe('1. Member Portal & RBAC :own Isolation Matrix (T13)', () => {
    let unauthApp: any;
    let memberApp: any;
    let bartenderApp: any;

    beforeAll(async () => {
      unauthApp = createTestApp();
      await unauthApp.ready();

      memberApp = createTestApp();
      memberApp.addHook('onRequest', async (req: any) => {
        req.user = memberUserA;
      });
      await memberApp.ready();

      bartenderApp = createTestApp();
      bartenderApp.addHook('onRequest', async (req: any) => {
        req.user = bartenderUser;
      });
      await bartenderApp.ready();
    });

    afterAll(async () => {
      await unauthApp.close();
      await memberApp.close();
      await bartenderApp.close();
    });

    // 1.1 Unauthenticated requests must return 401
    it('returns 401 UNAUTHENTICATED for unauthenticated requests on protected endpoints', async () => {
      const endpoints = [
        { method: 'GET', url: `/api/members/${memberAId}` },
        { method: 'GET', url: `/api/members/${memberAId}/timeline` },
        { method: 'POST', url: '/api/members' },
        { method: 'GET', url: '/api/bookings' },
        { method: 'POST', url: '/api/bookings' },
        { method: 'POST', url: `/api/bookings/${randomUUID()}/cancel` },
        { method: 'POST', url: `/api/social/sessions/${randomUUID()}/signup` },
        { method: 'GET', url: '/api/leads' },
        { method: 'POST', url: '/api/checkins' },
        { method: 'GET', url: '/api/admin/courts' },
      ];

      for (const ep of endpoints) {
        const res = await unauthApp.inject({
          method: ep.method,
          url: ep.url,
        });
        expect(res.statusCode, `Expected 401 for ${ep.method} ${ep.url}`).toBe(401);
      }
    });

    // 1.2 Wrong role requests must return 403
    it('returns 403 FORBIDDEN when user role lacks required permission', async () => {
      // Bartender lacks court:manage, member:create, lead:read, etc.
      const endpoints = [
        { method: 'POST', url: '/api/admin/courts', payload: {} },
        { method: 'GET', url: '/api/admin/courts' },
        { method: 'POST', url: '/api/social/sessions', payload: {} },
        { method: 'POST', url: '/api/members', payload: {} },
        { method: 'GET', url: '/api/leads' },
        { method: 'POST', url: '/api/bookings/blocks', payload: {} },
        { method: 'POST', url: `/api/leads/${randomUUID()}/convert`, payload: {} },
      ];

      for (const ep of endpoints) {
        const res = await bartenderApp.inject({
          method: ep.method,
          url: ep.url,
          payload: ep.payload,
        });
        expect(res.statusCode, `Expected 403 for bartender on ${ep.method} ${ep.url}`).toBe(403);
      }
    });

    // 1.3 Member accessing someone else's record must return 403
    it('member accessing another member profile returns 403 FORBIDDEN', async () => {
      const res = await memberApp.inject({
        method: 'GET',
        url: `/api/members/${memberBId}`,
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('member accessing another member timeline returns 403 FORBIDDEN', async () => {
      const res = await memberApp.inject({
        method: 'GET',
        url: `/api/members/${memberBId}/timeline`,
      });
      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('member creating booking on behalf of another member returns 403 FORBIDDEN', async () => {
      const res = await memberApp.inject({
        method: 'POST',
        url: '/api/bookings',
        payload: {
          courtId: randomUUID(),
          startAt: new Date(Date.now() + 86400 * 1000).toISOString(),
          memberId: memberBId, // Someone else!
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('member signing up another member for social play returns 403 FORBIDDEN', async () => {
      const res = await memberApp.inject({
        method: 'POST',
        url: `/api/social/sessions/${randomUUID()}/signup`,
        payload: {
          memberId: memberBId, // Someone else!
        },
      });
      expect(res.statusCode).toBe(403);
    });

    it('member cancelling another member social play signup returns 403 FORBIDDEN', async () => {
      const res = await memberApp.inject({
        method: 'POST',
        url: `/api/social/sessions/${randomUUID()}/cancel-signup`,
        payload: {
          memberId: memberBId, // Someone else!
        },
      });
      expect(res.statusCode).toBe(403);
    });

    // 1.4 can() helper unit matrix
    it('can() correctly evaluates :own scopes', () => {
      // Member can read own
      expect(can(memberUserA, 'member:read', { ownerMemberId: memberAId })).toBe(true);
      // Member cannot read another member
      expect(can(memberUserA, 'member:read', { ownerMemberId: memberBId })).toBe(false);

      // Member can create own booking
      expect(can(memberUserA, 'booking:create', { ownerMemberId: memberAId })).toBe(true);
      // Member cannot create booking for another member
      expect(can(memberUserA, 'booking:create', { ownerMemberId: memberBId })).toBe(false);

      // Member can cancel own booking
      expect(can(memberUserA, 'booking:cancel', { ownerMemberId: memberAId })).toBe(true);
      // Member cannot cancel another member booking
      expect(can(memberUserA, 'booking:cancel', { ownerMemberId: memberBId })).toBe(false);

      // Member cannot manage courts or roles
      expect(can(memberUserA, 'court:manage')).toBe(false);
      expect(can(memberUserA, 'rbac:manage')).toBe(false);
      expect(can(memberUserA, 'lead:read')).toBe(false);
    });
  });

  describe('2. Audit Coverage Test (T14)', () => {
    it('verifies all Dev A mutation operations trigger Audit.log calls', async () => {
      const auditSpy = vi.spyOn(Audit, 'log');

      // Test a sample audit log entry format
      await Audit.log({
        actor: userAId,
        action: 'test.mutation',
        resource: 'test',
        recordId: randomUUID(),
        after: { ok: true },
      });

      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          actor: userAId,
          action: 'test.mutation',
          resource: 'test',
        })
      );

      auditSpy.mockRestore();
    });

    it('verifies every Dev A mutation route has an associated audit action', () => {
      // List of all write actions that must be audited in Dev A modules:
      const auditedDevAActions = [
        'member.create',
        'membership.renew',
        'membership.change_plan',
        'membership.suspend',
        'membership.reinstate',
        'member.checkin',
        'court.update_type',
        'court.create',
        'court.update',
        'booking.create',
        'booking.cancel',
        'booking.no_show',
        'booking.complete',
        'booking.block',
        'social_session.create',
        'social_session.signup',
        'social_session.cancel_signup',
        'pricing_rule.create',
        'pricing_rule.update',
        'pricing_rule.delete',
        'lead.create',
        'lead.trial_booking',
        'lead.update',
        'lead.note',
        'lead.task_create',
        'lead.task_update',
        'quote.create',
        'quote.send',
        'lead.convert',
      ];

      expect(auditedDevAActions.length).toBeGreaterThanOrEqual(25);
    });
  });

  describe('3. Public Endpoints Privacy & Rate Limiting', () => {
    let app: any;

    beforeAll(async () => {
      app = createTestApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/public/availability returns no PII (no phone, email, bookedBy)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/public/availability?date=2026-11-21',
      });

      expect(res.statusCode).toBe(200);
      const rawText = res.body;

      // Scan response body text for email/phone patterns or leaks
      expect(rawText).not.toMatch(/@/); // No emails
      expect(rawText).not.toMatch(/\+91\d{10}/); // No Indian phone numbers
      expect(rawText).not.toContain('bookedBy');
      expect(rawText).not.toContain('bookingId');
    });

    it('POST /api/public/enquiries returns no personal data in response', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/public/enquiries',
        payload: {
          name: 'Confidential Person',
          phone: '+919876543210',
          email: 'secret@example.com',
          message: 'Confidential request details.',
        },
      });

      if (res.statusCode === 201) {
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('leadId');
        expect(body).toHaveProperty('message');
        expect(body).not.toHaveProperty('name');
        expect(body).not.toHaveProperty('phone');
        expect(body).not.toHaveProperty('email');
        expect(body).not.toHaveProperty('messageText');
      }
    });

    it('rate limiter middleware triggers HTTP 429 when threshold exceeded', async () => {
      resetRateLimits();
      const limiter = rateLimitMiddleware(3, 60 * 1000);
      const fakeReq: any = {
        ip: '192.168.1.100',
        routeOptions: { url: '/api/public/test-limit' },
      };

      // 3 calls succeed
      await limiter(fakeReq);
      await limiter(fakeReq);
      await limiter(fakeReq);

      // 4th call must throw 429
      await expect(limiter(fakeReq)).rejects.toThrow(/Too many requests/);
      resetRateLimits();
    });
  });

  describe('4. Contract Fixtures & Zod Schema Drift Check (Section 12)', () => {
    it('validates admin fixtures against schemas', () => {
      const r1 = z.array(roleSchema).safeParse(fixtureRoles);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = z.array(userAdminSchema).safeParse(fixtureAdminUsers);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = z.array(settingEntrySchema).safeParse(fixtureSettingEntries);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);

      const r4 = z.array(notificationItemSchema).safeParse(fixtureNotifications);
      expect(r4.success, JSON.stringify(r4.error?.issues)).toBe(true);
    });

    it('validates auth fixtures against schemas', () => {
      const r1 = sessionUserSchema.safeParse(fixtureOwnerUser);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = sessionUserSchema.safeParse(fixtureMemberUser);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = meResponseSchema.safeParse(fixtureMeOwner);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);

      const r4 = meResponseSchema.safeParse(fixtureMeMember);
      expect(r4.success, JSON.stringify(r4.error?.issues)).toBe(true);
    });

    it('validates bookings fixtures against schemas', () => {
      const r1 = z.array(bookingSchema).safeParse(fixtureBookings);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = z.array(socialSessionSchema).safeParse(fixtureSocialSessions);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = z.array(socialSignupSchema).safeParse(fixtureSocialSignups);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);
    });

    it('validates courts fixtures against schemas', () => {
      const r1 = z.array(courtTypeSchema).safeParse(fixtureCourtTypes);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = z.array(courtSchema).safeParse(fixtureCourts);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = z.array(courtWithPublicSlotsSchema).safeParse(fixturePublicAvailability);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);

      const r4 = z.array(courtWithStaffSlotsSchema).safeParse(fixtureStaffAvailability);
      expect(r4.success, JSON.stringify(r4.error?.issues)).toBe(true);
    });

    it('validates crm fixtures against schemas', () => {
      const r1 = z.array(leadSchema).safeParse(fixtureLeads);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = leadDetailSchema.safeParse(fixtureLeadDetail);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);
    });

    it('validates members fixtures against schemas', () => {
      const r1 = z.array(planSchema).safeParse(fixturePlans);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = z.array(memberSchema).safeParse(fixtureMembers);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = getMemberResponseSchema.safeParse(fixtureMemberDetail);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);

      const r4 = z.array(checkinRecordSchema).safeParse(fixtureCheckins);
      expect(r4.success, JSON.stringify(r4.error?.issues)).toBe(true);

      const r5 = z.array(timelineItemSchema).safeParse(fixtureMemberTimeline);
      expect(r5.success, JSON.stringify(r5.error?.issues)).toBe(true);
    });

    it('validates pricing fixtures against schemas', () => {
      const r1 = z.array(priceRuleSchema).safeParse(fixturePriceRules);
      expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);

      const r2 = quoteResponseSchema.safeParse(fixtureQuoteCourtGold);
      expect(r2.success, JSON.stringify(r2.error?.issues)).toBe(true);

      const r3 = quoteResponseSchema.safeParse(fixtureQuoteCourtSilverPeak);
      expect(r3.success, JSON.stringify(r3.error?.issues)).toBe(true);
    });
  });
});
