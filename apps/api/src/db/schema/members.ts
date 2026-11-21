import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Plans (Section 5.2)
export const plans = pgTable('plans', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // 'gold', 'silver', 'junior'
  name: text('name').notNull(),
  pricePaise: integer('price_paise').notNull(),
  durationDays: integer('duration_days').notNull(),
  dailyBookingLimit: integer('daily_booking_limit').default(2).notNull(),
  advanceBookingDays: integer('advance_booking_days').notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Members
export const members = pgTable('members', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberCode: text('member_code').notNull().unique(), // 'CC-000101'
  fullName: text('full_name').notNull(),
  phone: text('phone').notNull().unique(),
  email: text('email'),
  dob: date('dob'),
  photoUrl: text('photo_url'),
  qrToken: text('qr_token').notNull().unique(),
  notes: text('notes'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Memberships (Dated rows per Section 5.2)
export const memberships = pgTable('memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id')
    .notNull()
    .references(() => plans.id),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  status: text('status').default('active').notNull(), // 'active','expired','suspended','cancelled'
  invoiceId: uuid('invoice_id'), // Plain UUID until Dev B implements invoices
  replacedBy: uuid('replaced_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Member Guardians (Junior to guardian link)
export const memberGuardians = pgTable(
  'member_guardians',
  {
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    guardianMemberId: uuid('guardian_member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    relationship: text('relationship').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.memberId, table.guardianMemberId] }),
  })
);

// Checkins - Ledger (Section 5.2)
export const checkins = pgTable('checkins', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  method: text('method').default('qr').notNull(), // 'qr','manual'
  staffUserId: uuid('staff_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
