import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  Eye,
  Printer,
  X,
  User,
  Phone,
  Hash,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

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
  const { t, isRTL, lang } = useLocale();

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Ticket detail modal
  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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

  const openTicketDetail = async (tk: TicketRow) => {
    setSelectedTicket(tk);
    setQrDataUrl(null);
    setQrLoading(true);
    try {
      const qrContent = JSON.stringify({
        ticketId: tk.id,
        event: event?.title ?? "",
        customer: tk.customer_name,
      });
      const url = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });
      setQrDataUrl(url);
    } catch {
      setQrDataUrl(null);
    } finally {
      setQrLoading(false);
    }
  };

  const handlePrint = () => {
    if (!selectedTicket || !event) return;
    const isAr = lang === "ar";
    const win = window.open("", "_blank");
    if (!win) return;
    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    win.document.write(`
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
        <head>
          <title>${isAr ? "تذكرة" : "Ticket"} - ${selectedTicket.id}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: ${isAr ? "'Cairo'" : "'Inter'"}, system-ui, sans-serif; display: flex; justify-content: center; padding: 40px; background: #f3f4f6; }
            .ticket { background: white; border-radius: 24px; max-width: 420px; width: 100%; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
            .ticket-header { background: linear-gradient(135deg, #7c3aed, #9333ea); padding: 28px 24px; text-align: center; }
            .ticket-logo { font-size: 28px; margin-bottom: 6px; }
            .ticket-app { color: white; font-size: 18px; font-weight: 800; opacity: 0.9; }
            .ticket-body { padding: 28px 24px; }
            .event-name { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 6px; }
            .event-meta { display: flex; gap: 12px; font-size: 13px; color: #6b7280; margin-bottom: 24px; flex-wrap: wrap; }
            .divider { border: none; border-top: 2px dashed #e5e7eb; margin: 0 -24px 24px; }
            .customer-section { margin-bottom: 20px; }
            .customer-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
            .customer-value { font-size: 17px; font-weight: 700; color: #111827; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 20px;
              background: ${selectedTicket.is_scanned ? "#d1fae5" : "#fef3c7"}; color: ${selectedTicket.is_scanned ? "#065f46" : "#92400e"}; }
            .qr-container { text-align: center; margin: 20px 0 16px; }
            .qr-container img { width: 180px; height: 180px; border-radius: 12px; border: 1px solid #f3f4f6; }
            .ticket-id { text-align: center; font-size: 10px; color: #d1d5db; word-break: break-all; padding: 0 16px; }
            @media print { body { padding: 0; background: white; } .ticket { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="ticket-header">
              <div class="ticket-logo">🎫</div>
              <div class="ticket-app">${isAr ? "تذكرتي" : "TicketHub"}</div>
            </div>
            <div class="ticket-body">
              <div class="event-name">${event.title}</div>
              <div class="event-meta">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ""}
                ${event.location ? `<span>📍 ${event.location}</span>` : ""}
              </div>
              <hr class="divider" />
              <div class="customer-section">
                <div class="customer-label">${isAr ? "اسم العميل" : "Customer Name"}</div>
                <div class="customer-value">${selectedTicket.customer_name}</div>
              </div>
              ${selectedTicket.customer_phone ? `
              <div class="customer-section">
                <div class="customer-label">${isAr ? "رقم الهاتف" : "Phone Number"}</div>
                <div class="customer-value">${selectedTicket.customer_phone}</div>
              </div>` : ""}
              <div class="status-badge">${selectedTicket.is_scanned ? (isAr ? "تم الفحص" : "Scanned") : (isAr ? "لم يُفحص" : "Not Scanned")}</div>
              ${qrDataUrl ? `<div class="qr-container"><img src="${qrDataUrl}" alt="QR Code" /></div>` : ""}
              <div class="ticket-id">${isAr ? "رقم التذكرة" : "Ticket ID"}: ${selectedTicket.id}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

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

  const fmtDate = (d: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "PPP"); } catch { return d; }
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
              {event.event_date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="w-4 h-4" />
                  {fmtDate(event.event_date)}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {event.location}
                </span>
              )}
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
                    <div
                      key={tk.id}
                      className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => openTicketDetail(tk)}
                    >
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
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-end">
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
                        <div className="w-8 h-8 rounded-lg bg-muted/60 hover:bg-primary/10 hover:text-primary flex items-center justify-center transition-colors">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Ticket Detail Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-sm p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <DialogTitle className="sr-only">
            {selectedTicket?.customer_name} — {lang === "ar" ? "تفاصيل التذكرة" : "Ticket Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {lang === "ar" ? "تفاصيل التذكرة مع رمز الاستجابة السريعة" : "Ticket details with QR code"}
          </DialogDescription>
          {selectedTicket && event && (
            <>
              {/* Close button */}
              <button
                onClick={() => setSelectedTicket(null)}
                className="absolute top-3 end-3 z-10 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>

              {/* Ticket card */}
              <div ref={printRef}>
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-6 pt-7 pb-5 text-center">
                  <div className="text-3xl mb-1.5">🎫</div>
                  <h2 className="text-white font-bold text-lg leading-snug">{event.title}</h2>
                  {(event.event_date || event.location) && (
                    <div className="flex items-center justify-center flex-wrap gap-3 mt-2 text-white/70 text-xs">
                      {event.event_date && (
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {fmtDate(event.event_date)}
                        </span>
                      )}
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Status badge */}
                  <div className="mt-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                      selectedTicket.is_scanned
                        ? "bg-emerald-400/20 text-emerald-200"
                        : "bg-amber-400/20 text-amber-200"
                    )}>
                      {selectedTicket.is_scanned
                        ? <><CheckCircle2 className="w-3 h-3" />{t.scanned}</>
                        : <><Clock className="w-3 h-3" />{t.notScanned}</>
                      }
                    </span>
                  </div>
                </div>

                {/* Dashed separator */}
                <div className="relative bg-card">
                  <div className="absolute -top-3 start-0 end-0 flex items-center px-4">
                    <div className="flex-1 border-t-2 border-dashed border-border" />
                    <div className="w-6 h-6 rounded-full bg-background border border-border mx-2 shrink-0" />
                    <div className="flex-1 border-t-2 border-dashed border-border" />
                  </div>
                </div>

                {/* Body */}
                <div className="bg-card px-6 pt-6 pb-5 space-y-4">
                  {/* Customer info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {lang === "ar" ? "العميل" : "Customer"}
                      </p>
                      <p className="font-bold text-foreground text-sm">{selectedTicket.customer_name}</p>
                    </div>
                    {selectedTicket.customer_phone && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {lang === "ar" ? "الهاتف" : "Phone"}
                        </p>
                        <p className="font-bold text-foreground text-sm">{selectedTicket.customer_phone}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {lang === "ar" ? "رقم التذكرة" : "Ticket ID"}
                    </p>
                    <p className="font-mono text-xs text-foreground/70 break-all">{selectedTicket.id}</p>
                  </div>

                  {/* QR Code */}
                  <div className="flex justify-center pt-2">
                    <div className="bg-white rounded-2xl p-3 shadow-inner border border-border">
                      {qrLoading ? (
                        <div className="w-36 h-36 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                      ) : qrDataUrl ? (
                        <img src={qrDataUrl} alt="QR Code" className="w-36 h-36 rounded-xl block" />
                      ) : (
                        <div className="w-36 h-36 flex items-center justify-center text-muted-foreground text-xs text-center px-2">
                          QR unavailable
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-center text-[10px] text-muted-foreground/60">
                    {lang === "ar" ? "امسح الرمز للتحقق من التذكرة" : "Scan to verify this ticket"}
                  </p>
                </div>
              </div>

              {/* Footer actions */}
              <div className="bg-card px-6 pb-5">
                <Button
                  onClick={handlePrint}
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20 font-semibold text-sm"
                >
                  <Printer className="w-4 h-4" />
                  {t.printTicket}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
