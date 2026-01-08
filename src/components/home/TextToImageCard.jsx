import React from "react";
import { Link } from "react-router-dom";

import media1 from "../../assets/showcase/1.png";
import media2 from "../../assets/showcase/2.png";
import media3 from "../../assets/showcase/3.png";

export default function TextToImageCard({
  title = "Turn prompts into images.",
  subtitle = "Photorealistic, art, or cartoon — brand-ready visuals in seconds.",
}) {
  const ImgBox = ({ src, className = "" }) => (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 ${className}`}>
      <img src={src} alt="Generated preview" className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1677FF14] via-transparent to-[#7A3BFF14]" />
    </div>
  );

  return (
    // ↓ removed bg/ring/shadow/rounded so no big grey box
    <section className="mx-auto my-12 max-w-7xl w-full px-5 py-10">
      <header className="mb-5">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          Text → Image
        </span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white">{title}</h2>
        <p className="mt-2 text-sm text-zinc-300">{subtitle}</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT: Prompt bar */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <label htmlFor="tti-prompt" className="mb-2 block text-sm font-semibold text-zinc-100">
            Prompt
          </label>
          <input
            id="tti-prompt"
            type="text"
            placeholder="Type your prompt…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-zinc-400 outline-none transition
                       focus:border-transparent focus:ring-2 focus:ring-[#7A3BFF]"
          />
          <p className="mt-2 text-xs text-zinc-400">
            e.g., “cozy neon coffee shop, rainy night, cinematic lighting”
          </p>
        </div>

        {/* RIGHT: two tall tiles side-by-side */}
        <div className="grid grid-cols-2 gap-3 h-[340px] md:h-[420px]">
          <ImgBox src={media3} className="h-full" />
          <ImgBox src={media2} className="h-full" />
        </div>
      </div>

      <div className="mt-8 flex justify-center">
        <Link
          to="/textimage"
          className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 font-semibold text-white shadow-md"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          Generate Now
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
