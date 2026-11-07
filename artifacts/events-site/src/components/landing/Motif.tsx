/** The Sudanese triangle motif from the brand, repeated as a border band. */
export function MotifBand({ className = "", height = 56 }: { className?: string; height?: number }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-repeat-x bg-bottom ${className}`}
      style={{ height, backgroundImage: "url(/brand/motif.png)", backgroundSize: `auto ${height}px` }}
    />
  );
}
