import { useLocale } from "@/lib/i18n";

function Tri() {
  return (
    <svg viewBox="0 0 20 18" className="size-3.5 shrink-0" aria-hidden="true">
      <path d="M10 0 20 18H0Z" fill="currentColor" />
    </svg>
  );
}

/** Orange band of the summit's promises, scrolling endlessly. */
export function Marquee() {
  const { t } = useLocale();
  const items = [...t.marquee, ...t.marquee];
  return (
    <div className="marquee overflow-hidden border-y border-[#001f3b]/10 bg-[#e07b2e] py-4 text-[#001f3b]" aria-label={t.marquee.join(" · ")}>
      <div className="marquee-track flex w-max" style={{ ["--speed" as string]: "45s" }} aria-hidden="true">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0 items-center">
            {items.map((w, i) => (
              <li key={`${copy}-${i}`} className="flex items-center gap-6 px-6 font-[family-name:var(--font-display)] text-xl font-extrabold uppercase tracking-wide sm:text-2xl">
                {w}
                <Tri />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
