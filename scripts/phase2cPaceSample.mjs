// Phase 2c — ONE short ElevenLabs pace sample (Josh, eleven_flash_v2_5,
// speed 1.0) of the Myth vs Reality cold open, via the service-only
// elevenlabs-pace-sample function. Saves a permanent fixture:
//   tests/fixtures/stickman/audio/pace-samples/josh-flash_v2_5-speed-1.00/
//     audio.mp3, alignment.raw.json, meta.json (wpm, character-cost, settings)
// Refuses to run if the fixture exists. Never retries.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { writeFile, mkdir, access, readFile } from "node:fs/promises";

const VOICE = { label: "Josh", voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceModel: "eleven_flash_v2_5", speed: 1.0 };
const DIR = new URL("../tests/fixtures/stickman/audio/pace-samples/josh-flash_v2_5-speed-1.00/", import.meta.url);
try {
  await access(new URL("meta.json", DIR));
  console.log("pace sample fixture already exists — never regenerated.");
  process.exit(1);
} catch { /* not there yet */ }

// The cold open of the Myth vs Reality narration, to the end of its 7th sentence.
const meta = JSON.parse(await readFile(new URL("../tests/fixtures/stickman/audio/myth-vs-reality/meta.json", import.meta.url), "utf8"));
const sentences = meta.segmentTexts.map((s) => s.text).join(" ").match(/[^.!?]+[.!?]+/g).map((s) => s.trim());
const text = sentences.slice(0, sentences.findIndex((s) => s.startsWith("So did any Viking")) + 1).join(" ");
console.log(`sample: ${text.length} characters, ${text.split(/\s+/).length} words, speed ${VOICE.speed}`);

const res = await fetch(`${process.env.SUPABASE_URL}/functions/v1/elevenlabs-pace-sample`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ ...VOICE, text }),
});
const out = await res.json();
if (!out.ok) {
  console.log("sample FAILED — not retried:", out.error ?? JSON.stringify(out).slice(0, 400));
  process.exit(1);
}
await mkdir(DIR, { recursive: true });
await writeFile(new URL("audio.mp3", DIR), Buffer.from(out.audioBase64, "base64"));
await writeFile(new URL("alignment.raw.json", DIR), JSON.stringify(out.rawAlignment));
await writeFile(new URL("meta.json", DIR), JSON.stringify({ ...VOICE, text, characters: out.characters, wordCount: out.wordCount, wpm: out.wpm, durationSeconds: out.durationSeconds, characterCost: out.characterCost, requestId: out.requestId, voiceSettings: out.voiceSettings, recordedAt: new Date().toISOString() }, null, 2));
console.log(`measured ${out.wpm} wpm (${out.wordCount} words in ${out.durationSeconds}s) · character-cost ${out.characterCost} · saved ${DIR.pathname}`);
