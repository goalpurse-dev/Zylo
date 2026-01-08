// src/pages/Product.jsx
import React from "react";
import { Link } from "react-router-dom";

// IMPORT YOUR PREVIEW IMAGES HERE
import ImageCreator from "../assets/ImageCreator.png";
import ThumbnailCreator from "../assets/Thumbnail.png";
import Motivation from "../assets/Motivation.png";
import RedditStories from "../assets/Reddit.png";


const features = [
  {
    title: "Image Creator Pro",
    description:
      "AI-powered realistic & artistic image generation with HD output and custom styles.",
  },
  {
    title: "Thumbnail Creator X",
    description:
      "Create scroll-stopping YouTube & TikTok thumbnails with CTR-boosting designs.",
  },
  {
    title: "Motivational Quote Maker",
    description:
      "Stunning posts with auto-styled quotes, ready for any social platform.",
  },
  {
    title: "Reddit Story Video Maker",
    description:
      "Convert trending Reddit stories into engaging videos with voice & captions.",
      link: "/RedditStories",
  },
  {
    title: "Viral Hook Script Generator",
    description:
      "Create hooks that grab attention in 3 seconds — preview in phone mockups.",
  },
  {
    title: "Chat Story Maker",
    description:
      "Simulate viral text conversations with custom avatars & instant video export.",
      link: "/text-video",
  },
  {
    title: "Auto Shorts Converter",
    description:
      "Paste a YouTube link, AI finds viral moments, crops to vertical & captions it.",
  },
  {
    title: "Music Sync Editor",
    description:
      "Cut videos perfectly to your chosen song’s beat — TikTok ready.",
  },
  {
    title: "Social Post Auto-Writer",
    description:
      "Generate catchy captions, hashtags & descriptions in any tone.",
  },
  {
    title: "Ad Script Wizard",
    description:
      "High-converting ad scripts for TikTok, Instagram, and YouTube in seconds.",
  },
  {
    title: "Trend Scanner",
    description:
      "Live updates on trending TikTok sounds, captions, and viral ideas.",
  },
  {
    title: "Logo & Brand Kit Generator",
    description:
      "Get a complete brand pack: logo, colors, fonts, banners — instantly.",
  },
  {
    title: "Product Mockup Creator",
    description:
      "Showcase your products on realistic mockups for ads and stores.",
  },
  {
    title: "Batch Content Generator",
    description:
      "Create 30+ posts in one click — captions, images, hooks, hashtags.",
  },
  {
    title: "Content Planner AI",
    description:
        "Plan your month’s content with AI suggestions — never run out of ideas.",
  },
];

export default function Product() {
  return (
    <div className="min-h-screen bg-[#121212] text-white py-16 px-6">
      {/* HEADER */}
      <div className="max-w-7xl mx-auto text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-[#3EFECF]">
          ZyloAI Tools — Everything You Need to Dominate Content
        </h1>
        <p className="text-gray-400 mt-4 max-w-3xl mx-auto">
          15 all-in-one AI tools to create, edit, and grow your social media.
          Faster, smarter, and more customizable than any competitor.
        </p>
      </div>

      {/* FEATURES GRID */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {features.map((feature, i) => (
          <div
            key={i}
            className="bg-[#1c1c1c] rounded-xl overflow-hidden border border-gray-800 shadow-md hover:shadow-[0_0_25px_#3EFECF55] hover:scale-[1.02] transition duration-300 flex flex-col"
          >
            {/* IMAGE */}
            <div className="h-48 w-full overflow-hidden">
              <img
                src={feature.image}
                alt={feature.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
            {/* TEXT */}
            <div className="p-6 flex flex-col justify-between flex-1">
              <div>
                <h3 className="text-xl font-semibold text-[#3EFECF] mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-400 text-sm">{feature.description}</p>
              </div>
              <Link
  to={feature.link}
  className="mt-6 inline-block text-center py-2 px-4 bg-[#3EFECF] text-black rounded-lg font-semibold hover:bg-[#2cd9ae] transition"
>
  Try Now
</Link>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


