// src/components/ImageToVideoShowcase.jsx
import React, { useEffect, useRef, useState } from "react";
import CarExample from "../../assets/home/carexample.mp4";
import imgPoster from "../../assets/home/hero3.png";

export default function ImageToVideoShowcase() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  // enter animation on scroll
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            // keep it commented if you want it to trigger again when re-entering
            // observer.unobserve(el);
          }
        });
      },
      { threshold: 0.25 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="w-full bg-[#0c1218] py-14">
      <div
        ref={ref}
        className={[
          "mx-auto w-full max-w-6xl rounded-[32px]",
          "bg-[#101820] border border-white/6",
          "px-10 py-10 flex flex-col lg:flex-row gap-10 items-stretch",
          "transition-all duration-700",
          visible
            ? "opacity-100 translate-y-0 shadow-[0_40px_140px_rgba(0,0,0,0.85)]"
            : "opacity-0 translate-y-6",
        ].join(" ")}
      >
        {/* LEFT: copy + CTA */}
        <div className="flex-1 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#151d26] px-3 py-1 text-[11px] font-semibold text-[#8ab4ff]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#8ab4ff] shadow-[0_0_10px_rgba(138,180,255,0.9)]" />
              Image → Video
            </div>

            <h2 className="text-3xl sm:text-4xl font-semibold text-white leading-tight">
              Turn images into scroll-stopping videos.
            </h2>

            <p className="text-sm sm:text-base text-white/65 max-w-md">
              Drop any product or brand image and let Zylo auto-generate
              dynamic, on-brand videos ready for TikTok, Reels, and ads — in
              seconds.
            </p>

            <div className="flex flex-wrap gap-3 text-[11px] text-white/70">
              <Badge>Auto motion &amp; zooms</Badge>
              <Badge>Brand-safe overlays</Badge>
              <Badge>Instant formats: 9:16, 1:1, 16:9</Badge>
              <Badge>Exports in HD &amp; 4K</Badge>
            </div>
          </div>

          <button
            className="
              mt-4 inline-flex items-center justify-center
              rounded-full px-6 py-2.5
              text-sm font-semibold
              text-white
              bg-gradient-to-r from-[#3753ff] via-[#7b3dff] to-[#ff2bd6]
              shadow-[0_10px_40px_rgba(0,0,0,0.65)]
              hover:shadow-[0_16px_55px_rgba(0,0,0,0.9)]
              transition-all duration-200
            "
          >
            Generate video from image
            <span className="ml-2 text-lg leading-none">↗</span>
          </button>
        </div>

        {/* RIGHT: image -> video preview */}
        <div className="flex-[1.1] flex items-center gap-6 lg:gap-10">
          {/* Source image */}
          <div className="flex-1">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/40">
              Source image
            </div>
            <div className="relative h-64 sm:h-72 lg:h-80 overflow-hidden rounded-3xl bg-[#151d26] border border-white/8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(111,177,255,0.12),transparent)]" />
              <img
                src={imgPoster}
                alt="Sample product"
                className="h-full w-full object-cover rounded-3xl opacity-90"
              />
            </div>
          </div>

          {/* Bold arrow between */}
          <div className="hidden sm:flex items-center justify-center">
            <div className="text-4xl font-extrabold text-white/80">
              →
            </div>
          </div>

          {/* Generated video */}
          <div className="flex-1">
            <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-[#7b9dff]">
              Zylo video preview
            </div>
            <div
              className="
                relative h-64 sm:h-72 lg:h-80 overflow-hidden rounded-3xl
                bg-[#151d26] border border-[#3753ff]/70
                shadow-[0_0_40px_rgba(55,83,255,0.35)]
                animate-video-glow
              "
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(138,180,255,0.22),transparent)]" />

              <video
                src={CarExample}
                poster={imgPoster}
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover rounded-3xl opacity-95"
              />

              {/* loop indicator tag */}
              <div
                className="
                  absolute bottom-3 right-3
                  rounded-full bg-black/70 px-3 py-1
                  text-[9px] font-semibold text-white/80
                "
              >
                9:16 • 4K • Loop ready
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* animations */}
      <style>
        {`
        @keyframes videoGlow {
          0% { box-shadow: 0 0 32px rgba(55,83,255,0.22); }
          50% { box-shadow: 0 0 52px rgba(255,43,214,0.4); }
          100% { box-shadow: 0 0 32px rgba(55,83,255,0.22); }
        }
        .animate-video-glow {
          animation: videoGlow 3.4s ease-in-out infinite;
        }
        `}
      </style>
    </section>
  );
}

/* small pill */
function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/12 bg-[#151d26] px-3 py-1">
      <span className="mr-1 h-1.5 w-1.5 rounded-full bg-[#7b9dff]" />
      {children}
    </span>
  );
}
