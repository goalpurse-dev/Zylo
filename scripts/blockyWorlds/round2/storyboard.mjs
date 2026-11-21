// ROUND 2 TEST (owner 2026-11-21): the director v2 + the card compiler + the CHECKER WITH EYES, as a STORYBOARD only
// (no video): one still per shot (its key moment = the shot's middle frame), a vision check per still ("does this
// picture clearly show: <MUST SEE>?"; blurry / unreadable fails), the failing lines re-directed with the check's words
// and re-rendered (max 2 tries), then one sheet: every shot's still with its line under it. The round's $5 cap is shared
// through <out>/costs.json. Resumable: each stage's result is saved.
//   node --env-file=.env.local scripts/blockyWorlds/round2/storyboard.mjs --out <round dir> --id day|night [--yes]
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { callJson, costOf } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { direct2, redirectLine, cardProblems } from "../blenderKit/director2.mjs";
import { compileCard, shotsOf } from "../blenderKit/cards.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROUND = path.resolve(arg("out")), ID = arg("id");
const OUT = path.join(ROUND, `board_${ID}`); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(ROUND, { capUsd: 5, agentCapUsd: 5 });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "board.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const KEY = process.env.ANTHROPIC_API_KEY;
const script = JSON.parse(fs.readFileSync(path.join(ROUND, `script_${ID}.json`), "utf8")).script;
if (!has("yes")) { say(`dry run: "${script.title}" ${script.lines.length} lines; spent $${L.total()} of $5`); process.exit(0); }

// ---- 1. direct (plan + cards per line)
let D = load("direct.json");
if (!D) {
  L.check(`direct ${ID}`, 1.6);
  D = await direct2({ callJson, apiKey: KEY, script, log: say });
  L.add("director", D.costUsd); save("direct.json", D);
  say(`directed: $${D.costUsd}`);
}
const plan = D.plan;
const ACTS = path.join(KIT, "worlds", "acts.py");
if (has("direct-only") || !fs.existsSync(ACTS)) { say(`directed only (acts.py ${fs.existsSync(ACTS) ? "ready" : "not ready yet"}): ${D.cards.length} cards; spent $${L.total()}`); process.exit(0); }
let cards = D.cards; // [{ line, i, card }]

// ---- 2. compile + render (a set of shot ids) -> preview pngs
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const speakerOf = (line) => { const s = script.lines[line - 1].speaker; return s && !/^(narrator|)$/i.test(s) ? s : null; };
const py = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
async function render(tag, shots) {
  const dir = path.join(OUT, `render_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  // each shot gets 2 s of its own (a word a second, the still is the middle frame): times only matter inside the shot
  const N = shots.length;
  const body = (s) => compileCard(s.card, { plan, speaker: speakerOf(s.line), speech: Boolean(speakerOf(s.line)) }).split("\n").map((l) => `    ${l}`).join("\n");
  const src = [`"""Round 2 storyboard ${ID} ${tag}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "",
    ...shots.map((s, k) => `@S(${k + 1}, ${2 * k}, ${k + 1 < N ? 2 * (k + 1) : "None"}, ${JSON.stringify(`L${s.line}.${s.i + 1} ${s.card.camera}: ${s.card.must_see}`.slice(0, 160))})\ndef s${String(k + 1).padStart(3, "0")}(t0, t1):\n${body(s)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 1 }, (_, i) => ({ word: `w${i}`, start: i * 1.0, end: i * 1.0 + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "storyboard\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(2 * N + 1), path.join(dir, "video", "audio", "voice.wav")]);
  const jobs = N > 30 ? 3 : N > 12 ? 2 : 1;
  const groups = Array.from({ length: jobs }, (_, g) => shots.map((_, k) => k + 1).filter((id) => id % jobs === g % jobs)).filter((g) => g.length);
  const limit = (g) => g.length * 14 + 240;
  const worst = groups.reduce((a, g) => a + (limit(g) + BOOT_S) * RATE, 0);
  L.check(`render ${tag}`, worst);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round2-${ID}-${tag}-${Date.now().toString(36)}`, log: say });
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  const res = await Promise.all(groups.map(async (g, gi) => {
    const r = await R.job(`board ${ID} ${tag}.${gi} (${g.length})`, { role: "preview", slug: "board", videoUrl: url, shots: g.join(","), perSheet: 30, cols: 10, samples: 16, upload: await R.signPuts(`p${gi}.tgz`, 2) }, { maxRunSec: limit(g), ledgerKey: "runpod_preview" });
    if (!r.ok) return { ok: false, error: String(r.error).slice(0, 300) };
    const jd = path.join(dir, `job${gi}`); fs.mkdirSync(jd, { recursive: true });
    await R.fetchParts(`p${gi}.tgz`, r.output.upload.parts, path.join(jd, "p.tgz"));
    py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(jd, "p.tgz"), jd);
    return { ok: true, gi, failed: r.output.failed ?? {}, gate: r.output.gate ?? [] };
  }));
  await R.cleanup().catch(() => {});
  const bad = res.filter((x) => !x.ok);
  if (bad.length) throw new Error(`render failed: ${bad.map((b) => b.error).join(" | ")}`);
  // the stills by shot (local index k+1 -> the shot's key)
  const pngs = {}, failed = {};
  for (const x of res) {
    for (const [k, v] of Object.entries(x.failed)) failed[shots[Number(k) - 1].key] = String(v).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300);
    const pd = path.join(dir, `job${x.gi}`, "preview");
    if (fs.existsSync(pd)) for (const f of fs.readdirSync(pd)) { const m = f.match(/^shot_(\d+)\.png$/); if (m) pngs[shots[Number(m[1]) - 1].key] = path.join(pd, f); }
  }
  const out = { pngs, failed, gate: res.flatMap((x) => x.gate) };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`render ${tag}: ${Object.keys(pngs).length}/${N} stills, ${Object.keys(failed).length} crashed; spent $${L.total()}`);
  return out;
}

// ---- 3. the checker with eyes (batches of 8 stills)
const CHECK_SCHEMA = { type: "object", additionalProperties: false, required: ["shots"], properties: { shots: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "ok", "problem"], properties: { id: { type: "integer" }, ok: { type: "boolean" }, problem: { type: "string" } } } } } };
async function vision(batch) {
  const content = [{ type: "text", text: `You check storyboard stills of a Roblox-style blocky 3D story video (9:16). For EACH numbered picture answer: does it CLEARLY show its MUST SEE (the named person / thing / action, in frame and big enough to read)? Also FAIL a picture that is blurry, too dark to read, mostly one flat surface or wall, or where the main subject is cut off or hidden. Be strict but fair: a blocky stand-in for a thing counts if it reads as that thing. problem: one short sentence (what is wrong, or "" when ok).` }];
  for (const b of batch) {
    content.push({ type: "text", text: `PICTURE ${b.n}: line "${b.text}" | MUST SEE: ${b.must_see} | camera: ${b.camera}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: fs.readFileSync(b.png).toString("base64") } });
  }
  content.push({ type: "text", text: "Return the JSON: one entry per picture, id = its PICTURE number." });
  L.check("vision", 0.06);
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 3000, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema: CHECK_SCHEMA } } }) });
  const j = await r.json();
  L.add("vision", costOf("claude-sonnet-5-5", j.usage));
  if (!r.ok) throw new Error(`vision ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return JSON.parse((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("")).shots;
}
async function check(shots, pngs, failed) {
  const verdict = {};
  for (const s of shots) if (failed[s.key] || !pngs[s.key]) verdict[s.key] = { ok: false, problem: `the shot crashed in Blender: ${failed[s.key] ?? "no still"}` };
  const todo = shots.filter((s) => !verdict[s.key]);
  for (let k = 0; k < todo.length; k += 8) {
    const batch = todo.slice(k, k + 8).map((s, j) => ({ n: j + 1, key: s.key, png: pngs[s.key], text: script.lines[s.line - 1].text, must_see: s.card.must_see, camera: s.card.camera }));
    const v = await vision(batch);
    for (const b of batch) { const a = v.find((x) => x.id === b.n); verdict[b.key] = { ok: Boolean(a?.ok), problem: a?.problem ?? "no answer" }; }
  }
  return verdict;
}

// ---- the loop: render all, check, re-direct the failing lines (max 2 tries), re-render those lines
const keyOf = (x) => `${x.line}.${x.i}`;
let state = load("state.json") ?? { round: 0, verdict: {}, pngs: {}, tries: {} };
const all = () => shotsOf(script, cards).shots.map((s) => ({ ...s, key: keyOf(s) }));
if (state.round === 0) {
  const shots = all();
  const r = await render("r0", shots);
  state.pngs = { ...r.pngs };
  state.verdict = await check(shots, r.pngs, r.failed);
  state.round = 1; save("state.json", state);
}
for (let round = state.round; round <= 2; round++) {
  const failingLines = [...new Set(Object.entries(state.verdict).filter(([, v]) => !v.ok).map(([k]) => Number(k.split(".")[0])))];
  const pass = Object.values(state.verdict).filter((v) => v.ok).length;
  say(`round ${round}: ${pass}/${Object.keys(state.verdict).length} pass; ${failingLines.length} line(s) to re-direct`);
  if (!failingLines.length) break;
  // re-direct each failing line with the check's words (the cards of that line are replaced)
  for (const line of failingLines) {
    const prev = cards.filter((x) => x.line === line).map((x) => x.card);
    const fb = cards.filter((x) => x.line === line).map((x) => { const v = state.verdict[keyOf(x)]; return `card ${x.i + 1} (${x.card.camera}, MUST SEE "${x.card.must_see}"): ${v?.ok ? "ok" : `FAILED: ${v?.problem}`}`; }).join("; ");
    L.check("redirect", 0.05);
    const r = await redirectLine({ callJson, apiKey: KEY, plan, script, line, previous: prev, feedback: fb });
    L.add("director", r.costUsd);
    if (r.cards.length) {
      cards = [...cards.filter((x) => x.line !== line), ...r.cards.map((card, i) => ({ line, i, card }))];
      for (const k of Object.keys(state.verdict)) if (k.startsWith(`${line}.`)) { delete state.verdict[k]; delete state.pngs[k]; }
    }
  }
  const shots = all().filter((s) => failingLines.includes(s.line));
  const r = await render(`r${round}`, shots);
  Object.assign(state.pngs, r.pngs);
  Object.assign(state.verdict, await check(shots, r.pngs, r.failed));
  state.round = round + 1; save("state.json", state); save("cards.json", cards);
}
// ---- the sheet: every shot's still, its line under it, MUST SEE, pass / fail
const shots = all();
const rows = shots.map((s) => ({ id: s.id, line: s.line, text: script.lines[s.line - 1].text, must_see: s.card.must_see, camera: s.card.camera, png: state.pngs[s.key] ?? null, ok: Boolean(state.verdict[s.key]?.ok), problem: state.verdict[s.key]?.problem ?? "" }));
save("board.json", { title: script.title, rows });
spawnSync("python", [path.join(HERE, "boardSheet.py"), path.join(OUT, "board.json"), path.join(OUT, `storyboard_${ID}.jpg`)], { stdio: "inherit" });
const pass = rows.filter((r) => r.ok).length;
say(`storyboard ${ID}: ${pass}/${rows.length} shots pass (${Math.round((100 * pass) / rows.length)}%); close-ups ${rows.filter((r) => r.camera === "close").length}; spent $${L.total()} of $5 (round total)`);
