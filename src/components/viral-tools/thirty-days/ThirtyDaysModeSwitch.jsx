import { Clapperboard, Layers3 } from "lucide-react";

export default function ThirtyDaysModeSwitch({ mode, onChange, disabled = false }) {
  return <div className="grid grid-cols-2 rounded-xl border border-emerald-950/80 bg-[#080B09] p-1">
    {[{ id: "single", label: "Single Video", icon: Clapperboard }, { id: "series", label: "Series", icon: Layers3 }].map((item) => {
      const Icon = item.icon;
      const selected = mode === item.id;
      return <button key={item.id} type="button" disabled={disabled} onClick={() => onChange(item.id)} aria-pressed={selected}
        className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[11px] font-black transition ${selected ? "bg-lime-300 text-[#10150D]" : "text-white/45 hover:bg-emerald-950/35 hover:text-white/75"} disabled:opacity-40`}>
        <Icon className="h-3.5 w-3.5" />{item.label}
      </button>;
    })}
  </div>;
}
