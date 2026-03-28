import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { useBranding } from "@/contexts/BrandingContext";
import { CalendarDays, Ticket, ScanLine, TrendingUp, AlertCircle, RefreshCw, Users, ArrowRight, ArrowLeft, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface Stats {
  totalEvents: number;
  totalTickets: number;
  scannedTickets: number;
  totalRevenue: number;
}

interface RecentEvent {
  id: string;
  title: string;
  event_date: string | null;
  price: number | null;
}

function StatCard({
  label, value, icon: Icon, gradient, loading, trend, prefix, suffix,
}: {
  label: string; value: number; icon: React.ElementType; gradient: string;
  loading: boolean; trend?: string; prefix?: string; suffix?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 ${gradient} shadow-lg`}>
      <div className="absolute inset-0 opacity-10">
        <div className="absolute -top-4 -end-4 w-28 h-28 rounded-full bg-white blur-2xl" />
        <div className="absolute -bottom-4 -start-4 w-20 h-20 rounded-full bg-white blur-xl" />
      </div>
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-[11px] font-bold text-white/80 bg-white/15 px-2 py-1 rounded-lg backdrop-blur-sm">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </div>
          )}
        </div>
        {loading ? (
          <div className="h-9 w-24 bg-white/20 animate-pulse rounded-lg mb-1" />
        ) : (
          <p className="text-3xl font-black text-white tracking-tight">
            {prefix}{value.toLocaleString()}{suffix}
          </p>
        )}
        <p className="text-sm font-medium text-white/70 mt-1">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { t, isRTL, lang } = useLocale();
  const { profile } = useAuth();
  const { systemName } = useBranding();
  const [, navigate] = useLocation();
  const isAr = lang === "ar";

  const [stats, setStats] = useState<Stats>({ totalEvents: 0, totalTickets: 0, scannedTickets: 0, totalRevenue: 0 });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  const fetchStats = async () => {
    setLoading(true);
    const errs: string[] = [];
    let totalEvents = 0, totalTickets = 0, scannedTickets = 0, totalRevenue = 0;

    const [eventsRes, allTicketsRes, scannedRes, recentRes] = await Promise.all([
      supabase.from("events").select("id, price", { count: "exact" }),
      supabase.from("tickets").select("event_id"),
      supabase.from("tickets").select("id", { count: "exact", head: true }).eq("is_scanned", true),
      supabase.from("events").select("id, title, event_date, price").order("created_at", { ascending: false }).limit(5),
    ]);

    if (eventsRes.error) errs.push(`Events: ${eventsRes.error.message}`);
    else {
      totalEvents = eventsRes.count ?? 0;
      // Revenue = sum of (event.price × ticket_count_for_that_event)
      if (!allTicketsRes.error && allTicketsRes.data && eventsRes.data) {
        // Count tickets per event
        const ticketCountByEvent: Record<string, number> = {};
        for (const tk of allTicketsRes.data) {
          ticketCountByEvent[tk.event_id] = (ticketCountByEvent[tk.event_id] ?? 0) + 1;
        }
        totalRevenue = eventsRes.data.reduce((sum, ev) => {
          const count = ticketCountByEvent[ev.id] ?? 0;
          return sum + (ev.price ?? 0) * count;
        }, 0);
        totalTickets = allTicketsRes.data.length;
      }
    }

    if (allTicketsRes.error) errs.push(`Tickets: ${allTicketsRes.error.message}`);

    if (!scannedRes.error) scannedTickets = scannedRes.count ?? 0;

    if (!recentRes.error && recentRes.data) {
      setRecentEvents(recentRes.data as RecentEvent[]);
    }

    setStats({ totalEvents, totalTickets, scannedTickets, totalRevenue });
    setErrors(errs);
    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel("realtime-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, fetchStats)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const attendanceRate = stats.totalTickets > 0
    ? Math.round((stats.scannedTickets / stats.totalTickets) * 100)
    : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (isAr) return h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-0.5">
            {greeting()}, {profile?.full_name?.split(" ")[0] || (isAr ? "مدير" : "Admin")} 👋
          </p>
          <h1 className="text-2xl font-black text-foreground">{systemName || t.appName}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{t.dashboardSubtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="rounded-xl shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">{isAr ? "تعذر تحميل البيانات" : "Could not load data"}</p>
            {errors.map((e, i) => <p key={i} className="text-xs opacity-70 font-mono">{e}</p>)}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t.totalEvents} value={stats.totalEvents} icon={CalendarDays}
          gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 shadow-blue-500/25"
          loading={loading}
        />
        <StatCard
          label={t.totalTickets} value={stats.totalTickets} icon={Ticket}
          gradient="bg-gradient-to-br from-violet-600 via-purple-600 to-purple-700 shadow-violet-500/25"
          loading={loading}
        />
        <StatCard
          label={t.liveAttendance} value={stats.scannedTickets} icon={ScanLine}
          gradient="bg-gradient-to-br from-emerald-500 via-emerald-500 to-green-600 shadow-emerald-500/25"
          loading={loading} trend={`${attendanceRate}%`}
        />
        <StatCard
          label={isAr ? "إجمالي الإيرادات" : "Est. Revenue"} value={stats.totalRevenue} icon={DollarSign}
          gradient="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-orange-500/25"
          loading={loading} prefix="RWF "
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Live Attendance */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-60" />
              </div>
              <span className="font-bold text-foreground">{t.liveTracking}</span>
            </div>
            <span className="text-2xl font-black text-foreground">{attendanceRate}%</span>
          </div>

          <p className="text-sm text-muted-foreground mb-5">{t.liveTrackingDesc}</p>

          <div className="space-y-2">
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600">{stats.scannedTickets} {t.liveAttendance}</span>
              <span>{stats.totalTickets} {t.totalTickets}</span>
            </div>
          </div>

          {/* Mini stat row */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-border">
            {[
              { label: isAr ? "الفعاليات" : "Events", value: stats.totalEvents, color: "text-blue-600" },
              { label: isAr ? "التذاكر" : "Tickets", value: stats.totalTickets, color: "text-violet-600" },
              { label: isAr ? "الحضور" : "Attended", value: stats.scannedTickets, color: "text-emerald-600" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Events */}
        <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-foreground text-sm">{isAr ? "آخر الفعاليات" : "Recent Events"}</h3>
            <button
              onClick={() => navigate("/events")}
              className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors flex items-center gap-1"
            >
              {isAr ? "عرض الكل" : "View all"}
              <ArrowIcon className="w-3 h-3" />
            </button>
          </div>

          {loading ? (
            <div className="divide-y divide-border">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3.5 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-5">
              <CalendarDays className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t.noEvents}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentEvents.map((event) => (
                <button
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors text-start"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.event_date
                        ? new Date(event.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { month: "short", day: "numeric" })
                        : (isAr ? "لا يوجد تاريخ" : "No date")}
                    </p>
                  </div>
                  {event.price != null && (
                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 shrink-0">
                      {event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price?.toLocaleString()}`}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="px-5 py-3 border-t border-border">
            <Button
              onClick={() => navigate("/issue-ticket")}
              size="sm"
              className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 shadow-sm shadow-violet-500/20 font-semibold"
            >
              <Ticket className="w-3.5 h-3.5" />
              {t.issueTicket}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: isAr ? "إضافة فعالية" : "Add Event", icon: CalendarDays, href: "/events", color: "bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30" },
          { label: isAr ? "إصدار تذكرة" : "Issue Ticket", icon: Ticket, href: "/issue-ticket", color: "bg-violet-50 dark:bg-violet-900/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30" },
          { label: isAr ? "إدارة الموظفين" : "Manage Staff", icon: Users, href: "/staff", color: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30" },
          { label: isAr ? "السجلات" : "Activity Logs", icon: ScanLine, href: "/logs", color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30" },
        ].map(({ label, icon: Icon, href, color }) => (
          <button
            key={href}
            onClick={() => navigate(href)}
            className={`flex items-center gap-3 p-4 rounded-2xl border transition-all hover:scale-[1.02] hover:shadow-md ${color}`}
          >
            <div className="w-8 h-8 rounded-xl bg-current/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-semibold text-start leading-tight">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
