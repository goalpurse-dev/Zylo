// the copy's line in its voice (soft, too sweet, slightly slow) for the owner to hear before the final
//   node --env-file=.env.local scripts/blockyWorlds/v2/copyVoiceSample.mjs --name curtains --yes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { partTake } from "../engine/voice/castVoice.mjs";
import { spokenText } from "../../../supabase/functions/_shared/blockyWorlds/castVoices.js";
import { COPY_SWEET } from "./voices.mjs";
import { ledger } from "../studio/ledger.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2), arg = (k, d = null) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const OUT = path.join(HERE, "..", "..", "..", "reference", "blocky-worlds", "v2", `story_${arg("name", "curtains")}`);
const SC = JSON.parse(fs.readFileSync(path.join(OUT, "script.json"), "utf8")).script;
const line = SC.lines.find((l) => l.speaker === "mimic");
if (!argv.includes("--yes")) { console.log(`the copy's line: "${line.text}"; add --yes`); process.exit(0); }
const L = ledger(OUT, { capUsd: 3, agentCapUsd: 3 });
L.check("copy voice sample", 0.02);
const r = await partTake({ text: spokenText(line.text), narrator: COPY_SWEET, dir: path.join(OUT, "voice_samples", "copy"), apiKey: process.env.ELEVENLABS_KEY });
L.add("voice_samples", r.costUsd);
fs.copyFileSync(r.wav, path.join(OUT, "voice_samples", "sample_copy.wav"));
console.log(`copy: ${r.seconds.toFixed(1)} s, $${r.costUsd}`);
