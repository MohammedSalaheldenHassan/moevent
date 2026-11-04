import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { sendTicketsEmail } from "@/lib/sendTicketsEmail";
import { logActivity } from "@/lib/activityLogger";
import { Button } from "@/components/ui/button";
import { Building2, Check, CheckCircle2, ExternalLink, Inbox, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookingRequest {
  id: string;
  event_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  company_url: string;
  quantity: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  events: { title: string } | { title: string }[] | null;
}

const STATUS = {
  pending: { en: "Awaiting approval", ar: "بانتظار الموافقة", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  approved: { en: "Approved", ar: "تمت الموافقة", cls: "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400" },
  rejected: { en: "Rejected", ar: "مرفوض", cls: "bg-muted text-muted-foreground" },
} as const;

const eventTitle = (r: BookingRequest) => (Array.isArray(r.events) ? r.events[0]?.title : r.events?.title) ?? "";

/**
 * Organization booking requests from the public site. Approving runs
 * approve_booking_request() (creates the tickets in one database step, checks
 * seats), then emails the new tickets to the requester. Until approval no
 * ticket (and no QR) exists.
 *
 * With `eventId` it lists that event's requests; without, every event's
 * (the Requests page), showing which event each is for.
 */
export function BookingRequestsPanel({
  eventId,
  isAr,
  userEmail,
  onTicketsCreated,
  onPendingCount,
}: {
  eventId?: string;
  isAr: boolean;
  userEmail?: string;
  onTicketsCreated?: () => void;
  onPendingCount?: (n: number) => void;
}) {
  const [requests, setRequests] = useState<BookingRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase
      .from("booking_requests")
      .select("id, event_id, customer_name, customer_phone, customer_email, company_url, quantity, status, created_at, events(title)")
      .order("created_at", { ascending: false });
    if (eventId) q = q.eq("event_id", eventId);
    const { data, error } = await q;
    if (error) {
      setError(error.message);
      return;
    }
    const rows = (data ?? []) as BookingRequest[];
    setRequests(rows);
    onPendingCount?.(rows.filter((r) => r.status === "pending").length);
  }, [eventId, onPendingCount]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (r: BookingRequest) => {
    setBusy(r.id);
    setError(null);
    setNotice(null);
    const { error } = await supabase.rpc("approve_booking_request", { p_request_id: r.id });
    if (error) {
      setBusy(null);
      setError(error.message);
      return;
    }
    logActivity("ticket_issued", `${r.customer_name} (${r.quantity}) — ${eventTitle(r)} · approved organization request`, userEmail);

    // Send the new tickets straight to the requester.
    const { data: created } = await supabase.from("tickets").select("id").eq("booking_request_id", r.id);
    const ids = (created ?? []).map((t: { id: string }) => t.id);
    const result = ids.length ? await sendTicketsEmail(ids) : { ok: false, message: "no tickets found" };
    setBusy(null);
    if (result.ok) {
      setNotice(
        isAr
          ? `تمت الموافقة. أُرسلت ${ids.length} تذاكر إلى ${r.customer_email}.`
          : `Approved. ${ids.length} ticket${ids.length === 1 ? "" : "s"} emailed to ${r.customer_email}.`,
      );
    } else {
      setError(
        isAr
          ? `تمت الموافقة وأُنشئت التذاكر، لكن تعذّر إرسال البريد (${result.message}). يمكنك إرسالها من صفحة الفعالية.`
          : `Approved and tickets created, but the email failed (${result.message}). You can send them from the event page.`,
      );
    }
    await load();
    onTicketsCreated?.();
  };

  const reject = async (r: BookingRequest) => {
    setBusy(r.id);
    setError(null);
    setNotice(null);
    const { error } = await supabase.rpc("reject_booking_request", { p_request_id: r.id });
    setBusy(null);
    setConfirmReject(null);
    if (error) setError(error.message);
    else await load();
  };

  if (requests === null && !error) {
    return eventId ? null : (
      <div className="flex justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  // On an event page, stay out of the way when there's nothing to review.
  if (eventId && (requests?.length ?? 0) === 0 && !error) return null;

  const all = requests ?? [];
  const pending = all.filter((r) => r.status === "pending");
  const ordered = [...pending, ...all.filter((r) => r.status !== "pending")];
  const host = (url: string) => url.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <section className="bg-card border border-card-border rounded-lg overflow-hidden" aria-labelledby="requests-heading">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
        <h2 id="requests-heading" className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4 text-muted-foreground" />
          {isAr ? "طلبات المؤسسات" : "Organization requests"}
        </h2>
        {pending.length > 0 && (
          <span className="text-xs font-medium rounded px-2 py-0.5 bg-amber-500/10 text-amber-700 dark:text-amber-400 tabular-nums">
            {pending.length} {isAr ? "بانتظار المراجعة" : "to review"}
          </span>
        )}
      </div>

      {error && (
        <p role="alert" className="mx-5 mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mx-5 mt-4 flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {notice}
        </p>
      )}

      {ordered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
          <Inbox className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">{isAr ? "لا توجد طلبات بعد" : "No requests yet"}</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {isAr
              ? "عندما تحجز مؤسسة من الموقع العام، يظهر طلبها هنا للموافقة."
              : "When an organization books on the public site, its request shows up here for approval."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {ordered.map((r) => {
            const s = STATUS[r.status];
            return (
              <li key={r.id} className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-1">
                  {!eventId && (
                    <Link href={`/events/${r.event_id}`} className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline">
                      {eventTitle(r)}
                    </Link>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{r.customer_name}</p>
                    <span className={cn("text-[11px] font-medium rounded px-1.5 py-px", s.cls)}>{isAr ? s.ar : s.en}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {r.quantity} {isAr ? "تذاكر" : r.quantity === 1 ? "ticket" : "tickets"}
                    </span>
                  </div>
                  <a
                    href={r.company_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline break-all"
                  >
                    {host(r.company_url)}
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  <p dir="ltr" className="text-xs text-muted-foreground text-start break-all">
                    {r.customer_email} · {r.customer_phone}
                  </p>
                </div>

                {r.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {confirmReject === r.id ? (
                      <>
                        <span className="text-xs text-muted-foreground">{isAr ? "رفض الطلب؟" : "Reject request?"}</span>
                        <Button size="sm" variant="destructive" disabled={busy === r.id} onClick={() => reject(r)}>
                          {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          {isAr ? "رفض" : "Reject"}
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => setConfirmReject(null)}>
                          {isAr ? "إلغاء" : "Cancel"}
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirmReject(r.id)}>
                          {isAr ? "رفض" : "Reject"}
                        </Button>
                        <Button size="sm" disabled={busy !== null} onClick={() => approve(r)}>
                          {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          {isAr ? `موافقة وإرسال ${r.quantity}` : `Approve & send ${r.quantity}`}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
