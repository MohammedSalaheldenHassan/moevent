import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import type { PublicEvent } from "@/lib/events";

const pad = (n: number) => String(n).padStart(2, "0");

/** Live countdown to the next event (its date, start of day local time). */
export function Countdown({ event }: { event: PublicEvent }) {
  const { t } = useLocale();
  const target = (() => {
    const d = new Date(event.event_date!);
    // Dates are calendar days stored at UTC midnight; count to that day locally.
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
  })();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, target - now);
  if (left === 0) {
    return <p className="rise text-lg font-semibold text-[#f3a25a]" style={{ ["--d" as string]: 700 }}>{t.countdownToday}</p>;
  }
  const units = [
    { k: "d", v: Math.floor(left / 864e5) },
    { k: "h", v: Math.floor(left / 36e5) % 24 },
    { k: "m", v: Math.floor(left / 6e4) % 60 },
    { k: "s", v: Math.floor(left / 1e3) % 60 },
  ] as const;

  return (
    <div className="rise" style={{ ["--d" as string]: 700 }}>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{t.countdownTitle(event.title)}</p>
      <div dir="ltr" className="mt-3 flex justify-center gap-2 sm:gap-3" role="timer" aria-live="off">
        {units.map((u) => (
          <div key={u.k} className="w-[4.25rem] rounded-xl border border-white/10 bg-white/[0.06] px-2 py-2.5 backdrop-blur-sm sm:w-20">
            <span className="block text-2xl font-bold tabular-nums text-white sm:text-3xl">{u.k === "d" ? u.v : pad(u.v)}</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/55 sm:text-[11px]">{t.countdownUnits[u.k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
