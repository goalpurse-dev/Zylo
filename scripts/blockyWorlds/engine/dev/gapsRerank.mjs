// The gap ranking again, free, against TODAY's registry + matcher (GAPS agent, 2026-11-05). Two views:
//   A. the REAL run's asks (out/stress/real-script-haiku/gaps.jsonl, 124 stories): every logged ask re-checked with
//      supports() today; what is still unsupported is ranked again
//   B. the mock director over the real run's scripts (scripts.json + cards.json)
//   node dev/gapsRerank.mjs [--top 8] [--out out/gaps/rerank_after.txt]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { supports } from "../lib/capabilities.js";
import { rankGaps, formatRanked, gapRows } from "../lib/gaps.js";
import { directStory } from "../lib/director/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const top = Number(opt("top", 8));
const DIR = path.join(ROOT, "out/stress/real-script-haiku");
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const out = [];
const say = (s = "") => { out.push(s); console.log(s); };
const show = (title, rows) => {
  const stories = new Set(rows.map((r) => r.story_id)).size;
  say(`\n=== ${title}: ${rows.length} gaps from ${stories} stories ===`);
  say(formatRanked(rankGaps(rows), { top, totalStories: stories }));
  const det = rankGaps(rows, { by: "detail" });
  const pick = det.filter((g) => /^(character\.action|giant|creature\.animal|creature\.built|creature\.monster) /.test(g.key));
  say(`  -- character / giant / creature asks still open (${pick.reduce((s, g) => s + g.requests, 0)} requests): ${pick.slice(0, 14).map((g) => `${g.key} x${g.requests}`).join(", ") || "none"}`);
};

// A. the real asks, re-checked
const real = fs.readFileSync(path.join(DIR, "gaps.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
const still = real.filter((r) => {
  const m = /^([a-zA-Z]+)=(.*)$/.exec(r.detail ?? "");
  if (!m) return supports(r.capability, {}).status === "planned";   // "planned" / "partial": the capability as a whole
  const v = /^\d+$/.test(m[2]) ? Number(m[2]) : m[2];
  return supports(r.capability, { [m[1]]: v }).unsupported.length > 0;
});
show("A. the real run's asks (Haiku director, 124 stories) re-checked against today's registry", still);

// (productions.json of that run holds the mock fallbacks of an earlier failed attempt, not the AI's lists: see B)
const scripts = JSON.parse(fs.readFileSync(path.join(DIR, "scripts.json"), "utf8"));
const cards = fs.existsSync(path.join(DIR, "cards.json")) ? JSON.parse(fs.readFileSync(path.join(DIR, "cards.json"), "utf8")) : {};

// B. the mock director over the real scripts
const C = [];
for (const [id, sc] of Object.entries(scripts)) {
  const r = await directStory({ script: { lines: sc.lines }, idea: cards[id] ?? null, provider: "mock", exists });
  C.push(...gapRows(r.match.gaps, { storyId: id, title: sc.title, source: "mock" }));
}
show(`B. the mock director over the real run's ${Object.keys(scripts).length} scripts`, C);

const file = opt("out", null);
if (file) { fs.mkdirSync(path.dirname(path.resolve(ROOT, file)), { recursive: true }); fs.writeFileSync(path.resolve(ROOT, file), out.join("\n") + "\n"); console.log(`\n-> ${file}`); }
