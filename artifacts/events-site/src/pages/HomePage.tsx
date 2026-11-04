import { useEffect, useMemo } from "react";
import { isPast, useEvents } from "@/lib/events";
import { scrollToSection } from "@/lib/sections";
import { Hero } from "@/components/landing/Hero";
import { StatsBar } from "@/components/landing/StatsBar";
import { AvailableNow, pickAvailableNow } from "@/components/landing/AvailableNow";
import { EventsSection } from "@/components/landing/EventsSection";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { About } from "@/components/landing/About";
import { Faq } from "@/components/landing/Faq";
import { CtaBand } from "@/components/landing/CtaBand";

export default function HomePage() {
  const { data, loading, error, reload } = useEvents();
  const upcoming = useMemo(() => data.filter((e) => !isPast(e)), [data]);
  // "Available now" only earns its place when it is a subset; if it would
  // list every upcoming event, the full list below already shows them.
  const availableNow = useMemo(() => {
    const picked = pickAvailableNow(upcoming);
    return picked.length < upcoming.length ? picked : [];
  }, [upcoming]);

  // Arriving from another page via /#section: scroll once the events have
  // rendered, so the target doesn't move as the lists above it fill in.
  useEffect(() => {
    if (loading) return;
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => scrollToSection(id));
  }, [loading]);

  return (
    <>
      <Hero />
      <StatsBar />
      {!loading && !error && <AvailableNow events={availableNow} />}
      <EventsSection upcoming={upcoming} loading={loading} error={error} onRetry={reload} />
      <HowItWorks />
      <About />
      <Faq />
      <CtaBand />
    </>
  );
}
