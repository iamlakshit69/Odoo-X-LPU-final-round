import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { PriceBreakdown } from '../../../components/shared/PriceBreakdown';
import { LoadingState, EmptyState, ErrorState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatTime, formatDate, getTodayDateString } from '../../../lib/utils';
import type { StaffSlot, CourtType, CourtWithStaffSlots, QuoteResponse } from '@club/contract';
import {
  Calendar as CalendarIcon,
  Filter,
  X,
  Clock,
  User,
  Phone,
  ShieldAlert,
  Users,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

export function CourtsGrid() {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedType, setSelectedType] = useState<string>('all');

  // Drawer states
  const [bookingSlot, setBookingSlot] = useState<{ court: CourtWithStaffSlots['court']; slot: StaffSlot } | null>(null);
  const [detailSlot, setDetailSlot] = useState<{ court: CourtWithStaffSlots['court']; slot: StaffSlot } | null>(null);
  const [socialSlot, setSocialSlot] = useState<{ court: CourtWithStaffSlots['court']; slot: StaffSlot } | null>(null);

  // Booking Form State
  const [isWalkin, setIsWalkin] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ id: string; fullName: string; phone: string; currentPlan?: string | null } | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [channel, setChannel] = useState<'counter' | 'phone' | 'online'>('counter');

  // Cancel state
  const [cancelReason, setCancelReason] = useState('Member requested');
  const [cancelResult, setCancelResult] = useState<{ refundPaise: number; refundPercentage: number } | null>(null);

  // Auto-populate member from URL query param if navigated from FrontDesk
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mId = params.get('memberId');
    if (mId) {
      api.members.get(mId).then((m) => {
        if (m) {
          setSelectedMember({
            id: m.id,
            fullName: m.fullName,
            phone: m.phone,
            currentPlan: m.plan?.code || null,
          });
          setMemberSearch(m.fullName);
        }
      }).catch(console.error);
    }
  }, []);

  // Fetch court types dynamically from API (never hardcoded)
  const { data: courtTypes = [] } = useQuery<CourtType[]>({
    queryKey: ['court-types'],
    queryFn: () => api.courts.listCourtTypes(),
  });

  // Fetch courts × half-hour availability straight from API
  const {
    data: availabilityData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['availability', selectedDate, selectedType],
    queryFn: () =>
      api.courts.getStaffAvailability(
        selectedDate,
        selectedType === 'all' ? undefined : selectedType
      ),
  });

  // Live member search for booking sheet
  const { data: membersResult } = useQuery({
    queryKey: ['members-search', memberSearch],
    queryFn: () => api.members.list({ q: memberSearch, limit: 5 }),
    enabled: !isWalkin && memberSearch.trim().length >= 2,
  });

  // Live pricing quote straight from server (no maths in browser)
  const courtTypeCode = bookingSlot?.court.courtTypeCode || 'tennis';
  const matchingCourtType = courtTypes.find((t) => t.id === bookingSlot?.court.courtTypeId || t.code === courtTypeCode);
  const basePaise = matchingCourtType?.basePricePerHourPaise ?? 150000;

  const { data: quote, isFetching: isQuoting } = useQuery<QuoteResponse>({
    queryKey: [
      'pricing-quote',
      bookingSlot?.court.id,
      bookingSlot?.slot.startAt,
      selectedMember?.id,
      channel,
      isWalkin,
    ],
    queryFn: () =>
      api.pricing.quote({
        kind: 'court',
        scopeRef: courtTypeCode,
        basePricePaise: basePaise,
        qty: 1,
        memberId: isWalkin ? undefined : selectedMember?.id,
        channel,
        at: bookingSlot!.slot.startAt,
      }),
    enabled: !!bookingSlot,
  });

  // Booking creation mutation
  const createBookingMutation = useMutation({
    mutationFn: () => {
      if (!bookingSlot) throw new Error('No slot selected');
      return api.bookings.create({
        courtId: bookingSlot.court.id,
        startAt: bookingSlot.slot.startAt,
        channel,
        memberId: isWalkin ? undefined : selectedMember?.id,
        guest: isWalkin
          ? {
              name: guestName,
              phone: guestPhone,
            }
          : undefined,
      });
    },
    onSuccess: () => {
      showToast('success', 'Booking Confirmed', 'Court slot reserved successfully.');
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      setBookingSlot(null);
      resetBookingForm();
    },
    onError: (err) => {
      showError(err, 'Failed to reserve court slot.');
    },
  });

  // Cancel booking mutation
  const cancelBookingMutation = useMutation({
    mutationFn: (bookingId: string) =>
      api.bookings.cancel(bookingId, { reason: cancelReason }),
    onSuccess: (data) => {
      setCancelResult({
        refundPaise: data.refundPaise,
        refundPercentage: data.refundPercentage,
      });
      showToast('info', 'Booking Cancelled', `Refund processed: ${data.refundPercentage}%`);
      queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
    onError: (err) => {
      showError(err, 'Could not cancel booking.');
    },
  });

  // Social session signup mutation
  const socialSignupMutation = useMutation({
    mutationFn: (sessionId: string) => {
      if (!selectedMember) throw new Error('Please select a member first');
      return api.bookings.signupSocialSession(sessionId, selectedMember.id);
    },
    onSuccess: (res) => {
      showToast(
        'success',
        res.signup.status === 'confirmed' ? 'Signup Confirmed' : 'Waitlisted',
        `Social play session updated (position ${res.signup.position}).`
      );
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      setSocialSlot(null);
    },
    onError: (err) => {
      showError(err, 'Failed to sign up for social session.');
    },
  });

  const resetBookingForm = () => {
    setSelectedMember(null);
    setMemberSearch('');
    setIsWalkin(false);
    setGuestName('');
    setGuestPhone('');
    setChannel('counter');
  };

  const courtsData = availabilityData?.courts || [];

  // Extract all distinct start times straight from the API slots
  const allTimeSlots = React.useMemo(() => {
    const times = new Set<string>();
    courtsData.forEach((c) => {
      c.slots.forEach((s) => times.add(s.startAt));
    });
    return Array.from(times).sort();
  }, [courtsData]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Controls */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-2xl font-black tracking-tight text-primaryText">
                Court Availability Grid
              </h1>
            </div>
            <p className="text-xs text-mutedText mt-1">
              Live half-hour court schedule with direct API slot binding & instant pricing engine quote.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Date Picker */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-canvas text-xs">
              <CalendarIcon className="w-4 h-4 text-accent-orange" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-semibold text-primaryText focus:outline-none"
              />
            </div>

            {/* Quick jump to today */}
            <button
              onClick={() => setSelectedDate(getTodayDateString())}
              className="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-canvas text-xs font-semibold text-mutedText hover:text-primaryText transition-colors"
            >
              Today
            </button>
          </div>
        </div>

        {/* Court Type Filter Pills (Fetched from API) */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border/60 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-mutedText uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
              selectedType === 'all'
                ? 'bg-accent-orange text-white shadow-sm'
                : 'bg-canvas text-mutedText hover:text-primaryText border border-border'
            }`}
          >
            All Sports ({courtsData.length} courts)
          </button>
          {courtTypes.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedType(t.code)}
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider transition-all ${
                selectedType === t.code
                  ? 'bg-accent-orange text-white shadow-sm'
                  : 'bg-canvas text-mutedText hover:text-primaryText border border-border'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Container */}
      {isLoading ? (
        <LoadingState message="Loading live court availability from API..." />
      ) : isError ? (
        <ErrorState
          title="Failed to load court grid"
          message="Could not reach the availability endpoint."
          onRetry={refetch}
        />
      ) : courtsData.length === 0 ? (
        <EmptyState
          title="No courts available"
          description="No courts found for the selected filter on this date."
        />
      ) : (
        <div className="rounded-[24px] border border-border bg-surface shadow-md overflow-hidden">
          <div className="overflow-x-auto max-h-[720px] relative">
            <table className="w-full border-collapse text-left">
              {/* Header row with Court Names */}
              <thead className="sticky top-0 z-20 bg-surface-muted border-b border-border shadow-sm">
                <tr>
                  <th className="sticky left-0 z-30 bg-surface-muted px-4 py-3 text-xs font-bold uppercase tracking-wider text-mutedText border-r border-border min-w-[90px]">
                    Time
                  </th>
                  {courtsData.map((c) => (
                    <th
                      key={c.court.id}
                      className="px-4 py-3 text-xs font-bold text-primaryText border-r border-border/60 min-w-[160px] text-center"
                    >
                      <div className="font-extrabold">{c.court.name}</div>
                      <span className="text-[10px] font-normal uppercase text-mutedText">
                        {c.court.courtTypeCode}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Rows with Half-Hour Intervals */}
              <tbody className="divide-y divide-border/60 text-xs">
                {allTimeSlots.map((timeIso) => (
                  <tr key={timeIso} className="hover:bg-canvas/40 transition-colors">
                    {/* Time Column (Sticky Left) */}
                    <td className="sticky left-0 z-10 bg-surface-muted/95 px-3 py-2 text-[11px] font-mono font-semibold text-mutedText border-r border-border whitespace-nowrap">
                      {formatTime(timeIso)}
                    </td>

                    {/* Court Slots */}
                    {courtsData.map((c) => {
                      const slot = c.slots.find((s) => s.startAt === timeIso);
                      if (!slot) {
                        return (
                          <td key={c.court.id} className="p-1 border-r border-border/40 text-center text-mutedText/40">
                            —
                          </td>
                        );
                      }

                      const status = slot.status;
                      const isFree = status === 'free';
                      const isSocial = status === 'social';
                      const isBlocked = status === 'blocked';
                      const isBooked = status === 'taken' || status === 'held';

                      return (
                        <td
                          key={c.court.id}
                          className="p-1.5 border-r border-border/40"
                        >
                          <div
                            onClick={() => {
                              if (isFree) {
                                setBookingSlot({ court: c.court, slot });
                                resetBookingForm();
                              } else if (isSocial) {
                                setSocialSlot({ court: c.court, slot });
                              } else if (slot.bookingId) {
                                setDetailSlot({ court: c.court, slot });
                                setCancelResult(null);
                              }
                            }}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between min-h-[58px] ${
                              isFree
                                ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20 hover:border-emerald-500/50'
                                : isSocial
                                ? 'bg-accent-lime/15 border-accent-lime/40 hover:bg-accent-lime/25'
                                : isBlocked
                                ? 'bg-stone-500/10 border-stone-500/30 opacity-70 cursor-not-allowed'
                                : status === 'held'
                                ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                                : 'bg-canvas border-border hover:border-accent-orange/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <StatusBadge status={status} />
                              {slot.bookedBy?.channel && (
                                <span className="text-[10px] uppercase text-mutedText font-mono">
                                  {slot.bookedBy.channel}
                                </span>
                              )}
                            </div>

                            {/* Slot detail summary */}
                            <div className="mt-1 text-[11px] truncate">
                              {isFree ? (
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  + Book Free Slot
                                </span>
                              ) : isSocial && slot.social ? (
                                <div className="text-lime-900 dark:text-lime-300 font-semibold truncate">
                                  {slot.social.title} ({slot.social.spotsLeft} left)
                                </div>
                              ) : slot.bookedBy ? (
                                <div className="font-medium text-primaryText truncate">
                                  {slot.bookedBy.memberName || slot.bookedBy.guestName || 'Booked'}
                                </div>
                              ) : (
                                <span className="text-mutedText uppercase text-[10px]">
                                  {status}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 1. Free Slot Booking Sheet / Modal */}
      {bookingSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  New Court Reservation
                </span>
                <h3 className="text-xl font-black text-primaryText">
                  {bookingSlot.court.name}
                </h3>
                <div className="flex items-center gap-2 text-xs text-mutedText mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-accent-orange" />
                  <span>
                    {formatDate(bookingSlot.slot.startAt)} at {formatTime(bookingSlot.slot.startAt)} –{' '}
                    {formatTime(bookingSlot.slot.endAt)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setBookingSlot(null)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Booking Channel & Mode Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsWalkin(false)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  !isWalkin
                    ? 'bg-accent-orange text-white shadow-sm'
                    : 'bg-canvas border border-border text-mutedText hover:text-primaryText'
                }`}
              >
                Club Member
              </button>
              <button
                type="button"
                onClick={() => setIsWalkin(true)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                  isWalkin
                    ? 'bg-accent-orange text-white shadow-sm'
                    : 'bg-canvas border border-border text-mutedText hover:text-primaryText'
                }`}
              >
                Walk-In / Guest
              </button>
            </div>

            {/* Member Search or Walk-In Fields */}
            {!isWalkin ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-mutedText">Search Member</label>
                <input
                  type="text"
                  placeholder="Type name, phone, or code (e.g. Aarav, 9876)..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />

                {/* Search Results Dropdown */}
                {membersResult?.items && membersResult.items.length > 0 && !selectedMember && (
                  <div className="rounded-xl border border-border bg-surface divide-y divide-border/60 shadow-lg">
                    {membersResult.items.map((m) => (
                      <div
                        key={m.id}
                        onClick={() => {
                          setSelectedMember(m);
                          setMemberSearch(m.fullName);
                        }}
                        className="p-2.5 hover:bg-canvas cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div>
                          <span className="font-semibold text-primaryText">{m.fullName}</span>
                          <span className="text-[11px] text-mutedText ml-2 font-mono">
                            {m.phone}
                          </span>
                        </div>
                        {m.currentPlan && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300">
                            {m.currentPlan}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedMember && (
                  <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <div>
                        <span className="font-bold text-primaryText">{selectedMember.fullName}</span>
                        <span className="text-[11px] text-mutedText block">
                          Plan: {selectedMember.currentPlan || 'Active'} • {selectedMember.phone}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMember(null)}
                      className="text-xs font-semibold text-red-500 hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mutedText">Guest Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Guest Name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mutedText">Guest Phone</label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit number"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Channel Selector */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Booking Channel</label>
              <div className="grid grid-cols-3 gap-2">
                {(['counter', 'phone', 'online'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setChannel(ch)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all ${
                      channel === ch
                        ? 'bg-surface border border-accent-orange text-accent-orange shadow-sm'
                        : 'bg-canvas border border-border text-mutedText hover:text-primaryText'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            {/* Server-Side Pricing Engine Quote Breakdown */}
            {quote && (
              <PriceBreakdown
                basePaise={basePaise}
                totalPaise={quote.totalPaise}
                breakdown={quote.breakdown}
                tier={quote.tier}
              />
            )}

            {/* Confirm Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setBookingSlot(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-mutedText hover:text-primaryText hover:bg-canvas transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  createBookingMutation.isPending ||
                  (!isWalkin && !selectedMember) ||
                  (isWalkin && (!guestName || !guestPhone))
                }
                onClick={() => createBookingMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-accent-orange hover:bg-accent-orange/90 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-2"
              >
                {createBookingMutation.isPending ? 'Confirming...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Booking Detail & Cancellation Sheet */}
      {detailSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-mutedText">
                  Booking Details
                </span>
                <h3 className="text-lg font-black text-primaryText">
                  {detailSlot.court.name}
                </h3>
              </div>
              <button
                onClick={() => setDetailSlot(null)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-mutedText">Schedule</span>
                <span className="font-semibold text-primaryText">
                  {formatDate(detailSlot.slot.startAt)} at {formatTime(detailSlot.slot.startAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Booked For</span>
                <span className="font-semibold text-primaryText">
                  {detailSlot.slot.bookedBy?.memberName ||
                    detailSlot.slot.bookedBy?.guestName ||
                    'Registered Guest'}
                </span>
              </div>
              {detailSlot.slot.bookedBy?.phone && (
                <div className="flex justify-between">
                  <span className="text-mutedText">Phone</span>
                  <span className="font-mono text-primaryText">
                    {detailSlot.slot.bookedBy.phone}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-mutedText">Current Status</span>
                <StatusBadge status={detailSlot.slot.status} />
              </div>
            </div>

            {/* Cancellation Section */}
            {cancelResult ? (
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>Cancellation Processed</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Percentage</span>
                  <span className="font-bold">{cancelResult.refundPercentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Amount</span>
                  <MoneyText paise={cancelResult.refundPaise} className="font-bold" />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-mutedText">Cancellation Reason</label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason for cancelling..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-400 text-xs">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    Server cancellation policy applies refund tier based on hours before start.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={cancelBookingMutation.isPending}
                  onClick={() => cancelBookingMutation.mutate(detailSlot.slot.bookingId!)}
                  className="w-full py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  {cancelBookingMutation.isPending ? 'Processing...' : 'Cancel Booking & Refund'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Social Session Signup Sheet */}
      {socialSlot && socialSlot.slot.social && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-lime">
                  Social Play Session
                </span>
                <h3 className="text-lg font-black text-primaryText">
                  {socialSlot.slot.social.title}
                </h3>
              </div>
              <button
                onClick={() => setSocialSlot(null)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-canvas border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-mutedText">Time Window</span>
                <span className="font-semibold text-primaryText">
                  {formatTime(socialSlot.slot.startAt)} – {formatTime(socialSlot.slot.endAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Capacity</span>
                <span className="font-bold text-primaryText">
                  {socialSlot.slot.social.capacity} Players Max
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Spots Available</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {socialSlot.slot.social.spotsLeft} Left
                </span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-border">
                <span className="text-mutedText">Entry Fee / Head</span>
                <MoneyText
                  paise={socialSlot.slot.social.pricePerHeadPaise}
                  className="font-bold text-sm text-accent-orange"
                />
              </div>
            </div>

            {/* Member search for social signup */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-mutedText">Member Signup</label>
              <input
                type="text"
                placeholder="Search member name..."
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
              />

              {membersResult?.items && membersResult.items.length > 0 && !selectedMember && (
                <div className="rounded-xl border border-border bg-surface divide-y divide-border/60">
                  {membersResult.items.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        setSelectedMember(m);
                        setMemberSearch(m.fullName);
                      }}
                      className="p-2 hover:bg-canvas cursor-pointer text-xs flex justify-between"
                    >
                      <span className="font-semibold">{m.fullName}</span>
                      <span className="text-mutedText">{m.phone}</span>
                    </div>
                  ))}
                </div>
              )}

              {selectedMember && (
                <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex justify-between items-center text-xs">
                  <span className="font-bold">{selectedMember.fullName}</span>
                  <button
                    onClick={() => setSelectedMember(null)}
                    className="text-red-500 text-[11px]"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={socialSignupMutation.isPending || !selectedMember}
              onClick={() => socialSignupMutation.mutate(socialSlot.slot.social!.sessionId)}
              className="w-full py-2.5 rounded-xl bg-accent-lime hover:bg-accent-lime/90 text-lime-950 font-bold text-xs uppercase tracking-wider transition-colors shadow-md disabled:opacity-50"
            >
              {socialSignupMutation.isPending
                ? 'Registering...'
                : socialSlot.slot.social.spotsLeft > 0
                ? 'Confirm Social Signup'
                : 'Join Waitlist'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
