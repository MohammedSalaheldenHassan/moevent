// One look per ticket type for the printed ticket and the Issue Ticket preview.
// Same palette as the emailed PDF: api-server/src/lib/ticketTheme.ts.

export type TicketKind = "student" | "regular" | "organization" | "vip" | "vvip";

export interface TicketTheme {
  kind: TicketKind;
  label: string;
  tagline: { en: string; ar: string };
  name: { en: string; ar: string };
  dark: string;
  dark2: string;
  accent: string;
  onAccent: string;
  soft: string;
  /** Accent readable on white (gold is too light as text). */
  text: string;
  premium: boolean;
}

export const TICKET_THEMES: Record<TicketKind, TicketTheme> = {
  student: {
    kind: "student", label: "STUDENT", name: { en: "Student", ar: "طالب" },
    tagline: { en: "Student admission", ar: "دخول طالب" },
    dark: "#0C3437", dark2: "#1E5C61", accent: "#6FC1B8", onAccent: "#0C3437", soft: "#E1F0EE", text: "#1E5C61", premium: false,
  },
  regular: {
    kind: "regular", label: "REGULAR", name: { en: "Regular", ar: "عادي" },
    tagline: { en: "General admission", ar: "دخول عام" },
    dark: "#001F3B", dark2: "#0B3A66", accent: "#E07B2E", onAccent: "#001F3B", soft: "#E7EDF4", text: "#0B3A66", premium: false,
  },
  organization: {
    kind: "organization", label: "ORGANIZATION", name: { en: "Organization", ar: "مؤسسة" },
    tagline: { en: "Organization admission", ar: "دخول مؤسسة" },
    dark: "#2A3A4A", dark2: "#4C6073", accent: "#ECD4BD", onAccent: "#2A3A4A", soft: "#F3ECE2", text: "#4C6073", premium: false,
  },
  vip: {
    kind: "vip", label: "VIP", name: { en: "VIP", ar: "VIP" },
    tagline: { en: "VIP access", ar: "دخول VIP" },
    dark: "#5A2E0E", dark2: "#E07B2E", accent: "#FBE1C6", onAccent: "#5A2E0E", soft: "#FBE8D6", text: "#A8521A", premium: true,
  },
  vvip: {
    kind: "vvip", label: "VVIP", name: { en: "VVIP", ar: "VVIP" },
    tagline: { en: "Very VIP · All access", ar: "VVIP · دخول كامل" },
    dark: "#0A0A0B", dark2: "#2A2418", accent: "#D4AF37", onAccent: "#0A0A0B", soft: "#FAF3DC", text: "#8A6D0E", premium: true,
  },
};

export function ticketTheme(type: string | null | undefined): TicketTheme {
  return TICKET_THEMES[(type ?? "") as TicketKind] ?? TICKET_THEMES.regular;
}

/** Types the dashboard can issue; the rest are booked on the public site. */
export const ISSUABLE_TYPES = ["vip", "vvip"] as const;
export type IssuableType = (typeof ISSUABLE_TYPES)[number];

// ── Counts by ticket type ─────────────────────────────────────────────────────

export const TYPE_ORDER: TicketKind[] = ["student", "regular", "organization", "vip", "vvip"];

export const typeLabel = (type: TicketKind | null, lang: "en" | "ar") =>
  type ? TICKET_THEMES[type].name[lang] : lang === "ar" ? "غير محدد" : "Not set";

/** Admin-set seat limits on the event; null = no limit. VIP and VVIP never have one. */
export interface EventCapacities {
  capacity_student?: number | null;
  capacity_regular?: number | null;
  capacity_organization?: number | null;
}

export interface TypeSummaryRow {
  type: TicketKind | null;
  total: number;
  scanned: number;
  capacity: number | null;
  left: number | null;
}

/**
 * Every public type and every type actually sold; VIP / VVIP and untyped older
 * tickets only appear once there's at least one.
 */
export function summarizeTypes(
  tickets: { attendee_type: TicketKind | null; is_scanned: boolean | null }[],
  event: EventCapacities,
): { rows: TypeSummaryRow[]; total: number; scanned: number } {
  const counts = new Map<TicketKind | null, { total: number; scanned: number }>();
  for (const t of tickets) {
    const c = counts.get(t.attendee_type) ?? { total: 0, scanned: 0 };
    c.total += 1;
    if (t.is_scanned) c.scanned += 1;
    counts.set(t.attendee_type, c);
  }
  const capacityOf = (type: TicketKind | null): number | null =>
    type === "student" ? event.capacity_student ?? null
    : type === "regular" ? event.capacity_regular ?? null
    : type === "organization" ? event.capacity_organization ?? null
    : null;
  const types: (TicketKind | null)[] = TYPE_ORDER.filter(
    (t) => t === "student" || t === "regular" || t === "organization" || counts.has(t),
  );
  if (counts.has(null)) types.push(null);
  const rows = types.map((type) => {
    const c = counts.get(type) ?? { total: 0, scanned: 0 };
    const capacity = capacityOf(type);
    return { type, ...c, capacity, left: capacity == null ? null : Math.max(0, capacity - c.total) };
  });
  return {
    rows,
    total: tickets.length,
    scanned: tickets.reduce((n, t) => n + (t.is_scanned ? 1 : 0), 0),
  };
}
