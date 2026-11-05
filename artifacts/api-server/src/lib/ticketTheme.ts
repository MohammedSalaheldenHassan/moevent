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
    dark: "#0B3B3B", dark2: "#1F7A7A", accent: "#4FBDB3", onAccent: "#0B3B3B", soft: "#E2F1F0", text: "#1F7A7A", premium: false,
  },
  regular: {
    kind: "regular", label: "REGULAR", tagline: "General admission",
    dark: "#0E2A4A", dark2: "#1C4C80", accent: "#8DB4DB", onAccent: "#0E2A4A", soft: "#E8EEF5", text: "#1C4C80", premium: false,
  },
  organization: {
    kind: "organization", label: "ORGANIZATION", tagline: "Organization admission",
    dark: "#2A3A4A", dark2: "#4C6073", accent: "#E6D6C2", onAccent: "#2A3A4A", soft: "#F3ECE2", text: "#4C6073", premium: false,
  },
  vip: {
    kind: "vip", label: "VIP", tagline: "VIP access",
    dark: "#5A3113", dark2: "#C47A3F", accent: "#F2D7B8", onAccent: "#5A3113", soft: "#F7EBDF", text: "#9A5A26", premium: true,
  },
  vvip: {
    kind: "vvip", label: "VVIP", tagline: "Very VIP · All access",
    dark: "#0A0A0B", dark2: "#2A2418", accent: "#D4AF37", onAccent: "#0A0A0B", soft: "#FAF3DC", text: "#8A6D0E", premium: true,
  },
};

export function ticketTheme(type: string | null | undefined): TicketTheme {
  return TICKET_THEMES[(type ?? "") as TicketKind] ?? TICKET_THEMES.regular;
}
