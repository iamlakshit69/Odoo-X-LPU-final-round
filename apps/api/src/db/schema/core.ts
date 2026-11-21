import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

// Core settings table (per section 5.1 & 5.9)
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
