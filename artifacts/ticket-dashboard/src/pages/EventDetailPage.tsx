import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Ticket,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
}

interface TicketRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  is_scanned: boolean;
  created_at: string;
}

type Filter = "all" | "scanned" | "not_scanned";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [, navigate] = useLocation();
  const { t, isRTL } = useLocale();

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [eventRes, ticketsRes] = await Promise.all([
          supabase.from("events").select("id, title, event_date, location").eq("id", id).single(),
          supabase.from("tickets").select("*").eq("event_id", id).order("created_at", { ascending: false }),
        ]);
        if (eventRes.error) throw eventRes.error;
        if (ticketsRes.error) throw ticketsRes.error;
        setEvent(eventRes.data);
        setTickets(ticketsRes.data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.somethingWrong);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const filtered = tickets.filter((tk) => {
    const matchesSearch =
      tk.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      (tk.customer_phone || "").toLowerCase().includes(search.toLowerCase()) ||
      tk.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "scanned" && tk.is_scanned) ||
      (filter === "not_scanned" && !tk.is_scanned);
    return matchesSearch && matchesFilter;
  });

  const scannedCount = tickets.filter((tk) => tk.is_scanned).length;

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow;
    if (mins < 60) return `${mins}${t.minutesAgo}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t.hoursAgo}`;
    return `${Math.floor(hrs / 24)}${t.daysAgo}`;
  };

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate("/events")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <BackIcon className="w-4 h-4" />
        {t.backToEvents}
      </button>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : event ? (
        <>
          {/* Event Header Card */}
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-6 text-white shadow-lg shadow-violet-500/25">
            <h1 className="text-2xl font-bold mb-3">{event.title}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                {event.event_date
                  ? (() => { try { return format(new Date(event.event_date), "PPP"); } catch { return event.event_date; } })()
                  : "—"}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Ticket className="w-4 h-4" />
                {tickets.length} {t.ticketCount} · {scannedCount} {t.scanned}
              </span>
            </div>
          </div>

          {/* Tickets Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">{t.eventTickets}</h2>

            {/* Search + Filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", isRTL ? "right-3" : "left-3")} />
                <Input
                  placeholder={t.searchTickets}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn("h-10 rounded-xl", isRTL ? "pr-9" : "pl-9")}
                />
              </div>
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl">
                {(["all", "scanned", "not_scanned"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      filter === f
                        ? "bg-white shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f === "all" ? t.filterAll : f === "scanned" ? t.scanned : t.notScanned}
                  </button>
                ))}
              </div>
            </div>

            {/* Tickets list */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-card border border-card-border rounded-2xl">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Ticket className="w-7 h-7 text-primary" />
                </div>
                <p className="text-foreground font-semibold">{t.noTickets}</p>
                <p className="text-muted-foreground text-sm mt-1">{t.noTicketsDesc}</p>
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-border bg-muted/30">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {filtered.length} {t.ticketCount}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((tk) => (
                    <div key={tk.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                        tk.is_scanned
                          ? "bg-emerald-100 dark:bg-emerald-900/30"
                          : "bg-amber-100 dark:bg-amber-900/30"
                      )}>
                        {tk.is_scanned
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : <Clock className="w-4 h-4 text-amber-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{tk.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tk.customer_phone && <span className="me-2">{tk.customer_phone}</span>}
                          <span className="font-mono">#{tk.id.slice(0, 8)}</span>
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <span className={cn(
                          "inline-block px-2.5 py-1 rounded-full text-xs font-semibold mb-1",
                          tk.is_scanned
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        )}>
                          {tk.is_scanned ? t.scanned : t.notScanned}
                        </span>
                        <p className="text-[10px] text-muted-foreground">{timeAgo(tk.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
