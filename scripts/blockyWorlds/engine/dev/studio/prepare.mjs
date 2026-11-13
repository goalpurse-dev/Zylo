// STUDIO MODE prototype, step 1 (dev driver): a library idea -> the script (the production writer, llm.js writeScript,
// board mode) -> the narrator take (voice/eleven.mjs: Scruffy Duck on eleven_v3, silences over 0.15 s cut, 1.25x at the
// same pitch) -> the base plan (planVideo with the real word timings + the free mock director: cast, captions, lines,
// the creature, the production list) -> music A + the simple-look cues + the mix (local ffmpeg, audio only).
// Every paid step is priced first against the experiment cap (scripts/blockyWorlds/studio/ledger.mjs). A finished step's
// file is reused (never a second paid script or take).
//   node dev/studio/prepare.mjs --idea <library id prefix> --out <dir> [--length 60] [--cap 5] --yes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects } from "../../plan.mjs";
import { directStory } from "../../lib/director/index.js";
import { elevenVoice, envKey, narratorFor, paceStats } from "../../voice/eleven.mjs";
import { ledger } from "../../../studio/ledger.mjs";
import { processTake } from "../../../studio/pace.mjs";
import { fixAnimalCast } from "../../../studio/castFix.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHARED = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds");
const ROOT = path.resolve(ENGINE, "../../..");
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const out = path.resolve(arg("out")), LEN = Number(arg("length", 60));
const L = ledger(out, { capUsd: Number(arg("cap", 5)) });
const LIB = JSON.parse(fs.readFileSync(path.join(ROOT, "src/components/viral-tools/blocky-worlds/dev/libraryFixture.json"), "utf8"));
const row = LIB.find((r) => r.id.startsWith(arg("idea"))); if (!row) throw new Error("no such library idea");
const card = row.idea;
const say = (m) => { const l = `[${new Date().toISOString().slice(11, 19)}] ${m}`; console.log(l); fs.appendFileSync(path.join(out, "run.log"), l + "\n"); };
say(`idea "${card.title}" (${card.mood}, ${card.setting}), ${LEN} s; spent so far $${L.total()} of $${L.capUsd}`);
if (!argv.includes("--yes")) { say("dry run: nothing paid (add --yes)"); process.exit(0); }

const LLM = await import(pathToFileURL(path.join(SHARED, "llm.js")).href);
const { kitCheck } = await import(pathToFileURL(path.join(SHARED, "kitCheck.js")).href);
const { formulaProblems } = await import(pathToFileURL(path.join(SHARED, "formula.js")).href);

// --from <run dir>: the script and the paid take of an earlier run (a second director on the SAME words and voice:
// nothing is paid again; the pace is re-fitted for free)
if (arg("from")) {
  const src = path.resolve(arg("from"));
  if (!fs.existsSync(path.join(out, "results.json"))) fs.copyFileSync(path.join(src, "results.json"), path.join(out, "results.json"));
  fs.mkdirSync(path.join(out, "voice"), { recursive: true });
  for (const f of ["take.json", "voice.mp3"]) if (!fs.existsSync(path.join(out, "voice", f))) fs.copyFileSync(path.join(src, "voice", f), path.join(out, "voice", f));
  say(`reusing the script and the take of ${src} (no paid script, no paid voice)`);
}
// 1. the script (worst case = the meter's cap)
const resFile = path.join(out, "results.json");
let script;
if (fs.existsSync(resFile)) { script = JSON.parse(fs.readFileSync(resFile, "utf8")).results[0].script; say("script: reused"); }
else {
  const capScript = Number(arg("script-cap", 0.12)); L.check("script", capScript);
  const apiKey = envKey("ANTHROPIC_KEY") ?? envKey("ANTHROPIC_API_KEY");
  const meter = LLM.moneyMeter(capScript);
  try {
    const w = await L.step("script", () => LLM.writeScript({ apiKey, idea: card, lengthSec: LEN, meter, maxTokens: 8000, board: true }), { idea: row.id });
    script = w.script;
  } finally { L.add("script", meter.spent); L.log({ step: "script", usd: meter.spent, calls: meter.calls }); }
  fs.writeFileSync(resFile, JSON.stringify({ results: [{ script, card }] }, null, 1));
}
const words0 = script.lines.reduce((a, l) => a + l.text.split(/\s+/).length, 0);
const kc = kitCheck(script, { card, boardOnly: true });
say(`script "${script.title}": ${script.lines.length} lines, ${words0} words; formula ${formulaProblems(script, LEN).length} problem(s); kitCheck(board-only) ${kc.ok ? "ok" : `misses ${kc.missing.map((m) => m.word).join(", ")}`} (studio mode builds missing things from blocks, so a miss is reported, not a stop)`);
for (const [i, l] of script.lines.entries()) say(`  ${i}: [${l.part}] ${l.text}`);

// 2. the voice (worst case: 0.5 ElevenLabs credits a character at $0.0002 a credit): the one paid take (voice/eleven.mjs),
// then re-processed by studio/pace.mjs: ALWAYS 1.25x at the same pitch, pauses cut to ~0.10 s inside a sentence and
// ~0.22 s between sentences, no gap over 0.45 s (free). wpm is reported, never a reason to stop.
const narrator = narratorFor("scruffy_duck");
const chars = script.lines.map((l) => String(l.text).trim()).join("\n").length;
const voiceDir = path.join(out, "voice");
const hadTake = fs.existsSync(path.join(voiceDir, "take.json"));
if (!hadTake) L.check("voice", +(chars * 0.5 * 0.0002).toFixed(4));
const v = await L.step("voice", async () => { if (!hadTake) await elevenVoice({ lines: script.lines, outDir: voiceDir, narrator }); return processTake({ outDir: voiceDir }); }, { chars, voice: narrator.voiceName, model: narrator.model, reused: hadTake });
if (!hadTake) L.add("voice", v.costUsd ?? +(chars * 0.44 * 0.0002).toFixed(4));
say(`voice: ${narrator.voiceName} ${narrator.model}, ${v.duration.toFixed(2)} s at ${v.speed}x, pauses 0.10 / 0.22 s (longest ${v.maxGap} s), pace ${JSON.stringify(v.pace)}, $${hadTake ? 0 : v.costUsd} (${hadTake ? "reused take" : "new take"})`);

// 3. the base plan (free): the real word timings; the mock director (no paid call)
const direction = await directStory({ script, idea: card, provider: "mock" });
const tl0 = await L.step("plan", () => planVideo({ script, words: v.words, idea: card, lengthSec: LEN, direction, criticalMode: "report" }));
const castFixes = fixAnimalCast(tl0, script); // a pet the planner cast as a person (studio/castFix.mjs)
if (castFixes.length) say(`cast fix: ${castFixes.map((f) => `${f.name} is a ${f.species}, not a person`).join("; ")}`);
fs.writeFileSync(path.join(out, "base-timeline.json"), JSON.stringify(tl0));
fs.writeFileSync(path.join(out, "words.json"), JSON.stringify(v.words));
say(`base plan: ${tl0.shots.length} shots, ${tl0.duration} s, look ${tl0.look}, cast ${Object.keys(tl0.cast ?? {}).join(", ")}, monster ${tl0.monster ? JSON.stringify(tl0.monster).slice(0, 80) : "none"}; base checks timeline ${checkTimeline(tl0).length}, visuals ${checkVisuals(tl0, script).length}, subjects ${checkSubjects(tl0).length}`);

// 4. music A + the simple-look cues + the mix (audio only, local ffmpeg: light)
await L.step("mix", async () => {
  const { bedFromLoop, mixAudio } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const { sfxCues } = await import(pathToFileURL(path.join(ENGINE, "lib", "sfx.js")).href);
  const { simpleCues, AUDIO_SIMPLE } = await import(pathToFileURL(path.join(ENGINE, "lib", "audioPlan.js")).href);
  const music = path.join(out, "music.wav");
  await bedFromLoop("A", tl0.duration, music, { tempo: AUDIO_SIMPLE.bedTempo });
  const cues = simpleCues(tl0, sfxCues(tl0), script);
  const a = await mixAudio({ voice: v.wav, music, out: path.join(out, "mix.m4a"), duration: tl0.duration, sfxCues: cues, musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb });
  say(`mix: ${a.lufs} LUFS, ${cues.length} cues`);
});
fs.writeFileSync(path.join(out, "prepared.json"), JSON.stringify({ idea: { id: row.id, title: card.title }, script: script.title, lines: script.lines.length, words: words0, duration: tl0.duration, voice: { wpm: v.pace.wpm, speed: v.speed, maxGap: v.maxGap, pace: paceStats(v.words) }, kitCheck: { ok: kc.ok, missing: kc.missing.map((m) => m.word) } }, null, 1));
say(`prepared; spent $${L.total()}`);
