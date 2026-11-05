import { summarizeTypes, ticketTheme, typeLabel, type EventCapacities, type TicketKind } from "@/lib/ticketThemes";

/** How many tickets of each type an event has, against the limits set for it. */
export function TicketTypeBreakdown({
  tickets,
  event,
  isAr,
}: {
  tickets: { attendee_type: TicketKind | null; is_scanned: boolean | null }[];
  event: EventCapacities;
  isAr: boolean;
}) {
  const { rows, total, scanned } = summarizeTypes(tickets, event);
  const lang = isAr ? "ar" : "en";

  return (
    <section className="bg-card border border-card-border rounded-lg overflow-hidden" aria-labelledby="types-heading">
      <div className="px-5 py-4 border-b border-border">
        <h2 id="types-heading" className="text-sm font-semibold text-foreground">
          {isAr ? "التذاكر حسب النوع" : "Tickets by type"}
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border bg-muted/40">
              <th className="text-start font-medium px-5 py-2.5">{isAr ? "النوع" : "Type"}</th>
              <th className="text-end font-medium px-3 py-2.5">{isAr ? "العدد" : "Tickets"}</th>
              <th className="text-start font-medium px-3 py-2.5 min-w-40">{isAr ? "من السعة" : "Of capacity"}</th>
              <th className="text-end font-medium px-3 py-2.5">{isAr ? "المتبقي" : "Left"}</th>
              <th className="text-end font-medium px-5 py-2.5">{isAr ? "دخلوا" : "Checked in"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const th = ticketTheme(r.type);
              const pct = r.capacity ? Math.min(100, Math.round((r.total / r.capacity) * 100)) : null;
              return (
                <tr key={r.type ?? "none"}>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
                      style={r.type ? { background: th.soft, color: th.text } : undefined}
                    >
                      {typeLabel(r.type, lang)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-end font-semibold text-foreground tabular-nums">{r.total}</td>
                  <td className="px-3 py-3">
                    {r.capacity != null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: th.dark2 }} />
                        </div>
                        <span dir="ltr" className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                          {r.total} / {r.capacity}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">{isAr ? "بدون حد" : "No limit"}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-end text-muted-foreground tabular-nums">{r.left ?? "—"}</td>
                  <td className="px-5 py-3 text-end text-muted-foreground tabular-nums">{r.scanned}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/40 font-semibold text-foreground">
              <td className="px-5 py-2.5">{isAr ? "الإجمالي" : "Total"}</td>
              <td className="px-3 py-2.5 text-end tabular-nums">{total}</td>
              <td className="px-3 py-2.5" />
              <td className="px-3 py-2.5" />
              <td className="px-5 py-2.5 text-end tabular-nums">{scanned}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
