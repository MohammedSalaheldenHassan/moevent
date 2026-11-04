import { supabase } from "@/lib/supabase";

export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE as string | undefined;
  let trimmed = (raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");
  if (trimmed) {
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    if (!trimmed.endsWith("/api")) {
      trimmed = `${trimmed}/api`;
    }
    return trimmed;
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`.replace(/\/+$/, "");
  }
  return "";
}

// Authorization header for admin-only API routes, from the live (refreshed) session.
export async function getApiAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}
