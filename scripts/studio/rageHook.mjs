// Zyvo Studio recipe "Rage hook" (owner, 2026-11-02: the raging creator was the best video yet). A creator yells a real
// frustration on frame 0, Zee answers in two words, the real clip plays, three real steps, the real measured time, the real
// result, an excited last line. One recipe file per video in recipes/; any template. See recipes/README.md.
//   node rageHook.mjs <recipe.json> script     writes the two scripts ($0)
//   node rageHook.mjs <recipe.json> takes      3 takes of the yell, keeps the most intense; the other lines (paid, under recipe.cap_usd)
//   node rageHook.mjs <recipe.json> render     renders the bleeped main file and the uncensored one ($0, local)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assembleStory, VOICES } from "./storyScripts.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.resolve(HERE, "../../content/studio-worker");
const PER_CHAR = 0.0002;
// the settings that won the first video: the v3 model yells, the usual one measured 5 to 9 dB quieter
export const YELL_TAGS = "[shouting] [furious]", REACT_TAGS = "[shocked] [shouting]", EXCITED_TAGS = "[excited] [loud]";
const FAST = 1.22;   // Zee's steps and last line

const tap = (word, x, y) => ({ word, event: `tap|${x}|${y}`, sfx: "click" });

/** The two scripts of a recipe: { censored, raw }. They differ only by the bleep. */
export function rageHookScript(R) {
  const yellWords = R.yell.text.split(/\s+/), swear = yellWords.findIndex((w) => w.toLowerCase().startsWith(R.yell.swear));
  if (swear < 0) throw new Error(`the yell has no "${R.yell.swear}"`);
  if (R.clips.length !== 2) throw new Error("a Rage hook has two clips: the first and the result");
  const lines = [
    { who: "creator", text: R.yell.text, key: [R.yell.key], expr: "angry", pose: R.yell.pose ?? "rage", shake: 0.7, shot: "rage_hook", role: "yell", visual: { instant: true, up: 1.32, scale: 1.05, ...R.yell.prop } },
    { who: "zee", text: R.calm, key: ["Watch."], expr: "smug", pose: "pointUp", shot: "zee_close", role: "calm", listen: "angry" },
    { who: "creator", text: R.reaction, key: [R.reaction.split(/\s+/).at(-1)], expr: "shocked", pose: "handsUp", shot: "creator_close", role: "how", listen: "shocked", snap_start: true },
    ...R.steps.map((s, i) => ({ who: "zee", text: s.text, key: [s.key], expr: "happy", role: `s${i + 1}`, tempo: FAST, ...(i === 0 ? { shot: "two_shot" } : {}),
      screen: { file: s.screen, chip: `STEP ${i + 1}` }, cues: [...(s.taps ?? []).map((t) => tap(...t)), ...(s.flips ?? []).map(([word, file]) => ({ word, event: `flip|${file}`, sfx: "tick" }))] })),
    { who: "creator", text: "How long did that take?", key: ["long"], expr: "shocked", pose: "chin", shot: "creator_close", role: "long", visual: { kind: "none" } },
    { who: "zee", text: R.time.say, key: [R.time.key], expr: "smug", pose: "point", shot: "zee_close", role: "time", listen: "shocked",
      visual: { kind: "roll", value: R.time.seconds, format: "clock", secs: 0.8, scale: 0.78, up: 1.35, label: R.time.label } },
    { who: "creator", text: R.excited, key: [R.excited_key], expr: "happy", pose: "pointUpL", shot: "end_two", role: "making", visual: { kind: "none" } },
  ];
  const n = lines.length - 3;   // the "how long" line's index + 1: the result clip follows the answer
  const clip = (c, after, extra) => ({ name: c.name, file: R.creation.file, in: c.in, out: c.out, hq_dir: R.creation.hq_dir, ...(R.creation.hq_ext ? { hq_ext: R.creation.hq_ext } : {}), fullscreen: true, enter: "grow", pre: 0.32, post: 0.08, duck_db: 7, after_line: after, ...extra });
  const s = assembleStory(R.key, {
    title: R.title, template: R.template, world: R.world ?? "studio", music_bpm: 128, music_shift: 0, music_style: R.music === false ? "none" : "drive", music_db_under: 12, no_lead: true, first_second: true, tail: 0.25, creation: "this",
    energy: R.music === false ? { reveal_lines: [], reveal_clips: [] } : { reveal_lines: [], reveal_clips: [], from_frame0: true, hard_stop: { line: 1, word: R.calm.split(/\s+/).length - 1, clip: 0 } },
    recipe: { angle: "A5", hook_type: "rage_hook", length_bucket: "25-30", famous_name: false, end_trigger: "comment" },
    lines, clips: [clip(R.clips[0], 1), clip(R.clips[1], n + 1, { pre: 0.8 })],
    end: { line: { who: "zee", text: R.end.text, key: R.end.key, expr: "happy", pose: "wave", role: "cta", tempo: FAST, cues: [{ word: R.end.name_word, event: "site", sfx: "sparkle" }, { word: R.end.comment_word, event: "cta", sfx: "pop" }] }, cta: { id: `comment_${R.key}`, kind: "comment", chip: R.end.chip } },
    caption: R.caption,
  }, { this: { hq_dir: R.creation.hq_dir } }, R.creation.id);
  delete s.headline;   // no title card: the yell is the hook
  // the screens and the "none" prop bring no pop of their own
  for (const l of s.lines) if (l.screen || l.visual?.kind === "none") l.cues = l.cues.filter((c) => !c.event.startsWith("show"));
  // 25-30 s with no words cut
  Object.assign(s, { lufs_target: -15, squeeze: 0.14, gap_speaker: 0.12, gap_same: 0.08, voices: VOICES });
  // Zee answers fast after the creator: the camera may leave the close-up early here
  for (const m of s.shots) if (m.at.startsWith("long.") || m.at.startsWith("how.")) m.hold = 0.5;
  // assembleStory ends on two_shot: this recipe ends higher, and stays there
  s.lines.at(-1).shot = "end_two"; s.shots = s.shots.filter((m) => !m.at.startsWith("cta."));
  return { raw: s, censored: { ...s, bleep: { line: 0, word: swear, show: R.yell.show } } };
}

/** What each paid take is. Three takes of the yell, then every other line once. */
export function rageTakes(R, S) {
  const shout = (text) => text.toUpperCase().replace(/[.!?…]+$/, "") + "!!!";
  const creator = { voice: S.voices.eleven.creator.id, model: "eleven_v3", stability: 0 };
  const zee = { voice: S.voices.eleven.zee.id, model: null, stability: 0.6, style: 0.2, speed: 1.05 };
  return [
    ...["a", "b", "c"].map((k) => ({ file: `yell_${k}.mp3`, text: `${YELL_TAGS} ${shout(R.yell.text)}`, ...creator })),
    ...S.lines.slice(1).map((l, i) => {
      const file = `line${String(i + 2).padStart(2, "0")}.mp3`;
      if (l.who === "zee") return { file, text: l.say ?? l.text, ...zee };
      return { file, text: `${l.role === "how" ? REACT_TAGS : EXCITED_TAGS} ${l.text}`, ...creator };
    }),
  ];
}

async function makeTakes(R, S, dir) {
  const { admin } = await import("file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs");
  const { createBudgetGuard } = await import("../../supabase/functions/_shared/contentMachine/budgetGuard.js");
  const { createStore } = await import("../../supabase/functions/_shared/contentMachine/store.js");
  for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  const V2 = fs.readFileSync(path.join(HERE, "elevenTakes.mjs"), "utf8").match(/model_id: "([^"]+)"/)[1];   // the model every calm line uses
  const jobs = rageTakes(R, S).filter((j) => !fs.existsSync(path.join(dir, j.file)));
  const worst = jobs.reduce((a, j) => a + j.text.length, 0) * PER_CHAR;
  console.log(`${jobs.length} takes, worst case $${worst.toFixed(4)}, cap $${R.cap_usd}`);
  if (worst > R.cap_usd) throw new Error(`over the $${R.cap_usd} cap`);
  const guard = createBudgetGuard({ store: createStore(admin()) });
  let total = 0;
  for (const j of jobs) {
    const r = await guard.spend("other", "studio.voice_lines", j.text.length * PER_CHAR, async () => {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${j.voice}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ text: j.text, model_id: j.model ?? V2, voice_settings: { stability: j.stability, similarity_boost: 0.75, ...(j.style != null ? { style: j.style, use_speaker_boost: true } : {}), ...(j.speed != null ? { speed: j.speed } : {}) } }) });
      if (!res.ok) throw new Error(`${j.file}: ${res.status} ${(await res.text()).slice(0, 240)}`);
      const chars = Number(res.headers.get("character-cost")) || j.text.length;
      fs.writeFileSync(path.join(dir, j.file), Buffer.from(await res.arrayBuffer()));
      return { result: chars, actualUsd: chars * PER_CHAR };
    }, { lane: "studio", live: true });
    total += r.actualUsd ?? 0;
    console.log(`${j.file}: ${r.result} characters`);
  }
  fs.appendFileSync(path.join(dir, "cost.log"), `${new Date().toISOString()} ${jobs.length} takes $${total.toFixed(4)}\n`);
  console.log(`spent $${total.toFixed(4)}`);
  // the most intense yell: loudest and highest (measureTakes.py)
  const scores = JSON.parse(execFileSync("python", [path.join(HERE, "measureTakes.py"), ...["a", "b", "c"].map((k) => path.join(dir, `yell_${k}.mp3`))], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  const best = scores.sort((a, b) => b.score - a.score)[0];
  for (const x of scores) console.log(`${path.basename(x.file)}: ${x.seconds} s, ${x.lufs} LUFS, pitch ${x.pitch} Hz, score ${x.score}: "${x.text}"`);
  fs.copyFileSync(best.file, path.join(dir, "line01.mp3"));
  console.log(`line 1 is ${path.basename(best.file)}`);
  setTimeout(() => process.exit(0), 300);
}

function render(R) {
  const win = (p) => p.replace(/\\/g, "/");
  const out = path.resolve(HERE, "../..", R.out_dir); fs.mkdirSync(out, { recursive: true });
  const env = { ...process.env, STUDIO_SCRATCH: win(path.join(WORKER, "scratch")), PICS_DIR: win(path.join(WORKER, "pool")), PROTO_DIR: win(path.join(WORKER, "proto")), SCREENS: win(path.join(WORKER, "src_work", R.screens)), MEDIA: "/nonexistent" };
  for (const [script, suffix] of [["script.json", "bleep"], ["script_raw.json", "uncensored"]]) {
    const work = path.join(WORKER, "scratch", `${R.key}_${suffix}`); fs.mkdirSync(work, { recursive: true });
    const log = execFileSync("bash", [path.join(HERE, "buildStory.sh"), win(path.join(WORKER, "scratch", "story", R.key, script)), win(work), win(path.join(out, `${R.key}_${suffix}.mp4`))], { env, encoding: "utf8", maxBuffer: 1e8 });
    console.log(log.split("\n").filter((l) => /rendered|SAFE|^eleven|PROBLEM|rror/.test(l)).map((l) => l.slice(0, 500)).join("\n"));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, step] = process.argv.slice(2);
  const R = JSON.parse(fs.readFileSync(file, "utf8")), dir = path.join(WORKER, "scratch", "story", R.key);
  fs.mkdirSync(dir, { recursive: true });
  const { raw, censored } = rageHookScript(R);
  fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(censored, null, 1));
  fs.writeFileSync(path.join(dir, "script_raw.json"), JSON.stringify(raw, null, 1));
  if (step === "script") console.log(raw.lines.map((l, i) => `${i + 1} ${l.who} ${l.shot ?? "-"}: ${l.text}`).join("\n"));
  else if (step === "takes") await makeTakes(R, raw, dir);
  else if (step === "render") render(R);
  else throw new Error("the step: script, takes or render");
}
