// ROUND 3: ONE SHORT SAMPLE PER CHARACTER VOICE for the owner's approval (castVoices.js VOICE_TYPES; ~30 characters each,
// about $0.003 a sample), made exactly like the real parts (1.2 then sped up to 1.25, pitch kept). With --story <dir>
// also the story's own quoted line(s) in the voice its character got. Cached: a sample is never bought twice.
//   node --env-file=.env.local scripts/blockyWorlds/round3/voiceSamples.mjs --out <dir> [--story <dir>] [--yes]
import fs from "node:fs";
import path from "node:path";
import { ledger } from "../studio/ledger.mjs";
import { VOICE_TYPES, SAMPLE_LINES, voiceParts, spokenText } from "../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { partTake, voiceOf } from "../engine/voice/castVoice.mjs";

const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(path.join(OUT, "voice_samples"), { recursive: true });
const L = ledger(OUT, { capUsd: Number(arg("cap", 2)), agentCapUsd: Number(arg("cap", 2)) });
const KEY = process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY;
const jobs = Object.entries(SAMPLE_LINES).map(([type, text]) => ({ name: type, text, narrator: VOICE_TYPES[type] }));
const SD = arg("story") ? path.resolve(arg("story")) : null;
if (SD && fs.existsSync(path.join(SD, "script.json")) && fs.existsSync(path.join(SD, "voices.json"))) {
  const script = JSON.parse(fs.readFileSync(path.join(SD, "script.json"), "utf8")).script;
  const voices = JSON.parse(fs.readFileSync(path.join(SD, "voices.json"), "utf8"));
  voiceParts(script).filter((p) => p.who !== "narrator").forEach((p, i) => jobs.push({ name: `story_${i + 1}_${p.who.replace(/\W+/g, "")}`, text: spokenText(p.text), narrator: voiceOf(p.who, voices), who: p.who }));
}
const chars = jobs.reduce((a, j) => a + j.text.length, 0);
console.log(`${jobs.length} samples, ${chars} characters, about $${(chars * 0.0001).toFixed(3)}`);
if (!has("yes")) process.exit(0);
L.check("voice samples", chars * 0.0001 + 0.01);
const res = [];
for (const j of jobs) {
  const r = await partTake({ text: j.text, narrator: j.narrator, dir: path.join(OUT, "voice_samples", "parts", j.name), apiKey: KEY });
  L.add("voice_samples", r.costUsd);
  const dst = path.join(OUT, "voice_samples", `${j.name}.wav`);
  fs.copyFileSync(r.wav, dst);
  res.push({ sample: j.name, who: j.who ?? null, voice: j.narrator.voiceName, voiceId: j.narrator.voiceId, text: j.text, seconds: +r.seconds.toFixed(2), file: dst });
}
fs.writeFileSync(path.join(OUT, "voice_samples", "samples.json"), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ samples: res.map((x) => `${x.sample}: ${x.voice} "${x.text}" ${x.seconds}s`), spent: L.total() }, null, 1));
