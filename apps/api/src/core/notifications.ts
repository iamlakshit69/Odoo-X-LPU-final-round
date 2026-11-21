import { randomUUID } from 'node:crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq, and, or, inArray, desc, count } from 'drizzle-orm';
import { Channel, Notifications as NotificationsInterface, SessionUser } from '@club/contract';
import { db } from './db/index.js';
import { notifications, users, roles } from '../db/schema/core.js';
import { requireAuth } from './auth.js';
import { AppError } from './errors.js';

export interface NotificationPayload {
  to: {
    userId?: string;
    memberId?: string;
    leadId?: string;
  };
  template: string;
  channel?: Channel[];
  data: Record<string, unknown>;
}

export type TemplateRenderer = (data: Record<string, unknown>) => { title: string; body: string };

/**
 * Registry of standard notification templates from Section 9.
 */
export const templateRegistry: Record<string, TemplateRenderer> = {
  'booking.confirmed': (d) => ({
    title: 'Booking Confirmed',
    body: `Booking on ${d.courtName || 'Court'} for ${d.date || ''} ${d.time || ''} is confirmed.`,
  }),
  'booking.cancelled': (d) => ({
    title: 'Booking Cancelled',
    body: `Booking on ${d.courtName || 'Court'} for ${d.date || ''} has been cancelled.`,
  }),
  'membership.expiring': (d) => ({
    title: 'Membership Expiring Soon',
    body: `Your ${d.planName || 'club'} membership expires on ${d.expiryDate || 'soon'}.`,
  }),
  'membership.expired': (d) => ({
    title: 'Membership Expired',
    body: `Your membership has expired. Please renew to continue enjoying club privileges.`,
  }),
  'lead.new': (d) => ({
    title: 'New Lead Enquiry',
    body: `New enquiry from ${d.name || 'Guest'} (${d.phone || d.email || 'no contact'}).`,
  }),
  'lead.task_due': (d) => ({
    title: 'Lead Task Due',
    body: `Task '${d.taskTitle || 'Follow-up'}' for lead ${d.leadName || 'Lead'} is due today.`,
  }),
  'stock.low': (d) => ({
    title: 'Low Stock Alert',
    body: `Item '${d.itemName || 'Product'}' is low in stock (${d.quantity ?? 0} remaining).`,
  }),
  'order.ready': (d) => ({
    title: 'Order Ready',
    body: `Order #${d.orderNumber || d.orderId || ''} is ready for pickup.`,
  }),
  'leave.decision': (d) => ({
    title: 'Leave Request Decision',
    body: `Your leave request for ${d.dates || 'selected dates'} was ${d.status || 'processed'}.`,
  }),
  'quote.sent': (d) => ({
    title: 'Quote Sent',
    body: `Quote #${d.quoteNumber || d.quoteId || ''} has been sent to ${d.customerName || 'customer'}.`,
  }),
};

export function renderTemplate(templateName: string, data: Record<string, unknown>): { title: string; body: string } {
  const renderer = templateRegistry[templateName];
  if (renderer) {
    return renderer(data);
  }
  // Fallback for custom templates
  return {
    title: templateName.replace(/[._]/g, ' ').toUpperCase(),
    body: JSON.stringify(data),
  };
}

export class NotificationsService implements NotificationsInterface {
  /**
   * Sends a notification to one recipient across specified channels.
   * If channel array is omitted or empty, defaults to ['inapp'].
   */
  async send(n: NotificationPayload): Promise<void> {
    const channels = n.channel && n.channel.length > 0 ? n.channel : (['inapp'] as Channel[]);
    const rendered = renderTemplate(n.template, n.data);

    for (const channel of channels) {
      const isExternal = channel === 'email' || channel === 'sms' || channel === 'whatsapp';
      const status = isExternal ? 'sent' : 'queued';

      if (isExternal) {
        console.log(`[Notification:${channel}] To: ${JSON.stringify(n.to)} | Title: ${rendered.title} | Body: ${rendered.body}`);
      }

      const fullPayload = {
        title: rendered.title,
        body: rendered.body,
        ...n.data,
      };

      await db.insert(notifications).values({
        id: randomUUID(),
        userId: n.to.userId || null,
        memberId: n.to.memberId || null,
        leadId: n.to.leadId || null,
        channel,
        template: n.template,
        payload: fullPayload,
        status,
        createdAt: new Date(),
        readAt: null,
      });
    }
  }

  /**
   * Helper to send notifications to all active users with specific role codes.
   */
  async notifyRoles(
    roleCodes: string[],
    n: { template: string; channel?: Channel[]; data: Record<string, unknown> }
  ): Promise<void> {
    const targetUsers = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(inArray(roles.code, roleCodes), eq(users.active, true)));

    for (const target of targetUsers) {
      await this.send({
        to: { userId: target.id },
        template: n.template,
        channel: n.channel,
        data: n.data,
      });
    }
  }
}

export let Notifications: NotificationsService = new NotificationsService();

export function setNotifications(impl: NotificationsService): void {
  Notifications = impl;
}

/**
 * Registers Notification in-app inbox endpoints:
 * - GET /notifications
 * - POST /notifications/:id/read
 */
export async function registerNotificationRoutes(app: FastifyInstance) {
  // 1. GET /notifications
  app.get('/notifications', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser;
    const query = (req.query as any) || {};

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const statusFilter = query.status as string | undefined;

    // Build recipient condition: belongs to user, or member if user has linked member
    const recipientConditions = [eq(notifications.userId, user.id)];
    if (user.memberId) {
      recipientConditions.push(eq(notifications.memberId, user.memberId));
    }
    const ownershipWhere = or(...recipientConditions);

    const conditions = [ownershipWhere];
    if (statusFilter) {
      conditions.push(eq(notifications.status, statusFilter));
    }

    const whereClause = and(...conditions);

    // Count total
    const [totalRes] = await db
      .select({ val: count() })
      .from(notifications)
      .where(whereClause);
    const total = totalRes?.val ?? 0;

    // Fetch items
    const rows = await db
      .select()
      .from(notifications)
      .where(whereClause)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      memberId: r.memberId,
      leadId: r.leadId,
      channel: r.channel as Channel,
      template: r.template,
      payload: (r.payload as Record<string, unknown>) || {},
      status: r.status as 'queued' | 'sent' | 'read' | 'failed',
      createdAt: r.createdAt.toISOString(),
      readAt: r.readAt ? r.readAt.toISOString() : null,
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  });

  // 2. POST /notifications/:id/read
  app.post('/notifications/:id/read', { preHandler: [requireAuth] }, async (req: FastifyRequest, reply: FastifyReply) => {
    const user = (req as any).user as SessionUser;
    const { id } = req.params as { id: string };

    const [existing] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);

    if (!existing) {
      throw new AppError('NOT_FOUND', `Notification with id '${id}' not found`, 404);
    }

    // Permission check: owner or recipient
    const isOwner = user.roleCode === 'owner';
    const isUserRecipient = existing.userId === user.id;
    const isMemberRecipient = user.memberId && existing.memberId === user.memberId;

    if (!isOwner && !isUserRecipient && !isMemberRecipient) {
      throw new AppError('FORBIDDEN', 'Cannot mark another user notification as read', 403);
    }

    const now = new Date();
    const [updated] = await db
      .update(notifications)
      .set({
        status: 'read',
        readAt: now,
      })
      .where(eq(notifications.id, id))
      .returning();

    return {
      success: true,
      notification: {
        id: updated.id,
        userId: updated.userId,
        memberId: updated.memberId,
        leadId: updated.leadId,
        channel: updated.channel as Channel,
        template: updated.template,
        payload: (updated.payload as Record<string, unknown>) || {},
        status: updated.status as 'queued' | 'sent' | 'read' | 'failed',
        createdAt: updated.createdAt.toISOString(),
        readAt: updated.readAt ? updated.readAt.toISOString() : null,
      },
    };
  });
}
