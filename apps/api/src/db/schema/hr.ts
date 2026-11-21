// Owner: Dev B – Phase 1: HR, Employees, Leave & Payroll Schema
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';

// Employees Table (Section 5.8)
export const employees = pgTable('employees', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  roleTitle: text('role_title').notNull(),
  joinedOn: date('joined_on').notNull(),
  active: boolean('active').notNull().default(true),
  userId: uuid('user_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Work Shifts (Staff Rota)
export const workShifts = pgTable('work_shifts', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  area: text('area').notNull(), // 'front_desk', 'bar', 'shop', 'courts'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Leave Types Table
export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // 'CL', 'SL', 'EL'
  name: text('name').notNull(),
  annualDays: integer('annual_days').notNull().default(12),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Leave Balances Table
export const leaveBalances = pgTable(
  'leave_balances',
  {
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    leaveTypeId: uuid('leave_type_id')
      .notNull()
      .references(() => leaveTypes.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    allotted: integer('allotted').notNull().default(0),
    used: integer('used').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.employeeId, table.leaveTypeId, table.year] }),
  })
);

// Leave Requests Table
export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  leaveTypeId: uuid('leave_type_id')
    .notNull()
    .references(() => leaveTypes.id),
  fromOn: date('from_on').notNull(),
  toOn: date('to_on').notNull(),
  days: integer('days').notNull(),
  reason: text('reason'),
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  decidedBy: uuid('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Salary Components Table
export const salaryComponents = pgTable('salary_components', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // 'Basic Salary', 'HRA', 'PF Deduction'
  kind: text('kind').notNull(), // 'earning', 'deduction'
  amountPaise: integer('amount_paise').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Payslips Table
export const payslips = pgTable('payslips', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: uuid('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  monthOn: date('month_on').notNull(), // '2026-10-01'
  grossPaise: integer('gross_paise').notNull(),
  deductionsPaise: integer('deductions_paise').notNull(),
  netPaise: integer('net_paise').notNull(),
  status: text('status').notNull().default('draft'), // 'draft', 'paid'
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
