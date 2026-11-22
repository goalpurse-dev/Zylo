// REPLICA TEST (owner 2026-11-22, internal only): ONE take of the reference script in the owner's own voice
// "roblox-story", slow and creepy, then (free, local) a gentle tempo fit to the reference's ~61 s if it is far off.
//   node --env-file=.env.local scripts/blockyWorlds/replica/voice.mjs --out <dir> [--yes]
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { synthesize } from "../../../supabase/functions/_shared/blockyWorlds/voice.js";
import { ROBLOX_STORY } from "../../../supabase/functions/_shared/blockyWorlds/config.js";

export const LINES = [
  "In this town, nobody ever looks outside after 10 PM.",
  "Every night, at exactly 9:59, all my neighbors close their curtains, lock their doors, and turn off their lights.",
  "Nobody talks about why.",
  "Ten years ago, my best friend Noah disappeared after going outside at night.",
  "My mom always told me he moved away.",
  "But tonight, at 10:03, I looked through my bedroom window...",
  "and standing under the streetlight... was Noah.",
  "He looked exactly the same as the day he disappeared.",
  "I stepped closer to the window.",
  "He looked directly at me and slowly mouthed three words.",
  "\"Your mom lied.\"",
  "Suddenly... I heard my bedroom door open.",
  "My mom stood behind me.",
  "\"I told you never to look outside.\"",
  "I turned back to the window.",
  "Noah was gone.",
  "But then I noticed something terrifying.",
  "Every single neighbor was standing behind their window...",
  "and they were all looking directly at my house.",
];
const argv = process.argv.slice(2), arg = (k) => argv[argv.indexOf(`--${k}`) + 1];
if (import.meta.url.endsWith(process.argv[1].split(path.sep).join("/").split("/").pop())) {
  const OUT = path.resolve(arg("out")); fs.mkdirSync(OUT, { recursive: true });
  const text = LINES.join(" ");
  console.log(`one take, ${text.length} characters, voice ${ROBLOX_STORY.voiceName} (${ROBLOX_STORY.voiceId}), speed 0.92`);
  if (!argv.includes("--yes")) process.exit(0);
  if (fs.existsSync(path.join(OUT, "take.json"))) { console.log("already made (no second paid take)"); process.exit(0); }
  const narrator = { ...ROBLOX_STORY, settings: { ...ROBLOX_STORY.settings, speed: 0.92, stability: 0.45 } };
  const r = await synthesize({ apiKey: process.env.ELEVENLABS_KEY ?? process.env.ELEVENLABS_API_KEY, text, narrator });
  fs.writeFileSync(path.join(OUT, "take.mp3"), Buffer.from(r.audioBase64, "base64"));
  fs.writeFileSync(path.join(OUT, "take.json"), JSON.stringify({ text, spoken: r.spoken, costUsd: r.costUsd, voice: narrator.voiceName, settings: narrator.settings }, null, 1));
  const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path.join(OUT, "take.mp3")]).toString());
  console.log(JSON.stringify({ seconds: +dur.toFixed(2), words: r.spoken.length, costUsd: r.costUsd }));
}
