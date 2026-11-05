// INTEGRATION (2026-11-05): the story director's production list as the planner's source of truth, end to end, free.
//   node dev/integration.mjs [--stills] [--only name,name]
// For every case: the MOCK director (lib/director/mock.js, $0) -> planVideo({ direction }) -> checkTimeline + checkVisuals
// + checkSubjects + checkProduction (all four must be clean) -> out/integration/<name>/timeline.json. With --stills: one
// key still per case (the shot with the most EPIC things, else the middle shot) rendered locally (headless Chrome, free)
// and contact sheets in out/integration/.
// Cases: the owner's turtle-wolf story (dev/scripts/turtle_wolf.json), 10 stress topics (out/stress/topics.json, stand-in
// cards and scripts as dev/stress.mjs makes them), The Listener and 5 library ideas.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, checkProduction, estimateWords } from "../plan.mjs";
import { directStory } from "../lib/director/index.js";
import { standInScript, loadIdeas } from "./coverage.mjs";
import { makeTopics, standInCard } from "./stress.mjs";
import { sheet } from "./integrationSheet.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ENGINE, "out", "integration");
export const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const EXAMPLES = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds/examples.js");
const norm = (s) => ({ ...s, lines: s.lines.map((l) => (Array.isArray(l) ? { part: l[0], text: l[1] } : l)) });

/** the stress topics used here: the EPIC-heavy ones (creature worlds, giants, crowds, animal-pulled vehicles) */
export const STRESS_PICK = [1, 5, 11, 14, 15, 21, 29, 30, 34, 36];
export const IDEA_PICK = [0, 17, 42, 77, 111];

export async function cases() {
  const out = [];
  const tw = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "turtle_wolf.json"), "utf8"));
  out.push({ name: "turtle_wolf", script: tw, idea: tw.idea });
  const topicsFile = path.join(ENGINE, "out", "stress", "topics.json");
  const topics = fs.existsSync(topicsFile) ? JSON.parse(fs.readFileSync(topicsFile, "utf8")) : makeTopics(200, 11);
  for (const i of STRESS_PICK) {
    const t = topics[i];
    const idea = standInCard(t, 11 * 1000 + Number(t.id.slice(1)));
    out.push({ name: `stress_${t.id}`, label: t.topic, script: standInScript(idea), idea });
  }
  const { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } = await import(pathToFileURL(EXAMPLES).href);
  out.push({ name: "listener", script: norm(EXAMPLE_SCRIPT), idea: EXAMPLE_IDEAS[0] });
  const ideas = loadIdeas();
  for (const i of IDEA_PICK) { const idea = ideas[i].idea ?? ideas[i]; out.push({ name: `idea_${i}`, label: idea.title, script: standInScript(idea), idea }); }
  return out;
}

export async function runCase(c) {
  const direction = await directStory({ script: c.script, idea: c.idea, provider: "mock", exists });
  const words = estimateWords(c.script);
  const tl = planVideo({ script: c.script, words, idea: c.idea, lengthSec: 90, direction, exists });
  const checks = { timeline: checkTimeline(tl), visuals: checkVisuals(tl, c.script), subjects: checkSubjects(tl), production: checkProduction(tl) };
  const epic = { worlds: Object.keys(tl.worlds ?? {}), giants: Object.keys(tl.giants ?? {}), crowdShots: tl.shots.filter((s) => s.crowds?.length).length, giantShots: tl.shots.filter((s) => s.giants?.length).length, beats: tl.shots.filter((s) => s.beat).map((s) => s.beat.type) };
  const cards = tl.shots.filter((s) => s.insert?.kind === "card").length;
  return { ...c, tl, checks, epic, cards, gaps: direction.match.gaps.length, refined: tl.direction?.gaps ?? 0, notes: tl.direction?.notes ?? [], fixes: tl.direction?.fixes ?? [] };
}

const epicScore = (s) => (s.giants?.length ?? 0) * 3 + (s.crowds?.length ?? 0) * 2 + (/^creature:/.test(s.set ?? "") ? 1 : 0) + (s.beat ? 1 : 0);
export function keyShot(tl) {
  const real = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.camera !== "insert");
  const best = real.reduce((b, x) => (epicScore(x[0]) > epicScore(b[0]) ? x : b), real[Math.floor(real.length / 2)]);
  return best[1];
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const stills = process.argv.includes("--stills");
  const only = (process.argv[process.argv.indexOf("--only") + 1] ?? "").split(",").filter((x) => process.argv.includes("--only") && x);
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [], items = { stress: [], regress: [] };
  for (const c of await cases()) {
    if (only.length && !only.includes(c.name)) continue;
    const r = await runCase(c);
    const dir = path.join(OUT, c.name); fs.mkdirSync(dir, { recursive: true });
    const tlPath = path.join(dir, "timeline.json");
    // no builder here: its need markers go, as in make.mjs (the worker's builder removes them before any render)
    for (const s of r.tl.shots) { if (typeof s.world === "string") delete s.world; if (s.need) delete s.need; }
    fs.writeFileSync(tlPath, JSON.stringify(r.tl, null, 1));
    const bad = Object.entries(r.checks).filter(([, v]) => v.length).map(([k, v]) => `${k}:${v.length}`);
    rows.push(`| ${c.name} | ${c.label ?? c.script.title ?? ""} | ${r.tl.shots.length} | ${r.epic.worlds.join(" ") || "-"} | ${r.epic.giants.join(" ") || "-"} | ${r.epic.giantShots}/${r.epic.crowdShots} | ${[...new Set(r.epic.beats)].join(" ") || "-"} | ${r.cards} | ${r.gaps} | ${bad.join(" ") || "clean"} |`);
    console.log(`${c.name.padEnd(16)} shots ${String(r.tl.shots.length).padStart(3)}  worlds ${r.epic.worlds.join(",") || "-"}  giants ${r.epic.giants.join(",") || "-"}  giant/crowd shots ${r.epic.giantShots}/${r.epic.crowdShots}  cards ${r.cards}  checks ${bad.join(" ") || "clean"}`);
    for (const [k, v] of Object.entries(r.checks)) for (const p of v.slice(0, 3)) console.log(`   ${k}: ${typeof p === "string" ? p : JSON.stringify(p)}`);
    if (stills && c.name !== "turtle_wolf") {
      const k = keyShot(r.tl), s = r.tl.shots[k], t = +(s.start + (s.end - s.start) * 0.6).toFixed(2);
      const p = spawnSync(process.execPath, ["render.mjs", tlPath, path.join(dir, "key.mp4"), "--stills", String(t)], { cwd: ENGINE, encoding: "utf8" });
      const img = path.join(dir, `key-${t}.jpg`);
      if (p.status !== 0 || !fs.existsSync(img)) console.log(`   render failed: ${(p.stderr || p.stdout).slice(-400)}`);
      else (c.name.startsWith("stress") ? items.stress : items.regress).push({ label: `${c.name.replace("stress_", "")} L${s.line} ${s.camera}`, file: img });
    }
  }
  fs.writeFileSync(path.join(OUT, "report.md"), ["# Integration run (mock director -> planVideo -> 4 checks)", "", "| case | title | shots | creature worlds | giants | giant/crowd shots | beats | cards | gaps | checks |", "|---|---|---|---|---|---|---|---|---|---|", ...rows, ""].join("\n"));
  if (items.stress.length) console.log(sheet(path.join(OUT, "stress_topics.jpg"), 5, items.stress));
  if (items.regress.length) console.log(sheet(path.join(OUT, "regression.jpg"), 6, items.regress));
}
