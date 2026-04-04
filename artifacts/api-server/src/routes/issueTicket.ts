import { Router } from "express";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

const router = Router();

const SUPABASE_URL =
  process.env["SUPABASE_URL"] ?? "https://lzkitwefaxolgnuwdvuk.supabase.co";

// ── PDF builder ────────────────────────────────────────────────────────────────

function generateTicketPDF({
  customerName,
  ticketId,
  eventName,
  qrBuffer,
}: {
  customerName: string;
  ticketId: string;
  eventName: string;
  qrBuffer: Buffer;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    const doc = new PDFDocument({
      size: "A5",
      margin: 0,
      info: {
        Title: `Ticket – ${eventName}`,
        Author: "MO Event System",
      },
    });

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { width, height } = doc.page;

    const PURPLE = "#8B5CF6";
    const DARK_BG = "#0F0F1A";
    const CARD_BG = "#1A1A2E";
    const PANEL_BG = "#0F0F1A";
    const WHITE = "#FFFFFF";
    const DIM = "#A0A0B8";
    const BORDER = "#2A2A4A";

    // ── Full background ──────────────────────────────────────────
    doc.rect(0, 0, width, height).fill(DARK_BG);

    // ── Top accent bar ───────────────────────────────────────────
    doc.rect(0, 0, width, 5).fill(PURPLE);

    // ── Header card ──────────────────────────────────────────────
    doc.rect(0, 5, width, 88).fill(CARD_BG);

    doc
      .fontSize(9)
      .fillColor(PURPLE)
      .font("Helvetica-Bold")
      .text("MO EVENT SYSTEM", 0, 18, { align: "center", width });

    // Purple underline below brand
    const centerX = width / 2;
    doc
      .moveTo(centerX - 45, 32)
      .lineTo(centerX + 45, 32)
      .strokeColor(PURPLE)
      .lineWidth(0.8)
      .stroke();

    // Event name (wraps if long)
    doc
      .fontSize(15)
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .text(eventName, 24, 42, {
        align: "center",
        width: width - 48,
        ellipsis: true,
        lineBreak: false,
      });

    // ── Dashed separator ─────────────────────────────────────────
    const dashY = 97;
    const totalDashes = 38;
    const dashW = width / totalDashes;
    for (let i = 0; i < totalDashes; i++) {
      if (i % 2 === 0) doc.rect(i * dashW, dashY, dashW * 0.65, 1.5).fill(BORDER);
    }

    // ── QR code section ──────────────────────────────────────────
    const qrSize = 158;
    const qrX = (width - qrSize) / 2;
    const qrY = 112;

    // Glow box
    doc
      .roundedRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 10)
      .fill("#17172B");
    doc
      .roundedRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 8)
      .strokeColor(PURPLE)
      .lineWidth(1.2)
      .stroke();

    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    doc
      .fontSize(8)
      .fillColor(DIM)
      .font("Helvetica")
      .text("SCAN TO VERIFY", 0, qrY + qrSize + 16, {
        align: "center",
        width,
        characterSpacing: 1.5,
      });

    // ── Solid divider ─────────────────────────────────────────────
    const divY = qrY + qrSize + 34;
    doc
      .moveTo(24, divY)
      .lineTo(width - 24, divY)
      .strokeColor(BORDER)
      .lineWidth(0.8)
      .stroke();

    // ── Customer info ─────────────────────────────────────────────
    const infoY = divY + 14;

    doc.fontSize(7.5).fillColor(DIM).font("Helvetica").text("CUSTOMER NAME", 30, infoY, {
      characterSpacing: 0.8,
    });
    doc
      .fontSize(12)
      .fillColor(WHITE)
      .font("Helvetica-Bold")
      .text(customerName, 30, infoY + 11, {
        width: width - 60,
        lineBreak: false,
        ellipsis: true,
      });

    doc.fontSize(7.5).fillColor(DIM).font("Helvetica").text("TICKET ID", 30, infoY + 34, {
      characterSpacing: 0.8,
    });
    doc
      .fontSize(11)
      .fillColor(PURPLE)
      .font("Helvetica-Bold")
      .text(`#${ticketId.slice(0, 8).toUpperCase()}`, 30, infoY + 45);

    // ── Valid badge ───────────────────────────────────────────────
    const badgeY = infoY + 72;
    doc.roundedRect(30, badgeY, 108, 22, 11).fill("#1A1A35");
    doc
      .roundedRect(30, badgeY, 108, 22, 11)
      .strokeColor(PURPLE)
      .lineWidth(0.9)
      .stroke();
    doc
      .fontSize(8.5)
      .fillColor(PURPLE)
      .font("Helvetica-Bold")
      .text("✓  VALID TICKET", 30, badgeY + 6, { align: "center", width: 108 });

    // ── Bottom footer bar ─────────────────────────────────────────
    doc.rect(0, height - 28, width, 28).fill(PANEL_BG);
    doc.rect(0, height - 30, width, 1.5).fill(PURPLE);

    doc
      .fontSize(7)
      .fillColor("#4A4A6A")
      .font("Helvetica")
      .text(
        `Powered by MO Event System  •  ${ticketId}`,
        0,
        height - 17,
        { align: "center", width, characterSpacing: 0.3 },
      );

    doc.end();
  });
}

// ── Email HTML builder ─────────────────────────────────────────────────────────

function buildEmailHtml({
  customerName,
  eventName,
  ticketId,
}: {
  customerName: string;
  eventName: string;
  ticketId: string;
}): string {
  const shortId = `#${ticketId.slice(0, 8).toUpperCase()}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your Ticket – ${eventName}</title>
</head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#1A1A2E;border-radius:16px;overflow:hidden;border:1px solid #2A2A4A;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6D28D9,#8B5CF6);padding:30px 28px;text-align:center;">
      <p style="color:rgba(255,255,255,0.75);font-size:11px;font-weight:700;letter-spacing:3px;margin:0 0 10px;text-transform:uppercase;">MO Event System</p>
      <h1 style="color:#fff;font-size:24px;margin:0;font-weight:800;">Your Ticket is Ready! 🎫</h1>
    </div>
    <!-- Body -->
    <div style="padding:30px 28px;">
      <p style="color:#A0A0B8;font-size:15px;margin:0 0 22px;line-height:1.6;">
        Hi <strong style="color:#fff;">${customerName}</strong>, your ticket for
        <strong style="color:#8B5CF6;">${eventName}</strong> has been confirmed.
      </p>
      <!-- Ticket ID card -->
      <div style="background:#0F0F1A;border:1px solid #2A2A4A;border-left:3px solid #8B5CF6;border-radius:10px;padding:16px 20px;margin-bottom:22px;">
        <p style="color:#6B6B8A;font-size:10px;font-weight:700;letter-spacing:1.5px;margin:0 0 6px;text-transform:uppercase;">Ticket ID</p>
        <p style="color:#8B5CF6;font-size:20px;font-weight:800;margin:0;font-family:monospace;">${shortId}</p>
      </div>
      <p style="color:#6B6B8A;font-size:13px;margin:0;line-height:1.6;">
        📎 Your PDF ticket is attached to this email.<br>
        Please present it (printed or on your phone) at the event entrance.
      </p>
    </div>
    <!-- Footer -->
    <div style="background:#0F0F1A;border-top:1px solid #2A2A4A;padding:16px 28px;text-align:center;">
      <p style="color:#3A3A5A;font-size:11px;margin:0;">© 2025 MO Event System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── POST /api/issue-ticket ─────────────────────────────────────────────────────

router.post("/issue-ticket", async (req, res) => {
  const { customerEmail, customerName, ticketId, eventName } = req.body ?? {};

  // Validate required fields
  if (!customerEmail || !customerName || !ticketId || !eventName) {
    res.status(400).json({
      error: "Missing required fields",
      required: ["customerEmail", "customerName", "ticketId", "eventName"],
    });
    return;
  }

  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey) {
    res.status(500).json({ error: "RESEND_API_KEY is not configured" });
    return;
  }

  try {
    // 1. Generate QR code as PNG buffer
    const qrBuffer = await QRCode.toBuffer(
      JSON.stringify({ ticketId, event: eventName, customer: customerName }),
      {
        width: 200,
        margin: 1,
        color: { dark: "#8B5CF6", light: "#1A1A2E" },
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

    // 3. Send email via Resend
    const resend = new Resend(resendKey);
    const shortId = ticketId.slice(0, 8).toUpperCase();

    const { error: emailError } = await resend.emails.send({
      from: "MO Event System <tickets@moevent.com>",
      to: customerEmail,
      subject: `🎫 Your Ticket for ${eventName} – #${shortId}`,
      html: buildEmailHtml({ customerName, eventName, ticketId }),
      attachments: [
        {
          filename: `ticket-${shortId}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (emailError) {
      res.status(502).json({ error: "Email delivery failed", details: emailError });
      return;
    }

    // 4. Mark ticket as emailed in Supabase (best-effort — won't fail the request)
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (serviceKey) {
      const supabase = createClient(SUPABASE_URL, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: dbErr } = await supabase
        .from("tickets")
        .update({ is_emailed: true })
        .eq("id", ticketId);

      if (dbErr) {
        // Log but don't fail — email already sent
        console.warn(`[issue-ticket] is_emailed update failed: ${dbErr.message}`);
      }
    }

    res.json({
      success: true,
      message: `Ticket emailed to ${customerEmail}`,
      ticketId,
    });
  } catch (err) {
    res.status(500).json({
      error: "Internal server error",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
