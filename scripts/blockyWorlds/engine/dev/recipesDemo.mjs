// RECIPES (2026-11-08): plan a story with a shot recipe, free (mock director, estimated word timings), check it, compare
// the rhythm with the recipe's source, and optionally render key stills locally.
//   node dev/recipesDemo.mjs --script <results.json>#<index> --recipe creature_town_attack [--stills 16] [--out dir]
//   node dev/recipesDemo.mjs --fake curfew_monster            (a stand-in script of that story type, no stills)
//   node dev/recipesDemo.mjs --all-fakes
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { loadRecipe, rhythm, RECIPE_IDS, BEATS } from "../lib/recipes/index.js";
import { FAKE_SCRIPTS } from "./recipesFakes.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const arg = (k, d = null) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);

export async function planWith({ script, idea, recipe, wpm = 212 }) {
  const direction = await directStory({ script, idea, provider: "mock", exists });
  const words = estimateWords(script, wpm);
  const t0 = Date.now();
  const plain = planVideo({ script, words, idea, lengthSec: 90, direction, exists });
  const t1 = Date.now();
  const tl = planVideo({ script, words, idea, lengthSec: 90, direction, exists, recipe });
  const ms = { plain: t1 - t0, recipe: Date.now() - t1 };
  const checks = { timeline: checkTimeline(tl), visuals: checkVisuals(tl, script), subjects: checkSubjects(tl), production: checkProduction(tl) };
  const cards = tl.shots.filter((s) => s.camera === "insert" || s.insert || [s.marker, ...(s.markers ?? [])].some((m) => m && m.kind !== "ring")).length;
  return { tl, plain, checks, cards, ms };
}

export function summary(name, { tl, plain, checks, cards, ms }, recipe) {
  const R = rhythm(tl), P = rhythm(plain);
  const rows = [`== ${name} (${recipe.id}): ${plain.shots.length} -> ${tl.shots.length} shots, ${tl.duration} s; plan ${ms.plain} ms, with recipe ${ms.recipe} ms`,
    `   recipe pass: ${JSON.stringify({ lines: tl.recipe.lines, recut: tl.recipe.recut, skinned: tl.recipe.skinned, full: tl.recipe.full, yielded: tl.recipe.yielded, kept: tl.recipe.kept, slotShots: tl.recipe.slotShots, slotYields: tl.recipe.slotYields })}`,
    `   checks: ${Object.entries(checks).map(([k, v]) => `${k} ${v.length}`).join(", ")}; cards/badges ${cards}`];
  for (const b of BEATS) {
    const r = R[b], p = P[b], src = recipe.beats[b];
    if (!r) continue;
    const lines = tl.lines.filter((l) => l.part === b).length;
    rows.push(`   ${b.padEnd(9)} ${lines} lines: plain ${p?.shots ?? 0} shots (med ${p?.medianShot ?? "-"} s) -> recipe ${r.shots} (med ${r.medianShot} s; target ${src.targetShot} s) | ${Object.entries(r.cams).map(([c, n]) => `${c} ${n}`).join(", ")} | moves ${Object.entries(r.moves).filter(([m]) => m !== "-").map(([m, n]) => `${m} ${n}`).join(", ") || "-"}`);
  }
  for (const [k, v] of Object.entries(checks)) for (const p of v.slice(0, 4)) rows.push(`   ! ${k}: ${JSON.stringify(p).slice(0, 220)}`);
  return rows.join("\n");
}

/** ~n stills spread over the beats (opening, tour examples, me, until, discovery, climax, closer) */
export function pickStills(tl, n = 16) {
  const want = { rule: 2, tour: 3, me: 2, until: 2, discovery: 2, climax: 3, closer: 2 };
  const picks = [];
  for (const b of BEATS) {
    const own = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.part === b);
    const k = Math.min(want[b], own.length);
    for (let j = 0; j < k; j++) { const [s, i] = own[Math.floor(((j + 0.5) * own.length) / k)]; picks.push({ key: `${String(i).padStart(3, "0")}_${b}`, t: (s.start + s.end) / 2, shot: i }); }
  }
  return picks.slice(0, n);
}

async function stills(tl, dir, n) {
  const { makeShotStills } = await import("../lib/vision/stills.mjs");
  const r = await makeShotStills({ dir, size: 960, log: console.log });
  try {
    const picks = pickStills(tl, n);
    const res = await r.renderTimeline(tl, picks.map(({ key, t }) => ({ key, t })), { name: "recipe" });
    const out = [];
    for (const x of res.stills) {
      if (x.error) { console.log("still failed", x.key, x.error); continue; }
      out.push({ key: x.key, t: x.t, file: x.file, mean: x.mean, shot: tl.shots[picks.find((p) => p.key === x.key).shot] });
    }
    return out;
  } finally { await r.close(); }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const jobs = [];
  if (arg("--script")) {
    const [file, idx] = arg("--script").split("#");
    const x = JSON.parse(fs.readFileSync(file, "utf8")).results[Number(idx ?? 0)];
    jobs.push({ name: path.basename(path.dirname(file)) + "#" + (idx ?? 0), script: { title: x.script.title, lines: x.script.lines }, idea: x.card, recipe: arg("--recipe", x.recipe?.id) });
  }
  const fakes = process.argv.includes("--all-fakes") ? RECIPE_IDS : arg("--fake") ? [arg("--fake")] : [];
  for (const id of fakes) jobs.push({ name: `fake_${id}`, ...FAKE_SCRIPTS[id], recipe: id });
  const outDir = arg("--out", path.join(ENGINE, "out", "dev", "recipes"));
  fs.mkdirSync(outDir, { recursive: true });
  for (const j of jobs) {
    const recipe = loadRecipe(j.recipe);
    if (!recipe) { console.log(`${j.name}: no recipe "${j.recipe}"`); continue; }
    const r = await planWith({ script: j.script, idea: j.idea, recipe: recipe.id });
    console.log(summary(j.name, r, recipe));
    const dir = path.join(outDir, j.name.replace(/[^a-z0-9_#-]/gi, "_").replace("#", "_"));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "timeline.json"), JSON.stringify(r.tl, null, 1));
    const n = Number(arg("--stills", 0));
    if (n && !j.name.startsWith("fake_")) {
      const st = await stills(r.tl, path.join(dir, "stills"), n);
      fs.writeFileSync(path.join(dir, "stills.json"), JSON.stringify(st.map((x) => ({ key: x.key, file: x.file, t: x.t, camera: x.shot.camera, move: x.shot.move ?? null, focus: x.shot.focus, set: x.shot.set, recipe: x.shot.recipe ?? null, text: x.shot.text })), null, 1));
      console.log(`stills: ${st.length} in ${path.join(dir, "stills")}`);
    }
  }
}
