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

export const planCodeSchema = z.enum(['gold', 'silver', 'junior']);
export type PlanCode = z.infer<typeof planCodeSchema>;

export const membershipStatusSchema = z.enum(['active', 'expired', 'suspended', 'cancelled']);
export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const planEntitlementsSchema = z.object({
  courtRate: z.string(),
  shopDiscountBps: z.number().int().default(0),
  barDiscountBps: z.number().int().default(0),
});

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
  photoUrl: z.string().url().nullable().optional(),
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

export const createMemberRequestSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  dob: dateOnSchema.optional(),
  photoUrl: z.string().url().optional(),
  notes: z.string().optional(),
  planCode: planCodeSchema,
});
export type CreateMemberRequest = z.infer<typeof createMemberRequestSchema>;

export const renewMembershipRequestSchema = z.object({
  planCode: planCodeSchema.optional(),
});

export const changePlanRequestSchema = z.object({
  newPlanCode: planCodeSchema,
});

export const checkinRequestSchema = z.union([
  z.object({ qrToken: z.string() }),
  z.object({ memberId: uuidSchema }),
]);

export const checkinResponseSchema = z.object({
  memberId: uuidSchema,
  fullName: z.string(),
  planCode: planCodeSchema.nullable().optional(),
  status: membershipStatusSchema,
  endsOn: dateOnSchema.nullable().optional(),
  checkedInAt: timestampAtSchema,
});
