import { getApiBase, getApiAuthHeaders } from "@/lib/apiBase";

/**
 * Emails tickets through the API's admin route. The server sends to the
 * address stored on each ticket and marks them emailed.
 */
export async function sendTicketsEmail(ticketIds: string[]): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(`${getApiBase()}/tickets/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getApiAuthHeaders()) },
      body: JSON.stringify({ ticketIds }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok ? { ok: true } : { ok: false, message: data?.error ?? `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
