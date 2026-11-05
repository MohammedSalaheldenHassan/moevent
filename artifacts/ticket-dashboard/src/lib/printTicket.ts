// Opens a print window with a single ticket. Shared by Issue Ticket and Event Detail.
// Styled per ticket type (lib/ticketThemes.ts), like the emailed PDF.

import { ticketTheme } from "./ticketThemes";

export interface PrintableTicket {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  attendee_type?: string | null;
}

export interface PrintableEvent {
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const isImageUrl = (v: string) => v.startsWith("data:image/") || v.startsWith("https://") || v.startsWith("/");

export const shortTicketId = (id: string) => id.slice(0, 8).toUpperCase();

export function printTicket({
  lang, brandName, logoUrl, ticket, event, qrDataUrl,
}: {
  lang: "en" | "ar";
  brandName: string;
  logoUrl: string;
  ticket: PrintableTicket;
  event: PrintableEvent;
  qrDataUrl: string;
}) {
  const win = window.open("", "_blank");
  if (!win) return;
  const isAr = lang === "ar";
  const esc = (v: string | null | undefined) => escapeHtml(v ?? "");
  const logo = `<img class="logo" src="${esc(logoUrl && isImageUrl(logoUrl) ? logoUrl : `${window.location.origin}/logo.png`)}" alt="" />`;
  const dateStr = event.event_date
    ? new Date(event.event_date).toLocaleDateString(isAr ? "ar" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const priceStr = event.price == null ? "" : event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString()}`;

  const th = ticketTheme(ticket.attendee_type);
  const L = isAr ? "ar" : "en";
  const star = th.premium ? "&#9733; " : "";
  const header = th.premium
    ? `repeating-linear-gradient(135deg, transparent 0 11px, ${th.accent}24 11px 12px), linear-gradient(135deg, ${th.dark}, ${th.dark2})`
    : `linear-gradient(135deg, ${th.dark}, ${th.dark2})`;

  win.document.write(`<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${th.label} ${isAr ? "تذكرة" : "ticket"} ${shortTicketId(ticket.id)}</title>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Cairo:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ${isAr ? "'Cairo'" : "'Montserrat'"}, system-ui, sans-serif; color: #0E2A4A; background: #F8F6F2; display: flex; justify-content: center; padding: 40px 16px; }
  .ticket { position: relative; width: 380px; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.06), 0 8px 28px rgba(0,0,0,.08); ${th.kind === "vvip" ? `outline: 1px solid ${th.accent}; outline-offset: -6px;` : ""} }
  .top { padding: 22px 24px 20px; color: #fff; background: ${header}; border-bottom: 4px solid ${th.accent}; }
  .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .brand-name { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; color: ${th.accent}; }
  .logo { width: 24px; height: 24px; border-radius: 5px; object-fit: contain; background: #000; }
  .badge { font-size: 10.5px; font-weight: 700; letter-spacing: .14em; color: ${th.onAccent}; background: ${th.accent}; border-radius: 999px; padding: 4px 11px; white-space: nowrap; }
  .event { font-size: 21px; font-weight: 700; line-height: 1.25; letter-spacing: -.01em; }
  .meta { margin-top: 8px; font-size: 12.5px; color: rgba(255,255,255,.78); line-height: 1.6; }
  .bottom { padding: 20px 24px 18px; display: flex; gap: 18px; align-items: flex-start; }
  .fields { flex: 1; min-width: 0; }
  .label { font-size: 9.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #5C6B7B; margin-bottom: 2px; }
  .value { font-size: 14px; font-weight: 600; margin-bottom: 12px; word-break: break-word; }
  .type { color: ${th.text}; }
  .qrbox { flex-shrink: 0; text-align: center; }
  .qr { width: 124px; height: 124px; background: #fff; border: 2px solid ${th.accent}; outline: 6px solid ${th.soft}; border-radius: 10px; padding: 6px; margin: 6px; }
  .scan { margin-top: 6px; font-size: 8.5px; font-weight: 700; letter-spacing: .1em; color: #5C6B7B; }
  .stub { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 24px 14px; border-top: 1.5px dashed #E6D6C2; background: ${th.soft}; }
  .stub::before, .stub::after { content: ""; position: absolute; top: -9px; width: 16px; height: 16px; border-radius: 50%; background: #F8F6F2; }
  .stub::before { left: -8px; } .stub::after { right: -8px; }
  .id { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 15px; font-weight: 600; letter-spacing: .06em; }
  .tier { font-size: 13px; font-weight: 700; letter-spacing: .14em; color: ${th.text}; }
  @media print { body { background: #fff; padding: 0; } .ticket { box-shadow: none; border: 1px solid #ccc; } .stub::before, .stub::after { background: #fff; } }
</style>
</head>
<body>
  <div class="ticket">
    <div class="top">
      <div class="brand">
        <div class="brand-name">${logo}<span>${esc(brandName)}</span></div>
        <span class="badge">${star}${th.label}</span>
      </div>
      <div class="event">${esc(event.title)}</div>
      <div class="meta">
        ${dateStr ? `<div>${esc(dateStr)}</div>` : ""}
        ${event.location ? `<div>${esc(event.location)}</div>` : ""}
      </div>
    </div>
    <div class="bottom">
      <div class="fields">
        <div class="label">${isAr ? "اسم الحامل" : "Ticket holder"}</div>
        <div class="value">${esc(ticket.customer_name)}</div>
        <div class="label">${isAr ? "نوع التذكرة" : "Ticket type"}</div>
        <div class="value type">${esc(th.tagline[L])}</div>
        ${ticket.customer_phone ? `<div class="label">${isAr ? "الهاتف" : "Phone"}</div><div class="value" dir="ltr">${esc(ticket.customer_phone)}</div>` : ""}
        ${priceStr ? `<div class="label">${isAr ? "السعر" : "Price"}</div><div class="value">${esc(priceStr)}</div>` : ""}
      </div>
      ${qrDataUrl ? `<div class="qrbox"><img class="qr" src="${qrDataUrl}" alt="QR" /><div class="scan">${isAr ? "امسح عند الدخول" : "SCAN AT THE ENTRANCE"}</div></div>` : ""}
    </div>
    <div class="stub">
      <span class="id">#${shortTicketId(ticket.id)}</span>
      <span class="tier">${star}${th.label}</span>
    </div>
  </div>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 600);
}
