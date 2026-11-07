import { ArrowRight } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useSectionLink } from "@/lib/sections";
import { useReveal } from "@/hooks/useReveal";

/** "A seat at that table": the campaign's boardroom photo with one empty chair, yours. */
export function TableSection() {
  const { t, isAr } = useLocale();
  const sectionLink = useSectionLink();
  const ref = useReveal<HTMLElement>(0.2);

  return (
    <section ref={ref} aria-labelledby="table-title" className="relative overflow-hidden bg-[#f3e2cf]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-20">
        <div className="reveal order-2 lg:order-1">
          <p className="text-sm font-semibold text-[#a8521a]">{t.tableEyebrow}</p>
          <h2 id="table-title" className="mt-3 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.12] tracking-tight text-[#001f3b] sm:text-5xl">
            <span className="block text-2xl font-semibold sm:text-3xl">{t.tableTitleA}</span>
            <span className={`block ${isAr ? "" : "italic"}`}>{t.tableTitleB}</span>
          </h2>
          <span className="mt-5 block h-1.5 w-20 rounded-full bg-[#e07b2e]" aria-hidden="true" />
          <p className="mt-6 max-w-md text-lg leading-relaxed text-[#283f58]">{t.tableBody}</p>
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-[#001f3b] px-6 font-bold text-white transition-colors hover:bg-[#0a3360]"
          >
            {t.grabSeat}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 rtl:-scale-x-100 rtl:group-hover:-translate-x-1" aria-hidden="true" />
          </a>
        </div>

        <div className="reveal relative order-1 mx-auto w-full max-w-[420px] lg:order-2" style={{ ["--d" as string]: 120 }}>
          <img
            src="/brand/table.webp"
            alt=""
            width={1122}
            height={1402}
            loading="lazy"
            className="w-full rounded-[28px] shadow-[0_40px_80px_-40px_rgba(0,31,59,0.55)]"
          />
          {/* The empty chair, left side, third from the top. */}
          <div className="absolute left-[15%] top-[51%] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
            <span className="seat-ping absolute inset-0 rounded-full bg-[#e07b2e]/60" />
            <span className="relative block size-16 rounded-full border-[3px] border-[#e07b2e] bg-[#e07b2e]/15 sm:size-20" />
          </div>
          <div dir="ltr" className="absolute left-[15%] top-[51%] ml-11 -translate-y-1/2 sm:ml-13">
            <span className="relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-[#e07b2e] px-3 py-1.5 text-sm font-bold text-[#001f3b] shadow-lg">
              <span aria-hidden="true">←</span>
              {t.yourSeat}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
