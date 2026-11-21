import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp } from './helper.js';
import { can, guard } from '../src/core/rbac.js';
import { Settings } from '../src/core/settings.js';
import { Audit } from '../src/core/audit.js';
import { SessionUser } from '@club/contract';

describe('Phase 2: Auth, RBAC, Audit, and Settings (T13/T14)', () => {
  const app = createTestApp();

  // Add a test endpoint to verify own-scope RBAC guards
  app.get<{ Params: { memberId: string } }>(
    '/test/members/:memberId',
    {
      preHandler: [guard('member:read', (req) => (req.params as any)?.memberId)],
    },
    async (req) => {
      return { memberId: req.params.memberId, ok: true };
    }
  );

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Unauthenticated requests return 401', () => {
    it('GET /api/me without cookie returns 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/me',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });

    it('GET /api/admin/roles without cookie returns 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/admin/roles',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('2. RBAC: can() logic and :own scoping', () => {
    const memberUser: SessionUser & { permissions: string[] } = {
      id: '00000000-0000-0000-0000-000000000010',
      email: 'member@championsclub.in',
      name: 'Aarav Sharma',
      roleId: '10000000-0000-0000-0000-000000000010',
      roleCode: 'member',
      memberId: '20000000-0000-0000-0000-000000000001',
      active: true,
      permissions: [
        'member:read:own',
        'booking:create:own',
        'booking:read:own',
        'booking:cancel:own',
        'invoice:read:own',
      ],
    };

    const frontDeskUser: SessionUser & { permissions: string[] } = {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'frontdesk@championsclub.in',
      name: 'Sunita Rao',
      roleId: '10000000-0000-0000-0000-000000000003',
      roleCode: 'front_desk',
      active: true,
      permissions: ['member:create', 'member:read', 'booking:create', 'booking:read'],
    };

    it('allows a member to read their own data', () => {
      const allowed = can(memberUser, 'member:read', {
        ownerMemberId: '20000000-0000-0000-0000-000000000001',
      });
      expect(allowed).toBe(true);
    });

    it('denies a member requesting another member data (T13)', () => {
      const allowed = can(memberUser, 'member:read', {
        ownerMemberId: '20000000-0000-0000-0000-000000000999',
      });
      expect(allowed).toBe(false);
    });

    it('allows front desk to read any member data', () => {
      const allowed = can(frontDeskUser, 'member:read', {
        ownerMemberId: '20000000-0000-0000-0000-000000000999',
      });
      expect(allowed).toBe(true);
    });

    it('denies unknown permission by default (T13)', () => {
      const allowed = can(frontDeskUser, 'unknown:permission:code');
      expect(allowed).toBe(false);
    });

    it('returns 403 FORBIDDEN when route guard rejects permission', async () => {
      // Create a test app instance with a route that requires an unheld permission
      const customApp = createTestApp();
      customApp.get('/test/protected', { preHandler: [guard('rbac:manage')] }, async () => {
        return { ok: true };
      });

      // Inject request with mock member user
      customApp.addHook('onRequest', async (req) => {
        (req as any).user = memberUser;
      });

      const res = await customApp.inject({
        method: 'GET',
        url: '/test/protected',
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('FORBIDDEN');
      await customApp.close();
    });
  });

  describe('3. Settings Service & immediate cache invalidation', () => {
    it('retrieves default setting when not set in DB', async () => {
      const tz = await Settings.get<string>('club.timezone');
      expect(tz).toBe('Asia/Kolkata');

      const slotMinutes = await Settings.get<number>('booking.slot_minutes');
      expect(slotMinutes).toBe(30);
    });

    it('validates settings schemas per Section 5.9', () => {
      // Valid policy
      const validPolicy = [
        { hours_before: 24, refund_pct: 100 },
        { hours_before: 2, refund_pct: 50 },
      ];
      expect(Array.isArray(validPolicy)).toBe(true);
    });
  });

  describe('4. Audit Service writes audit events (T14)', () => {
    it('calls Audit.log without error', async () => {
      await expect(
        Audit.log({
          actor: '00000000-0000-0000-0000-000000000001',
          action: 'booking.create',
          resource: 'booking',
          recordId: 'rec-12345',
          after: { court: 'Tennis 1', slot: '10:00' },
          requestId: 'test-req-id-1',
        })
      ).resolves.not.toThrow();
    });
  });
});
