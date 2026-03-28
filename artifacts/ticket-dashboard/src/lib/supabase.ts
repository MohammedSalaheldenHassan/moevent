import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Public Supabase project URL — not a secret
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://lzkitwefaxolgnuwdvuk.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseAnonKey) {
  console.error(
    "[TicketHub] VITE_SUPABASE_ANON_KEY is not set.\n" +
    "Go to Replit Secrets and add:\n" +
    "  Key: VITE_SUPABASE_ANON_KEY\n" +
    "  Value: your Supabase project anon key\n" +
    "You can find it at: https://supabase.com/dashboard/project/lzkitwefaxolgnuwdvuk/settings/api"
  );
}

console.log("[TicketHub] Supabase URL:", supabaseUrl);
console.log("[TicketHub] Anon key present:", !!supabaseAnonKey);

// Use a window-level singleton so HMR never creates multiple GoTrueClient instances
declare global {
  interface Window {
    __tickethub_supabase__?: SupabaseClient;
  }
}

if (!window.__tickethub_supabase__) {
  window.__tickethub_supabase__ = createClient(
    supabaseUrl,
    supabaseAnonKey || "MISSING_KEY",
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    }
  );
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
