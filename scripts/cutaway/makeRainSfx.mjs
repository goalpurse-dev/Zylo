// The library's rain effect (owner-approved 2026-10-20: one ElevenLabs effect, up to $0.03). Same fixed prompt as
// LIBRARY.rain in _shared/cutaway/sound.js, made at 3.5 s instead of 4 so it stays under the cap (it loops softly,
// so the length doesn't matter). Cached as render-worker/assets/sfx/lib-rain.mp3 like the other library files.
//   node scripts/cutaway/makeRainSfx.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const WT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { LIBRARY, generateSfx } = await import(pathToFileURL(path.join(WT, "supabase/functions/_shared/cutaway/sound.js")).href);
const OUT = path.join(WT, "render-worker/assets/sfx/lib-rain.mp3");
const CAP = 0.03, SECONDS = 3.5, USD_PER_SEC = 0.008; // the library's own estimate when no character-cost header comes back
if (fs.existsSync(OUT)) throw new Error(`${OUT} exists: not paying again`);
if (SECONDS * USD_PER_SEC > CAP) throw new Error(`budget: $${(SECONDS * USD_PER_SEC).toFixed(3)} is over $${CAP}`);
const { bytes, costUsd } = await generateSfx({ apiKey: process.env.ELEVENLABS_KEY, text: LIBRARY.rain.prompt, seconds: SECONDS });
fs.writeFileSync(OUT, bytes);
const log = { key: "rain", prompt: LIBRARY.rain.prompt, seconds: SECONDS, costUsd, bytes: bytes.length, at: new Date().toISOString() };
fs.writeFileSync("C:/Users/Public/Zylo/research/seamless-niche/m2drain/rain_sfx.json", JSON.stringify(log, null, 1));
console.log(JSON.stringify(log));
