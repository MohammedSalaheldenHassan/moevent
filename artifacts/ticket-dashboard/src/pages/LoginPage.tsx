import { useState } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t, lang, setLang } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const displayName = systemName || t.appName;
  const displayLogo = systemLogo || "/logo.png";
  const isImageLogo = displayLogo.startsWith("data:") || displayLogo.startsWith("http") || displayLogo.startsWith("/");
  const isAr = lang === "ar";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error);
    setLoading(false);
  };

  const logo = isImageLogo ? (
    <img src={displayLogo} alt="" className="w-10 h-10 rounded-md object-contain bg-black border border-white/10" />
  ) : (
    <div className="w-10 h-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
      <Ticket className="w-5 h-5" />
    </div>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] bg-background">
      {/* Brand panel */}
      <aside className="hidden lg:flex flex-col justify-between bg-[hsl(220_15%_11%)] text-white px-12 py-10">
        <div className="flex items-center gap-3">
          {logo}
          <span className="font-semibold tracking-tight">{displayName}</span>
        </div>
        <div className="max-w-sm">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            {isAr ? "إدارة الفعاليات والتذاكر والدخول من مكان واحد." : "Events, tickets and gate entry, managed in one place."}
          </p>
          <p className="mt-3 text-sm text-white/55 leading-relaxed">
            {isAr
              ? "لوحة الإدارة مخصصة للمسؤولين. يستخدم موظفو البوابة تطبيق المسح."
              : "This console is for administrators. Gate staff use the scanning app."}
          </p>
        </div>
        <p className="text-xs text-white/40">&copy; {new Date().getFullYear()} {displayName}</p>
      </aside>

      {/* Form */}
      <main className="flex flex-col">
        <div className="flex justify-end p-4">
          <div className="flex items-center p-0.5 rounded-md border border-border bg-card" role="group" aria-label="Language">
            {(["en", "ar"] as const).map((code) => (
              <button
                key={code}
                onClick={() => setLang(code)}
                aria-pressed={lang === code}
                className={cn(
                  "px-3 h-7 rounded text-xs font-medium transition-colors",
                  lang === code ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {code === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[360px]">
            <div className="lg:hidden flex items-center gap-3 mb-10">
              {logo}
              <span className="font-semibold tracking-tight text-foreground">{displayName}</span>
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t.signIn}</h1>
            <p className="text-sm text-muted-foreground mt-1.5 mb-8">{t.signInToAdmin}</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">{t.emailAddress}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">{t.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-10"
                />
              </div>

              {error && (
                <div role="alert" className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/25 rounded-md text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full h-10" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.signingIn}
                  </>
                ) : (
                  t.signIn
                )}
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
