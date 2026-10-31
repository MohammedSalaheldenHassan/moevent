import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { useBranding } from "@/contexts/BrandingContext";
import { useOrg } from "@/contexts/OrgContext";
import {
  CalendarDays, Ticket, ScanLine, TrendingUp, AlertCircle, RefreshCw,
  Users, ArrowRight, ArrowLeft, DollarSign, CalendarCheck2, CalendarX2,
  Building2, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
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
  label, value, icon: Icon, gradient, loading, trend, prefix, suffix, sub, subLabel,
}: {
  label: string; value: number; icon: React.ElementType; gradient: string;
  loading: boolean; trend?: string; prefix?: string; suffix?: string;
  sub?: number; subLabel?: string;
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
        {sub !== undefined && subLabel && !loading && (
          <p className="text-[11px] text-white/50 mt-1 font-medium">
            {subLabel}: {prefix}{sub.toLocaleString()}{suffix}
          </p>
        )}
      </div>
    </div>
  );
}

const PIE_COLORS = ["#7c3aed", "#a78bfa", "#e879f9", "#6d28d9"];
const BAR_COLOR = "#7c3aed";
const BAR_COLOR2 = "#06b6d4";

export default function DashboardPage() {
  const { t, isRTL, lang } = useLocale();
  const { profile } = useAuth();
  const { systemName } = useBranding();
  const { org_name, logo_url, primary_color } = useOrg();
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
  const orgId = profile?.org_id ?? null;

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

    let eventsQuery = supabase.from("events").select("id, title, price, event_date", { count: "exact" });
    let recentQuery = supabase.from("events").select("id, title, event_date, price").order("created_at", { ascending: false }).limit(5);

    // Multi-tenant: filter by org_id when available
    if (orgId) {
      eventsQuery = eventsQuery.eq("org_id", orgId) as typeof eventsQuery;
      recentQuery = recentQuery.eq("org_id", orgId) as typeof recentQuery;
    }

    // Step 1: fetch events (and recent events) — already org_id filtered above
    // allowedEventIds: null = no staff restriction; [] = staff with zero access
    const noEventsAccess = allowedEventIds !== null && allowedEventIds.length === 0;
    const emptyResult0 = { data: [], error: null, count: 0 } as unknown as Awaited<typeof eventsQuery>;

    const [eventsRes, recentRes] = noEventsAccess
      ? [emptyResult0, emptyResult0]
      : await Promise.all([
          allowedEventIds ? eventsQuery.in("id", allowedEventIds) : eventsQuery,
          allowedEventIds ? recentQuery.in("id", allowedEventIds) : recentQuery,
        ]);

    // Step 2: build the event ID list to filter tickets — no org_id on tickets table
    let ticketEventIds: string[] | null = null;
    if (noEventsAccess) {
      ticketEventIds = [];
    } else if (allowedEventIds) {
      ticketEventIds = allowedEventIds;
    } else if (orgId && eventsRes.data) {
      ticketEventIds = eventsRes.data.map((ev) => ev.id);
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
  }, [orgId]);

  const attendanceRate = stats.totalTickets > 0
    ? Math.round((stats.scannedTickets / stats.totalTickets) * 100)
    : 0;

  const netRevenue = Math.round(stats.totalRevenue * 0.95);
  const platformFees = Math.round(stats.totalRevenue * 0.05);

  const pieData = stats.totalRevenue > 0
    ? [
        { name: isAr ? "صافي الإيراد (95%)" : "Net Revenue (95%)", value: netRevenue },
        { name: isAr ? "رسوم المنصة (5%)" : "Platform Fees (5%)", value: platformFees },
      ]
    : [];

  const greeting = () => {
    const h = new Date().getHours();
    if (isAr) return h < 12 ? "صباح الخير" : h < 17 ? "مساء الخير" : "مساء النور";
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  };

  const accentColor = primary_color ?? "#7c3aed";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground font-medium mb-0.5">
            {greeting()}, {profile?.full_name?.split(" ")[0] || (isAr ? "مدير" : "Admin")} 👋
          </p>
          <div className="flex items-center gap-2.5">
            {logo_url && (
              <img src={logo_url} alt="org logo" className="w-8 h-8 rounded-lg object-cover border border-border" />
            )}
            <h1 className="text-2xl font-black text-foreground">
              {org_name || systemName || t.appName}
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">{t.dashboardSubtitle}</p>
          {orgId && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-violet-500/20 bg-violet-500/5 text-violet-500 text-[11px] font-semibold">
              <Building2 className="w-3 h-3" />
              {isAr ? "مؤسستك" : "Your Organization"}
            </div>
          )}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label={t.totalEvents} value={stats.totalEvents} icon={CalendarDays}
          gradient="bg-gradient-to-br from-blue-500 via-blue-600 to-cyan-600 shadow-blue-500/25"
          loading={loading}
        />
        <StatCard
          label={isAr ? "فعاليات متاحة" : "Available Events"} value={stats.availableEvents} icon={CalendarCheck2}
          gradient="bg-gradient-to-br from-teal-500 via-emerald-500 to-green-600 shadow-teal-500/25"
          loading={loading}
        />
        <StatCard
          label={isAr ? "فعاليات منتهية" : "Expired Events"} value={stats.expiredEvents} icon={CalendarX2}
          gradient="bg-gradient-to-br from-slate-500 via-slate-600 to-zinc-700 shadow-slate-500/25"
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
          label={isAr ? "إجمالي الإيرادات" : "Total Revenue"} value={stats.totalRevenue} icon={DollarSign}
          gradient="bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 shadow-orange-500/25"
          loading={loading} prefix="RWF "
        />
      </div>

      {/* Revenue Split */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-800 shadow-lg shadow-violet-500/20">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-4 -end-4 w-28 h-28 rounded-full bg-white blur-2xl" />
          </div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-white/80 bg-white/15 px-2 py-1 rounded-lg">
                <Percent className="w-3 h-3" />
                {isAr ? "95%" : "95%"}
              </div>
            </div>
            {loading ? (
              <div className="h-9 w-24 bg-white/20 animate-pulse rounded-lg mb-1" />
            ) : (
              <p className="text-3xl font-black text-white tracking-tight">RWF {netRevenue.toLocaleString()}</p>
            )}
            <p className="text-sm font-medium text-white/70 mt-1">
              {isAr ? "صافي إيرادك (95%)" : "Your Net Revenue (95%)"}
            </p>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-rose-500 via-pink-600 to-fuchsia-700 shadow-lg shadow-rose-500/20">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-4 -end-4 w-28 h-28 rounded-full bg-white blur-2xl" />
          </div>
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Percent className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-white/80 bg-white/15 px-2 py-1 rounded-lg">
                <TrendingUp className="w-3 h-3" />
                {isAr ? "5%" : "5%"}
              </div>
            </div>
            {loading ? (
              <div className="h-9 w-24 bg-white/20 animate-pulse rounded-lg mb-1" />
            ) : (
              <p className="text-3xl font-black text-white tracking-tight">RWF {platformFees.toLocaleString()}</p>
            )}
            <p className="text-sm font-medium text-white/70 mt-1">
              {isAr ? "رسوم المنصة (5%)" : "Platform Fees (5%)"}
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar chart: tickets per event */}
        <div className="lg:col-span-3 bg-card border border-card-border rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-foreground mb-1">{isAr ? "التذاكر لكل فعالية" : "Tickets per Event"}</h3>
          <p className="text-xs text-muted-foreground mb-5">{isAr ? "أعلى الفعاليات من حيث المبيعات" : "Top events by ticket sales"}</p>
          {loading ? (
            <div className="h-48 bg-muted/30 animate-pulse rounded-xl" />
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
                <Bar dataKey="tickets" fill={accentColor} radius={[6, 6, 0, 0]} maxBarSize={40} />
                <Bar dataKey="revenue" fill={BAR_COLOR2} radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart: revenue split + recent events */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Pie chart */}
          <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm flex-1">
            <h3 className="font-bold text-foreground mb-1">{isAr ? "توزيع الإيرادات" : "Revenue Split"}</h3>
            <p className="text-xs text-muted-foreground mb-3">{isAr ? "المؤسسة مقابل المنصة" : "Org vs Platform"}</p>
            {loading ? (
              <div className="h-36 bg-muted/30 animate-pulse rounded-xl" />
            ) : pieData.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-muted-foreground text-sm">
                {isAr ? "لا توجد إيرادات بعد" : "No revenue yet"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={65}
                    paddingAngle={3} dataKey="value" stroke="none">
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                      borderRadius: "12px", fontSize: "12px",
                    }}
                    formatter={(val: number) => [`RWF ${val.toLocaleString()}`]}
                  />
                  <Legend
                    iconType="circle" iconSize={8}
                    wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Attendance ring */}
          <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-60" />
                </div>
                <span className="font-bold text-foreground text-sm">{t.liveTracking}</span>
              </div>
              <span className="text-xl font-black text-foreground">{attendanceRate}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700"
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
        <div className="lg:col-span-3 bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
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

        {/* Quick actions + mini stats */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground text-sm mb-3">{isAr ? "إجراءات سريعة" : "Quick Actions"}</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: isAr ? "إضافة فعالية" : "Add Event", icon: CalendarDays, href: "/events", color: "bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/30" },
                { label: isAr ? "إصدار تذكرة" : "Issue Ticket", icon: Ticket, href: "/issue-ticket", color: "bg-violet-50 dark:bg-violet-900/10 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/30" },
                { label: isAr ? "إدارة الموظفين" : "Manage Staff", icon: Users, href: "/staff", color: "bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/30" },
                { label: isAr ? "السجلات" : "Activity Logs", icon: ScanLine, href: "/logs", color: "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30" },
              ].map(({ label, icon: Icon, href, color }) => (
                <button
                  key={href}
                  onClick={() => navigate(href)}
                  className={`flex items-center gap-2.5 p-3.5 rounded-xl border transition-all hover:scale-[1.02] hover:shadow-md ${color}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-semibold text-start leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mini stat summary */}
          <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-foreground text-sm mb-3">{isAr ? "ملخص سريع" : "Quick Summary"}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: isAr ? "الكل" : "All Events", value: stats.totalEvents, color: "text-blue-600" },
                { label: isAr ? "متاحة" : "Available", value: stats.availableEvents, color: "text-teal-600" },
                { label: isAr ? "التذاكر" : "Tickets", value: stats.totalTickets, color: "text-violet-600" },
                { label: isAr ? "الحضور" : "Attended", value: stats.scannedTickets, color: "text-emerald-600" },
              ].map((s) => (
                <div key={s.label} className="text-center p-2 rounded-xl bg-muted/30">
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
