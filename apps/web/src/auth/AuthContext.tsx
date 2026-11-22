import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { SessionUser, LoginRequest } from '@club/contract';
import { api, ApiClientError } from '../api/client';
import { useToast } from '../lib/toast';

interface AuthContextValue {
  user: SessionUser | null;
  role: string | null;
  permissions: string[];
  memberId: string | null | undefined;
  activePlan: string | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasPermission: (permission: string, ctx?: { ownerMemberId?: string }) => boolean;
  login: (credentials: LoginRequest) => Promise<string | null>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [memberId, setMemberId] = useState<string | null | undefined>(null);
  const [activePlan, setActivePlan] = useState<string | null | undefined>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { showToast, showError } = useToast();

  const refreshMe = useCallback(async () => {
    // Only auto-restore user if session was started in this browser session
    const hasActiveSession = sessionStorage.getItem('cc_active_session') === 'true';
    if (!hasActiveSession) {
      setUser(null);
      setRole(null);
      setPermissions([]);
      setMemberId(null);
      setActivePlan(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.auth.me();
      setUser(data.user);
      setRole(data.role);
      setPermissions(data.permissions || []);
      setMemberId(data.memberId);
      setActivePlan(data.activePlan);
    } catch (err) {
      setUser(null);
      setRole(null);
      setPermissions([]);
      setMemberId(null);
      setActivePlan(null);
      sessionStorage.removeItem('cc_active_session');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  const hasPermission = useCallback(
    (permission: string, ctx?: { ownerMemberId?: string }): boolean => {
      if (!user) return false;
      if (role === 'owner') return true;

      if (permissions.includes(permission)) return true;

      // Handle :own scoped permissions
      const ownPerm = `${permission}:own`;
      if (permissions.includes(ownPerm)) {
        if (!ctx?.ownerMemberId || !memberId) return false;
        return ctx.ownerMemberId === memberId;
      }

      return false;
    },
    [user, role, permissions, memberId]
  );

  const login = async (credentials: LoginRequest): Promise<string | null> => {
    try {
      setIsLoading(true);
      await api.auth.login(credentials);
      const data = await api.auth.me();
      sessionStorage.setItem('cc_active_session', 'true');
      setUser(data.user);
      setRole(data.role);
      setPermissions(data.permissions || []);
      setMemberId(data.memberId);
      setActivePlan(data.activePlan);
      showToast('success', 'Logged in successfully', `Welcome back, ${credentials.email}`);
      return data.role;
    } catch (err) {
      showError(err, 'Failed to sign in. Please check your credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem('cc_active_session');
      await api.auth.logout();
      setUser(null);
      setRole(null);
      setPermissions([]);
      setMemberId(null);
      setActivePlan(null);
      showToast('info', 'Logged out', 'You have been signed out.');
    } catch (err) {
      showError(err, 'Failed to logout cleanly.');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        memberId,
        activePlan,
        isLoading,
        isAuthenticated: !!user,
        hasPermission,
        login,
        logout,
        refreshMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
