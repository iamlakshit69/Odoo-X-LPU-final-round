// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, timestampAtSchema } from './common.js';

export const roleSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  id: uuidSchema,
  code: z.string(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const settingSchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable().optional(),
  updatedBy: uuidSchema.nullable().optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Setting = z.infer<typeof settingSchema>;

export const auditLogSchema = z.object({
  id: uuidSchema,
  at: timestampAtSchema,
  actorUserId: uuidSchema.nullable().optional(),
  action: z.string(),
  resource: z.string(),
  recordId: z.string(),
  before: z.record(z.unknown()).nullable().optional(),
  after: z.record(z.unknown()).nullable().optional(),
  meta: z.record(z.unknown()).nullable().optional(),
  requestId: z.string().nullable().optional(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const notificationChannelSchema = z.enum(['inapp', 'email', 'sms', 'whatsapp']);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationStatusSchema = z.enum(['queued', 'sent', 'read', 'failed']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationSchema = z.object({
  id: uuidSchema,
  userId: uuidSchema.nullable().optional(),
  memberId: uuidSchema.nullable().optional(),
  leadId: uuidSchema.nullable().optional(),
  channel: notificationChannelSchema,
  template: z.string(),
  payload: z.record(z.unknown()).nullable().optional(),
  status: notificationStatusSchema,
  createdAt: timestampAtSchema,
  readAt: timestampAtSchema.nullable().optional(),
});
export type Notification = z.infer<typeof notificationSchema>;
