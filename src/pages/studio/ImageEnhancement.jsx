// src/pages/studio/ImageEnhancement.jsx
import React from "react";
import StudioHero from "../../components/studio/StudioHero";
import HowItWorks from "../../components/studio/HowItWorks";
import ShowcaseGallery from "../../components/studio/ShowcaseGallery";
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome";
import Faq from "../../components/FAQ";
import DownFooter from "../../components/DownFooter";
import StudioStickyNav from "../../components/studio/StudioStickyNav";

// (optional) If you want a quick-actions row here too, you can reuse your
// StudioQuickActions by making a prop-able variant; skipping per your request.

export default function ImageEnhancement() {
  const stickyItems = [
    { href: "#gallery",  label: "Gallery" },
    { href: "#upscale",  label: "Upscale" },
    { href: "#sharpen",  label: "Sharpen" },
    { href: "#reframe",  label: "Reframe" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
      <StudioHero
        kicker="Image Enhancement"
        title="Make every frame look pro — fast."
        tagline="Upscaler • Image Sharpen • Smart Reframe"
        description="Boost resolution, recover details, and convert aspect ratios for any platform — without opening Photoshop."
        cta={{ label: "Explore all studios", to: "/studios" }}
        secondaryCta={null}
        className="mb-10 sm:mb-14"
      />

      {/* Sticky chips */}
      <StudioStickyNav items={stickyItems} />

      {/* GALLERY */}
      <section id="gallery">
        <ShowcaseGallery
          title="Before → after: upscales, sharpens, and smart reframes"
          images={[
            // add your thumbs here when ready
          ]}
        />
      </section>

      {/* UPSCALER (HD BOOST) */}
      <section id="upscale" className="scroll-mt-24">
        <HowItWorks
          kicker="Upscaler (HD Boost)"
          title="Turn low-res into crisp HD."
          subtitle="Recover detail and texture for thumbnails, product shots, or social posts."
          steps={[
            {
              title: "Upload & choose scale",
              desc:
                "Drop an image and pick 2× or 4×. Zylo analyzes edges, patterns, and subject areas before enhancing.",
              bullets: [
                "2× / 4× upscale options",
                "Edge-aware enhancement",
                "Preserves skin tones & texture",
              ],
            },
            {
              title: "Enhance intelligently",
              desc:
                "We reconstruct details with AI while avoiding plastic skin or ringing artifacts.",
              bullets: [
                "Anti-artifact & anti-halo logic",
                "Consistent color & contrast",
                "Optional face enhancement",
              ],
              reverse: true,
            },
            {
              title: "Export in one click",
              desc:
                "Save as PNG/JPG at your chosen size. Perfect for YouTube thumbnails, storefronts, or posts.",
              bullets: ["PNG/JPG export", "Batch coming soon", "Ready for 4K workflows"],
            },
          ]}
          cta={{ label: "Upscale an image", to: "/upscale" }}
        />
      </section>

      {/* IMAGE SHARPEN (replace ‘Fix portraits’ section) */}
      <section id="sharpen" className="scroll-mt-24">
        <ToolStepsMosaic
          variant="light"
          kicker="Image Sharpen & Detail Boost"
          title="Bring back micro-detail without the crunch."
          subtitle="Make photos and frames look naturally sharp — not over-sharpened."
          steps={[
            {
              title: "Detect edges & textures",
              desc:
                "Zylo finds fine edges (hair, text, graphics) and separates them from noise.",
              bullets: ["Edge/texture detection", "Noise-aware preprocessing", "Skin-safe regions"],
            },
            {
              title: "Sharpen selectively",
              desc:
                "We boost clarity where it counts and protect gradients, skies, and skin from artifacts.",
              bullets: [
                "Local contrast & clarity lift",
                "No halos/glows on edges",
                "Optional face detail enhance",
              ],
            },
            {
              title: "Export & compare",
              desc:
                "Preview side-by-side, then export in your original size or combine with Upscaler.",
              bullets: ["A/B compare view", "PNG/JPG export", "Works with Upscaler"],
              to: "/sharpen",
              showButton: true,
            },
          ]}
        />
      </section>

      {/* SMART REFRAME / ASPECT CONVERTER (replace ‘Clean up messy images’) */}
      <section id="reframe" className="scroll-mt-24">
        <HowItWorks
          kicker="Smart Reframe & Aspect Converter"
          title="Turn 16:9 into 9:16 — automatically."
          subtitle="Reframe any image for YouTube Shorts, TikTok, or Reels while keeping the subject centered and clean."
          steps={[
            {
              title: "Pick your target format",
              desc:
                "Choose from presets (9:16, 1:1, 4:5, 16:9). Zylo keeps the main subject in frame with safe margins.",
              bullets: ["Platform presets", "Subject tracking", "Auto safe-zone guides"],
            },
            {
              title: "Fill, extend, or crop smartly",
              desc:
                "Use content-aware fill, blurred edges, or smart crop to maintain composition without weird stretching.",
              bullets: ["Content-aware fill", "Blur/gradient edges", "Rule-of-thirds alignment"],
              reverse: true,
            },
            {
              title: "Export for any platform",
              desc:
                "Export in platform-perfect sizes with optional brand overlays and caption-safe bounds.",
              bullets: ["Exact platform sizes", "Brand overlays optional", "PNG/JPG export"],
            },
          ]}
          cta={{ label: "Reframe an image", to: "/reframe" }}
        />
      </section>

      {/* Optional second gallery pass */}
      <ShowcaseGallery
        title="Real results from Upscale, Sharpen, and Reframe"
        images={[]}
      />

      <Pricing />
      <Faq />
      <DownFooter />
    </main>
  );
}
