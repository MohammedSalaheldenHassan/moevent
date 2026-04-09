import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useOrg } from "@/contexts/OrgContext";
import { useAuth } from "@/contexts/useAuth";
import { supabase } from "@/lib/supabase";

interface BrandingContextType {
  systemName: string;
  systemLogo: string;
  brandingLoaded: boolean;
  setSystemName: (name: string) => Promise<{ error: string | null }>;
  setSystemLogo: (logoUrl: string) => Promise<{ error: string | null }>;
  uploadLogo: (file: File) => Promise<{ url: string | null; error: string | null }>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const API_BASE = `${window.location.origin}/api`;

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { org_name, logo_url, org_id, orgLoaded } = useOrg();
  const { session } = useAuth();

  const [systemName, setSystemNameState] = useState<string>("");
  const [systemLogo, setSystemLogoState] = useState<string>("");

  // Sync from org data whenever it loads or changes
  useEffect(() => {
    if (!orgLoaded) return;
    setSystemNameState(org_name ?? "");
    setSystemLogoState(logo_url ?? "");
  }, [orgLoaded, org_name, logo_url]);

  const getToken = useCallback(async (): Promise<string> => {
    // Prefer live refreshed session token over the cached one
    const { data: { session: live } } = await supabase.auth.getSession();
    return live?.access_token ?? session?.access_token ?? "";
  }, [session?.access_token]);

  const setSystemName = useCallback(async (name: string): Promise<{ error: string | null }> => {
    if (!org_id) return { error: "No organization linked to this account" };
    setSystemNameState(name);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/org/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Failed to save name" };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to save name" };
    }
  }, [org_id, getToken]);

  const setSystemLogo = useCallback(async (logoUrl: string): Promise<{ error: string | null }> => {
    if (!org_id) return { error: "No organization linked to this account" };
    setSystemLogoState(logoUrl);
    try {
      const token = await getToken();
      const res = await fetch(`${API_BASE}/org/branding`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ logo_url: logoUrl }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) return { error: json.error ?? "Failed to save logo" };
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to save logo" };
    }
  }, [org_id, getToken]);

  const uploadLogo = useCallback(async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!org_id) return { url: null, error: "No organization linked to this account" };
    try {
      const token = await getToken();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${API_BASE}/org/upload-logo`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64, mimeType: file.type }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok) return { url: null, error: json.error ?? "Upload failed" };
      return { url: json.url ?? null, error: null };
    } catch (err) {
      return { url: null, error: err instanceof Error ? err.message : "Upload failed" };
    }
  }, [org_id, getToken]);

  return (
    <BrandingContext.Provider value={{
      systemName,
      systemLogo,
      brandingLoaded: orgLoaded,
      setSystemName,
      setSystemLogo,
      uploadLogo,
    }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
