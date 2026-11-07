import { Link } from "wouter";
import { CalendarDays, MapPin } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { daysUntil, type PublicEvent } from "@/lib/events";
import { EventImage } from "./EventImage";

/** "In 3 days" style label; accent-coloured when the event is within a week. */
export function WhenTag({ event }: { event: PublicEvent }) {
  const { relativeDay } = useLocale();
  const days = daysUntil(event);
  if (days == null) return null;
  const soon = days >= 0 && days <= 7;
  return (
    <span
      className={`inline-flex h-6 w-fit items-center rounded px-2 text-xs font-medium ${
        soon ? "bg-accent-soft text-copper-ink" : "bg-bg text-ink-soft"
      }`}
    >
      {relativeDay(days)}
    </span>
  );
}

function DateBadge({ iso }: { iso: string }) {
  const { dateParts } = useLocale();
  const p = dateParts(iso);
  return (
    <div className="flex w-14 flex-col items-center rounded-md bg-surface py-1.5 leading-none shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-copper-ink">{p.month}</span>
      <span className="mt-1 text-2xl font-semibold tracking-tight">{p.day}</span>
    </div>
  );
}

/**
 * Event card. `wide` is used when an event has a row to itself: on tablets
 * and up the cover sits beside the details instead of above them.
 */
export function EventCard({ event, wide = false }: { event: PublicEvent; wide?: boolean }) {
  const { t, formatDate, formatPrice } = useLocale();

  return (
    <Link
      href={`/events/${event.id}`}
      className={`group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-[0_12px_32px_-20px_rgba(14,42,74,0.35)] ${
        wide ? "md:flex-row" : ""
      }`}
    >
      <div className={`relative ${wide ? "md:w-1/2 md:shrink-0" : ""}`}>
        <EventImage
          src={event.image_url}
          alt={event.title}
          className={`aspect-[16/10] w-full ${wide ? "md:aspect-auto md:h-full md:min-h-80" : ""}`}
        />
        {event.event_date && (
          <div className="absolute start-3 top-3">
            <DateBadge iso={event.event_date} />
          </div>
        )}
      </div>

      <div className={`flex flex-1 flex-col p-5 ${wide ? "md:justify-center md:p-8 lg:p-10" : ""}`}>
        <WhenTag event={event} />
        <h3
          className={`mt-3 line-clamp-2 font-semibold leading-snug tracking-tight [overflow-wrap:anywhere] group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-4 ${
            wide ? "text-xl md:text-3xl" : "text-lg"
          }`}
        >
          {event.title}
        </h3>

        {event.description?.trim() && (
          <p className={`mt-2 text-sm leading-relaxed text-ink-soft [overflow-wrap:anywhere] ${wide ? "line-clamp-3 md:text-base" : "line-clamp-2"}`}>
            {event.description.trim()}
          </p>
        )}

        <ul className={`mt-3 space-y-1.5 text-sm text-muted ${wide ? "md:mt-4 md:text-base" : ""}`}>
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.event_date ? formatDate(event.event_date, wide ? "long" : "short") : t.dateTba}</span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.location || t.venueTba}</span>
          </li>
        </ul>

        <div className={`mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 ${wide ? "md:mt-8" : "mt-5"}`}>
          <span className={`font-semibold ${wide ? "md:text-lg" : ""} ${event.price === 0 ? "text-ok" : ""}`}>{formatPrice(event.price)}</span>
          <span
            className={`inline-flex items-center rounded-md bg-btn px-4 text-sm font-semibold text-on-btn transition-colors group-hover:bg-accent-hover group-hover:text-on-accent ${
              wide ? "h-11 md:px-6" : "h-10"
            }`}
          >
            {t.getTickets}
          </span>
        </div>
      </div>
    </Link>
  );
}

/**
 * Cards that always use the full width: a lone event gets a wide card, and
 * otherwise cards wrap (about 3 per row on desktop) with the last row's
 * cards growing to fill the space left over.
 */
export function EventGrid({ events }: { events: PublicEvent[] }) {
  if (events.length === 1) {
    return (
      <ul>
        <li>
          <EventCard event={events[0]} wide />
        </li>
      </ul>
    );
  }
  return (
    <ul className="flex flex-wrap gap-5">
      {events.map((e) => (
        <li key={e.id} className="min-w-0 flex-[1_1_300px]">
          <EventCard event={e} />
        </li>
      ))}
    </ul>
  );
}
