import type {
  RoleWithPermissions,
  UserAdmin,
  AuditLog,
  NotificationItem,
  SettingEntry,
  SettingsMap,
} from '../admin.js';

export const fixtureRoles: RoleWithPermissions[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    code: 'owner',
    name: 'Club Owner',
    description: 'Full administrative access across all club operations',
    permissions: [
      { id: '11000000-0000-0000-0000-000000000001', code: 'member:create' },
      { id: '11000000-0000-0000-0000-000000000002', code: 'booking:create' },
      { id: '11000000-0000-0000-0000-000000000003', code: 'finance:read' },
      { id: '11000000-0000-0000-0000-000000000004', code: 'rbac:manage' },
    ],
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    code: 'front_desk',
    name: 'Front Desk Staff',
    description: 'Front office operations, member check-in, bookings, and POS counter',
    permissions: [
      { id: '11000000-0000-0000-0000-000000000001', code: 'member:create' },
      { id: '11000000-0000-0000-0000-000000000002', code: 'booking:create' },
    ],
  },
  {
    id: '10000000-0000-0000-0000-000000000010',
    code: 'member',
    name: 'Club Member',
    description: 'Self-service portal access for active members',
    permissions: [
      { id: '11000000-0000-0000-0000-000000000010', code: 'booking:create:own' },
      { id: '11000000-0000-0000-0000-000000000011', code: 'member:read:own' },
    ],
  },
];

export const fixtureAdminUsers: UserAdmin[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'owner@championsclub.in',
    name: 'Rajesh Khanna',
    roleId: '10000000-0000-0000-0000-000000000001',
    roleCode: 'owner',
    roleName: 'Club Owner',
    active: true,
    createdAt: '2026-11-01T00:00:00Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'desk@championsclub.in',
    name: 'Sunita Rao',
    roleId: '10000000-0000-0000-0000-000000000003',
    roleCode: 'front_desk',
    roleName: 'Front Desk Staff',
    active: true,
    createdAt: '2026-11-05T00:00:00Z',
  },
];

export const fixtureSettings: SettingsMap = {
  'club.timezone': 'Asia/Kolkata',
  'booking.slot_minutes': 30,
  'booking.session_minutes': 60,
  'booking.hold_minutes': 5,
  'booking.default_daily_limit': 2,
  'booking.advance_days': 14,
  'booking.cancellation_policy': [
    { hours_before: 24, refund_pct: 100 },
    { hours_before: 2, refund_pct: 50 },
    { hours_before: 0, refund_pct: 0 },
  ],
  'social.windows': [{ weekday: 5, from: '18:00', to: '22:00', capacity: 16 }],
  'membership.reminder_days': [30, 7],
  'crm.stages': ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'],
  'inventory.default_low_stock': 3,
  'bar.table_occupied_minutes': 90,
};

export const fixtureSettingEntries: SettingEntry[] = Object.entries(fixtureSettings).map(
  ([key, value]) => ({
    key,
    value,
    description: `System configuration for ${key}`,
    updatedBy: '00000000-0000-0000-0000-000000000001',
    updatedAt: '2026-11-21T00:00:00Z',
  })
);

export const fixtureAuditLogs: AuditLog[] = [
  {
    id: '12000000-0000-0000-0000-000000000001',
    at: '2026-11-21T10:15:00Z',
    actorUserId: '00000000-0000-0000-0000-000000000003',
    actorName: 'Sunita Rao',
    action: 'booking.create',
    resource: 'booking',
    recordId: '21000000-0000-0000-0000-000000000001',
    before: null,
    after: { courtId: '22000000-0000-0000-0000-000000000001', status: 'confirmed' },
    meta: { ip: '127.0.0.1' },
    requestId: 'req-001',
  },
];

export const fixtureNotifications: NotificationItem[] = [
  {
    id: '13000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000003',
    memberId: null,
    leadId: '40000000-0000-0000-0000-000000000001',
    channel: 'inapp',
    template: 'lead.new',
    payload: {
      leadName: 'Vikram Seth',
      phone: '+919811223344',
      interest: 'Tennis coaching and Gold membership',
    },
    status: 'sent',
    createdAt: '2026-11-21T11:00:00Z',
    readAt: null,
  },
];
