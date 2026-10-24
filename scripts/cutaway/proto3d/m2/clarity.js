// M2: the clarity checks (the owner's car wash review, 2026-10-23), run by the solver before anything is rendered.
//  1. every sentence shows its own action: its beat names (shows.p) a part that acts in that beat, not one that only
//     goes away (hide, stop, off...); congrats is the calm end and is exempt
//  2. finishing touches belong in the setting: no grass or bushes at a car wash, a street, a garage or a room; a prop's
//     type must be on the setting's list (catalog.js SETTING_PROPS)
//  3. nothing floats: a part above the floor rests on the ground or on another part (a roof is a canopy with posts);
//     a raised pipe ends at a part
//  4. no tree stands over a part that acts (a tree over the gas flame)
import { focusOf as focusRaw } from "./focus.js";
import { SETTING_PROPS } from "./catalog.js";
import { settingBoxes, settingFloor } from "./framing.js";

const focusOf = (p, cut) => { try { return focusRaw(p, cut); } catch { return null; } };
// verbs that only take something away: a sentence whose only action is one of these shows nothing happening
const AWAY = /^(hide|stop|stopSpray|stopPulse|stopDrain|off|gone|leave|untip|lower|refill|close|open|clean|drain|clear1|clear2|dry)$/;
const overlapXZ = (a, b, pad = 0) => a.min[0] < b.max[0] - pad && b.min[0] < a.max[0] - pad && a.min[2] < b.max[2] - pad && b.min[2] < a.max[2] - pad;
export const settingOf = (W = {}) => W.backdrop?.type ?? (W.house === false ? "plain" : "yard");

export function clarityChecks(L, sentences) {
  const problems = [], warnings = [];
  const W = L.world ?? {}, cut = W.cut, setting = settingOf(W), parts = new Map(L.parts.map((p) => [p.id, p]));
  // 1. every sentence shows its own action
  for (const s of sentences) {
    if (s.role === "congrats") continue;
    const b = (L.beats ?? []).find((x) => x.s === s.role);
    if (!b?.shows?.p) { problems.push(`sentence ${s.role}: no shows {p, does}: name the part that visibly does "${s.text}"`); continue; }
    if (!parts.has(b.shows.p)) { problems.push(`sentence ${s.role}: shows names ${b.shows.p}, which is not a part`); continue; }
    const acts = (b.do ?? []).filter((a) => a.p === b.shows.p && !AWAY.test(a.v));
    if (!acts.length) problems.push(`sentence ${s.role}: ${b.shows.p} (${b.shows.does}) does nothing in this beat; give it the verb that shows it, or show the part that does`);
  }
  // 2. finishing touches that belong in the setting
  const allowed = new Set(SETTING_PROPS[setting] ?? []), green = !["yard", "park"].includes(setting) ? setting : null;
  for (const p of L.parts) {
    const isGrass = p.kind === "wipe" && /grass/i.test(p.params?.mat ?? "");
    if (green && (["shrubs", "youngTrees", "lawnWet"].includes(p.kind) || isGrass)) problems.push(`part ${p.id} (${isGrass ? "grass" : p.kind}) does not belong in the ${setting} setting: use its props (${[...allowed].join(", ")})`);
    if (p.kind === "prop" && !allowed.has(`prop:${p.params?.type}`)) problems.push(`part ${p.id}: a ${p.params?.type} does not belong in the ${setting} setting (allowed: ${[...allowed].filter((x) => x.startsWith("prop:")).map((x) => x.slice(5)).join(", ")})`);
  }
  // 2b. the "Add ..." line brings only finishing touches, never a new machine (a traffic light at a car wash)
  const fin = (L.beats ?? []).find((b) => b.s === "finish"), seen = new Set((L.beats ?? []).filter((b) => b !== fin && L.beats.indexOf(b) < L.beats.indexOf(fin)).flatMap((b) => (b.do ?? []).map((a) => a.p)));
  for (const a of fin?.do ?? []) { const p = parts.get(a.p); if (p && !seen.has(a.p) && ["trafficLight", "carWash", "vendingMachine", "atm", "hydrant", "car", "machine", "tank", "dumpTruck"].includes(p.kind)) problems.push(`finish: ${p.id} (${p.kind}) is a machine, not a finishing touch; add something from the ${setting} list`); }
  // 2c. realistic settings: no natural water (a creek, a stream) on a paved floor; it lies beside the setting (axis "z",
  // past the floor's edge), and what runs off the floor reaches it through a storm drain and a pipe
  const F = settingFloor(W.backdrop);
  if (F) for (const p of L.parts) if (p.kind === "creek") { const b = focusRaw(p, cut); if (b.max[0] > F[0] && b.min[0] < F[1]) problems.push(`part ${p.id}: a creek cannot run across the ${setting}'s paved floor (x ${F[0]} to ${F[1]}); put it beside the setting (axis "z", x past ${F[1] + 2} or before ${F[0] - 2}) and bring the water to it through a storm drain grate and a pipe in the cut face`); }
  // 3. nothing floats
  const floor = W.backdrop?.walkTop ?? (["street", "room"].includes(setting) ? 0.12 : setting === "carwash" ? 0.1 : setting === "garage" ? 0.08 : 0);
  const solids = [...settingBoxes(W.backdrop)];
  const boxesOf = (p) => (p.kind === "panels" ? (p.params?.panels ?? []).map((q) => { if (!Array.isArray(q.size) || !Array.isArray(q.pos)) return null; const s = q.size.map(Math.abs), a = q.anchor ?? [0, 0, 0]; const c = q.pos.map((v, i) => v + (a[i] * s[i]) / 2); return { ch: q.ch, min: c.map((v, i) => v - s[i] / 2), max: c.map((v, i) => v + s[i] / 2) }; }).filter(Boolean) : [focusOf(p, cut)].filter(Boolean));
  const STANDING = ["box", "boxPop", "machine", "tank", "prop", "panels", "vendingMachine", "atm", "carWash", "trafficLight", "hydrant"];
  // what can hold something up: solid parts (a pipe, a flow, water or an arrow holds nothing)
  const all = L.parts.filter((p) => [...STANDING, "canopy", "settle", "wipe", "gravel", "bags"].includes(p.kind)).flatMap((p) => boxesOf(p).map((b) => ({ id: p.id, b })));
  const ends = L.parts.flatMap((p) => boxesOf(p).map((b) => ({ id: p.id, b })));
  for (const p of L.parts) {
    if (!STANDING.includes(p.kind)) continue;
    for (const b of boxesOf(p)) {
      if (b.min[1] <= floor + 0.2) continue; // on the ground (or in the cut)
      // a riser (a vertical pipe) holds a small cap on its top (a wellhead), never a roof
      const small = b.max[0] - b.min[0] <= 1.2 && b.max[2] - b.min[2] <= 1.2;
      const risers = small ? L.parts.filter((x) => x.kind === "riser").map((x) => focusOf(x, cut)).filter(Boolean) : [];
      const under = [...all.filter((x) => !(x.id === p.id && x.b.ch === b.ch)).map((x) => x.b), ...solids, ...risers].some((o) => overlapXZ(o, b, 0.02) && Math.abs(o.max[1] - b.min[1]) <= 0.25); // its top meets this part's bottom
      if (!under) problems.push(`part ${p.id}${b.ch ? ` (${b.ch})` : ""} floats: its bottom is at y = ${b.min[1].toFixed(1)} with nothing under it; stand it on the ground or a part (a roof is a canopy, with its posts)`);
    }
  }
  for (const p of L.parts.filter((x) => ["pipe", "pipeRun"].includes(x.kind))) {
    const path = p.params?.path ?? []; if (path.length < 2) continue;
    for (const end of [path[0], path.at(-1)]) {
      if (end[1] <= floor + 0.4) continue;
      const near = [...ends.filter((x) => x.id !== p.id).map((x) => x.b), ...solids].some((o) => end.every((v, i) => v >= o.min[i] - 0.4 && v <= o.max[i] + 0.4));
      if (!near) problems.push(`part ${p.id}: the pipe ends in the air at [${end.map((v) => v.toFixed(1)).join(", ")}]; end it at a part (a pump, a nozzle arch, a tank)`);
    }
  }
  // 4. no tree over a part that acts
  const trees = [...(W.trees ?? []).map(([x, z, s = 1]) => ({ x, z, r: 1.8 * s })), ...L.parts.filter((p) => p.kind === "youngTrees").flatMap((p) => (p.params?.trees ?? []).map(([x, z, s = 1]) => ({ x, z, r: 1.0 * s })))];
  for (const p of L.parts.filter((x) => ["flare", "machine", "boxPop", "tank", "prop", "vendingMachine", "atm", "hydrant"].includes(x.kind))) {
    const b = focusOf(p, cut); if (!b || b.max[1] < 0) continue;
    for (const t of trees) if (t.x > b.min[0] - t.r && t.x < b.max[0] + t.r && t.z > b.min[2] - t.r && t.z < b.max[2] + t.r) { problems.push(`a tree at [${t.x}, ${t.z}] stands over ${p.id}: move the tree clear of it`); break; }
  }
  return { problems, warnings };
}
