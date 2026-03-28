import { useRef, useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type Theme } from "@/contexts/ThemeContext";

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
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
  const { systemName, systemLogo, setSystemName, setSystemLogo } = useBranding();
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
  const [brandSaved, setBrandSaved] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleSaveBranding = () => {
    setSystemName(nameInputBrand.trim());
    if (nameInputBrand.trim()) {
      logActivity("settings_changed", `System name changed to: ${nameInputBrand.trim()}`, profile?.email ?? undefined);
    }
    setBrandSaved(true);
    setTimeout(() => setBrandSaved(false), 2500);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(isAr ? "يرجى اختيار ملف صورة صالح" : "Please select a valid image file");
      return;
    }
    const MAX_BYTES = 800 * 1024; // 800 KB
    if (file.size > MAX_BYTES) {
      setLogoError(isAr ? "حجم الصورة أكبر من 800 كيلوبايت. يرجى اختيار صورة أصغر." : "Image is larger than 800 KB. Please choose a smaller image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setSystemLogo(dataUrl);
      logActivity("settings_changed", "System logo updated", profile?.email ?? undefined);
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
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
        <h1 className="text-2xl font-bold text-foreground">{t.settingsTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.settingsSubtitle}</p>
      </div>

      <div className="space-y-4 max-w-2xl">

        {/* ── Admin Profile ──────────────────────────────────── */}
        <SectionCard title={isAr ? "الملف الشخصي" : "Admin Profile"} icon={User}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-md">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{profile?.full_name || (isAr ? "بدون اسم" : "No name set")}</p>
              <p className="text-sm text-muted-foreground truncate">{user?.email || profile?.email}</p>
              <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                {isAr ? "مدير" : "Admin"}
              </span>
            </div>
            {!editingProfile && (
              <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => { setNameInput(profile?.full_name || ""); setEditingProfile(true); setProfileMsg(null); }}>
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
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveProfile}
                  disabled={profileSaving}
                  className="flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0"
                >
                  {profileSaving
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{isAr ? "جارٍ الحفظ..." : "Saving..."}</>
                    : <><Check className="w-4 h-4" />{isAr ? "حفظ" : "Save"}</>
                  }
                </Button>
                <Button variant="outline" onClick={() => { setEditingProfile(false); setProfileMsg(null); }} className="rounded-xl px-3">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {profileMsg && (
            <div className={cn("flex items-center gap-2 text-sm rounded-xl px-3 py-2", profileMsg.type === "ok" ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20" : "text-destructive bg-destructive/10")}>
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
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                  {systemLogo && systemLogo.startsWith("data:") ? (
                    <img
                      src={systemLogo}
                      alt="Logo"
                      className="w-full h-full object-cover rounded-2xl"
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
                    className="w-full h-10 rounded-xl border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all font-medium"
                    onClick={() => { setLogoError(null); logoInputRef.current?.click(); }}
                  >
                    <Upload className="w-4 h-4" />
                    {isAr ? "رفع شعار" : "Upload Logo"}
                  </Button>
                  {systemLogo && systemLogo.startsWith("data:") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 font-medium text-xs"
                      onClick={() => { setSystemLogo(""); setLogoError(null); }}
                    >
                      <X className="w-3.5 h-3.5" />
                      {isAr ? "إزالة الشعار" : "Remove Logo"}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    {isAr ? "PNG، JPG، SVG — بحد أقصى 800 كيلوبايت" : "PNG, JPG, SVG — max 800 KB"}
                  </p>
                </div>
              </div>

              {logoError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {logoError}
                </div>
              )}

              {systemLogo && systemLogo.startsWith("data:") && (
                <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
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
                  placeholder={isAr ? "مثال: نظام التذاكر" : "e.g. EventPro, TicketHub"}
                  value={nameInputBrand}
                  onChange={(e) => setNameInputBrand(e.target.value)}
                  className="h-11 rounded-xl flex-1"
                />
                <Button
                  onClick={handleSaveBranding}
                  className="h-11 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 border-0 shrink-0"
                >
                  {brandSaved ? <><Check className="w-4 h-4 text-white" />{isAr ? "تم" : "Saved"}</> : (isAr ? "حفظ" : "Save")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isAr ? "يظهر في الشريط الجانبي وشريط العنوان." : "Shown in the sidebar and browser tab title."}
              </p>
            </div>

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl border border-border">
              <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm shrink-0">
                {systemLogo && systemLogo.startsWith("data:") ? (
                  <img src={systemLogo} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-lg">
                    🎟️
                  </div>
                )}
              </div>
              <div>
                <p className="font-bold text-foreground text-sm leading-tight">{nameInputBrand || "TicketHub"}</p>
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
                  "flex flex-col items-center gap-2 py-4 px-3 rounded-xl border-2 transition-all font-medium text-sm",
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
                  "flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold border-2 transition-all",
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

        {/* ── Activity Logs ──────────────────────────────────── */}
        <SectionCard title={t.dataSection} icon={Trash2}>
          <p className="text-sm text-muted-foreground">{t.clearLogsConfirm}</p>
          {clearMsg && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {clearMsg}
            </div>
          )}
          {clearConfirm ? (
            <div className="flex gap-2">
              <Button onClick={handleClearLogs} variant="destructive" className="flex-1 rounded-xl h-10">
                <AlertTriangle className="w-4 h-4" />
                {t.confirmDeleteBtn}
              </Button>
              <Button onClick={() => setClearConfirm(false)} variant="outline" className="flex-1 rounded-xl h-10">
                {t.cancel}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClearLogs}
              variant="outline"
              className="w-full rounded-xl h-10 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
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
