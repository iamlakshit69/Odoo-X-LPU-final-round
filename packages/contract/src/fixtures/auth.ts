import type { SessionUser, MeResponse } from '../auth.js';

export const fixtureOwnerUser: SessionUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'owner@championsclub.in',
  name: 'Rajesh Khanna',
  roleId: '10000000-0000-0000-0000-000000000001',
  roleCode: 'owner',
  active: true,
};

export const fixtureFrontDeskUser: SessionUser = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'desk@championsclub.in',
  name: 'Sunita Rao',
  roleId: '10000000-0000-0000-0000-000000000003',
  roleCode: 'front_desk',
  active: true,
};

export const fixtureMemberUser: SessionUser = {
  id: '00000000-0000-0000-0000-000000000010',
  email: 'aarav.sharma@gmail.com',
  name: 'Aarav Sharma',
  roleId: '10000000-0000-0000-0000-000000000010',
  roleCode: 'member',
  memberId: '20000000-0000-0000-0000-000000000001',
  active: true,
};

export const fixtureMeOwner: MeResponse = {
  user: fixtureOwnerUser,
  role: 'owner',
  permissions: [
    'member:create',
    'member:read',
    'member:update',
    'member:delete',
    'booking:create',
    'booking:read',
    'booking:cancel',
    'booking:update',
    'booking:block',
    'lead:create',
    'lead:read',
    'lead:update',
    'lead:convert',
    'quote:manage',
    'pricing:manage',
    'pricing:quote',
    'rbac:manage',
    'user:manage',
    'settings:manage',
    'audit:read',
    'invoice:read',
    'payment:create',
    'finance:read',
  ],
};

export const fixtureMeMember: MeResponse = {
  user: fixtureMemberUser,
  role: 'member',
  permissions: [
    'booking:create:own',
    'booking:read:own',
    'booking:cancel:own',
    'member:read:own',
    'invoice:read:own',
    'order:create:own',
    'order:read:own',
  ],
  memberId: '20000000-0000-0000-0000-000000000001',
  activePlan: 'gold',
};
