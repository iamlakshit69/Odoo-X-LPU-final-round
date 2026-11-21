// Owner: Dev B – HR, Employees, Leave & Payroll Seed (Section 14.2)
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/index.js';
import {
  employees,
  workShifts,
  leaveTypes,
  leaveBalances,
  leaveRequests,
  salaryComponents,
  payslips,
} from '../schema/hr.js';
import { users } from '../schema/core.js';

export async function seed() {
  console.log('[Seed:hr] Seeding 8 employees, salary components, leave balances, shifts, and payslips...');

  // 1. Leave Types (Section 5.8)
  const defaultLeaveTypes = [
    { code: 'CL', name: 'Casual Leave', annualDays: 12 },
    { code: 'SL', name: 'Sick Leave', annualDays: 10 },
    { code: 'EL', name: 'Earned / Privilege Leave', annualDays: 18 },
  ];

  const seededLeaveTypes: any[] = [];
  for (const lt of defaultLeaveTypes) {
    let [existing] = await db
      .select()
      .from(leaveTypes)
      .where(eq(leaveTypes.code, lt.code))
      .limit(1);

    if (!existing) {
      const [inserted] = await db.insert(leaveTypes).values(lt).returning();
      existing = inserted;
    }
    seededLeaveTypes.push(existing);
  }

  // 2. 8 Employees (Section 14.2)
  const existingUsers = await db.select().from(users);
  const userByRole = new Map<string, string>();
  for (const u of existingUsers) {
    userByRole.set(u.email, u.id);
  }

  const employeeData = [
    { name: 'Sunil Sharma', phone: '+919811223344', email: 'sunil@championsclub.in', roleTitle: 'Head Tennis Coach', joinedOn: '2024-01-15', userEmail: 'owner@championsclub.in' },
    { name: 'Pooja Verma', phone: '+919822334455', email: 'pooja@championsclub.in', roleTitle: 'Front Desk Lead', joinedOn: '2024-03-01', userEmail: 'frontdesk@championsclub.in' },
    { name: 'Manoj Kumar', phone: '+919833445566', email: 'manoj@championsclub.in', roleTitle: 'Pro Shop Manager', joinedOn: '2024-05-10', userEmail: 'shop@championsclub.in' },
    { name: 'Ajay Singh', phone: '+919844556677', email: 'ajay@championsclub.in', roleTitle: 'Senior Bartender', joinedOn: '2024-06-01', userEmail: 'bartender@championsclub.in' },
    { name: 'Chef Sanjeev', phone: '+919855667788', email: 'sanjeev@championsclub.in', roleTitle: 'Executive Chef', joinedOn: '2024-04-15', userEmail: 'kitchen@championsclub.in' },
    { name: 'Pooja Sharma', phone: '+919866778899', email: 'cashier@championsclub.in', roleTitle: 'Head Cashier', joinedOn: '2024-07-01', userEmail: 'cashier@championsclub.in' },
    { name: 'Vikram Rao', phone: '+919877889900', email: 'vikram@championsclub.in', roleTitle: 'Strength & Conditioning Coach', joinedOn: '2024-08-01' },
    { name: 'Suresh Patel', phone: '+919888990011', email: 'suresh@championsclub.in', roleTitle: 'Court Maintenance Lead', joinedOn: '2024-02-01' },
  ];

  const currentYear = new Date().getFullYear();
  const seededEmployees: any[] = [];

  for (const emp of employeeData) {
    const userId = emp.userEmail ? userByRole.get(emp.userEmail) : null;

    const [inserted] = await db
      .insert(employees)
      .values({
        name: emp.name,
        phone: emp.phone,
        email: emp.email,
        roleTitle: emp.roleTitle,
        joinedOn: emp.joinedOn,
        active: true,
        userId: userId ?? null,
      })
      .returning();

    seededEmployees.push(inserted);

    // 3. Auto-allocate Leave Balances for 2026
    for (const lt of seededLeaveTypes) {
      let used = 0;
      if (lt.code === 'CL') used = 3;
      if (lt.code === 'SL') used = 1;

      await db
        .insert(leaveBalances)
        .values({
          employeeId: inserted.id,
          leaveTypeId: lt.id,
          year: currentYear,
          allotted: lt.annualDays,
          used,
        })
        .onConflictDoNothing();
    }

    // 4. Salary Components per employee
    // Basic: ₹35,000 to ₹60,000, HRA: ₹15,000 to ₹25,000, PF: ₹4,200 to ₹7,200
    const basic = 4000000;
    const hra = 1600000;
    const pf = 480000;

    await db.insert(salaryComponents).values([
      { employeeId: inserted.id, name: 'Basic Salary', kind: 'earning', amountPaise: basic },
      { employeeId: inserted.id, name: 'House Rent Allowance (HRA)', kind: 'earning', amountPaise: hra },
      { employeeId: inserted.id, name: 'Provident Fund (Employee)', kind: 'deduction', amountPaise: pf },
    ]);
  }

  // 5. Work Shifts This Week (Spanning front_desk, bar, shop, courts)
  const now = new Date();
  const shiftAreas = ['front_desk', 'shop', 'bar', 'courts'];

  for (let i = 0; i < 7; i++) {
    const shiftDate = new Date(now.getTime() + (i - 3) * 24 * 60 * 60 * 1000);
    const morningStart = new Date(shiftDate);
    morningStart.setHours(6, 0, 0, 0);
    const morningEnd = new Date(shiftDate);
    morningEnd.setHours(14, 0, 0, 0);

    const eveningStart = new Date(shiftDate);
    eveningStart.setHours(14, 0, 0, 0);
    const eveningEnd = new Date(shiftDate);
    eveningEnd.setHours(22, 0, 0, 0);

    const empMorning = seededEmployees[i % seededEmployees.length];
    const empEvening = seededEmployees[(i + 1) % seededEmployees.length];
    const area = shiftAreas[i % shiftAreas.length];

    await db.insert(workShifts).values([
      { employeeId: empMorning.id, startsAt: morningStart, endsAt: morningEnd, area },
      { employeeId: empEvening.id, startsAt: eveningStart, endsAt: eveningEnd, area },
    ]);
  }

  // 6. 3 Pending Leave Requests (Section 14.2)
  const clType = seededLeaveTypes.find((lt) => lt.code === 'CL');
  const slType = seededLeaveTypes.find((lt) => lt.code === 'SL');

  if (clType && seededEmployees.length >= 3) {
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const nextWeekEnd = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await db.insert(leaveRequests).values([
      {
        employeeId: seededEmployees[0].id,
        leaveTypeId: clType.id,
        fromOn: nextWeek,
        toOn: nextWeekEnd,
        days: 2,
        reason: 'Attending family wedding ceremony',
        status: 'pending',
      },
      {
        employeeId: seededEmployees[1].id,
        leaveTypeId: slType?.id ?? clType.id,
        fromOn: nextWeek,
        toOn: nextWeek,
        days: 1,
        reason: 'Scheduled routine medical check-up',
        status: 'pending',
      },
      {
        employeeId: seededEmployees[2].id,
        leaveTypeId: clType.id,
        fromOn: nextWeekEnd,
        toOn: nextWeekEnd,
        days: 1,
        reason: 'Personal urgent appointment',
        status: 'pending',
      },
    ]);
  }

  // 7. Last Month's Payslips (Section 14.2)
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStr = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

  for (const emp of seededEmployees) {
    // Basic (40k) + HRA (16k) - PF (4.8k) => Gross: 56,000, Ded: 4,800, Net: 51,200
    await db.insert(payslips).values({
      employeeId: emp.id,
      monthOn: lastMonthStr,
      grossPaise: 5600000,
      deductionsPaise: 480000,
      netPaise: 5120000,
      status: 'paid',
      paidAt: new Date(prevMonthDate.getTime() + 28 * 24 * 60 * 60 * 1000),
    });
  }

  console.log('[Seed:hr] Employees, shifts, leave balances, requests, and payslips seeded successfully.');
}
