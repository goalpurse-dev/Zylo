// Blocky Worlds: the SCENE PLAN (owner-only, Blender kit engine; owner 2026-11-14). After the script, each scene shows the
// location picked for it from the LOCATION LIBRARY (locations.js), and the owner may change it (pick from the library
// or type a place; a typed place maps to the closest library location; custom worlds are v2). The plan goes with the
// run (run.card.scene_plan) and the Blender director uses exactly those locations. Pure (the API, the page, the worker).
//   autoScenePlan(lines) -> { scenes: [{ lines: [a, b], location, auto: true, preview }] }
//   cleanScenePlan(plan, nLines) -> { ok, plan?, error? }    (the owner's edited plan, checked)
//   locationFromText(text) -> { id, label } | null
import { LOCATIONS, locationById, pickLocation } from "./locations.js";

export const DEFAULT_LOCATION = "downtown_street";

/** the free automatic pick: each line's place words -> a library location (a line with none keeps the scene before);
 *  consecutive lines with the same location form one scene */
export function autoScenePlan(lines) {
  const ls = Array.isArray(lines) ? lines : [];
  const picks = [];
  let prev = null;
  for (const l of ls) {
    const id = pickLocation(l?.text ?? "") ?? prev ?? null;
    picks.push(id);
    if (id) prev = id;
  }
  const first = picks.find(Boolean) ?? DEFAULT_LOCATION;
  const scenes = [];
  picks.forEach((id0, i) => {
    const id = id0 ?? first;
    const last = scenes[scenes.length - 1];
    if (last && last.location === id) last.lines[1] = i;
    else scenes.push({ lines: [i, i], location: id, auto: true, preview: String(ls[i]?.text ?? "").slice(0, 90) });
  });
  return { scenes };
}

export function locationFromText(text) {
  const id = pickLocation(text);
  const l = id ? locationById(id) : null;
  return l ? { id: l.id, label: l.label } : null;
}

/** the owner's plan: every scene a library id (or a typed place that maps to one), line ranges in order, covering
 *  0..nLines-1 with no gap or overlap */
export function cleanScenePlan(plan, nLines) {
  const scenes = Array.isArray(plan?.scenes) ? plan.scenes : null;
  if (!scenes?.length) return { ok: false, error: "The scene plan is empty." };
  if (scenes.length > 60) return { ok: false, error: "Too many scenes." };
  const out = [];
  let next = 0;
  for (const s of scenes) {
    const a = Number(s?.lines?.[0]), b = Number(s?.lines?.[1]);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a !== next || b < a || b >= nLines) return { ok: false, error: "The scenes must cover the script's lines in order." };
    let id = locationById(s.location) ? s.location : null;
    if (!id && typeof s.typed === "string" && s.typed.trim()) id = locationFromText(s.typed)?.id ?? null;
    if (!id) return { ok: false, error: `We don't have "${String(s.typed ?? s.location ?? "").slice(0, 40)}" in our worlds yet. Pick one from the list.` };
    out.push({ lines: [a, b], location: id, auto: s.auto === true && !s.typed });
    next = b + 1;
  }
  if (next !== nLines) return { ok: false, error: "The scenes must cover every line." };
  return { ok: true, plan: { scenes: out } };
}

/** the list the page shows in the location picker */
export const PICKER = Object.freeze(LOCATIONS.map((l) => ({ id: l.id, label: l.label, world: l.world })));
