// src/components/ShowcaseGallery.jsx
import React from "react";

const FallbackTile = () => (
  <div className="relative w-[260px] h-[148px] md:w-[320px] md:h-[182px] rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]/90" />
);

/**
 * ShowcaseGallery
 * - Pass images from the page: string URLs or { src, alt } objects
 * - Optional: aspect ratio override (default 16/9)
 */
export default function ShowcaseGallery({
  title = "Shots generated with Zylo",
  images = [],
  aspect = "16/9",
}) {
  // Normalize to objects
  const items = (images || [])
    .map((it) => (typeof it === "string" ? { src: it, alt: "" } : it))
    .filter((it) => it && it.src);

  return (
    <section className="relative pb-14">
      <div className="max-w-7xl mx-auto px-6">
        {title && (
          <h3 className="text-2xl md:text-3xl font-bold text-center text-black">
            {title}
          </h3>
        )}

        <div
          className="
            mt-8 overflow-x-auto overflow-y-hidden
            [mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]
            [-webkit-mask-image:linear-gradient(to_right,transparent,black_6rem,black_calc(100%-6rem),transparent)]
          "
        >
          <div className="flex gap-4 min-w-max px-6">
            {items.length === 0
              ? Array.from({ length: 6 }).map((_, i) => <FallbackTile key={i} />)
              : items.map(({ src, alt = "" }, i) => (
                  <div
                    key={i}
                    className="
                      relative w-[260px] h-[148px] md:w-[320px] md:h-[182px]
                      rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]
                      hover:shadow-[0_0_22px_rgba(62,254,207,0.18)]
                      transition-shadow duration-300
                    "
                  >
                    <div className="absolute inset-0" style={{ aspectRatio: aspect }}>
                      <img
                        src={src}
                        alt={alt}
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </div>
    </section>
  );
}