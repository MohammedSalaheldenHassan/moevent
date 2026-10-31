import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function getAdminClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(getSupabaseProjectUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST /api/staff/create
// Body: { email, password, full_name, role }
router.post("/staff/create", requireAdmin, async (req, res) => {
  try {
    const { email, password, full_name, role, org_id } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
      org_id?: string | null;
    };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required." });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }
    const allowedRoles = ["admin", "staff"];
    const assignedRole = allowedRoles.includes(role ?? "") ? role! : "staff";

    const adminClient = getAdminClient();

    // 1. Create the auth user
    const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirm so they can log in immediately
      user_metadata: { full_name: full_name?.trim() || null },
    });

    if (createError) {
      console.error("[staff/create] createUser error:", createError.message);
      res.status(400).json({ error: createError.message });
      return;
    }

    const userId = userData.user.id;

    // 2. Upsert their profile row with correct role and org
    const profileRow: Record<string, unknown> = {
      id: userId,
      email,
      full_name: full_name?.trim() || null,
      role: assignedRole,
    };
    if (org_id) profileRow["org_id"] = org_id;

    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert(profileRow);

    if (profileError) {
      console.error("[staff/create] profile upsert error:", profileError.message);
      // Auth user was created — return partial success with a warning
      res.status(207).json({
        warning: `User created but profile insert failed: ${profileError.message}`,
        user: { id: userId, email, full_name: full_name?.trim() || null, role: assignedRole },
      });
      return;
    }

    res.status(201).json({
      user: { id: userId, email, full_name: full_name?.trim() || null, role: assignedRole },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[staff/create] unexpected error:", msg);
    res.status(500).json({ error: msg });
  }
});

export default router;
