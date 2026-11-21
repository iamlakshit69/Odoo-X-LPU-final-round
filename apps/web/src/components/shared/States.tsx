import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function LoadingState({ message = 'Loading champions data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center min-h-[220px]">
      <Loader2 className="w-8 h-8 text-accent-orange animate-spin mb-3" />
      <p className="text-sm font-medium text-mutedText">{message}</p>
    </div>
  );
}

export function EmptyState({
  title = 'No records found',
  description = 'There are no items to display matching the criteria.',
  action,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl border border-dashed border-border bg-surface-muted/30 min-h-[240px]">
      <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center text-mutedText shadow-sm mb-3">
        <Inbox className="w-6 h-6" />
      </div>
      <h3 className="text-base font-semibold text-primaryText mb-1">{title}</h3>
      <p className="text-xs text-mutedText max-w-sm mb-4">{description}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = 'Failed to load data',
  message = 'An unexpected error occurred while contacting the server.',
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-10 text-center rounded-2xl border border-red-500/20 bg-red-500/5 min-h-[200px]">
      <AlertCircle className="w-8 h-8 text-red-500 mb-2" />
      <h3 className="text-base font-semibold text-red-600 dark:text-red-400 mb-1">{title}</h3>
      <p className="text-xs text-mutedText max-w-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-surface border border-border hover:bg-canvas text-primaryText transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
