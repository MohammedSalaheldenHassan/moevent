import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import {
  CalendarDays, CalendarPlus, Check, ChevronDown, ChevronRight, CircleAlert, Copy, ExternalLink, MapPin, Minus, Plus, Share2, Tag,
} from "lucide-react";
import { useLocale } from "@/lib/i18n";
import {
  ATTENDEE_TYPES, BookingError, daysUntil, isPast, isValidEmail, MAX_TICKETS, normalizeCompanyUrl, shortRef, submitBooking,
  useAvailability, useEvent, type AttendeeType, type PublicEvent,
} from "@/lib/events";
import { copyText, downloadIcs, googleCalendarUrl, loadContact, mapEmbedUrl, mapsUrl, saveContact, shareLink } from "@/lib/actions";
import { EventImage } from "@/components/EventImage";
import { WhenTag } from "@/components/EventCard";
import { Turnstile, TURNSTILE_SITE_KEY, type TurnstileHandle } from "@/components/Turnstile";

const isValidPhone = (v: string) => /^\+?[\d\s\-()]{9,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 9;

const btnSecondary =
  "inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:border-ink";

function Breadcrumb({ title }: { title: string }) {
  const { t } = useLocale();
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
      <Link href="/" className="inline-flex min-h-10 shrink-0 items-center hover:text-ink hover:underline">
        {t.breadcrumbEvents}
      </Link>
      <ChevronRight className="size-3.5 shrink-0 rtl:-scale-x-100" aria-hidden="true" />
      <span className="truncate text-ink-soft" aria-current="page">
        {title}
      </span>
    </nav>
  );
}

/** A key fact (date / venue / price) in the event header. */
function Fact({
  icon: Icon,
  label,
  value,
  sub,
  valueClass,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  sub?: ReactNode;
  valueClass?: string;
}) {
  return (
    <li className="flex gap-3 rounded-xl border border-line bg-surface p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-bg text-ink-soft">
        <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <p className={`mt-0.5 font-semibold leading-snug ${valueClass ?? ""}`}>{value}</p>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
    </li>
  );
}

function CalendarMenu({ event }: { event: PublicEvent }) {
  const { t } = useLocale();
  const ref = useRef<HTMLDetailsElement>(null);
  const page = window.location.href.split("?")[0];
  const google = googleCalendarUrl(event, page);

  // Close when tapping elsewhere.
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  if (!google) return null;

  const item = "flex w-full items-center gap-2 px-3 py-2.5 text-start text-sm hover:bg-bg";
  return (
    <details ref={ref} className="relative">
      <summary className={`${btnSecondary} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <CalendarPlus className="size-4" aria-hidden="true" />
        {t.addCalendar}
        <ChevronDown className="size-3.5 text-muted" aria-hidden="true" />
      </summary>
      <div className="absolute start-0 top-full z-20 mt-1 w-60 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-lg">
        <a href={google} target="_blank" rel="noopener noreferrer" className={item} onClick={() => ref.current?.removeAttribute("open")}>
          {t.googleCalendar}
          <ExternalLink className="ms-auto size-3.5 text-muted" aria-hidden="true" />
        </a>
        <button
          type="button"
          className={item}
          onClick={() => {
            downloadIcs(event, page);
            ref.current?.removeAttribute("open");
          }}
        >
          {t.appleCalendar}
        </button>
      </div>
    </details>
  );
}

function ShareButton({ title }: { title: string }) {
  const { t } = useLocale();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={btnSecondary}
      onClick={async () => {
        const r = await shareLink(title, window.location.href.split("?")[0]);
        if (r === "copied") {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }}
    >
      {copied ? <Check className="size-4 text-ok" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      {copied ? t.linkCopied : t.share}
    </button>
  );
}

/** `tickets`: booked directly. `request`: an organization request awaiting approval (ids = [request id]). */
interface Booked {
  kind: "tickets" | "request";
  ids: string[];
  name: string;
  email: string;
  attendeeType: AttendeeType;
  quantity: number;
  companyUrl?: string;
  /** Student / Regular only: whether the tickets were emailed right away. */
  emailed?: boolean;
}

function Confirmation({ event, booked, onMore }: { event: PublicEvent; booked: Booked; onMore: () => void }) {
  const { ids, name, email, attendeeType, kind, quantity, companyUrl, emailed } = booked;
  const isRequest = kind === "request";
  const { t, formatDate } = useLocale();
  const [copied, setCopied] = useState(false);
  const refs = ids.map(shortRef);
  const heading = useRef<HTMLHeadingElement>(null);

  // Move focus (and the viewport, on phones) to the result.
  useEffect(() => {
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, []);

  return (
    <div className="fade-in">
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-4.5" strokeWidth={2.5} aria-hidden="true" />
        </span>
        <div>
          <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold tracking-tight outline-none">
            {isRequest ? t.requestTitle : t.doneTitle}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {isRequest ? t.requestBody(email) : emailed ? t.ticketsEmailed(email, ids.length) : t.emailDelayed}
          </p>
        </div>
      </div>

      <dl className="mt-5 divide-y divide-line rounded-md border border-line text-sm">
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{t.guest}</dt>
          <dd className="truncate font-medium">{name}</dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{t.email}</dt>
          <dd dir="ltr" className="truncate font-medium">
            {email}
          </dd>
        </div>
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{t.attendeeType}</dt>
          <dd className="font-medium">{t.attendeeTypes[attendeeType].label}</dd>
        </div>
        {isRequest && companyUrl && (
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">{t.company}</dt>
            <dd dir="ltr" className="truncate font-medium">
              {companyUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </dd>
          </div>
        )}
        {isRequest && (
          <div className="flex justify-between gap-4 px-4 py-3">
            <dt className="text-muted">{t.ticketsRequested}</dt>
            <dd className="font-medium">{quantity}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{t.date}</dt>
          <dd className="font-medium">{event.event_date ? formatDate(event.event_date, "short") : t.dateTba}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <dt className="text-muted">{t.status}</dt>
          {!isRequest && emailed ? (
            <dd className="rounded bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">{t.ticketSent}</dd>
          ) : (
            <dd className="rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">{isRequest ? t.awaitingApproval : t.pending}</dd>
          )}
        </div>
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">{isRequest ? t.requestRef : t.references(refs.length)}</dt>
            <button
              type="button"
              onClick={async () => {
                if (await copyText(refs.join(", "))) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }
              }}
              className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-ink-soft hover:bg-bg"
            >
              {copied ? <Check className="size-3.5 text-ok" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              {copied ? t.copied : t.copy}
            </button>
          </div>
          <dd dir="ltr" className="mt-2 flex flex-wrap justify-end gap-1.5 rtl:justify-start">
            {refs.map((r) => (
              <span key={r} className="rounded bg-bg px-2 py-1 font-mono text-sm font-medium tracking-wider">
                {r}
              </span>
            ))}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted">{t.screenshotHint}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <CalendarMenu event={event} />
        <button type="button" onClick={onMore} className={btnSecondary}>
          {t.bookMore}
        </button>
      </div>
    </div>
  );
}

function BookingPanel({ event }: { event: PublicEvent }) {
  const { t, formatPrice, formatMoney } = useLocale();
  const [{ name, phone, email }, setContact] = useState(loadContact);
  const [attendeeType, setAttendeeType] = useState<AttendeeType | null>(null);
  const [qty, setQty] = useState(1);
  const [companyUrl, setCompanyUrl] = useState("");
  const [university, setUniversity] = useState("");
  const [major, setMajor] = useState("");
  const [errors, setErrors] = useState<{
    type?: string; company?: string; university?: string; major?: string; name?: string; phone?: string; email?: string; form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState<Booked | null>(null);
  const isOrg = attendeeType === "organization";
  const isStudent = attendeeType === "student";
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle>(null);

  // Seats left / per-booking limit for each type, as set by the admin.
  const { availability, refresh: refreshAvailability } = useAvailability(event.id);
  const typeInfo = attendeeType ? availability?.[attendeeType] : undefined;
  const maxQty = Math.max(1, Math.min(typeInfo?.maxPerBooking ?? MAX_TICKETS, typeInfo?.remaining ?? Infinity));
  useEffect(() => setQty((q) => Math.min(q, maxQty)), [maxQty]);

  if (booked) {
    return (
      <Confirmation
        event={event}
        booked={booked}
        onMore={() => {
          setBooked(null);
          setQty(1);
        }}
      />
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!attendeeType) next.type = t.attendeeTypeRequired;
    const company = isOrg ? normalizeCompanyUrl(companyUrl) : null;
    if (isOrg && !company) next.company = t.companyUrlInvalid;
    if (isStudent && !university.trim()) next.university = t.universityRequired;
    if (isStudent && !major.trim()) next.major = t.majorRequired;
    if (!name.trim()) next.name = t.nameRequired;
    if (!isValidPhone(phone)) next.phone = t.phoneInvalid;
    if (!isValidEmail(email.trim())) next.email = t.emailInvalid;
    setErrors(next);
    // Focus the first invalid field, in form order.
    const firstBad = (["type", "company", "university", "major", "name", "phone", "email"] as const).find((k) => next[k]);
    if (firstBad || !attendeeType) {
      document.getElementById(firstBad === "type" ? `type-${ATTENDEE_TYPES[0]}` : firstBad!)?.focus();
      return;
    }

    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setErrors({ form: t.captchaPending });
      return;
    }

    const contact = { name: name.trim(), phone: phone.trim(), email: email.trim() };
    const common = { name: contact.name, email: contact.email, attendeeType, quantity: qty };
    setSubmitting(true);
    try {
      // Student / Regular: tickets are created and emailed by the server.
      // Organization: a request an admin must approve — no tickets yet.
      const result = await submitBooking({
        eventId: event.id,
        attendeeType,
        ...contact,
        quantity: qty,
        ...(isOrg && company ? { companyUrl: company } : {}),
        ...(isStudent ? { university: university.trim(), major: major.trim() } : {}),
        ...(captchaToken ? { captchaToken } : {}),
      });
      if (result.kind === "request" && result.requestId) {
        setBooked({ kind: "request", ids: [result.requestId], companyUrl: company ?? undefined, ...common });
      } else {
        setBooked({ kind: "tickets", ids: result.ticketIds ?? [], emailed: result.emailed === true, ...common });
      }
      saveContact(contact);
      refreshAvailability();
    } catch (err) {
      const code = err instanceof BookingError ? err.code : "failed";
      const messages: Record<string, string> = {
        sold_out: t.soldOutError,
        max_per_booking: t.maxPerBookingError(maxQty),
        ended: t.endedError,
        daily_limit: t.dailyLimitError,
        rate_limit: t.rateLimitError,
        captcha: t.captchaError,
      };
      setErrors({ form: messages[code] ?? t.bookError });
      // Someone else may have taken the last seats; show the fresh numbers.
      if (code === "sold_out" || code === "max_per_booking") refreshAvailability();
    } finally {
      setSubmitting(false);
      // Turnstile tokens are single-use.
      turnstileRef.current?.reset();
    }
  };

  const input = (bad: boolean) =>
    `h-11 w-full rounded-md border bg-surface px-3 text-base outline-none placeholder:text-muted focus:border-ink ${bad ? "border-danger" : "border-line-strong"}`;
  const stepBtn =
    "flex size-11 items-center justify-center text-ink hover:bg-bg disabled:cursor-not-allowed disabled:text-line-strong disabled:hover:bg-transparent";

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{t.bookTitle}</h2>
        <p className="text-end">
          <span className={`font-semibold ${event.price === 0 ? "text-ok" : ""}`}>{formatPrice(event.price)}</span>
          {event.price != null && event.price > 0 && <span className="ms-1 text-xs text-muted">{t.perTicket}</span>}
        </p>
      </div>

      <div className="mt-5 space-y-4">
        <fieldset aria-describedby={errors.type ? "type-err" : undefined}>
          <legend className="text-sm font-medium">{t.attendeeType}</legend>
          <div className="mt-1.5 space-y-2">
            {ATTENDEE_TYPES.map((type) => {
              const checked = attendeeType === type;
              const remaining = availability?.[type]?.remaining ?? null;
              const soldOut = remaining === 0;
              return (
                <label
                  key={type}
                  htmlFor={`type-${type}`}
                  className={`flex min-h-12 items-center gap-3 rounded-md border px-3 py-2.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${
                    soldOut
                      ? "cursor-not-allowed border-line opacity-60"
                      : checked
                        ? "cursor-pointer border-ink bg-bg"
                        : errors.type
                          ? "cursor-pointer border-danger"
                          : "cursor-pointer border-line-strong hover:border-ink"
                  }`}
                >
                  <input
                    id={`type-${type}`}
                    type="radio"
                    name="attendee-type"
                    value={type}
                    checked={checked}
                    disabled={soldOut}
                    onChange={() => {
                      setAttendeeType(type);
                      setErrors((er) => ({ ...er, type: undefined }));
                    }}
                    className="size-4 shrink-0 accent-[var(--color-accent)] focus:outline-none"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t.attendeeTypes[type].label}</span>
                    <span className="block text-xs text-muted">{t.attendeeTypes[type].hint}</span>
                  </span>
                  {remaining != null && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${
                        soldOut ? "bg-bg text-muted" : remaining <= 10 ? "bg-accent-soft text-copper-ink" : "bg-bg text-ink-soft"
                      }`}
                    >
                      {soldOut ? t.soldOut : t.seatsLeft(remaining)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          {errors.type && (
            <p id="type-err" className="mt-1 text-xs text-danger">
              {errors.type}
            </p>
          )}
        </fieldset>

        {isOrg && (
          <div className="fade-in space-y-4">
            <p className="flex items-start gap-2 rounded-md border border-line bg-bg px-3 py-2.5 text-xs text-ink-soft">
              <CircleAlert className="mt-px size-4 shrink-0 text-copper-ink" aria-hidden="true" />
              {t.orgNotice}
            </p>
            <div>
              <label htmlFor="company" className="block text-sm font-medium">
                {t.companyUrl}
              </label>
              <input
                id="company"
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                dir="ltr"
                value={companyUrl}
                onChange={(e) => setCompanyUrl(e.target.value)}
                placeholder="https://company.com"
                maxLength={2048}
                aria-invalid={!!errors.company}
                aria-describedby="company-hint"
                className={`mt-1.5 rtl:text-right ${input(!!errors.company)}`}
              />
              <p id="company-hint" className={`mt-1 text-xs ${errors.company ? "text-danger" : "text-muted"}`}>
                {errors.company ?? t.companyUrlHint}
              </p>
            </div>
          </div>
        )}

        {isStudent && (
          <div className="fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div>
              <label htmlFor="university" className="block text-sm font-medium">
                {t.university}
              </label>
              <input
                id="university"
                autoComplete="organization"
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                maxLength={120}
                aria-invalid={!!errors.university}
                aria-describedby={errors.university ? "university-err" : undefined}
                className={`mt-1.5 ${input(!!errors.university)}`}
              />
              {errors.university && (
                <p id="university-err" className="mt-1 text-xs text-danger">
                  {errors.university}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="major" className="block text-sm font-medium">
                {t.major}
              </label>
              <input
                id="major"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                maxLength={120}
                aria-invalid={!!errors.major}
                aria-describedby={errors.major ? "major-err" : undefined}
                className={`mt-1.5 ${input(!!errors.major)}`}
              />
              {errors.major && (
                <p id="major-err" className="mt-1 text-xs text-danger">
                  {errors.major}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <span>
            <span id="qty-label" className="block text-sm font-medium">
              {t.quantity}
            </span>
            {attendeeType && <span className="block text-xs text-muted">{t.perBooking(maxQty)}</span>}
          </span>
          <div role="group" aria-labelledby="qty-label" className="flex items-center overflow-hidden rounded-md border border-line-strong">
            <button type="button" className={stepBtn} onClick={() => setQty((q) => q - 1)} disabled={qty <= 1} aria-label={t.decrease}>
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <output aria-live="polite" className="w-10 text-center font-semibold">
              {qty}
            </output>
            <button type="button" className={stepBtn} onClick={() => setQty((q) => q + 1)} disabled={qty >= maxQty} aria-label={t.increase}>
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="border-t border-line pt-5 text-sm font-semibold">{t.yourDetails}</p>

        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            {t.name}
          </label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            maxLength={80}
            aria-invalid={!!errors.name}
            aria-describedby="name-hint"
            className={`mt-1.5 ${input(!!errors.name)}`}
          />
          <p id="name-hint" className={`mt-1 text-xs ${errors.name ? "text-danger" : "text-muted"}`}>
            {errors.name ?? t.nameHint}
          </p>
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            {t.phone}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            value={phone}
            onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            placeholder="07X XXX XXXX"
            maxLength={20}
            aria-invalid={!!errors.phone}
            aria-describedby="phone-hint"
            className={`mt-1.5 rtl:text-right ${input(!!errors.phone)}`}
          />
          <p id="phone-hint" className={`mt-1 text-xs ${errors.phone ? "text-danger" : "text-muted"}`}>
            {errors.phone ?? t.phoneHint}
          </p>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            {t.email}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            dir="ltr"
            value={email}
            onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            placeholder="name@example.com"
            maxLength={254}
            aria-invalid={!!errors.email}
            aria-describedby="email-hint"
            className={`mt-1.5 rtl:text-right ${input(!!errors.email)}`}
          />
          <p id="email-hint" className={`mt-1 text-xs ${errors.email ? "text-danger" : "text-muted"}`}>
            {errors.email ?? t.emailHint}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-3 border-t border-line pt-4">
        <span className="text-sm font-medium">{t.total}</span>
        {event.price != null && event.price > 0 ? (
          <span className="text-lg font-semibold">{formatMoney(event.price * qty)}</span>
        ) : event.price === 0 ? (
          <span className="text-lg font-semibold">{t.free}</span>
        ) : (
          <span className="text-sm text-muted">{t.totalOnConfirm}</span>
        )}
      </div>

      <Turnstile ref={turnstileRef} onToken={setCaptchaToken} />

      {errors.form && (
        <p className="mt-4 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger" role="alert">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {errors.form}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-accent text-base font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
      >
        {submitting ? t.submitting : isOrg ? t.submitRequest(qty) : t.submit(qty)}
      </button>
      <p className="mt-3 text-center text-xs text-muted">{event.price === 0 ? t.freeNote : t.bookNote}</p>
    </form>
  );
}

function EventSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="h-5 w-40 animate-pulse rounded bg-line" />
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="aspect-[16/9] animate-pulse rounded-lg bg-line" />
        <div className="h-96 animate-pulse rounded-lg bg-line" />
      </div>
    </div>
  );
}

export default function EventPage({ id }: { id: string }) {
  const { t, formatDate, formatPrice, relativeDay } = useLocale();
  const { data: event, loading, error } = useEvent(id);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelVisible, setPanelVisible] = useState(true);

  useEffect(() => {
    if (event) document.title = `${event.title} · Nexus Youth`;
    return () => {
      document.title = "Nexus Youth — Events & Tickets";
    };
  }, [event]);

  // Mobile: show the bottom bar only while the booking panel is off screen.
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPanelVisible(entry.isIntersecting), { threshold: 0.1 });
    io.observe(el);
    return () => io.disconnect();
  }, [event]);

  if (loading) return <EventSkeleton />;

  if (!event) {
    return (
      <div className="mx-auto max-w-md px-4 pt-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{error ? t.loadError : t.notFound}</h1>
        <p className="mt-2 text-muted">{error ?? t.notFoundBody}</p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-md bg-btn px-5 font-medium text-on-btn hover:bg-accent-hover hover:text-on-accent">
          {t.goHome}
        </Link>
      </div>
    );
  }

  const past = isPast(event);
  const days = daysUntil(event);
  const hasPin = event.latitude != null && event.longitude != null;

  return (
    <>
      {/* Extra bottom room on phones for the fixed "Get tickets" bar. */}
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:pb-0">
        <Breadcrumb title={event.title} />

        <div className="mt-5 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
          <article className="min-w-0">
            {/* What, when, where — before the photo, so phones see it first. */}
            <header>
              <div className="flex flex-wrap items-center gap-2">
                <WhenTag event={event} />
                {event.price === 0 && (
                  <span className="inline-flex h-6 items-center rounded bg-ok-soft px-2 text-xs font-semibold text-ok">{t.free}</span>
                )}
              </div>
              <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight [overflow-wrap:anywhere] min-[400px]:text-3xl sm:text-4xl lg:text-[2.6rem]">
                {event.title}
              </h1>

              {/* Plain text from the dashboard; keep the admin's line breaks. */}
              {event.description?.trim() && (
                <p className="mt-4 max-w-prose whitespace-pre-line text-lg leading-relaxed text-ink-soft">{event.description.trim()}</p>
              )}

              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                <Fact
                  icon={CalendarDays}
                  label={t.date}
                  value={event.event_date ? formatDate(event.event_date, "long") : t.dateTba}
                  sub={days != null && days >= 0 ? relativeDay(days) : undefined}
                />
                <Fact
                  icon={MapPin}
                  label={t.venue}
                  value={event.location || t.venueTba}
                  sub={
                    event.location || hasPin ? (
                      <a href="#location" className="font-medium text-copper-ink hover:underline">
                        {t.seeOnMap}
                      </a>
                    ) : undefined
                  }
                />
                <Fact
                  icon={Tag}
                  label={t.price}
                  value={formatPrice(event.price)}
                  valueClass={event.price === 0 ? "text-ok" : undefined}
                  sub={event.price != null && event.price > 0 ? t.perTicket : undefined}
                />
              </ul>

              <div className="mt-4 flex flex-wrap gap-2">
                {!past && <CalendarMenu event={event} />}
                <ShareButton title={event.title} />
              </div>
            </header>

            <EventImage
              src={event.image_url}
              alt={event.title}
              eager
              className="mt-8 aspect-[16/9] max-h-[min(70svh,480px)] w-full rounded-xl border border-line"
            />

            {(event.location || hasPin) && (
              <section id="location" aria-labelledby="location-title" className="mt-10 scroll-mt-24">
                <h2 id="location-title" className="text-xl font-semibold tracking-tight">
                  {t.locationTitle}
                </h2>
                <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
                  {hasPin && (
                    <iframe
                      title={t.venueMap}
                      src={mapEmbedUrl(event.latitude!, event.longitude!)}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="block aspect-[4/3] w-full border-b border-line bg-placeholder sm:aspect-[2/1]"
                    />
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <p className="flex min-w-0 items-center gap-2 font-medium">
                      <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      <span>{event.location || t.venueTba}</span>
                    </p>
                    <a href={mapsUrl(event)} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
                      {t.openMaps}
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              </section>
            )}
          </article>

          <aside ref={panelRef} id="book" className="scroll-mt-20 lg:sticky lg:top-20">
            <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              {past ? (
                <div className="text-center">
                  <h2 className="text-lg font-semibold">{t.endedTitle}</h2>
                  <p className="mt-1 text-sm text-muted">{t.endedBody}</p>
                  <Link href="/" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-md bg-btn font-medium text-on-btn hover:bg-accent-hover hover:text-on-accent">
                    {t.seeUpcoming}
                  </Link>
                </div>
              ) : (
                <BookingPanel event={event} />
              )}
            </div>
          </aside>
        </div>
      </div>

      {!past && (
        <div
          aria-hidden={panelVisible}
          className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-200 lg:hidden ${
            panelVisible ? "translate-y-full" : "translate-y-0"
          }`}
        >
          <div className="mx-auto flex max-w-md items-center justify-between gap-4">
            <div className="min-w-0">
              <p className={`truncate font-semibold ${event.price === 0 ? "text-ok" : ""}`}>{formatPrice(event.price)}</p>
              <p className="truncate text-xs text-muted">{event.event_date ? formatDate(event.event_date, "short") : t.dateTba}</p>
            </div>
            <a
              href="#book"
              tabIndex={panelVisible ? -1 : 0}
              className="flex h-11 shrink-0 items-center rounded-md bg-accent px-6 font-semibold text-on-accent hover:bg-accent-hover"
            >
              {t.bookCta}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
