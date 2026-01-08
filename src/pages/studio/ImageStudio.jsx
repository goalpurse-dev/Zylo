import React from "react";
import StudioHero from "../../components/studio/StudioHero"; // ⬅️ from pages/studio -> components/studio
import HowItWorks from "../../components/studio/HowItWorks";
import  ShowcaseGallery from "../../components/studio/ShowcaseGallery"; // ⬅️ from components/ShowcaseGallery
import ToolStepsMosaic from "../../components/studio/ToolStepsMosaic";
import Pricing from "../../components/PricingHome"; // ⬅️ from pages/components/Pricing
import Faq from "../../components/FAQ"; // ⬅️ from pages/components/Faq
import DownFooter from "../../components/DownFooter";
import StudioQuickActions from "../../components/studio/StudioQuickActions";
import OutcomeStrip from "../../components/studio/OutcomeStrip";
import StudioStickyNav from "../../components/studio/StudioStickyNav";


export default function ImageStudio() {
  return (
    <main className="mx-auto max-w-6xl px-6 sm:px-8 py-8">
     <StudioHero
  kicker="AI Image Studio"
  title="Turn any idea into scroll-stopping visuals."
  tagline="Image Generator • BG Remover • Branding Kit • Thumbnails"
  description="Generate, enhance and brand your visuals — perfect for thumbnails, posts and ads."
  // one violet button only:
  cta={{ label: "Explore all studios", to: "/studios" }}
  secondaryCta={null}
    className="mb-10 sm:mb-14"
/>
    <StudioQuickActions />
          <OutcomeStrip />
                <StudioStickyNav />
<ShowcaseGallery
        title="Images, logos, and thumbnails created with AI Image Studio"
        images={[
       
        ]}
        // aspect="4/3" // optional override
      />
           <HowItWorks
        kicker="How it works"
        title="Image Generator"
        subtitle="From prompt to polished visual in three quick steps."
        steps={[
          {
            title: "Describe your idea",
            desc:
              "Type a clear prompt with subject, action, setting, and style hints. Add camera or lighting cues to guide the look.",
            bullets: ["Subject + action + setting (e.g., “neon city, rainy night”)",
        "Style hints (cinematic, studio lighting, 35mm, pastel)",
        "Reference image & negative keywords (optional)"],
       
          },
          {
            title: "Pick a style & size",
            desc:
              "Choose a look and format that fits your post or project. Keep it photoreal, go artsy, or switch to cartoonizer.",
            bullets: [ "Style presets: Photoreal • Art • Cartoonizer",
        "Aspect ratios: 1:1, 16:9, 4:5 (and more)",
        "Creativity/quality controls & variation count",],
         
            reverse: true,
          },
          {
            title: "Generate & refine",
            desc:
              "Create multiple results, pick your favorite, then re-roll or remix with small prompt tweaks for perfecting details.",
            bullets: [ "Variation grid with quick re-rolls",
        "Seed lock for consistent reruns across posts",
        "One-click upscale & export as PNG/JPG",],

          },
         
        ]}
        cta={{ label: "Create with Image Generator", to: "/image-generator" }}
      />
      {/* Tools section placeholder — fill with your ToolRow/ToolCard later */}
      <section id="tools" className="py-10 sm:py-12">
        {/* TODO: render the tool rows/cards here */}
      </section>
   <ShowcaseGallery
        title="Images, logos, and thumbnails created with AI Image Studio"
        images={[
       
        ]}
        // aspect="4/3" // optional override
      />
     
  <ToolStepsMosaic
  variant="light"
  kicker="AI Branding Kit"
  title="Design once. Reuse everywhere."
  subtitle="Generate a cohesive brand system—logos, colors, typography, and ready-to-use assets for your channel."
  steps={[
    {
      title: "Define your vibe",
      desc:
        "Tell Zylo your brand name and the vibe: playful, minimal, futuristic, or bold. We’ll propose color palettes and font pairs that fit.",
      bullets: ["Brand name & niche", "Mood & visual style", "Auto palette & type suggestions"],
      // no button, no media yet
    },
    {
      title: "Generate your assets",
      desc:
        "Create multiple logo concepts, banners, and channel art. Tweak shapes, spacing, and colors until it clicks.",
      bullets: ["Logo marks & wordmarks", "Banners & channel headers", "Preset-safe layouts"],
      // no button, no media yet
    },
    {
      title: "Publish everywhere",
      desc:
        "Export a clean brand kit with logo files, colors, fonts, and ready templates for thumbnails & posts. Apply with one click.",
      bullets: ["PNG/SVG logo exports", "Colors & type tokens", "Templates for YT/TikTok/IG"],
      to: "/branding-kit",
      showButton: true, // CTA only here
      // media: brandingPreviewImg (add later)
    },
  ]}
/>
<HowItWorks
        kicker="Thumbnail Creator"
        title="CTR-optimized thumbnails in minutes."
        subtitle="Turn any frame into a bold, scannable thumbnail for YouTube, TikTok, and Shorts."
        steps={[
          {
            title: "Pick your base & format",
            desc:
              "Start from a video frame or upload an image. Choose YouTube, Shorts, or TikTok presets with safe zones applied automatically.",
            bullets: [ "One-click frame grab or upload",
        "Platform presets & safe-zone guides",
        "Auto subject cutout & face enhance",],
       
          },
          {
            title: "Style it for CTR",
            desc:
            
        "Add punchy text, outlines, glows, and emojis. Apply your Brand Kit colors and fonts so every thumbnail feels on-brand.",
            bullets: [  "Bold text, outlines, glow & shadow",
        "Brand Kit colors & fonts",
        "Rule-of-thirds & contrast checks",],
         
            reverse: true,
          },
          {
            title:  "Export & A/B variants",
            desc:
             "Generate quick color and copy variations, then export in platform-perfect sizes. Batch export when you’re ready.",
            bullets: [ "1-click variants for A/B tests",
        "YouTube/TikTok size presets",
        "PNG/JPG export, 4K ready",],

          },
         
        ]}
        cta={{ label: "Create ThumbNails", to: "/image-generator" }}
      />
 <Pricing/>
<Faq/>
    <DownFooter/>
    </main>

  
    
);
}
