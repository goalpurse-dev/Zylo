// Zyvo Studio: the frame-0 rating of the Retention Engine (owner, 2026-10-30): "would a cold viewer stop scrolling?"
// 1–10 from the fast model (Claude Haiku 5.5) looking at frame 0 alone. Below 7 = make a new hook. A PAID call
// (about $0.0005 a frame): refuses without CAP_USD, and the worst case (every token billed) must fit under it.
// Writes <work>/frame0_rating.json, which scoreShort.mjs reads.
//   CAP_USD=0.01 node rateFrame0.mjs <video.mp4> <work dir> [<video.mp4> <work dir> ...]
import fs from "node:fs";
import { execFileSync } from "node:child_process";
for (const line of fs.readFileSync("C:/Users/Public/Zylo/.env.local", "utf8").split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }

const MODEL = "claude-haiku-5-5", PRICE = { input: 0.1, output: 0.5 };   // USD per 1M tokens (providers/anthropic.js)
const MAX_OUT = 1024, IN_EST = 2400;   // a 1080x1920 frame is ~1,850 image tokens after the API's resize, + the prompt
const pairs = process.argv.slice(2);
const CAP = Number(process.env.CAP_USD ?? 0), n = pairs.length / 2;
const worst = n * (IN_EST * PRICE.input + MAX_OUT * PRICE.output) / 1e6;
if (!CAP || worst > CAP) throw new Error(`budget: worst case $${worst.toFixed(4)} for ${n} frames; CAP_USD is ${CAP || "not set"}`);

const SCHEMA = { type: "object", additionalProperties: false, required: ["score", "why", "fix"], properties: {
  score: { type: "integer", description: "1-10" }, why: { type: "string" }, fix: { type: "string" } } };
const PROMPT = `This is frame 0 of a 9:16 short video, the very first thing a person sees while scrolling TikTok with the sound off.
Rate 1-10: would a cold viewer (who has never heard of this brand) stop scrolling on THIS frame?
Judge only what is visible: a face with clear emotion, contrast, something mid-action, a readable bold hook (how fast it reads, whether it makes them curious), clutter.
"why": one sentence. "fix": the single change that would raise the score most (one sentence).`;
let total = 0;
for (let i = 0; i < pairs.length; i += 2) {
  const [mp4, work] = [pairs[i], pairs[i + 1]];
  const jpg = execFileSync("ffmpeg", ["-v", "error", "-i", mp4, "-frames:v", "1", "-q:v", "3", "-f", "image2", "-c:v", "mjpeg", "-"], { maxBuffer: 1 << 26 });
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: MAX_OUT, output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpg.toString("base64") } }, { type: "text", text: PROMPT }] }] }),
  });
  const body = await res.json();
  if (!res.ok) { console.log(`${mp4}: ${res.status} ${JSON.stringify(body).slice(0, 200)}`); continue; }
  const usd = ((body.usage?.input_tokens ?? 0) * PRICE.input + (body.usage?.output_tokens ?? 0) * PRICE.output) / 1e6; total += usd;
  if (body.stop_reason === "refusal") { console.log(`${mp4}: declined`); continue; }
  const r = JSON.parse(body.content.filter((b) => b.type === "text").map((b) => b.text).join(""));
  fs.writeFileSync(`${work}/frame0_rating.json`, JSON.stringify({ ...r, by: MODEL, usd: +usd.toFixed(6), at: new Date().toISOString() }, null, 1));
  console.log(`${r.score}/10 ${mp4.split(/[\\/]/).pop()}: ${r.why} | fix: ${r.fix} ($${usd.toFixed(5)})`);
}
fs.appendFileSync("C:/Users/Public/Zylo-contentmachine/content/studio-previews/frame0_ratings_cost.log", `${new Date().toISOString()} ${n} frames $${total.toFixed(5)}\n`);
console.log(`total $${total.toFixed(5)}`);
