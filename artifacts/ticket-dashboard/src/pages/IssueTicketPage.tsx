import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Printer, CheckCircle2, Ticket, User, Phone, CalendarDays, MapPin, DollarSign } from "lucide-react";
import QRCode from "qrcode";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
}

interface IssuedTicket {
  id: string;
  customer_name: string;
  customer_phone: string;
  event: Event;
  qrDataUrl: string;
}

export default function IssueTicketPage() {
  const { t, lang } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const { profile } = useAuth();
  const isAr = lang === "ar";
  const isAdmin = !profile || profile.role === "admin";

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [form, setForm] = useState({ eventId: "", customerName: "", customerPhone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<IssuedTicket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        let eventIds: string[] | null = null;

        if (!isAdmin && profile?.id) {
          const { data: accessData, error: accessErr } = await supabase
            .from("event_access")
            .select("event_id")
            .eq("profile_id", profile.id);
          if (accessErr) throw accessErr;
          eventIds = (accessData ?? []).map((a: { event_id: string }) => a.event_id);
          if (eventIds.length === 0) {
            setEvents([]);
            setEventsLoading(false);
            return;
          }
        }

        let query = supabase
          .from("events")
          .select("id, title, event_date, location, price")
          .order("created_at", { ascending: false });
        if (eventIds) query = query.in("id", eventIds);
        const { data, error } = await query;
        if (error) throw error;
        setEvents(data as Event[] ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.failedLoadEventsForTicket);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, []);

  const selectedEvent = events.find((e) => e.id === form.eventId);

  const handleIssue = async () => {
    if (!form.eventId || !form.customerName.trim() || !form.customerPhone.trim()) {
      setError(t.allFieldsRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("tickets")
        .insert({
          event_id: form.eventId,
          customer_name: form.customerName.trim(),
          customer_phone: form.customerPhone.trim(),
          is_scanned: false,
        })
        .select("id, customer_name, customer_phone")
        .single();

      if (error) throw error;

      const event = events.find((e) => e.id === form.eventId)!;
      const qrContent = JSON.stringify({ ticketId: data.id, event: event.title, customer: data.customer_name });
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 300, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" },
      });

      setIssuedTicket({ id: data.id, customer_name: data.customer_name, customer_phone: data.customer_phone, event, qrDataUrl });
      setForm({ eventId: "", customerName: "", customerPhone: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.failedIssueTicket);
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price == null) return null;
    if (price === 0) return isAr ? "مجاني" : "Free";
    return `RWF ${price.toLocaleString()}`;
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const evt = issuedTicket?.event;
    const dateStr = evt?.event_date
      ? new Date(evt.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })
      : "";
    const priceStr = evt?.price != null ? formatPrice(evt.price) : "";
    win.document.write(`
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
        <head>
          <title>${isAr ? "تذكرة" : "Ticket"} - ${issuedTicket?.id}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: ${isAr ? "'Cairo'" : "'Inter'"}, system-ui, sans-serif; display: flex; justify-content: center; padding: 40px; background: #f3f4f6; }
            .ticket { background: white; border-radius: 24px; max-width: 420px; width: 100%; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
            .ticket-header { background: linear-gradient(135deg, hsl(var(--primary)), #9333ea); padding: 28px 24px; text-align: center; }
            .ticket-logo { font-size: 32px; margin-bottom: 6px; }
            .ticket-app { color: rgba(255,255,255,0.85); font-size: 14px; font-weight: 600; }
            .ticket-body { padding: 24px; }
            .event-name { font-size: 20px; font-weight: 800; color: #111827; margin-bottom: 6px; }
            .event-meta { display: flex; gap: 10px; font-size: 13px; color: #6b7280; margin-bottom: 8px; flex-wrap: wrap; }
            .price-badge { display: inline-block; background: #f3f0ff; color: hsl(var(--primary)); font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; margin-bottom: 20px; }
            .divider { border: none; border-top: 2px dashed #e5e7eb; margin: 0 -24px 20px; }
            .customer-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
            .customer-value { font-size: 17px; font-weight: 700; color: #111827; margin-bottom: 16px; }
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
              <div class="event-name">${evt?.title ?? ""}</div>
              <div class="event-meta">
                ${dateStr ? `<span>📅 ${dateStr}</span>` : ""}
                ${evt?.location ? `<span>📍 ${evt.location}</span>` : ""}
              </div>
              ${priceStr ? `<div class="price-badge">🎫 ${priceStr}</div>` : ""}
              <hr class="divider" />
              <div class="customer-label">${isAr ? "اسم العميل" : "Customer Name"}</div>
              <div class="customer-value">${issuedTicket?.customer_name ?? ""}</div>
              <div class="customer-label">${isAr ? "رقم الهاتف" : "Phone"}</div>
              <div class="customer-value">${issuedTicket?.customer_phone ?? ""}</div>
              <div class="qr-container"><img src="${issuedTicket?.qrDataUrl ?? ""}" alt="QR" /></div>
              <div class="ticket-id">${isAr ? "رقم التذكرة" : "Ticket ID"}: ${issuedTicket?.id ?? ""}</div>
            </div>
          </div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 600);
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.issueTicketTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.issueTicketSubtitle}</p>
      </div>

      <div className="bg-card border border-card-border rounded-lg shadow-sm overflow-hidden">
        {/* Form header */}
        <div className="p-6 space-y-5">
          {/* Event selector */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-primary" />
              {t.event} *
            </Label>
            {eventsLoading ? (
              <div className="h-11 bg-muted animate-pulse rounded-md" />
            ) : (
              <Select value={form.eventId} onValueChange={(v) => setForm(f => ({ ...f, eventId: v }))}>
                <SelectTrigger className="h-11 rounded-md">
                  <SelectValue placeholder={t.selectEvent} />
                </SelectTrigger>
                <SelectContent className="rounded-md">
                  {events.length === 0 ? (
                    <SelectItem value="none" disabled>{t.noEventsAvailable}</SelectItem>
                  ) : (
                    events.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="font-medium">{e.title}</span>
                        {e.price != null && <span className="text-muted-foreground ms-2">— {formatPrice(e.price)}</span>}
                        {e.event_date && <span className="text-muted-foreground ms-2">· {new Date(e.event_date).toLocaleDateString()}</span>}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Selected event preview */}
          {selectedEvent && (
            <div className="flex items-center gap-3 p-3.5 bg-primary/10 dark:bg-primary/15 rounded-md border border-primary/30 dark:border-primary/30">
              <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center shrink-0">
                <CalendarDays className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-primary dark:text-primary text-sm truncate">{selectedEvent.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  {selectedEvent.event_date && (
                    <span className="text-xs text-primary/70 dark:text-primary/70 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(selectedEvent.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                  {selectedEvent.location && (
                    <span className="text-xs text-primary/70 dark:text-primary/70 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selectedEvent.location}
                    </span>
                  )}
                </div>
              </div>
              {selectedEvent.price != null && (
                <div className="shrink-0 text-end">
                  <div className="flex items-center gap-1 bg-primary/10 dark:bg-primary/15 px-2.5 py-1.5 rounded-md">
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                    <span className="text-sm font-semibold text-primary dark:text-primary">{formatPrice(selectedEvent.price)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Customer name */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-name" className="font-semibold text-sm flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              {t.customerName} *
            </Label>
            <Input
              id="customer-name"
              placeholder={t.customerNamePlaceholder}
              value={form.customerName}
              onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))}
              className="h-11 rounded-md"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone" className="font-semibold text-sm flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              {t.customerPhone} *
            </Label>
            <Input
              id="customer-phone"
              type="tel"
              placeholder={t.customerPhonePlaceholder}
              value={form.customerPhone}
              onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              className="h-11 rounded-md"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3.5 bg-destructive/10 border border-destructive/20 rounded-md text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleIssue}
            disabled={saving}
            className="w-full h-12 rounded-md text-sm font-semibold bg-primary border-0 shadow-sm"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t.issuingTicket}</>
              : <><Ticket className="w-4 h-4" />{t.issueTicketBtn}</>
            }
          </Button>
        </div>
      </div>

      {/* Success: Issued ticket preview */}
      {issuedTicket && (
        <div className="bg-card border border-emerald-200 dark:border-emerald-900/50 rounded-lg overflow-hidden shadow-sm">
          {/* Success header */}
          <div className="bg-emerald-600 px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-md flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">{t.ticketIssuedSuccessfully}</p>
              <p className="text-white/70 text-xs mt-0.5">#{issuedTicket.id.slice(0, 12)}…</p>
            </div>
          </div>

          {/* Ticket card preview */}
          <div ref={printRef} className="m-5 rounded-lg overflow-hidden border border-border shadow-sm">
            <div className="bg-primary p-5 text-center">
              <div className="mb-1.5 flex justify-center">
                {systemLogo && systemLogo.startsWith("data:") ? (
                  <img src={systemLogo} alt="Logo" className="w-10 h-10 rounded-md object-cover" />
                ) : (
                  <span className="text-2xl">🎫</span>
                )}
              </div>
              <div className="text-white font-semibold text-lg leading-tight">{issuedTicket.event.title}</div>
              <div className="flex items-center justify-center flex-wrap gap-3 mt-2 text-white/70 text-xs">
                {issuedTicket.event.event_date && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" />
                    {new Date(issuedTicket.event.event_date).toLocaleDateString(isAr ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
                  </span>
                )}
                {issuedTicket.event.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {issuedTicket.event.location}
                  </span>
                )}
              </div>
              {issuedTicket.event.price != null && (
                <div className="mt-2 inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-white border border-white/20">
                  <DollarSign className="w-3 h-3 text-yellow-300" />
                  {formatPrice(issuedTicket.event.price)}
                </div>
              )}
            </div>
            <div className="bg-white p-5">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b-2 border-dashed border-gray-200">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{issuedTicket.customer_name}</div>
                  <div className="text-gray-500 text-xs flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {issuedTicket.customer_phone}
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <div className="bg-white rounded-lg p-2 shadow-inner border border-gray-100">
                  <img src={issuedTicket.qrDataUrl} alt="QR Code" className="w-40 h-40 rounded-md" />
                </div>
              </div>
              <p className="text-center text-[10px] text-gray-300 mt-3 break-all px-2 font-mono">{issuedTicket.id}</p>
            </div>
          </div>

          <div className="flex gap-3 px-5 pb-5">
            <Button
              onClick={handlePrint}
              className="flex-1 h-11 rounded-md bg-primary border-0 shadow-md font-semibold"
            >
              <Printer className="w-4 h-4" />
              {t.printTicket}
            </Button>
            <Button variant="outline" onClick={() => setIssuedTicket(null)} className="flex-1 h-11 rounded-md font-semibold">
              {t.issueAnother}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
