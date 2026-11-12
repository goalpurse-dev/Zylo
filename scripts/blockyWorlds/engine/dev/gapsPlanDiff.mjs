// No-direction planning, before vs after (GAPS agent, 2026-11-05): every corpus script planned by a baseline copy of
// plan.mjs + lib/ and by today's, compared shot by shot. The rule: byte-identical except lines whose verbs now have a
// real pose (hug, climb, push, eat, fall, jump, ride, hide, throw, fly, build, dig, dance, swim, kick).
//   node dev/gapsPlanDiff.mjs --base <folder with plan.mjs + lib/> [--show 30]
// Corpus: the 130 library ideas (stand-in scripts), 200 stress topics (stand-in cards + scripts), the real run's 33
// scripts, The Listener.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { standInScript, loadIdeas } from "./coverage.mjs";
import { makeTopics, standInCard } from "./stress.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf(`--${k}`); return i >= 0 ? a[i + 1] : d; };
const base = opt("base", null);
if (!base) { console.error("--base <folder> (a copy of plan.mjs + lib/ from before the change)"); process.exit(2); }
const show = Number(opt("show", 30));
const A = await import(pathToFileURL(path.join(path.resolve(base), "plan.mjs")).href);
const B = await import(pathToFileURL(path.join(ENGINE, "plan.mjs")).href);
// the verbs that now have their own pose (the only lines allowed to change)
export const NEW_POSE_VERBS = /\b(hug\w*|climb\w*|push\w*|shov\w*|eat|eats|ate|eating|chew\w*|munch\w*|nibbl\w*|gobbled|swallowed|fell|fall|falls|falling|trip\w*|slip\w*|tumbled|toppled|jump\w*|hop\w*|leap\w*|bounc\w*|ride|rides|rode|riding|hid|hide|hides|hiding|throw\w*|threw|toss\w*|hurled|fly|flies|flew|flying|soar\w*|build|builds|built|hammer\w*|dig|digs|dug|digging|shovel\w*|danc\w*|swim\w*|swam|kick\w*)\b/i;

const norm = (s) => ({ ...s, lines: s.lines.map((l) => (Array.isArray(l) ? { part: l[0], text: l[1] } : l)) });
const corpus = [];
for (const [i, it] of loadIdeas().entries()) { const idea = it.idea ?? it; corpus.push({ name: `idea_${i}`, script: standInScript(idea), idea }); }
const topicsFile = path.join(ENGINE, "out", "stress", "topics.json");
const topics = fs.existsSync(topicsFile) ? JSON.parse(fs.readFileSync(topicsFile, "utf8")) : makeTopics(200, 11);
for (const t of topics) { const idea = standInCard(t, 11 * 1000 + Number(t.id.slice(1))); corpus.push({ name: `stress_${t.id}`, script: standInScript(idea), idea }); }
const RS = path.join(ENGINE, "out/stress/real-script-haiku");
if (fs.existsSync(path.join(RS, "scripts.json"))) {
  const sc = JSON.parse(fs.readFileSync(path.join(RS, "scripts.json"), "utf8")), cards = JSON.parse(fs.readFileSync(path.join(RS, "cards.json"), "utf8"));
  for (const [id, s] of Object.entries(sc)) corpus.push({ name: `real_${id}`, script: { title: s.title, lines: s.lines }, idea: cards[id] ?? {} });
}
const EX = path.resolve(ENGINE, "../../../supabase/functions/_shared/blockyWorlds/examples.js");
if (fs.existsSync(EX)) { const { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } = await import(pathToFileURL(EX).href); corpus.push({ name: "listener", script: norm(EXAMPLE_SCRIPT), idea: EXAMPLE_IDEAS[0] }); }

let same = 0, allowed = 0, bad = 0;
const badList = [], allowedList = [];
for (const c of corpus) {
  const words = A.estimateWords(c.script);
  let ta, tb;
  try { ta = A.planVideo({ script: c.script, words, idea: c.idea, lengthSec: 90 }); } catch (e) { ta = { error: e.message }; }
  try { tb = B.planVideo({ script: c.script, words, idea: c.idea, lengthSec: 90 }); } catch (e) { tb = { error: e.message }; }
  if (JSON.stringify(ta) === JSON.stringify(tb)) { same++; continue; }
  if (ta.error || tb.error || ta.shots?.length !== tb.shots?.length) {
    // a different shot list: allowed only when every line whose shots differ has a new-pose verb
    const la = new Map(), lb = new Map();
    for (const s of ta.shots ?? []) la.set(s.line, [...(la.get(s.line) ?? []), JSON.stringify(s)]);
    for (const s of tb.shots ?? []) lb.set(s.line, [...(lb.get(s.line) ?? []), JSON.stringify(s)]);
    const lines = [...new Set([...la.keys(), ...lb.keys()])].filter((l) => JSON.stringify(la.get(l)) !== JSON.stringify(lb.get(l)));
    const off = lines.filter((l) => !NEW_POSE_VERBS.test(c.script.lines[l]?.text ?? ""));
    if (ta.error || tb.error || off.length) { bad++; badList.push(`${c.name}: ${ta.error ?? tb.error ?? `shot count ${ta.shots.length} -> ${tb.shots.length}; lines ${off.join(",")}: ${off.map((l) => c.script.lines[l]?.text).join(" | ")}`}`); }
    else { allowed++; allowedList.push(`${c.name}: lines ${lines.join(",")} (re-cut)`); }
    continue;
  }
  const diffs = [];
  ta.shots.forEach((s, i) => { if (JSON.stringify(s) !== JSON.stringify(tb.shots[i])) diffs.push(i); });
  // the per-line report may change only on those lines too
  const vr = (t) => new Map((t.visualReport ?? []).map((r) => [r.line, JSON.stringify(r)]));
  const va = vr(ta), vb = vr(tb);
  const la2 = new Map((ta.lines ?? []).map((r, i) => [i, JSON.stringify(r)])), lb2 = new Map((tb.lines ?? []).map((r, i) => [i, JSON.stringify(r)]));
  for (const [i, v] of la2) if (v !== lb2.get(i)) { va.set(`L${i}`, v); vb.set(`L${i}`, lb2.get(i)); }
  const vrOff = [...new Set([...va.keys(), ...vb.keys()])].filter((l) => va.get(l) !== vb.get(l) && !NEW_POSE_VERBS.test(c.script.lines[String(l).replace(/^L/, "")]?.text ?? ""));
  const rest = Object.keys({ ...ta, ...tb }).filter((k) => k !== "shots" && k !== "visualReport" && k !== "lines" && JSON.stringify(ta[k]) !== JSON.stringify(tb[k])).concat(vrOff.length ? [`visualReport lines ${vrOff.join(",")}`] : []);
  const offShots = diffs.filter((i) => !(tb.shots[i].lines ?? [tb.shots[i].line]).some((l) => NEW_POSE_VERBS.test(c.script.lines[l]?.text ?? "")));
  if (offShots.length || rest.length) {
    bad++;
    badList.push(`${c.name}: ${rest.length ? `fields ${rest.join(",")}; ` : ""}${offShots.map((i) => `shot ${i} L${ta.shots[i].line} "${c.script.lines[ta.shots[i].line]?.text}"\n      before ${JSON.stringify(ta.shots[i].actors)}\n      after  ${JSON.stringify(tb.shots[i].actors)}`).join("\n   ")}`);
  } else {
    allowed++;
    allowedList.push(`${c.name}: ${diffs.map((i) => `L${tb.shots[i].line} [${(ta.shots[i].actors ?? []).map((x) => x.pose).join(",")}] -> [${(tb.shots[i].actors ?? []).map((x) => x.pose).join(",")}] "${c.script.lines[tb.shots[i].line]?.text}"`).join("; ")}`);
  }
}
console.log(`${corpus.length} scripts: ${same} byte-identical, ${allowed} changed only on lines with a new-pose verb, ${bad} changed elsewhere`);
if (allowedList.length) console.log(`\nchanged on new-pose lines (first ${show}):\n  ${allowedList.slice(0, show).join("\n  ")}`);
if (badList.length) console.log(`\nCHANGED ELSEWHERE:\n  ${badList.slice(0, show).join("\n  ")}`);
process.exitCode = bad ? 1 : 0;
