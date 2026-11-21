// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  timestampAtSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

export const bookingKindSchema = z.enum(['regular', 'social', 'block']);
export type BookingKind = z.infer<typeof bookingKindSchema>;

export const bookingStatusSchema = z.enum([
  'held',
  'confirmed',
  'completed',
  'cancelled',
  'expired',
  'no_show',
]);
export type BookingStatus = z.infer<typeof bookingStatusSchema>;

export const bookingChannelSchema = z.enum(['counter', 'phone', 'online', 'public']);
export type BookingChannel = z.infer<typeof bookingChannelSchema>;

export const bookingSchema = z.object({
  id: uuidSchema,
  courtId: uuidSchema,
  kind: bookingKindSchema,
  status: bookingStatusSchema,
  memberId: uuidSchema.nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  expiresAt: timestampAtSchema.nullable().optional(),
  channel: bookingChannelSchema,
  pricePaise: paiseSchema,
  priceBreakdown: z.array(z.any()).nullable().optional(),
  invoiceId: uuidSchema.nullable().optional(),
  createdBy: uuidSchema.nullable().optional(),
  cancelledAt: timestampAtSchema.nullable().optional(),
  cancelReason: z.string().nullable().optional(),
  refundPaise: paiseSchema.nullable().optional(),
  socialSessionId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Booking = z.infer<typeof bookingSchema>;

export const createBookingRequestSchema = z.object({
  courtId: uuidSchema,
  startAt: timestampAtSchema,
  memberId: uuidSchema.optional(),
  guestName: z.string().optional(),
  guestPhone: z.string().optional(),
  channel: bookingChannelSchema.default('counter'),
});
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

export const cancelBookingRequestSchema = z.object({
  reason: z.string().optional(),
  overrideRefundPct: z.number().int().min(0).max(100).optional(),
});

export const socialSessionSchema = z.object({
  id: uuidSchema,
  courtId: uuidSchema,
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  capacity: z.number().int().positive(),
  pricePerHeadPaise: paiseSchema,
  title: z.string(),
  status: z.enum(['open', 'closed', 'cancelled']),
  bookingId: uuidSchema.nullable().optional(),
  confirmedCount: z.number().int().default(0),
  waitlistCount: z.number().int().default(0),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type SocialSession = z.infer<typeof socialSessionSchema>;

export const socialSignupStatusSchema = z.enum(['confirmed', 'waitlisted', 'cancelled']);
export type SocialSignupStatus = z.infer<typeof socialSignupStatusSchema>;

export const socialSignupSchema = z.object({
  id: uuidSchema,
  sessionId: uuidSchema,
  memberId: uuidSchema,
  status: socialSignupStatusSchema,
  position: z.number().int(),
  invoiceId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type SocialSignup = z.infer<typeof socialSignupSchema>;
