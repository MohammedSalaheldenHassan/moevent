import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activityLogger";
import { AuthContext, type Profile } from "./authContextObject";

// This file exports ONLY the AuthProvider component.
// useAuth hook is in useAuth.ts; context object is in authContextObject.ts.
// This three-file split lets Vite Fast Refresh each piece independently,
// eliminating the "Invalid hook call" HMR crash.

function fetchProfileFromSupabase(userId: string, timeoutMs = 5000): Promise<Profile | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => {
      console.warn("[AuthContext] profile fetch timed out — cannot verify admin role");
      resolve(null);
    }, timeoutMs)
  );

  const fetch = supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", userId)
    .single()
    .then(({ data, error }) => {
      if (error) {
        console.warn("[AuthContext] profile fetch error:", error.message);
        return null;
      }
      return data as Profile;
    })
    .catch(() => null);

  return Promise.race([fetch, timeout]);
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

    // Safety net: never stay loading more than 8 seconds
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.warn("[AuthContext] Safety timer fired — forcing loading=false");
        setLoading(false);
      }
    }, 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mountedRef.current) return;
        console.log("[AuthContext] auth event:", event, "user:", sess?.user?.email ?? "none");

        if (event === "SIGNED_OUT" || !sess?.user) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        // signIn() is actively handling this login — don't interfere.
        // It performs its own role check and sets state on success, or
        // signs out and returns an error on failure.
        if (signingInRef.current) return;

        // TOKEN_REFRESHED: user is already authenticated as admin, just update session.
        if (event === "TOKEN_REFRESHED") {
          setSession(sess);
          return;
        }

        // INITIAL_SESSION (page restore / refresh): verify admin role before allowing in.
        const p = await fetchProfileFromSupabase(sess.user.id);
        if (!mountedRef.current) return;

        if (!p || p.role !== "admin") {
          console.warn("[AuthContext] Non-admin user on session restore — signing out");
          await supabase.auth.signOut();
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
        const p = await fetchProfileFromSupabase(data.user.id, 7000);

        if (p === null) {
          await supabase.auth.signOut();
          return {
            error: "The server is starting up — please wait a few seconds and try again.",
          };
        }

        if (p.role !== "admin") {
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
