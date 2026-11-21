import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Calendar,
  Clock,
  Printer,
  Plus,
  Check,
  X,
  CreditCard,
  AlertCircle,
  FileText,
  UserCheck,
  Briefcase,
  ChevronRight,
} from 'lucide-react';
import { api, ApiClientError } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { MoneyText } from '../../../components/shared/MoneyText';
import { DataTable, Column } from '../../../components/shared/DataTable';
import { useToast } from '../../../lib/toast';

export function HrManagement() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'employees' | 'rota' | 'leaves' | 'payroll'>('employees');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // New Employee modal
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('+91');
  const [empEmail, setEmpEmail] = useState('');
  const [empRoleTitle, setEmpRoleTitle] = useState('Tennis Coach');
  const [empJoinedOn, setEmpJoinedOn] = useState(() => new Date().toISOString().slice(0, 10));

  // Leave Request modal
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveEmployeeId, setLeaveEmployeeId] = useState('');
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [leaveFrom, setLeaveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveTo, setLeaveTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveError, setLeaveError] = useState<string | null>(null);

  // Leave Decision modal
  const [showDecideModal, setShowDecideModal] = useState(false);
  const [decideRequestId, setDecideRequestId] = useState('');
  const [decideNote, setDecideNote] = useState('');

  // Payroll run
  const [payrollMonth, setPayrollMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);

  // 1. Fetch Employees
  const {
    data: employeesData,
    isLoading: isEmpLoading,
    error: empError,
    refetch: refetchEmployees,
  } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.hr.getEmployees({ limit: 100 }),
  });

  // 2. Fetch Shifts
  const {
    data: shiftsData,
    isLoading: isShiftsLoading,
    refetch: refetchShifts,
  } = useQuery({
    queryKey: ['work-shifts'],
    queryFn: () => api.hr.getWorkShifts(),
  });

  // 3. Fetch Payslips
  const {
    data: payslipsData,
    isLoading: isPayslipsLoading,
    refetch: refetchPayslips,
  } = useQuery({
    queryKey: ['payslips'],
    queryFn: () => api.hr.getPayslips(),
  });

  // 4. Leave balances for selected employee
  const { data: leaveBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['leave-balances', selectedEmployeeId],
    queryFn: () => (selectedEmployeeId ? api.hr.getLeaveBalances(selectedEmployeeId) : []),
    enabled: Boolean(selectedEmployeeId),
  });

  // 5. All pending leave requests
  const {
    data: leaveRequestsData,
    isLoading: isLeaveLoading,
    refetch: refetchLeaveRequests,
  } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => api.hr.getLeaveRequests(),
  });

  // Create Employee Mutation
  const createEmpMutation = useMutation({
    mutationFn: () =>
      api.hr.createEmployee({
        name: empName.trim(),
        phone: empPhone.trim(),
        email: empEmail.trim(),
        roleTitle: empRoleTitle.trim(),
        joinedOn: empJoinedOn,
      }),
    onSuccess: () => {
      showToast('success', 'Employee Created', 'Added to club staff roster with annual leave balances.');
      setShowAddEmpModal(false);
      setEmpName('');
      setEmpEmail('');
      refetchEmployees();
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message);
    },
  });

  // Submit Leave Request Mutation
  const submitLeaveMutation = useMutation({
    mutationFn: () =>
      api.hr.createLeaveRequest({
        employeeId: leaveEmployeeId,
        leaveTypeId,
        fromOn: leaveFrom,
        toOn: leaveTo,
        reason: leaveReason.trim() || undefined,
      }),
    onSuccess: (res) => {
      showToast('success', 'Leave Submitted', `Leave request #${res.id.slice(0, 8)} recorded as pending.`);
      setShowLeaveModal(false);
      setLeaveReason('');
      setLeaveError(null);
      if (selectedEmployeeId) refetchBalances();
      refetchLeaveRequests();
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Leave request failed';
      setLeaveError(msg);
      showToast('error', 'Balance Check Error', msg);
    },
  });

  // Decide Leave Mutation
  const decideLeaveMutation = useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      if (approve) {
        return api.hr.approveLeaveRequest(id, note);
      } else {
        return api.hr.rejectLeaveRequest(id, note || 'Rejected by supervisor');
      }
    },
    onSuccess: (_data, vars) => {
      showToast(
        'success',
        vars.approve ? 'Leave Request Approved' : 'Leave Request Rejected',
        'Staff leave balance updated.'
      );
      setShowDecideModal(false);
      setDecideRequestId('');
      setDecideNote('');
      if (selectedEmployeeId) refetchBalances();
      refetchLeaveRequests();
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Action failed';
      showToast('error', 'Balance Error', msg);
    },
  });

  // Run Payroll Mutation
  const runPayrollMutation = useMutation({
    mutationFn: () => api.hr.runPayroll(payrollMonth),
    onSuccess: (res) => {
      showToast(
        'success',
        'Payroll Completed',
        `Generated ${res.payslipsCreated} payslips for month ${res.monthOn}.`
      );
      refetchPayslips();
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (err: any) => {
      showToast('error', 'Payroll Error', err.message);
    },
  });

  const empColumns: Column<any>[] = [
    {
      key: 'name',
      header: 'Staff Member',
      render: (row) => (
        <div>
          <span className="font-bold text-primaryText block">{row.name}</span>
          <span className="text-[10px] text-mutedText">{row.email}</span>
        </div>
      ),
    },
    {
      key: 'roleTitle',
      header: 'Role / Designation',
      render: (row) => <span className="font-semibold text-primaryText">{row.roleTitle}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="text-mutedText">{row.phone}</span>,
    },
    {
      key: 'joinedOn',
      header: 'Joined Date',
      render: (row) => <span className="text-mutedText">{row.joinedOn}</span>,
    },
    {
      key: 'active',
      header: 'Status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            row.active
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-stone-500/10 text-stone-600'
          }`}
        >
          {row.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            HR, Staff Rota & Payroll
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Manage employee profiles, shift schedules, statutory leave quotas, and automated payroll runs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'employees' && (
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-2xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md"
            >
              <Plus className="w-4 h-4" /> Add Employee
            </button>
          )}

          {activeTab === 'payroll' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={payrollMonth}
                onChange={(e) => setPayrollMonth(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
              />
              <button
                disabled={runPayrollMutation.isPending}
                onClick={() => runPayrollMutation.mutate()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-md"
              >
                <CreditCard className="w-4 h-4" />
                {runPayrollMutation.isPending ? 'Running...' : 'Run Monthly Payroll'}
              </button>
            </div>
          )}

          {activeTab === 'leaves' && (
            <button
              onClick={() => {
                if (employeesData?.items?.[0]) {
                  setLeaveEmployeeId(employeesData.items[0].id);
                }
                setShowLeaveModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-2xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md"
            >
              <Plus className="w-4 h-4" /> Request Leave
            </button>
          )}
        </div>
      </div>

      {/* Area Tabs */}
      <div className="flex border-b border-border/80 px-2 gap-2">
        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'employees'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          <Users className="w-4 h-4" /> Employees & Leave
        </button>

        <button
          onClick={() => setActiveTab('rota')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'rota'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          <Calendar className="w-4 h-4" /> Shift Rota
        </button>

        <button
          onClick={() => setActiveTab('payroll')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'payroll'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Payroll & Payslips
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'leaves'
              ? 'border-accent-orange text-accent-orange'
              : 'border-transparent text-mutedText hover:text-primaryText'
          }`}
        >
          <Clock className="w-4 h-4" /> Leave Requests
          {(leaveRequestsData?.items?.filter((r: any) => r.status === 'pending').length ?? 0) > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-accent-orange text-white text-[9px] font-bold">
              {leaveRequestsData!.items.filter((r: any) => r.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Employees & Leave */}
      {activeTab === 'employees' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {isEmpLoading ? (
              <LoadingState message="Loading staff directory..." />
            ) : empError ? (
              <ErrorState title="Error" message={(empError as any)?.message} onRetry={() => refetchEmployees()} />
            ) : (
              <DataTable
                columns={empColumns}
                data={employeesData?.items || []}
                searchKey="name"
                searchPlaceholder="Search employee name..."
                onRowClick={(row) => setSelectedEmployeeId(row.id)}
                emptyTitle="No staff found"
                emptyDescription="Add staff members to maintain rotas and leave."
              />
            )}
          </div>

          {/* Leave Balances Sidebar */}
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4 h-fit">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primaryText">Leave Quotas & Balances</h3>
                <p className="text-[11px] text-mutedText">
                  {selectedEmployeeId ? 'Viewing selected employee' : 'Select an employee on the left'}
                </p>
              </div>

              {selectedEmployeeId && (
                <button
                  onClick={() => {
                    setLeaveEmployeeId(selectedEmployeeId);
                    if (leaveBalances?.length) {
                      setLeaveTypeId(leaveBalances[0].leaveTypeId);
                    }
                    setShowLeaveModal(true);
                  }}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
                >
                  Request Leave
                </button>
              )}
            </div>

            {selectedEmployeeId ? (
              leaveBalances?.length ? (
                <div className="space-y-3 pt-2">
                  {leaveBalances.map((b: any) => (
                    <div
                      key={b.leaveTypeId}
                      className="p-3.5 rounded-2xl bg-canvas border border-border space-y-1.5"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-primaryText">{b.leaveTypeName} ({b.leaveTypeCode})</span>
                        <span className="text-[11px] font-black text-accent-orange">
                          {b.remaining} days left
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-mutedText">
                        <span>Allotted: {b.allotted}</span>
                        <span>Used: {b.used}</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface border border-border overflow-hidden">
                        <div
                          className="h-full bg-accent-orange transition-all"
                          style={{
                            width: `${Math.min(100, Math.round((b.used / (b.allotted || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}

                  <div className="pt-2 border-t border-border/60">
                    <button
                      onClick={() => setShowDecideModal(true)}
                      className="w-full py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface text-center block"
                    >
                      Process Pending Leave Action
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-mutedText">
                  No leave quotas configured for this employee.
                </div>
              )
            ) : (
              <div className="py-12 text-center text-xs text-mutedText border border-dashed border-border/80 rounded-2xl">
                Click any employee in the roster to view their remaining leave balances.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Work Shift Rota */}
      {activeTab === 'rota' && (
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primaryText">Weekly Duty Schedule</h3>
              <p className="text-[11px] text-mutedText">
                Roster allocations across Front Desk, Lounge Bar, Pro Shop, and Courts
              </p>
            </div>
            <button
              onClick={() => refetchShifts()}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText"
            >
              Refresh
            </button>
          </div>

          {isShiftsLoading ? (
            <LoadingState message="Loading work shifts..." />
          ) : shiftsData?.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {['front_desk', 'bar', 'shop', 'courts'].map((area) => {
                const areaShifts = shiftsData.filter((s: any) => s.area === area);
                const title = area.replace('_', ' ').toUpperCase();

                return (
                  <div key={area} className="p-4 rounded-2xl bg-canvas border border-border space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="text-xs font-bold text-primaryText">{title}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface text-mutedText border border-border">
                        {areaShifts.length} Shifts
                      </span>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {areaShifts.map((s: any) => (
                        <div
                          key={s.id}
                          className="p-2.5 rounded-xl bg-surface border border-border text-xs space-y-1"
                        >
                          <span className="font-semibold text-primaryText block">
                            Staff: {s.employeeId.slice(0, 8)}
                          </span>
                          <div className="text-[10px] text-mutedText flex items-center gap-1">
                            <Clock className="w-3 h-3 text-accent-orange" />
                            {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                            {new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <span className="text-[9px] text-mutedText block">
                            {new Date(s.startsAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No shifts scheduled" description="Work shifts for this week will appear here." />
          )}
        </div>
      )}

      {/* Tab 3: Payroll & Payslips */}
      {activeTab === 'payroll' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-primaryText">Generated Staff Payslips</h3>
              <p className="text-[11px] text-mutedText">
                Monthly salary disbursements, allowances, statutory PF deductions, and printable payslips.
              </p>
            </div>

            {isPayslipsLoading ? (
              <LoadingState message="Loading payslips archive..." />
            ) : payslipsData?.length ? (
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Staff Name / ID</th>
                      <th className="px-3 py-2.5">Pay Month</th>
                      <th className="px-3 py-2.5 text-right">Gross Earnings</th>
                      <th className="px-3 py-2.5 text-right">Deductions</th>
                      <th className="px-4 py-2.5 text-right">Net Payable</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Payslip</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {payslipsData.map((slip: any) => (
                      <tr key={slip.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="px-4 py-2.5 font-bold text-primaryText">
                          {slip.employeeName || slip.employeeId.slice(0, 8)}
                        </td>
                        <td className="px-3 py-2.5 text-mutedText">{slip.monthOn}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-primaryText">
                          <MoneyText paise={slip.grossPaise} />
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-500">
                          <MoneyText paise={slip.deductionsPaise} />
                        </td>
                        <td className="px-4 py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                          <MoneyText paise={slip.netPaise} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={slip.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => setSelectedPayslip(slip)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-xl bg-canvas border border-border hover:bg-surface text-accent-orange"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No payslips generated"
                description="Run monthly payroll above to compute salary components and generate payslips."
              />
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Leave Requests */}
      {activeTab === 'leaves' && (
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-primaryText">Staff Leave Requests</h3>
                <p className="text-[11px] text-mutedText">
                  Review, approve, or reject employee leave applications against statutory leave quotas.
                </p>
              </div>
            </div>

            {isLeaveLoading ? (
              <LoadingState message="Loading leave applications..." />
            ) : leaveRequestsData?.items?.length ? (
              <div className="rounded-2xl border border-border overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Staff Member</th>
                      <th className="px-3 py-2.5">Leave Dates</th>
                      <th className="px-3 py-2.5 text-center">Days</th>
                      <th className="px-4 py-2.5">Reason</th>
                      <th className="px-3 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Decision / Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {leaveRequestsData.items.map((req: any) => {
                      const emp = employeesData?.items?.find((e: any) => e.id === req.employeeId);
                      return (
                        <tr key={req.id} className="hover:bg-canvas/50 transition-colors">
                          <td className="px-4 py-2.5">
                            <span className="font-bold text-primaryText block">
                              {emp ? emp.name : req.employeeId.slice(0, 8)}
                            </span>
                            <span className="text-[10px] text-mutedText">{emp?.roleTitle || 'Employee'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-mutedText whitespace-nowrap">
                            {req.fromOn} <span className="text-accent-orange">→</span> {req.toOn}
                          </td>
                          <td className="px-3 py-2.5 text-center font-bold text-primaryText">
                            {req.days} d
                          </td>
                          <td className="px-4 py-2.5 text-mutedText max-w-xs truncate">
                            {req.reason || 'No reason provided'}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <StatusBadge status={req.status} />
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            {req.status === 'pending' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  disabled={decideLeaveMutation.isPending}
                                  onClick={() =>
                                    decideLeaveMutation.mutate({
                                      id: req.id,
                                      approve: true,
                                      note: 'Approved',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                                >
                                  <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  disabled={decideLeaveMutation.isPending}
                                  onClick={() => {
                                    setDecideRequestId(req.id);
                                    setShowDecideModal(true);
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-mutedText">Decided</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No leave requests found"
                description="Staff leave applications will appear here for review."
              />
            )}
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Add Club Staff Member</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Full Name</label>
                <input
                  type="text"
                  value={empName}
                  onChange={(e) => setEmpName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Role Title</label>
                <input
                  type="text"
                  value={empRoleTitle}
                  onChange={(e) => setEmpRoleTitle(e.target.value)}
                  placeholder="e.g. Senior Tennis Coach"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Phone</label>
                  <input
                    type="text"
                    value={empPhone}
                    onChange={(e) => setEmpPhone(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Email</label>
                  <input
                    type="email"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Joined Date</label>
                <input
                  type="date"
                  value={empJoinedOn}
                  onChange={(e) => setEmpJoinedOn(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowAddEmpModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={createEmpMutation.isPending || !empName.trim() || !empEmail.trim()}
                onClick={() => createEmpMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 disabled:opacity-40"
              >
                {createEmpMutation.isPending ? 'Saving...' : 'Add Employee'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Request Staff Leave</h3>
            <p className="text-xs text-mutedText">
              Dates are evaluated inclusive of start and end calendar days against remaining balance.
            </p>

            {leaveError && (
              <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{leaveError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Leave Type</label>
                <select
                  value={leaveTypeId}
                  onChange={(e) => setLeaveTypeId(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText font-semibold"
                >
                  {leaveBalances?.map((b: any) => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.leaveTypeName} ({b.remaining} days available)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">From Date</label>
                  <input
                    type="date"
                    value={leaveFrom}
                    onChange={(e) => {
                      setLeaveFrom(e.target.value);
                      setLeaveError(null);
                    }}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">To Date</label>
                  <input
                    type="date"
                    value={leaveTo}
                    onChange={(e) => {
                      setLeaveTo(e.target.value);
                      setLeaveError(null);
                    }}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Reason / Note</label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="e.g. Attending family function"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={submitLeaveMutation.isPending || !leaveTypeId}
                onClick={() => submitLeaveMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90"
              >
                {submitLeaveMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decide Leave Action Modal */}
      {showDecideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Process Leave Decision</h3>
            <p className="text-xs text-mutedText">
              Enter the leave request ID to approve or reject. The server atomically re-verifies staff balance before confirming.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Leave Request ID</label>
                <input
                  type="text"
                  value={decideRequestId}
                  onChange={(e) => setDecideRequestId(e.target.value)}
                  placeholder="UUID of leave request"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Approval Note / Rejection Reason</label>
                <input
                  type="text"
                  value={decideNote}
                  onChange={(e) => setDecideNote(e.target.value)}
                  placeholder="Optional note for approval or required reason for rejection"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <button
                onClick={() => setShowDecideModal(false)}
                className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  disabled={decideLeaveMutation.isPending || !decideRequestId.trim()}
                  onClick={() => decideLeaveMutation.mutate({ id: decideRequestId.trim(), approve: false, note: decideNote })}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  disabled={decideLeaveMutation.isPending || !decideRequestId.trim()}
                  onClick={() => decideLeaveMutation.mutate({ id: decideRequestId.trim(), approve: true, note: decideNote })}
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Printable Payslip Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:p-0 print:bg-white animate-in fade-in">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-6 print:border-none print:shadow-none print:max-h-none print:p-0 print:text-black">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 print:hidden">
              <span className="text-xs font-bold text-primaryText">Employee Payslip</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() => setSelectedPayslip(null)}
                  className="p-1 rounded-full text-mutedText hover:text-primaryText"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Payslip Body */}
            <div>
              <div className="text-center border-b border-border/80 pb-4 mb-4">
                <span className="text-[10px] font-black tracking-widest text-accent-orange uppercase block">
                  CHAMPIONS CLUB INDIA
                </span>
                <h2 className="text-lg font-black text-primaryText">Salary Statement & Payslip</h2>
                <p className="text-xs text-mutedText mt-0.5">Pay Month: {selectedPayslip.monthOn}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                <div>
                  <span className="text-mutedText block">Employee:</span>
                  <span className="font-bold text-primaryText">
                    {selectedPayslip.employeeName || selectedPayslip.employeeId}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-mutedText block">Disbursement Status:</span>
                  <StatusBadge status={selectedPayslip.status} />
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-canvas border border-border space-y-2.5 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-mutedText">Gross Earnings (Basic + HRA + Allowances):</span>
                  <span className="font-bold text-primaryText">
                    <MoneyText paise={selectedPayslip.grossPaise} />
                  </span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Statutory Deductions (PF / Taxes):</span>
                  <span className="font-bold">
                    -<MoneyText paise={selectedPayslip.deductionsPaise} />
                  </span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-emerald-600 dark:text-emerald-400">
                  <span>Net Salary Payable:</span>
                  <MoneyText paise={selectedPayslip.netPaise} />
                </div>
              </div>

              <p className="text-[10px] text-mutedText text-center italic">
                Computer-generated payslip issued under Champions Club HR rules.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
