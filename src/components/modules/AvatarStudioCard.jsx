import React from "react";
import scriptadd from "../../assets/thumbs/scriptadd.png";

export default function AvatarStudioCard() {
  const Step = ({ n, title, desc, imgSrc }) => (
    <div className="relative rounded-3xl border border-zinc-200 bg-black p-6 shadow-sm dark:border-zinc-800 text-white">
      <div
        className="absolute -left-3 -top-3 grid h-8 w-8 place-items-center rounded-full text-white"
        style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
      >
        <span className="text-sm font-bold">{n}</span>
      </div>

      <h4 className="text-2xl font-extrabold tracking-tight text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-300">{desc}</p>

      <ul className="mt-3 space-y-1 text-sm">
        {["Style presets", "Reference-guided", "Noise-robust tracking"].map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
            <span className="text-zinc-200">{b}</span>
          </li>
        ))}
      </ul>

      {/* image area */}
      {imgSrc ? (
        <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-2xl">
          <img src={imgSrc} alt="Step preview" className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1677FF14] via-transparent to-[#7A3BFF14]" />
        </div>
      ) : (
        <div
          className="mt-4 aspect-video w-full rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-50 dark:from-zinc-800 dark:to-zinc-900"
          data-slot="image"
        />
      )}
    </div>
  );

  return (
    <section className="mx-auto max-w-7xl w-full px-5 py-10 rounded-3xl bg-black shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-800">
      <header className="mb-6">
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          Avatar Studio
        </span>
        <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-white">
          Create a face for your brand.
        </h2>
        <p className="mt-2 text-sm text-zinc-300">
          Mascots, presenters, or UGC avatars — save outfits, moods, and expressions.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Step 1 now shows your scriptadd image */}
        <Step
          n={1}
          title="Choose your avatar style"
          desc="Realistic, Pixar-ish, anime, clay, or toon — or upload a reference."
          imgSrc={scriptadd}
        />
        <Step
          n={2}
          title="Convert & preview"
          desc="Tweak expression, outfit, and line weight with motion-aware previews."
        />
      </div>

      <div className="relative mt-6 rounded-3xl border border-zinc-200 bg-black p-6 shadow-sm dark:border-zinc-800 text-white">
        <div
          className="absolute -left-3 -top-3 grid h-8 w-8 place-items-center rounded-full text-white"
          style={{ background: "linear-gradient(90deg,#1677FF,#7A3BFF)" }}
        >
          <span className="text-sm font-bold">3</span>
        </div>

        <h4 className="text-2xl font-extrabold tracking-tight text-white">Export clean results</h4>
        <ul className="mt-2 space-y-1 text-sm">
          {["PNG with alpha", "4K ready", "Caption/SFX ready"].map((b, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1 h-2 w-2 rounded-full" style={{ background: "#7A3BFF" }} />
              <span className="text-zinc-200">{b}</span>
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
