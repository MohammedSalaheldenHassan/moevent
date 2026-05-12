import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/apiBase";
import type { User, Session } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activityLogger";
import { AuthContext, type Profile } from "./authContextObject";

// This file exports ONLY the AuthProvider component.
// useAuth hook is in useAuth.ts; context object is in authContextObject.ts.
// This three-file split lets Vite Fast Refresh each piece independently,
// eliminating the "Invalid hook call" HMR crash.

// Fetch the user's profile from the API server using their access token.
// Uses the token directly — avoids calling supabase.auth.getSession() which
// can block on a network refresh and hang the entire auth flow.
// Parses GET /auth/role body; detects HTML (wrong host / static SPA) before JSON.parse throws.
function parseRoleBody(body: string, url: string): { profile: Profile | null; hint: string | null } {
  const t = body.trim();
  if (t.startsWith("<!") || (t.startsWith("<") && t.toLowerCase().includes("doctype"))) {
    return {
      profile: null,
      hint:
        `That URL returned a web page (HTML), not the JSON API — usually the static frontend or the wrong Railway service. Point VITE_API_BASE at the service that runs the Node/Express API only. Check in a new tab: ${url.replace(/\/auth\/role$/, "/healthz")} must return JSON like {"status":"ok"}.`,
    };
  }
  if (t.startsWith("<")) {
    return {
      profile: null,
      hint:
        `That URL returned HTML, not JSON. Fix VITE_API_BASE to your API Railway hostname (not the static site). Verify: …/api/healthz returns JSON.`,
    };
  }
  try {
    const profile = JSON.parse(t) as Profile;
    if (!profile || typeof profile !== "object" || typeof profile.role !== "string") {
      return { profile: null, hint: `Unexpected JSON from ${url}.` };
    }
    return { profile, hint: null };
  } catch {
    return {
      profile: null,
      hint: `Invalid JSON from ${url}: ${t.slice(0, 160)}${t.length > 160 ? "…" : ""}`,
    };
  }
}

async function fetchProfileFromApi(
  token: string,
): Promise<{ profile: Profile | null; hint: string | null }> {
  const apiBase = getApiBase();
  const url = `${apiBase}/auth/role`;

  const run = async (): Promise<{ profile: Profile | null; hint: string | null }> => {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      const text = await res.text();

      if (res.ok) {
        return parseRoleBody(text, url);
      }

      let bodyText = text;

      if (res.status === 401) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        const freshToken = refreshed.session?.access_token;
        if (!freshToken) {
          return {
            profile: null,
            hint:
              "The API rejected your session (401). Set SUPABASE_URL on the API service to the same project URL as VITE_SUPABASE_URL, and use a service_role key from that project.",
          };
        }
        const retry = await fetch(url, {
          headers: { Authorization: `Bearer ${freshToken}` },
          cache: "no-store",
          signal: AbortSignal.timeout(12_000),
        });
        const retryText = await retry.text();
        if (!retry.ok) {
          return {
            profile: null,
            hint: `Role check failed after refresh (HTTP ${retry.status}). Open ${url} in the browser network tab for details.`,
          };
        }
        return parseRoleBody(retryText, url);
      }

      let apiErr = "";
      try {
        const j = JSON.parse(bodyText) as { error?: string };
        apiErr = (j.error ?? "").trim();
      } catch {
        /* not JSON */
      }

      if (res.status === 404) {
        if (apiErr.includes("Profile not found") || bodyText.includes("Profile not found")) {
          return {
            profile: null,
            hint:
              "No profile found for this user in the database. Add a row in Supabase `profiles` with this user's id and role admin or super_admin.",
          };
        }
        return {
          profile: null,
          hint: `Wrong API URL (HTTP 404). Tried: ${url}. Set VITE_API_BASE to your Railway API hostname, redeploy the frontend, and open /api/healthz on that host to confirm.`,
        };
      }

      if (res.status === 500 && apiErr.includes("SUPABASE_SERVICE_ROLE_KEY")) {
        return {
          profile: null,
          hint: "API is missing SUPABASE_SERVICE_ROLE_KEY. Add it in Railway (API service) and redeploy.",
        };
      }

      if (res.status >= 400 && bodyText.includes("Cannot GET")) {
        return {
          profile: null,
          hint: `Wrong API path. Tried: ${url}. Set VITE_API_BASE to your API origin (e.g. https://xxx.up.railway.app), rebuild the frontend.`,
        };
      }

      return {
        profile: null,
        hint: `Role API HTTP ${res.status}${apiErr ? `: ${apiErr}` : ""}. Request: ${url}`,
      };
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const msg = err instanceof Error ? err.message : String(err);
      if (name === "AbortError" || msg.toLowerCase().includes("abort")) {
        return {
          profile: null,
          hint: `Timed out talking to ${url}. Confirm the API is running and VITE_API_BASE matches your API service URL.`,
        };
      }
      return {
        profile: null,
        hint: `Cannot reach ${url} (${msg}). Often: wrong VITE_API_BASE, frontend not rebuilt after env change, or browser blocked the request (CORS).`,
      };
    }
  };

  return await Promise.race([
    run(),
    new Promise<{ profile: Profile | null; hint: string | null }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            profile: null,
            hint: `Role check timed out. Tried: ${url}`,
          }),
        13_000,
      ),
    ),
  ]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  // When signIn() is actively handling a login attempt, the onAuthStateChange
  // handler must stay out of the way to avoid conflicting sign-outs that swallow
  // the error message and leave the UI stuck in a loading state.
  const signingInRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // Safety net: never stay loading more than 6 seconds
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.warn("[AuthContext] Safety timer fired — forcing loading=false");
        setLoading(false);
      }
    }, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mountedRef.current) return;
        console.log("[AuthContext] auth event:", event, "user:", sess?.user?.email ?? "none");

        if (event === "SIGNED_OUT" || !sess?.user) {
          // If signIn() triggered this sign-out internally (to reject a non-admin),
          // don't touch React state here — signIn() owns the flow and the LoginPage
          // must not be remounted (which would wipe the error message).
          if (!signingInRef.current) {
            setUser(null);
            setSession(null);
            setProfile(null);
            setLoading(false);
            clearTimeout(safetyTimer);
          }
          return;
        }

        // signIn() is actively handling this login — don't interfere.
        if (signingInRef.current) return;

        // TOKEN_REFRESHED: user is already authenticated as admin, just update session.
        if (event === "TOKEN_REFRESHED") {
          setSession(sess);
          return;
        }

        // INITIAL_SESSION / SIGNED_IN (page restore): verify admin role before allowing in.
        const { profile: p, hint } = await fetchProfileFromApi(sess.access_token);
        if (!mountedRef.current) return;

        if (!p || (p.role !== "admin" && p.role !== "super_admin")) {
          console.warn("[AuthContext] Non-admin user on session restore — clearing state and signing out", hint ?? "");
          // Clear state immediately so the login page shows right away
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimer);
          // Sign out in the background — SIGNED_OUT event will be a no-op since state is already cleared
          void supabase.auth.signOut().catch(() => {});
          return;
        }

        setSession(sess);
        setUser(sess.user);
        setProfile(p);
        if (mountedRef.current) setLoading(false);
        clearTimeout(safetyTimer);
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    signingInRef.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        const msg = error.message ?? "";
        if (/invalid api key/i.test(msg)) {
          return {
            error:
              "Supabase rejected the browser API key. In the repo root .env, set VITE_SUPABASE_ANON_KEY to the anon / publishable key from Supabase → Project Settings → API (not the service_role secret). Match VITE_SUPABASE_URL to the same project, save the file, then restart `pnpm dev`.",
          };
        }
        return { error: msg };
      }

      if (data.user && data.session) {
        const { profile: p, hint } = await fetchProfileFromApi(data.session.access_token);

        if (p === null) {
          await supabase.auth.signOut();
          return {
            error:
              hint ??
              "Unable to verify your role. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on the API, VITE_API_BASE on the frontend build if the API is on another host, and redeploy both.",
          };
        }

        if (p.role !== "admin" && p.role !== "super_admin") {
          await supabase.auth.signOut();
          return {
            error: "Access denied. Only admin accounts can access this dashboard.",
          };
        }

        setUser(data.user);
        setSession(data.session);
        setProfile(p);
        setLoading(false);
        logActivity("user_login", `Signed in as ${email}`, email);
      }
      return { error: null };
    } catch (err) {
      console.error("[AuthContext] signIn error:", err);
      return { error: "Connection error. Please try again." };
    } finally {
      signingInRef.current = false;
    }
  };

  const signOut = async () => {
    const email = profile?.email ?? user?.email;
    if (email) logActivity("user_logout", "Signed out", email);
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("[AuthContext] signOut network error (local state already cleared):", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
