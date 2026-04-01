import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activityLogger";
import { AuthContext, type Profile } from "./authContextObject";

// This file exports ONLY the AuthProvider component.
// useAuth hook is in useAuth.ts; context object is in authContextObject.ts.
// This three-file split lets Vite Fast Refresh each piece independently,
// eliminating the "Invalid hook call" HMR crash.

function fetchProfileFromSupabase(userId: string, timeoutMs = 3000): Promise<Profile | null> {
  const timeout = new Promise<null>((resolve) =>
    setTimeout(() => {
      console.warn("[AuthContext] profile fetch timed out — allowing access without profile");
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

  useEffect(() => {
    mountedRef.current = true;

    // Safety net: never stay loading more than 5 seconds
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        console.warn("[AuthContext] Safety timer fired — forcing loading=false");
        setLoading(false);
      }
    }, 5000);

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

        // Only admins can access the dashboard — sign out everyone else
        if (!p || p.role !== "admin") {
          console.warn("[AuthContext] Non-admin user detected on session restore — signing out");
          await supabase.auth.signOut();
          return;
        }

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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: error.message };

      if (data.user && data.session) {
        // Use a longer timeout for the login flow to reliably detect staff roles
        const p = await fetchProfileFromSupabase(data.user.id, 7000);

        if (p === null) {
          // DB timed out — sign them out and ask to retry so we can verify role
          await supabase.auth.signOut();
          return {
            error:
              "The server is starting up — please wait a few seconds and try again.",
          };
        }

        // Only admins can log in
        if (p.role !== "admin") {
          await supabase.auth.signOut();
          return {
            error:
              "Access denied. Only admin accounts can access this dashboard.",
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
