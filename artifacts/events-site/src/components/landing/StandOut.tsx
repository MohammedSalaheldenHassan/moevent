import { Check } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useReveal } from "@/hooks/useReveal";

/** "Learn how to Stand Out." over the campaign's crowd photo. */
export function StandOut() {
  const { t, isAr } = useLocale();
  const ref = useReveal<HTMLElement>(0.2);

  return (
    <section ref={ref} aria-labelledby="stand-title" className="relative isolate overflow-hidden bg-[#001f3b] text-white">
      <img
        src="/brand/crowd.webp"
        alt=""
        width={768}
        height={660}
        loading="lazy"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[70%_30%] rtl:-scale-x-100 sm:object-[center_30%]"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-[#001f3b] via-[#001f3b]/85 to-[#001f3b]/10 rtl:bg-gradient-to-l" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-[#001f3b] to-transparent" />

      <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <div className="reveal max-w-xl">
          <h2 id="stand-title" className="font-[family-name:var(--font-display)] font-extrabold tracking-tight">
            <span className="block text-3xl sm:text-4xl">{t.standTitleA}</span>
            <span className={`mt-1 block text-5xl text-[#e98c38] sm:text-7xl ${isAr ? "" : "italic"}`}>{t.standTitleB}</span>
          </h2>
          <svg viewBox="0 0 260 16" className="mt-3 h-3.5 w-56 text-[#e98c38] rtl:-scale-x-100" aria-hidden="true">
            <path d="M2 12 C 80 2, 180 2, 258 9" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </svg>
          <p className="mt-6 text-lg leading-relaxed text-white/75">{t.standBody}</p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {t.standPoints.map((p, i) => (
              <li
                key={p}
                className="reveal flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 font-semibold backdrop-blur-sm"
                style={{ ["--d" as string]: 250 + i * 120 }}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#e07b2e] text-[#001f3b]">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
