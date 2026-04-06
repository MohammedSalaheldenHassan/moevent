import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const SUPABASE_URL = "https://lzkitwefaxolgnuwdvuk.supabase.co";

function getAdminClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Middleware: verify super_admin role from Bearer token
async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const adminClient = getAdminClient();
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) { res.status(401).json({ error: "Invalid token" }); return; }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles").select("id, role").eq("id", user.id).single();

    if (profileError || !profile || profile.role !== "super_admin") {
      res.status(403).json({ error: "Forbidden: super_admin role required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// GET /api/super-admin/stats
router.get("/super-admin/stats", requireSuperAdmin, async (_req, res) => {
  try {
    const adminClient = getAdminClient();
    const [orgsRes, profilesRes, eventsRes, ticketsRes] = await Promise.all([
      adminClient.from("organizations").select("id", { count: "exact", head: true }),
      adminClient.from("profiles").select("id", { count: "exact", head: true }),
      adminClient.from("events").select("id, price", { count: "exact" }),
      adminClient.from("tickets").select("event_id"),
    ]);

    const totalOrgs = orgsRes.count ?? 0;
    const totalUsers = profilesRes.count ?? 0;
    const totalEvents = eventsRes.count ?? 0;
    const totalTickets = ticketsRes.data?.length ?? 0;

    let grossRevenue = 0;
    if (eventsRes.data && ticketsRes.data) {
      const ticketsByEvent: Record<string, number> = {};
      for (const t of ticketsRes.data) {
        ticketsByEvent[t.event_id] = (ticketsByEvent[t.event_id] ?? 0) + 1;
      }
      grossRevenue = eventsRes.data.reduce((sum, ev) => {
        return sum + (ev.price ?? 0) * (ticketsByEvent[ev.id] ?? 0);
      }, 0);
    }

    res.set("Cache-Control", "no-store");
    res.json({
      totalOrgs,
      totalUsers,
      totalEvents,
      totalTickets,
      grossRevenue,
      platformFees: Math.round(grossRevenue * 0.05),
      netRevenue: Math.round(grossRevenue * 0.95),
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/super-admin/organizations
router.get("/super-admin/organizations", requireSuperAdmin, async (_req, res) => {
  try {
    const adminClient = getAdminClient();
    const [orgsRes, eventsRes, ticketsRes] = await Promise.all([
      adminClient.from("organizations").select("*").order("created_at", { ascending: false }),
      adminClient.from("events").select("id, org_id, price"),
      adminClient.from("tickets").select("event_id"),
    ]);

    if (orgsRes.error) { res.status(500).json({ error: orgsRes.error.message }); return; }

    const events = eventsRes.data ?? [];
    const tickets = ticketsRes.data ?? [];

    const ticketsByEvent: Record<string, number> = {};
    for (const t of tickets) {
      ticketsByEvent[t.event_id] = (ticketsByEvent[t.event_id] ?? 0) + 1;
    }

    const eventsByOrg: Record<string, { count: number; revenue: number }> = {};
    for (const ev of events) {
      if (!ev.org_id) continue;
      if (!eventsByOrg[ev.org_id]) eventsByOrg[ev.org_id] = { count: 0, revenue: 0 };
      eventsByOrg[ev.org_id].count += 1;
      const ticketCount = ticketsByEvent[ev.id] ?? 0;
      eventsByOrg[ev.org_id].revenue += (ev.price ?? 0) * ticketCount;
    }

    const orgs = (orgsRes.data ?? []).map((org) => ({
      ...org,
      eventCount: eventsByOrg[org.id]?.count ?? 0,
      grossRevenue: eventsByOrg[org.id]?.revenue ?? 0,
      platformFee: Math.round((eventsByOrg[org.id]?.revenue ?? 0) * 0.05),
    }));

    res.set("Cache-Control", "no-store");
    res.json(orgs);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/super-admin/organizations
router.post("/super-admin/organizations", requireSuperAdmin, async (req, res) => {
  try {
    const { name, logo_url, primary_color } = req.body as Record<string, string>;
    if (!name?.trim()) { res.status(400).json({ error: "Name is required" }); return; }
    const adminClient = getAdminClient();
    const { data, error } = await adminClient
      .from("organizations")
      .insert({ name: name.trim(), logo_url: logo_url || null, primary_color: primary_color || null })
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/super-admin/organizations/:id
router.patch("/super-admin/organizations/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo_url, primary_color } = req.body as Record<string, string>;
    const adminClient = getAdminClient();
    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name.trim();
    if (logo_url !== undefined) updates.logo_url = logo_url || null;
    if (primary_color !== undefined) updates.primary_color = primary_color || null;
    const { data, error } = await adminClient
      .from("organizations").update(updates).eq("id", id).select().single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/super-admin/organizations/:id
router.delete("/super-admin/organizations/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const adminClient = getAdminClient();
    const { error } = await adminClient.from("organizations").delete().eq("id", id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/super-admin/users
router.get("/super-admin/users", requireSuperAdmin, async (_req, res) => {
  try {
    const adminClient = getAdminClient();
    const [profilesRes, orgsRes] = await Promise.all([
      adminClient.from("profiles").select("id, full_name, email, role, org_id, created_at").order("created_at", { ascending: false }),
      adminClient.from("organizations").select("id, name"),
    ]);
    if (profilesRes.error) { res.status(500).json({ error: profilesRes.error.message }); return; }

    const orgMap: Record<string, string> = {};
    for (const o of orgsRes.data ?? []) orgMap[o.id] = o.name;

    const users = (profilesRes.data ?? []).map((p) => ({
      ...p,
      org_name: p.org_id ? (orgMap[p.org_id] ?? null) : null,
    }));

    res.set("Cache-Control", "no-store");
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/super-admin/users/:id
router.patch("/super-admin/users/:id", requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role, org_id } = req.body as Record<string, string | null>;
    const adminClient = getAdminClient();
    const updates: Record<string, string | null> = {};
    if (role !== undefined) updates.role = role;
    if (org_id !== undefined) updates.org_id = org_id || null;
    const { data, error } = await adminClient
      .from("profiles").update(updates).eq("id", id).select().single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
