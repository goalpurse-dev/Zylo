// Zyvo Studio: the ElevenLabs takes for a script, one per line (a PAID step: run only after the owner's go, with
// the cost stated). Guarded: refuses if the worst case (every character billed at $0.0002) is over CAP_USD, and never
// pays twice for a line whose take already exists. Cost = the character-cost header x $0.0002.
//   CAP_USD=0.04 node elevenTakes.mjs <script.json> <takes dir> [first line] [last line]
import fs from "node:fs";
const [scriptPath, OUT, from = "1", to = "999"] = process.argv.slice(2);
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const S = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const V = S.voices.eleven, PER = 0.0002, CAP = Number(process.env.CAP_USD ?? 0);
const todo = S.lines.map((l, i) => ({ ...l, n: i + 1 })).filter((l) => l.n >= Number(from) && l.n <= Number(to) && !fs.existsSync(`${OUT}/line${String(l.n).padStart(2, "0")}.mp3`));
const worst = todo.reduce((a, l) => a + l.text.length, 0) * PER;
if (!CAP || worst > CAP) throw new Error(`budget: worst case $${worst.toFixed(4)} for ${todo.length} lines; CAP_USD is ${CAP || "not set"}`);
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const l of todo) {
  const v = V[l.who];
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
    method: "POST", headers: { "xi-api-key": process.env.ELEVENLABS_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text: l.text, model_id: "eleven_multilingual_v2", voice_settings: { stability: v.stability ?? 0.35, similarity_boost: 0.75, style: v.style ?? 0.4, use_speaker_boost: true, speed: v.speed ?? 1.05 } }),
  });
  if (!res.ok) { console.log(`line ${l.n} failed (not billed): ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
  const chars = Number(res.headers.get("character-cost")) || l.text.length;
  fs.writeFileSync(`${OUT}/line${String(l.n).padStart(2, "0")}.mp3`, Buffer.from(await res.arrayBuffer()));
  total += chars * PER;
  console.log(`line ${l.n} ${l.who}: "${l.text}" character-cost ${chars} ($${(chars * PER).toFixed(4)})`);
}
fs.appendFileSync(`${OUT}/cost.log`, `${new Date().toISOString()} ${todo.length} lines $${total.toFixed(4)}\n`);
console.log(`total $${total.toFixed(4)}`);
