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

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [systemName, setSystemNameState] = useState<string>(
    () => localStorage.getItem(NAME_KEY) || ""
  );
  const [systemLogo, setSystemLogoState] = useState<string>(
    () => localStorage.getItem(LOGO_KEY) || ""
  );

  const setSystemName = (name: string) => {
    localStorage.setItem(NAME_KEY, name);
    setSystemNameState(name);
  };

  const setSystemLogo = (logo: string) => {
    localStorage.setItem(LOGO_KEY, logo);
    setSystemLogoState(logo);
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
