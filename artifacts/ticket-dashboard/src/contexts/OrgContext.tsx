import { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/useAuth";

interface OrgData {
  org_id: string | null;
  org_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

interface OrgContextType extends OrgData {
  orgLoaded: boolean;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [org, setOrg] = useState<OrgData>({ org_id: null, org_name: null, logo_url: null, primary_color: null });
  const [orgLoaded, setOrgLoaded] = useState(false);
  const fetchedOrgRef = useRef<string | null>(null);

  useEffect(() => {
    const orgId = profile?.org_id ?? null;
    if (fetchedOrgRef.current === orgId) return;
    fetchedOrgRef.current = orgId;

    if (!orgId) {
      setOrg({ org_id: null, org_name: null, logo_url: null, primary_color: null });
      setOrgLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, logo_url, primary_color")
        .eq("id", orgId)
        .single();

      if (cancelled) return;

      if (error || !data) {
        setOrg({ org_id: orgId, org_name: null, logo_url: null, primary_color: null });
      } else {
        setOrg({
          org_id: orgId,
          org_name: data.name ?? null,
          logo_url: data.logo_url ?? null,
          primary_color: data.primary_color ?? null,
        });
        if (data.primary_color) {
          document.documentElement.style.setProperty("--org-primary", data.primary_color);
        }
      }
      setOrgLoaded(true);
    })();

    return () => { cancelled = true; };
  }, [profile?.org_id]);

  return (
    <OrgContext.Provider value={{ ...org, orgLoaded }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
