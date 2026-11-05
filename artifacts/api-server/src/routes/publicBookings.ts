import { Router, type IRouter, type Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { sendTicketsEmail } from "../lib/ticketEmail";
import { logger } from "../lib/logger";

/**
 * POST /api/public/bookings — the only way the public site can book.
 *
 * The database has no anon write policies; bookings are inserted here with
 * the service role after:
 *   - input validation (same rules as the DB constraints),
 *   - an optional Cloudflare Turnstile check (when TURNSTILE_SECRET_KEY is set),
 *   - per-email and per-phone daily caps (stops seat-hoarding scripts and
 *     using our mailbox to flood someone's inbox),
 *   - a per-IP rate limit (in app.ts).
 * Seat / per-booking limits are still enforced by database triggers.
 *
 * Input is checked by hand rather than with zod: lib/api-zod is on zod 3,
 * which has a memory-exhaustion advisory for oversized collections.
 */

const router: IRouter = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TYPES = new Set(["student", "regular", "organization"]);
const MAX_QUANTITY = 1000; // hard ceiling; the event's own per-booking limit is enforced by the DB

// Per email / per phone, rolling 24 hours.
const DAILY_BOOKINGS = 5;
const DAILY_REQUESTS = 3;

function getAdminClient() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getSupabaseProjectUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface BookingInput {
  eventId: string;
  attendeeType: "student" | "regular" | "organization";
  name: string;
  phone: string;
  email: string;
  quantity: number;
  companyUrl: string | null;
  captchaToken: string | null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function parse(body: unknown): BookingInput | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const eventId = str(b["eventId"]);
  const attendeeType = str(b["attendeeType"]);
  const name = str(b["name"]).replace(/\s+/g, " ");
  const phone = str(b["phone"]);
  const email = str(b["email"]).toLowerCase();
  const quantity = b["quantity"];
  const companyUrl = str(b["companyUrl"]) || null;
  const captchaToken = str(b["captchaToken"]) || null;

  if (!UUID.test(eventId)) return "A valid eventId is required";
  if (!TYPES.has(attendeeType)) return "attendeeType must be student, regular or organization";
  if (name.length < 1 || name.length > 80) return "Name must be 1–80 characters";
  // Control characters would end up in emails and printed tickets.
  if (/[\u0000-\u001f\u007f]/.test(name)) return "Name contains invalid characters";
  if (!/^\+?[\d\s\-()]{9,20}$/.test(phone) || phone.replace(/\D/g, "").length < 9) return "A valid phone number is required";
  if (email.length > 254 || !EMAIL.test(email)) return "A valid email is required";
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return "quantity must be a whole number of 1 or more";
  }
  if (attendeeType === "organization") {
    if (!companyUrl || companyUrl.length > 2048 || !/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(companyUrl)) {
      return "A valid company website (https://…) is required for organizations";
    }
  }
  return {
    eventId,
    attendeeType: attendeeType as BookingInput["attendeeType"],
    name,
    phone,
    email,
    quantity,
    companyUrl: attendeeType === "organization" ? companyUrl : null,
    captchaToken,
  };
}

/** Cloudflare Turnstile. Disabled (always passes) until TURNSTILE_SECRET_KEY is set. */
async function verifyCaptcha(token: string | null, ip: string | undefined): Promise<boolean> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return true;
  if (!token || token.length > 2048) return false;
  try {
    const form = new URLSearchParams({ secret, response: token });
    if (ip) form.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    logger.warn({ err: err instanceof Error ? err.message : err }, "[bookings] captcha verification failed");
    return false;
  }
}

const clientIp = (req: Request) => req.ip;

router.post("/public/bookings", async (req, res) => {
  const input = parse(req.body);
  if (typeof input === "string") {
    res.status(400).json({ error: input });
    return;
  }

  if (!(await verifyCaptcha(input.captchaToken, clientIp(req)))) {
    res.status(403).json({ error: "Bot check failed. Please try again.", code: "captcha" });
    return;
  }

  try {
    const db = getAdminClient();

    // Event must exist and not be over (dates are stored as 00:00 UTC).
    const { data: event, error: eventErr } = await db
      .from("events")
      .select("id, title, event_date, location, price, latitude, longitude")
      .eq("id", input.eventId)
      .maybeSingle();
    if (eventErr) throw new Error(eventErr.message);
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const now = new Date();
    const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    if (event.event_date && new Date(event.event_date).getTime() < todayUtc) {
      res.status(409).json({ error: "This event has ended", code: "ended" });
      return;
    }

    // Daily caps per email and per phone. Tickets from one booking share
    // created_at (one insert statement), so distinct timestamps = bookings.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    if (input.attendeeType === "organization") {
      const [byEmail, byPhone] = await Promise.all([
        db.from("booking_requests").select("id", { count: "exact", head: true }).eq("customer_email", input.email).gte("created_at", since),
        db.from("booking_requests").select("id", { count: "exact", head: true }).eq("customer_phone", input.phone).gte("created_at", since),
      ]);
      if ((byEmail.count ?? 0) >= DAILY_REQUESTS || (byPhone.count ?? 0) >= DAILY_REQUESTS) {
        res.status(429).json({ error: "Too many requests for this email or phone today. Please contact us.", code: "daily_limit" });
        return;
      }
    } else {
      const [byEmail, byPhone] = await Promise.all([
        db.from("tickets").select("created_at").eq("customer_email", input.email).gte("created_at", since).limit(500),
        db.from("tickets").select("created_at").eq("customer_phone", input.phone).gte("created_at", since).limit(500),
      ]);
      const bookings = (rows: { created_at: string }[] | null) => new Set((rows ?? []).map((r) => r.created_at)).size;
      if (bookings(byEmail.data) >= DAILY_BOOKINGS || bookings(byPhone.data) >= DAILY_BOOKINGS) {
        res.status(429).json({ error: "Too many bookings for this email or phone today. Please contact us.", code: "daily_limit" });
        return;
      }
    }

    // Organizations: a request for an admin to approve — no tickets yet.
    if (input.attendeeType === "organization") {
      const id = randomUUID();
      const { error } = await db.from("booking_requests").insert({
        id,
        event_id: input.eventId,
        customer_name: input.name,
        customer_phone: input.phone,
        customer_email: input.email,
        company_url: input.companyUrl,
        quantity: input.quantity,
        status: "pending",
      });
      if (error) return limitOrFail(res, error);
      res.status(201).json({ kind: "request", requestId: id });
      return;
    }

    // Student / Regular: create the tickets, then email them straight away.
    const ids = Array.from({ length: input.quantity }, () => randomUUID());
    const { error } = await db.from("tickets").insert(
      ids.map((id) => ({
        id,
        event_id: input.eventId,
        customer_name: input.name,
        customer_phone: input.phone,
        customer_email: input.email,
        attendee_type: input.attendeeType,
        is_scanned: false,
        is_emailed: false,
        payment_status: "pending",
      })),
    );
    if (error) return limitOrFail(res, error);

    let emailed = false;
    try {
      await sendTicketsEmail({
        to: input.email,
        customerName: input.name,
        event: {
          id: String(event.id),
          title: String(event.title),
          date: (event.event_date as string | null) ?? null,
          location: (event.location as string | null) ?? null,
          price: (event.price as number | null) ?? null,
          latitude: (event.latitude as number | null) ?? null,
          longitude: (event.longitude as number | null) ?? null,
        },
        tickets: ids.map((id) => ({ id, attendeeType: input.attendeeType })),
      });
      await db.from("tickets").update({ is_emailed: true }).in("id", ids);
      emailed = true;
    } catch (err) {
      // The booking stands; staff can resend from the dashboard.
      logger.warn({ err: err instanceof Error ? err.message : err }, "[bookings] ticket email failed");
    }
    res.status(201).json({ kind: "tickets", ticketIds: ids, emailed });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, "[bookings] unexpected error");
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Seat / per-booking limits come from DB triggers (hint = sold_out | max_per_booking). */
function limitOrFail(res: import("express").Response, error: { message: string; hint?: string | null }) {
  if (error.hint === "sold_out" || error.hint === "max_per_booking") {
    res.status(409).json({ error: error.message, code: error.hint });
    return;
  }
  logger.error({ err: error.message }, "[bookings] insert failed");
  res.status(500).json({ error: "Booking failed" });
}

export default router;
