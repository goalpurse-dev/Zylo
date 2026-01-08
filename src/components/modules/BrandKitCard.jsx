import React from "react";

export default function BrandKitCard() {
  return (
    <section className="mx-auto max-w-7xl w-full px-5 py-10 rounded-3xl bg-white/5 shadow-sm ring-1 ring-white/10">
      <header className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}>
          Brand Kit
        </span>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">Build your brand foundation.</h2>
        <p className="mt-2 text-sm text-zinc-300">
          Logos, colors, fonts, and voice that auto-apply across Zylo. Export guidelines and packs in one click.
        </p>
      </header>

      <div className="grid items-center gap-8 md:grid-cols-2">
        <div>
          <ul className="space-y-2 text-sm">
            {[
              "Logo pack (SVG/PNG) & color codes",
              "Brand voice sliders & tone chips",
              "Auto-applies to ads, avatars, thumbnails",
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
                <span className="text-zinc-200">{b}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold text-white shadow-md"
            style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}>
            Create a Brand
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div className="aspect-[16/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6" data-slot="image" />
      </div>
    </section>
  );
}
