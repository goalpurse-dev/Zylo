// Coverage: every library idea (130 judged cards) as a free stand-in script (no AI), planned and checked.
//   node dev/coverage.mjs                 -> out/coverage/report.md + report.json (+ timelines/<n>.json)
//   node dev/coverage.mjs --only 3,17     -> just those ideas (index in the fixture), printed in full
//
// The stand-in script uses the card's own words in the 7 parts, so the planner meets the nouns, people, creatures,
// props and pronouns the ideas really use:
//   rule      = the opener
//   tour      = the price + the 3 examples (one line per sentence)
//   me        = "I'm <narrator>." + the prop planted ("I always keep <prop> with me.")
//   until     = "Until one night, I broke the rule." + the first half of the twist's sentences
//   discovery = the teaser + the middle of the twist
//   climax    = the rest of the twist + the prop paid off ("So I grabbed <prop>.")
//   closer    = the closer
// A real AI-written script reads differently (shorter lines, more pronouns); this run is a breadth test.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planVideo, checkTimeline, checkVisuals, checkSubjects, estimateWords } from "../plan.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURE = path.resolve(HERE, "../../../../src/components/viral-tools/blocky-worlds/dev/libraryFixture.json");
export const CARD_TARGET = 0.05;

/** Sentences of a text (keeps "Mr. Plunk" together). */
export function sentences(text) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s) return [];
  const out = [];
  let cur = "";
  for (const w of s.split(" ")) {
    cur = cur ? `${cur} ${w}` : w;
    if (/[.!?]["')]?$/.test(w) && !/^(Mr|Mrs|Ms|Dr|St|Jr|Sr|Mt)\.$/.test(w)) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(/[.!?]$/.test(cur) ? cur : `${cur}.`);
  return out;
}
/** A long sentence split at a comma / "and" / "so" near the middle (script lines stay under ~16 words). */
function shortLines(s) {
  const w = s.split(" ");
  if (w.length <= 16) return [s];
  let best = -1, bestD = Infinity;
  w.forEach((x, i) => {
    if (i < 4 || i > w.length - 4) return;
    const ok = /,$/.test(x) ? i + 1 : /^(and|so|but|then|until|because|while|which|who)$/i.test(w[i + 1] ?? "") ? i + 1 : -1;
    if (ok < 0) return;
    const d = Math.abs(ok - w.length / 2);
    if (d < bestD) { bestD = d; best = ok; }
  });
  if (best < 0) best = Math.ceil(w.length / 2);
  const a = w.slice(0, best).join(" ").replace(/,$/, ".");
  let b = w.slice(best).join(" ");
  b = b[0].toUpperCase() + b.slice(1);
  return [...shortLines(/[.!?]$/.test(a) ? a : `${a}.`), ...shortLines(b)];
}
const lc1 = (s) => (/^(A|An|The)\b/.test(s) || (/^[A-Z][a-z]/.test(s) && !/^(I|I'm)\b/.test(s) && !/^[A-Z][a-z]+'s\b/.test(s)) ? s[0].toLowerCase() + s.slice(1) : s);
const strip = (s) => String(s ?? "").trim().replace(/[.!?]+$/, "");

/** The stand-in script of one idea card. */
export function standInScript(idea) {
  const lines = [];
  const add = (part, text) => { for (const s of sentences(text)) for (const l of shortLines(s)) lines.push({ part, text: l }); };
  add("rule", idea.opener);
  add("tour", idea.price);
  for (const e of idea.examples ?? []) add("tour", e);
  const nar = strip(idea.narrator);
  add("me", `I'm ${nar}.`);
  const prop = strip(idea.prop);
  const propLc = lc1(prop);
  if (prop) add("me", `I always keep ${propLc} with me.`);
  const tw = sentences(idea.twist);
  const n = tw.length;
  const a = Math.max(1, Math.ceil(n / 3)), b = Math.max(a, Math.ceil((2 * n) / 3));
  add("until", "Until one night, I broke the rule.");
  for (const s of tw.slice(0, a)) add("until", s);
  if (idea.teaser) add("discovery", idea.teaser);
  for (const s of tw.slice(a, b)) add("discovery", s);
  for (const s of tw.slice(b)) add("climax", s);
  if (prop) add("climax", `So I grabbed ${/^(a|an|the|my|our|his|her)\b/i.test(propLc) || /^[A-Z][a-z]+'s\b/.test(propLc) ? propLc.replace(/^(a|an|the)\b/i, "my") : `my ${propLc}`}.`);
  add("closer", idea.closer);
  return { title: idea.title, lines };
}

/** Plans one idea and runs every check. */
export function runIdea(entry, i) {
  const idea = entry.idea ?? entry;
  const script = standInScript(idea);
  const words = estimateWords(script);
  let tl, err = null;
  try { tl = planVideo({ script, words, idea, lengthSec: 90 }); } catch (e) { err = String(e.stack ?? e); }
  if (err) return { i, title: idea.title, error: err, script };
  const visual = checkVisuals(tl, script);
  const subj = checkSubjects(tl);
  const tlProblems = checkTimeline(tl);
  const shots = tl.shots;
  const cards = shots.filter((s) => s.insert?.kind === "card");
  const badges = shots.flatMap((s) => [...(s.markers ?? []), ...(s.marker && !(s.markers ?? []).length ? [s.marker] : [])].filter((m) => m.kind === "icon" && /^\P{L}+\s\S/u.test(m.text ?? "") && !/^x\d/.test(m.text)).map((m) => m.text));
  return {
    i, title: idea.title, mood: idea.mood, setting: idea.setting, script, tl,
    shots: shots.length, cards: cards.map((s) => s.insert.text), cardShare: cards.length / shots.length, badges,
    visual, subj, tlProblems,
    monster: tl.monster ? `${tl.monster.name} (${tl.monster.variant ?? tl.monster.type})` : null,
  };
}

export function loadIdeas() { return JSON.parse(fs.readFileSync(FIXTURE, "utf8")); }

export function runAll(ideas = loadIdeas()) { return ideas.map((e, i) => runIdea(e, i)); }

/** Totals + the ranked gaps (card / badge words, by how many ideas need them). */
export function summarize(results) {
  const ok = results.filter((r) => !r.error);
  const shots = ok.reduce((a, r) => a + r.shots, 0);
  const cards = ok.reduce((a, r) => a + r.cards.length, 0);
  const rank = (get) => {
    const m = new Map();
    for (const r of ok) for (const w of new Set(get(r))) m.set(w, (m.get(w) ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  };
  return {
    ideas: results.length, errors: results.filter((r) => r.error).length,
    shots, cards, cardShare: shots ? cards / shots : 0,
    badges: ok.reduce((a, r) => a + r.badges.length, 0),
    visualMisses: ok.reduce((a, r) => a + r.visual.length, 0), ideasWithMisses: ok.filter((r) => r.visual.length).length,
    subjectProblems: ok.reduce((a, r) => a + r.subj.length, 0), ideasWithSubjectProblems: ok.filter((r) => r.subj.length).length,
    timelineProblems: ok.reduce((a, r) => a + r.tlProblems.length, 0),
    cardWords: rank((r) => r.cards),
    badgeWords: rank((r) => r.badges),
    missWords: rank((r) => r.visual.flatMap((v) => v.missing)),
    monsters: rank((r) => (r.monster ? [r.monster] : ["(none)"])),
  };
}

function writeReport(results, sum, dir) {
  fs.mkdirSync(path.join(dir, "timelines"), { recursive: true });
  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const md = [
    "# Blocky Worlds coverage: 130 library ideas as stand-in scripts", "",
    `Generated by \`node dev/coverage.mjs\` (free, no AI). Ideas: ${sum.ideas}, planner errors: ${sum.errors}.`, "",
    "| Measure | Value |", "|---|---|",
    `| shots | ${sum.shots} |`, `| picture-card shots | ${sum.cards} (${pct(sum.cardShare)}; target <= ${pct(CARD_TARGET)}) |`, `| badges (icon fallback) | ${sum.badges} |`,
    `| checkVisuals misses | ${sum.visualMisses} (in ${sum.ideasWithMisses} ideas) |`,
    `| checkSubjects problems | ${sum.subjectProblems} (in ${sum.ideasWithSubjectProblems} ideas) |`,
    `| checkTimeline problems | ${sum.timelineProblems} |`, "",
    "## Gaps ranked by how many ideas need them", "",
    "| Card text (fallback) | Ideas |", "|---|---|", ...sum.cardWords.slice(0, 60).map(([w, n]) => `| ${w} | ${n} |`), "",
    "| Badge (fallback) | Ideas |", "|---|---|", ...sum.badgeWords.slice(0, 30).map(([w, n]) => `| ${w} | ${n} |`), "",
    "| Missing (check fails) | Ideas |", "|---|---|", ...sum.missWords.slice(0, 30).map(([w, n]) => `| ${w} | ${n} |`), "",
    "| Monster | Ideas |", "|---|---|", ...sum.monsters.map(([w, n]) => `| ${w} | ${n} |`), "",
    "## Per idea", "",
    "| # | Title | Mood | Monster | Shots | Cards | Badges | Visual misses | Subject problems |", "|---|---|---|---|---|---|---|---|---|",
  ];
  for (const r of results) {
    if (r.error) { md.push(`| ${r.i} | ${r.title} | | | ERROR | | | ${r.error.split("\n")[0]} | |`); continue; }
    const esc = (s) => String(s).replace(/\|/g, "\\|");
    md.push(`| ${r.i} | ${esc(r.title)} | ${r.mood} | ${esc(r.monster ?? "-")} | ${r.shots} | ${r.cards.length ? esc(r.cards.join("; ")) : 0} | ${r.badges.length ? esc(r.badges.join("; ")) : 0} | ${r.visual.length ? esc(r.visual.map((v) => `L${v.line}: ${v.missing.join(", ")}`).join("; ")) : 0} | ${r.subj.length ? esc(r.subj.map((p) => `s${p.shot}: ${p.problem}`).join("; ")) : 0} |`);
  }
  fs.writeFileSync(path.join(dir, "report.md"), md.join("\n") + "\n");
  const json = { summary: sum, ideas: results.map(({ tl, script, ...r }) => ({ ...r, lines: script.lines.length })) };
  fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(json, null, 1));
  for (const r of results) if (r.tl) fs.writeFileSync(path.join(dir, "timelines", `${String(r.i).padStart(3, "0")}.json`), JSON.stringify(r.tl));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",").map(Number) : null;
  const ideas = loadIdeas();
  if (only) {
    for (const i of only) {
      const r = runIdea(ideas[i], i);
      if (r.error) { console.log(r.error); continue; }
      console.log(`\n#${i} ${r.title} [${r.mood}] monster: ${r.monster ?? "-"}; shots ${r.shots}, cards ${r.cards.length}, misses ${r.visual.length}, subj ${r.subj.length}`);
      for (const v of r.tl.visualReport) {
        console.log(`  ${String(v.line).padEnd(3)} ${v.text}\n      subject: ${v.subject} | keys: ${v.nouns.join(", ")}${v.missing ? ` | MISSING ${v.missing.join(", ")}` : ""}`);
        for (const s of v.shows) console.log(`      -> ${s}`);
      }
      for (const p of r.subj) console.log(`  SUBJ shot ${p.shot} L${p.line}: ${p.problem}`);
      for (const p of r.tlProblems) console.log(`  TL ${p}`);
    }
  } else {
    const results = runAll(ideas);
    const sum = summarize(results);
    const dir = path.resolve(HERE, "../out/coverage");
    writeReport(results, sum, dir);
    const { cardWords, badgeWords, missWords, monsters, ...head } = sum;
    console.log(JSON.stringify(head));
    console.log("top cards:", cardWords.slice(0, 40).map(([w, n]) => `${w}:${n}`).join(", "));
    console.log("top badges:", badgeWords.slice(0, 20).map(([w, n]) => `${w}:${n}`).join(", "));
    console.log("monsters:", monsters.map(([w, n]) => `${w}:${n}`).join(", "));
  }
}
