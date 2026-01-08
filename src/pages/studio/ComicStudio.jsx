import React from "react";
import StudioHero from "../../components/studio/StudioHero";
import StudioStickyNav from "../../components/studio/StudioStickyNav";
import ShowcaseGallery from "../../components/studio/ShowcaseGallery";
import HowItWorks from "../../components/studio/HowItWorks";
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome";
import Faq from "../../components/FAQ";
import DownFooter from "../../components/DownFooter";

export default function ComicMakerStudio() {
  const stickyItems = [
    { href: "#gallery", label: "Gallery" },
    { href: "#builder", label: "Panel Builder" },
    { href: "#styles",  label: "Styles & Bubbles" },
    { href: "#export",  label: "Export" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
      <StudioHero
        kicker="AI Comic Maker"
        title="Turn any story into a scrollable comic or webtoon."
        tagline="Panel Builder • Auto Styles • Speech Bubbles"
        description="Outline your story, generate panels with consistent characters, and export for TikTok/Reels/Webtoon in one flow."
        cta={{ label: "Explore all studios", to: "/studios" }}
        secondaryCta={null}
        className="mb-10 sm:mb-14"
      />

      {/* Sticky chips */}
      <StudioStickyNav items={stickyItems} />

      {/* Gallery */}
      <section id="gallery">
        <ShowcaseGallery
          title="Panels & scrolls created with AI Comic Maker"
          images={[]}
        />
      </section>

      {/* Panel-by-panel Builder */}
      <section id="builder" className="scroll-mt-24">
        <HowItWorks
          kicker="Panel-by-panel Builder"
          title="From outline to storyboard in minutes."
          subtitle="Map your beats, auto-suggest panels, then refine pacing and flow."
          steps={[
            {
              title: "Outline the story",
              desc:
                "Paste a prompt, a Reddit post, or your script. We detect characters, beats, and locations.",
              bullets: ["Character & location extraction", "Beat/scene detection", "Auto panel suggestions"],
            },
            {
              title: "Lay out panels & pacing",
              desc:
                "Pick vertical scroll, grid, or hybrid. Adjust gutters, margins, and cliffhangers for retention.",
              bullets: ["Scroll/grid presets", "Timing & cliffhanger markers", "Gutters & spacing controls"],
              reverse: true,
            },
            {
              title: "Generate drafts",
              desc:
                "Create panel drafts in your chosen style with placeholder bubbles you can reposition.",
              bullets: ["Iterate per panel", "Background/character reuse", "Bubble placeholders"],
            },
          ]}
          cta={{ label: "Start a comic", to: "/comic-maker" }}
        />
      </section>

      {/* Styles & Speech Bubbles */}
      <section id="styles" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="Styles & Speech Bubbles"
          title="Lock the look. Keep characters consistent."
          subtitle="Pick manga/webtoon/comic styles. Auto place bubbles, tails, SFX and narration boxes."
          steps={[
            {
              title: "Choose art direction",
              desc:
                "Manga, webtoon, western comic, watercolor, or custom refs. Upload character sheets for consistency.",
              bullets: ["Style presets & refs", "Character sheets", "Continuity controls"],
            },
            {
              title: "Auto bubbles & SFX",
              desc:
                "We place bubbles and tails near speakers, balance inside panels, and suggest SFX text.",
              bullets: ["Bubble/tail auto-placement", "Narration & SFX blocks", "Font & stroke presets"],
            },
            {
              title: "Fine-tune & preview",
              desc:
                "Drag to reposition, resize, or restyle per panel. Preview full scroll before export.",
              bullets: ["Drag-drop editing", "Per-panel overrides", "Full scroll preview"],
              to: "/comic-maker",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* Export */}
      <section id="export" className="scroll-mt-24">
        <HowItWorks
          kicker="Export for TikTok / Reels / Webtoon"
          title="Publish everywhere with perfect sizing."
          subtitle="Auto slice long scrolls, title cards, and safe zones for Shorts platforms."
          steps={[
            {
              title: "Pick format & size",
              desc:
                "Select Webtoon long-scroll, TikTok/Reels vertical, or carousel. Safe zones applied automatically.",
              bullets: ["9:16 • 1:1 • long-scroll", "Caption/CTA safe zones", "Title card presets"],
            },
            {
              title: "Slice & package",
              desc:
                "Auto slice long scrolls into chapters/parts. We generate a clean upload pack.",
              bullets: ["Auto chapter slicing", "Ordered file pack", "Cover & thumb options"],
              reverse: true,
            },
            {
              title: "Export & share",
              desc:
                "Export PNG/JPG pages or MP4 scroll with subtle motion. Ready to upload instantly.",
              bullets: ["PNG/JPG pages", "MP4 scroll option", "Brand kit colors/fonts"],
            },
          ]}
          cta={{ label: "Create a comic now", to: "/comic-maker" }}
        />
      </section>

      {/* Optional second gallery */}
      <ShowcaseGallery title="Recent webtoons & panels from creators" images={[]} />

      <Pricing />
      <Faq />
      <DownFooter />
    </main>
  );
}
