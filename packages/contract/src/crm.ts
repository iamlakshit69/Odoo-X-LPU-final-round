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

export const leadSourceSchema = z.enum([
  'web_form',
  'trial_booking',
  'walk_in',
  'phone',
  'referral',
]);
export type LeadSource = z.infer<typeof leadSourceSchema>;

export const leadActivityTypeSchema = z.enum([
  'note',
  'call',
  'message',
  'stage_change',
  'quote',
  'task_done',
]);
export type LeadActivityType = z.infer<typeof leadActivityTypeSchema>;

export const leadSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable().optional(),
  source: leadSourceSchema,
  interest: z.string().nullable().optional(),
  stage: z.string(), // stages configurable in settings
  assignedTo: uuidSchema.nullable().optional(),
  lostReason: z.string().nullable().optional(),
  convertedMemberId: uuidSchema.nullable().optional(),
  trialBookingId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Lead = z.infer<typeof leadSchema>;

export const createLeadRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  source: leadSourceSchema.default('walk_in'),
  interest: z.string().optional(),
});
export type CreateLeadRequest = z.infer<typeof createLeadRequestSchema>;

export const leadActivitySchema = z.object({
  id: uuidSchema,
  leadId: uuidSchema,
  type: leadActivityTypeSchema,
  body: z.string(),
  byUserId: uuidSchema.nullable().optional(),
  at: timestampAtSchema,
});
export type LeadActivity = z.infer<typeof leadActivitySchema>;

export const leadTaskSchema = z.object({
  id: uuidSchema,
  leadId: uuidSchema,
  title: z.string(),
  dueOn: dateOnSchema,
  doneAt: timestampAtSchema.nullable().optional(),
  assignedTo: uuidSchema.nullable().optional(),
});
export type LeadTask = z.infer<typeof leadTaskSchema>;

export const quoteSchema = z.object({
  id: uuidSchema,
  leadId: uuidSchema,
  number: z.string(),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
  validUntil: dateOnSchema.nullable().optional(),
  totalPaise: paiseSchema,
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Quote = z.infer<typeof quoteSchema>;
