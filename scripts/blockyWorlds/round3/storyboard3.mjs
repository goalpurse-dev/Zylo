// ROUND 3 TEST (owner 2026-11-22): a living world with story logic + character voices. STILLS ONLY: one new ~40 s story
// (day -> dusk -> night, the rule "nobody goes outside after dark", a quoted line by another character), the story plan
// (the town, a world state per line, the cast's voices), the scene cards (one call each, the world state in every call),
// the start + end still of every card, the picture check WITH the world state (anything moving or lit that the world
// says should not be there fails), one redo round for failing cards, the sheet. The voices are NOT bought here (only
// the samples, voiceSamples.mjs): the scenes are timed on an ESTIMATE of the 1.25x voice. Cap: --cap (default $2) on
// <out>/costs.json. Resumable (every step saved).
//   node --env-file=.env.local scripts/blockyWorlds/round3/storyboard3.mjs --out <dir> [--yes] [--cap 2]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { callJson, costOf } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { writeScript2 } from "../../../supabase/functions/_shared/blockyWorlds/writer2.js";
import { STREET_PLACES } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { worldOf, worldText } from "../../../supabase/functions/_shared/blockyWorlds/worldState.js";
import { pickVoices } from "../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { planStory } from "../blenderKit/director2.mjs";
import { timedWords, scenesOf, wordsProblems, sceneCards, redoScene, capCloseUps } from "../blenderKit/sceneCards.mjs";
import { compileScene } from "../blenderKit/cards.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const ROOT = path.join(HERE, "..", "..", "..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 2));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const KEY = process.env.ANTHROPIC_API_KEY;
if (!has("yes")) { say(`round 3 storyboard: dry run (add --yes); cap $${CAP}; spent $${L.total()}`); process.exit(0); }

const TOPIC = "In this town, nobody goes outside after dark. Show a busy happy day on our street, everyone hurrying home when the sun goes down, the empty night street, and one scary moment when something is out there and the people who see it react. At least one other character says a quoted line.";

// ---- 1. the story (one call + one fix)
let script = load("script.json")?.script;
if (!script) {
  L.check("writer", 0.6);
  const r = await writeScript2({ callJson, apiKey: KEY, topic: TOPIC, when: "day_to_night", lengthSec: 40, needQuote: true });
  L.add("writer", r.costUsd);
  script = r.script;
  save("script.json", { script, problems: r.problems, tries: r.tries, costUsd: r.costUsd });
  say(`story "${script.title}": ${script.lines.length} lines, ${r.problems.length} rule problem(s) left${r.problems.length ? `: ${r.problems.join(" | ")}` : ""} ($${r.costUsd})`);
}

// ---- 2. the plan: the cast + their voices, the town, a world state per line
let P = load("plan.json");
if (!P) {
  L.check("plan", 0.5);
  const r = await planStory({ callJson, apiKey: KEY, script });
  L.add("director", r.costUsd);
  P = { plan: r.plan, problems: r.problems };
  save("plan.json", P);
  say(`plan: town rule "${r.plan.town?.rule}", ${r.plan.town?.effects?.length ?? 0} effect(s); ${r.problems.length} world problem(s) left; $${r.costUsd}`);
}
const plan = P.plan;
// the cast's voices, saved with the cast (a character keeps its voice in later videos)
const STORE = path.join(ROOT, "content", "in-this-town", "cast_voices.json");
fs.mkdirSync(path.dirname(STORE), { recursive: true });
const { voices, store } = pickVoices(plan.cast ?? [], fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : {});
fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
save("voices.json", voices);
say(`voices: ${Object.entries(voices).map(([k, v]) => `${k} = ${v.type} (${v.voiceName})`).join("; ") || "-"}`);

// ---- 3. the timing (an ESTIMATE of the 1.25x voice: ~4.3 words a second, a short pause at each line end; free)
const est = []; { let t = 0.1; for (const l of script.lines) { for (const w of String(l.text).split(/\s+/).filter(Boolean)) { const d = 0.16 + 0.035 * w.replace(/[^a-z]/gi, "").length; est.push({ word: w, start: +t.toFixed(3), end: +(t + d).toFixed(3) }); t += d + 0.02; } t += 0.18; } }
save("words_estimate.json", est);
const scenes = scenesOf(script, timedWords(script, est));
const wp = wordsProblems(script, scenes);
if (wp.length) throw new Error(`THE WORDS CHECK failed: ${wp.join(" | ")}`);
say(`${scenes.length} scenes, ~${est.at(-1).end.toFixed(1)} s (estimated 1.25x voice)`);

// ---- 4. the scene cards (one call each, the world state in each)
let C = load("cards.json");
if (!C) {
  L.check("scene cards", 1.0);
  const r = await sceneCards({ callJson, apiKey: KEY, plan, script, scenes, log: say });
  L.add("director", r.costUsd);
  C = r.cards.map((c) => ({ id: c.scene.id, card: c.card, problems: c.problems, firstOfPlace: c.firstOfPlace, monsterSeen: c.monsterSeen }));
  save("cards.json", C);
}
const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
const speakerOf = (sc) => { const l = script.lines[sc.line - 1]; return l.speaker && !/^(narrator|me|)$/i.test(l.speaker) ? l.speaker : null; };
const indoorOf = (c) => !STREET_PLACES.includes(c.card.start.place);

// ---- 5. the stills (start + end of each card), the library with our pieces (dot faces, window walls)
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
async function render(tag, ids) {
  const dir = path.join(OUT, `render_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const stills = ids.flatMap((id) => [{ id, which: "start" }, { id, which: "end" }]);
  const N = stills.length;
  const body = (x) => {
    const c = C.find((k) => k.id === x.id), sc = sceneById[x.id];
    const D = Math.max(0.6, sc.end - sc.start).toFixed(3);
    const shift = x.which === "start" ? `tm = (t0 + t1) / 2.0\nt0, t1 = tm, tm + ${D}` : `tm = (t0 + t1) / 2.0\nt0, t1 = tm - ${D}, tm`;
    return `${shift}\n${compileScene(c.card, { plan, scene: sc, speaker: speakerOf(sc), world: worldOf(plan, sc.line), indoor: indoorOf(c) })}`.split("\n").map((l) => `    ${l}`).join("\n");
  };
  const src = [`"""Round 3 stills ${tag}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
    ...stills.map((x, k) => `@S(${k + 1}, ${2 * k}, ${k + 1 < N ? 2 * (k + 1) : "None"}, ${JSON.stringify(`scene ${x.id} ${x.which}`)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${body(x)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "scene stills\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(dir, "video", "audio", "voice.wav")]);
  const limit = N * 28 + 300;
  L.check(`render ${tag}`, (limit + BOOT_S) * RATE);
  if (has("check-only")) { say(`render ${tag}: static check ok (${N} stills), not sent`); process.exit(0); }
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round3-${tag}-${Date.now().toString(36)}`, log: say });
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  const r = await R.job(`round3 ${tag} (${N})`, { role: "preview", slug: "scenes", videoUrl: url, shots: stills.map((_, k) => k + 1).join(","), perSheet: 90, cols: 10, samples: 12, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_preview" });
  if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`render failed: ${String(r.error).slice(0, 300)}`); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  const pngs = {}, failed = {};
  for (const [k, val] of Object.entries(r.output.failed ?? {})) { const s = stills[Number(k) - 1]; failed[`${s.id}.${s.which}`] = String(val).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300); }
  const pd = path.join(dir, "preview");
  if (fs.existsSync(pd)) for (const f of fs.readdirSync(pd)) { const m = f.match(/^shot_(\d+)\.png$/); if (m) { const s = stills[Number(m[1]) - 1]; pngs[`${s.id}.${s.which}`] = path.join(pd, f); } }
  const out = { pngs, failed, gate: r.output.gate ?? [] };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`render ${tag}: ${Object.keys(pngs).length}/${N} stills, ${Object.keys(failed).length} crashed${Object.keys(failed).length ? `: ${Object.entries(failed).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" | ")}` : ""}; spent $${L.total()}`);
  return out;
}

// ---- 6. the picture check: the words AND the world state
const CHECK = { type: "object", additionalProperties: false, required: ["pictures"], properties: { pictures: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "ok", "world_ok", "problem"], properties: { n: { type: "integer" }, ok: { type: "boolean" }, world_ok: { type: "boolean" }, problem: { type: "string" } } } } } };
async function vision(items) {
  const content = [{ type: "text", text: "You check storyboard stills of a Roblox-style blocky 3D story video (9:16). For EACH numbered picture: (1) ok: does it CLEARLY show its words (the named people, things and actions, in frame and big enough to read)? A START picture shows the moment the words begin, an END picture the moment they end. FAIL a picture that is blurry, too dark, mostly one flat surface or wall, a bright glare blob, or where the main subject is cut off or hidden. A blocky stand-in counts if it reads as that thing. (2) world_ok: does the picture fit its WORLD STATE? world_ok = false if anything moves or is lit that the world state says should not be there (people walking on a street that must be empty, a driving car or moving headlights when cars are parked only, lit windows when windows are dark), or if a busy world shows an empty dead street. problem: one short sentence (\"\" when both are fine)." }];
  for (const it of items) {
    content.push({ type: "text", text: `PICTURE ${it.n} (${it.which.toUpperCase()} of the scene): the words "${it.words}". ${it.world}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: fs.readFileSync(it.png).toString("base64") } });
  }
  content.push({ type: "text", text: "Return the JSON: one entry per picture, n = its PICTURE number." });
  L.check("vision", 0.08);
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema: CHECK } } }) });
  const j = await r.json();
  L.add("vision", costOf("claude-sonnet-5-5", j.usage));
  if (!r.ok) throw new Error(`vision ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return JSON.parse((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("")).pictures;
}
async function check(ids, pngs, failed) {
  const v = {}, items = [];
  for (const id of ids) for (const which of ["start", "end"]) {
    const k = `${id}.${which}`;
    const c = C.find((x) => x.id === id), sc = sceneById[id];
    if (failed[k] || !pngs[k]) v[k] = { ok: false, world_ok: false, problem: `crashed in Blender: ${failed[k] ?? "no still"}` };
    else items.push({ k, id, which, png: pngs[k], words: sc.words, world: worldText(worldOf(plan, sc.line), { indoor: indoorOf(c) }) });
  }
  for (let i = 0; i < items.length; i += 8) {
    const batch = items.slice(i, i + 8).map((x, j) => ({ ...x, n: j + 1 }));
    const a = await vision(batch);
    for (const b of batch) { const x = a.find((y) => y.n === b.n); v[b.k] = { ok: Boolean(x?.ok && x?.world_ok), words_ok: Boolean(x?.ok), world_ok: Boolean(x?.world_ok), problem: x?.problem ?? "no answer" }; }
  }
  return v;
}
const cardOk = (v, id) => v[`${id}.start`]?.ok && v[`${id}.end`]?.ok;

let st = load("state.json") ?? { round: 0, v: {}, pngs: {} };
// --rerender 16,3: those cards again AS THEY ARE (no rewrite: an engine / compiler fix), checked, into the sheet
if (arg("rerender")) {
  const ids = arg("rerender").split(",").map(Number);
  const r = await render(`x${Date.now().toString(36)}`, ids);
  Object.assign(st.pngs, r.pngs); Object.assign(st.v, await check(ids, r.pngs, r.failed)); save("state.json", st);
}
if (st.round === 0) {
  const ids = C.map((c) => c.id);
  const r = await render("r0", ids);
  st.pngs = { ...r.pngs }; st.v = await check(ids, r.pngs, r.failed); st.round = 1; save("state.json", st);
}
const MAXR = Number(arg("rounds", 1));
for (let round = st.round; round <= MAXR && !arg("rerender"); round++) {
  const failing = C.map((c) => c.id).filter((id) => !cardOk(st.v, id));
  say(`round ${round}: ${C.length - failing.length}/${C.length} cards pass (words + world, both stills)`);
  if (!failing.length) break;
  const need = failing.length * (0.03 + 2 * 0.0045) + 0.15;
  if (L.total() + need > CAP) { say(`round ${round} skipped: it needs ~$${need.toFixed(2)}, $${(CAP - L.total()).toFixed(2)} left`); break; }
  st.redone ??= {};
  if (!st.redone[round]) for (const id of failing) {
    const k = scenes.findIndex((s) => s.id === id), c = C.find((x) => x.id === id);
    const fb = ["start", "end"].map((w) => `${w.toUpperCase()}: ${st.v[`${id}.${w}`]?.ok ? "ok" : `FAILED${st.v[`${id}.${w}`]?.world_ok === false ? " (the WORLD STATE)" : ""}: ${st.v[`${id}.${w}`]?.problem}`}`).join("; ");
    const r = await redoScene({ callJson, apiKey: KEY, plan, script, scenes, k, previous: c.card, feedback: fb, firstOfPlace: c.firstOfPlace, monsterSeen: c.monsterSeen });
    L.add("director", r.costUsd);
    if (r.card?.start) { c.card = r.card; c.problems = r.problems; c.tries = (c.tries ?? 0) + 1; }
  }
  capCloseUps(C.map((c) => ({ card: c.card })));
  save("cards.json", C);
  st.redone[round] = true; save("state.json", st);
  const r = await render(`r${round}`, failing);
  Object.assign(st.pngs, r.pngs); Object.assign(st.v, await check(failing, r.pngs, r.failed));
  st.round = round + 1; save("state.json", st);
}

// ---- 7. the sheet: start | end, the words, the world state, the check
const wshort = (w, indoor) => indoor ? `indoor; windows ${w.windows}, curtains ${w.curtains}` : `${w.time}: ${w.busy}, people ${w.walkers}${w.extras?.length ? ` (${w.extras.join(", ")})` : ""}; cars ${w.cars}; windows ${w.windows}; curtains ${w.curtains}${w.threat !== "none" ? `; THREAT ${w.threat}` : ""}`;
const rows = C.map((c) => { const sc = sceneById[c.id]; const w = worldOf(plan, sc.line); return { id: c.id, words: sc.words, secs: +(sc.end - sc.start).toFixed(2), start: st.pngs[`${c.id}.start`] ?? null, end: st.pngs[`${c.id}.end`] ?? null, ok: Boolean(cardOk(st.v, c.id)),
  cam: `${c.card.start.camera.type}>${c.card.end.camera.type}`, motion: `WORLD ${wshort(w, indoorOf(c))}`, sfx: speakerOf(sc) ? `voice: ${speakerOf(sc)} = ${voices[speakerOf(sc)]?.type ?? "?"}` : "", problem: [st.v[`${c.id}.start`], st.v[`${c.id}.end`]].filter((x) => x && !x.ok).map((x) => `${x.world_ok === false ? "[world] " : ""}${x.problem}`).join(" / ") }; });
save("sheet.json", { title: script.title, rows });
spawnSync("python", [path.join(HERE, "..", "round2", "sceneSheet.py"), path.join(OUT, "sheet.json"), path.join(OUT, "storyboard.jpg")], { stdio: "inherit" });
const pass = rows.filter((r) => r.ok).length;
say(`storyboard: ${pass}/${rows.length} cards pass (${Math.round((100 * pass) / rows.length)}%); world fails ${Object.values(st.v).filter((x) => x.world_ok === false).length} stills; spent $${L.total()} of $${CAP}`);
