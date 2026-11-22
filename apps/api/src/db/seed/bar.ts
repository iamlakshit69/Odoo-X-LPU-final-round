// Owner: Dev B – Bar & Cafeteria POS Seed (Section 14.2)
import { randomUUID } from 'node:crypto';
import { db } from '../../core/db/index.js';
import {
  menuItems,
  barTables,
  tillSessions,
  tabs,
  tabItems,
  tabEvents,
} from '../schema/bar.js';
import { invoices, invoiceLines, payments } from '../schema/invoices.js';
import { users } from '../schema/core.js';
import { members } from '../schema/members.js';

export async function seed() {
  const existing = await db.select({ id: menuItems.id }).from(menuItems).limit(1);
  if (existing.length > 0) {
    console.log('[Seed:bar] Bar menu and tables already seeded, skipping.');
    return;
  }

  console.log('[Seed:bar] Seeding 20 menu items, 6 tables, till sessions, open tabs, and settled tab...');

  // 1. 20 Menu Items (Food and Drink)
  const menuData = [
    // Food (Station: kitchen)
    { name: 'Classic Club Sandwich', category: 'food', station: 'kitchen', pricePaise: 25000 },
    { name: 'Chicken Tikka Wrap', category: 'food', station: 'kitchen', pricePaise: 28000 },
    { name: 'Paneer Kathi Roll', category: 'food', station: 'kitchen', pricePaise: 22000 },
    { name: 'Caesar Salad with Grilled Chicken', category: 'food', station: 'kitchen', pricePaise: 32000 },
    { name: 'Mediterranean Hummus & Pita', category: 'food', station: 'kitchen', pricePaise: 26000 },
    { name: 'Truffle Parmesan Fries', category: 'food', station: 'kitchen', pricePaise: 19000 },
    { name: 'Margherita Sourdough Pizza', category: 'food', station: 'kitchen', pricePaise: 38000 },
    { name: 'Protein Scramble & Sourdough Toast', category: 'food', station: 'kitchen', pricePaise: 24000 },
    { name: 'Grilled Chicken Brown Rice Bowl', category: 'food', station: 'kitchen', pricePaise: 35000 },
    { name: 'Energy Nut & Berry Granola Bowl', category: 'food', station: 'kitchen', pricePaise: 21000 },

    // Drink (Station: bar)
    { name: 'Double Espresso', category: 'drink', station: 'bar', pricePaise: 14000 },
    { name: 'Flat White Coffee', category: 'drink', station: 'bar', pricePaise: 18000 },
    { name: 'Iced Americano', category: 'drink', station: 'bar', pricePaise: 16000 },
    { name: 'Fresh Orange & Carrot Juice', category: 'drink', station: 'bar', pricePaise: 20000 },
    { name: 'Electrolyte Hydration Punch', category: 'drink', station: 'bar', pricePaise: 15000 },
    { name: 'Whey Protein Shake (Chocolate)', category: 'drink', station: 'bar', pricePaise: 25000 },
    { name: 'Tender Fresh Coconut Water', category: 'drink', station: 'bar', pricePaise: 12000 },
    { name: 'Matcha Green Tea Latte', category: 'drink', station: 'bar', pricePaise: 22000 },
    { name: 'Lemon Mint Sparkler', category: 'drink', station: 'bar', pricePaise: 16000 },
    { name: 'Kombucha Hibiscus Ginger', category: 'drink', station: 'bar', pricePaise: 22000 },
    // Additional Gourmet Meals & Drinks
    { name: 'Artisanal Truffle Mushroom Pizza', category: 'food', station: 'kitchen', pricePaise: 42000 },
    { name: 'BBQ Pulled Chicken Sliders', category: 'food', station: 'kitchen', pricePaise: 34000 },
    { name: 'Smashed Avocado & Feta Toast', category: 'food', station: 'kitchen', pricePaise: 29000 },
    { name: 'Grilled Atlantic Salmon Quinoa Bowl', category: 'food', station: 'kitchen', pricePaise: 45000 },
    { name: 'Crispy Peri-Peri Chicken Tacos', category: 'food', station: 'kitchen', pricePaise: 31000 },
    { name: 'Acai Antioxidant Superbowl', category: 'food', station: 'kitchen', pricePaise: 27000 },
    { name: 'Warm Belgian Chocolate Brownie', category: 'food', station: 'kitchen', pricePaise: 23000 },
    { name: 'Cold Brew Nitro Coffee', category: 'drink', station: 'bar', pricePaise: 21000 },
    { name: 'Corona Extra with Fresh Lime', category: 'drink', station: 'bar', pricePaise: 35000 },
    { name: 'Bira 91 White Craft Beer', category: 'drink', station: 'bar', pricePaise: 32000 },
    { name: 'Handcrafted Gin & Basil Smash', category: 'drink', station: 'bar', pricePaise: 44000 },
    { name: 'Classic Tropical Mango Mojito', category: 'drink', station: 'bar', pricePaise: 26000 },
  ];

  const seededMenuItems = await db.insert(menuItems).values(menuData).returning();

  // 2. 6 Tables (Floor Plan)
  const tablesData = [
    { label: 'Table 1', seats: 2, x: 50, y: 50 },
    { label: 'Table 2', seats: 4, x: 150, y: 50 },
    { label: 'Table 3', seats: 4, x: 250, y: 50 },
    { label: 'Table 4', seats: 6, x: 50, y: 150 },
    { label: 'Table 5', seats: 2, x: 150, y: 150 },
    { label: 'Table 6', seats: 6, x: 250, y: 150 },
  ];
  const seededTables = await db.insert(barTables).values(tablesData).returning();

  // Find a staff user for till and tab openings
  const staffUsers = await db.select().from(users).limit(5);
  const staffId = staffUsers[0]?.id || randomUUID();

  // Find demo members
  const demoMembers = await db.select().from(members).limit(5);

  // 3. One Closed Till Session with a small variance (-₹50 / -5000 paise)
  const closedSessionId = randomUUID();
  const openedYesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const closedYesterday = new Date(Date.now() - 16 * 60 * 60 * 1000);

  await db.insert(tillSessions).values({
    id: closedSessionId,
    openedBy: staffId,
    openedAt: openedYesterday,
    openingFloatPaise: 200000, // ₹2000.00
    closedAt: closedYesterday,
    expectedCashPaise: 350000, // ₹3500.00
    countedCashPaise: 345000,  // ₹3450.00
    variancePaise: -5000,      // -₹50.00 shortage
  });

  // 4. One Open Till Session
  const openSessionId = randomUUID();
  await db.insert(tillSessions).values({
    id: openSessionId,
    openedBy: staffId,
    openedAt: new Date(),
    openingFloatPaise: 250000, // ₹2500.00
  });

  // 5. 4 Open Tabs with items in mixed statuses
  // Tab 1: Table 1 (Items: pending, preparing, ready)
  const [tab1] = await db
    .insert(tabs)
    .values({
      tableId: seededTables[0].id,
      memberId: demoMembers[0]?.id,
      guestLabel: 'Aarav Sharma',
      status: 'open',
      openedBy: staffId,
      tillSessionId: openSessionId,
    })
    .returning();

  await db.insert(tabItems).values([
    { tabId: tab1.id, menuItemId: seededMenuItems[0].id, qty: 1, unitPricePaise: 25000, status: 'pending' },
    { tabId: tab1.id, menuItemId: seededMenuItems[10].id, qty: 1, unitPricePaise: 14000, status: 'preparing' },
    { tabId: tab1.id, menuItemId: seededMenuItems[5].id, qty: 1, unitPricePaise: 19000, status: 'ready' },
  ]);

  // Tab 2: Table 2 (Items: preparing, served)
  const [tab2] = await db
    .insert(tabs)
    .values({
      tableId: seededTables[1].id,
      memberId: demoMembers[1]?.id,
      guestLabel: 'Pooja Verma',
      status: 'open',
      openedBy: staffId,
      tillSessionId: openSessionId,
    })
    .returning();

  await db.insert(tabItems).values([
    { tabId: tab2.id, menuItemId: seededMenuItems[1].id, qty: 2, unitPricePaise: 28000, status: 'preparing' },
    { tabId: tab2.id, menuItemId: seededMenuItems[15].id, qty: 2, unitPricePaise: 25000, status: 'served' },
  ]);

  // Tab 3: Table 3 (Items: ready, served)
  const [tab3] = await db
    .insert(tabs)
    .values({
      tableId: seededTables[2].id,
      guestLabel: 'Guest Walk-in A',
      status: 'open',
      openedBy: staffId,
      tillSessionId: openSessionId,
    })
    .returning();

  await db.insert(tabItems).values([
    { tabId: tab3.id, menuItemId: seededMenuItems[6].id, qty: 1, unitPricePaise: 38000, status: 'ready' },
    { tabId: tab3.id, menuItemId: seededMenuItems[13].id, qty: 2, unitPricePaise: 20000, status: 'served' },
  ]);

  // Tab 4: Table 4 (Items: pending, served)
  const [tab4] = await db
    .insert(tabs)
    .values({
      tableId: seededTables[3].id,
      guestLabel: 'Guest Walk-in B',
      status: 'open',
      openedBy: staffId,
      tillSessionId: openSessionId,
    })
    .returning();

  await db.insert(tabItems).values([
    { tabId: tab4.id, menuItemId: seededMenuItems[8].id, qty: 1, unitPricePaise: 35000, status: 'pending' },
    { tabId: tab4.id, menuItemId: seededMenuItems[18].id, qty: 2, unitPricePaise: 16000, status: 'served' },
  ]);

  // 6. One Settled Tab with Split Payment (Cash + UPI)
  const tab5InvoiceId = randomUUID();
  const [tab5] = await db
    .insert(tabs)
    .values({
      tableId: seededTables[4].id,
      memberId: demoMembers[2]?.id,
      guestLabel: 'Vikram Mehta',
      status: 'settled',
      openedBy: staffId,
      tillSessionId: openSessionId,
      invoiceId: tab5InvoiceId,
    })
    .returning();

  await db.insert(tabItems).values([
    { tabId: tab5.id, menuItemId: seededMenuItems[2].id, qty: 1, unitPricePaise: 22000, status: 'served' },
    { tabId: tab5.id, menuItemId: seededMenuItems[11].id, qty: 1, unitPricePaise: 18000, status: 'served' },
  ]);

  // Invoice for Tab 5: subtotal ₹400.00 (40,000 paise), 5% GST = ₹20.00 (2,000 paise), total ₹420.00 (42,000 paise)
  await db.insert(invoices).values({
    id: tab5InvoiceId,
    number: `INV-${new Date().getFullYear()}-000888`,
    memberId: demoMembers[2]?.id ?? null,
    guestName: 'Vikram Mehta',
    status: 'issued',
    subtotalPaise: 40000,
    cgstPaise: 1000,
    sgstPaise: 1000,
    totalPaise: 42000,
  });

  await db.insert(invoiceLines).values([
    {
      invoiceId: tab5InvoiceId,
      source: 'bar',
      description: 'Paneer Kathi Roll',
      qty: 1,
      unitPricePaise: 22000,
      taxablePaise: 22000,
      taxRateBps: 500,
      cgstPaise: 550,
      sgstPaise: 550,
      totalPaise: 23100,
      refType: 'tab',
      refId: tab5.id,
    },
    {
      invoiceId: tab5InvoiceId,
      source: 'bar',
      description: 'Flat White Coffee',
      qty: 1,
      unitPricePaise: 18000,
      taxablePaise: 18000,
      taxRateBps: 500,
      cgstPaise: 450,
      sgstPaise: 450,
      totalPaise: 18900,
      refType: 'tab',
      refId: tab5.id,
    },
  ]);

  // Split payments: ₹200 Cash + ₹220 UPI = ₹420 total
  await db.insert(payments).values([
    {
      invoiceId: tab5InvoiceId,
      method: 'cash',
      amountPaise: 20000,
      tillSessionId: openSessionId,
      receivedBy: staffId,
    },
    {
      invoiceId: tab5InvoiceId,
      method: 'upi',
      amountPaise: 22000,
      reference: 'UPI/BAR/SPLIT-001',
      receivedBy: staffId,
    },
  ]);

  console.log('[Seed:bar] Bar menu items, tables, till sessions, and demo tabs seeded successfully.');
}
