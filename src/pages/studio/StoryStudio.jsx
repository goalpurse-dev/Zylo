import React from "react";
import StudioHero from "../../components/studio/StudioHero";
import StudioStickyNav from "../../components/studio/StudioStickyNav";
import ShowcaseGallery from "../../components/studio/ShowcaseGallery";
import HowItWorks from "../../components/studio/HowItWorks";
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome";
import Faq from "../../components/FAQ";
import DownFooter from "../../components/DownFooter";

export default function StorySocialStudio() {
  const stickyItems = [
    { href: "#gallery",  label: "Gallery" },
    { href: "#reddit",   label: "Reddit Stories" },
    { href: "#text",     label: "Text Stories" },
    { href: "#hashtags", label: "Hashtags" },
    { href: "#threads",  label: "Threads" },
    { href: "#tiktok",   label: "TikTok Hooks" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
      <StudioHero
        kicker="AI Story & Social Tools"
        title="Go viral with the perfect script, hook, and captions."
        tagline="Reddit Story Maker • Text Story Maker • Hashtag Generator • Twitter Thread Generator • TikTok Hook & Caption Generator"
        description="Generate bingeable scripts, hooks, captions and thread drafts that are tuned for Shorts, TikTok, Reels, and Twitter."
        cta={{ label: "Explore all studios", to: "/studios" }}
        secondaryCta={null}
        className="mb-10 sm:mb-14"
      />

      {/* Sticky chips */}
      <StudioStickyNav items={stickyItems} />

      {/* Gallery */}
      <section id="gallery">
        <ShowcaseGallery
          title="Scripts, hooks, and posts created with AI Story & Social"
          images={[]}
        />
      </section>

      {/* Reddit Story Maker */}
      <section id="reddit" className="scroll-mt-24">
        <HowItWorks
          kicker="Reddit Story Maker"
          title="Turn any post into a bingeable short."
          subtitle="Auto-structure AITA/relationship/true stories with hooks, beats, and voiceover-ready narration."
          steps={[
            {
              title: "Paste a link or topic",
              desc:
                "Drop a Reddit URL or keywords. We fetch the thread and detect the most compelling arc.",
              bullets: ["Thread fetch & summarization", "Character & conflict extraction", "Drama score"],
            },
            {
              title: "Auto outline & script",
              desc:
                "We map intro–rising tension–twist–resolution, then write VO and on-screen captions.",
              bullets: ["Hook + beats + twist", "VO + captions", "PG/NSFW filters"],
              reverse: true,
            },
            {
              title: "Export for Shorts",
              desc:
                "Download VO/captions or push to your editor template. Optional thumbnail ideas included.",
              bullets: ["SRT/JSON export", "B-roll & sound effect prompts", "Thumbnail copy ideas"],
            },
          ]}
          cta={{ label: "Make a Reddit story", to: "/reddit-story" }}
        />
      </section>

      {/* Text Story Maker */}
      <section id="text" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="Text Story Maker"
          title="Script fast, keep retention high."
          subtitle="One-click outlines, beat pacing, hooks and cliffhangers for any niche."
          steps={[
            {
              title: "Pick a format",
              desc:
                "Choose Shorts narration, listicle, mini-documentary, or TikTok skit.",
              bullets: ["Format presets", "Tone & persona", "Length target"],
            },
            {
              title: "Draft with beats",
              desc:
                "We structure beat-by-beat with pattern interrupts and retention checkpoints.",
              bullets: ["Hook + pattern interrupts", "CTA suggestions", "A/B hook options"],
            },
            {
              title: "Export & iterate",
              desc:
                "Export as VO script, on-screen captions or teleprompter mode.",
              bullets: ["VO/caption export", "Teleprompter view", "Multilingual"],
              to: "/text-story",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* Hashtag Generator */}
      <section id="hashtags" className="scroll-mt-24">
        <HowItWorks
          kicker="Hashtag Generator"
          title="Find tags that actually move views."
          subtitle="Topic + platform-aware suggestions ranked by relevance, volume, and competition."
          steps={[
            {
              title: "Describe your post",
              desc:
                "Paste the hook or script. We extract entities and trend-match to your niche.",
              bullets: ["Entity extraction", "Trend & seasonality", "Geo/language aware"],
            },
            {
              title: "Get ranked sets",
              desc:
                "We group tags by reach tiers (broad/medium/niche) for mix balance.",
              bullets: ["Reach tiering", "Competition score", "Spam-safe filter"],
              reverse: true,
            },
            {
              title: "Copy to clipboard",
              desc:
                "One-click copy in platform-friendly formats with separators.",
              bullets: ["Platform templates", "Saved sets", "CSV export"],
            },
          ]}
          cta={{ label: "Generate hashtags", to: "/hashtags" }}
        />
      </section>

      {/* Twitter Thread Generator */}
      <section id="threads" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="Twitter Thread Generator"
          title="Turn ideas into tight, swipe-worthy threads."
          subtitle="Hooks, proof, examples, and CTA—auto-structured with character limits in mind."
          steps={[
            {
              title: "Drop your idea or link",
              desc:
                "We analyze your point and pull supporting facts/examples.",
              bullets: ["Idea distillation", "Fact & example suggestions", "Tone guidelines"],
            },
            {
              title: "Auto structure",
              desc:
                "We craft a hook, bullets, proof, and CTA across 6–12 tweets.",
              bullets: ["Character-safe splits", "Hook variations", "Media suggestions"],
            },
            {
              title: "Schedule or export",
              desc:
                "Copy as a thread, CSV, or push to your scheduler.",
              bullets: ["Thread/CSV export", "UTM helper", "Scheduling ready"],
              to: "/twitter-threads",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* TikTok Hook & Caption Generator */}
      <section id="tiktok" className="scroll-mt-24">
        <HowItWorks
          kicker="TikTok Hook & Caption Generator"
          title="Hooks that stop the scroll."
          subtitle="10-20 hook options tuned for your niche, plus caption copy with emojis and CTAs."
          steps={[
            {
              title: "Set context",
              desc:
                "Pick niche + outcome (educate, entertain, sell, story). Add any keywords or pain points.",
              bullets: ["Niche + outcome", "Pain points", "Keyword targets"],
            },
            {
              title: "Generate hooks",
              desc:
                "We produce variants using proven patterns (curiosity gap, contrarian, problem-solution…).",
              bullets: ["Proven patterns", "A/B sets", "Retention-friendly phrasing"],
              reverse: true,
            },
            {
              title: "Captions & CTA",
              desc:
                "Get captions with emoji pacing and lightweight CTAs. Copy in one click.",
              bullets: ["Emoji pacing", "Soft/strong CTAs", "Hashtag bundle"],
            },
          ]}
          cta={{ label: "Generate hooks & captions", to: "/tiktok-hooks" }}
        />
      </section>

      {/* Optional second gallery */}
      <ShowcaseGallery title="Scripts & posts from creators" images={[]} />

      <Pricing />
      <Faq />
      <DownFooter />
    </main>
  );
}
