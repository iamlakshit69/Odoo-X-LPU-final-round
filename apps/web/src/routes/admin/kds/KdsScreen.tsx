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
} from 'lucide-react';

interface KdsScreenProps {
  initialStation?: 'kitchen' | 'bar';
}

export function KdsScreen({ initialStation = 'kitchen' }: KdsScreenProps) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [station, setStation] = useState<'kitchen' | 'bar'>(initialStation);
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

  // Fetch KDS items filtered by station from API
  const { data: rawKdsItems = [], isLoading } = useQuery<KdsItem[]>({
    queryKey: ['kds', station],
    queryFn: () => api.bar.getKds(station),
    refetchInterval: 6000,
  });

  // Sort newest first
  const kdsItems = React.useMemo(() => {
    return [...rawKdsItems].sort((a, b) => {
      const timeA = new Date(a.orderTime || a.createdAt || 0).getTime();
      const timeB = new Date(b.orderTime || b.createdAt || 0).getTime();
      return timeB - timeA;
    });
  }, [rawKdsItems]);

  // Advance status mutation: pending -> preparing -> ready -> served
  const advanceStatusMutation = useMutation({
    mutationFn: ({ id, currentStatus }: { id: string; currentStatus: string }) => {
      let nextStatus: 'pending' | 'preparing' | 'ready' | 'served' = 'preparing';
      if (currentStatus === 'pending') nextStatus = 'preparing';
      else if (currentStatus === 'preparing') nextStatus = 'ready';
      else if (currentStatus === 'ready') nextStatus = 'served';

      return api.bar.updateTabItemStatus(id, nextStatus);
    },
    onSuccess: (item) => {
      showToast('info', 'Status Updated', `${item.menuItemName || 'Item'} marked ${item.status}.`);
      queryClient.invalidateQueries({ queryKey: ['kds', station] });
      queryClient.invalidateQueries({ queryKey: ['tab'] });
    },
    onError: (err) => {
      showError(err, 'Failed to advance item status.');
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

          {/* Enable Sound Unlock Button */}
          <button
            onClick={enableSound}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm ${
              soundEnabled
                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-accent-orange text-white hover:bg-accent-orange/90'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{soundEnabled ? 'Sound Active' : 'Enable Sound'}</span>
          </button>
        </div>
      </div>

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
    </div>
  );
}
