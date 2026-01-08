// src/pages/landing/RedditStoriesLanding.jsx
import React from "react";
import { useEffect } from "react";
// ---- Sections (exact names from your /components/landing/sections/Reddit folder)
import RedditHero from "../../components/landing/sections/Reddit/RedditHero";
import BigVisualReddit from "../../components/landing/sections/Reddit/BigVisualReddit";
import HowItWorks from "../../components/landing/sections/Reddit/HowItWorksR";
import ReviewsR from "../../components/landing/sections/Reddit/ReviewsR";

import Pricing from "../../components/landing/sections/Reddit/Pricing";
import FAQ from "../../components/landing/sections/Reddit/FAQ";

import DownFooter from "../../components/DownFooter";
import Reels from "../../components/ShowcaseReels";


export default function RedditStoriesLanding() {
     useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <main className="bg-white text-gray-900">
      {/* Hero section for Reddit Stories */}
      <RedditHero 
    
  kicker="Reddit Shorts"
  title="From Reddit post → Viral Short"
  subtitle="Paste a Reddit link or write your own story. Get auto captions, gameplay background, and voiceover — ready for TikTok, Reels, and Shorts."
  ctaText="Create now"
  ctaHref="/reddit-stories"
  
  tint="blue"
 
/>

      {/* Big showcase image/video */}
      <BigVisualReddit />

      {/* Steps: how it works */}
   <HowItWorks/>

      {/* Social proof / reviews */}
      <ReviewsR />

      {/* Cross-link to other tools */}

      <Reels/>

      {/* Pricing plans */}
      <Pricing />

      {/* FAQ */}
      <FAQ />

      {/* Final call to action */}
  
        <DownFooter />
    </main>
  );
}
