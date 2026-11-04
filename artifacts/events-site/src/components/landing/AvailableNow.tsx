import { ArrowDown } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { daysUntil, type PublicEvent } from "@/lib/events";
import { useSectionLink } from "@/lib/sections";
import { EventGrid } from "@/components/EventCard";
import { SectionHeader } from "./SectionHeader";

/** How far ahead an event counts as "available now". */
const WINDOW_DAYS = 30;
const MAX_CARDS = 3;

export function pickAvailableNow(events: PublicEvent[]): PublicEvent[] {
  return events
    .filter((e) => {
      const d = daysUntil(e);
      return d != null && d >= 0 && d <= WINDOW_DAYS;
    })
    .slice(0, MAX_CARDS);
}

export function AvailableNow({ events }: { events: PublicEvent[] }) {
  const { t } = useLocale();
  const sectionLink = useSectionLink();
  if (events.length === 0) return null;

  return (
    <section aria-labelledby="available-title" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
      <SectionHeader
        id="available-title"
        title={t.availableTitle}
        sub={t.availableSub}
        action={
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink hover:text-accent"
          >
            {t.viewAll}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        }
      />
      <div className="mt-8">
        <EventGrid events={events} />
      </div>
    </section>
  );
}
