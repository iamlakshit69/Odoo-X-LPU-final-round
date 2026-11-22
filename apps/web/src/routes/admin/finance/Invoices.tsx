import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt,
  Search,
  Filter,
  DollarSign,
  Printer,
  CreditCard,
  Plus,
  CheckCircle2,
  X,
  FileText,
  Calendar,
  User,
  Download,
  Share2,
} from 'lucide-react';
import { api, ApiClientError } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { MoneyText } from '../../../components/shared/MoneyText';
import { DataTable, Column } from '../../../components/shared/DataTable';
import { useToast } from '../../../lib/toast';

export function Invoices() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // 1. Fetch Invoices list
  const {
    data: invoicesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => api.finance.getInvoices({ status: statusFilter || undefined, limit: 100 }),
  });

  const columns: Column<any>[] = [
    {
      key: 'number',
      header: 'Invoice #',
      render: (row) => (
        <span className="font-bold text-primaryText hover:text-accent-orange transition-colors">
          {row.number}
        </span>
      ),
    },
    {
      key: 'issuedAt',
      header: 'Issued Date',
      render: (row) => (
        <span className="text-mutedText">
          {new Date(row.issuedAt).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'customer',
      header: 'Customer / Recipient',
      render: (row) => (
        <span className="font-medium text-primaryText">
          {row.guestName || (row.memberId ? `Member ${row.memberId.slice(0, 8)}` : 'Walk-in Customer')}
        </span>
      ),
    },
    {
      key: 'totalPaise',
      header: 'Charged',
      render: (row) => (
        <span className="font-bold text-primaryText">
          <MoneyText paise={row.totalPaise} />
        </span>
      ),
    },
    {
      key: 'paidPaise',
      header: 'Paid',
      render: (row) => (
        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
          <MoneyText paise={row.paidPaise ?? 0} />
        </span>
      ),
    },
    {
      key: 'outstandingPaise',
      header: 'Outstanding',
      render: (row) => (
        <span
          className={`font-black ${
            (row.outstandingPaise ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-mutedText'
          }`}
        >
          <MoneyText paise={row.outstandingPaise ?? 0} />
        </span>
      ),
    },
    {
      key: 'balanceStatus',
      header: 'Status',
      render: (row) => <StatusBadge status={row.balanceStatus || row.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            Invoices & Settlements
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Browse tax invoices, verify line item GST distributions, and record manual payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs font-semibold rounded-2xl bg-canvas border border-border text-primaryText"
          >
            <option value="">All Statuses</option>
            <option value="issued">Issued</option>
            <option value="draft">Draft</option>
            <option value="void">Void</option>
          </select>

          <button
            onClick={() => {
              window.open('/api/finance/export', '_blank');
              showToast('success', 'Exporting Ledger', 'Financial report CSV download initiated.');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-2xl bg-canvas border border-border text-primaryText hover:bg-surface transition-colors"
            title="Download CSV report"
          >
            <Download className="w-3.5 h-3.5 text-accent-blue" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => {
              navigator.clipboard?.writeText(window.location.origin + '/admin/finance');
              showToast('success', 'Report Shared', 'Financial report link copied to clipboard.');
            }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-2xl bg-canvas border border-border text-primaryText hover:bg-surface transition-colors"
            title="Share report snapshot"
          >
            <Share2 className="w-3.5 h-3.5 text-accent-orange" />
            <span>Share</span>
          </button>

          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-xs font-bold rounded-2xl bg-canvas border border-border text-primaryText hover:bg-surface transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Main Table */}
      {isLoading ? (
        <LoadingState message="Fetching tax invoices..." />
      ) : error ? (
        <ErrorState
          title="Could not load invoices"
          message={(error as any)?.message}
          onRetry={() => refetch()}
        />
      ) : (
        <DataTable
          columns={columns}
          data={invoicesData?.items || []}
          searchKey="number"
          searchPlaceholder="Search invoice #..."
          onRowClick={(row) => setSelectedInvoiceId(row.id)}
          emptyTitle="No invoices found"
          emptyDescription="Transactions across shop, bar, courts and memberships will appear here."
        />
      )}

      {/* Invoice Detail Sheet / Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onPaymentRecorded={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['finance'] });
          }}
        />
      )}
    </div>
  );
}

function InvoiceDetailModal({
  invoiceId,
  onClose,
  onPaymentRecorded,
}: {
  invoiceId: string;
  onClose: () => void;
  onPaymentRecorded: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payMethod, setPayMethod] = useState<'cash' | 'card' | 'upi' | 'comp'>('upi');
  const [payAmountRupees, setPayAmountRupees] = useState<number>(0);
  const [payRef, setPayRef] = useState('');

  // Fetch invoice details
  const {
    data: invoice,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.invoices.get(invoiceId),
  });

  React.useEffect(() => {
    if (invoice?.outstandingPaise) {
      setPayAmountRupees(Math.round(invoice.outstandingPaise / 100));
    }
  }, [invoice]);

  // Payment mutation
  const payMutation = useMutation({
    mutationFn: async () => {
      return api.invoices.recordPayment(invoiceId, {
        method: payMethod,
        amountPaise: Math.round(payAmountRupees * 100),
        reference: payRef.trim() || undefined,
      });
    },
    onSuccess: () => {
      showToast('success', 'Payment Recorded', 'Invoice balance updated.');
      setShowPaymentForm(false);
      refetch();
      onPaymentRecorded();
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Payment recording failed';
      showToast('error', 'Payment Error', msg);
    },
  });

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-3xl p-8 rounded-3xl bg-surface border border-border">
          <LoadingState message="Loading invoice line items and tax breakdown..." />
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <div className="w-full max-w-md p-6 rounded-3xl bg-surface border border-border">
          <ErrorState title="Invoice not found" onRetry={() => refetch()} />
          <button
            onClick={onClose}
            className="mt-4 w-full py-2 text-xs font-semibold rounded-xl bg-canvas border border-border"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white animate-in fade-in">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8 rounded-3xl bg-surface border border-border shadow-2xl space-y-6 print:border-none print:shadow-none print:max-h-none print:p-0 print:text-black">
        {/* Modal Top Actions (hidden during print) */}
        <div className="flex items-center justify-between border-b border-border/80 pb-4 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-accent-orange" />
            <h2 className="text-base font-bold text-primaryText">Tax Invoice Details</h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface"
            >
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-canvas text-mutedText hover:text-primaryText"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <span className="text-xs font-black tracking-widest text-accent-orange uppercase block mb-1">
              CHAMPIONS CLUB
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-primaryText">{invoice.number}</h1>
            <p className="text-xs text-mutedText mt-0.5">
              Issued: {new Date(invoice.issuedAt).toLocaleDateString()}
            </p>
          </div>

          <div className="sm:text-right">
            <StatusBadge status={invoice.balanceStatus || invoice.status} />
            <div className="text-xs text-mutedText mt-2 space-y-0.5">
              <p>Customer: {invoice.guestName || (invoice.memberId ? `Member ${invoice.memberId.slice(0, 8)}` : 'Walk-in')}</p>
              {invoice.dueOn && <p>Due Date: {invoice.dueOn}</p>}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-canvas border-b border-border text-mutedText uppercase font-semibold">
              <tr>
                <th className="px-4 py-2.5">Item Description</th>
                <th className="px-3 py-2.5 text-center">Qty</th>
                <th className="px-3 py-2.5 text-right">Unit Price</th>
                <th className="px-3 py-2.5 text-right">Taxable</th>
                <th className="px-3 py-2.5 text-right">CGST</th>
                <th className="px-3 py-2.5 text-right">SGST</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {invoice.lines?.map((line: any) => (
                <tr key={line.id}>
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-primaryText block">{line.description}</span>
                    <span className="text-[10px] text-mutedText uppercase font-medium tracking-wider">
                      Source: {line.source}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-primaryText">{line.qty}</td>
                  <td className="px-3 py-2.5 text-right text-primaryText">
                    <MoneyText paise={line.unitPricePaise} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-primaryText">
                    <MoneyText paise={line.taxablePaise} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-mutedText">
                    <MoneyText paise={line.cgstPaise} />
                  </td>
                  <td className="px-3 py-2.5 text-right text-mutedText">
                    <MoneyText paise={line.sgstPaise} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold text-primaryText">
                    <MoneyText paise={line.totalPaise} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* GST & Totals Summary Card */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 pt-2">
          {/* Payments list */}
          <div className="flex-1 space-y-2">
            <h4 className="text-xs font-bold text-primaryText">Payments History</h4>
            {invoice.payments?.length ? (
              <div className="space-y-1.5">
                {invoice.payments.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-canvas border border-border text-xs"
                  >
                    <div>
                      <span className="font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        {p.method}
                      </span>
                      <span className="text-[10px] text-mutedText ml-2">
                        {new Date(p.receivedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="font-bold text-primaryText">
                      <MoneyText paise={p.amountPaise} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mutedText">No payments recorded against this invoice yet.</p>
            )}
          </div>

          {/* Breakdown summary */}
          <div className="w-full sm:w-72 p-4 rounded-2xl bg-canvas border border-border space-y-2 text-xs">
            <div className="flex justify-between text-mutedText">
              <span>Subtotal Taxable:</span>
              <MoneyText paise={invoice.subtotalPaise} />
            </div>
            <div className="flex justify-between text-mutedText">
              <span>CGST (Intra-state):</span>
              <MoneyText paise={invoice.cgstPaise} />
            </div>
            <div className="flex justify-between text-mutedText">
              <span>SGST (Intra-state):</span>
              <MoneyText paise={invoice.sgstPaise} />
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-primaryText">
              <span>Total Charged:</span>
              <MoneyText paise={invoice.totalPaise} />
            </div>
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
              <span>Paid to Date:</span>
              <MoneyText paise={invoice.paidPaise ?? 0} />
            </div>
            <div className="border-t border-border/80 pt-2 flex justify-between font-black text-sm text-amber-600 dark:text-amber-400">
              <span>Outstanding:</span>
              <MoneyText paise={invoice.outstandingPaise ?? 0} />
            </div>
          </div>
        </div>

        {/* Action button to record payment */}
        {(invoice.outstandingPaise ?? 0) > 0 && !showPaymentForm && (
          <div className="flex justify-end pt-2 print:hidden">
            <button
              onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md"
            >
              <CreditCard className="w-4 h-4" /> Record Payment
            </button>
          </div>
        )}

        {/* Payment Record Form */}
        {showPaymentForm && (
          <div className="p-4 rounded-2xl bg-surface border border-accent-orange/60 shadow-md space-y-3 print:hidden">
            <h4 className="text-xs font-bold text-primaryText">Record Invoice Payment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-mutedText block mb-1">Tender Method</label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as any)}
                  className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText font-semibold uppercase"
                >
                  <option value="upi">UPI</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="comp">Complimentary</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={payAmountRupees}
                  onChange={(e) => setPayAmountRupees(Number(e.target.value))}
                  className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] text-mutedText block mb-1">Txn / Bank Ref (Optional)</label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="e.g. UPI-998822"
                  className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowPaymentForm(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={payMutation.isPending || payAmountRupees <= 0}
                onClick={() => payMutation.mutate()}
                className="px-4 py-1.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                {payMutation.isPending ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
