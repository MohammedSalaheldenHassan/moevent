import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

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
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          setSession(session);
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          if (!mounted) return;
          if (p && p.role === "admin") {
            setProfile(p);
          } else if (p) {
            await supabase.auth.signOut();
            setUser(null);
            setSession(null);
            setProfile(null);
          }
        }
      } catch {
        // silently handle connection errors
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (event === "SIGNED_OUT") {
          setUser(null);
          setSession(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        if (session?.user) {
          setSession(session);
          setUser(session.user);
          const p = await fetchProfile(session.user.id);
          if (!mounted) return;
          if (p && p.role === "admin") {
            setProfile(p);
          } else if (p) {
            await supabase.auth.signOut();
          } else {
            setProfile(null);
          }
        } else {
          setUser(null);
          setSession(null);
          setProfile(null);
        }
        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
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
      }
      return { error: null };
    } catch {
      return { error: "Connection error. Please try again." };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore errors on sign out
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
