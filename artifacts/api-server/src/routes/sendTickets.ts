import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getMailer, sendTicketsEmail } from "../lib/ticketEmail";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const UUID = /^[0-9a-f-]{36}$/i;

interface TicketForEmail {
  id: string;
  customer_name: string | null;
  customer_email: string | null;
  attendee_type: string | null;
  created_at: string;
  event_id: string;
  events: { title?: string } | { title?: string }[] | null;
}

function getAdminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getSupabaseProjectUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseIds(body: unknown, max: number): string[] | null {
  const ids = (body as { ticketIds?: unknown } | undefined)?.ticketIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > max) return null;
  if (!ids.every((id) => typeof id === "string" && UUID.test(id))) return null;
  return [...new Set(ids as string[])];
}

/**
 * Admin route: emails the given tickets to the address stored on each ticket
 * (never one supplied by the caller), one message per booking (same email +
 * event). Tickets are marked emailed first; a failed send releases them so it
 * can be retried.
 */
async function emailTickets(ids: string[]): Promise<{ sent: number; failed: number }> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("id, customer_name, customer_email, attendee_type, created_at, event_id, events(title)")
    .in("id", ids);
  if (error) throw new Error(error.message);

  const candidates = ((data ?? []) as TicketForEmail[]).filter((t) => t.customer_email);
  if (candidates.length === 0) return { sent: 0, failed: 0 };

  // Admins may resend; the tickets are (re)marked as emailed.
  const { data: claimedRows, error: claimErr } = await supabase
    .from("tickets")
    .update({ is_emailed: true })
    .in("id", candidates.map((t) => t.id))
    .select("id");
  if (claimErr) throw new Error(claimErr.message);
  const claimed = new Set((claimedRows ?? []).map((r: { id: string }) => r.id));

  const groups = new Map<string, TicketForEmail[]>();
  for (const t of candidates.filter((c) => claimed.has(c.id))) {
    const key = `${t.customer_email!.toLowerCase()}|${t.event_id}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }

  let sent = 0;
  let failed = 0;
  for (const tickets of groups.values()) {
    const first = tickets[0]!;
    const rel = first.events;
    const eventName = String((Array.isArray(rel) ? rel[0]?.title : rel?.title) ?? "Event");
    try {
      await sendTicketsEmail({
        to: first.customer_email!,
        customerName: String(first.customer_name ?? ""),
        eventName,
        ticketIds: tickets.map((t) => t.id),
      });
      sent += tickets.length;
    } catch (err) {
      failed += tickets.length;
      logger.warn({ err: err instanceof Error ? err.message : err }, "[send-tickets] email delivery failed");
      await supabase.from("tickets").update({ is_emailed: false }).in("id", tickets.map((t) => t.id));
    }
  }
  return { sent, failed };
}

async function handle(max: number, body: unknown, res: import("express").Response) {
  const ids = parseIds(body, max);
  if (!ids) {
    res.status(400).json({ error: `ticketIds must be 1–${max} ticket ids` });
    return;
  }
  if (!getMailer()) {
    res.status(503).json({ error: "Email sending is not configured on the server" });
    return;
  }
  try {
    const result = await emailTickets(ids);
    if (result.sent === 0 && result.failed === 0) {
      res.status(409).json({ error: "No tickets to send", ...result });
      return;
    }
    res.status(result.failed > 0 ? 502 : 200).json(result);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "[send-tickets] unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
}

// Dashboard, e.g. after approving an organization request.
router.post("/tickets/send-email", requireAdmin, (req, res) => handle(1000, req.body, res));

export default router;
