import React from "react";
import grid1 from "../../assets/grid/grid1.png";
import v36 from "../../assets/home/pic11.png";

export default function ProductPhotosCard() {
  return (
    <section className="mx-auto max-w-7xl w-full px-5 py-10 rounded-3xl bg-white/5 shadow-sm ring-1 ring-white/10">
      <header className="mb-6">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          Product Photos
        </span>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">
          Showcase your products anywhere.
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Clean packshots, lifestyle scenes, or UGC looks. Or describe the product to generate AI mockups.
        </p>
      </header>

      <div className="grid gap-8 md:grid-cols-3">
        <div className="order-2 grid grid-cols-2 gap-3 md:order-1 md:col-span-2">
          <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 grid place-items-center">
            <img src={grid1} alt="Product showcase" className="max-w-full max-h-full object-contain" draggable={false} />
          </div>

          <div className="aspect-square rounded-2xl bg-white/5 border border-white/10" />

          <div className="aspect-square rounded-2xl overflow-hidden bg-white/5 border border-white/10 grid place-items-center">
            <img src={v36} alt="Product showcase 2" className="max-w-full max-h-full object-contain" draggable={false} />
          </div>

          <div className="aspect-[4/3] rounded-2xl bg-white/5 border border-white/10" />
        </div>

        <div className="order-1 md:order-2">
          <ul className="space-y-2 text-sm">
            {[
              "Studio • Lifestyle • UGC • Seasonal",
              "Background cleanup & shadows",
              "3D spin / packshot for e-commerce",
            ].map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
                <span className="text-zinc-200">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
