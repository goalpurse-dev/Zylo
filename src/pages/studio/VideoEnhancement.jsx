// src/pages/studio/VideoEnhancement.jsx
import React from "react";
import StudioHero from "../../components/studio/StudioHero";
import StudioStickyNav from "../../components/studio/StudioStickyNav";
import ShowcaseGallery from "../../components/studio/ShowcaseGallery";
import HowItWorks from "../../components/studio/HowItWorks";
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome";
import Faq from "../../components/FAQ";
import DownFooter from "../../components/DownFooter";

export default function VideoEnhancement() {
  const stickyItems = [
    { href: "#gallery",   label: "Gallery" },
    { href: "#lipsync",   label: "AI Lip Sync" },
    { href: "#greenscreen", label: "Green Screen" },
    { href: "#stock",     label: "Stock B-roll" },
    { href: "#deepfake",  label: "Deepfake" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
      <StudioHero
        kicker="Video Enhancement Suite"
        title="Take any video further — sync, swap, replace, or enhance with one click."
        tagline="AI Lip Sync • AI Green Screen • Stock Video Generator • Deepfake"
        description="Cleanly replace backgrounds, match lip-motion to any voice, generate b-roll, or swap faces for memes and skits—ready for Shorts, TikTok, and Reels."
        cta={{ label: "Explore all studios", to: "/studios" }}
        secondaryCta={null}
        className="mb-10 sm:mb-14"
      />

      {/* Sticky chips */}
      <StudioStickyNav items={stickyItems} />

      {/* Gallery */}
      <section id="gallery">
        <ShowcaseGallery
          title="Before → after: lip-sync, keying, b-roll & swaps"
          images={[
            // add thumbs when you have them
          ]}
        />
      </section>

      {/* AI Lip Sync */}
      <section id="lipsync" className="scroll-mt-24">
        <HowItWorks
          kicker="AI Lip Sync"
          title="Match lips to any language or voice—fast."
          subtitle="Perfect for dubbing, translations, or voice swaps while keeping expressions natural."
          steps={[
            {
              title: "Add video & voice",
              desc:
                "Upload your clip and either upload a voice track or generate TTS in your target language.",
              bullets: ["Multi-language TTS", "Speaker tone selection", "Auto alignment"],
            },
            {
              title: "Sync & refine",
              desc:
                "We retime and morph mouth shapes to the new audio, preserving expressions and head motion.",
              bullets: ["Phoneme-aware morphing", "Expression preservation", "Frame-accurate timing"],
              reverse: true,
            },
            {
              title: "Export cleanly",
              desc:
                "Render with mixed audio and caption track. Export vertical or widescreen in one click.",
              bullets: ["Burn-in or SRT captions", "1:1 • 9:16 • 16:9", "MP4 export"],
            },
          ]}
          cta={{ label: "Try Lip Sync", to: "/lip-sync" }}
        />
      </section>

      {/* AI Green Screen */}
      <section id="greenscreen" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="AI Green Screen"
          title="Key out backgrounds—no actual green screen."
          subtitle="Replace scenes with virtual sets, gradients, or brand backgrounds without spill."
          steps={[
            {
              title: "Smart keying",
              desc:
                "Upload your footage; we separate subject from background with hair/fur handling.",
              bullets: ["Hair/fur edges", "Spill suppression", "Shadow retention"],
            },
            {
              title: "Add a new scene",
              desc:
                "Choose a studio, gradient, blur plate, or upload a custom set. Match lighting and depth.",
              bullets: ["Virtual sets & gradients", "Light/DOF match", "Brand overlays"],
            },
            {
              title: "Render & export",
              desc:
                "Export with baked background, or alpha channel for editing elsewhere.",
              bullets: ["Alpha export (ProRes/PNG seq.)", "9:16 presets", "MP4/ProRes"],
              to: "/green-screen",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* Stock Video Generator (b-roll) */}
      <section id="stock" className="scroll-mt-24">
        <HowItWorks
          kicker="Stock Video Generator (B-roll)"
          title="Fill your edits with smart b-roll—auto picked from your script."
          subtitle="Generate or fetch cinematic cutaways that match keywords, mood, and pacing."
          steps={[
            {
              title: "Paste script or topic",
              desc:
                "We extract entities & moods to suggest shot lists (city night, hands typing, lab close-ups…).",
              bullets: ["Entity extraction", "Mood detection", "Shot-list builder"],
            },
            {
              title: "Generate or fetch",
              desc:
                "Use AI-generated shots or pull stock footage; everything is trimmed to beat.",
              bullets: ["AI or stock source", "Beat-synced trims", "Style & color match"],
              reverse: true,
            },
            {
              title: "Drop into timeline",
              desc:
                "Export a folder of b-roll clips or a pre-timed track ready to overlay.",
              bullets: ["Pre-timed sequence", "Brand LUT optional", "MP4 exports"],
            },
          ]}
          cta={{ label: "Get b-roll", to: "/stock-video" }}
        />
      </section>

      {/* Deepfake (memes/skits) */}
      <section id="deepfake" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="Deepfake (memes/skits)"
          title="Face-swap for comedy and skits—responsibly."
          subtitle="Create parody cuts and meme formats. Watermarks and consent workflow encouraged by default."
          steps={[
            {
              title: "Choose source & target",
              desc:
                "Upload the clip and the face image/video. We validate quality and alignment automatically.",
              bullets: ["Quality/pose checks", "Head pose match", "Lighting analysis"],
            },
            {
              title: "Blend naturally",
              desc:
                "We track the head and blend skin/lights with optional makeup and tone match.",
              bullets: ["Head/eye tracking", "Tone/makeup match", "Edge feathering"],
            },
            {
              title: "Render with watermark",
              desc:
                "Export with default watermark and consent note; remove only with verified rights.",
              bullets: ["Default watermark", "Consent note", "MP4 export"],
              to: "/deepfake",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* Optional second gallery */}
      <ShowcaseGallery title="Enhancement results from creators" images={[]} />

      <Pricing />
      <Faq />
      <DownFooter />
    </main>
  );
}
