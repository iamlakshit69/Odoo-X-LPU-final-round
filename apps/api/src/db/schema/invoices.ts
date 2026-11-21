// Owner: Dev B – Phase 1: Invoices, Payments, Tax, Finance & Expenses Schema
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
} from 'drizzle-orm/pg-core';

// Business Clients Table (Section 5.7)
export const businessClients = pgTable('business_clients', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  gstin: text('gstin'),
  contactName: text('contact_name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  creditDays: integer('credit_days').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Invoices Table
export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  number: text('number').notNull().unique(), // e.g. 'INV-2026-000123'
  memberId: uuid('member_id'),
  businessClientId: uuid('business_client_id').references(() => businessClients.id),
  guestName: text('guest_name'),
  status: text('status').notNull().default('issued'), // 'draft', 'issued', 'void'
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow().notNull(),
  dueOn: date('due_on'),
  subtotalPaise: integer('subtotal_paise').notNull().default(0),
  cgstPaise: integer('cgst_paise').notNull().default(0),
  sgstPaise: integer('sgst_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Invoice Lines Table
export const invoiceLines = pgTable('invoice_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  source: text('source').notNull(), // 'membership', 'court', 'shop', 'bar', 'corporate', 'social'
  description: text('description').notNull(),
  qty: integer('qty').notNull().default(1),
  unitPricePaise: integer('unit_price_paise').notNull(),
  discountPaise: integer('discount_paise').notNull().default(0),
  taxablePaise: integer('taxable_paise').notNull(),
  taxRateBps: integer('tax_rate_bps').notNull().default(0), // 1800 = 18.00%
  cgstPaise: integer('cgst_paise').notNull().default(0),
  sgstPaise: integer('sgst_paise').notNull().default(0),
  totalPaise: integer('total_paise').notNull(),
  refType: text('ref_type'), // 'booking', 'order', 'tab', 'membership', 'social_signup', 'manual'
  refId: text('ref_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payments Table (Append-only ledger; refund rows have negative amount_paise)
export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id),
  method: text('method').notNull(), // 'cash', 'card', 'upi', 'online', 'comp', 'refund'
  amountPaise: integer('amount_paise').notNull(), // negative for refund
  receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  receivedBy: uuid('received_by'),
  tillSessionId: uuid('till_session_id'),
  reference: text('reference'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Expenses Table
export const expenses = pgTable('expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  amountPaise: integer('amount_paise').notNull(),
  incurredOn: date('incurred_on').notNull(),
  paid: boolean('paid').notNull().default(false),
  receiptUrl: text('receipt_url'),
  status: text('status').notNull().default('submitted'), // 'submitted', 'approved', 'rejected'
  submittedBy: uuid('submitted_by'),
  approvedBy: uuid('approved_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tax Rates Table (Section 5.4)
export const taxRates = pgTable('tax_rates', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: text('category').notNull().unique(), // e.g. 'court_hire_18', 'sports_goods_12', 'restaurant_5'
  rateBps: integer('rate_bps').notNull(), // 1800 => 18%
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
