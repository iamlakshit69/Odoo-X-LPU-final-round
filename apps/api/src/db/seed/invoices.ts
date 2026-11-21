// Owner: Dev B – Invoices, Payments, Tax, Finance & Expenses Seed (Section 14.2)
import { randomUUID } from 'node:crypto';
import { db } from '../../core/db/index.js';
import {
  taxRates,
  businessClients,
  invoices,
  invoiceLines,
  payments,
  expenses,
} from '../schema/invoices.js';
import { members } from '../schema/members.js';
import { users } from '../schema/core.js';

export async function seed() {
  console.log('[Seed:invoices] Seeding tax rates, business clients, invoices, payments, and expenses...');

  // 1. Tax Rates (Section 5.4)
  const defaultRates = [
    { category: 'court_hire_18', rateBps: 1800, description: '18% GST on Court Hires' },
    { category: 'sports_goods_12', rateBps: 1200, description: '12% GST on Sporting Goods & Apparel' },
    { category: 'restaurant_5', rateBps: 500, description: '5% GST on Food & Beverages' },
    { category: 'membership_18', rateBps: 1800, description: '18% GST on Club Memberships' },
    { category: 'standard', rateBps: 1800, description: '18% Standard GST Rate' },
  ];

  for (const r of defaultRates) {
    await db
      .insert(taxRates)
      .values(r)
      .onConflictDoUpdate({
        target: taxRates.category,
        set: { rateBps: r.rateBps, description: r.description },
      });
  }

  // 2. 3 Business Clients (Section 14.2)
  const clientsData = [
    {
      name: 'Apex Sports Academy',
      gstin: '07AAAAA0000A1Z5',
      contactName: 'Rohit Verma',
      phone: '+919811122233',
      email: 'finance@apexsports.in',
      creditDays: 30,
    },
    {
      name: 'Zenith Tech Solutions',
      gstin: '07BBBBB1111B1Z6',
      contactName: 'Priya Sundaram',
      phone: '+919822233344',
      email: 'admin@zenithtech.com',
      creditDays: 45,
    },
    {
      name: 'Metro Tennis League',
      gstin: '07CCCCC2222C1Z7',
      contactName: 'Kunal Malhotra',
      phone: '+919833344455',
      email: 'billing@metrotennis.org',
      creditDays: 15,
    },
  ];

  const seededClients = await db.insert(businessClients).values(clientsData).returning();

  // Find members and staff for foreign keys
  const existingMembers = await db.select().from(members).limit(10);
  const staffUsers = await db.select().from(users).limit(5);
  const staffId = staffUsers[0]?.id;

  const m1 = existingMembers[0]?.id;
  const m2 = existingMembers[1]?.id;
  const m3 = existingMembers[2]?.id;
  const m4 = existingMembers[3]?.id;

  const now = new Date();
  const year = now.getFullYear();

  // Helper date generators relative to today
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const dateStr = (d: Date) => d.toISOString().slice(0, 10);

  // 3. Invoices across 5 sources, with varying ages and payment statuses
  // Sources: 'membership', 'court', 'shop', 'bar', 'corporate', 'social'
  // Statuses: fully paid, partially paid, and unpaid across aging buckets (0-30, 31-60, 61+)
  const invoiceSeeds = [
    // Invoice 1: Corporate Tournament (Unpaid, aged 75 days => 61+ aging bucket)
    {
      id: randomUUID(),
      number: `INV-${year}-000101`,
      businessClientId: seededClients[0].id,
      issuedAt: daysAgo(75),
      dueOn: dateStr(daysAgo(45)),
      source: 'corporate',
      description: 'Annual Interschool Tournament Sponsorship',
      subtotalPaise: 5000000, // ₹50,000.00
      taxRateBps: 1800,
      cgstPaise: 450000,
      sgstPaise: 450000,
      totalPaise: 5900000, // ₹59,000.00
      paidAmountPaise: 0,
      payments: [],
    },
    // Invoice 2: Corporate Court Block (Unpaid, aged 45 days => 31-60 aging bucket)
    {
      id: randomUUID(),
      number: `INV-${year}-000102`,
      businessClientId: seededClients[1].id,
      issuedAt: daysAgo(45),
      dueOn: dateStr(daysAgo(15)),
      source: 'corporate',
      description: 'Weekend Corporate Badminton Clinic',
      subtotalPaise: 3000000, // ₹30,000.00
      taxRateBps: 1800,
      cgstPaise: 270000,
      sgstPaise: 270000,
      totalPaise: 3540000, // ₹35,400.00
      paidAmountPaise: 0,
      payments: [],
    },
    // Invoice 3: Membership Gold Plan (Paid in full via Online, issued 20 days ago)
    {
      id: randomUUID(),
      number: `INV-${year}-000103`,
      memberId: m1,
      issuedAt: daysAgo(20),
      dueOn: dateStr(daysAgo(10)),
      source: 'membership',
      description: 'Gold Annual Club Membership Fee',
      subtotalPaise: 5000000,
      taxRateBps: 1800,
      cgstPaise: 450000,
      sgstPaise: 450000,
      totalPaise: 5900000,
      paidAmountPaise: 5900000,
      payments: [{ method: 'online', amountPaise: 5900000, ref: 'RAZORPAY_GOLD_001' }],
    },
    // Invoice 4: Court Booking Package (Paid via UPI, issued 10 days ago)
    {
      id: randomUUID(),
      number: `INV-${year}-000104`,
      memberId: m2,
      issuedAt: daysAgo(10),
      dueOn: dateStr(daysAgo(5)),
      source: 'court',
      description: 'Prime Tennis Court Booking (5 Sessions)',
      subtotalPaise: 750000, // ₹7,500.00
      taxRateBps: 1800,
      cgstPaise: 67500,
      sgstPaise: 67500,
      totalPaise: 885000, // ₹8,850.00
      paidAmountPaise: 885000,
      payments: [{ method: 'upi', amountPaise: 885000, ref: 'UPI/COURT/7762' }],
    },
    // Invoice 5: Pro Shop Gear (Partial Payment, issued 5 days ago => 0-30 aging bucket)
    {
      id: randomUUID(),
      number: `INV-${year}-000105`,
      memberId: m3,
      issuedAt: daysAgo(5),
      dueOn: dateStr(daysAgo(2)),
      source: 'shop',
      description: 'Wilson Pro Staff Racket + Super Grap (3-Pack)',
      subtotalPaise: 2539800, // ₹25,398.00
      taxRateBps: 1200,
      cgstPaise: 152388,
      sgstPaise: 152388,
      totalPaise: 2844576, // ₹28,445.76
      paidAmountPaise: 1000000, // Paid ₹10,000 partial via Card
      payments: [{ method: 'card', amountPaise: 1000000, ref: 'HDFC_POS_9918' }],
    },
    // Invoice 6: Friday Social Play Session (Paid via Cash, issued 2 days ago)
    {
      id: randomUUID(),
      number: `INV-${year}-000106`,
      memberId: m4,
      issuedAt: daysAgo(2),
      dueOn: dateStr(daysAgo(1)),
      source: 'social',
      description: 'Friday Night Mixed Social Play Session',
      subtotalPaise: 50000, // ₹500.00
      taxRateBps: 1800,
      cgstPaise: 4500,
      sgstPaise: 4500,
      totalPaise: 59000, // ₹590.00
      paidAmountPaise: 59000,
      payments: [{ method: 'cash', amountPaise: 59000, ref: 'CASH_FRONTDESK' }],
    },
    // Invoice 7: Metro Tennis League Sponsorship (Unpaid, aged 15 days => 0-30 aging bucket)
    {
      id: randomUUID(),
      number: `INV-${year}-000107`,
      businessClientId: seededClients[2].id,
      issuedAt: daysAgo(15),
      dueOn: dateStr(daysAgo(5)),
      source: 'corporate',
      description: 'Quarterly Court Access & League Facility Agreement',
      subtotalPaise: 4000000, // ₹40,000.00
      taxRateBps: 1800,
      cgstPaise: 360000,
      sgstPaise: 360000,
      totalPaise: 4720000, // ₹47,200.00
      paidAmountPaise: 0,
      payments: [],
    },
  ];

  for (const inv of invoiceSeeds) {
    await db.insert(invoices).values({
      id: inv.id,
      number: inv.number,
      memberId: inv.memberId ?? null,
      businessClientId: inv.businessClientId ?? null,
      status: 'issued',
      issuedAt: inv.issuedAt,
      dueOn: inv.dueOn,
      subtotalPaise: inv.subtotalPaise,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      totalPaise: inv.totalPaise,
    });

    await db.insert(invoiceLines).values({
      invoiceId: inv.id,
      source: inv.source,
      description: inv.description,
      qty: 1,
      unitPricePaise: inv.subtotalPaise,
      discountPaise: 0,
      taxablePaise: inv.subtotalPaise,
      taxRateBps: inv.taxRateBps,
      cgstPaise: inv.cgstPaise,
      sgstPaise: inv.sgstPaise,
      totalPaise: inv.totalPaise,
      refType: 'seed',
      refId: inv.id,
    });

    for (const p of inv.payments) {
      await db.insert(payments).values({
        invoiceId: inv.id,
        method: p.method,
        amountPaise: p.amountPaise,
        receivedAt: inv.issuedAt,
        receivedBy: staffId ?? null,
        reference: p.ref,
      });
    }
  }

  // 4. 12 Expenses across categories (some approved, some submitted/pending)
  const expenseData = [
    // Approved
    { category: 'maintenance', description: 'Tennis Clay Court Top Dressing & Rolling', amountPaise: 1800000, incurredOn: dateStr(daysAgo(25)), paid: true, status: 'approved' },
    { category: 'utilities', description: 'Monthly High-Mast Court Floodlights Electricity', amountPaise: 3200000, incurredOn: dateStr(daysAgo(22)), paid: true, status: 'approved' },
    { category: 'equipment', description: 'Wilson Official Tournament Court Nets (x2)', amountPaise: 950000, incurredOn: dateStr(daysAgo(18)), paid: true, status: 'approved' },
    { category: 'supplies', description: 'Cafeteria House Blend Roasted Coffee Beans', amountPaise: 420000, incurredOn: dateStr(daysAgo(16)), paid: true, status: 'approved' },
    { category: 'marketing', description: 'Champions Club Winter Junior Open Social Ads', amountPaise: 650000, incurredOn: dateStr(daysAgo(14)), paid: true, status: 'approved' },
    { category: 'maintenance', description: 'Padel Glass Wall Alignment & Fasteners Service', amountPaise: 750000, incurredOn: dateStr(daysAgo(10)), paid: true, status: 'approved' },
    { category: 'utilities', description: 'Clubhouse RO Filter Maintenance & Water Tank Clean', amountPaise: 380000, incurredOn: dateStr(daysAgo(8)), paid: true, status: 'approved' },
    { category: 'supplies', description: 'Locker Room Fresh Linens & Towels Replenishment', amountPaise: 290000, incurredOn: dateStr(daysAgo(6)), paid: true, status: 'approved' },

    // Pending (submitted)
    { category: 'maintenance', description: 'Badminton Court 1 Wooden Floor Polish & Striping', amountPaise: 1200000, incurredOn: dateStr(daysAgo(4)), paid: false, status: 'submitted' },
    { category: 'equipment', description: 'Replacement Automatic Tennis Ball Machine Battery', amountPaise: 540000, incurredOn: dateStr(daysAgo(3)), paid: false, status: 'submitted' },
    { category: 'supplies', description: 'Commercial First Aid & Physio Taping Inventory', amountPaise: 185000, incurredOn: dateStr(daysAgo(2)), paid: false, status: 'submitted' },
    { category: 'marketing', description: 'Quarterly Club Magazine & Event Posters Printing', amountPaise: 350000, incurredOn: dateStr(daysAgo(1)), paid: false, status: 'submitted' },
  ];

  for (const exp of expenseData) {
    await db.insert(expenses).values({
      category: exp.category,
      description: exp.description,
      amountPaise: exp.amountPaise,
      incurredOn: exp.incurredOn,
      paid: exp.paid,
      status: exp.status,
      submittedBy: staffId ?? null,
      approvedBy: exp.status === 'approved' ? staffId ?? null : null,
    });
  }

  console.log('[Seed:invoices] Invoices, business clients, payments, and expenses seeded successfully.');
}
