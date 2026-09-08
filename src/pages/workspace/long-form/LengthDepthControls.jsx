import { Minus, Plus } from "lucide-react";
import {
  CUSTOM_DEPTH_OPTIONS,
  DEFAULT_CUSTOM_DEPTH,
  DEFAULT_CUSTOM_LENGTH_MINUTES,
  DEPTH_MODE_OPTIONS,
  LENGTH_MODE_OPTIONS,
  MAX_CUSTOM_LENGTH_MINUTES,
  MIN_CUSTOM_LENGTH_MINUTES,
} from "./state";
import { ChipRow } from "./shared";
import LongFormSelect from "./LongFormSelect";

// Same control used for BOTH "Start with a topic" and a selected discovered
// idea — settings semantics never differ by source (state.js). Auto is
// always the default; switching to Custom reveals exactly one extra control
// each, never a big form. Compact on purpose: this sits inside the
// scrollable body of a fixed-height rail (DiscoveryPanels.jsx) or a
// centered card, never the page's primary content.
//
// layout="row" (manual-topic page, which has real width to spare) puts
// Target Length and Explanation Depth side by side from md breakpoint up.
// The default, "stacked", stays single-column always — used by the
// Discover Ideas rail, which is deliberately narrow and shouldn't cram two
// dropdowns into it.
export function LengthDepthControls({ draft, onChange, layout = "stacked" }) {
  const setLengthMode = (lengthMode) =>
    onChange({ lengthMode, customLengthMinutes: draft.customLengthMinutes ?? DEFAULT_CUSTOM_LENGTH_MINUTES });
  const setDepthMode = (depthMode) =>
    onChange({ depthMode, customExplanationDepth: draft.customExplanationDepth ?? DEFAULT_CUSTOM_DEPTH });

  const stepLength = (delta) => {
    const current = draft.customLengthMinutes ?? DEFAULT_CUSTOM_LENGTH_MINUTES;
    const next = Math.min(MAX_CUSTOM_LENGTH_MINUTES, Math.max(MIN_CUSTOM_LENGTH_MINUTES, current + delta));
    onChange({ customLengthMinutes: next });
  };

  return (
    <div className={`grid grid-cols-1 gap-3 ${layout === "row" ? "md:grid-cols-2 md:items-start" : ""}`}>
      <div>
        <LongFormSelect label="Target Length" options={LENGTH_MODE_OPTIONS} value={draft.lengthMode} onChange={setLengthMode} />
        {draft.lengthMode === "custom" && (
          <div className="mt-2 rounded-xl border border-white/[0.08] bg-[#101213] px-3 py-2.5">
            <span className="block text-center text-[10px] font-semibold uppercase tracking-[0.1em] text-white/30">Custom Length</span>
            <div className="mt-1.5 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => stepLength(-1)}
                disabled={draft.customLengthMinutes <= MIN_CUSTOM_LENGTH_MINUTES}
                aria-label="Decrease length"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-[64px] text-center text-[15px] font-bold text-white">{draft.customLengthMinutes} min</span>
              <button
                type="button"
                onClick={() => stepLength(1)}
                disabled={draft.customLengthMinutes >= MAX_CUSTOM_LENGTH_MINUTES}
                aria-label="Increase length"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <div>
        <LongFormSelect label="Explanation Depth" options={DEPTH_MODE_OPTIONS} value={draft.depthMode} onChange={setDepthMode} />
        {draft.depthMode === "custom" && (
          <div className="mt-2">
            <ChipRow
              label="Depth"
              options={CUSTOM_DEPTH_OPTIONS}
              value={draft.customExplanationDepth}
              onChange={(value) => onChange({ customExplanationDepth: value })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
