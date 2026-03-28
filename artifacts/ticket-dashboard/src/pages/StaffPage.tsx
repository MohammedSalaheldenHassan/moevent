import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Users, AlertCircle, ShieldCheck, User, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Profile {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

export default function StaffPage() {
  const { t } = useLocale();
  const { profile: currentProfile } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, role, full_name, email")
        .order("role", { ascending: false });
      if (error) throw error;
      setProfiles(data ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load staff";
      setError(msg);
      // Fall back to showing the current user's profile
      if (currentProfile) {
        setProfiles([
          {
            id: currentProfile.id ?? "",
            role: currentProfile.role ?? "admin",
            full_name: currentProfile.full_name,
            email: currentProfile.email,
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.staffTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.staffSubtitle}</p>
        </div>
        {error && (
          <Button variant="outline" size="sm" onClick={fetchProfiles} className="rounded-xl shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            {t.tryAgain}
          </Button>
        )}
      </div>

      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t.staffTitle} — {t.somethingWrong}</p>
              <p className="text-xs opacity-80 mt-0.5">{error}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-sm text-amber-800 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{t.rlsHint}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-2xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-lg w-32 mb-2" />
                <div className="h-3 bg-muted rounded-lg w-48" />
              </div>
              <div className="h-6 bg-muted rounded-full w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold text-base">{t.noStaff}</p>
          <p className="text-muted-foreground text-sm mt-1">{t.noStaffDesc}</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-border bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {profiles.length} {t.staffTitle}
              {error && <span className="ms-2 text-amber-600 font-normal">(showing partial data)</span>}
            </p>
          </div>
          <div className="divide-y divide-border">
            {profiles.map((profile) => {
              const isAdmin = profile.role === "admin";
              const initials = (profile.full_name || profile.email || "U")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div key={profile.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold ${
                      isAdmin
                        ? "bg-gradient-to-br from-violet-500 to-purple-700 text-white"
                        : "bg-gradient-to-br from-blue-500 to-cyan-600 text-white"
                    }`}>
                      {initials}
                    </div>
                    {isAdmin && (
                      <div className="absolute -bottom-0.5 -end-0.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-card">
                        <ShieldCheck className="w-2.5 h-2.5 text-amber-900" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground text-sm truncate">
                      {profile.full_name || t.unnamedUser}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email || profile.id}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                    isAdmin
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {profile.role}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
        <p className="text-sm text-amber-800 dark:text-amber-400">
          <span className="font-semibold">{t.staffNote}</span>{" "}
          {t.staffNoteDesc}{" "}
          <code className="bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-xs font-mono">admin</code>{" "}
          {t.staffNoteDesc2}
        </p>
      </div>
    </div>
  );
}
