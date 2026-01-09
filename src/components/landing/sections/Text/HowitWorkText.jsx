import React from "react";
import { Link } from "react-router-dom";



// Reusable card
function ShowcaseCard({ title, kicker, desc,  reverse = false, to }) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-2 gap-8 items-center rounded-3xl bg-[#F6F7F9], "max-auto w-full 
                  p-8 sm:p-10 md:p-12 shadow-sm`}
                  
    >

      {/* Text */}
      <div className={`${reverse ? "md:order-2" : ""}`}>
        {kicker && (
          <div className="text-xs font-bold tracking-wide uppercase text-[#007BFF] mb-3">
            {kicker}
          </div>
        )}
        <h3 className="text-[28px] sm:text-[34px] md:text-[38px] font-extrabold leading-tight text-black">
          {title}
        </h3>
        <p className="mt-3 text-gray-700 text-[15px] sm:text-base max-w-prose">
          {desc}
        </p>

        <div className="mt-8">
          <Link
            to={to}
            className="btn-outline-blue text-[15px]"
          >
            Create now
          </Link>
        </div>
      </div>

{/* Image */}
<div className={`${reverse ? "md:order-1" : ""}`}>
  <div className="relative w-full rounded-2xl overflow-hidden bg-white shadow-md">
    {/* Let the image keep its natural aspect ratio */}
    
    {/* corner glow */}
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl"
      style={{
        background:
          "radial-gradient(60% 60% at 80% 0%, rgba(155,77,255,0.18), transparent 60%)",
      }}
    />
        </div>
      </div>
    </div>
  );
}

export default function FeatureShowcase() {
  const items = [
    {
   
      title: "Type a prompt or let AI generate",
      desc:
       "Write your idea or topic and our AI will generate structured content instantly or generate script yourself.", 
      reverse: false,
      to: "/text-video",

    },
    {
     
      title: "Pick style & background",
      desc:
      "Choose your background. Clean, legible, and watch-time friendly.",
        
    
      reverse: true,
       to: "/text-video",

    },
    {
    
      title: "Choose voice",
      desc:
        "Select a voice and optional music. We generate the voiceover, captions, and export for Shorts/Reels/TikTok.",
     
      reverse: false,
      to: "/text-video",

    },
  ];

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14 space-y-8 sm:space-y-10">
        {/* Section headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-black">
          Create viral faceless content with <span className="text-violet-gradient">AI</span>
        </h2>

        {/* Cards */}
        <div className="space-y-8 sm:space-y-10">
          {items.map((it, i) => (
            <ShowcaseCard key={i} {...it} />
          ))}
        </div>
        
      </div>
    </section>
  );
}
