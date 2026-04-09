import { Router, type IRouter, type Request, type Response } from "express";
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

// Resolve org_id for any authenticated user from their Bearer token
async function getOrgIdFromToken(req: Request, res: Response): Promise<{ orgId: string; userId: string } | null> {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  const token = authHeader.slice(7);
  const adminClient = getAdminClient();

  const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !user) {
    res.status(401).json({ error: "Invalid token" });
    return null;
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, org_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    res.status(404).json({ error: "Profile not found" });
    return null;
  }

  if (!profile.org_id) {
    res.status(400).json({ error: "No organization linked to this account" });
    return null;
  }

  return { orgId: profile.org_id, userId: user.id };
}

// POST /api/org/upload-logo
// Any authenticated user with an org — uploads image to Storage, returns URL
router.post("/org/upload-logo", async (req, res) => {
  try {
    const ctx = await getOrgIdFromToken(req, res);
    if (!ctx) return;

    const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
    if (!base64 || !mimeType) {
      res.status(400).json({ error: "base64 and mimeType are required" });
      return;
    }

    const adminClient = getAdminClient();
    await adminClient.storage.createBucket("org-logos", { public: true }).catch(() => {});

    const ext = mimeType.split("/")[1]?.split("+")[0] ?? "png";
    const fileName = `${ctx.orgId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(base64, "base64");

    const { error: uploadError } = await adminClient.storage
      .from("org-logos")
      .upload(fileName, buffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    const { data: { publicUrl } } = adminClient.storage.from("org-logos").getPublicUrl(fileName);
    res.json({ url: publicUrl });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Upload failed" });
  }
});

// PATCH /api/org/branding
// Any authenticated user with an org — updates their org's name and/or logo_url
router.patch("/org/branding", async (req, res) => {
  try {
    const ctx = await getOrgIdFromToken(req, res);
    if (!ctx) return;

    const { name, logo_url } = req.body as { name?: string; logo_url?: string };
    const adminClient = getAdminClient();

    const updates: Record<string, string | null> = {};
    if (name !== undefined) updates.name = name.trim() || null;
    if (logo_url !== undefined) updates.logo_url = logo_url || null;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No fields to update" });
      return;
    }

    const { data, error } = await adminClient
      .from("organizations")
      .update(updates)
      .eq("id", ctx.orgId)
      .select("id, name, logo_url, primary_color")
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Update failed" });
  }
});

export default router;
