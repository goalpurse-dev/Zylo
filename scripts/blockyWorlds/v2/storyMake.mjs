// IN THIS TOWN v2: A NEW STORY END TO END (owner 2026-11-24, step 3 part E): the writer -> the shot planner -> the free
// checks (+ re-plans, max 2) -> the voice (+ the two pace samples) -> the stills (+ automatic fixes, max 2 per shot) ->
// ONE low-quality preview video with voice and captions. Resumable: every paid step is cached in the output folder.
//   node --env-file=.env.local scripts/blockyWorlds/v2/storyMake.mjs --name mimic_mom --yes [--cap 2] [--to script|plan|voice|stills|preview]
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ledger } from "../studio/ledger.mjs";
import { callJson } from "../../../supabase/functions/_shared/blockyWorlds/llm.js";
import { castVoice } from "../engine/voice/castVoice.mjs";
import { timedWords } from "../blenderKit/sceneCards.mjs";
import { STAGE_A } from "./stageA.mjs";
import { checkRows, composition } from "./shots.mjs";
import { writeStory, planRows, TELLS } from "./writerV5.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const NAME = arg("name", "mimic_mom");
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${NAME}`);
fs.mkdirSync(OUT, { recursive: true });
const CAP = Number(arg("cap", 2));
const L = ledger(OUT, { capUsd: CAP, agentCapUsd: CAP });
const meter = { check: (usd, what) => L.check(`llm ${what}`, usd), add: (usd, what) => L.add("llm", usd) };
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(OUT, "run.log"), l + "\n"); };
const save = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));
const load = (f) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")) : null);
const TO = arg("to", "preview");
const STEPS = ["script", "plan", "voice", "stills", "preview"];
const upTo = (s) => STEPS.indexOf(s) <= STEPS.indexOf(TO);
if (!has("yes")) { say("dry run (add --yes)"); process.exit(0); }
const KEY = process.env.ANTHROPIC_API_KEY;
const S = { ...STAGE_A, cameras: {} };

const TOPIC = "In this town, something can copy the people you love. I think my mom isn't my mom. A creepy mimic story, kid-safe (eerie, nobody gets hurt), our own plot. Stage: our street, the house front, the porch, the door, a window; dusk into night. Cast: me (the narrator), Mom, the Mimic (a wrong copy of Mom), my little sister. 60-80 seconds.";
const CAST_MENU = [{ id: "me", about: "the narrator, a kid in an orange hoodie" }, { id: "mom", about: "Mom, warm, red cardigan, a bob" }, { id: "mimic", about: "the copy of Mom: almost right" }, { id: "sister", about: "my little sister, cheeky, pigtails" }];

// ---- 1 the script
let W = load("script.json");
if (!W) {
  const r = await writeStory({ callJson, apiKey: KEY, topic: TOPIC, cast: CAST_MENU, meter });
  W = { ...r }; save("script.json", W);
  say(`script "${r.script.title}": ${r.script.lines.length} lines, ${r.script.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0)} words, tell ${r.script.tell}; ${r.problems.length} problem(s) left${r.problems.length ? ": " + r.problems.join(" | ") : ""}; $${r.costUsd}`);
}
const SC = W.script;
fs.writeFileSync(path.join(OUT, "script.txt"), [`${SC.title}`, `rule: ${SC.rule} (tell: ${SC.tell})`, "", ...SC.lines.map((l, i) => `${i + 1}. ${l.speaker !== "narrator" ? "[the copy] " : ""}${l.text}`), "", `planted: ${SC.planted.map((p) => `${p.detail} (line ${p.line} -> ${p.payoff_line})`).join("; ")}`, `comment hook: ${SC.comment_hook}`].join("\n"));
if (!upTo("plan")) process.exit(0);

// ---- 2 the story object + the shot rows (planned, checked, re-planned)
const sisterName = (SC.lines.map((l) => l.text).join(" ").match(/\bsister,? (\w+)/i) ?? [])[1];
const story = {
  title: SC.title, rule_text: SC.rule, tell: SC.tell, lines: SC.lines,
  cast: { me: { name: "Me", spec: "me" }, mom: { name: "Mom", spec: "mom" }, mimic: { name: "Mom", spec: "mimic_mom" }, sister: { name: sisterName ?? "Sis", spec: "sister" } },
  aliases: { me: ["I", "me"], mom: ["mom", "mother"], sister: ["sister", ...(sisterName ? [sisterName.toLowerCase()] : [])], mimic: ["copy", "mimic", "the thing"], porch_light: ["porch light"] },
  alias_any: { mom: ["mom", "mimic"] },
  props: { flashlight: { kind: "flashlight", hands: "R" }, phone: { kind: "phone", hands: "both" } },
  rule: { object: SC.tell === "porch_light" ? "porch_light" : null, start: "on", change_words: ["out", "off", "on", "lit", "flick", "flicked", "click"], tell_person: "mimic" },
};
let rows = load("rows.json");
if (!rows) {
  let r = await planRows({ callJson, apiKey: KEY, story, meter });
  rows = r.rows;
  for (let k = 0; k < 2; k++) {
    const probs = checkRows(S, { ...story, rows });
    if (!probs.length) break;
    const lines = [...new Set(probs.map((p) => Number((p.match(/line (\d+)/) ?? [])[1])).filter(Boolean))];
    say(`plan try ${k + 1}: ${probs.length} problem(s) on lines ${lines.join(", ") || "-"}: re-planning those`);
    if (!lines.length) break;
    const rp = await planRows({ callJson, apiKey: KEY, story, meter, previous: rows.filter((x) => lines.includes(x.line)), problems: probs, onlyLines: lines });
    rows = [...rows.filter((x) => !lines.includes(x.line)), ...rp.rows.filter((x) => lines.includes(x.line))].sort((a, b) => a.line - b.line);
  }
  save("rows.json", rows);
}
story.rows = rows;
const probs = checkRows(S, story);
save("checks.json", { problems: probs, composition: composition(S, story) });
say(`plan: ${rows.length} rows; free checks: ${probs.length} problem(s) left${probs.length ? ":\n- " + probs.join("\n- ") : ""}`);
say(`composition: ${JSON.stringify(composition(S, story))}`);
if (!upTo("voice")) process.exit(0);

// ---- 3 the voice (the owner's voice, 1.2x creepy) + the two pace samples (15 s each)
const VD = path.join(OUT, "voice");
let V = load("voice.json");
if (!V) {
  L.check("voice", 0.3);
  const r = await castVoice({ script: { lines: SC.lines.map((l) => ({ text: l.text, speaker: l.speaker === "mimic" ? "Mimic" : "narrator" })) }, voices: { Mimic: { type: "mom" } }, outDir: VD, apiKey: process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY, log: say });
  L.add("voice", r.costUsd);
  V = { wav: r.wav, words: r.words, duration: r.duration }; save("voice.json", V);
  say(`voice: ${r.duration.toFixed(1)} s, $${r.costUsd}`);
}
// the pace samples: creepy = the take as it is; funny = 0.1 s inside sentences, 0.2 s between, sped to ~250 words / minute
{
  const ws = V.words, end15 = ws.findIndex((w) => w.end > 15);
  const N15 = end15 > 0 ? end15 : ws.length;
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", V.wav, "-t", String(ws[N15 - 1].end + 0.2), path.join(OUT, "pace_creepy_15s.wav")]);
  const segs = [];
  for (let i = 0; i < N15; i++) {
    const a = Math.max(0, ws[i].start - 0.02), b = ws[i].end + 0.02;
    const gap = i + 1 < N15 ? Math.max(0, ws[i + 1].start - ws[i].end) : 0;
    const keep = /[.!?]$/.test(ws[i].word) ? Math.min(gap, 0.2) : Math.min(gap, 0.1);
    segs.push([a, b + keep]);
  }
  const g = segs.map(([a, b], i) => `[0:a]atrim=${a.toFixed(3)}:${b.toFixed(3)},asetpts=PTS-STARTPTS[s${i}]`).join(";") + `;${segs.map((_, i) => `[s${i}]`).join("")}concat=n=${segs.length}:v=0:a=1[c]`;
  const raw = segs.reduce((t, [a, b]) => t + (b - a), 0), wpm = (N15 / raw) * 60, tempo = Math.min(1.25, Math.max(1, 250 / wpm));
  const gf = path.join(OUT, "pace.graph"); fs.writeFileSync(gf, `${g};[c]atempo=${tempo.toFixed(3)}[out]`);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", V.wav, "-/filter_complex", gf, "-map", "[out]", path.join(OUT, "pace_funny_15s.wav")]);
  say(`pace samples: creepy ${(N15 / ws[N15 - 1].end * 60).toFixed(0)} wpm, funny ${(wpm * tempo).toFixed(0)} wpm (gaps 0.1 / 0.2 s, tempo ${tempo.toFixed(2)})`);
}
// the words -> each line's time -> each row's time (a line's rows share it; a row may start on its from_word)
const tw = timedWords({ lines: SC.lines }, V.words.map((w) => ({ word: w.word, start: w.start, end: w.end })));
const lineW = SC.lines.map((_, i) => tw.map((w, j) => ({ ...w, j })).filter((w) => w.line === i + 1));
const byLine = {};
rows.forEach((r) => (byLine[r.line] ??= []).push(r));
for (const [ln, rs] of Object.entries(byLine)) {
  const ws = lineW[Number(ln) - 1];
  rs.forEach((r, k) => { const wi = Math.min(ws.length - 1, r.from_word ?? Math.floor((k * ws.length) / rs.length)); r.w0 = ws[wi].j; });
}
rows.forEach((r, i) => { r.w1 = i + 1 < rows.length ? rows[i + 1].w0 : null; r.t0 = i === 0 ? 0 : tw[r.w0].start; r.t1 = r.w1 == null ? V.duration : tw[r.w1].start; });
const longest = Math.max(...rows.map((r) => r.t1 - r.t0));
const closeLong = rows.filter((r) => ["close", "eyes"].includes(r.cam?.type) && r.t1 - r.t0 > 1.5).map((r, i) => `line ${r.line} close ${(r.t1 - r.t0).toFixed(1)} s`);
say(`timing: ${V.duration.toFixed(1)} s, ${rows.length} shots, the longest ${longest.toFixed(1)} s${closeLong.length ? `; closes over 1.5 s: ${closeLong.join(", ")}` : ""}`);
fs.writeFileSync(path.join(HERE, "stories", `${NAME}.json`), JSON.stringify({ ...story, rows }, null, 1));
save("timed_rows.json", rows);
save("timed_words.json", tw.map((w) => ({ word: w.word, start: w.start, end: w.end, line: w.line })));
if (!upTo("stills")) process.exit(0);

// ---- 4 the stills (+ the automatic fixes of the shots the Blender checks failed: the camera pulled back, max 2)
const run = (extra) => { const r = spawnSync("node", ["--env-file=.env.local", path.join(HERE, "storyStills.mjs"), "--story", NAME, "--yes", "--cap", String(CAP), "--out", OUT, ...extra], { encoding: "utf8", cwd: path.join(HERE, "..", "..", ".."), maxBuffer: 1 << 26 }); say(String(r.stdout).trim().split("\n").slice(-2).join(" | ")); if (r.status) say(`stills FAILED: ${String(r.stderr).slice(-400)}`); };
if (!fs.existsSync(path.join(OUT, "rows.json")) || has("restills")) run(["--force"]);
for (let k = 0; k < 2; k++) {
  const res = JSON.parse(fs.readFileSync(path.join(OUT, "rows.json"), "utf8"));
  const bad = Object.entries(res).filter(([, v]) => v.fails.length).map(([n]) => Number(n));
  if (!bad.length) break;
  const st = JSON.parse(fs.readFileSync(path.join(HERE, "stories", `${NAME}.json`), "utf8"));
  if (k === 0) {
    say(`fix try 1: ${bad.length} shot(s) failed the Blender checks (${bad.join(", ")}): the camera pulled back`);
    for (const n of bad) st.rows[n - 1].cam = { ...st.rows[n - 1].cam, pull: (st.rows[n - 1].cam.pull ?? 1) * 1.35 };
  } else {
    // re-planned, never shown: the planner gets the failing shots and why; its new rows must pass the free checks
    const lines = [...new Set(bad.map((n) => st.rows[n - 1].line))];
    const why = bad.map((n) => `row of line ${st.rows[n - 1].line}: ${res[n].fails.join("; ")}`);
    say(`fix try 2: re-planning lines ${lines.join(", ")} (${why.join(" | ")})`);
    const rp = await planRows({ callJson, apiKey: KEY, story: { ...story, rows: st.rows }, meter, previous: st.rows.filter((x) => lines.includes(x.line)), problems: why.map((w) => `${w} (the rendered still failed: re-plan this shot: another camera type / angle / spot)`), onlyLines: lines });
    const keep = st.rows.filter((x) => !lines.includes(x.line));
    const neu = rp.rows.filter((x) => lines.includes(x.line)).map((x) => ({ ...x, stage: x.stage ?? st.rows.find((y) => y.line === x.line)?.stage }));
    const cand = [...keep, ...neu].sort((a, b) => a.line - b.line);
    if (!checkRows(S, { ...story, rows: cand }).length) { st.rows = cand; for (const [i, r] of st.rows.entries()) { const old = rows.find((x) => x.line === r.line); r.t0 = r.t0 ?? old?.t0; r.t1 = r.t1 ?? old?.t1; r.w0 = r.w0 ?? old?.w0; r.w1 = r.w1 ?? old?.w1; } }
    else say("the re-plan did not pass the free checks: the pulled-back shots stay (and are reported)");
  }
  fs.writeFileSync(path.join(HERE, "stories", `${NAME}.json`), JSON.stringify(st, null, 1));
  run(["--force", "--rows", bad.join(",")]);
}
// the final storyboard: the latest still of every row
{
  const res = JSON.parse(fs.readFileSync(path.join(OUT, "rows.json"), "utf8"));
  const tiles = path.join(OUT, "board"); fs.rmSync(tiles, { recursive: true, force: true }); fs.mkdirSync(tiles);
  let m = 0;
  for (let n = 1; n <= rows.length; n++) if (res[n]?.label && fs.existsSync(res[n].label)) fs.copyFileSync(res[n].label, path.join(tiles, `t_${String(++m).padStart(3, "0")}.png`));
  spawnSync("ffmpeg", ["-v", "error", "-y", "-start_number", "1", "-i", path.join(tiles, "t_%03d.png"), "-vf", `tile=6x${Math.ceil(m / 6)}:color=0x15171c`, "-frames:v", "1", "-q:v", "3", path.join(OUT, "storyboard_final.jpg")]);
  const still = Object.values(res).filter((v) => v.fails.length).length;
  say(`storyboard: ${m}/${rows.length} shots, ${still} still failing the Blender checks after the fixes`);
}
if (!upTo("preview")) process.exit(0);

// ---- 5 the preview video
const pv = spawnSync("node", ["--env-file=.env.local", path.join(HERE, "previewVideo.mjs"), "--name", NAME, "--yes", "--cap", String(CAP)], { encoding: "utf8", cwd: path.join(HERE, "..", "..", ".."), maxBuffer: 1 << 26 });
say(String(pv.stdout).trim().split("\n").slice(-3).join(" | "));
if (pv.status) say(`preview FAILED: ${String(pv.stderr).slice(-600)}`);
say(`spent $${L.total()}`);
