// src/components/VideoToAIShowcase.jsx
import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

// helper: detect video file
const isVideo = (src = "") => /\.(mp4|webm|mov|m4v)$/i.test(src);

/**
 * Props (all optional; defaults included for quick demo):
 * - before: string (img/video URL for the original)
 * - styles: [{ id, name, blurb, after }] (each "after" can be img or video)
 * - title, gradientWord, subtitle: strings for the header
 */
export default function VideoToAIShowcase({
  before,
  styles,
  title = "Transform Any Video into",
  gradientWord = "AI Styles",
  subtitle = "Drag the handle to reveal the difference. Pick a style and watch your real footage become anime, cartoon, fantasy and more — instantly.",
}) {
  // ---- DEMO FALLBACKS (used only if you don't pass props) ----
  const DEMO_BEFORE = before || "/assets/showcase/irl-before.jpg";
  const DEMO_STYLES =
    styles && styles.length
      ? styles
      : [
          {
            id: "anime",
            name: "Anime / Manga",
            after: "/assets/showcase/irl-anime.mp4",
            blurb: "Hand-drawn lines, vibrant colors, high-energy motion.",
          },
          {
            id: "cartoon",
            name: "Cartoon (3D Pixar)",
            after: "/assets/showcase/irl-cartoon.mp4",
            blurb: "Soft lighting, round features, playful 3D feel.",
          },
          {
            id: "real",
            name: "Realistic AI Portrait",
            after: "/assets/showcase/irl-realistic.jpg",
            blurb: "Cinematic grading, glowing skin, depth & contrast.",
          },
          {
            id: "fantasy",
            name: "Fantasy (Knight / Elf / Cyberpunk)",
            after: "/assets/showcase/irl-fantasy.mp4",
            blurb: "Epic vibes, armor, neon, or elven flair — you choose.",
          },
          {
            id: "comic",
            name: "Comic Book",
            after: "/assets/showcase/irl-comic.jpg",
            blurb: "Bold ink, halftone shading, pop-art drama.",
          },
        ];

  const [activeId, setActiveId] = useState(DEMO_STYLES[0].id);
  const [ratio, setRatio] = useState(0.55); // how much of the RIGHT (after) side is visible [0..1]

  const wrapRef = useRef(null);

  const active = useMemo(
    () => DEMO_STYLES.find((s) => s.id === activeId) || DEMO_STYLES[0],
    [activeId, DEMO_STYLES]
  );

  // unified pointer drag
  const onPointerDown = (e) => {
    const el = wrapRef.current;
    if (!el) return;
    el.setPointerCapture?.(e.pointerId);

    const update = (clientX) => {
      const rect = el.getBoundingClientRect();
      let x = (clientX - rect.left) / rect.width;
      x = Math.max(0.02, Math.min(0.98, x));
      setRatio(x);
    };

    update(e.clientX);

    const onMove = (ev) => update(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const insetLeft = `calc(${ratio * 100}% )`;

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-16">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-black">
            {title} <span className="text-violet-gradient">{gradientWord}</span>
          </h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Style pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-6">
          {DEMO_STYLES.map((s) => {
            const activePill = s.id === activeId;
            return (
              <button
                key={s.id}
                onClick={() => setActiveId(s.id)}
                className={`px-4 h-10 rounded-full text-sm font-semibold transition
                  border ${
                    activePill
                      ? "bg-[#007BFF] text-white border-[#007BFF]"
                      : "bg-white text-black border-gray-200 hover:bg-gray-50"
                  }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>

        {/* Blurb */}
        {active?.blurb && (
          <p className="text-center text-gray-500 mb-5">{active.blurb}</p>
        )}

        {/* Reveal box */}
        <div className="relative rounded-3xl overflow-hidden shadow-sm border border-gray-200">
          <div
            ref={wrapRef}
            className="relative w-full cursor-col-resize select-none bg-black"
            style={{ aspectRatio: "16 / 9" }}
            onPointerDown={onPointerDown}
          >
            {/* ORIGINAL underlayer */}
            {isVideo(DEMO_BEFORE) ? (
              <video
                src={DEMO_BEFORE}
                className="absolute inset-0 w-full h-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={DEMO_BEFORE}
                alt="Original"
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* AFTER overlay (clipped from left) */}
            <div
              className="absolute inset-0"
              style={{ clipPath: `inset(0 0 0 ${insetLeft})` }}
            >
              {isVideo(active.after) ? (
                <video
                  key={active.after}
                  src={active.after}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  key={active.after}
                  src={active.after}
                  alt={active.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
            </div>

            {/* Divider & handle */}
            <div
              className="absolute top-0 bottom-0 w-px bg-white/70 pointer-events-none"
              style={{ left: insetLeft }}
            />
            <div
              className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full
                         bg-black text-white flex items-center justify-center ring-2 ring-[#007BFF]
                         shadow-md"
              style={{ left: insetLeft }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M8 12l-3-3v6l3-3zm8 0l3 3V9l-3 3z" fill="currentColor" />
              </svg>
            </div>

            {/* Labels */}
            <div className="absolute left-4 top-4 text-[11px] font-bold tracking-wide uppercase bg-black/60 text-white px-2 py-1 rounded">
              Original
            </div>
            <div className="absolute right-4 top-4 text-[11px] font-bold tracking-wide uppercase bg-black/60 text-white px-2 py-1 rounded">
              {active?.name}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/video-to-ai"
            className="inline-flex items-center justify-center h-12 px-6 rounded-full bg-[#007BFF] text-white font-semibold hover:bg-[#0066d6] transition"
          >
            Try Video → AI Styles
          </Link>
        </div>
      </div>
    </section>
  );
}
