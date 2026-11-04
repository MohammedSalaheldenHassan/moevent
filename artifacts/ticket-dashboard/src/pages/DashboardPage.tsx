import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { useBranding } from "@/contexts/BrandingContext";
import {
  CalendarDays, Ticket, ScanLine, AlertCircle, RefreshCw,
  Users, ArrowRight, ArrowLeft, DollarSign, CalendarCheck2, CalendarX2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Stats {
  totalEvents: number;
  availableEvents: number;
  expiredEvents: number;
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

interface EventTicketBar {
  name: string;
  tickets: number;
  revenue: number;
}

function StatCard({
  label, value, icon: Icon, loading, prefix, meta,
}: {
  label: string; value: number; icon: React.ElementType;
  loading: boolean; prefix?: string; meta?: string;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <Icon className="w-4 h-4 text-muted-foreground/70" strokeWidth={1.75} />
      </div>
      {loading ? (
        <div className="h-8 w-24 bg-muted animate-pulse rounded mt-2" />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold text-foreground tracking-tight tabular-nums">
          <span dir="ltr" className="inline-flex items-baseline gap-1">
            {prefix && <span className="text-base font-medium text-muted-foreground">{prefix}</span>}
            {value.toLocaleString()}
          </span>
        </p>
      )}
      {meta && !loading && <p className="text-xs text-muted-foreground mt-1">{meta}</p>}
    </div>
  );
}

const BAR_TICKETS = "hsl(var(--chart-1))";
const BAR_REVENUE = "hsl(var(--chart-2))";

export default function DashboardPage() {
  const { t, isRTL, lang } = useLocale();
  const { profile } = useAuth();
  const { systemName } = useBranding();
  const [, navigate] = useLocation();
  const isAr = lang === "ar";

  const [stats, setStats] = useState<Stats>({
    totalEvents: 0, availableEvents: 0, expiredEvents: 0,
    totalTickets: 0, scannedTickets: 0, totalRevenue: 0,
  });
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [barData, setBarData] = useState<EventTicketBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const isAdmin = !profile || profile.role === "admin";

  const fetchStats = async () => {
    setLoading(true);
    const errs: string[] = [];
    let totalEvents = 0, availableEvents = 0, expiredEvents = 0;
    let totalTickets = 0, scannedTickets = 0, totalRevenue = 0;

    // For staff: get their accessible event IDs first
    let allowedEventIds: string[] | null = null;
    if (!isAdmin && profile?.id) {
      const { data: accessData } = await supabase
        .from("event_access")
        .select("event_id")
        .eq("profile_id", profile.id);
      allowedEventIds = (accessData ?? []).map((a: { event_id: string }) => a.event_id);
    }

    const eventsQuery = supabase.from("events").select("id, title, price, event_date", { count: "exact" });
    const recentQuery = supabase.from("events").select("id, title, event_date, price").order("created_at", { ascending: false }).limit(5);

    // Step 1: fetch events (and recent events)
    // allowedEventIds: null = no staff restriction; [] = staff with zero access
    const noEventsAccess = allowedEventIds !== null && allowedEventIds.length === 0;
    const emptyResult0 = { data: [], error: null, count: 0 } as unknown as Awaited<typeof eventsQuery>;

    const [eventsRes, recentRes] = noEventsAccess
      ? [emptyResult0, emptyResult0]
      : await Promise.all([
          allowedEventIds ? eventsQuery.in("id", allowedEventIds) : eventsQuery,
          allowedEventIds ? recentQuery.in("id", allowedEventIds) : recentQuery,
        ]);

    // Step 2: build the event ID list to filter tickets (null = all tickets)
    let ticketEventIds: string[] | null = null;
    if (noEventsAccess) {
      ticketEventIds = [];
    } else if (allowedEventIds) {
      ticketEventIds = allowedEventIds;
    }

    // If we have an explicit empty list, skip DB calls entirely — nothing to query
    const emptyTicketSet = ticketEventIds !== null && ticketEventIds.length === 0;
    const emptyResult = { data: [], error: null, count: 0 };

    const [allTicketsRes, scannedRes] = emptyTicketSet
      ? [emptyResult, emptyResult]
      : await Promise.all([
          ticketEventIds
            ? supabase.from("tickets").select("event_id").in("event_id", ticketEventIds)
            : supabase.from("tickets").select("event_id"),
          ticketEventIds
            ? supabase.from("tickets").select("id", { count: "exact", head: true }).eq("is_scanned", true).in("event_id", ticketEventIds)
            : supabase.from("tickets").select("id", { count: "exact", head: true }).eq("is_scanned", true),
        ]);

    if (eventsRes.error) errs.push(`Events: ${eventsRes.error.message}`);
    else {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      totalEvents = eventsRes.count ?? 0;

      if (eventsRes.data) {
        availableEvents = eventsRes.data.filter((ev) => {
          if (!ev.event_date) return true;
          return new Date(ev.event_date) >= now;
        }).length;
        expiredEvents = eventsRes.data.filter((ev) => {
          if (!ev.event_date) return false;
          return new Date(ev.event_date) < now;
        }).length;

        if (!allTicketsRes.error && allTicketsRes.data && eventsRes.data) {
          const ticketCountByEvent: Record<string, number> = {};
          for (const tk of allTicketsRes.data) {
            ticketCountByEvent[tk.event_id] = (ticketCountByEvent[tk.event_id] ?? 0) + 1;
          }
          totalRevenue = eventsRes.data.reduce((sum, ev) => {
            const count = ticketCountByEvent[ev.id] ?? 0;
            return sum + (ev.price ?? 0) * count;
          }, 0);
          totalTickets = allTicketsRes.data.length;

          // Build bar chart data: top 8 events by ticket count
          const bars: EventTicketBar[] = eventsRes.data
            .map((ev) => ({
              name: ev.title?.length > 12 ? ev.title.slice(0, 12) + "…" : (ev.title ?? "—"),
              tickets: ticketCountByEvent[ev.id] ?? 0,
              revenue: (ev.price ?? 0) * (ticketCountByEvent[ev.id] ?? 0),
            }))
            .filter((b) => b.tickets > 0)
            .sort((a, b) => b.tickets - a.tickets)
            .slice(0, 8);
          setBarData(bars);
        }
      }
    }

    if (allTicketsRes.error) errs.push(`Tickets: ${allTicketsRes.error.message}`);
    if (!scannedRes.error) scannedTickets = scannedRes.count ?? 0;
    if (!recentRes.error && recentRes.data) setRecentEvents(recentRes.data as RecentEvent[]);

    setStats({ totalEvents, availableEvents, expiredEvents, totalTickets, scannedTickets, totalRevenue });
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
      <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-sm text-muted-foreground">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mt-0.5">
            {isAr ? "نظرة عامة" : "Overview"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {systemName || t.appName} · {new Date().toLocaleDateString(isAr ? "ar" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading} className="shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {isAr ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">{isAr ? "تعذر تحميل البيانات" : "Could not load data"}</p>
            {errors.map((e, i) => <p key={i} className="text-xs opacity-70 font-mono">{e}</p>)}
          </div>
        </div>
      )}

      {/* Key figures */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden">
        <StatCard label={isAr ? "إجمالي الإيرادات" : "Total Revenue"} value={stats.totalRevenue} icon={DollarSign} loading={loading} prefix="RWF" />
        <StatCard label={t.totalTickets} value={stats.totalTickets} icon={Ticket} loading={loading} />
        <StatCard
          label={t.liveAttendance} value={stats.scannedTickets} icon={ScanLine} loading={loading}
          meta={isAr ? `${attendanceRate}% من التذاكر` : `${attendanceRate}% of tickets`}
        />
        <StatCard label={t.totalEvents} value={stats.totalEvents} icon={CalendarDays} loading={loading} />
        <StatCard label={isAr ? "فعاليات قادمة" : "Upcoming Events"} value={stats.availableEvents} icon={CalendarCheck2} loading={loading} />
        <StatCard label={isAr ? "فعاليات منتهية" : "Past Events"} value={stats.expiredEvents} icon={CalendarX2} loading={loading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart: tickets per event */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-lg p-6">
          <h3 className="font-semibold text-foreground mb-1">{isAr ? "التذاكر لكل فعالية" : "Tickets per Event"}</h3>
          <p className="text-xs text-muted-foreground mb-5">{isAr ? "أعلى الفعاليات من حيث المبيعات" : "Top events by ticket sales"}</p>
          {loading ? (
            <div className="h-48 bg-muted/30 animate-pulse rounded-md" />
          ) : barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              {isAr ? "لا توجد بيانات بعد" : "No data yet"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  axisLine={false} tickLine={false} allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                    borderRadius: "12px", fontSize: "12px",
                  }}
                  cursor={{ fill: "hsl(var(--muted))", radius: 6 }}
                  formatter={(val: number, name: string) => [
                    name === "tickets" ? val : `RWF ${val.toLocaleString()}`,
                    name === "tickets" ? (isAr ? "تذاكر" : "Tickets") : (isAr ? "إيراد" : "Revenue"),
                  ]}
                />
                <Bar dataKey="tickets" fill={BAR_TICKETS} radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Bar dataKey="revenue" fill={BAR_REVENUE} radius={[3, 3, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Attendance + recent events */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Attendance ring */}
          <div className="bg-card border border-card-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="font-semibold text-foreground text-sm">{t.liveTracking}</span>
              </div>
              <span className="text-xl font-semibold text-foreground tabular-nums">{attendanceRate}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-emerald-600">{stats.scannedTickets} {isAr ? "حضر" : "Attended"}</span>
              <span>{stats.totalTickets} {isAr ? "إجمالي" : "Total"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Events + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent Events */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-foreground text-sm">{isAr ? "آخر الفعاليات" : "Recent Events"}</h3>
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
                  <div className="w-8 h-8 rounded-md bg-muted border border-border flex items-center justify-center shrink-0">
                    <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
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
                    <span className="text-xs font-medium text-foreground tabular-nums shrink-0">
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
              className="w-full"
            >
              <Ticket className="w-3.5 h-3.5" />
              {t.issueTicket}
            </Button>
          </div>
        </div>

        {/* Quick actions + mini stats */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-lg p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">{isAr ? "إجراءات سريعة" : "Quick Actions"}</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: isAr ? "إضافة فعالية" : "Add event", icon: CalendarDays, href: "/events" },
                { label: isAr ? "إصدار تذكرة" : "Issue ticket", icon: Ticket, href: "/issue-ticket" },
                { label: isAr ? "إدارة الموظفين" : "Manage staff", icon: Users, href: "/staff" },
                { label: isAr ? "السجلات" : "Activity log", icon: ScanLine, href: "/logs" },
              ].map(({ label, icon: Icon, href }) => (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-md border border-border bg-card hover:bg-muted/60 transition-colors"
                >
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <span className="text-[13px] font-medium text-foreground text-start leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
