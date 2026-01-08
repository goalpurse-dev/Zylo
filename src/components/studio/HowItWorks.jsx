import React from "react";
import { Link } from "react-router-dom";

const Fallback = () => (
  <div className="h-full w-full rounded-2xl bg-gradient-to-br from-purple-500/20 via-blue-500/10 to-purple-500/20" />
);

/**
 * HowItWorks
 * props:
 * - kicker?: string (pill)
 * - title: string (big heading)
 * - subtitle?: string (one-liner)
 * - steps: Array<{
 *     title: string,
 *     desc: string,
 *     bullets?: string[],
 *     mediaSrc?: string,      // optional image path (imported or URL)
 *     mediaAlt?: string,
 *     reverse?: boolean       // override the default alternating layout
 *   }>
 * - cta?: { label: string, to: string }  // optional button at the bottom
 */
export default function HowItWorks({
  kicker,
  title,
  subtitle,
  steps = [],
  cta = null,
  className = "",
}) {
  return (
    <section className={`py-10 sm:py-14 ${className}`}>
      <div className="mx-auto max-w-6xl px-6 sm:px-8">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          {kicker && (
            <span className="inline-block text-sm sm:text-base font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-50 text-blue-600">
              {kicker}
            </span>
          )}
          <h2 className="mt-3 text-[28px] sm:text-[36px] md:text-[42px] font-extrabold leading-tight text-black">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-2 text-lg text-black/70 max-w-3xl">{subtitle}</p>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-10 sm:space-y-12">
          {steps.map((s, i) => {
            const isReversed = s.reverse ?? (i % 2 === 1);
            return (
              <div
                key={i}
                className={`grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10 items-center`}
              >
                {/* Media */}
                <div className={`${isReversed ? "md:order-2" : ""}`}>
                  <div className="relative w-full rounded-2xl overflow-hidden shadow-sm ring-1 ring-black/5">
                    <div className="w-full" style={{ aspectRatio: "16 / 9" }}>
                      {s.mediaSrc ? (
                        <img
                          src={s.mediaSrc}
                          alt={s.mediaAlt || s.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <Fallback />
                      )}
                    </div>
                    <div
                      className="pointer-events-none absolute inset-0 rounded-2xl"
                      style={{
                        background:
                          "radial-gradient(50% 50% at 100% 0%, rgba(124,58,237,0.14), transparent 60%)",
                      }}
                    />
                  </div>
                </div>

                {/* Copy */}
                <div className={`${isReversed ? "md:order-1" : ""}`}>
                  <div className="mb-2 inline-flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-bold">
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                      Step {i + 1}
                    </span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-extrabold text-black">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-black/70">{s.desc}</p>

                  {s.bullets?.length ? (
                    <ul className="mt-4 grid gap-2 text-sm text-black/75">
                      {s.bullets.map((b, bi) => (
                        <li key={bi} className="flex items-start gap-2">
                          <span className="mt-[6px] h-2 w-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {cta && (
          <div className="mt-10">
            <Link
              to={cta.to}
              className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95"
            >
              {cta.label}
              <svg className="ml-2 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.293 15.707a1 1 0 010-1.414L13.586 11H5a1 1 0 110-2h8.586l-3.293-3.293a1 1 0 111.414-1.414l5 5a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0z"/>
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
