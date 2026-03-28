import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Printer, CheckCircle2, Ticket, User, Phone, CalendarDays } from "lucide-react";
import QRCode from "qrcode";

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
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
        const { data, error } = await supabase
          .from("events")
          .select("id, title, event_date, location")
          .order("created_at", { ascending: false });
        if (error) throw error;
        setEvents(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t.failedLoadEventsForTicket);
      } finally {
        setEventsLoading(false);
      }
    };
    fetchEvents();
  }, []);

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
        .select("id, customer_name, customer_phone, event_id")
        .single();

      if (error) throw error;

      const event = events.find((e) => e.id === form.eventId)!;
      const qrContent = JSON.stringify({ ticketId: data.id, event: event.title, customer: data.customer_name });
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 300,
        margin: 2,
        color: { dark: "#1e1b4b", light: "#ffffff" },
      });

      setIssuedTicket({
        id: data.id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        event,
        qrDataUrl,
      });
      setForm({ eventId: "", customerName: "", customerPhone: "" });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.failedIssueTicket);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    const isAr = lang === "ar";
    win.document.write(`
      <html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
        <head>
          <title>${isAr ? "تذكرة" : "Ticket"} - ${issuedTicket?.id}</title>
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
              <div class="event-name">${issuedTicket?.event.title}</div>
              <div class="event-meta">
                <span>📅 ${issuedTicket?.event.event_date ? new Date(issuedTicket.event.event_date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}</span>
                <span>📍 ${issuedTicket?.event.location}</span>
              </div>
              <hr class="divider" />
              <div class="customer-section">
                <div class="customer-label">${isAr ? "اسم العميل" : "Customer Name"}</div>
                <div class="customer-value">${issuedTicket?.customer_name}</div>
              </div>
              <div class="customer-section">
                <div class="customer-label">${isAr ? "رقم الهاتف" : "Phone Number"}</div>
                <div class="customer-value">${issuedTicket?.customer_phone}</div>
              </div>
              <div class="qr-container">
                <img src="${issuedTicket?.qrDataUrl}" alt="QR Code" />
              </div>
              <div class="ticket-id">${isAr ? "رقم التذكرة" : "Ticket ID"}: ${issuedTicket?.id}</div>
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
        <h1 className="text-2xl font-bold text-foreground">{t.issueTicketTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.issueTicketSubtitle}</p>
      </div>

      <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm space-y-5">
        {/* Event */}
        <div className="space-y-1.5">
          <Label className="font-semibold text-sm flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-primary" />
            {t.event}
          </Label>
          {eventsLoading ? (
            <div className="h-11 bg-muted animate-pulse rounded-xl" />
          ) : (
            <Select value={form.eventId} onValueChange={(v) => setForm(f => ({ ...f, eventId: v }))}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder={t.selectEvent} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {events.length === 0 ? (
                  <SelectItem value="none" disabled>{t.noEventsAvailable}</SelectItem>
                ) : (
                  events.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.title}{e.event_date ? ` — ${new Date(e.event_date).toLocaleDateString()}` : ""}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Customer name */}
        <div className="space-y-1.5">
          <Label htmlFor="customer-name" className="font-semibold text-sm flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-primary" />
            {t.customerName}
          </Label>
          <Input
            id="customer-name"
            placeholder={t.customerNamePlaceholder}
            value={form.customerName}
            onChange={(e) => setForm(f => ({ ...f, customerName: e.target.value }))}
            className="h-11 rounded-xl"
          />
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <Label htmlFor="customer-phone" className="font-semibold text-sm flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-primary" />
            {t.customerPhone}
          </Label>
          <Input
            id="customer-phone"
            type="tel"
            placeholder={t.customerPhonePlaceholder}
            value={form.customerPhone}
            onChange={(e) => setForm(f => ({ ...f, customerPhone: e.target.value }))}
            className="h-11 rounded-xl"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3.5 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <Button
          onClick={handleIssue}
          disabled={saving}
          className="w-full h-12 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/25"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{t.issuingTicket}</>
          ) : (
            <><Ticket className="w-4 h-4" />{t.issueTicketBtn}</>
          )}
        </Button>
      </div>

      {issuedTicket && (
        <div className="bg-card border border-emerald-200 dark:border-emerald-900/50 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <h2 className="font-bold text-foreground">{t.ticketIssuedSuccessfully}</h2>
          </div>

          {/* Ticket preview */}
          <div ref={printRef} className="rounded-2xl overflow-hidden border border-border mb-5 shadow-sm">
            <div className="bg-gradient-to-r from-violet-600 to-purple-700 p-5 text-center">
              <div className="text-2xl mb-1">🎫</div>
              <div className="text-white font-bold text-lg">{issuedTicket.event.title}</div>
              <div className="text-white/70 text-xs mt-1">
                {issuedTicket.event.event_date ? new Date(issuedTicket.event.event_date).toLocaleDateString(lang === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" }) : ""}{issuedTicket.event.location ? ` · ${issuedTicket.event.location}` : ""}
              </div>
            </div>
            <div className="bg-white p-5">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-dashed border-gray-200">
                <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900 text-sm">{issuedTicket.customer_name}</div>
                  <div className="text-gray-500 text-xs">{issuedTicket.customer_phone}</div>
                </div>
              </div>
              <div className="flex justify-center">
                <img src={issuedTicket.qrDataUrl} alt="QR Code" className="w-40 h-40 rounded-xl" />
              </div>
              <div className="text-center text-[10px] text-gray-300 mt-3 break-all px-2 font-mono">
                {issuedTicket.id}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handlePrint}
              className="flex-1 h-11 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/20 font-semibold"
            >
              <Printer className="w-4 h-4" />
              {t.printTicket}
            </Button>
            <Button
              variant="outline"
              onClick={() => setIssuedTicket(null)}
              className="flex-1 h-11 rounded-xl font-semibold"
            >
              {t.issueAnother}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
