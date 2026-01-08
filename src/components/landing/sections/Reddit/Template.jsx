// src/components/landing/AppLandingTemplate.jsx
import React from "react";
import Hero from "./RedditHero";
import BigVisual from "./BigVisualReddit";
import HowItWorks from "./HowItWorksR";
import Reviews from "./ReviewsR";
import OtherTools from "./OtherToolsR";
import Pricing from "./Pricing";
import FAQ from "./FAQ";
import FinalCTA from "./FinalCTA";

export default function AppLandingTemplate({
  // HERO
  hero: { kicker, title, subtitle, ctaText, ctaHref, heroImg, tint="blue" },
  // BIG VISUAL
  visual: { mediaSrc, mediaAlt, mediaType = "image" }, // "image" | "video"
  // HOW IT WORKS (3 concise steps)
  steps, // [{title, desc, icon}, ...]
  // REVIEWS
  reviews, // [{name, handle, avatar, quote}, ...]
  // OTHER TOOLS (chips)
  tools,   // [{label, to}, ...]
  // PRICING
  plans,   // [{name, price, note, features:[] , ctaText, ctaHref, popular?}, ...]
  // FAQ
  faqs,    // [{q,a}, ...]
}) {
  return (
    <div className="bg-white text-black">
      <Hero {...{ kicker, title, subtitle, ctaText, ctaHref, heroImg, tint }} />
      <BigVisual {...{ mediaSrc, mediaAlt, mediaType }} />
      <HowItWorks steps={steps} />
      <Reviews items={reviews} />
      <OtherTools items={tools} />
      <Pricing plans={plans} />
      <FAQ items={faqs} />
      <FinalCTA title="Ready to create?" ctaText={ctaText} ctaHref={ctaHref} />
    </div>
  );
}
