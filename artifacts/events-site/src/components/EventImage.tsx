import { useState } from "react";
import { CalendarDays } from "lucide-react";

/**
 * Event cover that always fills its box (object-cover), with a neutral
 * placeholder when there is no image or it fails to load. Size the box with
 * className (e.g. an aspect ratio plus a width).
 */
export function EventImage({
  src,
  alt = "",
  className = "",
  eager = false,
}: {
  src: string | null;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-placeholder ${className}`}>
      {!src || failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-line-strong" role={alt ? "img" : undefined} aria-label={alt || undefined}>
          <CalendarDays className="size-8" strokeWidth={1.5} aria-hidden="true" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </div>
  );
}
