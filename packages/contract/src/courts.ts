// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, paiseSchema, timestampAtSchema } from './common.js';

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
  name: z.string(),
  active: z.boolean(),
  sortOrder: z.number().int().default(0),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Court = z.infer<typeof courtSchema>;

export const slotAvailabilityStatusSchema = z.enum(['free', 'taken', 'social', 'held', 'blocked']);
export type SlotAvailabilityStatus = z.infer<typeof slotAvailabilityStatusSchema>;

export const publicSlotSchema = z.object({
  courtId: uuidSchema,
  courtName: z.string(),
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  status: slotAvailabilityStatusSchema,
  social: z
    .object({
      capacity: z.number().int(),
      left: z.number().int(),
      pricePerHeadPaise: paiseSchema,
    })
    .optional(),
});

export const staffSlotSchema = publicSlotSchema.extend({
  bookingId: uuidSchema.optional(),
  bookedBy: z
    .object({
      memberId: uuidSchema.optional(),
      memberName: z.string().optional(),
      guestName: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});
