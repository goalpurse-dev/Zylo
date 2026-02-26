import React from "react";
import { Link } from "react-router-dom";

export default function ViralVideoGenerator() {
  return (
    <section className="relative w-full py-32 px-6 bg-gradient-to-b from-white to-[#F7F5FA] overflow-hidden">

      {/* Subtle radial glow */}
      <div className="absolute right-0 top-1/2 w-[600px] h-[600px] -translate-y-1/2 bg-purple-200/30 blur-3xl rounded-full -z-10" />

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-20 items-center">

        {/* RIGHT SIDE — TEXT (comes first on mobile) */}
        <div className="text-left order-1 md:order-2">

          <p className="text-sm font-medium text-[#7A3BFF] mb-4">
            VIRAL VIDEO GENERATOR
          </p>

          <h2 className="text-4xl md:text-5xl font-semibold text-gray-900 leading-tight mb-6">
            Generate high-retention videos in seconds
          </h2>

          <p className="text-lg text-gray-600 mb-8">
            Create engaging short-form videos using 10+ AI models —
            optimized for TikTok, Reels, and YouTube Shorts.
          </p>

          <div className="space-y-4 mb-10">
            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl">✔</span>
              <p className="text-gray-700">10+ powerful video AI models</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl">✔</span>
              <p className="text-gray-700">Built for virality</p>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-green-500 text-xl">✔</span>
              <p className="text-gray-700">Fast rendering + affordable pricing</p>
            </div>
          </div>

          <Link
            className="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#6F3AE6] text-white font-medium shadow-lg shadow-purple-500/30 hover:scale-[1.03] transition"
            to="/workspace/video-generator"
          >
            Try Video Generator
          </Link>

        </div>

        {/* LEFT SIDE — VIDEO (comes second on mobile) */}
        <div className="relative group order-2 md:order-1">

          <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/10 aspect-square">
            <video
              src="/assets/video/fire.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          {/* Glass highlight */}
          <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent pointer-events-none rounded-3xl" />

        </div>

      </div>
    </section>
  );
}