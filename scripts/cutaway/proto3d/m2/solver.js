// M2: the layout solver: free code checks on a planned layout before anything is rendered. It returns problems
// (the plan goes back for one repair round) and warnings (logged). Geometry in world units, see catalog.js.
import { validateLayout } from "./format.js";
import { focusOf as focusRaw, union } from "./focus.js";
// a part with missing settings has no box (its problem is reported by REQUIRED)
const focusOf = (p, cut) => { try { return focusRaw(p, cut); } catch { return null; } };
import { expandBeats, VERBS } from "./verbs.js";
import { compile } from "./compile.mjs";
import { draftWords } from "./plan.js";

// the settings each kind cannot do without
export const REQUIRED = {
  dig: ["mound"], panels: ["panels"], box: ["mat", "size", "pos"], bags: ["area", "y0"], pipeRun: ["path", "r"], pipeRunFlow: ["pipe"], tank: ["pos"],
  riser: ["x", "z", "y0", "y1"], boxPop: ["size", "pos"], flare: ["pos"], bubbles: ["x0", "x1", "y0", "y1"], machine: ["pos"], fence: ["x0", "x1", "step", "zBack", "sideStart", "zFront"],
  youngTrees: ["trees"], sheet: ["from", "to"], book: ["from", "to", "lines"], flag: ["at"], shrubs: ["list"], sign: ["at"], crack: ["points"], drops: ["x0", "x1", "landY"],
  water: ["box"], gravel: ["box", "faceBox", "pourBox", "waterTop", "waterSpan", "drainDrop"], soakPit: ["box", "faceBox"], wipe: ["box", "mat"], wrap: ["box"], pipe: ["path"], pipeFlow: ["pipe"],
  puddles: ["list"], rain: ["x0", "x1", "z0", "z1"], stream: ["x0", "x1", "z", "yTop", "yBot"], wetBand: ["cx", "halfW", "bottom"], soak: ["x0", "x1", "top"], arrows: ["list"], outline: ["points"],
};
const LIBS = ["dirt", "drip", "water_rush", "flame", "motor_hum"];
const overlap = (a, b, pad = 0) => [0, 1, 2].every((i) => a.min[i] < b.max[i] - pad && b.min[i] < a.max[i] - pad);
const pts = (p) => [p.path, p.points, Array.isArray(p.list) && p.list.every((a) => a && !Array.isArray(a) && Array.isArray(a.at)) ? p.list.map((a) => a.at) : null].find(Array.isArray) ?? [];

export function solveLayout(L, sentences) {
  const problems = [], warnings = [];
  const W = L.world ?? {}, cut = W.cut;
  if (!cut || ![cut.x0, cut.x1, cut.z0, cut.depth].every(Number.isFinite)) return { problems: ["world.cut must be {x0, x1, z0, depth}"], warnings };
  if (!(cut.x1 > cut.x0 && cut.z0 < 0 && cut.depth > 0)) problems.push("world.cut: needs x1 > x0, z0 < 0 (it opens on the face z = 0) and depth > 0");
  if (Math.abs(cut.x0) > 14 || Math.abs(cut.x1) > 14 || cut.depth > 20 || cut.z0 < -10) problems.push("world.cut: keep |x| <= 14, depth <= 20, z0 >= -10");
  const cutBox = { min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] };
  const h = Array.isArray(W.house) ? W.house : W.house === false ? [0, -100, 0] : [-8, 0, -30], houseBox = { min: [h[0] - 5.5, 0, h[2] - 3.25], max: [h[0] + 5.5, 9.4, h[2] + 3.25] };
  if (overlap({ min: [cut.x0, -1, cut.z0], max: [cut.x1, 1, 0] }, houseBox, 0.05)) problems.push("the house stands on the cut: move world.house back (its front is z + 3.25) or the cut aside");
  // the parts' own settings
  for (const p of L.parts) {
    const P = p.params ?? {};
    for (const k of REQUIRED[p.kind] ?? []) if (P[k] == null) problems.push(`part ${p.id} (${p.kind}): needs ${k}`);
    for (const q of pts(P)) if (!Array.isArray(q) || q.length !== 3 || !q.every(Number.isFinite)) { problems.push(`part ${p.id}: every point must be [x, y, z]`); break; }
    for (const k of ["box", "faceBox", "pourBox", "area"]) if (P[k]) { const b = P[k]; if (!["x0", "x1", "z0", "z1"].every((j) => Number.isFinite(b[j])) || b.x1 <= b.x0 || b.z1 <= b.z0 || (b.y0 != null && b.y1 != null && b.y1 <= b.y0)) problems.push(`part ${p.id}: ${k} needs x0 < x1, y0 < y1, z0 < z1`); }
    if (["water", "gravel", "soakPit", "wrap"].includes(p.kind) && P.box && Math.abs(P.box.z1) > 0.06) warnings.push(`part ${p.id}: a fill seen in section should end at the face (box.z1 about 0)`);
    if (p.kind === "pipe" || p.kind === "pipeRun") for (const q of P.path ?? []) if (q[1] < 0 && Math.abs(q[2]) > 0.3 && !(q[0] >= cut.x0 && q[0] <= cut.x1 && q[2] >= cut.z0)) warnings.push(`part ${p.id}: an underground pipe point ${JSON.stringify(q)} is hidden (not at the face, z about -0.06)`);
    if (p.kind === "sign") { const s = focusOf(p, cut); if ((P.at?.[1] ?? 0) < 0) problems.push("the sign must stand on the ground (at[1] >= 0)"); if (overlap(s, houseBox, 0.3)) problems.push("the sign is inside the house"); }
    if (["tank", "machine", "youngTrees", "shrubs", "flag", "fence", "boxPop"].includes(p.kind)) { const b = focusOf(p, cut); if (b && b.min[1] >= -0.05 && overlap(b, houseBox, 0.1)) problems.push(`part ${p.id} is inside the house`); }
    // panels (liners, clay, walls) in the cut must not stick up out of the ground
    if (p.kind === "panels") for (const q of P.panels ?? []) { if (!Array.isArray(q.size) || !Array.isArray(q.pos)) { problems.push(`part ${p.id}: panel ${q.ch} needs size and pos`); continue; } const a = q.anchor ?? [0, 0, 0], top = q.pos[1] + (a[1] * Math.abs(q.size[1])) / 2 + Math.abs(q.size[1]) / 2, inCut = q.pos[0] > cut.x0 - 0.6 && q.pos[0] < cut.x1 + 0.6 && q.pos[2] > cut.z0 - 0.6; if (inCut && top > 0.6) problems.push(`part ${p.id}: panel ${q.ch} reaches y = ${top.toFixed(1)}, above the ground (anchor [0, 1, 0] grows UP from pos; to grow down from the surface use anchor [0, -1, 0] with pos y = 0)`); }
    for (const [k, v] of Object.entries(P)) if (/mat$/i.test(k) && typeof v === "string" && v === "") problems.push(`part ${p.id}: empty ${k}`);
  }
  for (const s of L.audio?.sfx ?? []) if (!LIBS.includes(s.lib)) problems.push(`audio.sfx: no library sound "${s.lib}" (use ${LIBS.join(", ")})`);
  if (!L.parts.some((p) => p.kind === "sign")) problems.push("no sign part (the end card)");
  if (!L.parts.some((p) => p.kind === "light")) warnings.push("no light part");
  if (!L.parts.some((p) => p.kind === "dig")) problems.push("no dig part (the cut is never dug)");
  // beats: verbs exist, parts exist, every part is used, every sentence has something
  let ex = null;
  try { ex = expandBeats(L); } catch (e) { problems.push(e.message); }
  const used = new Set((L.beats ?? []).flatMap((b) => (b.do ?? []).map((a) => a.p)));
  for (const p of L.parts) if (!used.has(p.id) && !["box", "light", "sign", "pipeFlow"].includes(p.kind) && Object.keys(VERBS[p.kind] ?? {}).length) warnings.push(`part ${p.id} is never animated`);
  const roles = new Set(sentences.map((s) => s.role));
  for (const b of L.beats ?? []) if (!roles.has(b.s)) problems.push(`beat ${b.s}: the script has no sentence with that role`);
  for (const s of sentences) { const b = (L.beats ?? []).find((x) => x.s === s.role); if (!b || (!(b.do ?? []).length && !b.shot && !(b.shots ?? []).length)) warnings.push(`sentence ${s.role} has nothing new on screen`); }
  const name = (L.beats ?? []).find((b) => b.s === "name");
  if (!name) problems.push('no beat for the "This is a…" sentence (role name)');
  else if (![name.shot, ...(name.shots ?? [])].some((s) => s?.hero)) warnings.push("the name beat has no hero shot");
  // the format check and a dry compile on draft word times (catches words that are not in their sentence)
  if (ex) {
    for (const p of validateLayout({ ...L, cues: [...(L.cues ?? []), ...ex.cues], shots: ex.shots })) problems.push(p);
    try {
      const words = draftWords(sentences);
      const tl = compile(L, words, words.at(-1).e + 0.1, { roles: sentences.map((s) => s.role) });
      for (const f of tl.director?.frames ?? []) if (!f.ok) (f.hero && f.why.some((w) => /wide$/.test(w)) ? problems : warnings).push(`shot at ${f.t.toFixed(1)} s (${f.ids}): ${f.why.join(", ")}`);
      for (const n of tl.director?.notes ?? []) warnings.push(`camera: ${n}`);
      // the props on the lawn: overlap each other above ground
      const above = L.parts.filter((p) => ["tank", "machine", "flag", "sign", "boxPop", "shrubs"].includes(p.kind)).map((p) => ({ id: p.id, b: focusOf(p, cut) })).filter((x) => x.b && x.b.min[1] >= -0.05);
      for (let i = 0; i < above.length; i++) for (let j = i + 1; j < above.length; j++) if (overlap(above[i].b, above[j].b, 0.1)) warnings.push(`${above[i].id} and ${above[j].id} overlap on the lawn (fine only if they are never on screen together)`);
      return { problems, warnings, timeline: tl };
    } catch (e) { problems.push(e.message.replace(/^layout [^:]+: /, "")); }
  }
  return { problems, warnings };
}

export { union };
