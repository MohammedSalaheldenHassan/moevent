import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { useBranding } from "@/contexts/BrandingContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logActivity } from "@/lib/activityLogger";
import {
  Globe,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Check,
  Sun,
  Moon,
  Monitor,
  User,
  Palette,
  Loader2,
  Pencil,
  X,
  Upload,
  ImageIcon,
  CalendarX2,
  RefreshCw,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getApiBase, getApiAuthHeaders } from "@/lib/apiBase";
import { type Theme } from "@/contexts/ThemeContext";

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-lg overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-muted/20">
        <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
          <Icon className="w-3.5 h-3.5 text-primary" />
        </div>
        <h3 className="font-semibold text-foreground text-sm">{title}</h3>
      </div>
      <div className="px-5 py-4 space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { t, lang, setLang } = useLocale();
  const { profile, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { systemName, systemLogo, setSystemName, setSystemLogo, uploadLogo } = useBranding();
  const isAr = lang === "ar";

  // ── Admin Profile ───────────────────────────────────────────
  const [editingProfile, setEditingProfile] = useState(false);
  const [nameInput, setNameInput] = useState(profile?.full_name || "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const handleSaveProfile = async () => {
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const { data: updated, error } = await supabase
        .from("profiles")
        .update({ full_name: nameInput.trim() || null })
        .eq("id", user!.id)
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error(isAr ? "فشل الحفظ — تحقق من صلاحيات قاعدة البيانات" : "Save blocked — check database permissions");
      logActivity("settings_changed", "Updated admin profile name", profile?.email ?? undefined);
      setProfileMsg({ type: "ok", text: isAr ? "تم حفظ الاسم بنجاح" : "Name saved successfully" });
      setEditingProfile(false);
    } catch (err: unknown) {
      setProfileMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to save" });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Branding ────────────────────────────────────────────────
  const [nameInputBrand, setNameInputBrand] = useState(systemName);
  // Sync input once org data loads (systemName is "" on first render, then gets populated)
  useEffect(() => {
    setNameInputBrand((prev) => (prev === "" ? systemName : prev));
  }, [systemName]);
  const [brandSaved, setBrandSaved] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [brandNameError, setBrandNameError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSaving, setLogoSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBranding = async () => {
    setBrandSaving(true);
    setBrandNameError(null);
    const { error } = await setSystemName(nameInputBrand.trim());
    setBrandSaving(false);
    if (error) {
      setBrandNameError(error);
      return;
    }
    if (nameInputBrand.trim()) {
      logActivity("settings_changed", `System name changed to: ${nameInputBrand.trim()}`, profile?.email ?? undefined);
    }
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(isAr ? "يرجى اختيار ملف صورة صالح" : "Please select a valid image file");
      return;
    }
    const MAX_BYTES = 8 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setLogoError(isAr ? "حجم الصورة أكبر من 8 ميغابايت." : "Image is larger than 8 MB.");
      return;
    }
    e.target.value = "";
    setLogoSaving(true);
    const { url, error: uploadError } = await uploadLogo(file);
    if (uploadError || !url) {
      setLogoSaving(false);
      setLogoError(isAr ? `فشل رفع الشعار: ${uploadError}` : `Failed to upload logo: ${uploadError}`);
      return;
    }
    const { error: saveError } = await setSystemLogo(url);
    setLogoSaving(false);
    if (saveError) {
      setLogoError(isAr ? `فشل حفظ الشعار: ${saveError}` : `Failed to save logo: ${saveError}`);
      return;
    }
    logActivity("settings_changed", "System logo updated", profile?.email ?? undefined);
  };

  // ── Auto-Cleanup ─────────────────────────────────────────────
  const [cleanupStatus, setCleanupStatus] = useState<{ pendingDeletionCount: number; expiredCount: number } | null>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const cleanupApiBase = getApiBase();

  useEffect(() => {
    setCleanupLoading(true);
    getApiAuthHeaders()
      .then((headers) => fetch(`${cleanupApiBase}/cleanup/status`, { headers }))
      .then((r) => r.json())
      .then((d) => setCleanupStatus(d))
      .catch(() => setCleanupStatus(null))
      .finally(() => setCleanupLoading(false));
  }, []);

  const handleManualCleanup = async () => {
    setCleanupRunning(true);
    setCleanupMsg(null);
    try {
      const res = await fetch(`${cleanupApiBase}/cleanup/run`, { method: "POST", headers: await getApiAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setCleanupMsg({ type: "ok", text: isAr ? "تم تنفيذ عملية التنظيف بنجاح" : "Cleanup sweep completed successfully" });
      logActivity("settings_changed", "Manual cleanup sweep triggered", profile?.email ?? undefined);
      // Refresh status
      const statusRes = await fetch(`${cleanupApiBase}/cleanup/status`, { headers: await getApiAuthHeaders() });
      if (statusRes.ok) setCleanupStatus(await statusRes.json());
    } catch (err: unknown) {
      setCleanupMsg({ type: "error", text: err instanceof Error ? err.message : "Cleanup failed" });
    } finally {
      setCleanupRunning(false);
      setTimeout(() => setCleanupMsg(null), 4000);
    }
  };

  // ── Activity Logs ───────────────────────────────────────────
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearMsg, setClearMsg] = useState("");

  const handleClearLogs = () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    import("@/lib/activityLogger").then(({ clearActivityLogs }) => {
      clearActivityLogs();
      setClearMsg(t.logsCleared);
      setClearConfirm(false);
      setTimeout(() => setClearMsg(""), 3000);
    });
  };

  const themeOptions: { value: Theme; label: string; arLabel: string; icon: React.ElementType }[] = [
    { value: "light", label: "Light", arLabel: "فاتح", icon: Sun },
    { value: "dark",  label: "Dark",  arLabel: "داكن", icon: Moon },
    { value: "system", label: "System", arLabel: "تلقائي", icon: Monitor },
  ];

  const initials = (profile?.full_name || profile?.email || "A")
    .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t.settingsTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.settingsSubtitle}</p>
      </div>

      <div className="space-y-4 max-w-2xl">

        {/* ── Admin Profile ──────────────────────────────────── */}
        <SectionCard title={isAr ? "الملف الشخصي" : "Admin Profile"} icon={User}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-lg bg-primary flex items-center justify-center text-white text-lg font-semibold shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{profile?.full_name || (isAr ? "بدون اسم" : "No name set")}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email || profile?.email}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary">
                {isAr ? "مدير" : "Admin"}
              </span>
            </div>
            {!editingProfile && (
              <Button variant="outline" size="sm" className="rounded-md shrink-0" onClick={() => { setNameInput(profile?.full_name || ""); setEditingProfile(true); setProfileMsg(null); }}>
                <Pencil className="w-3.5 h-3.5" />
                {isAr ? "تعديل" : "Edit"}
              </Button>
            )}
          </div>

          {editingProfile && (
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <Label className="font-medium text-sm">{isAr ? "الاسم الكامل" : "Full Name"}</Label>
                <Input
                  placeholder={isAr ? "أدخل اسمك الكامل" : "Enter your full name"}
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="h-11 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex-1 rounded-md bg-primary border-0"
                >
                  {profileSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الحفظ..." : "Saving..."}</>
                    : <><Check className="w-4 h-4" />{isAr ? "حفظ" : "Save"}</>
                  }
                </Button>
                <Button variant="outline" onClick={() => { setEditingProfile(false); setProfileMsg(null); }} className="rounded-md px-3">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {profileMsg && (
            <div className={cn("flex items-center gap-2 text-sm rounded-md px-3 py-2", profileMsg.type === "ok" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-destructive bg-destructive/10")}>
              {profileMsg.type === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {profileMsg.text}
            </div>
          )}
        </SectionCard>

        {/* ── System Branding ────────────────────────────────── */}
        <SectionCard title={isAr ? "هوية النظام" : "System Branding"} icon={Palette}>
          <div className="space-y-4">
            {/* Logo upload */}
            <div className="space-y-3">
              <Label className="font-medium text-sm">{isAr ? "شعار النظام" : "System Logo"}</Label>

              <div className="flex items-center gap-4">
                {/* Current logo preview */}
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {systemLogo ? (
                    <img
                      src={systemLogo}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                      <ImageIcon className="w-7 h-7 opacity-40" />
                      <span className="text-[10px]">{isAr ? "لا يوجد شعار" : "No logo"}</span>
                    </div>
                  )}
                </div>

                {/* Upload actions */}
                <div className="flex-1 space-y-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={logoSaving}
                    className="w-full h-10 rounded-md border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all font-medium"
                    onClick={() => { setLogoError(null); logoInputRef.current?.click(); }}
                  >
                    {logoSaving
                      ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الحفظ..." : "Saving..."}</>
                      : <><Upload className="w-4 h-4" />{isAr ? "رفع شعار" : "Upload Logo"}</>}
                  </Button>
                  {systemLogo && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoSaving}
                      className="w-full h-8 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium text-xs"
                      onClick={async () => { setLogoError(null); await setSystemLogo(""); }}
                    >
                      <X className="w-3.5 h-3.5" />
                      {isAr ? "إزالة الشعار" : "Remove Logo"}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "PNG، JPG، SVG — بحد أقصى 8 ميغابايت" : "PNG, JPG, SVG — max 8 MB"}
                  </p>
                </div>
              </div>

              {logoError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {logoError}
                </div>
              )}

              {systemLogo && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {isAr ? "تم رفع الشعار بنجاح — يظهر في الشريط الجانبي" : "Logo uploaded — now showing in the sidebar"}
                </div>
              )}
            </div>

            {/* Name input */}
            <div className="space-y-1.5">
              <Label className="font-medium text-sm">{isAr ? "اسم النظام" : "System Name"}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={isAr ? "مثال: Nexus Youth" : "e.g. Nexus Youth"}
                  value={nameInputBrand}
                  onChange={(e) => setNameInputBrand(e.target.value)}
                  className="h-11 rounded-md flex-1"
                />
                <Button
                  onClick={handleSaveBranding}
                  disabled={brandSaving}
                  className="h-11 px-4 rounded-md bg-primary border-0 shrink-0"
                >
                  {brandSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الحفظ..." : "Saving..."}</>
                    : brandSaved
                      ? <><Check className="w-4 h-4 text-white" />{isAr ? "تم الحفظ" : "Saved!"}</>
                      : (isAr ? "حفظ" : "Save")}
                </Button>
              </div>
              {brandNameError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {brandNameError}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {isAr ? "يظهر في الشريط الجانبي وشريط العنوان." : "Shown in the sidebar and browser tab title."}
              </p>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-md border border-border">
              <div className="w-9 h-9 rounded-md overflow-hidden shadow-sm shrink-0">
                {systemLogo ? (
                  <img src={systemLogo} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted text-muted-foreground flex items-center justify-center">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-foreground text-sm leading-tight">{nameInputBrand || t.appName}</p>
                <p className="text-[10px] text-muted-foreground">{isAr ? "معاينة" : "Preview"}</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* ── Appearance ─────────────────────────────────────── */}
        <SectionCard title={isAr ? "المظهر" : "Appearance"} icon={Sun}>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map(({ value, label, arLabel, icon: Icon }) => (
              <button
                key={value}
                onClick={() => {
                  setTheme(value);
                  logActivity("settings_changed", `Theme changed to ${value}`, profile?.email ?? undefined);
                }}
                className={cn(
                  "flex flex-col items-center gap-2 py-4 px-3 rounded-md border-2 transition-all font-medium text-sm",
                  theme === value
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="w-5 h-5" />
                {isAr ? arLabel : label}
                {theme === value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Language ───────────────────────────────────────── */}
        <SectionCard title={t.languagePref} icon={Globe}>
          <div className="flex gap-2">
            {([["en", "English", "إنجليزي"], ["ar", "عربي", "عربي"]] as const).map(([code, label, arLabel]) => (
              <button
                key={code}
                onClick={() => {
                  setLang(code);
                  logActivity("settings_changed", `Language changed to ${code}`, profile?.email ?? undefined);
                }}
                className={cn(
                  "flex-1 py-2.5 px-4 rounded-md text-sm font-semibold border-2 transition-all",
                  lang === code
                    ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {isAr ? arLabel : label}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* ── Auto Event Cleanup ─────────────────────────────── */}
        <SectionCard title={isAr ? "حذف الفعاليات المنتهية تلقائياً" : "Auto-Delete Expired Events"} icon={CalendarX2}>
          {/* Policy info row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2.5 flex-1 min-w-[140px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-md px-3 py-2.5">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {isAr ? "فترة السماح" : "Grace Period"}
                </p>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                  {isAr ? "٣ أيام" : "3 days"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 flex-1 min-w-[140px] bg-muted/50 border border-border rounded-md px-3 py-2.5">
              <RefreshCw className="w-4 h-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">
                  {isAr ? "التشغيل التلقائي" : "Auto Sweep"}
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {isAr ? "كل ٢٤ ساعة" : "Every 24 hours"}
                </p>
              </div>
            </div>
            <div className={cn(
              "flex items-center gap-2.5 flex-1 min-w-[140px] border rounded-md px-3 py-2.5",
              cleanupLoading
                ? "bg-muted/50 border-border"
                : (cleanupStatus?.pendingDeletionCount ?? 0) > 0
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/40"
                  : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40"
            )}>
              {cleanupLoading
                ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                : (cleanupStatus?.pendingDeletionCount ?? 0) > 0
                  ? <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                  : <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
              <div>
                <p className={cn("text-xs font-semibold",
                  cleanupLoading ? "text-muted-foreground"
                  : (cleanupStatus?.pendingDeletionCount ?? 0) > 0
                    ? "text-red-700 dark:text-red-300"
                    : "text-emerald-700 dark:text-emerald-300"
                )}>
                  {isAr ? "في انتظار الحذف" : "Pending Deletion"}
                </p>
                <p className={cn("text-sm font-semibold",
                  cleanupLoading ? "text-foreground"
                  : (cleanupStatus?.pendingDeletionCount ?? 0) > 0
                    ? "text-red-800 dark:text-red-200"
                    : "text-emerald-800 dark:text-emerald-200"
                )}>
                  {cleanupLoading ? "…" : `${cleanupStatus?.pendingDeletionCount ?? 0} ${isAr ? "فعاليات" : "events"}`}
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {isAr
              ? "يتم حذف الفعاليات المنتهية تلقائياً بعد ٣ أيام من تاريخ انتهائها، بما في ذلك جميع تذاكرها وبيانات الكوادر المرتبطة بها."
              : "Expired events are automatically deleted 3 days after their event date, including all associated tickets and staff assignments."}
          </p>

          {cleanupMsg && (
            <div className={cn(
              "flex items-center gap-2 text-sm rounded-md px-3 py-2",
              cleanupMsg.type === "ok"
                ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300"
                : "text-destructive bg-destructive/10"
            )}>
              {cleanupMsg.type === "ok"
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {cleanupMsg.text}
            </div>
          )}

          <Button
            onClick={handleManualCleanup}
            disabled={cleanupRunning}
            variant="outline"
            className="w-full h-10 rounded-md border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 font-medium text-sm"
          >
            {cleanupRunning
              ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ التنظيف…" : "Running sweep…"}</>
              : <><RefreshCw className="w-4 h-4" />{isAr ? "تشغيل التنظيف الآن" : "Run Cleanup Now"}</>}
          </Button>
        </SectionCard>

        {/* ── Activity Logs ──────────────────────────────────── */}
        <SectionCard title={t.dataSection} icon={Trash2}>
          <p className="text-sm text-muted-foreground">{t.clearLogsConfirm}</p>
          {clearMsg && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-md px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {clearMsg}
            </div>
          )}
          {clearConfirm ? (
            <div className="flex gap-2">
              <Button onClick={handleClearLogs} variant="destructive" className="flex-1 rounded-md h-10">
                <AlertTriangle className="w-4 h-4" />
                {t.confirmDeleteBtn}
              </Button>
              <Button onClick={() => setClearConfirm(false)} variant="outline" className="flex-1 rounded-md h-10">
                {t.cancel}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClearLogs}
              variant="outline"
              className="w-full rounded-md h-10 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="w-4 h-4" />
              {t.clearLogsBtn}
            </Button>
          )}
        </SectionCard>

      </div>
    </div>
  );
}
