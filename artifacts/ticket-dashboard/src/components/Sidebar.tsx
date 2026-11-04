import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/useAuth";
import { useLocale } from "@/contexts/LocaleContext";
import { useBranding } from "@/contexts/BrandingContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Ticket,
  Users,
  LogOut,
  Menu,
  X,
  Globe,
  Settings,
  ClipboardList,
  Building2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function Sidebar() {
  const [location] = useLocation();
  const { signOut, profile } = useAuth();
  const { t, lang, setLang, isRTL } = useLocale();
  const { systemName, systemLogo } = useBranding();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = systemName || t.appName;
  const displayLogo = systemLogo || "/logo.png";
  const isImageLogo = displayLogo.startsWith("data:") || displayLogo.startsWith("http") || displayLogo.startsWith("/");

  const isAdmin = !profile || profile.role === "admin";

  // Pending organization requests, refreshed on every navigation.
  const [pendingRequests, setPendingRequests] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .then(({ count }) => setPendingRequests(count ?? 0));
  }, [isAdmin, location]);

  const navItems: { href: string; label: string; icon: React.ElementType; badge?: number }[] = [
    { href: "/", label: t.dashboard, icon: LayoutDashboard },
    { href: "/events", label: t.events, icon: CalendarDays },
    { href: "/issue-ticket", label: t.issueTicket, icon: Ticket },
    ...(isAdmin
      ? [
          { href: "/requests", label: lang === "ar" ? "طلبات المؤسسات" : "Requests", icon: Building2, badge: pendingRequests },
          { href: "/staff", label: t.staff, icon: Users },
        ]
      : []),
  ];

  const bottomNavItems = [
    { href: "/logs", label: t.activityLogs, icon: ClipboardList },
    { href: "/settings", label: t.settings, icon: Settings },
  ];

  const initials = (profile?.full_name || profile?.email || "A")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  const NavLink = ({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ElementType; badge?: number }) => {
    const active = isActive(href);
    return (
      <Link href={href}>
        <div
          onClick={() => setMobileOpen(false)}
          aria-current={active ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm cursor-pointer border transition-colors",
            active
              ? "bg-sidebar-accent border-sidebar-border text-sidebar-accent-foreground font-medium shadow-2xs"
              : "border-transparent text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60"
          )}
        >
          <Icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} strokeWidth={1.75} />
          <span className="flex-1">{label}</span>
          {!!badge && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
              {badge}
            </span>
          )}
        </div>
      </Link>
    );
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <p className="px-2.5 pt-4 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/45">
      {children}
    </p>
  );

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Business */}
      <div className="px-4 h-16 flex items-center border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 min-w-0">
          {isImageLogo ? (
            <img
              src={displayLogo}
              alt=""
              className="w-8 h-8 rounded-md object-contain bg-black border border-sidebar-border shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Ticket className="w-4 h-4" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-sidebar-foreground text-sm leading-tight truncate">{displayName}</p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate leading-tight mt-0.5">{t.appTagline}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pb-4 overflow-y-auto">
        <SectionLabel>{lang === "ar" ? "العمليات" : "Operations"}</SectionLabel>
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>

        <SectionLabel>{lang === "ar" ? "الإدارة" : "Administration"}</SectionLabel>
        <div className="space-y-0.5">
          {bottomNavItems.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </nav>

      {/* Account */}
      <div className="px-3 py-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-1 p-0.5 rounded-md border border-sidebar-border bg-sidebar-accent/50" role="group" aria-label="Language">
          <Globe className="w-3.5 h-3.5 text-sidebar-foreground/45 mx-1.5 shrink-0" />
          {(["en", "ar"] as const).map((code) => (
            <button
              key={code}
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              className={cn(
                "flex-1 h-7 rounded text-xs font-medium transition-colors",
                lang === code
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-2xs border border-sidebar-border"
                  : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
              )}
            >
              {code === "en" ? "English" : "العربية"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="w-8 h-8 rounded-full bg-sidebar-accent border border-sidebar-border flex items-center justify-center text-sidebar-foreground text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {profile?.full_name || profile?.email || t.admin}
            </p>
            <p className="text-[11px] text-sidebar-foreground/50 truncate">
              {profile?.full_name ? profile.email : t.admin}
            </p>
          </div>
          <button
            onClick={signOut}
            title={t.signOut}
            aria-label={t.signOut}
            className="p-1.5 rounded-md text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className={cn(
          "lg:hidden fixed top-3 z-50 p-2 bg-card rounded-md border border-border shadow-xs",
          isRTL ? "right-4" : "left-4"
        )}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X className="w-4 h-4 text-sidebar-foreground" /> : <Menu className="w-4 h-4 text-sidebar-foreground" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={cn(
          "fixed top-0 h-full w-64 bg-sidebar border-sidebar-border flex flex-col z-40 transition-transform duration-200",
          isRTL ? "right-0 border-l" : "left-0 border-r",
          "lg:translate-x-0",
          mobileOpen
            ? "translate-x-0"
            : isRTL
            ? "translate-x-full lg:translate-x-0"
            : "-translate-x-full lg:translate-x-0"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
