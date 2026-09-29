// Home v2 (hidden local route /home-v2): the Long Form launch layout, built
// from today's Home pieces (gradient headline, zyvo suite coverflow).
import { useEffect, useState } from "react";
import Glow from "../../components/workspace/Glow.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import PublicGallery from "../../components/public-gallery/gallery.jsx";
import { JumpBackInV2, LongFormSection, PathCards, SectionHeader, WhatsNewRow, suiteTemplates } from "../../components/home-v2/HomeV2Sections.jsx";
import { fetchShowcase } from "../../components/launch/launch";

export default function HomeV2() {
  const [longFormCreations, setLongFormCreations] = useState([]);

  useEffect(() => {
    document.title = "Create Visuals Faster";
    fetchShowcase("home").then(setLongFormCreations);
  }, []);

  return (
    <div className="flex-1 pb-24 lg:pb-12">
      {/* HERO: dark ground, a soft purple glow left and lime glow right behind the headline */}
      <div className="relative isolate flex flex-col overflow-hidden bg-[#090A0A] pb-2">
        <div className="pointer-events-none absolute -left-40 -top-24 -z-10 h-[520px] w-[720px] rounded-full bg-[radial-gradient(closest-side,rgba(122,59,255,0.22),transparent)]" />
        <div className="pointer-events-none absolute -right-40 -top-10 -z-10 h-[480px] w-[680px] rounded-full bg-[radial-gradient(closest-side,rgba(190,242,100,0.10),transparent)]" />
        <Glow />
        <PathCards />
      </div>

      <WhatsNewRow />

      <LongFormSection />

      {/* Short Form: the zyvo suite coverflow is the templates section */}
      <div className="mt-12">
        <ZyvoSuiteCarousel items={suiteTemplates()} subtitle="Short Form templates for TikTok, Reels & Shorts" />
      </div>

      {/* Hidden for users without projects */}
      <JumpBackInV2 />

      <div className="mt-12">
        <div className="px-4 md:px-[50px]">
          <SectionHeader title="Community creations" subtitle="Watch how people use Zyvo to make content that performs." />
        </div>
        <PublicGallery hideHeader dense longFormItems={longFormCreations} excludeCategories={["Face ASMR", "Lego", "Cartoon"]} />
      </div>
    </div>
  );
}
