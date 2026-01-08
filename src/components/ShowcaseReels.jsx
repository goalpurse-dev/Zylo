import React, { useEffect, useRef } from "react";

const GRADIENT = "bg-gradient-to-r from-[#A142F4] to-[#F646A9]";

const REELS = [
  { src: "/reels/test.mp4", caption: "Test1" },
  { src: "/reels/zylo1.mp4", caption: "Interview" },
  { src: "/reels/asmr_soap.mp4", caption: "ASMR Soap" },
  { src: "/reels/mario.mp4", caption: "Mario Kart" },
  { src: "/reels/minecraft2.mp4", caption: "Minecraft" },
  { src: "/reels/hand_cam.mp4", caption: "Hand Cam" },
];

export default function ShowcaseReels({
  titlePrefix = "2.5M clips have been made with",
  titleZylo = "Zylo",
  eyebrow = "REAL EXAMPLES FROM THE FEED",
}) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const vids = Array.from(wrap.querySelectorAll("video"));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          const v = e.target;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        });
      },
      { threshold: 0.3 }
    );
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, []);

  return (
    <section className="relative py-14 bg-transparent">
      <div className="max-w-7xl mx-auto px-6">
        {/* Heading */}
        <div className="text-center">
          <div className="text-xs font-semibold tracking-widest uppercase text-zinc-400">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight">
            <span className="text-white">{titlePrefix} </span>
            <span className={`${GRADIENT} bg-clip-text text-transparent`}>{titleZylo}</span>
          </h2>
          <p className="mt-2 text-zinc-300">
            Autoplaying, looped, and sized for Reels/Shorts—exactly how your audience sees them.
          </p>
        </div>

        {/* Reel strip */}
        <div
          ref={wrapRef}
          className="relative mt-8 overflow-x-auto overflow-y-hidden scroll-smooth
                     [mask-image:linear-gradient(to_right,transparent,black_72px,black_calc(100%-72px),transparent)]
                     [-webkit-mask-image:linear-gradient(to_right,transparent,black_72px,black_calc(100%-72px),transparent)]"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex gap-5 min-w-max px-8">
            {REELS.map((r, i) => (
              <figure
                key={i}
                className="relative w-[220px] md:w-[260px] aspect-[9/16]
                           rounded-2xl overflow-hidden border border-white/10
                           bg-white/5 shadow-sm transition hover:shadow-[0_8px_28px_rgba(0,0,0,0.18)]"
                title={r.caption}
              >
                <video src={r.src} muted loop playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                <figcaption
                  className="absolute left-2.5 bottom-2.5 text-[11px] px-2 py-1 rounded-md
                             bg-black/60 border border-white/10 backdrop-blur
                             font-semibold text-white"
                >
                  {r.caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
