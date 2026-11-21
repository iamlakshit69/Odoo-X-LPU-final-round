import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  date,
  timestamp,
} from 'drizzle-orm/pg-core';

// Price Rules (Section 5.4)
export const priceRules = pgTable('price_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  appliesTo: text('applies_to').notNull(), // 'court','shop','bar','membership','social'
  scopeRef: text('scope_ref'), // court_type code, product category, menu category, plan code
  tier: text('tier'), // 'gold','silver','junior','walkin'
  channel: text('channel'), // 'counter','phone','online','public'
  dayMask: integer('day_mask'), // bit per weekday (0=Sun .. 6=Sat)
  timeFrom: text('time_from'), // 'HH:mm'
  timeTo: text('time_to'), // 'HH:mm'
  effect: text('effect').notNull(), // 'fixed_price','percent_off','amount_off'
  value: integer('value').notNull(), // paise or basis points
  priority: integer('priority').default(0).notNull(),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
