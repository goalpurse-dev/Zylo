// src/pages/Home.jsx
import React from "react";
import { Link } from "react-router-dom";

// Sections / components
import Hero from "../components/Hero";
import FAQ from "../components/FAQ";
import ShowcaseReels from "../components/ShowcaseReels";
import ShowcaseGallery from "../components/ShowcaseGallery";
import Reviews from "../components/Reviews";
import Pricing from "../components/PricingHome";
import DownFooter from "../components/DownFooter";
import TextToImageCard from "../components/home/TextToImageCard";
import TextToVideoCard from "../components/home/TextToVideoCard";

// Assets
import RedditImage from "../assets/Reddit.png";
import TextImage from "../assets/TextImage.png";
import ImageCreator from "../assets/ImageCreator.png";
import ThumbnailCreator from "../assets/Thumbnail.png";
import MotivationalImage from "../assets/Motivation.png";

import HowItWorks from "../components/home/HowItWorks";
import FeatureGrid from "../components/home/FeatureGrid.jsx";

// Cards
import BrandKitCard from "../components/modules/BrandKitCard.jsx";
import AvatarStudioCard from "../components/modules/AvatarStudioCard.jsx";
import AdStudioCard from "../components/modules/AdStudioCard.jsx";
import ProductPhotosCard from "../components/modules/ProductPhotosCard.jsx";
import EnhancementsCard from "../components/modules/EnhancementsCard.jsx";
import PicGallery1 from "../components/gallery/picgallery1.jsx";
import PicGallery2 from "../components/gallery/picgallery2.jsx";
import PicGallery3 from "../components/gallery/picgallery3.jsx";
import VidGallery1 from "../components/gallery/videogallery1.jsx";
import Media from "../components/home/Media.jsx";
import Video from "../components/home/Video.jsx";
import QuickLaunchDuplex from "../components/home/QuickLaunchDuplex";
import TallToolsCarousel from "../components/home/TallToolsCarousel";
import ResultStrip from "../components/home/ResultsStrip";
import SocialProof from "../components/home/SocialProofStrip";
import VideoExample from "../components/home/ImageToVideoShowcase";

// Video→AI demo assets
import beforeVid from "../assets/irlbefore.png";
import animeAfter from "../assets/irllanime.png";

const featureItems = [
  { title: "Reddit Stories", desc: "Turn threads into engaging story videos.", to: "/tools/reddit-story", image: RedditImage },
  { title: "Image Creator", desc: "Turn ideas into stunning images in seconds.", to: "/image-generator", image: ImageCreator },
  { title: "Fake Text Messages", desc: "Simulate viral chat stories with avatars.", to: "/text-video", image: TextImage },
  { title: "Viral Hooks", desc: "Auto-generate hooks that grab attention.", to: "/viral-hooks" },
  { title: "Thumbnail Creator", desc: "CTR-boosted thumbnails with AI scoring.", to: "/thumbnail", image: ThumbnailCreator },
  { title: "Motivation Maker", desc: "Quote images with perfect styling.", to: "/motivation", image: MotivationalImage },
  { title: "Shorts Converter", desc: "Find highlights & convert to vertical.", to: "/shorts-converter" },
  { title: "Music Sync", desc: "Cut on beat — TikTok-ready.", to: "/music-sync" },
];

const VIDEO_AI_STYLES = [
  { id: "anime", name: "Anime / Manga", blurb: "Hand-drawn lines, vibrant colors, high-energy motion.", after: animeAfter },
  { id: "cartoon", name: "Cartoon (3D Pixar)", blurb: "Soft lighting, rounded shapes, friendly 3D toon look.", after: animeAfter },
  { id: "portrait", name: "Realistic AI Portrait", blurb: "Cinematic grading, polished skin, depth & focus.", after: animeAfter },
  { id: "fantasy", name: "Fantasy (Knight / Elf / Cyberpunk)", blurb: "Epic themes, armor, neon, moody atmospherics.", after: animeAfter },
  { id: "comic", name: "Comic Book", blurb: "Bold inks, halftones, dramatic contrast.", after: animeAfter },
];

export default function Home() {
  const [showFlows, setShowFlows] = React.useState(false);
  const [seedItem, setSeedItem] = React.useState(null);

  return (
    // flip to dark: page bg = #0c1218, text = white
    <div className="dark relative min-h-screen bg-[#0c1218] text-white overflow-hidden">
      <main className="with-rail">
            <SocialProof />
        {/* HERO */}
        <section className="full-bleed">
          <div className="page">
            <Hero />
          </div>
        </section>

    
        {/* Quick launch / carousel (unchanged) */}
        <QuickLaunchDuplex />
        <TallToolsCarousel title="Brand tools" />

        {/* Media section (unchanged) */}
        <Media />

        
     

        {/* ===== Big hero tiles row — now in a fluid grid ===== */}
        <section className="full-bleed">
          <div className="page auto-grid home-grid">
            <div className="rounded-3xl border border-white/10 bg-white/5 text-white">
              <TextToImageCard />
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 text-white">
              <TextToVideoCard />
            </div>
          </div>
        </section>


        <HowItWorks />

        
            <VideoExample />

        {/* Modules / galleries / pricing (unchanged) */}
        <section id="modules" className="mx-auto mt-10 max-w-7xl px-5">
          <div className="flex flex-col gap-16">
            <div className="rounded-3xl border border-white/10 bg-white/5 text-white">{/* reserved */}</div>

            <section className="full-bleed">
              <div className="page">
                <PicGallery1 title="Avatars used in zylos ads" />
              </div>
            </section>

            <ResultStrip />


            <Pricing />

            <section className="full-bleed">
              <div className="page">
                <PicGallery2 title="Product photos created with Zylo" />
              </div>
            </section>

            <Reviews />

            <section className="full-bleed">
              <div className="page">{/* reserved */}</div>
            </section>
          </div>
        </section>

        <section className="full-bleed">
          <div className="page">
            <PicGallery3 title="Popular imagines made with Zylo" />
          </div>
        </section>

        {/* FAQ */}
        <section className="full-bleed">
          <div className="page">
            <FAQ />
          </div>
        </section>
      </main>

      <DownFooter />
    </div>
  );
}
