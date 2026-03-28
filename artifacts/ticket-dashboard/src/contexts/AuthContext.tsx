import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activityLogger";

interface Profile {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .eq("id", userId)
        .single();
      if (error) return null;
      return data as Profile;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    // Safety net: never stay loading more than 8 seconds
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 8000);

    // Supabase v2: onAuthStateChange fires immediately with INITIAL_SESSION
    // This is the canonical way to initialize auth — no need for getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, sess) => {
        if (!mountedRef.current) return;

        if (event === "SIGNED_OUT" || !sess?.user) {
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimer);
          return;
        }

        // User is authenticated — fetch their profile
        setSession(sess);
        setUser(sess.user);

        const p = await fetchProfile(sess.user.id);
        if (!mountedRef.current) return;

        if (p && p.role === "admin") {
          setProfile(p);
        } else if (p && p.role !== "admin") {
          // Not an admin — sign them out
          setProfile(null);
          setUser(null);
          setSession(null);
          await supabase.auth.signOut();
        } else {
          // Profile not found — still let them through if they have a session
          // (the page will show an error if they try to access data)
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
        const p = await fetchProfile(data.user.id);
        if (!p || p.role !== "admin") {
          await supabase.auth.signOut();
          return { error: "Access Denied: You do not have admin privileges." };
        }
        setProfile(p);
        logActivity("user_login", `Signed in as ${email}`, email);
      }
      return { error: null };
    } catch {
      return { error: "Connection error. Please try again." };
    }
  };

  const signOut = async () => {
    const email = profile?.email ?? user?.email;
    try {
      if (email) logActivity("user_logout", `Signed out`, email);
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

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
