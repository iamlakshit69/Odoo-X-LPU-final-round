import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { plans, members, memberships } from '../schema/members.js';
import { courts, courtTypes, bookings } from '../schema/courts.js';
import { menuItems, barTables, tabs, tabItems } from '../schema/bar.js';
import { invoices, invoiceLines, payments } from '../schema/invoices.js';
import { users, roles } from '../schema/core.js';
import { hashPassword } from '../../core/auth.js';

export async function seed() {
  console.log('[Seed:enrichment] Starting comprehensive data enrichment (200+ entries)...');

  // Check if already fully seeded
  const [existingInv] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.number, 'INV-2026-000250'))
    .limit(1);

  if (existingInv) {
    console.log('[Seed:enrichment] Enrichment data already fully populated, skipping.');
    return;
  }

  // --------------------------------------------------------------------------
  // 1. Fetch prerequisite reference data
  // --------------------------------------------------------------------------
  const allPlans = await db.select().from(plans);
  const goldPlan = allPlans.find((p) => p.code === 'gold') || allPlans[0];
  const silverPlan = allPlans.find((p) => p.code === 'silver') || allPlans[0];
  const juniorPlan = allPlans.find((p) => p.code === 'junior') || allPlans[0];

  const [memberRole] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, 'member'))
    .limit(1);

  const defaultPasswordHash = await hashPassword('club2026');

  // --------------------------------------------------------------------------
  // 2. Insert 60 New Realistic Members + User Accounts + Memberships
  // --------------------------------------------------------------------------
  console.log('[Seed:enrichment] Seeding 60 members with memberships and portal credentials...');

  const memberNames = [
    'Aditi Rao', 'Kabir Kapoor', 'Meera Nambiar', 'Tarun Khanna', 'Natasha Poonawalla',
    'Cyrus Mistry', 'Tara Sutaria', 'Dev Patel', 'Dia Mirza', 'Farhan Akhtar',
    'Zoya Akhtar', 'Abhay Deol', 'Radhika Apte', 'Manoj Bajpayee', 'Nawazuddin Siddiqui',
    'Konkona Sen Sharma', 'Rahul Bose', 'Shabana Azmi', 'Javed Akhtar', 'Naseeruddin Shah',
    'Ratna Pathak Shah', 'Supriya Pathak', 'Pankaj Kapur', 'Shahid Kapoor', 'Mira Rajput',
    'Ishaan Khatter', 'Janhavi Kapoor', 'Khushi Kapoor', 'Boney Kapoor', 'Anil Kapoor',
    'Sunita Kapoor', 'Sonam Kapoor', 'Rhea Kapoor', 'Harsh Varrdhan Kapoor', 'Sanjay Kapoor',
    'Maheep Kapoor', 'Shanaya Kapoor', 'Jahaan Kapoor', 'Chunky Pandey', 'Bhavana Pandey',
    'Ananya Panday', 'Rysa Panday', 'Sameer Nair', 'Ronnie Screwvala', 'Zarina Screwvala',
    'Siddharth Roy Kapur', 'Vidya Balan', 'Aditya Roy Kapur', 'Kunaal Roy Kapur', 'Rohan Sippy',
    'Ramesh Sippy', 'Kiran Sippy', 'Ashutosh Gowariker', 'Sunita Gowariker', 'Rakeysh Mehra',
    'Bharati Mehra', 'Shoojit Sircar', 'Jhumpa Lahiri', 'Arundhati Roy', 'Vikram Seth'
  ];

  const createdMemberIds: string[] = [];
  const today = '2026-11-22';

  for (let i = 0; i < memberNames.length; i++) {
    const codeNum = 201 + i;
    const memberCode = `CC-${String(codeNum).padStart(6, '0')}`;
    const name = memberNames[i];
    const phone = `+91987000${String(codeNum).padStart(4, '0')}`;
    const email = `member${codeNum}@championsclub.in`;

    const [existing] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.memberCode, memberCode))
      .limit(1);

    if (existing) {
      createdMemberIds.push(existing.id);
      continue;
    }

    const memberId = randomUUID();
    const qrToken = `QR-${memberCode}-${randomUUID().slice(0, 8)}`;

    const planToAssign = i % 3 === 0 ? goldPlan : i % 3 === 1 ? silverPlan : juniorPlan;
    const membershipId = randomUUID();

    // Create user login account for portal
    if (memberRole) {
      await db
        .insert(users)
        .values({
          id: randomUUID(),
          email,
          roleId: memberRole.id,
          passwordHash: defaultPasswordHash,
          name,
          active: true,
        })
        .onConflictDoNothing();
    }

    // Insert Member
    await db
      .insert(members)
      .values({
        id: memberId,
        memberCode,
        fullName: name,
        phone,
        email,
        dob: '1992-05-15',
        qrToken,
        createdAt: new Date('2026-08-01T10:00:00+05:30'),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    // Insert Membership
    await db
      .insert(memberships)
      .values({
        id: membershipId,
        memberId,
        planId: planToAssign.id,
        startsOn: '2026-08-01',
        endsOn: '2027-08-01',
        status: 'active',
        createdAt: new Date('2026-08-01T10:00:00+05:30'),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    createdMemberIds.push(memberId);
  }

  // --------------------------------------------------------------------------
  // 3. Insert 50 Court Bookings Across Available Courts & Dates
  // --------------------------------------------------------------------------
  console.log('[Seed:enrichment] Seeding 50 court bookings across tennis, badminton, squash, padel...');

  const allCourts = await db.select().from(courts);
  const courtList = allCourts.length > 0 ? allCourts : [];

  if (courtList.length > 0) {
    const bookingDates = [
      '2026-11-21',
      '2026-11-22', // today
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
    ];

    const timeSlots = [
      { start: '07:00:00', end: '08:00:00' },
      { start: '08:00:00', end: '09:00:00' },
      { start: '09:00:00', end: '10:00:00' },
      { start: '16:00:00', end: '17:00:00' },
      { start: '17:00:00', end: '18:00:00' },
      { start: '18:00:00', end: '19:00:00' },
      { start: '19:00:00', end: '20:00:00' },
      { start: '20:00:00', end: '21:00:00' },
    ];

    let bookingCount = 0;
    for (const bDate of bookingDates) {
      for (let cIdx = 0; cIdx < courtList.length && bookingCount < 50; cIdx++) {
        const slot = timeSlots[(cIdx + bookingCount) % timeSlots.length];
        const targetCourt = courtList[cIdx];
        const assignedMemberId = createdMemberIds[bookingCount % createdMemberIds.length];

        const startAt = new Date(`${bDate}T${slot.start}+05:30`);
        const endAt = new Date(`${bDate}T${slot.end}+05:30`);
        const isPast = endAt < new Date();

        try {
          await db.insert(bookings).values({
            id: randomUUID(),
            courtId: targetCourt.id,
            kind: 'regular',
            status: isPast ? 'completed' : 'confirmed',
            memberId: assignedMemberId,
            startAt,
            endAt,
            channel: bookingCount % 2 === 0 ? 'online' : 'counter',
            pricePaise: 150000,
            priceBreakdown: { basePaise: 150000, discountPaise: 0, finalPaise: 150000 },
            createdAt: new Date('2026-11-20T12:00:00+05:30'),
            updatedAt: new Date(),
          });
          bookingCount++;
        } catch {
          // ignore slot conflict and proceed
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. Insert 60 Kitchen & Bar Tab Items (Active + Served History)
  // --------------------------------------------------------------------------
  console.log('[Seed:enrichment] Seeding 60 kitchen & bar orders with live tickets and served history...');

  const allMenuItems = await db.select().from(menuItems);
  const kitchenItems = allMenuItems.filter((m) => m.station === 'kitchen');
  const barItems = allMenuItems.filter((m) => m.station === 'bar');

  const allTables = await db.select().from(barTables);
  const tableList = allTables.length > 0 ? allTables : [];

  if (kitchenItems.length > 0 && barItems.length > 0 && tableList.length > 0) {
    const [adminUser] = await db.select({ id: users.id }).from(users).limit(1);

    // A. Create 6 Open Tabs and 6 Settled Tabs
    const tabIds: { id: string; tableLabel: string; isOpen: boolean }[] = [];

    for (let t = 0; t < 12; t++) {
      const table = tableList[t % tableList.length];
      const tabId = randomUUID();
      const isOpen = t < 6; // first 6 open, rest settled
      const memberId = createdMemberIds[t % createdMemberIds.length];

      await db.insert(tabs).values({
        id: tabId,
        tableId: table.id,
        memberId,
        guestLabel: `Guest of Table ${table.label}`,
        status: isOpen ? 'open' : 'settled',
        openedBy: adminUser.id,
        createdAt: new Date(Date.now() - (t + 1) * 3600 * 1000),
        updatedAt: new Date(),
      });

      tabIds.push({ id: tabId, tableLabel: table.label, isOpen });
    }

    // B. Insert 35 Kitchen Items (15 active: pending/preparing/ready, 20 served)
    for (let k = 0; k < 35; k++) {
      const menuItem = kitchenItems[k % kitchenItems.length];
      const isServed = k >= 15;
      const targetTab = isServed ? tabIds[6 + (k % 6)] : tabIds[k % 6];

      let itemStatus: 'pending' | 'preparing' | 'ready' | 'served' = 'pending';
      if (isServed) {
        itemStatus = 'served';
      } else if (k % 3 === 0) {
        itemStatus = 'pending';
      } else if (k % 3 === 1) {
        itemStatus = 'preparing';
      } else {
        itemStatus = 'ready';
      }

      // Stagger served timestamps over the last 1-4 hours
      const orderMinutesAgo = isServed ? 30 + (k * 7) : 5 + (k * 2);
      const servedMinutesAgo = isServed ? Math.max(5, orderMinutesAgo - 15) : 0;

      const orderTime = new Date(Date.now() - orderMinutesAgo * 60 * 1000);
      const updateTime = isServed ? new Date(Date.now() - servedMinutesAgo * 60 * 1000) : orderTime;

      await db.insert(tabItems).values({
        id: randomUUID(),
        tabId: targetTab.id,
        menuItemId: menuItem.id,
        qty: (k % 2) + 1,
        unitPricePaise: menuItem.pricePaise,
        priceBreakdown: { unitPaise: menuItem.pricePaise },
        status: itemStatus,
        createdAt: orderTime,
        updatedAt: updateTime,
      });
    }

    // C. Insert 25 Bar Items (10 active, 15 served)
    for (let b = 0; b < 25; b++) {
      const menuItem = barItems[b % barItems.length];
      const isServed = b >= 10;
      const targetTab = isServed ? tabIds[6 + (b % 6)] : tabIds[b % 6];

      const itemStatus: 'pending' | 'preparing' | 'ready' | 'served' = isServed
        ? 'served'
        : b % 2 === 0
        ? 'pending'
        : 'preparing';

      const orderMinutesAgo = isServed ? 20 + (b * 6) : 3 + (b * 2);
      const servedMinutesAgo = isServed ? Math.max(2, orderMinutesAgo - 10) : 0;

      const orderTime = new Date(Date.now() - orderMinutesAgo * 60 * 1000);
      const updateTime = isServed ? new Date(Date.now() - servedMinutesAgo * 60 * 1000) : orderTime;

      await db.insert(tabItems).values({
        id: randomUUID(),
        tabId: targetTab.id,
        menuItemId: menuItem.id,
        qty: 1,
        unitPricePaise: menuItem.pricePaise,
        priceBreakdown: { unitPaise: menuItem.pricePaise },
        status: itemStatus,
        createdAt: orderTime,
        updatedAt: updateTime,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. Insert 50 Invoices & 50 Payments
  // --------------------------------------------------------------------------
  console.log('[Seed:enrichment] Seeding 50 invoices and matching ledger payments...');

  const paymentMethods = ['upi', 'card', 'cash', 'online'];

  for (let inv = 0; inv < 50; inv++) {
    const invNum = 201 + inv;
    const invoiceNumber = `INV-2026-000${invNum}`;

    const [existingInv] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(eq(invoices.number, invoiceNumber))
      .limit(1);

    if (existingInv) continue;

    const invoiceId = randomUUID();
    const memberId = createdMemberIds[inv % createdMemberIds.length];

    const subtotalPaise = 250000 + (inv * 15000); // ₹2,500 - ₹9,850
    const cgstPaise = Math.round((subtotalPaise * 9) / 100);
    const sgstPaise = Math.round((subtotalPaise * 9) / 100);
    const totalPaise = subtotalPaise + cgstPaise + sgstPaise;

    const daysAgo = 1 + (inv % 20);
    const issuedAt = new Date(Date.now() - daysAgo * 24 * 3600 * 1000);

    // Insert Invoice
    await db.insert(invoices).values({
      id: invoiceId,
      number: invoiceNumber,
      memberId,
      status: 'issued',
      issuedAt,
      dueOn: today,
      subtotalPaise,
      cgstPaise,
      sgstPaise,
      totalPaise,
      createdAt: issuedAt,
      updatedAt: issuedAt,
    });

    // Insert Invoice Line
    await db.insert(invoiceLines).values({
      id: randomUUID(),
      invoiceId,
      source: inv % 4 === 0 ? 'membership' : inv % 4 === 1 ? 'court' : inv % 4 === 2 ? 'bar' : 'shop',
      description:
        inv % 4 === 0
          ? 'Annual Membership Dues & Club Privileges'
          : inv % 4 === 1
          ? 'Tennis Court 1 Peak Hourly Booking'
          : inv % 4 === 2
          ? 'Club Dining & Refreshment Lounge Bill'
          : 'Pro Shop Wilson Tennis Gear & Balls',
      qty: 1,
      unitPricePaise: subtotalPaise,
      taxablePaise: subtotalPaise,
      taxRateBps: 1800,
      cgstPaise,
      sgstPaise,
      totalPaise,
      createdAt: issuedAt,
    });

    // Insert Payment
    const method = paymentMethods[inv % paymentMethods.length];
    const isPaid = inv % 6 !== 0; // 5 out of 6 fully paid, 1 pending
    const paidPaise = isPaid ? totalPaise : Math.round(totalPaise * 0.5);

    await db.insert(payments).values({
      id: randomUUID(),
      invoiceId,
      method,
      amountPaise: paidPaise,
      receivedAt: issuedAt,
      reference:
        method === 'upi'
          ? `UPI/202611${invNum}/champions`
          : method === 'card'
          ? `AUTH-VISA-99${invNum}`
          : method === 'online'
          ? `RAZORPAY-PAY-${invNum}A9`
          : `CASH-DRAWER-${invNum}`,
      createdAt: issuedAt,
    });
  }

  console.log('[Seed:enrichment] Successfully seeded 220+ records (60 members, 50 bookings, 60 tab items, 50 invoices & payments)!');
}

export default seed;
