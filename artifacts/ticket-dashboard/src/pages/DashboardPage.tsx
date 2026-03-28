import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CalendarDays, Ticket, ScanLine, Loader2 } from "lucide-react";

interface Stats {
  totalEvents: number;
  totalTickets: number;
  scannedTickets: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-16 bg-muted animate-pulse rounded" />
      ) : (
        <p className="text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
      )}
    </div>
  );
}

export default function DashboardPage() {
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
      setError("Failed to load stats. Retrying...");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();

    const channel = supabase
      .channel("realtime-attendance")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => {
          fetchStats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your event management system</p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Total Events"
          value={stats.totalEvents}
          icon={CalendarDays}
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          loading={loading}
        />
        <StatCard
          label="Total Tickets"
          value={stats.totalTickets}
          icon={Ticket}
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          loading={loading}
        />
        <StatCard
          label="Live Attendance"
          value={stats.scannedTickets}
          icon={ScanLine}
          color="bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
          loading={loading}
        />
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-medium text-foreground">Live Attendance Tracking</span>
        </div>
        <p className="text-sm text-muted-foreground">
          The attendance counter updates automatically in real-time as tickets are scanned at your events.
        </p>
        {!loading && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Attendance rate</span>
              <span>
                {stats.totalTickets > 0
                  ? Math.round((stats.scannedTickets / stats.totalTickets) * 100)
                  : 0}%
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    stats.totalTickets > 0
                      ? Math.min((stats.scannedTickets / stats.totalTickets) * 100, 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
