import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";

const router: IRouter = Router();

function getAdminClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(getSupabaseProjectUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// GET /api/auth/role
// Returns the role of the authenticated user.
// Requires: Authorization: Bearer <supabase_access_token>
router.get("/auth/role", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid Authorization header" });
      return;
    }
    const token = authHeader.slice(7);

    const adminClient = getAdminClient();

    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, email, org_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      res.status(404).json({ error: "Profile not found", role: null });
      return;
    }

    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json({
      id: profile.id as string,
      role: profile.role as string,
      full_name: (profile.full_name ?? null) as string | null,
      email: (profile.email ?? null) as string | null,
      org_id: (profile.org_id ?? null) as string | null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("SUPABASE_SERVICE_ROLE_KEY")) {
      res.status(500).json({ error: "Server misconfiguration: SUPABASE_SERVICE_ROLE_KEY is not set" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
