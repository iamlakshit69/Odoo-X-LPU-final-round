import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { SportSpotlightRotator } from '../../components/bento/SportSpotlightRotator';
import { DraggableCardCarousel } from '../../components/bento/DraggableCardCarousel';
import { MoneyText } from '../../components/shared/MoneyText';
import { StatusBadge } from '../../components/shared/StatusBadge';
import { useToast } from '../../lib/toast';
import { getTodayDateString, formatTime, formatDate } from '../../lib/utils';
import type { Plan } from '@club/contract';
import {
  Sparkles,
  ArrowRight,
  Shield,
  Calendar,
  CheckCircle2,
  Send,
  X,
  Phone,
  Mail,
  User,
} from 'lucide-react';

interface PublicHomeProps {
  onNavigateStaff?: () => void;
  onNavigatePortal?: () => void;
}

export function PublicHome({ onNavigateStaff, onNavigatePortal }: PublicHomeProps) {
  const { showToast, showError } = useToast();
  const [trialModalOpen, setTrialModalOpen] = useState(false);
  const [trialName, setTrialName] = useState('');
  const [trialPhone, setTrialPhone] = useState('');
  const [trialEmail, setTrialEmail] = useState('');
  const [trialSport, setTrialSport] = useState('tennis');
  const [isSubmittingTrial, setIsSubmittingTrial] = useState(false);

  // Fetch plans from API
  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['plans-list'],
    queryFn: () => api.members.listPlans(),
  });

  // Fetch public availability for today
  const today = getTodayDateString();
  const { data: publicAvailability } = useQuery({
    queryKey: ['public-availability', today],
    queryFn: () => api.courts.getPublicAvailability(today),
  });

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trialName || !trialPhone) return;

    try {
      setIsSubmittingTrial(true);
      const res = await fetch('/api/public/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trialName,
          phone: trialPhone,
          email: trialEmail || undefined,
          sportInterest: trialSport,
          notes: 'Trial booking request from landing page.',
        }),
      });

      if (!res.ok) throw new Error('Failed to submit enquiry');
      showToast('success', 'Trial Request Received', 'A club manager will contact you shortly to confirm your session.');
      setTrialModalOpen(false);
      setTrialName('');
      setTrialPhone('');
      setTrialEmail('');
    } catch (err) {
      showError(err, 'Failed to submit enquiry');
    } finally {
      setIsSubmittingTrial(false);
    }
  };

  return (
    <div className="space-y-12 animate-fade-in py-4">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[28px] border border-border bg-surface p-8 md:p-14 shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-orange/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-accent-lime/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-orange/15 border border-accent-orange/30 text-accent-orange text-xs font-extrabold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5" />
            <span>World-Class Sporting Experience</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-primaryText leading-[1.08]">
            Play like a champion, <span className="text-accent-orange">thrive</span> together.
          </h1>

          <p className="text-sm sm:text-base text-mutedText max-w-xl leading-relaxed">
            Eight professional courts across Tennis, Padel, Badminton, and Cricket nets.
            Complete with members lounge, pro shop gear, and state-of-the-art training facilities.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => setTrialModalOpen(true)}
              className="px-6 py-3 rounded-full bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-all duration-200 shadow-lg shadow-accent-orange/30 flex items-center gap-2"
            >
              <span>Book a Trial Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onNavigateStaff}
              className="px-6 py-3 rounded-full border border-border bg-surface hover:bg-canvas text-primaryText font-bold text-xs uppercase tracking-wider transition-all shadow-sm"
            >
              Staff Portal Access
            </button>
          </div>
        </div>
      </section>

      {/* Bento Spotlight & Sport Highlights */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
              Facilities & Arenas
            </span>
            <h2 className="text-2xl font-black text-primaryText">Sport Spotlight</h2>
          </div>
        </div>

        <SportSpotlightRotator />
      </section>

      {/* Membership Tiers Showcase */}
      <section className="space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-lime">
            Membership Plans
          </span>
          <h2 className="text-2xl font-black text-primaryText">Join the Champions Circle</h2>
        </div>

        <DraggableCardCarousel
          plans={plans}
          onSelectPlan={() => setTrialModalOpen(true)}
        />
      </section>

      {/* Public Court Availability Strip */}
      {publicAvailability?.courts && (
        <section className="rounded-[24px] border border-border bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-mutedText">
                Today's Schedule
              </span>
              <h3 className="text-lg font-black text-primaryText">Court Availability Preview</h3>
            </div>
            <span className="text-xs font-mono text-mutedText">{today}</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {publicAvailability.courts.slice(0, 4).map((c) => {
              const freeCount = c.slots.filter((s) => s.status === 'free').length;
              return (
                <div key={c.court.id} className="p-3 rounded-xl border border-border bg-canvas space-y-1">
                  <span className="font-bold text-xs text-primaryText block">{c.court.name}</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                    {freeCount} free slots today
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Book a Trial Modal */}
      {trialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-[24px] border border-border bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-accent-orange">
                  Trial Booking
                </span>
                <h3 className="text-lg font-black text-primaryText">Experience Champions Club</h3>
              </div>
              <button
                onClick={() => setTrialModalOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTrialSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Your Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={trialName}
                  onChange={(e) => setTrialName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={trialPhone}
                  onChange={(e) => setTrialPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. priya@example.com"
                  value={trialEmail}
                  onChange={(e) => setTrialEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-mutedText">Sport Interest</label>
                <select
                  value={trialSport}
                  onChange={(e) => setTrialSport(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-canvas text-xs text-primaryText focus:outline-none"
                >
                  <option value="tennis">Tennis</option>
                  <option value="padel">Padel</option>
                  <option value="badminton">Badminton</option>
                  <option value="cricket">Cricket</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingTrial}
                className="w-full py-2.5 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-md flex items-center justify-center gap-2 mt-4"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmittingTrial ? 'Submitting...' : 'Send Trial Request'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
