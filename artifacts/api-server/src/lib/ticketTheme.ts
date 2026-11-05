// One look per ticket type, shared by the PDF ticket and the email.
// Keep in sync with the dashboard's lib/ticketThemes.ts.

export type TicketKind = "student" | "regular" | "organization" | "vip" | "vvip";

export interface TicketTheme {
  kind: TicketKind;
  /** Printed on the ticket, e.g. "VIP". */
  label: string;
  /** Short line under the label. */
  tagline: string;
  /** Header background (dark). */
  dark: string;
  /** Second header colour, for the gradient. */
  dark2: string;
  /** Accent: badge, frame, highlights. */
  accent: string;
  /** Text on the accent colour. */
  onAccent: string;
  /** Light tint of the accent for panels on white. */
  soft: string;
  /** Premium tiers get extra ornament. */
  premium: boolean;
}

export const TICKET_THEMES: Record<TicketKind, TicketTheme> = {
  student: {
    kind: "student", label: "STUDENT", tagline: "Student admission",
    dark: "#0B1F4D", dark2: "#1D4ED8", accent: "#3B82F6", onAccent: "#FFFFFF", soft: "#EAF1FF", premium: false,
  },
  regular: {
    kind: "regular", label: "REGULAR", tagline: "General admission",
    dark: "#2B0F06", dark2: "#B2300A", accent: "#E03A0C", onAccent: "#FFFFFF", soft: "#FDEDE6", premium: false,
  },
  organization: {
    kind: "organization", label: "ORGANIZATION", tagline: "Organization admission",
    dark: "#042F2C", dark2: "#0F766E", accent: "#14B8A6", onAccent: "#042F2C", soft: "#E3F8F5", premium: false,
  },
  vip: {
    kind: "vip", label: "VIP", tagline: "VIP access",
    dark: "#1E0B45", dark2: "#6D28D9", accent: "#A78BFA", onAccent: "#1E0B45", soft: "#F1ECFE", premium: true,
  },
  vvip: {
    kind: "vvip", label: "VVIP", tagline: "Very VIP · All access",
    dark: "#0A0A0B", dark2: "#2A2418", accent: "#D4AF37", onAccent: "#0A0A0B", soft: "#FAF3DC", premium: true,
  },
};

export function ticketTheme(type: string | null | undefined): TicketTheme {
  return TICKET_THEMES[(type ?? "") as TicketKind] ?? TICKET_THEMES.regular;
}
