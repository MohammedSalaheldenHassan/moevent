import { createClient, SupabaseClient } from "@supabase/supabase-js";

/** Strip BOM, whitespace, and optional wrapping quotes from Vite env strings. */
function normalizeEnv(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "");
}

// Public Supabase project URL — not a secret
const supabaseUrl =
  normalizeEnv(import.meta.env.VITE_SUPABASE_URL) ||
  "https://lzkitwefaxolgnuwdvuk.supabase.co";
const supabaseAnonKey = normalizeEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseAnonKey) {
  console.error(
    "[TicketHub] VITE_SUPABASE_ANON_KEY is not set.\n" +
      "Add it to the repo root .env (not the service role key):\n" +
      "  VITE_SUPABASE_ANON_KEY=<anon or publishable key from Supabase → Project Settings → API>\n" +
      "Then restart `pnpm dev` so Vite reloads env.\n" +
      "https://supabase.com/dashboard/project/lzkitwefaxolgnuwdvuk/settings/api",
  );
}

console.log("[TicketHub] Supabase URL:", supabaseUrl);
console.log("[TicketHub] Anon key present:", !!supabaseAnonKey);

declare global {
  interface Window {
    __tickethub_supabase__?: SupabaseClient;
    __tickethub_supabase_cfg__?: { url: string; key: string };
  }
}

const cfg = { url: supabaseUrl, key: supabaseAnonKey || "MISSING_KEY" };
const prev = window.__tickethub_supabase_cfg__;
if (
  window.__tickethub_supabase__ &&
  prev &&
  (prev.url !== cfg.url || prev.key !== cfg.key)
) {
  void window.__tickethub_supabase__.auth.signOut().catch(() => {});
  delete window.__tickethub_supabase__;
  delete window.__tickethub_supabase_cfg__;
}

if (!window.__tickethub_supabase__) {
  window.__tickethub_supabase__ = createClient(cfg.url, cfg.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  });
  window.__tickethub_supabase_cfg__ = { url: cfg.url, key: cfg.key };
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
