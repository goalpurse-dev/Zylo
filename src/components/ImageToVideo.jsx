// src/components/ImageToVideoShowcase.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Replace these with your actual assets.
 * You can use images for both before/after for now,
 * or a video URL for `after` (handled automatically).
 *
 * Example:
 * import ex1Before from "@/assets/showcase/img2vid/ex1-before.jpg";
 * import ex1After  from "@/assets/showcase/img2vid/ex1-after.mp4";
 */
const examples = [
  {
    prompt: "Slow push-in, slight parallax on background, soft glow.",
    before: "/assets/showcase/ex1-before.jpg",
    after:  "/assets/showcase/ex1-after.jpg", // can be .mp4 too
  },
  {
    prompt: "Gentle zoom with light bloom and film grain.",
    before: "/assets/showcase/ex2-before.jpg",
    after:  "/assets/showcase/ex2-after.jpg",
  },
  {
    prompt: "Subtle camera move + vignette, keep subject sharp.",
    before: "/assets/showcase/ex3-before.jpg",
    after:  "/assets/showcase/ex3-after.jpg",
  },
];

const Chevron = ({ dir = "right", className = "" }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    className={className}
    aria-hidden="true"
  >
    {dir === "right" ? (
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    ) : (
      <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    )}
  </svg>
);

export default function ImageToVideoShowcase() {
  const [idx, setIdx] = useState(0);
  const n = examples.length;
  const cur = useMemo(() => examples[idx], [idx]);

  const prev = () => setIdx((i) => (i - 1 + n) % n);
  const next = () => setIdx((i) => (i + 1) % n);

  const isVideo = (src) => /\.(mp4|webm|mov|m4v)$/i.test(src || "");

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14">
        {/* Title / Desc */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-black">
            Image ➜ <span className="text-violet-gradient">Video</span> (Showcase)
          </h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">
            See how a single photo becomes an engaging animated clip. Motion, parallax and soft
            glow — perfect for TikTok, Reels and Shorts.
          </p>
        </div>

        {/* Prompt (display only) */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 sm:p-5 mb-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="text-sm text-gray-500 sm:w-28">Prompt</label>
            <div className="flex-1 h-12 rounded-lg border border-gray-200 px-4 grid items-center text-gray-800 bg-gray-50">
              {cur.prompt}
            </div>
            <Link
              to="/image-to-video"
              className="h-12 px-5 rounded-lg bg-[#007BFF] text-white font-semibold hover:bg-[#0066d6] inline-flex items-center justify-center"
            >
              Try it
            </Link>
          </div>
        </div>

        {/* Showcase card with arrows */}
        <div className="relative">
          {/* Left arrow */}
          <button
            onClick={prev}
            aria-label="Previous example"
            className="absolute -left-4 sm:-left-8 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-black text-white
                       ring-2 ring-[#007BFF] hover:bg-[#111] active:scale-95 transition"
          >
            <Chevron dir="left" className="mx-auto" />
          </button>

          {/* Right arrow */}
          <button
            onClick={next}
            aria-label="Next example"
            className="absolute -right-4 sm:-right-8 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-black text-white
                       ring-2 ring-[#007BFF] hover:bg-[#111] active:scale-95 transition"
          >
            <Chevron dir="right" className="mx-auto" />
          </button>

          {/* Content card */}
          <div className="rounded-3xl bg-[#F6F7F9] p-5 sm:p-6 shadow-sm">
            {/* two columns: before / after */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* BEFORE */}
              <div className="rounded-2xl overflow-hidden bg-white border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold tracking-wide uppercase text-gray-500">
                    Before
                  </span>
                </div>
                <div className="w-full" style={{ aspectRatio: "4/5" }}>
                  <img
                    key={cur.before}
                    src={cur.before}
                    alt="Before"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* AFTER */}
              <div className="rounded-2xl overflow-hidden bg-white border border-gray-200 relative">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-bold tracking-wide uppercase text-gray-500">
                    Result
                  </span>
                  <span className="text-xs text-gray-500">Preview</span>
                </div>

                <div className="w-full relative" style={{ aspectRatio: "4/5" }}>
                  {isVideo(cur.after) ? (
                    <video
                      key={cur.after}
                      src={cur.after}
                      className="w-full h-full object-cover"
                      autoPlay
                      loop
                      muted
                      playsInline
                    />
                  ) : (
                    <img
                      key={cur.after}
                      src={cur.after}
                      alt="After"
                      className="w-full h-full object-cover"
                    />
                  )}

                  {/* subtle violet corner glow */}
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
          </div>
        </div>

        {/* Dots */}
        <div className="mt-6 flex justify-center gap-2">
          {examples.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to example ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${
                i === idx ? "bg-[#007BFF]" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
