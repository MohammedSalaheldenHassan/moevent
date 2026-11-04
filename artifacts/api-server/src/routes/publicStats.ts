import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { GetPublicStatsResponse } from "@workspace/api-zod";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CACHE_MS = 5 * 60 * 1000;
let cache: { at: number; body: ReturnType<typeof GetPublicStatsResponse.parse> } | null = null;

function getAdminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getSupabaseProjectUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Counts only — no rows, no personal data. Events are stored as a date at
 * 00:00 UTC, so "upcoming" is anything dated today (UTC) or later.
 *
 * Note: the cleanup job deletes events (and their tickets) 3 days after they
 * end, so eventsHeld / ticketsBooked / checkedIn cover what is still stored,
 * not all-time totals.
 */
async function computeStats() {
  const supabase = getAdminClient();
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const count = { count: "exact" as const, head: true };

  const [held, upcoming, booked, scanned] = await Promise.all([
    supabase.from("events").select("id", count).lt("event_date", todayUtc),
    supabase.from("events").select("id", count).gte("event_date", todayUtc),
    supabase.from("tickets").select("id", count),
    supabase.from("tickets").select("id", count).eq("is_scanned", true),
  ]);

  const failed = [held, upcoming, booked, scanned].find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  return GetPublicStatsResponse.parse({
    eventsHeld: held.count ?? 0,
    upcomingEvents: upcoming.count ?? 0,
    ticketsBooked: booked.count ?? 0,
    checkedIn: scanned.count ?? 0,
  });
}

router.get("/public/stats", async (_req, res) => {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) {
      cache = { at: Date.now(), body: await computeStats() };
    }
    res.set("Cache-Control", "public, max-age=300");
    res.json(cache.body);
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "[public-stats] failed");
    // Serve the last good numbers rather than nothing.
    if (cache) {
      res.json(cache.body);
      return;
    }
    res.status(503).json({ error: "Stats are temporarily unavailable" });
  }
});

export default router;
