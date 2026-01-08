import React, { useMemo, useState } from "react";
import { Film, Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Minimal, no-API demo. Replace PREVIEWS with your CDN/Thumbs later.
 * You can also swap the "filter by tags" for an ANN/embedding lookup.
 */
const PREVIEWS = [
  { id: "cyber",    tags: ["cyber", "neon", "city", "night", "glitch"],
    title: "Neon cyber city (beat-synced)", thumb: "/previews/cyber_city.jpg",  video: "/previews/cyber_city.mp4" },
  { id: "fitness",  tags: ["fitness", "gym", "energy", "fast"],
    title: "High-energy fitness cut",       thumb: "/previews/fitness.jpg",     video: "/previews/fitness.mp4" },
  { id: "cooking",  tags: ["cooking", "kitchen", "food", "hands"],
    title: "Cooking close-ups (b-roll)",    thumb: "/previews/cooking.jpg",     video: "/previews/cooking.mp4" },
  { id: "travel",   tags: ["travel", "ocean", "drone", "sunset"],
    title: "Travel drone montage",          thumb: "/previews/travel.jpg",      video: "/previews/travel.mp4" },
  { id: "lofi",     tags: ["lofi", "anime", "cozy", "study"],
    title: "Lo-fi anime loop",              thumb: "/previews/lofi.jpg",        video: "/previews/lofi.mp4" },
  { id: "tech",     tags: ["tech", "ui", "screens", "startup"],
    title: "SaaS/tech explainer look",      thumb: "/previews/tech.jpg",        video: "/previews/tech.mp4" },
];

export default function PromptVideoDemo({
  title = "Try Video Generation",
  ctaTo = "/videogenerator",
}) {
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | loading | results
  const [results, setResults] = useState([]);

  const suggestions = [
    "neon cyber city with glitch text",
    "high-energy fitness montage",
    "cooking b-roll for recipe video",
  ];

  function handleGenerate() {
    setPhase("loading");
    const words = q.toLowerCase().split(/\W+/).filter(Boolean);
    const scored = PREVIEWS.map(p => ({
      ...p,
      score: p.tags.reduce((s, t) => s + (words.includes(t) ? 2 : 0), 0)
    }))
    .sort((a, b) => b.score - a.score);

    const top = (scored[0]?.score ?? 0) > 0 ? scored.slice(0, 4) : PREVIEWS.slice(0, 4);

    setTimeout(() => {
      setResults(top);
      setPhase("results");
    }, 500);
  }

  function reset() {
    setPhase("idle");
    setResults([]);
  } 
  return (
    <section className="mx-auto max-w-6xl px-6 sm:px-8">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center gap-2">
        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-white">
          <Film size={18} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">
          {title}
        </h2>
      </div>

     {/* Prompt bar */}
<div className="rounded-2xl border border-black/10 bg-white p-3 sm:p-4 shadow-sm">
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="flex-1">
     <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-6">
  <Sparkles className="text-purple-600" size={18} />
  <input
    value={q}
    onChange={(e) => setQ(e.target.value)}
    placeholder="Describe your video… e.g. neon cyber city, fast cuts, glitch text"
    className="w-full bg-transparent outline-none text-black caret-black placeholder:text-black/40"
  />
</div>
      {/* Chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setQ(s)}
            className="text-sm rounded-full border border-black/10 px-3 py-1 text-black/70 hover:bg-black/5"
          >
            {s}
          </button>
        ))}
      </div>
    </div>

    <button
      onClick={handleGenerate}
      disabled={phase === "loading"}
      className="inline-flex items-center justify-center h-11 sm:h-12 px-5 rounded-xl
                 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold
                 hover:opacity-95 disabled:opacity-60"
    >
      {phase === "loading" ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…
        </>
      ) : (
        <>
          Generate preview <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </button>
  </div>
</div>

    
      {/* Results (non-selectable to avoid blue highlight) */}
      {phase === "results" && (
        <div className="mt-6 sm:mt-8 select-none">
          <p className="text-sm text-black/60 mb-3">
            Here are example looks that match <span className="font-medium text-black">“{q}”</span>.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {results.map(r => (
              <figure
                key={r.id}
                className="group rounded-2xl overflow-hidden border border-black/10 bg-white shadow-sm"
                onMouseDown={(e) => e.preventDefault()}     // extra guard against selection drag
              >
                <div className="relative w-full" style={{aspectRatio: "16/9"}}>
                  <img
                    src={r.thumb}
                    alt={r.title}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    draggable="false"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition" />
                </div>
                <figcaption className="p-3 text-sm font-semibold text-black">
                  {r.title}
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to={ctaTo}
              className="inline-flex items-center h-11 px-5 rounded-xl bg-gradient-to-r
                         from-purple-600 to-blue-600 text-white font-semibold hover:opacity-95"
            >
              Looks good? Create a real video
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <button
              onClick={reset}
              className="inline-flex items-center h-11 px-5 rounded-xl border border-black/10 bg-white text-black hover:bg-black/5">
              Try another idea
            </button>
          </div>
        </div>
      )}
    </section>
  );
}