import { ChevronDown, SlidersHorizontal } from "lucide-react";

const DIRECTIONS = [
  ["auto", "Automatic"],
  ["anime", "Anime accurate"],
  ["realistic", "Realistic"],
  ["dreamcore", "Dreamcore"],
  ["cinematic", "Cinematic"],
];

export default function TwoAmAdvancedSettings({ open, onToggle, settings, onChange }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-lime-300/[0.09] bg-lime-300/[0.018] shadow-[inset_0_1px_0_rgba(190,242,100,.025)]">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-4 w-4 text-lime-300" strokeWidth={2.2} />
          <div>
            <p className="text-[13px] font-bold text-white/85">Advanced settings</p>
            <p className="mt-0.5 text-[10px] text-white/30">Optional creative controls</p>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/35 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-5 border-t border-lime-300/[0.07] px-4 pb-4 pt-4">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Visual direction</p>
              <div className="flex flex-wrap gap-1.5">
                {DIRECTIONS.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => onChange({ ...settings, style: value })}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${settings.style === value ? "border-lime-300/50 bg-lime-300/10 text-lime-200 shadow-[0_0_14px_rgba(190,242,100,.06)]" : "border-white/[0.07] bg-white/[0.035] text-white/40 hover:border-lime-300/20 hover:text-white/70"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Nostalgia intensity</p>
                <span className="text-[11px] font-bold text-lime-300">{Math.round(settings.nostalgia * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(settings.nostalgia * 100)}
                onChange={(event) => onChange({ ...settings, nostalgia: Number(event.target.value) / 100 })}
                className="h-1.5 w-full cursor-pointer accent-lime-400"
              />
              <div className="mt-1.5 flex justify-between text-[9px] font-medium text-white/25"><span>Subtle</span><span>Dreamlike</span></div>
            </div>

            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">Specific scene requests</span>
              <textarea
                value={settings.customInstructions}
                maxLength={800}
                onChange={(event) => onChange({ ...settings, customInstructions: event.target.value })}
                placeholder="One request is used in one scene only.&#10;&#10;Example: Chen Island, Wu drinking tea with the ninjas"
                className="min-h-28 w-full resize-none rounded-xl border border-lime-300/[0.09] bg-[#080B09] px-3.5 py-3 text-[12px] leading-relaxed text-white outline-none placeholder:text-white/20 focus:border-lime-300/45 focus:ring-1 focus:ring-lime-300/20"
              />
              <span className="mt-2 block text-[9px] leading-relaxed text-white/25">Separate requests with commas, semicolons, or new lines. Each becomes a different slide.</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
