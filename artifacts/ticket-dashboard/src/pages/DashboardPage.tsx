import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { CalendarDays, Ticket, ScanLine, TrendingUp } from "lucide-react";

interface Stats {
  totalEvents: number;
  totalTickets: number;
  scannedTickets: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  iconBg,
  loading,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  loading: boolean;
  trend?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-6 ${gradient} border border-white/10`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shadow-md`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-white/70 bg-white/10 px-2 py-1 rounded-lg">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </div>
        )}
      </div>
      {loading ? (
        <div className="h-9 w-20 bg-white/20 animate-pulse rounded-lg" />
      ) : (
        <p className="text-3xl font-bold text-white">{value.toLocaleString()}</p>
      )}
      <p className="text-sm font-medium text-white/70 mt-1">{label}</p>
      {/* Decorative blur */}
      <div className="absolute -bottom-4 -end-4 w-24 h-24 rounded-full bg-white/5 blur-2xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLocale();
  const [stats, setStats] = useState<Stats>({ totalEvents: 0, totalTickets: 0, scannedTickets: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      const [eventsRes, ticketsRes, scannedRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id", { count: "exact", head: true }).eq("is_scanned", true),
      ]);
      setStats({
        totalEvents: eventsRes.count ?? 0,
        totalTickets: ticketsRes.count ?? 0,
        scannedTickets: scannedRes.count ?? 0,
      });
      setError(null);
    } catch {
      setError(t.failedStats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const channel = supabase
      .channel("realtime-attendance")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, fetchStats)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const attendanceRate =
    stats.totalTickets > 0
      ? Math.round((stats.scannedTickets / stats.totalTickets) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.dashboardTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.dashboardSubtitle}</p>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label={t.totalEvents}
          value={stats.totalEvents}
          icon={CalendarDays}
          gradient="bg-gradient-to-br from-blue-600 to-cyan-600"
          iconBg="bg-white/20"
          loading={loading}
        />
        <StatCard
          label={t.totalTickets}
          value={stats.totalTickets}
          icon={Ticket}
          gradient="bg-gradient-to-br from-violet-600 to-purple-700"
          iconBg="bg-white/20"
          loading={loading}
        />
        <StatCard
          label={t.liveAttendance}
          value={stats.scannedTickets}
          icon={ScanLine}
          gradient="bg-gradient-to-br from-emerald-500 to-green-600"
          iconBg="bg-white/20"
          loading={loading}
          trend={`${attendanceRate}%`}
        />
      </div>

      {/* Real-time card */}
      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-60" />
          </div>
          <span className="text-sm font-semibold text-foreground">{t.liveTracking}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{t.liveTrackingDesc}</p>

        {!loading && (
          <div>
            <div className="flex justify-between items-center text-sm mb-2">
              <span className="text-muted-foreground font-medium">{t.attendanceRate}</span>
              <span className="font-bold text-foreground text-base">{attendanceRate}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(attendanceRate, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{stats.scannedTickets} {t.liveAttendance}</span>
              <span>{stats.totalTickets} {t.totalTickets}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
