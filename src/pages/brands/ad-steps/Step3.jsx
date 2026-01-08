import React from "react";
import { cn, MIN_SCENE_LEN, MAX_SCENES } from "./ui";

export default function Step3({
  segments,
  setSegments,
  sceneCount,
  setSceneCountSafe,
  updateSegmentLen,
  addScene,
  removeScene,
  lines,
  setLines,
}) {
  // Quick presets for 8s (all meet min 2s/scene)
  const presets = [
    [2, 2, 4],
    [2, 3, 3],
    [4, 4],
    [2, 2, 2, 2],
  ];

  function setPreset(arr) {
    let acc = 0;
    const segs = arr.map((len) => {
      const s = { start: acc, end: acc + len };
      acc += len;
      return s;
    });
    setSegments(segs);
    setLines((prev) => {
      const L = arr.length;
      const next = prev.slice(0, L);
      while (next.length < L) next.push("");
      return next;
    });
  }

  return (
    <div className="space-y-5">
      {/* Heading */}
      <div>
        <div className="text-base font-semibold tracking-tight">
          <span className="mr-1">3)</span>{" "}
          <span className="font-extrabold">Scenes &amp; script</span>{" "}
          <span className="opacity-70">(total 8s)</span>
        </div>
        <p className="mt-1 text-xs text-white/70">
          Split your ad into <span className="font-semibold text-white">2–4 scenes</span>. Each scene is at least{" "}
          <span className="font-semibold text-white">{MIN_SCENE_LEN}s</span>. Adjust lengths and write the exact
          line your avatar should speak.
        </p>
      </div>

      {/* Controls bar */}
      <div className="rounded-2xl border border-white/12 bg-white/[.035] p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-white/70 mr-1">Scene count</div>
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setSceneCountSafe(n)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-semibold transition ring-1",
                n === sceneCount
                  ? "bg-white/90 text-black ring-white/40"
                  : "bg-white/10 text-white/85 ring-white/10 hover:bg-white/15 hover:ring-white/20"
              )}
            >
              {n}
            </button>
          ))}

          <div className="mx-3 h-5 w-px bg-white/15" />

          <div className="text-xs text-white/70 mr-1">Quick presets</div>
          {presets.map((p, i) => (
            <button
              key={i}
              onClick={() => setPreset(p)}
              className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/10 ring-1 ring-white/10 hover:bg-white/15 hover:ring-white/20 transition"
              title={`${p.join("+")} = 8s`}
            >
              {p.join(" + ")}s
            </button>
          ))}

          <div className="ml-auto text-xs text-white/70">
            Total: <span className="font-semibold text-white">8.00s</span>
          </div>
        </div>
      </div>

      {/* Editable rows */}
      <div className="grid gap-3">
        {segments.map((seg, i) => {
          const length = seg.end - seg.start;
          return (
            <div
              key={i}
              className="rounded-2xl border border-white/12 bg-white/[.03] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-white/60 font-semibold">
                  Scene {i + 1}
                </div>
                <div className="text-xs text-white/60">
                  {seg.start.toFixed(2)}s → {seg.end.toFixed(2)}s
                </div>
              </div>

              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-white/60">Length (sec)</label>
                  <input
                    type="number"
                    min={MIN_SCENE_LEN}
                    step="0.1"
                    value={Number(length.toFixed(2))}
                    onChange={(e) => updateSegmentLen(i, parseFloat(e.target.value))}
                    className="w-full rounded-xl border border-white/12 bg-white/5 p-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                  />
                  <div className="mt-1 text-[11px] text-white/45">
                    Min {MIN_SCENE_LEN}s • Remaining scenes auto-fit to end at 8s
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-white/60">Lines to speak</label>
                  <textarea
                    rows={3}
                    value={lines[i] || ""}
                    onChange={(e) => {
                      const next = [...lines];
                      next[i] = e.target.value;
                      setLines(next);
                    }}
                    placeholder="Write exactly what the avatar should say in this scene."
                    className="w-full rounded-xl border border-white/12 bg-white/5 p-2 text-sm outline-none focus:ring-2 focus:ring-[#7A3BFF]"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / remove */}
      <div className="flex gap-2">
        <button
          onClick={addScene}
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-semibold transition",
            segments.length < MAX_SCENES
              ? "bg-white/10 hover:bg-white/15 border border-white/12"
              : "bg-white/5 opacity-50 cursor-not-allowed border border-white/10"
          )}
          disabled={segments.length >= MAX_SCENES}
        >
          + Add scene
        </button>
        <button
          onClick={removeScene}
          className={cn(
            "rounded-xl px-3 py-1.5 text-sm font-semibold transition",
            segments.length > 2
              ? "bg-white/10 hover:bg-white/15 border border-white/12"
              : "bg-white/5 opacity-50 cursor-not-allowed border border-white/10"
          )}
          disabled={segments.length <= 2}
        >
          − Remove last
        </button>
      </div>
    </div>
  );
}
