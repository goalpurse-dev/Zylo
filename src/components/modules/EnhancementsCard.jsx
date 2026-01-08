import React from "react";

export default function EnhancementsCard() {
  return (
    <section className="mx-auto max-w-7xl w-full px-5 py-10 rounded-3xl bg-white/5 shadow-sm ring-1 ring-white/10">
      <header className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}>
          Enhancements
        </span>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">Fix. Polish. Upscale.</h2>
        <p className="mt-2 text-sm text-zinc-300">
          One-click cleanups for any asset you bring in—no Photoshop needed.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <ul className="space-y-2 text-sm">
            {["Upscale 2× / 4×", "Face restoration & sharpen", "Deblur / Denoise", "BG remover / replacer"].map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
                <span className="text-zinc-200">{b}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-sm">
          <div className="aspect-[16/9] w-full bg-white/5" data-slot="image-before" />
          <div className="absolute inset-y-0 left-1/2 w-1/2 bg-transparent backdrop-blur-sm" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-white/10" />
          <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white shadow">Before</div>
          <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white shadow">After</div>
        </div>
      </div>
    </section>
  );
}
