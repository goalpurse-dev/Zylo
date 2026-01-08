// src/components/SubtitleStyleStep.jsx
import React, { useEffect, useMemo, useState } from "react";

/**
 * Scrollable subtitle style picker used in Step 4.
 * Props:
 *  - onComplete({ isValid, enabled, styleId, styleName })
 *  - initial?: { enabled, styleId }
 */
export default function SubtitleStyleStep({ onComplete, initial }) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [selected, setSelected] = useState(initial?.styleId ?? null);

  // 36 quick variations (feel free to tune / add real previews later)
  const STYLES = useMemo(
    () => [
      { id: "classic-white", name: "Classic White", style: { color: "#fff", background: "#00000066", padding: "6px 12px", borderRadius: 8, fontWeight: 700 } },
      { id: "bold-red", name: "Bold Red", style: { color: "#fff", background: "#C1121F", padding: "6px 12px", borderRadius: 8, fontWeight: 800 } },
      { id: "outline-black", name: "White + Black Outline", style: { color: "#fff", textShadow: "0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000" } },
      { id: "outline-blue", name: "Yellow + Blue Outline", style: { color: "#FFD60A", textShadow: "0 2px 0 #023E8A, 0 -2px 0 #023E8A, 2px 0 0 #023E8A, -2px 0 0 #023E8A" } },
      { id: "comic-pop", name: "Comic Pop", style: { color: "#111", background: "#FFDD57", padding: "6px 12px", borderRadius: 6, fontWeight: 900 } },
      { id: "bubble", name: "Bubble", style: { color: "#111", background: "#E5E7EB", padding: "6px 12px", borderRadius: 9999, fontWeight: 700 } },
      { id: "neon-mint", name: "Neon Mint", style: { color: "#3EFECF", textShadow: "0 0 10px #3EFECF, 0 0 18px #3EFECF", fontWeight: 800 } },
      { id: "neon-blue", name: "Neon Blue", style: { color: "#1E90FF", textShadow: "0 0 10px #1E90FF, 0 0 18px #1E90FF", fontWeight: 800 } },
      { id: "neon-pink", name: "Neon Pink", style: { color: "#FF4D8D", textShadow: "0 0 10px #FF4D8D, 0 0 18px #FF4D8D", fontWeight: 800 } },
      { id: "shadow-heavy", name: "Heavy Shadow", style: { color: "#fff", textShadow: "2px 4px 6px rgba(0,0,0,.8)", fontWeight: 800 } },
      { id: "shadow-soft", name: "Soft Shadow", style: { color: "#fff", textShadow: "0 3px 8px rgba(0,0,0,.6)" } },
      { id: "lime-block", name: "Lime Block", style: { color: "#111", background: "#A7F3D0", padding: "6px 12px", borderRadius: 6, fontWeight: 800 } },
      { id: "cyan-block", name: "Cyan Block", style: { color: "#111", background: "#BAE6FD", padding: "6px 12px", borderRadius: 6, fontWeight: 800 } },
      { id: "violet-grad", name: "Violet Gradient", style: { background: "linear-gradient(90deg,#7A3BFF,#C084FC)", WebkitBackgroundClip: "text", color: "transparent", fontWeight: 900 } },
      { id: "mint-grad", name: "Mint Gradient", style: { background: "linear-gradient(90deg,#3EFECF,#00C4A7)", WebkitBackgroundClip: "text", color: "transparent", fontWeight: 900 } },
      { id: "blue-grad", name: "Blue Gradient", style: { background: "linear-gradient(90deg,#007BFF,#00A2FF)", WebkitBackgroundClip: "text", color: "transparent", fontWeight: 900 } },
      { id: "retro", name: "Retro", style: { color: "#111", background: "#FDE68A", padding: "6px 12px", borderRadius: 4, border: "2px solid #111", fontWeight: 900 } },
      { id: "carded", name: "Carded", style: { color: "#111", background: "#fff", padding: "10px 14px", borderRadius: 10, boxShadow: "0 6px 18px rgba(0,0,0,.12)" } },
      { id: "glass", name: "Glass", style: { color: "#fff", background: "rgba(255,255,255,.12)", backdropFilter: "blur(8px)", padding: "6px 12px", borderRadius: 8 } },
      { id: "caps-red", name: "All Caps Red", style: { color: "#DC2626", letterSpacing: "2px", fontWeight: 900, textTransform: "uppercase" } },
      { id: "caps-blue", name: "All Caps Blue", style: { color: "#1D4ED8", letterSpacing: "2px", fontWeight: 900, textTransform: "uppercase" } },
      { id: "caps-mint", name: "All Caps Mint", style: { color: "#059669", letterSpacing: "2px", fontWeight: 900, textTransform: "uppercase" } },
      { id: "thin-white", name: "Thin White", style: { color: "#fff", fontWeight: 400 } },
      { id: "thin-yellow", name: "Thin Yellow", style: { color: "#fde047", fontWeight: 500 } },
      { id: "thick-black", name: "Thick Black", style: { color: "#111", background: "#fff", padding: "6px 12px", borderRadius: 6, fontWeight: 900, border: "2px solid #111" } },
      { id: "caption-gray", name: "Caption Gray", style: { color: "#374151", background: "#F3F4F6", padding: "6px 10px", borderRadius: 4 } },
      { id: "spark", name: "Spark", style: { color: "#F97316", textShadow: "0 0 10px rgba(249,115,22,.6)", fontWeight: 900 } },
      { id: "ice", name: "Ice", style: { color: "#60A5FA", textShadow: "0 0 10px rgba(96,165,250,.6)", fontWeight: 900 } },
      { id: "choco", name: "Chocolate", style: { color: "#fff", background: "#7C3E2D", padding: "6px 12px", borderRadius: 8, fontWeight: 800 } },
      { id: "grape", name: "Grape", style: { color: "#fff", background: "#7C3AED", padding: "6px 12px", borderRadius: 8, fontWeight: 800 } },
      { id: "leaf", name: "Leaf", style: { color: "#064E3B", background: "#D1FAE5", padding: "6px 12px", borderRadius: 8, fontWeight: 700 } },
      { id: "steel", name: "Steel", style: { color: "#111827", background: "#E5E7EB", padding: "6px 12px", borderRadius: 8, fontWeight: 700 } },
      { id: "ghost", name: "Ghost", style: { color: "#fff", border: "2px solid #fff", padding: "4px 10px", borderRadius: 10 } },
      { id: "marker", name: "Marker", style: { color: "#111", background: "#FDE68A", padding: "2px 6px", boxShadow: "0 -6px 0 #FDE68A inset", fontWeight: 800 } },
      { id: "ink", name: "Ink", style: { color: "#000", textShadow: "0 0 1px #000" } },
      { id: "sea", name: "Sea", style: { color: "#0EA5E9", background: "#E0F2FE", padding: "6px 12px", borderRadius: 6, fontWeight: 800 } },
      { id: "warning", name: "Warning", style: { color: "#fff", background: "#F97316", padding: "6px 12px", borderRadius: 6, fontWeight: 900 } },
    ],
    []
  );

  useEffect(() => {
    if (!onComplete) return;
    if (!enabled) {
      onComplete({ isValid: true, enabled: false, styleId: null, styleName: "None" });
    } else if (selected) {
      const obj = STYLES.find((s) => s.id === selected);
      onComplete({
        isValid: true,
        enabled: true,
        styleId: obj?.id,
        styleName: obj?.name,
      });
    } else {
      onComplete({ isValid: false, enabled: true, styleId: null, styleName: null });
    }
  }, [enabled, selected, STYLES, onComplete]);

  return (
    <div className="grid lg:grid-cols-[1fr] gap-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Choose whether subtitles should appear, then pick a style.
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            onChange={() => setEnabled((v) => !v)}
            className="h-4 w-4 accent-[#007BFF]"
          />
          Show subtitles
        </label>
      </div>

      {/* Scrollable grid */}
      <div className="mt-2 rounded-2xl border border-gray-200 bg-white">
        <div className="max-h-[520px] overflow-y-auto p-4">
          {!enabled ? (
            <div className="h-52 grid place-items-center text-gray-400">
              Subtitles are disabled.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {STYLES.map((s) => {
                const active = selected === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`rounded-xl border text-left transition p-4 h-36 flex items-center justify-center
                      ${active ? "border-[#007BFF] ring-2 ring-[#007BFF]/25" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <div className="w-full h-full bg-gray-50 rounded-lg grid place-items-center">
                      <div style={s.style} className="text-2xl leading-[1] select-none">
                        WORD
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-4 text-xs text-gray-600 font-medium">
                      {s.name}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
