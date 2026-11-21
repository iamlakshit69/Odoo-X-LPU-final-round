import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';
import { members } from './members.js';

// Court Types (Section 5.3)
export const courtTypes = pgTable('court_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // 'tennis', 'padel', 'badminton', 'cricket'
  name: text('name').notNull(),
  basePricePerHourPaise: integer('base_price_per_hour_paise').notNull(),
  taxCategory: text('tax_category').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Courts
export const courts = pgTable('courts', {
  id: uuid('id').defaultRandom().primaryKey(),
  courtTypeId: uuid('court_type_id')
    .notNull()
    .references(() => courtTypes.id),
  name: text('name').notNull(),
  active: boolean('active').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Bookings (Section 5.3)
// Note: `during` tstzrange generated column and exclusion constraint are added in 10_constraints.sql
export const bookings = pgTable('bookings', {
  id: uuid('id').defaultRandom().primaryKey(),
  courtId: uuid('court_id')
    .notNull()
    .references(() => courts.id),
  kind: text('kind').default('regular').notNull(), // 'regular','social','block'
  status: text('status').default('confirmed').notNull(), // 'held','confirmed','completed','cancelled','expired','no_show'
  memberId: uuid('member_id').references(() => members.id),
  guestName: text('guest_name'),
  guestPhone: text('guest_phone'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // For 'held'
  channel: text('channel').default('counter').notNull(), // 'counter','phone','online','public'
  pricePaise: integer('price_paise').notNull(),
  priceBreakdown: jsonb('price_breakdown'),
  invoiceId: uuid('invoice_id'), // Plain UUID until Dev B implements invoices
  createdBy: uuid('created_by'),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  refundPaise: integer('refund_paise'),
  socialSessionId: uuid('social_session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Social Sessions
export const socialSessions = pgTable('social_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  courtId: uuid('court_id')
    .notNull()
    .references(() => courts.id),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  capacity: integer('capacity').notNull(),
  pricePerHeadPaise: integer('price_per_head_paise').notNull(),
  title: text('title').notNull(),
  status: text('status').default('open').notNull(), // 'open','closed','cancelled'
  bookingId: uuid('booking_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Social Signups
export const socialSignups = pgTable('social_signups', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => socialSessions.id, { onDelete: 'cascade' }),
  memberId: uuid('member_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  status: text('status').default('confirmed').notNull(), // 'confirmed','waitlisted','cancelled'
  position: integer('position').notNull(),
  invoiceId: uuid('invoice_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
