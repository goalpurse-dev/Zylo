// Home v2 (hidden local route /home-v2): the Long Form launch layout, built
// from today's Home pieces (space hero, headline, zyvo suite coverflow).
import { useEffect, useState } from "react";
import Glow from "../../components/workspace/Glow.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import { JumpBackInV2, LongFormSection, PathCards, SectionHeader, ToolsCompact, WhatsNewRow, suiteTemplates } from "../../components/home-v2/HomeV2Sections.jsx";
import { fetchShowcase } from "../../components/launch/launch";

function useDeferredHeroVideo() {
  const [shouldLoad, setShouldLoad] = useState(false);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!desktop.matches || reducedMotion.matches || navigator.connection?.saveData) return undefined;
    const start = () => setShouldLoad(true);
    const id = "requestIdleCallback" in window ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 700);
    return () => ("cancelIdleCallback" in window ? window.cancelIdleCallback(id) : window.clearTimeout(id));
  }, []);
  return shouldLoad;
}

export default function HomeV2() {
  const shouldLoadHeroVideo = useDeferredHeroVideo();
  const [heroVideoReady, setHeroVideoReady] = useState(false);
  const [longFormCreations, setLongFormCreations] = useState([]);

  useEffect(() => {
    document.title = "Create Visuals Faster";
    fetchShowcase("home").then(setLongFormCreations);
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">
      {/* 1 — HERO: today's space background + headline; two path cards replace the nav pill */}
      <div className="relative isolate flex flex-col overflow-hidden bg-[#090A0A] pb-2">
        <div className="absolute inset-0 -z-40 bg-[radial-gradient(circle_at_50%_18%,#4a1f70_0%,#18101f_36%,#090A0A_72%)]" />
        {shouldLoadHeroVideo && (
          <video className={`absolute inset-0 -z-30 hidden h-full w-full object-cover transition-opacity duration-700 md:block ${heroVideoReady ? "opacity-100" : "opacity-0"}`}
            autoPlay muted loop playsInline preload="none" aria-hidden="true" onCanPlay={() => setHeroVideoReady(true)}>
            <source src="/home/zyvo-hero.webm" type="video/webm" />
            <source src="/home/zyvo-hero.mp4" type="video/mp4" />
          </video>
        )}
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(9,10,10,.38)_0%,rgba(9,10,10,.08)_32%,rgba(9,10,10,.32)_64%,#090A0A_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_38%,transparent_0%,rgba(9,10,10,.14)_42%,rgba(9,10,10,.66)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-[45%] bg-gradient-to-t from-[#090A0A] via-[#090A0A]/80 to-transparent" />
        <Glow />
        <PathCards />
      </div>

      {/* 3 — WHAT'S NEW */}
      <WhatsNewRow />

      {/* 4 — JUMP BACK IN (hidden for users without projects) */}
      <JumpBackInV2 />

      {/* 5 — LONG FORM */}
      <LongFormSection />

      {/* 6 — SHORT FORM: the zyvo suite coverflow is the templates section */}
      <div className="mt-12">
        <ZyvoSuiteCarousel items={suiteTemplates()} subtitle="Short Form templates for TikTok, Reels & Shorts" />
      </div>

      {/* 7 — TOOLS + TRENDING MODELS */}
      <ToolsCompact />

      {/* 8 — COMMUNITY CREATIONS (with a Long Form tab) */}
      <div className="mt-12">
        <div className="px-4 md:px-[50px]">
          <SectionHeader title="Community creations" subtitle="Watch how people use Zyvo to make content that performs." />
        </div>
        <PublicGallery hideHeader dense longFormItems={longFormCreations} excludeCategories={["Face ASMR", "Lego", "Cartoon"]} />
      </div>
    </div>
  );
}
