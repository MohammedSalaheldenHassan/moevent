import { useCallback, type MouseEvent } from "react";
import { useLocation } from "wouter";

export type SectionId = "events" | "how" | "about" | "faq";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function scrollToSection(id: string): boolean {
  const el = document.getElementById(id);
  if (!el) return false;
  el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
  return true;
}

/**
 * Click handler for landing-page anchors. On the home page it scrolls; on any
 * other page it navigates home with the hash, and the home page scrolls once
 * it has rendered (see useScrollToHashOnMount).
 */
export function useSectionLink() {
  const [location, navigate] = useLocation();
  return useCallback(
    (id: SectionId) => (e: MouseEvent<HTMLAnchorElement>) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      if (location === "/") scrollToSection(id);
      else navigate(`/#${id}`);
    },
    [location, navigate],
  );
}
