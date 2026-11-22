// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  dateOnSchema,
  timestampAtSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Section 5.2 Enums & Models
export const planCodeSchema = z.string().min(1);
export type PlanCode = z.infer<typeof planCodeSchema>;

export const membershipStatusSchema = z.enum(['active', 'expired', 'suspended', 'cancelled']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const checkinMethodSchema = z.enum(['qr', 'manual']);
export type CheckinMethod = z.infer<typeof checkinMethodSchema>;

export const planEntitlementsSchema = z.object({
  courtRate: z.string(), // e.g. "Free" or "40% off peak, 60% off normal"
  shopDiscountBps: z.number().int().default(0), // basis points (1500 = 15%)
  barDiscountBps: z.number().int().default(0),  // basis points (1000 = 10%)
});
export type PlanEntitlements = z.infer<typeof planEntitlementsSchema>;

export const planSchema = z.object({
  id: uuidSchema,
  code: planCodeSchema,
  name: z.string(),
  pricePaise: paiseSchema,
  durationDays: z.number().int().positive(),
  dailyBookingLimit: z.number().int().default(2),
  advanceBookingDays: z.number().int().positive(),
  active: z.boolean(),
  entitlements: planEntitlementsSchema.optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Plan = z.infer<typeof planSchema>;

export const memberSchema = z.object({
  id: uuidSchema,
  memberCode: z.string(),
  fullName: z.string(),
  phone: z.string(),
  email: z.string().email().nullable().optional(),
  dob: dateOnSchema.nullable().optional(),
  photoUrl: z.string().nullable().optional(),
  qrToken: z.string(),
  notes: z.string().nullable().optional(),
  createdBy: uuidSchema.nullable().optional(),
  currentPlan: planCodeSchema.nullable().optional(),
  status: membershipStatusSchema.nullable().optional(),
  endsOn: dateOnSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Member = z.infer<typeof memberSchema>;

export const membershipSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
  planId: uuidSchema,
  startsOn: dateOnSchema,
  endsOn: dateOnSchema,
  status: membershipStatusSchema,
  invoiceId: uuidSchema.nullable().optional(),
  replacedBy: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Membership = z.infer<typeof membershipSchema>;

export const checkinRecordSchema = z.object({
  id: uuidSchema,
  memberId: uuidSchema,
  memberName: z.string().optional(),
  at: timestampAtSchema,
  method: checkinMethodSchema,
  staffUserId: uuidSchema.nullable().optional(),
});
export type CheckinRecord = z.infer<typeof checkinRecordSchema>;

export const timelineItemKindSchema = z.enum([
  'booking',
  'order',
  'tab',
  'payment',
  'checkin',
  'membership',
]);
export type TimelineItemKind = z.infer<typeof timelineItemKindSchema>;

export const timelineItemSchema = z.object({
  id: uuidSchema,
  kind: timelineItemKindSchema,
  at: timestampAtSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  amountPaise: paiseSchema.optional(),
  status: z.string().optional(),
  meta: z.record(z.unknown()).optional(),
});
export type TimelineItem = z.infer<typeof timelineItemSchema>;

// Endpoint Schemas (prefix /api)

// 1. GET /api/plans (public)
export const getPlansResponseSchema = z.array(planSchema);

// 2. POST /api/members
export const createMemberRequestSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().or(z.literal('')).optional().transform((v) => (v === '' ? undefined : v)),
  dob: dateOnSchema.or(z.literal('')).optional().transform((v) => (v === '' ? undefined : v)),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  planCode: planCodeSchema,
  guardianMemberId: uuidSchema.optional(),
  relationship: z.string().optional(),
  password: z.string().min(6).optional(), // Portal login password (optional — required only if email is set)
});
export type CreateMemberRequest = z.infer<typeof createMemberRequestSchema>;

export const createMemberResponseSchema = z.object({
  member: memberSchema,
  membership: membershipSchema,
  invoiceId: uuidSchema,
  qrToken: z.string(),
});
export type CreateMemberResponse = z.infer<typeof createMemberResponseSchema>;

// 3. GET /api/members
export const getMembersQuerySchema = paginationQuerySchema.extend({
  q: z.string().optional(),
  status: membershipStatusSchema.optional(),
  planCode: planCodeSchema.optional(),
});
export const getMembersResponseSchema = paginatedResponseSchema(memberSchema);

// 4. GET /api/members/:id
export const getMemberParamsSchema = z.object({ id: uuidSchema });
export const getMemberResponseSchema = memberSchema.extend({
  membership: membershipSchema.nullable().optional(),
  plan: planSchema.nullable().optional(),
  guardian: z
    .object({
      id: uuidSchema,
      fullName: z.string(),
      phone: z.string(),
      relationship: z.string(),
    })
    .nullable()
    .optional(),
});
export type MemberDetail = z.infer<typeof getMemberResponseSchema>;

// 5. GET /api/members/:id/timeline
export const getMemberTimelineParamsSchema = z.object({ id: uuidSchema });
export const getMemberTimelineQuerySchema = paginationQuerySchema;
export const getMemberTimelineResponseSchema = z.array(timelineItemSchema);

// 6. POST /api/members/:id/renew
export const renewMembershipParamsSchema = z.object({ id: uuidSchema });
export const renewMembershipRequestSchema = z.object({
  planCode: planCodeSchema.optional(),
});
export const renewMembershipResponseSchema = z.object({
  membership: membershipSchema,
  invoiceId: uuidSchema,
});

// 7. POST /api/members/:id/change-plan
export const changePlanParamsSchema = z.object({ id: uuidSchema });
export const changePlanRequestSchema = z.object({
  newPlanCode: planCodeSchema,
});
export const changePlanResponseSchema = z.object({
  membership: membershipSchema,
  invoiceId: uuidSchema,
});

// 8. POST /api/members/:id/suspend
export const suspendMemberParamsSchema = z.object({ id: uuidSchema });
export const suspendMemberRequestSchema = z.object({
  reason: z.string().optional(),
});
export const suspendMemberResponseSchema = z.object({
  member: memberSchema,
  status: membershipStatusSchema,
});

// 9. POST /api/members/:id/reinstate
export const reinstateMemberParamsSchema = z.object({ id: uuidSchema });
export const reinstateMemberResponseSchema = z.object({
  member: memberSchema,
  status: membershipStatusSchema,
});

// 10. POST /api/checkins
export const checkinRequestSchema = z.object({
  qrToken: z.string().optional(),
  memberId: uuidSchema.optional(),
  method: checkinMethodSchema.default('qr'),
});
export type CheckinRequest = z.infer<typeof checkinRequestSchema>;

export const checkinResponseSchema = z.object({
  checkin: checkinRecordSchema,
  memberCard: z.object({
    id: uuidSchema,
    memberCode: z.string(),
    fullName: z.string(),
    planCode: planCodeSchema.nullable().optional(),
    status: membershipStatusSchema,
    endsOn: dateOnSchema.nullable().optional(),
    photoUrl: z.string().nullable().optional(),
  }),
});
export type CheckinResponse = z.infer<typeof checkinResponseSchema>;

// 11. GET /api/checkins/current
export const getCurrentCheckinsResponseSchema = z.array(
  z.object({
    id: uuidSchema,
    memberId: uuidSchema,
    memberCode: z.string(),
    fullName: z.string(),
    planCode: planCodeSchema.nullable().optional(),
    checkedInAt: timestampAtSchema,
    method: checkinMethodSchema,
  })
);
