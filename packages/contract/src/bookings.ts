// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  timestampAtSchema,
  dateOnSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Section 5.3 Enums & Models
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

export const bookingPriceBreakdownItemSchema = z.object({
  ruleId: z.string(),
  label: z.string(),
  deltaPaise: paiseSchema,
});
export type BookingPriceBreakdownItem = z.infer<typeof bookingPriceBreakdownItemSchema>;

export const bookingSchema = z.object({
  id: uuidSchema,
  courtId: uuidSchema,
  courtName: z.string().optional(),
  kind: bookingKindSchema,
  status: bookingStatusSchema,
  memberId: uuidSchema.nullable().optional(),
  memberName: z.string().nullable().optional(),
  guestName: z.string().nullable().optional(),
  guestPhone: z.string().nullable().optional(),
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  expiresAt: timestampAtSchema.nullable().optional(),
  channel: bookingChannelSchema,
  pricePaise: paiseSchema,
  priceBreakdown: z.array(bookingPriceBreakdownItemSchema).nullable().optional(),
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

export const socialSessionSchema = z.object({
  id: uuidSchema,
  courtId: uuidSchema,
  courtName: z.string().optional(),
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
  memberName: z.string().optional(),
  status: socialSignupStatusSchema,
  position: z.number().int(),
  invoiceId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type SocialSignup = z.infer<typeof socialSignupSchema>;

// Endpoint Schemas (prefix /api)

// 1. POST /api/bookings
export const createBookingRequestSchema = z.object({
  courtId: uuidSchema,
  startAt: timestampAtSchema,
  memberId: uuidSchema.optional(),
  guest: z
    .object({
      name: z.string().min(1),
      phone: z.string().min(5),
    })
    .optional(),
  channel: bookingChannelSchema.default('counter'),
});
export type CreateBookingRequest = z.infer<typeof createBookingRequestSchema>;

export const createBookingResponseSchema = z.object({
  booking: bookingSchema,
  invoiceId: uuidSchema.nullable().optional(),
});
export type CreateBookingResponse = z.infer<typeof createBookingResponseSchema>;

// 2. POST /api/bookings/:id/cancel
export const cancelBookingParamsSchema = z.object({ id: uuidSchema });
export const cancelBookingRequestSchema = z.object({
  reason: z.string().optional(),
  overrideRefundPct: z.number().int().min(0).max(100).optional(),
});
export const cancelBookingResponseSchema = z.object({
  bookingId: uuidSchema,
  status: bookingStatusSchema,
  refundPaise: paiseSchema,
  refundPercentage: z.number().int(),
});
export type CancelBookingResponse = z.infer<typeof cancelBookingResponseSchema>;

// 3. GET /api/bookings
export const getBookingsQuerySchema = paginationQuerySchema.extend({
  from: timestampAtSchema.optional(),
  to: timestampAtSchema.optional(),
  date: dateOnSchema.optional(),
  courtId: uuidSchema.optional(),
  memberId: uuidSchema.optional(),
  status: bookingStatusSchema.optional(),
});
export const getBookingsResponseSchema = paginatedResponseSchema(bookingSchema);

// 4. GET /api/bookings/:id
export const getBookingParamsSchema = z.object({ id: uuidSchema });
export const getBookingResponseSchema = bookingSchema;

// 5. POST /api/bookings/:id/no-show
export const markNoShowParamsSchema = z.object({ id: uuidSchema });
export const markNoShowResponseSchema = bookingSchema;

// 6. POST /api/bookings/:id/complete
export const completeBookingParamsSchema = z.object({ id: uuidSchema });
export const completeBookingResponseSchema = bookingSchema;

// 7. POST /api/bookings/blocks (maintenance block)
export const createBlockBookingRequestSchema = z.object({
  courtId: uuidSchema,
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  reason: z.string().min(1),
});
export const createBlockBookingResponseSchema = bookingSchema;

// 8. GET /api/social/sessions
export const getSocialSessionsQuerySchema = z.object({
  from: timestampAtSchema.optional(),
  to: timestampAtSchema.optional(),
  date: dateOnSchema.optional(),
});
export const getSocialSessionsResponseSchema = z.array(socialSessionSchema);

// 9. POST /api/social/sessions
export const createSocialSessionRequestSchema = z.object({
  courtId: uuidSchema,
  startAt: timestampAtSchema,
  endAt: timestampAtSchema,
  capacity: z.number().int().positive(),
  pricePerHeadPaise: paiseSchema,
  title: z.string().min(1),
});
export const createSocialSessionResponseSchema = socialSessionSchema;

// 10. POST /api/social/sessions/:id/signup
export const signupSocialSessionParamsSchema = z.object({ id: uuidSchema });
export const signupSocialSessionRequestSchema = z.object({
  memberId: uuidSchema,
});
export const signupSocialSessionResponseSchema = z.object({
  signup: socialSignupSchema,
  invoiceId: uuidSchema.nullable().optional(),
});

// 11. POST /api/social/sessions/:id/cancel-signup
export const cancelSocialSignupParamsSchema = z.object({ id: uuidSchema });
export const cancelSocialSignupRequestSchema = z.object({
  memberId: uuidSchema,
});
export const cancelSocialSignupResponseSchema = z.object({
  success: z.boolean(),
  promotedMemberId: uuidSchema.nullable().optional(),
});
