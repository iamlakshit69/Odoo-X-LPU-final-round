// Owner: Dev B – Phase 1: Bar & Cafeteria POS Schema
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from 'drizzle-orm/pg-core';

// Menu Items Table (Section 5.6)
export const menuItems = pgTable('menu_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'food', 'drink'
  station: text('station').notNull(), // 'kitchen', 'bar'
  pricePaise: integer('price_paise').notNull(),
  taxCategory: text('tax_category').notNull().default('restaurant_5'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Bar Tables (Floor Plan)
export const barTables = pgTable('bar_tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  label: text('label').notNull(),
  seats: integer('seats').notNull().default(2),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Till Sessions Table
export const tillSessions = pgTable('till_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  openedBy: uuid('opened_by').notNull(),
  openedAt: timestamp('opened_at', { withTimezone: true }).defaultNow().notNull(),
  openingFloatPaise: integer('opening_float_paise').notNull().default(0),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  countedCashPaise: integer('counted_cash_paise'),
  expectedCashPaise: integer('expected_cash_paise'),
  variancePaise: integer('variance_paise'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tabs Table
export const tabs = pgTable('tabs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tableId: uuid('table_id').references(() => barTables.id),
  memberId: uuid('member_id'),
  guestLabel: text('guest_label'),
  status: text('status').notNull().default('open'), // 'open', 'settled', 'void'
  openedBy: uuid('opened_by').notNull(),
  tillSessionId: uuid('till_session_id').references(() => tillSessions.id),
  invoiceId: uuid('invoice_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tab Items Table
export const tabItems = pgTable('tab_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tabId: uuid('tab_id')
    .notNull()
    .references(() => tabs.id, { onDelete: 'cascade' }),
  menuItemId: uuid('menu_item_id')
    .notNull()
    .references(() => menuItems.id),
  qty: integer('qty').notNull().default(1),
  unitPricePaise: integer('unit_price_paise').notNull(),
  priceBreakdown: jsonb('price_breakdown'),
  status: text('status').notNull().default('pending'), // 'pending', 'preparing', 'ready', 'served', 'void'
  voidReason: text('void_reason'),
  addedBy: uuid('added_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tab Events Table (Append-only ledger: item added, status change, void, transfer, settle)
export const tabEvents = pgTable('tab_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tabId: uuid('tab_id')
    .notNull()
    .references(() => tabs.id, { onDelete: 'cascade' }),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  type: text('type').notNull(), // 'item_added', 'status_changed', 'void', 'transferred', 'merged', 'settled'
  payload: jsonb('payload'),
  byUserId: uuid('by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
