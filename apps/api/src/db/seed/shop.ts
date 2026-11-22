// Owner: Dev B – Shop & Products Seed (Section 14.2)
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  products,
  productVariants,
  stockLevels,
  orders,
  orderItems,
  stockMovements,
} from '../schema/shop.js';
import { members } from '../schema/members.js';

export async function seed() {
  const existing = await db.select({ id: products.id }).from(products).limit(1);
  if (existing.length > 0) {
    console.log('[Seed:shop] Products already seeded, skipping.');
    return;
  }

  console.log('[Seed:shop] Seeding 25 products with variants, stock levels, and demo orders...');

  // 1. 25 Products Data
  const productData = [
    // Rackets (Tennis, Badminton, Padel, Squash)
    { name: 'Wilson Pro Staff 97 v14', category: 'racket', basePricePaise: 2499900, taxCategory: 'sports_goods_12', options: ['Grip 2 (4 1/4)', 'Grip 3 (4 3/8)', 'Grip 4 (4 1/2)'] },
    { name: 'Babolat Pure Drive 2024', category: 'racket', basePricePaise: 2199900, taxCategory: 'sports_goods_12', options: ['Grip 2 (4 1/4)', 'Grip 3 (4 3/8)'] },
    { name: 'Head Speed MP Legend 2024', category: 'racket', basePricePaise: 2299900, taxCategory: 'sports_goods_12', options: ['Grip 2 (4 1/4)', 'Grip 3 (4 3/8)'] },
    { name: 'Yonex Ezone 98 Deep Blue', category: 'racket', basePricePaise: 2349900, taxCategory: 'sports_goods_12', options: ['Grip 3 (4 3/8)'] },
    { name: 'Yonex Astrox 88D Pro', category: 'racket', basePricePaise: 1699900, taxCategory: 'sports_goods_12', options: ['4U / G5', '3U / G4'] },
    { name: 'Li-Ning Aeronaut 9000C', category: 'racket', basePricePaise: 1549900, taxCategory: 'sports_goods_12', options: ['3U / G5'] },
    { name: 'Victor Thruster K Falcon', category: 'racket', basePricePaise: 1499900, taxCategory: 'sports_goods_12', options: ['4U / G5'] },
    { name: 'Bullpadel Hack 03 Pro Padel', category: 'racket', basePricePaise: 2899900, taxCategory: 'sports_goods_12', options: ['Standard Weight'] },
    { name: 'Nox AT10 Luxury Genius 18K', category: 'racket', basePricePaise: 2799900, taxCategory: 'sports_goods_12', options: ['Standard Weight'] },
    { name: 'Head Delta Pro Padel', category: 'racket', basePricePaise: 2449900, taxCategory: 'sports_goods_12', options: ['Standard Weight'] },

    // Balls & Shuttles
    { name: 'Wilson US Open Extra Duty (4-Ball Can)', category: 'ball', basePricePaise: 75000, taxCategory: 'sports_goods_12', options: ['4-Ball Can', 'Case of 18 Cans'] },
    { name: 'Head Tour XT Tennis Balls (3-Ball Can)', category: 'ball', basePricePaise: 65000, taxCategory: 'sports_goods_12', options: ['3-Ball Can'] },
    { name: 'Babolat Team All Court (4-Ball Can)', category: 'ball', basePricePaise: 69900, taxCategory: 'sports_goods_12', options: ['4-Ball Can'] },
    { name: 'Yonex Mavis 350 Nylon Shuttlecock', category: 'ball', basePricePaise: 95000, taxCategory: 'sports_goods_12', options: ['Slow (Green)', 'Medium (Blue)'] },
    { name: 'Yonex Aerosensa 30 Feather Shuttlecock', category: 'ball', basePricePaise: 249900, taxCategory: 'sports_goods_12', options: ['Speed 77', 'Speed 78'] },
    { name: 'Bullpadel Premium Pro Padel Balls', category: 'ball', basePricePaise: 59900, taxCategory: 'sports_goods_12', options: ['3-Ball Can'] },

    // Footwear
    { name: 'Nike Court Air Zoom Vapor Pro 2', category: 'shoe', basePricePaise: 1099500, taxCategory: 'sports_goods_12', options: ['UK 8', 'UK 9', 'UK 10'] },
    { name: 'Asics Gel Resolution 9 Clay/All Court', category: 'shoe', basePricePaise: 1299900, taxCategory: 'sports_goods_12', options: ['UK 8.5', 'UK 9.5', 'UK 10.5'] },
    { name: 'Yonex Power Cushion 65Z3 Indoor Court', category: 'shoe', basePricePaise: 1149000, taxCategory: 'sports_goods_12', options: ['UK 8', 'UK 9', 'UK 10'] },

    // Apparel & Bags
    { name: 'Champions Club Performance Dry-Fit Tee', category: 'apparel', basePricePaise: 199900, taxCategory: 'sports_goods_12', options: ['Size M / Navy', 'Size L / Navy', 'Size XL / White'] },
    { name: 'Champions Club Court Shorts', category: 'apparel', basePricePaise: 159900, taxCategory: 'sports_goods_12', options: ['Size M / Black', 'Size L / Black'] },
    { name: 'Wilson Super Tour 9-Pack Racket Bag', category: 'accessory', basePricePaise: 899900, taxCategory: 'sports_goods_12', options: ['Red / Black'] },

    // Strings & Grips
    { name: 'Yonex Super Grap Overgrip (3-Pack)', category: 'accessory', basePricePaise: 39900, taxCategory: 'sports_goods_12', options: ['White', 'Black', 'Neon Yellow'] },
    { name: 'Tourna Grip Original Dry Feel (10-Pack)', category: 'accessory', basePricePaise: 149900, taxCategory: 'sports_goods_12', options: ['XL Blue'] },
    { name: 'Luxilon ALU Power 125 String Set', category: 'accessory', basePricePaise: 189900, taxCategory: 'sports_goods_12', options: ['Silver 12m'] },
  ];

  const seededVariantIds: string[] = [];

  for (let i = 0; i < productData.length; i++) {
    const p = productData[i];
    const [insertedProduct] = await db
      .insert(products)
      .values({
        name: p.name,
        category: p.category,
        description: `Premium ${p.name} for club players and tournament training.`,
        basePricePaise: p.basePricePaise,
        taxCategory: p.taxCategory,
        active: true,
      })
      .returning();

    for (let j = 0; j < p.options.length; j++) {
      const opt = p.options[j];
      const sku = `SKU-${p.category.toUpperCase().slice(0, 3)}-${String(i + 1).padStart(3, '0')}-${j + 1}`;

      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: insertedProduct.id,
          sku,
          optionLabel: opt,
          pricePaise: p.basePricePaise,
          lowStockThreshold: 3,
          active: true,
        })
        .returning();

      seededVariantIds.push(variant.id);
    }
  }

  // 2. Set Stock Levels: exactly 3 variants at or below low stock threshold (<= 3)
  for (let idx = 0; idx < seededVariantIds.length; idx++) {
    const varId = seededVariantIds[idx];
    let qty = 25;

    if (idx === 0) qty = 1; // At or below threshold (threshold = 3)
    else if (idx === 1) qty = 2; // At or below threshold
    else if (idx === 2) qty = 0; // At or below threshold (out of stock)
    else if (idx % 3 === 0) qty = 12;
    else if (idx % 2 === 0) qty = 35;

    await db
      .insert(stockLevels)
      .values({
        variantId: varId,
        onHand: qty,
        reserved: 0,
      })
      .onConflictDoUpdate({
        target: stockLevels.variantId,
        set: { onHand: qty, reserved: 0 },
      });

    // Record initial receipt movement
    if (qty > 0) {
      await db.insert(stockMovements).values({
        variantId: varId,
        delta: qty,
        reason: 'purchase',
        note: 'Initial inventory intake',
      });
    }
  }

  // 3. Demo Orders (Pickup and Delivery in different states)
  const existingMembers = await db.select().from(members).limit(5);
  const m1 = existingMembers[0]?.id;
  const m2 = existingMembers[1]?.id;

  const demoOrdersData = [
    // Pickup orders
    {
      channel: 'online',
      fulfilment: 'pickup',
      status: 'placed',
      memberId: m1,
      variantId: seededVariantIds[3],
      qty: 1,
    },
    {
      channel: 'online',
      fulfilment: 'pickup',
      status: 'ready',
      memberId: m2,
      variantId: seededVariantIds[4],
      qty: 2,
    },
    {
      channel: 'counter',
      fulfilment: 'pickup',
      status: 'collected',
      guestName: 'Kunal Kapoor',
      guestPhone: '+919811002233',
      variantId: seededVariantIds[5],
      qty: 1,
    },
    // Delivery orders
    {
      channel: 'online',
      fulfilment: 'delivery',
      status: 'placed',
      deliveryAddress: 'Apartment 402, Palm Greens, New Delhi',
      memberId: m1,
      variantId: seededVariantIds[6],
      qty: 1,
    },
    {
      channel: 'online',
      fulfilment: 'delivery',
      status: 'out_for_delivery',
      deliveryAddress: 'Villa 14, Golf Links, New Delhi',
      guestName: 'Rohit Nambiar',
      guestPhone: '+919822334455',
      variantId: seededVariantIds[7],
      qty: 1,
    },
    {
      channel: 'online',
      fulfilment: 'delivery',
      status: 'delivered',
      deliveryAddress: 'House 88, Vasant Vihar, New Delhi',
      memberId: m2,
      variantId: seededVariantIds[8],
      qty: 2,
    },
  ];

  for (const o of demoOrdersData) {
    const [ord] = await db
      .insert(orders)
      .values({
        memberId: o.memberId ?? null,
        guestName: o.guestName ?? null,
        guestPhone: o.guestPhone ?? null,
        channel: o.channel,
        status: o.status,
        fulfilment: o.fulfilment,
        deliveryAddress: o.deliveryAddress ?? null,
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: ord.id,
      variantId: o.variantId,
      qty: o.qty,
      unitPricePaise: 150000,
    });
  }

  console.log('[Seed:shop] Shop products, variants, stock, and orders seeded successfully.');
}
