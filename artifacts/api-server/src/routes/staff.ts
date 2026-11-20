import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";
import { generateTemporaryPassword, setStaffPassword } from "../lib/staffPassword";

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
    const { email, password, full_name, role } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: string;
    };

    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "A valid email address is required." });
      return;
    }
    if (!password || password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters." });
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
      // Staff get a password from an admin; the gate app makes them set their
      // own (verified by an email code) at the first sign-in.
      ...(assignedRole === "staff" ? { app_metadata: { must_change_password: true } } : {}),
    });

    if (createError) {
      console.error("[staff/create] createUser error:", createError.message);
      res.status(400).json({ error: createError.message });
      return;
    }

    const userId = userData.user.id;

    // 2. Upsert their profile row with the correct role
    const profileRow: Record<string, unknown> = {
      id: userId,
      email,
      full_name: full_name?.trim() || null,
      role: assignedRole,
    };

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
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/staff/:id/reset-password
// Gives a staff member a new random temporary password, returned once. They
// must set their own password at their next gate-app sign-in.
// Supabase's admin password change deletes all of their sessions, so their
// phone is sent to login at its next token refresh. Until then (up to the
// access token's lifetime, about an hour) the current access token still
// works against the database, which only checks its signature.
router.post("/staff/:id/reset-password", requireAdmin, async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const id = String(req.params["id"]);
    if (id === res.locals["userId"]) {
      res.status(400).json({ error: "You cannot reset your own password here." });
      return;
    }

    const adminClient = getAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("role").eq("id", id).maybeSingle();
    if (profileError) {
      res.status(500).json({ error: profileError.message });
      return;
    }
    if (!profile) {
      res.status(404).json({ error: "Staff member not found." });
      return;
    }
    if (profile.role !== "staff") {
      res.status(400).json({ error: "Only staff accounts can be reset here." });
      return;
    }

    const password = generateTemporaryPassword();
    const { error, passwordChanged } = await setStaffPassword(adminClient, id, password, {
      mustChangeAfter: true,
    });
    if (error && !passwordChanged) {
      console.error("[staff/reset-password] failed:", error.message);
      res.status(500).json({ error: `Password not changed: ${error.message}` });
      return;
    }
    if (error) {
      // The password did change, so the admin still needs to see it.
      console.error("[staff/reset-password] flag not set:", error.message);
      res.status(207).json({
        password,
        warning: "Password changed, but they won't be asked to set their own. Reset again to retry.",
      });
      return;
    }

    res.json({ password });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[staff/reset-password] unexpected error:", msg);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/staff/:id
// Removes the profile (and its event_access rows, via cascade) and soft-deletes
// the auth user so they can no longer sign in to the dashboard or the gate app.
// The auth row is kept because tickets.scanned_by references it.
router.delete("/staff/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params["id"]);
    if (id === res.locals["userId"]) {
      res.status(400).json({ error: "You cannot delete your own account." });
      return;
    }

    const adminClient = getAdminClient();

    const { error: profileError } = await adminClient.from("profiles").delete().eq("id", id);
    if (profileError) {
      res.status(500).json({ error: profileError.message });
      return;
    }

    const { error: authError } = await adminClient.auth.admin.deleteUser(id, true);
    if (authError) {
      res.status(500).json({ error: `Profile removed but sign-in not revoked: ${authError.message}` });
      return;
    }

    res.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[staff/delete] unexpected error:", msg);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
