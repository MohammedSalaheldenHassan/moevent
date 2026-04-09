import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
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
async function fetchProfileFromApi(token: string): Promise<Profile | null> {
  const apiBase = `${window.location.origin}/api`;

  // Race the entire fetch against a 4-second wall clock so nothing can block
  // the auth flow beyond that (AbortSignal.timeout only covers the fetch itself).
  const result = await Promise.race([
    (async (): Promise<Profile | null> => {
      try {
        const res = await fetch(`${apiBase}/auth/role`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });

        if (res.ok) return await res.json() as Profile;

        // 401 means the token might be stale — try a one-shot refresh
        if (res.status === 401) {
          console.warn("[AuthContext] role API returned 401, attempting token refresh…");
          const { data: refreshed } = await supabase.auth.refreshSession();
          const freshToken = refreshed.session?.access_token;
          if (!freshToken) return null;

          const retry = await fetch(`${apiBase}/auth/role`, {
            headers: { Authorization: `Bearer ${freshToken}` },
            cache: "no-store",
            signal: AbortSignal.timeout(4000),
          });
          if (!retry.ok) {
            console.warn("[AuthContext] role API returned", retry.status, "after refresh");
            return null;
          }
          return await retry.json() as Profile;
        }

        console.warn("[AuthContext] role API returned", res.status);
        return null;
      } catch (err) {
        console.warn("[AuthContext] role API error:", err);
        return null;
      }
    })(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 4500)),
  ]);

  return result;
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
        const p = await fetchProfileFromApi(sess.access_token);
        if (!mountedRef.current) return;

        if (!p || (p.role !== "admin" && p.role !== "super_admin")) {
          console.warn("[AuthContext] Non-admin user on session restore — clearing state and signing out");
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
      if (error) return { error: error.message };

      if (data.user && data.session) {
        const p = await fetchProfileFromApi(data.session.access_token);

        if (p === null) {
          await supabase.auth.signOut();
          return {
            error: "Unable to verify account — please try again.",
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
