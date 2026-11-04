import { PhoneCall, QrCode, Search, UserRound } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { SectionHeader } from "./SectionHeader";

const ICONS = [Search, UserRound, PhoneCall, QrCode];

export function HowItWorks() {
  const { t } = useLocale();

  return (
    <section id="how" aria-labelledby="how-title" className="mt-20 border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeader id="how-title" title={t.navHow} sub={t.howSub} />

        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {t.howSteps.map((step, i) => {
            const Icon = ICONS[i] ?? Search;
            return (
              <li key={step.title} className="relative">
                {/* connector to the next step (desktop) */}
                {i < t.howSteps.length - 1 && (
                  <span className="absolute start-14 end-0 top-6 hidden border-t border-dashed border-line-strong lg:block" aria-hidden="true" />
                )}
                <div className="relative flex size-12 items-center justify-center rounded-full border border-line-strong bg-surface text-ink">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  <span className="absolute -end-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
