// Owner: Dev A. Frozen at hour 2.
import { z } from 'zod';
import { uuidSchema, timestampAtSchema } from './common.js';

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

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  user: sessionUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const meResponseSchema = z.object({
  user: sessionUserSchema,
  role: z.string(),
  permissions: z.array(z.string()),
  memberId: uuidSchema.nullable().optional(),
  activePlan: z.string().nullable().optional(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
