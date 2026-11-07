import { Ticket } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";
import { useReveal } from "@/hooks/useReveal";

/** Closing call: "What are you waiting for? Grab a seat." with the orange-chair photo. */
export function CtaBand() {
  const { t, isAr } = useLocale();
  const sectionLink = useSectionLink();
  const ref = useReveal<HTMLElement>(0.25);

  return (
    <section ref={ref} aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="reveal grid overflow-hidden rounded-[28px] bg-[#001f3b] text-white md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-12 sm:py-16">
          <p className={`text-[#f3a25a] ${isAr ? "text-lg font-semibold" : "text-lg italic"}`}>{t.ctaKicker}</p>
          <h2
            id="cta-title"
            className={`mt-2 font-[family-name:var(--font-display)] font-black leading-[0.95] ${isAr ? "text-6xl sm:text-7xl" : "text-6xl uppercase tracking-tight sm:text-8xl"}`}
          >
            {t.ctaBig}
          </h2>
          <p className="mt-5 max-w-sm text-white/70">{t.ctaBody}</p>
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="group mt-8 inline-flex h-13 w-fit items-center gap-2 rounded-full bg-[#e07b2e] px-7 text-base font-bold text-[#001f3b] transition-all hover:-translate-y-0.5 hover:bg-[#ee8f45]"
          >
            <Ticket className="size-5 transition-transform group-hover:-rotate-12" aria-hidden="true" />
            {t.browseEvents}
          </a>
        </div>
        <img
          src="/brand/grab-a-seat.webp"
          alt=""
          width={1000}
          height={1000}
          loading="lazy"
          className="h-72 w-full object-cover md:h-full"
        />
      </div>
    </section>
  );
}
