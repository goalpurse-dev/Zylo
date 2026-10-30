// Writes <work>/moves.json (the camera plan: whooshes) and <work>/visual_events.json (every card flip, tap and chip
// change: ticks, clicks, pops) from <work>/timing.json, for audio.py, and checks the plan. "No dead air" (owner,
// 2026-10-30): whatever changes on screen is also heard.
//   node writeMoves.mjs <work dir>
import fs from "node:fs";
import { planFor, planProblems, roles } from "./timeline.js";
const [work] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(`${work}/timing.json`, "utf8"));
const p = planFor(T);
fs.writeFileSync(`${work}/moves.json`, JSON.stringify(p.filter((s) => s.type === "move"), null, 1));

// the same card timing as episode.js#cardFrame: a step's frames spread over its line (+0.3 s); a tap 0.35 s before the next
const ev = [];
const EV = Object.fromEntries(T.events.map((e) => [e.event, e.t]));
if (T.template && fs.existsSync(`${work}/cards/cards.json`)) {
  const CARDS = JSON.parse(fs.readFileSync(`${work}/cards/cards.json`, "utf8")), R = roles(T.lines);
  for (let n = 1; n <= 5; n++) {
    const c = CARDS[`step${n}`], s = EV[`step${n}`], line = R[`step${n}`]; if (!c || s == null || !line) continue;
    const span = Math.max(0.6, line.end - line.start + 0.3), dur = span / c.frames.length;
    c.frames.forEach((f, i) => {
      if (i > 0) ev.push({ t: +(s + i * dur).toFixed(3), sfx: "tick", gain: 0.55, what: `step ${n} screen ${i + 1}` });
      if (f.tap) ev.push({ t: +(s + (c.frames.length > 1 ? (i + 1) * dur - 0.35 : 0.45)).toFixed(3), sfx: "click", gain: 0.8, what: `step ${n} tap` });
    });
  }
  // chip changes that have no sound of their own yet
  for (const [t, what] of [[R.answer?.start, "chip: IT'S SIMPLE"], [EV.lazy, "chip: TOO LAZY"], [R.objection?.start, "chip: FIRST CLICK"], [T.clips?.find((c) => c.name === "payoff")?.end, "chip: MADE WITH ZYVO"], [EV.cta != null ? EV.cta + 0.3 : null, "the CTA chip"]])
    if (t != null) ev.push({ t: +t.toFixed(3), sfx: "pop", gain: 0.45, what });
}
fs.writeFileSync(`${work}/visual_events.json`, JSON.stringify(ev.sort((a, b) => a.t - b.t), null, 1));
for (const s of p) console.log(`${s.t0.toFixed(2)}-${s.t1.toFixed(2)} ${s.type === "hold" ? `hold ${s.at}` : `${s.kind} ${s.from} -> ${s.to}`}`);
const probs = planProblems(p, T);
console.log(`${ev.length} visual events with a sound`);
console.log(probs.length ? `PLAN PROBLEMS: ${probs.join("; ")}` : "plan ok: every hold >= 1.2 s, no hard cuts");
