// SETS-V2 2026-11-09: re-plans the dev scripts for free (stored director lists, else the mock director) and prints the
// places per script: each place's share of the video's time, the biggest place's share, and the set preset + rig per
// place (lib/worldBible.js themes). No paid call, no render.
//   node dev/setsV2Places.mjs [--json out.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import { planCriticalFirst } from "./criticalFakes.mjs";
import { directStory } from "../lib/director/index.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const DIR = path.join(ENGINE, "dev", "scripts");

/** a shot's place key: the bible place it stands in (placeId), else its spot / place / set */
export const placeKey = (s) => s.placeId ?? (/^world:/.test(s.set ?? "") ? s.set : s.worldSpot ?? s.place ?? s.set);

export async function planScript(file) {
  const R = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8"));
  const script = { title: R.title, lines: R.lines };
  const words = Array.isArray(R.words) ? R.words.map((w) => (Array.isArray(w) ? { word: w[0], start: w[1], end: w[2] } : w)) : undefined;
  const idea = R.idea ?? R.card ?? { opener: R.lines[0].text ?? R.lines[0], title: R.title, topic: R.topic };
  const direction = R.production
    ? await directStory({ script, idea, exists, provider: { direct: async () => ({ data: R.production, costUsd: 0 }) } })
    : await directStory({ script, idea, provider: "mock", exists });
  return planCriticalFirst(plan, { script, words, idea, lengthSec: R.lengthSec ?? 90, direction, exists }).tl;
}

export function placeShares(tl) {
  const sec = {};
  for (const s of tl.shots) { const k = placeKey(s); sec[k] = (sec[k] ?? 0) + (s.end - s.start); }
  const tot = Object.values(sec).reduce((a, b) => a + b, 0) || 1;
  const rows = Object.entries(sec).map(([k, v]) => [k, v / tot]).sort((a, b) => b[1] - a[1]);
  return { rows, biggest: rows[0]?.[1] ?? 0 };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = {};
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith(".json"))) {
    let tl;
    try { tl = await planScript(f); } catch (e) { console.log(`${f}: PLAN FAILED ${e.message.slice(0, 200)}`); continue; }
    const { rows, biggest } = placeShares(tl);
    const th = tl.world?.places ?? [];
    const rigs = {};
    for (const s of tl.shots) { const k = placeKey(s); (rigs[k] ??= new Set()).add(s.rig ?? s.light); }
    console.log(`\n${f}: ${tl.title} | ${rows.length} places | biggest ${(biggest * 100).toFixed(0)}% | check ${plan.checkTimeline(tl).length} problems`);
    for (const [k, v] of rows) {
      const p = th.find((x) => x.id === k);
      console.log(`  ${(v * 100).toFixed(0).padStart(3)}%  ${k.padEnd(26)} ${p ? `${p.theme} [${p.density}]` : ""}  rigs: ${[...rigs[k]].join(",")}`);
    }
    out[f] = { title: tl.title, places: rows.length, biggest, rows, problems: plan.checkTimeline(tl) };
  }
  const j = process.argv.indexOf("--json");
  if (j > 0) fs.writeFileSync(process.argv[j + 1], JSON.stringify(out, null, 1));
}
