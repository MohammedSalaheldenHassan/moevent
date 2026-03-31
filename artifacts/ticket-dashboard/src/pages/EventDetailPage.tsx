import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  ArrowLeft, ArrowRight, CalendarDays, MapPin, Ticket,
  Search, CheckCircle2, Clock, AlertCircle, Loader2,
  Eye, Printer, X, User, Phone, Hash, DollarSign, Users, UserPlus, Trash2, ShieldCheck, MessageCircle,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
  image_url: string | null;
}

interface TicketRow {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  is_scanned: boolean;
  created_at: string;
}

interface StaffProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
}

interface AccessRow {
  id: string;
  profile_id: string;
  profiles: StaffProfile;
}

type Filter = "all" | "scanned" | "not_scanned";

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [, navigate] = useLocation();
  const { t, isRTL, lang } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const { profile: currentProfile } = useAuth();
  const isAr = lang === "ar";
  const isAdmin = !currentProfile || currentProfile.role === "admin";

  const [event, setEvent] = useState<Event | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [selectedTicket, setSelectedTicket] = useState<TicketRow | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // ── WhatsApp Send ─────────────────────────────────────────────
  const [waTicket, setWaTicket] = useState<TicketRow | null>(null);
  const [waPhone, setWaPhone] = useState("");

  const openWhatsApp = (tk: TicketRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setWaTicket(tk);
    setWaPhone(tk.customer_phone ?? "");
  };

  const sendWhatsApp = () => {
    if (!waTicket || !event) return;
    const raw = waPhone.replace(/[\s\-().+]/g, "");
    if (!raw) return;
    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const priceStr = event.price != null
      ? (event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString()}`)
      : "";
    const msg = isAr
      ? [
          `🎫 *تذكرتك جاهزة!*`,
          ``,
          `📅 الفعالية: *${event.title}*`,
          dateStr ? `🗓️ التاريخ: ${dateStr}` : "",
          event.location ? `📍 الموقع: ${event.location}` : "",
          priceStr ? `💰 السعر: ${priceStr}` : "",
          ``,
          `👤 الاسم: ${waTicket.customer_name}`,
          `🔖 رقم التذكرة: #${waTicket.id.slice(0, 8).toUpperCase()}`,
          ``,
          `نتمنى لك وقتاً ممتعاً! 🎉`,
        ].filter(Boolean).join("\n")
      : [
          `🎫 *Your Ticket is Ready!*`,
          ``,
          `📅 Event: *${event.title}*`,
          dateStr ? `🗓️ Date: ${dateStr}` : "",
          event.location ? `📍 Location: ${event.location}` : "",
          priceStr ? `💰 Price: ${priceStr}` : "",
          ``,
          `👤 Name: ${waTicket.customer_name}`,
          `🔖 Ticket #: ${waTicket.id.slice(0, 8).toUpperCase()}`,
          ``,
          `Enjoy the event! 🎉`,
        ].filter(Boolean).join("\n");
    window.open(`https://wa.me/${raw}?text=${encodeURIComponent(msg)}`, "_blank");
    setWaTicket(null);
  };

  // ── Assigned Staff ────────────────────────────────────────────
  const [staffAccess, setStaffAccess] = useState<AccessRow[]>([]);
  const [allStaff, setAllStaff] = useState<StaffProfile[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [addingStaffId, setAddingStaffId] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);

  const fetchStaffAccess = async () => {
    if (!id) return;
    setStaffLoading(true);
    const [accessRes, allStaffRes] = await Promise.all([
      supabase
        .from("event_access")
        .select("id, profile_id, profiles(id, full_name, email, role)")
        .eq("event_id", id),
      isAdmin
        ? supabase.from("profiles").select("id, full_name, email, role").eq("role", "staff")
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (!accessRes.error) setStaffAccess((accessRes.data ?? []) as AccessRow[]);
    if (!allStaffRes.error) setAllStaff((allStaffRes.data ?? []) as StaffProfile[]);
    setStaffLoading(false);
  };

  const handleAddStaff = async () => {
    if (!addingStaffId || !id) return;
    setStaffError(null);
    const { error } = await supabase.from("event_access").insert({ event_id: id, profile_id: addingStaffId });
    if (error) { setStaffError(error.message); return; }
    setAddingStaffId("");
    fetchStaffAccess();
  };

  const handleRemoveStaff = async (accessRowId: string) => {
    setRemovingId(accessRowId);
    await supabase.from("event_access").delete().eq("id", accessRowId);
    setRemovingId(null);
    fetchStaffAccess();
  };

  const assignedIds = new Set(staffAccess.map((a) => a.profile_id));
  const availableStaff = allStaff.filter((s) => !assignedIds.has(s.id));

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const [eventRes, ticketsRes] = await Promise.all([
          supabase.from("events").select("id, title, event_date, location, price, image_url").eq("id", id).single(),
          supabase.from("tickets").select("*").eq("event_id", id).order("created_at", { ascending: false }),
        ]);
        if (eventRes.error) throw eventRes.error;
        if (ticketsRes.error) throw ticketsRes.error;
        setEvent(eventRes.data as Event);
        setTickets(ticketsRes.data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.somethingWrong);
      } finally {
        setLoading(false);
      }
    };
    load();
    fetchStaffAccess();
  }, [id]);

  const openTicketDetail = async (tk: TicketRow) => {
    setSelectedTicket(tk);
    setQrDataUrl(null);
    setQrLoading(true);
    try {
      const qrContent = JSON.stringify({ ticketId: tk.id, event: event?.title ?? "", customer: tk.customer_name });
      const url = await QRCode.toDataURL(qrContent, { width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });
      setQrDataUrl(url);
    } catch { setQrDataUrl(null); }
    finally { setQrLoading(false); }
  };

  const handlePrint = () => {
    if (!selectedTicket || !event) return;
    const win = window.open("", "_blank");
    if (!win) return;
    const dateStr = event.event_date
      ? new Date(event.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const priceStr = event.price != null
      ? (event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString()}`)
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
            .ticket-logo { font-size: 32px; margin-bottom: 6px; }
            .ticket-app { color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 600; }
            .ticket-body { padding: 24px; }
            .event-name { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 8px; }
            .event-meta { display: flex; gap: 10px; font-size: 13px; color: #6b7280; margin-bottom: 8px; flex-wrap: wrap; }
            .price-badge { display: inline-block; background: #f3f0ff; color: #6d28d9; font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
            .divider { border: none; border-top: 2px dashed #e5e7eb; margin: 0 -24px 20px; }
            .customer-section { margin-bottom: 16px; }
            .customer-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
            .customer-value { font-size: 17px; font-weight: 700; color: #111827; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 700; margin-bottom: 16px;
              background: ${selectedTicket.is_scanned ? "#d1fae5" : "#fef3c7"}; color: ${selectedTicket.is_scanned ? "#065f46" : "#92400e"}; }
            .qr-container { text-align: center; margin: 16px 0 12px; }
            .qr-container img { width: 180px; height: 180px; border-radius: 12px; }
            .ticket-id { text-align: center; font-size: 10px; color: #d1d5db; word-break: break-all; padding: 0 12px; }
            @media print { body { padding: 0; background: white; } .ticket { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="ticket">
            <div class="ticket-header">
              <div class="ticket-logo">${systemLogo && systemLogo.startsWith("data:") ? `<img src="${systemLogo}" style="width:40px;height:40px;border-radius:10px;object-fit:cover;margin:0 auto 2px;" />` : (systemLogo || "🎫")}</div>
              <div class="ticket-app">${systemName || (isAr ? "نظام التذاكر" : "TicketHub")}</div>
            </div>
            <div class="ticket-body">
              <div class="event-name">${event.title}</div>
              <div class="event-meta">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ""}
                ${event.location ? `<span>📍 ${event.location}</span>` : ""}
              </div>
              ${priceStr ? `<div class="price-badge">🎫 ${priceStr}</div>` : ""}
              <hr class="divider" />
              <div class="customer-section">
                <div class="customer-label">${isAr ? "اسم العميل" : "Customer Name"}</div>
                <div class="customer-value">${selectedTicket.customer_name}</div>
              </div>
              ${selectedTicket.customer_phone ? `
              <div class="customer-section">
                <div class="customer-label">${isAr ? "رقم الهاتف" : "Phone"}</div>
                <div class="customer-value">${selectedTicket.customer_phone}</div>
              </div>` : ""}
              <div class="status-badge">${selectedTicket.is_scanned ? (isAr ? "✓ تم الفحص" : "✓ Scanned") : (isAr ? "⏳ لم يُفحص" : "⏳ Not Scanned")}</div>
              ${qrDataUrl ? `<div class="qr-container"><img src="${qrDataUrl}" alt="QR" /></div>` : ""}
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
      (tk.customer_phone || "").includes(search) ||
      tk.id.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "scanned" && tk.is_scanned) ||
      (filter === "not_scanned" && !tk.is_scanned);
    return matchesSearch && matchesFilter;
  });

  const scannedCount = tickets.filter((tk) => tk.is_scanned).length;
  const attendanceRate = tickets.length > 0 ? Math.round((scannedCount / tickets.length) * 100) : 0;

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

  const formatPrice = (price: number | null) => {
    if (price == null) return null;
    if (price === 0) return isAr ? "مجاني" : "Free";
    return `RWF ${price.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate("/events")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
      >
        <BackIcon className="w-4 h-4" />
        {t.backToEvents}
      </button>

      {loading ? (
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-2xl p-6 animate-pulse">
            <div className="h-8 bg-white/20 rounded-lg w-2/3 mb-4" />
            <div className="h-4 bg-white/20 rounded w-1/3" />
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      ) : event ? (
        <>
          {/* Event Header */}
          <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-purple-800 rounded-2xl p-6 text-white shadow-xl shadow-violet-500/25 overflow-hidden relative">
            {/* Event image as background */}
            {event.image_url && (
              <div className="absolute inset-0 rounded-2xl overflow-hidden">
                <img
                  src={event.image_url}
                  alt={event.title}
                  className="w-full h-full object-cover opacity-25"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-violet-700/80 via-purple-700/70 to-purple-900/80" />
              </div>
            )}
            {/* Background decoration (shown when no image) */}
            {!event.image_url && (
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-6 -end-6 w-40 h-40 rounded-full bg-white blur-3xl" />
                <div className="absolute -bottom-6 -start-6 w-32 h-32 rounded-full bg-white blur-2xl" />
              </div>
            )}
            <div className="relative">
              <div className="flex items-start justify-between gap-4 mb-4">
                <h1 className="text-2xl font-black leading-tight">{event.title}</h1>
                {event.price != null && (
                  <div className="shrink-0 flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-white/20">
                    <DollarSign className="w-4 h-4 text-yellow-300" />
                    <span className="font-bold text-white text-sm">{formatPrice(event.price)}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-white/80 mb-5">
                {event.event_date && (
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {fmtDate(event.event_date)}
                  </span>
                )}
                {event.location && (
                  <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg">
                    <MapPin className="w-3.5 h-3.5" />
                    {event.location}
                  </span>
                )}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: t.totalTickets, value: tickets.length, icon: Ticket },
                  { label: t.scanned, value: scannedCount, icon: CheckCircle2 },
                  { label: isAr ? "نسبة الحضور" : "Attendance", value: `${attendanceRate}%`, icon: Users },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2.5 text-center border border-white/10">
                    <Icon className="w-4 h-4 text-white/60 mx-auto mb-1" />
                    <p className="text-xl font-black text-white">{value}</p>
                    <p className="text-[10px] font-medium text-white/60 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tickets Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{t.eventTickets}</h2>
              <span className="text-sm text-muted-foreground">{filtered.length} / {tickets.length}</span>
            </div>

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
              <div className="flex gap-1 bg-muted/50 p-1 rounded-xl shrink-0">
                {(["all", "scanned", "not_scanned"] as Filter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                      filter === f ? "bg-white dark:bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
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
                <div className="px-5 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t.ticketCount}</p>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {scannedCount}
                    </div>
                    <span className="text-muted-foreground text-xs">/</span>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                      <Ticket className="w-3.5 h-3.5" />
                      {tickets.length}
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {filtered.map((tk) => (
                    <div
                      key={tk.id}
                      className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors cursor-pointer group"
                      onClick={() => openTicketDetail(tk)}
                    >
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        tk.is_scanned ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-amber-100 dark:bg-amber-900/30"
                      )}>
                        {tk.is_scanned
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          : <Clock className="w-4 h-4 text-amber-600" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate group-hover:text-primary transition-colors">{tk.customer_name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tk.customer_phone && <span className="me-2">{tk.customer_phone}</span>}
                          <span className="font-mono opacity-60">#{tk.id.slice(0, 8)}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-end">
                          <span className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold",
                            tk.is_scanned
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          )}>
                            {tk.is_scanned ? t.scanned : t.notScanned}
                          </span>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(tk.created_at)}</p>
                        </div>
                        <button
                          onClick={(e) => openWhatsApp(tk, e)}
                          title={isAr ? "إرسال عبر واتساب" : "Send via WhatsApp"}
                          className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-800/50 flex items-center justify-center transition-colors shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        </button>
                        <div className="w-7 h-7 rounded-lg bg-muted/60 group-hover:bg-primary/10 group-hover:text-primary flex items-center justify-center transition-colors">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />
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

      {/* ── Assigned Staff Panel ─────────────────────────────── */}
      <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-muted/20">
          <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
            <Users className="w-3.5 h-3.5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground text-sm flex-1">
            {isAr ? "الكوادر المسؤولة" : "Assigned Staff"}
          </h3>
          {staffLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Add staff (admin only) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <select
                value={addingStaffId}
                onChange={(e) => setAddingStaffId(e.target.value)}
                className="flex-1 h-9 rounded-xl border border-border bg-background text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">{isAr ? "اختر موظفاً للإضافة…" : "Select staff to add…"}</option>
                {availableStaff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name || s.email || s.id}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                onClick={handleAddStaff}
                disabled={!addingStaffId}
                className="h-9 px-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 shrink-0"
              >
                <UserPlus className="w-4 h-4" />
              </Button>
            </div>
          )}
          {staffError && (
            <p className="text-xs text-destructive flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />{staffError}
            </p>
          )}
          {/* Staff list */}
          {staffAccess.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
              {isAr ? "لم يُسنَد أي موظف لهذا الفعالية بعد" : "No staff assigned to this event yet"}
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {staffAccess.map((row) => {
                const s = row.profiles;
                const initials = (s.full_name || s.email || "?")
                  .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
                return (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/20 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{s.full_name || (isAr ? "بدون اسم" : "No name")}</p>
                      <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                        s.role === "admin"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      )}>
                        <ShieldCheck className="w-2.5 h-2.5" />
                        {s.role}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemoveStaff(row.id)}
                          disabled={removingId === row.id}
                          className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive flex items-center justify-center transition-colors"
                        >
                          {removingId === row.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ticket Detail Modal */}
      <Dialog open={!!selectedTicket} onOpenChange={(o) => !o && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-sm p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <DialogTitle className="sr-only">
            {selectedTicket?.customer_name} — {isAr ? "تفاصيل التذكرة" : "Ticket Details"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isAr ? "تفاصيل التذكرة مع رمز QR" : "Ticket details with QR code"}
          </DialogDescription>

          {selectedTicket && event && (
            <>
              <button
                onClick={() => setSelectedTicket(null)}
                className="absolute top-3 end-3 z-10 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>

              <div ref={printRef}>
                {/* Header */}
                <div className="bg-gradient-to-br from-violet-600 to-purple-700 px-6 pt-7 pb-5 text-center">
                  <div className="mb-1.5 flex justify-center">
                    {systemLogo && systemLogo.startsWith("data:") ? (
                      <img src={systemLogo} alt="Logo" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <span className="text-3xl">🎫</span>
                    )}
                  </div>
                  <h2 className="text-white font-bold text-lg leading-snug">{event.title}</h2>
                  <div className="flex items-center justify-center flex-wrap gap-3 mt-2 text-white/70 text-xs">
                    {event.event_date && (
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(event.event_date)}</span>
                    )}
                    {event.location && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
                    )}
                  </div>
                  {event.price != null && (
                    <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-bold text-white border border-white/20">
                      <DollarSign className="w-3 h-3 text-yellow-300" />
                      {formatPrice(event.price)}
                    </div>
                  )}
                  <div className="mt-3">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                      selectedTicket.is_scanned ? "bg-emerald-400/20 text-emerald-200" : "bg-amber-400/20 text-amber-200"
                    )}>
                      {selectedTicket.is_scanned
                        ? <><CheckCircle2 className="w-3 h-3" />{t.scanned}</>
                        : <><Clock className="w-3 h-3" />{t.notScanned}</>
                      }
                    </span>
                  </div>
                </div>

                {/* Dashed separator */}
                <div className="relative bg-card h-0.5">
                  <div className="absolute -top-3.5 start-0 end-0 flex items-center px-3">
                    <div className="flex-1 border-t-2 border-dashed border-border" />
                    <div className="w-7 h-7 rounded-full bg-background border-2 border-border mx-1 shrink-0" />
                    <div className="flex-1 border-t-2 border-dashed border-border" />
                  </div>
                </div>

                {/* Body */}
                <div className="bg-card px-6 pt-7 pb-5 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {isAr ? "العميل" : "Customer"}
                      </p>
                      <p className="font-bold text-foreground text-sm">{selectedTicket.customer_name}</p>
                    </div>
                    {selectedTicket.customer_phone && (
                      <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {isAr ? "الهاتف" : "Phone"}
                        </p>
                        <p className="font-bold text-foreground text-sm">{selectedTicket.customer_phone}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Hash className="w-3 h-3" />
                      {isAr ? "رقم التذكرة" : "Ticket ID"}
                    </p>
                    <p className="font-mono text-xs text-foreground/60 break-all">{selectedTicket.id}</p>
                  </div>

                  <div className="flex justify-center pt-1">
                    <div className="bg-white rounded-2xl p-3 shadow-inner border border-gray-100">
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

                  <p className="text-center text-[10px] text-muted-foreground/50">
                    {isAr ? "امسح الرمز للتحقق من التذكرة" : "Scan to verify this ticket"}
                  </p>
                </div>
              </div>

              <div className="bg-card px-6 pb-6 pt-1 flex gap-2">
                <Button
                  onClick={() => { if (selectedTicket) openWhatsApp(selectedTicket, { stopPropagation: () => {} } as React.MouseEvent); }}
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 font-semibold text-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  {isAr ? "واتساب" : "WhatsApp"}
                </Button>
                <Button
                  onClick={handlePrint}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20 font-semibold text-sm"
                >
                  <Printer className="w-4 h-4" />
                  {t.printTicket}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Send Modal */}
      <Dialog open={!!waTicket} onOpenChange={(o) => !o && setWaTicket(null)}>
        <DialogContent className="sm:max-w-xs p-0 rounded-2xl overflow-hidden border-0 shadow-2xl">
          <DialogTitle className="sr-only">{isAr ? "إرسال عبر واتساب" : "Send via WhatsApp"}</DialogTitle>
          <DialogDescription className="sr-only">{isAr ? "أدخل رقم الواتساب" : "Enter WhatsApp number"}</DialogDescription>

          {/* Header */}
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 px-6 py-5 text-center">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-bold text-base">
              {isAr ? "إرسال التذكرة عبر واتساب" : "Send Ticket via WhatsApp"}
            </h3>
            {waTicket && (
              <p className="text-white/75 text-xs mt-1 truncate">{waTicket.customer_name}</p>
            )}
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" />
                {isAr ? "رقم واتساب المستقبل" : "Recipient WhatsApp Number"}
              </label>
              <Input
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value)}
                placeholder={isAr ? "مثال: 250788123456" : "e.g. 250788123456"}
                className="h-11 rounded-xl text-sm font-mono"
                dir="ltr"
                type="tel"
                onKeyDown={(e) => e.key === "Enter" && sendWhatsApp()}
              />
              <p className="text-[11px] text-muted-foreground">
                {isAr
                  ? "أدخل الرقم بدون رمز + (مثال: 250788123456)"
                  : "Enter without the + sign (e.g. 250788123456)"}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-sm"
                onClick={() => setWaTicket(null)}
              >
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                disabled={!waPhone.trim()}
                onClick={sendWhatsApp}
                className="flex-1 h-10 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 border-0 text-white font-semibold text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                {isAr ? "فتح واتساب" : "Open WhatsApp"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
