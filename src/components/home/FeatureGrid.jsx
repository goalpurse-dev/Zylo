// src/components/home/FeatureGrid.jsx
import React from "react";
import { Link } from "react-router-dom";
import grid1 from "../../assets/grid/grid1.png";
import grid2 from "../../assets/grid/avatar.png";

const FEATURES = [
  { name: "Brand Kit",      to: "/brand/kit",   img: "/images/features/brand-kit.jpg" },
  { name: "Avatar Studio",  to: "/avatar",      img: grid2 },
  { name: "Ad Studio",      to: "/ad-studio",         img: "/images/features/ad-studio.jpg" },
  { name: "Product Photos", to: "/photos",      img: grid1 },
  { name: "Enhancements",   to: "/enhance",     img: "/images/features/enhance.jpg" },
  { name: "Campaigns",      to: "/campaigns",   img: "/images/features/campaigns.jpg" },
];

function FeatureCard({ name, to, img }) {
  return (
    <Link
      to={to}
      className="group relative w-[230px] sm:w-[260px] lg:w-[280px] shrink-0"
      aria-label={name}
    >
      <div className="rounded-[18px] border border-gray-200 bg-white shadow-sm transition-shadow group-hover:shadow-md">
        <div className="overflow-hidden rounded-[18px]">
          {/* 9:16 tall image */}
          <div className="relative aspect-[9/16]">
            <img
              src={img}
              alt={name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* subtle left vignette */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/25 via-black/0 to-transparent" />

            {/* LABEL INSIDE (so it won't be clipped) */}
            <div className="absolute left-3 bottom-3">
              <span className="rounded-full border border-gray-200 bg-white/95 backdrop-blur px-3 py-1 text-xs font-medium text-gray-700 shadow-sm">
                {name}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}


const FeatureGrid = () => {
  const loop = [...FEATURES, ...FEATURES];
  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Explore the ZyloAI Studios</h2>
          <Link to="/brands" className="hidden sm:inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold border-gray-300 text-gray-900 hover:bg-gray-50">
            Browse all
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M5 12h14m0 0-6-6m6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </Link>
        </div>

        <div className="relative">
  {/* edge fades (blend left & right) */}
  <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent" />
  <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent" />

  <div className="group/track overflow-hidden">
    <div className="flex gap-6 will-change-transform animate-[marqueeRight_28s_linear_infinite]">
      {loop.map((f, i) => (
        <FeatureCard key={i + f.name} {...f} />
      ))}
    </div>
  </div>
</div>
      </div>
    </section>
  );
};

export default FeatureGrid;     // ✅ default export
