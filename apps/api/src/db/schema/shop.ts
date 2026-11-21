// Owner: Dev B – Phase 1: Shop & Inventory Schema
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Products Table (Section 5.5)
export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'racket', 'ball', 'shoe', 'accessory', 'apparel'
  description: text('description'),
  imageUrl: text('image_url'),
  basePricePaise: integer('base_price_paise').notNull(),
  taxCategory: text('tax_category').notNull().default('sports_goods_12'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Product Variants Table
export const productVariants = pgTable('product_variants', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku').notNull().unique(),
  optionLabel: text('option_label').notNull(), // e.g. 'UK 9 / White'
  pricePaise: integer('price_paise'), // null => inherits basePricePaise from product
  lowStockThreshold: integer('low_stock_threshold').notNull().default(3),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Stock Movements Table (Append-only ledger)
export const stockMovements = pgTable('stock_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => productVariants.id, { onDelete: 'cascade' }),
  delta: integer('delta').notNull(), // positive for stock in, negative for stock out
  reason: text('reason').notNull(), // 'purchase', 'sale', 'return', 'adjustment', 'reservation_release'
  refType: text('ref_type'),
  refId: text('ref_id'),
  note: text('note'),
  byUserId: uuid('by_user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Stock Levels Table (Derived table maintained by triggers on movements and reservations)
export const stockLevels = pgTable(
  'stock_levels',
  {
    variantId: uuid('variant_id')
      .primaryKey()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    onHand: integer('on_hand').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
  },
  (table) => ({
    checkOnHand: check('check_on_hand_non_negative', sql`${table.onHand} >= 0`),
    checkReserved: check('check_reserved_non_negative', sql`${table.reserved} >= 0`),
  })
);

// Stock Reservations Table (For online orders awaiting payment)
export const stockReservations = pgTable('stock_reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => productVariants.id, { onDelete: 'cascade' }),
  qty: integer('qty').notNull(),
  orderId: uuid('order_id').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('active'), // 'active', 'released', 'converted'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Orders Table
export const orders = pgTable('orders', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id'),
  guestName: text('guest_name'),
  guestPhone: text('guest_phone'),
  channel: text('channel').notNull().default('counter'), // 'counter', 'online'
  status: text('status').notNull().default('placed'), // 'placed', 'ready', 'out_for_delivery', 'collected', 'delivered', 'cancelled'
  fulfilment: text('fulfilment').notNull().default('counter'), // 'counter', 'pickup', 'delivery'
  deliveryAddress: text('delivery_address'),
  invoiceId: uuid('invoice_id'),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Order Items Table
export const orderItems = pgTable('order_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id')
    .notNull()
    .references(() => productVariants.id),
  qty: integer('qty').notNull(),
  unitPricePaise: integer('unit_price_paise').notNull(),
  priceBreakdown: jsonb('price_breakdown'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
