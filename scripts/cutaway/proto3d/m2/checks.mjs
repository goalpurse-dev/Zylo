// M2: the quality checks (M2_PLAN.md section 5), in order:
//  1. timelineChecks: free code checks on the compiled timeline, before anything renders;
//  2. previewTimes + visionCheck: one still per beat at its key moment, checked by Claude against its sentence;
//  3. renderChecks: measured on the full render (one continuous shot, saturation, loudness), plus a 1 fps contact sheet.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { channelValue } from "./curves.js";
import { cameraAt, projectBox, MOVE } from "./director.js";
import { focusOf } from "./focus.js";
import { CAMERA_LIMITS, measureKey, turnBetween } from "./framing.js";
import { callJSON } from "./llm.mjs";
import { sheet } from "./sheet.mjs";

// the channels that mean "the problem is still on screen" (rain, storm, leaks, flows, arrows) by kind
const PROBLEM_CH = { rain: ["on"], stream: ["on"], light: ["storm"], soilLeak: ["a1", "a2", "murkA"], arrows: ["on"], seepFlow: ["on"], bubbles: ["on"], pipeFlow: ["on"], pipeRunFlow: ["on"], puddles: ["rise"] };

/** 1. code checks on a compiled timeline (layout: the layout it came from) */
export function timelineChecks(layout, tl) {
  const problems = [], warnings = [], T = tl.tracks, M = tl.marks;
  const congrats = tl.sentences.find((s) => s.role === "congrats") ?? tl.sentences.at(-1);
  // the end card 0.4 s after the measured voice
  if (Math.abs(M.signPop - (M.speechEnd + 0.4)) > 0.01) problems.push(`the sign pops ${(M.signPop - M.speechEnd).toFixed(2)} s after the voice (want 0.4)`);
  // a calm end: nothing of the problem left once "Congratulations" is said
  const tEnd = congrats.t0 + 0.8;
  for (const p of layout.parts) for (const ch of PROBLEM_CH[p.kind] ?? []) {
    const tr = T[`${p.id}.${ch}`]; if (!tr) continue;
    let v = channelValue(tr, tEnd);
    if (p.kind === "puddles") v -= channelValue(T[`${p.id}.fall`], tEnd);
    if (v > 0.05) problems.push(`${p.id} (${p.kind}) is still on at "Congratulations" (${ch} = ${v.toFixed(2)}): the end must be calm`);
  }
  // something new at least every 2.5 s (cue starts and camera moves), from the first word to the end of the voice
  const events = [...Object.values(T).flatMap((tr) => tr.ramps.map((r) => r.t0)), ...tl.camera.end.map((k) => k[0])].filter((t) => t >= 0 && t <= M.speechEnd).sort((a, b) => a - b);
  let worst = { gap: 0, at: 0 }, prev = 0;
  for (const t of [...events, M.speechEnd]) { if (t - prev > worst.gap) worst = { gap: t - prev, at: prev }; prev = t; }
  if (worst.gap > 2.5) warnings.push(`nothing new for ${worst.gap.toFixed(1)} s after ${worst.at.toFixed(1)} s (want 2.5 s or less)`);
  // the camera: fast moves (big changes of view in under 1.2 s) and their cadence
  const fast = [];
  for (let t = 0.1; t < M.lengthEnd; t += 0.1) {
    const a = cameraAt(tl.camera.end, t - 0.1), b = cameraAt(tl.camera.end, t);
    const dist = Math.hypot(...a.pos.map((v, i) => v - a.tgt[i]));
    const d = Math.hypot(...a.pos.map((v, i) => v - b.pos[i])) + Math.hypot(...a.tgt.map((v, i) => v - b.tgt[i]));
    if (d / dist > 0.04 && (!fast.length || t - fast.at(-1) > 1.2)) fast.push(+t.toFixed(1));
  }
  const per10 = (fast.length / M.speechEnd) * 10;
  if (per10 > 3.5) warnings.push(`${fast.length} fast camera moves in ${M.speechEnd.toFixed(0)} s (${per10.toFixed(1)} per 10 s; the approved videos have about 3)`);
  // the named part: on screen, at least 15% of the width, clear of the bands (the director's hero frame)
  const hero = (tl.director?.frames ?? []).filter((f) => f.ok !== undefined);
  for (const f of hero) if (f.rect.w < 0.15) (f.hero ? problems : warnings).push(`the shot at ${f.t.toFixed(1)} s frames ${f.ids} at ${(f.rect.w * 100).toFixed(0)}% of the width (at least 15%)`);
  // the camera at the middle of every sentence: the main subject in view, at most 40% open lawn or sky, and no
  // turn between keys bigger than the hand-built paths make (CAMERA_LIMITS, calibrated on them)
  const camera = [];
  for (const s of tl.sentences) {
    const t = (s.t0 + s.t1) / 2; if (t > M.signPop) continue;
    const k = cameraAt(tl.camera.end, t), m = measureKey(layout, k.pos, k.tgt);
    camera.push({ role: s.role, t: +t.toFixed(2), ...m });
    if (m.empty > CAMERA_LIMITS.emptyMax) problems.push(`sentence ${s.role}: the frame is ${(m.empty * 100).toFixed(0)}% open lawn or sky (at most ${CAMERA_LIMITS.emptyMax * 100}%)`);
    if (m.subject < CAMERA_LIMITS.subjectMin) problems.push(`sentence ${s.role}: the main subject is out of the frame (${(m.subject * 100).toFixed(1)}% of it)`);
  }
  const story = tl.camera.end.filter((k) => k[0] <= M.signPop);
  for (let i = 1; i < story.length; i++) { const tu = turnBetween({ pos: story[i - 1][1], tgt: story[i - 1][2] }, { pos: story[i][1], tgt: story[i][2] }); if (tu > CAMERA_LIMITS.turnMax) problems.push(`the camera turns ${tu.toFixed(0)} degrees at ${story[i][0].toFixed(1)} s (the hand-built paths at most ${CAMERA_LIMITS.turnMax})`); }
  if (!(tl.director?.frames ?? []).some((f) => f.opening)) warnings.push("the video opens on the home view, not close on the hook object");
  // the part that shows each sentence: at least 12% of the frame width and inside the frame at its moment
  for (const pt of previewTimes(tl, layout)) {
    const b = layout.beats?.find((x) => x.s === pt.role); if (!b?.shows) continue;
    const part = layout.parts.find((p) => p.id === b.shows.p); let box = null; try { box = part && focusOf(part, layout.world?.cut); } catch {}
    if (!box) continue;
    const k = cameraAt(tl.camera.end, pt.t), r = projectBox(k.pos, k.tgt, box);
    if (r.behind || r.x1 < 0.02 || r.x0 > 0.98 || r.y1 < 0.02 || r.y0 > 0.98) problems.push(`sentence ${pt.role}: ${b.shows.p} is not in the frame at its moment`);
    else if (Math.min(1, r.x1) - Math.max(0, r.x0) < 0.12) problems.push(`sentence ${pt.role}: ${b.shows.p} is only ${((Math.min(1, r.x1) - Math.max(0, r.x0)) * 100).toFixed(0)}% of the frame width at its moment (at least 12%)`);
  }
  // beats at least 2.5 s long
  for (const s of tl.sentences) if (s.t1 - s.t0 < 1.0) warnings.push(`sentence ${s.role} lasts only ${(s.t1 - s.t0).toFixed(1)} s`);
  return { problems, warnings, camera, stats: { fastMoves: fast, movesPer10s: +per10.toFixed(1), longestGap: +worst.gap.toFixed(2) } };
}

/** 2a. one preview time per sentence: when its last action has finished (capped before the next sentence) */
export function previewTimes(tl, layout = null) {
  const out = [];
  tl.sentences.forEach((s, i) => {
    const next = tl.sentences[i + 1]?.t0 ?? tl.marks.lengthEnd;
    const beat = layout?.beats?.find((b) => b.s === s.role), shows = beat?.shows;
    // the moment after the sentence's showing action has settled (else after its last action)
    const own = shows ? Object.entries(tl.tracks).filter(([k]) => k.startsWith(`${shows.p}.`)).flatMap(([, tr]) => tr.ramps.filter((r) => r.t0 >= s.t0 - 0.5 && r.t0 < next).map((r) => r.t1)) : [];
    const ends = own.length ? own : Object.values(tl.tracks).flatMap((tr) => tr.ramps.filter((r) => r.t0 >= s.t0 - 0.5 && r.t0 < next - 0.3).map((r) => r.t1));
    // (the showing action on the last word, a canopy going up on "canopy", may settle just after the sentence: up to 0.4 s)
    // and never after the camera has set off for the next sentence's shot (a frame mid-move loses what this one framed)
    const moveOff = Math.min(Infinity, ...(tl.director?.frames ?? []).filter((f) => f.t >= next - 0.05).map((f) => f.t - MOVE.lead - 0.05));
    const lim = Math.min(own.length ? next + 0.4 : next - 0.15, moveOff);
    const t = Math.min(lim, Math.max(s.t0 + 1.0, ...ends.map((e) => Math.min(e + 0.2, lim))));
    // congrats is judged before the end card pops (the finished build must be in view, not the sign)
    const tt = s.role === "congrats" && tl.marks?.signPop ? Math.min(t, tl.marks.signPop - 0.2) : t;
    out.push({ role: s.role, text: s.text, t: +Math.max(s.t0 + 0.3, tt).toFixed(2), ...(mustFor(s.role, shows) ? { must: mustFor(s.role, shows) } : {}) });
  });
  return out;
}
/**
 * What a sentence's frame must show, by kind of sentence (the creator's videos, studied 2026-10-24): the mechanism and
 * the hook show their action; the myth lines only need the named thing clearly in view (a small cue is enough); the
 * "Add ..." line shows each added thing in place; congrats shows the whole finished build, nothing covering it.
 */
export function mustFor(role, shows) {
  if (role === "congrats") return "the whole finished build, fully in view, nothing covering it (visible, no action needed)";
  if (role === "finish") return `each thing this sentence adds, in place on the finished build and standing on something${shows ? ` (${shows.p})` : ""}`;
  if (!shows) return null;
  if (["myth", "mythFact"].includes(role)) return `${shows.p} clearly in view (visible, no action needed; a small cue is enough)`;
  return `${shows.p}: ${shows.does}`;
}
// the beats that explain the mechanism: they must pass the preview check (a repair, then a second small one)
export const MECHANISM = ["name", "how", "fix1", "fix2", "fix3"];

const VISION_SCHEMA = { type: "object", additionalProperties: false, required: ["frames"], properties: { frames: { type: "array", items: { type: "object", additionalProperties: false, required: ["role", "ok", "seen", "problem"], properties: { role: { type: "string" }, ok: { type: "boolean" }, seen: { type: "string" }, problem: { type: "string" } } } } } };
const VISION_SYSTEM = `When a frame's line says "visible, no action needed", ok is true if that thing is clearly in view and readable at phone size; it need not be doing anything. When a frame says what it must clearly show, ok is true only if that thing is on screen, readable at phone size and visibly DOING it in this frame (water flowing along its path, sludge moving through the pipe, sand lying on the tank floor, a dark oil layer on top, the part built where the sentence says). Arrows alone never count as the action. Nothing may float in the air. You check preview frames of a 3D cutaway explainer video (a lawn and a house with the ground cut open in section; the viewer sees the ground's cut face). Each frame is the moment after one sentence of the narration. For each frame, say what you see and whether it SHOWS what its sentence says: the named thing is visible and readable at phone size, it is in the scene where the sentence puts it, and nothing is broken (floating parts, parts inside the house, a part cut off by the frame edge, a black or empty frame, the camera inside geometry). Captions and number cards are added later, so their absence is fine. Be strict about the named part and lenient about style. ok = true when the frame shows the sentence well enough for a viewer; problem = "" when ok, otherwise one short sentence saying what is wrong and what to change.`;

/** 2b. the vision check (paid: about $0.01 per frame at 540x960) */
export async function visionCheck({ apiKey, frames, log, model }) {
  const frames0 = frames;
  const content = [];
  for (const f of frames) {
    content.push({ type: "text", text: `Frame ${f.role} at ${f.t} s. Sentence: "${f.text}"${f.must ? `\nIt must clearly show: ${f.must}` : ""}` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") } });
  }
  content.push({ type: "text", text: "Check every frame, in order." });
  const r = await callJSON({ apiKey, model, system: VISION_SYSTEM, user: content, schema: VISION_SCHEMA, effort: "medium", maxTokens: 16000, label: "vision check", log });
  // the verdicts belong to the frames in the order they were sent (the model sometimes writes a part name as the role)
  const judged = (r.data.frames ?? []).map((f, i) => (frames0[i] ? { ...f, role: frames0[i].role, t: frames0[i].t } : f));
  return { ...r.data, frames: judged, costUsd: r.costUsd };
}

/** small jpgs of the preview pngs, for the vision check */
export function shrink(ff, pngs, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  return pngs.map((p) => { const o = path.join(outDir, path.basename(p).replace(/\.png$/, ".jpg")); execFileSync(ff, ["-v", "error", "-y", "-i", p, "-vf", "scale=540:960", "-q:v", "4", o]); return o; });
}

/** 3. measured checks on the full render: one continuous shot, saturation, a contact sheet */
export function renderChecks({ ff, video, out, every = 1 }) {
  fs.mkdirSync(out, { recursive: true });
  // scene changes: ffmpeg's scdet score (0-100) between frames; a cut shows as a spike
  const sc = spawnSync(ff, ["-hide_banner", "-i", video, "-vf", "scale=270:480,scdet=threshold=0", "-an", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
  const scores = [...sc.stderr.matchAll(/lavfi\.scd\.score: ([\d.]+)/g)].map((m) => Number(m[1]));
  const sceneMax = scores.length ? Math.max(...scores) : null;
  // saturation: mean HSV saturation (0-1) of 1 fps frames at 108x192
  const raw = execFileSync(ff, ["-v", "error", "-i", video, "-vf", `fps=1/${every},scale=108:192`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 28 });
  let sum = 0, n = 0;
  for (let i = 0; i < raw.length; i += 3) { const r = raw[i], g = raw[i + 1], b = raw[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b); sum += mx ? (mx - mn) / mx : 0; n++; }
  const saturation = +(sum / n).toFixed(3);
  // the contact sheet: 1 fps
  const frames = path.join(out, "frames"); fs.mkdirSync(frames, { recursive: true });
  execFileSync(ff, ["-v", "error", "-y", "-i", video, "-vf", "fps=1,scale=270:480", path.join(frames, "f_%03d.png")]);
  const files = fs.readdirSync(frames).filter((f) => /^f_\d+\.png$/.test(f)).sort();
  // rename to the stills layout (f_000 = 0 s) for sheet.mjs
  files.forEach((f, i) => fs.renameSync(path.join(frames, f), path.join(frames, `g_${String(i).padStart(3, "0")}.png`)));
  fs.readdirSync(frames).forEach((f) => fs.renameSync(path.join(frames, f), path.join(frames, f.replace(/^g_/, "f_"))));
  fs.writeFileSync(path.join(frames, "times.json"), JSON.stringify(files.map((_, i) => i)));
  const contact = sheet(ff, frames, null, path.join(out, "contact_sheet.jpg"), files.map((_, i) => i), { w: 180, perRow: 8 });
  const problems = [];
  if (saturation < 0.38 || saturation > 0.45) problems.push(`saturation ${saturation} (the house style is 0.38-0.45; the creator is 0.41)`);
  if (sceneMax != null && sceneMax > 10) problems.push(`a scene-change score of ${sceneMax.toFixed(1)} (0-100): looks like a cut, not one continuous shot`);
  return { sceneMax, saturation, contact, problems };
}

/** mean HSV saturation (0-1) of still images, at 108x192 (the render check's measure) */
export function saturationOf(ff, files) {
  let sum = 0, n = 0;
  for (const f of files) {
    const raw = execFileSync(ff, ["-v", "error", "-i", f, "-vf", "scale=108:192", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
    for (let k = 0; k < raw.length; k += 3) { const mx = Math.max(raw[k], raw[k + 1], raw[k + 2]), mn = Math.min(raw[k], raw[k + 1], raw[k + 2]); sum += mx ? (mx - mn) / mx : 0; n++; }
  }
  return +(sum / n).toFixed(3);
}

// the grading saturation for a topic: one step from the measured preview toward the creator's 0.41-0.42
// (measured on the water well: about 0.25 of saturation per unit of grading)
export const SAT = Object.freeze({ base: 1.38, lo: 0.38, hi: 0.45, target: 0.42, slope: 0.25 });
export function gradingFor(measured, current = SAT.base) {
  if (measured >= SAT.lo && measured <= SAT.hi) return null;
  return +Math.min(1.6, Math.max(0.8, current - (measured - SAT.target) / SAT.slope)).toFixed(3);
}
