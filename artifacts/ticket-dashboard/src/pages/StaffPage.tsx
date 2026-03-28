import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import {
  Users,
  AlertCircle,
  ShieldCheck,
  User,
  RefreshCw,
  Pencil,
  Trash2,
  Loader2,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { logActivity } from "@/lib/activityLogger";

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

  // Edit state
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editForm, setEditForm] = useState({ full_name: "", role: "admin" });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      console.error("[StaffPage] fetchProfiles error:", msg);
      setError(msg);
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

  const openEdit = (profile: Profile) => {
    setEditTarget(profile);
    setEditForm({ full_name: profile.full_name ?? "", role: profile.role });
    setEditError(null);
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editForm.full_name.trim() || null, role: editForm.role })
        .eq("id", editTarget.id);
      if (error) throw error;
      logActivity("settings_changed", `Updated staff: ${editTarget.email}`, currentProfile?.email ?? undefined);
      setEditTarget(null);
      fetchProfiles();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    // Prevent deleting yourself
    if (deleteTarget.id === currentProfile?.id) {
      alert("You cannot delete your own account.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      logActivity("settings_changed", `Deleted staff: ${deleteTarget.email}`, currentProfile?.email ?? undefined);
      setDeleteTarget(null);
      fetchProfiles();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.staffTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.staffSubtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProfiles} disabled={loading} className="rounded-xl shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {t.tryAgain}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t.staffTitle} — {t.somethingWrong}</p>
              <p className="text-xs opacity-80 mt-0.5 font-mono">{error}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-sm text-amber-800 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs">{t.rlsHint}</p>
          </div>
        </div>
      )}

      {/* Skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-card-border rounded-2xl p-4 animate-pulse flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded-lg w-32" />
                <div className="h-3 bg-muted rounded-lg w-48" />
              </div>
              <div className="h-6 bg-muted rounded-full w-16 shrink-0" />
              <div className="flex gap-1">
                <div className="w-7 h-7 bg-muted rounded-lg" />
                <div className="w-7 h-7 bg-muted rounded-lg" />
              </div>
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
              {error && <span className="ms-2 text-amber-600 font-normal normal-case">(showing partial data)</span>}
            </p>
          </div>
          <div className="divide-y divide-border">
            {profiles.map((profile) => {
              const isAdmin = profile.role === "admin";
              const isSelf = profile.id === currentProfile?.id;
              const initials = (profile.full_name || profile.email || "U")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
                <div key={profile.id} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/20 transition-colors">
                  {/* Avatar */}
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-foreground text-sm truncate">
                        {profile.full_name || t.unnamedUser}
                      </p>
                      {isSelf && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">You</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{profile.email || profile.id}</p>
                  </div>

                  {/* Role badge */}
                  <span className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 ${
                    isAdmin
                      ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  }`}>
                    {isAdmin ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                    {profile.role}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(profile)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(profile)}
                      disabled={isSelf}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      title={isSelf ? "Cannot delete yourself" : "Delete"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl p-4">
        <p className="text-sm text-amber-800 dark:text-amber-400">
          <span className="font-semibold">{t.staffNote}</span>{" "}
          {t.staffNoteDesc}{" "}
          <code className="bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-xs font-mono">admin</code>{" "}
          {t.staffNoteDesc2}
        </p>
      </div>

      {/* Edit Modal */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Staff Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="font-medium">Full Name</Label>
              <Input
                placeholder="e.g. Ahmed Al-Rashidi"
                value={editForm.full_name}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-medium">Role</Label>
              <div className="flex gap-2">
                {(["admin", "staff"] as const).map((role) => (
                  <button
                    key={role}
                    onClick={() => setEditForm((f) => ({ ...f, role }))}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-all capitalize ${
                      editForm.role === role
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            {editError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p className="font-mono text-xs">{editError}</p>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)} className="rounded-xl">
              <X className="w-4 h-4" />
              {t.cancel}
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={editSaving}
              className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0"
            >
              {editSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t.saving}</>
              ) : (
                <><Check className="w-4 h-4" />Save Changes</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive">{t.confirmDelete}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground">
              This will remove the profile record for:
            </p>
            {deleteTarget && (
              <p className="mt-2 font-semibold text-foreground text-sm">
                {deleteTarget.full_name || deleteTarget.email || deleteTarget.id}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Their Supabase Auth account will remain — only the profile row is deleted.</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="rounded-xl">{t.cancel}</Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive" className="rounded-xl">
              {deleting ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t.deleting}</>
              ) : (
                <><Trash2 className="w-4 h-4" />{t.confirmDeleteBtn}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
