import { Link } from "react-router-dom";
import React from "react";

export default function Hero() {
  return (
    <section className="bg-transparent">
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-16 text-center">
        {/* Tagline */}
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-zinc-300">
          <span className="inline-block h-2 w-2 rounded-full bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]" />
          Brand building, automated
        </div>

        {/* H1 */}
        <h1 className="mt-4 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white">
          Build a brand.{" "}
          <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]">
            Generate every asset in minutes.
          </span>
        </h1>

        {/* Subcopy */}
        <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg text-zinc-300">
          Create a brand kit, avatar, and ad-ready assets—<span className="whitespace-nowrap">all in one workspace.</span>
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/brands"
            className="inline-flex h-12 items-center justify-center rounded-full px-6 font-semibold text-white
                       bg-gradient-to-r from-[#1677FF] to-[#7A3BFF] shadow-sm hover:opacity-95 focus:outline-none
                       focus:ring-2 focus:ring-[#7A3BFF] focus:ring-offset-0"
          >
            Create a Brand
          </Link>

          <Link
            to="/textvideo"
            className="inline-flex h-12 items-center justify-center rounded-full px-6 font-semibold
                       border border-white/20 text-white hover:bg-white/10 focus:outline-none
                       focus:ring-2 focus:ring-white/20 focus:ring-offset-0"
          >
            Create video
          </Link>
        </div>

        {/* Social proof */}
        <div className="mx-auto mt-10 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <svg key={i} aria-hidden="true" className="h-4 w-4 fill-yellow-400" viewBox="0 0 20 20">
                  <path d="M10 15.27l-5.18 3.05 1.4-5.98L1 7.97l6.05-.52L10 2l2.95 5.45 6.05.52-5.22 4.37 1.4 5.98L10 15.27z" />
                </svg>
              ))}
            </div>
            <span className="font-medium">4.9/5</span>
            <span className="text-zinc-500">·</span>
            <span>2,300+ creators & teams</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
            {["Nova", "Peak", "Orbit", "Nimbus", "Vertex"].map((name) => (
              <span key={name} className="text-sm font-semibold tracking-wide text-zinc-400">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
