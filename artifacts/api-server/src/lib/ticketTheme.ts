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
  /** Type colour that stays readable as text on white. */
  text: string;
  /** Premium tiers get extra ornament. */
  premium: boolean;
}

// Built from the Nexus Youth palette: Nile Blue, Teal, Sand, Copper, Ivory.
export const TICKET_THEMES: Record<TicketKind, TicketTheme> = {
  student: {
    kind: "student", label: "STUDENT", tagline: "Student admission",
    dark: "#0C3437", dark2: "#1E5C61", accent: "#6FC1B8", onAccent: "#0C3437", soft: "#E1F0EE", text: "#1E5C61", premium: false,
  },
  regular: {
    kind: "regular", label: "REGULAR", tagline: "General admission",
    dark: "#001F3B", dark2: "#0B3A66", accent: "#E07B2E", onAccent: "#001F3B", soft: "#E7EDF4", text: "#0B3A66", premium: false,
  },
  organization: {
    kind: "organization", label: "ORGANIZATION", tagline: "Organization admission",
    dark: "#2A3A4A", dark2: "#4C6073", accent: "#ECD4BD", onAccent: "#2A3A4A", soft: "#F3ECE2", text: "#4C6073", premium: false,
  },
  vip: {
    kind: "vip", label: "VIP", tagline: "VIP access",
    dark: "#5A2E0E", dark2: "#E07B2E", accent: "#FBE1C6", onAccent: "#5A2E0E", soft: "#FBE8D6", text: "#A8521A", premium: true,
  },
  vvip: {
    kind: "vvip", label: "VVIP", tagline: "Very VIP · All access",
    dark: "#0A0A0B", dark2: "#2A2418", accent: "#D4AF37", onAccent: "#0A0A0B", soft: "#FAF3DC", text: "#8A6D0E", premium: true,
  },
};

export function ticketTheme(type: string | null | undefined): TicketTheme {
  return TICKET_THEMES[(type ?? "") as TicketKind] ?? TICKET_THEMES.regular;
}
