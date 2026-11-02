// Zyvo Studio: 3 voice candidates per character (Master Prompt v2), the same lines each, so the owner can pick by ear and
// lock the channel's cast. Stock ElevenLabs voices only: no cloning, no imitating anyone. Guarded by CAP_USD (a PAID step).
//   CAP_USD=0.20 node voiceCandidates.mjs <out dir>
import fs from "node:fs";
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const [out] = process.argv.slice(2);
const CREATOR = "Wait. Why did a fruit dating show get thirty nine million views?";
const ZEE = "Because it's a formula. Three parts. And most people skip the third one.";
const C = [
  ["creator_1_Liam_energetic_creator", "TX3LPaxmHKxFdv7VOQHJ", CREATOR],
  ["creator_2_Alex_upbeat_clear", "yl2ZDV1MzN4HbQJbMihG", CREATOR],
  ["creator_3_Derek_fun_energetic", "Q0Et7LOU7VpeoeCRQAVS", CREATOR],
  ["zee_1_Laura_quirky", "FGY2WhTYpPnrIDTdsKH5", ZEE],
  ["zee_2_Jessica_current", "cgSgspJ2msm6clMCkdW9", ZEE],
  ["zee_3_Jessa_friendly", "yj30vwTGJxSHezdAGsv9", ZEE],
];
const CAP = Number(process.env.CAP_USD ?? 0), worst = C.reduce((a, x) => a + x[2].length, 0) * 0.0002;
if (!CAP || worst > CAP) throw new Error(`budget: worst case $${worst.toFixed(4)}; CAP_USD is ${CAP || "not set"}`);
fs.mkdirSync(out, { recursive: true });
let total = 0;
for (const [name, id, text] of C) {
  const file = `${out}/${name}.mp3`; if (fs.existsSync(file)) continue;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}?output_format=mp3_44100_128`, { method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.35, similarity_boost: 0.75, style: 0.5, use_speaker_boost: true, speed: 1.03 } }) });
  if (!res.ok) { console.log(`${name} failed: ${res.status}`); continue; }
  const chars = Number(res.headers.get("character-cost")) || text.length; total += chars * 0.0002;
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer())); console.log(`${name} $${(chars * 0.0002).toFixed(4)}`);
}
fs.appendFileSync(`${out}/cost.log`, `${new Date().toISOString()} $${total.toFixed(4)}\n`);
console.log(`total $${total.toFixed(4)}`);
