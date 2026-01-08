// src/components/home/QuickLaunchDuplex.jsx
import React from "react";
import { Link } from "react-router-dom";

import videoExample from "../../assets/home/carexample.mp4";
import imgPoster from "../../assets/home/hero1.png";

function DuoCard({
  to,
  title,
  subtitle,
  mediaSrc,
  isVideo = false,
  tag = "",
}) {
  return (
    <div
      className="
        group relative overflow-hidden rounded-[24px]
        border border-white/10 bg-white/5 shadow-xl transition
        hover:bg-white/10 hover:shadow-2xl
      "
    >
      {/* Make the whole card clickable */}
      <Link to={to} className="absolute inset-0 z-10" aria-label={title} />

      {/* BIG 1:1 stage */}
      <div className="relative w-full" style={{ aspectRatio: "1 / 1" }}>
        <div className="absolute inset-0 min-h-[420px] md:min-h-[520px] xl:min-h-[620px]">
          {/* Media */}
          {isVideo ? (
            <video
              src={mediaSrc}
              autoPlay
              loop
              muted
              playsInline
              className="
                absolute inset-0 h-full w-full
                object-cover opacity-95
                transition group-hover:opacity-100
              "
            />
          ) : (
            <img
              src={mediaSrc}
              alt=""
              loading="lazy"
              draggable={false}
              className="
                absolute inset-0 h-full w-full
                object-cover opacity-95
                transition group-hover:opacity-100
              "
            />
          )}

          {/* Overlays */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-white/10" />

          {/* TOP-RIGHT icon */}
          <div
            className="
              absolute top-4 right-4 inline-flex items-center justify-center
              w-9 h-9 rounded-full bg-black/40 text-white/90 backdrop-blur
              group-hover:bg-black/55
            "
          >
            ↗
          </div>

          {/* Title + subtitle + CTA at TOP-LEFT */}
          <div className="absolute left-6 right-6 top-6">
            <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              {title}
            </h3>

            {subtitle && (
              <p className="mt-2 text-base md:text-lg text-zinc-200 max-w-[40ch]">
                {subtitle}
              </p>
            )}

            <div
              className="
                mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5
                text-sm md:text-base font-semibold text-white
                bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]
                shadow-sm group-hover:opacity-95
              "
            >
              Open
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>

          {/* Tag pill BOTTOM-LEFT */}
          {tag && (
            <div
              className="
                absolute left-6 bottom-6 inline-flex items-center gap-2
                rounded-full px-3 py-1 text-xs font-semibold
                text-white bg-black/40 backdrop-blur
              "
            >
              {tag}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuickLaunchDuplex() {
  return (
    <section className="px-5 md:px-6 py-10">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DuoCard
          to="/textimage"
          title="Text → Image"
          subtitle="Turn prompts into brand-ready visuals."
          mediaSrc={imgPoster}
          isVideo={false}
          tag="AI Image"
        />
        <DuoCard
          to="/textvideo"
          title="Text → Video"
          subtitle="Generate shorts from scripts and ideas."
          mediaSrc={videoExample}
          isVideo={true}
          tag="AI Video"
        />
      </div>
    </section>
  );
}
