import { Briefcase, Flag, Lightbulb, Users } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useReveal } from "@/hooks/useReveal";

const ICONS = [Lightbulb, Users, Briefcase, Flag];
// Waypoints along the route, in the SVG's 400×520 box.
const STOPS = [
  { x: 70, y: 470 },
  { x: 300, y: 360 },
  { x: 110, y: 220 },
  { x: 320, y: 70 },
];
const ROUTE = "M70 470 C 160 470, 300 440, 300 360 S 110 300, 110 220 S 300 150, 320 70";

/** "Feeling lost? Let us hand you a map." The route draws itself on scroll. */
export function MapSection() {
  const { t, isAr } = useLocale();
  const ref = useReveal<HTMLElement>(0.25);

  return (
    <section id="about" ref={ref} aria-labelledby="map-title" className="relative overflow-hidden bg-[#001f3b] text-white">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div className="reveal">
          <p className="text-sm font-semibold text-[#f3a25a]">{t.mapEyebrow}</p>
          <h2 id="map-title" className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            {t.mapTitleA}{" "}
            <span className={`text-[#e98c38] ${isAr ? "" : "italic"}`}>{t.mapTitleB}</span>
          </h2>
          <svg viewBox="0 0 220 14" className="mt-3 h-3 w-44 text-[#e98c38] rtl:-scale-x-100" aria-hidden="true">
            <path d="M2 10 C 60 2, 140 2, 218 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-white/70">{t.mapBody}</p>

          <ol className="mt-8 space-y-4">
            {t.mapStops.map((stop, i) => {
              const Icon = ICONS[i] ?? Flag;
              return (
                <li key={stop.title} className="reveal flex gap-4" style={{ ["--d" as string]: 300 + i * 140 }}>
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-[#f3a25a] ring-1 ring-white/10">
                    <Icon className="size-5" strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-bold">
                      <span className="me-2 text-[#e98c38] tabular-nums">0{i + 1}</span>
                      {stop.title}
                    </p>
                    <p className="mt-0.5 text-sm text-white/60">{stop.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        {/* The map itself: a folded sheet with the route on it. */}
        <div className="reveal relative mx-auto w-full max-w-md" style={{ ["--d" as string]: 150 }} aria-hidden="true">
          <div className="relative rotate-[-2deg] overflow-hidden rounded-2xl bg-[#fef9ef] p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]">
            <div className="absolute inset-y-0 left-1/3 w-px bg-[#001f3b]/10" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-[#001f3b]/10" />
            <div className="absolute inset-y-0 left-1/3 w-1/3 bg-[#001f3b]/[0.03]" />
            <svg viewBox="0 0 400 520" className="relative w-full">
              <defs>
                <mask id="route-mask">
                  <path className="route-draw" pathLength={1} d={ROUTE} fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
                </mask>
              </defs>
              <path d={ROUTE} fill="none" stroke="#001f3b" strokeOpacity="0.12" strokeWidth="5" strokeDasharray="2 12" strokeLinecap="round" />
              <path d={ROUTE} fill="none" stroke="#e07b2e" strokeWidth="5" strokeDasharray="14 12" strokeLinecap="round" mask="url(#route-mask)" />
              {STOPS.map((p, i) => {
                const last = i === STOPS.length - 1;
                return (
                  <g key={i} className="waypoint" style={{ ["--d" as string]: 500 + i * 450 }}>
                    <circle cx={p.x} cy={p.y} r={last ? 26 : 20} fill={last ? "#e07b2e" : "#001f3b"} />
                    <circle cx={p.x} cy={p.y} r={last ? 34 : 27} fill="none" stroke={last ? "#e07b2e" : "#001f3b"} strokeOpacity=".25" strokeWidth="3" />
                    {last ? (
                      <path d={`M${p.x - 7} ${p.y + 11} V${p.y - 12} L${p.x + 11} ${p.y - 5} L${p.x - 7} ${p.y + 2}`} fill="#001f3b" />
                    ) : (
                      <text x={p.x} y={p.y + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill="#fef9ef" fontFamily="Montserrat Variable, sans-serif">
                        {i + 1}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          {/* The hand-drawn pin from the poster. */}
          <svg viewBox="0 0 40 52" className="absolute -end-2 -top-4 h-14 w-11 text-[#e07b2e] drop-shadow-lg">
            <path d="M20 2C10 2 3 9.5 3 19c0 12.5 17 31 17 31s17-18.5 17-31C37 9.5 30 2 20 2Z" fill="currentColor" />
            <circle cx="20" cy="19" r="6.5" fill="#001f3b" />
          </svg>
        </div>
      </div>
    </section>
  );
}
