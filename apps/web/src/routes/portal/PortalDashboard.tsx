import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { MoneyText } from '../../components/shared/MoneyText';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../components/shared/States';
import { useToast } from '../../lib/toast';
import { formatDate, formatTime } from '../../lib/utils';
import type { Booking } from '@club/contract';
import { Calendar, Clock, RotateCw, XCircle, UserCheck, Shield } from 'lucide-react';

interface PortalDashboardProps {
  onNavigateBookCourt?: () => void;
  onNavigateLogin?: () => void;
}

export function PortalDashboard({ onNavigateBookCourt, onNavigateLogin }: PortalDashboardProps) {
  const { user, memberId, activePlan, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  // Fetch upcoming bookings for this member
  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ['portal-bookings', memberId],
    queryFn: () => api.bookings.list({ memberId: memberId || undefined }),
    enabled: !!memberId,
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.cancel(id, { reason: 'Member cancelled from portal' }),
    onSuccess: (data) => {
      showToast('info', 'Booking Cancelled', `Refund tier applied: ${data.refundPercentage}%`);
      queryClient.invalidateQueries({ queryKey: ['portal-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      showError(err, 'Failed to cancel booking');
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-accent-orange/15 text-accent-orange flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-primaryText">Member Portal Sign-In</h2>
        <p className="text-xs text-mutedText">
          Please log in with your member account to view bookings, court allowances, and membership status.
        </p>
        <button
          onClick={onNavigateLogin}
          className="px-6 py-2.5 rounded-full bg-accent-orange text-white text-xs font-bold uppercase tracking-wider shadow-md"
        >
          Sign In as Member
        </button>
      </div>
    );
  }

  const bookings = bookingsData?.items || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in py-4">
      {/* Member Profile Banner */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent-orange to-amber-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-accent-orange/20">
            {user?.name.charAt(0) || 'M'}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">
              Champions Club Member
            </span>
            <h2 className="text-2xl font-black text-primaryText">{user?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300">
                {activePlan || 'Gold'} Tier
              </span>
              <span className="text-xs text-mutedText font-mono">{user?.email}</span>
            </div>
          </div>
        </div>

        <button
          onClick={onNavigateBookCourt}
          className="px-5 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center justify-center gap-1.5"
        >
          <Calendar className="w-4 h-4" />
          <span>Book a Court</span>
        </button>
      </div>

      {/* Member Bookings List */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-lg font-black text-primaryText">My Court Bookings</h3>
            <p className="text-xs text-mutedText">Upcoming sessions and reservations.</p>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['portal-bookings'] })}
            className="p-1.5 rounded-lg border border-border hover:bg-canvas text-mutedText"
            title="Refresh"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {isLoading ? (
          <LoadingState message="Fetching member bookings..." />
        ) : bookings.length > 0 ? (
          <div className="space-y-3">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl border border-border bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-primaryText">
                      {b.courtName || 'Court Session'}
                    </span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="flex items-center gap-2 text-mutedText font-mono">
                    <Clock className="w-3.5 h-3.5 text-accent-orange" />
                    <span>
                      {formatDate(b.startAt)} at {formatTime(b.startAt)} – {formatTime(b.endAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <MoneyText paise={b.pricePaise} className="font-bold text-sm text-primaryText" />
                  {b.status === 'confirmed' || b.status === 'held' ? (
                    <button
                      type="button"
                      disabled={cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(b.id)}
                      className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-semibold text-xs transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Upcoming Bookings"
            description="You don't have any active court sessions booked."
            action={
              <button
                onClick={onNavigateBookCourt}
                className="px-4 py-2 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-wider"
              >
                Reserve Your First Court
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}
