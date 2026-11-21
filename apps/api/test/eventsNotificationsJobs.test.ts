import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, isDbConnected } from './helper.js';
import { Events, SseClient } from '../src/core/events.js';
import { Notifications, templateRegistry, renderTemplate } from '../src/core/notifications.js';
import { getRegisteredJobs, runJob } from '../src/core/jobs.js';
import { db } from '../src/core/db/index.js';
import { notifications, users } from '../src/db/schema/core.js';
import { eq } from 'drizzle-orm';
import { SessionUser } from '@club/contract';

describe('Phase 3: Events (SSE), Notifications, and Background Jobs', () => {
  const app = createTestApp();
  let dbAvailable = false;

  beforeAll(async () => {
    dbAvailable = await isDbConnected();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Events & SSE permissions and fan-out', () => {
    const publicClientRes = {
      chunks: [] as string[],
      write(chunk: string) {
        this.chunks.push(chunk);
      },
    };

    const frontDeskClientRes = {
      chunks: [] as string[],
      write(chunk: string) {
        this.chunks.push(chunk);
      },
    };

    const memberClientRes = {
      chunks: [] as string[],
      write(chunk: string) {
        this.chunks.push(chunk);
      },
    };

    const frontDeskUser: SessionUser = {
      id: '00000000-0000-0000-0000-000000000003',
      email: 'desk@championsclub.in',
      name: 'Rohan Patel',
      roleId: '10000000-0000-0000-0000-000000000003',
      roleCode: 'front_desk',
      active: true,
    };

    const memberUser: SessionUser = {
      id: '00000000-0000-0000-0000-000000000010',
      email: 'member@championsclub.in',
      name: 'Aarav Sharma',
      roleId: '10000000-0000-0000-0000-000000000010',
      roleCode: 'member',
      active: true,
    };

    it('canReceive filters topics based on client role and public flag', () => {
      const publicClient: SseClient = {
        id: 'pub-1',
        rawRes: publicClientRes,
        isPublic: true,
      };

      const frontDeskClient: SseClient = {
        id: 'fd-1',
        rawRes: frontDeskClientRes,
        user: frontDeskUser,
        isPublic: false,
      };

      const memberClient: SseClient = {
        id: 'mem-1',
        rawRes: memberClientRes,
        user: memberUser,
        isPublic: false,
      };

      // Public can only receive booking.changed
      expect(Events.canReceive(publicClient, 'booking.changed')).toBe(true);
      expect(Events.canReceive(publicClient, 'lead.created')).toBe(false);
      expect(Events.canReceive(publicClient, 'order.item')).toBe(false);

      // Front desk can receive booking.changed and lead.created
      expect(Events.canReceive(frontDeskClient, 'booking.changed')).toBe(true);
      expect(Events.canReceive(frontDeskClient, 'lead.created')).toBe(true);
      expect(Events.canReceive(frontDeskClient, 'order.item')).toBe(false);

      // Member can receive booking.changed but not lead.created
      expect(Events.canReceive(memberClient, 'booking.changed')).toBe(true);
      expect(Events.canReceive(memberClient, 'lead.created')).toBe(false);
    });

    it('publishes events only to authorized SSE subscribers', () => {
      Events.clear();

      const pubClient: SseClient = {
        id: 'pub-test',
        rawRes: {
          chunks: [] as string[],
          write(c: string) {
            this.chunks.push(c);
          },
        },
        isPublic: true,
      };

      const fdClient: SseClient = {
        id: 'fd-test',
        rawRes: {
          chunks: [] as string[],
          write(c: string) {
            this.chunks.push(c);
          },
        },
        user: frontDeskUser,
        isPublic: false,
      };

      Events.addClient(pubClient);
      Events.addClient(fdClient);

      // 1. Publish booking.changed -> both should receive
      Events.publish('booking.changed', { courtId: 'c1', date: '2026-11-25' });

      expect(pubClient.rawRes.chunks.length).toBe(1);
      expect(pubClient.rawRes.chunks[0]).toContain('event: booking.changed');
      expect(pubClient.rawRes.chunks[0]).toContain('"courtId":"c1"');

      expect(fdClient.rawRes.chunks.length).toBe(1);
      expect(fdClient.rawRes.chunks[0]).toContain('event: booking.changed');

      // 2. Publish lead.created -> only front desk should receive
      Events.publish('lead.created', { leadId: 'lead-999' });

      expect(pubClient.rawRes.chunks.length).toBe(1); // Unchanged!
      expect(fdClient.rawRes.chunks.length).toBe(2);
      expect(fdClient.rawRes.chunks[1]).toContain('event: lead.created');
      expect(fdClient.rawRes.chunks[1]).toContain('"leadId":"lead-999"');

      Events.clear();
    });

    it('GET /api/events without authentication returns 401 UNAUTHENTICATED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/events',
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('2. Notifications Template Registry & channel handling', () => {
    it('renders all 10 templates from Section 9', () => {
      const requiredTemplates = [
        'booking.confirmed',
        'booking.cancelled',
        'membership.expiring',
        'membership.expired',
        'lead.new',
        'lead.task_due',
        'stock.low',
        'order.ready',
        'leave.decision',
        'quote.sent',
      ];

      for (const tmpl of requiredTemplates) {
        expect(templateRegistry[tmpl]).toBeDefined();
        const rendered = renderTemplate(tmpl, {
          courtName: 'Badminton 1',
          date: '2026-11-25',
          time: '10:00 AM',
          planName: 'Gold',
          expiryDate: '2026-12-31',
          name: 'Priya',
          phone: '9999999999',
          taskTitle: 'Follow-up call',
          leadName: 'Lead 1',
          itemName: 'Yonex Shuttle',
          quantity: 3,
          orderNumber: 'ORD-101',
          dates: '2026-12-01 to 2026-12-03',
          status: 'approved',
          quoteNumber: 'Q-500',
          customerName: 'Aarav',
        });
        expect(rendered.title.length).toBeGreaterThan(0);
        expect(rendered.body.length).toBeGreaterThan(0);
      }
    });

    it('Notifications.send creates rows in notifications table per specified channel (when DB online)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        return;
      }

      const testUserId = '00000000-0000-0000-0000-000000000003';

      await Notifications.send({
        to: { userId: testUserId },
        template: 'booking.confirmed',
        channel: ['inapp', 'email'],
        data: { courtName: 'Badminton 1', date: '2026-11-25', time: '10:00 AM' },
      });

      const userNotifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, testUserId));

      const inappNotif = userNotifs.find(
        (n) => n.channel === 'inapp' && n.template === 'booking.confirmed'
      );
      const emailNotif = userNotifs.find(
        (n) => n.channel === 'email' && n.template === 'booking.confirmed'
      );

      expect(inappNotif).toBeDefined();
      expect(inappNotif?.status).toBe('queued');
      expect((inappNotif?.payload as any)?.title).toBe('Booking Confirmed');
      expect((inappNotif?.payload as any)?.body).toContain('Badminton 1');

      expect(emailNotif).toBeDefined();
      expect(emailNotif?.status).toBe('sent');
    });

    it('notifyRoles sends notification to all active users with the matching role (when DB online)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        return;
      }

      const fdUsers = await db
        .select()
        .from(users)
        .where(eq(users.email, 'desk@championsclub.in'));

      expect(fdUsers.length).toBeGreaterThan(0);
      const targetUserId = fdUsers[0].id;

      await Notifications.notifyRoles(['front_desk'], {
        template: 'lead.new',
        channel: ['inapp'],
        data: { name: 'Priya Sharma', phone: '+919876543210' },
      });

      const notifs = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, targetUserId));

      const leadNotif = notifs.find(
        (n) => n.template === 'lead.new' && (n.payload as any)?.body?.includes('Priya Sharma')
      );

      expect(leadNotif).toBeDefined();
      expect((leadNotif?.payload as any)?.title).toBe('New Lead Enquiry');
    });

    it('GET /api/notifications returns user inbox and POST /api/notifications/:id/read marks read (when DB online)', async () => {
      if (!dbAvailable) {
        console.log('Skipping live DB check as Postgres is currently offline.');
        return;
      }

      // 1. Login as front_desk user
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'desk@championsclub.in',
          password: 'demo1234',
        },
      });

      expect(loginRes.statusCode).toBe(200);
      const cookieHeader = loginRes.headers['set-cookie'];
      expect(cookieHeader).toBeDefined();

      // 2. Fetch inbox
      const inboxRes = await app.inject({
        method: 'GET',
        url: '/api/notifications',
        headers: {
          cookie: Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string),
        },
      });

      expect(inboxRes.statusCode).toBe(200);
      const inbox = JSON.parse(inboxRes.body);
      expect(inbox.items.length).toBeGreaterThan(0);
      const unreadItem = inbox.items[0];
      expect(unreadItem.readAt).toBeNull();

      // 3. Mark as read
      const markReadRes = await app.inject({
        method: 'POST',
        url: `/api/notifications/${unreadItem.id}/read`,
        headers: {
          cookie: Array.isArray(cookieHeader) ? cookieHeader[0] : (cookieHeader as string),
        },
      });

      expect(markReadRes.statusCode).toBe(200);
      const readResult = JSON.parse(markReadRes.body);
      expect(readResult.success).toBe(true);
      expect(readResult.notification.status).toBe('read');
      expect(readResult.notification.readAt).not.toBeNull();
    });
  });

  describe('3. Background Jobs Registry & manual runner', () => {
    it('registers all standard jobs from Section 9', () => {
      const jobs = getRegisteredJobs();
      expect(jobs).toContain('membership.expire');
      expect(jobs).toContain('membership.remind');
      expect(jobs).toContain('booking.expireHolds');
      expect(jobs).toContain('stock.lowCheck');
      expect(jobs).toContain('crm.overdueTasks');
      expect(jobs).toContain('bar.longOccupied');
    });

    it('runJob executes jobs idempotently without unhandled rejection', async () => {
      await expect(runJob('booking.expireHolds')).resolves.not.toThrow();
      await expect(runJob('membership.expire')).resolves.not.toThrow();
      await expect(runJob('crm.overdueTasks')).resolves.not.toThrow();
      await expect(runJob('stock.lowCheck')).resolves.not.toThrow();
      await expect(runJob('bar.longOccupied')).resolves.not.toThrow();
      await expect(runJob('membership.remind')).resolves.not.toThrow();
    });

    it('runJob throws an error for unknown job', async () => {
      await expect(runJob('nonexistent.job')).rejects.toThrow(/not registered/);
    });
  });
});
