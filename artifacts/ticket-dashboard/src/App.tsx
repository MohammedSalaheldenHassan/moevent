import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/useAuth";
import { LocaleProvider, useLocale } from "@/contexts/LocaleContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrandingProvider, useBranding } from "@/contexts/BrandingContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Sidebar } from "@/components/Sidebar";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import EventsPage from "@/pages/EventsPage";
import EventDetailPage from "@/pages/EventDetailPage";
import IssueTicketPage from "@/pages/IssueTicketPage";
import StaffPage from "@/pages/StaffPage";
import SettingsPage from "@/pages/SettingsPage";
import ActivityLogsPage from "@/pages/ActivityLogsPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, retryDelay: 1000 },
  },
});

function AppLayout({ children }: { children: React.ReactNode }) {
  const { isRTL } = useLocale();
  const { systemName } = useBranding();

  // Update page title with system name
  useEffect(() => {
    document.title = systemName || "TicketHub";
  }, [systemName]);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className={`flex-1 ${isRTL ? "lg:pr-64" : "lg:pl-64"} min-w-0`}>
        {/* pt-16 on mobile so content is below the fixed hamburger button */}
        <div className="p-4 pt-16 sm:p-6 sm:pt-16 lg:p-8 lg:pt-8 max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function LoadingScreen() {
  const { t } = useLocale();
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowReload(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">{t.loading}</p>
        {showReload && (
          <button
            onClick={() => window.location.reload()}
            className="mt-2 text-xs text-primary underline underline-offset-2"
          >
            Taking too long? Click to reload
          </button>
        )}
      </div>
    </div>
  );
}

function ProtectedRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginPage />;

  // Super admin gets a fully separate layout
  if (profile?.role === "super_admin") {
    return (
      <Switch>
        <Route path="/super-admin" component={SuperAdminPage} />
        <Route>
          <SuperAdminPage />
        </Route>
      </Switch>
    );
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/events" component={EventsPage} />
        <Route path="/events/:id" component={EventDetailPage} />
        <Route path="/issue-ticket" component={IssueTicketPage} />
        <Route path="/staff" component={StaffPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/logs" component={ActivityLogsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LocaleProvider>
          <QueryClientProvider client={queryClient}>
            <TooltipProvider>
              <AuthProvider>
                <OrgProvider>
                  {/* BrandingProvider must be inside OrgProvider so it can read org data */}
                  <BrandingProvider>
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                      <ProtectedRoutes />
                    </WouterRouter>
                    <Toaster />
                  </BrandingProvider>
                </OrgProvider>
              </AuthProvider>
            </TooltipProvider>
          </QueryClientProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
