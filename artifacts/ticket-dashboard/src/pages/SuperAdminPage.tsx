import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { supabase } from "@/lib/supabase";
import { getApiBase } from "@/lib/apiBase";
import {
  Building2, Users, CalendarDays, Ticket, DollarSign, TrendingUp,
  RefreshCw, Plus, Pencil, Trash2, X, Check, AlertCircle, Loader2,
  ShieldCheck, LogOut, Percent, ChevronDown, Eye, EyeOff, UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────

interface PlatformStats {
  totalOrgs: number;
  totalUsers: number;
  totalEvents: number;
  totalTickets: number;
  grossRevenue: number;
  platformFees: number;
  netRevenue: number;
}

interface Org {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  created_at: string;
  eventCount: number;
  grossRevenue: number;
  platformFee: number;
}

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  org_id: string | null;
  org_name: string | null;
}

type Tab = "overview" | "organizations" | "users";

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  admin: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  staff: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

const BAR_COLORS = ["#7c3aed", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#f97316"];

// ─── Super Admin Page ───────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { profile, session, signOut } = useAuth();
  const { lang } = useLocale();
  const isAr = lang === "ar";
  const apiBase = getApiBase();
  const token = session?.access_token ?? "";

  const [tab, setTab] = useState<Tab>("overview");
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Org modal
  const [orgModal, setOrgModal] = useState<{ open: boolean; editing: Org | null }>({ open: false, editing: null });
  const [orgForm, setOrgForm] = useState({ name: "", slug: "", logo_url: "", primary_color: "#7c3aed", admin_name: "", admin_email: "", admin_password: "" });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);

  // User edit modal
  const [userModal, setUserModal] = useState<{ open: boolean; user: UserProfile | null }>({ open: false, user: null });
  const [userForm, setUserForm] = useState({ role: "", org_id: "" });
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Org | null>(null);
  const [deleting, setDeleting] = useState(false);

  const apiFetch = async (path: string, opts?: RequestInit) => {
    // Always pull a fresh token — avoids stale closure if Supabase refreshed the session
    const { data: { session: liveSession } } = await supabase.auth.getSession();
    const liveToken = liveSession?.access_token ?? token;
    const res = await fetch(`${apiBase}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${liveToken}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Request failed");
    return json;
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, o, u] = await Promise.all([
        apiFetch("/super-admin/stats"),
        apiFetch("/super-admin/organizations"),
        apiFetch("/super-admin/users"),
      ]);
      setStats(s);
      setOrgs(o);
      setUsers(u);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ─── Org CRUD ──────────────────────────────────────────────────────────────

  const toSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const openAddOrg = () => {
    setOrgForm({ name: "", slug: "", logo_url: "", primary_color: "#7c3aed", admin_name: "", admin_email: "", admin_password: "" });
    setLogoFile(null);
    setLogoPreview(null);
    setShowPassword(false);
    setOrgError(null);
    setOrgModal({ open: true, editing: null });
  };

  const openEditOrg = (org: Org) => {
    setOrgForm({ name: org.name, slug: org.slug ?? "", logo_url: org.logo_url ?? "", primary_color: org.primary_color ?? "#7c3aed", admin_name: "", admin_email: "", admin_password: "" });
    setLogoFile(null);
    setLogoPreview(org.logo_url ?? null);
    setShowPassword(false);
    setOrgError(null);
    setOrgModal({ open: true, editing: org });
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveOrg = async () => {
    if (!orgForm.name.trim()) { setOrgError(isAr ? "اسم المؤسسة مطلوب" : "Organization name is required"); return; }
    if (!orgModal.editing && orgForm.admin_email.trim() && !orgForm.admin_password.trim()) {
      setOrgError(isAr ? "كلمة المرور مطلوبة مع البريد الإلكتروني" : "Password is required when providing an email"); return;
    }
    if (!orgModal.editing && orgForm.admin_password.trim() && orgForm.admin_password.trim().length < 8) {
      setOrgError(isAr ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters"); return;
    }
    setOrgSaving(true);
    setOrgError(null);
    try {
      // Upload logo file first if one was selected
      let finalLogoUrl = orgForm.logo_url;
      if (logoFile) {
        setLogoUploading(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(logoFile);
        });
        const uploadRes = await apiFetch("/super-admin/upload-logo", {
          method: "POST",
          body: JSON.stringify({ base64, mimeType: logoFile.type }),
        });
        finalLogoUrl = (uploadRes as { url: string }).url;
        setLogoUploading(false);
      }

      const finalSlug = orgForm.slug.trim() || toSlug(orgForm.name);

      if (orgModal.editing) {
        await apiFetch(`/super-admin/organizations/${orgModal.editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: orgForm.name, slug: finalSlug, logo_url: finalLogoUrl, primary_color: orgForm.primary_color }),
        });
      } else {
        await apiFetch("/super-admin/organizations", {
          method: "POST",
          body: JSON.stringify({ ...orgForm, slug: finalSlug, logo_url: finalLogoUrl }),
        });
      }
      setOrgModal({ open: false, editing: null });
      await loadAll();
    } catch (err) {
      setLogoUploading(false);
      setOrgError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setOrgSaving(false);
    }
  };

  const deleteOrg = async (org: Org) => {
    setDeleting(true);
    try {
      await apiFetch(`/super-admin/organizations/${org.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  // ─── User Edit ──────────────────────────────────────────────────────────────

  const openEditUser = (u: UserProfile) => {
    setUserForm({ role: u.role, org_id: u.org_id ?? "" });
    setUserError(null);
    setUserModal({ open: true, user: u });
  };

  const saveUser = async () => {
    if (!userModal.user) return;
    setUserSaving(true);
    setUserError(null);
    try {
      await apiFetch(`/super-admin/users/${userModal.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: userForm.role, org_id: userForm.org_id || null }),
      });
      setUserModal({ open: false, user: null });
      await loadAll();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setUserSaving(false);
    }
  };

  // ─── Derived chart data ─────────────────────────────────────────────────────

  const orgBarData = orgs
    .filter((o) => o.grossRevenue > 0 || o.eventCount > 0)
    .slice(0, 8)
    .map((o) => ({ name: o.name.length > 10 ? o.name.slice(0, 10) + "…" : o.name, revenue: o.grossRevenue, events: o.eventCount }));

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-fuchsia-600 flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-foreground tracking-tight text-sm">
              {isAr ? "لوحة التحكم العليا" : "Super Admin"}
            </span>
            <span className="hidden sm:block text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
              PLATFORM
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-xs text-muted-foreground">{profile?.email}</span>
            <Button variant="outline" size="sm" onClick={loadAll} disabled={loading} className="rounded-lg h-8">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="rounded-lg h-8 text-destructive border-destructive/30 hover:bg-destructive/10">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:block">{isAr ? "خروج" : "Sign Out"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-2.5 p-4 bg-destructive/10 border border-destructive/20 rounded-2xl text-sm text-destructive">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-2xl w-fit border border-border">
          {([
            ["overview", isAr ? "نظرة عامة" : "Overview"],
            ["organizations", isAr ? "المؤسسات" : "Organizations"],
            ["users", isAr ? "المستخدمون" : "Users"],
          ] as [Tab, string][]).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: isAr ? "المؤسسات" : "Organizations", value: stats?.totalOrgs ?? 0, icon: Building2, gradient: "bg-gradient-to-br from-violet-600 to-purple-700" },
                { label: isAr ? "المستخدمون" : "Users", value: stats?.totalUsers ?? 0, icon: Users, gradient: "bg-gradient-to-br from-blue-500 to-cyan-600" },
                { label: isAr ? "الفعاليات" : "Events", value: stats?.totalEvents ?? 0, icon: CalendarDays, gradient: "bg-gradient-to-br from-teal-500 to-emerald-600" },
                { label: isAr ? "التذاكر" : "Tickets", value: stats?.totalTickets ?? 0, icon: Ticket, gradient: "bg-gradient-to-br from-orange-500 to-amber-500" },
              ].map(({ label, value, icon: Icon, gradient }) => (
                <div key={label} className={`relative overflow-hidden rounded-2xl p-5 ${gradient} shadow-lg`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-4 -end-4 w-24 h-24 rounded-full bg-white blur-2xl" />
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                      <Icon className="w-4.5 h-4.5 text-white" />
                    </div>
                    {loading ? <div className="h-8 w-16 bg-white/20 animate-pulse rounded-lg" /> : (
                      <p className="text-3xl font-black text-white">{value.toLocaleString()}</p>
                    )}
                    <p className="text-sm text-white/70 mt-1 font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: isAr ? "إجمالي الإيرادات" : "Gross Revenue", value: stats?.grossRevenue ?? 0, icon: DollarSign, gradient: "bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600" },
                { label: isAr ? "إيراد المؤسسات (95%)" : "Org Net Revenue (95%)", value: stats?.netRevenue ?? 0, icon: TrendingUp, gradient: "bg-gradient-to-br from-violet-600 to-indigo-700" },
                { label: isAr ? "رسوم المنصة (5%)" : "Platform Fees (5%)", value: stats?.platformFees ?? 0, icon: Percent, gradient: "bg-gradient-to-br from-rose-500 to-pink-600" },
              ].map(({ label, value, icon: Icon, gradient }) => (
                <div key={label} className={`relative overflow-hidden rounded-2xl p-5 shadow-lg ${gradient}`}>
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-4 -end-4 w-24 h-24 rounded-full bg-white blur-2xl" />
                  </div>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-4">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    {loading ? <div className="h-8 w-24 bg-white/20 animate-pulse rounded-lg" /> : (
                      <p className="text-2xl font-black text-white">RWF {value.toLocaleString()}</p>
                    )}
                    <p className="text-sm text-white/70 mt-1 font-medium">{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue per org chart */}
            {orgBarData.length > 0 && (
              <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-foreground mb-1">{isAr ? "الإيرادات لكل مؤسسة" : "Revenue per Organization"}</h3>
                <p className="text-xs text-muted-foreground mb-5">{isAr ? "إجمالي المبيعات مقارنةً بعدد الفعاليات" : "Gross sales vs event count"}</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={orgBarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px" }}
                      formatter={(val: number, name: string) => [
                        name === "revenue" ? `RWF ${val.toLocaleString()}` : val,
                        name === "revenue" ? (isAr ? "الإيراد" : "Revenue") : (isAr ? "الفعاليات" : "Events"),
                      ]}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]} maxBarSize={48}>
                      {orgBarData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── ORGANIZATIONS TAB ── */}
        {tab === "organizations" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{isAr ? "المؤسسات" : "Organizations"}</h2>
              <Button onClick={openAddOrg} size="sm" className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 font-semibold">
                <Plus className="w-3.5 h-3.5" />
                {isAr ? "مؤسسة جديدة" : "Add Organization"}
              </Button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-card border border-border rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : orgs.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{isAr ? "لا توجد مؤسسات بعد" : "No organizations yet"}</p>
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {[
                          isAr ? "المؤسسة" : "Organization",
                          isAr ? "الفعاليات" : "Events",
                          isAr ? "إجمالي الإيراد" : "Gross Revenue",
                          isAr ? "رسوم المنصة" : "Platform Fee",
                          isAr ? "اللون الرئيسي" : "Brand Color",
                          isAr ? "تاريخ الإنشاء" : "Created",
                          "",
                        ].map((h) => (
                          <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orgs.map((org) => (
                        <tr key={org.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-border shrink-0" />
                              ) : (
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: org.primary_color ?? "#7c3aed" }}>
                                  <Building2 className="w-4 h-4 text-white" />
                                </div>
                              )}
                              <div>
                                <p className="font-semibold text-foreground">{org.name}</p>
                                {org.slug ? (
                                  <p className="text-xs text-violet-400 font-mono">moevents.online/{org.slug}</p>
                                ) : (
                                  <p className="text-xs text-muted-foreground font-mono">{org.id.slice(0, 8)}…</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-foreground">{org.eventCount}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-foreground">RWF {org.grossRevenue.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="font-semibold text-rose-500">RWF {org.platformFee.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            {org.primary_color ? (
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-md border border-border shrink-0" style={{ background: org.primary_color }} />
                                <span className="text-xs text-muted-foreground font-mono">{org.primary_color}</span>
                              </div>
                            ) : <span className="text-muted-foreground text-xs">—</span>}
                          </td>
                          <td className="px-4 py-3.5 text-xs text-muted-foreground">
                            {new Date(org.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => openEditOrg(org)}
                                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleteTarget(org)}
                                className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === "users" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">{isAr ? "المستخدمون" : "Users & Profiles"}</h2>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-2xl animate-pulse" />)}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{isAr ? "لا يوجد مستخدمون" : "No users found"}</p>
              </div>
            ) : (
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {[
                          isAr ? "المستخدم" : "User",
                          isAr ? "الدور" : "Role",
                          isAr ? "المؤسسة" : "Organization",
                          "",
                        ].map((h) => (
                          <th key={h} className="text-start px-4 py-3 text-xs font-semibold text-muted-foreground">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3.5">
                            <div>
                              <p className="font-semibold text-foreground">{u.full_name ?? "—"}</p>
                              <p className="text-xs text-muted-foreground">{u.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ROLE_COLORS[u.role] ?? "bg-muted text-muted-foreground border-border"}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="text-sm text-foreground">{u.org_name ?? <span className="text-muted-foreground text-xs">—</span>}</span>
                          </td>
                          <td className="px-4 py-3.5">
                            <button
                              onClick={() => openEditUser(u)}
                              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ORG MODAL ── */}
      {orgModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h3 className="font-bold text-foreground">
                {orgModal.editing ? (isAr ? "تعديل المؤسسة" : "Edit Organization") : (isAr ? "إضافة مؤسسة" : "Add Organization")}
              </h3>
              <button onClick={() => setOrgModal({ open: false, editing: null })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {orgError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />{orgError}
                </div>
              )}
              {/* Name */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {isAr ? "اسم المؤسسة *" : "Organization Name *"}
                </Label>
                <Input
                  value={orgForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setOrgForm((f) => ({ ...f, name, slug: f.slug || toSlug(name) }));
                  }}
                  placeholder={isAr ? "مثال: شركة الإبداع" : "e.g. Creative Co."} className="rounded-xl" />
              </div>

              {/* Slug / domain */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {isAr ? "رابط المؤسسة" : "Organization URL"}
                </Label>
                <div className="flex items-center gap-0 border border-border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-3 py-2 text-xs text-muted-foreground bg-muted border-r border-border whitespace-nowrap select-none">
                    moevents.online/
                  </span>
                  <input
                    value={orgForm.slug}
                    onChange={(e) => setOrgForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                    placeholder={orgForm.name ? toSlug(orgForm.name) : "serava"}
                    className="flex-1 px-3 py-2 text-sm bg-background outline-none font-mono"
                  />
                </div>
                {(orgForm.slug || orgForm.name) && (
                  <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
                    moevents.online/{orgForm.slug || toSlug(orgForm.name)}
                  </p>
                )}
              </div>

              {/* Logo upload */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {isAr ? "شعار المؤسسة" : "Organization Logo"}
                </Label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="relative shrink-0">
                      <img src={logoPreview} alt="Logo preview" className="w-14 h-14 rounded-xl object-cover border border-border" />
                      <button
                        type="button"
                        onClick={() => { setLogoFile(null); setLogoPreview(null); setOrgForm((f) => ({ ...f, logo_url: "" })); }}
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-14 h-14 rounded-xl border-2 border-dashed border-border flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <label className="flex-1 cursor-pointer">
                    <div className="px-3 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors text-center">
                      {logoFile ? logoFile.name : (isAr ? "اختر صورة" : "Choose image…")}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                </div>
              </div>

              {/* Brand color */}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {isAr ? "اللون الرئيسي" : "Brand Color"}
                </Label>
                <div className="flex items-center gap-3">
                  <input type="color" value={orgForm.primary_color}
                    onChange={(e) => setOrgForm((f) => ({ ...f, primary_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent" />
                  <Input value={orgForm.primary_color}
                    onChange={(e) => setOrgForm((f) => ({ ...f, primary_color: e.target.value }))}
                    placeholder="#7c3aed" className="rounded-xl font-mono text-sm" />
                </div>
              </div>

              {/* Admin account — only shown when adding a new org */}
              {!orgModal.editing && (
                <div className="pt-3 border-t border-border space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <UserPlus className="w-3.5 h-3.5" />
                    {isAr ? "حساب المدير (اختياري)" : "Admin Account (optional)"}
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                      {isAr ? "الاسم الكامل" : "Full Name"}
                    </Label>
                    <Input value={orgForm.admin_name}
                      onChange={(e) => setOrgForm((f) => ({ ...f, admin_name: e.target.value }))}
                      placeholder={isAr ? "مثال: أحمد محمد" : "e.g. John Smith"}
                      className="rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                      {isAr ? "البريد الإلكتروني" : "Email Address"}
                    </Label>
                    <Input type="email" value={orgForm.admin_email}
                      onChange={(e) => setOrgForm((f) => ({ ...f, admin_email: e.target.value }))}
                      placeholder="admin@organization.com"
                      className="rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                      {isAr ? "كلمة المرور" : "Password"}
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={orgForm.admin_password}
                        onChange={(e) => setOrgForm((f) => ({ ...f, admin_password: e.target.value }))}
                        placeholder={isAr ? "8 أحرف على الأقل" : "Min 8 characters"}
                        className="rounded-xl pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      {isAr ? "اترك فارغاً لإنشاء المؤسسة بدون حساب مدير الآن" : "Leave empty to create the org without an admin account for now"}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setOrgModal({ open: false, editing: null })}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={saveOrg} disabled={orgSaving} className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 font-semibold">
                {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isAr ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── USER EDIT MODAL ── */}
      {userModal.open && userModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h3 className="font-bold text-foreground">{isAr ? "تعديل المستخدم" : "Edit User"}</h3>
              <button onClick={() => setUserModal({ open: false, user: null })} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-muted-foreground">{userModal.user.email}</p>
              {userError && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0" />{userError}
                </div>
              )}
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{isAr ? "الدور" : "Role"}</Label>
                <div className="relative">
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full h-10 rounded-xl border border-input bg-background px-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="admin">admin</option>
                    <option value="staff">staff</option>
                    <option value="super_admin">super_admin</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                  {isAr ? "معرّف المؤسسة (org_id)" : "Organization ID (org_id)"}
                </Label>
                <Input value={userForm.org_id}
                  onChange={(e) => setUserForm((f) => ({ ...f, org_id: e.target.value }))}
                  placeholder={isAr ? "اتركه فارغاً لعدم التعيين" : "Leave empty for none"}
                  className="rounded-xl font-mono text-xs" />
                {orgs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {orgs.map((o) => (
                      <button key={o.id} onClick={() => setUserForm((f) => ({ ...f, org_id: o.id }))}
                        className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors font-medium ${userForm.org_id === o.id ? "bg-violet-500/20 border-violet-500/40 text-violet-400" : "border-border text-muted-foreground hover:border-violet-500/30 hover:text-violet-400"}`}>
                        {o.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setUserModal({ open: false, user: null })}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={saveUser} disabled={userSaving} className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 font-semibold">
                {userSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {isAr ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <div className="text-center">
              <h3 className="font-bold text-foreground mb-1">{isAr ? "حذف المؤسسة" : "Delete Organization"}</h3>
              <p className="text-sm text-muted-foreground">
                {isAr ? `هل تريد حذف "${deleteTarget.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                  : `Delete "${deleteTarget.name}"? This cannot be undone.`}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDeleteTarget(null)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={() => deleteOrg(deleteTarget)} disabled={deleting}
                className="flex-1 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground border-0 font-semibold">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {isAr ? "حذف" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
