import { randomInt } from "node:crypto";
import type { AuthError, SupabaseClient } from "@supabase/supabase-js";

/**
 * Sets a staff member's password the only way the database allows it.
 *
 * Migration 20261120120000_guard_staff_password_change rejects any staff
 * password change unless app_metadata.password_change_ok is true, and clears
 * that marker and must_change_password when the password changes. So:
 *   1. set the marker, 2. set the password, 3. if 2 failed, remove the marker.
 * Every server path that sets a staff password must go through here.
 */
export async function setStaffPassword(
  admin: SupabaseClient,
  userId: string,
  password: string,
  options: { mustChangeAfter: boolean },
): Promise<{ error: AuthError | null; passwordChanged: boolean }> {
  const marked = await admin.auth.admin.updateUserById(userId, {
    app_metadata: { password_change_ok: true },
  });
  if (marked.error) return { error: marked.error, passwordChanged: false };

  const changed = await admin.auth.admin.updateUserById(userId, { password });
  if (changed.error) {
    // The trigger only accepts exactly `true`, so a stored null is harmless.
    // If this rollback itself fails, the marker stays true and the account's
    // next password change (even a direct one) would be allowed: log it so
    // it can be cleared by hand.
    const rollback = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { password_change_ok: null },
    });
    if (rollback.error) {
      console.error("[staffPassword] marker rollback failed for", userId, rollback.error.message);
    }
    return { error: changed.error, passwordChanged: false };
  }

  if (options.mustChangeAfter) {
    // Must come after the password: the trigger clears the flag on change.
    const flagged = await admin.auth.admin.updateUserById(userId, {
      app_metadata: { must_change_password: true },
    });
    if (flagged.error) return { error: flagged.error, passwordChanged: true };
  }

  return { error: null, passwordChanged: true };
}

// No 0/O, 1/l/I: the admin reads this password out or types it.
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALPHABET = LOWER + UPPER + DIGITS;

/**
 * A random one-time password like "k7Hm-x9Qp-2tRw": 12 random characters
 * (about 70 bits) in three groups. It always contains a lowercase letter, an
 * uppercase letter, a digit and a symbol ("-"), so it passes any Supabase
 * character requirement.
 */
export function generateTemporaryPassword(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => ALPHABET[randomInt(ALPHABET.length)]);
    const raw = chars.join("");
    if (/[a-z]/.test(raw) && /[A-Z]/.test(raw) && /[0-9]/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
    }
  }
}
