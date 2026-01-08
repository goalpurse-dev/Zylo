import React from "react";
import { Link } from "react-router-dom";

/**
 * Auth layout
 * - Max page width so content sits centered on large screens
 * - Left column pushed slightly right & higher
 * - Right showcase centered and shows 3 reels max at a time
 * - Back arrow (top-left) returns to home
 */
export default function AuthLayout({ title, subtitle, children, hero }) {
  return (
    <section className="bg-white min-h-screen relative">
      {/* Back to home */}
      <Link
        to="/"
        aria-label="Back to home"
        className="absolute top-5 left-5 lg:top-8 lg:left-8 inline-flex items-center justify-center
                   w-9 h-9 rounded-full border border-black/10 bg-white text-black shadow-sm
                   hover:bg-black/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      {/* Center the whole grid on wide screens */}
      <div className="mx-auto max-w-[1600px] min-h-screen grid grid-cols-1 lg:grid-cols-[560px_1fr]">
        {/* Left: form — slightly right and higher */}
        <div className="pl-10 lg:pl-16 xl:pl-20 pt-32 pb-15">
          <div className="w-full max-w-[520px]">
            {/* brand glyph */}
            <div className="mb-6">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold">
                <span className="text-lg">⌘</span>
              </div>
            </div>

            <h1 className="text-2xl font-extrabold text-black">{title}</h1>
            {subtitle && <p className="text-sm text-black/60 mt-1">{subtitle}</p>}

            <div className="mt-6">{children}</div>
          </div>
        </div>

        {/* Right: hero (centered) */}
        <div className="hidden lg:flex items-center justify-center pr-8 xl:pr-10 bg-white -mt-50">
          {hero ?? <ReelMarquee />}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- Right-side Marquee --------------------------- */

function ReelMarquee() {
  // Replace with your real assets later
  const ITEMS = Array.from({ length: 10 }, (_, i) => ({ id: `reel-${i + 1}` }));

  return (
    <section className="w-full h-full flex flex-col items-center justify-center">
      <style>{`
        @keyframes auth-marquee-left {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .auth-marquee {
          display: flex;
          width: 200%;
          will-change: transform;
          animation: auth-marquee-left 28s linear infinite;
        }
        .auth-mask {
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
                  mask-image: linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%);
        }
      `}</style>

      <h2 className="text-2xl font-extrabold tracking-tight text-black text-center">
        Scripts &amp; posts from creators
      </h2>

      {/* Show at most 3 tiles: 3 x 200px + 2 gaps (~20px each) */}
      <div className="mt-5 w-full">
        <div className="mx-auto max-w-[700px]">
          <div className="relative overflow-hidden auth-mask">
            <div className="auth-marquee gap-5 pr-5">
              <Track items={ITEMS} />
              <Track items={ITEMS} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Track({ items }) {
  return (
    <div className="flex items-center gap-5">
      {items.map((it) => (
        <ReelCard key={it.id} />
      ))}
    </div>
  );
}

function ReelCard() {
  // 9:16 card; keep size so 3 fit comfortably in ~700px
  return (
    <div
      className={[
        "relative shrink-0 rounded-xl overflow-hidden",
        "w-[200px] h-[356px] bg-neutral-900",
        "ring-1 ring-black/10 shadow-sm",
      ].join(" ")}
      title="Creator reel"
    >
      {/* Swap with <video> + poster later */}
      <div className="absolute inset-0 w-full h-full bg-neutral-900" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_60%_at_20%_0%,rgba(255,255,255,0.14),transparent_40%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/30" />
    </div>
  );
}
