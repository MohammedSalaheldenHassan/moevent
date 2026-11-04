import { useEffect, useState } from "react";
import { ApiError, createBooking, type BookingRequest as BookingBody, type BookingResult } from "@workspace/api-client-react";
import { supabase } from "./supabase";
import { siteConfig } from "@/config/site";

export interface PublicEvent {
  id: string;
  title: string;
  event_date: string | null;
  location: string | null;
  price: number | null;
  image_url: string | null;
  description: string | null;
  /** Venue pin set on the dashboard's map; both null when not set. */
  latitude: number | null;
  longitude: number | null;
}

const EVENT_COLUMNS = "id, title, event_date, location, price, image_url, description, latitude, longitude";

type Load<T> = { data: T; loading: boolean; error: string | null };

export function useEvents(): Load<PublicEvent[]> & { reload: () => void } {
  const [state, setState] = useState<Load<PublicEvent[]>>({ data: [], loading: true, error: null });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .order("event_date", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        setState({ data: (data ?? []) as PublicEvent[], loading: false, error: error?.message ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

export function useEvent(id: string): Load<PublicEvent | null> {
  const [state, setState] = useState<Load<PublicEvent | null>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    // Not a UUID -> the query would 400; treat it as not found instead.
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setState({ data: (data as PublicEvent | null) ?? null, loading: false, error: error?.message ?? null });
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

const DAY = 86_400_000;

/** Today's date as midnight UTC, the same convention event_date is stored in. */
function todayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Whole days from today until the event (0 = today, negative = past); null when undated. */
export function daysUntil(e: PublicEvent): number | null {
  if (!e.event_date) return null;
  return Math.round((new Date(e.event_date).getTime() - todayUtc()) / DAY);
}

export const isPast = (e: PublicEvent) => (daysUntil(e) ?? 0) < 0;

export type RangeFilter = "all" | "week" | "month";

export function inRange(e: PublicEvent, range: RangeFilter): boolean {
  if (range === "all") return true;
  const d = daysUntil(e);
  if (d == null) return false;
  if (range === "week") return d <= 7;
  const now = new Date();
  const date = new Date(e.event_date!);
  return date.getUTCFullYear() === now.getFullYear() && date.getUTCMonth() === now.getMonth();
}

export const MAX_TICKETS = siteConfig.maxTicketsPerBooking;

/** Matches the tickets_attendee_type_check constraint. */
export const ATTENDEE_TYPES = ["student", "regular", "organization"] as const;
export type AttendeeType = (typeof ATTENDEE_TYPES)[number];

export interface TypeAvailability {
  capacity: number | null;
  sold: number;
  /** null = unlimited */
  remaining: number | null;
  maxPerBooking: number;
}

/**
 * Seats left and per-booking limit for each ticket type of one event, from
 * the public event_ticket_availability() function (counts only).
 */
export function useAvailability(eventId: string | undefined) {
  const [data, setData] = useState<Record<AttendeeType, TypeAvailability> | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    supabase.rpc("event_ticket_availability", { p_event_id: eventId }).then(({ data: rows, error }) => {
      if (cancelled || error || !rows) return;
      const out = {} as Record<AttendeeType, TypeAvailability>;
      for (const r of rows as { attendee_type: AttendeeType; capacity: number | null; sold: number; max_per_booking: number | null }[]) {
        out[r.attendee_type] = {
          capacity: r.capacity,
          sold: r.sold,
          remaining: r.capacity == null ? null : Math.max(0, r.capacity - r.sold),
          maxPerBooking: r.max_per_booking ?? MAX_TICKETS,
        };
      }
      setData(out);
    });
    return () => {
      cancelled = true;
    };
  }, [eventId, nonce]);

  return { availability: data, refresh: () => setNonce((n) => n + 1) };
}

export type BookingErrorCode = "sold_out" | "max_per_booking" | "ended" | "daily_limit" | "rate_limit" | "captcha" | "failed";

/** A booking the server refused, with a reason the form can explain. */
export class BookingError extends Error {
  constructor(public code: BookingErrorCode, message: string) {
    super(message);
  }
}

const KNOWN_CODES = new Set<BookingErrorCode>(["sold_out", "max_per_booking", "ended", "daily_limit", "captcha"]);

/**
 * Books through the API — the only path that can write bookings (the database
 * has no public write access). Student / Regular get tickets emailed straight
 * away; Organization gets a request an admin must approve.
 */
export async function submitBooking(body: BookingBody): Promise<BookingResult> {
  try {
    return await createBooking(body);
  } catch (err) {
    if (err instanceof ApiError) {
      const code = (err.data as { code?: string } | null)?.code as BookingErrorCode | undefined;
      if (code && KNOWN_CODES.has(code)) throw new BookingError(code, err.message);
      if (err.status === 429) throw new BookingError("rate_limit", err.message);
    }
    throw new BookingError("failed", err instanceof Error ? err.message : String(err));
  }
}

/** Same rule as the tickets_customer_email_check constraint. */
export const isValidEmail = (v: string) => v.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

/**
 * Accepts "acme.com" or a full link; returns a normalised https URL, or null
 * when it isn't a plausible website (same rule as the company_url constraint).
 */
export function normalizeCompanyUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || /\s/.test(withScheme)) return null;
    const out = u.toString();
    return out.length <= 2048 ? out : null;
  } catch {
    return null;
  }
}

export const shortRef = (id: string) => id.slice(0, 8).toUpperCase();
