import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, CheckCircle, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

const ERROR_CODE_MAP: Record<string, string> = {
  SLOT_TAKEN: 'That slot was just taken, please select another slot.',
  DAILY_LIMIT: 'Daily booking limit reached for this membership plan.',
  MEMBERSHIP_INACTIVE: 'Membership is inactive or expired. Please renew first.',
  OUT_OF_STOCK: 'Requested inventory item is currently out of stock.',
  OVERPAYMENT: 'Payment amount exceeds the outstanding invoice balance.',
  FORBIDDEN: 'Access denied: You do not have permission for this action.',
  INVALID_STATE: 'The requested action is not allowed in the current state.',
  VALIDATION: 'Please verify the input fields and try again.',
  NOT_FOUND: 'The requested resource was not found.',
  UNAUTHENTICATED: 'Your session has expired. Please log in again.',
};

interface ToastContextValue {
  showToast: (type: ToastType, title: string, message?: string) => void;
  showError: (err: unknown, defaultMessage?: string) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  }, [dismissToast]);

  const showError = useCallback(
    (err: unknown, defaultMessage = 'An unexpected error occurred') => {
      let code = '';
      let message = defaultMessage;

      if (err && typeof err === 'object') {
        const anyErr = err as any;
        code = anyErr.error?.code || anyErr.code || '';

        // Surface exact field-level validation issues from the server if present
        const issues = anyErr.details?.issues || anyErr.error?.details?.issues;
        if (Array.isArray(issues) && issues.length > 0) {
          message = issues
            .map((i: any) => `${i.path?.join('.') || 'field'}: ${i.message}`)
            .join('; ');
        } else if (anyErr.message && anyErr.message !== 'Validation failed' && anyErr.message !== 'Request failed') {
          message = anyErr.message;
        } else if (code && ERROR_CODE_MAP[code]) {
          message = ERROR_CODE_MAP[code];
        } else if (anyErr.error?.message) {
          message = anyErr.error.message;
        }
      }

      showToast('error', code ? `Error: ${code}` : 'Error', message);
    },
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, showError, dismissToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border transition-all duration-300 animate-slide-up ${
              toast.type === 'error'
                ? 'bg-surface border-red-500/30 text-red-500 dark:text-red-400'
                : toast.type === 'success'
                ? 'bg-surface border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : toast.type === 'warning'
                ? 'bg-surface border-amber-500/30 text-amber-500'
                : 'bg-surface border-border text-primaryText'
            }`}
          >
            <div className="mt-0.5">
              {toast.type === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
              {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-500" />}
              {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-500" />}
              {toast.type === 'info' && <Info className="w-5 h-5 text-accent-orange" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-primaryText">{toast.title}</p>
              {toast.message && <p className="text-xs text-mutedText mt-0.5">{toast.message}</p>}
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 hover:bg-canvas rounded-lg text-mutedText hover:text-primaryText transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
