import { useState, useEffect } from "react";
import { useLocale } from "@/contexts/LocaleContext";
import { getActivityLogs, clearActivityLogs, ActivityLog, ActionType } from "@/lib/activityLogger";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  CalendarDays,
  Ticket,
  LogIn,
  LogOut,
  Settings,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  event_created: CalendarDays,
  event_updated: CalendarDays,
  event_deleted: Trash2,
  ticket_issued: Ticket,
  user_login: LogIn,
  user_logout: LogOut,
  settings_changed: Settings,
};

const ACTION_COLORS: Record<ActionType, string> = {
  event_created: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
  event_updated: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  event_deleted: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  ticket_issued: "bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400",
  user_login: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  user_logout: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  settings_changed: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
};

export default function ActivityLogsPage() {
  const { t } = useLocale();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [filter, setFilter] = useState<ActionType | "all">("all");
  const [confirmClear, setConfirmClear] = useState(false);

  const loadLogs = () => setLogs(getActivityLogs());

  useEffect(() => {
    loadLogs();
  }, []);

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearActivityLogs();
    setLogs([]);
    setConfirmClear(false);
  };

  const ACTION_LABELS: Record<ActionType | "all", string> = {
    all: t.allActions,
    event_created: t.actionEventCreated,
    event_updated: t.actionEventUpdated,
    event_deleted: t.actionEventDeleted,
    ticket_issued: t.actionTicketIssued,
    user_login: t.actionUserLogin,
    user_logout: t.actionUserLogout,
    settings_changed: t.actionSettingsChanged,
  };

  const filtered = filter === "all" ? logs : logs.filter((l) => l.action === filter);

  // Group by date
  const grouped: Record<string, ActivityLog[]> = {};
  for (const log of filtered) {
    const day = format(new Date(log.timestamp), "PP");
    if (!grouped[day]) grouped[day] = [];
    grouped[day].push(log);
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t.justNow;
    if (mins < 60) return `${mins}${t.minutesAgo}`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}${t.hoursAgo}`;
    return `${Math.floor(hrs / 24)}${t.daysAgo}`;
  };

  const filterTypes: (ActionType | "all")[] = [
    "all",
    "event_created",
    "event_updated",
    "event_deleted",
    "ticket_issued",
    "user_login",
    "user_logout",
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.logsTitle}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t.logsSubtitle}</p>
        </div>
        {logs.length > 0 && (
          confirmClear ? (
            <div className="flex gap-2 shrink-0">
              <Button onClick={handleClear} variant="destructive" className="rounded-xl h-9 text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t.confirmDeleteBtn}
              </Button>
              <Button onClick={() => setConfirmClear(false)} variant="outline" className="rounded-xl h-9 text-xs">
                {t.cancel}
              </Button>
            </div>
          ) : (
            <Button
              onClick={handleClear}
              variant="outline"
              className="rounded-xl h-9 text-xs shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t.clearLogs}
            </Button>
          )
        )}
      </div>

      {/* Filter chips */}
      {logs.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {filterTypes.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                filter === f
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              {ACTION_LABELS[f]}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-card border border-card-border rounded-2xl">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-8 h-8 text-primary" />
          </div>
          <p className="text-foreground font-semibold">{t.noLogs}</p>
          <p className="text-muted-foreground text-sm mt-1">{t.noLogsDesc}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayLogs]) => (
            <div key={day}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{day}</p>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">{dayLogs.length}</span>
              </div>
              <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm divide-y divide-border">
                {dayLogs.map((log) => {
                  const Icon = ACTION_ICONS[log.action] ?? Settings;
                  const colorClass = ACTION_COLORS[log.action] ?? "bg-gray-100 text-gray-600";
                  return (
                    <div key={log.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", colorClass)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{ACTION_LABELS[log.action]}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>
                        {log.user && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5">{log.user}</p>
                        )}
                      </div>
                      <div className="text-end shrink-0">
                        <p className="text-xs text-muted-foreground">{timeAgo(log.timestamp)}</p>
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                          {format(new Date(log.timestamp), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
