import { useRef, type PointerEvent } from "react";
import { ArrowDown, Ticket } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { prefersReducedMotion, useSectionLink } from "@/lib/sections";
import type { PublicEvent } from "@/lib/events";
import { Countdown } from "./Countdown";

/**
 * Campaign hero: "Let us light your path". A flashlight at the bottom throws a
 * beam up behind the headline; on desktop a soft glow follows the pointer.
 */
export function Hero({ nextEvent }: { nextEvent: PublicEvent | null }) {
  const { t, isAr, formatDate } = useLocale();
  const sectionLink = useSectionLink();
  const ref = useRef<HTMLElement>(null);

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  return (
    <section
      ref={ref}
      onPointerMove={onMove}
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-[#001f3b] text-white"
    >
      {/* Faint blueprint grid, like the posters. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(ellipse at 50% 40%, #000 30%, transparent 75%)",
        }}
      />
      {/* Pointer glow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 hidden md:block"
        style={{ background: "radial-gradient(420px circle at var(--mx, 50%) var(--my, 30%), rgba(233,140,56,0.10), transparent 70%)" }}
      />
      {/* The beam. */}
      <div
        aria-hidden="true"
        className="beam-on pointer-events-none absolute inset-x-0 bottom-[150px] -z-10 mx-auto h-[85%] w-[min(1100px,140%)] sm:bottom-[190px]"
      >
        <div
          className="beam-breathe h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse 18% 100% at 50% 100%, rgba(255,236,200,0.55), rgba(255,214,150,0.18) 45%, transparent 75%), conic-gradient(from 180deg at 50% 100%, transparent 162deg, rgba(255,225,170,0.14) 172deg, rgba(255,235,195,0.26) 180deg, rgba(255,225,170,0.14) 188deg, transparent 198deg)",
          }}
        />
      </div>

      <div className="mx-auto flex min-h-[min(100svh,920px)] max-w-5xl flex-col items-center px-4 pb-[230px] pt-14 text-center sm:px-6 sm:pb-[290px] sm:pt-20">
        <p className="rise inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-white/85 sm:text-sm">
          <span className="size-1.5 rounded-full bg-[#e98c38]" aria-hidden="true" />
          {t.heroKicker}
          {nextEvent?.event_date && (
            <>
              <span className="text-white/35" aria-hidden="true">·</span>
              <span className="text-[#f3a25a]">{formatDate(nextEvent.event_date, "short")}</span>
            </>
          )}
        </p>

        <h1
          id="hero-title"
          className={`mt-6 font-[family-name:var(--font-display)] font-extrabold tracking-tight ${
            isAr ? "text-[3.4rem] leading-[1.25] min-[400px]:text-6xl sm:text-7xl lg:text-8xl" : "text-[2.9rem] leading-[1.02] min-[400px]:text-6xl sm:text-7xl lg:text-[6.2rem]"
          }`}
        >
          <span className="rise block text-[#fef9ef]" style={{ ["--d" as string]: 120 }}>{t.heroLine1}</span>
          <span
            className="rise block bg-gradient-to-b from-[#f3a25a] to-[#d5762c] bg-clip-text text-transparent"
            style={{ ["--d" as string]: 260 }}
          >
            {t.heroLine2}
          </span>
        </h1>

        <p className="rise mt-6 max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg" style={{ ["--d" as string]: 420 }}>
          {t.heroLead}
        </p>

        <div className="rise mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row" style={{ ["--d" as string]: 560 }}>
          <a
            href="/#events"
            onClick={sectionLink("events")}
            className="group inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#e07b2e] px-7 text-base font-bold text-[#001f3b] shadow-[0_10px_40px_-10px_rgba(233,140,56,0.8)] transition-all hover:-translate-y-0.5 hover:bg-[#ee8f45]"
          >
            <Ticket className="size-5 transition-transform group-hover:-rotate-12" aria-hidden="true" />
            {t.grabSeat}
          </a>
          <a
            href="/#how"
            onClick={sectionLink("how")}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-full border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/5"
          >
            {t.heroHow}
            <ArrowDown className="size-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-10">{nextEvent?.event_date && <Countdown event={nextEvent} />}</div>
      </div>

      {/* Flashlight + motif from the campaign, blended into the navy. */}
      <img
        src="/brand/flashlight.webp"
        alt=""
        width={1122}
        height={690}
        fetchPriority="high"
        className="pointer-events-none absolute bottom-0 left-1/2 -z-10 h-[300px] w-auto max-w-none -translate-x-1/2 sm:h-[380px]"
        style={{ maskImage: "linear-gradient(to top, #000 70%, transparent), linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)", maskComposite: "intersect" }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-[46px] bg-repeat-x sm:h-[58px]"
        style={{ backgroundImage: "url(/brand/motif.png)", backgroundSize: "auto 100%", backgroundPosition: "center bottom" }}
      />
    </section>
  );
}
