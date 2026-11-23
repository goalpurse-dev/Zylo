// PART C (owner 2026-11-23): TEST THE BUILDER on 10 hard stills + 3 move clips. Everything missing is made by the Part B
// pipeline (supabase/functions/_shared/blockyWorlds/builder.js -> worlds/builder.py): a planner call picks the place, the
// cast, the props and the moves (library first); each missing piece is one spec call (data only), tested alone next to a
// kid on a cheap still + a vision check, one retry with the reason, then saved to the library or logged as a miss (the
// scene is rewritten without it). No hand-made pieces: anything I fix by hand is listed in the report.
//   node --env-file=.env.local scripts/blockyWorlds/round9/builder9.mjs --out reference/blocky-worlds/round9/builder --yes --cap 3.0 [--only 1,2]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { callJson } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import * as B from "../../../supabase/functions/_shared/blockyWorlds/builder.js";
import { GEN_THINGS, GEN_PLACES } from "../../../supabase/functions/_shared/blockyWorlds/engineKitGenerated.js";
import { ledger } from "../studio/ledger.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const LIBDIR = path.join(HERE, "..", "library", "built");
const LOG = path.join(HERE, "..", "library", "builder_log.jsonl");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out", "reference/blocky-worlds/round9/builder")); fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(LIBDIR, { recursive: true });
const L = ledger(OUT, { capUsd: Number(arg("cap", 3.0)), agentCapUsd: Number(arg("cap", 3.0)) });
const KEY = process.env.ANTHROPIC_API_KEY;
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const meter = { check: (w, model) => L.check(`ai ${model}`, w), add: (c) => L.add("anthropic", c) };
if (!has("yes")) { say(`builder test: dry run (add --yes); spent $${L.total()}`); process.exit(0); }
const logBuild = (rec) => fs.appendFileSync(LOG, JSON.stringify(B.logRecord(rec)) + "\n");
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };

const ASKS = [
  "A bunker: Dad, Milo and Grandma underground, shelves of cans, a lantern, a ladder up to a hatch.",
  "The pizza guy inside a pizza shop: counter, oven, pizzas, a menu board, him sliding a pizza out.",
  "A dentist's room: a kid in the dentist chair, the dentist holding a mirror tool, a lamp over them.",
  "A kid riding a giant chicken through a market with fruit stalls.",
  "An astronaut kid planting a flag on the moon, a rover behind, Earth in the sky.",
  "Grandma knitting on a roof, her scarf so long it hangs down the whole building.",
  "A fisherman in a small rowing boat on a lake, pulling up a shark on his rod.",
  "A classroom: a teacher writing on the board, a kid asleep at a desk, a paper plane in the air.",
  "A firefighter on a ladder taking a cat out of a tree, a fire truck beside it.",
  "A birthday party: a robot butler serving a cake, balloons, presents, three kids cheering.",
];
const CLIPS = [
  { name: "slide_pizza_out_of_oven", description: "sliding a pizza out of an oven with a long wooden pizza peel: lean forward, both arms push the peel in, then pull it back out level and lift" },
  { name: "knitting", description: "knitting while sitting: both hands in front of the chest, the needles moving in small quick alternating strokes, the head looking down at the work" },
  { name: "pull_fishing_rod_hard", description: "pulling hard on a fishing rod: both hands high on the rod, leaning far back, heaving up in strong pulls, the knees bent" },
];
const LOOKS = {
  kid_red: { name: "Kid", kid: true, skin: "#F2C9A0", shirt: "#d62a1e", pants: "#c42a1c", hair: "spiky", hair_color: "#d4381c", face: "hero" },
  dad: { name: "Dad", kid: false, skin: "#efc29a", shirt: "#f4f4f4", pants: "#7fa8e0", hair: "short", hair_color: "#5a3a1e", face: "mustache", style: "dad" },
  pizza_guy: { name: "Guy", kid: false, skin: "#e0ac69", shirt: "#c0392b", pants: "#a93226", hair: "short", hair_color: "#1a1a1a", face: "kid" },
};
const library = () => { const out = {}; for (const k of ["prop", "character", "move", "place"]) { const d = path.join(LIBDIR, k); if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) out[`${k}:${f.replace(/\.json$/, "")}`] = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); } return out; };

// ---- 1. THE PLANNER (one call per still): library first, a build only for what the library lacks
const FEELS = ["happy", "scared", "terrified", "confident", "calm", "determined", "sad", "shocked", "curious", "angry", "loving", "relieved", "serious"];
const PLAN_SCHEMA = { type: "object", additionalProperties: false, required: ["place_library", "place_build", "time", "characters", "props", "camera_subjects", "camera_things", "signs"], properties: {
  signs: { type: "array", items: { type: "string" }, description: "the words on the place's signs (a library shop: [\"PIZZA\", \"PIZZA\", \"OVEN\"]); empty if none" },
  place_library: { type: "string", description: "a library place id, or empty to build one" },
  place_build: { type: "string", description: "if building: what the place is (one sentence: the room / spot, its furniture and set pieces)" },
  time: { type: "string", enum: ["day", "sunset", "night"] },
  characters: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "library_look", "build", "pos", "rot", "feel", "pose", "move_name", "move", "holds"], properties: {
    name: { type: "string" }, library_look: { type: "string", enum: ["", ...Object.keys(LOOKS)] }, build: { type: "string", description: "if not a library look: who they are and how they look" },
    pos: { type: "array", items: { type: "number" }, description: "x, y in metres" }, rot: { type: "number", description: "degrees turned from facing the camera (90 = facing right)" },
    feel: { type: "string", enum: FEELS }, pose: { type: "string", enum: ["", "sit", "cheer", "point", "wave", "reach", "hands_head"] },
    move_name: { type: "string" }, move: { type: "string", description: "if a new move: what the body does (empty for a library pose)" }, holds: { type: "string", description: "the name of the prop in their hands, or empty" } } } },
  props: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "library", "build", "size_cm", "hold", "pos", "z", "holder"], properties: {
    name: { type: "string" }, library: { type: "string", description: "a library thing, or empty to build" }, build: { type: "string", description: "if building: what it is and looks like" },
    size_cm: { type: "number" }, hold: { type: "string", enum: B.HOLDS }, pos: { type: "array", items: { type: "number" } }, z: { type: "number", description: "metres above the floor (0 on the ground)" }, holder: { type: "string" } } } },
  camera_subjects: { type: "array", items: { type: "string" } }, camera_things: { type: "array", items: { type: "string" } } } };
const PLAN_SYSTEM = (lib) => `You stage ONE STILL of a blocky Roblox-style video. Use the LIBRARY first; build only what it lacks.
LIBRARY PLACES: ${GEN_PLACES.join(", ")}. LIBRARY THINGS: ${GEN_THINGS.join(", ")}. LIBRARY LOOKS: ${Object.keys(LOOKS).join(", ")} (kid_red = a kid, dad = a dad with a moustache, pizza_guy).
ALREADY BUILT (free): ${Object.keys(lib).join(", ") || "none"}. LIBRARY POSES: sit, cheer, point, wave, reach, hands_head.
POSITIONS in metres: x to the right, y away from the camera. A BUILT place: its floor spans x -w/2..w/2, y 0..depth (you
describe the place; it is built about 7 x 6 m). A LIBRARY place: its stage centre is (0, 0), people stand within x -3..3,
y -1..4. Everyone in reach of what they act on (a hand at the oven, a foot on the ladder), nobody inside anything, people
a body width apart. Every prop that must be visible (the story's things) is listed; a held thing names its holder.
In the sky / high up: z in metres. One move per character at most (new moves only for actions the poses cannot show).
Every character acts with a FEEL. The camera subjects = the people and things the still is about.
CREATURES AND VEHICLES (a giant chicken, a shark, a cat, a robot, a boat, a fire truck) are PROPS you build (real size;
a giant one simply bigger): someone riding one = its hold "ridden" and holder = the rider; someone sitting in a boat or a
seat = hold "sat_in" and holder = who sits in it. A library place with signs: give its sign words (a pizza shop: PIZZA).
NEVER a library place that does not fit the still (no living room for a bunker): build the place instead.`;
async function planScene(k, ask) {
  const got = load(`plan_${k}.json`); if (got) return got;
  const r = await callJson({ apiKey: KEY, model: "claude-sonnet-5-5", system: [PLAN_SYSTEM(library())], user: `THE STILL: ${ask}`, schema: PLAN_SCHEMA, effort: "low", maxTokens: 6000, meter, cache: false });
  const plan = { ...r.data, costUsd: r.costUsd };
  save(`plan_${k}.json`, plan); say(`plan ${k}: $${r.costUsd} (${plan.place_library || "build: " + plan.place_build.slice(0, 60)}; ${plan.characters.length} people, ${plan.props.length} props)`);
  return plan;
}

// ---- 2. THE PIECES (dedup by name; the library first; Haiku first, the retry on Sonnet with the reason)
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
const pieces = load("pieces.json") ?? {};   // key -> { kind, name, asked, spec, tries: [{ model, cost, still, verdict }], status, extra }
async function specFor(kind, name, asked, feedback = "", model = "claude-haiku-5-5", hint = {}) {
  const fn = { prop: B.buildProp, character: B.buildCharacter, move: B.buildMove, place: B.buildPlace }[kind];
  const orig = B.SPEC_MODEL;
  const cj = (o) => callJson({ ...o, model });
  const r = await fn({ callJson: cj, apiKey: KEY, name, description: asked, sizeHint: hint.size ?? null, hold: hint.hold ?? null, keep: hint.keep ?? null, feedback, meter });
  void orig;
  return r;
}
function need(kind, name, asked, hint = {}) {
  const key = `${kind}:${slug(name)}`;
  const lib = library()[key];
  if (lib) { pieces[key] ??= { kind, name: slug(name), asked, spec: lib.spec, status: "library", tries: [], hint }; return key; }
  pieces[key] ??= { kind, name: slug(name), asked, spec: null, status: "new", tries: [], hint };
  return key;
}

// ---- 3. GPU STILLS (one job): the test pieces / the finals
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py", "worlds/stage9.py", "worlds/stage9b.py", "worlds/stage9c.py", "worlds/stage9d.py", "worlds/stage9e.py", "worlds/stage9f.py", "worlds/stage9g.py", "worlds/stage9h.py", "worlds/stage9i.py", "worlds/builder.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const HEAD = (t) => [`"""${t}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, ""];
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
const BOFF = 70;
async function gpuStills(tag, bodies, { full = false } = {}) {
  const dir = path.join(OUT, `job_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8"));
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const N = bodies.length;
  const src = [...HEAD(`builder ${tag}`), full ? "" : "ZW_PREVIEW.update(pct=30, samples=6)", "",
    `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
    ...bodies.map((b, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(b.label)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n${ind(b.code)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check ${tag}: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : BOFF + (i - 1), end: (i === 0 ? 0 : BOFF + (i - 1)) + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "builder\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(BOFF + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
  if (has("check-only")) { say(`${tag}: static check ok (${N}), not sent`); return null; }
  const limit = N * (full ? 70 : 30) + 300;
  L.check(`stills ${tag}`, (limit + BOOT_S) * RATE);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/builder-${tag}-${Date.now().toString(36)}`, log: say });
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const rr = await R.job(`${tag} (${N})`, { role: "preview", slug: "scenes", videoUrl: await R.signGet("v.tgz"), shots: bodies.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, ...(full ? {} : { samples: 6 }), upload: await R.signPuts("p.tgz", full ? 4 : 2) }, { maxRunSec: limit, ledgerKey: `runpod_${tag}` });
  if (!rr.ok) { await R.cleanup().catch(() => {}); throw new Error(`${tag} failed: ${String(rr.error).slice(0, 300)}`); }
  await R.fetchParts("p.tgz", rr.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  const pngs = {};
  for (const f of fs.readdirSync(path.join(dir, "preview"))) { const m = f.match(/^shot_(\d+)\.png$/); if (m && Number(m[1]) >= 2) pngs[bodies[Number(m[1]) - 2].key] = path.join(dir, "preview", f); }
  const out = { pngs, gate: rr.output.gate ?? [], failed: rr.output.failed ?? {} };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`${tag}: ${Object.keys(pngs).length}/${N} stills, ${Object.keys(out.failed).length} crashed; spent $${L.total()}`);
  return out;
}
const small = (png) => { const tmp = png.replace(/\.png$/, "_s.jpg"); execFileSync("ffmpeg", ["-v", "error", "-y", "-i", png, "-vf", "scale=360:-1", "-q:v", "4", tmp]); return fs.readFileSync(tmp).toString("base64"); };
const accOf = (pc) => (pc.extra?.accessories ?? []).map((k) => pieces[k]).filter((x) => x?.spec && x.status !== "missed");
const testBody = (key) => {
  const pc = pieces[key];
  const extra = pc.kind === "character" ? `[${accOf(pc).map((a) => `(${B.pyData(a.spec)}, ${JSON.stringify(a.spec.hold || "worn_head")})`).join(", ")}]`
    : pc.kind === "place" ? `{${(pc.extra?.furniture ?? []).map((k) => pieces[k]).filter((x) => x?.spec).map((x) => `${JSON.stringify(x.extra.fname)}: ${B.pyData(x.spec)}`).join(", ")}}`
    : pc.kind === "move" ? `{"props": [${(pc.extra?.props ?? []).map((k) => pieces[k]).filter((x) => x?.spec).map((x) => B.pyData(x.spec)).join(", ")}], "support": ${pieces[pc.extra?.support]?.spec ? B.pyData(pieces[pc.extra.support].spec) : "None"}}` : "None";
  return { key, label: `test ${key}`, code: `zb_test_piece(${JSON.stringify(pc.kind)}, ${B.pyData(pc.spec)}, t0, t1, ${extra})` };
};
async function testRound(tag, keys) {
  if (!keys.length) return;
  const r = await gpuStills(tag, keys.map(testBody));
  if (!r) return;
  for (const key of keys) {
    const pc = pieces[key], png = r.pngs[key];
    if (!png) { pc.tries.at(-1).verdict = { ok: false, reason: "the test still crashed" }; continue; }
    const size = pc.kind === "prop" ? pc.spec.real_size_cm : pc.kind === "character" ? pc.spec.height_cm : null;
    const short = (pc.short ?? pc.name).replace(/^place_\d+_/, "").replace(/_/g, " ");
    const listed = pc.kind === "place" ? (pc.spec.furniture ?? []).map((f) => f.name).join(", ") : "";
    const thing = pc.kind === "move" ? `a kid ${pc.asked}` : pc.kind === "place" ? `${pc.asked.split(/[,.:;]/)[0]} (listed: ${listed})` : pc.kind === "character" ? `a ${short}` : `a ${short}`;
    const v = await B.visionCheck({ callJson, apiKey: KEY, imageB64: small(png), thing, kind: pc.kind, sizeCm: size, meter });
    pc.tries.at(-1).verdict = v; pc.tries.at(-1).still = png; pc.tries.at(-1).visionCost = v.costUsd;
    say(`  ${key}: ${v.ok ? "PASS" : "FAIL"} ($${v.costUsd}) ${v.reason}`);
  }
  save("pieces.json", pieces);
}

// ---- THE RUN
if (has("things")) {
  const want = JSON.parse(fs.readFileSync(arg("things"), "utf8"));
  const keys = want.map((w) => { const k = need("prop", w.name, w.description, { size: w.size_cm, hold: w.hold }); pieces[k].short = w.name; return k; });
  await specs(keys.filter((k) => pieces[k].status === "new"), "claude-haiku-5-5");
  const t1 = keys.filter((k) => pieces[k].status === "built");
  await testRound("things1", t1);
  for (const k of t1) if (!pieces[k].tries.at(-1)?.verdict?.ok) pieces[k].status = "retry";
  await specs(keys.filter((k) => pieces[k].status === "retry"), "claude-sonnet-5-5");
  const t2 = keys.filter((k) => pieces[k].status === "built" && pieces[k].tries.length > 1 && !pieces[k].tries.at(-1)?.verdict);
  await testRound("things2", t2);
  const out = [];
  for (const k of keys) {
    const pc = pieces[k]; if (pc.status === "library") { out.push({ name: pc.name, ok: true, from: "library", spec: pc.spec }); continue; }
    const ok = Boolean(pc.tries.at(-1)?.verdict?.ok);
    pc.tries.forEach((t, i) => logBuild({ kind: "prop", name: pc.name, asked: pc.asked, story: arg("story", "a story"), spec: i === pc.tries.length - 1 ? pc.spec : null, still: t.still ?? null, verdict: t.verdict ?? null, retry: i, costUsd: (t.cost ?? 0) + (t.visionCost ?? 0), outcome: i < pc.tries.length - 1 ? "retried" : ok ? "saved" : "missed", library: ok ? k : null }));
    if (ok) { fs.mkdirSync(path.join(LIBDIR, "prop"), { recursive: true }); fs.writeFileSync(path.join(LIBDIR, "prop", `${pc.name}.json`), JSON.stringify({ name: pc.name, kind: "prop", asked: pc.asked, spec: pc.spec, still: pc.tries.at(-1).still, cost_usd: pc.tries.reduce((a, t) => a + (t.cost ?? 0) + (t.visionCost ?? 0), 0) }, null, 1)); pc.status = "saved"; } else pc.status = "missed";
    pc.logged = true;
    out.push({ name: pc.name, ok, spec: pc.spec, cost: pc.tries.reduce((a, t) => a + (t.cost ?? 0) + (t.visionCost ?? 0), 0), reason: pc.tries.at(-1)?.verdict?.reason ?? "", still: pc.tries.at(-1)?.still ?? null });
  }
  save("pieces.json", pieces); save("things_result.json", out);
  say(`THINGS: ${out.filter((x) => x.ok).length}/${out.length} built; spent $${L.total()}`);
  process.exit(0);
}
if (has("reset-missed")) { for (const pc of Object.values(pieces)) { if (pc.status !== "missed" || !pc.spec) continue; pc.status = "built"; pc.tries = [{ model: "kept", cost: 0, problems: [] }]; delete pc.logged; } for (const d of ["job_test1", "job_test2", "job_finals", "clips"]) fs.rmSync(path.join(OUT, d), { recursive: true, force: true }); save("pieces.json", pieces); say("reset-missed: last round's misses re-tested with the new check (no new spec first)"); }
if (has("reset")) { for (const pc of Object.values(pieces)) { if (pc.status === "library" || !pc.spec) continue; pc.status = "built"; pc.tries = [{ model: "kept", cost: 0, problems: [] }]; delete pc.logged; } for (const d of ["job_test1", "job_test2", "job_finals"]) fs.rmSync(path.join(OUT, d), { recursive: true, force: true }); save("pieces.json", pieces); say("reset: the existing specs re-tested (no new spec calls)"); }
if (has("retest")) { const keys = arg("retest").split(","); const r = await gpuStills(arg("tag", "dbg"), keys.map(testBody)); for (const g of (r?.gate ?? []).filter((g) => /builder|skipped/.test(g))) console.log(g); process.exit(0); }
const only = arg("only") ? arg("only").split(",").map(Number) : ASKS.map((_, k) => k + 1);
const plans = {};
for (const k of only) plans[k] = await planScene(k, ASKS[k - 1]);
// the pieces each plan needs
for (const [k, p] of Object.entries(plans)) {
  if (!p.place_library) {
    const key = need("place", `place_${k}`, p.place_build); pieces[key].extra ??= { scene: Number(k) };
  }
  for (const c of p.characters) {
    if (!c.library_look && c.build) { const key = need("character", c.name, c.build); pieces[key].extra ??= { accessories: [] }; }
    if (c.move) need("move", c.move_name || `${c.name}_move`, c.move);
  }
  for (const pr of p.props) if (!pr.library || !GEN_THINGS.includes(pr.library)) need("prop", pr.name, pr.build || pr.name, { size: pr.size_cm, hold: pr.hold });
}
for (const c of CLIPS) need("move", c.name, c.description);
// spec pass 1 (Haiku), then the second-level pieces (accessories, furniture), then the test
async function specs(keys, model) {
  for (const key of keys) {
    const pc = pieces[key];
    if (pc.spec && pc.status !== "retry") continue;
    const fb = pc.status === "retry" ? (pc.tries.at(-1)?.verdict?.reason ?? "") : "";
    const r = await specFor(pc.kind, pc.name, pc.asked, fb, model, { ...(pc.hint ?? {}), keep: pc.kind === "place" && pc.spec ? (pc.spec.furniture ?? []).map((f) => f.name) : null });
    pc.tries.push({ model, cost: r.costUsd, problems: r.problems });
    if (!r.ok) { pc.status = "missed"; say(`  ${key}: the spec failed its check (${r.problems.join("; ")})`); continue; }
    pc.spec = r.spec; pc.status = "built";
    if (pc.kind === "character") for (const a of r.spec.accessories ?? []) { const ak = need("prop", `${pc.name}_${a.name}`, a.description, { size: a.real_size_cm, hold: a.worn }); pc.extra.accessories = [...new Set([...(pc.extra.accessories ?? []), ak])]; }
    if (pc.kind === "move") {
      pc.extra = { ...(pc.extra ?? {}), props: [] };
      for (const q of r.spec.props ?? []) { const k = need("prop", `${pc.name}_${q.name}`, q.description, { size: q.real_size_cm, hold: q.hold }); pieces[k].short = q.name; pc.extra.props.push(k); }
      const SUP = { chair: ["a simple wooden chair to sit on", 90, "sat_in"], stool: ["a round wooden stool to sit on", 50, "sat_in"], boat: ["a small wooden rowing boat with a seat in the middle", 300, "sat_in"], ladder: ["a tall wooden ladder", 300, "on_ground"] }[r.spec.support];
      if (SUP) { const k = need("prop", `support_${r.spec.support}`, SUP[0], { size: SUP[1], hold: SUP[2] }); pieces[k].short = r.spec.support; pc.extra.support = k; }
    }
    if (pc.kind === "place") for (const f of r.spec.furniture ?? []) { if (f.library && GEN_THINGS.includes(f.library)) continue; const fk = need("prop", `${pc.name}_${f.name}`, f.description, { size: f.real_size_cm, hold: "on_ground" }); pieces[fk].extra = { fname: f.name }; pieces[fk].short = f.name; pc.extra.furniture = [...new Set([...(pc.extra.furniture ?? []), fk])]; }
    say(`  ${key}: spec by ${model} ($${r.costUsd})${r.problems.length ? " " + r.problems.join("; ") : ""}`);
  }
  save("pieces.json", pieces);
}
const newKeys = () => Object.keys(pieces).filter((k) => ["new", "retry"].includes(pieces[k].status));
await specs(newKeys(), "claude-haiku-5-5");
await specs(newKeys(), "claude-haiku-5-5");   // (the accessories / furniture the first pass asked for)
const toTest1 = Object.keys(pieces).filter((k) => pieces[k].status === "built" && !pieces[k].tries.at(-1)?.verdict);
await testRound("test1", toTest1);
for (const k of toTest1) if (pieces[k].tries.at(-1)?.verdict && !pieces[k].tries.at(-1).verdict.ok) pieces[k].status = "retry";
await specs(Object.keys(pieces).filter((k) => pieces[k].status === "retry"), "claude-sonnet-5-5");
const toTest2 = Object.keys(pieces).filter((k) => pieces[k].status === "built" && pieces[k].tries.length > 1 && !pieces[k].tries.at(-1)?.verdict);
await testRound("test2", toTest2);
// save what passed, log everything (one record per try)
for (const [key, pc] of Object.entries(pieces)) {
  if (pc.status === "library" || pc.logged) continue;
  const last = pc.tries.at(-1), ok = Boolean(last?.verdict?.ok);
  pc.tries.forEach((t, i) => logBuild({ kind: pc.kind, name: pc.name, asked: pc.asked, story: "builder test (Part C)", spec: i === pc.tries.length - 1 ? pc.spec : null, still: t.still ?? null, verdict: t.verdict ?? null, retry: i, costUsd: (t.cost ?? 0) + (t.visionCost ?? 0), outcome: i < pc.tries.length - 1 ? "retried" : ok ? "saved" : "missed", library: ok ? key : null }));
  if (ok) { fs.mkdirSync(path.join(LIBDIR, pc.kind), { recursive: true }); fs.writeFileSync(path.join(LIBDIR, pc.kind, `${pc.name}.json`), JSON.stringify({ name: pc.name, kind: pc.kind, asked: pc.asked, spec: pc.spec, still: last.still, cost_usd: pc.tries.reduce((a, t) => a + (t.cost ?? 0) + (t.visionCost ?? 0), 0) }, null, 1)); pc.status = "saved"; }
  else pc.status = "missed";
  pc.logged = true;
}
save("pieces.json", pieces);

// ---- 4. THE 10 STILLS (1080x1920): each scene from its plan + the saved pieces; a missed piece is left out (rewritten)
const P = (kind, name) => { const pc = pieces[`${kind}:${slug(name)}`]; return pc && ["saved", "library"].includes(pc.status) ? pc : null; };
const sceneData = (k, p) => {
  const rewritten = [];
  const pk = pieces[`place:place_${k}`];
  const place = p.place_library ? null : (P("place", `place_${k}`) ?? (pk?.spec ? pk : null));
  if (!p.place_library && !P("place", `place_${k}`)) rewritten.push(pk?.spec ? "the place failed its check: its own shell + furniture used (logged)" : "no place spec: a plain shell");
  const shell = { name: `shell_${k}`, kind: /lake|sea|river|water/i.test(p.place_build) ? "water" : /roof|moon|market|street|garden|outside|park/i.test(p.place_build) ? "outdoor" : /bunker|underground|cave/i.test(p.place_build) ? "underground" : "room", size_m: [8, 7, 4], floor: "#7d7468", walls: "#b9ad9a", light: p.time === "night" ? "night" : "daylight", furniture: [], zones: [] };
  const props_built = {};
  if (place) for (const fk of place.extra?.furniture ?? []) { const f = pieces[fk]; if (f?.spec && f.status !== "missed") props_built[f.extra.fname] = f.spec; }
  const S = { time: p.time, tag: `SC${k}`, signs: p.signs ?? [], ...(p.place_library ? { place_library: p.place_library } : { place_built: place ? place.spec : shell, props_built }), characters: [], props: [], camera: { subjects: p.camera_subjects, things: p.camera_things } };
  for (const c of p.characters) {
    const ch = { name: c.name, pos: c.pos, rot: c.rot, feel: c.feel, pose: c.pose };
    if (c.library_look) ch.look = { ...LOOKS[c.library_look], name: c.name };
    else { const pc = P("character", c.name); if (pc) { ch.built = pc.spec; ch.accessories_built = accOf(pc).map((a) => a.spec); } else { ch.look = { ...LOOKS.kid_red, name: c.name }; rewritten.push(`${c.name}: a library look (the built character missed)`); } }
    if (c.move) { const mv = P("move", c.move_name || `${c.name}_move`); if (mv) ch.move_built = mv.spec; else rewritten.push(`${c.name}: no move (missed)`); }
    S.characters.push(ch);
  }
  for (const pr of p.props) {
    const lib = pr.library && GEN_THINGS.includes(pr.library);
    const pc = lib ? null : P("prop", pr.name);
    if (!lib && !pc) { rewritten.push(`${pr.name}: left out (missed)`); continue; }
    S.props.push({ name: pr.name, ...(lib ? { library: pr.library } : { built: pc.spec }), at: { pos: pr.pos, z: pr.z || null, holder: pr.holder || null } });
  }
  return { S, rewritten };
};
const finals = only.map((k) => ({ k, ...sceneData(k, plans[k]) }));
save("finals.json", finals);
const fin = await gpuStills("finals", finals.map((f) => ({ key: `still_${f.k}`, label: `still ${f.k}`, code: `zb_scene(${B.pyData(f.S)}, t0, t1)` })), { full: true });
if (fin) for (const f of finals) if (fin.pngs[`still_${f.k}`]) fs.copyFileSync(fin.pngs[`still_${f.k}`], path.join(OUT, `still_${String(f.k).padStart(2, "0")}.png`));
const SCENE = load("scene_checks.json") ?? {};
if (fin && !has("check-only")) for (const f of finals) {
  const png = fin.pngs[`still_${f.k}`]; if (!png || SCENE[f.k]) continue;
  const m = (fin.gate ?? []).find((g) => String(g).startsWith(`ZW_GATE|SC${f.k}|measure|`));
  const h = m ? Number(String(m).match(/h=([\d.]+)/)?.[1] ?? 0) : 0;
  const flat = Number(pyRun("import sys\nfrom PIL import Image, ImageStat\nprint(sum(ImageStat.Stat(Image.open(sys.argv[1]).convert('RGB').resize((54,96))).stddev)/3)", png).trim());
  if (h < 0.2 || flat < 6) { SCENE[f.k] = { pre: "FAIL", h, flat, reason: h < 0.2 ? `the subjects cover ${Math.round(h * 100)}% of the frame height (under 20%)` : "one flat colour" }; say(`  still ${f.k}: pre-check FAIL (${SCENE[f.k].reason}): no paid check`); continue; }
  const v = await B.sceneCheck({ callJson, apiKey: KEY, imageB64: small(png), sentence: ASKS[f.k - 1], meter });
  SCENE[f.k] = { pre: "ok", h, flat, ...v };
  say(`  still ${f.k}: ${v.shows_it ? "SHOWS IT" : "does not show it"} ($${v.costUsd}) ${v.reason}${v.missing?.length ? " | missing: " + v.missing.join(", ") : ""}`);
}
save("scene_checks.json", SCENE);

// ---- 5. THE 3 MOVE CLIPS (2.5 s each, low quality): a kid doing each built move
const clipKeys = CLIPS.map((c) => `move:${slug(c.name)}`).filter((k) => ["saved", "library"].includes(pieces[k]?.status) || (has("clips-anyway") && pieces[k]?.spec));
if (clipKeys.length && !has("check-only")) {
  const dir = path.join(OUT, "clips"); fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const n = clipKeys.length, D = 2.5;
  const src = [...HEAD("builder clips"), "ZW_PREVIEW.update(pct=30, samples=6)", "",
    ...clipKeys.map((k, i) => `@S(${i + 1}, ${i}, ${i + 1 < n ? i + 1 : "None"}, ${JSON.stringify(k)})\ndef s${String(i + 1).padStart(3, "0")}(t0, t1):\n${ind(`cam = zb_test_piece("move", ${B.pyData(pieces[k].spec)}, t0, t1)`)}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py")); if (!sc.ok) throw new Error(`clips static check: ${JSON.stringify(sc.problems.slice(0, 3))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  const words = Array.from({ length: n }, (_, i) => ({ word: `c${i}`, start: i * D, end: i * D + 0.4 }));
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(words));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "clips\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(n * D + 0.1), path.join(dir, "video", "audio", "voice.wav")]);
  const frames = shotFrames(src, words);
  const g = splitShots(frames, 1)[0];
  const lim = Math.ceil(g.n * 0.9) + 45 * g.ids.length + 300;
  L.check("clips", (lim + BOOT_S) * RATE);
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/builder-clips-${Date.now().toString(36)}`, log: say });
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const rr = await R.job(`clips (${g.n} frames)`, { role: "render", slug: "preview", videoUrl: await R.signGet("v.tgz"), shots: g.ids.join(","), f0: g.f0, f1: g.f1, samples: 6, upload: await R.signPuts("clips.mp4", 4) }, { maxRunSec: lim, ledgerKey: "runpod_clips" });
  if (rr.ok) {
    await R.fetchParts("clips.mp4", rr.output.upload.parts, path.join(dir, "clips.mp4"));
    clipKeys.forEach((k, i) => execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(i * D), "-t", String(D), "-i", path.join(dir, "clips.mp4"), "-an", "-c:v", "libx264", "-crf", "22", "-pix_fmt", "yuv420p", path.join(OUT, `clip_${pieces[k].name}.mp4`)]));
  } else say(`clips failed: ${String(rr.error).slice(0, 200)}`);
  await R.cleanup().catch(() => {});
}

// ---- 6. THE TABLE
const rows = finals.map((f) => {
  const p = plans[f.k];
  const lib = [p.place_library ? `place ${p.place_library}` : null, ...p.characters.filter((c) => c.library_look).map((c) => `${c.name} (${c.library_look})`), ...p.props.filter((x) => x.library && GEN_THINGS.includes(x.library)).map((x) => x.library)].filter(Boolean);
  const keys = [p.place_library ? null : `place:place_${f.k}`, ...p.characters.filter((c) => !c.library_look).map((c) => `character:${slug(c.name)}`), ...p.characters.filter((c) => c.move).map((c) => `move:${slug(c.move_name || `${c.name}_move`)}`), ...p.props.filter((x) => !(x.library && GEN_THINGS.includes(x.library))).map((x) => `prop:${slug(x.name)}`)].filter(Boolean);
  const sub = keys.flatMap((k) => [k, ...(pieces[k]?.extra?.accessories ?? []), ...(pieces[k]?.extra?.furniture ?? [])]);
  const made = sub.filter((k) => pieces[k]?.status === "saved").map((k) => `${k.split(":")[1]}${pieces[k].spec?.real_size_cm ? ` (${Math.round(pieces[k].spec.real_size_cm)} cm)` : pieces[k].spec?.height_cm ? ` (${Math.round(pieces[k].spec.height_cm)} cm)` : ""}`);
  const missed = sub.filter((k) => pieces[k]?.status === "missed").map((k) => k.split(":")[1]);
  const cost = (p.costUsd ?? 0) + sub.reduce((a, k) => a + (pieces[k]?.tries ?? []).reduce((b, t) => b + (t.cost ?? 0) + (t.visionCost ?? 0), 0), 0);
  return { still: f.k, ask: ASKS[f.k - 1], library: lib, made, missed, rewritten: f.rewritten, ai_cost_usd: +cost.toFixed(4) };
});
const built = Object.values(pieces).filter((x) => x.status === "saved");
const pieceCost = Object.values(pieces).filter((x) => x.status !== "library").reduce((a, x) => a + x.tries.reduce((b, t) => b + (t.cost ?? 0) + (t.visionCost ?? 0), 0), 0);
save("report.json", { rows, total_usd: L.total(), costs: L.costs, built: built.length, missed: Object.values(pieces).filter((x) => x.status === "missed").length, ai_cost_per_built_piece: built.length ? +(pieceCost / built.length).toFixed(4) : null });
say(`DONE: ${built.length} pieces saved, ${Object.values(pieces).filter((x) => x.status === "missed").length} missed; spent $${L.total()}`);
