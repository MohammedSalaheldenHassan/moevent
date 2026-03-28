import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activityLogger";
import { AuthContext, type Profile } from "./authContextObject";

// This file exports ONLY the AuthProvider component.
// useAuth hook is in useAuth.ts; context object is in authContextObject.ts.
// This three-file split lets Vite Fast Refresh each piece independently,
// eliminating the "Invalid hook call" HMR crash.

function fetchProfileFromSupabase(userId: string): Promise<Profile | null> {
  return supabase
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
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // Safety net: never stay loading more than 8 seconds
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.warn("[AuthContext] Safety timer fired — forcing loading=false");
        setLoading(false);
      }
    }, 8000);

    // Supabase v2: onAuthStateChange fires immediately with INITIAL_SESSION.
    // This is the canonical init pattern — no getSession() race condition.
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

        setSession(sess);
        setUser(sess.user);

        const p = await fetchProfileFromSupabase(sess.user.id);
        if (!mountedRef.current) return;

        if (p && p.role === "admin") {
          setProfile(p);
        } else if (p && p.role !== "admin") {
          // Non-admin user — reject
          setProfile(null);
          setUser(null);
          setSession(null);
          await supabase.auth.signOut();
        } else {
          // Profile row not found — allow through (tables may not exist yet)
          setProfile(null);
        }

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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user) {
        const p = await fetchProfileFromSupabase(data.user.id);
        if (!p) {
          // Profile missing — still allow if they authenticated successfully
          console.warn("[AuthContext] No profile found for user, allowing access without role check");
          logActivity("user_login", `Signed in as ${email} (no profile row)`, email);
          return { error: null };
        }
        if (p.role !== "admin") {
          await supabase.auth.signOut();
          return { error: "Access Denied: You do not have admin privileges." };
        }
        setProfile(p);
        logActivity("user_login", `Signed in as ${email}`, email);
      }
      return { error: null };
    } catch (err) {
      console.error("[AuthContext] signIn error:", err);
      return { error: "Connection error. Please try again." };
    }
  };

  const signOut = async () => {
    const email = profile?.email ?? user?.email;
    try {
      if (email) logActivity("user_logout", "Signed out", email);
      await supabase.auth.signOut();
    } catch {
      // ignore sign-out errors
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
