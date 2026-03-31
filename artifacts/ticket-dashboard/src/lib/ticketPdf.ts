import jsPDF from "jspdf";

interface TicketPdfOptions {
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
}

function addWrappedText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export async function generateTicketPdf(opts: TicketPdfOptions): Promise<Blob> {
  const {
    ticketId, customerName, customerPhone, isScanned,
    eventTitle, eventDate, eventLocation, eventPrice,
    qrDataUrl, systemName,
  } = opts;

  // A6 portrait: 105 × 148 mm
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a6" });
  const W = 105;
  const margin = 8;
  const contentW = W - margin * 2;

  // ── Header ──────────────────────────────────────────────────
  doc.setFillColor(109, 40, 217); // violet-700
  doc.rect(0, 0, W, 40, "F");

  // System name (top)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text((systemName || "TicketHub").toUpperCase(), W / 2, 9, { align: "center" });

  // Thin white rule
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(margin, 11, W - margin, 11);

  // Event title
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  const titleLines: string[] = doc.splitTextToSize(eventTitle, contentW - 4);
  const titleStartY = titleLines.length === 1 ? 22 : 18;
  doc.text(titleLines.slice(0, 2), W / 2, titleStartY, { align: "center" });

  // Date / location
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(210, 180, 255);
  let metaY = titleLines.length === 1 ? 29 : 32;
  const metaParts: string[] = [];
  if (eventDate) {
    const d = new Date(eventDate);
    metaParts.push(d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }));
  }
  if (eventLocation) metaParts.push(eventLocation);
  if (metaParts.length) {
    doc.text(metaParts.join("  |  "), W / 2, metaY, { align: "center" });
    metaY += 5;
  }

  // Price badge
  if (eventPrice != null) {
    const priceStr = eventPrice === 0 ? "FREE" : `RWF ${eventPrice.toLocaleString()}`;
    const badgeW = doc.getTextWidth(priceStr) + 6;
    doc.setFillColor(255, 255, 255);
    doc.setFillColor(139, 92, 246); // violet-500
    doc.roundedRect(W / 2 - badgeW / 2, metaY - 4, badgeW, 6, 1.5, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(priceStr, W / 2, metaY, { align: "center" });
  }

  // ── Dashed separator ────────────────────────────────────────
  const sepY = 42;
  doc.setLineDashPattern([1.5, 1.5], 0);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, sepY, W - margin, sepY);
  doc.setLineDashPattern([], 0);

  // ── Body ─────────────────────────────────────────────────────
  let y = 49;
  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("CUSTOMER", margin, y);

  y += 4;
  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  y = addWrappedText(doc, customerName, margin, y, contentW, 5.5);

  if (customerPhone) {
    y += 1;
    doc.setTextColor(130, 130, 130);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("PHONE", margin, y);
    y += 4;
    doc.setTextColor(20, 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(customerPhone, margin, y);
    y += 6;
  }

  // Ticket ID
  y += 1;
  doc.setTextColor(130, 130, 130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("TICKET ID", margin, y);
  y += 4;
  doc.setTextColor(80, 80, 80);
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.text(ticketId, margin, y);
  y += 6;

  // Status chip
  const scanned = isScanned;
  const chipColor: [number, number, number] = scanned ? [5, 150, 105] : [217, 119, 6];
  doc.setFillColor(...chipColor);
  const chipText = scanned ? "SCANNED" : "NOT SCANNED";
  const chipW = doc.getTextWidth(chipText) + 6;
  doc.roundedRect(margin, y - 3.5, chipW, 6, 1.5, 1.5, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(chipText, margin + 3, y + 0.5);
  y += 7;

  // ── QR Code ──────────────────────────────────────────────────
  if (qrDataUrl) {
    const remaining = 148 - y - 12; // space left before footer
    const qrSize = Math.min(50, remaining - 8);
    if (qrSize > 20) {
      const qrX = (W - qrSize) / 2;
      // White background square for QR
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(qrX - 2, y, qrSize + 4, qrSize + 4, 2, 2, "F");
      doc.addImage(qrDataUrl, "PNG", qrX, y + 2, qrSize, qrSize);
      y += qrSize + 8;
    }
  }

  // ── Footer ───────────────────────────────────────────────────
  doc.setTextColor(180, 180, 180);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("Scan QR code to verify this ticket", W / 2, 143, { align: "center" });

  return doc.output("blob");
}
