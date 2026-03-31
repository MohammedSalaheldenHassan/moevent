import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface TicketPdfOptions {
  ticketId: string;
  customerName: string;
  customerPhone: string | null;
  isScanned: boolean;
  eventTitle: string;
  eventDate: string | null;
  eventLocation: string | null;
  eventPrice: number | null;
  qrDataUrl: string | null;
  systemName: string;
  systemLogo?: string;
  isAr?: boolean;
}

function buildTicketHTML(opts: TicketPdfOptions): string {
  const {
    ticketId, customerName, customerPhone, isScanned,
    eventTitle, eventDate, eventLocation, eventPrice,
    qrDataUrl, systemName, systemLogo, isAr,
  } = opts;

  const dateStr = eventDate
    ? new Date(eventDate).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "";

  const priceStr = eventPrice != null
    ? (eventPrice === 0
        ? (isAr ? "مجاني" : "Free")
        : `RWF ${eventPrice.toLocaleString()}`)
    : "";

  const logoHtml = systemLogo && systemLogo.startsWith("data:")
    ? `<img src="${systemLogo}" style="width:44px;height:44px;border-radius:12px;object-fit:cover;margin-bottom:6px;display:block;margin-left:auto;margin-right:auto;" />`
    : `<div style="font-size:36px;margin-bottom:4px;text-align:center;">🎫</div>`;

  const statusColor = isScanned ? "#059669" : "#d97706";
  const statusBg   = isScanned ? "#d1fae5" : "#fef3c7";
  const statusText = isScanned
    ? (isAr ? "✓ تم الفحص" : "✓ Scanned")
    : (isAr ? "⏳ لم يُفحص" : "⏳ Not Scanned");

  const dir = isAr ? "rtl" : "ltr";

  return `
    <div style="
      width: 380px;
      font-family: 'Segoe UI', 'Helvetica Neue', Arial, 'Noto Sans Arabic', sans-serif;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      direction: ${dir};
    ">
      <!-- Header -->
      <div style="
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        padding: 28px 24px 22px;
        text-align: center;
      ">
        ${logoHtml}
        <div style="color:rgba(255,255,255,0.75);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">
          ${systemName || "TicketHub"}
        </div>
        <div style="color:#fff;font-size:18px;font-weight:700;line-height:1.35;margin-bottom:10px;">
          ${eventTitle}
        </div>
        ${dateStr || eventLocation ? `
        <div style="color:rgba(255,255,255,0.70);font-size:12px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:8px;">
          ${dateStr ? `<span>📅 ${dateStr}</span>` : ""}
          ${eventLocation ? `<span>📍 ${eventLocation}</span>` : ""}
        </div>` : ""}
        ${priceStr ? `
        <div style="
          display:inline-block;
          background:rgba(255,255,255,0.18);
          border:1px solid rgba(255,255,255,0.25);
          border-radius:999px;
          padding:4px 14px;
          color:#fff;
          font-size:12px;
          font-weight:700;
        ">💰 ${priceStr}</div>` : ""}
      </div>

      <!-- Dashed separator -->
      <div style="
        border-top: 2px dashed #e5e7eb;
        margin: 0 20px;
        position: relative;
      "></div>

      <!-- Body -->
      <div style="padding: 20px 24px 0;">
        <!-- Customer name -->
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
            ${isAr ? "اسم العميل" : "Customer"}
          </div>
          <div style="font-size:17px;font-weight:700;color:#111827;">
            ${customerName}
          </div>
        </div>

        ${customerPhone ? `
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
            ${isAr ? "رقم الهاتف" : "Phone"}
          </div>
          <div style="font-size:14px;color:#374151;direction:ltr;text-align:${isAr ? "right" : "left"};">
            ${customerPhone}
          </div>
        </div>` : ""}

        <!-- Ticket ID -->
        <div style="margin-bottom:14px;">
          <div style="font-size:10px;font-weight:700;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">
            ${isAr ? "رقم التذكرة" : "Ticket ID"}
          </div>
          <div style="font-size:11px;font-family:monospace;color:#6b7280;word-break:break-all;direction:ltr;text-align:${isAr ? "right" : "left"};">
            ${ticketId}
          </div>
        </div>

        <!-- Status -->
        <div style="margin-bottom:18px;">
          <span style="
            display:inline-block;
            background:${statusBg};
            color:${statusColor};
            font-size:12px;
            font-weight:700;
            padding:5px 14px;
            border-radius:999px;
          ">${statusText}</span>
        </div>
      </div>

      <!-- QR Code -->
      ${qrDataUrl ? `
      <div style="display:flex;justify-content:center;padding:0 0 12px;">
        <div style="background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:10px;">
          <img src="${qrDataUrl}" style="width:150px;height:150px;display:block;" />
        </div>
      </div>` : ""}

      <!-- Footer -->
      <div style="
        text-align:center;
        padding:10px 24px 20px;
        font-size:10px;
        color:#d1d5db;
      ">
        ${isAr ? "امسح رمز QR للتحقق من التذكرة" : "Scan QR code to verify this ticket"}
      </div>
    </div>
  `;
}

export async function generateTicketPdf(opts: TicketPdfOptions): Promise<Blob> {
  // 1. Build a hidden DOM element with the ticket HTML
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "position:fixed;left:-9999px;top:-9999px;z-index:-1;";
  wrapper.innerHTML = buildTicketHTML(opts);
  document.body.appendChild(wrapper);

  try {
    // 2. Capture with html2canvas
    const canvas = await html2canvas(wrapper.firstElementChild as HTMLElement, {
      scale: 2,            // 2× for crisp output
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    // 3. Build jsPDF (A5 — good match for the 380px card)
    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pxW = canvas.width;
    const pxH = canvas.height;

    // Convert to mm keeping the aspect ratio, max width 130mm
    const maxW = 130;
    const mmW  = maxW;
    const mmH  = (pxH / pxW) * mmW;

    const doc = new jsPDF({
      orientation: mmH > mmW ? "portrait" : "landscape",
      unit: "mm",
      format: [mmW, mmH],
    });

    doc.addImage(imgData, "JPEG", 0, 0, mmW, mmH);
    return doc.output("blob");
  } finally {
    document.body.removeChild(wrapper);
  }
}
