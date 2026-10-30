// Writes <work>/moves.json (the camera plan: whooshes) and <work>/visual_events.json (every card flip, tap and chip
// change: ticks, clicks, pops) from <work>/timing.json, for audio.py, and checks the plan. "No dead air" (owner,
// 2026-10-30): whatever changes on screen is also heard.
//   node writeMoves.mjs <work dir>
import fs from "node:fs";
import { planFor, planProblems, roles, shortSteps, stepFrames, anchor } from "./timeline.js";
const [work] = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(`${work}/timing.json`, "utf8"));
const p = planFor(T);
fs.writeFileSync(`${work}/moves.json`, JSON.stringify(p.filter((s) => s.type === "move"), null, 1));

// the same card timing as episode.js#cardFrame: a step's frames spread over its line (+0.3 s); a tap 0.35 s before the next
const ev = [];
const EV = Object.fromEntries(T.events.map((e) => [e.event, e.t]));
if (T.short) {
  // short videos: every step flip/tap, chip, clip growing/shrinking and the loop fade is heard
  const CARDS = JSON.parse(fs.readFileSync(`${work}/cards/cards.json`, "utf8"));
  for (const st of shortSteps(T)) {
    const sf = stepFrames(st, CARDS); if (!sf) continue;
    if (!(st.line.cues ?? []).length) ev.push({ t: +st.t0.toFixed(3), sfx: "pop", gain: 0.6, what: `step ${st.n} chip` });
    sf.frames.forEach((f, i) => {
      if (i > 0) ev.push({ t: +f.t.toFixed(3), sfx: "tick", gain: 0.55, what: `step ${st.n} screen ${i + 1}` });
      if (f.f.tap) ev.push({ t: +(st.t0 + f.tapAt).toFixed(3), sfx: "click", gain: 0.8, what: `step ${st.n} tap` });
    });
  }
  for (const c of T.short.chips ?? []) ev.push({ t: +anchor(T, c.from).toFixed(3), sfx: "pop", gain: 0.45, what: `chip: ${c.parts.map((p) => p[0]).join("")}` });
  for (const c of T.clips ?? []) {
    if (c.fullscreen && c.enter !== "cut") ev.push({ t: +(c.start - 0.4).toFixed(3), sfx: "whoosh:0.45", gain: 0.6, what: `${c.name} grows full screen` });
    if (c.fullscreen) ev.push({ t: +(c.freeze_end ?? c.end).toFixed(3), sfx: "whoosh:0.35", gain: 0.5, what: `${c.name} shrinks into the phone` });
    if (c.pays_loop) ev.push({ t: +(c.start - 0.1).toFixed(3), sfx: "sparkle", gain: 0.5, what: "the loop pays off" });
  }
  if (T.short.loop_end) ev.push({ t: +(T.total - (T.short.loop_end.secs ?? 0.5) - 0.05).toFixed(3), sfx: `whoosh:${(T.short.loop_end.secs ?? 0.5).toFixed(2)}`, gain: 0.7, what: "the loop: back to frame 0" });
} else if (T.template && fs.existsSync(`${work}/cards/cards.json`)) {
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
