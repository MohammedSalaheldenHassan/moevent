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
    dark: "#0B1F4D", dark2: "#1D4ED8", accent: "#3B82F6", onAccent: "#FFFFFF", soft: "#EAF1FF", text: "#1D4ED8", premium: false,
  },
  regular: {
    kind: "regular", label: "REGULAR", name: { en: "Regular", ar: "عادي" },
    tagline: { en: "General admission", ar: "دخول عام" },
    dark: "#2B0F06", dark2: "#B2300A", accent: "#E03A0C", onAccent: "#FFFFFF", soft: "#FDEDE6", text: "#B2300A", premium: false,
  },
  organization: {
    kind: "organization", label: "ORGANIZATION", name: { en: "Organization", ar: "مؤسسة" },
    tagline: { en: "Organization admission", ar: "دخول مؤسسة" },
    dark: "#042F2C", dark2: "#0F766E", accent: "#14B8A6", onAccent: "#042F2C", soft: "#E3F8F5", text: "#0F766E", premium: false,
  },
  vip: {
    kind: "vip", label: "VIP", name: { en: "VIP", ar: "VIP" },
    tagline: { en: "VIP access", ar: "دخول VIP" },
    dark: "#1E0B45", dark2: "#6D28D9", accent: "#A78BFA", onAccent: "#1E0B45", soft: "#F1ECFE", text: "#6D28D9", premium: true,
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
