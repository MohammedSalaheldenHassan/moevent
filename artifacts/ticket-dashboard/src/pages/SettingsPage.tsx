import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logActivity } from "@/lib/activityLogger";
import {
  Settings,
  Globe,
  Database,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { t, lang, setLang } = useLocale();
  const { profile } = useAuth();

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearMsg, setClearMsg] = useState("");

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestMsg("");
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (error) throw error;
      setTestStatus("ok");
      setTestMsg(t.connectionOk);
      logActivity("settings_changed", "Connection test: success", profile?.email ?? undefined);
    } catch (err: unknown) {
      setTestStatus("fail");
      setTestMsg(err instanceof Error ? err.message : t.connectionFailed);
      logActivity("settings_changed", "Connection test: failed", profile?.email ?? undefined);
    }
  };

  const handleClearLogs = () => {
    if (!clearConfirm) {
      setClearConfirm(true);
      return;
    }
    import("@/lib/activityLogger").then(({ clearActivityLogs }) => {
      clearActivityLogs();
      setClearMsg(t.logsCleared);
      setClearConfirm(false);
      setTimeout(() => setClearMsg(""), 3000);
    });
  };

  const SectionCard = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t.settingsTitle}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t.settingsSubtitle}</p>
      </div>

      <div className="space-y-4 max-w-2xl">

        {/* Language */}
        <SectionCard title={t.languagePref} icon={Globe}>
          <div className="flex gap-2">
            {([["en", "English"], ["ar", "عربي"]] as const).map(([code, label]) => (
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
                {label}
              </button>
            ))}
          </div>
        </SectionCard>

        {/* Connection */}
        <SectionCard title={t.connectionSection} icon={Database}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t.connectionStatus}</p>
              <p className="text-xs text-muted-foreground mt-0.5">lzkitwefaxolgnuwdvuk.supabase.co</p>
            </div>
            <div className="flex items-center gap-2">
              {testStatus === "idle" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {t.connected}
                </span>
              )}
              {testStatus === "ok" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t.connectionOk}
                </span>
              )}
              {testStatus === "fail" && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5" />
                  {t.connectionFailed}
                </span>
              )}
            </div>
          </div>
          {testStatus === "fail" && testMsg && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{testMsg}</p>
          )}
          <Button
            onClick={handleTestConnection}
            disabled={testStatus === "testing"}
            variant="outline"
            className="w-full rounded-xl h-10"
          >
            {testStatus === "testing"
              ? <><Loader2 className="w-4 h-4 animate-spin" />{t.testing}</>
              : t.testConnection
            }
          </Button>
        </SectionCard>

        {/* Data Management */}
        <SectionCard title={t.dataSection} icon={Trash2}>
          <p className="text-sm text-muted-foreground">
            {t.clearLogsConfirm}
          </p>
          {clearMsg && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {clearMsg}
            </div>
          )}
          {clearConfirm ? (
            <div className="flex gap-2">
              <Button
                onClick={handleClearLogs}
                variant="destructive"
                className="flex-1 rounded-xl h-10"
              >
                <AlertTriangle className="w-4 h-4" />
                {t.confirmDeleteBtn}
              </Button>
              <Button
                onClick={() => setClearConfirm(false)}
                variant="outline"
                className="flex-1 rounded-xl h-10"
              >
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
