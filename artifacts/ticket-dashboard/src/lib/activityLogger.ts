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

export function logActivity(action: ActionType, details: string, user?: string) {
  const logs: ActivityLog[] = getActivityLogs();
  const newLog: ActivityLog = {
    id: crypto.randomUUID(),
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
