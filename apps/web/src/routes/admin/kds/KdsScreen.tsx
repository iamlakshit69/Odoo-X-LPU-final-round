import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatTime } from '../../../lib/utils';
import type { KdsItem } from '@club/contract';
import {
  Utensils,
  Coffee,
  Volume2,
  VolumeX,
  Clock,
  CheckCircle2,
  ArrowRight,
  Flame,
  History,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface KdsScreenProps {
  initialStation?: 'kitchen' | 'bar';
}

export function KdsScreen({ initialStation = 'kitchen' }: KdsScreenProps) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [station, setStation] = useState<'kitchen' | 'bar'>(initialStation);
  const [viewTab, setViewTab] = useState<'live' | 'history'>('live');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Initialize Web Audio Context on button click (satisfying browser autoplay policy)
  const enableSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      audioCtxRef.current = ctx;
      setSoundEnabled(true);
      playChime(ctx); // sample ping
      showToast('success', 'Audio Unlocked', 'Audio notifications enabled for incoming orders.');
    } catch {
      showToast('error', 'Audio Error', 'Could not initialize Web Audio.');
    }
  };

  const playChime = (ctx?: AudioContext | null) => {
    const audioCtx = ctx || audioCtxRef.current;
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // ignore audio errors
    }
  };

  // Fetch active KDS items filtered by station from API
  const { data: rawKdsItems = [], isLoading } = useQuery<KdsItem[]>({
    queryKey: ['kds', station, 'active'],
    queryFn: () => api.bar.getKds(station, false),
    refetchInterval: 6000,
  });

  // Fetch recently served history items
  const { data: rawHistoryItems = [], isLoading: isHistoryLoading } = useQuery<KdsItem[]>({
    queryKey: ['kds', station, 'history'],
    queryFn: () => api.bar.getKds(station, true),
    refetchInterval: 10000,
  });

  // Sort active items newest first
  const kdsItems = React.useMemo(() => {
    return [...rawKdsItems].sort((a, b) => {
      const timeA = new Date(a.orderTime || a.createdAt || 0).getTime();
      const timeB = new Date(b.orderTime || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [rawKdsItems]);

  // Sort history items by served time (updatedAt) newest first
  const historyItems = React.useMemo(() => {
    return [...rawHistoryItems].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [rawHistoryItems]);

  // Advance / change status mutation
  const advanceStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus, targetStatus }: { id: string; currentStatus: string; targetStatus?: 'pending' | 'preparing' | 'ready' | 'served' }) => {
      let nextStatus: 'pending' | 'preparing' | 'ready' | 'served' = 'preparing';
      if (targetStatus) {
        nextStatus = targetStatus;
      } else if (currentStatus === 'pending') {
        nextStatus = 'preparing';
      } else if (currentStatus === 'preparing') {
        nextStatus = 'ready';
      } else if (currentStatus === 'ready') {
        nextStatus = 'served';
      }

      return api.bar.updateTabItemStatus(id, nextStatus);
    },
    onSuccess: (item) => {
      showToast('info', 'Status Updated', `${item.menuItemName || 'Item'} marked ${item.status}.`);
      queryClient.invalidateQueries({ queryKey: ['kds', station] });
      queryClient.invalidateQueries({ queryKey: ['tab'] });
    },
    onError: (err) => {
      showError(err, 'Failed to update item status.');
    },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top KDS Bar */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent-orange/15 text-accent-orange flex items-center justify-center">
            {station === 'kitchen' ? <Utensils className="w-5 h-5" /> : <Coffee className="w-5 h-5" />}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">
              Kitchen Display System (KDS)
            </span>
            <h1 className="text-2xl font-black text-primaryText capitalize">
              {station} Station Screen
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Station Switcher */}
          <div className="flex items-center p-1 rounded-full bg-canvas border border-border">
            <button
              onClick={() => setStation('kitchen')}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                station === 'kitchen'
                  ? 'bg-surface text-primaryText shadow-sm'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              Kitchen
            </button>
            <button
              onClick={() => setStation('bar')}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                station === 'bar'
                  ? 'bg-surface text-primaryText shadow-sm'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              Bar
            </button>
          </div>

          {/* View Mode Switcher: Live Queue vs Served History */}
          <div className="flex items-center p-1 rounded-full bg-canvas border border-border">
            <button
              onClick={() => setViewTab('live')}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewTab === 'live'
                  ? 'bg-accent-orange text-white shadow-sm'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Live ({kdsItems.length})</span>
            </button>
            <button
              onClick={() => setViewTab('history')}
              className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                viewTab === 'history'
                  ? 'bg-accent-orange text-white shadow-sm'
                  : 'text-mutedText hover:text-primaryText'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History ({historyItems.length})</span>
            </button>
          </div>

          {/* Enable Sound Unlock Button */}
          <button
            onClick={enableSound}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${
              soundEnabled
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-surface border border-border text-primaryText hover:bg-canvas'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-mutedText" />}
            <span>{soundEnabled ? 'Sound Active' : 'Enable Sound'}</span>
          </button>
        </div>
      </div>

      {/* Main Content: Live Queue OR Served History */}
      {viewTab === 'live' ? (
        <div className="space-y-8">
          {/* Large Touch Cards Grid */}
          {isLoading ? (
            <LoadingState message="Loading station tickets..." />
          ) : kdsItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
              {kdsItems.map((item) => {
                const isPending = item.status === 'pending';
                const isPreparing = item.status === 'preparing';
                const isReady = item.status === 'ready';

                let borderTheme = 'border-border bg-surface';
                if (isPending) borderTheme = 'border-amber-500/60 bg-amber-500/5 ring-1 ring-amber-500/20';
                else if (isPreparing) borderTheme = 'border-blue-500/60 bg-blue-500/5 ring-1 ring-blue-500/20';
                else if (isReady) borderTheme = 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20';

                return (
                  <div
                    key={item.id}
                    className={`rounded-[24px] border p-5 shadow-md flex flex-col justify-between min-h-[260px] transition-all ${borderTheme}`}
                  >
                    <div className="space-y-3">
                      {/* Card Header: Table + Time */}
                      <div className="flex items-center justify-between pb-2 border-b border-border/60">
                        <span className="font-extrabold text-xs uppercase px-2.5 py-1 rounded-md bg-canvas border border-border">
                          {item.tableLabel || item.guestLabel || 'Takeaway'}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-mono text-mutedText">
                          <Clock className="w-3.5 h-3.5 text-accent-orange" />
                          <span>{formatTime(item.orderTime)}</span>
                        </div>
                      </div>

                      {/* Main Item & Qty */}
                      <div className="py-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-xl font-black text-primaryText leading-snug">
                            {item.menuItemName || 'Menu Item'}
                          </h3>
                          <span className="text-2xl font-black text-accent-orange">
                            x{item.qty}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Status & One-Tap Advance Button */}
                    <div className="pt-3 border-t border-border/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-mutedText uppercase font-bold">Status</span>
                        <StatusBadge status={item.status} />
                      </div>

                      {item.status !== 'served' && item.status !== 'void' && (
                        <button
                          type="button"
                          disabled={advanceStatusMutation.isPending}
                          onClick={() =>
                            advanceStatusMutation.mutate({
                              id: item.id,
                              currentStatus: item.status,
                            })
                          }
                          className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2 active:scale-95 ${
                            isPending
                              ? 'bg-blue-600 hover:bg-blue-700 text-white'
                              : isPreparing
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                              : 'bg-stone-700 hover:bg-stone-800 text-white'
                          }`}
                        >
                          {isPending ? (
                            <>
                              <Flame className="w-4 h-4" />
                              <span>Start Preparing</span>
                            </>
                          ) : isPreparing ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Mark Ready</span>
                            </>
                          ) : (
                            <>
                              <ArrowRight className="w-4 h-4" />
                              <span>Mark Served</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="All Caught Up!"
              description={`No pending orders waiting in the ${station} queue.`}
            />
          )}

          {/* Quick Served History Strip (Below Live Queue) */}
          {historyItems.length > 0 && (
            <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-border/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-bold text-primaryText">Recently Served History</h3>
                  <span className="text-[10px] text-mutedText px-2 py-0.5 rounded-full bg-canvas border border-border">
                    Last {Math.min(historyItems.length, 6)} served items
                  </span>
                </div>
                <button
                  onClick={() => setViewTab('history')}
                  className="text-xs font-semibold text-accent-orange hover:underline flex items-center gap-1"
                >
                  <span>View All ({historyItems.length})</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {historyItems.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 rounded-2xl bg-canvas border border-border flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-[11px] uppercase px-1.5 py-0.5 rounded bg-surface border border-border text-primaryText">
                          {item.tableLabel || item.guestLabel || 'Takeaway'}
                        </span>
                        <span className="font-bold text-primaryText truncate">
                          {item.menuItemName} <span className="text-accent-orange">x{item.qty}</span>
                        </span>
                      </div>
                      <div className="text-[10px] text-mutedText font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        <span>Served at {formatTime(item.updatedAt || item.createdAt)}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={advanceStatusMutation.isPending}
                      onClick={() =>
                        advanceStatusMutation.mutate({
                          id: item.id,
                          currentStatus: 'served',
                          targetStatus: 'ready',
                        })
                      }
                      title="Undo served (return to ready)"
                      className="p-1.5 rounded-xl border border-border bg-surface text-mutedText hover:text-accent-orange hover:border-accent-orange transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Full Served History Screen */
        <div className="space-y-4">
          <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-primaryText flex items-center gap-2">
                <History className="w-5 h-5 text-accent-orange" />
                <span>{station === 'kitchen' ? 'Kitchen' : 'Bar'} Served History</span>
              </h2>
              <p className="text-xs text-mutedText">
                Complete log of items fulfilled and served by the {station} today.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-mutedText">
                Total Served: <span className="text-emerald-500">{historyItems.length} items</span>
              </span>
              <button
                onClick={() => setViewTab('live')}
                className="px-3.5 py-1.5 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-orange/90 flex items-center gap-1.5"
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Back to Live Queue</span>
              </button>
            </div>
          </div>

          {isHistoryLoading ? (
            <LoadingState message="Loading served history log..." />
          ) : historyItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {historyItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[24px] border border-border/80 bg-surface/90 p-5 shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <span className="font-extrabold text-xs uppercase px-2 py-0.5 rounded-md bg-canvas border border-border text-primaryText">
                        {item.tableLabel || item.guestLabel || 'Takeaway'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Served
                      </span>
                    </div>

                    <div className="py-1">
                      <h3 className="text-base font-black text-primaryText">
                        {item.menuItemName}
                      </h3>
                      <span className="text-xl font-black text-accent-orange">
                        Quantity: x{item.qty}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] text-mutedText font-mono pt-1">
                      <div className="flex items-center justify-between">
                        <span>Ordered:</span>
                        <span>{formatTime(item.orderTime)}</span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span>Served:</span>
                        <span>{formatTime(item.updatedAt || item.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-border/60 flex items-center justify-end">
                    <button
                      type="button"
                      disabled={advanceStatusMutation.isPending}
                      onClick={() =>
                        advanceStatusMutation.mutate({
                          id: item.id,
                          currentStatus: 'served',
                          targetStatus: 'ready',
                        })
                      }
                      className="px-3 py-1.5 rounded-xl border border-border bg-canvas hover:border-accent-orange text-mutedText hover:text-accent-orange text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Recall to Ready</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Served History"
              description={`No orders have been marked as served yet in this ${station} session.`}
            />
          )}
        </div>
      )}
    </div>
  );
}
