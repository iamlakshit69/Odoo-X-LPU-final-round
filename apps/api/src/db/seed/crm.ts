// Owner: Dev A – Phase 8: CRM Seed
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import { leads, leadActivities, leadTasks, quotes, quoteLines } from '../schema/crm.js';
import { users } from '../schema/core.js';
import { clubLocalToday, addClubDays } from '../../core/clubTime.js';

export async function seed() {
  console.log('[Seed:crm] Checking CRM seeding...');
  const existing = await db.select({ id: leads.id }).from(leads).limit(1);
  if (existing.length > 0) {
    console.log('[Seed:crm] Leads already exist, skipping.');
    return;
  }

  // Find a staff user to assign to
  const [staff] = await db.select({ id: users.id }).from(users).where(eq(users.active, true)).limit(1);
  const staffUserId = staff?.id || null;

  const today = clubLocalToday();
  const yesterday = addClubDays(today, -1);
  const tomorrow = addClubDays(today, 2);

  console.log('[Seed:crm] Seeding 6 leads across pipeline stages...');

  const lead1Id = '70000000-0000-0000-0000-000000000001';
  const lead2Id = '70000000-0000-0000-0000-000000000002';
  const lead3Id = '70000000-0000-0000-0000-000000000003';
  const lead4Id = '70000000-0000-0000-0000-000000000004';
  const lead5Id = '70000000-0000-0000-0000-000000000005';
  const lead6Id = '70000000-0000-0000-0000-000000000006';

  // 1. Lead 1: new
  await db.insert(leads).values({
    id: lead1Id,
    name: 'Aditya Verma',
    phone: '+919876543210',
    email: 'aditya.verma@example.com',
    source: 'web_form',
    interest: 'Tennis membership inquiry',
    stage: 'new',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values({
    id: randomUUID(),
    leadId: lead1Id,
    type: 'stage_change',
    body: 'Lead created via web_form enquiry. Stage: new',
    byUserId: null,
    at: new Date(),
    createdAt: new Date(),
  });

  // 2. Lead 2: contacted (with 1 overdue task)
  await db.insert(leads).values({
    id: lead2Id,
    name: 'Neha Sharma',
    phone: '+919876543211',
    email: 'neha.sharma@example.com',
    source: 'phone',
    interest: 'Padel coaching & weekend slots',
    stage: 'contacted',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values([
    {
      id: randomUUID(),
      leadId: lead2Id,
      type: 'stage_change',
      body: 'Lead created via phone call. Stage: new',
      byUserId: staffUserId,
      at: new Date(Date.now() - 3 * 86400 * 1000),
      createdAt: new Date(Date.now() - 3 * 86400 * 1000),
    },
    {
      id: randomUUID(),
      leadId: lead2Id,
      type: 'call',
      body: 'Introductory phone call completed. Interested in Padel weekend clinics.',
      byUserId: staffUserId,
      at: new Date(Date.now() - 2 * 86400 * 1000),
      createdAt: new Date(Date.now() - 2 * 86400 * 1000),
    },
    {
      id: randomUUID(),
      leadId: lead2Id,
      type: 'stage_change',
      body: 'Stage changed to contacted',
      byUserId: staffUserId,
      at: new Date(Date.now() - 2 * 86400 * 1000),
      createdAt: new Date(Date.now() - 2 * 86400 * 1000),
    },
  ]);
  // Overdue task (due yesterday)
  await db.insert(leadTasks).values({
    id: '71000000-0000-0000-0000-000000000001',
    leadId: lead2Id,
    title: 'Send padel clinic schedule & pricing',
    dueOn: yesterday,
    assignedTo: staffUserId,
    doneAt: null,
    createdAt: new Date(Date.now() - 2 * 86400 * 1000),
  });

  // 3. Lead 3: quotation_sent (with 1 draft quote)
  await db.insert(leads).values({
    id: lead3Id,
    name: 'Rohit Kapoor',
    phone: '+919876543212',
    email: 'rohit.kapoor@example.com',
    source: 'walk_in',
    interest: 'Gold Membership + personal training',
    stage: 'quotation_sent',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values({
    id: randomUUID(),
    leadId: lead3Id,
    type: 'stage_change',
    body: 'Stage changed to quotation_sent after clubhouse tour',
    byUserId: staffUserId,
    at: new Date(),
    createdAt: new Date(),
  });

  const quoteId = '72000000-0000-0000-0000-000000000001';
  await db.insert(quotes).values({
    id: quoteId,
    leadId: lead3Id,
    number: 'QTE-2026-00001',
    status: 'draft',
    validUntil: addClubDays(today, 14),
    totalPaise: 5500000,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(quoteLines).values([
    {
      id: randomUUID(),
      quoteId,
      description: 'Gold Annual Club Membership',
      qty: 1,
      unitPricePaise: 5000000,
      createdAt: new Date(),
    },
    {
      id: randomUUID(),
      quoteId,
      description: 'Premium Locker Annual Rental',
      qty: 1,
      unitPricePaise: 500000,
      createdAt: new Date(),
    },
  ]);

  // 4. Lead 4: follow_up (with 1 open future task)
  await db.insert(leads).values({
    id: lead4Id,
    name: 'Priya Nair',
    phone: '+919876543213',
    email: 'priya.nair@example.com',
    source: 'web_form',
    interest: 'Badminton coaching for kids',
    stage: 'follow_up',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values({
    id: randomUUID(),
    leadId: lead4Id,
    type: 'stage_change',
    body: 'Stage changed to follow_up. Requested weekend morning callback.',
    byUserId: staffUserId,
    at: new Date(),
    createdAt: new Date(),
  });
  // Open task due in 2 days
  await db.insert(leadTasks).values({
    id: '71000000-0000-0000-0000-000000000002',
    leadId: lead4Id,
    title: 'Call back Priya regarding weekend badminton slots',
    dueOn: tomorrow,
    assignedTo: staffUserId,
    doneAt: null,
    createdAt: new Date(),
  });

  // 5. Lead 5: converted
  await db.insert(leads).values({
    id: lead5Id,
    name: 'Vikram Malhotra',
    phone: '+919876543214',
    email: 'vikram.m@example.com',
    source: 'referral',
    interest: 'Silver Membership',
    stage: 'converted',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values({
    id: randomUUID(),
    leadId: lead5Id,
    type: 'stage_change',
    body: 'Lead converted to full club member',
    byUserId: staffUserId,
    at: new Date(),
    createdAt: new Date(),
  });

  // 6. Lead 6: lost
  await db.insert(leads).values({
    id: lead6Id,
    name: 'Suresh Menon',
    phone: '+919876543215',
    email: 'suresh.menon@example.com',
    source: 'web_form',
    interest: 'Swimming only',
    stage: 'lost',
    lostReason: 'Joined another facility closer to residence',
    assignedTo: staffUserId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await db.insert(leadActivities).values({
    id: randomUUID(),
    leadId: lead6Id,
    type: 'stage_change',
    body: 'Lead marked as lost. Reason: Joined another facility closer to residence',
    byUserId: staffUserId,
    at: new Date(),
    createdAt: new Date(),
  });

  console.log('[Seed:crm] CRM seed completed successfully.');
}
