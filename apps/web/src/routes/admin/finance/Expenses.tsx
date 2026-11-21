import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet,
  Plus,
  Check,
  X,
  Calendar,
  Tag,
  DollarSign,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api, ApiClientError } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { MoneyText } from '../../../components/shared/MoneyText';
import { DataTable, Column } from '../../../components/shared/DataTable';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../lib/toast';

export function Expenses() {
  const queryClient = useQueryClient();
  const { hasPermission, role } = useAuth();
  const { showToast } = useToast();

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  // Submit form state
  const [category, setCategory] = useState('Equipment & Maintenance');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState(5000);
  const [incurredOn, setIncurredOn] = useState(() => new Date().toISOString().slice(0, 10));

  const canApprove = role === 'owner' || hasPermission('expense:approve');

  // 1. Fetch expenses
  const {
    data: expensesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['expenses', statusFilter],
    queryFn: () => api.finance.getExpenses({ status: statusFilter || undefined, limit: 100 }),
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      return api.finance.createExpense({
        category,
        description: description.trim(),
        amountPaise: Math.round(amountRupees * 100),
        incurredOn,
      });
    },
    onSuccess: () => {
      showToast('success', 'Expense Submitted', 'Logged for approval.');
      setShowSubmitModal(false);
      setDescription('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Expense submission failed';
      showToast('error', 'Error', msg);
    },
  });

  // Decide mutation (approve/reject)
  const decideMutation = useMutation({
    mutationFn: async ({ id, approve }: { id: string; approve: boolean }) => {
      return api.finance.approveExpense(id, approve);
    },
    onSuccess: (_data, vars) => {
      showToast('success', vars.approve ? 'Expense Approved' : 'Expense Rejected', 'Updated status.');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['finance'] });
    },
    onError: (err: any) => {
      showToast('error', 'Decision Failed', err.message);
    },
  });

  const columns: Column<any>[] = [
    {
      key: 'incurredOn',
      header: 'Date',
      render: (row) => (
        <span className="text-mutedText">
          {new Date(row.incurredOn).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="font-semibold text-primaryText capitalize">{row.category}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (row) => <span className="text-primaryText">{row.description}</span>,
    },
    {
      key: 'amountPaise',
      header: 'Amount',
      render: (row) => (
        <span className="font-bold text-primaryText">
          <MoneyText paise={row.amountPaise} />
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        if (row.status !== 'submitted' || !canApprove) {
          return null;
        }
        return (
          <div className="flex items-center gap-1.5">
            <button
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: row.id, approve: true })}
              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
              title="Approve Expense"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              disabled={decideMutation.isPending}
              onClick={() => decideMutation.mutate({ id: row.id, approve: false })}
              className="p-1.5 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
              title="Reject Expense"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            Operating Expenses
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Track operational spending, equipment purchases, utility payments, and supervisor approvals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-2xl bg-canvas border border-border text-primaryText"
          >
            <option value="">All Statuses</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-2xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md transition-all"
          >
            <Plus className="w-4 h-4" /> Log Expense
          </button>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Loading club expenses ledger..." />
      ) : error ? (
        <ErrorState
          title="Could not load expenses"
          message={(error as any)?.message}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={expensesData?.items || []}
          searchKey="description"
          searchPlaceholder="Search expense description..."
          emptyTitle="No expenses found"
          emptyDescription="Operational expenses will be shown here."
        />
      )}

      {/* Submit Expense Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Submit Club Expense</h3>
            <p className="text-xs text-mutedText">
              Submit expenditure for approval. Approved expenses directly affect net profit calculations.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText font-semibold"
                >
                  <option value="Equipment & Maintenance">Equipment & Maintenance</option>
                  <option value="Court Maintenance">Court Maintenance</option>
                  <option value="Food & Beverage Supplies">Food & Beverage Supplies</option>
                  <option value="Utilities & Electricity">Utilities & Electricity</option>
                  <option value="Staff Uniforms & Welfare">Staff Uniforms & Welfare</option>
                  <option value="Marketing & Promotion">Marketing & Promotion</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. 5 boxes Wilson US Open tennis balls"
                  className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(Number(e.target.value))}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-mutedText block mb-1">Incurred Date</label>
                  <input
                    type="date"
                    value={incurredOn}
                    onChange={(e) => setIncurredOn(e.target.value)}
                    className="w-full p-2.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={submitMutation.isPending || !description.trim() || amountRupees <= 0}
                onClick={() => submitMutation.mutate()}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 disabled:opacity-40"
              >
                {submitMutation.isPending ? 'Submitting...' : 'Submit Expense'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
