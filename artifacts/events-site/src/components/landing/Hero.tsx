import { ArrowDown, Check, Clock, QrCode } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";
import { BrandMark } from "@/components/Logo";

/** Brand visual: the Meroë pyramids (Sudanese roots) with the pass you end up with. */
function BrandVisual() {
  const { t } = useLocale();

  return (
    <div className="relative mx-auto w-full max-w-lg pb-8 pt-6" aria-hidden="true">
      <img
        src="/brand/pyramids.webp"
        alt=""
        width={1135}
        height={664}
        className="aspect-[4/3] w-full rounded-2xl object-cover object-[70%_center] shadow-[0_30px_60px_-30px_rgba(14,42,74,0.6)] rtl:-scale-x-100"
      />

      <div className="absolute bottom-0 end-3 flex w-[min(17rem,78%)] items-center gap-3 rounded-xl bg-panel p-3 text-white shadow-xl ring-1 ring-white/10 sm:end-5">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-white p-2">
          <QrCode className="size-full text-[#0e2a4a]" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <BrandMark tone="light" className="mb-1 h-4 w-auto" />
          <span className="block truncate text-sm font-semibold">{t.heroPass}</span>
          <span className="block truncate text-xs text-white/65">{t.heroScan}</span>
        </span>
      </div>

      <div className="absolute start-3 top-0 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium shadow-lg sm:start-5">
        <span className="flex size-6 items-center justify-center rounded-full bg-ok-soft text-ok">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
        {t.chipNoAccount}
      </div>
      <div className="absolute bottom-24 start-3 hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium shadow-lg min-[480px]:flex sm:start-5">
        <span className="flex size-6 items-center justify-center rounded-full bg-copper-soft text-copper-ink">
          <Clock className="size-3.5" strokeWidth={2.5} />
        </span>
        {t.chipFast}
      </div>
    </div>
  );
}

export function Hero() {
  const { t, isAr } = useLocale();
  const sectionLink = useSectionLink();

  return (
    <section aria-labelledby="hero-title" className="border-b border-line bg-surface">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14 lg:py-20">
        <div>
          <p className={`text-xs font-semibold text-copper-ink sm:text-sm ${isAr ? "" : "uppercase tracking-[0.2em]"}`}>{t.heroEyebrow}</p>
          <span className="mt-3 block h-1 w-12 rounded-full bg-copper" aria-hidden="true" />
          <h1 id="hero-title" className="mt-5 text-[2rem] font-bold leading-[1.1] tracking-tight min-[400px]:text-4xl sm:text-5xl lg:text-[3.4rem]">
            {t.heroTitle}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">{t.heroSub}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/#events"
              onClick={sectionLink("events")}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-accent px-6 text-base font-semibold text-on-accent transition-colors hover:bg-accent-hover"
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

        <BrandVisual />
      </div>
    </section>
  );
}
