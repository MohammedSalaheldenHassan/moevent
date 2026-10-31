// Opens a print window with a single ticket. Shared by Issue Ticket and Event Detail.

export interface PrintableTicket {
  id: string;
  customer_name: string;
  customer_phone: string | null;
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
  const logo = logoUrl && isImageUrl(logoUrl) ? `<img class="logo" src="${esc(logoUrl)}" alt="" />` : "";
  const dateStr = event.event_date
    ? new Date(event.event_date).toLocaleDateString(isAr ? "ar" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const priceStr = event.price == null ? "" : event.price === 0 ? (isAr ? "مجاني" : "Free") : `RWF ${event.price.toLocaleString()}`;

  win.document.write(`<!DOCTYPE html>
<html dir="${isAr ? "rtl" : "ltr"}" lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${isAr ? "تذكرة" : "Ticket"} ${shortTicketId(ticket.id)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${isAr ? "'IBM Plex Sans Arabic'" : "'IBM Plex Sans'"}, system-ui, sans-serif; color: #111418; background: #f4f3f0; display: flex; justify-content: center; padding: 40px 16px; }
  .ticket { width: 360px; background: #fff; border: 1px solid #dcdad5; border-radius: 10px; overflow: hidden; }
  .top { padding: 22px 24px 20px; }
  .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
  .brand-name { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; }
  .logo { width: 26px; height: 26px; border-radius: 5px; object-fit: contain; background: #000; }
  .admit { font-size: 10px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: #6b6a66; border: 1px solid #dcdad5; border-radius: 4px; padding: 3px 7px; }
  .event { font-size: 20px; font-weight: 600; line-height: 1.25; letter-spacing: -.01em; }
  .meta { margin-top: 8px; font-size: 12.5px; color: #5d5c58; line-height: 1.6; }
  .tear { position: relative; border-top: 1.5px dashed #cfccc6; margin: 0 14px; }
  .tear::before, .tear::after { content: ""; position: absolute; top: -9px; width: 16px; height: 16px; border-radius: 50%; background: #f4f3f0; border: 1px solid #dcdad5; }
  .tear::before { left: -23px; } .tear::after { right: -23px; }
  .bottom { padding: 20px 24px 22px; display: flex; gap: 18px; align-items: flex-start; }
  .fields { flex: 1; min-width: 0; }
  .label { font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #8a8984; margin-bottom: 2px; }
  .value { font-size: 14px; font-weight: 500; margin-bottom: 12px; word-break: break-word; }
  .qr { width: 118px; height: 118px; border: 1px solid #e6e4df; border-radius: 6px; padding: 4px; }
  .id { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #5d5c58; text-align: center; padding: 10px 24px 14px; border-top: 1px solid #eeece8; letter-spacing: .06em; }
  @media print { body { background: #fff; padding: 0; } .ticket { border-color: #bbb; } .tear::before, .tear::after { background: #fff; } }
</style>
</head>
<body>
  <div class="ticket">
    <div class="top">
      <div class="brand">
        <div class="brand-name">${logo}<span>${esc(brandName)}</span></div>
        <span class="admit">${isAr ? "تذكرة دخول" : "Admit one"}</span>
      </div>
      <div class="event">${esc(event.title)}</div>
      <div class="meta">
        ${dateStr ? `<div>${esc(dateStr)}</div>` : ""}
        ${event.location ? `<div>${esc(event.location)}</div>` : ""}
      </div>
    </div>
    <div class="tear"></div>
    <div class="bottom">
      <div class="fields">
        <div class="label">${isAr ? "اسم الحامل" : "Ticket holder"}</div>
        <div class="value">${esc(ticket.customer_name)}</div>
        ${ticket.customer_phone ? `<div class="label">${isAr ? "الهاتف" : "Phone"}</div><div class="value" dir="ltr">${esc(ticket.customer_phone)}</div>` : ""}
        ${priceStr ? `<div class="label">${isAr ? "السعر" : "Price"}</div><div class="value">${esc(priceStr)}</div>` : ""}
      </div>
      ${qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR" />` : ""}
    </div>
    <div class="id">${isAr ? "رقم التذكرة" : "Ticket"} ${shortTicketId(ticket.id)}</div>
  </div>
</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 600);
}
