import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { LoadingState, EmptyState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatDate, formatTime } from '../../../lib/utils';
import type { Member, MemberDetail, TimelineItem, Plan } from '@club/contract';
import {
  Search,
  QrCode,
  UserCheck,
  Calendar,
  RotateCw,
  Clock,
  Sparkles,
  Phone,
  Mail,
  Shield,
  CreditCard,
  ShoppingBag,
  Coffee,
  CheckCircle2,
  CalendarDays,
} from 'lucide-react';

interface FrontDeskProps {
  onNavigateBookCourt?: (memberId: string) => void;
}

export function FrontDesk({ onNavigateBookCourt }: FrontDeskProps) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [omniInput, setOmniInput] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [timelineTab, setTimelineTab] = useState<'all' | 'booking' | 'order' | 'tab' | 'payment' | 'checkin'>('all');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedRenewPlan, setSelectedRenewPlan] = useState<string>('gold');

  // Search members with omnibox input
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['members-omni', omniInput],
    queryFn: () => api.members.list({ q: omniInput, limit: 8 }),
    enabled: omniInput.trim().length >= 2,
  });

  // Auto-select first member when initial results return
  React.useEffect(() => {
    if (!selectedMemberId && searchResults?.items && searchResults.items.length > 0) {
      setSelectedMemberId(searchResults.items[0].id);
    }
  }, [searchResults, selectedMemberId]);

  // Fetch full details of the active member
  const { data: memberDetail, isLoading: isLoadingMember } = useQuery<MemberDetail>({
    queryKey: ['member-detail', selectedMemberId],
    queryFn: () => api.members.get(selectedMemberId!),
    enabled: !!selectedMemberId,
  });

  // Fetch timeline items for member
  const { data: timelineItems = [], isLoading: isLoadingTimeline } = useQuery<TimelineItem[]>({
    queryKey: ['member-timeline', selectedMemberId],
    queryFn: () => api.members.getTimeline(selectedMemberId!),
    enabled: !!selectedMemberId,
  });

  // Fetch plans for renew dialog
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: () => api.members.listPlans(),
  });

  // Fetch currently checked-in members at club
  const { data: currentCheckins = [] } = useQuery({
    queryKey: ['checkins-current'],
    queryFn: () => api.members.getCurrentCheckins(),
    refetchInterval: 15000,
  });

  // Check-in mutation
  const checkinMutation = useMutation({
    mutationFn: () => {
      if (!selectedMemberId) throw new Error('No member selected');
      return api.members.checkin({
        memberId: selectedMemberId,
        method: 'manual',
      });
    },
    onSuccess: (data) => {
      showToast('success', 'Checked In!', `${data.memberCard.fullName} verified at Front Desk.`);
      queryClient.invalidateQueries({ queryKey: ['checkins-current'] });
      queryClient.invalidateQueries({ queryKey: ['member-timeline', selectedMemberId] });
    },
    onError: (err) => {
      showError(err, 'Check-in failed');
    },
  });

  // Quick QR Token Check-in from Omnibox
  const qrCheckinMutation = useMutation({
    mutationFn: (token: string) => api.members.checkin({ qrToken: token, method: 'qr' }),
    onSuccess: (data) => {
      showToast('success', 'QR Verified!', `${data.memberCard.fullName} checked in.`);
      setSelectedMemberId(data.memberCard.id);
      queryClient.invalidateQueries({ queryKey: ['checkins-current'] });
    },
    onError: (err) => {
      showError(err, 'QR Token invalid or membership expired.');
    },
  });

  // Renew mutation
  const renewMutation = useMutation({
    mutationFn: () => {
      if (!selectedMemberId) throw new Error('No member selected');
      return api.members.renew(selectedMemberId, selectedRenewPlan);
    },
    onSuccess: () => {
      showToast('success', 'Membership Renewed', 'New membership term initiated and invoiced.');
      setRenewDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['member-detail', selectedMemberId] });
      queryClient.invalidateQueries({ queryKey: ['member-timeline', selectedMemberId] });
    },
    onError: (err) => {
      showError(err, 'Failed to renew membership.');
    },
  });

  // Filter timeline based on active tab
  const filteredTimeline = React.useMemo(() => {
    if (timelineTab === 'all') return timelineItems;
    return timelineItems.filter((t) => t.kind === timelineTab);
  }, [timelineItems, timelineTab]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Front Desk Omnibox Card */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md">
        <div className="max-w-2xl mx-auto space-y-4 text-center">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-accent-orange">
              Reception Console
            </span>
            <h1 className="text-2xl font-black text-primaryText">Front Desk Omnibox</h1>
            <p className="text-xs text-mutedText mt-0.5">
              Instant member lookup by Name, Phone Number, Member Code (CC-000123), or QR token.
            </p>
          </div>

          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-accent-orange" />
            <input
              type="text"
              value={omniInput}
              onChange={(e) => setOmniInput(e.target.value)}
              placeholder="Search by name, phone (9876543210), code (CC-000123), or scan QR..."
              className="w-full pl-12 pr-28 py-3.5 rounded-full border-2 border-border bg-canvas text-sm font-semibold text-primaryText focus:border-accent-orange focus:outline-none shadow-inner"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (omniInput) qrCheckinMutation.mutate(omniInput);
                }}
                className="px-3 py-1.5 rounded-full bg-accent-orange/15 hover:bg-accent-orange/25 text-accent-orange text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Scan QR</span>
              </button>
            </div>
          </div>

          {/* Search Result Chips */}
          {searchResults?.items && searchResults.items.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {searchResults.items.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all flex items-center gap-2 ${
                    selectedMemberId === m.id
                      ? 'border-accent-orange bg-surface ring-1 ring-accent-orange text-accent-orange font-bold shadow-sm'
                      : 'border-border bg-canvas hover:border-border/80 text-primaryText'
                  }`}
                >
                  <span>{m.fullName}</span>
                  <span className="text-[10px] text-mutedText font-mono">{m.memberCode}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Split: Member Card + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Member Card */}
        <div className="lg:col-span-1 space-y-6">
          {isLoadingMember ? (
            <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
              <LoadingState message="Fetching member profile..." />
            </div>
          ) : memberDetail ? (
            <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-6">
              
              {/* Member Card Header */}
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent-orange to-amber-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-accent-orange/20">
                  {memberDetail.fullName.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-primaryText truncate">
                      {memberDetail.fullName}
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-mutedText block">
                    {memberDetail.memberCode}
                  </span>
                  <div className="flex items-center gap-2 mt-2">
                    {memberDetail.currentPlan && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300 border border-accent-lime/40">
                        {memberDetail.currentPlan} Plan
                      </span>
                    )}
                    <StatusBadge status={memberDetail.status || 'active'} />
                  </div>
                </div>
              </div>

              {/* Contact info & validity bounds */}
              <div className="p-4 rounded-2xl bg-canvas border border-border space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-mutedText">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-accent-orange" />
                    Phone
                  </span>
                  <span className="font-semibold text-primaryText font-mono">
                    {memberDetail.phone}
                  </span>
                </div>
                {memberDetail.email && (
                  <div className="flex items-center justify-between text-mutedText">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-accent-orange" />
                      Email
                    </span>
                    <span className="font-semibold text-primaryText truncate max-w-[160px]">
                      {memberDetail.email}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between text-mutedText pt-2 border-t border-border/60">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-accent-orange" />
                    Valid Through
                  </span>
                  <span className="font-bold text-primaryText">
                    {formatDate(memberDetail.endsOn || memberDetail.membership?.endsOn)}
                  </span>
                </div>
              </div>

              {/* Entitlements summary from plan */}
              {memberDetail.plan?.entitlements && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-mutedText">
                    Plan Entitlements
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl border border-border bg-surface-muted">
                      <span className="text-[10px] text-mutedText block">Court Rates</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {memberDetail.plan.entitlements.courtRate}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl border border-border bg-surface-muted">
                      <span className="text-[10px] text-mutedText block">Shop / Bar</span>
                      <span className="font-bold text-primaryText">
                        {memberDetail.plan.entitlements.shopDiscountBps / 100}% off
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Desk Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={checkinMutation.isPending}
                  onClick={() => checkinMutation.mutate()}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>{checkinMutation.isPending ? 'Verifying...' : 'Record Check-in'}</span>
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateBookCourt && selectedMemberId) {
                        onNavigateBookCourt(selectedMemberId);
                      }
                    }}
                    className="py-2.5 rounded-xl border border-border bg-surface hover:bg-canvas text-xs font-bold text-primaryText transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CalendarDays className="w-4 h-4 text-accent-orange" />
                    <span>Book Court</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRenewDialogOpen(true)}
                    className="py-2.5 rounded-xl border border-border bg-surface hover:bg-canvas text-xs font-bold text-primaryText transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCw className="w-4 h-4 text-accent-orange" />
                    <span>Renew Plan</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
              <EmptyState
                title="No member selected"
                description="Use the Omnibox above to search by name or code."
              />
            </div>
          )}

          {/* Live Check-ins on Premises Widget */}
          <div className="rounded-[24px] border border-border bg-surface p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-primaryText">
                  Currently in Club ({currentCheckins.length})
                </h3>
              </div>
              <Clock className="w-3.5 h-3.5 text-mutedText" />
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {currentCheckins.length > 0 ? (
                currentCheckins.map((chk) => (
                  <div
                    key={chk.id}
                    onClick={() => setSelectedMemberId(chk.memberId)}
                    className="p-2 rounded-xl bg-canvas border border-border/60 hover:border-accent-orange/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-semibold text-primaryText">{chk.fullName}</span>
                      <span className="text-[10px] text-mutedText block font-mono">
                        {chk.memberCode}
                      </span>
                    </div>
                    <span className="text-[10px] text-mutedText font-mono">
                      {formatTime(chk.checkedInAt)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-mutedText italic text-center py-2">
                  No active check-ins recorded yet today.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Member Timeline Tabs */}
        <div className="lg:col-span-2">
          <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-4 min-h-[520px]">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div>
                <h3 className="text-lg font-black text-primaryText">Member Activity Timeline</h3>
                <p className="text-xs text-mutedText">
                  Realtime history across court bookings, shop orders, bar tabs, check-ins, and invoices.
                </p>
              </div>

              {/* Timeline filter tabs */}
              <div className="flex items-center gap-1 bg-canvas p-1 rounded-full border border-border overflow-x-auto">
                {(['all', 'booking', 'order', 'tab', 'payment', 'checkin'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTimelineTab(tab)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition-all ${
                      timelineTab === tab
                        ? 'bg-surface text-primaryText shadow-sm'
                        : 'text-mutedText hover:text-primaryText'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeline Events Feed */}
            {isLoadingTimeline ? (
              <LoadingState message="Loading member timeline..." />
            ) : filteredTimeline.length > 0 ? (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/60">
                {filteredTimeline.map((item) => {
                  let icon = <Clock className="w-4 h-4 text-accent-orange" />;
                  if (item.kind === 'booking') icon = <Calendar className="w-4 h-4 text-emerald-500" />;
                  else if (item.kind === 'order') icon = <ShoppingBag className="w-4 h-4 text-blue-500" />;
                  else if (item.kind === 'tab') icon = <Coffee className="w-4 h-4 text-purple-500" />;
                  else if (item.kind === 'payment') icon = <CreditCard className="w-4 h-4 text-amber-500" />;
                  else if (item.kind === 'checkin') icon = <UserCheck className="w-4 h-4 text-teal-500" />;

                  return (
                    <div key={item.id} className="relative flex items-start gap-4 pl-1">
                      <div className="w-7 h-7 rounded-full bg-surface border border-border shadow-sm flex items-center justify-center flex-shrink-0 z-10">
                        {icon}
                      </div>

                      <div className="flex-1 p-3.5 rounded-2xl bg-canvas border border-border/80 hover:border-accent-orange/30 transition-all text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-primaryText">{item.title}</span>
                          <span className="text-[11px] text-mutedText font-mono">
                            {formatDate(item.at)} {formatTime(item.at)}
                          </span>
                        </div>

                        {item.subtitle && (
                          <p className="text-mutedText text-[11px] mt-0.5">{item.subtitle}</p>
                        )}

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40">
                          {item.amountPaise !== undefined ? (
                            <MoneyText paise={item.amountPaise} className="font-bold text-accent-orange" />
                          ) : (
                            <span />
                          )}
                          {item.status && <StatusBadge status={item.status} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="No timeline events"
                description={`No events recorded under the ${timelineTab} category.`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Renew Plan Dialog */}
      {renewDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-primaryText">Renew Membership Plan</h3>
            <p className="text-xs text-mutedText">
              Select plan term to generate renewal invoice and update validity.
            </p>

            <div className="space-y-2">
              {plans.map((p) => (
                <div
                  key={p.code}
                  onClick={() => setSelectedRenewPlan(p.code)}
                  className={`p-3 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                    selectedRenewPlan === p.code
                      ? 'border-accent-orange bg-accent-orange/10 ring-1 ring-accent-orange'
                      : 'border-border bg-canvas hover:bg-surface-muted'
                  }`}
                >
                  <div>
                    <span className="font-bold text-sm text-primaryText block">{p.name}</span>
                    <span className="text-xs text-mutedText">{p.durationDays} days term</span>
                  </div>
                  <MoneyText paise={p.pricePaise} className="font-bold text-sm text-accent-orange" />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setRenewDialogOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-mutedText hover:text-primaryText"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={renewMutation.isPending}
                onClick={() => renewMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-wider shadow-md hover:bg-accent-orange/90"
              >
                {renewMutation.isPending ? 'Renewing...' : 'Confirm Renewal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
