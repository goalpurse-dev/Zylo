import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { FOCUS, cx } from "../../ui/zyvo";
import { locationFromText } from "../../../../supabase/functions/_shared/blockyWorlds/scenePlan.js";

/**
 * The SCENE PLAN (owner-only, the Blender kit engine; owner 2026-11-14): after the script, each scene with the location
 * picked for it from our world library, and a way to change it (pick from the library, or type a place: it maps to the
 * closest library location). "Make my video" sends the plan with the run. Minimal by design: custom worlds are v2.
 */
export default function ScenePlan({ flow }) {
  const { scenePlan, loadScenePlan, changeScene, lines } = flow;
  const [open, setOpen] = useState(false);
  const [typing, setTyping] = useState(null); // { i, text }
  useEffect(() => { if (open && !scenePlan) loadScenePlan(); }, [open, scenePlan, loadScenePlan]);
  const locs = scenePlan?.locations ?? [];
  const labelOf = (id) => locs.find((l) => l.id === id)?.label ?? id;
  const typed = typing?.text ? locationFromText(typing.text) : null;

  return (
    <div className="mb-2 rounded-xl border border-white/[0.08] bg-white/[0.03]" data-testid="bw-scene-plan">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className={cx("flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[12px] font-bold text-white/75", FOCUS)}>
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-lime-300" aria-hidden="true" />Scene plan<span className="font-semibold text-white/40">(owner)</span></span>
        <span className="text-white/40">{open ? "Hide" : scenePlan ? `${scenePlan.scenes.length} scenes` : "Show"}</span>
      </button>
      {open && (
        <ol className="max-h-64 space-y-1.5 overflow-y-auto px-3 pb-3" data-testid="bw-scene-list">
          {!scenePlan && <li className="text-[11.5px] text-white/45">Picking a place for each scene…</li>}
          {scenePlan?.scenes.map((sc, i) => (
            <li key={`${sc.lines[0]}-${sc.lines[1]}`} className="rounded-lg bg-[#111315] px-2.5 py-2">
              <p className="mb-1 truncate text-[11px] text-white/50">Lines {sc.lines[0] + 1}{sc.lines[1] > sc.lines[0] ? `–${sc.lines[1] + 1}` : ""}: {lines[sc.lines[0]]?.text ?? sc.preview}</p>
              <div className="flex items-center gap-2">
                <select aria-label={`Location for scene ${i + 1}`} value={sc.location} onChange={(e) => changeScene(i, { location: e.target.value, typed: undefined })}
                  className={cx("min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0b0c0e] px-2 py-1 text-[12px] text-white", FOCUS)}>
                  {locs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                {sc.auto && <span className="text-[10.5px] font-semibold text-white/35">auto</span>}
                <button type="button" onClick={() => setTyping({ i, text: "" })} className={cx("text-[11px] font-bold text-lime-300 underline", FOCUS)}>Change</button>
              </div>
              {typing?.i === i && (
                <div className="mt-1.5 flex items-center gap-2">
                  <input autoFocus value={typing.text} maxLength={60} onChange={(e) => setTyping({ i, text: e.target.value })} placeholder="Type a place: a bank, the moon, my bedroom…"
                    className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#0b0c0e] px-2 py-1 text-[12px] text-white outline-none placeholder:text-white/25" />
                  <button type="button" disabled={!typed} onClick={() => { changeScene(i, { location: typed.id, typed: typing.text }); setTyping(null); }}
                    className={cx("rounded-md bg-white/[0.08] px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40", FOCUS)}>{typed ? `Use ${typed.label}` : "Not in our worlds yet"}</button>
                </div>
              )}
              {sc.typed && <p className="mt-1 text-[10.5px] text-white/40">“{sc.typed}” → {labelOf(sc.location)}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
