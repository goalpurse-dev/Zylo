import React from "react";
import { Link } from "react-router-dom";

const ImgFallback = () => (
  <div className="w-full h-full rounded-xl bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200" />
);

/** Gradient step dot (1, 2, 3) */
function StepDot({ n = 1 }) {
  return (
    <div className="absolute top-4 left-4">
      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-extrabold flex items-center justify-center shadow-sm">
        {n}
      </div>
    </div>
  );
}

/** New layout: text up top, image block at the bottom */
function StepTile({
  step = 1,
  title,
  desc,
  bullets = [],
  to = "#",
  media,                 // optional image
  colSpan = 1,           // 1 = half; 2 = full (wide)
  showButton = true,     // allow only last to show CTA
  variant = "light",     // "light" | "dark"
}) {
  const isDark = variant === "dark";

  return (
    <article
      className={`relative overflow-hidden rounded-3xl shadow-sm ${
        isDark ? "bg-[#0B0D10] text-white" : "bg-[#F6F7F9] text-black"
      } ${colSpan === 2 ? "md:col-span-2" : ""}`}
    >
      {/* step dot */}
      <StepDot n={step} />

      {/* content */}
      <div className="p-6 sm:p-8 md:p-10">
        {/* copy block (top) */}
       <div className="max-w-[640px] pl-10 sm:pl-12">
          <h3
            className={`font-extrabold leading-[1.05] text-[24px] sm:text-[32px] md:text-[38px] ${
              isDark ? "text-white" : "text-black"
            }`}
          >
            {title}
          </h3>

          {desc && (
            <p className={`mt-2 text-sm sm:text-[15px] ${isDark ? "text-white/85" : "text-black/70"}`}>
              {desc}
            </p>
          )}

          {!!bullets.length && (
            <ul className={`mt-3 space-y-1.5 text-sm ${isDark ? "text-white/80" : "text-black/75"}`}>
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-gradient-to-r from-purple-600 to-blue-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* image block (bottom) */}
        <div className="mt-6">
          <div className="rounded-xl overflow-hidden ring-1 ring-black/5">
            {/* fixed aspect so all tiles feel consistent; widen on the hero tile via colSpan=2 */}
            <div style={{ aspectRatio: colSpan === 2 ? "21/9" : "16/9" }}>
              {media ? (
                <img
                  src={media}
                  alt={title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <ImgFallback />
              )}
            </div>
          </div>
        </div>

        {/* CTA (optional, typically only last card) */}
        {showButton && (
          <div className="mt-5">
            <Link
              to={to}
              className={`inline-flex items-center justify-center h-10 sm:h-11 px-5 rounded-full font-semibold transition
                ${
                  isDark
                    ? "bg-white text-[#1677FF] hover:bg-blue-50"
                    : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:opacity-95"
                }`}
            >
              Create now
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

/** 2-1 mosaic (two half tiles on top, one wide tile below) */
export default function ToolStepsMosaic({
  kicker = "Branding Kit",
  title = "Design once. Reuse everywhere.",
  subtitle = "",
  steps = [],        // Array of 3 step objects
  variant = "light", // default to light for gray cards
}) {
  return (
    <section className="py-12 sm:py-14">
      <div className="max-w-6xl mx-auto px-6">
        {/* header */}
        <div className="mb-8 sm:mb-10">
          <div className="inline-block text-sm sm:text-base font-extrabold uppercase tracking-widest px-3 py-1 rounded-full bg-blue-50 text-blue-600">
            {kicker}
          </div>
          <h2 className="mt-4 text-[30px] sm:text-[38px] md:text-[46px] font-extrabold leading-tight text-black">
            {title}
          </h2>
          {subtitle && <p className="mt-3 text-gray-700 text-lg max-w-3xl">{subtitle}</p>}
        </div>

        {/* mosaic */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps[0] && (
            <StepTile
              step={1}
              title={steps[0].title}
              desc={steps[0].desc}
              bullets={steps[0].bullets}
              to={steps[0].to}
              media={steps[0].media}
              showButton={steps[0].showButton ?? false}
              variant={variant}
            />
          )}

          {steps[1] && (
            <StepTile
              step={2}
              title={steps[1].title}
              desc={steps[1].desc}
              bullets={steps[1].bullets}
              to={steps[1].to}
              media={steps[1].media}
              showButton={steps[1].showButton ?? false}
              variant={variant}
            />
          )}

          {steps[2] && (
            <StepTile
              step={3}
              title={steps[2].title}
              desc={steps[2].desc}
              bullets={steps[2].bullets}
              to={steps[2].to}
              media={steps[2].media}
              colSpan={2}
              showButton={steps[2].showButton ?? true}
              variant={variant}
            />
          )}
        </div>
      </div>
    </section>
  );
}
