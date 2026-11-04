import { useMemo } from "react";
import { ArrowDown, Check, Clock, PhoneCall, QrCode, ScanLine, Ticket } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";

/** Decorative QR-style pattern (not scannable): three finder squares plus seeded modules. */
function QrArt({ className = "" }: { className?: string }) {
  const cells = useMemo(() => {
    const n = 21;
    let h = 0x9e3779b9;
    const rand = () => {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      return ((h >>> 0) % 1000) / 1000;
    };
    const inFinder = (x: number, y: number) => (x < 8 && y < 8) || (x >= n - 8 && y < 8) || (x < 8 && y >= n - 8);
    const out: [number, number][] = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!inFinder(x, y) && rand() > 0.52) out.push([x, y]);
    return out;
  }, []);

  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" fill="currentColor" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" fill="currentColor" />
    </g>
  );

  return (
    <svg viewBox="0 0 21 21" className={className} shapeRendering="crispEdges" aria-hidden="true">
      <rect width="21" height="21" fill="#fff" />
      {finder(0, 0)}
      {finder(14, 0)}
      {finder(0, 14)}
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

/**
 * Brand visual: the MoEvent booking flow (reserve → confirm → check in) on a
 * branded panel, with the pass it ends in. Illustrative only — no live data.
 */
function SystemVisual() {
  const { t } = useLocale();
  const icons = [Ticket, PhoneCall, ScanLine];

  return (
    <div className="relative mx-auto w-full max-w-md pt-6 pb-8" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl bg-panel text-white shadow-[0_30px_60px_-30px_rgba(17,17,17,0.6)] ring-1 ring-white/5">
        <div className="h-1.5 bg-accent" />

        <div className="flex items-center justify-between px-6 pt-5">
          <span dir="ltr" className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="size-7">
              <rect width="32" height="32" rx="6" fill="var(--color-accent)" />
              <path d="M9 22V10h2.6l4.4 6.2 4.4-6.2H23v12h-2.6v-7.6L16 20.4l-4.4-6V22z" fill="#fff" />
            </svg>
            <span className="text-[17px] font-semibold tracking-tight">MoEvent</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80">
            <span className="size-1.5 rounded-full bg-[#3fcf83]" />
            {t.heroLive}
          </span>
        </div>

        <p className="px-6 pt-5 text-xs font-medium uppercase tracking-widest text-white/45">{t.heroPanelLabel}</p>

        <ol className="relative px-6 pb-6 pt-3">
          {/* vertical connector behind the step icons */}
          <span className="absolute bottom-12 start-[2.6rem] top-8 border-s border-dashed border-white/20" />
          {t.flow.map((step, i) => {
            const Icon = icons[i] ?? Ticket;
            const done = i < t.flow.length - 1;
            return (
              <li key={step.title} className="relative flex items-center gap-4 py-2.5">
                <span
                  className={`relative flex size-10 shrink-0 items-center justify-center rounded-full ${
                    done ? "bg-white/10 text-white" : "bg-accent text-white"
                  }`}
                >
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{step.title}</p>
                  <p className="truncate text-sm text-white/55">{step.sub}</p>
                </div>
                <Check className={`size-4 shrink-0 ${done ? "text-white/40" : "text-[#3fcf83]"}`} />
              </li>
            );
          })}
        </ol>

        {/* the pass */}
        <div className="relative">
          <div className="mx-5 border-t-2 border-dashed border-white/15" />
          <span className="absolute -start-3 -top-3 size-6 rounded-full bg-surface" />
          <span className="absolute -end-3 -top-3 size-6 rounded-full bg-surface" />
        </div>
        <div className="flex items-center gap-4 px-6 py-5">
          <div className="rounded-md bg-white p-1.5 text-[#111]">
            <QrArt className="size-16" />
          </div>
          <div>
            <p className="font-medium">{t.heroPass}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-white/55">
              <QrCode className="size-3.5" />
              {t.heroScan}
            </p>
          </div>
        </div>
      </div>

      {/* floating benefit chips */}
      <div className="absolute end-0 top-0 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium shadow-lg xl:-end-6">
        <span className="flex size-6 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {t.chipNoAccount}
      </div>
      <div className="absolute bottom-0 start-0 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium shadow-lg xl:-start-6">
        <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Clock className="size-3.5" strokeWidth={2.5} />
        </span>
        {t.chipFast}
      </div>
    </div>
  );
}

export function Hero() {
  const { t } = useLocale();
  const sectionLink = useSectionLink();

  return (
    <section aria-labelledby="hero-title" className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-bg px-3 py-1 text-xs font-medium text-ink-soft">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            {t.heroEyebrow}
          </p>
          <h1 id="hero-title" className="mt-5 text-[2rem] min-[400px]:text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
            {t.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.heroSub}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/#events"
              onClick={sectionLink("events")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              {t.browseEvents}
              <ArrowDown className="size-4" aria-hidden="true" />
            </a>
            <a
              href="/#how"
              onClick={sectionLink("how")}
              className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-6 text-base font-semibold text-ink transition-colors hover:border-ink"
            >
              {t.heroHow}
            </a>
          </div>
        </div>

        <SystemVisual />
      </div>
    </section>
  );
}
