// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, paiseSchema, timestampAtSchema, dateOnSchema } from './common.js';

// Section 5.3 Models & Enums
export const courtTypeCodeSchema = z.enum(['tennis', 'padel', 'badminton', 'cricket']);
export type CourtTypeCode = z.infer<typeof courtTypeCodeSchema>;

export const courtTypeSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  basePricePerHourPaise: paiseSchema,
  taxCategory: z.string(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type CourtType = z.infer<typeof courtTypeSchema>;

export const courtSchema = z.object({
  id: uuidSchema,
  courtTypeId: uuidSchema,
  courtTypeCode: z.string().optional(),
  courtTypeName: z.string().optional(),
  name: z.string(),
  active: z.boolean(),
  sortOrder: z.number().int().default(0),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Court = z.infer<typeof courtSchema>;

export const slotStatusSchema = z.enum(['free', 'taken', 'social', 'held', 'blocked']);
export type SlotStatus = z.infer<typeof slotStatusSchema>;

export const publicSlotSchema = z.object({
  courtId: uuidSchema,
  courtName: z.string(),
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  status: slotStatusSchema,
  social: z
    .object({
      sessionId: uuidSchema,
      title: z.string(),
      capacity: z.number().int(),
      spotsLeft: z.number().int(),
      pricePerHeadPaise: paiseSchema,
    })
    .optional(),
});
export type PublicSlot = z.infer<typeof publicSlotSchema>;

export const staffSlotSchema = publicSlotSchema.extend({
  bookingId: uuidSchema.optional(),
  bookedBy: z
    .object({
      memberId: uuidSchema.optional(),
      memberName: z.string().optional(),
      guestName: z.string().optional(),
      phone: z.string().optional(),
      channel: z.string().optional(),
    })
    .optional(),
});
export type StaffSlot = z.infer<typeof staffSlotSchema>;

export const courtWithPublicSlotsSchema = z.object({
  court: courtSchema,
  slots: z.array(publicSlotSchema),
});
export type CourtWithPublicSlots = z.infer<typeof courtWithPublicSlotsSchema>;

export const courtWithStaffSlotsSchema = z.object({
  court: courtSchema,
  slots: z.array(staffSlotSchema),
});
export type CourtWithStaffSlots = z.infer<typeof courtWithStaffSlotsSchema>;

// Endpoint Schemas (prefix /api)

// 1. GET /api/public/availability
export const getPublicAvailabilityQuerySchema = z.object({
  date: dateOnSchema,
  courtType: z.string().optional(),
});
export const getPublicAvailabilityResponseSchema = z.object({
  date: dateOnSchema,
  courts: z.array(courtWithPublicSlotsSchema),
});

// 2. GET /api/availability (staff)
export const getStaffAvailabilityQuerySchema = z.object({
  date: dateOnSchema,
  courtType: z.string().optional(),
});
export const getStaffAvailabilityResponseSchema = z.object({
  date: dateOnSchema,
  courts: z.array(courtWithStaffSlotsSchema),
});

// 3. GET /api/admin/court-types
export const getCourtTypesResponseSchema = z.array(courtTypeSchema);

// 4. PUT /api/admin/court-types/:id
export const updateCourtTypeParamsSchema = z.object({ id: uuidSchema });
export const updateCourtTypeRequestSchema = z.object({
  name: z.string().optional(),
  basePricePerHourPaise: paiseSchema.optional(),
  taxCategory: z.string().optional(),
});
export const updateCourtTypeResponseSchema = courtTypeSchema;

// 5. GET /api/admin/courts
export const getCourtsResponseSchema = z.array(courtSchema);

// 6. POST /api/admin/courts
export const createCourtRequestSchema = z.object({
  courtTypeId: uuidSchema,
  name: z.string().min(1),
  sortOrder: z.number().int().default(0),
  active: z.boolean().default(true),
});
export const createCourtResponseSchema = courtSchema;

// 7. PUT /api/admin/courts/:id
export const updateCourtParamsSchema = z.object({ id: uuidSchema });
export const updateCourtRequestSchema = z.object({
  name: z.string().optional(),
  courtTypeId: uuidSchema.optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export const updateCourtResponseSchema = courtSchema;
