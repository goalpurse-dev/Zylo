// M2: the quality checks (M2_PLAN.md section 5), in order:
//  1. timelineChecks: free code checks on the compiled timeline, before anything renders;
//  2. previewTimes + visionCheck: one still per beat at its key moment, checked by Claude against its sentence;
//  3. renderChecks: measured on the full render (one continuous shot, saturation, loudness), plus a 1 fps contact sheet.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { channelValue } from "./curves.js";
import { cameraAt } from "./director.js";
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
  for (const f of hero) if (f.rect.w < 0.15) problems.push(`the shot at ${f.t.toFixed(1)} s frames ${f.ids} at ${(f.rect.w * 100).toFixed(0)}% of the width (at least 15%)`);
  // beats at least 2.5 s long
  for (const s of tl.sentences) if (s.t1 - s.t0 < 1.0) warnings.push(`sentence ${s.role} lasts only ${(s.t1 - s.t0).toFixed(1)} s`);
  return { problems, warnings, stats: { fastMoves: fast, movesPer10s: +per10.toFixed(1), longestGap: +worst.gap.toFixed(2) } };
}

/** 2a. one preview time per sentence: when its last action has finished (capped before the next sentence) */
export function previewTimes(tl) {
  const out = [];
  tl.sentences.forEach((s, i) => {
    const next = tl.sentences[i + 1]?.t0 ?? tl.marks.lengthEnd;
    const ends = Object.values(tl.tracks).flatMap((tr) => tr.ramps.filter((r) => r.t0 >= s.t0 - 0.5 && r.t0 < next - 0.3).map((r) => r.t1));
    const t = Math.min(next - 0.15, Math.max(s.t0 + 1.0, ...ends.map((e) => Math.min(e + 0.1, next - 0.15))));
    out.push({ role: s.role, text: s.text, t: +Math.max(s.t0 + 0.3, t).toFixed(2) });
  });
  return out;
}

const VISION_SCHEMA = { type: "object", additionalProperties: false, required: ["frames"], properties: { frames: { type: "array", items: { type: "object", additionalProperties: false, required: ["role", "ok", "seen", "problem"], properties: { role: { type: "string" }, ok: { type: "boolean" }, seen: { type: "string" }, problem: { type: "string" } } } } } };
const VISION_SYSTEM = `You check preview frames of a 3D cutaway explainer video (a lawn and a house with the ground cut open in section; the viewer sees the ground's cut face). Each frame is the moment after one sentence of the narration. For each frame, say what you see and whether it SHOWS what its sentence says: the named thing is visible and readable at phone size, it is in the scene where the sentence puts it, and nothing is broken (floating parts, parts inside the house, a part cut off by the frame edge, a black or empty frame, the camera inside geometry). Captions and number cards are added later, so their absence is fine. Be strict about the named part and lenient about style. ok = true when the frame shows the sentence well enough for a viewer; problem = "" when ok, otherwise one short sentence saying what is wrong and what to change.`;

/** 2b. the vision check (paid: about $0.01 per frame at 540x960) */
export async function visionCheck({ apiKey, frames, log, model }) {
  const content = [];
  for (const f of frames) {
    content.push({ type: "text", text: `Frame ${f.role} at ${f.t} s. Sentence: "${f.text}"` });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: fs.readFileSync(f.file).toString("base64") } });
  }
  content.push({ type: "text", text: "Check every frame, in order." });
  const r = await callJSON({ apiKey, model, system: VISION_SYSTEM, user: content, schema: VISION_SCHEMA, effort: "medium", maxTokens: 16000, label: "vision check", log });
  return { ...r.data, costUsd: r.costUsd };
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
  if (sceneMax != null && sceneMax > 10) problems.push(`a scene-change score of ${sceneMax.toFixed(1)} (0-100): looks like a cut, not one continuous shot`);
  return { sceneMax, saturation, contact, problems };
}
