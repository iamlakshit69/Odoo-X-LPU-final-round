import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  plans,
  members,
  memberships,
  memberGuardians,
} from '../schema/members.js';
import { users } from '../schema/core.js';
import { clubLocalToday, addClubDays } from '../../core/clubTime.js';

export async function seed() {
  console.log('[Seed:members] Starting members seed...');

  const today = clubLocalToday();

  // 1. Seed Plans (Gold, Silver, Junior)
  const seedPlans = [
    {
      code: 'gold',
      name: 'Gold Membership',
      pricePaise: 5000000, // ₹50,000
      durationDays: 365,
      dailyBookingLimit: 2,
      advanceBookingDays: 14,
      active: true,
    },
    {
      code: 'silver',
      name: 'Silver Membership',
      pricePaise: 2500000, // ₹25,000
      durationDays: 365,
      dailyBookingLimit: 2,
      advanceBookingDays: 7,
      active: true,
    },
    {
      code: 'junior',
      name: 'Junior Membership',
      pricePaise: 1200000, // ₹12,000
      durationDays: 365,
      dailyBookingLimit: 2,
      advanceBookingDays: 7,
      active: true,
    },
  ];

  const planMap = new Map<string, string>(); // code -> id

  for (const p of seedPlans) {
    const [existing] = await db
      .select({ id: plans.id })
      .from(plans)
      .where(eq(plans.code, p.code))
      .limit(1);

    if (existing) {
      planMap.set(p.code, existing.id);
    } else {
      const [inserted] = await db
        .insert(plans)
        .values({
          id: randomUUID(),
          ...p,
        })
        .returning();
      planMap.set(p.code, inserted.id);
    }
  }

  // 2. Members roster (40 members total: 10 Gold, 18 Silver, 8 Junior, 4 Expired/Suspended)
  const roster = [
    // --- 10 Gold Members ---
    { name: 'Aarav Sharma', phone: '+919820011001', email: 'member@championsclub.in', tier: 'gold', daysRemaining: 180 },
    { name: 'Vikramaditya Singhania', phone: '+919820011002', email: 'vikram.singhania@example.com', tier: 'gold', daysRemaining: 6 }, // Expiring in 6 days (Demo Scene 1)
    { name: 'Ananya Birla', phone: '+919820011003', email: 'ananya.birla@example.com', tier: 'gold', daysRemaining: 25 }, // Expiring within 30 days
    { name: 'Rohan Bopanna', phone: '+919820011004', email: 'rohan.bopanna@example.com', tier: 'gold', daysRemaining: 300 },
    { name: 'Kavita Krishnamurthy', phone: '+919820011005', email: 'kavita.k@example.com', tier: 'gold', daysRemaining: 210 },
    { name: 'Gautam Adani', phone: '+919820011006', email: 'gautam.a@example.com', tier: 'gold', daysRemaining: 320 },
    { name: 'Nita Ambani', phone: '+919820011007', email: 'nita.a@example.com', tier: 'gold', daysRemaining: 150 },
    { name: 'Devendra Fadnavis', phone: '+919820011008', email: 'devendra.f@example.com', tier: 'gold', daysRemaining: 90 },
    { name: 'Sunil Gavaskar', phone: '+919820011009', email: 'sunil.g@example.com', tier: 'gold', daysRemaining: 15 }, // Within 30 days
    { name: 'Leander Paes', phone: '+919820011010', email: 'leander.p@example.com', tier: 'gold', daysRemaining: 270 },

    // --- 18 Silver Members ---
    { name: 'Aarav Mehta', phone: '+919830022001', email: 'aarav.mehta@example.com', tier: 'silver', daysRemaining: 360 }, // New walk-in member (Demo Scene 1)
    { name: 'Rahul Dravid', phone: '+919830022002', email: 'rahul.d@example.com', tier: 'silver', daysRemaining: 4 }, // Expiring in 4 days (within 7 days)
    { name: 'Sania Mirza', phone: '+919830022003', email: 'sania.m@example.com', tier: 'silver', daysRemaining: 18 }, // Within 30 days
    { name: 'Deepika Padukone', phone: '+919830022004', email: 'deepika.p@example.com', tier: 'silver', daysRemaining: 120 },
    { name: 'Ranveer Singh', phone: '+919830022005', email: 'ranveer.s@example.com', tier: 'silver', daysRemaining: 120 },
    { name: 'Sachin Tendulkar', phone: '+919830022006', email: 'sachin.t@example.com', tier: 'silver', daysRemaining: 240 },
    { name: 'Mahendra Singh Dhoni', phone: '+919830022007', email: 'ms.dhoni@example.com', tier: 'silver', daysRemaining: 340 },
    { name: 'Virat Kohli', phone: '+919830022008', email: 'virat.k@example.com', tier: 'silver', daysRemaining: 190 },
    { name: 'Anushka Sharma', phone: '+919830022009', email: 'anushka.s@example.com', tier: 'silver', daysRemaining: 190 },
    { name: 'P. V. Sindhu', phone: '+919830022010', email: 'pv.sindhu@example.com', tier: 'silver', daysRemaining: 85 },
    { name: 'Saina Nehwal', phone: '+919830022011', email: 'saina.n@example.com', tier: 'silver', daysRemaining: 215 },
    { name: 'Neeraj Chopra', phone: '+919830022012', email: 'neeraj.c@example.com', tier: 'silver', daysRemaining: 310 },
    { name: 'Abhinav Bindra', phone: '+919830022013', email: 'abhinav.b@example.com', tier: 'silver', daysRemaining: 140 },
    { name: 'Mary Kom', phone: '+919830022014', email: 'mary.k@example.com', tier: 'silver', daysRemaining: 28 }, // Within 30 days
    { name: 'Viswanathan Anand', phone: '+919830022015', email: 'v.anand@example.com', tier: 'silver', daysRemaining: 160 },
    { name: 'Mirabai Chanu', phone: '+919830022016', email: 'mirabai.c@example.com', tier: 'silver', daysRemaining: 220 },
    { name: 'Pankaj Advani', phone: '+919830022017', email: 'pankaj.a@example.com', tier: 'silver', daysRemaining: 95 },
    { name: 'Bhaichung Bhutia', phone: '+919830022018', email: 'bhaichung.b@example.com', tier: 'silver', daysRemaining: 175 },

    // --- 8 Junior Members (with guardians) ---
    { name: 'Arjun Singhania', phone: '+919840033001', email: 'arjun.s@example.com', tier: 'junior', daysRemaining: 200, guardianPhone: '+919820011002' },
    { name: 'Rhea Bopanna', phone: '+919840033002', email: 'rhea.b@example.com', tier: 'junior', daysRemaining: 300, guardianPhone: '+919820011004' },
    { name: 'Samaira Dravid', phone: '+919840033003', email: 'samaira.d@example.com', tier: 'junior', daysRemaining: 4, guardianPhone: '+919830022002' },
    { name: 'Sara Tendulkar', phone: '+919840033004', email: 'sara.t@example.com', tier: 'junior', daysRemaining: 240, guardianPhone: '+919830022006' },
    { name: 'Arjun Tendulkar', phone: '+919840033005', email: 'arjun.t@example.com', tier: 'junior', daysRemaining: 240, guardianPhone: '+919830022006' },
    { name: 'Ziva Dhoni', phone: '+919840033006', email: 'ziva.d@example.com', tier: 'junior', daysRemaining: 340, guardianPhone: '+919830022007' },
    { name: 'Vamika Kohli', phone: '+919840033007', email: 'vamika.k@example.com', tier: 'junior', daysRemaining: 190, guardianPhone: '+919830022008' },
    { name: 'Akaay Kohli', phone: '+919840033008', email: 'akaay.k@example.com', tier: 'junior', daysRemaining: 190, guardianPhone: '+919830022008' },

    // --- 4 Expired or Suspended Members ---
    { name: 'Karan Mehra', phone: '+919850044001', email: 'karan.m@example.com', tier: 'silver', status: 'expired', daysRemaining: -15 },
    { name: 'Pooja Hegde', phone: '+919850044002', email: 'pooja.h@example.com', tier: 'gold', status: 'expired', daysRemaining: -2 },
    { name: 'Rishabh Pant', phone: '+919850044003', email: 'rishabh.p@example.com', tier: 'gold', status: 'suspended', daysRemaining: 60 },
    { name: 'Shikhar Dhawan', phone: '+919850044004', email: 'shikhar.d@example.com', tier: 'silver', status: 'suspended', daysRemaining: 90 },
  ];

  const createdMembers = new Map<string, { id: string; fullName: string }>(); // phone -> { id, fullName }

  let demoMemberId: string | null = null;

  for (let i = 0; i < roster.length; i++) {
    const item = roster[i];
    const memberCode = `CC-${String(101 + i).padStart(6, '0')}`;
    const qrToken = `qr_member_${memberCode.toLowerCase().replace('-', '_')}`;

    const [existing] = await db
      .select({ id: members.id })
      .from(members)
      .where(eq(members.phone, item.phone))
      .limit(1);

    let memberId: string;

    if (existing) {
      memberId = existing.id;
    } else {
      const [inserted] = await db
        .insert(members)
        .values({
          id: randomUUID(),
          memberCode,
          fullName: item.name,
          phone: item.phone,
          email: item.email,
          qrToken,
          notes: `Seeded ${item.tier} club member`,
        })
        .returning();
      memberId = inserted.id;
    }

    createdMembers.set(item.phone, { id: memberId, fullName: item.name });

    if (item.email === 'member@championsclub.in') {
      demoMemberId = memberId;
    }

    // Seed membership row
    const planId = planMap.get(item.tier);
    if (!planId) continue;

    const startsOn = addClubDays(today, item.daysRemaining - 365);
    const endsOn = addClubDays(today, item.daysRemaining);
    const membershipStatus = (item.status as any) || (item.daysRemaining < 0 ? 'expired' : 'active');

    const [existingMem] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(eq(memberships.memberId, memberId))
      .limit(1);

    if (!existingMem) {
      await db.insert(memberships).values({
        id: randomUUID(),
        memberId,
        planId,
        startsOn,
        endsOn,
        status: membershipStatus,
        invoiceId: randomUUID(), // Dev B stub invoice
      });
    }
  }

  // 3. Link junior members to guardians
  for (const item of roster) {
    if ((item as any).guardianPhone) {
      const junior = createdMembers.get(item.phone);
      const guardian = createdMembers.get((item as any).guardianPhone);

      if (junior && guardian) {
        await db
          .insert(memberGuardians)
          .values({
            memberId: junior.id,
            guardianMemberId: guardian.id,
            relationship: 'Parent',
          })
          .onConflictDoNothing();
      }
    }
  }

  // 4. Link demo 'member' user to the first Gold member (Aarav Sharma)
  if (demoMemberId) {
    await db
      .update(users)
      .set({ memberId: demoMemberId })
      .where(eq(users.email, 'member@championsclub.in'));
    console.log(`[Seed:members] Linked demo login 'member@championsclub.in' to memberId: ${demoMemberId}`);
  }

  console.log(`[Seed:members] Seeded ${roster.length} members with plans, guardians, and memberships.`);
}

export default seed;
