const STORAGE_KEY = "tickethub_activity_logs";
const MAX_LOGS = 500;

export interface ActivityLog {
  id: string;
  action: ActionType;
  details: string;
  timestamp: string;
  user?: string;
}

export type ActionType =
  | "event_created"
  | "event_updated"
  | "event_deleted"
  | "ticket_issued"
  | "user_login"
  | "user_logout"
  | "settings_changed";

// crypto.randomUUID exists only in secure contexts (https / localhost); the
// dashboard is also opened over plain http on the LAN, where it would throw.
function newLogId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function logActivity(action: ActionType, details: string, user?: string) {
  const logs: ActivityLog[] = getActivityLogs();
  const newLog: ActivityLog = {
    id: newLogId(),
    action,
    details,
    timestamp: new Date().toISOString(),
    user,
  };
  logs.unshift(newLog);
  if (logs.length > MAX_LOGS) logs.splice(MAX_LOGS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
}

export function getActivityLogs(): ActivityLog[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function clearActivityLogs() {
  localStorage.removeItem(STORAGE_KEY);
}
