import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Loader2, AlertCircle, ShieldCheck, User } from "lucide-react";

interface Profile {
  id: string;
  role: string;
  full_name: string | null;
  email: string | null;
}

export default function StaffPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, role, full_name, email")
          .order("role", { ascending: false });
        if (error) throw error;
        setProfiles(data ?? []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load staff");
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Staff</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your team members and their roles</p>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-32 mb-2" />
                  <div className="h-3 bg-muted rounded w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">No staff found</p>
          <p className="text-muted-foreground text-sm">Staff profiles will appear here once created in Supabase</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {profiles.map((profile) => (
              <div key={profile.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  profile.role === "admin"
                    ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                }`}>
                  {profile.role === "admin" ? (
                    <ShieldCheck className="w-5 h-5" />
                  ) : (
                    <User className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">
                    {profile.full_name || "Unnamed User"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email || profile.id}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  profile.role === "admin"
                    ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                }`}>
                  {profile.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-muted/50 border border-border rounded-xl p-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Note:</span> To manage staff roles, edit user profiles directly in your Supabase dashboard. Only users with the <code className="bg-muted px-1 py-0.5 rounded text-xs">admin</code> role can access this dashboard.
        </p>
      </div>
    </div>
  );
}
