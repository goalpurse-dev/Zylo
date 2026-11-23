// ROUND 9 PART 3 (owner 2026-11-23): a NEW story with the replica's camera defaults (stage9.py zc_cut: the subjects'
// side of the road, 35-60 % of the frame, move sideways when blocked, kid + monster low, ground things top-down alone,
// close two-shots with both faces), the reference's night, and the Part 2 fixes: the narrator tells everything (only the
// monster may say one short line), the rule in plain words in lines 1-3, who is on stage per line (enter / exit in code,
// the checker fails anyone off stage), 1-3 places each its own take, movement verbs that really move (measured), a crowd
// for "everyone". Storyboard + low-quality preview; ONE final (1080x1920) only at >= 85%. Cap --cap. Resumable.
//   node --env-file=.env.local scripts/blockyWorlds/round9/storyboard9.mjs --out <dir> [--yes] [--rounds 2] [--video] [--final]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { castVoice } from "../engine/voice/castVoice.mjs";
import { shotFrames, splitShots } from "../blenderKit/plan.mjs";
import { captionColors } from "../blenderKit/speakers.mjs";
import { ledger } from "../studio/ledger.mjs";
import { callJson, costOf } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { writeScript4 } from "../../../supabase/functions/_shared/blockyWorlds/writer4.js";
import { VOICE_TYPES } from "../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { pickVoices } from "../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { THINGS } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { timedWords } from "../blenderKit/sceneCards.mjs";
import { redoCard, storyChecks } from "../blenderKit/director3.mjs";
import { planStory4, lineCards4, movementProblems } from "../blenderKit/director4.mjs";
import { compileTakes, lockLooks, applyCard, ACTIONS8 } from "../blenderKit/takes.mjs";
import { runpod, RATE, BOOT_S } from "../blenderKit/rp.mjs";
import { staticCheck } from "../blenderKit/director.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.join(HERE, "..", "blenderKit");
const ROOT = path.join(HERE, "..", "..", "..");
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 1.9));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const KEY = process.env.ANTHROPIC_API_KEY;
if (!has("yes")) { say(`round 9 storyboard: dry run (add --yes); cap $${CAP}; spent $${L.total()}`); process.exit(0); }
const low = (s) => String(s ?? "").trim().toLowerCase();
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");

const TOPIC = "A NEW In This Town story in 2-3 places (the street at night, inside our house, maybe a bedroom). The town rule is ONE simple physical thing every person carries or uses, explained plainly in lines 1-3: what the danger is and the one way to deal with it. In the day we see it; at night a monster comes for someone the narrator loves; the narrator moves through the places (sneaks out, runs door to door); at the climax EVERYONE on the street uses the rule together; it ends in the morning with a twist or a joke. Only the monster may speak, one short line.";

// ---- 1. the story (the round 8 writer)
let script = load("script.json")?.script;
if (!script) {
  L.check("writer", 0.7);
  const r = await writeScript4({ callJson, apiKey: KEY, topic: TOPIC, lengthSec: 45 });
  L.add("writer", r.costUsd);
  script = r.script;
  save("script.json", { script, problems: r.problems, tries: r.tries, costUsd: r.costUsd });
  say(`story "${script.title}": ${script.lines.length} lines, key sentence "${script.key_sentence}" (lines ${script.key_lines?.join(", ")}), ${r.problems.length} rule problem(s) left${r.problems.length ? `: ${r.problems.join(" | ")}` : ""} ($${r.costUsd})`);
}

// ---- 2. the plan: the stage map, the scenes, the rule object; the looks LOCKED in code
let P = load("plan.json");
if (!P) {
  L.check("plan", 0.3);
  const r = await planStory4({ callJson, apiKey: KEY, script });
  L.add("director", r.costUsd);
  P = { plan: r.plan, problems: r.problems, looks: lockLooks(r.plan.cast) };
  save("plan.json", P);
  say(`plan: ${r.plan.scenes.length} scene(s) (${r.plan.scenes.map((s) => `${s.lines[0]}-${s.lines[1]} ${s.place} ${s.time}`).join("; ")}), rule object ${r.plan.rule?.object?.thing} ${r.plan.rule?.object?.where} ${r.plan.rule?.object?.who ?? ""}, monster ${r.plan.monster?.present ? r.plan.monster.style : "none"}; ${r.problems.length} plan problem(s)${r.problems.length ? `: ${r.problems.join(" | ")}` : ""}; $${r.costUsd}`);
}
const plan = P.plan, looks = P.looks;
const STORE = path.join(ROOT, "content", "in-this-town", "cast_voices.json");
const { voices, store } = pickVoices(plan.cast ?? [], fs.existsSync(STORE) ? JSON.parse(fs.readFileSync(STORE, "utf8")) : {});
fs.writeFileSync(STORE, JSON.stringify(store, null, 1));
// round 9: only the monster has its own voice (its one short line); the narrator tells the rest
for (const l of script.lines) if (l.speaker && !/^(narrator|me|i|)$/i.test(l.speaker)) voices[l.speaker] = { type: "monster", voiceId: VOICE_TYPES.monster.voiceId, voiceName: VOICE_TYPES.monster.voiceName };
save("voices.json", voices);

// ---- 3. the voice (the approved voices, 1.3x)
const VD = path.join(OUT, "voice");
let V13 = load("voice_1.3.json");
if (!V13) {
  L.check("voice take", 0.25);
  const r = await castVoice({ script, voices, outDir: VD, apiKey: process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY, log: say });
  L.add("voice", r.costUsd);
  fs.copyFileSync(r.wav, path.join(VD, "voice_1.3.wav"));
  V13 = { words: r.words, duration: r.duration, parts: r.parts };
  save("voice_1.3.json", V13);
  say(`voice: ${r.parts.length} parts, ${r.duration.toFixed(1)} s at 1.3x; $${r.costUsd}`);
}
const tw = timedWords(script, V13.words.map((w) => ({ word: w.word, start: w.start, end: w.end })));
const lines = script.lines.map((l, i) => {
  const ws = tw.map((w, j) => ({ ...w, j })).filter((w) => w.line === i + 1);
  return { text: l.text, speaker: l.speaker, start: ws[0].start, end: ws.at(-1).end, words: ws.map((w) => ({ word: w.word, start: w.start })), w0: ws[0].j };
});
lines.forEach((Ln, i) => { Ln.next = lines[i + 1]?.start ?? Ln.end + 0.25; });
const sceneOf = (n) => plan.scenes.find((x) => n >= x.lines[0] && n <= x.lines[1]);

// ---- 4. the line cards, in order, each from the state the lines before left
let C = load("cards.json");
if (!C) {
  L.check("line cards", 0.9);
  const r = await lineCards4({ callJson, apiKey: KEY, plan, script, lines, log: say });
  L.add("director", r.costUsd);
  C = { cards: r.cards, states: r.states, book: r.log };
  save("cards.json", C);
  say(`line cards: ${C.cards.length}, ${C.cards.reduce((a, c) => a + c.cuts.length, 0)} cuts; THE CODE REJECTED ${new Set(r.log.rejected.map((x) => x.line)).size} card(s) (${r.log.rejected.length} times) for contradicting the state / the rules, ${r.log.dropped.length} action(s) dropped, ${r.log.fixed} card(s) code-fixed, ${r.log.auto} enter / exit / crowd action(s) added by the code; $${r.costUsd}`);
}

// ---- 5. the takes + the shots
const LIB = ["worlds/worlds.py", "actions/actions.py", "worlds/acts.py", "worlds/pieces.py", "worlds/motion.py", "worlds/crowds.py", "worlds/town.py", "worlds/effects.py", "worlds/stage.py", "worlds/stage9.py", "worlds/stage9b.py", "worlds/stage9c.py", "worlds/stage9d.py", "worlds/stage9e.py", "worlds/stage9f.py", "worlds/stage9g.py", "worlds/stage9h.py"].map((f) => fs.readFileSync(path.join(KIT, f), "utf8")).join("\n\n");
const RO = plan.rule?.object ?? {};
const RULE_PY = RO.thing ? `ZW_RULE.update(${py({ thing: RO.thing, heads: 1.3, where: "over_head", how: "pop", glow: true })})` : "";
const HEAD = (title) => [`"""${title}"""`, "from shotkit import *", "from rbx import story", "from rbx.story import *", "import math, random", "from mathutils import Vector", "", "V = Video(__file__)", "story.bind(V)", "", LIB, "", RULE_PY, ""];
const pyRun = (code, ...a) => { const r = spawnSync("python", ["-P", "-c", code, ...a], { encoding: "utf8" }); if (r.status) throw new Error(r.stderr.slice(-400)); return r.stdout; };
const ind = (s) => s.split("\n").map((l) => `    ${l}`).join("\n");
function build() {
  const T = compileTakes({ plan, cards: C.cards, states: C.states, lines, looks });
  const sceneOfShot = (s) => s.scene;
  // a shot's real time window (the voice's word times; shotkit: the first shot from 0)
  T.shots.forEach((s, k) => { s.ta = k === 0 ? 0 : tw[s.w0].start; s.tb = s.w1 == null ? tw.at(-1).end + 0.25 : tw[s.w1].start; });
  return { ...T, sceneOfShot };
}
let T = build();
// the stills of a line: FIRST (its first cut), ACTION (the main action's moment: a pop / an appear checked at its pop
// moment), LAST; each on the cut that covers that moment
const MAIN = ["rule_effect", "appear", "climb_out", "dive_in", "give", "pick_up", "throw", "drop", "switch_all_on", "switch_all_off", "windows_open", "switch_on", "switch_off", "splat", "sign", "fall", "hug", "jump", "enter", "exit", "kick", "turn_on", "turn_off", "star_eyes", "x_eyes"];
function stillsOf(n) {
  const Ln = lines[n - 1], c = C.cards[n - 1];
  const cutAt = (t) => [...T.shots].reverse().find((s) => s.line <= n && s.ta <= t + 1e-6) ?? T.shots[0];
  const a0 = Math.max(Ln.start, n === 1 ? 0 : Ln.start) + 0.12, a2 = Math.max(a0 + 0.2, Ln.next - 0.1);
  const out = [{ line: n, which: "first", t: a0 }];
  const main = [...(c.actions ?? [])].sort((x, y) => MAIN.indexOf(x.do) - MAIN.indexOf(y.do)).find((x) => MAIN.includes(x.do));
  if (main) { const ta = (Ln.words[Math.max(0, Math.min(Ln.words.length - 1, Number(main.on_word) || 0))]?.start ?? Ln.start); const tb = Math.max(ta + 0.8, Ln.next - 0.05); const t = main.do === "dive_in" ? ta + 0.72 * (tb - ta) : ta + (["rule_effect", "appear", "turn_on", "splat"].includes(main.do) ? 0.35 : 0.5); if (t > a0 + 0.3 && t < a2 - 0.3) out.push({ line: n, which: "action", t, what: `${main.who} ${main.do}${main.target ? " " + main.target : ""}` }); }
  out.push({ line: n, which: "last", t: a2 });
  return out.map((x) => ({ ...x, shot: cutAt(x.t) }));
}
const B = 60;   // the stills' own time line (every take time shifted to the still's middle frame: o = mid - t)
async function render(tag, ns) {
  const dir = path.join(OUT, `render_${tag}`);
  if (fs.existsSync(path.join(dir, "done.json"))) return { tag, ...JSON.parse(fs.readFileSync(path.join(dir, "done.json"), "utf8")) };
  fs.mkdirSync(path.join(dir, "video", "audio"), { recursive: true });
  const stills = ns.flatMap(stillsOf);
  const N = stills.length;
  stills.forEach((x, k) => { x.k = k + 2; });
  const body = (x) => {
    const s = x.shot;
    const Ln = lines[x.line - 1], mv = x.which === "last" ? (T.movers[x.line] ?? []) : [];
    return [`o = (t0 + t1) / 2.0 - ${x.t.toFixed(3)}`, `H = take_${s.scene}(o)`, T.cutCall(s, `o + ${s.ta.toFixed(3)}`, `o + ${s.tb.toFixed(3)}`), ...(mv.length ? [`zs_moved(H, ${JSON.stringify(mv)}, o + ${Ln.start.toFixed(3)}, o + ${(Ln.next - 0.05).toFixed(3)}, "${x.k}")`] : [])].join("\n");
  };
  const src = [...HEAD(`Round 9 stills ${tag}`), ...Object.values(T.takes), "",
    `@S(1, 0, 1, "unused")\ndef s001(t0, t1):\n    zw_build("suburb_street", t0, t1, {"time": "day"})\n    Cam().key(t0, (0, -20, 5), (0, 0, 2), lens=30)\n`,
    ...stills.map((x, k) => `@S(${k + 2}, ${2 * k + 1}, ${k + 1 < N ? 2 * k + 3 : "None"}, ${JSON.stringify(`line ${x.line} ${x.which}`)})\ndef s${String(k + 2).padStart(3, "0")}(t0, t1):\n${ind(body(x))}\n`)].join("\n");
  const sc = staticCheck(src, path.join(dir, "video", "shots.py"));
  if (!sc.ok) throw new Error(`static check: ${JSON.stringify(sc.problems.slice(0, 5))}`);
  fs.writeFileSync(path.join(dir, "video", "shots.py"), src);
  fs.writeFileSync(path.join(dir, "video", "audio", "words.json"), JSON.stringify(Array.from({ length: 2 * N + 2 }, (_, i) => ({ word: `w${i}`, start: i === 0 ? 0 : B + (i - 1), end: (i === 0 ? 0 : B + (i - 1)) + 0.6 }))));
  fs.writeFileSync(path.join(dir, "video", "script.txt"), "scene stills\n");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=mono", "-t", String(B + 2 * N + 2), path.join(dir, "video", "audio", "voice.wav")]);
  const limit = N * 30 + 300;
  L.check(`render ${tag}`, (limit + BOOT_S) * RATE);
  if (has("check-only")) { say(`render ${tag}: static check ok (${N} stills), not sent`); process.exit(0); }
  const R = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round9-${tag}-${Date.now().toString(36)}`, log: say });
  pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(dir, "v.tgz"), path.join(dir, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
  await R.putFile("v.tgz", path.join(dir, "v.tgz"), "application/gzip");
  const url = await R.signGet("v.tgz");
  const r = await R.job(`round9 ${tag} (${N})`, { role: "preview", slug: "scenes", videoUrl: url, shots: stills.map((_, k) => k + 2).join(","), perSheet: 90, cols: 10, samples: 12, upload: await R.signPuts("p.tgz", 2) }, { maxRunSec: limit, ledgerKey: "runpod_preview" });
  if (!r.ok) { await R.cleanup().catch(() => {}); throw new Error(`render failed: ${String(r.error).slice(0, 300)}`); }
  await R.fetchParts("p.tgz", r.output.upload.parts, path.join(dir, "p.tgz"));
  await R.cleanup().catch(() => {});
  pyRun("import sys,tarfile\nwith tarfile.open(sys.argv[1]) as t:\n t.extractall(sys.argv[2], filter='data')", path.join(dir, "p.tgz"), dir);
  const key = (x) => `${x.line}.${x.which}`;
  const pngs = {}, failed = {};
  for (const [k, val] of Object.entries(r.output.failed ?? {})) { const x = stills[Number(k) - 2]; if (x) failed[key(x)] = String(val).split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300); }
  const pd = path.join(dir, "preview");
  if (fs.existsSync(pd)) for (const f of fs.readdirSync(pd)) { const m = f.match(/^shot_(\d+)\.png$/); if (m && stills[Number(m[1]) - 2]) pngs[key(stills[Number(m[1]) - 2])] = path.join(pd, f); }
  const out = { tag, pngs, failed, gate: r.output.gate ?? [], order: stills.map(key), stills: stills.map((x) => ({ line: x.line, which: x.which, t: x.t, what: x.what ?? null, shot: { shot: x.shot.shot, show: x.shot.show, move: x.shot.move } })) };
  fs.writeFileSync(path.join(dir, "done.json"), JSON.stringify(out, null, 1));
  say(`render ${tag}: ${Object.keys(pngs).length}/${N} stills, ${Object.keys(failed).length} crashed${Object.keys(failed).length ? `: ${Object.entries(failed).slice(0, 3).map(([k, v]) => `${k} ${v}`).join(" | ")}` : ""}; spent $${L.total()}`);
  return out;
}

// ---- 6. the checks: FREE first (flat surface, a cast member too small / covered, a crash), then the AI: the words, the
// world, the ACTION moment, and the CONTINUITY (this line's first frame vs the line before's last frame)
const VISION_PER_STILL = 0.0045;
const GATE_FAIL = new Set(["small", "covered", "monster_hidden"]);
function freeChecks(r, keys) {
  const out = {};
  const have = keys.filter((k) => r.pngs[k]);
  const flat = have.length ? JSON.parse(pyRun(fs.readFileSync(path.join(HERE, "..", "round8", "flatcheck8.py"), "utf8"), ...have.map((k) => r.pngs[k])) || "{}") : {};
  const castNames = new Set([...(plan.cast ?? []).map((c) => low(c.name)), "monster"]);
  for (const k of have) {
    const why = [];
    if ((flat[r.pngs[k]] ?? 0) > 0.45) why.push(`a flat surface fills ${Math.round(100 * flat[r.pngs[k]])}% of the frame`);
    const n = (r.order ?? []).indexOf(k) + 2;
    for (const g of r.gate ?? []) {
      const p = String(g).split("|");
      if (p[0] === "ZW_GATE" && Number(p[1]) === n && p[3] === "moved") { if (Number(p[4]) < 1.5) why.push(`${p[2]} was told to move but went only ${Number(p[4]).toFixed(1)} (the action did not happen)`); continue; }
      if (p[0] !== "ZW_GATE" || Number(p[1]) !== n || !GATE_FAIL.has(p[3]) || !castNames.has(low(p[2]))) continue;
      const by = String(p[4] ?? "").split(" ")[0];
      if (p[3] === "covered" && (/^zp_f/.test(by) || /^car_/.test(by) || /^zt_/.test(by))) continue;   // a face part, a car, a HELD PROP (the bell in front of its holder: the try-3 lesson)
      const st = (r.stills ?? []).find((x) => `${x.line}.${x.which}` === k);
      if (p[3] === "small" && st?.shot?.shot === "wide") continue;   // a wide shows the place on purpose
      if (p[3] === "small" && st?.shot?.shot === "low" && low(p[2]) !== "monster") continue;   // the low shot: the person tiny beside the monster
      why.push(`${p[2]} ${p[3] === "small" ? "is too small" : p[3] === "covered" ? "is covered" : "is hidden"} (${p[4] ?? ""})`);
    }
    if (why.length) out[k] = why.join("; ");
  }
  return out;
}
const CHECK = { type: "object", additionalProperties: false, required: ["pictures", "continuity"], properties: {
  pictures: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "ok", "world_ok", "problem"], properties: { n: { type: "integer" }, ok: { type: "boolean" }, world_ok: { type: "boolean" }, problem: { type: "string" } } } },
  continuity: { type: "array", items: { type: "object", additionalProperties: false, required: ["n", "ok", "problem"], properties: { n: { type: "integer" }, ok: { type: "boolean" }, problem: { type: "string" } } } } } };
const lookText = Object.values(looks).map((l) => `${l.name}: ${l.shirt} shirt, ${l.pants} pants, ${l.hair} hair`).join("; ");
async function vision(items) {
  const content = [{ type: "text", text: `You check storyboard stills of a Roblox-style blocky 3D story video (9:16). The cast keeps ONE look the whole video: ${lookText}${plan.monster?.present ? `; the monster: ${plan.monster.style}` : ""}. For EACH numbered picture: (1) ok: does it CLEARLY show what it must (the named people / things / action, in frame, big enough to read)? FAIL a picture that is blurry, too dark, mostly one flat surface (a wall, the pavement, the sky), a glare blob, or where the main subject is cut off or hidden. (2) world_ok: does it fit its world (the time of day, lit / dark as said)? problem: one short sentence ("" when fine). THEN the CONTINUITY: for every picture marked "CONTINUES picture m", compare it with picture m (the same running scene a moment later, maybe another camera angle): continuity ok = the same people in the same clothes, on the same sides of each other, with the same props in the same hands; nobody vanished or appeared without a reason in the words. A DIFFERENT CAMERA IS NEVER A BREAK: a closer or wider shot, another angle, a shot that shows fewer or more of the people is fine. A break is ONLY: a person in other clothes, two people who are BOTH visible swapped sides, a prop that jumped to another hand or vanished, or someone who should be there per the words gone from a shot that shows their spot.` }];
  for (const it of items) {
    content.push({ type: "text", text: `PICTURE ${it.n}${it.ref ? " (REFERENCE: the LAST frame of the line before; judge it too)" : ""}: line ${it.line} ${it.which.toUpperCase()} frame: the words "${it.words}". ${it.which === "action" ? `This is the moment of the ACTION: ${it.what}. ` : ""}It must show: ${it.show}. ON STAGE (the only cast who may be in the picture): ${it.on || "-"}; anyone else of the cast in the picture = not ok. Time: ${it.time}.${it.cont ? ` CONTINUES picture ${it.cont}.` : ""}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/png", data: fs.readFileSync(it.png).toString("base64") } });
  }
  content.push({ type: "text", text: "Return the JSON: pictures = one entry per picture (n); continuity = one entry per picture marked CONTINUES (n = that picture)." });
  L.check("vision", 0.1);
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 4000, messages: [{ role: "user", content }], output_config: { effort: "low", format: { type: "json_schema", schema: CHECK } } }) });
  const j = await r.json();
  L.add("vision", costOf("claude-sonnet-5-5", j.usage));
  if (!r.ok) throw new Error(`vision ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return JSON.parse((j.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join(""));
}
let st = load("state.json") ?? { round: 0, v: {}, pngs: {}, cont: {}, stills: {}, free: { k: {} } };
async function check(ns, r) {
  const keys = ns.flatMap((n) => stillsOf(n).map((x) => `${n}.${x.which}`));
  const free = freeChecks(r, keys);
  const items = [];
  for (const n of ns) {
    const Ln = lines[n - 1], sc = sceneOf(n);
    for (const x of stillsOf(n)) {
      const k = `${n}.${x.which}`;
      if (r.failed[k] || !r.pngs[k]) { st.v[k] = { ok: false, world_ok: false, problem: `crashed in Blender: ${r.failed[k] ?? "no still"}` }; st.free.k[`${r.tag}:${k}`] = "crash"; continue; }
      st.pngs[k] = r.pngs[k];
      if (free[k]) { st.v[k] = { ok: false, world_ok: true, free: true, problem: `[free check] ${free[k]}` }; st.free.k[`${r.tag}:${k}`] = "free"; }
      else { items.push({ k, line: n, which: x.which, png: r.pngs[k], words: Ln.text, what: x.what, show: (x.shot.show ?? []).join(", ") || "the scene", time: sc.time, on: (script.lines[n - 1].on_stage ?? []).join(", ") }); st.free.k[`${r.tag}:${k}`] = "ai"; }
    }
  }
  // batches of about 8, chronological; a line's FIRST still continues the line before's LAST (same scene), which rides
  // along as a reference picture when it is not in the batch
  const order = items;
  for (let i = 0; i < order.length; i += 8) {
    const batch = order.slice(i, i + 8);
    const pics = [];
    for (const b of batch) {
      let cont = null;
      if (b.which === "first" && b.line > 1 && sceneOf(b.line).id === sceneOf(b.line - 1).id) {
        const pk = `${b.line - 1}.last`;
        const inB = pics.find((p) => p.k === pk);
        if (inB) cont = inB.n;
        else if (st.pngs[pk]) { const ref = { k: pk, ref: true, line: b.line - 1, which: "last", png: st.pngs[pk], words: lines[b.line - 2].text, show: "the scene", time: sceneOf(b.line - 1).time, n: pics.length + 1 }; pics.push(ref); cont = ref.n; }
      }
      pics.push({ ...b, n: pics.length + 1, cont });
    }
    const a = await vision(pics);
    for (const p of pics) {
      if (p.ref) continue;
      const x = a.pictures.find((y) => y.n === p.n);
      st.v[p.k] = { ok: Boolean(x?.ok && x?.world_ok), words_ok: Boolean(x?.ok), world_ok: Boolean(x?.world_ok), problem: x?.problem ?? "no answer" };
      if (p.cont) { const c = a.continuity.find((y) => y.n === p.n); st.cont[p.line] = { ok: c ? Boolean(c.ok) : true, problem: c?.problem ?? "" }; }
    }
  }
  const fv = Object.values(st.free.k);
  st.free.skipped = fv.filter((x) => x !== "ai").length; st.free.sent = fv.filter((x) => x === "ai").length; st.free.saved = +(st.free.skipped * VISION_PER_STILL).toFixed(4);
  say(`checks: ${Object.keys(free).length} still(s) failed the FREE checks${Object.keys(free).length ? ` (${Object.entries(free).slice(0, 6).map(([k, w]) => `${k}: ${w}`).join(" | ")})` : ""}, ${items.length} went to the AI; continuity breaks so far: ${Object.values(st.cont).filter((c) => !c.ok).length}`);
}
const lineOk = (n) => stillsOf(n).every((x) => st.v[`${n}.${x.which}`]?.ok) && st.cont[n]?.ok !== false;

if (st.round === 0) {
  const ns = lines.map((_, i) => i + 1);
  const r = await render("r0", ns);
  await check(ns, r); st.round = 1; save("state.json", st);
}
// ---- 7. redo rounds: the failing lines again (the checker's notes, the previous card's end still, its own stills)
const MAXR = Number(arg("rounds", 1));
for (let round = st.round; round <= MAXR; round++) {
  const failing = lines.map((_, i) => i + 1).filter((n) => !lineOk(n));
  say(`round ${round}: ${lines.length - failing.length}/${lines.length} cards pass (every still + the continuity)`);
  if (!failing.length) break;
  const need = failing.length * (0.03 + 3 * 0.005) + 0.12;
  if (L.total() + need > CAP - 0.25) { say(`round ${round} skipped: it needs ~$${need.toFixed(2)}, $${(CAP - L.total()).toFixed(2)} left (keeping $0.25 for the preview)`); break; }
  st.redone ??= {};
  const redo = new Set(failing);
  if (!st.redone[round]) {
    for (const n of failing) {
      const fb = [...stillsOf(n).map((x) => `${x.which.toUpperCase()}: ${st.v[`${n}.${x.which}`]?.ok ? "ok" : `FAILED: ${st.v[`${n}.${x.which}`]?.problem}`}`), st.cont[n]?.ok === false ? `CONTINUITY BREAK with the line before: ${st.cont[n].problem}` : ""].filter(Boolean).join("; ");
      const img = (k, label) => (st.pngs[k] ? [{ label, b64: fs.readFileSync(st.pngs[k]).toString("base64") }] : []);
      const images = [...img(`${n - 1}.last`, "THE PREVIOUS CARD'S END STILL (this line continues from it):"), ...stillsOf(n).flatMap((x) => img(`${n}.${x.which}`, `THIS LINE'S ${x.which.toUpperCase()} STILL (as rendered):`))];
      const before = C.states[n];
      const r = await redoCard({ callJson, apiKey: KEY, plan, script, lines, n, state: before, card: C.cards[n - 1], feedback: fb, images, prevCut: C.cards[n - 2]?.cuts?.at(-1) ?? null });
      L.add("director", r.costUsd);
      const keep = (C.cards[n - 1].actions ?? []).filter((a) => a.auto);
      let nc = { ...r.card, actions: [...keep, ...(r.card.actions ?? []).filter((a) => !keep.some((x) => x.who === a.who && x.do === a.do))] };
      if (movementProblems(script, n, plan, nc).length) nc = { ...nc, actions: [...nc.actions, ...(C.cards[n - 1].actions ?? []).filter((a) => ["walk_to", "run_to", "run_door_to_door", "enter", "exit", "follow", "draw_around"].includes(a.do) && !a.auto)] };
      const ra = applyCard(before, nc, { place: sceneOf(n).place, line: lines[n - 1], plan });
      C.cards[n - 1] = { ...nc, actions: ra.applied };
      r.state = ra.state;
      // the state after this line changed? the next lines are re-checked against it in code (their bad actions dropped)
      let S = r.state;
      for (let m = n + 1; m <= lines.length; m++) {
        C.states[m] = S;
        const a = applyCard(S, C.cards[m - 1], { place: sceneOf(m).place, line: lines[m - 1], plan });
        if (a.problems.length) { C.cards[m - 1] = { ...C.cards[m - 1], actions: a.applied }; redo.add(m); C.book.dropped.push(...a.problems.map((p) => ({ line: m, problem: p, after: `redo of ${n}` }))); }
        S = a.state;
      }
      C.states[lines.length + 1] = S;
    }
    save("cards.json", C);
    st.redone[round] = [...redo]; save("state.json", st);
  }
  T = build();
  const ns = st.redone[round] === true ? failing : st.redone[round];
  const r = await render(`r${round}`, ns);
  await check(ns, r);
  st.round = round + 1; save("state.json", st);
}

// ---- 8. the sheet
const rows = lines.map((Ln, i) => {
  const n = i + 1, c = C.cards[i];
  const ss = stillsOf(n);
  return { id: n, words: Ln.text, secs: +(Ln.next - Ln.start).toFixed(2), ok: Boolean(lineOk(n)), cont: st.cont[n] ? st.cont[n].ok : null,
    stills: ss.map((x) => [x.which, st.pngs[`${n}.${x.which}`] ?? null]),
    cam: (c.cuts ?? []).map((k) => `${k.shot} ${k.show.join("+")} ${k.move}`).join(" | "),
    acts: `${sceneOf(n).place} ${sceneOf(n).time}: ` + ((c.actions ?? []).map((a) => `${a.who} ${a.do}${a.target ? " " + a.target : ""}`).join(", ") || "-"),
    problem: [...ss.map((x) => st.v[`${n}.${x.which}`]).filter((x) => x && !x.ok).map((x) => x.problem), st.cont[n]?.ok === false ? `[continuity] ${st.cont[n].problem}` : ""].filter(Boolean).join(" / ") };
});
const pass = rows.filter((r) => r.ok).length;
const contBreaks = Object.values(st.cont).filter((c) => !c.ok).length;
const codeRejected = new Set(C.book.rejected.map((x) => x.line)).size;
save("sheet.json", { title: script.title, note: `${contBreaks} continuity break(s) in the pictures; the code rejected ${codeRejected} card(s)`, rows });
spawnSync("python", [path.join(HERE, "..", "round8", "sheet8.py"), path.join(OUT, "sheet.json"), path.join(OUT, "storyboard.jpg")], { stdio: "inherit" });
const SC = storyChecks(plan, C.cards);
const report = { story_checks: SC, pass, cards: rows.length, pct: Math.round((100 * pass) / rows.length), continuity_breaks_pictures: contBreaks, cards_rejected_by_code: codeRejected, code_rejections: C.book.rejected.length, actions_dropped: C.book.dropped.length, free: { skipped: st.free.skipped, sent: st.free.sent, saved: st.free.saved }, spent: L.total() };
save("report.json", report);
say(`storyboard: ${pass}/${rows.length} cards pass (${report.pct}%); CONTINUITY: ${contBreaks} break(s) found in the pictures, the code rejected ${codeRejected} card(s) (${C.book.rejected.length} times) and dropped ${C.book.dropped.length} action(s); free checks kept ${st.free.skipped} still(s) from the AI (~$${st.free.saved}); spent $${L.total()} of $${CAP}`);

// ---- 9. THE PREVIEW (--video) / THE FINAL (--final, only at >= 85%)
const FINAL = has("final");
if (!has("video") && !FINAL) process.exit(0);
if (FINAL && pass / rows.length < 0.85) { say(`final NOT made: ${pass}/${rows.length} cards pass (${report.pct}%), under the 85% bar: the preview is the answer`); process.exit(0); }
const PV = path.join(OUT, FINAL ? "final" : "preview"); fs.mkdirSync(path.join(PV, "video", "audio"), { recursive: true });
const segs = path.join(PV, "segments"); fs.mkdirSync(segs, { recursive: true });
const vsrc = [...HEAD("Round 9 video"), FINAL ? "" : "ZW_PREVIEW.update(pct=30, samples=6)", "", ...Object.values(T.takes), "",
  ...T.shots.map((s) => `@S(${s.id}, ${s.w0}, ${s.w1 ?? "None"}, ${JSON.stringify(`line ${s.line} cut ${s.cut + 1}: ${s.shot} ${s.show.join("+")}`)})\ndef s${String(s.id).padStart(3, "0")}(t0, t1):\n${ind(`H = take_${s.scene}(0.0)\n${T.cutCall(s)}`)}\n`)].join("\n");
const vsc = staticCheck(vsrc, path.join(PV, "video", "shots.py"));
if (!vsc.ok) throw new Error(`video static check: ${JSON.stringify(vsc.problems.slice(0, 5))}`);
fs.writeFileSync(path.join(PV, "video", "shots.py"), vsrc);
const twv = tw.map((w) => ({ word: w.word, start: w.start, end: w.end }));
fs.writeFileSync(path.join(PV, "video", "audio", "words.json"), JSON.stringify(twv));
fs.copyFileSync(path.join(VD, "voice_1.3.wav"), path.join(PV, "video", "audio", "voice.wav"));
fs.writeFileSync(path.join(PV, "video", "script.txt"), "video\n");
const frames = shotFrames(vsrc, twv);
const groups = splitShots(frames, FINAL ? 4 : 2);
const vlimit = (g) => Math.ceil(g.n * (FINAL ? 1.6 : 0.5)) + 40 * g.ids.length + (FINAL ? 420 : 300);
const vworst = groups.reduce((a, g) => a + (vlimit(g) + BOOT_S) * RATE, 0);
say(`${FINAL ? "FINAL" : "preview"} video: ${frames.length} shots, ${frames.reduce((a, x) => a + x.n, 0)} frames in ${groups.length} chunks; worst case $${vworst.toFixed(3)}; spent $${L.total()}`);
L.check(FINAL ? "final video" : "preview video", vworst);
const VR = runpod({ L, prefix: `blocky-worlds-test/blender-kit/round9-${FINAL ? "final" : "preview"}-${Date.now().toString(36)}`, log: say });
pyRun("import sys,tarfile,os\nout,root=sys.argv[1],sys.argv[2]\nwith tarfile.open(out,'w:gz') as t:\n for f in sys.argv[3:]:\n  t.add(os.path.join(root,f),arcname=f)", path.join(PV, "v.tgz"), path.join(PV, "video"), "shots.py", "script.txt", "audio/words.json", "audio/voice.wav");
await VR.putFile("v.tgz", path.join(PV, "v.tgz"), "application/gzip");
const vurl = await VR.signGet("v.tgz");
const vres = await Promise.all(groups.map(async (g, i) => {
  const name = `seg${i}.mp4`;
  if (fs.existsSync(path.join(segs, name))) return { ok: true };
  const r = await VR.job(`${FINAL ? "final" : "preview"} chunk ${i} (${g.n} frames)`, { role: "render", slug: FINAL ? "final" : "preview", videoUrl: vurl, shots: g.ids.join(","), f0: g.f0, f1: g.f1, ...(FINAL ? {} : { samples: 6 }), upload: await VR.signPuts(name, 4) }, { maxRunSec: vlimit(g), ledgerKey: FINAL ? "runpod_final" : "runpod_preview_video" });
  if (!r.ok) return { ok: false, error: String(r.error).slice(0, 600) };
  await VR.fetchParts(name, r.output.upload.parts, path.join(segs, name));
  return { ok: true, sPerFrame: r.output.sPerFrame };
}));
await VR.cleanup().catch(() => {});
const vbad = vres.filter((x) => !x.ok);
if (vbad.length) throw new Error(`video chunks failed: ${vbad.map((b) => b.error).join(" | ")}`);
fs.writeFileSync(path.join(segs, "list.txt"), groups.map((_, i) => `file 'seg${i}.mp4'`).join("\n"));
const vraw = path.join(PV, "raw.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(segs, "list.txt"), "-c", "copy", vraw]);
const cap = captionColors(script, V13.words);
fs.writeFileSync(path.join(PV, "colors.json"), JSON.stringify(cap.colors));
fs.writeFileSync(path.join(PV, "speakers.json"), JSON.stringify(cap.speakers));
fs.writeFileSync(path.join(PV, "words_voice.json"), JSON.stringify(V13.words));
pyRun("import sys,json\nsys.path.insert(0,sys.argv[1])\nimport finishx\nw=json.load(open(sys.argv[2],encoding='utf-8'))\nc=json.load(open(sys.argv[3],encoding='utf-8'))\ns=json.load(open(sys.argv[4],encoding='utf-8'))\nopen(sys.argv[5],'w',encoding='utf-8').write(finishx.captions_ass(w,c,'Arial Black',s))", KIT, path.join(PV, "words_voice.json"), path.join(PV, "colors.json"), path.join(PV, "speakers.json"), path.join(PV, "captions.ass"));
const ass = path.join(PV, "captions.ass").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "$1\\:");
const vout = path.join(OUT, FINAL ? "final_1080x1920.mp4" : "preview_1.3x.mp4");
// the pop sound on the rule effects / the things that appear
const pops = C.cards.flatMap((c, i) => (c.actions ?? []).filter((a) => ["rule_effect", "appear", "splat"].includes(a.do)).map((a) => +((lines[i].words[Math.max(0, Math.min(lines[i].words.length - 1, Number(a.on_word) || 0))]?.start ?? lines[i].start) + 0.1).toFixed(3)));
const POP = "aevalsrc=0.7*sin(2*PI*(260+2600*t)*t)*exp(-22*t)+0.15*(random(0)-0.5)*exp(-60*t):s=44100:d=0.22";
const audio = pops.length ? `${pops.map((t, i) => `[${i + 2}:a]adelay=${Math.round(t * 1000)}|${Math.round(t * 1000)}[p${i}]`).join(";")};[1:a]${pops.map((_, i) => `[p${i}]`).join("")}amix=inputs=${pops.length + 1}:normalize=0:duration=first[a]` : "[1:a]anull[a]";
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", vraw, "-i", path.join(VD, "voice_1.3.wav"), ...pops.flatMap(() => ["-f", "lavfi", "-i", POP]), "-filter_complex", `[0:v]scale=${FINAL ? "1080:1920" : "540:960"},subtitles='${ass}'[v];${audio}`, "-map", "[v]", "-map", "[a]", "-shortest", "-c:v", "libx264", "-crf", FINAL ? "18" : "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", vout]);
say(`${FINAL ? "FINAL" : "preview"}: ${vout} (${vres.map((x) => x.sPerFrame).join(" / ")} s a frame), ${pops.length} pop(s); spent $${L.total()} of $${CAP}`);
void THINGS; void ACTIONS8;
