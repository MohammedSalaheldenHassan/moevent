import { useEffect, useRef, useState } from "react";
import { getGetPublicStatsQueryKey, useGetPublicStats } from "@workspace/api-client-react";
import { useLocale } from "@/lib/i18n";
import { prefersReducedMotion } from "@/lib/sections";

/** Counts from 0 to `value` once the number scrolls into view. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1200;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration);
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);

  return (
    <span ref={ref} className="tabular-nums">
      {/* Screen readers get the final number, not the animation. */}
      <span aria-hidden="true">{shown.toLocaleString("en-US")}</span>
      <span className="sr-only">{value.toLocaleString("en-US")}</span>
    </span>
  );
}

// Columns match the number of stats shown, so none sits alone on a row.
// (Full class names so Tailwind generates them.)
const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

export function StatsBar() {
  const { t } = useLocale();
  const { data, isLoading, isError } = useGetPublicStats({
    query: { queryKey: getGetPublicStatsQueryKey(), staleTime: 5 * 60 * 1000, retry: 1, refetchOnWindowFocus: false },
  });

  if (isError) return null;

  // A zero reads as "nothing happens here" on a landing page, so empty stats are left out.
  const items = data
    ? [
        { label: t.statEventsHeld, value: data.eventsHeld },
        { label: t.statTickets, value: data.ticketsBooked },
        { label: t.statUpcoming, value: data.upcomingEvents },
        { label: t.statCheckedIn, value: data.checkedIn },
      ].filter((i) => i.value > 0)
    : [];
  if (!isLoading && items.length === 0) return null;

  return (
    <section aria-label={t.statsLabel} className="border-b border-line bg-surface">
      <dl className={`mx-auto grid max-w-6xl px-4 sm:px-6 ${isLoading ? "grid-cols-2 lg:grid-cols-4" : GRID[items.length] ?? GRID[4]}`}>
        {isLoading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="px-2 py-7 sm:px-4">
                <div className="h-9 w-20 animate-pulse rounded bg-bg" />
                <div className="mt-2 h-4 w-28 animate-pulse rounded bg-bg" />
              </div>
            ))
          : items.map((i) => (
              <div key={i.label} className="flex flex-col-reverse px-2 py-7 sm:px-4">
                <dt className="mt-1 text-sm text-muted">{i.label}</dt>
                <dd className="text-2xl font-semibold tracking-tight min-[400px]:text-3xl sm:text-4xl">
                  <CountUp value={i.value} />
                </dd>
              </div>
            ))}
      </dl>
    </section>
  );
}
