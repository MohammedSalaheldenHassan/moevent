import { createContext } from "react";
import type { User, Session } from "@supabase/supabase-js";

export interface Profile {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
  org_id: string | null;
}

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// Stored in window so HMR re-evaluation always returns the SAME context object.
// Without this, each hot reload creates a new context, causing useContext() to
// return undefined in components that still hold a reference to the old context.
declare global {
  interface Window {
    __tickethub_auth_ctx__?: ReturnType<typeof createContext<AuthContextType | undefined>>;
  }
}

if (!window.__tickethub_auth_ctx__) {
  window.__tickethub_auth_ctx__ = createContext<AuthContextType | undefined>(undefined);
}

export const AuthContext = window.__tickethub_auth_ctx__;
