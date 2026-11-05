import { useMemo, useState, type ReactNode } from "react";
import { CalendarSearch, Search, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { inRange, type PublicEvent, type RangeFilter } from "@/lib/events";
import { EventGrid } from "@/components/EventCard";
import { SectionHeader } from "./SectionHeader";

function Notice({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-bg text-muted">
        <CalendarSearch className="size-6" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="mt-4 font-semibold">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <li className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-xl border border-line bg-surface">
      <div className="aspect-[16/10] animate-pulse bg-bg" />
      <div className="space-y-2.5 p-5">
        <div className="h-5 w-20 animate-pulse rounded bg-bg" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-bg" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-bg" />
      </div>
    </li>
  );
}

/** Groups events under month headings, keeping the incoming (date) order. */
function groupByMonth(events: PublicEvent[], heading: (iso: string) => string, undated: string) {
  const groups: { label: string; items: PublicEvent[] }[] = [];
  for (const e of events) {
    const label = e.event_date ? heading(e.event_date) : undated;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

export function EventsSection({
  upcoming,
  loading,
  error,
  onRetry,
}: {
  upcoming: PublicEvent[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { t, monthHeading } = useLocale();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<RangeFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return upcoming.filter(
      (e) => inRange(e, range) && (!q || `${e.title} ${e.location ?? ""}`.toLowerCase().includes(q)),
    );
  }, [upcoming, query, range]);
  const groups = useMemo(() => groupByMonth(filtered, monthHeading, t.dateTba), [filtered, monthHeading, t.dateTba]);

  const filters: { id: RangeFilter; label: string }[] = [
    { id: "all", label: t.filterAll },
    { id: "week", label: t.filterWeek },
    { id: "month", label: t.filterMonth },
  ];
  const reset = () => {
    setQuery("");
    setRange("all");
  };

  return (
    <section id="events" aria-labelledby="events-title" className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
      <SectionHeader id="events-title" title={t.pageTitle} sub={t.upcomingSub} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block sm:w-96">
          <span className="sr-only">{t.search}</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="h-11 w-full rounded-md border border-line-strong bg-surface ps-9 pe-10 text-base outline-none placeholder:text-muted focus:border-ink"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t.clearSearch}
              className="absolute end-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded text-muted hover:bg-bg hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          )}
        </label>

        <div role="group" aria-label={t.navEvents} className="flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRange(f.id)}
              aria-pressed={range === f.id}
              className={`h-11 shrink-0 rounded-md border px-4 text-sm font-medium transition-colors ${
                range === f.id ? "border-ink bg-btn text-on-btn" : "border-line-strong bg-surface text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8" aria-live="polite">
        {loading ? (
          <ul className="flex flex-wrap gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </ul>
        ) : error ? (
          <Notice
            title={t.loadError}
            body={error}
            action={
              <button type="button" onClick={onRetry} className="h-10 rounded-md bg-btn px-4 text-sm font-medium text-on-btn hover:bg-accent-hover hover:text-on-accent">
                {t.retry}
              </button>
            }
          />
        ) : upcoming.length === 0 ? (
          <Notice title={t.noEvents} body={t.noEventsBody} />
        ) : filtered.length === 0 ? (
          <Notice
            title={t.noMatches}
            action={
              <button type="button" onClick={reset} className="h-10 rounded-md border border-line-strong bg-surface px-4 text-sm font-medium hover:border-ink">
                {t.resetFilters}
              </button>
            }
          />
        ) : (
          <div className="fade-in space-y-8">
            <p className="text-sm text-muted">{t.results(filtered.length)}</p>
            {groups.map((g) => (
              <div key={g.label}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{g.label}</h3>
                <EventGrid events={g.items} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
