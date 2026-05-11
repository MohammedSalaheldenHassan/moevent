/** Same project as the dashboard (`VITE_SUPABASE_URL`). Set on the API server in Railway as `SUPABASE_URL`. */
export function getSupabaseProjectUrl(): string {
  const u = process.env["SUPABASE_URL"]?.trim();
  if (u) return u.replace(/\/+$/, "");
  return "https://lzkitwefaxolgnuwdvuk.supabase.co";
}
