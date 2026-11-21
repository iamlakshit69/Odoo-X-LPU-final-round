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

  const { isAuthenticated } = useAuth();

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
      return <Login onSuccess={() => navigate('/admin/courts')} />;
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
