import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatPaise, getTodayDateString, formatDate, formatTime } from '../../../lib/utils';
import type { BarTable, MenuItem, Tab, TabItem, ZReport } from '@club/contract';
import {
  Coffee,
  Utensils,
  AlertTriangle,
  Plus,
  Trash2,
  DollarSign,
  FileSpreadsheet,
  Download,
  CreditCard,
  Receipt,
  X,
  Clock,
  CheckCircle,
  RotateCw,
} from 'lucide-react';

export function BarConsole() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<BarTable | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'food' | 'drink'>('all');

  // Void modal state
  const [voidItem, setVoidItem] = useState<TabItem | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Split-tender settlement state
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState<number>(0);
  const [cardAmount, setCardAmount] = useState<number>(0);
  const [upiAmount, setUpiAmount] = useState<number>(0);

  // Till state
  const [tillModalOpen, setTillModalOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState<number>(5000); // in Rupees (₹5,000)
  const [countedCash, setCountedCash] = useState<number>(5000);
  const [tillVariance, setTillVariance] = useState<number | null>(null);

  // Z-Report state
  const [zReportOpen, setZReportOpen] = useState(false);
  const [reportDate, setReportDate] = useState<string>(getTodayDateString());

  // Fetch tables
  const { data: tables = [], isLoading: isLoadingTables } = useQuery<BarTable[]>({
    queryKey: ['tables'],
    queryFn: () => api.bar.getTables(),
    refetchInterval: 10000,
  });

  // Fetch menu
  const { data: menu = [] } = useQuery<MenuItem[]>({
    queryKey: ['menu', categoryFilter],
    queryFn: () =>
      api.bar.getMenu({
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      }),
  });

  // Fetch active tab
  const { data: activeTab, isLoading: isLoadingTab } = useQuery<Tab>({
    queryKey: ['tab', activeTabId],
    queryFn: () => api.bar.getTab(activeTabId!),
    enabled: !!activeTabId,
    refetchInterval: 5000,
  });

  // Fetch Z-Report
  const { data: zReport } = useQuery<ZReport>({
    queryKey: ['z-report', reportDate],
    queryFn: () => api.bar.getZReport(reportDate),
    enabled: zReportOpen,
  });

  // Create new tab on table
  const createTabMutation = useMutation({
    mutationFn: (table: BarTable) =>
      api.bar.createTab({
        tableId: table.id,
        guestLabel: `${table.label} Guests`,
      }),
    onSuccess: (tab) => {
      setActiveTabId(tab.id);
      showToast('success', 'Tab Opened', `Tab created on ${selectedTable?.label}.`);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (err) => {
      showError(err, 'Failed to open tab.');
    },
  });

  // Add item to tab mutation
  const addItemMutation = useMutation({
    mutationFn: (menuItem: MenuItem) => {
      if (!activeTabId) throw new Error('No active tab');
      return api.bar.addTabItem(activeTabId, {
        menuItemId: menuItem.id,
        qty: 1,
      });
    },
    onSuccess: (item) => {
      showToast('info', 'Item Added', `Added ${item.menuItemName || 'Item'}.`);
      queryClient.invalidateQueries({ queryKey: ['tab', activeTabId] });
      queryClient.invalidateQueries({ queryKey: ['kds'] });
    },
    onError: (err) => {
      showError(err, 'Could not add item.');
    },
  });

  // Void item mutation
  const voidItemMutation = useMutation({
    mutationFn: () => {
      if (!voidItem || !voidReason.trim()) throw new Error('Void reason is required');
      return api.bar.voidTabItem(voidItem.id, voidReason);
    },
    onSuccess: () => {
      showToast('warning', 'Item Voided', 'Void recorded and order cancelled in kitchen.');
      setVoidItem(null);
      setVoidReason('');
      queryClient.invalidateQueries({ queryKey: ['tab', activeTabId] });
      queryClient.invalidateQueries({ queryKey: ['kds'] });
    },
    onError: (err) => {
      showError(err, 'Could not void item.');
    },
  });

  // Split-tender settle calculation
  const tabSubtotal = activeTab?.subtotalPaise || 0;
  const totalTendered = cashAmount + cardAmount + upiAmount;
  const isOverpaid = totalTendered > tabSubtotal;
  const isExactOrRemaining = tabSubtotal - totalTendered;

  // Settle tab mutation
  const settleTabMutation = useMutation({
    mutationFn: () => {
      if (!activeTabId) throw new Error('No active tab');
      if (isOverpaid) throw new Error('OVERPAYMENT: Tender exceeds tab total');
      const payments: Array<{ method: string; amountPaise: number }> = [];
      if (cashAmount > 0) payments.push({ method: 'cash', amountPaise: cashAmount });
      if (cardAmount > 0) payments.push({ method: 'card', amountPaise: cardAmount });
      if (upiAmount > 0) payments.push({ method: 'upi', amountPaise: upiAmount });

      return api.bar.settleTab(activeTabId, { payments });
    },
    onSuccess: () => {
      showToast('success', 'Tab Settled', 'Split payment captured and invoice generated.');
      setSettleModalOpen(false);
      setActiveTabId(null);
      setSelectedTable(null);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
    },
    onError: (err) => {
      showError(err, 'Failed to settle tab.');
    },
  });

  // Open till mutation
  const openTillMutation = useMutation({
    mutationFn: () => api.bar.openTill({ openingFloatPaise: Math.round(openingFloat * 100) }),
    onSuccess: () => {
      showToast('success', 'Till Opened', 'Daily cash drawer session initialized.');
      setTillModalOpen(false);
    },
    onError: (err) => showError(err, 'Failed to open till.'),
  });

  // Close till mutation
  const closeTillMutation = useMutation({
    mutationFn: () =>
      api.bar.closeTill({
        tillSessionId: 'latest', // handled by backend
        countedCashPaise: Math.round(countedCash * 100),
      }),
    onSuccess: (session) => {
      setTillVariance(session.variancePaise ?? 0);
      showToast('info', 'Till Closed', `Variance: ₹${(session.variancePaise ?? 0) / 100}`);
    },
    onError: (err) => showError(err, 'Failed to close till.'),
  });

  // CSV download of Z-Report
  const downloadZReportCsv = () => {
    if (!zReport) return;
    const lines = [
      'Z-Report Date,' + zReport.date,
      'Total Sales (Paise),' + zReport.totalSalesPaise,
      'Discounts (Paise),' + zReport.discountsPaise,
      'Tax (Paise),' + zReport.taxPaise,
      'Voids Count,' + zReport.voidsCount,
      'Voids (Paise),' + zReport.voidsPaise,
      '',
      'Tender,Amount (Paise)',
      ...zReport.salesByTender.map((t) => `${t.method},${t.amountPaise}`),
      '',
      'Category,Amount (Paise)',
      ...zReport.salesByCategory.map((c) => `${c.category},${c.amountPaise}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `z-report-${zReport.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Console Bar */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
            Hospitality POS
          </span>
          <h1 className="text-2xl font-black text-primaryText">Bar & Lounge Floor</h1>
          <p className="text-xs text-mutedText mt-0.5">
            Table management, open tabs, KDS dispatch, till reconciliation, and Z-reports.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTillModalOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-canvas text-xs font-bold text-primaryText flex items-center gap-1.5"
          >
            <DollarSign className="w-4 h-4 text-emerald-500" />
            <span>Till Session</span>
          </button>

          <button
            onClick={() => setZReportOpen(true)}
            className="px-3.5 py-1.5 rounded-xl border border-border hover:bg-canvas text-xs font-bold text-primaryText flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            <span>Z-Report</span>
          </button>
        </div>
      </div>

      {/* Table Floor Plan Grid */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-mutedText">
            Floor Plan & Table Occupancy
          </span>
          <span className="text-[11px] text-mutedText">
            Click table to view/open tab
          </span>
        </div>

        {isLoadingTables ? (
          <LoadingState message="Loading floor plan tables..." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {tables.map((t) => {
              const isOccupied = !!t.activeTabId;
              const isAlert = t.isOccupiedTooLong;
              const isSelected = selectedTable?.id === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTable(t);
                    if (t.activeTabId) {
                      setActiveTabId(t.activeTabId);
                    } else {
                      setActiveTabId(null);
                    }
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer text-center space-y-2 ${
                    isAlert
                      ? 'border-red-500 bg-red-500/10 ring-2 ring-red-500/30'
                      : isSelected
                      ? 'border-accent-orange bg-surface ring-2 ring-accent-orange shadow-md'
                      : isOccupied
                      ? 'border-amber-500/40 bg-amber-500/10'
                      : 'border-border bg-canvas hover:border-border/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-primaryText">{t.label}</span>
                    <span className="text-[10px] text-mutedText">{t.seats}P</span>
                  </div>

                  <div className="py-2">
                    {isAlert ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-red-500">
                        <AlertTriangle className="w-3 h-3" /> Over 90m
                      </span>
                    ) : isOccupied ? (
                      <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                        Occupied
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                        Available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Split: Menu Grid + Active Tab Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Tablet-Friendly Menu Grid (2 Cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-mutedText">
              Menu Items
            </span>

            <div className="flex items-center gap-2">
              {(['all', 'food', 'drink'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                    categoryFilter === cat
                      ? 'bg-accent-orange text-white shadow-sm'
                      : 'bg-surface border border-border text-mutedText hover:text-primaryText'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {menu.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!activeTabId}
                onClick={() => addItemMutation.mutate(item)}
                className="p-4 rounded-2xl border border-border bg-surface hover:border-accent-orange/60 hover:shadow-md disabled:opacity-40 text-left transition-all flex flex-col justify-between min-h-[105px] group"
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase font-bold text-mutedText">
                    <span>{item.category}</span>
                    <span className="px-1.5 py-0.5 rounded bg-canvas border border-border">
                      {item.station}
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-primaryText mt-1 group-hover:text-accent-orange transition-colors">
                    {item.name}
                  </h4>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <MoneyText paise={item.pricePaise} className="font-bold text-xs" />
                  <span className="text-[10px] font-bold text-accent-orange opacity-0 group-hover:opacity-100 transition-opacity">
                    + Add
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Active Tab Screen */}
        <div className="lg:col-span-1">
          <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-4 sticky top-24">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-orange">
                  Active Bill
                </span>
                <h3 className="text-lg font-black text-primaryText">
                  {selectedTable ? selectedTable.label : 'Select a Table'}
                </h3>
              </div>
              {activeTab && <StatusBadge status={activeTab.status} />}
            </div>

            {!activeTabId && selectedTable ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-xs text-mutedText">No open tab on {selectedTable.label}.</p>
                <button
                  onClick={() => createTabMutation.mutate(selectedTable)}
                  className="px-4 py-2 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider shadow-md"
                >
                  Open New Tab
                </button>
              </div>
            ) : activeTab ? (
              <div className="space-y-4">
                {/* Per-Item List with Status Chips & Void Button */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {activeTab.items && activeTab.items.length > 0 ? (
                    activeTab.items.map((it) => (
                      <div
                        key={it.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          it.status === 'void'
                            ? 'bg-red-500/5 border-red-500/20 opacity-60'
                            : 'bg-canvas border-border'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-primaryText truncate">
                              {it.menuItemName || 'Item'}
                            </span>
                            <span className="text-mutedText font-mono">x{it.qty}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <StatusBadge status={it.status} />
                            {it.voidReason && (
                              <span className="text-[10px] text-red-500 italic truncate max-w-[120px]">
                                ({it.voidReason})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <MoneyText paise={it.unitPricePaise * it.qty} className="font-bold" />
                          {it.status !== 'void' && it.status !== 'served' && (
                            <button
                              onClick={() => setVoidItem(it)}
                              className="p-1 rounded text-mutedText hover:text-red-500"
                              title="Void Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-mutedText italic text-center py-6">
                      Tab is empty. Tap items on the menu to add.
                    </p>
                  )}
                </div>

                {/* Subtotal & Settle Trigger */}
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs font-bold text-mutedText">Tab Total</span>
                    <MoneyText
                      paise={activeTab.subtotalPaise}
                      className="text-2xl font-black text-accent-orange"
                    />
                  </div>

                  <button
                    disabled={!activeTab.items || activeTab.items.length === 0}
                    onClick={() => {
                      setCashAmount(activeTab.subtotalPaise || 0);
                      setCardAmount(0);
                      setUpiAmount(0);
                      setSettleModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-md flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Split Tender & Settle</span>
                  </button>
                </div>
              </div>
            ) : (
              <EmptyState title="No Table Selected" description="Tap a table on the floor plan above." />
            )}
          </div>
        </div>
      </div>

      {/* Split-Tender Settlement Dialog */}
      {settleModalOpen && activeTab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Split Settlement
                </span>
                <h3 className="text-xl font-black text-primaryText">Settle {selectedTable?.label}</h3>
              </div>
              <button
                onClick={() => setSettleModalOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-canvas border border-border flex justify-between items-baseline text-xs">
              <span className="font-semibold text-mutedText">Total Due</span>
              <MoneyText paise={tabSubtotal} className="text-lg font-black text-primaryText" />
            </div>

            {/* Split Tenders Inputs */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Cash (Paise)</label>
                <input
                  type="number"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs font-mono text-primaryText focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Card (Paise)</label>
                <input
                  type="number"
                  value={cardAmount}
                  onChange={(e) => setCardAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs font-mono text-primaryText focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">UPI (Paise)</label>
                <input
                  type="number"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs font-mono text-primaryText focus:outline-none"
                />
              </div>
            </div>

            {/* Inline OVERPAYMENT Validation Flag */}
            {isOverpaid ? (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>OVERPAYMENT: Total tendered exceeds bill by {formatPaise(totalTendered - tabSubtotal)}!</span>
              </div>
            ) : isExactOrRemaining > 0 ? (
              <div className="flex justify-between text-xs text-mutedText">
                <span>Remaining balance</span>
                <MoneyText paise={isExactOrRemaining} className="font-bold text-accent-orange" />
              </div>
            ) : (
              <div className="text-xs text-emerald-600 font-bold text-center">
                ✓ Exact payment matched
              </div>
            )}

            <button
              type="button"
              disabled={settleTabMutation.isPending || isOverpaid || totalTendered === 0}
              onClick={() => settleTabMutation.mutate()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md mt-2"
            >
              {settleTabMutation.isPending ? 'Settling...' : 'Capture Payments & Settle'}
            </button>
          </div>
        </div>
      )}

      {/* Void Reason Modal */}
      {voidItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-primaryText">Void Menu Item</h3>
            <p className="text-xs text-mutedText">
              Voiding <span className="font-bold">{voidItem.menuItemName}</span> requires an audit reason.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Required Reason *</label>
              <input
                type="text"
                required
                placeholder="Spill, guest cancellation, kitchen out of stock..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setVoidItem(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-mutedText"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!voidReason.trim() || voidItemMutation.isPending}
                onClick={() => voidItemMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold uppercase tracking-wider shadow-md disabled:opacity-40"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Till Open / Close Modal */}
      {tillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Cash Reconciliation
                </span>
                <h3 className="text-xl font-black text-primaryText">Daily Till Drawer</h3>
              </div>
              <button
                onClick={() => setTillModalOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Open Till Section */}
            <div className="p-4 rounded-xl bg-canvas border border-border space-y-2">
              <span className="text-xs font-bold text-primaryText block">Start Shift: Open Till (₹)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(Number(e.target.value))}
                  placeholder="Opening Float (₹)"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={openTillMutation.isPending}
                  onClick={() => openTillMutation.mutate()}
                  className="px-4 py-1.5 rounded-lg bg-accent-orange text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  Open Till
                </button>
              </div>
            </div>

            {/* Close Till & Variance Section */}
            <div className="p-4 rounded-xl bg-canvas border border-border space-y-2">
              <span className="text-xs font-bold text-primaryText block">End Shift: Close Till (₹)</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={countedCash}
                  onChange={(e) => setCountedCash(Number(e.target.value))}
                  placeholder="Counted Cash (₹)"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono"
                />
                <button
                  type="button"
                  disabled={closeTillMutation.isPending}
                  onClick={() => closeTillMutation.mutate()}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider whitespace-nowrap"
                >
                  Close & Reconcile
                </button>
              </div>

              {tillVariance !== null && (
                <div className="pt-2 flex justify-between text-xs font-semibold">
                  <span className="text-mutedText">Reconciliation Variance</span>
                  <MoneyText paise={tillVariance} className="font-bold" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Z-Report Modal */}
      {zReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Daily Closing
                </span>
                <h3 className="text-xl font-black text-primaryText">End-of-Day Z-Report</h3>
              </div>
              <button
                onClick={() => setZReportOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-border bg-canvas text-xs font-semibold"
              />
            </div>

            {zReport ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-canvas border border-border space-y-2">
                  <div className="flex justify-between items-baseline font-bold text-sm">
                    <span>Total Sales</span>
                    <MoneyText paise={zReport.totalSalesPaise} className="text-accent-orange font-black" />
                  </div>
                  <div className="flex justify-between text-mutedText">
                    <span>Tax Collected</span>
                    <MoneyText paise={zReport.taxPaise} />
                  </div>
                  <div className="flex justify-between text-mutedText">
                    <span>Discounts Given</span>
                    <MoneyText paise={zReport.discountsPaise} />
                  </div>
                  <div className="flex justify-between text-red-500">
                    <span>Voids ({zReport.voidsCount})</span>
                    <MoneyText paise={zReport.voidsPaise} />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold uppercase text-[10px] text-mutedText">Sales By Tender</span>
                  <div className="divide-y divide-border/60 border border-border rounded-xl p-2 bg-canvas">
                    {zReport.salesByTender?.map((t, idx) => (
                      <div key={idx} className="flex justify-between py-1.5">
                        <span className="uppercase font-semibold">{t.method}</span>
                        <MoneyText paise={t.amountPaise} className="font-mono font-bold" />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadZReportCsv}
                  className="w-full py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Z-Report CSV</span>
                </button>
              </div>
            ) : (
              <LoadingState message="Fetching Z-Report summary..." />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
