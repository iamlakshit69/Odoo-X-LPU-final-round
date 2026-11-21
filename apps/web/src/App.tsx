import React, { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from './lib/toast';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useSSE } from './hooks/useSSE';
import { AppShell } from './components/layout/AppShell';

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

function MainRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    return window.location.pathname || '/';
  });

  const { isAuthenticated, isLoading } = useAuth();

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
    if (currentPath === '/login') {
      return <Login onSuccess={(role) => navigate(role === 'member' ? '/portal' : '/admin/courts')} />;
    }
    if (!isAuthenticated && (currentPath.startsWith('/admin') || currentPath === '/portal')) {
      navigate('/login');
      return null;
    }

    if (currentPath === '/portal') {
      return (
        <PortalDashboard
          onNavigateBookCourt={() => navigate('/admin/courts')}
          onNavigateLogin={() => navigate('/login')}
        />
      );
    }

    if (currentPath === '/admin/courts') {
      return <CourtsGrid />;
    }

    if (currentPath === '/admin/desk') {
      return (
        <FrontDesk
          onNavigateBookCourt={(memberId) => navigate(`/admin/courts?memberId=${memberId}`)}
        />
      );
    }

    if (currentPath === '/admin/members/new') {
      return <NewMember onDone={() => navigate('/admin/desk')} />;
    }

    if (currentPath === '/admin/shop/pos' || currentPath === '/admin/shop') {
      return <ShopPos />;
    }

    if (currentPath === '/admin/shop/orders') {
      return <ShopOrders />;
    }

    if (currentPath === '/admin/shop/stock') {
      return <ShopStock />;
    }

    if (currentPath === '/admin/bar') {
      return <BarConsole />;
    }

    if (currentPath === '/admin/kds/kitchen') {
      return <KdsScreen initialStation="kitchen" />;
    }

    if (currentPath === '/admin/kds/bar') {
      return <KdsScreen initialStation="bar" />;
    }

    if (currentPath === '/admin/crm') {
      return (
        <CrmBoard
          onConvertSuccess={(memberId) => navigate(`/admin/desk?memberId=${memberId}`)}
        />
      );
    }

    if (currentPath === '/admin/dashboard') {
      return <Dashboard />;
    }

    if (currentPath === '/admin/finance/invoices' || currentPath === '/admin/finance') {
      return <Invoices />;
    }

    if (currentPath === '/admin/finance/expenses') {
      return <Expenses />;
    }

    if (currentPath === '/admin/hr') {
      return <HrManagement />;
    }

    if (currentPath === '/admin/settings') {
      return <SettingsView />;
    }

    // Default to Public Landing
    return (
      <PublicHome
        onNavigateStaff={() => navigate('/admin/courts')}
        onNavigatePortal={() => navigate('/portal')}
      />
    );
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
