import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";

export function CtaBand() {
  const { t } = useLocale();
  const sectionLink = useSectionLink();

  return (
    <section aria-labelledby="cta-title" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="overflow-hidden rounded-2xl bg-panel text-white">
        <div className="flex flex-col gap-6 px-6 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-12 sm:py-14">
          <div className="max-w-xl">
            <h2 id="cta-title" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t.ctaTitle}
            </h2>
            <p className="mt-2 text-white/70">{t.ctaBody}</p>
          </div>
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-md bg-copper px-6 text-base font-semibold text-on-copper transition-colors hover:bg-sand"
          >
            {t.browseEvents}
          </a>
        </div>
        <div className="h-12 bg-[url('/brand/pattern.svg')] bg-[length:auto_100%] bg-repeat-x" aria-hidden="true" />
      </div>
    </section>
  );
}
