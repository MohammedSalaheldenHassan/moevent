import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";

export function CtaBand() {
  const { t } = useLocale();
  const sectionLink = useSectionLink();

  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl bg-panel px-6 py-12 text-white sm:px-12 sm:py-14">
        <div className="absolute inset-y-0 start-0 w-1.5 bg-accent" aria-hidden="true" />
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 id="cta-title" className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {t.ctaTitle}
            </h2>
            <p className="mt-2 text-white/65">{t.ctaBody}</p>
          </div>
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-md bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            {t.browseEvents}
          </a>
        </div>
      </div>
    </section>
  );
}
