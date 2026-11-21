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
import { planCodeSchema } from './members.js';

// Section 5.8 Enums & Models
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

export const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected']);
export type QuoteStatus = z.infer<typeof quoteStatusSchema>;

export const leadSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().email().nullable().optional(),
  source: leadSourceSchema,
  interest: z.string().nullable().optional(),
  stage: z.string(), // 'new', 'contacted', 'quotation_sent', 'follow_up', 'converted', 'lost'
  assignedTo: uuidSchema.nullable().optional(),
  assignedToName: z.string().optional(),
  lostReason: z.string().nullable().optional(),
  convertedMemberId: uuidSchema.nullable().optional(),
  trialBookingId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Lead = z.infer<typeof leadSchema>;

export const leadActivitySchema = z.object({
  id: uuidSchema,
  leadId: uuidSchema,
  type: leadActivityTypeSchema,
  body: z.string(),
  byUserId: uuidSchema.nullable().optional(),
  byUserName: z.string().optional(),
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
  assignedToName: z.string().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type LeadTask = z.infer<typeof leadTaskSchema>;

export const quoteLineSchema = z.object({
  id: uuidSchema.optional(),
  quoteId: uuidSchema.optional(),
  description: z.string().min(1),
  qty: z.number().int().positive(),
  unitPricePaise: paiseSchema,
  totalPaise: paiseSchema.optional(),
});
export type QuoteLine = z.infer<typeof quoteLineSchema>;

export const quoteSchema = z.object({
  id: uuidSchema,
  leadId: uuidSchema,
  number: z.string(),
  status: quoteStatusSchema,
  validUntil: dateOnSchema.nullable().optional(),
  totalPaise: paiseSchema,
  lines: z.array(quoteLineSchema).optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Quote = z.infer<typeof quoteSchema>;

export const leadDetailSchema = leadSchema.extend({
  activities: z.array(leadActivitySchema),
  tasks: z.array(leadTaskSchema),
  quotes: z.array(quoteSchema),
});
export type LeadDetail = z.infer<typeof leadDetailSchema>;

// Endpoint Schemas (prefix /api)

// 1. POST /api/public/enquiries (rate-limited)
export const createPublicEnquiryRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  interest: z.string().optional(),
  message: z.string().optional(),
});
export type CreatePublicEnquiryRequest = z.infer<typeof createPublicEnquiryRequestSchema>;
export const createPublicEnquiryResponseSchema = z.object({
  leadId: uuidSchema,
  message: z.string(),
});

// 2. POST /api/public/trial-bookings (rate-limited)
export const createPublicTrialBookingRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  courtId: uuidSchema,
  startAt: timestampAtSchema,
});
export type CreatePublicTrialBookingRequest = z.infer<typeof createPublicTrialBookingRequestSchema>;
export const createPublicTrialBookingResponseSchema = z.object({
  leadId: uuidSchema,
  bookingId: uuidSchema,
  message: z.string(),
});

// 3. GET /api/leads
export const getLeadsQuerySchema = paginationQuerySchema.extend({
  stage: z.string().optional(),
  assignedTo: uuidSchema.optional(),
  source: leadSourceSchema.optional(),
});
export const getLeadsResponseSchema = paginatedResponseSchema(leadSchema);

// 4. GET /api/leads/:id
export const getLeadParamsSchema = z.object({ id: uuidSchema });
export const getLeadResponseSchema = leadDetailSchema;

// 5. PATCH /api/leads/:id
export const updateLeadParamsSchema = z.object({ id: uuidSchema });
export const updateLeadRequestSchema = z.object({
  stage: z.string().optional(),
  assignedTo: uuidSchema.nullable().optional(),
  lostReason: z.string().optional(),
  interest: z.string().optional(),
});
export const updateLeadResponseSchema = leadSchema;

// 6. POST /api/leads/:id/notes
export const createLeadNoteParamsSchema = z.object({ id: uuidSchema });
export const createLeadNoteRequestSchema = z.object({
  body: z.string().min(1),
});
export const createLeadNoteResponseSchema = leadActivitySchema;

// 7. POST /api/leads/:id/tasks
export const createLeadTaskParamsSchema = z.object({ id: uuidSchema });
export const createLeadTaskRequestSchema = z.object({
  title: z.string().min(1),
  dueOn: dateOnSchema,
  assignedTo: uuidSchema.optional(),
});
export const createLeadTaskResponseSchema = leadTaskSchema;

// 8. PATCH /api/tasks/:id
export const updateLeadTaskParamsSchema = z.object({ id: uuidSchema });
export const updateLeadTaskRequestSchema = z.object({
  done: z.boolean(),
});
export const updateLeadTaskResponseSchema = leadTaskSchema;

// 9. POST /api/leads/:id/quotes
export const createLeadQuoteParamsSchema = z.object({ id: uuidSchema });
export const createLeadQuoteRequestSchema = z.object({
  lines: z
    .array(
      z.object({
        description: z.string().min(1),
        qty: z.number().int().positive(),
        unitPricePaise: paiseSchema,
      })
    )
    .min(1),
  validUntil: dateOnSchema.optional(),
});
export const createLeadQuoteResponseSchema = quoteSchema;

// 10. POST /api/quotes/:id/send
export const sendQuoteParamsSchema = z.object({ id: uuidSchema });
export const sendQuoteResponseSchema = z.object({
  success: z.boolean(),
  quote: quoteSchema,
  message: z.string().optional(),
});

// 11. POST /api/leads/:id/convert
export const convertLeadParamsSchema = z.object({ id: uuidSchema });
export const convertLeadRequestSchema = z.object({
  planCode: planCodeSchema,
  dob: dateOnSchema.optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});
export const convertLeadResponseSchema = z.object({
  memberId: uuidSchema,
  memberCode: z.string(),
  membershipId: uuidSchema,
  invoiceId: uuidSchema,
});
export type ConvertLeadResponse = z.infer<typeof convertLeadResponseSchema>;
