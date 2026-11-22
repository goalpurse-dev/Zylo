// REPLICA ROUND 2 voice (owner 2026-11-22): the owner's "roblox-story" voice, more expressive (lower stability, a little
// style), sped up after the take (atempo, pitch kept). --sample: ONE short take of the first 2 lines, processed at 1.2x
// and 1.25x, each checked with speech-to-text (word errors) -> the clearer speed. --full: ONE take of the whole script at
// the chosen speed -> voice/words.json + voice.wav (the old take is kept as voice_r1/).
//   node --env-file=.env.local scripts/blockyWorlds/replica/voice2.mjs --dir <replica dir> --sample|--full [--speed 1.25] [--yes]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { synthesize } from "../../../supabase/functions/_shared/blockyWorlds/voice.js";
import { ROBLOX_STORY } from "../../../supabase/functions/_shared/blockyWorlds/config.js";
import { LINES } from "./voice.mjs";
import { ledger } from "../studio/ledger.mjs";

const argv = process.argv.slice(2), has = (k) => argv.includes(`--${k}`), arg = (k, d = null) => (has(k) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const DIR = path.resolve(arg("dir"));
const L = ledger(DIR, { capUsd: 3, agentCapUsd: 3 });   // the test's own ledger (round 2 adds at most $1)
export const VOICE2 = { stability: 0.35, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true, speed: 1.0 };
const KEY = process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY;
const narrator = { ...ROBLOX_STORY, settings: { ...VOICE2 } };
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
const wer = (ref, hyp) => { const d = Array.from({ length: ref.length + 1 }, (_, i) => [i, ...Array(hyp.length).fill(0)]); for (let j = 1; j <= hyp.length; j++) d[0][j] = j; for (let i = 1; i <= ref.length; i++) for (let j = 1; j <= hyp.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)); return d[ref.length][hyp.length] / Math.max(1, ref.length); };
async function stt(file) {
  const fd = new FormData(); fd.append("model_id", "scribe_v1"); fd.append("file", new Blob([fs.readFileSync(file)], { type: "audio/mpeg" }), "v.mp3");
  const r = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": KEY }, body: fd });
  L.add("speech_to_text", (dur(file) / 3600) * 0.4);
  return (await r.json()).text ?? "";
}
async function take(text, out) {
  fs.mkdirSync(out, { recursive: true });
  if (fs.existsSync(path.join(out, "take.json"))) return JSON.parse(fs.readFileSync(path.join(out, "take.json"), "utf8"));
  L.check("voice take", text.length * 0.0001 + 0.02);
  const r = await synthesize({ apiKey: KEY, text, narrator });
  fs.writeFileSync(path.join(out, "take.mp3"), Buffer.from(r.audioBase64, "base64"));
  const t = { text, spoken: r.spoken, costUsd: r.costUsd, settings: narrator.settings };
  fs.writeFileSync(path.join(out, "take.json"), JSON.stringify(t, null, 1));
  L.add("voice", r.costUsd ?? text.length * 0.000088);
  return t;
}
const atempo = (src, k, dst) => execFileSync("ffmpeg", ["-v", "error", "-y", "-i", src, "-af", `atempo=${k}`, "-ar", "44100", "-ac", "1", dst]);
if (!has("yes")) { console.log("dry run (add --yes)"); process.exit(0); }
if (has("sample")) {
  const text = LINES.slice(0, 2).join(" ");
  const out = path.join(DIR, "voice2_sample");
  await take(text, out);
  const res = {};
  for (const k of [1.2, 1.25]) {
    const f = path.join(out, `sample_${k}x.mp3`); atempo(path.join(out, "take.mp3"), k, f);
    const hyp = await stt(f);
    res[k] = { seconds: +dur(f).toFixed(2), wordErrorRate: +wer(norm(text), norm(hyp)).toFixed(3), heard: hyp };
  }
  // the clearer: fewer word errors; a tie goes to the owner's 1.25x
  const pick = res[1.25].wordErrorRate <= res[1.2].wordErrorRate ? 1.25 : 1.2;
  fs.writeFileSync(path.join(out, "result.json"), JSON.stringify({ res, pick }, null, 1));
  console.log(JSON.stringify({ res, pick, spent: L.total() }, null, 1));
}
if (has("full")) {
  const k = Number(arg("speed", 1.25));
  const vd = path.join(DIR, "voice");
  if (!fs.existsSync(path.join(DIR, "voice_r1"))) fs.renameSync(vd, path.join(DIR, "voice_r1"));
  const t = await take(LINES.join(" "), vd);
  atempo(path.join(vd, "take.mp3"), k, path.join(vd, "voice.wav"));
  const words = t.spoken.map((x) => ({ word: x.w, start: +(x.s / k).toFixed(3), end: +(x.e / k).toFixed(3) }));
  fs.writeFileSync(path.join(vd, "words.json"), JSON.stringify(words));
  console.log(JSON.stringify({ speed: k, raw: +dur(path.join(vd, "take.mp3")).toFixed(2), seconds: +dur(path.join(vd, "voice.wav")).toFixed(2), words: words.length, spent: L.total() }));
}
