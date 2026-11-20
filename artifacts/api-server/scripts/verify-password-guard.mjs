// Checks the staff password guard (migration 20261120120000) against the live
// project, using ONE TEST staff account. Run after applying the migration:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SUPABASE_ANON_KEY=... \
//   TEST_EMAIL=test-staff@example.com TEST_PASSWORD='current password' \
//   node artifacts/api-server/scripts/verify-password-guard.mjs
//
// The account must have role 'staff' in public.profiles. Its password ends up
// back at TEST_PASSWORD. Its app_metadata ends without the flags it adds.

import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
};
const url = env("SUPABASE_URL");
const email = env("TEST_EMAIL");
const password = env("TEST_PASSWORD");
const temp = `${password}-Tmp9!`;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };
const admin = createClient(url, env("SUPABASE_SERVICE_ROLE_KEY"), noSession);
const anon = () => createClient(url, env("SUPABASE_ANON_KEY"), noSession);

let failures = 0;
const check = (ok, label, detail = "") => {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
};

const meta = async (id) => {
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) throw error;
  return data.user.app_metadata;
};
const setMeta = (id, app_metadata) =>
  admin.auth.admin.updateUserById(id, { app_metadata });
const setPassword = (id, pw) =>
  admin.auth.admin.updateUserById(id, { password: pw });
const canSignIn = async (pw) => {
  const c = anon();
  const { error } = await c.auth.signInWithPassword({ email, password: pw });
  if (!error) await c.auth.signOut({ scope: "local" });
  return !error;
};

const signIn = await anon().auth.signInWithPassword({ email, password });
if (signIn.error) throw new Error(`Cannot sign in as ${email}: ${signIn.error.message}`);
const id = signIn.data.user.id;
const { data: profile } = await admin.from("profiles").select("role").eq("id", id).single();
if (profile?.role !== "staff") throw new Error(`${email} is not a staff account`);

const before = await meta(id);
console.log("app_metadata at start:", JSON.stringify(before));

// 1. How app_metadata merges.
await setMeta(id, { must_change_password: true });
let m = await meta(id);
check(m.must_change_password === true, "admin update adds a key");
check(
  Object.keys(before).every((k) => k in m),
  "admin update keeps the other keys (merge, not replace)",
  JSON.stringify(m),
);

await setMeta(id, { password_change_ok: true });
await setMeta(id, { password_change_ok: null });
m = await meta(id);
console.log(
  `INFO  setting a key to null ${"password_change_ok" in m ? "stores JSON null" : "deletes the key"}`,
);
check(m.password_change_ok !== true, "marker no longer true after rollback");
check(m.must_change_password === true, "rollback leaves must_change_password");

// 2. Direct changes are blocked.
const user = anon();
await user.auth.signInWithPassword({ email, password });
const direct = await user.auth.updateUser({ password: temp });
check(Boolean(direct.error), "direct updateUser(password) is rejected", direct.error?.message);
await user.auth.signOut({ scope: "local" });

const noMarker = await setPassword(id, temp);
check(Boolean(noMarker.error), "admin password change without marker is rejected", noMarker.error?.message);
check(await canSignIn(password), "password unchanged after rejected attempts");

// 3. The marker pattern works and clears both flags.
await setMeta(id, { password_change_ok: true });
const withMarker = await setPassword(id, temp);
check(!withMarker.error, "admin password change with marker succeeds", withMarker.error?.message);
m = await meta(id);
check(!m.password_change_ok, "marker removed by the trigger", JSON.stringify(m));
check(!m.must_change_password, "must_change_password removed by the trigger");
check(await canSignIn(temp), "new password works");

// 4. A used marker cannot be reused.
const reuse = await setPassword(id, password);
check(Boolean(reuse.error), "second change without a new marker is rejected", reuse.error?.message);

// Restore the original password.
await setMeta(id, { password_change_ok: true });
const restore = await setPassword(id, password);
check(!restore.error, "original password restored", restore.error?.message);
console.log("app_metadata at end:", JSON.stringify(await meta(id)));

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
