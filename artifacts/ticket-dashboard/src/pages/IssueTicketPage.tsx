import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Loader2, Printer, CheckCircle2, CalendarDays, MapPin, QrCode, RotateCcw, Crown, Mail, Star } from "lucide-react";
import { logActivity } from "@/lib/activityLogger";
import { cn } from "@/lib/utils";
import QRCode from "qrcode";
import { printTicket, isImageUrl, shortTicketId as shortId } from "@/lib/printTicket";
import { sendTicketsEmail } from "@/lib/sendTicketsEmail";
import { ISSUABLE_TYPES, TICKET_THEMES, type IssuableType } from "@/lib/ticketThemes";

// Same rule as the tickets_customer_email_check constraint.
const isValidEmail = (v: string) => v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

interface Event {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
}

// The dashboard issues VIP and VVIP tickets; public bookings cover the other types.
interface IssuedTicket {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  attendee_type: IssuableType;
  event: Event;
  qrDataUrl: string;
  email: "sending" | "sent" | "failed";
  emailError?: string;
}

interface TicketView {
  event: Event | undefined;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
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
  const [form, setForm] = useState({ eventId: "", customerName: "", customerPhone: "", customerEmail: "" });
  const [ticketType, setTicketType] = useState<IssuableType>("vip");
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
    if (!form.eventId || !form.customerName.trim() || !form.customerPhone.trim() || !form.customerEmail.trim()) {
      setError(t.allFieldsRequired);
      return;
    }
    if (!isValidEmail(form.customerEmail.trim())) {
      setError(isAr ? "أدخل بريدًا إلكترونيًا صحيحًا." : "Enter a valid email address.");
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
          customer_email: form.customerEmail.trim(),
          attendee_type: ticketType,
          is_scanned: false,
        })
        .select("id, customer_name, customer_phone, customer_email")
        .single();

      if (error) throw error;

      const event = events.find((e) => e.id === form.eventId)!;
      // Payload is read by the gate app; keep the shape unchanged.
      const qrContent = JSON.stringify({ ticketId: data.id, event: event.title, customer: data.customer_name });
      const qrDataUrl = await QRCode.toDataURL(qrContent, {
        width: 320, margin: 1, color: { dark: "#111418", light: "#ffffff" },
      });

      const issued: IssuedTicket = {
        id: data.id, customer_name: data.customer_name, customer_phone: data.customer_phone,
        customer_email: data.customer_email, attendee_type: ticketType, event, qrDataUrl, email: "sending",
      };
      setIssuedTicket(issued);
      setForm({ eventId: form.eventId, customerName: "", customerPhone: "", customerEmail: "" });
      logActivity("ticket_issued", `${TICKET_THEMES[ticketType].label} · ${data.customer_name} — ${event.title}`, profile?.email ?? undefined);
      // Like public bookings, the ticket goes straight to the guest's email.
      void emailTicket(issued);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t.failedIssueTicket);
    } finally {
      setSaving(false);
    }
  };

  const emailTicket = async (ticket: IssuedTicket) => {
    setIssuedTicket((cur) => (cur?.id === ticket.id ? { ...cur, email: "sending", emailError: undefined } : cur));
    const result = await sendTicketsEmail([ticket.id]);
    setIssuedTicket((cur) =>
      cur?.id === ticket.id ? { ...cur, email: result.ok ? "sent" : "failed", emailError: result.message } : cur,
    );
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
    ? { event: issuedTicket.event, customerName: issuedTicket.customer_name, customerPhone: issuedTicket.customer_phone, customerEmail: issuedTicket.customer_email, id: issuedTicket.id, qrDataUrl: issuedTicket.qrDataUrl }
    : { event: selectedEvent, customerName: form.customerName.trim(), customerPhone: form.customerPhone.trim(), customerEmail: form.customerEmail.trim() };

  // Theme of the ticket shown in the preview.
  const pth = TICKET_THEMES[issuedTicket?.attendee_type ?? ticketType];

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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground flex items-center gap-2.5">
          {t.issueTicketTitle}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAr
            ? "تصدر من هنا تذاكر VIP و VVIP. تُرسل التذكرة إلى بريد الضيف فور إصدارها. تذاكر الطلاب والعاديين والمؤسسات تُحجز من الموقع العام."
            : "Issue VIP and VVIP tickets. The ticket is emailed to the guest as soon as it's issued. Student, Regular and Organization tickets are booked on the public site."}
        </p>
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
              title={isAr ? "نوع التذكرة" : "Ticket type"}
              hint={isAr ? "لكل نوع تصميم ولون خاص على التذكرة والبريد" : "Each type has its own design on the ticket and the email"}
            />
            <div role="radiogroup" aria-label={isAr ? "نوع التذكرة" : "Ticket type"} className="sm:ps-9 grid gap-3 grid-cols-2">
              {ISSUABLE_TYPES.map((type) => {
                const th = TICKET_THEMES[type];
                const active = ticketType === type;
                const Icon = type === "vvip" ? Crown : Star;
                return (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => { setTicketType(type); setError(null); if (issuedTicket) setIssuedTicket(null); }}
                    className={cn(
                      "relative overflow-hidden rounded-lg border-2 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active ? "shadow-md" : "border-border opacity-80 hover:opacity-100",
                    )}
                    style={active ? { borderColor: th.accent } : undefined}
                  >
                    <div className="px-3.5 py-3" style={{ backgroundImage: `linear-gradient(135deg, ${th.dark}, ${th.dark2})` }}>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.14em]"
                        style={{ background: th.accent, color: th.onAccent }}
                      >
                        <Icon className="w-3 h-3" fill="currentColor" />
                        {th.label}
                      </span>
                      <p className="mt-2 text-sm font-semibold text-white">{th.tagline[isAr ? "ar" : "en"]}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 bg-card px-3.5 py-2">
                      <span className="text-xs text-muted-foreground">
                        {type === "vvip" ? (isAr ? "أسود وذهبي" : "Black & gold") : (isAr ? "نحاسي" : "Copper")}
                      </span>
                      <span
                        className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center", !active && "border-border")}
                        style={active ? { borderColor: th.accent } : undefined}
                      >
                        {active && <span className="w-2 h-2 rounded-full" style={{ background: th.accent }} />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border p-5 sm:p-6 space-y-4">
            <SectionHeading
              step={3}
              title={isAr ? "العميل" : "Customer"}
              hint={isAr ? "يُطبع الاسم على التذكرة، وتُرسل التذكرة إلى البريد" : "The name is printed on the ticket; the ticket is sent to the email"}
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
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="customer-email" className="text-sm font-medium">{isAr ? "البريد الإلكتروني" : "Email"}</Label>
                <Input
                  id="customer-email"
                  type="email"
                  inputMode="email"
                  placeholder="guest@example.com"
                  value={form.customerEmail}
                  onChange={(e) => updateForm({ customerEmail: e.target.value })}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  maxLength={254}
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
                : <>{ticketType === "vvip" ? <Crown className="w-4 h-4" /> : <Star className="w-4 h-4" />}{isAr ? `إصدار تذكرة ${TICKET_THEMES[ticketType].label}` : `Issue ${TICKET_THEMES[ticketType].label} ticket`}</>
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

          <div
            className={cn("bg-card border-2 rounded-xl overflow-hidden", !issuedTicket && "opacity-95")}
            style={{ borderColor: pth.accent }}
          >
            <div
              className="relative p-5 text-white"
              style={{
                backgroundImage: pth.premium
                  ? `repeating-linear-gradient(135deg, transparent 0 10px, ${pth.accent}1f 10px 11px), linear-gradient(135deg, ${pth.dark}, ${pth.dark2})`
                  : `linear-gradient(135deg, ${pth.dark}, ${pth.dark2})`,
                borderBottom: `4px solid ${pth.accent}`,
              }}
            >
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  {systemLogo && isImageUrl(systemLogo) && (
                    <img src={systemLogo} alt="" className="w-6 h-6 rounded object-contain bg-black shrink-0" />
                  )}
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] truncate" style={{ color: pth.accent }}>{brandName}</span>
                </div>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.14em] rounded-full px-2.5 py-1 shrink-0"
                  style={{ background: pth.accent, color: pth.onAccent }}
                >
                  {pth.kind === "vvip" ? <Crown className="w-3 h-3" fill="currentColor" /> : <Star className="w-3 h-3" fill="currentColor" />}
                  {pth.label}
                </span>
              </div>
              <p className={cn("text-lg font-semibold leading-snug tracking-tight", !preview.event && "text-white/60")}>
                {preview.event?.title ?? (isAr ? "اسم الفعالية" : "Event name")}
              </p>
              <div className="mt-2 space-y-1 text-xs text-white/75">
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
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "البريد" : "Email"}</p>
                  <p dir="ltr" className={cn("text-sm font-medium truncate text-start", preview.customerEmail ? "text-foreground" : "text-muted-foreground/60")}>
                    {preview.customerEmail || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{isAr ? "السعر" : "Price"}</p>
                  <p className="text-sm font-medium text-foreground tabular-nums">{formatPrice(preview.event?.price ?? null) ?? "—"}</p>
                </div>
              </div>
              {preview.qrDataUrl ? (
                <img src={preview.qrDataUrl} alt={isAr ? "رمز QR للتذكرة" : "Ticket QR code"} className="w-28 h-28 rounded-lg border-2 p-1.5 bg-white shrink-0" style={{ borderColor: pth.accent }} />
              ) : (
                <div className="w-28 h-28 rounded-md border border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground/60 shrink-0">
                  <QrCode className="w-6 h-6" strokeWidth={1.5} />
                  <span className="text-[10px] text-center leading-tight px-2">{isAr ? "يظهر بعد الإصدار" : "Appears after issuing"}</span>
                </div>
              )}
            </div>

            <div className="relative border-t-[1.5px] border-dashed border-border px-5 py-2.5 flex items-center justify-between gap-3" style={{ background: pth.soft }}>
              <span className="font-mono text-xs font-semibold tracking-wider text-neutral-900">
                {preview.id ? `#${shortId(preview.id)}` : "#————————"}
              </span>
              <span className="text-[11px] font-bold tracking-[0.14em]" style={{ color: pth.text }}>{pth.label}</span>
            </div>
          </div>

          {issuedTicket && (
            <div
              role="status"
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm",
                issuedTicket.email === "sent" && "border-emerald-600/30 bg-emerald-600/5 text-emerald-700 dark:text-emerald-400",
                issuedTicket.email === "sending" && "border-border text-muted-foreground",
                issuedTicket.email === "failed" && "border-destructive/30 bg-destructive/5 text-destructive",
              )}
            >
              {issuedTicket.email === "sending" ? (
                <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
              ) : issuedTicket.email === "sent" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="break-words">
                  {issuedTicket.email === "sending"
                    ? (isAr ? "جارٍ إرسال التذكرة بالبريد…" : "Emailing the ticket…")
                    : issuedTicket.email === "sent"
                      ? (isAr ? `أُرسلت التذكرة إلى ${issuedTicket.customer_email}` : `Ticket emailed to ${issuedTicket.customer_email}`)
                      : (isAr ? `تعذّر إرسال البريد${issuedTicket.emailError ? ` (${issuedTicket.emailError})` : ""}.` : `The email couldn't be sent${issuedTicket.emailError ? ` (${issuedTicket.emailError})` : ""}.`)}
                </p>
                {issuedTicket.email === "failed" && (
                  <button type="button" onClick={() => void emailTicket(issuedTicket)} className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2">
                    <Mail className="w-3.5 h-3.5" />
                    {isAr ? "إعادة المحاولة" : "Try again"}
                  </button>
                )}
              </div>
            </div>
          )}

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
