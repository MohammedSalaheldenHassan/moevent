/**
 * Base URL for the Express API (mounted at `/api`).
 * - Local dev: defaults to same origin + `/api` (Vite proxy forwards to the API server).
 * - Split deploy (e.g. Railway static + API): set `VITE_API_BASE` at build time to the public API root, e.g. `https://your-api.up.railway.app/api`
 */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE as string | undefined;
  const trimmed = (raw ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`.replace(/\/+$/, "");
  }
  return "";
}
