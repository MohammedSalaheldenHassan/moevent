import { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const NAME_KEY = "system_name";
const LOGO_KEY = "system_logo";

interface BrandingContextType {
  systemName: string;
  systemLogo: string;
  brandingLoaded: boolean;
  setSystemName: (name: string) => Promise<{ error: string | null }>;
  setSystemLogo: (logo: string) => Promise<{ error: string | null }>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

function readCache(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function writeCache(key: string, value: string) {
  try {
    if (value) { localStorage.removeItem(key); localStorage.setItem(key, value); }
    else { localStorage.removeItem(key); }
  } catch { /* quota — skip */ }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [systemName, setSystemNameState] = useState<string>(() => readCache(NAME_KEY));
  const [systemLogo, setSystemLogoState] = useState<string>(() => readCache(LOGO_KEY));
  const [brandingLoaded, setBrandingLoaded] = useState(false);

  // Fetch from DB on mount — localStorage gives instant render, DB corrects it
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", [NAME_KEY, LOGO_KEY]);

      if (cancelled || error) {
        setBrandingLoaded(true);
        return;
      }

      const map: Record<string, string> = {};
      for (const row of data ?? []) map[row.key] = row.value ?? "";

      if (NAME_KEY in map) {
        setSystemNameState(map[NAME_KEY]);
        writeCache(NAME_KEY, map[NAME_KEY]);
      }
      if (LOGO_KEY in map) {
        setSystemLogoState(map[LOGO_KEY]);
        writeCache(LOGO_KEY, map[LOGO_KEY]);
      }
      setBrandingLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  const setSystemName = async (name: string): Promise<{ error: string | null }> => {
    setSystemNameState(name);
    writeCache(NAME_KEY, name);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: NAME_KEY, value: name }, { onConflict: "key" });
    return { error: error?.message ?? null };
  };

  const setSystemLogo = async (logo: string): Promise<{ error: string | null }> => {
    setSystemLogoState(logo);
    writeCache(LOGO_KEY, logo);
    const { error } = await supabase
      .from("system_settings")
      .upsert({ key: LOGO_KEY, value: logo }, { onConflict: "key" });
    return { error: error?.message ?? null };
  };

  return (
    <BrandingContext.Provider value={{ systemName, systemLogo, brandingLoaded, setSystemName, setSystemLogo }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
