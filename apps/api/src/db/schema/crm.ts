import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';

// Leads (Section 5.8)
export const leads = pgTable('leads', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  source: text('source').notNull(), // 'web_form','trial_booking','walk_in','phone','referral'
  interest: text('interest'),
  stage: text('stage').default('new').notNull(), // 'new','contacted','quotation_sent','follow_up','converted','lost'
  assignedTo: uuid('assigned_to'),
  lostReason: text('lost_reason'),
  convertedMemberId: uuid('converted_member_id'),
  trialBookingId: uuid('trial_booking_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Lead Activities - Ledger (Section 5.8)
export const leadActivities = pgTable('lead_activities', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'note','call','message','stage_change','quote','task_done'
  body: text('body').notNull(),
  byUserId: uuid('by_user_id'),
  at: timestamp('at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Lead Tasks
export const leadTasks = pgTable('lead_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueOn: date('due_on').notNull(),
  doneAt: timestamp('done_at', { withTimezone: true }),
  assignedTo: uuid('assigned_to'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Quotes
export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadId: uuid('lead_id')
    .notNull()
    .references(() => leads.id, { onDelete: 'cascade' }),
  number: text('number').notNull().unique(), // 'QTE-2026-00001'
  status: text('status').default('draft').notNull(), // 'draft','sent','accepted','rejected'
  validUntil: date('valid_until'),
  totalPaise: integer('total_paise').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Quote Lines
export const quoteLines = pgTable('quote_lines', {
  id: uuid('id').defaultRandom().primaryKey(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  description: text('description').notNull(),
  qty: integer('qty').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
