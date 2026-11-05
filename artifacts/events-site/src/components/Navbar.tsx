import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Link, useLocation } from "wouter";
import { Globe, Menu, Moon, Sun, X } from "lucide-react";
import { useLocale } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { useSectionLink, type SectionId } from "@/lib/sections";
import { Wordmark } from "./Logo";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { t, toggle, isAr } = useLocale();
  return (
    <button
      type="button"
      onClick={toggle}
      lang={isAr ? "en" : "ar"}
      className={`inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-soft hover:bg-bg hover:text-ink ${className}`}
    >
      <Globe className="size-4" aria-hidden="true" />
      {t.switchLang}
    </button>
  );
}

function ThemeToggle() {
  const { t } = useLocale();
  const { theme, toggle } = useTheme();
  const label = theme === "dark" ? t.themeToLight : t.themeToDark;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex size-10 items-center justify-center rounded-md text-ink-soft hover:bg-bg hover:text-ink"
    >
      {theme === "dark" ? <Sun className="size-[18px]" aria-hidden="true" /> : <Moon className="size-[18px]" aria-hidden="true" />}
    </button>
  );
}

export function Navbar() {
  const { t } = useLocale();
  const [location] = useLocation();
  const sectionLink = useSectionLink();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const links: { id: SectionId; label: string }[] = [
    { id: "events", label: t.navEvents },
    { id: "how", label: t.navHow },
    { id: "about", label: t.navAbout },
    { id: "faq", label: t.navFaq },
  ];

  // Close the mobile menu on navigation and on Escape (returning focus to the toggle).
  useEffect(() => setOpen(false), [location]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (id: SectionId) => {
    const handler = sectionLink(id);
    return (e: MouseEvent<HTMLAnchorElement>) => {
      setOpen(false);
      handler(e);
    };
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-md focus:bg-btn focus:px-3 focus:py-2 focus:text-sm focus:text-on-btn"
      >
        {t.skipToContent}
      </a>

      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" aria-label="Nexus Youth" className="flex h-10 shrink-0 items-center rounded">
          <Wordmark />
        </Link>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`/#${l.id}`}
                  onClick={go(l.id)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-bg hover:text-ink"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <LanguageToggle className="hidden sm:inline-flex" />
          <a
            href="/#events"
            onClick={go("events")}
            className="hidden h-10 items-center rounded-md bg-btn px-4 text-sm font-semibold text-on-btn transition-colors hover:bg-accent-hover hover:text-on-accent sm:inline-flex"
          >
            {t.browseEvents}
          </a>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={menuId}
            aria-label={open ? t.closeMenu : t.openMenu}
            className="inline-flex size-10 items-center justify-center rounded-md text-ink hover:bg-bg lg:hidden"
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div id={menuId} hidden={!open} className="border-t border-line bg-surface lg:hidden">
        <nav aria-label="Mobile" className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <ul className="flex flex-col">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={`/#${l.id}`}
                  onClick={go(l.id)}
                  className="flex h-12 items-center rounded-md px-3 text-base font-medium text-ink hover:bg-bg"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:hidden">
            <LanguageToggle className="justify-start" />
            <a
              href="/#events"
              onClick={go("events")}
              className="inline-flex h-12 items-center justify-center rounded-md bg-btn text-base font-semibold text-on-btn hover:bg-accent-hover hover:text-on-accent"
            >
              {t.browseEvents}
            </a>
          </div>
        </nav>
      </div>
    </header>
  );
}
