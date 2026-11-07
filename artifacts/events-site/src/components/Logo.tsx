/**
 * The Nexus Youth logo: the mark (from the brand files) and the two-line
 * wordmark. `tone="auto"` follows the site theme; "light" is for dark panels.
 */
export function BrandMark({ className = "", tone = "auto" }: { className?: string; tone?: "auto" | "ink" | "light" }) {
  if (tone === "light") return <img src="/brand/mark-light.png" alt="" width={640} height={384} className={className} />;
  if (tone === "ink") return <img src="/brand/mark.png" alt="" width={640} height={384} className={className} />;
  return (
    <span className="logo-auto contents">
      <img src="/brand/mark.png" alt="" width={640} height={384} className={`logo-on-light ${className}`} />
      <img src="/brand/mark-light.png" alt="" width={640} height={384} className={`logo-on-dark ${className}`} />
    </span>
  );
}

export function Wordmark({ tone = "auto", size = "md" }: { tone?: "auto" | "ink" | "light"; size?: "md" | "lg" }) {
  const text = tone === "light" ? "text-white" : "text-ink";
  const big = size === "lg";
  return (
    // The brand name stays Latin and left-to-right in both languages.
    <span dir="ltr" className="flex items-center gap-2" aria-label="Nexus Youth">
      <BrandMark tone={tone} className={big ? "h-12 w-auto" : "h-7 w-auto sm:h-8"} />
      <span className={`${big ? "text-[26px]" : "text-[15px] sm:text-base"} leading-[0.95] ${text}`} style={{ fontFamily: '"Montserrat Variable", sans-serif' }}>
        <span className="block font-bold tracking-tight">Nexus</span>
        <span className="block font-medium">Youth</span>
      </span>
    </span>
  );
}
