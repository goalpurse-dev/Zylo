// M2: the automatic planner. Topic -> script -> fact-check (web search) -> scene plan (a new layout, or a saved
// layout's beats mapped onto the new script) -> layout solver -> one repair round. Sonnet 5.5 by default.
// Every step's reply and problems are kept in the trace for reading afterwards.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { callJSON, MODEL } from "./llm.mjs";
import { catalogText } from "./catalog.js";
import { FACTS_SCHEMA, layoutFromScene, ROLES, SCENE_REPLY_SCHEMA, SCRIPT_SCHEMA, sceneFromLayout } from "./plan.js";
import { solveLayout } from "./solver.js";
import { homeView, projectBox } from "./director.js";
import { placeLifeProps } from "./framing.js";
import { VERBS } from "./verbs.js";
import { classifyTopic, normTopic, PREMADE, premadeByKey } from "../../../../supabase/functions/_shared/cutaway/topics.js";
import { focusOf, union } from "./focus.js";
import { KIND_DOCS } from "./catalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// a saved layout, with its side-story props moved beside the cut (the same rule as a new layout; deterministic)
const template = (k) => { const L = JSON.parse(fs.readFileSync(path.join(here, "layouts", `${k}.template.json`), "utf8")); return placeLifeProps(L, homeView(L), projectBox).layout; };
const roleScript = (L, words) => words; // (kept for symmetry; scripts carry their roles)

export const LENGTH = { 30: { words: [100, 125], sentences: [10, 13] }, 60: { words: [200, 240], sentences: [18, 24] } };

const EXAMPLES = [
  { topic: "a French drain", roles: template("french_drain").roles, text: "If you dig a ditch along your house, you have a drain. | But one inch of rain on a small roof dumps over 600 gallons right by your walls. | The ditch floods. | Five feet down, that water pushes over 300 pounds on each square foot, and the wall cracks. | So you fill the ditch with gravel, but the water still sits at the bottom. | So you lay a pipe full of holes under the gravel. | This is a French drain. | Water seeps in through the holes, and the pipe slopes downhill to carry it away. | Wrap the gravel in fabric so mud can't clog it. | And the French in French drain is not France. | It is Henry French, a New England farmer and judge who wrote the book on drains in 1859. | Add the grass back on top. | Congratulations, you have built a French drain." },
  { topic: "a landfill", roles: template("landfill").roles, text: "If you dig a pit and throw your trash in, you have a landfill. | But dirty trash juice leaks straight down into the groundwater you drink. | So you lay a thick clay base, but it is still not enough. | You add a thick black plastic sheet. | This is a landfill liner. | A pipe drains the collected juice into a tank beside the pit. | Sealed this tight, trash barely rots at all once it is buried. | A 1952 newspaper dug up decades later was still readable word for word. | But trapped trash still makes gas, so a pipe carries it out. | That flame is not waste burning, it is gas making electricity nearby. | Add a grass cap, a fence, and a few young trees. | Congratulations, you have built a landfill." },
];

const SCRIPT_SYSTEM = `You write scripts for short cutaway explainer videos: a 3D diorama of a lawn and a house with the ground cut open in section, where a thing is built step by step while one narrator talks. Every sentence must be something the 3D kit can show happening: digging, pipes, tanks, fills (gravel, water, soil, clay), liners and covers, water or sludge flowing along a path, sand sinking and oil rising in a tank, a creek, rain, leaks and cracks, a car, simple machines (a pump box, a generator, a vending machine, a car wash arch, a traffic light, a hydrant, an ATM), props (a flag, a book, a newspaper, number cards). Never name a thing outside that list (no people doing things, no maps, no ice, no towers, no screens with text) and never compare two things that would both need to be drawn in a beat of their own. The account's formula:

HOOK      "If you [one naive physical action], you have a [thing]."
LOOPS     "But [a failure you can see: it floods, it stinks, it leaks, it cracks]." then "So you [add one real part, described physically, no jargon]."
NAME      "This is a [real term]." (exactly one sentence with role name; a second one, name2, only in 60 s videos)
MYTH-BUST "And [the thing everyone knows] is not [what they think]. It is [the mechanism]." (when a true one exists)
FINISH    "Add [two or three finishing touches]." then "Congratulations, you have built a [thing]."

Rules:
- Every sentence is something the viewer can SEE happen in the cut-open ground or on the lawn: dig, fill, pour, lay a pipe, water rising, flowing, seeping, a crack, rain, a tank, a pump, a cap, grass, a fence. Nothing abstract, no people, no vehicles except a dump truck.
- Three or four surprises, each physical and concrete, ideally with a number ("dumps over 600 gallons", "pushes over 300 pounds on each square foot", "still readable"). One by about a third of the way in, one in the middle, the myth-bust near the end. Each surprise is a claim the fact-checker will search, so give a search query for it.
- Number cards: put 1-3 big numbers on screen as cards ("600 GALLONS", "300 LB", "1859", "37 YEARS"). The card's word must be a word of that sentence, exactly as written (for example the word "600").
- Plain words, sentences of 6-20 words, no run-ons, no lists of more than three, no questions, no "you might think". Present tense. American English, numbers as digits.
- Each sentence gets one role from the list; a role is used once. Order: hook first, congrats last, finish just before it, name after the loop that adds the named part.
- parts: the physical things the video will need to show (for the scene planner), plain nouns.`;

function scriptUser({ topic, lengthSec, roles, facts, keyWords }) {
  const L = LENGTH[lengthSec];
  return `Topic: ${topic}
Length: ${lengthSec} s video: ${L.words[0]}-${L.words[1]} words in ${L.sentences[0]}-${L.sentences[1]} sentences.
${roles ? `This topic re-uses a saved scene. Use exactly these roles, in this order, one sentence each: ${roles.join(", ")}.` : `Roles you may use: ${ROLES.join(", ")}.`}
${facts?.length ? `Use only these verified facts for the surprises (with their exact wording and numbers):\n${facts.map((f) => `- ${f}`).join("\n")}` : ""}
${keyWords ? `The saved scene animates on these words; use them in these sentences where it reads naturally:\n${Object.entries(keyWords).map(([r, ws]) => `- ${r}: ${ws.join(", ")}`).join("\n")}` : ""}

Two approved scripts by the account, sentence by sentence (| between sentences), with their roles:
${EXAMPLES.map((e) => `${e.topic} [${e.roles.join(", ")}]:\n${e.text}`).join("\n\n")}`;
}

const RESEARCH_SYSTEM = `You research the surprise claims in a short explainer script with web search. You MUST search for every claim (one or two searches each) before you answer; never answer from memory. For each claim, write what reliable sources say (engineering and government sources, manufacturers' guides, encyclopedias; not forums), with the exact figures and wording they use, and the URL of each source. Then say for each claim: supported as written, supported in a corrected form (give it), or not supported.`;

const FACTS_SYSTEM = `You fact-check the surprise claims in a short explainer script, with web search. For each claim:
- search for it (one or two searches), and read what reliable sources say (engineering and government sources, manufacturers' guides, encyclopedias, well-known references; not forums);
- verdict "keep" if sources support it as written; "reword" if the true version is close (change the wording and the numbers to exactly what the sources support, for example "New England" instead of "Massachusetts", "over 600 gallons" for a rounded figure); "drop" if it is false, unsupported, or a myth;
- list the sources you used (url and title) for keep and reword.
You are given research notes with sources found by web search: judge every claim ONLY from those notes (a claim the notes do not support is dropped), and copy the source URLs from the notes. Then return the whole script again with the claims fixed: reworded sentences changed, and a dropped claim's sentence rewritten without it (keep the role, keep it something visible). Keep every other sentence word for word. Return the number cards again too, fixed to the new wording (a card's word must still be a word of its sentence).`;

// the worked example is the other golden topic when the topic is itself a golden one (a fair remake)
const EXAMPLE_TITLE = { french_drain: "French drain", landfill: "landfill" };
const sceneSystem = (example = "french_drain") => `You plan the 3D scene and the animation of a cutaway explainer video, from its script, using ONLY the kit described below. You write a layout: the world change (the cut), the parts with their settings, and the beats: for each sentence (by its role), which kit verbs happen on which of its words, and the camera shots.

${catalogText()}

HOW TO PLAN
- Coordinates: the face of the cut is z = 0, facing the camera; things seen in section in the face sit at z near 0 (pipes in the face at z = -0.06, fills from z0 to z1 = 0). The ground surface is y = 0. The camera looks from +z, a little from the right and above.
- Choose the setting first (THE SETTING above): the yard only for things around a house; a street or a park when the topic lives there. Our videos should not all look alike.
- One cut (world.cut) holds the main build. Keep the house off the cut (move it back or aside with world.house). Pipes may run through the soil outside the cut, along the face.
- A part appears ON THE WORD THAT NAMES IT: put its verb on that word ("pipe", "gravel", "tank"). The dig is on "dig" in the hook.
- The explainer layer: arrows show where water or gas moves; a glowing outline traces the named part on the "This is a…" sentence (verb show on the named word, hide on the next sentence); flow dots run in pipes when water flows.
- A myth-bust ("X is not Y") must SHOW the wrong idea first, then take it away: a flag crossed out, a fake lake that drains or fades on "not", then the real mechanism appears on the next sentence. A sentence about something that is not there needs a visible stand-in for it.
- EVERY SENTENCE SHOWS ITS OWN ACTION: the thing the sentence names is on screen and visibly does the sentence's verb. Each beat has shows: {p: the id of the part that does it, does: the visible action in a few words}. Use the part made for the verb: flow for runs / pours / flows (its path goes from where the stuff starts to where it ends, e.g. across the slab into the drain, through the pipe, down into the creek), settle for sinks / floats / separates (sand grains fall to the floor, a dark oil layer rises), creek for a creek, river or stream (it must exist as a part, not a blue box), fills for filling up, pipes growing for laying a pipe. Arrows alone never show an action: they only point at one. A creek or anything else seen in section must lie inside the cut's x range (the solid soil face hides the rest); otherwise it is seen on the surface.
- IF THE KIT CANNOT SHOW A SENTENCE: rewrite that sentence so it says what the kit can show, keeping its numbers and facts and its length: sceneJson.rewrites [{role, text}]. The narration is recorded after your plan, so the rewrite is what is said.
- Something new every 2-3 s: every sentence has at least one action. Problems are visible (rain, flooding, a crack, a leak) and are fixed by the next part. By "Congratulations" the problem is gone: stop rain, clear the storm, hide arrows and flows, refill or cap the cut, add the finishing touches. The end is calm.
- Camera shots: about one per sentence, a fast move starts just before the sentence (or before the word in shot.word). focus is the ids of the parts to frame (["home"] = the home view). Size a shot by type, the shot vocabulary measured on the hand-built videos: wide (0.9 of the home distance), mid (0.7: most story shots), close (0.42: a crack, a newspaper, a machine's slot), detail (0.2: the holes in a pipe); or by width (how much of the frame width the parts fill: 0.3-0.5 for a prop, 0.6-1.0 for a long trench). Give type or width, not both. box (6 numbers: min x,y,z, max x,y,z) frames a region instead of parts. view: home (default), high (from above, for water on a surface), low (level, for a pipe in section), close (a detail on a wall); they all stay within 20 degrees of the home angle. The "This is a…" sentence's shot is hero: true (with a width). Congrats and finish are home shots.
- THE OPENING: the video opens close on its own hook object, never on the house. The hook beat's first shot (no word) frames the naive thing the hook line names, the thing a viewer already knows (the hole being dug, the machine's slot, the puddle at the wall, the car in the bay, the button), type close or mid. The home view comes later (the problem or how sentence) and at the end.
- THE MAIN SUBJECT: every shot keeps it in view (the cut, or the part you mark main: true when the story is a machine above ground); no shot of open lawn or sky. Side-story props (a flag, a book, a newspaper) stand beside the cut, just behind its back edge and inside the home frame, never out on the lawn. world.worker true only when the topic has a worker (by default there is none).
- Sound: library effects on events (digging, pouring, water rushing, dripping, flame, a pump hum), 3-5 of them; chimes on each number card, on the name sentence, and on "Congratulations"; cards on their number words. A rain bed (audio.rain: [from, to]) only when it rains.
- Reply with "why" and "sceneJson": the scene as JSON text with exactly the worked example's shape: {world: {cut: [x0, x1, z0, depth], house, porch, trees, road, rocksAvoid, backdrop?, worker?, moreTrees?}, parts: [{id, kind, params, base?}], beats: [{s, do: [...], shows: {p, does}, shots: [...]}], audio: {cards, sfx, chimes, rain}, rewrites?: [{role, text}]}. A part's base (optional) sets a channel's starting value. Numbers in world units.
- Verbs: an action is {p: part id, v: verb, w: the word in that sentence (as written, without punctuation; "" = the sentence start), o: seconds after the word (0), d: a duration to stretch the verb (0 = default), amp: 1, ch: "" (panels only: the panel channel)}.
- Reuse the worked example's settings when a part plays the same role (trench water, gravel with pebbles, soak pit, fabric, caps).
- In "why", say in two or three sentences what the scene is and how the camera tells it.

THE WORKED EXAMPLE: the approved ${EXAMPLE_TITLE[example]} video's layout, for its script:
${JSON.stringify(sceneFromLayout(template(example)))}`;
const SCENE_SYSTEM = sceneSystem();

// topics that happen inside a home go in the room setting (its cut below the floor is the basement)
export const INDOOR = /\b(basement|sump|crawl ?space|indoor|inside (a|the|your) (house|home)|water heater|boiler|furnace|radiator|air condition\w*|\bac unit|heat pump|toilet|sink|shower|bathtub|dishwasher|smoke detector|fireplace|chimney|floor heating|underfloor)\b/i;
// the setting a topic belongs in: a premade topic's own (topics.js), else the room for indoor topics
export function settingHint(topic) {
  // a premade topic, or a custom one that names it ("how a traffic light knows your car is there")
  const t = ` ${normTopic(topic)} `;
  const pre = premadeByKey(classifyTopic(topic).premade ?? "") ?? PREMADE.find((p) => p.setting && p.aliases.some((x) => t.includes(` ${x} `)));
  const type = pre?.setting ?? (INDOOR.test(topic) ? "room" : null);
  if (!type) return "";
  return ` This topic belongs in the ${type} setting: use world.backdrop {type: "${type}"}${type === "room" ? " (the cut below its floor is the basement)" : ""}, and set house, worker, moreTrees and road to false. It is about the ${pre?.topic ?? "thing"} itself, as people meet it there.`;
}
function sceneUser({ topic, title, sentences, hero, parts, lastOpening }) {
  return `Topic: ${topic} ("${title}").${settingHint(topic)} The named part: ${hero}. Things it needs to show: ${parts.join(", ")}.${lastOpening ? `\nThe previous video opened on ${lastOpening.what} (a ${lastOpening.kind}, ${lastOpening.type} shot) in the ${lastOpening.setting} setting: open this one on a different kind of object${lastOpening.setting === "yard" ? ", and in another setting if the topic allows" : ""}.` : ""}
The script, one sentence per line, as "role: text":
${sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}`;
}

// how a layout opens: its setting, and the hook's first shot (the part it frames, its kind, its size)
export function openingOf(L) {
  const W = L.world ?? {}, setting = W.backdrop?.type ?? (W.house === false ? "plain" : "yard");
  const hook = (L.beats ?? []).find((b) => b.s === "hook"), sh = hook && [hook.shot, ...(hook.shots ?? [])].filter(Boolean).find((s) => !s.at?.w) ;
  if (!sh || sh.focus === "home" || (Array.isArray(sh.focus) && sh.focus.includes("home"))) return { setting, kind: "home", type: "home", what: "the home view" };
  const id = [].concat(sh.focus ?? [])[0], part = L.parts.find((p) => p.id === id);
  return { setting, kind: sh.box ? "region" : part?.kind ?? "region", type: sh.type ?? (sh.width ? `width ${sh.width}` : "mid"), what: id ?? "a region" };
}
// verbs that build something over time: at the first frame they are already under way (a third done), not finished;
// the dig itself is the exception (below)
const PROCESS = /^(dig|grow|fill|pour|rise|wipe|flow|seep|soak|build|stack)/;
export const OPEN_AT = 0.3;
/**
 * The hook object on screen at 0.3 s: the part the hook's first shot frames gets its first action moved to the start of
 * the video, so it is already there (a car parked in the bay, a machine standing) or already under way (the cut a
 * third dug). Returns { layout, moved: { part, verb } | null }.
 */
export function fixOpening(L) {
  const hook = (L.beats ?? []).find((b) => b.s === "hook");
  const sh = hook && [hook.shot, ...(hook.shots ?? [])].filter(Boolean).find((s) => !s.at?.w);
  if (!sh || sh.focus === "home") return { layout: L, moved: null };
  const cut = L.world?.cut, parts = new Map(L.parts.map((p) => [p.id, p]));
  // the part it frames: the first focus part, or for a region the part (with an action) that overlaps it most
  let id = [].concat(sh.focus ?? []).find((x) => parts.has(x));
  if (!id && sh.box) {
    const ov = (a, b) => Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])) * Math.max(0, Math.min(a.max[1], b.max[1]) - Math.max(a.min[1], b.min[1]));
    // only a part the hook sentence itself acts on (never a later highlight such as the "This is a…" outline)
    const acted = new Set((hook.do ?? []).map((a) => a.p));
    id = L.parts.filter((p) => acted.has(p.id)).map((p) => ({ id: p.id, o: (() => { try { const b = focusOf(p, cut); return b ? ov(b, sh.box) : 0; } catch { return 0; } })() })).sort((a, b) => b.o - a.o)[0]?.id;
    if (!id && parts.has("dig")) id = "dig";
  }
  if (!id) return { layout: L, moved: null };
  // its first action anywhere in the video (the one that makes it appear)
  const next = JSON.parse(JSON.stringify(L));
  for (const b of next.beats ?? []) for (const a of b.do ?? []) {
    if (a.p !== id) continue;
    const part = parts.get(id), list = VERBS[part.kind]?.[a.v] ?? (part.kind === "panels" ? [{ a: 0.02, b: 0.45 }] : null);
    if (!list) return { layout: L, moved: null };
    // a dig is shown mostly done (the hole open, its clumps landed): a third done is mid-burst, a cloud of dirt close up
    const r = list[0], len = r.b == null ? 0 : (a.d != null ? Number(a.d) : r.b - r.a), P = a.v === "dig" ? 0.8 : PROCESS.test(a.v) ? 0.35 : 1;
    // already on screen by 0.3 s: nothing to do (its sentence starts the video and its cue starts early enough)
    const start = OPEN_AT - (r.b == null ? 0.05 : P * len);
    // move it to the hook's start; it may begin before the first frame (then the video opens with it under way)
    const moved = { part: id, verb: a.v, from: b.s + (a.w ? `:${a.w}` : "") };
    const beat = next.beats.find((x) => x.s === "hook"), act = { ...a, o: +(start - r.a).toFixed(3) }; delete act.w;
    if (part.kind === "dig") { const first = [beat.shot, ...(beat.shots ?? [])].filter(Boolean).find((s) => !s.at?.w); if (first && (first.type === "close" || first.type === "detail" || (first.width ?? 0) > 0.8)) { delete first.width; first.type = "mid"; } }
    b.do.splice(b.do.indexOf(a), 1);
    beat.do = [act, ...(beat.do ?? [])];
    return { layout: next, moved };
  }
  return { layout: L, moved: null };
}

/** the opening rules: close on the hook object, and not the way the previous video opened */
export function openingProblems(L, last) {
  const o = openingOf(L), out = [];
  if (o.kind === "home") out.push("the hook opens on the home view: its first shot (no word) must frame the hook object close (type close or mid)");
  else if (last && o.kind === last.kind && o.setting === last.setting) out.push(`the video opens like the previous one (a ${o.kind} in the ${o.setting} setting): open on another kind of object${o.setting === "yard" ? " or in another setting" : ""}`);
  return out;
}

// the words a saved layout's beats, shots and sounds trigger on, by sentence role
export function anchorWords(L) {
  const out = {}; const add = (s, w) => { if (s && w) (out[s] ??= new Set()).add(w); };
  for (const b of L.beats ?? []) { for (const a of b.do ?? []) add(b.s, a.w); for (const sh of [b.shot, ...(b.shots ?? [])]) if (sh?.at) add(sh.at.s, sh.at.w); }
  for (const c of [...(L.audio?.cards ?? []), ...(L.audio?.sfx ?? [])]) add(c.at?.s, c.at?.w);
  for (const c of L.audio?.chimes ?? []) add(c.s, c.w);
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [...v]]));
}
const clean = (w) => String(w ?? "").toLowerCase().replace(/[^a-z0-9']/g, "");
// every anchor of a saved layout whose word is not in its sentence of the new script
export function missingWords(L, sentences) {
  const has = (s, w) => (sentences.find((x) => x.role === s)?.text ?? "").split(/\s+/).some((x) => clean(x) === clean(w));
  const out = [];
  (L.beats ?? []).forEach((b, bi) => {
    (b.do ?? []).forEach((a, ai) => { if (a.w && !has(b.s, a.w)) out.push({ s: b.s, w: a.w, what: `${a.v} ${a.p}`, path: ["beats", bi, "do", ai, "w"] }); });
    [b.shot, ...(b.shots ?? [])].forEach((sh, si) => { if (sh?.at?.w && !has(sh.at.s, sh.at.w)) out.push({ s: sh.at.s, w: sh.at.w, what: "the camera moves to the next shot", path: si === 0 ? ["beats", bi, "shot", "at", "w"] : ["beats", bi, "shots", si - 1, "at", "w"] }); });
  });
  for (const k of ["cards", "sfx"]) (L.audio?.[k] ?? []).forEach((c, i) => { if (c.at?.w && !has(c.at.s, c.at.w)) out.push({ s: c.at.s, w: c.at.w, what: k === "cards" ? `the number card ${c.text}` : `the sound ${c.lib}`, path: ["audio", k, i, "at", "w"] }); });
  (L.audio?.chimes ?? []).forEach((c, i) => { if (c.w && !has(c.s, c.w)) out.push({ s: c.s, w: c.w, what: "a chime", path: ["audio", "chimes", i, "w"] }); });
  return out;
}
export function applyWords(L, missing, words) {
  const next = JSON.parse(JSON.stringify(L));
  missing.forEach((m, i) => { const w = words.find((x) => x.index === i)?.word; if (!w) return; let o = next; for (const k of m.path.slice(0, -1)) o = o[k]; o[m.path.at(-1)] = w.replace(/[^\w',-]/g, ""); });
  return next;
}
// a line's inner sentence breaks joined: "It sucks. It spins." -> "It sucks; it spins." (an abbreviation like "Mr."
// before a capital is joined too, which reads the same)
export function oneSentence(text) {
  // the next word is lowercased only when it is a common sentence start (names keep their capital)
  const START = /^(It|Its|It's|This|That|These|Those|The|A|An|And|But|So|Then|There|They|We|You|Your|He|She|Now|Each|Every|No|Not|Just|Even|Most|Some|All)$/;
  return String(text).trim().replace(/([.!?])(["”']?)\s+([\w']+)/g, (m, p, close, next) => `${p === "?" ? "," : ";"}${close} ${START.test(next) ? next.toLowerCase() : next}`);
}
// anchors whose words are missing: they fall back to the start of their sentence (a negative offset is dropped)
export function dropWords(L, missing) {
  const next = JSON.parse(JSON.stringify(L));
  for (const m of missing) { let o = next; for (const k of m.path.slice(0, -1)) o = o[k]; delete o.w; if (o.o < 0) delete o.o; }
  return next;
}
const WORDS_SCHEMA = { type: "object", additionalProperties: false, required: ["words"], properties: { words: { type: "array", items: { type: "object", additionalProperties: false, required: ["index", "word"], properties: { index: { type: "integer" }, word: { type: "string" } } } } } };

/**
 * A planner's sentence rewrites (the kit can't show the original), taken only when they keep the sentence's numbers
 * and roughly its length. Returns { script, taken: [roles], refused: [reasons] }.
 */
export function applyRewrites(script, rewrites = []) {
  const nums = (t) => (String(t).match(/\d[\d,.]*/g) ?? []).map((x) => x.replace(/[,.]$/, ""));
  const words = (t) => String(t).split(/\s+/).filter(Boolean).length;
  let sentences = script.sentences.slice(); const taken = [], refused = [];
  for (const r of rewrites) {
    const i = sentences.findIndex((s) => s.role === r.role); if (i < 0) { refused.push(`${r.role}: no such sentence`); continue; }
    const old = sentences[i].text, lost = nums(old).filter((n) => !nums(r.text).includes(n));
    if (lost.length) { refused.push(`${r.role}: drops ${lost.join(", ")}`); continue; }
    if (Math.abs(words(r.text) - words(old)) > Math.max(4, words(old) * 0.4)) { refused.push(`${r.role}: length ${words(old)} -> ${words(r.text)} words`); continue; }
    sentences[i] = { ...sentences[i], text: oneSentence(r.text) }; taken.push(r.role);
  }
  return { script: { ...script, sentences }, taken, refused };
}

/** a scene patch applied to a whole scene (a repair's reply): beats replaced by sentence, parts by id, world keys */
export function mergeScene(scene, patch) {
  if (!patch || patch._bad || (!patch.beats && !patch.parts && !patch.world)) return patch?.world?.cut ? patch : scene; // a whole layout is still accepted
  const out = JSON.parse(JSON.stringify(scene));
  for (const b of patch.beats ?? []) { const i = out.beats.findIndex((x) => x.s === b.s); if (i >= 0) out.beats[i] = b; else out.beats.push(b); }
  for (const p of patch.parts ?? []) { const i = out.parts.findIndex((x) => x.id === p.id); if (i >= 0) out.parts[i] = p; else out.parts.push(p); }
  if (patch.world) out.world = { ...out.world, ...patch.world };
  if (patch.audio) for (const k of ["cards", "sfx", "chimes", "rain"]) if (patch.audio[k]) out.audio[k] = patch.audio[k];
  return out;
}
const parseScene = (d) => { try { return JSON.parse(d.sceneJson); } catch (e) { return { _bad: e.message }; } };

const checkScript = (s, lengthSec, roles) => {
  const P = [], L = LENGTH[lengthSec];
  const n = s.sentences.reduce((k, x) => k + x.text.split(/\s+/).filter(Boolean).length, 0);
  if (n < L.words[0] - 8 || n > L.words[1] + 10) P.push(`${n} words (want ${L.words[0]}-${L.words[1]})`);
  const rs = s.sentences.map((x) => x.role);
  if (new Set(rs).size !== rs.length) P.push("a role is used twice");
  if (rs[0] !== "hook" || rs.at(-1) !== "congrats") P.push("the script must open with hook and end with congrats");
  if (!rs.includes("name")) P.push("no name sentence");
  if (roles && rs.join() !== roles.join()) P.push(`the roles must be exactly ${roles.join(", ")}`);
  for (const c of s.cards ?? []) { const t = s.sentences[c.sentence]?.text ?? ""; if (!t.split(/\s+/).some((w) => w.replace(/[^\w']/g, "") === c.word.replace(/[^\w']/g, ""))) P.push(`card "${c.text}": the word "${c.word}" is not in sentence ${c.sentence}`); }
  for (const x of s.sentences) if (!/[.!]$/.test(x.text.trim())) P.push(`sentence "${x.text.slice(0, 30)}…" must end with a full stop`);
  return P;
};

/**
 * The whole planner. topic, lengthSec (30 | 60); reuse: a saved layout key (its roles, its scene) or null for a
 * new layout. Returns { script, facts, layout, problems, warnings, costUsd, trace }.
 */
export async function planTopic({ apiKey, topic, lengthSec = 30, reuse = null, log, script: given = null, lastOpening = null, defer = null, model = MODEL.default, onStep = () => {}, cacheDir = null, example = /french drain|drain/i.test(topic) ? "landfill" : "french_drain" }) {
  const SCENE = sceneSystem(example);
  const trace = [];
  let cost = 0, n = 0;
  // every paid step is saved (cacheDir/step_<n>_<label>.json) and re-used on a re-run: nothing is paid for twice
  const step = async (label, args) => {
    onStep({ step: label });
    const file = cacheDir && path.join(cacheDir, `step_${++n}_${label.replace(/[^a-z0-9]+/gi, "_")}.json`);
    if (file && fs.existsSync(file)) { const r = JSON.parse(fs.readFileSync(file, "utf8")); trace.push({ label, cached: true, data: r.data }); return r; }
    // a batch pre-build: the scene plan's request is handed back instead of sent (its answer is written to this file)
    if (defer && label === "scene plan") { defer.push({ file, label, model, ...args }); throw Object.assign(new Error("deferred to a batch"), { deferred: true }); }
    const r = await callJSON({ apiKey, model, log, label, ...args });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
    cost += r.costUsd; trace.push({ label, costUsd: r.costUsd, searches: r.searches, data: r.data }); return r;
  };
  const saved = reuse ? template(reuse) : null;
  const savedFacts = saved?.facts?.filter((f) => f.verdict !== "drop") ?? [];
  const keyWords = saved ? anchorWords(saved) : null;

  // 1. the script (or a given one: the golden set re-uses the approved scripts)
  let script = given;
  if (!script) {
    let r = await step("script", { system: SCRIPT_SYSTEM, user: scriptUser({ topic, lengthSec, roles: saved?.roles, facts: savedFacts.map((f) => f.claim), keyWords }), schema: SCRIPT_SCHEMA, effort: "high", maxTokens: 16000 });
    script = r.data;
    let P = checkScript(script, lengthSec, saved?.roles);
    if (P.length) { r = await step("script repair", { system: SCRIPT_SYSTEM, user: `${scriptUser({ topic, lengthSec, roles: saved?.roles })}\n\nYour last script had these problems; fix them and return the whole script:\n- ${P.join("\n- ")}\n\nYour last script:\n${JSON.stringify(script)}`, schema: SCRIPT_SCHEMA, maxTokens: 16000 }); script = r.data; P = checkScript(script, lengthSec, saved?.roles); }
    trace.push({ label: "script check", problems: P });

    // 2. the fact-check, with web search (a second script round if fewer than 2 surprises survive). A saved layout
    //    keeps the facts it was checked with (the plan: a repeat topic needs no new fact-check).
    if (savedFacts.length) { script = { ...script, facts: saved.facts }; trace.push({ label: "fact-check skipped: the saved layout's verified facts", facts: savedFacts.length }); }
    else {
    const claims = `Surprise claims (index: claim | suggested search):\n${script.surprises.map((c, i) => `${i}: ${c.claim} | ${c.search}`).join("\n")}`;
    let rs = await step("fact research", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${claims}`, schema: null, search: Math.min(10, 2 * script.surprises.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < script.surprises.length) rs = await step("fact research (again)", { system: RESEARCH_SYSTEM, user: `Topic: ${topic}\n${claims}\n\nSearch the web for EACH claim now; an answer without searches is refused.`, schema: null, search: Math.min(10, 2 * script.surprises.length + 2), effort: "medium", maxTokens: 24000 });
    if (rs.searches < 1) throw new Error("fact-check: no web search was made; the facts are not verified");
    const notes = `${rs.data.text}\n\nSources found:\n${rs.data.sources.map((s) => `- ${s.title} ${s.url}`).join("\n")}`;
    const fc = await step("fact-check", { system: FACTS_SYSTEM, user: `Topic: ${topic}\nScript (index: role: text):\n${script.sentences.map((s, i) => `${i}: ${s.role}: ${s.text}`).join("\n")}\n\n${claims}\n\nCards: ${JSON.stringify(script.cards)}\n\nResearch notes (from ${rs.searches} web searches):\n${notes}`, schema: FACTS_SCHEMA, effort: "medium", maxTokens: 16000 });
    trace.push({ label: "fact research searches", searches: rs.searches, sources: rs.data.sources.length });
    const kept = fc.data.checks.filter((c) => c.verdict !== "drop");
    script = { ...script, sentences: fc.data.sentences, cards: fc.data.cards, facts: fc.data.checks };
    if (kept.length < 2) {
      const r2 = await step("script (verified facts)", { system: SCRIPT_SYSTEM, user: scriptUser({ topic, lengthSec, roles: saved?.roles, facts: kept.map((c) => c.claim) }), schema: SCRIPT_SCHEMA, maxTokens: 16000 });
      script = { ...r2.data, facts: fc.data.checks };
    }
    }
    const P2 = checkScript(script, lengthSec, saved?.roles);
    if (P2.length) trace.push({ label: "script check after facts", problems: P2 });
  }

  // one sentence per role: the voice is split into sentences at . ! ?, so a line holding two would shift every later
  // role by one. An inner break becomes a semicolon (a question mark a comma).
  script = { ...script, sentences: script.sentences.map((s) => ({ ...s, text: oneSentence(s.text) })) };

  // 3. the scene: a saved layout's beats, or a new layout planned from the kit
  // the sentences of a saved layout whose words moved (re-anchored): only their preview frames need a new look
  let layout, problems = [], warnings = [], changedRoles = null;
  if (saved) {
    layout = { ...saved, title: script.title || saved.title };
    ({ problems, warnings } = solveLayout(layout, script.sentences));
    if (problems.length) {
      // the saved beats' words are not all in the new sentences: one small call re-picks only those words
      const missing = missingWords(saved, script.sentences);
      changedRoles = [...new Set(missing.map((m) => m.s))];
      if (missing.length) {
        const r = await step("re-anchor words", { system: "You re-anchor an animation to a new narration. For each item, pick the one word of the given sentence (copy it exactly, without punctuation) on which that action should happen: the word that names the thing or the action. Reply with every item.", user: `Items (index: sentence role: sentence | the action | the old word):\n${missing.map((m, i) => `${i}: ${m.s}: ${script.sentences.find((x) => x.role === m.s)?.text} | ${m.what} | ${m.w}`).join("\n")}`, schema: WORDS_SCHEMA, effort: "low", maxTokens: 4000 });
        layout = applyWords(layout, missing, r.data.words);
      }
      ({ problems, warnings } = solveLayout(layout, script.sentences));
    }
  } else {
    const key = topic.toLowerCase().replace(/^(a|an|the)\s+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const user = sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [], lastOpening });
    let r = await step("scene plan", { system: SCENE, user, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
    let conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
    const rw1 = applyRewrites(script, conv.rewrites); script = rw1.script; if (rw1.taken.length || rw1.refused.length) trace.push({ label: "rewrites", taken: rw1.taken, refused: rw1.refused });
    ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
    problems.unshift(...conv.problems, ...openingProblems(conv.layout, lastOpening));
    trace.push({ label: "solver 1", problems, warnings, opening: openingOf(conv.layout) });
    if (problems.length) {
      r = await step("scene repair", { system: SCENE, user: `${user}\n\nYour layout below has problems the layout solver found. Fix every one and return the whole layout again (change only what the problems need).\nProblems:\n- ${problems.join("\n- ")}\n${warnings.length ? `Warnings (fix them if you can):\n- ${warnings.join("\n- ")}\n` : ""}\nYour layout (sceneJson):\n${r.data.sceneJson}`, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
      conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
      const rw2 = applyRewrites(script, conv.rewrites); script = rw2.script; if (rw2.taken.length || rw2.refused.length) trace.push({ label: "rewrites (repair)", taken: rw2.taken, refused: rw2.refused });
      ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
      problems.unshift(...conv.problems);
      // words still not in their sentences after the repair: those actions start with their sentence instead (free)
      if (problems.some((x) => /^anchor word not found/.test(x))) {
        const miss = missingWords(conv.layout, script.sentences);
        conv = { ...conv, layout: dropWords(conv.layout, miss) };
        ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
        problems.unshift(...conv.problems);
        warnings.push(...miss.map((m) => `${m.s}: "${m.w}" is not in the sentence, so ${m.what} starts with it`));
      }
      // a repeat opening after the repair is a warning: the video still goes on
      warnings.push(...openingProblems(conv.layout, lastOpening));
      trace.push({ label: "solver 2", problems, warnings, opening: openingOf(conv.layout) });
    }
    layout = { ...conv.layout, why: r.data.why };
  }
  // the hook object on screen in the first frame (free, in code)
  const op = fixOpening(layout);
  if (op.moved) { layout = op.layout; ({ problems, warnings } = (() => { const r = solveLayout(layout, script.sentences); return { problems: [...problems.filter((x) => !/^anchor word not found/.test(x)), ...r.problems.filter((x) => !problems.includes(x))], warnings: [...warnings, ...r.warnings.filter((x) => !warnings.includes(x))] }; })()); trace.push({ label: "opening", ...op.moved }); }
  if (saved && changedRoles == null) changedRoles = [];
  return { script, layout, problems, warnings, costUsd: +cost.toFixed(4), trace, changedRoles, approved: saved ? saved.approved !== false : false };
}

export { SCRIPT_SYSTEM, SCENE_SYSTEM, FACTS_SYSTEM, checkScript, KIND_DOCS, roleScript };

/**
 * One repair round after the preview frames: the failing beats and what the vision check saw go back to the scene
 * planner, which returns the layout with only those beats (and the parts they use) changed. A saved layout keeps
 * its world and parts: only beats and shots may change.
 */
export async function repairLayout({ apiKey, topic, script, layout, problems, log, cacheDir, model = MODEL.default, saved = false, example = /french drain|drain/i.test(topic) ? "landfill" : "french_drain" }) {
  const file = cacheDir && path.join(cacheDir, `repair_${problems.length}_${problems.join("|").length}.json`);
  let r;
  if (file && fs.existsSync(file)) r = JSON.parse(fs.readFileSync(file, "utf8"));
  else {
    r = await callJSON({ apiKey, model, log, label: "preview repair", system: sceneSystem(example), schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000,
      user: `${sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [] })}\n\nThe layout below was rendered, and preview frames of these beats failed the check (what the checker saw, and what to change):\n- ${problems.join("\n- ")}\n\nFix only those beats${saved ? " (beats and shots only: the world and the parts must stay exactly as they are)" : " (their parts' settings, their verbs, their shots)"}. Keep everything else exactly as it is. Return ONLY what changes, as sceneJson = {\"beats\": [each beat you change, whole, with its s], \"parts\": [each part you change or add, whole, with its id], \"world\": {only the world keys you change}}; leave out everything that stays the same.\n\nThe layout (sceneJson):\n${JSON.stringify(sceneFromLayout(layout))}` });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
  }
  // the reply is a patch: changed beats (by sentence), changed or new parts (by id), changed world keys
  const conv = layoutFromScene(mergeScene(sceneFromLayout(layout), parseScene(r.data)), { key: layout.key, title: layout.title, roles: layout.roles });
  let next = { ...conv.layout, why: layout.why };
  if (saved) next = { ...next, world: layout.world, parts: layout.parts, camera: layout.camera };
  else if (layout.camera) next.camera = layout.camera;
  if (layout.world?.sat != null) next.world = { ...next.world, sat: layout.world.sat };
  const solved = solveLayout(next, script.sentences);
  return { layout: next, problems: [...conv.problems, ...solved.problems], warnings: solved.warnings, costUsd: r.costUsd ?? 0 };
}
