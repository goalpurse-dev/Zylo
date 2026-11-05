// GAPS: one corpus script's plan before vs after (the tl.lines / shots that differ). node dev/gapsPlanDiffOne.mjs --base <dir> <name>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { standInScript, loadIdeas } from "./coverage.mjs";
import { makeTopics, standInCard } from "./stress.mjs";
const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = process.argv.slice(2), base = a[a.indexOf("--base") + 1], name = a.at(-1);
const A = await import(pathToFileURL(path.join(path.resolve(base), "plan.mjs")).href), B = await import(pathToFileURL(path.join(ENGINE, "plan.mjs")).href);
let c;
if (name.startsWith("idea_")) { const it = loadIdeas()[Number(name.slice(5))]; const idea = it.idea ?? it; c = { script: standInScript(idea), idea }; }
else if (name.startsWith("stress_")) { const topics = JSON.parse(fs.readFileSync(path.join(ENGINE, "out/stress/topics.json"), "utf8")); const t = topics.find((x) => x.id === name.slice(7)); const idea = standInCard(t, 11 * 1000 + Number(t.id.slice(1))); c = { script: standInScript(idea), idea }; }
else { const id = name.slice(5); const sc = JSON.parse(fs.readFileSync(path.join(ENGINE, "out/stress/real-script-haiku/scripts.json"), "utf8"))[id]; c = { script: { title: sc.title, lines: sc.lines }, idea: JSON.parse(fs.readFileSync(path.join(ENGINE, "out/stress/real-script-haiku/cards.json"), "utf8"))[id] ?? {} }; }
const w = A.estimateWords(c.script);
const ta = A.planVideo({ script: c.script, words: w, idea: c.idea, lengthSec: 90 }), tb = B.planVideo({ script: c.script, words: w, idea: c.idea, lengthSec: 90 });
ta.lines.forEach((l, i) => { if (JSON.stringify(l) !== JSON.stringify(tb.lines[i])) console.log("line", i, JSON.stringify(l), "->", JSON.stringify(tb.lines[i])); });
ta.shots.forEach((s, i) => { if (JSON.stringify(s) !== JSON.stringify(tb.shots[i])) console.log("shot", i, s.lines ?? s.line, s.text, "\n  ", JSON.stringify(s.actors), "\n  ", JSON.stringify(tb.shots[i]?.actors)); });
