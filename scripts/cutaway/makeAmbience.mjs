// The setting ambiences (owner-approved 2026-10-25: one sound bed per setting, up to $0.20 in total, made once and cached
// forever as render-worker/assets/sfx/amb-<setting>.mp3). ElevenLabs sound effects, 8 s each (looped under the voice
// with crossfades by m2/audio.mjs). A file that exists is never paid for again; the run stops before the cap.
//   node scripts/cutaway/makeAmbience.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { generateSfx } = await import(pathToFileURL(path.join(WT, "supabase/functions/_shared/cutaway/sound.js")).href);
export const AMBIENCE = {
  yard: "quiet suburban backyard ambience, a soft breeze and distant birds, no voices, no music",
  street: "city street ambience, a steady low rumble of traffic and cars passing, no horns, no voices, no music",
  park: "quiet park ambience, birds and a light breeze in the trees, faint far-off traffic, no voices, no music",
  garage: "quiet indoor garage room tone, a faint electrical hum and a little echo, no voices, no music",
  room: "quiet house interior room tone, very faint, no voices, no music",
  carwash: "car wash bay ambience, water spraying steadily and a machine humming, no voices, no music",
};
const CAP = 0.2, SECONDS = 8, NEXT_WORST = 0.03; // a call has cost about $0.002 a second (the rain: $0.007 for 3.5 s)
const LOG = "C:/Users/Public/Zylo/research/seamless-niche/work/m2spend.jsonl";
let spent = 0; const made = [];
for (const [key, prompt] of Object.entries(AMBIENCE)) {
  const out = path.join(WT, "render-worker/assets/sfx", `amb-${key}.mp3`);
  if (fs.existsSync(out)) { console.log(`${key}: cached`); continue; }
  if (spent + NEXT_WORST > CAP) { console.log(`stop: $${spent.toFixed(3)} spent, the next could pass $${CAP}`); break; }
  const { bytes, costUsd } = await generateSfx({ apiKey: process.env.ELEVENLABS_KEY, text: prompt, seconds: SECONDS });
  fs.writeFileSync(out, bytes); spent += costUsd;
  fs.appendFileSync(LOG, `${JSON.stringify({ at: new Date().toISOString(), label: `sfx ambience ${key} (ElevenLabs)`, chars: prompt.length, costUsd })}\n`);
  made.push({ key, prompt, seconds: SECONDS, costUsd, bytes: bytes.length });
  console.log(`${key}: $${costUsd} (${bytes.length} bytes)`);
}
fs.writeFileSync("C:/Users/Public/Zylo/research/seamless-niche/ambience_sfx.json", JSON.stringify({ made, spent: +spent.toFixed(4), at: new Date().toISOString() }, null, 1));
console.log(`total $${spent.toFixed(4)}`);
