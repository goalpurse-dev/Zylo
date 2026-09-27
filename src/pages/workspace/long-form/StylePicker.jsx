import { useState } from "react";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { Check, X } from "lucide-react";
import { STYLE_PRESETS, toVersionedId, parseVersionedId } from "./stylePresets";
import StoryboardSketch from "./StoryboardSketch";

// A representative beat for the live preview panel (Part 13) — a real beat
// from the current storyboard when one exists, otherwise this generic
// placeholder so the picker still works before any storyboard is generated.
const FALLBACK_BEAT = { id: "preview", visualType: "SCENE", shotSize: "MEDIUM", informationToCommunicate: "A representative scene from your storyboard.", sketchContext: { characterCount: 1, environment: "" } };

// Card preview — a curated, static product asset (Part 5: never generated
// per-request, every user sees the same one). Real assets now exist for all
// 6 launch presets (see stylePresets.js's previewAsset + STYLE_PREVIEW_PROMPTS.md
// for the exact prompt used per style). Falls back to a theme-tinted
// abstract placeholder for any future preset added without artwork yet,
// rather than ever showing a broken image.
function PreviewSwatch({ preset }) {
  const [loadFailed, setLoadFailed] = useState(false);
  if (preset.previewAsset && !loadFailed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl bg-black/20">
        <img src={preset.previewAsset} alt={`${preset.name} style preview`} className="h-full w-full object-cover" loading="lazy" onError={() => setLoadFailed(true)} />
      </div>
    );
  }
  const t = preset.sketchTheme;
  return (
    <div
      className="relative aspect-video w-full overflow-hidden rounded-t-2xl"
      style={{ background: `linear-gradient(135deg, ${t.paper} 0%, ${t.structureFill} 55%, ${t.accent} 100%)` }}
    >
      <svg viewBox="0 0 100 56" className="absolute inset-0 h-full w-full opacity-90">
        <rect x="8" y="10" width="38" height="36" rx="4" fill={t.structureFill} stroke={t.structureStroke} strokeWidth="1.5" />
        <circle cx="66" cy="24" r="10" fill={t.person} stroke={t.personStroke} strokeWidth="1.2" />
        <rect x="56" y="36" width="20" height="12" rx="2" fill={t.device} />
      </svg>
      <span className="absolute bottom-2 right-2 rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">
        Preview placeholder
      </span>
    </div>
  );
}

function StyleCard({ preset, selected, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`${preset.name}. ${preset.summary} Best for: ${preset.bestFor.join(", ")}.`}
      onClick={() => onSelect(preset)}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-[#121615] text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0e0d] ${
        selected ? "border-lime-300/70 shadow-[0_0_0_1px_rgba(190,242,100,0.35),0_0_24px_-6px_rgba(190,242,100,0.45)]" : "border-white/10 hover:-translate-y-0.5 hover:border-white/25"
      }`}
    >
      <PreviewSwatch preset={preset} />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[14px] font-bold text-white">{preset.name}</p>
          {selected && (
            <span className="flex shrink-0 items-center gap-1 rounded-full border border-lime-300/40 bg-lime-300/10 px-2 py-0.5 text-[10px] font-bold text-lime-300">
              <Check className="h-3 w-3" /> Selected
            </span>
          )}
        </div>
        <p className="text-[11.5px] font-semibold text-white/50">{preset.descriptors.join(" · ")}</p>
        <p className="text-[12px] leading-relaxed text-white/40">{preset.summary}</p>
        <p className="mt-auto pt-1 text-[11px] text-white/30">
          Best for <span className="text-white/50">{preset.bestFor.join(" · ")}</span>
        </p>
      </div>
    </button>
  );
}

export default function StylePicker({ open, currentStylePreset, previewBeat, onClose, onConfirm }) {
  const currentId = parseVersionedId(currentStylePreset).id;
  const [draftId, setDraftId] = useState(currentId);
  const draftPreset = STYLE_PRESETS.find((s) => s.id === draftId) ?? STYLE_PRESETS[0];
  const beat = previewBeat ?? FALLBACK_BEAT;

  function close() {
    setDraftId(currentId); // discard any un-confirmed preview selection
    onClose();
  }
  function confirm() {
    onConfirm(toVersionedId(draftPreset));
  }

  return (
    <Dialog open={open} onClose={close} className="relative z-[110]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-5">
        <DialogPanel className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden bg-[#101414] text-white sm:h-[88vh] sm:rounded-2xl sm:border sm:border-white/15">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
            <div>
              <DialogTitle className="text-lg font-bold">Choose your visual style</DialogTitle>
              <p className="mt-1 text-xs text-white/45">Free to change until you build your Visual World. Your storyboard stays exactly the same.</p>
            </div>
            <button type="button" aria-label="Close style picker" onClick={close} className="rounded-lg p-2 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div role="radiogroup" aria-label="Visual style" className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {STYLE_PRESETS.map((preset) => (
                <StyleCard key={preset.id} preset={preset} selected={draftId === preset.id} onSelect={(p) => setDraftId(p.id)} />
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Selected style · {draftPreset.name}</p>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
                {draftPreset.previewAsset && (
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <img src={draftPreset.previewAsset} alt={`${draftPreset.name} style preview`} className="aspect-video w-full object-cover" onError={(e) => { e.currentTarget.parentElement.style.display = "none"; }} />
                  </div>
                )}
                <div>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <StoryboardSketch beat={beat} visualStylePreset={toVersionedId(draftPreset)} />
                  </div>
                  <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-white/30">Live Director-sketch preview</p>
                </div>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-white/35">
                The large image is the actual curated style preview. The smaller sketch is schematic, not a generated image — it shows how palette and linework shift with your chosen style, at zero cost. Real illustrated frames are created later in Visual World.
              </p>
            </div>
          </div>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 bg-[#141919] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <button type="button" onClick={close} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10">
              Cancel
            </button>
            <button type="button" onClick={confirm} className="rounded-xl bg-lime-300 px-5 py-3 text-sm font-bold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]">
              Use {draftPreset.name}
            </button>
          </footer>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
