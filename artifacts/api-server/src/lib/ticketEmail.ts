import nodemailer from "nodemailer";
import { formatEventDate, formatPrice, generateTicketPDF, shortTicketId } from "./ticketPdf";
import { ticketTheme, type TicketTheme } from "./ticketTheme";

export { generateTicketPDF } from "./ticketPdf";

const BRAND = () => process.env["BRAND_NAME"]?.trim() || "Nexus Youth";

export interface EmailEvent {
  id?: string;
  title: string;
  date: string | null;
  location: string | null;
  price: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface EmailTicket {
  id: string;
  attendeeType: string | null;
}

// ── Email HTML ─────────────────────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mapsUrl(e: EmailEvent): string | null {
  if (e.latitude != null && e.longitude != null) {
    return `https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}`;
  }
  return e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : null;
}

function eventUrl(e: EmailEvent): string | null {
  const site = process.env["PUBLIC_SITE_URL"]?.trim().replace(/\/+$/, "");
  return site && e.id && /^https:\/\//.test(site) ? `${site}/events/${encodeURIComponent(e.id)}` : null;
}

/**
 * Table-based, inline-styled HTML so it renders the same in Gmail, Outlook and
 * Apple Mail. Coloured by the booking's ticket type.
 */
export function buildEmailHtml({
  customerName,
  event,
  tickets,
}: {
  customerName: string;
  event: EmailEvent;
  tickets: EmailTicket[];
}): string {
  const brand = escapeHtml(BRAND());
  const th: TicketTheme = ticketTheme(tickets[0]?.attendeeType);
  const many = tickets.length > 1;
  const name = escapeHtml(customerName.trim().split(/\s+/)[0] || customerName);
  const title = escapeHtml(event.title);
  const date = escapeHtml(formatEventDate(event.date));
  const venue = escapeHtml(event.location ?? "");
  const price = escapeHtml(formatPrice(event.price));
  const maps = mapsUrl(event);
  const link = eventUrl(event);
  const year = new Date().getUTCFullYear();
  const font = "Montserrat,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  const tierText = th.text;
  const site = process.env["PUBLIC_SITE_URL"]?.trim().replace(/\/+$/, "");
  const logo = site && /^https:\/\//.test(site) ? `${site}/brand/logo-email.png` : null;

  const preheader = `${many ? `Your ${tickets.length} tickets are` : "Your ticket is"} attached. Show the QR code at the entrance.`;

  const row = (label: string, value: string, extra = "") => `
              <tr>
                <td style="padding:12px 0;border-bottom:1px solid #EFE9DF;font:600 11px/1.4 ${font};letter-spacing:.08em;text-transform:uppercase;color:#5C6B7B;width:38%;vertical-align:top;">${label}</td>
                <td style="padding:12px 0;border-bottom:1px solid #EFE9DF;font:500 15px/1.45 ${font};color:#0E2A4A;vertical-align:top;">${value}${extra}</td>
              </tr>`;

  const ticketRows = tickets
    .map((t, i) => {
      const tt = ticketTheme(t.attendeeType);
      return `
              <tr>
                <td style="padding:10px 14px;border-top:${i ? "1px solid #EFE9DF" : "0"};font:600 16px/1.3 'SFMono-Regular',Menlo,Consolas,monospace;letter-spacing:.06em;color:#0E2A4A;">#${shortTicketId(t.id)}</td>
                <td align="right" style="padding:10px 14px;border-top:${i ? "1px solid #EFE9DF" : "0"};">
                  <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${tt.accent};color:${tt.onAccent};font:700 11px/1.2 ${font};letter-spacing:.12em;">${tt.premium ? "&#9733; " : ""}${tt.label}</span>
                </td>
              </tr>`;
    })
    .join("");

  const step = (n: number, text: string) => `
              <tr>
                <td width="34" style="padding:6px 0;vertical-align:top;">
                  <div style="width:24px;height:24px;border-radius:12px;background:${th.soft};color:${tierText};font:700 12px/24px ${font};text-align:center;">${n}</div>
                </td>
                <td style="padding:6px 0;font:400 14px/1.55 ${font};color:#33475E;vertical-align:top;">${text}</td>
              </tr>`;

  const button = (href: string, label: string, primary: boolean) =>
    `<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;margin:4px 6px 4px 0;padding:12px 20px;border-radius:10px;font:600 14px/1 ${font};text-decoration:none;${
      primary ? `background:#0E2A4A;color:#FFFFFF;` : `background:#FFFFFF;color:#0E2A4A;border:1px solid #CFC4B2;`
    }">${label}</a>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <title>${many ? "Your tickets" : "Your ticket"} – ${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8F6F2;-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8F6F2;">
    <tr>
      <td align="center" style="padding:28px 12px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Brand -->
          <tr>
            <td style="padding:0 6px 16px;">
              ${logo
                ? `<img src="${escapeHtml(logo)}" width="146" height="36" alt="${brand}" style="display:block;border:0;">`
                : `<span style="font:800 18px/1 ${font};color:#0E2A4A;">${brand}</span>`}
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#FFFFFF;border-radius:18px;overflow:hidden;border:1px solid #E8E1D6;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Hero -->
                <tr>
                  <td style="background-color:${th.dark};background-image:linear-gradient(135deg,${th.dark} 0%,${th.dark2} 100%);padding:30px 28px 28px;border-bottom:4px solid ${th.accent};">
                    <span style="display:inline-block;padding:5px 12px;border-radius:999px;background:${th.accent};color:${th.onAccent};font:700 11px/1.2 ${font};letter-spacing:.16em;">${th.premium ? "&#9733; " : ""}${th.label}</span>
                    <h1 style="margin:18px 0 6px;font:700 26px/1.25 ${font};color:#FFFFFF;letter-spacing:-.01em;">You're in, ${name}!</h1>
                    <p style="margin:0;font:400 15px/1.5 ${font};color:rgba(255,255,255,.82);">
                      ${many ? `Your <strong style="color:#fff;">${tickets.length} tickets</strong> for` : "Your ticket for"} <strong style="color:#fff;">${title}</strong> ${many ? "are" : "is"} confirmed.
                    </p>
                  </td>
                </tr>

                <!-- Details -->
                <tr>
                  <td style="padding:10px 28px 4px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${row("Event", `<strong>${title}</strong>`)}
                      ${date ? row("Date", date) : ""}
                      ${venue ? row("Venue", venue, maps ? `<br><a href="${escapeHtml(maps)}" target="_blank" style="font:600 13px/1.8 ${font};color:${tierText};text-decoration:none;">Open in Maps &rarr;</a>` : "") : ""}
                      ${row("Ticket type", `<span style="color:${tierText};font-weight:700;">${escapeHtml(th.tagline)}</span>`)}
                      ${price ? row(many ? "Price each" : "Price", price) : ""}
                    </table>
                  </td>
                </tr>

                <!-- Ticket numbers -->
                <tr>
                  <td style="padding:20px 28px 4px;">
                    <p style="margin:0 0 8px;font:600 11px/1.4 ${font};letter-spacing:.08em;text-transform:uppercase;color:#5C6B7B;">${many ? "Your tickets" : "Your ticket"}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${th.soft};border-radius:12px;border-left:4px solid ${th.accent};">
                      ${ticketRows}
                    </table>
                  </td>
                </tr>

                <!-- How to enter -->
                <tr>
                  <td style="padding:22px 28px 6px;">
                    <p style="margin:0 0 6px;font:700 16px/1.4 ${font};color:#0E2A4A;">At the entrance</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${step(1, `Open the attached PDF ${many ? "tickets" : "ticket"} &mdash; on your phone or printed.`)}
                      ${step(2, `Show the QR code to the staff at the door. ${many ? "Each guest needs their own ticket." : ""}`)}
                      ${step(3, "Keep it private: each QR code admits one person, once.")}
                    </table>
                  </td>
                </tr>

                ${maps || link ? `
                <!-- Actions -->
                <tr>
                  <td style="padding:14px 28px 6px;">
                    ${link ? button(link, "View event", true) : ""}${maps ? button(maps, "Get directions", !link) : ""}
                  </td>
                </tr>` : ""}

                <tr>
                  <td style="padding:18px 28px 26px;font:400 13px/1.6 ${font};color:#5C6B7B;">
                    Can't attend or something's wrong? Just reply to this email and we'll help.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:18px 12px 0;font:400 12px/1.6 ${font};color:#8C97A3;">
              You received this email because a ticket was booked with this address.<br>
              &copy; ${year} ${brand}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Mail transport ─────────────────────────────────────────────────────────────
// Two options:
//  • BREVO_API_KEY (+ MAIL_FROM): sends over HTTPS through Brevo's API. Use this
//    on hosts that block outgoing SMTP (Railway Free/Hobby blocks ports 25/465/587).
//  • SMTP_USER / SMTP_PASS (+ SMTP_FROM): plain SMTP, Gmail by default.
// MAIL_FROM / SMTP_FROM look like "Nexus Youth <tickets@gmail.com>".

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  attachments: { filename: string; content: Buffer; contentType: string }[];
};

export type Mailer = { send: (msg: MailMessage) => Promise<void> };

function parseFrom(from: string): { name?: string; email: string } {
  // Accepts "Name <a@b.com>", "Name a@b.com" or just "a@b.com".
  const email = /[^\s<>"]+@[^\s<>"]+/.exec(from)?.[0] ?? from.trim();
  const name = from.replace(email, "").replace(/[<>"]/g, "").trim();
  return name ? { name, email } : { email };
}

export function getMailer(): Mailer | null {
  const brevoKey = process.env["BREVO_API_KEY"]?.trim();
  if (brevoKey) {
    const from = process.env["MAIL_FROM"] || process.env["SMTP_FROM"] || process.env["SMTP_USER"];
    if (!from) return null;
    const sender = parseFrom(from);
    return {
      async send(msg) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": brevoKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender,
            to: [{ email: msg.to }],
            subject: msg.subject,
            htmlContent: msg.html,
            attachment: msg.attachments.map((a) => ({ name: a.filename, content: a.content.toString("base64") })),
          }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) {
          const detail = (await res.text().catch(() => "")).slice(0, 300);
          throw new Error(`Brevo API ${res.status}: ${detail}`);
        }
      },
    };
  }

  const user = process.env["SMTP_USER"];
  const pass = process.env["SMTP_PASS"];
  if (!user || !pass) return null;
  const port = Number(process.env["SMTP_PORT"] ?? 465);
  const from = process.env["SMTP_FROM"] || user;
  const transport = nodemailer.createTransport({
    host: process.env["SMTP_HOST"] ?? "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user, pass },
    // Fail fast instead of hanging a booking for minutes when SMTP is blocked.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(msg) {
      await transport.sendMail({ from, ...msg });
    },
  };
}

// ── Send ───────────────────────────────────────────────────────────────────────

/**
 * Emails one booking's tickets in a single message: one PDF (with its QR) per
 * ticket, each designed for its ticket type.
 */
export async function sendTicketsEmail({
  to,
  customerName,
  event,
  tickets,
}: {
  to: string;
  customerName: string;
  event: EmailEvent;
  tickets: EmailTicket[];
}): Promise<void> {
  const mailer = getMailer();
  if (!mailer) throw new Error("Email sending is not configured on the server");
  if (tickets.length === 0) return;

  const brandName = BRAND();
  const attachments = await Promise.all(
    tickets.map(async (t, i) => {
      const theme = ticketTheme(t.attendeeType);
      const content = await generateTicketPDF({
        ticketId: t.id,
        customerName,
        event: { title: event.title, date: event.date, location: event.location, price: event.price },
        theme,
        index: i + 1,
        count: tickets.length,
        brandName,
      });
      return {
        filename: `${theme.label.toLowerCase()}-ticket-${shortTicketId(t.id)}.pdf`,
        content,
        contentType: "application/pdf",
      };
    }),
  );

  const th = ticketTheme(tickets[0]!.attendeeType);
  const first = shortTicketId(tickets[0]!.id);
  await mailer.send({
    to,
    subject:
      tickets.length > 1
        ? `Your ${tickets.length} ${th.label} tickets for ${event.title} – #${first}`
        : `Your ${th.label} ticket for ${event.title} – #${first}`,
    html: buildEmailHtml({ customerName, event, tickets }),
    attachments,
  });
}
