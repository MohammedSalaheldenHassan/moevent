import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setBaseUrl } from "@workspace/api-client-react";
import { Link, Route, Router, Switch, useLocation } from "wouter";
import { LocaleProvider, useLocale } from "@/lib/i18n";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import HomePage from "@/pages/HomePage";
import EventPage from "@/pages/EventPage";
import PrivacyPage from "@/pages/PrivacyPage";

// In dev /api is proxied to the Express server; a deployed site points at the
// API host (e.g. https://api.up.railway.app). Generated URLs already start with
// /api, so a trailing /api in the variable is dropped — like the dashboard,
// either form works. A bare hostname gets https:// (otherwise the browser would
// treat it as a path on this site).
function normalizeApiBase(raw: string | undefined): string {
  let base = (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "").replace(/\/api$/, "");
  if (base && !/^https?:\/\//i.test(base)) base = `https://${base}`;
  return base;
}
const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE as string | undefined);
if (apiBase) setBaseUrl(apiBase);

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [location]);
  return null;
}

function NotFound() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-md px-4 pt-24 text-center">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t.pageNotFound}</h1>
      <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-md bg-btn px-5 font-medium text-on-btn hover:bg-accent hover:text-white">
        {t.goHome}
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <Router base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <ScrollToTop />
          <div className="flex min-h-dvh flex-col">
            <Navbar />
            {/* pb: every page keeps the same gap above the footer. */}
            <main id="main" tabIndex={-1} className="flex-1 pb-16 outline-none sm:pb-24">
              <Switch>
                <Route path="/" component={HomePage} />
                <Route path="/privacy" component={PrivacyPage} />
                <Route path="/events/:id">{(params) => <EventPage id={params.id} />}</Route>
                <Route component={NotFound} />
              </Switch>
            </main>
            <Footer />
          </div>
        </Router>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
