import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

// Must match public/theme-init.js, which applies the theme before first paint.
const STORAGE_KEY = "moevent-site-theme";
const THEME_COLOR = { light: "#ffffff", dark: "#171716" };

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * Follows the system setting until the visitor picks a theme; after that the
 * choice is remembered on this device.
 */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? (media().matches ? "dark" : "light"));

  useEffect(() => apply(theme), [theme]);

  // Track OS changes only while the visitor hasn't chosen explicitly.
  useEffect(() => {
    const mq = media();
    const onChange = () => {
      if (!stored()) setTheme(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // storage blocked; the choice lasts for this page view
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
