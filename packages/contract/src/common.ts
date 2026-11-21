// ALL: errors, pagination, money types. Frozen at hour 2.
import { z } from 'zod';

// Money: integer paise, column names end in _paise
export const paiseSchema = z.number().int();

// Basis points: 1800 = 18.00%
export const bpsSchema = z.number().int().min(0).max(10000);

// Standard UUID identifier
export const uuidSchema = z.string().uuid();

// Standard date format: YYYY-MM-DD
export const dateOnSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be in YYYY-MM-DD format');

// Standard datetime format: ISO 8601 string
export const timestampAtSchema = z.string().datetime();

// Pagination query parameters (?limit=50&cursor=...)
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// Standard paginated response shape ({ items, nextCursor })
export const paginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().nullable().optional(),
  });

// Error codes from section 3.3
export const errorCodeSchema = z.enum([
  'VALIDATION',          // 400
  'UNAUTHENTICATED',    // 401
  'FORBIDDEN',          // 403
  'NOT_FOUND',          // 404
  'SLOT_TAKEN',         // 409
  'OUT_OF_STOCK',       // 409
  'INVALID_STATE',      // 409
  'DAILY_LIMIT',        // 422
  'MEMBERSHIP_INACTIVE',// 422
  'OVERPAYMENT',        // 422
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

// Error response structure: { error: { code, message, details? } }
export const apiErrorSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.record(z.unknown()).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
