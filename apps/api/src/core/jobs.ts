import cron, { ScheduledTask } from 'node-cron';
import { db } from './db/index.js';
import { bookings } from '../db/schema/courts.js';
import { memberships, plans } from '../db/schema/members.js';
import { notifications } from '../db/schema/core.js';
import { and, eq, lt, gte } from 'drizzle-orm';
import { Notifications } from './notifications.js';
import { Settings } from './settings.js';
import { clubLocalToday, addClubDays, clubLocalDayBoundsUtc } from './clubTime.js';

export type JobHandler = () => Promise<void>;

export interface RegisteredJob {
  name: string;
  cronExpression: string;
  handler: JobHandler;
  task?: ScheduledTask;
}

const jobRegistry = new Map<string, RegisteredJob>();

/**
 * Registers an idempotent background job.
 * The handler is automatically wrapped with error handling and timing metrics.
 */
export function registerJob(name: string, cronExpression: string, handler: JobHandler): void {
  const wrappedHandler: JobHandler = async () => {
    const start = Date.now();
    try {
      await handler();
      const elapsed = Date.now() - start;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[Job: ${name}] Completed successfully in ${elapsed}ms`);
      }
    } catch (err) {
      console.error(`[Job: ${name}] Error executing job:`, err);
    }
  };

  jobRegistry.set(name, {
    name,
    cronExpression,
    handler: wrappedHandler,
  });
}

/**
 * Manually executes a job by name. Useful for unit tests, demo triggers, or admin commands.
 */
export async function runJob(name: string): Promise<void> {
  const job = jobRegistry.get(name);
  if (!job) {
    throw new Error(`Job '${name}' is not registered`);
  }
  await job.handler();
}

/**
 * Starts all registered cron jobs.
 */
export function startJobs(): void {
  for (const [name, job] of jobRegistry.entries()) {
    if (job.task) {
      job.task.stop();
    }
    job.task = cron.schedule(job.cronExpression, () => {
      job.handler();
    });
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[Jobs] Scheduled '${name}' (${job.cronExpression})`);
    }
  }
}

/**
 * Stops all scheduled cron tasks.
 */
export function stopJobs(): void {
  for (const job of jobRegistry.values()) {
    if (job.task) {
      job.task.stop();
      job.task = undefined;
    }
  }
}

/**
 * Returns all registered job names.
 */
export function getRegisteredJobs(): string[] {
  return Array.from(jobRegistry.keys());
}

// -------------------------------------------------------------
// Register the Standard Jobs from Section 9
// -------------------------------------------------------------

// 1. membership.expire - 00:05 daily
registerJob('membership.expire', '5 0 * * *', async () => {
  const today = clubLocalToday();
  const bounds = clubLocalDayBoundsUtc(today);

  const expiredMemberships = await db
    .update(memberships)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(memberships.status, 'active'), lt(memberships.endsOn, today)))
    .returning({ id: memberships.id, memberId: memberships.memberId });

  for (const m of expiredMemberships) {
    // Idempotency check: don't send duplicate notifications on the same day
    const alreadySent = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.memberId, m.memberId),
          eq(notifications.template, 'membership.expired'),
          gte(notifications.createdAt, bounds.start)
        )
      )
      .limit(1);

    if (alreadySent.length === 0) {
      await Notifications.send({
        to: { memberId: m.memberId },
        template: 'membership.expired',
        channel: ['inapp'],
        data: { membershipId: m.id },
      });
    }
  }
});

// 2. membership.remind - 09:00 daily
registerJob('membership.remind', '0 9 * * *', async () => {
  const today = clubLocalToday();
  const bounds = clubLocalDayBoundsUtc(today);

  let reminderDays: number[] = [30, 7, 1];
  try {
    const configured = await Settings.get<number[]>('membership.reminder_days');
    if (Array.isArray(configured) && configured.length > 0) {
      reminderDays = configured;
    }
  } catch {
    // fallback to default [30, 7, 1]
  }

  for (const days of reminderDays) {
    const targetDate = addClubDays(today, days);

    const expiringMemberships = await db
      .select({
        id: memberships.id,
        memberId: memberships.memberId,
        endsOn: memberships.endsOn,
        planName: plans.name,
      })
      .from(memberships)
      .innerJoin(plans, eq(memberships.planId, plans.id))
      .where(and(eq(memberships.status, 'active'), eq(memberships.endsOn, targetDate)));

    for (const m of expiringMemberships) {
      // Idempotency check: don't send duplicate reminder for this member today
      const alreadySent = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.memberId, m.memberId),
            eq(notifications.template, 'membership.expiring'),
            gte(notifications.createdAt, bounds.start)
          )
        )
        .limit(1);

      if (alreadySent.length === 0) {
        await Notifications.send({
          to: { memberId: m.memberId },
          template: 'membership.expiring',
          channel: ['inapp'],
          data: {
            planName: m.planName,
            expiryDate: m.endsOn,
            days,
          },
        });
      }
    }
  }
});

// 3. booking.expireHolds - every minute (* * * * *)
registerJob('booking.expireHolds', '* * * * *', async () => {
  const now = new Date();
  await db
    .update(bookings)
    .set({ status: 'expired' })
    .where(and(eq(bookings.status, 'held'), lt(bookings.expiresAt, now)));
});

// 4. stock.lowCheck - every 5 minutes (*/5 * * * *)
registerJob('stock.lowCheck', '*/5 * * * *', async () => {
  // Inventory low-stock check placeholder
});

// 5. crm.overdueTasks - hourly (0 * * * *)
registerJob('crm.overdueTasks', '0 * * * *', async () => {
  // CRM overdue tasks checker placeholder (real CRM logic in Phase 7)
});

// 6. bar.longOccupied - every 5 minutes (*/5 * * * *)
registerJob('bar.longOccupied', '*/5 * * * *', async () => {
  // Bar occupied too long checker placeholder (Dev B commerce)
});
