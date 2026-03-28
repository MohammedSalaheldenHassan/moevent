import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuth } from "@/contexts/useAuth";
import { Button } from "@/components/ui/button";
import { logActivity } from "@/lib/activityLogger";
import {
  Globe,
  Database,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
  Code2,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SETUP_SQL = `-- 1. Create the events table
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date,
  location text,
  created_at timestamptz default now()
);

-- 2. Create the tickets table
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  customer_name text not null,
  customer_phone text,
  is_scanned boolean default false,
  created_at timestamptz default now()
);

-- 3. Create the profiles table (if not exists)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user',
  full_name text,
  email text
);

-- 4. Enable Row Level Security on all tables
alter table public.events enable row level security;
alter table public.tickets enable row level security;
alter table public.profiles enable row level security;

-- 5. RLS Policies for events (admins can do everything)
create policy "Authenticated users can read events"
  on public.events for select to authenticated using (true);

create policy "Authenticated users can insert events"
  on public.events for insert to authenticated with check (true);

create policy "Authenticated users can update events"
  on public.events for update to authenticated using (true);

create policy "Authenticated users can delete events"
  on public.events for delete to authenticated using (true);

-- 6. RLS Policies for tickets
create policy "Authenticated users can read tickets"
  on public.tickets for select to authenticated using (true);

create policy "Authenticated users can insert tickets"
  on public.tickets for insert to authenticated with check (true);

create policy "Authenticated users can update tickets"
  on public.tickets for update to authenticated using (true);

-- 7. RLS Policies for profiles
create policy "Users can read all profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

-- 8. Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'admin')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();`;

const FIX_PERMISSIONS_SQL = `-- Fix permissions for existing tables
-- Run this if you can read events but cannot update, insert, or delete them.

-- Drop old policies (safe — ignores if they don't exist)
drop policy if exists "Authenticated users can read events"   on public.events;
drop policy if exists "Authenticated users can insert events" on public.events;
drop policy if exists "Authenticated users can update events" on public.events;
drop policy if exists "Authenticated users can delete events" on public.events;
drop policy if exists "Authenticated users can read tickets"  on public.tickets;
drop policy if exists "Authenticated users can insert tickets" on public.tickets;
drop policy if exists "Authenticated users can update tickets" on public.tickets;

-- Re-create all policies
create policy "Authenticated users can read events"
  on public.events for select to authenticated using (true);

create policy "Authenticated users can insert events"
  on public.events for insert to authenticated with check (true);

create policy "Authenticated users can update events"
  on public.events for update to authenticated using (true) with check (true);

create policy "Authenticated users can delete events"
  on public.events for delete to authenticated using (true);

create policy "Authenticated users can read tickets"
  on public.tickets for select to authenticated using (true);

create policy "Authenticated users can insert tickets"
  on public.tickets for insert to authenticated with check (true);

create policy "Authenticated users can update tickets"
  on public.tickets for update to authenticated using (true) with check (true);

-- Add event_date column if your table used a different name
alter table public.events add column if not exists event_date date;
alter table public.events add column if not exists location text;`;

export default function SettingsPage() {
  const { t, lang, setLang } = useLocale();
  const { profile } = useAuth();

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testDetails, setTestDetails] = useState<{ events: string; tickets: string; profiles: string } | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearMsg, setClearMsg] = useState("");
  const [sqlCopied, setSqlCopied] = useState(false);
  const [fixCopied, setFixCopied] = useState(false);

  const handleCopyFixSQL = async () => {
    await navigator.clipboard.writeText(FIX_PERMISSIONS_SQL);
    setFixCopied(true);
    setTimeout(() => setFixCopied(false), 2000);
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestDetails(null);
    try {
      const [eventsRes, ticketsRes, profilesRes] = await Promise.all([
        supabase.from("events").select("id", { count: "exact", head: true }),
        supabase.from("tickets").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
      ]);
      const details = {
        events: eventsRes.error ? `❌ ${eventsRes.error.message}` : `✅ ${eventsRes.count ?? 0} rows`,
        tickets: ticketsRes.error ? `❌ ${ticketsRes.error.message}` : `✅ ${ticketsRes.count ?? 0} rows`,
        profiles: profilesRes.error ? `❌ ${profilesRes.error.message}` : `✅ ${profilesRes.count ?? 0} rows`,
      };
      setTestDetails(details);
      const allOk = !eventsRes.error && !ticketsRes.error && !profilesRes.error;
      setTestStatus(allOk ? "ok" : "fail");
      logActivity("settings_changed", "Connection test ran", profile?.email ?? undefined);
    } catch (err: unknown) {
      setTestStatus("fail");
      setTestDetails({ events: "❌ Could not connect", tickets: "❌ Could not connect", profiles: "❌ Could not connect" });
    }
  };

  const handleCopySQL = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
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

  const SectionCard = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
  }) => (
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

        {/* Database Setup */}
        <SectionCard title="Database Setup" icon={Code2}>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Run this SQL in your Supabase project's <strong>SQL Editor</strong> to create all required tables and RLS policies. Only needed once.
            </p>
            <div className="relative">
              <pre className="bg-muted/60 rounded-xl p-4 text-xs font-mono overflow-auto max-h-48 text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {SETUP_SQL}
              </pre>
              <button
                onClick={handleCopySQL}
                className="absolute top-2 end-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
              >
                {sqlCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {sqlCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Go to <strong>Supabase Dashboard → SQL Editor → New query</strong>, paste the script above, and click <strong>Run</strong>.
            </p>
          </div>
        </SectionCard>

        {/* Fix Permissions */}
        <SectionCard title="Fix Permissions (RLS)" icon={ShieldCheck}>
          <div className="space-y-3">
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl text-sm text-amber-800 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                <strong>Run this if edits, additions, or deletes don't save to the database.</strong>{" "}
                This safely drops and recreates all RLS policies on your existing tables — nothing is deleted.
              </p>
            </div>
            <div className="relative">
              <pre className="bg-muted/60 rounded-xl p-4 text-xs font-mono overflow-auto max-h-48 text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {FIX_PERMISSIONS_SQL}
              </pre>
              <button
                onClick={handleCopyFixSQL}
                className="absolute top-2 end-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-lg text-xs font-medium hover:bg-muted transition-colors"
              >
                {fixCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {fixCopied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Go to <strong>Supabase Dashboard → SQL Editor → New query</strong>, paste and click <strong>Run</strong>. Then try editing an event again.
            </p>
          </div>
        </SectionCard>

        {/* Connection Test */}
        <SectionCard title={t.connectionSection} icon={Database}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">{t.connectionStatus}</p>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">lzkitwefaxolgnuwdvuk.supabase.co</p>
            </div>
            {testStatus === "idle" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t.connected}
              </span>
            )}
            {testStatus === "ok" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All tables OK
              </span>
            )}
            {testStatus === "fail" && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
                <XCircle className="w-3.5 h-3.5" />
                Issues found
              </span>
            )}
          </div>

          {testDetails && (
            <div className="rounded-xl border border-border bg-muted/30 divide-y divide-border">
              {Object.entries(testDetails).map(([table, status]) => (
                <div key={table} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span className="font-mono text-xs font-medium">{table}</span>
                  <span className="text-xs text-muted-foreground">{status}</span>
                </div>
              ))}
            </div>
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
