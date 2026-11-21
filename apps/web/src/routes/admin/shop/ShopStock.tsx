import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { DataTable, type Column } from '../../../components/shared/DataTable';
import { LoadingState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import type { StockLevel } from '@club/contract';
import {
  Boxes,
  AlertTriangle,
  PlusCircle,
  Filter,
  CheckCircle,
  X,
  FileText,
} from 'lucide-react';

export function ShopStock() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [lowOnly, setLowOnly] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [delta, setDelta] = useState<number>(10);
  const [reason, setReason] = useState<'purchase' | 'adjustment' | 'return'>('purchase');
  const [note, setNote] = useState('');

  // Fetch stock from v_stock view via API
  const { data: stockData, isLoading, refetch } = useQuery({
    queryKey: ['inventory', lowOnly],
    queryFn: () => api.shop.getStock({ lowOnly }),
  });

  const stockList: StockLevel[] = stockData?.items || [];

  // Stock movement mutation
  const recordMovementMutation = useMutation({
    mutationFn: () =>
      api.shop.recordStockMovement({
        variantId: selectedVariantId,
        delta: Number(delta),
        reason,
        note: note || undefined,
      }),
    onSuccess: () => {
      showToast('success', 'Stock Adjusted', 'Movement entry written to append-only ledger.');
      setMovementModalOpen(false);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err) => {
      showError(err, 'Failed to record stock movement.');
    },
  });

  const columns: Column<StockLevel>[] = [
    {
      key: 'sku',
      header: 'SKU / Code',
      render: (row) => <span className="font-mono font-bold">{row.sku}</span>,
    },
    {
      key: 'productName',
      header: 'Product & Variant',
      render: (row) => (
        <div>
          <span className="font-bold text-primaryText block">{row.productName}</span>
          <span className="text-mutedText text-[11px]">{row.optionLabel}</span>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-canvas border border-border">
          {row.category}
        </span>
      ),
    },
    {
      key: 'onHand',
      header: 'On Hand',
      render: (row) => <span className="font-mono font-semibold">{row.onHand}</span>,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      render: (row) => <span className="font-mono text-mutedText">{row.reserved}</span>,
    },
    {
      key: 'saleable',
      header: 'Saleable',
      render: (row) => (
        <span className="font-mono font-black text-primaryText">{row.saleable}</span>
      ),
    },
    {
      key: 'threshold',
      header: 'Threshold',
      render: (row) => (
        <span className="font-mono text-mutedText text-xs">≤ {row.lowStockThreshold}</span>
      ),
    },
    {
      key: 'status',
      header: 'Health',
      render: (row) =>
        row.isLow ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30">
            <AlertTriangle className="w-3 h-3" /> Low Stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle className="w-3 h-3" /> Healthy
          </span>
        ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right',
      render: (row) => (
        <button
          type="button"
          onClick={() => {
            setSelectedVariantId(row.variantId);
            setDelta(10);
            setMovementModalOpen(true);
          }}
          className="px-2.5 py-1 rounded-lg border border-border hover:bg-canvas text-xs font-semibold text-accent-orange"
        >
          + Adjust
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
            Inventory Ledger
          </span>
          <h1 className="text-2xl font-black text-primaryText">v_stock Warehouse Levels</h1>
          <p className="text-xs text-mutedText mt-0.5">
            SQL views with append-only stock movement enforcement. Realtime low-stock alerts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Low stock filter toggle */}
          <button
            onClick={() => setLowOnly(!lowOnly)}
            className={`px-3.5 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
              lowOnly
                ? 'bg-red-500/15 border-red-500/40 text-red-500'
                : 'bg-canvas border-border text-mutedText hover:text-primaryText'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Low Stock Alerts</span>
          </button>

          <button
            onClick={() => {
              if (stockList.length > 0) setSelectedVariantId(stockList[0].variantId);
              setMovementModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Record Movement</span>
          </button>
        </div>
      </div>

      {/* Stock Table */}
      <DataTable
        columns={columns}
        data={stockList}
        isLoading={isLoading}
        searchKey="productName"
        searchPlaceholder="Filter items by product name..."
        emptyTitle="No stock records found"
      />

      {/* Add Stock / Adjust Dialog */}
      {movementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Stock Ledger Mutation
                </span>
                <h3 className="text-xl font-black text-primaryText">Record Stock Movement</h3>
              </div>
              <button
                onClick={() => setMovementModalOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Select Product Variant</label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => setSelectedVariantId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                >
                  {stockList.map((s) => (
                    <option key={s.variantId} value={s.variantId}>
                      {s.productName} ({s.optionLabel}) — On hand: {s.onHand}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mutedText">Quantity Delta</label>
                  <input
                    type="number"
                    value={delta}
                    onChange={(e) => setDelta(Number(e.target.value))}
                    placeholder="+10 or -2"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs font-mono text-primaryText focus:outline-none"
                  />
                  <span className="text-[10px] text-mutedText">Negative for reduction/write-off</span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mutedText">Movement Reason</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                  >
                    <option value="purchase">Purchase Intake</option>
                    <option value="adjustment">Stock Audit / Fix</option>
                    <option value="return">Customer Return</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Audit Note</label>
                <input
                  type="text"
                  placeholder="PO number, supplier reference, breakage details..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={recordMovementMutation.isPending || !selectedVariantId || delta === 0}
                onClick={() => recordMovementMutation.mutate()}
                className="w-full py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 mt-4"
              >
                <Boxes className="w-4 h-4" />
                <span>{recordMovementMutation.isPending ? 'Writing Ledger...' : 'Commit Movement'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
