import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { deleteExpiredEvents } from "../lib/cleanup";
import { logger } from "../lib/logger";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

const DAYS_GRACE = 3;

function getAdminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getSupabaseProjectUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET /api/cleanup/status
// Returns count of events past their date, and count due for deletion (> 3 days expired)
router.get("/cleanup/status", requireAdmin, async (_req, res) => {
  try {
    const supabase = getAdminClient();
    const now = new Date().toISOString();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DAYS_GRACE);
    const cutoffIso = cutoff.toISOString();

    const [expiredRes, dueDeletionRes] = await Promise.all([
      supabase.from("events").select("id, title, event_date").lt("event_date", now),
      supabase.from("events").select("id, title, event_date").lt("event_date", cutoffIso),
    ]);

    res.json({
      graceDays: DAYS_GRACE,
      expiredCount: expiredRes.data?.length ?? 0,
      pendingDeletionCount: dueDeletionRes.data?.length ?? 0,
      pendingDeletion: dueDeletionRes.data ?? [],
      nextSweepNote: "Sweep runs every 24 hours and on server restart",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err: msg }, "[cleanup/status] error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/cleanup/run
// Manually trigger the cleanup sweep. Requires: Authorization: Bearer <admin token>
router.post("/cleanup/run", requireAdmin, async (_req, res) => {
  try {
    logger.info("[cleanup/run] Manual sweep triggered");
    await deleteExpiredEvents();
    res.json({ ok: true, message: "Cleanup sweep completed" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    logger.error({ err: msg }, "[cleanup/run] error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
