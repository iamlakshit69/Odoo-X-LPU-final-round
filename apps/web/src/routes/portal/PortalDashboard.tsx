import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '../../api/client';
import { useAuth } from '../../auth/AuthContext';
import { MoneyText } from '../../components/shared/MoneyText';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { LoadingState, EmptyState, ErrorState } from '../../components/shared/States';
import { SportSpotlightRotator } from '../../components/bento/SportSpotlightRotator';
import { PriceBreakdown } from '../../components/shared/PriceBreakdown';
import { useToast } from '../../lib/toast';
import { formatDate, formatTime, getTodayDateString } from '../../lib/utils';
import type { Booking, CourtWithPublicSlots, PublicSlot } from '@club/contract';
import {
  Calendar,
  Clock,
  RotateCw,
  XCircle,
  Shield,
  ShoppingBag,
  Receipt,
  Bell,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  CreditCard,
  Printer,
  ChevronRight,
  Sparkles,
  MapPin,
  Lock,
} from 'lucide-react';

interface PortalDashboardProps {
  onNavigateBookCourt?: () => void;
  onNavigateLogin?: () => void;
}

type PortalTab = 'dashboard' | 'book' | 'bookings' | 'shop' | 'invoices' | 'notifications';

export function PortalDashboard({ onNavigateBookCourt, onNavigateLogin }: PortalDashboardProps) {
  const { user, memberId, activePlan, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');

  // 1. Fetch Member Profile & Membership Dates
  const { data: memberProfile } = useQuery({
    queryKey: ['member-profile', memberId],
    queryFn: () => (memberId ? api.members.get(memberId) : null),
    enabled: !!memberId,
  });

  // Calculate expiry countdown (display only, no date arithmetic business logic)
  const endsOn = memberProfile?.membership?.endsOn || memberProfile?.endsOn;
  const expiryCountdownDays = React.useMemo(() => {
    if (!endsOn) return null;
    const diff = new Date(endsOn).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [endsOn]);

  // 2. Fetch Member's Upcoming Bookings
  const { data: bookingsData, isLoading: isBookingsLoading } = useQuery({
    queryKey: ['portal-bookings', memberId],
    queryFn: () => api.bookings.list({ memberId: memberId || undefined }),
    enabled: !!memberId,
  });

  // 3. Cancel Booking Mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.bookings.cancel(id, { reason: 'Member cancelled from portal' }),
    onSuccess: (data) => {
      showToast(
        'info',
        'Booking Cancelled',
        `Refund: ₹${((data.refundPaise || 0) / 100).toFixed(2)} (${data.refundPercentage ?? 0}% tier applied)`
      );
      queryClient.invalidateQueries({ queryKey: ['portal-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['availability'] });
      queryClient.invalidateQueries({ queryKey: ['public-availability'] });
    },
    onError: (err: any) => {
      showError(err, 'Failed to cancel booking');
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-accent-orange/15 text-accent-orange flex items-center justify-center mx-auto">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-primaryText">Member Portal Sign-In</h2>
        <p className="text-xs text-mutedText">
          Please log in with your member account to access court bookings, membership benefits, pro shop discounts, and invoices.
        </p>
        <button
          onClick={onNavigateLogin}
          className="px-6 py-2.5 rounded-full bg-accent-orange text-white text-xs font-bold uppercase tracking-wider shadow-md hover:bg-accent-orange/90 transition-all"
        >
          Sign In as Member
        </button>
      </div>
    );
  }

  const upcomingBookings = (bookingsData?.items || []).filter(
    (b) => b.status === 'confirmed' || b.status === 'held'
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in py-4">
      {/* Member Profile Banner */}
      <div className="rounded-[28px] border border-border bg-surface p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-accent-orange to-amber-500 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-accent-orange/20 shrink-0">
            {user?.name.charAt(0) || 'M'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">
                Champions Club Member
              </span>
              {memberProfile?.memberCode && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-canvas border border-border text-mutedText">
                  {memberProfile.memberCode}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-primaryText">{user?.name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300">
                {activePlan || 'Gold'} Tier
              </span>
              {expiryCountdownDays !== null && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-canvas border border-border text-primaryText">
                  <span className="text-accent-orange font-bold">{expiryCountdownDays} days</span> until renewal
                </span>
              )}
              {endsOn && (
                <span className="text-xs text-mutedText font-mono">
                  (Valid till {endsOn})
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('book')}
            className="px-5 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5"
          >
            <Calendar className="w-4 h-4" />
            <span>Book Court</span>
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className="px-4 py-2.5 rounded-xl bg-canvas border border-border hover:bg-surface text-primaryText text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4 text-accent-orange" />
            <span>Pro Shop</span>
          </button>
        </div>
      </div>

      {/* Portal Navigation Tabs */}
      <div className="flex border-b border-border px-2 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'dashboard', label: 'My Dashboard', icon: <Sparkles className="w-4 h-4" /> },
          { id: 'book', label: 'Self-Service Booking', icon: <Calendar className="w-4 h-4" /> },
          { id: 'bookings', label: 'My Bookings', icon: <Clock className="w-4 h-4" /> },
          { id: 'shop', label: 'Pro Shop', icon: <ShoppingBag className="w-4 h-4" /> },
          { id: 'invoices', label: 'My Invoices', icon: <Receipt className="w-4 h-4" /> },
          { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as PortalTab)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'border-accent-orange text-accent-orange'
                : 'border-transparent text-mutedText hover:text-primaryText'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Dashboard Overview */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-border bg-surface shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-mutedText">
                Active Tier
              </span>
              <div className="text-xl font-black text-primaryText capitalize">{activePlan || 'Gold'}</div>
              <p className="text-[11px] text-mutedText">
                {activePlan === 'gold'
                  ? 'Complimentary court booking at all times'
                  : activePlan === 'silver'
                  ? '40% peak, 60% off-peak court discount'
                  : 'Junior member tier with court discounts'}
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-surface shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-mutedText">
                Validity & Expiry
              </span>
              <div className="text-xl font-black text-accent-orange">
                {expiryCountdownDays !== null ? `${expiryCountdownDays} Days Left` : 'Active'}
              </div>
              <p className="text-[11px] text-mutedText">Renewal date: {endsOn || 'Continuous'}</p>
            </div>

            <div className="p-5 rounded-2xl border border-border bg-surface shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-mutedText">
                Upcoming Sessions
              </span>
              <div className="text-xl font-black text-primaryText">{upcomingBookings.length} Booked</div>
              <p className="text-[11px] text-mutedText">Reserved courts in your schedule</p>
            </div>
          </div>

          {/* Sport Spotlight Rotator in Portal */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-primaryText">Facility Spotlights & Programs</h3>
            <SportSpotlightRotator />
          </div>

          {/* Upcoming Bookings Preview */}
          <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/80">
              <div>
                <h3 className="text-base font-bold text-primaryText">Upcoming Sessions</h3>
                <p className="text-xs text-mutedText">Your active court reservations.</p>
              </div>
              <button
                onClick={() => setActiveTab('bookings')}
                className="text-xs font-semibold text-accent-orange hover:underline flex items-center gap-1"
              >
                View All <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingBookings.length > 0 ? (
              <div className="space-y-3">
                {upcomingBookings.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-2xl border border-border bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-primaryText">
                          {b.courtName || 'Court Booking'}
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
                      <button
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No Upcoming Bookings"
                description="You don't have any court sessions booked right now."
                action={
                  <button
                    onClick={() => setActiveTab('book')}
                    className="px-4 py-2 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-wider"
                  >
                    Book a Court Now
                  </button>
                }
              />
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Self-Service Court Booking Grid */}
      {activeTab === 'book' && (
        <PortalCourtBooking memberId={memberId} activePlan={activePlan} />
      )}

      {/* Tab 3: My Bookings Full List */}
      {activeTab === 'bookings' && (
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div>
              <h3 className="text-lg font-black text-primaryText">All My Bookings</h3>
              <p className="text-xs text-mutedText">Upcoming, completed, and cancelled reservations.</p>
            </div>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['portal-bookings'] })}
              className="p-1.5 rounded-lg border border-border hover:bg-canvas text-mutedText"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {isBookingsLoading ? (
            <LoadingState message="Fetching member bookings..." />
          ) : (bookingsData?.items || []).length > 0 ? (
            <div className="space-y-3">
              {(bookingsData?.items || []).map((b) => (
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
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(b.id)}
                        className="px-3 py-1.5 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancel Booking</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No Bookings Found"
              description="No past or current court reservations found."
            />
          )}
        </div>
      )}

      {/* Tab 4: Member Pro Shop Ordering */}
      {activeTab === 'shop' && (
        <PortalShopOrdering memberId={memberId} />
      )}

      {/* Tab 5: My Invoices */}
      {activeTab === 'invoices' && (
        <PortalInvoices memberId={memberId} />
      )}

      {/* Tab 6: Notifications Inbox */}
      {activeTab === 'notifications' && (
        <PortalNotifications />
      )}
    </div>
  );
}

// Subcomponent: Self-Service Court Booking Grid
function PortalCourtBooking({
  memberId,
  activePlan,
}: {
  memberId?: string | null;
  activePlan?: string | null;
}) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [date, setDate] = useState(() => getTodayDateString());
  const [selectedSlot, setSelectedSlot] = useState<{
    courtId: string;
    courtName: string;
    courtTypeCode: string;
    startAt: string;
    basePricePaise: number;
  } | null>(null);

  // Fetch Public Availability (other people's bookings are masked as 'taken', strictly no personal data)
  const { data: availabilityData, isLoading, refetch } = useQuery({
    queryKey: ['public-availability', date],
    queryFn: () => api.courts.getPublicAvailability(date),
  });

  // Fetch quote when slot is selected
  const { data: quote, isLoading: isQuoteLoading } = useQuery({
    queryKey: ['portal-court-quote', selectedSlot?.courtId, selectedSlot?.startAt, memberId],
    queryFn: () =>
      selectedSlot
        ? api.pricing.quote({
            kind: 'court',
            scopeRef: selectedSlot.courtTypeCode,
            basePricePaise: selectedSlot.basePricePaise,
            qty: 1,
            memberId: memberId || undefined,
            channel: 'online',
            at: selectedSlot.startAt,
          })
        : null,
    enabled: !!selectedSlot,
  });

  // Book slot mutation
  const bookMutation = useMutation({
    mutationFn: () => {
      if (!selectedSlot) throw new Error('No slot selected');
      return api.bookings.create({
        courtId: selectedSlot.courtId,
        startAt: selectedSlot.startAt,
        memberId: memberId || undefined,
        channel: 'online',
      });
    },
    onSuccess: (res) => {
      showToast('success', 'Court Reserved!', `Session confirmed on ${selectedSlot?.courtName}.`);
      setSelectedSlot(null);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['portal-bookings'] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Booking failed';
      showToast('error', 'Booking Blocked', msg);
    },
  });

  return (
    <div className="rounded-[28px] border border-border bg-surface p-6 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/80">
        <div>
          <h3 className="text-lg font-black text-primaryText">Self-Service Court Grid</h3>
          <p className="text-xs text-mutedText">
            Other reservations are anonymized for privacy. Member entitlements applied automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-canvas border border-border text-primaryText"
          />
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg border border-border hover:bg-canvas text-mutedText"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <LoadingState message="Loading court availability schedule..." />
      ) : availabilityData?.courts?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {availabilityData.courts.map((c) => (
            <div key={c.court.id} className="p-4 rounded-2xl bg-canvas border border-border space-y-3">
              <div className="pb-2 border-b border-border/60">
                <span className="font-bold text-xs text-primaryText block">{c.court.name}</span>
                <span className="text-[10px] text-mutedText capitalize">{c.court.courtTypeName || 'Court'}</span>
              </div>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {c.slots.map((s, idx) => {
                  const isFree = s.status === 'free';
                  const isSocial = s.status === 'social';

                  return (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl text-xs flex items-center justify-between border transition-all ${
                        isFree
                          ? 'bg-surface hover:border-accent-orange cursor-pointer border-border'
                          : 'bg-surface/40 border-border/40 text-mutedText opacity-75'
                      }`}
                      onClick={() => {
                        if (isFree) {
                          setSelectedSlot({
                            courtId: c.court.id,
                            courtName: c.court.name,
                            courtTypeCode: c.court.courtTypeCode || 'tennis',
                            startAt: s.startAt,
                            basePricePaise: 150000,
                          });
                        }
                      }}
                    >
                      <span className="font-mono text-[11px] font-semibold text-primaryText">
                        {formatTime(s.startAt)} - {formatTime(s.endAt)}
                      </span>

                      {isFree ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Free
                        </span>
                      ) : isSocial ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-lime/20 text-lime-800 dark:text-lime-400">
                          Social
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-mutedText font-medium">
                          <Lock className="w-3 h-3" /> Booked
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No Courts Found" description="Could not load court availability." />
      )}

      {/* Slot Booking Confirmation Modal */}
      {selectedSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primaryText">Confirm Court Reservation</h3>
            <div className="p-4 rounded-2xl bg-canvas border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-mutedText">Court:</span>
                <span className="font-bold text-primaryText">{selectedSlot.courtName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Date & Time:</span>
                <span className="font-mono text-primaryText">
                  {formatDate(selectedSlot.startAt)} at {formatTime(selectedSlot.startAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Member Tier:</span>
                <span className="font-bold uppercase text-accent-orange">{activePlan || 'Gold'}</span>
              </div>
            </div>

            {/* Price Quote from API */}
            {isQuoteLoading ? (
              <LoadingState message="Fetching pricing engine quote..." />
            ) : quote ? (
              <div className="p-4 rounded-2xl bg-canvas border border-border space-y-2 text-xs">
                <div className="flex justify-between text-mutedText">
                  <span>List Price:</span>
                  <MoneyText paise={selectedSlot.basePricePaise} />
                </div>
                {quote.breakdown?.map((b: any, i: number) => (
                  <div key={i} className="flex justify-between text-emerald-600 dark:text-emerald-400">
                    <span>{b.label}:</span>
                    <span>-<MoneyText paise={Math.abs(b.deltaPaise)} /></span>
                  </div>
                ))}
                <div className="border-t border-border pt-2 flex justify-between font-black text-sm text-primaryText">
                  <span>Your Price:</span>
                  <MoneyText paise={quote.totalPaise} />
                </div>
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-mutedText"
              >
                Cancel
              </button>
              <button
                disabled={bookMutation.isPending || isQuoteLoading}
                onClick={() => bookMutation.mutate()}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-accent-orange text-white hover:bg-accent-orange/90 shadow-md disabled:opacity-40"
              >
                {bookMutation.isPending ? 'Reserving...' : 'Confirm Reservation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Member Pro Shop Ordering
function PortalShopOrdering({ memberId }: { memberId?: string | null }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [cart, setCart] = useState<Array<{ product: any; variant: any; qty: number }>>([]);
  const [fulfilment, setFulfilment] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // 1. Fetch public/portal products
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['portal-products'],
    queryFn: () => api.shop.getProducts({ active: true }),
  });

  const products = productsData?.items || [];

  const addToCart = (product: any, variant: any) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variant.id === variant.id);
      if (existing) {
        return prev.map((i) =>
          i.variant.id === variant.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { product, variant, qty: 1 }];
    });
    showToast('info', 'Added to Cart', `${product.name} (${variant.optionLabel}) added.`);
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((i) => i.variant.id !== variantId));
  };

  // Submit order mutation
  const orderMutation = useMutation({
    mutationFn: () => {
      return api.shop.createOrder({
        memberId: memberId || undefined,
        channel: 'online',
        fulfilment,
        deliveryAddress: fulfilment === 'delivery' ? deliveryAddress.trim() : undefined,
        items: cart.map((i) => ({
          variantId: i.variant.id,
          qty: i.qty,
        })),
      });
    },
    onSuccess: (order) => {
      showToast(
        'success',
        'Order Placed!',
        `Order #${order.id.slice(0, 8)} confirmed for ${fulfilment}.`
      );
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (err: any) => {
      const msg = err instanceof ApiClientError ? err.message : 'Order submission failed';
      showToast('error', 'Order Error', msg);
    },
  });

  if (isLoading) return <LoadingState message="Loading pro shop gear..." />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Product Grid */}
      <div className="lg:col-span-2 space-y-4">
        <div className="p-6 rounded-[28px] border border-border bg-surface shadow-sm">
          <h3 className="text-base font-bold text-primaryText mb-1">Pro Shop Equipment & Gear</h3>
          <p className="text-xs text-mutedText">
            Member discounts applied automatically by server pricing engine.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className="p-5 rounded-2xl border border-border bg-surface shadow-sm flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-bold text-accent-orange">
                    {p.category}
                  </span>
                  <span className="font-bold text-primaryText">
                    <MoneyText paise={p.basePricePaise} />
                  </span>
                </div>
                <h4 className="font-bold text-sm text-primaryText">{p.name}</h4>
                <p className="text-xs text-mutedText mt-1 line-clamp-2">{p.description}</p>
              </div>

              {p.variants?.length ? (
                <div className="space-y-2 border-t border-border/60 pt-3">
                  <span className="text-[10px] text-mutedText block">Select Variant / Option:</span>
                  <div className="space-y-1.5">
                    {p.variants.map((v: any) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between p-2 rounded-xl bg-canvas border border-border text-xs"
                      >
                        <div>
                          <span className="font-semibold text-primaryText">{v.optionLabel}</span>
                          <span className="text-[10px] text-mutedText block font-mono">
                            SKU: {v.sku}
                          </span>
                        </div>
                        <button
                          onClick={() => addToCart(p, v)}
                          className="px-3 py-1 rounded-lg bg-accent-orange text-white text-xs font-bold hover:bg-accent-orange/90"
                        >
                          Add +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {/* Cart & Checkout Panel */}
      <div className="p-6 rounded-[28px] border border-border bg-surface shadow-sm space-y-4 h-fit">
        <div className="flex items-center justify-between pb-2 border-b border-border/80">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-accent-orange" />
            <h4 className="text-sm font-bold text-primaryText">Cart ({cart.length})</h4>
          </div>
          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              className="text-[10px] text-mutedText hover:text-red-500"
            >
              Clear Cart
            </button>
          )}
        </div>

        {cart.length > 0 ? (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {cart.map((item) => (
                <div
                  key={item.variant.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-canvas border border-border text-xs"
                >
                  <div>
                    <span className="font-semibold text-primaryText block">{item.product.name}</span>
                    <span className="text-[10px] text-mutedText">
                      {item.variant.optionLabel} x {item.qty}
                    </span>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.variant.id)}
                    className="p-1 rounded-lg text-red-500 hover:bg-red-500/10"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Fulfilment Choice */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="text-[10px] text-mutedText block font-bold uppercase">
                Fulfillment Mode
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFulfilment('pickup')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                    fulfilment === 'pickup'
                      ? 'bg-accent-orange/15 border-accent-orange text-accent-orange'
                      : 'bg-canvas border-border text-mutedText'
                  }`}
                >
                  Pickup at Club
                </button>
                <button
                  type="button"
                  onClick={() => setFulfilment('delivery')}
                  className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
                    fulfilment === 'delivery'
                      ? 'bg-accent-orange/15 border-accent-orange text-accent-orange'
                      : 'bg-canvas border-border text-mutedText'
                  }`}
                >
                  Home Delivery
                </button>
              </div>

              {fulfilment === 'delivery' && (
                <div className="pt-2">
                  <label className="text-[10px] text-mutedText block mb-1">Delivery Address</label>
                  <textarea
                    rows={2}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter complete postal address..."
                    className="w-full p-2 text-xs rounded-xl bg-canvas border border-border text-primaryText"
                  />
                </div>
              )}
            </div>

            <button
              disabled={orderMutation.isPending || (fulfilment === 'delivery' && !deliveryAddress.trim())}
              onClick={() => orderMutation.mutate()}
              className="w-full py-2.5 rounded-xl bg-accent-orange text-white text-xs font-bold uppercase tracking-wider hover:bg-accent-orange/90 shadow-md disabled:opacity-40"
            >
              {orderMutation.isPending ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-mutedText border border-dashed border-border rounded-2xl">
            Your cart is empty. Pick equipment from the shop catalog.
          </div>
        )}
      </div>
    </div>
  );
}

// Subcomponent: Member Invoices
function PortalInvoices({ memberId }: { memberId?: string | null }) {
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['portal-invoices', memberId],
    queryFn: () => api.finance.getInvoices({ memberId: memberId || undefined, limit: 50 }),
    enabled: !!memberId,
  });

  if (isLoading) return <LoadingState message="Loading your invoices..." />;

  const invoices = invoicesData?.items || [];

  return (
    <div className="rounded-[28px] border border-border bg-surface p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-bold text-primaryText">My Billing & Tax Invoices</h3>
        <p className="text-xs text-mutedText">
          Historical records of membership fees, court bookings, and pro shop purchases.
        </p>
      </div>

      {invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="p-4 rounded-2xl border border-border bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-primaryText">{inv.number}</span>
                  <StatusBadge status={inv.balanceStatus || inv.status} />
                </div>
                <span className="text-[11px] text-mutedText font-mono">
                  Issued: {new Date(inv.issuedAt).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-[10px] text-mutedText block">Charged</span>
                  <span className="font-bold text-primaryText">
                    <MoneyText paise={inv.totalPaise} />
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-mutedText block">Outstanding</span>
                  <span className={`font-bold ${inv.outstandingPaise > 0 ? 'text-amber-500' : 'text-mutedText'}`}>
                    <MoneyText paise={inv.outstandingPaise} />
                  </span>
                </div>

                <button
                  onClick={() => setSelectedInvoice(inv)}
                  className="px-3 py-1.5 rounded-xl border border-border hover:bg-surface text-accent-orange font-semibold flex items-center gap-1"
                >
                  <Receipt className="w-3.5 h-3.5" /> Details
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No Invoices" description="You have no recorded invoices." />
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg p-6 rounded-3xl bg-surface border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="font-bold text-base text-primaryText">{selectedInvoice.number}</span>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-xs text-mutedText hover:text-primaryText"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-mutedText">Date:</span>
                <span>{new Date(selectedInvoice.issuedAt).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-mutedText">Status:</span>
                <StatusBadge status={selectedInvoice.balanceStatus || selectedInvoice.status} />
              </div>
              <div className="flex justify-between font-bold border-t border-border pt-2">
                <span>Total Amount:</span>
                <MoneyText paise={selectedInvoice.totalPaise} />
              </div>
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Paid Amount:</span>
                <MoneyText paise={selectedInvoice.paidPaise || 0} />
              </div>
              <div className="flex justify-between text-amber-500 font-bold">
                <span>Outstanding:</span>
                <MoneyText paise={selectedInvoice.outstandingPaise || 0} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-canvas border border-border text-primaryText hover:bg-surface"
              >
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Subcomponent: Member Notifications Inbox
function PortalNotifications() {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: notifsData, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return { items: [] };
      return res.json();
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  if (isLoading) return <LoadingState message="Loading notification inbox..." />;

  const items = notifsData?.items || [];

  return (
    <div className="rounded-[28px] border border-border bg-surface p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-bold text-primaryText">Notification Inbox</h3>
        <p className="text-xs text-mutedText">
          Booking confirmations, renewal alerts, and club messages.
        </p>
      </div>

      {items.length > 0 ? (
        <div className="space-y-2.5">
          {items.map((n: any) => (
            <div
              key={n.id}
              className={`p-3.5 rounded-2xl border text-xs flex items-start justify-between gap-3 ${
                n.status !== 'read'
                  ? 'bg-accent-orange/10 border-accent-orange/30 text-primaryText'
                  : 'bg-canvas border-border/60 text-mutedText'
              }`}
            >
              <div>
                <span className="font-bold text-primaryText block">{n.template}</span>
                <p className="text-xs text-primaryText/90 mt-0.5">
                  {n.payload?.body || n.payload?.title || JSON.stringify(n.payload || {})}
                </p>
                <span className="text-[10px] text-mutedText mt-1 block">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </div>

              {n.status !== 'read' && (
                <button
                  onClick={() => markReadMutation.mutate(n.id)}
                  className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-surface border border-border text-accent-orange hover:bg-canvas shrink-0"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Inbox Clean" description="No unread club notifications." />
      )}
    </div>
  );
}
