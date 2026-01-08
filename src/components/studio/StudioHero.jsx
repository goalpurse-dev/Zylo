// src/components/studio/StudioHero.jsx
import React from "react";

export default function StudioHero({
  kicker = "AI Image Studio",
  title = "Create scroll-stopping visuals in minutes.",
  tagline = "Generate • Remix • Brand • Thumbnails",
  description = "Generate, remix, remove backgrounds, build brand kits, and ship CTR-optimized thumbnails — all in one place.",
  cta = { label: "Explore tools", to: "#tools" },
  secondaryCta = null,
  className = "",
}) {
  return (
    <section className={`pt-10 sm:pt-12 ${className}`}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        {kicker && (
          <span className="inline-block text-sm sm:text-base font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-50 text-blue-600">
            {kicker}
          </span>
        )}

        <h1 className="mt-4 text-[32px] sm:text-[40px] md:text-[48px] font-extrabold leading-tight text-black">
          {title}
        </h1>

        {tagline && (
          <p className="mt-1 text-lg sm:text-xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-600">
            {tagline}
          </p>
        )}

        {description && (
          <p className="mt-3 text-black/70 max-w-3xl">{description}</p>
        )}

        {(cta || secondaryCta) && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {cta && (
              <a
                href={cta.to}
                className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              >
                {cta.label}
                <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.293 15.707a1 1 0 010-1.414L13.586 11H5a1 1 0 110-2h8.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"/>
                </svg>
              </a>
            )}
            {secondaryCta && (
              <a
                href={secondaryCta.to}
                className="inline-flex items-center rounded-full border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-black/5"
              >
                {secondaryCta.label}
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
