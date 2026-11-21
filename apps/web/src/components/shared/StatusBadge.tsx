import React from 'react';

type StatusType =
  // Slots
  | 'free'
  | 'confirmed'
  | 'held'
  | 'social'
  | 'blocked'
  | 'taken'
  // Bookings
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show'
  // Memberships
  | 'active'
  | 'suspended'
  // Finance & Balances
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overpaid'
  | 'draft'
  | 'issued'
  | 'void'
  // Social waitlist
  | 'waitlisted'
  | string;

interface StatusBadgeProps {
  status: StatusType | null | undefined;
  label?: string;
  className?: string;
}

export function StatusBadge({ status, label, className = '' }: StatusBadgeProps) {
  if (!status) return null;

  const s = String(status).toLowerCase();
  const displayLabel = label || s.replace('_', ' ').toUpperCase();

  let colorClasses = 'bg-surface-muted text-mutedText border-border';

  switch (s) {
    case 'free':
    case 'active':
    case 'paid':
    case 'confirmed':
    case 'completed':
      colorClasses =
        'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30';
      break;
    case 'held':
    case 'partial':
    case 'draft':
    case 'waitlisted':
      colorClasses = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30';
      break;
    case 'social':
      colorClasses =
        'bg-accent-lime/15 text-lime-800 dark:text-lime-400 border-accent-lime/40';
      break;
    case 'blocked':
    case 'cancelled':
    case 'void':
    case 'no_show':
    case 'suspended':
      colorClasses = 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30';
      break;
    case 'taken':
    case 'unpaid':
    case 'expired':
      colorClasses = 'bg-stone-500/10 text-stone-700 dark:text-stone-300 border-stone-500/30';
      break;
    case 'overpaid':
      colorClasses = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${colorClasses} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-80" />
      {displayLabel}
    </span>
  );
}
