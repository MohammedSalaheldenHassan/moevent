import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { setStaffPassword } from "../lib/staffPassword";

const router: IRouter = Router();

function getServiceKey(): string {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return key;
}

function getAdminClient() {
  return createClient(getSupabaseProjectUrl(), getServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Keep in sync with the gate app's PasswordPolicy.minLength and Supabase. */
const MIN_PASSWORD_LENGTH = 6;

// Wrong email codes per user. In memory: one API instance, and a restart only
// resets the count. With 6-digit codes, 5 tries per 10 minutes is enough for
// typos and far too few to guess.
const MAX_WRONG_CODES = 5;
const WRONG_CODE_WINDOW_MS = 10 * 60 * 1000;
const wrongCodes = new Map<string, { count: number; since: number }>();

function wrongCodeCount(userId: string): number {
  const entry = wrongCodes.get(userId);
  if (!entry) return 0;
  if (Date.now() - entry.since > WRONG_CODE_WINDOW_MS) {
    wrongCodes.delete(userId);
    return 0;
  }
  return entry.count;
}

function recordWrongCode(userId: string): number {
  const count = wrongCodeCount(userId) + 1;
  const since = wrongCodes.get(userId)?.since ?? Date.now();
  wrongCodes.set(userId, { count, since });
  return count;
}

// POST /api/account/password
// A staff member sets their own password after proving access to their email.
// Headers: Authorization: Bearer <access token of a fresh password sign-in>
// Body: { code: "123456" (from signInWithOtp), new_password }
// Errors: { error, code } where code is one of
//   session_ended, not_staff, invalid_request, weak_password, same_password,
//   invalid_code, too_many_codes, rate_limited, server_error
router.post("/account/password", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Not signed in.", code: "session_ended" });
      return;
    }
    const admin = getAdminClient();
    const { data: { user }, error: userError } = await admin.auth.getUser(authHeader.slice(7));
    if (userError || !user?.email) {
      res.status(401).json({ error: "Your session has ended.", code: "session_ended" });
      return;
    }

    const { data: profile } = await admin
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "staff") {
      res.status(403).json({ error: "Only staff accounts use this.", code: "not_staff" });
      return;
    }

    const { code, new_password } = (req.body ?? {}) as { code?: unknown; new_password?: unknown };
    if (typeof code !== "string" || !/^\d{6}$/.test(code) || typeof new_password !== "string") {
      res.status(400).json({ error: "A 6-digit code and a new password are required.", code: "invalid_request" });
      return;
    }
    if (new_password.length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({
        error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
        code: "weak_password",
        reasons: ["length"],
      });
      return;
    }

    if (wrongCodeCount(user.id) >= MAX_WRONG_CODES) {
      res.status(429).json({ error: "Too many wrong codes. Try again in a few minutes.", code: "too_many_codes" });
      return;
    }

    // A separate client: verifying creates a session, which is signed out
    // again right away. scope "local" ends only that session; the default
    // ("global") would also sign the user out on their phone.
    const otp = createClient(getSupabaseProjectUrl(), getServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const verified = await otp.auth.verifyOtp({ email: user.email, token: code, type: "email" });
    if (verified.error || !verified.data.user || verified.data.user.id !== user.id) {
      if (verified.error?.status === 429) {
        res.status(429).json({ error: "Too many attempts. Wait a few minutes.", code: "rate_limited" });
        return;
      }
      const count = recordWrongCode(user.id);
      res.status(400).json({
        error: "This code is wrong or has expired.",
        code: "invalid_code",
        attempts_left: Math.max(0, MAX_WRONG_CODES - count),
      });
      return;
    }
    wrongCodes.delete(user.id);
    await otp.auth.signOut({ scope: "local" }).catch(() => undefined);

    const { error } = await setStaffPassword(admin, user.id, new_password, { mustChangeAfter: false });
    if (error) {
      if (error.code === "weak_password") {
        const reasons = (error as { reasons?: string[] }).reasons ?? [];
        res.status(400).json({ error: error.message, code: "weak_password", reasons });
        return;
      }
      if (error.code === "same_password") {
        res.status(400).json({ error: error.message, code: "same_password" });
        return;
      }
      console.error("[account/password] update failed:", error.code, error.message);
      res.status(500).json({ error: "Could not change the password.", code: "server_error" });
      return;
    }

    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[account/password] unexpected error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error", code: "server_error" });
  }
});

export default router;
