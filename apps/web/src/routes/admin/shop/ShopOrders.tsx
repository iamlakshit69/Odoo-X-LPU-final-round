import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatDate, formatTime } from '../../../lib/utils';
import type { Order } from '@club/contract';
import {
  Package,
  Clock,
  ArrowRight,
  Truck,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';

const COLUMNS = [
  { id: 'placed', label: 'Placed', icon: <Clock className="w-4 h-4 text-amber-500" /> },
  { id: 'ready', label: 'Ready', icon: <Package className="w-4 h-4 text-blue-500" /> },
  { id: 'out_for_delivery', label: 'Out for Delivery', icon: <Truck className="w-4 h-4 text-purple-500" /> },
  { id: 'fulfilled', label: 'Collected / Delivered', icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
];

export function ShopOrders() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.shop.listOrders(),
  });

  const orders: Order[] = ordersData?.items || [];

  // Status update mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.shop.updateOrderStatus(id, status),
    onSuccess: (_, { status }) => {
      showToast('success', 'Order Updated', `Moved to ${status.replace('_', ' ')}.`);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err) => {
      showError(err, 'Invalid status transition.');
    },
  });

  const getOrdersForCol = (colId: string) => {
    if (colId === 'fulfilled') {
      return orders.filter((o) => o.status === 'collected' || o.status === 'delivered');
    }
    return orders.filter((o) => o.status === colId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex items-center justify-between">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
            Fulfilment Kanban
          </span>
          <h1 className="text-2xl font-black text-primaryText">Shop Orders Board</h1>
          <p className="text-xs text-mutedText mt-0.5">
            Track and advance counter pickups and member home deliveries in realtime.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          className="p-2 rounded-xl border border-border hover:bg-canvas text-mutedText hover:text-primaryText transition-colors flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <LoadingState message="Loading orders board..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colOrders = getOrdersForCol(col.id);

            return (
              <div
                key={col.id}
                className="rounded-[24px] border border-border bg-surface p-4 shadow-sm space-y-3 min-h-[500px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <div className="flex items-center gap-2">
                    {col.icon}
                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-primaryText">
                      {col.label}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-canvas border border-border text-mutedText">
                    {colOrders.length}
                  </span>
                </div>

                {/* Cards List */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colOrders.length > 0 ? (
                    colOrders.map((ord) => (
                      <div
                        key={ord.id}
                        className="p-4 rounded-2xl bg-canvas border border-border hover:border-accent-orange/40 transition-all space-y-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-primaryText">
                            #{ord.id.slice(0, 8)}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-surface border border-border">
                            {ord.fulfilment}
                          </span>
                        </div>

                        {/* Customer / Items info */}
                        <div className="space-y-1 text-xs">
                          <div className="text-mutedText">
                            {ord.guestName || (ord.memberId ? 'Club Member' : 'Counter Sale')}
                          </div>
                          {ord.deliveryAddress && (
                            <p className="text-[11px] text-mutedText truncate italic">
                              📍 {ord.deliveryAddress}
                            </p>
                          )}
                          <div className="text-[10px] text-mutedText font-mono pt-1">
                            {formatDate(ord.createdAt)} • {formatTime(ord.createdAt)}
                          </div>
                        </div>

                        {/* Items list preview */}
                        {ord.items && ord.items.length > 0 && (
                          <div className="p-2 rounded-xl bg-surface-muted border border-border/60 text-[11px] space-y-1">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="flex justify-between text-mutedText">
                                <span className="truncate max-w-[130px]">
                                  {it.productName || 'Item'} ({it.optionLabel || 'standard'})
                                </span>
                                <span className="font-bold">x{it.qty}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action buttons to advance status */}
                        <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                          {ord.status === 'placed' && (
                            <button
                              type="button"
                              disabled={updateStatusMutation.isPending}
                              onClick={() =>
                                updateStatusMutation.mutate({ id: ord.id, status: 'ready' })
                              }
                              className="w-full py-1.5 rounded-xl bg-accent-orange text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm"
                            >
                              <span>Mark Ready</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {ord.status === 'ready' && (
                            <div className="grid grid-cols-2 gap-1.5 w-full">
                              <button
                                type="button"
                                disabled={updateStatusMutation.isPending}
                                onClick={() =>
                                  updateStatusMutation.mutate({ id: ord.id, status: 'collected' })
                                }
                                className="py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider"
                              >
                                Collected
                              </button>
                              <button
                                type="button"
                                disabled={updateStatusMutation.isPending}
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    id: ord.id,
                                    status: 'out_for_delivery',
                                  })
                                }
                                className="py-1.5 rounded-xl bg-purple-600 text-white font-bold text-[10px] uppercase tracking-wider"
                              >
                                Dispatch
                              </button>
                            </div>
                          )}

                          {ord.status === 'out_for_delivery' && (
                            <button
                              type="button"
                              disabled={updateStatusMutation.isPending}
                              onClick={() =>
                                updateStatusMutation.mutate({ id: ord.id, status: 'delivered' })
                              }
                              className="w-full py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 shadow-sm"
                            >
                              <span>Mark Delivered</span>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {(ord.status === 'collected' || ord.status === 'delivered') && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 mx-auto">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Fulfilled
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-mutedText italic text-center py-10">No orders</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
