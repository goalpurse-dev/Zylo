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
import { KIND_DOCS } from "./catalog.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const template = (k) => JSON.parse(fs.readFileSync(path.join(here, "layouts", `${k}.template.json`), "utf8"));
const roleScript = (L, words) => words; // (kept for symmetry; scripts carry their roles)

export const LENGTH = { 30: { words: [100, 125], sentences: [10, 13] }, 60: { words: [200, 240], sentences: [18, 24] } };

const EXAMPLES = [
  { topic: "a French drain", roles: template("french_drain").roles, text: "If you dig a ditch along your house, you have a drain. | But one inch of rain on a small roof dumps over 600 gallons right by your walls. | The ditch floods. | Five feet down, that water pushes over 300 pounds on each square foot, and the wall cracks. | So you fill the ditch with gravel, but the water still sits at the bottom. | So you lay a pipe full of holes under the gravel. | This is a French drain. | Water seeps in through the holes, and the pipe slopes downhill to carry it away. | Wrap the gravel in fabric so mud can't clog it. | And the French in French drain is not France. | It is Henry French, a New England farmer and judge who wrote the book on drains in 1859. | Add the grass back on top. | Congratulations, you have built a French drain." },
  { topic: "a landfill", roles: template("landfill").roles, text: "If you dig a pit and throw your trash in, you have a landfill. | But dirty trash juice leaks straight down into the groundwater you drink. | So you lay a thick clay base, but it is still not enough. | You add a thick black plastic sheet. | This is a landfill liner. | A pipe drains the collected juice into a tank beside the pit. | Sealed this tight, trash barely rots at all once it is buried. | A 1952 newspaper dug up decades later was still readable word for word. | But trapped trash still makes gas, so a pipe carries it out. | That flame is not waste burning, it is gas making electricity nearby. | Add a grass cap, a fence, and a few young trees. | Congratulations, you have built a landfill." },
];

const SCRIPT_SYSTEM = `You write scripts for short cutaway explainer videos: a 3D diorama of a lawn and a house with the ground cut open in section, where a thing is built step by step while one narrator talks. The account's formula:

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

function scriptUser({ topic, lengthSec, roles, facts }) {
  const L = LENGTH[lengthSec];
  return `Topic: ${topic}
Length: ${lengthSec} s video: ${L.words[0]}-${L.words[1]} words in ${L.sentences[0]}-${L.sentences[1]} sentences.
${roles ? `This topic re-uses a saved scene. Use exactly these roles, in this order, one sentence each: ${roles.join(", ")}.` : `Roles you may use: ${ROLES.join(", ")}.`}
${facts?.length ? `Use only these verified facts for the surprises (with their exact wording and numbers):\n${facts.map((f) => `- ${f}`).join("\n")}` : ""}

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
- One cut (world.cut) holds the main build. Keep the house off the cut (move it back or aside with world.house). Pipes may run through the soil outside the cut, along the face.
- A part appears ON THE WORD THAT NAMES IT: put its verb on that word ("pipe", "gravel", "tank"). The dig is on "dig" in the hook.
- The explainer layer: arrows show where water or gas moves; a glowing outline traces the named part on the "This is a…" sentence (verb show on the named word, hide on the next sentence); flow dots run in pipes when water flows.
- A myth-bust ("X is not Y") must SHOW the wrong idea first, then take it away: a flag crossed out, a fake lake that drains or fades on "not", then the real mechanism appears on the next sentence. A sentence about something that is not there needs a visible stand-in for it.
- Something new every 2-3 s: every sentence has at least one action. Problems are visible (rain, flooding, a crack, a leak) and are fixed by the next part. By "Congratulations" the problem is gone: stop rain, clear the storm, hide arrows and flows, refill or cap the cut, add the finishing touches. The end is calm.
- Camera shots: about one per sentence, a fast move starts just before the sentence (or before the word in shot.word). focus is the ids of the parts to frame (["home"] = the home view). width is how much of the frame width they fill: 0.3-0.5 for a prop or a detail, 0.6-1.0 for a long trench or a pit (wide parts fill the frame). box (6 numbers: min x,y,z, max x,y,z) frames a region instead of parts, for a close-up on a detail (the holes in a pipe). view: home (default), high (from above, for water on a surface), low (level, for a pipe in section), close (a detail on a wall). The "This is a…" sentence's shot is hero: true. Congrats and finish are home shots. The hook is a home shot when the cut is wide; for a small or narrow cut (a well shaft) the hook frames the cut being dug (focus the dig part) so the hole reads.
- Sound: library effects on events (digging, pouring, water rushing, dripping, flame, a pump hum), 3-5 of them; chimes on each number card, on the name sentence, and on "Congratulations"; cards on their number words. A rain bed (audio.rain: [from, to]) only when it rains.
- Reply with "why" and "sceneJson": the scene as JSON text with exactly the worked example's shape: {world: {cut: [x0, x1, z0, depth], house, porch, trees, road, rocksAvoid}, parts: [{id, kind, params, base?}], beats: [{s, do: [...], shots: [...]}], audio: {cards, sfx, chimes, rain}}. A part's base (optional) sets a channel's starting value. Numbers in world units.
- Verbs: an action is {p: part id, v: verb, w: the word in that sentence (as written, without punctuation; "" = the sentence start), o: seconds after the word (0), d: a duration to stretch the verb (0 = default), amp: 1, ch: "" (panels only: the panel channel)}.
- Reuse the worked example's settings when a part plays the same role (trench water, gravel with pebbles, soak pit, fabric, caps).
- In "why", say in two or three sentences what the scene is and how the camera tells it.

THE WORKED EXAMPLE: the approved ${EXAMPLE_TITLE[example]} video's layout, for its script:
${JSON.stringify(sceneFromLayout(template(example)))}`;
const SCENE_SYSTEM = sceneSystem();

function sceneUser({ topic, title, sentences, hero, parts }) {
  return `Topic: ${topic} ("${title}"). The named part: ${hero}. Things it needs to show: ${parts.join(", ")}.
The script, one sentence per line, as "role: text":
${sentences.map((s) => `${s.role}: ${s.text}`).join("\n")}`;
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
export async function planTopic({ apiKey, topic, lengthSec = 30, reuse = null, log, script: given = null, model = MODEL.default, onStep = () => {}, cacheDir = null, example = /french drain|drain/i.test(topic) ? "landfill" : "french_drain" }) {
  const SCENE = sceneSystem(example);
  const trace = [];
  let cost = 0, n = 0;
  // every paid step is saved (cacheDir/step_<n>_<label>.json) and re-used on a re-run: nothing is paid for twice
  const step = async (label, args) => {
    onStep({ step: label });
    const file = cacheDir && path.join(cacheDir, `step_${++n}_${label.replace(/[^a-z0-9]+/gi, "_")}.json`);
    if (file && fs.existsSync(file)) { const r = JSON.parse(fs.readFileSync(file, "utf8")); trace.push({ label, cached: true, data: r.data }); return r; }
    const r = await callJSON({ apiKey, model, log, label, ...args });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
    cost += r.costUsd; trace.push({ label, costUsd: r.costUsd, searches: r.searches, data: r.data }); return r;
  };
  const saved = reuse ? template(reuse) : null;

  // 1. the script (or a given one: the golden set re-uses the approved scripts)
  let script = given;
  if (!script) {
    let r = await step("script", { system: SCRIPT_SYSTEM, user: scriptUser({ topic, lengthSec, roles: saved?.roles }), schema: SCRIPT_SCHEMA, effort: "high", maxTokens: 16000 });
    script = r.data;
    let P = checkScript(script, lengthSec, saved?.roles);
    if (P.length) { r = await step("script repair", { system: SCRIPT_SYSTEM, user: `${scriptUser({ topic, lengthSec, roles: saved?.roles })}\n\nYour last script had these problems; fix them and return the whole script:\n- ${P.join("\n- ")}\n\nYour last script:\n${JSON.stringify(script)}`, schema: SCRIPT_SCHEMA, maxTokens: 16000 }); script = r.data; P = checkScript(script, lengthSec, saved?.roles); }
    trace.push({ label: "script check", problems: P });

    // 2. the fact-check, with web search (a second script round if fewer than 2 surprises survive)
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
    const P2 = checkScript(script, lengthSec, saved?.roles);
    if (P2.length) trace.push({ label: "script check after facts", problems: P2 });
  }

  // 3. the scene: a saved layout's beats, or a new layout planned from the kit
  let layout, problems = [], warnings = [];
  if (saved) {
    layout = { ...saved, title: script.title || saved.title };
    ({ problems, warnings } = solveLayout(layout, script.sentences));
    if (problems.length) {
      // the saved beats' words are not all in the new sentences: one small call re-picks them
      const r = await step("re-anchor saved beats", { system: SCENE, user: `${sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [] })}\n\nThis topic re-uses the saved layout below. Keep its world, parts and settings exactly; only change the beats' words (w, and shot words) so every word is in its sentence, and the cards' and sounds' words. Problems with the saved beats on this script:\n- ${problems.join("\n- ")}\n\nThe saved layout:\n${JSON.stringify(sceneFromLayout(saved))}`, schema: SCENE_REPLY_SCHEMA, maxTokens: 48000 });
      const conv = layoutFromScene(parseScene(r.data), { key: saved.key, title: layout.title, roles: saved.roles });
      layout = { ...conv.layout, parts: saved.parts, world: saved.world, camera: saved.camera };
      ({ problems, warnings } = solveLayout(layout, script.sentences));
      problems.unshift(...conv.problems);
    }
  } else {
    const key = topic.toLowerCase().replace(/^(a|an|the)\s+/, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    const user = sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [] });
    let r = await step("scene plan", { system: SCENE, user, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
    let conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
    ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
    problems.unshift(...conv.problems);
    trace.push({ label: "solver 1", problems, warnings });
    if (problems.length) {
      r = await step("scene repair", { system: SCENE, user: `${user}\n\nYour layout below has problems the layout solver found. Fix every one and return the whole layout again (change only what the problems need).\nProblems:\n- ${problems.join("\n- ")}\n${warnings.length ? `Warnings (fix them if you can):\n- ${warnings.join("\n- ")}\n` : ""}\nYour layout (sceneJson):\n${r.data.sceneJson}`, schema: SCENE_REPLY_SCHEMA, effort: "high", maxTokens: 64000 });
      conv = layoutFromScene(parseScene(r.data), { key, title: script.title, roles: script.sentences.map((s) => s.role) });
      ({ problems, warnings } = solveLayout(conv.layout, script.sentences));
      problems.unshift(...conv.problems);
      trace.push({ label: "solver 2", problems, warnings });
    }
    layout = { ...conv.layout, why: r.data.why };
  }
  return { script, layout, problems, warnings, costUsd: +cost.toFixed(4), trace };
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
      user: `${sceneUser({ topic, title: script.title, sentences: script.sentences, hero: script.hero, parts: script.parts ?? [] })}\n\nThe layout below was rendered, and preview frames of these beats failed the check (what the checker saw, and what to change):\n- ${problems.join("\n- ")}\n\nFix only those beats${saved ? " (beats and shots only: the world and the parts must stay exactly as they are)" : " (their parts' settings, their verbs, their shots)"}. Keep everything else exactly as it is, and return the whole layout.\n\nThe layout (sceneJson):\n${JSON.stringify(sceneFromLayout(layout))}` });
    if (file) { fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1)); }
  }
  const conv = layoutFromScene(parseScene(r.data), { key: layout.key, title: layout.title, roles: layout.roles });
  let next = { ...conv.layout, why: layout.why };
  if (saved) next = { ...next, world: layout.world, parts: layout.parts, camera: layout.camera };
  else if (layout.camera) next.camera = layout.camera;
  if (layout.world?.sat != null) next.world = { ...next.world, sat: layout.world.sat };
  const solved = solveLayout(next, script.sentences);
  return { layout: next, problems: [...conv.problems, ...solved.problems], warnings: solved.warnings, costUsd: r.costUsd ?? 0 };
}
