import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Roles (Section 5.1 & 8)
export const roles = pgTable('roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // owner, manager, front_desk, shop_clerk, bartender, kitchen, cashier, finance, hr, member
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Permissions
export const permissions = pgTable('permissions', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // 'booking:create', 'booking:read:own', etc.
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Role Permissions Join Table
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  })
);

// Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  roleId: uuid('role_id')
    .notNull()
    .references(() => roles.id),
  memberId: uuid('member_id'), // Linked to members.id when member
  employeeId: uuid('employee_id'), // Plain UUID until Dev B implements employees table
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Settings (Section 5.1 & 5.9)
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Audit Log - Ledger (Section 4 Rule 2 & 5.1)
export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  actorUserId: uuid('actor_user_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  recordId: text('record_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  meta: jsonb('meta'),
  requestId: text('request_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Notifications - Ledger with read_at (Section 5.1 & 7.1)
export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id'),
  memberId: uuid('member_id'),
  leadId: uuid('lead_id'),
  channel: text('channel').notNull(), // 'inapp','email','sms','whatsapp'
  template: text('template').notNull(),
  payload: jsonb('payload'),
  status: text('status').default('queued').notNull(), // 'queued','sent','read','failed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
});
