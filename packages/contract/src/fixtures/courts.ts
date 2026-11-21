import type {
  CourtType,
  Court,
  CourtWithPublicSlots,
  CourtWithStaffSlots,
} from '../courts.js';

export const fixtureCourtTypes: CourtType[] = [
  {
    id: '18000000-0000-0000-0000-000000000001',
    code: 'tennis',
    name: 'Lawn & Synthetic Tennis',
    basePricePerHourPaise: 100000, // ₹1,000.00 / session
    taxCategory: 'court_hire_18',
  },
  {
    id: '18000000-0000-0000-0000-000000000002',
    code: 'padel',
    name: 'Panoramic Padel',
    basePricePerHourPaise: 150000, // ₹1,500.00 / session
    taxCategory: 'court_hire_18',
  },
  {
    id: '18000000-0000-0000-0000-000000000003',
    code: 'badminton',
    name: 'Indoor Teakwood Badminton',
    basePricePerHourPaise: 60000,  // ₹600.00 / session
    taxCategory: 'court_hire_18',
  },
  {
    id: '18000000-0000-0000-0000-000000000004',
    code: 'cricket',
    name: 'Cricket Bowling Nets',
    basePricePerHourPaise: 80000,  // ₹800.00 / session
    taxCategory: 'court_hire_18',
  },
];

export const fixtureCourts: Court[] = [
  {
    id: '22000000-0000-0000-0000-000000000001',
    courtTypeId: '18000000-0000-0000-0000-000000000001',
    courtTypeCode: 'tennis',
    courtTypeName: 'Lawn & Synthetic Tennis',
    name: 'Centre Court (Tennis 1)',
    active: true,
    sortOrder: 1,
  },
  {
    id: '22000000-0000-0000-0000-000000000002',
    courtTypeId: '18000000-0000-0000-0000-000000000001',
    courtTypeCode: 'tennis',
    courtTypeName: 'Lawn & Synthetic Tennis',
    name: 'Court 2 (Synthetic)',
    active: true,
    sortOrder: 2,
  },
  {
    id: '22000000-0000-0000-0000-000000000003',
    courtTypeId: '18000000-0000-0000-0000-000000000001',
    courtTypeCode: 'tennis',
    courtTypeName: 'Lawn & Synthetic Tennis',
    name: 'Court 3 (Clay)',
    active: true,
    sortOrder: 3,
  },
  {
    id: '22000000-0000-0000-0000-000000000004',
    courtTypeId: '18000000-0000-0000-0000-000000000002',
    courtTypeCode: 'padel',
    courtTypeName: 'Panoramic Padel',
    name: 'Padel Glass Court 1',
    active: true,
    sortOrder: 4,
  },
  {
    id: '22000000-0000-0000-0000-000000000005',
    courtTypeId: '18000000-0000-0000-0000-000000000002',
    courtTypeCode: 'padel',
    courtTypeName: 'Panoramic Padel',
    name: 'Padel Glass Court 2',
    active: true,
    sortOrder: 5,
  },
  {
    id: '22000000-0000-0000-0000-000000000006',
    courtTypeId: '18000000-0000-0000-0000-000000000003',
    courtTypeCode: 'badminton',
    courtTypeName: 'Indoor Teakwood Badminton',
    name: 'Badminton Hall 1',
    active: true,
    sortOrder: 6,
  },
  {
    id: '22000000-0000-0000-0000-000000000007',
    courtTypeId: '18000000-0000-0000-0000-000000000003',
    courtTypeCode: 'badminton',
    courtTypeName: 'Indoor Teakwood Badminton',
    name: 'Badminton Hall 2',
    active: true,
    sortOrder: 7,
  },
  {
    id: '22000000-0000-0000-0000-000000000008',
    courtTypeId: '18000000-0000-0000-0000-000000000004',
    courtTypeCode: 'cricket',
    courtTypeName: 'Cricket Bowling Nets',
    name: 'Cricket Net 1 (AstroTurf)',
    active: true,
    sortOrder: 8,
  },
];

export const fixturePublicAvailability: CourtWithPublicSlots[] = [
  {
    court: fixtureCourts[0],
    slots: [
      {
        courtId: fixtureCourts[0].id,
        courtName: fixtureCourts[0].name,
        startAt: '2026-11-21T04:30:00Z', // 10:00 IST
        endAt: '2026-11-21T05:30:00Z',   // 11:00 IST
        status: 'taken',
      },
      {
        courtId: fixtureCourts[0].id,
        courtName: fixtureCourts[0].name,
        startAt: '2026-11-21T05:30:00Z', // 11:00 IST
        endAt: '2026-11-21T06:30:00Z',   // 12:00 IST
        status: 'free',
      },
      {
        courtId: fixtureCourts[0].id,
        courtName: fixtureCourts[0].name,
        startAt: '2026-11-21T12:30:00Z', // 18:00 IST
        endAt: '2026-11-21T16:30:00Z',   // 22:00 IST
        status: 'social',
        social: {
          sessionId: '28000000-0000-0000-0000-000000000001',
          title: 'Friday Night Social Mixer',
          capacity: 16,
          spotsLeft: 4,
          pricePerHeadPaise: 40000,
        },
      },
    ],
  },
];

export const fixtureStaffAvailability: CourtWithStaffSlots[] = [
  {
    court: fixtureCourts[0],
    slots: [
      {
        courtId: fixtureCourts[0].id,
        courtName: fixtureCourts[0].name,
        startAt: '2026-11-21T04:30:00Z',
        endAt: '2026-11-21T05:30:00Z',
        status: 'taken',
        bookingId: '21000000-0000-0000-0000-000000000001',
        bookedBy: {
          memberId: '20000000-0000-0000-0000-000000000001',
          memberName: 'Aarav Sharma',
          phone: '+919876543210',
          channel: 'online',
        },
      },
      {
        courtId: fixtureCourts[0].id,
        courtName: fixtureCourts[0].name,
        startAt: '2026-11-21T05:30:00Z',
        endAt: '2026-11-21T06:30:00Z',
        status: 'free',
      },
    ],
  },
];
