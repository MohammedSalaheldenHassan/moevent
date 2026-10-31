import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";

function getAdminClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(getSupabaseProjectUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Middleware: verify the Bearer token belongs to an admin profile.
// On success the caller's id is available as res.locals.userId.
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const adminClient = getAdminClient();
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) { res.status(401).json({ error: "Invalid token" }); return; }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("id, role").eq("id", user.id).single();

    if (profileError || !profile || profile.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admin role required" });
      return;
    }
    res.locals["userId"] = user.id;
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
