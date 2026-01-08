import React, { useEffect, useState } from "react";
import step1Img from "./../assets/home/hero3.png";
import step2Img from "./../assets/home/hero3.png";
import step3Img from "./../assets/home/hero3.png";

function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

const STEPS = [
  {
    step: "STEP 1",
    title: "Describe your video idea",
    text: "Type a bold hook and scene in one line. Mention subject, angle, style and motion so Zylo can frame a scroll-stopping story.",
    image: step1Img,
  },
  {
    step: "STEP 2",
    title: "Choose model, format & length",
    text: "Pick v2, v3 or v4 based on quality and cost, set aspect ratio for TikTok, YouTube or square, and pick 5–10s runtime.",
    image: step2Img,
  },
  {
    step: "STEP 3",
    title: "Generate, review & duplicate",
    text: "Preview your clip in seconds, download it, repeat.",
    image: step3Img,
  },
];

export default function TextToVideoSteps() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="mt-20">
      <h2 className="text-3xl md:text-[32px] font-extrabold text-white/95 text-center mb-3">
        3 simple steps. Amazing results.
      </h2>
      <p className="text-[13px] md:text-sm text-white/55 text-center mb-10 max-w-2xl mx-auto">
        Zylo turns your ideas into high-impact videos in seconds without
        timelines, keyframes or editors.
      </p>

      <div className="grid gap-7 lg:gap-8 md:grid-cols-3">
        {STEPS.map((s, i) => (
          <div
            key={s.step}
            className={classNames(
              "group relative flex flex-col",
              "rounded-[28px] border border-white/10",
              "bg-gradient-to-b from-[#191b27] via-[#0f121b] to-[#030509]",
              "px-7 pt-6 pb-7",
              "shadow-[0_24px_90px_rgba(0,0,0,.95)]",
              "transition-transform transition-shadow transition-opacity duration-400",
              "hover:-translate-y-3 hover:shadow-[0_32px_120px_rgba(0,0,0,1)]",
              mounted
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-4"
            )}
            style={{
              transitionDelay: mounted ? `${i * 90}ms` : "0ms",
            }}
          >
            {/* top gradient bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-11 bg-gradient-to-r from-[#5B5FFF]/22 via-transparent to-[#B845FF]/22 rounded-t-[28px]" />

            {/* Step label */}
            <span className="text-[10px] font-semibold tracking-[0.18em] text-[#A855F7] uppercase relative z-10">
              {s.step}
            </span>

            {/* Title */}
            <h3 className="mt-3 text-[20px] md:text-[22px] font-extrabold text-white relative z-10">
              {s.title}
            </h3>

            {/* Body */}
            <p className="mt-3 text-[13px] leading-relaxed text-white/72 relative z-10">
              {s.text}
            </p>

            {/* Big image */}
            <div className="mt-6 relative flex-1 flex items-end">
              <div className="w-full rounded-2xl overflow-hidden bg-[#020308] border border-white/12 shadow-[0_18px_60px_rgba(0,0,0,.95)]">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full h-52 md:h-64 object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/30" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
