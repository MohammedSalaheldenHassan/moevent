import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";
import { getMailer, sendTicketsEmail } from "../lib/ticketEmail";

const router = Router();

// ── POST /api/issue-ticket ─────────────────────────────────────────────────────

// Body: { customerEmail, ticketId }. customerName / eventName are still accepted
// for compatibility but ignored: both are read from the database by ticketId.
router.post("/issue-ticket", requireAdmin, async (req, res) => {
  const { customerEmail, ticketId } = (req.body ?? {}) as { customerEmail?: unknown; ticketId?: unknown };

  if (typeof customerEmail !== "string" || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(customerEmail.trim())) {
    res.status(400).json({ error: "A valid customer email address is required" });
    return;
  }
  if (typeof ticketId !== "string" || !/^[0-9a-f-]{36}$/i.test(ticketId)) {
    res.status(400).json({ error: "A valid ticketId is required" });
    return;
  }

  const mailer = getMailer();
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!mailer || !serviceKey) {
    res.status(500).json({ error: "Email sending is not configured on the server" });
    return;
  }

  const supabase = createClient(getSupabaseProjectUrl(), serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("id, customer_name, attendee_type, events(id, title, event_date, location, price, latitude, longitude)")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticketErr || !ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    type Ev = { id?: string; title?: string; event_date?: string | null; location?: string | null; price?: number | null; latitude?: number | null; longitude?: number | null };
    const rel = ticket.events as Ev | Ev[] | null;
    const ev: Ev = (Array.isArray(rel) ? rel[0] : rel) ?? {};

    try {
      await sendTicketsEmail({
        to: customerEmail.trim(),
        customerName: String(ticket.customer_name ?? ""),
        event: {
          id: ev.id,
          title: String(ev.title ?? "Event"),
          date: ev.event_date ?? null,
          location: ev.location ?? null,
          price: ev.price ?? null,
          latitude: ev.latitude ?? null,
          longitude: ev.longitude ?? null,
        },
        tickets: [{ id: ticketId, attendeeType: (ticket.attendee_type as string | null) ?? null }],
      });
    } catch (emailError) {
      console.warn("[issue-ticket] email delivery failed:", emailError instanceof Error ? emailError.message : emailError);
      res.status(502).json({ error: "Email delivery failed" });
      return;
    }

    // 4. Mark ticket as emailed (best-effort — email already sent)
    const { error: dbErr } = await supabase
      .from("tickets")
      .update({ is_emailed: true })
      .eq("id", ticketId);
    if (dbErr) {
      console.warn(`[issue-ticket] is_emailed update failed: ${dbErr.message}`);
    }

    res.json({
      success: true,
      message: `Ticket emailed to ${customerEmail}`,
      ticketId,
    });
  } catch (err) {
    console.error("[issue-ticket] unexpected error:", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
