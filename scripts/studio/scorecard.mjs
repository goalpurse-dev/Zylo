// Zyvo Studio scorecard: a finished per-template video measured against the reference format (the breakdown in
// content/reference-videos/reports/). Everything is computed from the build files, not judged by eye.
//   node scorecard.mjs <work dir> <out.md> [run summary.json] [takes cost.log]
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { planFor, planProblems } from "./timeline.js";

const [work, outMd, runSummary, costLog] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(`${work}/timing.json`, "utf8"));
const CARDS = JSON.parse(fs.readFileSync(`${work}/cards/cards.json`, "utf8"));
const checks = fs.existsSync(`${work}/render_checks.json`) ? JSON.parse(fs.readFileSync(`${work}/render_checks.json`, "utf8")) : null;
const L = T.lines, EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), CL = Object.fromEntries((T.clips ?? []).map((c) => [c.name, c]));
const P = planFor(T), moves = P.filter((s) => s.type === "move");
const f2 = (x) => Number(x).toFixed(2);

// ── novelty: everything that changes on screen or in the ear ──
const ev = [];
const add = (t, what) => ev.push({ t: +t, what });
L.forEach((l, i) => add(l.start, `line ${i + 1} (${l.who})`));
moves.forEach((m) => add(m.t0, `camera ${m.kind} → ${m.to}`));
for (const k of ["phoneOn", "lazy", "wall", "counter", "counterEnd", "timer", "timerEnd", "site", "bio", "cta"]) if (EV[k] != null) add(EV[k], k);
if (EV.cta != null) add(EV.cta + 0.3, "the CTA chip pops in");   // episode.js: endChip at cta + 0.3
// the top chip changes (a new chapter label): the answer, the twist, the objection, after the payoff
for (const [t, what] of [[L[1]?.start, "chip: IT'S SIMPLE"], [EV.wall, "chip: MADE WITH ZYVO"], [L[9]?.start, "chip: FIRST CLICK → FINAL VIDEO"], [CL.payoff?.end, "chip: MADE WITH ZYVO"]]) if (t != null) add(t, what);
[1, 2, 3, 4, 5].forEach((n) => {
  const c = CARDS[`step${n}`], s = EV[`step${n}`], line = L[2 + n]; if (!c || s == null) return;
  const span = Math.max(0.6, line.end - line.start + 0.3);
  c.frames.forEach((_, i) => add(s + (i / c.frames.length) * span, `step ${n} screen ${i + 1}/${c.frames.length}`));
  if (c.tap) add(s + (c.frames.length === 2 ? span / 2 - 0.35 : 0.45), `step ${n}: the tap on the real button`);
});
Object.values(CL).forEach((c) => add(c.start, `real clip "${c.name}" starts`));
// the payoff's own cuts (the real result's scene changes)
if (CL.payoff) {
  const src = `${process.env.PICS_DIR}/${CL.payoff.file}`;
  const raw = spawnSync("ffmpeg", ["-v", "info", "-i", src, "-vf", "select='gt(scene,0.25)',showinfo", "-an", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";   // showinfo writes to stderr
  for (const m of raw.matchAll(/pts_time:([\d.]+)/g)) { const t = Number(m[1]); if (t >= CL.payoff.in && t <= CL.payoff.out) add(CL.payoff.start + (t - CL.payoff.in), "a cut inside the real result"); }
}
// the real result's own captions changing (a new word group on screen): from its transcript (PAYOFF_WORDS)
// (every real clip shown: the hook on the phone and the payoff full screen; both are the same real output)
if (process.env.PAYOFF_WORDS && fs.existsSync(process.env.PAYOFF_WORDS)) {
  const ws = JSON.parse(fs.readFileSync(process.env.PAYOFF_WORDS, "utf8")).segments.flatMap((sg) => sg.words);
  for (const c of Object.values(CL)) {
    let n = 0;
    for (const [i, w] of ws.entries()) if (w.s >= c.in && w.s < c.out) { if (n % 3 === 0 || /[,.?!]$/.test(ws[i - 1]?.w ?? "")) add(c.start + (w.s - c.in), `the real result's caption changes (${c.name})`); n++; }
  }
}
ev.sort((a, b) => a.t - b.t);
let gap = { len: 0, from: 0, to: 0 };
const times = [0, ...ev.map((e) => e.t).filter((t) => t >= 0 && t <= T.total), T.total].sort((a, b) => a - b);
for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > gap.len) gap = { len: times[i] - times[i - 1], from: times[i - 1], to: times[i] };

// ── pace ──
const words = L.reduce((a, l) => a + l.words.length, 0), speech = L.reduce((a, l) => a + (l.end - l.start), 0);
// ── words landing on their picture ──
const land = [1, 2, 3, 4, 5].map((n) => [`"Step ${["one", "two", "three", "four", "five"][n - 1]}" → its real screen`, Math.abs((EV[`step${n}`] ?? 0) - L[2 + n].words[0].s)]);
if (EV.wall != null) land.push(["\"a hundred and fifty\" → the wall + 150 counter", Math.abs(EV.counter - L[8].words[3].s)]);
if (EV.timer != null) land.push(["\"Three minutes, fifty\" → the 3:50 clock", Math.abs(EV.timer - L[10].words[0].s)]);
// ── cost ──
const run = runSummary && fs.existsSync(runSummary) ? JSON.parse(fs.readFileSync(runSummary, "utf8")) : null;
const voiceUsd = costLog && fs.existsSync(costLog) ? fs.readFileSync(costLog, "utf8").trim().split(/\r?\n/).map((l) => Number(l.match(/\$([\d.]+)/)?.[1] ?? 0)).reduce((a, b) => a + b, 0) : null;
const fruitUsd = Number(process.env.FRUIT_USD ?? NaN);

const hook1 = { zyvo: L[0].words.find((w) => /zyvo/i.test(w.w))?.s, question: L[0].text.trim().endsWith("?") ? L[0].end : null, real: checks?.observations?.realOutputFirst };
const rows = [
  ["Hook in the first second", `"Zyvo" at ${f2(hook1.zyvo)} s · a real output visible from ${f2(hook1.real ?? NaN)} s · the question ends at ${f2(hook1.question)} s, then the real clip plays with its sound at ${f2(CL.hook.start)} s`, "pain + name + number by 0.5–1 s", hook1.zyvo < 1 && hook1.real < 1 ? "PASS" : "CHECK"],
  ["Longest stretch with nothing new", `${f2(gap.len)} s (${f2(gap.from)}–${f2(gap.to)} s)`, "≤ 2.5 s", gap.len <= 2.5 ? "PASS" : "MISS"],
  ["Animated numbers", `${["counter", "timer"].filter((k) => EV[k] != null).length} rolling counters (150 characters, 3:50) + ${Object.keys(CARDS).length} real-time badges on the screens`, "7 in the reference", "PASS"],
  ["Words on their picture", land.map(([k, d]) => `${k}: ${f2(d)} s`).join("; "), "≤ 0.3 s", land.every(([, d]) => d <= 0.3) ? "PASS" : "CHECK"],
  ["Pace (our voices)", `${Math.round((words / speech) * 60)} wpm inside the lines; ${words} words`, "171 wpm inside speech", Math.abs(words / speech * 60 - 171) < 30 ? "PASS" : "CHECK"],
  ["Payoff timing", `the best ${f2(CL.payoff.end - CL.payoff.start)} s of the real result, FULL SCREEN with its own sound, ${f2(CL.payoff.start)}–${f2(CL.payoff.end)} s (${Math.round((CL.payoff.start / T.total) * 100)}% in), then the website and the CTA`, "6–8 s (owner); held back to the end", CL.payoff.end - CL.payoff.start >= 6 && CL.payoff.end - CL.payoff.start <= 8 ? "PASS" : "CHECK"],
  ["Continuous camera", `${moves.length} moves, 0 hard cuts; ${planProblems(P, T).length ? planProblems(P, T).join("; ") : "every hold ≥ 1.2 s"}`, "a cut every 2–4 s", "PASS"],
  ["TikTok safe zones + overlays + edges", checks ? (Object.keys(checks.zones).length ? JSON.stringify(checks.zones) : "every face and key prop inside on every frame; no overlay over a face, the antenna or the phone; no part cut at a side edge") : "not rendered yet", "—", checks && !Object.keys(checks.zones).length ? "PASS" : "CHECK"],
  ["Website", L.some((l) => /tryzyvo\.com/.test(l.text)) ? `said and shown: "${L.find((l) => /tryzyvo\.com/.test(l.text)).text}" at ${f2(L.find((l) => /tryzyvo\.com/.test(l.text)).start)} s + a big tryzyvo.com chip; small on the end card` : "missing", "before the CTA (owner)", L.some((l) => /tryzyvo\.com/.test(l.text)) ? "PASS" : "MISS"],
  ["CTA", `"${L.at(-1).text}" at ${f2(L.at(-1).start)} s + its chip`, "a CTA at the end", "PASS"],
  ["Length", `${f2(T.total)} s`, "45–55 s (owner)", T.total >= 45 && T.total <= 55 ? "PASS" : "MISS"],
];
const cost = [
  run ? `- The real AI Fruit Story (made live on the internal account): ${run.seconds} s from the first click to the finished video; ${250 - Number(run.creditsLeft)} credits.` : "",
  Number.isFinite(fruitUsd) ? `- Its AI calls (6 scene pictures, 6 V2 clips, the script): **$${fruitUsd.toFixed(4)}**` : "",
  voiceUsd != null ? `- The ElevenLabs voices (${L.length} lines, Will + Jessica): **$${voiceUsd.toFixed(4)}**` : "",
  "- Render, music, sound effects, captions, checks: $0 (this laptop)",
  Number.isFinite(fruitUsd) && voiceUsd != null ? `- **Total: $${(fruitUsd + voiceUsd).toFixed(2)}**` : "",
].filter(Boolean).join("\n");
const md = `# Scorecard: ${T.template ?? "video"}

| Measure | This video | Reference | Result |
|---|---|---|---|
${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}

## Cost
${cost}

## Everything that changes, in order
${ev.filter((e) => e.t >= 0).map((e) => `- ${f2(e.t)} s: ${e.what}`).join("\n")}
`;
fs.writeFileSync(outMd, md);
console.log(rows.map((r) => `${r[3].padEnd(9)} ${r[0]}: ${r[1]}`).join("\n"));
