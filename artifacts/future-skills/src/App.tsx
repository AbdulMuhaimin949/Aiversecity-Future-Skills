import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from "framer-motion";
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/shell';
import Home from '@/pages/home';
import ProfilePage from '@/pages/profile';
import RadarPage from '@/pages/radar';
import MatchesPage from '@/pages/matches';
import RolePage from '@/pages/role';
import PathwayPage from '@/pages/pathway';
import SdgsPage from '@/pages/sdgs';
import AboutPage from '@/pages/about';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AppRoutes() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/radar" component={RadarPage} />
          <Route path="/matches" component={MatchesPage} />
          <Route path="/roles/:occupationId" component={RolePage} />
          <Route path="/pathway/:occupationId" component={PathwayPage} />
          <Route path="/sdgs" component={SdgsPage} />
          <Route path="/about" component={AboutPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
          </TooltipProvider>
        </MotionConfig>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;
