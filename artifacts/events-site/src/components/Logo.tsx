export function Wordmark({ tone = "ink" }: { tone?: "ink" | "light" }) {
  return (
    // The brand name stays Latin and left-to-right in both languages.
    <span dir="ltr" className="flex items-center gap-2">
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="var(--color-accent)" />
        <path d="M9 22V10h2.6l4.4 6.2 4.4-6.2H23v12h-2.6v-7.6L16 20.4l-4.4-6V22z" fill="#fff" />
      </svg>
      <span className={`text-[17px] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>MoEvent</span>
    </span>
  );
}
