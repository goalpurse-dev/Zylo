// The owner's Home (Studio v2): the prompt-first signed-in Home from laptop-transfer: one prompt box (Maestro /
// Create / Quick), recent projects, the studios, trending templates, In This Town, Made with Zyvo, tutorials.
import { useEffect, useState } from "react";
import MadeWithZyvo from "../../components/home-v2/madeWithZyvo/MadeWithZyvo.jsx";
import useBlockyWorldsAccess from "../../components/viral-tools/blocky-worlds/api/blockyWorldsAccess";
import { showBlockyWorlds } from "../../data/blockyWorlds";
import { FeaturedTemplate, HOME_MAX_W, JumpBackInV2, TutorialsRow } from "../../components/home-v2/HomeV2Sections.jsx";
import { HomeHero, RewardsStrip, TrendingTemplates } from "../../components/home-v2/HomeHero.jsx";
import StudioCards from "../../components/create/StudioCards.jsx";
import { fetchShowcase } from "../../components/launch/launch";
import { TOWN_TEMPLATE } from "../../data/homeContent";
import { BLOCKY_STORIES_FLAG, BLOCKY_STORIES_LAUNCHED } from "../../data/blockyStories";
import { useFeatureFlag } from "../../lib/featureFlags";
import FirstVideoHomeCard from "../../components/onboarding/FirstVideoHomeCard.jsx";
import SpamNote from "../../components/onboarding/SpamNote.jsx";

// THE OWNER'S COPY of Home (Studio v2, owner-only 2026-11-27): the signed-in Home only. HomeV2.jsx renders it only
// for an account src/lib/studioV2.js says yes to; everyone else, and every signed-out visitor, gets today's Home.
export default function HomeV2Studio() {
  return <SignedInHome />;
}

function SignedInHome() {
  const [longFormCreations, setLongFormCreations] = useState([]);
  // Blocky Stories is on Home only once it is switched on for EVERYONE (the global blocky_v1 switch). No
  // user is passed on purpose: an account's own switch doesn't count here, so nothing shows before launch.
  // Until the switch has been read (the build's HTML, and a first visit's first paint) Home shows what is
  // launched, so the server HTML and the first browser render are the same and crawlers get the links.
  const blockySwitch = useFeatureFlag(BLOCKY_STORIES_FLAG, null);
  const blockyLive = blockySwitch.loading ? BLOCKY_STORIES_LAUNCHED : blockySwitch.enabled;

  useEffect(() => {
    fetchShowcase("home").then(setLongFormCreations);
  }, []);

  // In This Town: only for visitors the server lets see it (the same answer as its menu entry and Home block)
  const townVisible = showBlockyWorlds(useBlockyWorldsAccess());

  return (
    <div className="flex-1 pb-24 lg:pb-12">
      <div className="relative isolate flex flex-col overflow-hidden bg-[#090A0A] pb-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[120px] bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,rgba(190,242,100,0.10),rgba(255,255,255,0.03)_50%,transparent_100%)] md:h-[200px] md:bg-[radial-gradient(ellipse_40%_100%_at_50%_0%,rgba(190,242,100,0.10),rgba(255,255,255,0.03)_50%,transparent_100%)]" data-testid="hero-spotlight" />
        <SpamNote where="home" />
        <FirstVideoHomeCard />
        {/* 1. one prompt box: Maestro (default) / Create / Quick */}
        <HomeHero />
      </div>

      <div className={`mx-auto w-full ${HOME_MAX_W}`}>
        {/* their recent projects (hidden for users without projects) */}
        <JumpBackInV2 />

        {/* 2. the studios (the same cards as the Create hub) */}
        <section className="mt-10 px-4 md:px-[50px]">
          <h2 className="text-[20px] font-bold tracking-tight text-white md:text-[28px]">Studios</h2>
          <div className="mt-4"><StudioCards placement="home" /></div>
        </section>

        {/* 3. trending templates */}
        <div className="mt-12"><TrendingTemplates /></div>

        {/* In This Town's own section (the only one on Home) */}
        {townVisible && <FeaturedTemplate template={TOWN_TEMPLATE} testId="featured-in-this-town" />}

        {/* 4. Made with Zyvo: real posted videos, each with "Make one like this" */}
        <div className="mt-12">
          <MadeWithZyvo blocky={blockyLive} longFormItems={longFormCreations} arrivals={false} />
        </div>

        {/* 5. free credits + earning, then tutorials */}
        <div className="mt-12"><RewardsStrip /></div>
        <TutorialsRow />

        {/* The brand as people search for it ("zyvoai"), once, in the page's own text. */}
        <p className="mt-12 px-4 text-center text-[12px] text-white/50 md:px-[50px]" data-testid="home-brand-line">Zyvo (ZyvoAI) · AI video generator for YouTube, TikTok and Reels</p>
      </div>
    </div>
  );
}
