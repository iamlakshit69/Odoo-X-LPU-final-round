import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../api/client';
import { MoneyText } from '../../../components/shared/MoneyText';
import { StatusBadge } from '../../../components/shared/StatusBadge';
import { DraggableCardCarousel } from '../../../components/bento/DraggableCardCarousel';
import { LoadingState } from '../../../components/shared/States';
import { useToast } from '../../../lib/toast';
import { formatDate } from '../../../lib/utils';
import type { Plan, PlanCode, InvoiceDetail } from '@club/contract';
import {
  User,
  Phone,
  Mail,
  Calendar,
  FileText,
  CheckCircle,
  CreditCard,
  Receipt,
  ArrowRight,
  ArrowLeft,
  QrCode,
  ShieldCheck,
} from 'lucide-react';

export function NewMember({ onDone }: { onDone?: () => void }) {
  const queryClient = useQueryClient();
  const { showToast, showError } = useToast();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  // Creation results
  const [createdData, setCreatedData] = useState<{
    memberId: string;
    memberCode: string;
    invoiceId: string;
    qrToken: string;
  } | null>(null);

  // Payment dialog state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi'>('upi');
  const [paymentRef, setPaymentRef] = useState('UPI-REF-' + Math.floor(100000 + Math.random() * 900000));

  // Fetch plans for carousel
  const { data: plans = [], isLoading: isLoadingPlans } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: () => api.members.listPlans(),
  });

  // Auto-select first plan when loaded
  React.useEffect(() => {
    if (!selectedPlan && plans.length > 0) {
      setSelectedPlan(plans[0]);
    }
  }, [plans, selectedPlan]);

  // Fetch invoice details when step 5 is active
  const { data: invoiceDetail, refetch: refetchInvoice } = useQuery<InvoiceDetail>({
    queryKey: ['invoice-detail', createdData?.invoiceId],
    queryFn: () => api.invoices.get(createdData!.invoiceId),
    enabled: !!createdData?.invoiceId && (step === 4 || step === 5),
  });

  // Member creation mutation
  const createMemberMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlan) throw new Error('Please choose a plan');
      return api.members.create({
        fullName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() ? email.trim() : undefined,
        dob: dob || undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        planCode: selectedPlan.code as PlanCode,
      });
    },
    onSuccess: (data) => {
      setCreatedData({
        memberId: data.member.id,
        memberCode: data.member.memberCode,
        invoiceId: data.invoiceId,
        qrToken: data.qrToken,
      });
      showToast('success', 'Member Created!', `${data.member.fullName} (${data.member.memberCode}) enrolled.`);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setStep(4);
    },
    onError: (err) => {
      showError(err, 'Failed to create member profile.');
    },
  });

  // Payment mutation
  const recordPaymentMutation = useMutation({
    mutationFn: () => {
      if (!createdData?.invoiceId || !invoiceDetail) throw new Error('Invoice not found');
      return api.invoices.recordPayment(createdData.invoiceId, {
        method: paymentMethod,
        amountPaise: invoiceDetail.outstandingPaise,
        reference: paymentRef,
      });
    },
    onSuccess: (data) => {
      showToast('success', 'Payment Recorded!', `Invoice settled. Outstanding: ₹${data.outstandingPaise / 100}`);
      refetchInvoice();
      setStep(5);
    },
    onError: (err) => {
      showError(err, 'Payment could not be recorded.');
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in py-4">
      {/* Step Progress Bar */}
      <div className="rounded-[24px] border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Personal Details' },
            { num: 2, label: 'Plan Selection' },
            { num: 3, label: 'Confirm Review' },
            { num: 4, label: 'Invoice & Payment' },
            { num: 5, label: 'Completed' },
          ].map((s) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step === s.num
                    ? 'bg-accent-orange text-white ring-4 ring-accent-orange/20 shadow-md'
                    : step > s.num
                    ? 'bg-emerald-500 text-white'
                    : 'bg-canvas text-mutedText border border-border'
                }`}
              >
                {step > s.num ? <CheckCircle className="w-4 h-4" /> : s.num}
              </div>
              <span className="hidden md:block text-xs font-semibold text-primaryText">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: Personal Details */}
      {step === 1 && (
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-primaryText">Member Personal Details</h2>
            <p className="text-xs text-mutedText">Enter member contact info and registration details.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Full Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Rohini Sen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Phone Number *</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9811223344"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
                <input
                  type="email"
                  placeholder="e.g. rohini@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-mutedText">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-mutedText">Notes & Remarks</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-mutedText" />
                <textarea
                  rows={2}
                  placeholder="Referrals, sport interests, locker requests..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:ring-1 focus:ring-accent-orange focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-border">
            <button
              type="button"
              disabled={!fullName.trim() || !phone.trim()}
              onClick={() => setStep(2)}
              className="px-6 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md"
            >
              <span>Continue to Plans</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Plan Selection Carousel */}
      {step === 2 && (
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-primaryText">Select Membership Tier</h2>
            <p className="text-xs text-mutedText">
              Browse seeded membership plans with advance booking perks and daily quotas.
            </p>
          </div>

          {isLoadingPlans ? (
            <LoadingState message="Loading membership tiers from API..." />
          ) : (
            <DraggableCardCarousel
              plans={plans}
              selectedPlanId={selectedPlan?.id}
              onSelectPlan={(plan) => setSelectedPlan(plan)}
            />
          )}

          <div className="flex justify-between items-center pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-mutedText hover:text-primaryText flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              disabled={!selectedPlan}
              onClick={() => setStep(3)}
              className="px-6 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md"
            >
              <span>Review & Confirm</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirm Review */}
      {step === 3 && selectedPlan && (
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-5 animate-fade-in">
          <div>
            <h2 className="text-xl font-black text-primaryText">Confirm Member Enrollment</h2>
            <p className="text-xs text-mutedText">Review details before issuing membership and invoice.</p>
          </div>

          <div className="p-4 rounded-2xl bg-canvas border border-border space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-mutedText">Full Name</span>
              <span className="font-bold text-primaryText">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-mutedText">Phone</span>
              <span className="font-mono font-semibold text-primaryText">{phone}</span>
            </div>
            {email && (
              <div className="flex justify-between">
                <span className="text-mutedText">Email</span>
                <span className="font-semibold text-primaryText">{email}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-border/60">
              <span className="text-mutedText">Selected Plan</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-accent-lime/20 text-lime-900 dark:text-lime-300">
                {selectedPlan.name} ({selectedPlan.code})
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-mutedText">Membership Fee</span>
              <MoneyText paise={selectedPlan.pricePaise} className="text-base font-extrabold text-accent-orange" />
            </div>
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-border">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-mutedText hover:text-primaryText flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              disabled={createMemberMutation.isPending}
              onClick={() => createMemberMutation.mutate()}
              className="px-6 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-md"
            >
              {createMemberMutation.isPending ? 'Enrolling...' : 'Issue Membership & Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Invoice View & Record Payment */}
      {step === 4 && (
        <div className="rounded-[24px] border border-border bg-surface p-6 shadow-md space-y-5 animate-fade-in">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" /> Member Registered Successfully
            </span>
            <h2 className="text-xl font-black text-primaryText mt-1">Invoice & Payment Collection</h2>
            <p className="text-xs text-mutedText">
              Invoice #{invoiceDetail?.number || 'INV-PENDING'} generated for {fullName}.
            </p>
          </div>

          {/* Invoice Breakdown Straight from API */}
          {invoiceDetail ? (
            <div className="p-4 rounded-2xl bg-canvas border border-border space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-border">
                <span className="font-mono text-mutedText">{invoiceDetail.number}</span>
                <StatusBadge status={invoiceDetail.balanceStatus || 'unpaid'} />
              </div>

              {invoiceDetail.lines?.map((line, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-primaryText">{line.description}</span>
                    <span className="text-[10px] text-mutedText block">Qty: {line.qty}</span>
                  </div>
                  <MoneyText paise={line.totalPaise} className="font-semibold" />
                </div>
              ))}

              <div className="pt-2 border-t border-border/60 space-y-1">
                <div className="flex justify-between text-mutedText">
                  <span>Subtotal</span>
                  <MoneyText paise={invoiceDetail.subtotalPaise} />
                </div>
                <div className="flex justify-between text-mutedText">
                  <span>CGST (9%)</span>
                  <MoneyText paise={invoiceDetail.cgstPaise} />
                </div>
                <div className="flex justify-between text-mutedText">
                  <span>SGST (9%)</span>
                  <MoneyText paise={invoiceDetail.sgstPaise} />
                </div>
                <div className="flex justify-between items-baseline pt-2 border-t border-border font-bold text-sm">
                  <span>Total Amount</span>
                  <MoneyText paise={invoiceDetail.totalPaise} className="text-base text-accent-orange" />
                </div>
                <div className="flex justify-between items-baseline text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Outstanding Balance</span>
                  <MoneyText paise={invoiceDetail.outstandingPaise} />
                </div>
              </div>
            </div>
          ) : (
            <LoadingState message="Loading invoice from ledger..." />
          )}

          {/* Record Payment Form */}
          {invoiceDetail && invoiceDetail.outstandingPaise > 0 && (
            <div className="p-4 rounded-2xl bg-surface-muted border border-border space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primaryText">
                Record Payment
              </h4>

              <div className="grid grid-cols-3 gap-2">
                {(['upi', 'card', 'cash'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold uppercase transition-all ${
                      paymentMethod === m
                        ? 'bg-accent-orange text-white shadow-sm'
                        : 'bg-surface border border-border text-mutedText hover:text-primaryText'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-mutedText">Payment Reference / Txn ID</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="UPI / Card approval code..."
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                />
              </div>

              <button
                type="button"
                disabled={recordPaymentMutation.isPending}
                onClick={() => recordPaymentMutation.mutate()}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  {recordPaymentMutation.isPending
                    ? 'Recording...'
                    : `Record ₹${invoiceDetail.outstandingPaise / 100} Payment`}
                </span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 5: Success & QR Token Display */}
      {step === 5 && createdData && (
        <div className="rounded-[24px] border border-border bg-surface p-8 shadow-md text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-black text-primaryText">Membership Active!</h2>
            <p className="text-xs text-mutedText mt-1">
              Member code <span className="font-bold text-primaryText">{createdData.memberCode}</span> is fully paid and ready for court bookings.
            </p>
          </div>

          {/* QR Token Chip */}
          <div className="p-4 rounded-2xl bg-canvas border border-border inline-block mx-auto text-center space-y-2">
            <div className="w-32 h-32 mx-auto rounded-xl bg-surface border border-border flex items-center justify-center">
              <QrCode className="w-20 h-20 text-accent-orange" />
            </div>
            <span className="text-[11px] font-mono text-mutedText block">
              Token: {createdData.qrToken}
            </span>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setFullName('');
                setPhone('');
                setEmail('');
                setCreatedData(null);
              }}
              className="px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-canvas text-xs font-semibold text-primaryText"
            >
              Enroll Another Member
            </button>
            {onDone && (
              <button
                type="button"
                onClick={onDone}
                className="px-6 py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white text-xs font-bold uppercase tracking-wider shadow-md"
              >
                Go to Front Desk
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
