/** The Nexus Youth mark: the N path over a pyramid, with the forward flag. */
export function BrandMark({ className = "", tone = "ink" }: { className?: string; tone?: "ink" | "light" }) {
  const fill = tone === "light" ? "#F8F6F2" : "var(--color-ink)";
  return (
    <svg viewBox="40 20 795 475" className={className} aria-hidden="true">
      <path fill={fill} d="M47 488 232 218C268 160 330 126 392 126 460 126 525 160 566 216 470 215 400 250 355 320L240 488Z" />
      <path fill={fill} d="M458 300C490 265 530 245 570 245 610 245 645 262 668 292L828 488H613Z" />
      <path fill="#C47A3F" d="M632 30 822 135 632 232Z" />
    </svg>
  );
}

export function Wordmark({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    // The brand name stays Latin and left-to-right in both languages.
    <span dir="ltr" className="flex items-center gap-2 sm:gap-2.5">
      <BrandMark tone={tone} className="h-8 w-auto" />
      <span className={`h-7 w-px max-[359px]:hidden ${tone === "light" ? "bg-white/25" : "bg-line-strong"}`} aria-hidden="true" />
      <span className={`text-[15px] leading-[1.02] ${tone === "light" ? "text-white" : "text-ink"}`}>
        <span className="block font-extrabold tracking-tight">Nexus</span>
        <span className="block font-normal">Youth</span>
      </span>
    </span>
  );
}
