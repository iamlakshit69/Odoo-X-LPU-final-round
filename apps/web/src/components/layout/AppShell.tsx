import React, { useState } from 'react';
import { TopPillNavbar } from './TopPillNavbar';
import { FloatingIconRail } from './FloatingIconRail';
import { useAuth } from '../../auth/AuthContext';
import {
  Search, X, ArrowRight, UserCheck, CalendarDays, UserPlus,
  LayoutDashboard, Contact2, Receipt, Wallet, Users, Settings, UserCircle,
} from 'lucide-react';

interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export function AppShell({ currentPath, onNavigate, children }: AppShellProps) {
  const { isAuthenticated } = useAuth();
  const [commandOpen, setCommandOpen] = useState(false);
  const [cmdSearch, setCmdSearch] = useState('');

  let activeArea: 'public' | 'portal' | 'admin' = 'public';
  if (currentPath.startsWith('/portal')) {
    activeArea = 'portal';
  } else if (currentPath.startsWith('/admin') || currentPath.startsWith('/login')) {
    activeArea = 'admin';
  }

  const handleAreaSwitch = (area: 'public' | 'portal' | 'admin') => {
    if (area === 'public') onNavigate('/');
    else if (area === 'portal') onNavigate('/portal');
    else if (area === 'admin') onNavigate('/admin/courts');
  };

  const commandItems = [
    { title: 'Court Availability Grid', icon: <CalendarDays className="w-4 h-4 text-accent-orange" />, path: '/admin/courts' },
    { title: 'Front Desk Member Omnibox', icon: <UserCheck className="w-4 h-4 text-emerald-500" />, path: '/admin/desk' },
    { title: 'Register New Member', icon: <UserPlus className="w-4 h-4 text-blue-500" />, path: '/admin/members/new' },
    { title: 'Shop POS Counter', icon: <ArrowRight className="w-4 h-4 text-accent-orange" />, path: '/admin/shop/pos' },
    { title: 'Shop Orders Board', icon: <ArrowRight className="w-4 h-4 text-purple-500" />, path: '/admin/shop/orders' },
    { title: 'Warehouse v_stock', icon: <ArrowRight className="w-4 h-4 text-blue-500" />, path: '/admin/shop/stock' },
    { title: 'Lounge Bar Floor Plan', icon: <ArrowRight className="w-4 h-4 text-amber-500" />, path: '/admin/bar' },
    { title: 'Kitchen KDS Station', icon: <ArrowRight className="w-4 h-4 text-red-500" />, path: '/admin/kds/kitchen' },
    { title: 'Bar KDS Station', icon: <ArrowRight className="w-4 h-4 text-cyan-500" />, path: '/admin/kds/bar' },
    { title: 'KPI Dashboard', icon: <LayoutDashboard className="w-4 h-4 text-accent-orange" />, path: '/admin/dashboard' },
    { title: 'CRM Leads Board', icon: <Contact2 className="w-4 h-4 text-orange-500" />, path: '/admin/crm' },
    { title: 'Finance – Invoices', icon: <Receipt className="w-4 h-4 text-yellow-500" />, path: '/admin/finance/invoices' },
    { title: 'Finance – Expenses', icon: <Wallet className="w-4 h-4 text-green-500" />, path: '/admin/finance/expenses' },
    { title: 'HR Management', icon: <Users className="w-4 h-4 text-indigo-500" />, path: '/admin/hr' },
    { title: 'Club Settings', icon: <Settings className="w-4 h-4 text-mutedText" />, path: '/admin/settings' },
    { title: 'Member Portal', icon: <UserCircle className="w-4 h-4 text-lime-500" />, path: '/portal' },
    { title: 'Public Home & Sports Spotlight', icon: <ArrowRight className="w-4 h-4 text-mutedText" />, path: '/' },
  ].filter((item) => item.title.toLowerCase().includes(cmdSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-canvas text-primaryText flex flex-col relative selection:bg-accent-orange selection:text-white">
      {/* Top Pill Navbar */}
      <TopPillNavbar
        activeArea={activeArea}
        onNavigateArea={handleAreaSwitch}
        onOpenCommandPalette={() => setCommandOpen(true)}
      />

      {/* Floating Icon Rail for Staff Console */}
      {activeArea === 'admin' && isAuthenticated && (
        <FloatingIconRail currentPath={currentPath} onNavigate={onNavigate} />
      )}

      {/* Main Container */}
      <div className={`flex-1 flex flex-col w-full ${activeArea === 'admin' && isAuthenticated ? 'md:pl-20 xl:pl-0' : ''}`}>
        <main className={`flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 ${
          activeArea === 'admin' && isAuthenticated ? 'xl:pl-20' : ''
        }`}>
          {children}
        </main>
      </div>

      {/* ⌘K Command Palette Modal */}
      {commandOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 flex-1">
                <Search className="w-4 h-4 text-mutedText" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type a command or jump to screen..."
                  value={cmdSearch}
                  onChange={(e) => setCmdSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-primaryText focus:outline-none"
                />
              </div>
              <button
                onClick={() => setCommandOpen(false)}
                className="p-1 rounded-lg text-mutedText hover:text-primaryText"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 max-h-64 overflow-y-auto">
              {commandItems.length > 0 ? (
                commandItems.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      onNavigate(item.path);
                      setCommandOpen(false);
                    }}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-canvas cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-semibold text-primaryText">
                      {item.icon}
                      <span>{item.title}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-mutedText group-hover:text-accent-orange group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-mutedText text-center py-4">No matching commands</p>
              )}
            </div>

            <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-mutedText">
              <span>Navigate with mouse or enter</span>
              <kbd className="px-1.5 py-0.5 bg-canvas border border-border rounded text-[10px]">ESC</kbd>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
