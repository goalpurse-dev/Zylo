import { Check } from "lucide-react";

// On-Screen Text / Explainer Density (Part 2/3/4, 2026-09-15 content-
// grounding pass) — a REAL storyboard-planning input, not a cosmetic
// toggle: refineVisualSequences (visualShotPlanning.js) reads it once, at
// Storyboard compile time, to bias how eagerly narration becomes a graphic/
// explainer sub-shot versus pure illustration. Deliberately placed on the
// "New Video" creation flow (not the Generate page's quality selector) —
// this is the only point in the current flow that runs genuinely BEFORE the
// storyboard exists; the setting has no effect once a storyboard is already
// compiled (see the migration's own comment).
//
// Previews are pure CSS/SVG shapes, never an AI generation (explicit ask:
// "tiny VISUAL EXAMPLES that are deterministic/lightweight, NOT AI
// generations") — a rough sketch of the visual RATIO each mode leans
// toward, not a literal frame from any real video.
const OPTIONS = [
  {
    id: "minimal",
    label: "Minimal",
    tagline: "Visuals first",
    description: "Mostly illustrated scenes — text and graphics only when the idea genuinely needs one.",
  },
  {
    id: "balanced",
    label: "Balanced",
    tagline: "Recommended",
    description: "Best for most explainers — occasional big words, comparisons, timelines and callouts.",
  },
  {
    id: "frequent",
    label: "Frequent",
    tagline: "Explainer-heavy",
    description: "More key phrases, labeled diagrams and comparisons — a text-led explainer style.",
  },
];

function MinimalPreview() {
  return (
    <svg viewBox="0 0 64 40" className="h-9 w-14" aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="39" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="24" cy="18" r="7" fill="currentColor" fillOpacity="0.35" />
      <rect x="34" y="24" width="20" height="9" rx="2" fill="currentColor" fillOpacity="0.16" />
    </svg>
  );
}
function BalancedPreview() {
  return (
    <svg viewBox="0 0 64 40" className="h-9 w-14" aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="39" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <circle cx="18" cy="20" r="7" fill="currentColor" fillOpacity="0.35" />
      <path d="M28 14 L40 10" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M28 26 L40 30" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="41" y="7" width="16" height="6" rx="1.5" fill="currentColor" fillOpacity="0.22" />
      <rect x="41" y="27" width="16" height="6" rx="1.5" fill="currentColor" fillOpacity="0.22" />
    </svg>
  );
}
function FrequentPreview() {
  return (
    <svg viewBox="0 0 64 40" className="h-9 w-14" aria-hidden="true">
      <rect x="0.5" y="0.5" width="63" height="39" rx="4" fill="none" stroke="currentColor" strokeOpacity="0.18" />
      <rect x="7" y="9" width="50" height="9" rx="1.5" fill="currentColor" fillOpacity="0.45" />
      <rect x="7" y="22" width="34" height="5" rx="1.5" fill="currentColor" fillOpacity="0.24" />
      <rect x="7" y="30" width="22" height="5" rx="1.5" fill="currentColor" fillOpacity="0.24" />
    </svg>
  );
}
const PREVIEWS = { minimal: MinimalPreview, balanced: BalancedPreview, frequent: FrequentPreview };

// `locked` mirrors the Image Quality selector's own lock treatment exactly
// (Part: "make it lock when hovering the other options so they can't be
// clicked") — once a storyboard exists for this project, this setting no
// longer has anywhere left to apply, so it locks the same way.
export function TextDensityControl({ value, locked = false, onChange }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/50">On-Screen Text</h3>
      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {OPTIONS.map((opt) => {
          const selected = value === opt.id;
          const Preview = PREVIEWS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => !locked && onChange(opt.id)}
              disabled={locked}
              title={locked ? "Locked — the storyboard for this project already exists" : opt.description}
              className={`relative flex flex-col items-center justify-center gap-1 rounded-lg border px-1.5 py-2.5 text-center transition ${
                selected
                  ? "border-lime-300/50 bg-lime-300/[0.08]"
                  : locked
                  ? "cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-40"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]"
              }`}
            >
              {selected && <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-lime-300"><Check className="h-2 w-2 text-[#11150D]" strokeWidth={3.5} /></span>}
              {opt.tagline === "Recommended" && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full border border-lime-300/25 bg-[#0C0F0D] px-1.5 py-0 text-[7px] font-bold uppercase tracking-wide text-lime-300">Best</span>}
              <span className={selected ? "text-lime-300" : "text-white/50"}><Preview /></span>
              <span className={`text-[10px] font-black tracking-wide ${selected ? "text-lime-300" : "text-white/50"}`}>{opt.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 truncate text-[11px] text-white/35">{OPTIONS.find((o) => o.id === value)?.description}</p>
      {locked && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-white/30">Locked — set before the storyboard is built</p>
      )}
    </div>
  );
}
