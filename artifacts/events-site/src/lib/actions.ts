import type { PublicEvent } from "./events";

/** Google Maps link: the exact pin when the event has one, otherwise a search for the venue text. */
export const mapsUrl = (e: Pick<PublicEvent, "location" | "latitude" | "longitude">) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    e.latitude != null && e.longitude != null ? `${e.latitude},${e.longitude}` : (e.location ?? ""),
  )}`;

/** OpenStreetMap embed centred on the pin (no API key needed). */
export function mapEmbedUrl(lat: number, lng: number): string {
  const dLat = 0.004;
  const dLng = 0.006;
  const bbox = [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((n) => n.toFixed(6)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

/** Events are all-day (stored as a date), so calendars get a date-only entry. */
function dateParts(e: PublicEvent): { start: string; end: string } | null {
  if (!e.event_date) return null;
  const d = new Date(e.event_date);
  const fmt = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, "");
  return { start: fmt(d), end: fmt(new Date(d.getTime() + 86_400_000)) };
}

export function googleCalendarUrl(e: PublicEvent, pageUrl: string): string | null {
  const p = dateParts(e);
  if (!p) return null;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${p.start}/${p.end}`,
    details: pageUrl,
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsEscape = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** Downloads an .ics file — opens in Apple Calendar / Outlook. */
export function downloadIcs(e: PublicEvent, pageUrl: string): void {
  const p = dateParts(e);
  if (!p) return;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NexusYouth//Events//EN",
    "BEGIN:VEVENT",
    `UID:${e.id}@moevent`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
    `DTSTART;VALUE=DATE:${p.start}`,
    `DTEND;VALUE=DATE:${p.end}`,
    `SUMMARY:${icsEscape(e.title)}`,
    e.location ? `LOCATION:${icsEscape(e.location)}` : "",
    `URL:${pageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${e.title.replace(/[^\w\- ]+/g, "").trim() || "event"}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Copies text; falls back to execCommand where the Clipboard API is unavailable (plain-http LAN). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/** Native share sheet on phones; copies the link elsewhere. Returns "copied" when it fell back. */
export async function shareLink(title: string, url: string): Promise<"shared" | "copied" | "failed"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title, url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "shared";
    }
  }
  return (await copyText(url)) ? "copied" : "failed";
}

const DETAILS_KEY = "moevent-site-contact";

export interface Contact {
  name: string;
  phone: string;
  email: string;
}

export function loadContact(): Contact {
  const empty: Contact = { name: "", phone: "", email: "" };
  try {
    const v = JSON.parse(localStorage.getItem(DETAILS_KEY) ?? "null");
    if (v && typeof v === "object") {
      // Older saves have no email.
      const pick = (k: keyof Contact) => (typeof v[k] === "string" ? v[k] : "");
      return { name: pick("name"), phone: pick("phone"), email: pick("email") };
    }
  } catch {
    // storage blocked or malformed
  }
  return empty;
}

export function saveContact(contact: Contact): void {
  try {
    localStorage.setItem(DETAILS_KEY, JSON.stringify(contact));
  } catch {
    // ignore
  }
}
