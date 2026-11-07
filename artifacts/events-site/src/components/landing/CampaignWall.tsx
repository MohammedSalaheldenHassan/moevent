import { useLocale } from "@/lib/i18n";
import { MotifBand } from "./Motif";

const POSTERS = Array.from({ length: 8 }, (_, i) => `/brand/campaign/poster-${i + 1}.webp`);

/** The campaign posters, drifting past like a wall of flyers. */
export function CampaignWall() {
  const { t } = useLocale();
  return (
    <section aria-labelledby="wall-title" className="overflow-hidden bg-[#fef9ef] pt-20 sm:pt-24">
      <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
        <h2 id="wall-title" className="font-[family-name:var(--font-display)] text-4xl font-extrabold tracking-tight text-[#001f3b] sm:text-5xl">
          {t.wallTitle}
        </h2>
        <p className="mt-2 text-[#586a7d]">{t.wallSub}</p>
      </div>
      <div className="marquee mt-10 pb-14">
        <div className="marquee-track flex w-max gap-5" style={{ ["--speed" as string]: "70s" }}>
          {[0, 1].map((copy) =>
            POSTERS.map((src, i) => (
              <img
                key={`${copy}-${i}`}
                src={src}
                alt={copy === 0 ? t.wallPoster(i + 1) : ""}
                aria-hidden={copy === 1 || undefined}
                width={520}
                height={i === 7 ? 520 : 650}
                loading="lazy"
                className={`h-64 w-auto shrink-0 rounded-2xl object-cover shadow-[0_20px_40px_-24px_rgba(0,31,59,0.6)] sm:h-80 ${i % 2 ? "rotate-[1.5deg]" : "-rotate-[1.5deg]"}`}
              />
            )),
          )}
        </div>
      </div>
      <MotifBand height={44} />
    </section>
  );
}
