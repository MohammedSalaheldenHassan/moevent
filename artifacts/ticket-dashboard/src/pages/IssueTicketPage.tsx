import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Printer, CheckCircle2, Ticket, CalendarDays, MapPin, QrCode, RotateCcw } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";
import { printTicket, isImageUrl, shortTicketId as shortId } from "@/lib/printTicket";

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

interface TicketView {
  event: Event | undefined;
  customerName: string;
  customerPhone: string;
  id?: string;
  qrDataUrl?: string;
}

export default function IssueTicketPage() {
  const { t, lang } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const { profile } = useAuth();
  const isAr = lang === "ar";
  const isAdmin = !profile || profile.role === "admin";
  const brandName = systemName || t.appName;

  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [form, setForm] = useState({ eventId: "", customerName: "", customerPhone: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedTicket, setIssuedTicket] = useState<IssuedTicket | null>(null);

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
          .order("event_date", { ascending: true });
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = (e: Event) => !!e.event_date && new Date(e.event_date) < today;

  const updateForm = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
    // Editing the form starts a new ticket
    if (issuedTicket) setIssuedTicket(null);
  };

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
      // Payload is read by the gate app; keep the shape unchanged.
      const qrContent = JSON.stringify({ ticketId: data.id, event: event.title, customer: data.customer_name });
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 320, margin: 1, color: { dark: "#111418", light: "#ffffff" },
      });

      setIssuedTicket({ id: data.id, customer_name: data.customer_name, customer_phone: data.customer_phone, event, qrDataUrl });
      setForm({ eventId: form.eventId, customerName: "", customerPhone: "" });
      logActivity("ticket_issued", `${data.customer_name} — ${event.title}`, profile?.email ?? undefined);
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

  const formatDate = (iso: string | null, long = false) =>
    iso
      ? new Date(iso).toLocaleDateString(isAr ? "ar" : "en-GB", long
        ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" })
      : "";

  const handlePrint = () => {
    if (!issuedTicket) return;
    printTicket({
      lang, brandName, logoUrl: systemLogo,
      ticket: issuedTicket, event: issuedTicket.event, qrDataUrl: issuedTicket.qrDataUrl,
    });
  };

  const preview: TicketView = issuedTicket
    ? { event: issuedTicket.event, customerName: issuedTicket.customer_name, customerPhone: issuedTicket.customer_phone, id: issuedTicket.id, qrDataUrl: issuedTicket.qrDataUrl }
    : { event: selectedEvent, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim() };

  const SectionHeading = ({ step, title, hint }: { step: number; title: string; hint: string }) => (
    <div className="flex items-start gap-3">
      <span className="w-6 h-6 rounded-full border border-border text-xs font-medium text-muted-foreground flex items-center justify-center shrink-0 tabular-nums">
        {step}
      </span>
      <div>
        <h2 className="text-sm font-semibold text-foreground leading-6">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.issueTicketTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t.issueTicketSubtitle}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* Form */}
        <form
          className="bg-card border border-card-border rounded-lg"
          onSubmit={(e) => { e.preventDefault(); void handleIssue(); }}
        >
          <div className="p-5 sm:p-6 space-y-4">
            <SectionHeading
              step={1}
              title={t.event}
              hint={isAr ? "اختر الفعالية التي تصدر لها التذكرة" : "Choose the event this ticket admits to"}
            />
            <div className="sm:ps-9">
              {eventsLoading ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={form.eventId} onValueChange={(v) => updateForm({ eventId: v })}>
                  <SelectTrigger className="h-10" aria-label={t.event}>
                    <SelectValue placeholder={t.selectEvent} />
                  </SelectTrigger>
                  <SelectContent>
                    {events.length === 0 ? (
                      <SelectItem value="none" disabled>{t.noEventsAvailable}</SelectItem>
                    ) : (
                      events.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <span className="font-medium">{e.title}</span>
                          {e.event_date && <span className="text-muted-foreground ms-2">{formatDate(e.event_date)}</span>}
                          {isPast(e) && <span className="text-muted-foreground ms-2">· {isAr ? "منتهية" : "Past"}</span>}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {selectedEvent && (
                <dl className="mt-3 grid grid-cols-3 gap-px bg-border border border-border rounded-md overflow-hidden text-sm">
                  <div className="bg-card px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">{isAr ? "التاريخ" : "Date"}</dt>
                    <dd className="font-medium text-foreground truncate">{formatDate(selectedEvent.event_date) || "—"}</dd>
                  </div>
                  <div className="bg-card px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">{isAr ? "المكان" : "Venue"}</dt>
                    <dd className="font-medium text-foreground truncate">{selectedEvent.location || "—"}</dd>
                  </div>
                  <div className="bg-card px-3 py-2">
                    <dt className="text-[11px] text-muted-foreground">{isAr ? "السعر" : "Price"}</dt>
                    <dd className="font-medium text-foreground tabular-nums truncate">{formatPrice(selectedEvent.price) ?? "—"}</dd>
                  </div>
                </dl>
              )}
              {selectedEvent && isPast(selectedEvent) && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {isAr ? "هذه الفعالية انتهت بالفعل." : "This event has already taken place."}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-border p-5 sm:p-6 space-y-4">
            <SectionHeading
              step={2}
              title={isAr ? "العميل" : "Customer"}
              hint={isAr ? "يُطبع الاسم على التذكرة ويظهر عند المسح" : "The name is printed on the ticket and shown at the gate"}
            />
            <div className="sm:ps-9 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="customer-name" className="text-sm font-medium">{t.customerName}</Label>
                <Input
                  id="customer-name"
                  placeholder={t.customerNamePlaceholder}
                  value={form.customerName}
                  onChange={(e) => updateForm({ customerName: e.target.value })}
                  autoComplete="off"
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="customer-phone" className="text-sm font-medium">{t.customerPhone}</Label>
                <Input
                  id="customer-phone"
                  type="tel"
                  placeholder="+250 7XX XXX XXX"
                  value={form.customerPhone}
                  onChange={(e) => updateForm({ customerPhone: e.target.value })}
                  autoComplete="off"
                  required
                  className="h-10"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mx-5 sm:mx-6 mb-4 flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/25 rounded-md text-sm text-destructive" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="border-t border-border bg-muted/40 px-5 sm:px-6 py-4 flex items-center justify-between gap-4 rounded-b-lg">
            <div>
              <p className="text-xs text-muted-foreground">{isAr ? "المبلغ المستحق" : "Amount due"}</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                {selectedEvent ? formatPrice(selectedEvent.price) ?? "—" : "—"}
              </p>
            </div>
            <Button type="submit" disabled={saving} className="h-10 px-5">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" />{t.issuingTicket}</>
                : <><Ticket className="w-4 h-4" />{t.issueTicketBtn}</>
              }
            </Button>
          </div>
        </form>

        {/* Ticket preview */}
        <aside className="lg:sticky lg:top-8 space-y-3" aria-live="polite">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {issuedTicket ? (isAr ? "التذكرة الصادرة" : "Issued ticket") : (isAr ? "معاينة" : "Preview")}
            </p>
            {issuedTicket && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t.ticketIssuedSuccessfully}
              </span>
            )}
          </div>

          <div className={cn("bg-card border border-card-border rounded-lg overflow-hidden", !issuedTicket && "opacity-95")}>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  {systemLogo && isImageUrl(systemLogo) ? (
                    <img src={systemLogo} alt="" className="w-6 h-6 rounded object-contain bg-black shrink-0" />
                  ) : (
                    <Ticket className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-foreground truncate">{brandName}</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground border border-border rounded px-1.5 py-0.5 shrink-0">
                  {isAr ? "تذكرة دخول" : "Admit one"}
                </span>
              </div>
              <p className={cn("text-lg font-semibold leading-snug tracking-tight", preview.event ? "text-foreground" : "text-muted-foreground/60")}>
                {preview.event?.title ?? (isAr ? "اسم الفعالية" : "Event name")}
              </p>
              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  {preview.event?.event_date ? formatDate(preview.event.event_date, true) : "—"}
                </p>
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                  {preview.event?.location || "—"}
                </p>
              </div>
            </div>

            {/* Tear line */}
            <div className="relative mx-3 border-t-[1.5px] border-dashed border-border">
              <span className="absolute -top-2 -start-5 w-4 h-4 rounded-full bg-background border border-card-border" />
              <span className="absolute -top-2 -end-5 w-4 h-4 rounded-full bg-background border border-card-border" />
            </div>

            <div className="p-5 flex gap-4 items-start">
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "اسم الحامل" : "Ticket holder"}</p>
                  <p className={cn("text-sm font-medium truncate", preview.customerName ? "text-foreground" : "text-muted-foreground/60")}>
                    {preview.customerName || (isAr ? "اسم العميل" : "Customer name")}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "الهاتف" : "Phone"}</p>
                  <p dir="ltr" className={cn("text-sm font-medium truncate text-start", preview.customerPhone ? "text-foreground" : "text-muted-foreground/60")}>
                    {preview.customerPhone || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "السعر" : "Price"}</p>
                  <p className="text-sm font-medium text-foreground tabular-nums">{formatPrice(preview.event?.price ?? null) ?? "—"}</p>
                </div>
              </div>
              {preview.qrDataUrl ? (
                <img src={preview.qrDataUrl} alt={isAr ? "رمز QR للتذكرة" : "Ticket QR code"} className="w-28 h-28 rounded-md border border-border p-1 bg-white shrink-0" />
              ) : (
                <div className="w-28 h-28 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground/60 shrink-0">
                  <QrCode className="w-6 h-6" strokeWidth={1.5} />
                  <span className="text-[10px] text-center leading-tight px-2">{isAr ? "يظهر بعد الإصدار" : "Appears after issuing"}</span>
                </div>
              )}
            </div>

            <div className="border-t border-border px-5 py-2.5 text-center font-mono text-[11px] tracking-wider text-muted-foreground">
              {preview.id ? `${isAr ? "رقم التذكرة" : "Ticket"} ${shortId(preview.id)}` : "—"}
            </div>
          </div>

          {issuedTicket && (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={handlePrint} className="h-10">
                <Printer className="w-4 h-4" />
                {t.printTicket}
              </Button>
              <Button variant="outline" onClick={() => setIssuedTicket(null)} className="h-10">
                <RotateCcw className="w-4 h-4" />
                {t.issueAnother}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
