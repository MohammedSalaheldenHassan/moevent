import type { ReactNode } from "react";

export function SectionHeader({
  id,
  eyebrow,
  title,
  sub,
  action,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-sm font-semibold text-accent">{eyebrow}</p>}
        <h2 id={id} className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h2>
        {sub && <p className="mt-2 text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
