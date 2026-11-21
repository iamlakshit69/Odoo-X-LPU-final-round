import type { Booking, SocialSession, SocialSignup } from '../bookings.js';

export const fixtureBookings: Booking[] = [
  {
    id: '21000000-0000-0000-0000-000000000001',
    courtId: '22000000-0000-0000-0000-000000000001',
    courtName: 'Centre Court (Tennis 1)',
    kind: 'regular',
    status: 'confirmed',
    memberId: '20000000-0000-0000-0000-000000000001',
    memberName: 'Aarav Sharma',
    guestName: null,
    guestPhone: null,
    startAt: '2026-11-21T04:30:00Z', // 10:00 IST
    endAt: '2026-11-21T05:30:00Z',   // 11:00 IST
    expiresAt: null,
    channel: 'online',
    pricePaise: 0,
    priceBreakdown: [
      {
        ruleId: '19000000-0000-0000-0000-000000000001',
        label: 'Gold Member Free Court Entitlement',
        deltaPaise: -100000,
      },
    ],
    invoiceId: '30000000-0000-0000-0000-000000000002',
    createdBy: '00000000-0000-0000-0000-000000000010',
    cancelledAt: null,
    cancelReason: null,
    refundPaise: null,
    createdAt: '2026-11-20T12:00:00Z',
  },
  {
    id: '21000000-0000-0000-0000-000000000002',
    courtId: '22000000-0000-0000-0000-000000000002',
    courtName: 'Court 2 (Synthetic)',
    kind: 'regular',
    status: 'confirmed',
    memberId: null,
    guestName: 'Kunal Kapoor',
    guestPhone: '+919988776655',
    startAt: '2026-11-21T11:30:00Z', // 17:00 IST (peak)
    endAt: '2026-11-21T12:30:00Z',   // 18:00 IST
    expiresAt: null,
    channel: 'counter',
    pricePaise: 120000, // ₹1,200 walk-in peak rate
    priceBreakdown: [
      {
        ruleId: '19000000-0000-0000-0000-000000000004',
        label: 'Peak Band Walk-in Surcharge',
        deltaPaise: 20000,
      },
    ],
    invoiceId: '30000000-0000-0000-0000-000000000003',
    createdBy: '00000000-0000-0000-0000-000000000003',
    createdAt: '2026-11-21T09:00:00Z',
  },
];

export const fixtureSocialSessions: SocialSession[] = [
  {
    id: '28000000-0000-0000-0000-000000000001',
    courtId: '22000000-0000-0000-0000-000000000001',
    courtName: 'Centre Court (Tennis 1)',
    startAt: '2026-11-21T12:30:00Z', // 18:00 IST
    endAt: '2026-11-21T16:30:00Z',   // 22:00 IST
    capacity: 16,
    pricePerHeadPaise: 40000, // ₹400.00 / head
    title: 'Friday Night Tennis Mixer',
    status: 'open',
    bookingId: '21000000-0000-0000-0000-000000000009',
    confirmedCount: 12,
    waitlistCount: 2,
    createdAt: '2026-11-15T00:00:00Z',
  },
];

export const fixtureSocialSignups: SocialSignup[] = [
  {
    id: '29000000-0000-0000-0000-000000000001',
    sessionId: fixtureSocialSessions[0].id,
    memberId: '20000000-0000-0000-0000-000000000001',
    memberName: 'Aarav Sharma',
    status: 'confirmed',
    position: 1,
    invoiceId: '30000000-0000-0000-0000-000000000004',
    createdAt: '2026-11-16T10:00:00Z',
  },
  {
    id: '29000000-0000-0000-0000-000000000002',
    sessionId: fixtureSocialSessions[0].id,
    memberId: '20000000-0000-0000-0000-000000000002',
    memberName: 'Priya Patel',
    status: 'confirmed',
    position: 2,
    invoiceId: '30000000-0000-0000-0000-000000000005',
    createdAt: '2026-11-16T11:00:00Z',
  },
];
