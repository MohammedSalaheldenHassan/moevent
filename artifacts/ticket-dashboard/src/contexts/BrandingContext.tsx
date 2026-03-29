import { createContext, useContext, useState } from "react";

const NAME_KEY = "system_name";
const LOGO_KEY = "system_logo";

interface BrandingContextType {
  systemName: string;
  systemLogo: string;
  setSystemName: (name: string) => void;
  setSystemLogo: (logo: string) => void;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

function readStorage(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [systemName, setSystemNameState] = useState<string>(
    () => readStorage(NAME_KEY)
  );
  const [systemLogo, setSystemLogoState] = useState<string>(
    () => readStorage(LOGO_KEY)
  );

  const setSystemName = (name: string) => {
    setSystemNameState(name);
    try {
      if (name) {
        localStorage.setItem(NAME_KEY, name);
      } else {
        localStorage.removeItem(NAME_KEY);
      }
    } catch {
      // quota exceeded — state still updated for this session
    }
  };

  const setSystemLogo = (logo: string) => {
    if (!logo) {
      setSystemLogoState("");
      try { localStorage.removeItem(LOGO_KEY); } catch { /* ignore */ }
      return;
    }
    // Always remove old logo first to free quota before writing the new one
    try { localStorage.removeItem(LOGO_KEY); } catch { /* ignore */ }
    try {
      localStorage.setItem(LOGO_KEY, logo);
      setSystemLogoState(logo);
    } catch {
      // Still update in-memory state so the current session sees the logo
      setSystemLogoState(logo);
      throw new Error("storage_full");
    }
  };

  return (
    <BrandingContext.Provider value={{ systemName, systemLogo, setSystemName, setSystemLogo }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used within BrandingProvider");
  return ctx;
}
