import type {
  Plan,
  Member,
  MemberDetail,
  TimelineItem,
  CheckinRecord,
} from '../members.js';

export const fixturePlans: Plan[] = [
  {
    id: '15000000-0000-0000-0000-000000000001',
    code: 'gold',
    name: 'Gold Championship Plan',
    pricePaise: 5000000, // ₹50,000.00 / year
    durationDays: 365,
    dailyBookingLimit: 2,
    advanceBookingDays: 14,
    active: true,
    entitlements: {
      courtRate: 'Free (100% off any time)',
      shopDiscountBps: 1500, // 15% off
      barDiscountBps: 1000,  // 10% off
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '15000000-0000-0000-0000-000000000002',
    code: 'silver',
    name: 'Silver Club Plan',
    pricePaise: 3000000, // ₹30,000.00 / year
    durationDays: 365,
    dailyBookingLimit: 2,
    advanceBookingDays: 7,
    active: true,
    entitlements: {
      courtRate: '40% off peak (17:00-21:00), 60% off regular',
      shopDiscountBps: 1000, // 10% off
      barDiscountBps: 500,   // 5% off
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '15000000-0000-0000-0000-000000000003',
    code: 'junior',
    name: 'Junior Academy Plan',
    pricePaise: 1500000, // ₹15,000.00 / year
    durationDays: 365,
    dailyBookingLimit: 1,
    advanceBookingDays: 5,
    active: true,
    entitlements: {
      courtRate: '70% off before 17:00',
      shopDiscountBps: 500, // 5% off
      barDiscountBps: 0,
    },
    createdAt: '2026-01-01T00:00:00Z',
  },
];

export const fixtureMembers: Member[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    memberCode: 'CC-000101',
    fullName: 'Aarav Sharma',
    phone: '+919876543210',
    email: 'aarav.sharma@gmail.com',
    dob: '1990-05-15',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    qrToken: 'qr-aarav-sharma-gold-001',
    notes: 'National level tennis player, preferred court: Centre Court',
    createdBy: '00000000-0000-0000-0000-000000000001',
    currentPlan: 'gold',
    status: 'active',
    endsOn: '2027-11-20',
    createdAt: '2026-11-20T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    memberCode: 'CC-000102',
    fullName: 'Priya Patel',
    phone: '+919812345678',
    email: 'priya.patel@outlook.com',
    dob: '1994-08-22',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150',
    qrToken: 'qr-priya-patel-silver-002',
    notes: 'Plays badminton and tennis regularly on weekends',
    createdBy: '00000000-0000-0000-0000-000000000003',
    currentPlan: 'silver',
    status: 'active',
    endsOn: '2026-12-15', // Expiry within 30 days
    createdAt: '2025-12-15T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000003',
    memberCode: 'CC-000103',
    fullName: 'Rohan Mehta',
    phone: '+919899887766',
    email: 'rohan.junior@gmail.com',
    dob: '2012-03-10',
    photoUrl: null,
    qrToken: 'qr-rohan-mehta-junior-003',
    notes: 'Junior squad trainee. Guardian: Ananya Mehta',
    createdBy: '00000000-0000-0000-0000-000000000003',
    currentPlan: 'junior',
    status: 'active',
    endsOn: '2026-11-28', // Expiry within 7 days
    createdAt: '2025-11-28T00:00:00Z',
  },
  {
    id: '20000000-0000-0000-0000-000000000004',
    memberCode: 'CC-000104',
    fullName: 'Sneha Reddy',
    phone: '+919822334455',
    email: 'sneha.reddy@yahoo.com',
    dob: '1988-11-04',
    photoUrl: null,
    qrToken: 'qr-sneha-reddy-expired-004',
    notes: 'Former Gold member, needs follow-up for renewal',
    createdBy: '00000000-0000-0000-0000-000000000001',
    currentPlan: 'gold',
    status: 'expired',
    endsOn: '2026-11-10',
    createdAt: '2025-11-10T00:00:00Z',
  },
];

export const fixtureMemberDetail: MemberDetail = {
  ...fixtureMembers[0],
  membership: {
    id: '25000000-0000-0000-0000-000000000001',
    memberId: fixtureMembers[0].id,
    planId: fixturePlans[0].id,
    startsOn: '2026-11-20',
    endsOn: '2027-11-20',
    status: 'active',
    invoiceId: '30000000-0000-0000-0000-000000000001',
    createdAt: '2026-11-20T00:00:00Z',
  },
  plan: fixturePlans[0],
};

export const fixtureMemberTimeline: TimelineItem[] = [
  {
    id: '26000000-0000-0000-0000-000000000001',
    kind: 'checkin',
    at: '2026-11-21T09:00:00Z',
    title: 'Checked in at Front Desk',
    subtitle: 'Verified by QR code scan',
    status: 'active',
  },
  {
    id: '26000000-0000-0000-0000-000000000002',
    kind: 'booking',
    at: '2026-11-21T09:30:00Z',
    title: 'Court Booking: Centre Court (Tennis)',
    subtitle: 'Slot: 10:00 - 11:00 IST',
    amountPaise: 0, // Free with Gold
    status: 'confirmed',
  },
  {
    id: '26000000-0000-0000-0000-000000000003',
    kind: 'order',
    at: '2026-11-21T11:15:00Z',
    title: 'Shop Purchase: Head Tour XT Tennis Balls (3-pack)',
    subtitle: 'Paid via UPI at Counter',
    amountPaise: 85000, // ₹850.00
    status: 'collected',
  },
];

export const fixtureCheckins: CheckinRecord[] = [
  {
    id: '27000000-0000-0000-0000-000000000001',
    memberId: fixtureMembers[0].id,
    memberName: fixtureMembers[0].fullName,
    at: '2026-11-21T09:00:00Z',
    method: 'qr',
    staffUserId: '00000000-0000-0000-0000-000000000003',
  },
];
