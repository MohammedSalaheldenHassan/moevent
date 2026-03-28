import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
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
} from "lucide-react";
import { useState } from "react";

export function Sidebar() {
  const [location] = useLocation();
  const { signOut, profile } = useAuth();
  const { t, lang, setLang, isRTL } = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: t.dashboard, icon: LayoutDashboard },
    { href: "/events", label: t.events, icon: CalendarDays },
    { href: "/issue-ticket", label: t.issueTicket, icon: Ticket },
    { href: "/staff", label: t.staff, icon: Users },
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

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => {
    const active = isActive(href);
    return (
      <Link href={href}>
        <div
          onClick={() => setMobileOpen(false)}
          className={cn(
            "group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-150",
            active
              ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-sm shadow-violet-900/30"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          )}
        >
          <Icon className={cn("w-4 h-4 shrink-0 transition-transform", active ? "" : "group-hover:scale-110")} />
          <span>{label}</span>
          {active && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
        </div>
      </Link>
    );
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-md">
            <Ticket className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sidebar-foreground text-sm leading-tight">{t.appName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate leading-tight">{t.appTagline}</p>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}

        {/* Divider */}
        <div className="pt-3 pb-1">
          <div className="h-px bg-sidebar-border mx-1" />
        </div>

        {/* Secondary nav */}
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-3 space-y-2 border-t border-sidebar-border pt-3">
        {/* Language switcher */}
        <div className="flex items-center gap-1 px-3 py-2 rounded-xl bg-sidebar-accent/50">
          <Globe className="w-4 h-4 text-sidebar-foreground/50 shrink-0" />
          <div className="flex ms-auto gap-1">
            <button
              onClick={() => setLang("en")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                lang === "en"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              EN
            </button>
            <button
              onClick={() => setLang("ar")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all",
                lang === "ar"
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              عربي
            </button>
          </div>
        </div>

        {/* User + sign out */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sidebar-accent transition-colors group cursor-pointer"
          onClick={signOut}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {profile?.full_name || profile?.email || "Admin"}
            </p>
            <p className="text-[10px] text-sidebar-foreground/40 truncate">{t.admin}</p>
          </div>
          <LogOut className="w-3.5 h-3.5 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/70 transition-colors shrink-0" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className={cn(
          "lg:hidden fixed top-4 z-50 p-2.5 bg-sidebar rounded-xl border border-sidebar-border shadow-lg",
          isRTL ? "right-4" : "left-4"
        )}
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-4 h-4 text-sidebar-foreground" /> : <Menu className="w-4 h-4 text-sidebar-foreground" />}
      </button>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

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
