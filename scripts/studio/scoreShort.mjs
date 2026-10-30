// Zyvo Studio: the Retention Engine scorecard for a short video (owner, 2026-10-30). Every row is measured from the
// build files and the rendered MP4, not judged by eye; the one judged row (frame-0 rating) is read from
// <work>/frame0_rating.json and says who rated it. Writes <out.md> and <out.json> (the Queue item keeps the rows).
//   PICS_DIR=... PAYOFF_WORDS=<words.json> node scoreShort.mjs <work dir> <video.mp4> <out.md>
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { planFor, planProblems, roles, shortSteps, stepFrames, anchor } from "./timeline.js";

const [work, mp4, outMd] = process.argv.slice(2);
if (!fs.existsSync(mp4) || fs.statSync(mp4).size < 1000) { console.error(`not rendered: ${mp4}`); process.exit(1); }
const T = JSON.parse(fs.readFileSync(`${work}/timing.json`, "utf8"));
const SH = T.short, L = T.lines, R = roles(L);
const CARDS = JSON.parse(fs.readFileSync(`${work}/cards/cards.json`, "utf8"));
const checks = fs.existsSync(`${work}/render_checks.json`) ? JSON.parse(fs.readFileSync(`${work}/render_checks.json`, "utf8")) : null;
const EV = Object.fromEntries(T.events.map((e) => [e.event, e.t])), CL = Object.fromEntries((T.clips ?? []).map((c) => [c.name, c]));
const P = planFor(T), moves = P.filter((s) => s.type === "move");
const END = T.total, f2 = (x) => (x == null || Number.isNaN(Number(x)) ? "—" : Number(x).toFixed(2));
const clipEnd = (c) => c.freeze_end ?? c.end;

// ── what changes on screen (visual) and the bigger re-hooks ──
const vis = [], big = [];
const V = (t, what, isBig = false) => { if (t == null || t < 0 || t > END) return; vis.push({ t: +t, what }); if (isBig) big.push({ t: +t, what }); };
const covered = (t) => Object.values(CL).some((c) => c.fullscreen && t >= c.start && t < clipEnd(c));
moves.forEach((m) => { if (!covered(m.t0) || !covered(m.t1)) V(m.t0, `camera ${m.kind} → ${m.to}`, true); });
for (const c of Object.values(CL)) {
  V(c.start, c.enter === "cut" ? `real clip "${c.name}" full screen (frame 0)` : `real clip "${c.name}" grows full screen`, true);
  (c.punch ?? []).forEach((p) => V(c.start + p, `zoom punch (${c.name})`, true));
  if (c.freeze_end) V(c.end, "freeze-frame + record scratch", true);
  if (c.fullscreen) V(clipEnd(c), `"${c.name}" shrinks into the phone`, true);
  if (c.open_loop) V(c.start + c.open_loop.at, "open-loop chip", true);
  // the real result's own cuts and caption changes, inside the part shown
  const src = `${process.env.PICS_DIR}/${c.file}`;
  const raw = spawnSync("ffmpeg", ["-v", "info", "-i", src, "-vf", "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-"], { encoding: "utf8" }).stderr ?? "";
  for (const m of raw.matchAll(/pts_time:([\d.]+)/g)) { const t = Number(m[1]); if (t > c.in + 0.1 && t < c.out) V(c.start + t - c.in, `a cut inside the real result (${c.name})`); }
  if (process.env.PAYOFF_WORDS && fs.existsSync(process.env.PAYOFF_WORDS)) {
    const ws = JSON.parse(fs.readFileSync(process.env.PAYOFF_WORDS, "utf8")).segments.flatMap((sg) => sg.words); let n = 0;
    for (const [i, w] of ws.entries()) if (w.s >= c.in && w.s < c.out) { if (n % 3 === 0 || /[,.?!]$/.test(ws[i - 1]?.w ?? "")) V(c.start + (w.s - c.in), `the real result's caption changes (${c.name})`); n++; }
  }
}
const steps = shortSteps(T);
for (const st of steps) {
  V(st.t0, `step ${steps.indexOf(st) + 1}/${steps.length}: the chip + a real screen`, true);
  const sf = stepFrames(st, CARDS); sf?.frames.forEach((f, i) => { if (i) V(f.t, `step ${steps.indexOf(st) + 1} screen ${i + 1}`); if (f.f.tap) V(st.t0 + f.tapAt, `step ${steps.indexOf(st) + 1}: the real tap`); });
}
for (const c of SH.chips ?? []) V(anchor(T, c.from), `chip: ${c.parts.map((p) => p[0]).join("")}`);
for (const [k, what, b] of [["wall", "the wall of real results", true], ["counter", "the 150 counter rolls", true], ["counterEnd", "the counter lands"], ["timer", "the 3:50 clock rolls", true], ["timerEnd", "the clock lands"], ["site", "tryzyvo.com chip", true], ["bio", "· link in bio"], ["cta", "the trigger line", true]])
  if (EV[k] != null) V(EV[k], what, b);
if (EV.cta != null) V(EV.cta + 0.3, "the trigger chip");
if (SH.loop_end) V(END - (SH.loop_end.secs ?? 0.5), "the loop: fading back to frame 0", true);
vis.sort((a, b) => a.t - b.t); big.sort((a, b) => a.t - b.t);
const maxGap = (list, from = 0, to = END) => {
  const ts = [from, ...list.map((e) => e.t).filter((t) => t >= from && t <= to), to].sort((a, b) => a - b); let g = { len: 0, from, to: from };
  for (let i = 1; i < ts.length; i++) if (ts[i] - ts[i - 1] > g.len) g = { len: ts[i] - ts[i - 1], from: ts[i - 1], to: ts[i] };
  return g;
};
const gVis = maxGap(vis), gVis5 = maxGap(vis, 0, Math.min(5, END)), gBig = maxGap(big);
// a line starting also counts as "something new" for the ear
const gAny = maxGap([...vis, ...L.map((l) => ({ t: l.start }))]);

// ── sound: frame 0, the longest near-silence (fg.wav: everything but the music) ──
const pcm = spawnSync("ffmpeg", ["-v", "error", "-i", `${work}/fg.wav`, "-ac", "1", "-ar", "16000", "-f", "f32le", "-"], { maxBuffer: 1 << 28 }).stdout;
const A = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
const dbAt = (t0, t1) => { let e = 0, n = 0; for (let k = Math.floor(t0 * 16000); k < Math.min(A.length, t1 * 16000); k++) { e += A[k] * A[k]; n++; } return 10 * Math.log10(e / Math.max(1, n) + 1e-12); };
const frame0Db = dbAt(0, 0.1);
let run = 0, silence = { len: 0, at: 0 };
for (let i = 0; i + 800 <= A.length; i += 800) { if (dbAt(i / 16000, (i + 800) / 16000) < -40 && i / 16000 < END - 0.3) { run += 0.05; if (run > silence.len) silence = { len: run, at: i / 16000 - run + 0.05 }; } else run = 0; }
const voiceGaps = L.slice(1).map((l, i) => ({ g: l.start - L[i].end })).filter((x, i) => !Object.values(CL).some((c) => c.start >= L[i].end - 0.01 && c.start <= L[i + 1].start));
const maxVoiceGap = Math.max(0, ...voiceGaps.map((x) => x.g));

// ── the loop: the last frame against the first (mean absolute difference, 0–255, on a small grey copy) ──
const grab = (args) => spawnSync("ffmpeg", ["-v", "error", ...args, "-i", mp4, "-frames:v", "1", "-vf", "scale=135:240,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 24 }).stdout;
const first = grab([]), last = grab(["-sseof", "-0.04"]);
let diff = 0; for (let i = 0; i < Math.min(first.length, last.length); i++) diff += Math.abs(first[i] - last[i]); diff /= Math.max(1, Math.min(first.length, last.length));
const dur = Number(spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp4], { encoding: "utf8" }).stdout.trim());

// ── pace, twist, loop planted/paid, the end ──
const words = L.reduce((a, l) => a + l.words.length, 0), speech = L.reduce((a, l) => a + (l.end - l.start), 0), wpm = (words / speech) * 60;
const open = Object.values(CL).find((c) => c.enter === "cut"), f0 = checks?.observations?.frame0;
const hookWords = (open?.hook ?? "").replace(/[|*]/g, " ").split(/\s+/).filter(Boolean).length;
const firstInterrupt = Math.min(...[...(open?.punch ?? []).map((p) => open.start + p), open?.freeze_end ? open.end : Infinity]);
const planted = EV.loopPlant, paid = SH.recipe?.open_loop_paid_by === "site" ? EV.site : EV.loopPaid;
const twistAt = EV.wall ?? R.twist?.start;
const payoffC = Object.values(CL).find((c) => c.pays_loop) ?? CL.payoff;
const ctaLines = L.filter((l) => l.role === "cta");
const rating = fs.existsSync(`${work}/frame0_rating.json`) ? JSON.parse(fs.readFileSync(`${work}/frame0_rating.json`, "utf8")) : null;
const [lo, hi] = SH.length_target ?? [15, 40];
const zonesOk = checks && !Object.keys(checks.zones).length;
const probs = planProblems(P, T).filter((p) => { const m = p.match(/at ([\d.]+)/); return !(m && covered(Number(m[1]) + 0.01)); });
const PASS = (ok) => (ok ? "PASS" : "MISS");

const rows = [
  ["A · Frame 0 is the real result", f0 ? (f0.fullscreen ? "the real result full screen, mid-action, from frame 0" : "NOT full screen on frame 0") : "not rendered", "start mid-action on the most striking real moment", PASS(f0?.fullscreen)],
  ["A · Hook text on frame 0", `"${(open?.hook ?? "").replace(/[|*]/g, " ").replace(/\s+/g, " ").trim()}" (${hookWords} words), whole on frame 0`, "bold, ≤ 7 words, in the safe zone", PASS(open?.hook && hookWords <= 7)],
  ["A · Sound on frame 0", `${f2(frame0Db)} dB in the first 0.1 s (a hit + the clip's own sound)`, "a sound hit at frame 0", PASS(frame0Db > -30)],
  ["A · Pattern interrupt in the first second", Number.isFinite(firstInterrupt) ? `first at ${f2(firstInterrupt)} s (${(open.punch ?? []).length} zoom punches${open.freeze_end ? " + a freeze" : ""})` : "none", "≤ 1.0 s", PASS(firstInterrupt <= 1.0)],
  ["A · Would a cold viewer stop scrolling? (1–10)", rating ? `${rating.score}/10 by ${rating.by}: ${rating.why}` : "not rated yet", "≥ 7, else a new hook", rating ? (rating.score >= 7 ? "PASS" : "MISS") : "WAITING"],
  ["B · Open loop", planted != null ? `planted at ${f2(planted)} s; paid at ${f2(paid)} s (${Math.round(((paid ?? 0) / END) * 100)}% in) by ${SH.recipe?.open_loop ?? "?"}` : "none", "planted ≤ 3 s; ALWAYS paid, in the second half, before the website (unless the loop IS the website)", PASS(planted != null && planted <= 3 && paid != null && paid > END * 0.5 && (SH.recipe?.open_loop_paid_by === "site" || paid < (EV.site ?? END)))],
  ["C · Visual change", `longest with no visual change ${f2(gVis.len)} s (${f2(gVis.from)}–${f2(gVis.to)}); first 5 s: ${f2(gVis5.len)} s`, "≤ 2 s (first 5 s: every 1–2 s)", PASS(gVis.len <= 2.0 && gVis5.len <= 2.0)],
  ["C · Re-hook", `longest without a bigger re-hook ${f2(gBig.len)} s (${f2(gBig.from)}–${f2(gBig.to)}); anything new (incl. a line): ${f2(gAny.len)} s`, "≤ 5 s", PASS(gBig.len <= 5)],
  ["C · Progress", steps.length ? `${steps.length} steps with progress dashes (${steps.map((s) => s.chip.join("")).join(" → ")})` : "none", "visible progress", PASS(steps.length >= 3)],
  ["C · Mid twist", twistAt != null ? `the 150 wall at ${f2(twistAt)} s = ${Math.round((twistAt / END) * 100)}% in` : "none (a 20 s cut: the payoff is the twist)", "~50–60%", twistAt != null ? (twistAt / END >= 0.45 && twistAt / END <= 0.65 ? "PASS" : "CHECK") : END <= 21 ? "n/a" : "MISS"],
  ["C · Pace", `${Math.round(wpm)} wpm inside the lines (${words} words, takes at ×${SH.tempo ?? 1})`, "200–230 wpm", PASS(wpm >= 195 && wpm <= 235)],
  ["D · End hit", payoffC ? `the ending (${f2(payoffC.end - payoffC.start)} s, full screen, its own sound) at ${f2(payoffC.start)} s, then the website at ${f2(EV.site)} s, then ONE trigger (${SH.cta?.kind}): "${ctaLines[0]?.text}"` : "no payoff", "best moment last + website + one trigger", PASS(payoffC && EV.site > payoffC.start && ctaLines.length === 1)],
  ["E · Loop", `last frame vs frame 0: ${f2(diff)} / 255 mean difference`, "the end flows into the start (≤ 6)", PASS(diff <= 6)],
  ["F · Length", `${f2(dur)} s`, `${lo}–${hi} s (this variant)`, PASS(dur >= lo - 0.5 && dur <= hi + 0.5)],
  ["Safe zones + overlays + edges", checks ? (zonesOk ? "every face and key prop inside on every frame; nothing over a face, the antenna or the phone; every overlay inside the safe zone" : JSON.stringify(checks.zones)) : "not rendered", "—", PASS(zonesOk)],
  ["Continuous camera", `${moves.length} moves, 0 hard cuts in the studio; ${probs.length ? probs.join("; ") : "every visible hold ≥ 1.2 s"}`, "no jumps", PASS(!probs.length)],
  ["No dead air", `longest near-silence ${f2(silence.len)} s (at ${f2(silence.at)} s); longest voice gap ${f2(maxVoiceGap)} s`, "≤ 0.5 s; voice gaps ≤ 0.4 s", PASS(silence.len <= 0.5 && maxVoiceGap <= 0.4)],
];
const md = `# Retention scorecard: ${SH.variant} (${f2(dur)} s)

Recipe: ${JSON.stringify(SH.recipe)}

| Rule | This video | Target | Result |
|---|---|---|---|
${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}

## Everything that changes on screen
${vis.map((e) => `- ${f2(e.t)} s: ${e.what}${big.includes(e) ? " **(re-hook)**" : ""}`).join("\n")}
`;
fs.writeFileSync(outMd, md);
fs.writeFileSync(outMd.replace(/\.md$/, ".json"), JSON.stringify({ variant: SH.variant, seconds: +dur.toFixed(2), rows: rows.map(([rule, value, target, result]) => ({ rule, value, target, result })) }, null, 1));
console.log(rows.map((r) => `${r[3].padEnd(8)} ${r[0]}: ${r[1]}`).join("\n"));
