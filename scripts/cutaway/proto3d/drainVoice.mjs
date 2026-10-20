// French drain voiceover (pre-approved: up to $0.15 of ElevenLabs). One take with the approved Eric settings
// (voice test (a): stability 0.3, style 0.45, speed 1.1), saved raw with its word times; the re-time by real
// silences is voiceSilence.mjs (free). Cost = character-cost header x $0.0002 (as logged for the landfill takes).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [wt, OUT] = process.argv.slice(2);
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const { alignmentWords } = await import(pathToFileURL(path.join(wt, "supabase/functions/_shared/cutaway/voice.js")).href);
export const SCRIPT = "If you dig a ditch along your house, you have a drain. But one inch of rain on a small roof dumps over 600 gallons right by your walls. The ditch floods. Five feet down, that water pushes over 300 pounds on each square foot, and the wall cracks. So you fill the ditch with gravel, but the water still sits at the bottom. So you lay a pipe full of holes under the gravel. This is a French drain. Water seeps in through the holes, and the pipe slopes downhill to carry it away. Wrap the gravel in fabric so mud can't clog it. And the French in French drain is not France. It is Henry French, a New England farmer and judge who wrote the book on drains in 1859. Add the grass back on top. Congratulations, you have built a French drain.";
const CAP = 0.15, PER = 0.0002;
// worst case: every character billed (the landfill takes were billed at about 0.4 per character)
if (SCRIPT.length * PER > CAP) throw new Error(`budget: worst case $${(SCRIPT.length * PER).toFixed(3)} is over $${CAP}`);
fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(`${OUT}/raw.mp3`)) throw new Error(`${OUT}/raw.mp3 exists: not paying for a second take`);
const res = await fetch("https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal/with-timestamps?output_format=mp3_44100_128", {
  method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ text: SCRIPT, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.3, similarity_boost: 0.75, style: 0.45, use_speaker_boost: true, speed: 1.1 } }),
});
const chars = Number(res.headers.get("character-cost")) || SCRIPT.length;
if (!res.ok) { console.log("failed (not billed):", res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const body = await res.json();
fs.writeFileSync(`${OUT}/raw.mp3`, Buffer.from(body.audio_base64, "base64"));
const words = alignmentWords(body.alignment ?? body.normalized_alignment);
fs.writeFileSync(`${OUT}/raw.words.json`, JSON.stringify(words));
const usd = +(chars * PER).toFixed(4);
fs.writeFileSync(`${OUT}/voice.json`, JSON.stringify({ script: SCRIPT, chars: SCRIPT.length, characterCost: chars, usd, words: words.length, rawSeconds: words.at(-1).e }, null, 1));
console.log(`ok: ${words.length} words, raw ${words.at(-1).e.toFixed(1)} s, character-cost ${chars}, $${usd}`);
