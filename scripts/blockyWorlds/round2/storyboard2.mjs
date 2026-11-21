// ROUND 2 TEST, the rework (owner 2026-11-21, "the Whisperer way"): SCENE CARDS (start frame, end frame, motion on words,
// sfx), one AI call per scene, words from the REAL voice timing (joined = the script, checked), then the CHECK: the start
// and the end still of every card, a vision check on both ("does this picture clearly show: <the words>?"), a failing
// card rewritten with the check's words and re-rendered (max 2 tries), and the sheet: each card's start + end side by
// side with its words under them. The round's $5 cap is shared (<round>/costs.json). Resumable.
//   node --env-file=.env.local scripts/blockyWorlds/round2/storyboard2.mjs --out <round dir> --id day|night --voice <words.json> [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { callJson, costOf } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { timedWords, scenesOf, wordsProblems, sceneCards, redoScene, capCloseUps } from "../blenderKit/sceneCards.mjs";
import { compileScene } from "../blenderKit/cards.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROUND = path.resolve(arg("out")), ID = arg("id");
const OUT = path.join(ROUND, `scenes_${ID}`); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(ROUND, { capUsd: 5, agentCapUsd: 5 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "scenes.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const KEY = process.env.ANTHROPIC_API_KEY;
const script = JSON.parse(fs.readFileSync(path.join(ROUND, `script_${ID}.json`), "utf8")).script;
const plan = JSON.parse(fs.readFileSync(path.join(ROUND, `board_${ID}`, "direct.json"), "utf8")).plan; // step 1 (the story plan), already made
const voiceWords = JSON.parse(fs.readFileSync(path.resolve(arg("voice")), "utf8"));
const scenes = scenesOf(script, timedWords(script, voiceWords));
const wp = wordsProblems(script, scenes);
if (wp.length) throw new Error(`THE WORDS CHECK failed: ${wp.join(" | ")}`);
say(`"${script.title}": ${scenes.length} scenes from the real voice timing (${voiceWords.at(-1).end.toFixed(1)} s); the words check: the cards' words = the script`);
if (!has("yes")) process.exit(0);

// ---- the scene cards (one call each)
let C = load("cards.json");
if (!C) {
  L.check(`scene cards ${ID}`, 1.2);
  const r = await sceneCards({ callJson, apiKey: KEY, plan, script, scenes, log: say });
  L.add("director", r.costUsd);
  C = r.cards.map((c) => ({ id: c.scene.id, card: c.card, problems: c.problems, firstOfPlace: c.firstOfPlace, monsterSeen: c.monsterSeen }));
  save("cards.json", C);
}
const sceneById = Object.fromEntries(scenes.map((s) => [s.id, s]));
if (has("cards-only")) { say(`cards only: ${C.length} cards, ${C.filter((c) => c.problems.length).length} with rule problems; spent $${L.total()}`); process.exit(0); }
const speakerOf = (sc) => { const l = script.lines[sc.line - 1]; return l.speaker && !/^(narrator|)$/i.test(l.speaker) ? l.speaker : null; };

// ---- render the start + end still of a set of cards
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
async function render(tag, ids) {
  const dir = path.join(OUT, `render_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const stills = ids.flatMap((id) => [{ id, which: "start" }, { id, which: "end" }]);
  const N = stills.length;
  const body = (x) => {
    const c = C.find((k) => k.id === x.id), sc = sceneById[x.id];
    const D = Math.max(0.6, sc.end - sc.start).toFixed(3);
    // the still is the window's middle frame: the scene runs FROM it (start still) or ENDS on it (end still)
    const shift = x.which === "start" ? `tm = (t0 + t1) / 2.0\nt0, t1 = tm, tm + ${D}` : `tm = (t0 + t1) / 2.0\nt0, t1 = tm - ${D}, tm`;
    return `${shift}\n${compileScene(c.card, { plan, scene: sc, speaker: speakerOf(sc) })}`.split("\n").map((l) => `    ${l}`).join("\n");
  };
  const src = [`"""Round 2 scene stills ${ID} ${tag}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
    ...stills.map((x, k) => `@S(${k + 1}, ${2 * k}, ${k + 1 < N ? 2 * (k + 1) : "None"}, ${JSON.stringify(`scene ${x.id} ${x.which}`)})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${body(x)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "scene stills\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(dir, "video", "audio", "voice.wav")]);
  const jobs = N > 50 ? 3 : N > 16 ? 2 : 1;
  const groups = Array.from({ length: jobs }, (_, g) => stills.map((_, k) => k + 1).filter((n) => n % jobs === g % jobs)).filter((g) => g.length);
  const limit = (g) => g.length * 12 + 240;
  L.check(`render ${tag}`, groups.reduce((a, g) => a + (limit(g) + BOOT_S) * RATE, 0));
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round2s-${ID}-${tag}-${Date.now().toString(36)}`, log: say });
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  const res = await Promise.all(groups.map(async (g, gi) => {
    const r = await R.job(`scenes ${ID} ${tag}.${gi} (${g.length})`, { role: "preview", slug: "scenes", videoUrl: url, shots: g.join(","), perSheet: 40, cols: 10, samples: 16, upload: await R.signPuts(`p${gi}.tgz`, 2) }, { maxRunSec: limit(g), ledgerKey: "runpod_preview" });
    if (!r.ok) return { ok: false, error: String(r.error).slice(0, 300) };
    const jd = path.join(dir, `job${gi}`); fs.mkdirSync(jd, { recursive: true });
    await R.fetchParts(`p${gi}.tgz`, r.output.upload.parts, path.join(jd, "p.tgz"));
    py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(jd, "p.tgz"), jd);
    return { ok: true, gi, failed: r.output.failed ?? {} };
  }));
  await R.cleanup().catch(() => {});
  const bad = res.filter((x) => !x.ok);
  if (bad.length) throw new Error(`render failed: ${bad.map((b) => b.error).join(" | ")}`);
  const pngs = {}, failed = {};
  for (const x of res) {
    for (const [k, val] of Object.entries(x.failed)) { const s = stills[Number(k) - 1]; failed[`${s.id}.${s.which}`] = String(val).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300); }
    const pd = path.join(dir, `job${x.gi}`, "preview");
    if (fs.existsSync(pd)) for (const f of fs.readdirSync(pd)) { const m = f.match(/^shot_(\d+)\.png$/); if (m) { const s = stills[Number(m[1]) - 1]; pngs[`${s.id}.${s.which}`] = path.join(pd, f); } }
  }
  const out = { pngs, failed };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`render ${tag}: ${Object.keys(pngs).length}/${N} stills, ${Object.keys(failed).length} crashed; spent $${L.total()}`);
  return out;
}

// ---- the check: both stills of a card against its words
const CHECK = { type: "object", additionalProperties: false, required: ["pictures"], properties: { pictures: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "ok", "problem"], properties: { n: { type: "integer" }, ok: { type: "boolean" }, problem: { type: "string" } } } } } };
async function vision(items) {
  const content = [{ type: "text", text: "You check storyboard stills of a Roblox-style blocky 3D story video (9:16). For EACH numbered picture: does it CLEARLY show its words (the named people, things and actions, in frame and big enough to read)? A START picture shows the moment the words begin, an END picture the moment they end: each must fit its words. FAIL a picture that is blurry, too dark, mostly one flat surface or wall, a bright glare blob, or where the main subject is cut off or hidden. A blocky stand-in counts if it reads as that thing. problem: one short sentence (\"\" when ok)." }];
  for (const it of items) {
    content.push({ type: "text", text: `PICTURE ${it.n} (${it.which.toUpperCase()} of the scene): the words "${it.words}"` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: fs.readFileSync(it.png).toString("base64") } });
  }
  content.push({ type: "text", text: "Return the JSON: one entry per picture, n = its PICTURE number." });
  L.check("vision", 0.06);
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema: CHECK } } }) });
  const j = await r.json();
  L.add("vision", costOf("claude-sonnet-5-5", j.usage));
  if (!r.ok) throw new Error(`vision ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return JSON.parse((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("")).pictures;
}
async function check(ids, pngs, failed) {
  const v = {};
  const items = [];
  for (const id of ids) for (const which of ["start", "end"]) {
    const k = `${id}.${which}`;
    if (failed[k] || !pngs[k]) v[k] = { ok: false, problem: `crashed in Blender: ${failed[k] ?? "no still"}` };
    else items.push({ k, id, which, png: pngs[k], words: sceneById[id].words });
  }
  for (let i = 0; i < items.length; i += 8) {
    const batch = items.slice(i, i + 8).map((x, j) => ({ ...x, n: j + 1 }));
    const a = await vision(batch);
    for (const b of batch) { const x = a.find((y) => y.n === b.n); v[b.k] = { ok: Boolean(x?.ok), problem: x?.problem ?? "no answer" }; }
  }
  return v;
}
const cardOk = (v, id) => v[`${id}.start`]?.ok && v[`${id}.end`]?.ok;

// ---- the loop
let st = load("state.json") ?? { round: 0, v: {}, pngs: {} };
if (st.round === 0) {
  const ids = C.map((c) => c.id);
  const r = await render("r0", ids);
  st.pngs = { ...r.pngs }; st.v = await check(ids, r.pngs, r.failed); st.round = 1; save("state.json", st);
}
for (let round = st.round; round <= 2; round++) {
  const failing = C.map((c) => c.id).filter((id) => !cardOk(st.v, id));
  say(`round ${round}: ${C.length - failing.length}/${C.length} cards pass (both stills)`);
  if (!failing.length) break;
  for (const id of failing) {
    const k = scenes.findIndex((s) => s.id === id), c = C.find((x) => x.id === id);
    const fb = ["start", "end"].map((w) => `${w.toUpperCase()}: ${st.v[`${id}.${w}`]?.ok ? "ok" : `FAILED: ${st.v[`${id}.${w}`]?.problem}`}`).join("; ");
    L.check("redo scene", 0.03);
    const r = await redoScene({ callJson, apiKey: KEY, plan, script, scenes, k, previous: c.card, feedback: fb, firstOfPlace: c.firstOfPlace, monsterSeen: c.monsterSeen });
    L.add("director", r.costUsd);
    if (r.card?.start) { c.card = r.card; c.problems = r.problems; c.tries = (c.tries ?? 0) + 1; }
  }
  capCloseUps(C.map((c) => ({ card: c.card })));
  save("cards.json", C);
  const r = await render(`r${round}`, failing);
  Object.assign(st.pngs, r.pngs); Object.assign(st.v, await check(failing, r.pngs, r.failed));
  st.round = round + 1; save("state.json", st);
}
// ---- the sheet: start | end side by side, the words under them
const rows = C.map((c) => { const sc = sceneById[c.id]; return { id: c.id, words: sc.words, secs: +(sc.end - sc.start).toFixed(2), start: st.pngs[`${c.id}.start`] ?? null, end: st.pngs[`${c.id}.end`] ?? null, ok: Boolean(cardOk(st.v, c.id)), cam: `${c.card.start.camera.type}>${c.card.end.camera.type}`, motion: (c.card.motion ?? []).map((m) => `${m.who} ${m.action}${m.target ? ` ${m.target}` : ""} on "${sc.wordList[m.on_word]?.word ?? "?"}"`).join("; "), sfx: (c.card.sfx ?? []).map((x) => `${x.sound} on "${sc.wordList[x.on_word]?.word ?? "?"}"`).join(", "), problem: [st.v[`${c.id}.start`], st.v[`${c.id}.end`]].filter((x) => x && !x.ok).map((x) => x.problem).join(" / ") }; });
save("sheet.json", { title: script.title, rows });
spawnSync("python", [path.join(HERE, "sceneSheet.py"), path.join(OUT, "sheet.json"), path.join(OUT, `storyboard_${ID}.jpg`)], { stdio: "inherit" });
const pass = rows.filter((r) => r.ok).length;
say(`storyboard ${ID}: ${pass}/${rows.length} cards pass (${Math.round((100 * pass) / rows.length)}%); close-ups ${C.filter((c) => c.card.start.camera.type === "close").length}; round spent $${L.total()} of $5`);
