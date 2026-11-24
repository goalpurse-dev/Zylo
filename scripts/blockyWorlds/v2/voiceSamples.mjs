// IN THIS TOWN v2: three 15 s voice samples of the same lines (owner 2026-11-24): (a) roblox-story, stable settings, an
// English-only model; (b) the same on multilingual v2; (c) the same settings on a neutral American stock narrator.
//   node scripts/blockyWorlds/v2/voiceSamples.mjs --name curtains --yes
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { elevenVoice } from "../engine/voice/eleven.mjs";
import { NARRATOR_SAMPLES } from "./voices.mjs";
import { ledger } from "../studio/ledger.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const NAME = arg("name", "curtains");
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${NAME}`, "voice_samples");
fs.mkdirSync(OUT, { recursive: true });
const L = ledger(path.dirname(OUT), { capUsd: 3, agentCapUsd: 3 });
const SC = JSON.parse(fs.readFileSync(path.join(OUT, "..", "script.json"), "utf8")).script;
// the same opening lines for all three: about 15 s at 1.2x (~45 words)
const lines = []; let words = 0;
for (const l of SC.lines) { if (l.speaker !== "narrator") break; lines.push(l.text); words += l.text.split(/\s+/).length; if (words >= 42) break; }
const SAMPLES = NARRATOR_SAMPLES;
if (!argv.includes("--yes")) { console.log(`3 samples of: ${lines.join(" ")} (${words} words); add --yes`); process.exit(0); }
for (const [k, n] of Object.entries(SAMPLES)) {
  L.check(`voice sample ${k}`, 0.06);
  const r = await elevenVoice({ lines, outDir: path.join(OUT, k), narrator: n });
  L.add("voice_samples", r.costUsd ?? 0.03);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", r.wav, "-t", "15", path.join(OUT, `sample_${k}.wav`)]);
  console.log(`${k}: ${r.duration.toFixed(1)} s, ${r.wpm} wpm, $${r.costUsd}: ${n.about}`);
}
fs.writeFileSync(path.join(OUT, "README.txt"), [`The same lines in all three: "${lines.join(" ")}"`, "", ...Object.entries(SAMPLES).map(([k, n]) => `sample_${k}.wav: ${n.about}`)].join("\n"));
console.log(`spent in folder: $${L.total()}`);
