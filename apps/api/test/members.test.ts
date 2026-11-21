import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, isDbConnected } from './helper.js';
import { Members, getPlanEntitlements } from '../src/modules/members/service.js';
import { runJob } from '../src/core/jobs.js';
import { db } from '../src/core/db/index.js';
import { members, plans, memberships } from '../src/db/schema/members.js';
import { eq } from 'drizzle-orm';
import { SessionUser } from '@club/contract';
import { randomUUID } from 'node:crypto';

describe('Phase 4: Members, Plans, and Lifecycle (T4/T13)', () => {
  const app = createTestApp();
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDbConnected();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Plan Entitlements & getActivePlan resolution (T4)', () => {
    it('returns derived entitlements for all plan tiers', () => {
      const gold = getPlanEntitlements('gold');
      expect(gold.courtRate).toContain('Free');
      expect(gold.shopDiscountBps).toBe(1500);
      expect(gold.barDiscountBps).toBe(1000);

      const silver = getPlanEntitlements('silver');
      expect(silver.courtRate).toContain('40% off peak');
      expect(silver.shopDiscountBps).toBe(1000);
      expect(silver.barDiscountBps).toBe(500);

      const junior = getPlanEntitlements('junior');
      expect(junior.courtRate).toContain('70% off');
      expect(junior.shopDiscountBps).toBe(500);
      expect(junior.barDiscountBps).toBe(0);

      const walkin = getPlanEntitlements('walkin');
      expect(walkin.shopDiscountBps).toBe(0);
      expect(walkin.barDiscountBps).toBe(0);
    });

    it('getActivePlan treats unknown member as walkin', async () => {
      const res = await Members.getActivePlan(randomUUID());
      expect(res.planCode).toBe('walkin');
      expect(res.status).toBe('none');
      expect(res.dailyBookingLimit).toBe(0);
    });

    it('getActivePlan resolves expired and suspended members to walkin (T4)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        return;
      }

      // Check seeded members
      const [expiredMem] = await db
        .select({ id: members.id })
        .from(members)
        .innerJoin(memberships, eq(members.id, memberships.memberId))
        .where(eq(memberships.status, 'expired'))
        .limit(1);

      if (expiredMem) {
        const planInfo = await Members.getActivePlan(expiredMem.id);
        expect(planInfo.planCode).toBe('walkin');
        expect(planInfo.status).toBe('expired');
        expect(planInfo.dailyBookingLimit).toBe(0);
      }

      const [suspendedMem] = await db
        .select({ id: members.id })
        .from(members)
        .innerJoin(memberships, eq(members.id, memberships.memberId))
        .where(eq(memberships.status, 'suspended'))
        .limit(1);

      if (suspendedMem) {
        const planInfo = await Members.getActivePlan(suspendedMem.id);
        expect(planInfo.planCode).toBe('walkin');
        expect(planInfo.status).toBe('suspended');
        expect(planInfo.dailyBookingLimit).toBe(0);
      }
    });
  });

  describe('2. RBAC & Member Isolation (T13)', () => {
    const member1Id = '00000000-0000-0000-0000-000000000001';
    const member2Id = '00000000-0000-0000-0000-000000000002';

    const member1User: SessionUser = {
      id: '00000000-0000-0000-0000-000000000010',
      email: 'member1@championsclub.in',
      name: 'Aarav Sharma',
      roleId: '10000000-0000-0000-0000-000000000010',
      roleCode: 'member',
      memberId: member1Id,
      active: true,
    };

    it('GET /api/plans is public and requires no authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/plans',
      });

      expect(res.statusCode).toBe(200);
      const plansList = JSON.parse(res.body);
      expect(Array.isArray(plansList)).toBe(true);
    });

    it('member cannot read another member profile (T13)', async () => {
      const customApp = createTestApp();
      customApp.addHook('onRequest', async (req) => {
        (req as any).user = member1User;
      });

      // Attempt reading member 2 profile with member 1 session
      const res = await customApp.inject({
        method: 'GET',
        url: `/api/members/${member2Id}`,
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');

      await customApp.close();
    });

    it('unauthenticated request to create member returns 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/members',
        payload: {
          fullName: 'Test Walkin',
          phone: '+919999999999',
          planCode: 'silver',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('3. Background Jobs idempotency for memberships', () => {
    it('runJob membership.expire runs idempotently', async () => {
      await expect(runJob('membership.expire')).resolves.not.toThrow();
      await expect(runJob('membership.expire')).resolves.not.toThrow();
    });

    it('runJob membership.remind runs idempotently', async () => {
      await expect(runJob('membership.remind')).resolves.not.toThrow();
      await expect(runJob('membership.remind')).resolves.not.toThrow();
    });
  });

  describe('4. Member creation and check-in workflow (when DB online)', () => {
    it('creates member end-to-end with invoice and QR token', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        return;
      }

      // Create member directly through service
      const res = await Members.createMember({
        fullName: 'Test New Member',
        phone: `+9199${Date.now().toString().slice(-8)}`,
        email: `test-${Date.now()}@example.com`,
        planCode: 'silver',
      });

      expect(res.member).toBeDefined();
      expect(res.member.memberCode).toMatch(/^CC-\d{6}$/);
      expect(res.qrToken).toBeDefined();
      expect(res.membership.status).toBe('active');
      expect(res.invoiceId).toBeDefined();

      // Perform check-in with the generated QR token
      const checkinRes = await Members.checkin({
        qrToken: res.qrToken,
      });

      expect(checkinRes.checkin).toBeDefined();
      expect(checkinRes.memberCard.fullName).toBe('Test New Member');
      expect(checkinRes.memberCard.planCode).toBe('silver');
      expect(checkinRes.memberCard.status).toBe('active');
    });
  });
});
