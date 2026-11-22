import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Download,
  Calendar,
  AlertTriangle,
  Users,
  Info,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Layers,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../../../api/client';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { useToast } from '../../../lib/toast';

type RangeOption = 'today' | 'week' | 'month' | 'custom';

const COLORS = ['#F97316', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B'];

export function Dashboard() {
  const { showToast, showError } = useToast();
  const [range, setRange] = useState<RangeOption>('month');

  // Dates in club-local YYYY-MM-DD
  const today = new Date().toISOString().slice(0, 10);
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customTo, setCustomTo] = useState(today);

  const { from, to } = React.useMemo(() => {
    const now = new Date();
    if (range === 'today') {
      return { from: today, to: today };
    }
    if (range === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    if (range === 'month') {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { from: d.toISOString().slice(0, 10), to: today };
    }
    return { from: customFrom, to: customTo };
  }, [range, today, customFrom, customTo]);

  // 1. Finance summary
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['finance', 'summary', from, to],
    queryFn: () => api.finance.getSummary({ from, to }),
  });

  // 2. Receivables Aging
  const {
    data: receivables,
    isLoading: isRecLoading,
    error: recError,
  } = useQuery({
    queryKey: ['finance', 'receivables'],
    queryFn: () => api.finance.getReceivables(),
  });

  // 3. Low stock variants
  const { data: stockData } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => api.shop.getStock({ lowOnly: true }),
  });

  // 4. Expiring memberships
  const { data: membersData } = useQuery({
    queryKey: ['members', 'expiring'],
    queryFn: () => api.members.list({ limit: 50 }),
  });

  const lowStockItems = stockData?.items || [];
  const expiringMembers = (membersData?.items || []).filter((m: any) => {
    if (!m.endsOn) return false;
    const diffDays = Math.ceil(
      (new Date(m.endsOn).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= 0 && diffDays <= 30;
  });

  const handleExportCsv = () => {
    try {
      const url = `/api/finance/export?from=${from}&to=${to}`;
      const win = window.open(url, '_blank');
      if (!win) {
        showToast('warning', 'Pop-up Blocked', 'Please allow pop-ups to download the CSV report.');
      } else {
        showToast('info', 'Export Started', 'Financial ledger CSV report downloading.');
      }
    } catch (err: any) {
      showError(err, 'Failed to export CSV');
    }
  };

  if (isSummaryLoading && !summary) {
    return <LoadingState message="Calculating executive KPI summary..." />;
  }

  if (summaryError) {
    return (
      <ErrorState
        title="Could not load dashboard data"
        message={(summaryError as any)?.message}
        onRetry={() => refetchSummary()}
      />
    );
  }

  // Pre-process series for chart (scale paise to rupees for charts without losing accuracy in breakdown)
  const chartSeries = (summary?.series || []).map((s: any) => ({
    date: s.date,
    Charged: Math.round((s.charged || 0) / 100),
    Collected: Math.round((s.collected || 0) / 100),
    Expenses: Math.round((s.expenses || 0) / 100),
    Profit: Math.round((s.profit || 0) / 100),
  }));

  const bySourceData = (summary?.bySource || []).map((s: any) => ({
    name: s.source.toUpperCase(),
    value: Math.round(s.amountPaise / 100),
    paise: s.amountPaise,
  }));

  const byMethodData = (summary?.byMethod || []).map((m: any) => ({
    name: m.method.toUpperCase(),
    value: Math.round(m.amountPaise / 100),
    paise: m.amountPaise,
  }));

  return (
    <div className="space-y-6">
      {/* Header and Range Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-primaryText">
            Executive Owner Dashboard
          </h1>
          <p className="text-xs text-mutedText mt-1">
            Realtime revenue, cash collections, aging receivables and GST liability summary.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Range pills */}
          <div className="flex items-center p-1 rounded-2xl bg-canvas border border-border">
            {(['today', 'week', 'month', 'custom'] as RangeOption[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setRange(opt)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                  range === opt
                    ? 'bg-accent-orange text-white shadow-sm'
                    : 'text-mutedText hover:text-primaryText'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {range === 'custom' && (
            <div className="flex items-center gap-1.5 bg-canvas px-2.5 py-1 rounded-2xl border border-border text-xs">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="bg-transparent text-primaryText focus:outline-none"
              />
              <span className="text-mutedText">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="bg-transparent text-primaryText focus:outline-none"
              />
            </div>
          )}

          {/* Export CSV button */}
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-2xl bg-canvas border border-border text-primaryText hover:bg-surface shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 6 Bento KPI Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* 1. Charged */}
        <KpiTile
          label="Charged"
          amountPaise={summary?.charged ?? 0}
          definition="Sum of issued invoice totals."
          icon={<DollarSign className="w-4 h-4 text-blue-500" />}
          badge="Invoiced"
        />

        {/* 2. Collected */}
        <KpiTile
          label="Collected"
          amountPaise={summary?.collected ?? 0}
          definition="Sum of payments (refunds negative)."
          icon={<ArrowUpRight className="w-4 h-4 text-emerald-500" />}
          badge="Realized Cash"
        />

        {/* 3. Outstanding */}
        <KpiTile
          label="Outstanding"
          amountPaise={summary?.outstanding ?? 0}
          definition="Charged minus collected."
          icon={<Clock className="w-4 h-4 text-amber-500" />}
          badge="Receivables"
        />

        {/* 4. Expenses */}
        <KpiTile
          label="Expenses"
          amountPaise={summary?.expenses ?? 0}
          definition="Approved expenses for the period."
          icon={<ArrowDownRight className="w-4 h-4 text-red-500" />}
          badge="Operational"
        />

        {/* 5. Profit */}
        <KpiTile
          label="Profit"
          amountPaise={summary?.profit ?? 0}
          definition="Taxable revenue minus approved expenses minus payslips for the period."
          icon={<TrendingUp className="w-4 h-4 text-accent-orange" />}
          badge="Net Operational"
        />

        {/* 6. GST Collected */}
        <KpiTile
          label="GST Collected"
          amountPaise={summary?.gstCollected ?? 0}
          definition="CGST + SGST on issued invoices (what we owe the government)."
          icon={<Layers className="w-4 h-4 text-purple-500" />}
          badge="Tax Liability"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main timeline bar chart */}
        <div className="lg:col-span-2 p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primaryText">Revenue & Expense Trend</h3>
              <p className="text-[11px] text-mutedText">Daily breakdown over selected period (₹)</p>
            </div>
          </div>

          <div className="h-[280px] w-full pt-2">
            {chartSeries.length === 0 ? (
              <EmptyState title="No trend data" description="No transactions in selected window." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#888888" />
                  <YAxis tick={{ fontSize: 10 }} stroke="#888888" />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface, #1e293b)',
                      borderColor: 'var(--color-border, #334155)',
                      borderRadius: '12px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Charged" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Collected" fill="#10B981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Split by Payment Method */}
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-primaryText">Payment Methods</h3>
            <p className="text-[11px] text-mutedText">Share by tender type</p>
          </div>

          <div className="h-[200px] w-full">
            {byMethodData.length === 0 ? (
              <EmptyState title="No payments" description="No settlements recorded." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byMethodData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {byMethodData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(val: any) => [`₹${val}`, 'Amount']}
                    contentStyle={{
                      backgroundColor: 'var(--color-surface, #1e293b)',
                      borderColor: 'var(--color-border, #334155)',
                      borderRadius: '12px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60 text-xs">
            {byMethodData.map((m: any, idx: number) => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-mutedText">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  {m.name}
                </span>
                <span className="font-semibold text-primaryText">
                  <MoneyText paise={m.paise} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Receivables Aging and Revenue by Source */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receivables Aging Buckets */}
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-primaryText">Receivable Aging Buckets</h3>
              <p className="text-[11px] text-mutedText">Outstanding balances sorted by overdue maturity</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-mutedText block">Total Outstanding</span>
              <span className="font-black text-xs text-primaryText">
                <MoneyText paise={receivables?.totalOutstandingPaise ?? 0} />
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-canvas border border-border">
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                0-30 Days
              </span>
              <span className="text-sm font-black text-primaryText">
                <MoneyText paise={receivables?.bucket0_30Paise ?? 0} />
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-canvas border border-border">
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 block mb-1">
                31-60 Days
              </span>
              <span className="text-sm font-black text-primaryText">
                <MoneyText paise={receivables?.bucket31_60Paise ?? 0} />
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-canvas border border-border">
              <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block mb-1">
                61+ Days
              </span>
              <span className="text-sm font-black text-primaryText">
                <MoneyText paise={receivables?.bucket61PlusPaise ?? 0} />
              </span>
            </div>
          </div>

          {/* Business clients list */}
          <div className="space-y-2 pt-2">
            <h4 className="text-xs font-bold text-primaryText">Overdue Accounts</h4>
            {receivables?.clients?.length ? (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {receivables.clients.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-border text-xs"
                  >
                    <div>
                      <span className="font-semibold text-primaryText">{c.clientName}</span>
                      <span className="text-[10px] text-mutedText ml-2">Bucket: {c.bucket}</span>
                    </div>
                    <span className="font-bold text-primaryText">
                      <MoneyText paise={c.outstandingPaise} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-mutedText py-4 text-center">No overdue client accounts.</p>
            )}
          </div>
        </div>

        {/* Revenue Breakdown by Source */}
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-primaryText">Revenue by Source</h3>
            <p className="text-[11px] text-mutedText">Contribution across sports, membership, bar and shop</p>
          </div>

          <div className="space-y-3">
            {bySourceData.map((item: any, idx: number) => {
              const totalPaise = summary?.charged || 1;
              const pct = Math.round((item.paise / totalPaise) * 100);

              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-primaryText">{item.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-mutedText">{pct}%</span>
                      <span className="font-bold text-primaryText">
                        <MoneyText paise={item.paise} />
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 rounded-full bg-canvas border border-border overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: COLORS[idx % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Operational Watchlist Bento: Low Stock & Expiring Memberships */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-primaryText">Inventory Low-Stock Alerts</h3>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-mutedText">
              All warehouse stocks are above safety threshold.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lowStockItems.map((item: any) => (
                <div
                  key={item.variantId}
                  className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-border text-xs"
                >
                  <div>
                    <h5 className="font-semibold text-primaryText">{item.productName}</h5>
                    <span className="text-[10px] text-mutedText">{item.optionLabel}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                      {item.saleable} units left
                    </span>
                    <span className="text-[10px] text-mutedText block mt-0.5">
                      Threshold: {item.lowStockThreshold}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expiring Memberships */}
        <div className="p-6 rounded-3xl bg-surface border border-border shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent-orange" />
            <h3 className="text-sm font-bold text-primaryText">Upcoming Expiring Memberships</h3>
          </div>

          {expiringMembers.length === 0 ? (
            <div className="py-8 text-center text-xs text-mutedText">
              No active memberships expiring in the next 30 days.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {expiringMembers.map((m: any) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-canvas border border-border text-xs"
                >
                  <div>
                    <h5 className="font-semibold text-primaryText">{m.fullName}</h5>
                    <span className="text-[10px] text-mutedText">{m.memberCode} · Plan: {m.planCode}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Expires {m.endsOn}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  amountPaise,
  definition,
  icon,
  badge,
}: {
  label: string;
  amountPaise: number;
  definition: string;
  icon: React.ReactNode;
  badge: string;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative p-5 rounded-3xl bg-surface border border-border shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div>
        <div className="flex items-center justify-between gap-1 mb-2">
          <span className="text-xs font-semibold text-mutedText flex items-center gap-1.5">
            {icon} {label}
          </span>
          <div className="relative">
            <button
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              className="text-mutedText hover:text-primaryText"
              aria-label="Definition info"
            >
              <Info className="w-3.5 h-3.5" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 bottom-full mb-2 w-48 p-2 rounded-xl bg-primaryText text-canvas text-[10px] leading-tight shadow-xl z-50">
                {definition}
              </div>
            )}
          </div>
        </div>

        <div className="text-lg sm:text-xl font-black text-primaryText tracking-tight">
          <MoneyText paise={amountPaise} />
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-canvas text-mutedText border border-border/80">
          {badge}
        </span>
      </div>
    </div>
  );
}
