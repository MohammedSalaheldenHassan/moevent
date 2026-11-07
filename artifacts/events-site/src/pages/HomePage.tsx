import { useEffect, useMemo } from "react";
import { isPast, useEvents } from "@/lib/events";
import { scrollToSection } from "@/lib/sections";
import { Hero } from "@/components/landing/Hero";
import { Marquee } from "@/components/landing/Marquee";
import { StatsBar } from "@/components/landing/StatsBar";
import { AvailableNow, pickAvailableNow } from "@/components/landing/AvailableNow";
import { EventsSection } from "@/components/landing/EventsSection";
import { MapSection } from "@/components/landing/MapSection";
import { TableSection } from "@/components/landing/TableSection";
import { StandOut } from "@/components/landing/StandOut";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CampaignWall } from "@/components/landing/CampaignWall";
import { Faq } from "@/components/landing/Faq";
import { CtaBand } from "@/components/landing/CtaBand";

export default function HomePage() {
  const { data, loading, error, reload } = useEvents();
  const upcoming = useMemo(() => data.filter((e) => !isPast(e)), [data]);
  // The soonest dated event drives the hero's date and countdown.
  const nextEvent = useMemo(() => upcoming.find((e) => e.event_date) ?? null, [upcoming]);
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
      <Hero nextEvent={nextEvent} />
      <Marquee />
      <StatsBar />
      {!loading && !error && <AvailableNow events={availableNow} />}
      <EventsSection upcoming={upcoming} loading={loading} error={error} onRetry={reload} />
      <div className="mt-20 sm:mt-24">
        <MapSection />
        <TableSection />
        <StandOut />
      </div>
      <HowItWorks />
      <CampaignWall />
      <Faq />
      <CtaBand />
    </>
  );
}
