import { Router } from "express";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";
import { buildEmailHtml, generateTicketPDF, getMailer } from "../lib/ticketEmail";

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
      .select("id, customer_name, events(title)")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticketErr || !ticket) {
      res.status(404).json({ error: "Ticket not found" });
      return;
    }
    const customerName = String(ticket.customer_name ?? "");
    const eventRel = ticket.events as { title?: string } | { title?: string }[] | null;
    const eventName = String((Array.isArray(eventRel) ? eventRel[0]?.title : eventRel?.title) ?? "Event");

    // 1. Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(
      JSON.stringify({ ticketId, event: eventName, customer: customerName }),
      {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#FFFFFF" },
        errorCorrectionLevel: "M",
      },
    );

    // 2. Generate PDF
    const pdfBuffer = await generateTicketPDF({
      customerName,
      ticketId,
      eventName,
      qrBuffer,
    });

    // 3. Send email over SMTP
    const shortId = ticketId.slice(0, 8).toUpperCase();

    try {
      await mailer.transport.sendMail({
        from: mailer.from,
        to: customerEmail.trim(),
        subject: `Your ticket for ${eventName} – #${shortId}`,
        html: buildEmailHtml({ customerName, eventName, ticketIds: [ticketId] }),
        attachments: [
          {
            filename: `ticket-${shortId}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
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
