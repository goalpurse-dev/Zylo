import React, { useMemo, useState } from "react";

const Star = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M12 2.8l2.8 5.67 6.26.91-4.53 4.41 1.07 6.22L12 17.9l-5.6 2.94 1.07-6.22L2.94 9.38l6.26-.91L12 2.8z"
      fill="currentColor"
    />
  </svg>
);

const SEED = [
  { name: "Sarah P.", quote: "This is what video creation should be!", rating: 5 },
  { name: "Hetvi K.", quote: "Making everyone a video producer.", rating: 5 },
  { name: "Jonas T.", quote: "The script drafts are scary-good.", rating: 5 },
  { name: "Leo R.", quote: "Turned ideas into finished shorts in minutes.", rating: 5 },
  { name: "Maya S.", quote: "Captions + pacing are chef’s kiss.", rating: 4 },
  { name: "Zoë L.", quote: "Clean UI with outputs that get views.", rating: 5 },
  { name: "Ahmed N.", quote: "Voiceovers sound surprisingly natural.", rating: 4 },
  { name: "Priya C.", quote: "Saved hours every week—no exaggeration.", rating: 5 },
  { name: "Dmitri V.", quote: "Perfect for faceless channels.", rating: 5 },
  { name: "Elena G.", quote: "Publishing is the easy part now.", rating: 5 },
];

const initials = (name) =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ReviewCard({ data, variant = "center" }) {
  const isSide = variant !== "center";
  return (
    <div
      className={`rounded-[28px] bg-white border border-gray-200 shadow-sm px-8 sm:px-10 py-10 ${
        isSide ? "scale-[.92] opacity-70" : "scale-100 opacity-100"
      }`}
    >
      <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center font-extrabold text-white bg-gradient-to-br from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2]">
        {initials(data.name)}
      </div>
      <p className="mt-6 text-2xl sm:text-3xl font-extrabold leading-snug text-black text-center">
        “{data.quote}”
      </p>
      <div className="mt-5 text-sm font-semibold text-black text-center">
        {data.name}
      </div>
      <div className="mt-7 text-[11px] uppercase tracking-wide text-gray-500 text-center">
        Capterra
      </div>
      <div className="mt-2 flex justify-center gap-1 text-[#007BFF]">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${i < data.rating ? "" : "opacity-30"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function Reviews() {
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState({ active: false, dir: 0 }); // -1 left, +1 right

  const n = SEED.length;
  const at = (i) => ((i % n) + n) % n;

  const prevI = useMemo(() => at(idx - 1), [idx]);
  const nextI = useMemo(() => at(idx + 1), [idx]);

  // Track positions
  const base = "-33.3333%";
  const targetWhenNext = "-66.6667%";
  const targetWhenPrev = "0%";

  const go = (dir) => {
    if (!anim.active) setAnim({ active: true, dir });
  };
  const onEnd = () => {
    setIdx((i) => at(i + anim.dir));
    setAnim({ active: false, dir: 0 });
  };

  let translate = base;
  if (anim.active && anim.dir === 1) translate = targetWhenNext;
  if (anim.active && anim.dir === -1) translate = targetWhenPrev;

  return (
    <section className="bg-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-14">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-black text-center">
          See what people think about{" "}
          <span className="text-violet-gradient">ZyloAI</span>
        </h2>

        {/* Outer wrapper - arrows here so they're not clipped */}
        <div className="relative mt-10 md:mt-12">

          {/* Left arrow */}
          <button
            onClick={() => go(-1)}
            aria-label="Previous review"
            className="absolute -left-8 md:-left-12 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black text-white hover:opacity-90 active:scale-95 transition"
          >
            ←
          </button>

          {/* Right arrow */}
          <button
            onClick={() => go(1)}
            aria-label="Next review"
            className="absolute -right-8 md:-right-12 top-1/2 -translate-y-1/2 z-10 inline-flex items-center justify-center w-12 h-12 rounded-full bg-black text-white hover:opacity-90 active:scale-95 transition"
          >
            →
          </button>

          {/* Inner viewport with fade mask */}
          <div
            className="overflow-hidden"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
              maskImage:
                "linear-gradient(to right, transparent 0, black 6%, black 94%, transparent 100%)",
            }}
          >
            {/* Track */}
            <div
              className="flex gap-6 sm:gap-8 w-[300%]"
              style={{
                transform: `translateX(${translate})`,
                transition: anim.active
                  ? "transform 420ms cubic-bezier(.22,.61,.36,1)"
                  : "none",
              }}
              onTransitionEnd={anim.active ? onEnd : undefined}
            >
              <div className="w-1/3">
                <ReviewCard data={SEED[prevI]} variant="side" />
              </div>
              <div className="w-1/3">
                <ReviewCard data={SEED[idx]} variant="center" />
              </div>
              <div className="w-1/3">
                <ReviewCard data={SEED[nextI]} variant="side" />
              </div>
            </div>
          </div>
        </div>

        {/* Dots */}
        <div className="mt-6 flex justify-center gap-2">
          {SEED.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition ${
                i === idx
                  ? "bg-[#007BFF]"
                  : "bg-gray-300 hover:bg-gray-400"
              }`}
              aria-label={`Go to review ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
