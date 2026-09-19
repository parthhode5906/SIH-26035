import React, { useState } from 'react';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from '@/components/ErrorBoundary';
import Navbar from '@/components/Navbar';
import Header from '@/components/Header';
import HelpDialog from '@/components/HelpDialog';

// Pages
import Landing from '@/pages/Landing';
import Home from '@/pages/Home';
import Login from '@/pages/Login';
import About from '@/pages/About';
import NewEvaluation from '@/pages/NewEvaluation';
import ActiveSession from '@/pages/ActiveSession';
import Reports from '@/pages/Reports';
import Verify from '@/pages/Verify';
import NotFound from '@/pages/NotFound';
import Registry from '@/pages/Registry';
import Admin from '@/pages/Admin';
import { syncOutbox } from '@/lib/sync';

const queryClient = new QueryClient();

function Shell({ children }) {
  const [mobileNav, setMobileNav] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className="console-shell grain flex min-h-[100dvh]">
      <Navbar
        mobileOpen={mobileNav}
        onCloseMobile={() => setMobileNav(false)}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <main className="min-w-0 flex-1 flex flex-col">
        <Header
          onOpenMobileNav={() => setMobileNav(true)}
          onOpenHelp={() => setHelpOpen(true)}
        />
        <div className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-7 md:px-10 md:py-10">
          {children}
        </div>
      </main>
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard" component={() => <Shell><Home /></Shell>} />
      <Route path="/about" component={() => <Shell><About /></Shell>} />
      <Route path="/evaluations/new" component={() => <Shell><NewEvaluation /></Shell>} />
      <Route path="/sessions/active" component={() => <Shell><ActiveSession /></Shell>} />
      <Route path="/reports" component={() => <Shell><Reports /></Shell>} />
      <Route path="/instruments" component={() => <Shell><Registry /></Shell>} />
      <Route path="/admin" component={() => <Shell><Admin /></Shell>} />
      <Route path="/verify/:id">{(params) => <Verify id={params.id} />}</Route>
      <Route path="/verify/NR-2026-0047" component={() => <Verify id="NR-2026-0047" />} />
      <Route path="/login" component={Login} />
      <Route component={() => <Shell><NotFound /></Shell>} />
    </Switch>
  );
}

function ProtectedRouter() {
  const [location] = useLocation();
  const authenticated = localStorage.getItem('nawi-authenticated') === '1';

  if (location === '/' || location.startsWith('/verify/')) {
    return <AppRoutes />;
  }

  if (!authenticated && location !== '/login') {
    return <Login />;
  }

  return <AppRoutes />;
}

function RoutedErrorBoundary({ children }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

export function App() {
  React.useEffect(() => { syncOutbox(); const t=window.setInterval(syncOutbox,30000); return()=>window.clearInterval(t); }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter>
          <RoutedErrorBoundary>
            <ProtectedRouter />
          </RoutedErrorBoundary>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
