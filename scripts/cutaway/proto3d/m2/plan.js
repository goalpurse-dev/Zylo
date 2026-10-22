// M2: the planner's reply shapes (JSON schemas for structured outputs) and their conversion to and from layouts.
// Structured outputs need every object closed and every field listed, so free-form settings travel as JSON text
// (paramsJson) and "not set" is an empty string or 0.
import { KIND_CHANNELS } from "./parts.js";
import { homeView, projectBox, SHOTS } from "./director.js";
import { placeLifeProps } from "./framing.js";

export const ROLES = ["hook", "problem", "flood", "stakes", "fix1", "fix2", "fix3", "fix4", "name", "name2", "how", "fact", "factProof", "problem2", "problem3", "fix5", "myth", "mythFact", "finish", "congrats"];
export const VIEWS = ["home", "high", "low", "front", "side", "close"];
export const SHOT_TYPES = Object.keys(SHOTS);

const obj = (properties) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const str = { type: "string" }, num = { type: "number" }, int = { type: "integer" }, bool = { type: "boolean" };
const arr = (items) => ({ type: "array", items });

export const SCRIPT_SCHEMA = obj({
  title: str, hero: str,
  sentences: arr(obj({ role: { type: "string", enum: ROLES }, text: str })),
  surprises: arr(obj({ claim: str, sentence: int, search: str })),
  cards: arr(obj({ text: str, sentence: int, word: str })),
  parts: arr(str),
});

export const FACTS_SCHEMA = obj({
  checks: arr(obj({ index: int, verdict: { type: "string", enum: ["keep", "reword", "drop"] }, claim: str, why: str, sources: arr(obj({ url: str, title: str })) })),
  sentences: arr(obj({ role: { type: "string", enum: ROLES }, text: str })),
  cards: arr(obj({ text: str, sentence: int, word: str })),
});

const ACTION = obj({ p: str, v: str, w: str, o: num, d: num, amp: num, ch: str });
// (no enums in the scene schema: the grammar would be too large; the solver checks kinds, roles and views)
const SHOT = obj({ focus: arr(str), view: str, width: num, type: str, hero: bool, word: str, box: arr(num) });
const AT = obj({ s: str, w: str, o: num });
// the scene reply: the layout as JSON text (a full schema compiles to a grammar the API refuses as too large)
export const SCENE_REPLY_SCHEMA = obj({ why: str, sceneJson: str });
export const SCENE_SCHEMA = obj({
  why: str,
  world: obj({ cut: arr(num), house: arr(num), porch: bool, trees: arr(arr(num)), road: arr(num), rocksAvoid: arr(arr(num)) }),
  parts: arr(obj({ id: str, kind: str, paramsJson: str, baseJson: str })),
  beats: arr(obj({ s: str, do: arr(ACTION), shots: arr(SHOT) })),
  audio: obj({ cards: arr(obj({ text: str, at: AT, d: num })), sfx: arr(obj({ lib: str, at: AT, d: num })), chimes: arr(AT), rain: arr(AT) }),
});

const anchor = (a) => { const o = {}; o.s = a.s; if (a.w) o.w = a.w; if (a.o) o.o = a.o; return o; };

/** a planner scene reply -> a layout (problems in parsing are collected, not thrown) */
export function layoutFromScene(scene, { key, title, roles }) {
  const problems = [];
  const json = (t, what) => { if (!t) return {}; try { return JSON.parse(t); } catch (e) { problems.push(`${what}: bad JSON (${e.message.slice(0, 60)})`); return {}; } };
  if (!scene?.world?.cut || !Array.isArray(scene.parts) || !Array.isArray(scene.beats) || !scene.audio) return { layout: { key, title, roles, world: { cut: {} }, parts: [], cues: [], beats: [], audio: {} }, problems: [`the scene needs world.cut, parts, beats and audio${scene?._bad ? ` (sceneJson is not JSON: ${scene._bad})` : ""}`] };
  const [x0, x1, z0, depth] = scene.world.cut;
  const world = { cut: { x0, x1, z0, depth } };
  if (scene.world.house === false) world.house = false; else if (scene.world.house?.length === 3) world.house = scene.world.house;
  // the yard's worker figure only when asked for (he stood in the frame of other topics' shots)
  if (scene.world.worker !== true) world.worker = false;
  if (scene.world.moreTrees === false) world.moreTrees = false;
  if (scene.world.road === false) world.road = false;
  if (scene.world.backdrop && ["street", "park"].includes(scene.world.backdrop.type)) world.backdrop = scene.world.backdrop;
  else if (scene.world.backdrop) problems.push(`world.backdrop type "${scene.world.backdrop.type}": use street or park, or leave it out for the yard`);
  if (scene.world.porch === false) world.porch = false;
  if (scene.world.trees?.length === 2) world.trees = scene.world.trees;
  if (Array.isArray(scene.world.road) && scene.world.road.length === 3) world.road = scene.world.road;
  if (scene.world.rocksAvoid?.length) { world.rocksAvoid = scene.world.rocksAvoid; world.roots = { pad: 0.8, to: Math.max(7, x1 + 2) }; }
  const parts = (scene.parts ?? []).map((p) => { const out = { id: p.id, kind: p.kind, params: p.params ?? json(p.paramsJson, `part ${p.id} params`) }; if (p.main) out.main = true; const base = p.base ?? json(p.baseJson, `part ${p.id} base`); if (base && Object.keys(base).length) out.base = base; return out; });
  const beats = scene.beats.map((b) => ({
    s: b.s,
    do: (b.do ?? []).map((a) => { const o = { p: a.p, v: a.v }; if (a.w) o.w = a.w; if (a.o) o.o = a.o; if (a.d) o.d = a.d; if (a.amp && a.amp !== 1) o.amp = a.amp; if (a.ch) o.ch = a.ch; return o; }),
    shots: (b.shots ?? []).map((s) => {
      const o = (s.focus ?? []).includes("home") ? { focus: "home" } : s.box?.length === 6 ? { box: { min: s.box.slice(0, 3), max: s.box.slice(3) } } : { focus: s.focus };
      if (s.view && s.view !== "home") { if (VIEWS.includes(s.view)) o.view = s.view; else problems.push(`shot view "${s.view}": use one of ${VIEWS.join(", ")}`); } if (s.width) o.width = s.width; if (s.type) { if (SHOT_TYPES.includes(s.type)) o.type = s.type; else problems.push(`shot type "${s.type}": use one of ${SHOT_TYPES.join(", ")}`); } if (s.hero) o.hero = true; if (s.word) o.at = { s: b.s, w: s.word };
      return o;
    }),
  }));
  const A = { cards: [], sfx: [], chimes: [], rain: [], ...scene.audio };
  const audio = {
    cards: A.cards.map((c) => ({ text: c.text, at: anchor(c.at), d: c.d || 1.8 })),
    sfx: A.sfx.map((c) => ({ lib: c.lib, at: anchor(c.at), d: c.d || 1.3 })),
    chimes: A.chimes.map(anchor),
    ...(A.rain.length === 2 ? { rain: { from: anchor(A.rain[0]), to: anchor(A.rain[1]), underDb: 24 } } : {}),
  };
  const raw = { key, title, template: true, roles, world, parts, cues: [], beats, audio };
  // the side-story props (a flag, a book, a newspaper) stand beside the action, inside the home frame
  const placed = placeLifeProps(raw, homeView(raw), projectBox);
  return { layout: placed.layout, problems, moved: placed.moved };
}

/** a layout template -> the planner's scene shape (the worked example in the prompt) */
export function sceneFromLayout(L) {
  const at = (a) => ({ s: a.s, w: a.w ?? "", o: a.o ?? 0 });
  return {
    why: `${L.title}: the saved layout.`,
    world: { cut: [L.world.cut.x0, L.world.cut.x1, L.world.cut.z0, L.world.cut.depth], house: L.world.house ?? [], porch: L.world.porch !== false, trees: L.world.trees ?? [], road: L.world.road ?? [], rocksAvoid: L.world.rocksAvoid ?? [], ...(L.world.backdrop ? { backdrop: L.world.backdrop } : {}), ...(L.world.worker === false ? { worker: false } : {}), ...(L.world.moreTrees === false ? { moreTrees: false } : {}) },
    parts: L.parts.map((p) => ({ id: p.id, kind: p.kind, params: p.params ?? {}, ...(p.base ? { base: p.base } : {}) })),
    beats: L.beats.map((b) => ({
      s: b.s,
      do: (b.do ?? []).map((a) => ({ p: a.p, v: a.v, w: a.w ?? "", o: a.o ?? 0, d: a.d ?? 0, amp: a.amp ?? 1, ch: a.ch ?? "" })),
      shots: [b.shot, ...(b.shots ?? [])].filter(Boolean).map((s) => ({ focus: s.focus === "home" ? ["home"] : s.focus ?? [], view: typeof s.view === "string" ? s.view : "home", width: s.width ?? 0, type: s.type ?? "", hero: !!s.hero, word: s.at?.w ?? "", box: s.box ? [...s.box.min, ...s.box.max] : [] })),
    })),
    audio: { cards: (L.audio.cards ?? []).map((c) => ({ text: c.text, at: at(c.at), d: c.d ?? 1.8 })), sfx: (L.audio.sfx ?? []).map((c) => ({ lib: c.lib, at: at(c.at), d: c.d ?? 1.3 })), chimes: (L.audio.chimes ?? []).map(at), rain: L.audio.rain ? [at(L.audio.rain.from), at(L.audio.rain.to)] : [] },
  };
}

/** fake word times from a script (0.3 s a word, 0.25 s between sentences), to check a plan before the voice exists */
export function draftWords(sentences) {
  const words = []; let t = 0;
  for (const s of sentences) { for (const w of s.text.split(/\s+/).filter(Boolean)) { words.push({ w, s: +t.toFixed(3), e: +(t + 0.27).toFixed(3) }); t += 0.3; } t += 0.25; }
  return words;
}
