// src/pages/studio/VideoStudio.jsx
import React from "react";
import StudioHero from "../../components/studio/StudioHero";
import StudioStickyNav from "../../components/studio/StudioStickyNav";
import ShowcaseGallery from "../../components/studio/ShowcaseGallery";
import HowItWorks from "../../components/studio/HowItWorks";
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome";
import Faq from "../../components/FAQ";
import DownFooter from "../../components/DownFooter";

export default function VideoStudio() {
  const stickyItems = [
    { href: "#gallery", label: "Gallery" },
    { href: "#avatars", label: "Avatars" },
    { href: "#music", label: "Music" },
    { href: "#auto", label: "Auto-Editor" },
    { href: "#cartoon", label: "3D Cartoon" },
    { href: "#irl", label: "IRL → AI" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
      <StudioHero
        kicker="AI Video Studio"
        title="Generate viral-ready videos, shorts & reels — automatically."
        tagline="Talking Avatars • Music Videos • Auto Shorts • 3D Cartoon • IRL → AI"
        description="From faceless avatars to 3D cartoon edits, produce platform-ready videos in seconds. No editors, no stress."
        cta={{ label: "Explore all studios", to: "/studios" }}
        secondaryCta={null}
        className="mb-10 sm:mb-14"
      />

      {/* Sticky chips */}
      <StudioStickyNav items={stickyItems} />

      {/* Gallery */}
      <section id="gallery">
        <ShowcaseGallery
          title="Clips made with AI Video Studio"
          images={[
            // add thumbs when ready
          ]}
        />
      </section>

      {/* Talking Avatars */}
      <section id="avatars" className="scroll-mt-24">
        <HowItWorks
          kicker="Talking Avatar Videos"
          title="Turn any script into a presenter-style video."
          subtitle="Pick an avatar, paste text (or upload audio), and render auto-captioned clips in multiple languages."
          steps={[
            {
              title: "Write or paste your script",
              desc:
                "Start with a hook or import text from your doc. Add pauses, emphasis, and emojis for natural delivery.",
              bullets: [
                "Script editor + emphasis tags",
                "Multi-language support",
                "Optional voice-to-avatar",
              ],
            },
            {
              title: "Choose avatar, voice & layout",
              desc:
                "Pick a presenter, set camera crop, background, and brand overlays. Swap voices or languages instantly.",
              bullets: [
                "Dozens of avatars & voices",
                "Brand kit overlays",
                "Green-screen or scene backgrounds",
              ],
              reverse: true,
            },
            {
              title: "Render & export",
              desc:
                "Auto generate subtitles and safe-zone framing. Export in platform-ready sizes for Shorts, Reels, and TikTok.",
              bullets: ["Auto captions", "1:1 • 9:16 • 16:9", "MP4 export"],
            },
          ]}
          cta={{ label: "Create an avatar video", to: "/avatar" }}
        />
      </section>

       {/* 3D Cartoon Video Maker */}
      <section id="cartoon" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="3D Cartoon Video Maker"
          title="Transform real clips into stylized 3D cartoons."
          subtitle="Anime, comic, Pixar-ish, or low-poly — keep motion and camera moves intact."
          steps={[
            {
              title: "Choose your cartoon style",
              desc:
                "Pick from stylized presets or upload references to match your channel’s look.",
              bullets: ["Anime/comic/Pixar-ish", "Reference-guided looks", "Noise-robust tracking"],
            },
            {
              title: "Convert & preview",
              desc:
                "We process frames with motion-aware models to avoid flicker. Tweak strength and line weight.",
              bullets: ["Motion-aware conversion", "Anti-flicker pipeline", "Line weight control"],
            },
            {
              title: "Export clean results",
              desc:
                "Export with alpha or on a background, then add SFX or subtitles as needed.",
              bullets: ["MP4 with/without alpha", "4K ready", "Ready for SFX/captions"],
              to: "/3d-cartoon",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* Viral Shorts Auto-Editor */}
      <section id="auto" className="scroll-mt-24">
        <HowItWorks
          kicker="Viral Shorts Auto-Editor"
          title="Turn long videos into punchy shorts."
          subtitle="Detect highlights, cut dead air, add captions, and export vertical reels automatically."
          steps={[
            {
              title: "Upload your long video",
              desc:
                "We analyze speakers, pauses, and spikes to find the best moments automatically.",
              bullets: ["Speaker & silence detection", "Hook finder", "Auto scene splits"],
            },
            {
              title: "Auto edit for vertical",
              desc:
                "Smart crop to 9:16, face tracking, zoom-cuts, b-roll and emoji overlays where they matter.",
              bullets: ["Smart 9:16 reframing", "Face tracking + zooms", "Auto b-roll & overlays"],
              reverse: true,
            },
            {
              title: "Captions & export",
              desc:
                "Burn in styled captions, brand colors, and export batches for TikTok/Shorts/Reels.",
              bullets: ["Karaoke captions", "Brand kit styling", "Batch export"],
            },
          ]}
          cta={{ label: "Auto-edit my video", to: "/shorts-auto-editor" }}
        />
      </section>

     
 <Pricing />
      {/* IRL → AI Video */}
      <section id="irl" className="scroll-mt-24">
        <HowItWorks
          kicker="IRL footage → AI Video"
          title="Stylize real footage into AI looks."
          subtitle="Swap scenes, apply cinematic looks, or generate AI b-roll from prompts."
          steps={[
            {
              title: "Upload your footage",
              desc:
                "We stabilize, denoise, and prep frames for consistent AI styling.",
              bullets: ["Prep: stabilize & denoise", "Consistent color", "Scene detection"],
            },
            {
              title: "Pick a look or prompt",
              desc:
                "Choose a LUT or text prompt (e.g., ‘neo-noir cyber city’) to generate matching scenes or overlays.",
              bullets: ["Look LUTs & prompts", "Style strength control", "Subject-aware masking"],
              reverse: true,
            },
            {
              title: "Render & export",
              desc:
                "Export vertical or widescreen with brand overlays and subtitles, ready for upload.",
              bullets: ["9:16 • 1:1 • 16:9", "Brand overlays", "MP4 export"],
            },
          ]}
          cta={{ label: "Try IRL → AI", to: "/irl-to-ai" }}
        />
      </section>

      {/* Optional second gallery */}
      <ShowcaseGallery title="Recent renders from AI Video Studio" images={[]} />

     
     
      <Faq />
      <DownFooter />
    </main>
  );
}
