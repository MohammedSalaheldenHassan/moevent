import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set.");
}

// Use a window-level singleton so HMR doesn't create multiple GoTrueClient instances
declare global {
  interface Window {
    __tickethub_supabase__?: SupabaseClient;
  }
}

if (!window.__tickethub_supabase__) {
  window.__tickethub_supabase__ = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = window.__tickethub_supabase__;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string | null;
          email: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          title: string;
          date: string;
          location: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          date: string;
          location: string;
          created_at?: string;
        };
      };
      tickets: {
        Row: {
          id: string;
          event_id: string;
          customer_name: string;
          customer_phone: string;
          is_scanned: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          customer_name: string;
          customer_phone: string;
          is_scanned?: boolean;
          created_at?: string;
        };
      };
    };
  };
};
