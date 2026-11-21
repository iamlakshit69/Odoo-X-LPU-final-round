import React, { useState, useEffect } from 'react';
import { Sun, Moon, Bell, Search, LogOut, User as UserIcon, Shield, Sparkles } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

interface TopPillNavbarProps {
  activeArea: 'public' | 'portal' | 'admin';
  onNavigateArea: (area: 'public' | 'portal' | 'admin') => void;
  onOpenCommandPalette?: () => void;
}

export function TopPillNavbar({
  activeArea,
  onNavigateArea,
  onOpenCommandPalette,
}: TopPillNavbarProps) {
  const { user, role, logout, isAuthenticated } = useAuth();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cc_theme') as 'light' | 'dark') || 'dark';
  });

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

  return (
    <header className="sticky top-4 z-40 px-4 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between p-2 rounded-full border border-border bg-surface/90 backdrop-blur-md shadow-lg transition-all duration-300">
        
        {/* Brand with morphing sport emblem */}
        <div
          onClick={() => onNavigateArea('public')}
          className="flex items-center gap-2.5 px-3 py-1 cursor-pointer select-none group"
        >
          <div className="w-8 h-8 rounded-full bg-accent-orange flex items-center justify-center text-white shadow-md transition-transform duration-300 group-hover:scale-105">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-sm tracking-tight text-primaryText">CHAMPIONS</span>
            <span className="text-xs font-bold text-accent-orange ml-1">CLUB</span>
          </div>
        </div>

        {/* Public / Portal / Staff Pill Switcher */}
        <nav className="flex items-center p-1 rounded-full bg-canvas/80 border border-border/80">
          <button
            onClick={() => onNavigateArea('public')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeArea === 'public'
                ? 'bg-surface text-primaryText shadow-sm'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Public
          </button>
          <button
            onClick={() => onNavigateArea('portal')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeArea === 'portal'
                ? 'bg-surface text-primaryText shadow-sm'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Portal
          </button>
          <button
            onClick={() => onNavigateArea('admin')}
            className={`px-3.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 ${
              activeArea === 'admin'
                ? 'bg-surface text-primaryText shadow-sm'
                : 'text-mutedText hover:text-primaryText'
            }`}
          >
            Staff
          </button>
        </nav>

        {/* Actions & Utilities */}
        <div className="flex items-center gap-2">
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
              className="p-2 rounded-full border border-border bg-canvas/80 text-mutedText hover:text-primaryText transition-colors shadow-inner"
            >
              <Bell className="w-4 h-4" />
            </button>
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-orange animate-ping" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent-orange" />
          </div>

          {/* User Pill / Login state */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full border border-border bg-canvas/80 shadow-inner">
              <div className="w-6 h-6 rounded-full bg-accent-orange/20 text-accent-orange flex items-center justify-center text-xs font-bold uppercase">
                {user.name?.charAt(0) || 'U'}
              </div>
              <div className="hidden lg:block text-left text-xs pr-1">
                <span className="font-semibold text-primaryText block leading-tight truncate max-w-[100px]">
                  {user.name}
                </span>
                <span className="text-[10px] uppercase font-bold text-accent-orange block">
                  {role || user.roleCode}
                </span>
              </div>
              <button
                onClick={logout}
                title="Log out"
                className="p-1 rounded-full hover:bg-surface text-mutedText hover:text-red-500 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => onNavigateArea('admin')}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent-orange text-white hover:bg-accent-orange/90 transition-colors shadow-md"
            >
              Log in
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
