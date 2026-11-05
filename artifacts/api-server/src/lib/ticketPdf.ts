import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { TicketTheme } from "./ticketTheme";

export interface PdfTicketInput {
  ticketId: string;
  customerName: string;
  event: { title: string; date: string | null; location: string | null; price: number | null };
  theme: TicketTheme;
  /** "Ticket 2 of 3" when a booking has several. */
  index?: number;
  count?: number;
  brandName: string;
}

export const shortTicketId = (id: string) => id.slice(0, 8).toUpperCase();

export function formatEventDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // Dates are stored as calendar days; read them in UTC like the site does.
  return d.toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function formatPrice(price: number | null): string {
  if (price == null) return "";
  return price === 0 ? "Free" : `RWF ${price.toLocaleString("en-US")}`;
}

/** The QR payload the gate app reads. Keep the shape unchanged. */
export function qrPayload(ticketId: string, eventTitle: string, customerName: string): string {
  return JSON.stringify({ ticketId, event: eventTitle, customer: customerName });
}

// The standard PDF fonts only cover Latin-1; drop anything else so a stray
// emoji can't print as garbage. (Arabic names need an embedded font.)
const latin = (s: string) => s.replace(/[^ -~ -ÿ–—‘’“”•…]/g, "").trim();

function star(doc: PDFKit.PDFDocument, cx: number, cy: number, r: number) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  doc.polygon(...pts);
}

export async function generateTicketPDF(input: PdfTicketInput): Promise<Buffer> {
  const { ticketId, event, theme: th, brandName } = input;
  const qr = await QRCode.toBuffer(qrPayload(ticketId, event.title, input.customerName), {
    width: 360,
    margin: 0,
    color: { dark: "#0A0A0B", light: "#FFFFFF" },
    errorCorrectionLevel: "M",
  });

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A5",
      margin: 0,
      info: { Title: `${th.label} ticket – ${latin(event.title)}`, Author: brandName },
    });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width;
    const H = doc.page.height;
    const PAGE = "#EEEDE9";
    const INK = "#16161A";
    const MUTED = "#85837D";
    const LINE = "#E2E0DA";

    const cx = 22;
    const cy = 22;
    const cw = W - 44;
    const ch = H - 44;
    const R = 16;
    const headerH = 178;
    const perf1 = cy + headerH;
    const perf2 = cy + ch - 92;

    // Page and card
    doc.rect(0, 0, W, H).fill(PAGE);
    doc.roundedRect(cx, cy, cw, ch, R).fill("#FFFFFF");

    // ── Header ────────────────────────────────────────────────────
    doc.save();
    doc.roundedRect(cx, cy, cw, ch, R).clip();
    const grad = doc.linearGradient(cx, cy, cx + cw, cy + headerH);
    grad.stop(0, th.dark).stop(1, th.dark2);
    doc.rect(cx, cy, cw, headerH).fill(grad);

    // Fine diagonal lines on premium tiers.
    if (th.premium) {
      doc.save();
      doc.rect(cx, cy, cw, headerH).clip();
      doc.lineWidth(0.6).strokeColor(th.accent).strokeOpacity(0.14);
      for (let x = cx - headerH; x < cx + cw; x += 11) {
        doc.moveTo(x, cy + headerH).lineTo(x + headerH, cy).stroke();
      }
      doc.restore();
    }
    // Accent rule at the bottom of the header
    doc.rect(cx, perf1 - 4, cw, 4).fill(th.accent);
    doc.restore();

    // Brand
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(th.accent).fillOpacity(1)
      .text(latin(brandName).toUpperCase(), cx + 22, cy + 24, { characterSpacing: 2.4, lineBreak: false });

    // Tier badge
    doc.font("Helvetica-Bold").fontSize(9.5);
    const badgeText = th.label;
    const textW = doc.widthOfString(badgeText, { characterSpacing: 1.6 });
    const iconW = th.premium ? 14 : 0;
    const bw = textW + iconW + 22;
    const bx = cx + cw - 22 - bw;
    const by = cy + 18;
    doc.roundedRect(bx, by, bw, 22, 11).fill(th.accent);
    if (th.premium) {
      star(doc, bx + 15, by + 11, 5.2);
      doc.fill(th.onAccent);
    }
    doc.fillColor(th.onAccent).text(badgeText, bx + 11 + iconW, by + 6.6, { characterSpacing: 1.6, lineBreak: false });

    // Event title (up to two lines)
    doc.font("Helvetica-Bold").fontSize(22).fillColor("#FFFFFF")
      .text(latin(event.title) || "Event", cx + 22, cy + 62, { width: cw - 44, height: 56, ellipsis: true, lineGap: 1 });

    // Tagline + date
    const dateStr = formatEventDate(event.date);
    doc.font("Helvetica").fontSize(10).fillColor("#FFFFFF").fillOpacity(0.78)
      .text([th.tagline, dateStr].filter(Boolean).join("  •  "), cx + 22, cy + 128, { width: cw - 44, lineBreak: false, ellipsis: true });
    if (event.location) {
      doc.text(latin(event.location), cx + 22, cy + 144, { width: cw - 44, lineBreak: false, ellipsis: true });
    }
    doc.fillOpacity(1);

    // ── Perforations ──────────────────────────────────────────────
    const perforate = (y: number) => {
      doc.circle(cx, y, 9).fill(PAGE);
      doc.circle(cx + cw, y, 9).fill(PAGE);
      doc.lineWidth(1.2).strokeColor(LINE).dash(4, { space: 4 })
        .moveTo(cx + 16, y).lineTo(cx + cw - 16, y).stroke().undash();
    };
    perforate(perf2);

    // ── Body: details (left) + QR (right) ─────────────────────────
    const qrBox = 150;
    const qx = cx + cw - 20 - qrBox;
    const qy = perf1 + 22;
    const colX = cx + 22;
    const colW = qx - colX - 14;

    const field = (label: string, value: string, y: number, opts: { w?: number; x?: number; lines?: number; color?: string } = {}) => {
      const x = opts.x ?? colX;
      const w = opts.w ?? colW;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text(label, x, y, { characterSpacing: 1.1, lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(11.5).fillColor(opts.color ?? INK)
        .text(value || "—", x, y + 11, { width: w, height: (opts.lines ?? 1) * 15, ellipsis: true });
    };

    field("TICKET HOLDER", latin(input.customerName), qy, { lines: 2 });
    field("DATE", dateStr.replace(/^\w+, /, ""), qy + 50);
    field("VENUE", latin(event.location ?? ""), qy + 92, { lines: 2 });
    field("TICKET TYPE", th.tagline, qy + 148, { color: th.kind === "vvip" ? "#9A7A12" : th.dark2 });

    // QR panel
    doc.roundedRect(qx, qy, qrBox, qrBox, 12).fill(th.soft);
    doc.roundedRect(qx, qy, qrBox, qrBox, 12).lineWidth(1.4).strokeColor(th.accent).stroke();
    doc.roundedRect(qx + 11, qy + 11, qrBox - 22, qrBox - 22, 6).fill("#FFFFFF");
    doc.image(qr, qx + 16, qy + 16, { width: qrBox - 32, height: qrBox - 32 });
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text("SCAN AT THE ENTRANCE", qx, qy + qrBox + 9, { width: qrBox, align: "center", characterSpacing: 1.1 });

    // Notice strip
    const ny = perf2 - 46;
    doc.roundedRect(colX, ny, cw - 44, 30, 8).fill(th.soft);
    doc.rect(colX, ny, 3, 30).fill(th.accent);
    doc.font("Helvetica").fontSize(8.5).fillColor(INK)
      .text("One entry per ticket. Keep this QR code private: the first scan admits the holder.", colX + 14, ny + 10, { width: cw - 72, lineBreak: false, ellipsis: true });

    // ── Stub ──────────────────────────────────────────────────────
    const sy = perf2 + 18;
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("TICKET NO.", colX, sy, { characterSpacing: 1.1 });
    doc.font("Courier-Bold").fontSize(18).fillColor(INK).text(`#${shortTicketId(ticketId)}`, colX, sy + 11, { lineBreak: false });
    const priceStr = formatPrice(event.price);
    if (priceStr) {
      const pw = 110;
      const px = cx + cw / 2 - pw / 2 + 4;
      doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED).text("PRICE", px, sy, { width: pw, align: "center", characterSpacing: 1.1 });
      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(priceStr, px, sy + 13, { width: pw, align: "center", lineBreak: false });
    }
    const count = input.count ?? 1;
    const right = count > 1 ? `TICKET ${input.index ?? 1} OF ${count}` : "ADMIT ONE";
    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED)
      .text(right, cx + cw - 22 - 140, sy, { width: 140, align: "right", characterSpacing: 1.1 });
    doc.font("Helvetica-Bold").fontSize(13).fillColor(th.kind === "vvip" ? "#9A7A12" : th.dark2)
      .text(th.label, cx + cw - 22 - 140, sy + 12, { width: 140, align: "right", characterSpacing: 1.4 });
    doc.font("Helvetica").fontSize(6.5).fillColor("#A9A79F")
      .text(`${latin(brandName)}  •  ${ticketId}`, cx, cy + ch - 20, { width: cw, align: "center", characterSpacing: 0.3, lineBreak: false });

    // Thin gold inner frame for VVIP
    if (th.kind === "vvip") {
      doc.roundedRect(cx + 6, cy + 6, cw - 12, ch - 12, R - 4).lineWidth(0.8).strokeColor(th.accent).strokeOpacity(0.9).stroke();
      doc.strokeOpacity(1);
      perforate(perf2);
    }

    doc.end();
  });
}
