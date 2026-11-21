import type {
  Employee,
  WorkShift,
  SalaryComponent,
  LeaveBalance,
  LeaveRequest,
  Payslip,
} from '../hr.js';

export const fixtureEmployees: Employee[] = [
  {
    id: '40000000-0000-0000-0000-000000000001',
    name: 'Sunil Sharma',
    phone: '+919811223344',
    email: 'sunil@championsclub.in',
    roleTitle: 'Head Tennis Coach',
    joinedOn: '2025-01-15',
    active: true,
    userId: '00000000-0000-0000-0000-000000000004',
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: '40000000-0000-0000-0000-000000000002',
    name: 'Pooja Verma',
    phone: '+919822334455',
    email: 'pooja@championsclub.in',
    roleTitle: 'Front Desk Lead',
    joinedOn: '2025-03-01',
    active: true,
    userId: '00000000-0000-0000-0000-000000000005',
    createdAt: '2025-03-01T00:00:00Z',
  },
];

export const fixtureWorkShifts: WorkShift[] = [
  {
    id: '41000000-0000-0000-0000-000000000001',
    employeeId: '40000000-0000-0000-0000-000000000002',
    startsAt: '2026-11-21T06:00:00Z',
    endsAt: '2026-11-21T14:00:00Z',
    area: 'front_desk',
    createdAt: '2026-11-15T00:00:00Z',
  },
];

export const fixtureSalaryComponents: SalaryComponent[] = [
  {
    id: '42000000-0000-0000-0000-000000000001',
    employeeId: '40000000-0000-0000-0000-000000000001',
    name: 'Basic Salary',
    kind: 'earning',
    amountPaise: 5000000, // ₹50,000.00
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: '42000000-0000-0000-0000-000000000002',
    employeeId: '40000000-0000-0000-0000-000000000001',
    name: 'House Rent Allowance (HRA)',
    kind: 'earning',
    amountPaise: 2000000, // ₹20,000.00
    createdAt: '2025-01-15T00:00:00Z',
  },
  {
    id: '42000000-0000-0000-0000-000000000003',
    employeeId: '40000000-0000-0000-0000-000000000001',
    name: 'Provident Fund (Employee)',
    kind: 'deduction',
    amountPaise: 600000, // ₹6,000.00
    createdAt: '2025-01-15T00:00:00Z',
  },
];

export const fixtureLeaveBalances: LeaveBalance[] = [
  {
    employeeId: '40000000-0000-0000-0000-000000000001',
    leaveTypeId: '43000000-0000-0000-0000-000000000001',
    leaveTypeCode: 'CL',
    leaveTypeName: 'Casual Leave',
    year: 2026,
    allotted: 12,
    used: 4,
    remaining: 8,
  },
  {
    employeeId: '40000000-0000-0000-0000-000000000001',
    leaveTypeId: '43000000-0000-0000-0000-000000000002',
    leaveTypeCode: 'SL',
    leaveTypeName: 'Sick Leave',
    year: 2026,
    allotted: 10,
    used: 2,
    remaining: 8,
  },
];

export const fixtureLeaveRequest: LeaveRequest = {
  id: '44000000-0000-0000-0000-000000000001',
  employeeId: '40000000-0000-0000-0000-000000000001',
  leaveTypeId: '43000000-0000-0000-0000-000000000001',
  fromOn: '2026-11-25',
  toOn: '2026-11-26',
  days: 2,
  reason: 'Family function in hometown',
  status: 'pending',
  decidedBy: null,
  decidedAt: null,
  createdAt: '2026-11-21T09:00:00Z',
};

export const fixturePayslip: Payslip = {
  id: '45000000-0000-0000-0000-000000000001',
  employeeId: '40000000-0000-0000-0000-000000000001',
  employeeName: 'Sunil Sharma',
  monthOn: '2026-10-01',
  grossPaise: 7000000, // ₹70,000.00
  deductionsPaise: 600000, // ₹6,000.00
  netPaise: 6400000, // ₹64,000.00
  status: 'paid',
  paidAt: '2026-10-31T18:00:00Z',
  createdAt: '2026-10-31T10:00:00Z',
};
