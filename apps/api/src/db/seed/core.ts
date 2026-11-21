import { db } from '../../core/db/index.js';
import {
  roles,
  permissions,
  rolePermissions,
  users,
  settings,
} from '../schema/core.js';
import { eq } from 'drizzle-orm';
import { hashPassword } from '../../core/auth.js';

export async function seed() {
  console.log('[Seed] Seeding core settings, roles, permissions, and users...');

  // 1. Seed Settings (Section 5.9)
  const defaultSettings = [
    { key: 'club.timezone', value: 'Asia/Kolkata', description: 'Club local timezone' },
    { key: 'booking.slot_minutes', value: 30, description: 'Slot start interval in minutes' },
    { key: 'booking.session_minutes', value: 60, description: 'Standard court session duration' },
    { key: 'booking.hold_minutes', value: 5, description: 'Temporary hold duration for online payments' },
    { key: 'booking.default_daily_limit', value: 2, description: 'Default max sessions per member per day' },
    { key: 'booking.advance_days', value: 14, description: 'Maximum days in advance a slot can be booked' },
    {
      key: 'booking.cancellation_policy',
      value: [
        { hours_before: 24, refund_pct: 100 },
        { hours_before: 2, refund_pct: 50 },
        { hours_before: 0, refund_pct: 0 },
      ],
      description: 'Cancellation refund percentage based on notice',
    },
    {
      key: 'social.windows',
      value: [{ weekday: 5, from: '18:00', to: '22:00', capacity: 16 }],
      description: 'Social play sessions schedule and capacity',
    },
    {
      key: 'membership.reminder_days',
      value: [30, 7],
      description: 'Days before membership expiry to send reminders',
    },
    {
      key: 'crm.stages',
      value: ['new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'],
      description: 'CRM lead pipeline stages',
    },
    { key: 'inventory.default_low_stock', value: 3, description: 'Default low stock alert threshold' },
    { key: 'bar.table_occupied_minutes', value: 90, description: 'Threshold for highlighting occupied tables' },
  ];

  for (const s of defaultSettings) {
    await db.insert(settings).values(s).onConflictDoUpdate({
      target: settings.key,
      set: { value: s.value, description: s.description, updatedAt: new Date() },
    });
  }

  // 2. Seed 10 Roles (Section 8)
  const allRoles = [
    { code: 'owner', name: 'Club Owner', description: 'Full access to all club operations' },
    { code: 'manager', name: 'Club Manager', description: 'Club manager with all operational perms except RBAC' },
    { code: 'front_desk', name: 'Front Desk', description: 'Front desk reception and bookings staff' },
    { code: 'shop_clerk', name: 'Shop Clerk', description: 'Sports shop counter and inventory' },
    { code: 'bartender', name: 'Bartender', description: 'Bar and cafe service' },
    { code: 'kitchen', name: 'Kitchen Staff', description: 'Kitchen display screen staff' },
    { code: 'cashier', name: 'Cashier', description: 'Till and POS cashier' },
    { code: 'finance', name: 'Finance Officer', description: 'Accounting, invoices, and financial reports' },
    { code: 'hr', name: 'HR Officer', description: 'Staff rota, leave, and payroll' },
    { code: 'member', name: 'Club Member', description: 'Member self-service portal' },
  ];

  const roleMap = new Map<string, string>(); // code -> id

  for (const r of allRoles) {
    const existing = await db.select().from(roles).where(eq(roles.code, r.code)).limit(1);
    if (existing.length > 0) {
      roleMap.set(r.code, existing[0].id);
    } else {
      const inserted = await db.insert(roles).values(r).returning();
      roleMap.set(r.code, inserted[0].id);
    }
  }

  // 3. Seed Permissions (Sections 7 & 8)
  const allPermissions = [
    // Members
    'member:create',
    'member:read',
    'member:read:own',
    'member:update',
    'member:delete',
    'checkin:create',
    // Bookings
    'booking:create',
    'booking:create:own',
    'booking:read',
    'booking:read:own',
    'booking:cancel',
    'booking:cancel:own',
    'booking:update',
    'booking:block',
    'booking:override_refund',
    'court:manage',
    // Leads & CRM
    'lead:create',
    'lead:read',
    'lead:update',
    'lead:convert',
    'quote:manage',
    // Shop & Orders
    'product:manage',
    'product:read',
    'stock:read',
    'stock:adjust',
    'order:create',
    'order:create:own',
    'order:read',
    'order:read:own',
    'order:update',
    // Bar & KDS
    'menu:manage',
    'tab:create',
    'tab:read',
    'tab:read:own',
    'tab:update',
    'tab:void',
    'tab:settle',
    'kds:read',
    'kds:update',
    'till:manage',
    // Invoices & Payments
    'invoice:create',
    'invoice:read',
    'invoice:read:own',
    'payment:create',
    'client:manage',
    // Finance & Reports
    'finance:read',
    'finance:share',
    'expense:manage',
    'expense:approve',
    'report:read',
    'tax:manage',
    // HR & Payroll
    'hr:manage',
    'hr:read',
    'leave:approve',
    'payroll:run',
    'payroll:read',
    // Core & Admin
    'rbac:manage',
    'user:manage',
    'settings:manage',
    'pricing:manage',
    'pricing:quote',
    'audit:read',
  ];

  const permMap = new Map<string, string>(); // code -> id

  for (const p of allPermissions) {
    const existing = await db.select().from(permissions).where(eq(permissions.code, p)).limit(1);
    if (existing.length > 0) {
      permMap.set(p, existing[0].id);
    } else {
      const inserted = await db.insert(permissions).values({ code: p, description: p }).returning();
      permMap.set(p, inserted[0].id);
    }
  }

  // 4. Role to Permission Matrix (Section 8)
  const matrix: Record<string, string[]> = {
    owner: allPermissions, // Owner has all
    manager: allPermissions.filter((p) => p !== 'rbac:manage'),
    front_desk: [
      'member:create',
      'member:read',
      'member:update',
      'checkin:create',
      'booking:create',
      'booking:read',
      'booking:cancel',
      'booking:update',
      'court:manage',
      'lead:create',
      'lead:read',
      'lead:update',
      'lead:convert',
      'quote:manage',
      'product:read',
      'order:create',
      'order:read',
      'invoice:read',
      'payment:create',
      'pricing:quote',
    ],
    shop_clerk: [
      'member:read',
      'product:manage',
      'product:read',
      'stock:read',
      'stock:adjust',
      'order:create',
      'order:read',
      'order:update',
      'payment:create',
      'invoice:read',
      'pricing:quote',
    ],
    bartender: [
      'member:read',
      'tab:create',
      'tab:read',
      'tab:update',
      'tab:void',
      'kds:read',
      'kds:update',
      'pricing:quote',
    ],
    kitchen: ['kds:read', 'kds:update'],
    cashier: [
      'member:read',
      'booking:read',
      'order:read',
      'tab:settle',
      'till:manage',
      'payment:create',
      'invoice:read',
      'invoice:create',
      'report:read',
    ],
    finance: [
      'member:read',
      'booking:read',
      'order:read',
      'tab:read',
      'invoice:create',
      'invoice:read',
      'payment:create',
      'client:manage',
      'finance:read',
      'finance:share',
      'expense:manage',
      'expense:approve',
      'report:read',
      'tax:manage',
      'payroll:read',
      'audit:read',
    ],
    hr: ['hr:manage', 'hr:read', 'leave:approve', 'payroll:run', 'payroll:read'],
    member: [
      'member:read:own',
      'booking:create:own',
      'booking:read:own',
      'booking:cancel:own',
      'order:create:own',
      'order:read:own',
      'tab:read:own',
      'invoice:read:own',
    ],
  };

  // Link role_permissions
  for (const [roleCode, permCodes] of Object.entries(matrix)) {
    const roleId = roleMap.get(roleCode);
    if (!roleId) continue;

    for (const permCode of permCodes) {
      const permId = permMap.get(permCode);
      if (!permId) continue;

      await db
        .insert(rolePermissions)
        .values({ roleId, permissionId: permId })
        .onConflictDoNothing();
    }
  }

  // 5. Seed one user per role with password 'demo1234'
  const defaultPasswordHash = await hashPassword('demo1234');

  const defaultUsers = [
    { email: 'owner@championsclub.in', name: 'Rajesh Khanna', role: 'owner' },
    { email: 'manager@championsclub.in', name: 'Deepak Verma', role: 'manager' },
    { email: 'frontdesk@championsclub.in', name: 'Sunita Rao', role: 'front_desk' },
    { email: 'shop@championsclub.in', name: 'Manoj Kumar', role: 'shop_clerk' },
    { email: 'bartender@championsclub.in', name: 'Ajay Singh', role: 'bartender' },
    { email: 'kitchen@championsclub.in', name: 'Chef Sanjeev', role: 'kitchen' },
    { email: 'cashier@championsclub.in', name: 'Pooja Sharma', role: 'cashier' },
    { email: 'finance@championsclub.in', name: 'Sanjay Gupta', role: 'finance' },
    { email: 'hr@championsclub.in', name: 'Ritu Kapoor', role: 'hr' },
    { email: 'member@championsclub.in', name: 'Aarav Sharma', role: 'member' },
  ];

  for (const u of defaultUsers) {
    const roleId = roleMap.get(u.role);
    if (!roleId) continue;

    await db
      .insert(users)
      .values({
        email: u.email,
        name: u.name,
        passwordHash: defaultPasswordHash,
        roleId,
        active: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          name: u.name,
          roleId,
          passwordHash: defaultPasswordHash,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  console.log('[Seed] Core seed completed successfully.');
}
