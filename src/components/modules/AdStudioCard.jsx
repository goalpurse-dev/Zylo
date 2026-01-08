import React from "react";
import pixarugc from "../../assets/thumbs/3dugc.png";

export default function AdStudioCard() {
  const Badge = ({ n }) => (
    <div
      className="absolute -left-3 -top-3 grid h-8 w-8 place-items-center rounded-full text-white"
      style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
    >
      <span className="text-sm font-bold">{n}</span>
    </div>
  );

  return (
    <section className="mx-auto max-w-7xl w-full px-5 py-10 rounded-4xl bg-white/60 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-900/60 dark:ring-zinc-800">
      <header className="mb-6">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          Ad Studio
        </span>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-black">
          Turn any script into a presenter-style ad
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Auto-brand with your palette, fonts, and avatar. Export in platform sizes.
        </p>
      </header>

      <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {/* REPLACED placeholder with image + soft gradient overlay */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl">
          <img
            src={pixarugc}
            alt="Pixar UGC preview"
            className="h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1677FF14] via-transparent to-[#7A3BFF14] dark:via-zinc-900/40" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Badge n={1} />
          <h4 className="text-xl font-bold text-black">Write or paste your script</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {["Hook & CTA helper", "Multi-language support", "Optional voice-to-script"].map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
                <span className="text-zinc-700 dark:text-zinc-200">{b}</span>
              </li>
            ))}
          </ul>
          <div
            className="mt-4 aspect-video w-full rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900"
            data-slot="image"
          />
        </div>

        <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <Badge n={2} />
          <h4 className="text-xl font-bold text-black">Choose layout & platform size</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {["Reels/TikTok 9:16", "YouTube Thumb 16:9", "IG Carousel 1:1"].map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
                <span className="text-zinc-700 dark:text-zinc-200">{b}</span>
              </li>
            ))}
          </ul>
          <div
            className="mt-4 aspect-video w-full rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900"
            data-slot="image"
          />
        </div>
      </div>

      <div className="relative mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <Badge n={3} />
        <h4 className="text-xl font-bold text-black">Render & export</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {["Auto captions", "Safe-zone framing", "MP4/PNG exports"].map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
              <span className="text-zinc-700 dark:text-zinc-200">{b}</span>
            </li>
          ))}
        </ul>
        <div
          className="mt-4 aspect-[16/9] w-full rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900"
          data-slot="image"
        />
      </div>
    </section>
  );
}
