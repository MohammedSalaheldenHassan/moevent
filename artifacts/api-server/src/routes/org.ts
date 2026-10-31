import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseProjectUrl } from "../lib/supabaseProjectUrl";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

function getAdminClient() {
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  return createClient(getSupabaseProjectUrl(), serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// The single organization row that holds the business name and logo
async function getOrgId(adminClient: ReturnType<typeof getAdminClient>): Promise<string> {
  const { data, error } = await adminClient.from("organizations").select("id").limit(1).single();
  if (error || !data) throw new Error(error?.message ?? "Organization row not found");
  return data.id as string;
}

// POST /api/org/upload-logo
// Admin only — uploads image to Storage, returns URL
router.post("/org/upload-logo", requireAdmin, async (req, res) => {
  try {
    const { base64, mimeType } = req.body as { base64?: string; mimeType?: string };
    if (!base64 || !mimeType) {
      res.status(400).json({ error: "base64 and mimeType are required" });
      return;
    }

    const adminClient = getAdminClient();
    const orgId = await getOrgId(adminClient);
    await adminClient.storage.createBucket("org-logos", { public: true }).catch(() => {});

    const ext = mimeType.split("/")[1]?.split("+")[0] ?? "png";
    const fileName = `${orgId}-${Date.now()}.${ext}`;
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
// Admin only — updates the business name and/or logo_url
router.patch("/org/branding", requireAdmin, async (req, res) => {
  try {
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
      .eq("id", await getOrgId(adminClient))
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
