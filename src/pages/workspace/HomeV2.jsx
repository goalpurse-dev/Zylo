import { lazy as studioLazy, Suspense as StudioSuspense } from "react";
import { useStudioV2 } from "../../lib/studioV2.js";
// Home (the site root, "/"): the Long Form launch layout, built from the previous
// Home's pieces (gradient headline, zyvo suite coverflow). The previous Home is
// home.jsx, behind USE_LEGACY_HOME (src/data/homeContent.js) for one release.
import { useEffect, useState } from "react";
import Glow from "../../components/workspace/Glow.jsx";
import ZyvoSuiteCarousel from "../../components/workspace/ZyvoSuiteCarousel.jsx";
import MadeWithZyvo from "../../components/home-v2/madeWithZyvo/MadeWithZyvo.jsx";
import InThisTownLaunch from "../../components/home-v2/InThisTownLaunch.jsx";
import RealThreeD from "../../components/home-v2/RealThreeD.jsx";
import WorkflowNiches from "../../components/home-v2/WorkflowNiches.jsx";
import useBlockyWorldsAccess from "../../components/viral-tools/blocky-worlds/api/blockyWorldsAccess";
import { showBlockyWorlds } from "../../data/blockyWorlds";
import { FeaturedTemplate, HOME_MAX_W, JumpBackInV2, LongFormSection, PathCards, PhoneTemplates, PhoneTools, SectionHeader, TutorialsRow, WhatsNewRow, suiteTemplates } from "../../components/home-v2/HomeV2Sections.jsx";
import { fetchShowcase } from "../../components/launch/launch";
import { BLOCKY_TEMPLATE, TOWN_TEMPLATE } from "../../data/homeContent";
import { BLOCKY_STORIES_FLAG, BLOCKY_STORIES_LAUNCHED } from "../../data/blockyStories";
import { useFeatureFlag } from "../../lib/featureFlags";
import FirstVideoHomeCard from "../../components/onboarding/FirstVideoHomeCard.jsx";
import SpamNote from "../../components/onboarding/SpamNote.jsx";

function HomeV2() {
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

  const [phone, setPhone] = useState(false);
  useEffect(() => { setPhone(window.matchMedia("(max-width: 767px)").matches); }, []);
  // In This Town: only for visitors the server lets see it (the same answer as its menu entry and Home block)
  const townVisible = showBlockyWorlds(useBlockyWorldsAccess());
  const templates = suiteTemplates(Date.now(), { blocky: blockyLive, town: townVisible });

  return (
    <div className="flex-1 pb-24 lg:pb-12">
      {/* HERO: near-black ground, one soft neutral spotlight from the top
          center (no tint, no motion) that fades out above the path cards. */}
      <div className="relative isolate flex flex-col overflow-hidden bg-[#090A0A] pb-2">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80px] bg-[radial-gradient(ellipse_75%_100%_at_50%_0%,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_50%,transparent_100%)] md:h-[140px] md:bg-[radial-gradient(ellipse_40%_100%_at_50%_0%,rgba(255,255,255,0.09),rgba(255,255,255,0.035)_50%,transparent_100%)]" data-testid="hero-spotlight" />
        <Glow compact />
        <SpamNote where="home" />
        <FirstVideoHomeCard />
        <PhoneTools />
        <PathCards />
      </div>

      {/* Centred content column, capped on big screens (the hero's cards use the same width). */}
      <div className={`mx-auto w-full ${HOME_MAX_W}`}>
      <WhatsNewRow />
      <InThisTownLaunch />
      {/* "Not AI slop. Real 3D worlds.": how an In This Town video is built (shown with In This Town only) */}
      <RealThreeD />

      {/* Workflows for viral niches: a hub, pulsing lines, one card per template (In This Town first) */}
      <WorkflowNiches />

      {/* Short Form: the "short form suite" coverflow is the templates section (owner, 2026-11-17: under the workflows,
          above Long Form; the Fruit series / free-plan lines under it removed) */}
      <div className="mt-12">
        {/* The coverflow keeps animating when hidden, so a phone drops it once it knows (the first render keeps its links for crawlers). */}
        {!phone && <div className="hidden md:block"><ZyvoSuiteCarousel title="short form suite" items={templates} subtitle="Short Form templates for TikTok, Reels & Shorts" /></div>}
        <div className="px-4 md:hidden"><SectionHeader title="Short Form templates" subtitle="For TikTok, Reels & Shorts." /></div>
        <PhoneTemplates items={templates} />
      </div>

      <LongFormSection />

      {/* In This Town's own section, the newest template first (shown with In This Town only) */}
      {townVisible && <FeaturedTemplate template={TOWN_TEMPLATE} testId="featured-in-this-town" />}

      {/* Blocky Stories' own section, right above the featured template and built the same way (launched only). */}
      {blockyLive && <FeaturedTemplate template={BLOCKY_TEMPLATE} testId="featured-blocky" />}

      {/* Featured template (src/data/homeContent.js: FEATURED_TEMPLATE) */}
      <FeaturedTemplate />

      {/* Tutorials, under the featured template (owner, 2026-11-10) */}
      <TutorialsRow />

      {/* Hidden for users without projects */}
      <JumpBackInV2 />

      {/* Made with Zyvo: the owner's own videos per template (src/data/communityShowcase.json) */}
      <div className="mt-12">
        <MadeWithZyvo blocky={blockyLive} longFormItems={longFormCreations} />
      </div>
      {/* The brand as people search for it ("zyvoai"), once, in the page's own text. */}
      <p className="mt-12 px-4 text-center text-[12px] text-white/50 md:px-[50px]" data-testid="home-brand-line">Zyvo (ZyvoAI) · AI video generator for YouTube, TikTok and Reels</p>
      </div>
    </div>
  );
}

// Studio v2, OWNER-ONLY (owner 2026-11-27): the owner's account (asked on the server, src/lib/studioV2.js) gets the
// new version; everyone else, signed out or in, gets the function above exactly as before.
const HomeStudio = studioLazy(() => import("./HomeV2Studio.jsx"));
export default function HomeV2Switch(props) {
  const { on } = useStudioV2();
  if (on) return <StudioSuspense fallback={null}><HomeStudio {...props} /></StudioSuspense>;
  return <HomeV2 {...props} />;
}
