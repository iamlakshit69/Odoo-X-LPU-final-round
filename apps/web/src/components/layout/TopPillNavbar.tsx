import React, { useState, useEffect, useRef } from 'react';
import {
  Sun, Moon, Bell, Search, LogOut, Sparkles, ChevronDown,
  LayoutDashboard, CalendarDays, UserCheck, Receipt, Users,
  Settings, ShoppingBag, Coffee, Contact2, ExternalLink, Shield,
  Package, Boxes, Utensils, Wallet, UserCircle, Check
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/AuthContext';
import { getHomePathForRole } from '../../lib/utils';

interface TopPillNavbarProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  activeArea?: 'public' | 'portal' | 'admin';
  onNavigateArea?: (area: 'public' | 'portal' | 'admin') => void;
  onOpenCommandPalette?: () => void;
}

interface NavLinkItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ReactNode;
}

export function TopPillNavbar({
  currentPath = '/',
  onNavigate,
  activeArea,
  onNavigateArea,
  onOpenCommandPalette,
}: TopPillNavbarProps) {
  const { user, role, hasPermission, logout, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showNotifications, setShowNotifications] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cc_theme') as 'light' | 'dark') || 'dark';
  });

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications', { credentials: 'include' });
      if (!res.ok) return { items: [], total: 0 };
      return res.json();
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
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

  const unreadItems = (notifData?.items || []).filter((n: any) => n.status !== 'read');
  const unreadCount = unreadItems.length;

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('cc_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpenCommandPalette?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenCommandPalette]);

  // Navigate helper supporting path + hash
  const handleNavClick = (path: string) => {
    setMoreOpen(false);
    setUserMenuOpen(false);
    if (path.includes('#')) {
      const [targetPath, hash] = path.split('#');
      window.location.hash = hash;
      if (onNavigate) {
        onNavigate(targetPath);
      } else if (onNavigateArea) {
        if (targetPath.startsWith('/portal')) onNavigateArea('portal');
        else if (targetPath.startsWith('/admin')) onNavigateArea('admin');
        else onNavigateArea('public');
      }
    } else {
      if (window.location.hash) {
        window.history.pushState('', document.title, window.location.pathname + window.location.search);
      }
      if (onNavigate) {
        onNavigate(path);
      } else if (onNavigateArea) {
        if (path.startsWith('/portal')) onNavigateArea('portal');
        else if (path.startsWith('/admin')) onNavigateArea('admin');
        else onNavigateArea('public');
      }
    }
  };

  // Determine active item
  const isLinkActive = (path: string) => {
    if (!currentPath) return false;
    if (path === '/') return currentPath === '/';
    if (path.includes('#')) {
      const [base, hash] = path.split('#');
      return currentPath === base && window.location.hash === `#${hash}`;
    }
    return currentPath === path || (path !== '/' && currentPath.startsWith(path));
  };

  // Construct Role-Specific Navigation Links
  let primaryLinks: NavLinkItem[] = [];
  let overflowLinks: NavLinkItem[] = [];

  if (!isAuthenticated) {
    primaryLinks = [
      { id: 'login', label: 'Sign In (Dev Roles)', path: '/login' },
      { id: 'public', label: 'Club Showcase', path: '/public' },
    ];
  } else if (role === 'member') {
    primaryLinks = [
      { id: 'portal', label: 'Overview', path: '/portal' },
      { id: 'book', label: 'Book Court', path: '/portal#book' },
      { id: 'bookings', label: 'My Bookings', path: '/portal#bookings' },
      { id: 'shop', label: 'Pro Shop', path: '/portal#shop' },
      { id: 'invoices', label: 'Invoices', path: '/portal#invoices' },
      { id: 'public', label: 'Club Showcase', path: '/public' },
    ];
  } else if (role === 'owner' || role === 'manager') {
    // Owner has core management shortcuts upfront + clean overflow dropdown
    primaryLinks = [
      { id: 'dashboard', label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: 'courts', label: 'Courts', path: '/admin/courts', icon: <CalendarDays className="w-3.5 h-3.5" /> },
      { id: 'desk', label: 'Front Desk', path: '/admin/desk', icon: <UserCheck className="w-3.5 h-3.5" /> },
      { id: 'finance', label: 'Finance', path: '/admin/finance/invoices', icon: <Receipt className="w-3.5 h-3.5" /> },
      { id: 'hr', label: 'HR & Rota', path: '/admin/hr', icon: <Users className="w-3.5 h-3.5" /> },
    ];
    overflowLinks = [
      { id: 'crm', label: 'CRM Leads Board', path: '/admin/crm', icon: <Contact2 className="w-4 h-4 text-orange-500" /> },
      { id: 'pos', label: 'Shop POS Counter', path: '/admin/shop/pos', icon: <ShoppingBag className="w-4 h-4 text-accent-orange" /> },
      { id: 'orders', label: 'Shop Orders Board', path: '/admin/shop/orders', icon: <Package className="w-4 h-4 text-purple-500" /> },
      { id: 'stock', label: 'Warehouse Stock (v_stock)', path: '/admin/shop/stock', icon: <Boxes className="w-4 h-4 text-blue-500" /> },
      { id: 'bar', label: 'Lounge Bar Floor Plan', path: '/admin/bar', icon: <Coffee className="w-4 h-4 text-amber-500" /> },
      { id: 'kds-kitchen', label: 'Kitchen KDS Station', path: '/admin/kds/kitchen', icon: <Utensils className="w-4 h-4 text-red-500" /> },
      { id: 'kds-bar', label: 'Bar KDS Station', path: '/admin/kds/bar', icon: <Coffee className="w-4 h-4 text-cyan-500" /> },
      { id: 'expenses', label: 'Finance Expenses', path: '/admin/finance/expenses', icon: <Wallet className="w-4 h-4 text-green-500" /> },
      { id: 'settings', label: 'Club Settings & RBAC', path: '/admin/settings', icon: <Settings className="w-4 h-4 text-mutedText" /> },
      { id: 'portal-preview', label: 'Member Portal View', path: '/portal', icon: <UserCircle className="w-4 h-4 text-lime-500" /> },
      { id: 'public-home', label: 'Public Website View', path: '/public', icon: <Sparkles className="w-4 h-4 text-accent-orange" /> },
    ];
  } else if (role === 'hr') {
    // HR Officer strictly sees HR operations and staff timetable
    primaryLinks = [
      { id: 'hr', label: 'HR Management & Rota', path: '/admin/hr', icon: <Users className="w-3.5 h-3.5" /> },
      { id: 'courts', label: 'Courts Timetable', path: '/admin/courts', icon: <CalendarDays className="w-3.5 h-3.5" /> },
      { id: 'desk', label: 'Club Directory', path: '/admin/desk', icon: <UserCheck className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'finance') {
    // Finance Officer strictly sees financial books and reports
    primaryLinks = [
      { id: 'invoices', label: 'Invoices & Billing', path: '/admin/finance/invoices', icon: <Receipt className="w-3.5 h-3.5" /> },
      { id: 'expenses', label: 'Club Expenses', path: '/admin/finance/expenses', icon: <Wallet className="w-3.5 h-3.5" /> },
      { id: 'dashboard', label: 'Financial KPI', path: '/admin/dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
      { id: 'orders', label: 'POS Orders', path: '/admin/shop/orders', icon: <Package className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'front_desk') {
    // Front Desk sees reception, member omnibox, courts, registration
    primaryLinks = [
      { id: 'courts', label: 'Courts Grid', path: '/admin/courts', icon: <CalendarDays className="w-3.5 h-3.5" /> },
      { id: 'desk', label: 'Member Omnibox', path: '/admin/desk', icon: <UserCheck className="w-3.5 h-3.5" /> },
      { id: 'new-member', label: 'Register Member', path: '/admin/members/new', icon: <UserCheck className="w-3.5 h-3.5" /> },
      { id: 'crm', label: 'CRM Leads', path: '/admin/crm', icon: <Contact2 className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'shop_clerk' || role === 'cashier') {
    // Shop Staff
    primaryLinks = [
      { id: 'pos', label: 'Shop POS', path: '/admin/shop/pos', icon: <ShoppingBag className="w-3.5 h-3.5" /> },
      { id: 'orders', label: 'Orders Board', path: '/admin/shop/orders', icon: <Package className="w-3.5 h-3.5" /> },
      { id: 'stock', label: 'Warehouse Stock', path: '/admin/shop/stock', icon: <Boxes className="w-3.5 h-3.5" /> },
    ];
  } else if (role === 'bartender' || role === 'kitchen') {
    // F&B Staff
    primaryLinks = [
      { id: 'bar', label: 'Lounge Floor', path: '/admin/bar', icon: <Coffee className="w-3.5 h-3.5" /> },
      { id: 'kds-kitchen', label: 'Kitchen KDS', path: '/admin/kds/kitchen', icon: <Utensils className="w-3.5 h-3.5" /> },
      { id: 'kds-bar', label: 'Bar KDS', path: '/admin/kds/bar', icon: <Coffee className="w-3.5 h-3.5" /> },
    ];
  } else {
    // Fallback role links
    primaryLinks = [
      { id: 'courts', label: 'Courts', path: '/admin/courts' },
      { id: 'desk', label: 'Desk', path: '/admin/desk' },
    ];
  }

  const isOverflowActive = overflowLinks.some((item) => isLinkActive(item.path));

  return (
    <header className="sticky top-4 z-40 px-2 sm:px-4 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-1.5 sm:p-2 rounded-full border border-border bg-surface/90 backdrop-blur-md shadow-lg transition-all duration-300">
        
        {/* Brand with morphing sport emblem */}
        <div
          onClick={() => handleNavClick(isAuthenticated ? getHomePathForRole(role) : '/login')}
          className="flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-3 py-1 cursor-pointer select-none group shrink-0"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-accent-orange flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105">
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-pulse" />
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-sm tracking-tight text-primaryText">CHAMPIONS</span>
            <span className="text-xs font-bold text-accent-orange ml-1">CLUB</span>
          </div>
        </div>

        {/* Dynamic Role-Based Navigation Pill */}
        <nav className="flex items-center p-0.5 sm:p-1 rounded-full bg-canvas/80 border border-border/80 max-w-[62vw] lg:max-w-none shrink relative z-40">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
            {primaryLinks.map((link) => {
              const active = isLinkActive(link.path);
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.path)}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-accent-orange text-white shadow-sm shadow-accent-orange/20 font-bold'
                      : 'text-mutedText hover:text-primaryText hover:bg-surface/60'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </button>
              );
            })}
          </div>

          {/* More Dropdown for Owner / Manager */}
          {overflowLinks.length > 0 && (
            <div className="relative shrink-0 ml-1" ref={dropdownRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMoreOpen((prev) => !prev);
                }}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer select-none ${
                  isOverflowActive
                    ? 'bg-accent-orange text-white shadow-sm font-bold'
                    : 'text-mutedText hover:text-primaryText hover:bg-surface/60'
                }`}
              >
                <span>More</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${moreOpen ? 'rotate-180' : ''}`} />
              </button>

              {moreOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-64 rounded-2xl border border-border bg-surface p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold text-mutedText uppercase tracking-wider border-b border-border/60 mb-1">
                    Club Operations Suite
                  </div>
                  <div className="max-h-80 overflow-y-auto no-scrollbar space-y-0.5">
                    {overflowLinks.map((item) => {
                      const active = isLinkActive(item.path);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNavClick(item.path)}
                          className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold text-left transition-colors cursor-pointer ${
                            active
                              ? 'bg-accent-orange/15 text-accent-orange font-bold'
                              : 'text-primaryText hover:bg-canvas'
                          }`}
                        >
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* ⌘K Omnibox Button */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full text-xs bg-canvas/80 border border-border text-mutedText hover:text-primaryText hover:border-border/80 transition-colors shadow-inner"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search...</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-surface border border-border rounded">
              ⌘K
            </kbd>
          </button>

          {/* Pill Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark/light theme"
            className="p-2 rounded-full border border-border bg-canvas/80 text-mutedText hover:text-primaryText transition-colors shadow-inner"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-accent-orange" />
            ) : (
              <Moon className="w-4 h-4 text-primaryText" />
            )}
          </button>

          {/* Notification Bell with live badge */}
          <div className="relative">
            <button
              aria-label="Notifications"
              onClick={() => setShowNotifications((prev) => !prev)}
              className="p-2 rounded-full border border-border bg-canvas/80 text-mutedText hover:text-primaryText transition-colors shadow-inner relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <>
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-orange animate-ping" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-orange" />
                </>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-2xl border border-border bg-surface p-3 shadow-2xl z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-2">
                  <span className="text-xs font-bold text-primaryText uppercase tracking-wider">
                    Notifications {unreadCount > 0 ? `(${unreadCount})` : ''}
                  </span>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-[10px] text-mutedText hover:text-primaryText"
                  >
                    Close
                  </button>
                </div>
                {notifData?.items?.length ? (
                  <div className="space-y-2">
                    {notifData.items.slice(0, 10).map((n: any) => (
                      <div
                        key={n.id}
                        className={`p-2 rounded-xl text-xs border transition-colors ${
                          n.status !== 'read'
                            ? 'bg-accent-orange/10 border-accent-orange/30 text-primaryText'
                            : 'bg-canvas/50 border-border/50 text-mutedText'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-semibold block">{n.template}</span>
                          {n.status !== 'read' && (
                            <button
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="text-[10px] text-accent-orange hover:underline shrink-0"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                        <p className="text-[11px] mt-0.5 opacity-90">
                          {n.payload?.body || n.payload?.title || n.payload?.name || JSON.stringify(n.payload || {})}
                        </p>
                        <span className="text-[9px] text-mutedText mt-1 block">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-mutedText">
                    No recent notifications
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Pill / Login state */}
          {isAuthenticated && user ? (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded-full border border-border bg-canvas/80 hover:bg-canvas shadow-inner shrink-0 transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-accent-orange/20 text-accent-orange flex items-center justify-center text-xs font-bold uppercase">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden lg:block text-left text-xs pr-1">
                  <span className="font-semibold text-primaryText block leading-tight truncate max-w-[90px]">
                    {user.name}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-accent-orange block">
                    {role || user.roleCode}
                  </span>
                </div>
                <ChevronDown className="w-3 h-3 text-mutedText hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-border bg-surface p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 space-y-1">
                  <div className="px-3 py-2 border-b border-border/60">
                    <p className="text-xs font-bold text-primaryText truncate">{user.name}</p>
                    <p className="text-[10px] text-mutedText truncate">{user.email}</p>
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-accent-orange/15 text-accent-orange border border-accent-orange/30">
                      <Shield className="w-2.5 h-2.5" />
                      <span>{role?.replace('_', ' ') || 'User'}</span>
                    </div>
                  </div>

                  <div className="py-1 space-y-0.5 text-xs">
                    {role !== 'member' && (
                      <button
                        onClick={() => handleNavClick('/portal')}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-canvas text-primaryText text-left transition-colors"
                      >
                        <UserCircle className="w-3.5 h-3.5 text-lime-500" />
                        <span>Member Portal</span>
                      </button>
                    )}
                    <button
                      onClick={() => handleNavClick('/public')}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-canvas text-primaryText text-left transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-accent-orange" />
                      <span>Club Public Site</span>
                    </button>
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenCommandPalette?.();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-canvas text-primaryText text-left transition-colors"
                    >
                      <Search className="w-3.5 h-3.5 text-mutedText" />
                      <span>Command Palette (⌘K)</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-border/60">
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-red-500/10 text-red-500 text-xs font-semibold text-left transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => handleNavClick('/login')}
              className="px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider bg-accent-orange text-white hover:bg-accent-orange/90 transition-colors shadow-md shrink-0"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
