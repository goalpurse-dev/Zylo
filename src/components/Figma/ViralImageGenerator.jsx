import React from "react";
import { Link } from "react-router-dom";

export default function ViralImageGenerator() {
  return (
    <section className="relative w-full bg-white py-16  px-6 overflow-hidden">

      {/* TOP BLEND */}
<div className="pointer-events-none absolute top-0 left-0 w-full h-40 bg-[linear-gradient(to_bottom,#F7F5FA_0%,#F7F5FA_60%,rgba(247,245,250,0)_100%)]" />

      <div className="relative max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-center">

        {/* LEFT SIDE — TEXT */}
        <div className="text-left">

          <p className="text-sm font-medium text-[#7A3BFF] mb-4 cursor-default">
            VIRAL IMAGE GENERATOR
          </p>

          <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight mb-6 cursor-default">
            Create scroll-stopping visuals with 20+ styles
          </h2>

          <p className="text-lg text-gray-600 mb-8 cursor-default">
            Generate high-performing content using 10+ top AI providers —
            all optimized for engagement, speed, and affordability.
          </p>

          {/* Feature Points */}
          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl cursor-default">✔</span>
              <p className="text-gray-700 cursor-default">20+ viral-ready styles</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl cursor-default">✔</span>
              <p className="text-gray-700 cursor-default">10+ powerful AI providers</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl cursor-default">✔</span>
              <p className="text-gray-700 cursor-default">Affordable pricing built for creators</p>
            </div>
          </div>

          {/* CTA */}
          <Link
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-medium shadow-lg shadow-purple-500/30 hover:scale-[1.03] transition"
            to="/workspace/image-generator"
          >
            Try Image Generator
          </Link>

        </div>

        {/* RIGHT SIDE — IMAGE */}
        <div className="relative">

          <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/10 aspect-square">
  <img
    src="/assets/showcase/image1.webp"
    alt="Viral Image Generator Preview"
    className="w-full h-full object-cover"
  />
</div>

          {/* Soft purple glow */}
          <div className="absolute -z-10 top-10 left-10 w-full h-full bg-purple-200/40 blur-3xl rounded-full" />

        </div>

      </div>

      {/* BOTTOM BLEND */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-full h-20 bg-[linear-gradient(to_top,#F7F5FA_0%,#F7F5FA_60%,rgba(247,245,250,0)_100%)]" />

    </section>
  );
}