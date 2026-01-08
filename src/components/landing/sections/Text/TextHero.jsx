import React from "react";
import { Link } from "react-router-dom";

/**
 * RedditHero
 * - Same palette/layout as your global Hero.jsx
 * - Centered content, white surface
 * - Blue outline CTA (rounded-full) identical to "Try Zylo now"
 * - All copy passed as props from the landing page
 */
export default function TextHero({
  kicker,                 // small uppercase line above title (optional)
  title,                  // main title (string or JSX)
  highlight,              // word/phrase to show in violet→pink gradient (optional)
  subtitle,               // paragraph under title
  ctaText = "Create now", // primary CTA label
  ctaHred = "/text-video",    // primary CTA route
  note = "Trusted by creators and teams who value speed and quality", // small helper line
}) {
  return (
    <section className="bg-white py-20 text-center">
      <div className="max-w-3xl mx-auto px-6">
        {kicker ? (
          <div className="text-xs font-bold uppercase tracking-widest text-[#1677FF]">
            {kicker}
          </div>
        ) : null}

        <h1 className="mt-2 text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-black">
          {title}{" "}
          {highlight ? (
            <>
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-pink-500">
                {highlight}
              </span>
            </>
          ) : null}
        </h1>

        {subtitle ? (
          <p className="mt-6 text-gray-600 text-lg sm:text-xl">{subtitle}</p>
        ) : null}

        {/* CTA – same style as your global hero */}
        <div className="mt-8 flex justify-center">
          <Link
            to={ctaHred}
            className="inline-flex items-center justify-center h-12 px-6 rounded-full
                       border-2 border-blue-500 text-blue-500 font-semibold
                       hover:bg-blue-50 transition"
          >
            {ctaText}
          </Link>
        </div>

        {note ? (
          <p className="mt-4 text-sm text-gray-400">{note}</p>
        ) : null}
      </div>
    </section>
  );
}
