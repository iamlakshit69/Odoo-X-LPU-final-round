import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Shield, Lock, Mail, Sparkles, CheckCircle2 } from 'lucide-react';

interface LoginProps {
  onSuccess?: () => void;
}

const DEMO_ROLES = [
  { role: 'Owner', email: 'owner@championsclub.in', label: 'Rajesh Khanna', color: 'from-amber-500 to-orange-500' },
  { role: 'Manager', email: 'manager@championsclub.in', label: 'Deepak Verma', color: 'from-orange-500 to-red-500' },
  { role: 'Front Desk', email: 'frontdesk@championsclub.in', label: 'Sunita Rao', color: 'from-emerald-500 to-teal-500' },
  { role: 'Shop Clerk', email: 'shop@championsclub.in', label: 'Manoj Kumar', color: 'from-blue-500 to-cyan-500' },
  { role: 'Bartender', email: 'bartender@championsclub.in', label: 'Ajay Singh', color: 'from-purple-500 to-indigo-500' },
  { role: 'Kitchen', email: 'kitchen@championsclub.in', label: 'Chef Sanjeev', color: 'from-red-500 to-pink-500' },
  { role: 'Cashier', email: 'cashier@championsclub.in', label: 'Pooja Sharma', color: 'from-teal-500 to-emerald-500' },
  { role: 'Finance', email: 'finance@championsclub.in', label: 'Sanjay Gupta', color: 'from-yellow-500 to-amber-500' },
  { role: 'HR', email: 'hr@championsclub.in', label: 'Ritu Kapoor', color: 'from-indigo-500 to-blue-500' },
  { role: 'Member', email: 'member@championsclub.in', label: 'Aarav Sharma', color: 'from-lime-500 to-green-500' },
];

export function Login({ onSuccess }: LoginProps) {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('demo1234');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    try {
      setIsSubmitting(true);
      await login({ email, password });
      onSuccess?.();
    } catch {
      // toast shown by auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo1234');
    try {
      setIsSubmitting(true);
      await login({ email: demoEmail, password: 'demo1234' });
      onSuccess?.();
    } catch {
      // toast handled
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 animate-fade-in">
      <div className="rounded-[24px] border border-border bg-surface p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent-orange/15 text-accent-orange mb-2">
            <Shield className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-primaryText">Champions Club Sign-In</h2>
          <p className="text-xs text-mutedText max-w-sm mx-auto">
            Access staff operations console, front desk omnibox, and court scheduling.
          </p>
        </div>

        {/* Demo Quick-Login Chips */}
        <div className="p-4 rounded-2xl bg-surface-muted/60 border border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-mutedText flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-accent-orange" />
              Demo Quick-Login (Dev Seeded Roles)
            </span>
            <span className="text-[10px] text-mutedText font-mono">Password: demo1234</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {DEMO_ROLES.map((r) => (
              <button
                key={r.email}
                type="button"
                disabled={isSubmitting || isLoading}
                onClick={() => handleQuickLogin(r.email)}
                className="px-2.5 py-1.5 rounded-full text-xs font-medium border border-border bg-surface hover:border-accent-orange hover:text-accent-orange transition-all duration-150 flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                <span className="w-2 h-2 rounded-full bg-accent-orange" />
                <span className="font-semibold text-primaryText">{r.role}</span>
                <span className="text-[11px] text-mutedText">({r.label.split(' ')[0]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-mutedText">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@championsclub.in"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-canvas text-sm text-primaryText placeholder:text-mutedText/60 focus:outline-none focus:ring-2 focus:ring-accent-orange/40"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-mutedText">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-mutedText" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-canvas text-sm text-primaryText focus:outline-none focus:ring-2 focus:ring-accent-orange/40"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full py-3 rounded-xl bg-accent-orange hover:bg-accent-orange/90 text-white font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-accent-orange/20 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <span>Signing In...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Sign In with Session Cookie</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
