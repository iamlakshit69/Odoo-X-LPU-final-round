// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  timestampAtSchema,
  dateOnSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Section 5.1 & 8 Models
export const roleSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
});
export type Role = z.infer<typeof roleSchema>;

export const permissionSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  description: z.string().optional(),
});
export type Permission = z.infer<typeof permissionSchema>;

export const roleWithPermissionsSchema = roleSchema.extend({
  permissions: z.array(permissionSchema),
});
export type RoleWithPermissions = z.infer<typeof roleWithPermissionsSchema>;

export const userAdminSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string(),
  roleId: uuidSchema,
  roleCode: z.string(),
  roleName: z.string().optional(),
  memberId: uuidSchema.nullable().optional(),
  employeeId: uuidSchema.nullable().optional(),
  active: z.boolean(),
  createdAt: timestampAtSchema.optional(),
});
export type UserAdmin = z.infer<typeof userAdminSchema>;

export const auditLogSchema = z.object({
  id: uuidSchema,
  at: timestampAtSchema,
  actorUserId: uuidSchema.nullable().optional(),
  actorName: z.string().optional(),
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
export type Channel = z.infer<typeof notificationChannelSchema>;

export const notificationStatusSchema = z.enum(['queued', 'sent', 'read', 'failed']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationItemSchema = z.object({
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
export type NotificationItem = z.infer<typeof notificationItemSchema>;

// Section 5.9: Settings Schemas (one per key)
export const settingClubTimezoneSchema = z.string().default('Asia/Kolkata');
export const settingBookingSlotMinutesSchema = z.number().int().positive().default(30);
export const settingBookingSessionMinutesSchema = z.number().int().positive().default(60);
export const settingBookingHoldMinutesSchema = z.number().int().positive().default(5);
export const settingBookingDefaultDailyLimitSchema = z.number().int().min(1).default(2);
export const settingBookingAdvanceDaysSchema = z.number().int().min(1).default(14);
export const settingBookingCancellationPolicySchema = z.array(
  z.object({
    hours_before: z.number().int().min(0),
    refund_pct: z.number().int().min(0).max(100),
  })
);
export const settingSocialWindowsSchema = z.array(
  z.object({
    weekday: z.number().int().min(0).max(6),
    from: z.string(),
    to: z.string(),
    capacity: z.number().int().positive(),
  })
);
export const settingMembershipReminderDaysSchema = z.array(z.number().int().positive());
export const settingCrmStagesSchema = z.array(z.string().min(1));
export const settingInventoryDefaultLowStockSchema = z.number().int().min(0).default(3);
export const settingBarTableOccupiedMinutesSchema = z.number().int().min(0).default(90);

export const settingsMapSchema = z.object({
  'club.timezone': settingClubTimezoneSchema,
  'booking.slot_minutes': settingBookingSlotMinutesSchema,
  'booking.session_minutes': settingBookingSessionMinutesSchema,
  'booking.hold_minutes': settingBookingHoldMinutesSchema,
  'booking.default_daily_limit': settingBookingDefaultDailyLimitSchema,
  'booking.advance_days': settingBookingAdvanceDaysSchema,
  'booking.cancellation_policy': settingBookingCancellationPolicySchema,
  'social.windows': settingSocialWindowsSchema,
  'membership.reminder_days': settingMembershipReminderDaysSchema,
  'crm.stages': settingCrmStagesSchema,
  'inventory.default_low_stock': settingInventoryDefaultLowStockSchema,
  'bar.table_occupied_minutes': settingBarTableOccupiedMinutesSchema,
});
export type SettingsMap = z.infer<typeof settingsMapSchema>;

export const settingEntrySchema = z.object({
  key: z.string(),
  value: z.unknown(),
  description: z.string().nullable().optional(),
  updatedBy: uuidSchema.nullable().optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type SettingEntry = z.infer<typeof settingEntrySchema>;

// Section 7.1 Realtime SSE Topics and Payloads
export const topicBookingChangedPayloadSchema = z.object({
  courtId: uuidSchema,
  date: dateOnSchema,
});
export const topicOrderItemPayloadSchema = z.object({
  station: z.enum(['kitchen', 'bar']),
});
export const topicOrderStatusPayloadSchema = z.object({
  orderId: uuidSchema,
  status: z.string(),
});
export const topicStockLowPayloadSchema = z.object({
  variantId: uuidSchema,
  saleable: z.number().int(),
});
export const topicLeadCreatedPayloadSchema = z.object({
  leadId: uuidSchema,
});
export const topicDashboardTickPayloadSchema = z.object({});

export const sseTopicsSchema = z.enum([
  'booking.changed',
  'order.item',
  'order.status',
  'stock.low',
  'lead.created',
  'dashboard.tick',
]);
export type Topic = z.infer<typeof sseTopicsSchema>;

// Section 6 Interfaces (Dev A exports)
export interface Notifications {
  send(n: {
    to: { userId?: string; memberId?: string; leadId?: string };
    template: string;
    channel?: Channel[];
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface Events {
  publish(topic: Topic, payload: Record<string, unknown>): void;
}

export interface Audit {
  log(e: {
    actor: string;
    action: string;
    resource: string;
    recordId: string;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  }): Promise<void>;
}

export interface Settings {
  get<T>(key: string): Promise<T>;
}

// Endpoint Schemas (prefix /api)

// 1. GET /api/admin/roles
export const getRolesResponseSchema = z.array(roleWithPermissionsSchema);

// 2. PUT /api/admin/roles/:id/permissions
export const updateRolePermissionsParamsSchema = z.object({ id: uuidSchema });
export const updateRolePermissionsRequestSchema = z.object({
  permissionIds: z.array(uuidSchema),
});
export const updateRolePermissionsResponseSchema = roleWithPermissionsSchema;

// 3. GET /api/admin/users
export const getUsersQuerySchema = paginationQuerySchema.extend({
  roleId: uuidSchema.optional(),
  active: z.coerce.boolean().optional(),
});
export const getUsersResponseSchema = paginatedResponseSchema(userAdminSchema);

// 4. POST /api/admin/users
export const createUserRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  roleId: uuidSchema,
  memberId: uuidSchema.optional(),
  employeeId: uuidSchema.optional(),
});
export const createUserResponseSchema = userAdminSchema;

// 5. PATCH /api/admin/users/:id
export const updateUserParamsSchema = z.object({ id: uuidSchema });
export const updateUserRequestSchema = z.object({
  name: z.string().optional(),
  roleId: uuidSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});
export const updateUserResponseSchema = userAdminSchema;

// 6. GET /api/admin/settings/:key
export const getSettingParamsSchema = z.object({ key: z.string() });
export const getSettingResponseSchema = settingEntrySchema;

// 7. PUT /api/admin/settings/:key
export const updateSettingParamsSchema = z.object({ key: z.string() });
export const updateSettingRequestSchema = z.object({
  value: z.unknown(),
  description: z.string().optional(),
});
export const updateSettingResponseSchema = settingEntrySchema;

// 8. GET /api/admin/audit
export const getAuditLogQuerySchema = paginationQuerySchema.extend({
  resource: z.string().optional(),
  actor: z.string().optional(),
  from: dateOnSchema.optional(),
  to: dateOnSchema.optional(),
});
export const getAuditLogResponseSchema = paginatedResponseSchema(auditLogSchema);

// 9. GET /api/notifications
export const getNotificationsQuerySchema = paginationQuerySchema.extend({
  status: notificationStatusSchema.optional(),
});
export const getNotificationsResponseSchema = paginatedResponseSchema(notificationItemSchema);

// 10. POST /api/notifications/:id/read
export const markNotificationReadParamsSchema = z.object({ id: uuidSchema });
export const markNotificationReadResponseSchema = z.object({
  success: z.boolean(),
  notification: notificationItemSchema,
});
