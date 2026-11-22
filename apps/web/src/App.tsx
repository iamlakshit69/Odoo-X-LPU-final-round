import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './lib/toast';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useSSE } from './hooks/useSSE';
import { AppShell } from './components/layout/AppShell';
import { ShieldAlert } from 'lucide-react';
import { getHomePathForRole } from './lib/utils';

// Routes
import { PublicHome } from './routes/public/PublicHome';
import { PortalDashboard } from './routes/portal/PortalDashboard';
import { Login } from './routes/Login';
import { CourtsGrid } from './routes/admin/courts/CourtsGrid';
import { FrontDesk } from './routes/admin/desk/FrontDesk';
import { NewMember } from './routes/admin/members/NewMember';
import { ShopPos } from './routes/admin/shop/ShopPos';
import { ShopOrders } from './routes/admin/shop/ShopOrders';
import { ShopStock } from './routes/admin/shop/ShopStock';
import { BarConsole } from './routes/admin/bar/BarConsole';
import { KdsScreen } from './routes/admin/kds/KdsScreen';
import { CrmBoard } from './routes/admin/crm/CrmBoard';
import { Dashboard } from './routes/admin/dashboard/Dashboard';
import { Invoices } from './routes/admin/finance/Invoices';
import { Expenses } from './routes/admin/finance/Expenses';
import { HrManagement } from './routes/admin/hr/HrManagement';
import { SettingsView } from './routes/admin/settings/SettingsView';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 30, // 30s
      retry: 1,
    },
  },
});

function AccessDenied({ role, onBack }: { role: string | null; onBack: () => void }) {
  return (
    <div className="max-w-md mx-auto my-16 p-8 rounded-2xl border border-red-500/20 bg-surface text-center space-y-4 shadow-xl">
      <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
        <ShieldAlert className="w-6 h-6" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-primaryText">Access Restricted</h2>
        <p className="text-xs text-mutedText mt-1">
          Your assigned role (<span className="font-semibold text-accent-orange capitalize">{role?.replace('_', ' ') || 'Staff'}</span>) does not have authorization to view this department.
        </p>
      </div>
      <button
        onClick={onBack}
        className="px-4 py-2 bg-canvas hover:bg-canvas/80 border border-border text-primaryText text-xs font-bold rounded-xl transition-colors"
      >
        Return to My Desk
      </button>
    </div>
  );
}

function MainRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const { isAuthenticated, role, hasPermission, isLoading } = useAuth();

  // Activate realtime SSE topic-to-query-key synchronization
  useSSE();

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderCurrentScreen = () => {
    // 0. Login & Entry Routing: Unauthenticated users visiting '/' or '/login' see the Login screen
    if (currentPath === '/login' || (!isAuthenticated && currentPath === '/')) {
      return (
        <Login
          onSuccess={(role) => navigate(getHomePathForRole(role))}
          onNavigatePublic={() => navigate('/public')}
        />
      );
    }

    // Authenticated users visiting '/' are sent straight to their role workspace
    if (isAuthenticated && currentPath === '/') {
      navigate(getHomePathForRole(role));
      return null;
    }

    // Public Club Showcase
    if (currentPath === '/public') {
      return (
        <PublicHome
          onNavigateStaff={() => navigate(isAuthenticated ? getHomePathForRole(role) : '/login')}
          onNavigatePortal={() => navigate(isAuthenticated && role === 'member' ? '/portal' : '/login')}
        />
      );
    }

    // 1. Unauthenticated users cannot access /admin or /portal
    if (!isAuthenticated && (currentPath.startsWith('/admin') || currentPath === '/portal')) {
      navigate('/login');
      return null;
    }

    // 2. Strict Role Protection: Members can NEVER access administrative screens
    if (isAuthenticated && role === 'member' && currentPath.startsWith('/admin')) {
      navigate('/portal');
      return null;
    }

    if (currentPath === '/portal') {
      return (
        <PortalDashboard
          onNavigateBookCourt={() => navigate(role === 'member' ? '/portal' : '/admin/courts')}
          onNavigateLogin={() => navigate('/login')}
        />
      );
    }

    const checkAccess = (permission: string) => {
      if (role === 'owner') return true;
      return hasPermission(permission);
    };

    if (currentPath === '/admin/courts') {
      if (!checkAccess('booking:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <CourtsGrid />;
    }

    if (currentPath === '/admin/desk') {
      if (!checkAccess('member:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return (
        <FrontDesk
          onNavigateBookCourt={(memberId) => navigate(`/admin/courts?memberId=${memberId}`)}
        />
      );
    }

    if (currentPath === '/admin/members/new') {
      if (!checkAccess('member:create')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <NewMember onDone={() => navigate('/admin/desk')} />;
    }

    if (currentPath === '/admin/shop/pos' || currentPath === '/admin/shop') {
      if (!checkAccess('order:create')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <ShopPos />;
    }

    if (currentPath === '/admin/shop/orders') {
      if (!checkAccess('order:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <ShopOrders />;
    }

    if (currentPath === '/admin/shop/stock') {
      if (!checkAccess('stock:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <ShopStock />;
    }

    if (currentPath === '/admin/bar') {
      if (!checkAccess('tab:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <BarConsole />;
    }

    if (currentPath === '/admin/kds/kitchen') {
      if (!checkAccess('kds:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <KdsScreen initialStation="kitchen" />;
    }

    if (currentPath === '/admin/kds/bar') {
      if (!checkAccess('kds:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <KdsScreen initialStation="bar" />;
    }

    if (currentPath === '/admin/crm') {
      if (!checkAccess('lead:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return (
        <CrmBoard
          onConvertSuccess={(memberId) => navigate(`/admin/desk?memberId=${memberId}`)}
        />
      );
    }

    if (currentPath === '/admin/dashboard') {
      if (!checkAccess('finance:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <Dashboard />;
    }

    if (currentPath === '/admin/finance/invoices' || currentPath === '/admin/finance') {
      if (!checkAccess('invoice:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <Invoices />;
    }

    if (currentPath === '/admin/finance/expenses') {
      if (!checkAccess('expense:manage')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <Expenses />;
    }

    if (currentPath === '/admin/hr') {
      if (!checkAccess('hr:read')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <HrManagement />;
    }

    if (currentPath === '/admin/settings') {
      if (!checkAccess('settings:manage')) {
        return <AccessDenied role={role} onBack={() => navigate(getHomePathForRole(role))} />;
      }
      return <SettingsView />;
    }

    if (currentPath === '/' || currentPath === '/public') {
      return (
        <PublicHome
          onNavigateStaff={() => navigate(isAuthenticated ? getHomePathForRole(role) : '/login')}
          onNavigatePortal={() => navigate(isAuthenticated && role === 'member' ? '/portal' : '/login')}
        />
      );
    }

    // Default to role home or login for unknown routes
    if (isAuthenticated) {
      navigate(getHomePathForRole(role));
      return null;
    }
    navigate('/login');
    return null;
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate}>
      {renderCurrentScreen()}
    </AppShell>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MainRouter />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
