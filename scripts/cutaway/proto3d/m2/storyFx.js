// M2: what the narration says, happening on screen, for every topic (the owner's rules of 2026-11-05). Run by the
// compiler on each compile (the same layout object, so the page gets the parts it adds; idempotent: what it added
// before is taken out first, marked auto).
//   1. every event word happens: a word like "blast", "cracks", "floods" with nothing happening on screen at it gets
//      its effect there (kit/fx.js), on the part the sentence shows ("A blast" showed nothing in the real bunker run)
//   2. the "Add ..." line: each thing it adds pops in on its own word, one by one, and stays (the words come from the
//      line itself, so the voice says each one)
//   3. never a still moment (motionGaps, after timing): a stretch of more than GAP seconds with nothing moving gets life:
//      the shown part's own motion again, or slow drifting specks round it
import { focusOfId } from "./focus.js";
import { channelValue } from "./curves.js";

/** event words -> the effect (kit/fx.js) that shows them; a one-shot plays "go", a state "start"s */
export const EVENTS = [
  { re: /^(blast|blasts|explode|explodes|exploded|explosion|explosions|boom|detonates?)$/, type: "blast" },
  { re: /^(crash|crashes|crashed|smash|smashes|smashed|slams?|collides?|snaps?|snapped|breaks?|broke|bursts?|shatters?|shattered)$/, type: "crash" },
  { re: /^(crack|cracks|cracked|cracking|splits?)$/, type: "crack" },
  { re: /^(collapses?|collapsed|crumbles?|crumbled|caves?)$/, type: "collapse" },
  { re: /^(burns?|burning|burned|burnt|ablaze|blaze|ignites?)$/, type: "fire" },
  { re: /^(smoke|smokes|smoking|smoky|fumes)$/, type: "smoke" },
  { re: /^(floods?|flooded|flooding|splash|splashes|spills?|spilled|gush|gushes|sprays?|overflows?)$/, type: "splash" },
  { re: /^(leaks?|leaked|leaking|drips?|dripping|seeps?|seeping|melts?|melted|melting)$/, type: "drip" },
  { re: /^(sparks?|sparking|zaps?|shorts?)$/, type: "spark" },
  { re: /^(freezes?|freezing|frozen|froze|frost|frosts)$/, type: "frost" },
  { re: /^(spins?|spinning|spun|whirls?|whirling|rotates?|rotating)$/, type: "swirl" },
];
const ONE_SHOT = new Set(["blast", "crash", "crack", "collapse"]);
// not things the "Add ..." line adds: gauges, arrows, flows and the scene's switches
const DRESSING = new Set(["counter", "arrows", "outline", "flow", "pipeFlow", "pipeRunFlow", "seepFlow", "light", "rain", "sign", "fx", "lawnWet", "soak", "bubbles"]);
// words for the same thing (an item word -> words a part's id, kind or name may use)
const SAME = { light: ["lamp", "bulb"], lamp: ["light"], grass: ["lawn", "turf", "sod", "cap"], lawn: ["grass"], bush: ["shrub"], shrub: ["bush"], plant: ["shrub", "bush", "flower"], tree: ["young"], step: ["stair"], stair: ["step", "ladder"], seat: ["bench"], bench: ["seat"], cover: ["lid", "cap"], lid: ["cover", "cap"], gate: ["door"], door: ["gate", "hatch"], pan: ["pot"], pot: ["pan"] };
const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "");
const tokens = (text) => String(text ?? "").split(/\s+/).filter(Boolean);
const AUTO = (id) => /^auto_/.test(String(id));
// the things that move by themselves while on (a still moment has none of these on and no ramp playing)
const MOVERS = { ambient: ["on"], waterBody: ["flow"], rain: ["on"], stream: ["on"], flow: ["on"], pipeFlow: ["on"], pipeRunFlow: ["on"], seepFlow: ["on"], arrows: ["on"], bubbles: ["on"], fx: ["on"], creek: ["*"] };
const RIG_MOVING = new Set(["spin", "flow", "pump", "shake", "burn", "blink"]);
export const GAP = 2.5;

function strip(layout) {
  layout.parts = layout.parts.filter((p) => !AUTO(p.id));
  for (const b of layout.beats ?? []) b.do = (b.do ?? []).filter((a) => !a.auto && !AUTO(a.p));
  for (const b of layout.beats ?? []) for (const a of b.do) if (a.autoW) { a.w = a.autoW.w0; if (a.autoW.o0 != null) a.o = a.autoW.o0; delete a.autoW; }
}

/** where an effect goes on what the sentence shows: its front, at the top for a blast or fire, the middle otherwise */
function spot(layout, beat, type) {
  const byId = new Map(layout.parts.map((p) => [p.id, p])), cut = layout.world?.cut ?? null;
  const ids = [beat.shows?.p, ...(beat.do ?? []).map((a) => a.p), ...layout.parts.filter((p) => p.main).map((p) => p.id)].filter(Boolean);
  let box = null, boxId = null;
  for (const id of ids) { try { box = focusOfId(byId, id, cut); } catch { box = null; } if (box) { boxId = id; break; } }
  // (a designed machine is a closed box with a lid: a splash, frost, sparks or specks on its top sat on the lid, outside
  // it; the dishwasher's "sprays" put water blobs on the lid, the real run of 2026-11-10. In a machine they go in the
  // middle of it, where its works are; a blast, fire and smoke still rise from the top)
  const inMachine = byId.get(String(boxId ?? "").split(".")[0])?.kind === "rig" && ["splash", "frost", "spark", "motes", "swirl"].includes(type);
  if (!box && cut) box = { min: [cut.x0, -cut.depth, cut.z0], max: [cut.x1, 0, 0] };
  if (!box) box = { min: [-1, 0, -2], max: [1, 2, 0] };
  const c = box.min.map((v, i) => (v + box.max[i]) / 2), w = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1]);
  const size = +Math.min(3.5, Math.max(0.5, w * 0.22)).toFixed(2), front = +(box.max[2] + 0.05).toFixed(2);
  // (on its top: a blast, fire, a splash, frost on a surface, specks in the air; frost in the soil under an ice rink read as
  // nothing, 2026-11-05)
  const y = inMachine ? c[1] : ["blast", "fire", "smoke", "spark", "swirl", "frost", "splash", "motes"].includes(type) ? box.max[1] : type === "drip" ? box.max[1] - (box.max[1] - box.min[1]) * 0.25 : c[1];
  return { at: [+c[0].toFixed(2), +Math.max(y, box.min[1]).toFixed(2), front], size };
}

/** 1 + 2 on the layout (mutated); returns notes and counts */
export function storyFx(layout, sentences) {
  const notes = [], stats = { events: 0, finish: 0, finishDropped: 0 };
  if (!layout?.parts || !Array.isArray(layout.beats) || !sentences?.length) return { notes, stats };
  strip(layout);
  const textOf = (role) => sentences.find((s) => s.role === role)?.text ?? "";
  const kinds = new Map(layout.parts.map((p) => [p.id, p.kind]));
  // the words of the topic's own name (its title and key: "How a smoke detector works", smoke_detector)
  const topicWords = new Set(tokens(`${layout.title ?? ""} ${String(layout.key ?? "").replace(/_/g, " ")}`).map(clean).filter((w) => w.length > 2 && !/^(how|works?|the|and|your|you)$/.test(w)));
  let n = 0;
  // 2. the finish line first (its items name parts the events must not double)
  const fin = layout.beats.find((b) => b.s === "finish");
  if (fin) {
    const words = tokens(textOf("finish")), low = words.map(clean);
    // (the things it adds: not a gauge or arrows shown for a moment, nor anything it shows and hides again on the same
    // line: the bunker rerun's decay counter took the word "light" from the lamp)
    const hidden = new Set((fin.do ?? []).filter((a) => /^(hide|gone|stop|leave)$/.test(a.v)).map((a) => a.p));
    const adds = (fin.do ?? []).filter((a) => !hidden.has(a.p) && !DRESSING.has(kinds.get(a.p)) && (/^(show|build|grow|arrive|pop|fill|open|appear)$/.test(a.v) || (kinds.get(a.p) === "rig" && !/Back$/.test(a.v))));
    // the items: the line after "Add", split on commas and "and" (each a few words)
    const start = low.indexOf("add") + 1, items = []; let cur = [];
    for (let i = Math.max(0, start); i < words.length; i++) { const w = low[i]; if (w === "and" || w === "plus" || w === "then") { if (cur.length) items.push(cur); cur = []; continue; } cur.push(i); if (/[,;]$/.test(words[i])) { items.push(cur); cur = []; } }
    if (cur.length) items.push(cur);
    const nameOf = (a) => { const p = layout.parts.find((q) => q.id === a.p); const node = p?.kind === "rig" ? (p.params?.nodes ?? []).find((n) => (n.moves ?? []).some((m) => m.name === a.v)) : null; return [a.p, a.v, p?.kind, p?.params?.name, node?.id, ...(p?.params?.synonyms ?? [])].filter(Boolean).join(" ").toLowerCase().replace(/([a-z])([A-Z])/g, "$1 $2"); };
    const used = new Set(), taken = new Map();
    // each added thing on the item that names it (its words in the thing's id, kind, name or the node it moves)
    for (const a of adds) {
      const nm = nameOf(a).toLowerCase();
      let best = -1, score = 0;
      items.forEach((it, k) => { const sc = it.filter((i) => low[i].length > 2 && (nm.includes(low[i].replace(/s$/, "")) || (SAME[low[i].replace(/s$/, "")] ?? []).some((x) => nm.includes(x)))).length; if (sc > score && !used.has(k)) { score = sc; best = k; } });
      if (best >= 0) { used.add(best); taken.set(a, best); }
    }
    // what is left goes on the items left, in order, then (more things than items) on the last item: nothing is taken
    // out (it may be what the line shows), the count of things the line never names is reported
    const freeItems = items.map((_, k) => k).filter((k) => !used.has(k));
    for (const a of adds) if (!taken.has(a)) { if (freeItems.length) taken.set(a, freeItems.shift()); else if (items.length) { taken.set(a, items.length - 1); stats.unnamed = (stats.unnamed ?? 0) + 1; } }
    // several things on one item ("the grass back on top": a cap and its grass) share its word
    for (const a of adds) {
      if (!taken.has(a)) continue;
      const it = items[taken.get(a)], head = it.filter((i) => low[i].length > 2 && !/^(the|a|an|some|its|back|on|top|of|with)$/.test(low[i])).pop() ?? it[it.length - 1];
      const w = words[head].replace(/[^A-Za-z0-9'-]/g, "");
      // (on its word itself: a planner's lead of 0.7 s before it put two things on one moment)
      if (a.w !== w || Number(a.o) < 0) { a.autoW = { w0: a.w, o0: a.o }; a.w = w; delete a.o; n++; }
    }
    if (stats.unnamed) notes.push(`finish: ${stats.unnamed} added thing(s) share an item word (the line names fewer things than it adds)`);
    // what the line adds stays: no later hide of it
    const addedIds = new Set(adds.map((a) => a.p));
    for (const b of layout.beats.slice(layout.beats.indexOf(fin) + 1)) b.do = (b.do ?? []).filter((a) => !(addedIds.has(a.p) && /^(hide|gone|leave)$/.test(a.v)));
    stats.finish = n; if (n) notes.push(`finish: ${n} added thing(s) moved onto the word that names them`);
  }
  // 1. the event words
  let k = 0;
  for (const b of layout.beats) {
    const words = tokens(textOf(b.s)), low = words.map(clean);
    if (!words.length) continue;
    // the words something already happens on (an action's cue word), and its neighbours
    const hit = new Set();
    for (const a of b.do ?? []) { const i = a.w ? low.indexOf(clean(a.w)) : 0; if (i >= 0) for (const j of [i - 1, i, i + 1]) hit.add(j); }
    const seen = new Set();
    low.forEach((w, i) => {
      const ev = EVENTS.find((e) => e.re.test(w));
      if (!ev || seen.has(ev.type) || hit.has(i)) return;
      // (a word of the topic's own name is the thing, not an event: "smoke" in "smoke detector", "flood" in "flood
      // light", "fire" in "fire hydrant"; the owner's list of 2026-11-07)
      if (topicWords.has(w) && (topicWords.has(low[i + 1]) || topicWords.has(low[i - 1]))) return;
      // (said as not happening: "That flame is not garbage burning" in the landfill myth line)
      if (low.slice(Math.max(0, i - 3), i).some((x) => /^(not|no|never|nothing|without)$|n't$/.test(x))) return;
      // (a condition, not an event: "gas only burns when it meets air" put fire on a cold burner)
      if (low.slice(Math.max(0, i - 3), i).includes("only") || low.slice(i + 1, i + 4).some((x) => /^(when|if|unless|once)$/.test(x))) return;
      // (a word the beat's own verbs or parts already name: "cracks" with a crack part growing, "burns" with a flame burning)
      const named = (b.do ?? []).some((a) => { const kd = kinds.get(a.p) ?? ""; return new RegExp(ev.type === "splash" ? "flood|water|splash|spray" : ev.type === "drip" ? "drip|leak|seep|drop|melt" : ev.type === "fire" ? "burn|fire|flame|ignite" : ev.type === "swirl" ? "spin|turn|rotat" : ev.type, "i").test(`${a.v} ${a.p} ${kd}`); });
      if (named) return;
      seen.add(ev.type);
      // (a leak of gas, air, steam or fumes is a puff of smoke, not water drops)
      const type = ev.type === "drip" && low.some((x) => /^(gas|air|steam|fumes?|vapou?r|smoke)$/.test(x)) ? "smoke" : ev.type;
      const id = `auto_fx${++k}`, { at, size } = spot(layout, b, type);
      // (water in a planned video as droplets, not blue balls: the owner on the dishwasher run, 2026-11-10; a premade
      // video keeps its approved look)
      layout.parts.push({ id, kind: "fx", params: { type, at, size, ...(["splash", "drip"].includes(type) && layout.approved !== true ? { look: "drops" } : {}) } });
      b.do.push({ p: id, v: ONE_SHOT.has(type) ? "go" : "start", w: words[i].replace(/[^A-Za-z0-9'-]/g, ""), auto: true });
      // a state stops when the build fixes it: at the next sentence that is a fix (or the finish)
      if (!ONE_SHOT.has(type)) { const nb = layout.beats.slice(layout.beats.indexOf(b) + 1).find((x) => /^(fix|finish|name|congrats)/.test(x.s)); if (nb) nb.do.push({ p: id, v: "stop", auto: true }); }
      stats.events++; notes.push(`${b.s}: "${words[i]}" happens on screen (${ev.type})`);
    });
  }
  return { notes, stats };
}

/**
 * 3. the still moments, after timing: stretches of more than GAP s (within the narration) where no ramp plays and
 * nothing moving is on. Each gets life: the shown rig's own moving move played again, or drifting specks round it.
 * Returns the extra parts (pushed onto the layout) and the ramps to add to the tracks.
 */
export function motionGaps(layout, tracks, sentences, { from = 0, to = null } = {}) {
  const end = to ?? sentences.at(-1)?.t1 ?? 0, kind = new Map(layout.parts.map((p) => [p.id, p]));
  const isMover = (key) => {
    const [id, ch] = key.split("."), p = kind.get(id); if (!p) return false;
    if (p.kind === "rig") return (p.params?.nodes ?? []).some((n) => (n.moves ?? []).some((m) => m.name === ch && RIG_MOVING.has(m.type)));
    const M = MOVERS[p.kind]; return !!M && (M.includes("*") || M.includes(ch));
  };
  const moving = (t) => Object.entries(tracks).some(([key, tr]) => tr.ramps.some((r) => t >= r.t0 - 0.05 && t <= Math.max(r.t1 ?? r.t0, r.t0 + 0.5) + 0.05) || (isMover(key) && channelValue(tr, t) > 0.05));
  const gaps = []; let g0 = null;
  for (let t = from; t <= end + 1e-6; t += 0.25) { if (!moving(t)) { if (g0 == null) g0 = t; } else { if (g0 != null && t - g0 > GAP) gaps.push([g0, t]); g0 = null; } }
  if (g0 != null && end - g0 > GAP) gaps.push([g0, end]);
  return gaps;
}

/**
 * The life a still moment gets, from the scene itself: "steam" over a real flame (a burner, a flare, a fire; not a heating move: a fridge compressor has one),
 * "ripple:<id>" on open water, "hum" (a machine idling: the shown designed part trembles), "breeze" (outdoors: trees and
 * bushes sway), "dust" (specks, only where dust is real: a workshop or a basement room).
 */
export function ambientFor(layout, beat) {
  const parts = layout.parts ?? [], W = layout.world ?? {};
  const shown = parts.find((p) => p.id === String(beat?.shows?.p ?? "").split(".")[0]) ?? parts.find((p) => p.main);
  const setting = W.backdrop?.type ?? "yard", indoor = ["room", "kitchen", "workshop", "carwash", "garage"].includes(setting);
  const hot = (p) => p && (p.kind === "flare" || (p.kind === "fx" && p.params?.type === "fire") || (p.kind === "rig" && (p.params?.nodes ?? []).some((n) => (n.moves ?? []).some((m) => m.type === "burn") || (n.shapes ?? []).some((s) => s.shape === "flame"))));
  if (hot(shown)) return "steam";
  const water = parts.find((p) => p.kind === "waterBody");
  if (water && !indoor) return `ripple:${water.id}`;
  if (shown?.kind === "rig") return "hum";
  if (!indoor) return "breeze";
  if (setting === "workshop" || setting === "room") return "dust";
  return "hum";
}

/** fill the gaps (the layout and tracks mutated); returns notes */
export function fillGaps(layout, tracks, sentences, gaps) {
  const notes = [];
  gaps.forEach(([a, b], i) => {
    const s = sentences.find((x) => x.t0 <= (a + b) / 2 && x.t1 >= (a + b) / 2) ?? sentences.find((x) => x.t1 >= a) ?? sentences.at(-1);
    const beat = (layout.beats ?? []).find((x) => x.s === s?.role) ?? {};
    // the shown rig's own moving move, if it has one it already plays in the story: again, through the gap
    const rig = layout.parts.find((p) => p.id === String(beat.shows?.p ?? "").split(".")[0] && p.kind === "rig") ?? layout.parts.find((p) => p.main && p.kind === "rig");
    const move = rig && (rig.params?.nodes ?? []).flatMap((n) => n.moves ?? []).find((m) => RIG_MOVING.has(m.type) && tracks[`${rig.id}.${m.name}`]?.ramps.some((r) => r.t0 < a));
    if (move) {
      const key = `${rig.id}.${move.name}`, now = channelValue(tracks[key], a);
      if (now < 0.5) { tracks[key].ramps.push({ t0: a + 0.2, t1: a + 0.5, amp: 1, e: "inOut", auto: true }, { t0: b - 0.3, t1: b, amp: -1, e: "inOut", auto: true }); notes.push(`still ${a.toFixed(1)}-${b.toFixed(1)} s: ${key} runs again`); return; }
    }
    // motion that belongs in the scene (the owner, 2026-11-10: dust specks read as stray floating dots; specks only where
    // dust is real, a workshop or a basement room, and subtle)
    const on = (key) => { tracks[key] = tracks[key] ?? { base: 0, ramps: [] }; tracks[key].ramps.push({ t0: a + 0.2, t1: a + 0.6, amp: 1, e: "inOut", auto: true }, { t0: b - 0.2, t1: b + 0.3, amp: -1, e: "inOut", auto: true }); };
    const mode = ambientFor(layout, beat), id = `auto_life${i + 1}`, { at, size } = spot(layout, beat, mode === "steam" ? "smoke" : "motes");
    // (a premade video keeps the life it was approved with: the drifting specks of the live worker, as they were. Premade =
    // approved: true, set by the worker for a saved approved layout; every planned layout has template: true, so that flag
    // is no premade marker)
    if (layout.approved === true) { layout.parts.push({ id, kind: "fx", params: { type: "motes", at, size: Math.max(size, 1) } }); tracks[`${id}.go`] = { base: 0, ramps: [] }; on(`${id}.on`); notes.push(`still ${a.toFixed(1)}-${b.toFixed(1)} s: specks (premade, as approved)`); return; }
    if (mode.startsWith("ripple:")) { const w = mode.slice(7); on(`${w}.flow`); notes.push(`still ${a.toFixed(1)}-${b.toFixed(1)} s: the water ripples (${w})`); return; }
    if (mode === "dust") { layout.parts.push({ id, kind: "fx", params: { type: "motes", at, size: Math.min(size, 0.7) } }); tracks[`${id}.go`] = { base: 0, ramps: [] }; }
    else layout.parts.push({ id, kind: "ambient", params: { mode, target: String(beat.shows?.p ?? layout.parts.find((p) => p.main)?.id ?? "").split(".")[0] || null, at, size } });
    on(`${id}.on`);
    notes.push(`still ${a.toFixed(1)}-${b.toFixed(1)} s: ${mode} round ${beat.shows?.p ?? "the build"}`);
  });
  return notes;
}
