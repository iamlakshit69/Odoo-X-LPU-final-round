// Owner: Dev B. Frozen at hour 2.
import { z } from 'zod';
import {
  uuidSchema,
  paiseSchema,
  dateOnSchema,
  timestampAtSchema,
  paginationQuerySchema,
  paginatedResponseSchema,
} from './common.js';

// Enums
export const shiftAreaSchema = z.enum(['front_desk', 'bar', 'shop', 'courts']);
export type ShiftArea = z.infer<typeof shiftAreaSchema>;

export const salaryComponentKindSchema = z.enum(['earning', 'deduction']);
export type SalaryComponentKind = z.infer<typeof salaryComponentKindSchema>;

export const leaveRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']);
export type LeaveRequestStatus = z.infer<typeof leaveRequestStatusSchema>;

export const payslipStatusSchema = z.enum(['draft', 'paid']);
export type PayslipStatus = z.infer<typeof payslipStatusSchema>;

// Models
export const employeeSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string(),
  email: z.string().email(),
  roleTitle: z.string(),
  joinedOn: dateOnSchema,
  active: z.boolean(),
  userId: uuidSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
  updatedAt: timestampAtSchema.optional(),
});
export type Employee = z.infer<typeof employeeSchema>;

export const workShiftSchema = z.object({
  id: uuidSchema,
  employeeId: uuidSchema,
  startsAt: timestampAtSchema,
  endsAt: timestampAtSchema,
  area: shiftAreaSchema,
  createdAt: timestampAtSchema.optional(),
});
export type WorkShift = z.infer<typeof workShiftSchema>;

export const salaryComponentSchema = z.object({
  id: uuidSchema,
  employeeId: uuidSchema,
  name: z.string(),
  kind: salaryComponentKindSchema,
  amountPaise: paiseSchema,
  createdAt: timestampAtSchema.optional(),
});
export type SalaryComponent = z.infer<typeof salaryComponentSchema>;

export const leaveTypeSchema = z.object({
  id: uuidSchema,
  code: z.string(),
  name: z.string(),
  annualDays: z.number().int().min(0),
});
export type LeaveType = z.infer<typeof leaveTypeSchema>;

export const leaveBalanceSchema = z.object({
  employeeId: uuidSchema,
  leaveTypeId: uuidSchema,
  leaveTypeCode: z.string(),
  leaveTypeName: z.string(),
  year: z.number().int(),
  allotted: z.number().int().min(0),
  used: z.number().int().min(0),
  remaining: z.number().int(),
});
export type LeaveBalance = z.infer<typeof leaveBalanceSchema>;

export const leaveRequestSchema = z.object({
  id: uuidSchema,
  employeeId: uuidSchema,
  leaveTypeId: uuidSchema,
  fromOn: dateOnSchema,
  toOn: dateOnSchema,
  days: z.number().int().positive(),
  reason: z.string().nullable().optional(),
  status: leaveRequestStatusSchema,
  decidedBy: uuidSchema.nullable().optional(),
  decidedAt: timestampAtSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type LeaveRequest = z.infer<typeof leaveRequestSchema>;

export const payslipSchema = z.object({
  id: uuidSchema,
  employeeId: uuidSchema,
  employeeName: z.string().optional(),
  monthOn: dateOnSchema,
  grossPaise: paiseSchema,
  deductionsPaise: paiseSchema,
  netPaise: paiseSchema,
  status: payslipStatusSchema,
  paidAt: timestampAtSchema.nullable().optional(),
  createdAt: timestampAtSchema.optional(),
});
export type Payslip = z.infer<typeof payslipSchema>;

// Endpoint Schemas

// 1. CRUD /employees
export const getEmployeesQuerySchema = paginationQuerySchema.extend({
  active: z.coerce.boolean().optional(),
});
export const getEmployeesResponseSchema = paginatedResponseSchema(employeeSchema);

export const createEmployeeRequestSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  roleTitle: z.string().min(1),
  joinedOn: dateOnSchema,
  active: z.boolean().default(true).optional(),
  userId: uuidSchema.optional(),
});
export const createEmployeeResponseSchema = employeeSchema;

export const updateEmployeeParamsSchema = z.object({ id: uuidSchema });
export const updateEmployeeRequestSchema = createEmployeeRequestSchema.partial();
export const updateEmployeeResponseSchema = employeeSchema;

// 2. CRUD /work-shifts
export const getWorkShiftsQuerySchema = z.object({
  employeeId: uuidSchema.optional(),
  from: timestampAtSchema.optional(),
  to: timestampAtSchema.optional(),
  area: shiftAreaSchema.optional(),
});
export const getWorkShiftsResponseSchema = z.array(workShiftSchema);

export const createWorkShiftRequestSchema = z.object({
  employeeId: uuidSchema,
  startsAt: timestampAtSchema,
  endsAt: timestampAtSchema,
  area: shiftAreaSchema,
});
export const createWorkShiftResponseSchema = workShiftSchema;

export const updateWorkShiftParamsSchema = z.object({ id: uuidSchema });
export const updateWorkShiftRequestSchema = createWorkShiftRequestSchema.partial();
export const updateWorkShiftResponseSchema = workShiftSchema;

export const deleteWorkShiftParamsSchema = z.object({ id: uuidSchema });
export const deleteWorkShiftResponseSchema = z.object({ success: z.boolean() });

// 3. CRUD /salary-components
export const getSalaryComponentsQuerySchema = z.object({
  employeeId: uuidSchema,
});
export const getSalaryComponentsResponseSchema = z.array(salaryComponentSchema);

export const createSalaryComponentRequestSchema = z.object({
  employeeId: uuidSchema,
  name: z.string().min(1),
  kind: salaryComponentKindSchema,
  amountPaise: paiseSchema,
});
export const createSalaryComponentResponseSchema = salaryComponentSchema;

export const updateSalaryComponentParamsSchema = z.object({ id: uuidSchema });
export const updateSalaryComponentRequestSchema = createSalaryComponentRequestSchema.omit({ employeeId: true }).partial();
export const updateSalaryComponentResponseSchema = salaryComponentSchema;

export const deleteSalaryComponentParamsSchema = z.object({ id: uuidSchema });
export const deleteSalaryComponentResponseSchema = z.object({ success: z.boolean() });

// 4. GET /leave/balances
export const getLeaveBalancesQuerySchema = z.object({
  employeeId: uuidSchema,
});
export const getLeaveBalancesResponseSchema = z.array(leaveBalanceSchema);

// 5. POST /leave/requests
export const createLeaveRequestSchema = z.object({
  employeeId: uuidSchema,
  leaveTypeId: uuidSchema,
  fromOn: dateOnSchema,
  toOn: dateOnSchema,
  days: z.number().int().positive().optional(),
  reason: z.string().optional(),
});
export const createLeaveRequestResponseSchema = leaveRequestSchema;

// 6. POST /leave/requests/:id/approve & reject
export const decideLeaveRequestParamsSchema = z.object({ id: uuidSchema });
export const approveLeaveRequestSchema = z.object({
  note: z.string().optional(),
});
export const rejectLeaveRequestSchema = z.object({
  reason: z.string().min(1),
});
export const decideLeaveRequestResponseSchema = leaveRequestSchema;

// 7. POST /payroll/run
export const runPayrollRequestSchema = z.object({
  monthOn: z.string().optional(),
  month: z.string().optional(),
});
export const runPayrollResponseSchema = z.object({
  monthOn: dateOnSchema,
  payslipsCreated: z.number().int().min(0),
  totalGrossPaise: paiseSchema,
  totalDeductionsPaise: paiseSchema,
  totalNetPaise: paiseSchema,
  payslips: z.array(payslipSchema),
});

// 8. GET /payslips
export const getPayslipsQuerySchema = z.object({
  monthOn: z.string().optional(),
  month: z.string().optional(),
  employeeId: uuidSchema.optional(),
});
export const getPayslipsResponseSchema = z.array(payslipSchema);

export type CreateEmployeeRequest = z.infer<typeof createEmployeeRequestSchema>;
export type UpdateEmployeeRequest = z.infer<typeof updateEmployeeRequestSchema>;
export type CreateWorkShiftRequest = z.infer<typeof createWorkShiftRequestSchema>;
export type CreateSalaryComponentRequest = z.infer<typeof createSalaryComponentRequestSchema>;
export type CreateLeaveRequest = z.infer<typeof createLeaveRequestSchema>;
