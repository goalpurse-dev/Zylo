// Blender kit engine (Studio-Blender): one video, fully automatic after the script. Driver for the owner test and the
// shape the worker step (steps.mjs) follows.
//   1. the script + the narrator take come from the run dir (engine/dev/studio/prepare.mjs --studio: OUR production
//      writer in Studio "no refusals" mode, Scruffy Duck on eleven_v3, studio/pace.mjs 1.25x + pause cuts; optionally
//      trim.mjs). Script approval: auto-approved for the owner test and logged.
//   2. the director (director.mjs) plans + writes shots.py in batches; the static pre-check (shotcheck.py)
//   3. previews on the Blender endpoint (the kit's preview mode + the kit's contact sheets), the free pixel check,
//      the fixed vision checker; at most `rounds` (2) fix rounds, each re-previewing only the fixed shots
//   4. a shot that still crashes is merged into its neighbour (never a hole in the final)
//   5. the final in parallel chunks + the kit's finish (cues, mix with OUR music, captions)
//   6. contact sheet + black / flat frame scan of the real encode; new builds that passed -> the library (pending)
// Every paid step is priced worst-case first on the run's ledger (studio/ledger.mjs, the same costs.json prepare.mjs
// used): the hard per-video cap (--cap) and the model cap (--agent-cap).
//   node pipeline.mjs --run <prepare out dir> [--voice-dir <trim dir>] [--model sonnet|opus] [--rounds 2] [--cap 5]
//                     [--agent-cap 2.5] [--chunks 6] [--slug plane_town] --yes
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger, stepTimes } from "../studio/ledger.mjs";
import { loadEnv } from "../engine/runpod/client.mjs";
import { makeDirector, systemPrompt, tileShots, assemble, staticCheck, wordLines, MODELS, BATCH } from "./director.mjs";
import { runpod, RATE, BOOT_S } from "./rp.mjs";
import { shotFrames, splitShots } from "./plan.mjs";
import { saveAsset, functionSource } from "./library.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const RUN = path.resolve(arg("run"));
const KIT = path.resolve(arg("kit", process.env.BLOCKY_WORLDS_KIT_DIR || path.join(REPO, "reference/blocky-worlds/roblox-story-kit/unzipped/roblox-story-kit")));
const FIX_PER_CALL = 10;
const SLUG = arg("slug", "plane_town"), ROUNDS = Math.min(2, Number(arg("rounds", 2))), K = Number(arg("chunks", 6));
const MODEL = MODELS[arg("model", "sonnet")] ?? MODELS.sonnet;
const L = ledger(RUN, { capUsd: Number(arg("cap", 5)), agentCapUsd: Number(arg("agent-cap", 2.5)) });
const OUT = path.join(RUN, "blender"); fs.mkdirSync(OUT, { recursive: true });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "pipeline.log"), l + "\n"); };
const py = (code, ...args) => { const r = spawnSync("python", ["-P", "-c", code, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }); if (r.status !== 0) throw new Error(`python: ${(r.stderr || r.stdout).slice(-600)}`); return r.stdout; };
const state = fs.existsSync(path.join(OUT, "state.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "state.json"), "utf8")) : {};
const save = () => fs.writeFileSync(path.join(OUT, "state.json"), JSON.stringify(state, null, 1));

// ---------------------------------------------------------------- inputs (script + take)
const vdirIn = arg("voice-dir") ? path.resolve(arg("voice-dir")) : path.join(RUN, "voice");
const script = fs.existsSync(path.join(vdirIn, "script.json")) ? JSON.parse(fs.readFileSync(path.join(vdirIn, "script.json"), "utf8")) : JSON.parse(fs.readFileSync(path.join(RUN, "results.json"), "utf8")).results[0].script;
const words = JSON.parse(fs.readFileSync(path.join(vdirIn, "words.json"), "utf8"));
const wav = path.join(vdirIn, "voice.wav");
const builds = fs.existsSync(path.join(RUN, "studio-builds.json")) ? JSON.parse(fs.readFileSync(path.join(RUN, "studio-builds.json"), "utf8")) : [];
const { line: lineOf, exact } = wordLines(script, words);
const dur = words[words.length - 1].end + 0.25;
say(`script "${script.title}": ${script.lines.length} lines, ${words.length} words, voice ${dur.toFixed(1)} s (words ${exact ? "match the lines" : "DO NOT match the lines: proportional"}); spent so far $${L.total()} of $${L.capUsd}`);
if (!state.approved) {
  // SCRIPT APPROVAL: the owner test auto-approves (logged); in the app the customer approves before the run starts
  state.approved = { at: new Date().toISOString(), by: "auto (owner test)", lines: script.lines.length, voiceDir: vdirIn };
  L.log({ step: "script_approval", auto: true, lines: script.lines.length, title: script.title });
  save();
}
if (!has("yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }

// overlap with the kit's example (it must not be a remake): shared 3-word runs and shared rare words
{
  const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  const ours = norm(script.lines.map((l) => l.text).join(" ")), theirs = norm(fs.readFileSync(path.join(KIT, "engine/videos/sneeze_teleport/script.txt"), "utf8").split("\n").filter((l) => !l.startsWith("#")).join(" "));
  const tri = (a) => new Set(a.slice(0, -2).map((_, i) => a.slice(i, i + 3).join(" ")));
  const t1 = tri(ours), t2 = tri(theirs), shared = [...t1].filter((x) => t2.has(x));
  const STOPW = new Set("the a an and to of in on it is was my me i you your he she his her we our they their at as for with that this but so then one up out all every if what when there".split(" "));
  const w2 = new Set(theirs), rare = [...new Set(ours)].filter((w) => !STOPW.has(w) && w.length > 3 && w2.has(w));
  state.overlap = { trigramsShared: shared, trigramShare: +(shared.length / Math.max(1, t1.size)).toFixed(3), contentWordsShared: rare };
  save();
  say(`overlap with sneeze_teleport: ${shared.length} shared 3-word runs (${(state.overlap.trigramShare * 100).toFixed(1)}%): ${shared.slice(0, 12).join(" | ") || "-"}; shared content words: ${rare.join(", ")}`);
}

const env = loadEnv();
// the worker passes its key in the environment (workerSteps.mjs, BLOCKY_WORLDS_KEYS_FROM_ENV); the laptop reads .env.local
const apiKey = process.env.ANTHROPIC_API_KEY || env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY;
if (!apiKey) throw new Error("no Anthropic key in .env.local");
const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/${path.basename(RUN)}-${Date.now().toString(36)}`, log: say });
// the GPU money still to come, reserved out of the model's room: previews (round 0 + the fix rounds) and the final
const finalWorst = () => { const n = Math.round(dur * 30); return (n * 2.5 + K * (300 + 60)) * RATE + Math.min(K, 3) * BOOT_S * RATE + (1800 + BOOT_S) * RATE; };
const previewWorst = (nShots, jobs) => (nShots * 10 + jobs * 300 + jobs * BOOT_S) * RATE;
const reserve = () => finalWorst() + (state.previewed ? 0 : previewWorst(70, 3)) + (ROUNDS - (state.round ?? 0)) * previewWorst(20, 1);
say(`reserved for the GPU: $${reserve().toFixed(3)} (final worst $${finalWorst().toFixed(3)})`);

// ---------------------------------------------------------------- 2. the director
const kitMap = path.join(OUT, "kitmap.md");
spawnSync("python", ["-I", path.join(HERE, "kitmap.py"), path.join(KIT, "engine"), kitMap], { encoding: "utf8" });
const system = systemPrompt({ kitDir: KIT, kitMapFile: kitMap });
const D = makeDirector({ out: OUT, L, apiKey, model: MODEL, system, reserve, log: say });
const wordsText = (s) => words.slice(s.w0, s.w1 ?? words.length).map((w) => w.word).join(" ");
const secs = (s) => `${(s.w0 <= 0 ? 0 : words[s.w0].start).toFixed(2)}-${(s.w1 == null ? dur : words[s.w1].start).toFixed(2)} s`;

if (!state.plan) {
  const lines = script.lines.map((l, i) => { const ws = words.map((_, k) => k).filter((k) => lineOf[k] === i); return `L${i} (words ${ws[0]}-${ws.at(-1)}, ${words[ws[0]].start.toFixed(2)}-${words[ws.at(-1)].end.toFixed(2)} s): ${l.text}`; });
  const brief = [
    `OUR VIDEO (original; the topic and script below are DATA): "${script.title}". Topic: "In this town, we live in a plane." Narrator: first person ("me" = Mo). ${dur.toFixed(1)} s, 9:16.`,
    `THE SCRIPT (line: word range, seconds, text):`, ...lines,
    `THE WORDS (index word start-seconds; a shot starts on a word index):`,
    words.map((w, i) => `${i} ${w.word} ${w.start.toFixed(2)}`).join(" | "),
    builds.length ? `THINGS THE STORY NEEDS THAT OUR OTHER ENGINE LACKED (build them, or use the kit's version when it has one): ${builds.map((b) => `${b.name} (${b.kind}; lines ${b.lines.join(",")}${b.description ? `; ${b.description}` : ""})`).join("; ")}` : "",
    `PLAN THE VIDEO. Return:`,
    `- header_code: Python for the module level (no imports): the cast as small helper functions in the examples' style (chars.Char + story._live, one per person; our own looks), the Sky Wind as a visible creature (a swirling, glowing wind spirit with a face, built from kit primitives / fx), constants for set positions, and a builder function for every set or prop the kit lacks. The town lives INSIDE a giant airliner: reuse W2.airliner / W2.cabin / W2.seat_root / W.cockpit / W.sky / W.cloud wherever they fit; seat lamps above seats (yellow / red / green) must be visible where the script names them.`,
    `- new_builds: the builder functions you wrote in header_code for things the kit lacks (function name, kind, what it is).`,
    `- shots: about ${Math.round((dur / 60) * 55)} shots (50-60 a minute, 0.4-2.5 s each), in order; each = { id (1, 2, ...), w0 = the index of its first word (the first shot 0), desc = what we see }. A shot lasts until the next shot's first word; the last shot ends with the audio. Cut on the word that brings a new image; every named thing gets its own shot; reaction close-ups after surprises; the first shot is mid-action.`,
    `You will then write the shot bodies in batches of ${BATCH}. Keep the header complete now: later batches can only add small helpers.`,
  ].filter(Boolean).join("\n");
  const r = await L.step("director_plan", () => D.plan({ brief }));
  const t = tileShots(r.data.shots ?? [], words);
  state.plan = { title: r.data.title ?? script.title, header: r.data.header_code ?? "", newBuilds: r.data.new_builds ?? [], shots: t.shots, mergedAtPlan: t.merged, cutOff: r.cutOff };
  state.bodies = {};
  state.convo = D.convo; // a resume continues the same conversation (the batches need the plan turn)
  save();
  say(`plan: ${t.shots.length} shots (${t.merged.length} too short, merged), ${state.plan.newBuilds.length} new builds (${state.plan.newBuilds.map((b) => b.function).join(", ")}), header ${state.plan.header.length} chars${r.cutOff ? " (CUT OFF)" : ""}`);
  if (!state.plan.header.trim() || !t.shots.length) throw new Error("the plan came back without a header or shots");
} else D.convo.push(...(state.convo ?? []));

const plan = state.plan;
const shotById = (id) => plan.shots.find((s) => s.id === id);
/** shots that cannot render join their neighbour: the shot before runs on to the next shot's first word (the new first
 *  shot starts at word 0); never a hole in the timeline */
function mergeOut(ids, why) {
  if (!ids.length) return;
  if (ids.length >= plan.shots.length) throw new Error("every shot failed: nothing to merge into");
  plan.shots = plan.shots.filter((s) => !ids.includes(s.id));
  plan.shots.forEach((s, i) => { if (i === 0) s.w0 = 0; s.w1 = i + 1 < plan.shots.length ? plan.shots[i + 1].w0 : null; });
  for (const id of ids) delete state.bodies[id];
  (state.merged ??= []).push(...ids.map((id) => ({ id, why })));
  save();
  say(`merged ${ids.length} shot(s) into their neighbours (${why}): ${ids.join(", ")}`);
}
const writeFile = () => assemble({ title: plan.title, header: plan.header, shots: plan.shots, bodies: state.bodies, slug: SLUG });

// batches of <= BATCH shots; a cut-off batch keeps its complete shots, the rest go into the next call
for (let guard = 0; guard < 30; guard++) {
  const todo = plan.shots.filter((s) => !state.bodies[s.id]);
  if (!todo.length) break;
  const batch = todo.slice(0, BATCH);
  const text = [`Write the bodies of shots ${batch.map((s) => s.id).join(", ")} (only these ids). For each shot: the inside of def sNN(t0, t1) (t0 / t1 = its start / end seconds), using the header's helpers and the kit. Keep each body short (about 8-25 lines) like the examples.`,
    ...batch.map((s) => `shot ${s.id} (${secs(s)}; words: "${wordsText(s)}"): ${s.desc}`)].join("\n");
  const r = await L.step("director_batch", () => D.bodies({ label: `batch_${batch[0].id}_${batch.at(-1).id}`, text }));
  let got = 0;
  for (const x of r.data.shots ?? []) if (batch.some((s) => s.id === x.id) && String(x.body ?? "").trim()) { state.bodies[x.id] = x.body; got++; }
  state.convo = D.convo; save();
  say(`batch ${batch[0].id}-${batch.at(-1).id}: ${got} of ${batch.length} bodies${r.cutOff ? " (cut off: the rest go next)" : ""}`);
  if (!got) throw new Error(`batch ${batch[0].id}-${batch.at(-1).id} returned no body`);
}

// the static pre-check; failing shots (or a failing header) get ONE writing fix before any GPU sees the file
const vdir = path.join(OUT, "video"); fs.mkdirSync(path.join(vdir, "audio"), { recursive: true });
fs.copyFileSync(wav, path.join(vdir, "audio", "voice.wav"));
fs.writeFileSync(path.join(vdir, "audio", "words.json"), JSON.stringify(words));
fs.writeFileSync(path.join(vdir, "script.txt"), script.lines.map((l) => l.text).join("\n") + "\n");
const shotsFile = path.join(vdir, "shots.py");
let sc = staticCheck(writeFile(), shotsFile);
if (!sc.ok && !state.prefixed) {
  state.prefixed = true;
  const bad = [...new Set(sc.problems.map((p) => p.shot))];
  const text = [`The static checker refused these parts of the file (it only allows the kit, math, random, Vector and D; no imports, os only as os.path.join(W.TEX, ...), no getattr / open / dunders / bpy.ops). Fix them.`,
    ...sc.problems.slice(0, 40).map((p) => `- ${p.shot == null ? "header" : `shot ${p.shot}`} line ${p.line}: ${p.problem}`),
    bad.includes(null) ? `Return the corrected header parts in header_append (they are added after the header and may redefine its functions).` : `header_append: "" unless a helper must change.`,
    ...bad.filter((x) => x != null).map((id) => `shot ${id} current body:\n${state.bodies[id]}`)].join("\n");
  const r = await L.step("director_prefix", () => D.fix({ label: "static_fix", text }));
  if (r.data.header_append?.trim()) plan.header += `\n\n# --- fix (static check)\n${r.data.header_append}`;
  for (const x of r.data.shots ?? []) if (shotById(x.id)) state.bodies[x.id] = x.body;
  state.convo = D.convo; save();
  sc = staticCheck(writeFile(), shotsFile);
}
if (!sc.ok) {
  const hdr = sc.problems.filter((p) => p.shot == null);
  if (hdr.length) throw new Error(`the header still fails the static check: ${hdr.map((p) => p.problem).join("; ")}`);
  mergeOut([...new Set(sc.problems.map((p) => p.shot))], "static");
  sc = staticCheck(writeFile(), shotsFile);
}
say(`static check: ${sc.ok ? "ok" : `${sc.problems.length} problem(s)`}, ${plan.shots.length} shots`);

// ---------------------------------------------------------------- 3. previews + checks + fix rounds
const tarVideo = (name) => {
  const file = path.join(OUT, name);
  py("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", file, vdir, "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  return file;
};
async function uploadVideo(tag) {
  fs.writeFileSync(shotsFile, writeFile());
  const tgz = tarVideo(`video_${tag}.tgz`);
  await R.putFile(`video_${tag}.tgz`, tgz, "application/gzip");
  return R.signGet(`video_${tag}.tgz`);
}
const PIX = "import sys,json,os\nfrom PIL import Image, ImageStat\nres={}\nfor f in sorted(os.listdir(sys.argv[1])):\n if f.startswith('shot_') and f.endswith('.png'):\n  im=Image.open(os.path.join(sys.argv[1],f)).convert('L')\n  st=ImageStat.Stat(im)\n  res[int(f[5:-4])]={'mean':round(st.mean[0],1),'std':round(st.stddev[0],1)}\nprint(json.dumps(res))";

/** a downloaded preview folder -> the job output it came with (the worker's own rules: failures from the kit's log, sheets of
 *  16 rendered shots in order) */
function rebuildPreviewOut(dir) {
  const log = fs.readFileSync(path.join(dir, "render_log_preview.txt"), "utf8").split("\n");
  const failed = {}; let cur = null;
  for (const l of log) {
    const m = l.match(/^shot (\d+) (ok|FAILED)/);
    if (m) { cur = m[2] === "FAILED" ? m[1] : null; if (cur) failed[cur] = []; continue; }
    if (cur && l.trim()) failed[cur].push(l);
  }
  const have = fs.readdirSync(path.join(dir, "preview")).map((f) => f.match(/^shot_(\d+)\.png$/)).filter(Boolean).map((m) => Number(m[1])).sort((a, b) => a - b);
  const sheets = [];
  for (let k = 0; k < have.length; k += 16) { const grp = have.slice(k, k + 16); const f = `sheet_${String(grp[0]).padStart(2, "0")}_${String(grp.at(-1)).padStart(2, "0")}.jpg`; if (fs.existsSync(path.join(dir, f))) sheets.push({ file: f, shots: grp }); }
  return { failed: Object.fromEntries(Object.entries(failed).map(([k, v]) => [k, v.slice(-6).join("\n").slice(0, 900)])), sheets, renderS: 0, rebuilt: true };
}

async function previewRound(tag, ids) {
  const url = await uploadVideo(tag);
  const groups = ids.length > 24 ? [0, 1, 2].map((g) => ids.filter((_, i) => i % 3 === g)) : [ids];
  const outs = await Promise.all(groups.map(async (g, gi) => {
    const name = `preview_${tag}_${gi}.tgz`;
    const dir = path.join(OUT, "previews", tag, String(gi)); fs.mkdirSync(dir, { recursive: true });
    // a resume: a preview already downloaded (its job's output saved next to it) is never paid for again
    if (fs.existsSync(path.join(dir, "out.json"))) return { ok: true, dir, ids: g, out: JSON.parse(fs.readFileSync(path.join(dir, "out.json"), "utf8")) };
    if (fs.existsSync(path.join(dir, "preview")) && fs.existsSync(path.join(dir, "render_log_preview.txt"))) return { ok: true, dir, ids: g, out: rebuildPreviewOut(dir) };
    const r = await R.job(`preview ${tag}.${gi} (${g.length} shots)`, { role: "preview", slug: SLUG, videoUrl: url, shots: g.join(","), perSheet: 16, cols: 8, upload: await R.signPuts(name, 2) }, { maxRunSec: g.length * 10 + 300, ledgerKey: "runpod_preview" });
    if (!r.ok) return { ok: false, error: r.error, ids: g };
    await R.fetchParts(name, r.output.upload.parts, path.join(dir, "p.tgz"));
    py("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
    fs.writeFileSync(path.join(dir, "out.json"), JSON.stringify(r.output));
    return { ok: true, dir, ids: g, out: r.output };
  }));
  const bad = outs.filter((o) => !o.ok);
  if (bad.length) throw new Error(`preview failed: ${bad.map((b) => String(b.error).slice(0, 400)).join(" | ")}`);
  const failed = {}, sheets = [], pixel = {};
  for (const o of outs) {
    Object.assign(failed, o.out.failed ?? {});
    for (const s of o.out.sheets ?? []) sheets.push({ file: path.join(o.dir, s.file), shots: s.shots });
    Object.assign(pixel, JSON.parse(py(PIX, path.join(o.dir, "preview"))));
    fs.mkdirSync(path.join(OUT, "previews", "latest"), { recursive: true });
    for (const f of fs.readdirSync(path.join(o.dir, "preview"))) fs.copyFileSync(path.join(o.dir, "preview", f), path.join(OUT, "previews", "latest", f));
  }
  // ids that did not render at all (no png) count as crashed
  for (const id of ids) if (!pixel[id] && !failed[id]) failed[id] = "no preview frame was rendered";
  const pixBad = Object.fromEntries(Object.entries(pixel).filter(([, p]) => p.mean < 12 || p.std < 4).map(([id, p]) => [id, p.mean < 12 ? `the frame is black (mean ${p.mean})` : `the frame is one flat colour (std ${p.std})`]));
  return { failed, sheets, pixel, pixBad, renderS: outs.reduce((a, o) => a + (o.out.renderS ?? 0), 0) };
}
async function vision(tag, sheets, ids) {
  if (!sheets.length) return {};
  const shots = plan.shots.filter((s) => ids.includes(s.id));
  const r = await L.step("vision_check", () => D.check({ label: `check_${tag}`, sheets, shots, wordsText }));
  return Object.fromEntries((r.data.shots ?? []).filter((x) => !x.ok).map((x) => [x.id, x.problem]));
}

state.rounds ??= [];
let failing = {};
if (!state.previewed) {
  const p = await L.step("preview_round0", () => previewRound("r0", plan.shots.map((s) => s.id)));
  const vis = await vision("r0", p.sheets, plan.shots.map((s) => s.id).filter((id) => !p.failed[id]));
  failing = mergeProblems(p, vis);
  state.previewed = true; state.round = 0;
  state.rounds.push({ round: 0, shots: plan.shots.length, crashed: Object.keys(p.failed).length, pixel: Object.keys(p.pixBad).length, vision: Object.keys(vis).length, failing: Object.keys(failing).length, sheets: p.sheets.map((s) => s.file) });
  state.failing = failing; save();
  say(`round 0: ${plan.shots.length} shots previewed: ${Object.keys(p.failed).length} crashed, ${Object.keys(p.pixBad).length} pixel, ${Object.keys(vis).length} vision -> ${Object.keys(failing).length} to fix`);
} else failing = state.failing ?? {};

function mergeProblems(p, vis) {
  const f = {};
  for (const [id, t] of Object.entries(p.failed)) f[id] = { kind: "crash", text: `the shot CRASHED in Blender: ${t}` };
  for (const [id, t] of Object.entries(p.pixBad)) if (!f[id]) f[id] = { kind: "pixel", text: t };
  for (const [id, t] of Object.entries(vis)) if (!f[id]) f[id] = { kind: "vision", text: `the checker saw: ${t}` };
  return f;
}

for (let round = (state.round ?? 0) + 1; round <= ROUNDS && Object.keys(failing).length; round++) {
  const ids = Object.keys(failing).map(Number).filter((id) => shotById(id));
  const prev = Object.fromEntries(ids.map((id) => [id, state.bodies[id]]));
  // crashes first; at most FIX_PER_CALL shots a call (fix round 1 of the first test sent 36 at once and hit the output limit)
  const order = [...ids].sort((a, b) => (failing[a].kind === "crash" ? 0 : 1) - (failing[b].kind === "crash" ? 0 : 1) || a - b);
  let skipped = null;
  for (let k = 0; k < order.length && !skipped; k += FIX_PER_CALL) {
    const part = order.slice(k, k + FIX_PER_CALL);
    const text = [`FIX ROUND ${round} of ${ROUNDS} (part ${k / FIX_PER_CALL + 1} of ${Math.ceil(order.length / FIX_PER_CALL)}). These shots failed in the preview (the kit's preview mode, middle frame at 25% res). Rewrite each body so it renders and reads clearly. Crashes first: read the traceback and use only kit functions and parameters from the toolkit map. If a header helper is broken, fix it in the added header code (it may redefine the function).`,
      ...part.map((id) => { const s = shotById(id); return `shot ${id} (${secs(s)}; words "${wordsText(s)}"; desc: ${s.desc})\nPROBLEM: ${failing[id].text}\nCURRENT BODY:\n${state.bodies[id]}`; })].join("\n\n");
    let r;
    try { r = await L.step(`director_fix_${round}`, () => D.fix({ label: `fix_round_${round}_${k / FIX_PER_CALL + 1}`, text })); }
    catch (e) { if (e.code !== "CAP") throw e; skipped = e.message; break; } // no money left for it: never a stop
    if (r.data.header_append?.trim()) plan.header += `\n\n# --- fix round ${round}\n${r.data.header_append}`;
    for (const x of r.data.shots ?? []) if (part.includes(x.id) && String(x.body ?? "").trim()) state.bodies[x.id] = x.body;
    state.convo = D.convo; save();
  }
  if (skipped && Object.values(prev).every((b, i) => state.bodies[ids[i]] === b)) {
    state.rounds.push({ round, skipped }); save();
    say(`round ${round} SKIPPED: the caps cannot fund it (${skipped}); going on to the final with ${ids.length} shot(s) still flagged`);
    break;
  }
  let c = staticCheck(writeFile(), shotsFile);
  if (!c.ok) { // a fix that breaks the static check: that shot keeps its previous body (the header part is dropped)
    for (const p of c.problems) if (p.shot != null && prev[p.shot]) state.bodies[p.shot] = prev[p.shot];
    if (c.problems.some((p) => p.shot == null)) plan.header = plan.header.split(`\n\n# --- fix round ${round}\n`)[0];
    c = staticCheck(writeFile(), shotsFile);
  }
  save();
  const p = await L.step(`preview_round${round}`, () => previewRound(`r${round}`, ids));
  const vis = await vision(`r${round}`, p.sheets, ids.filter((id) => !p.failed[id]));
  failing = mergeProblems(p, vis);
  state.round = round;
  state.rounds.push({ round, fixed: ids.length, crashed: Object.keys(p.failed).length, pixel: Object.keys(p.pixBad).length, vision: Object.keys(vis).length, failing: Object.keys(failing).length, sheets: p.sheets.map((s) => s.file) });
  state.failing = failing; save();
  say(`round ${round}: ${ids.length} shots re-previewed: ${Object.keys(p.failed).length} crashed, ${Object.keys(p.pixBad).length} pixel, ${Object.keys(vis).length} vision -> ${Object.keys(failing).length} still failing`);
}

// ---------------------------------------------------------------- 4. no holes: a shot that still crashes joins its neighbour
const crashed = Object.entries(failing).filter(([, f]) => f.kind === "crash").map(([id]) => Number(id));
if (crashed.length) mergeOut(crashed, "crash");
fs.writeFileSync(shotsFile, writeFile());
const fsc = staticCheck(writeFile(), shotsFile);
if (!fsc.ok) throw new Error(`the final shots.py fails the static check: ${JSON.stringify(fsc.problems).slice(0, 400)}`);

// ---------------------------------------------------------------- 5. the final (parallel) + the kit's finish
const frames = shotFrames(fs.readFileSync(shotsFile, "utf8"), words);
const NF = frames[frames.length - 1].f1, groups = splitShots(frames, K);
const chunkMax = (g) => Math.round(g.n * 2.5 + g.ids.length * 4 + 300);
const worstFinal = groups.reduce((a, g) => a + chunkMax(g), 0) * RATE + Math.min(K, 3) * BOOT_S * RATE + (1800 + BOOT_S) * RATE;
L.check("final render + finish (all jobs)", worstFinal);
say(`final: ${frames.length} shots, ${NF} frames in ${K} chunks (${groups.map((g) => `${g.shots}:${g.n}`).join(" ")}); worst case $${worstFinal.toFixed(3)}; spent $${L.total()}`);
const tFinal = Date.now();
const finalUrl = await uploadVideo("final");
state.chunks ??= {};
const res = await L.step("final_render", () => Promise.all(groups.map(async (g, i) => {
  if (state.chunks[i]?.done) return { ok: true };
  const name = `seg${String(i).padStart(2, "0")}.mp4`;
  const r = await R.job(`chunk ${i} (shots ${g.shots}, ${g.n} frames)`, { role: "render", slug: SLUG, videoUrl: finalUrl, shots: g.ids.join(","), f0: g.f0, f1: g.f1, upload: await R.signPuts(name, 4) }, { maxRunSec: chunkMax(g), ledgerKey: "runpod_final" });
  if (r.ok) { state.chunks[i] = { done: true, name, parts: r.output.upload.parts, out: r.output, execS: r.execS, bootS: r.bootS }; save(); say(`chunk ${i}: ${r.output.frames} frames in ${r.output.renderS} s (${r.output.sPerFrame} s/frame)`); }
  return r;
})));
const badC = res.filter((r) => !r.ok);
if (badC.length) throw new Error(`final chunks failed (no paid retry): ${badC.map((r) => String(r.error).slice(0, 500)).join(" | ")}`);
const renderWall = (Date.now() - tFinal) / 1000;
const segments = [];
for (let i = 0; i < groups.length; i++) segments.push(await R.signGetParts(state.chunks[i].name, state.chunks[i].parts));
const uploads = { "final.mp4": await R.signPuts("final.mp4", 4), "final_nocaptions.mp4": await R.signPuts("final_nocaptions.mp4", 4), "final_phone.mp4": await R.signPuts("final_phone.mp4", 2) };
const fin = await L.step("finish", () => R.job("finish", { role: "finish", slug: SLUG, videoUrl: finalUrl, frames: NF, segments, uploads, music: true }, { maxRunSec: 1800, ledgerKey: "runpod_final" }));
if (!fin.ok) throw new Error(`finish failed: ${String(fin.error).slice(0, 800)}`);
for (const [name, u] of Object.entries(fin.output.uploads)) await R.fetchParts(name, u.parts, path.join(OUT, name));
const finalWall = (Date.now() - tFinal) / 1000;
say(`final: ${path.join(OUT, "final.mp4")} (${fin.output.duration} s; cues ${fin.output.cues?.count}); render wall ${renderWall.toFixed(0)} s, with finish ${finalWall.toFixed(0)} s`);
await R.cleanup().catch((e) => say(`cleanup: ${e.message}`));

// ---------------------------------------------------------------- 6. contact sheet, black / flat frames, library
const sheet = path.join(OUT, "contact.jpg");
spawnSync("python", [path.join(HERE, "contact.py"), path.join(OUT, "final.mp4"), sheet], { encoding: "utf8" });
const SCAN = "import sys,json,subprocess\nfrom PIL import Image, ImageStat\nimport io\nsrc=sys.argv[1]\nraw=subprocess.run(['ffmpeg','-v','error','-i',src,'-vf','fps=4,scale=108:192,format=gray','-f','rawvideo','-'],capture_output=True).stdout\nn=108*192\nout=[]\nfor k in range(len(raw)//n):\n im=Image.frombytes('L',(108,192),raw[k*n:(k+1)*n])\n st=ImageStat.Stat(im)\n m,s=st.mean[0],st.stddev[0]\n if m<12 or s<4:\n  out.append({'t':round(k/4,2),'mean':round(m,1),'std':round(s,1)})\nprint(json.dumps({'samples':len(raw)//n,'bad':out}))";
const scan = JSON.parse(py(SCAN, path.join(OUT, "final_nocaptions.mp4")));
say(`frame scan (4 per second, no captions): ${scan.bad.length} black / flat of ${scan.samples}${scan.bad.length ? `: ${scan.bad.map((b) => b.t).join(", ")} s` : ""}`);
const passed = new Set(plan.shots.map((s) => s.id).filter((id) => !failing[id]));
const saved = [];
for (const b of plan.newBuilds ?? []) {
  const users = plan.shots.filter((s) => passed.has(s.id) && new RegExp(`\\b${b.function}\\s*\\(`).test(String(state.bodies[s.id] ?? "")));
  if (!users.length) continue;
  const code = functionSource(plan.header, b.function);
  if (!code) continue;
  const thumb = path.join(OUT, "previews", "latest", `shot_${String(users[0].id).padStart(2, "0")}.png`);
  saved.push(saveAsset({ name: b.function, kind: b.kind, about: b.about, code, source: { run: path.basename(RUN), shots: users.map((s) => s.id), title: plan.title }, thumbFrom: fs.existsSync(thumb) ? thumb : null }).id);
}
say(`library: ${saved.length} new build(s) saved PENDING the owner's approval: ${saved.join(", ") || "-"}`);

const report = { title: plan.title, slug: SLUG, model: MODEL, duration: fin.output.duration, shots: plan.shots.length, frames: NF, overlap: state.overlap, approved: state.approved,
  rounds: state.rounds, merged: state.merged ?? [], stillFailing: failing, costs: L.costs, total: L.total(), steps: stepTimes(RUN),
  final: { file: path.join(OUT, "final.mp4"), phone: path.join(OUT, "final_phone.mp4"), contact: sheet, renderWallS: +renderWall.toFixed(0), withFinishS: +finalWall.toFixed(0),
    chunks: Object.values(state.chunks).map((c) => ({ frames: c.out.frames, renderS: c.out.renderS, sPerFrame: c.out.sPerFrame, gpu: c.out.gpu?.renderer })), finish: { finishS: fin.output.finishS, cues: fin.output.cues } },
  frameScan: scan, library: saved, sandbox: fin.output.sandbox };
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
say(`done: $${L.total()} of $${L.capUsd}; report ${path.join(OUT, "report.json")}`);
