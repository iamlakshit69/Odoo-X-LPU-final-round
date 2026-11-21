// Owner: Dev B – HR Module Service (Section 7.9)
import { randomUUID } from 'node:crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  employees,
  workShifts,
  salaryComponents,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  payslips,
} from '../../db/schema/hr.js';
import {
  Employee,
  WorkShift,
  SalaryComponent,
  LeaveBalance,
  LeaveRequest,
  Payslip,
  CreateEmployeeRequest,
  CreateWorkShiftRequest,
  CreateSalaryComponentRequest,
  CreateLeaveRequest,
  ShiftArea,
  SalaryComponentKind,
  LeaveRequestStatus,
  PayslipStatus,
} from '@club/contract';
import { AppError } from '../../core/errors.js';
import { Audit } from '../../core/audit.js';
import { Notifications } from '../../core/notifications.js';
import { Events } from '../../core/events.js';
import { users } from '../../db/schema/core.js';

export class HrService {
  // 1. Employees Management
  async listEmployees(query: { active?: boolean; limit?: number; cursor?: string }): Promise<{
    items: Employee[];
    nextCursor?: string | null;
  }> {
    const limit = query.limit ?? 50;
    const conds: any[] = [];
    if (query.active !== undefined) conds.push(eq(employees.active, query.active));

    const rows = await db
      .select()
      .from(employees)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(employees.name)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const list = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: list.map((e) => ({
        id: e.id,
        name: e.name,
        phone: e.phone,
        email: e.email,
        roleTitle: e.roleTitle,
        joinedOn: String(e.joinedOn),
        active: e.active,
        userId: e.userId ?? undefined,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
      nextCursor: hasMore ? list[list.length - 1].id : null,
    };
  }

  async createEmployee(input: CreateEmployeeRequest, actorUserId?: string): Promise<Employee> {
    const [e] = await db
      .insert(employees)
      .values({
        name: input.name,
        phone: input.phone,
        email: input.email,
        roleTitle: input.roleTitle,
        joinedOn: input.joinedOn,
        active: input.active ?? true,
        userId: input.userId ?? null,
      })
      .returning();

    // Initialize leave balances for default leave types
    const lTypes = await db.select().from(leaveTypes);
    const currentYear = new Date().getFullYear();
    for (const lt of lTypes) {
      await db
        .insert(leaveBalances)
        .values({
          employeeId: e.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allotted: lt.annualDays,
          used: 0,
        })
        .onConflictDoNothing();
    }

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'employee',
      recordId: e.id,
      after: e,
    });

    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      email: e.email,
      roleTitle: e.roleTitle,
      joinedOn: String(e.joinedOn),
      active: e.active,
      userId: e.userId ?? undefined,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  async getEmployee(id: string): Promise<Employee> {
    const [e] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!e) throw new AppError('NOT_FOUND', 'Employee not found', 404);

    return {
      id: e.id,
      name: e.name,
      phone: e.phone,
      email: e.email,
      roleTitle: e.roleTitle,
      joinedOn: String(e.joinedOn),
      active: e.active,
      userId: e.userId ?? undefined,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    };
  }

  async updateEmployee(id: string, input: Partial<CreateEmployeeRequest>, actorUserId?: string): Promise<Employee> {
    const [existing] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Employee not found', 404);

    const [updated] = await db
      .update(employees)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'employee',
      recordId: id,
      before: existing,
      after: updated,
    });

    return this.getEmployee(id);
  }

  async deleteEmployee(id: string, actorUserId?: string): Promise<{ success: boolean }> {
    const [existing] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Employee not found', 404);

    await db.delete(employees).where(eq(employees.id, id));

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'delete',
      resource: 'employee',
      recordId: id,
    });

    return { success: true };
  }

  // 2. Work Shifts
  async listWorkShifts(query: { employeeId?: string; from?: string; to?: string; area?: string }): Promise<WorkShift[]> {
    const conds: any[] = [];
    if (query.employeeId) conds.push(eq(workShifts.employeeId, query.employeeId));
    if (query.area) conds.push(eq(workShifts.area, query.area));

    const rows = await db
      .select()
      .from(workShifts)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(workShifts.startsAt);

    return rows.map((s) => ({
      id: s.id,
      employeeId: s.employeeId,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      area: s.area as ShiftArea,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async createWorkShift(input: CreateWorkShiftRequest, actorUserId?: string): Promise<WorkShift> {
    const [s] = await db
      .insert(workShifts)
      .values({
        employeeId: input.employeeId,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        area: input.area,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'work_shift',
      recordId: s.id,
      after: s,
    });

    return {
      id: s.id,
      employeeId: s.employeeId,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      area: s.area as ShiftArea,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async getWorkShift(id: string): Promise<WorkShift> {
    const [s] = await db.select().from(workShifts).where(eq(workShifts.id, id)).limit(1);
    if (!s) throw new AppError('NOT_FOUND', 'Work shift not found', 404);
    return {
      id: s.id,
      employeeId: s.employeeId,
      startsAt: s.startsAt.toISOString(),
      endsAt: s.endsAt.toISOString(),
      area: s.area as ShiftArea,
      createdAt: s.createdAt.toISOString(),
    };
  }

  async updateWorkShift(id: string, input: Partial<CreateWorkShiftRequest>, actorUserId?: string): Promise<WorkShift> {
    const [existing] = await db.select().from(workShifts).where(eq(workShifts.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Work shift not found', 404);

    const updateData: any = {};
    if (input.employeeId) updateData.employeeId = input.employeeId;
    if (input.startsAt) updateData.startsAt = new Date(input.startsAt);
    if (input.endsAt) updateData.endsAt = new Date(input.endsAt);
    if (input.area) updateData.area = input.area;
    updateData.updatedAt = new Date();

    const [updated] = await db.update(workShifts).set(updateData).where(eq(workShifts.id, id)).returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'work_shift',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      startsAt: updated.startsAt.toISOString(),
      endsAt: updated.endsAt.toISOString(),
      area: updated.area as ShiftArea,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteWorkShift(id: string, actorUserId?: string): Promise<{ success: boolean }> {
    const [existing] = await db.select().from(workShifts).where(eq(workShifts.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Work shift not found', 404);

    await db.delete(workShifts).where(eq(workShifts.id, id));

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'delete',
      resource: 'work_shift',
      recordId: id,
    });

    return { success: true };
  }

  // 3. Salary Components
  async listSalaryComponents(employeeId: string): Promise<SalaryComponent[]> {
    const rows = await db
      .select()
      .from(salaryComponents)
      .where(eq(salaryComponents.employeeId, employeeId));

    return rows.map((c) => ({
      id: c.id,
      employeeId: c.employeeId,
      name: c.name,
      kind: c.kind as SalaryComponentKind,
      amountPaise: c.amountPaise,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async createSalaryComponent(input: CreateSalaryComponentRequest, actorUserId?: string): Promise<SalaryComponent> {
    const [c] = await db
      .insert(salaryComponents)
      .values({
        employeeId: input.employeeId,
        name: input.name,
        kind: input.kind,
        amountPaise: input.amountPaise,
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'salary_component',
      recordId: c.id,
      after: c,
    });

    return {
      id: c.id,
      employeeId: c.employeeId,
      name: c.name,
      kind: c.kind as SalaryComponentKind,
      amountPaise: c.amountPaise,
      createdAt: c.createdAt.toISOString(),
    };
  }

  async updateSalaryComponent(id: string, input: Partial<CreateSalaryComponentRequest>, actorUserId?: string): Promise<SalaryComponent> {
    const [existing] = await db.select().from(salaryComponents).where(eq(salaryComponents.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Salary component not found', 404);

    const [updated] = await db
      .update(salaryComponents)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(salaryComponents.id, id))
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'update',
      resource: 'salary_component',
      recordId: id,
      before: existing,
      after: updated,
    });

    return {
      id: updated.id,
      employeeId: updated.employeeId,
      name: updated.name,
      kind: updated.kind as SalaryComponentKind,
      amountPaise: updated.amountPaise,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async deleteSalaryComponent(id: string, actorUserId?: string): Promise<{ success: boolean }> {
    const [existing] = await db.select().from(salaryComponents).where(eq(salaryComponents.id, id)).limit(1);
    if (!existing) throw new AppError('NOT_FOUND', 'Salary component not found', 404);

    await db.delete(salaryComponents).where(eq(salaryComponents.id, id));

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'delete',
      resource: 'salary_component',
      recordId: id,
    });

    return { success: true };
  }

  // 4. Leave Balances & Requests (Section 7.9 & Section 14 T12)
  async getLeaveBalances(employeeId: string): Promise<LeaveBalance[]> {
    const currentYear = new Date().getFullYear();
    const rows = await db
      .select({
        employeeId: leaveBalances.employeeId,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeCode: leaveTypes.code,
        leaveTypeName: leaveTypes.name,
        year: leaveBalances.year,
        allotted: leaveBalances.allotted,
        used: leaveBalances.used,
      })
      .from(leaveBalances)
      .innerJoin(leaveTypes, eq(leaveBalances.leaveTypeId, leaveTypes.id))
      .where(and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.year, currentYear)));

    return rows.map((r) => ({
      employeeId: r.employeeId,
      leaveTypeId: r.leaveTypeId,
      leaveTypeCode: r.leaveTypeCode,
      leaveTypeName: r.leaveTypeName,
      year: r.year,
      allotted: r.allotted,
      used: r.used,
      remaining: r.allotted - r.used,
    }));
  }

  async createLeaveRequest(input: CreateLeaveRequest, actorUserId?: string): Promise<LeaveRequest> {
    const fromYear = new Date(input.fromOn).getFullYear();

    // Calculate inclusive calendar days
    const fromTime = new Date(input.fromOn).getTime();
    const toTime = new Date(input.toOn).getTime();
    const calcDays = Math.max(1, Math.round((toTime - fromTime) / (1000 * 60 * 60 * 24)) + 1);
    const days = input.days && input.days > 0 ? input.days : calcDays;

    // Check balance
    const [bal] = await db
      .select()
      .from(leaveBalances)
      .where(
        and(
          eq(leaveBalances.employeeId, input.employeeId),
          eq(leaveBalances.leaveTypeId, input.leaveTypeId),
          eq(leaveBalances.year, fromYear)
        )
      )
      .limit(1);

    if (!bal) {
      throw new AppError('NOT_FOUND', 'Leave balance record not found for this year', 404);
    }

    const available = bal.allotted - bal.used;
    if (days > available) {
      throw new AppError(
        'VALIDATION',
        `Requested leave (${days} days) exceeds available balance (${available} days)`,
        400
      );
    }

    const [req] = await db
      .insert(leaveRequests)
      .values({
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        fromOn: input.fromOn,
        toOn: input.toOn,
        days,
        reason: input.reason ?? null,
        status: 'pending',
      })
      .returning();

    await Audit.log({
      actor: actorUserId ?? 'system',
      action: 'create',
      resource: 'leave_request',
      recordId: req.id,
      after: req,
    });

    return {
      id: req.id,
      employeeId: req.employeeId,
      leaveTypeId: req.leaveTypeId,
      fromOn: String(req.fromOn),
      toOn: String(req.toOn),
      days: req.days,
      reason: req.reason ?? undefined,
      status: req.status as LeaveRequestStatus,
      createdAt: req.createdAt.toISOString(),
    };
  }

  async decideLeaveRequest(id: string, approve: boolean, reasonOrNote?: string, actorUserId?: string): Promise<LeaveRequest> {
    return await db.transaction(async (tx) => {
      const [req] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, id)).for('update');
      if (!req) throw new AppError('NOT_FOUND', 'Leave request not found', 404);
      if (req.status !== 'pending') throw new AppError('INVALID_STATE', 'Leave request already decided', 409);

      const fromYear = new Date(req.fromOn).getFullYear();

      if (approve) {
        // Re-check balance under lock
        const [bal] = await tx
          .select()
          .from(leaveBalances)
          .where(
            and(
              eq(leaveBalances.employeeId, req.employeeId),
              eq(leaveBalances.leaveTypeId, req.leaveTypeId),
              eq(leaveBalances.year, fromYear)
            )
          )
          .for('update');

        if (!bal) throw new AppError('NOT_FOUND', 'Leave balance not found', 404);

        const available = bal.allotted - bal.used;
        if (req.days > available) {
          throw new AppError(
            'VALIDATION',
            `Cannot approve: requested leave (${req.days} days) exceeds available balance (${available} days)`,
            400
          );
        }

        // Deduct from balance
        await tx
          .update(leaveBalances)
          .set({ used: bal.used + req.days, updatedAt: new Date() })
          .where(
            and(
              eq(leaveBalances.employeeId, req.employeeId),
              eq(leaveBalances.leaveTypeId, req.leaveTypeId),
              eq(leaveBalances.year, fromYear)
            )
          );
      }

      const status: LeaveRequestStatus = approve ? 'approved' : 'rejected';
      const [updated] = await tx
        .update(leaveRequests)
        .set({
          status,
          decidedBy: actorUserId ?? null,
          decidedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leaveRequests.id, id))
        .returning();

      await Audit.log({
        actor: actorUserId ?? 'system',
        action: approve ? 'approve' : 'reject',
        resource: 'leave_request',
        recordId: id,
        after: updated,
      });

      // Send notification
      const [emp] = await tx.select().from(employees).where(eq(employees.id, req.employeeId)).limit(1);
      let notifyUserId = emp?.userId;
      if (!notifyUserId && emp?.email) {
        const [u] = await tx.select().from(users).where(eq(users.email, emp.email)).limit(1);
        if (u) notifyUserId = u.id;
      }
      if (notifyUserId) {
        await Notifications.send({
          to: { userId: notifyUserId },
          template: 'leave.decision',
          data: { status, dates: `${req.fromOn} to ${req.toOn}`, days: req.days, reason: reasonOrNote },
        });
      }

      return {
        id: updated.id,
        employeeId: updated.employeeId,
        leaveTypeId: updated.leaveTypeId,
        fromOn: String(updated.fromOn),
        toOn: String(updated.toOn),
        days: updated.days,
        reason: updated.reason ?? undefined,
        status: updated.status as LeaveRequestStatus,
        decidedBy: updated.decidedBy ?? undefined,
        decidedAt: updated.decidedAt ? updated.decidedAt.toISOString() : undefined,
        createdAt: updated.createdAt.toISOString(),
      };
    });
  }

  // 5. Payroll Run (Section 7.9)
  async runPayroll(monthOn: string, actorUserId?: string): Promise<{
    monthOn: string;
    payslipsCreated: number;
    totalGrossPaise: number;
    totalDeductionsPaise: number;
    totalNetPaise: number;
    payslips: Payslip[];
  }> {
    // Normalise month format to YYYY-MM-01
    const normalizedMonth = monthOn.length === 7 ? `${monthOn}-01` : monthOn;

    const res = await db.transaction(async (tx) => {
      // Check idempotency: if payslips already exist for this month, return them
      const existingSlips = await tx
        .select()
        .from(payslips)
        .where(eq(payslips.monthOn, normalizedMonth));

      if (existingSlips.length > 0) {
        let totalGross = 0;
        let totalDeductions = 0;
        let totalNet = 0;

        const mapped: Payslip[] = [];
        for (const s of existingSlips) {
          totalGross += s.grossPaise;
          totalDeductions += s.deductionsPaise;
          totalNet += s.netPaise;
          mapped.push({
            id: s.id,
            employeeId: s.employeeId,
            monthOn: String(s.monthOn),
            grossPaise: s.grossPaise,
            deductionsPaise: s.deductionsPaise,
            netPaise: s.netPaise,
            status: s.status as PayslipStatus,
            paidAt: s.paidAt ? s.paidAt.toISOString() : undefined,
            createdAt: s.createdAt.toISOString(),
          });
        }

        return {
          monthOn: normalizedMonth,
          payslipsCreated: 0,
          totalGrossPaise: totalGross,
          totalDeductionsPaise: totalDeductions,
          totalNetPaise: totalNet,
          payslips: mapped,
        };
      }

      // Generate payslips for all active employees
      const activeEmps = await tx.select().from(employees).where(eq(employees.active, true));

      const newSlips: any[] = [];
      let totalGross = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      for (const emp of activeEmps) {
        const comps = await tx
          .select()
          .from(salaryComponents)
          .where(eq(salaryComponents.employeeId, emp.id));

        const earnings = comps
          .filter((c) => c.kind === 'earning')
          .reduce((sum, c) => sum + c.amountPaise, 0);

        const deductions = comps
          .filter((c) => c.kind === 'deduction')
          .reduce((sum, c) => sum + c.amountPaise, 0);

        const net = Math.max(0, earnings - deductions);

        totalGross += earnings;
        totalDeductions += deductions;
        totalNet += net;

        newSlips.push({
          id: randomUUID(),
          employeeId: emp.id,
          monthOn: normalizedMonth,
          grossPaise: earnings,
          deductionsPaise: deductions,
          netPaise: net,
          status: 'draft',
        });
      }

      if (newSlips.length > 0) {
        await tx.insert(payslips).values(newSlips);
      }

      await Audit.log({
        actor: actorUserId ?? 'system',
        action: 'payroll_run',
        resource: 'payroll',
        recordId: normalizedMonth,
        after: { count: newSlips.length, totalNetPaise: totalNet },
      });

      return {
        monthOn: normalizedMonth,
        payslipsCreated: newSlips.length,
        totalGrossPaise: totalGross,
        totalDeductionsPaise: totalDeductions,
        totalNetPaise: totalNet,
        payslips: newSlips.map((s) => ({
          id: s.id,
          employeeId: s.employeeId,
          monthOn: s.monthOn,
          grossPaise: s.grossPaise,
          deductionsPaise: s.deductionsPaise,
          netPaise: s.netPaise,
          status: s.status as PayslipStatus,
          createdAt: new Date().toISOString(),
        })),
      };
    });

    Events.publish('dashboard.tick', { source: 'payroll', monthOn: normalizedMonth });
    return res;
  }

  async listPayslips(query: { monthOn?: string; month?: string; employeeId?: string }): Promise<Payslip[]> {
    const rawMonth = query.monthOn || query.month || new Date().toISOString().slice(0, 7);
    const normalizedMonth = rawMonth.length === 7 ? `${rawMonth}-01` : rawMonth;
    const conds: any[] = [eq(payslips.monthOn, normalizedMonth)];
    if (query.employeeId) conds.push(eq(payslips.employeeId, query.employeeId));

    const rows = await db
      .select({
        id: payslips.id,
        employeeId: payslips.employeeId,
        employeeName: employees.name,
        monthOn: payslips.monthOn,
        grossPaise: payslips.grossPaise,
        deductionsPaise: payslips.deductionsPaise,
        netPaise: payslips.netPaise,
        status: payslips.status,
        paidAt: payslips.paidAt,
        createdAt: payslips.createdAt,
      })
      .from(payslips)
      .innerJoin(employees, eq(payslips.employeeId, employees.id))
      .where(and(...conds))
      .orderBy(employees.name);

    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      monthOn: String(r.monthOn),
      grossPaise: r.grossPaise,
      deductionsPaise: r.deductionsPaise,
      netPaise: r.netPaise,
      status: r.status as PayslipStatus,
      paidAt: r.paidAt ? r.paidAt.toISOString() : undefined,
      createdAt: r.createdAt.toISOString(),
    }));
  }
}

export const Hr = new HrService();
