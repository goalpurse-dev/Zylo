import { Palette } from "lucide-react";
import { VISUAL_STYLES } from "./api/thirtyDaysApi";

export default function VisualStyleSelector({ value, onChange }) {
  return <div>
    <div className="flex items-center gap-1.5">
      <Palette className="h-3.5 w-3.5 text-lime-300/70" />
      <p className="text-xs font-bold text-white/75">Visual style</p>
    </div>
    <div className="mt-2 grid grid-cols-2 gap-2">
      {VISUAL_STYLES.map((style) => {
        const selected = value === style.id;
        return <button
          key={style.id}
          type="button"
          onClick={() => onChange(style.id)}
          aria-pressed={selected}
          className={`min-w-0 rounded-xl border px-3 py-2 text-left transition duration-150 ${selected
            ? "border-lime-300/45 bg-lime-300/[.075] shadow-[inset_0_1px_0_rgba(190,242,100,.06)]"
            : "border-emerald-950/80 bg-[#090D0B] hover:border-emerald-700/45 hover:bg-[#0C120E]"} ${style.id === "auto" ? "col-span-2" : ""}`}
        >
          <span className={`block truncate text-[11px] font-black ${selected ? "text-lime-200" : "text-white/72"}`}>{style.label}{style.recommended ? " · Recommended" : ""}</span>
          <span className={`mt-0.5 block truncate text-[9px] ${selected ? "text-lime-100/38" : "text-white/27"}`}>{style.description}</span>
        </button>;
      })}
    </div>
  </div>;
}
