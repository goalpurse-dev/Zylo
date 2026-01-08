import React from "react";
import { ArrowRight } from "lucide-react"; // optional; remove if you don't use lucide

const mint = "#3EFECF";

function StepCard({ n, title, text, imgAlt, imgSrc }) {
  return (
    <div className="relative group">
      {/* Number badge */}
      <div
        className="absolute -top-3 -left-3 z-10 h-8 w-8 rounded-full grid place-items-center text-black text-sm font-extrabold shadow"
        style={{ background: mint }}
      >
        {n}
      </div>

      {/* Card */}
      <div className="rounded-2xl bg-[#121212] border border-[#2a2a2a] overflow-hidden shadow-[0_0_0_rgba(0,0,0,0)] group-hover:shadow-[0_0_32px_rgba(62,254,207,0.18)] transition-shadow">
        {/* Image placeholder (swap src later) */}
        <div className="relative">
          <div className="absolute inset-0 pointer-events-none rounded-t-2xl"
               style={{ boxShadow: "inset 0 -60px 80px rgba(0,0,0,.45)" }} />
          <img
            src={imgSrc}
            alt={imgAlt}
            className="w-full h-56 md:h-64 object-cover"
          />
        </div>

        {/* Copy */}
        <div className="p-5">
          <h3 className="text-white font-semibold text-lg mb-1">{title}</h3>
          <p className="text-gray-400 text-sm leading-6">{text}</p>
        </div>
      </div>
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section className="relative py-16 md:py-24">
      {/* soft glow behind title */}
      <div className="pointer-events-none absolute inset-x-0 -top-10 mx-auto h-40 w-[60%] blur-3xl opacity-25"
           style={{ background: mint }} />

      <div className="max-w-6xl mx-auto px-6">
        {/* Title */}
        <div className="text-center mb-10 md:mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold">
            How it <span className="bg-gradient-to-r from-[#3EFECF] to-[#00C4A7] bg-clip-text text-transparent">works</span>
          </h2>
          <p className="text-gray-400 mt-2">
            Three simple steps to create, export, and publish viral-ready content.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          <StepCard
            n={1}
            title="Enter prompt or paste a link"
            text="Type a prompt (or paste a YouTube/Reddit URL). Choose a template and let Zylo prep the assets automatically."
            imgAlt="Step 1 — enter prompt or link"
            imgSrc="/placeholders/how-step-1.png" // swap later
          />

          {/* Arrow (desktop) */}
          <div className="hidden md:flex items-center justify-center">
            <div className="h-0.5 w-10 bg-[#2a2a2a] mx-2" />
            <ArrowRight size={24} className="text-gray-500" />
            <div className="h-0.5 w-10 bg-[#2a2a2a] mx-2" />
          </div>

          <StepCard
            n={2}
            title="AI generates instantly"
            text="Captions, voiceover, B-roll, beat cuts—done in seconds. Tweak anything live before export."
            imgAlt="Step 2 — AI generates instantly"
            imgSrc="/placeholders/how-step-2.png" // swap later
          />

          {/* Arrow (desktop) */}
          <div className="hidden md:flex items-center justify-center md:col-span-3">
            <div className="h-0.5 flex-1 bg-[#2a2a2a]" />
            <ArrowRight size={24} className="text-gray-500 mx-4" />
            <div className="h-0.5 flex-1 bg-[#2a2a2a]" />
          </div>

          <StepCard
            n={3}
            title="Download & go viral"
            text="Export in one click with social-ready settings. Post to TikTok, YouTube, or Instagram directly."
            imgAlt="Step 3 — download and publish"
            imgSrc="/placeholders/how-step-3.png" // swap later
          />
        </div>

        {/* mini helper line */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Tip: Replace the placeholder images at <code className="text-gray-300">/placeholders/</code> with your product screenshots or GIF loops.
        </p>
      </div>
    </section>
  );
}