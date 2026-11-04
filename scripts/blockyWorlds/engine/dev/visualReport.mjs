// The word-to-scene table: for every script line, its key nouns/actions, what its shot(s) show, OK / MISSING.
//   node dev/visualReport.mjs                                  The Listener, estimated timings
//   node dev/visualReport.mjs --dir out/listener_full          words.json + script.json (+ idea) from a run folder
//   node dev/visualReport.mjs --tl timeline.json [--script script.json]   an existing timeline
//   ... [--md out.md] [--json tl.json]
import fs from "node:fs";
import path from "node:path";
import { planVideo, checkTimeline, checkVisuals, estimateWords } from "../plan.mjs";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../../../../supabase/functions/_shared/blockyWorlds/examples.js";

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

let tl, script;
if (opt("--tl")) {
  tl = readJson(opt("--tl"));
  script = opt("--script") ? readJson(opt("--script")) : { lines: tl.lines };
  if (script.script) script = script.script;
  if (!tl.visualReport) tl.visualReport = null;
} else {
  let idea = EXAMPLE_IDEAS[0], words = null;
  script = EXAMPLE_SCRIPT;
  if (opt("--dir")) {
    const dir = opt("--dir");
    const s = readJson(path.join(dir, "script.json"));
    script = s.script ?? s;
    idea = s.idea ?? idea;
    words = readJson(path.join(dir, "words.json"));
  }
  tl = planVideo({ script, words: words ?? estimateWords(script), idea, lengthSec: 90 });
}
if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(tl, null, 1));

const missing = checkVisuals(tl, script);
const missBy = new Map(missing.map((m) => [m.line, m.missing]));
const report = tl.visualReport ?? script.lines.map((l, i) => ({ line: i, text: l.text, nouns: [], shows: [], ok: !missBy.has(i) }));
const lens = tl.shots.map((s) => s.end - s.start).sort((a, b) => a - b);
const head = `${tl.title}: ${tl.duration.toFixed(1)} s, ${tl.shots.length} shots (median ${lens[lens.length >> 1].toFixed(2)} s, min ${lens[0].toFixed(2)} s), ` +
  `${report.length - missing.length}/${report.length} lines OK, ${missing.length} missing; checkTimeline: ${checkTimeline(tl).length || "clean"}`;

const md = [`# Word-to-scene: ${tl.title}`, "", head, "", "| # | Line | Key nouns / actions | What the shot shows | |", "|---|---|---|---|---|"];
for (const r of report) {
  const miss = missBy.get(r.line);
  const esc = (s) => String(s).replace(/\|/g, "\\|");
  md.push(`| ${r.line} | ${esc(r.text)} | ${esc(r.nouns.join(", ") || "-")} | ${esc(r.shows.join(" **/** "))} | ${miss ? `MISSING: ${esc(miss.join(", "))}` : "OK"} |`);
}
if (opt("--md")) { fs.writeFileSync(opt("--md"), md.join("\n") + "\n"); }

console.log(head + "\n");
const pad = (s, n) => String(s ?? "").slice(0, n).padEnd(n);
for (const r of report) {
  const miss = missBy.get(r.line);
  console.log(`${pad(r.line, 3)} ${pad(r.text, 54)} | ${pad(r.nouns.join(", "), 40)} | ${miss ? `MISSING ${miss.join(", ")}` : "OK"}`);
  for (const s of r.shows) console.log(`      -> ${s}`);
}
