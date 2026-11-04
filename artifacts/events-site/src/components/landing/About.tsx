import { PhoneCall, QrCode, UserRoundCheck, Zap } from "lucide-react";
import { useLocale } from "@/lib/i18n";

const ICONS = [UserRoundCheck, PhoneCall, QrCode, Zap];

export function About() {
  const { t } = useLocale();

  return (
    <section id="about" aria-labelledby="about-title" className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <div>
          <p className="text-sm font-semibold text-accent">{t.aboutEyebrow}</p>
          <h2 id="about-title" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {t.aboutTitle}
          </h2>
          <p className="mt-4 leading-relaxed text-muted">{t.aboutBody}</p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {t.aboutFeatures.map((f, i) => {
            const Icon = ICONS[i] ?? Zap;
            return (
              <li key={f.title} className="rounded-xl border border-line bg-surface p-5">
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
