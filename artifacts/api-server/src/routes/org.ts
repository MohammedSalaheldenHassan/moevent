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

const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** Identifies PNG / JPEG / WebP / GIF from their magic bytes. */
function detectImageType(b: Buffer): { mime: string; ext: string } | null {
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (b.length >= 6 && /^GIF8[79]a$/.test(b.toString("ascii", 0, 6))) return { mime: "image/gif", ext: "gif" };
  return null;
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

    // Raster images only (SVG can carry scripts), checked by the file's own
    // bytes rather than the client-supplied type.
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_LOGO_BYTES) {
      res.status(400).json({ error: "Logo must be an image under 5 MB" });
      return;
    }
    const detected = detectImageType(buffer);
    if (!detected) {
      res.status(400).json({ error: "Logo must be a PNG, JPEG, WebP or GIF image" });
      return;
    }
    const fileName = `${orgId}-${Date.now()}.${detected.ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("org-logos")
      .upload(fileName, buffer, { contentType: detected.mime, upsert: true });

    if (uploadError) {
      res.status(500).json({ error: uploadError.message });
      return;
    }

    const { data: { publicUrl } } = adminClient.storage.from("org-logos").getPublicUrl(fileName);
    res.json({ url: publicUrl });
  } catch (err) {
    console.error("[org/upload-logo]", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Upload failed" });
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
    console.error("[org/branding]", err instanceof Error ? err.message : err);
    res.status(500).json({ error: "Update failed" });
  }
});

export default router;
