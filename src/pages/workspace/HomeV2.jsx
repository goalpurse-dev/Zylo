// Home (/workspace/home): the Long Form launch layout, built from the previous
// Home's pieces (gradient headline, zyvo suite coverflow). The previous Home is
// home.jsx, behind USE_LEGACY_HOME (src/data/homeContent.js) for one release.
import { useEffect, useState } from "react";
import Glow from "../../components/workspace/Glow.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import { FeaturedTemplate, JumpBackInV2, LongFormSection, PathCards, SectionHeader, WhatsNewRow, suiteTemplates } from "../../components/home-v2/HomeV2Sections.jsx";
import { fetchShowcase } from "../../components/launch/launch";
import { HIDDEN_COMMUNITY_CATEGORIES } from "../../data/homeContent";

export default function HomeV2() {
  const [longFormCreations, setLongFormCreations] = useState([]);

  useEffect(() => {
    document.title = "Create Visuals Faster";
    fetchShowcase("home").then(setLongFormCreations);
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">
      {/* HERO: near-black ground, one soft neutral spotlight from the top
          center (no tint, no motion) that fades out above the path cards. */}
      <div className="relative isolate flex flex-col overflow-hidden bg-[#090A0A] pb-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80px] bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_50%,transparent_100%)] md:h-[140px] md:bg-[radial-gradient(ellipse_40%_100%_at_50%_0%,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_50%,transparent_100%)]" data-testid="hero-spotlight" />
        <Glow compact />
        <PathCards />
      </div>

      <WhatsNewRow />

      <LongFormSection />

      {/* Short Form: the "short form suite" coverflow is the templates section */}
      <div className="mt-12">
        <ZyvoSuiteCarousel title="short form suite" items={suiteTemplates()} subtitle="Short Form templates for TikTok, Reels & Shorts" />
      </div>

      {/* Featured template (src/data/homeContent.js: FEATURED_TEMPLATE) */}
      <FeaturedTemplate />

      {/* Hidden for users without projects */}
      <JumpBackInV2 />

      <div className="mt-12">
        <div className="px-4 md:px-[50px]">
          <SectionHeader title="Community creations" subtitle="Watch how people use Zyvo to make content that performs." />
        </div>
        <PublicGallery hideHeader dense longFormItems={longFormCreations} excludeCategories={HIDDEN_COMMUNITY_CATEGORIES} />
      </div>
    </div>
  );
}
