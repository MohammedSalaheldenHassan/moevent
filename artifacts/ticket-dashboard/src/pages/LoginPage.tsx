import { useState } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Ticket, Loader2, AlertCircle, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { signIn } = useAuth();
  const { t, lang, setLang } = useLocale();
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex justify-end p-4">
        <div className="flex items-center gap-1 bg-card border border-card-border rounded-xl px-2 py-1.5 shadow-sm">
          <Globe className="w-3.5 h-3.5 text-muted-foreground me-1" />
          <button
            onClick={() => setLang("en")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            EN
          </button>
          <button
            onClick={() => setLang("ar")}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
              lang === "ar" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            عربي
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 mb-5 shadow-lg shadow-violet-500/25">
              <Ticket className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">{t.appName}</h1>
            <p className="text-sm text-muted-foreground mt-2">{t.signInToAdmin}</p>
          </div>

          {/* Card */}
          <div className="bg-card border border-card-border rounded-2xl p-7 shadow-xl shadow-black/5">
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
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">{t.password}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 rounded-xl"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 bg-destructive/8 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 rounded-xl text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 border-0 shadow-md shadow-violet-500/25"
                disabled={loading}
              >
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

          <p className="text-center text-xs text-muted-foreground mt-6">
            {t.appName} &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
