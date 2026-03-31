import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";

const SUPABASE_URL = "https://lzkitwefaxolgnuwdvuk.supabase.co";
const DAYS_GRACE = 3;

function getAdminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(SUPABASE_URL, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function deleteExpiredEvents(): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_GRACE);
  const cutoffIso = cutoff.toISOString();

  logger.info({ cutoff: cutoffIso }, "[cleanup] Starting expired-event sweep");

  try {
    const supabase = getAdminClient();

    // Fetch the events that qualify so we can log their titles
    const { data: expired, error: fetchErr } = await supabase
      .from("events")
      .select("id, title, event_date")
      .lt("event_date", cutoffIso);

    if (fetchErr) {
      logger.error({ err: fetchErr.message }, "[cleanup] Failed to fetch expired events");
      return;
    }

    if (!expired || expired.length === 0) {
      logger.info("[cleanup] No expired events to delete");
      return;
    }

    const ids = expired.map((e: { id: string }) => e.id);
    logger.info({ count: ids.length, ids }, "[cleanup] Found expired events — deleting");

    // 1. Remove event_access rows (staff assignments)
    const { error: accessErr } = await supabase
      .from("event_access")
      .delete()
      .in("event_id", ids);
    if (accessErr) {
      logger.warn({ err: accessErr.message }, "[cleanup] Could not remove event_access rows (continuing)");
    }

    // 2. Remove tickets belonging to these events
    const { error: ticketErr, count: ticketCount } = await supabase
      .from("tickets")
      .delete()
      .in("event_id", ids)
      .select("id");
    if (ticketErr) {
      logger.warn({ err: ticketErr.message }, "[cleanup] Could not remove tickets (continuing)");
    } else {
      logger.info({ ticketCount }, "[cleanup] Deleted tickets");
    }

    // 3. Delete the events themselves
    const { error: eventErr } = await supabase
      .from("events")
      .delete()
      .in("id", ids);
    if (eventErr) {
      logger.error({ err: eventErr.message }, "[cleanup] Failed to delete events");
      return;
    }

    for (const ev of expired as { id: string; title: string; event_date: string }[]) {
      logger.info(
        { id: ev.id, title: ev.title, event_date: ev.event_date },
        `[cleanup] Deleted expired event: "${ev.title}"`
      );
    }
    logger.info({ deleted: ids.length }, "[cleanup] Sweep complete");
  } catch (err: unknown) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, "[cleanup] Unexpected error");
  }
}
