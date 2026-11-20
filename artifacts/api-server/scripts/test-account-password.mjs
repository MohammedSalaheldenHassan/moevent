// Interactive end-to-end test of POST /api/account/password, using ONE TEST
// staff account. It asks for the emailed code, and leaves the account with
// its original password and its original must_change_password flag.
//
//   set -a; source .env; set +a
//   TEST_EMAIL=test-staff@example.com TEST_PASSWORD='current password' \
//   scripts/node_modules/.bin/tsx artifacts/api-server/scripts/test-account-password.mjs [--lockout]
//
// Run with tsx, not node: it imports setStaffPassword from the .ts source.
//
// Env: SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//      TEST_EMAIL, TEST_PASSWORD, API_URL (default http://127.0.0.1:3001/api).
// --lockout also checks the 5-wrong-codes limit. It runs last, but it locks
// this account out of password changes for 10 minutes.
// Tokens and passwords are never printed.

import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import { setStaffPassword } from "../src/lib/staffPassword.ts";

const env = (name, fallback) => {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is not set`);
  return v;
};
const url = env("SUPABASE_URL");
const anonKey = env("VITE_SUPABASE_ANON_KEY");
const email = env("TEST_EMAIL");
const password = env("TEST_PASSWORD");
const api = env("API_URL", "http://127.0.0.1:3001/api").replace(/\/+$/, "");
const lockout = process.argv.includes("--lockout");
const newPassword = `Tst-${randomBytes(6).toString("base64url")}9a`;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), noSession);
const anon = () => createClient(url, anonKey, noSession);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};
const describe = (r) => `${r.status} ${r.body.code ?? ""}`.trim();

const callApi = async (body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${api}/account/password`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let json = {};
  try { json = await res.json(); } catch {}
  return { status: res.status, body: json };
};

const sessionAlive = async (accessToken) => {
  const { data, error } = await anon().auth.getUser(accessToken);
  return !error && data.user?.id === id;
};

const signInToken = async (pw) => {
  const { data, error } = await anon().auth.signInWithPassword({ email, password: pw });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return data.session.access_token;
};

const canSignIn = async (pw) => {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (!error) await c.auth.signOut({ scope: "local" });
  return !error;
};

const appMeta = async (id) => {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) throw error;
  return data.user.app_metadata ?? {};
};

// ── Setup ───────────────────────────────────────────────────
const signIn = await anon().auth.signInWithPassword({ email, password });
if (signIn.error) throw new Error(`Cannot sign in as the test account: ${signIn.error.message}`);
const token = signIn.data.session.access_token;
const id = signIn.data.user.id;
const { data: profile } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
if (profile?.role !== "staff") throw new Error("TEST_EMAIL is not a staff account");

const originalFlag = (await appMeta(id)).must_change_password === true;
// Flag the account so the test can see the change clear it.
await admin.auth.admin.updateUserById(id, { app_metadata: { must_change_password: true } });
console.log(`API: ${api}\n`);

// Control: our server ends the verifyOtp session with scope "local". Show that
// a local sign-out ends only that one session, never the user's others.
{
  const keep = await signInToken(password);
  const other = anon();
  await other.auth.signInWithPassword({ email, password });
  await other.auth.signOut({ scope: "local" });
  check(await sessionAlive(keep), "a scope-local sign-out leaves the user's other sessions alive");
}

let restored = false;
const restore = async () => {
  if (restored) return;
  restored = true;
  const { error } = await setStaffPassword(admin, id, password, { mustChangeAfter: originalFlag });
  if (error?.code === "same_password") {
    // The password never changed (the run stopped early): only the flag
    // this script set needs undoing.
    await admin.auth.admin.updateUserById(id, {
      app_metadata: { must_change_password: originalFlag ? true : null },
    });
  }
  check(
    !error || error.code === "same_password",
    "test account restored (original password and flag)",
    error?.message,
  );
  if (!originalFlag) {
    const m = await appMeta(id);
    check(!m.must_change_password, "flag left as it was (not set)");
  }
};

try {
  // ── 1. Request a code ─────────────────────────────────────
  const first = await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  check(!first.error, "code requested", first.error?.message);
  const second = await anon().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  check(
    second.error?.status === 429,
    "second request within 60 s is rate-limited",
    second.error ? `${second.error.status} ${second.error.code ?? ""}` : "not limited: a second email was sent, use the newest code",
  );

  // ── 2. Cases that don't use up a code attempt ─────────────
  const noToken = await callApi({ code: "000000", new_password: newPassword });
  check(noToken.status === 401 && noToken.body.code === "session_ended", "no token is rejected (401)", describe(noToken));

  const weak = await callApi({ code: "000000", new_password: "abc" }, token);
  check(weak.status === 400 && weak.body.code === "weak_password", "weak password is rejected", describe(weak));

  // ── 3. The real code ──────────────────────────────────────
  const rl = createInterface({ input: stdin, output: stdout });
  const code = (await rl.question("\nType the 6-digit code from the email: ")).trim();
  rl.close();
  console.log();

  // ── 4. Change the password ────────────────────────────────
  const changed = await callApi({ code, new_password: newPassword }, token);
  check(changed.status === 200 && changed.body.ok === true, "password changed with the real code", describe(changed));
  check(await canSignIn(newPassword), "new password works");
  check(!(await canSignIn(password)), "old password no longer works");
  const m = await appMeta(id);
  check(!m.must_change_password, "must_change_password cleared");
  check(m.password_change_ok !== true, "password_change_ok not left set");
  // Supabase's admin password change deletes ALL of the user's sessions
  // (UpdatePassword(tx, nil) -> Logout). The app signs in again right after.
  check(!(await sessionAlive(token)), "original session ended by the password change (expected)");
  const afterToken = await signInToken(newPassword);
  check(await sessionAlive(afterToken), "signing in again with the new password works (what the app does)");

  // ── 5. Reuse and wrong codes ──────────────────────────────
  // After the real change on purpose: if a wrong attempt invalidated the
  // emailed code, step 4 would fail for the wrong reason.
  const reuse = await callApi({ code, new_password: `${newPassword}x` }, afterToken);
  check(reuse.status === 400 && reuse.body.code === "invalid_code", "reusing the code fails", describe(reuse));

  const wrongCode = code === "000000" ? "111111" : "000000";
  const wrong = await callApi({ code: wrongCode, new_password: `${newPassword}x` }, afterToken);
  check(
    wrong.status === 400 && wrong.body.code === "invalid_code" && typeof wrong.body.attempts_left === "number",
    "wrong code is rejected with attempts_left",
    `${describe(wrong)}, attempts_left ${wrong.body.attempts_left}`,
  );

  // ── 6. Restore ────────────────────────────────────────────
  // Independent proof, with no verifyOtp involved: an admin password change
  // alone ends a session that is alive just before it.
  const beforeRestore = await signInToken(newPassword);
  await restore();
  check(!(await sessionAlive(beforeRestore)), "an admin password change alone ends the user's sessions (Supabase)");

  if (lockout) {
    const lockToken = await signInToken(password);
    let last;
    for (let i = 0; i < 5; i++) {
      last = await callApi({ code: wrongCode, new_password: `${newPassword}x` }, lockToken);
      if (last.status === 429) break;
    }
    check(last.status === 429 && last.body.code === "too_many_codes", "5 wrong codes lock the account for 10 minutes", describe(last));
  } else {
    console.log("SKIP  5-wrong-codes lockout (pass --lockout to run it)");
  }
} finally {
  // Also restores if anything above threw.
  await restore().catch((e) => check(false, "test account restored", e.message));
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
