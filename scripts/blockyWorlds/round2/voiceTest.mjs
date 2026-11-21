// ROUND 2 TEST (owner 2026-11-21, A7): Scruffy Duck at 1.1x vs 1.25x on ONE script. One paid ElevenLabs take, then the
// same take processed twice (free: studio/pace.mjs at speed 1.1 and 1.25). "Easier to understand" is measured, not
// guessed: each version goes through ElevenLabs speech-to-text and the transcript is compared with the script (word
// error rate), plus the words per minute and the length.
//   node --env-file=.env.local scripts/blockyWorlds/round2/voiceTest.mjs --script <script_night.json> --out <dir> [--yes]
import fs from "node:fs";
import path from "node:path";
import { elevenVoice, envKey } from "../engine/voice/eleven.mjs";
import { processTake, PACE } from "../studio/pace.mjs";
import { ledger } from "../studio/ledger.mjs";

const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
const L = ledger(path.dirname(OUT), { capUsd: 5, agentCapUsd: 5 });
const s = JSON.parse(fs.readFileSync(path.resolve(arg("script")), "utf8")).script;
const lines = s.lines.map((l) => l.text);
const chars = lines.join("\n").length;
console.log(`voice test: "${s.title}", ${lines.length} lines, ${chars} characters (about $${(chars * 0.0002).toFixed(2)} for the take + ~$0.02 speech-to-text)`);
if (!has("yes")) process.exit(0);
L.check("voice take", chars * 0.0002 + 0.05);
const raw = path.join(OUT, "take");
const r0 = await elevenVoice({ lines, outDir: raw });
if (!fs.existsSync(path.join(OUT, "take.booked"))) { L.add("voice", r0.costUsd ?? chars * 0.0002); fs.writeFileSync(path.join(OUT, "take.booked"), "1"); }
const norm = (t) => String(t).toLowerCase().replace(/[^a-z' ]+/g, " ").split(/\s+/).filter(Boolean);
/** word error rate (Levenshtein over words) */
const wer = (ref, hyp) => {
  const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]);
  for (let j = 1; j <= hyp.length; j++) d[0][j] = j;
  for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1));
  return d[ref.length][hyp.length] / Math.max(1, ref.length);
};
const ref = norm(lines.join(" "));
const out = {};
for (const speed of [1.1, 1.25]) {
  const dir = path.join(OUT, `x${speed}`); fs.mkdirSync(dir, { recursive: true });
  for (const f of ["take.json", "voice.mp3"]) fs.copyFileSync(path.join(raw, f), path.join(dir, f));
  const p = await processTake({ outDir: dir, P: { ...PACE, speed } });
  const mp3 = path.join(dir, `voice_${speed}x.mp3`);
  (await import("node:child_process")).execFileSync("ffmpeg", ["-v", "error", "-y", "-i", p.wav, "-b:a", "128k", mp3]);
  // speech-to-text (ElevenLabs scribe): what a listener's ear (a machine one) hears
  const fd = new FormData();
  fd.append("model_id", "scribe_v1");
  fd.append("file", new Blob([fs.readFileSync(mp3)], { type: "audio/mpeg" }), "v.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": envKey("ELEVENLABS_KEY") }, body: fd });
  const j = await res.json().catch(() => ({}));
  L.add("speech_to_text", (p.duration / 3600) * 0.4);
  const hyp = norm(j.text ?? "");
  out[speed] = { seconds: +p.duration.toFixed(1), wpm: Math.round(p.words.length / (p.duration / 60)), wordErrorRate: +wer(ref, hyp).toFixed(3), sttStatus: res.status, file: mp3 };
  fs.writeFileSync(path.join(dir, "transcript.txt"), j.text ?? JSON.stringify(j).slice(0, 400));
}
fs.writeFileSync(path.join(OUT, "voice_test.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
console.log(`spent so far $${L.total()} of $5`);
