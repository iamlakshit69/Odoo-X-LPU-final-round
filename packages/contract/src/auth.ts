// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, timestampAtSchema } from './common.js';

// Section 6 & 8: Session User & RBAC
export const sessionUserSchema = z.object({
  id: uuidSchema,
  email: z.string().email(),
  name: z.string(),
  roleId: uuidSchema,
  roleCode: z.string(),
  memberId: uuidSchema.nullable().optional(),
  employeeId: uuidSchema.nullable().optional(),
  active: z.boolean(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export type Can = (
  user: SessionUser,
  permission: string,
  ctx?: { ownerMemberId?: string }
) => boolean;

// Endpoint Schemas (prefix /api)

// 1. POST /api/auth/login
export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  user: sessionUserSchema,
  message: z.string().optional(),
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

// 2. POST /api/auth/logout
export const logoutResponseSchema = z.object({
  success: z.boolean(),
});
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

// 3. GET /api/me
export const meResponseSchema = z.object({
  user: sessionUserSchema,
  role: z.string(),
  permissions: z.array(z.string()),
  memberId: uuidSchema.nullable().optional(),
  activePlan: z.string().nullable().optional(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
