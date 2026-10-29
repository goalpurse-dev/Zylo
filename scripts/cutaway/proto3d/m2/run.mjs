// M2: a topic, end to end with no hand work:
//   plan (script, facts, scene, solver, repair) -> voice -> timeline checks -> preview frames + vision check (one
//   repair round for failing beats) -> render -> sound -> the video -> measured checks + contact sheet.
//   node m2/run.mjs --topic "a water well" --out DIR --proto PROTO --ff FFMPEG [--length 30] [--reuse french_drain]
//        [--script approved.json (a given script)] [--voice v.mp3 --words w.json (a given voice)] [--planOnly]
//        [--noVision] [--log spend.jsonl] [--resume (the plan saved in DIR)] [--maxUsd 1 (no repair past it)]
// Progress goes to stdout as PROGRESS lines; everything (script, facts, layout, trace, checks, files) is saved in DIR.
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planTopic, repairLayout, openingOf, rewordBeats, missingWords, dropWords } from "./planner.mjs";
import { loadKey } from "./llm.mjs";
import { makeVoice } from "./voice.mjs";
import { makeVideo, preparePage, runProcess } from "./make.mjs";
import { compile } from "./compile.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { gradingFor, MECHANISM, previewTimes, renderChecks, saturationOf, shrink, timelineChecks, visionCheck } from "./checks.mjs";
import { sheet } from "./sheet.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(here, "../../../..");
export const VISION_FAILS_OK = 2;
// how each video opened, newest last (the planner opens the next one differently)
export const OPENINGS = path.join(here, "layouts", "openings.jsonl");
const lastOpeningIn = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8").trim().split("\n").at(-1)); } catch { return null; } };
const progress = (o, cb) => { console.log(`PROGRESS ${JSON.stringify(o)}`); cb?.(o); };

// the vision check, cached by the exact frames (and sentences) it is given: a re-run with the same frames is free
async function visionCached({ apiKey, frames, log, cacheDir, multi = true }) {
  const h = crypto.createHash("sha1"); h.update(multi ? "multi" : "one"); for (const f of frames) { h.update(f.text); h.update(fs.readFileSync(f.file)); }
  const file = path.join(cacheDir, `vision_${h.digest("hex").slice(0, 16)}.json`);
  if (fs.existsSync(file)) return { ...JSON.parse(fs.readFileSync(file, "utf8")), costUsd: 0 };
  const r = await visionCheck({ apiKey, frames, log, multi });
  fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1));
  return r;
}

// each sentence's frames (start, middle, end of its action) side by side in one small jpg: what the checker sees
async function previewStrips({ proto, layout, shots, out, ff, wt = WT }) {
  const all = shots.flatMap((s) => s.ts ?? [s.t]);
  const pngs = await previewStills({ proto, layout, times: all, out });
  let k = 0;
  return shots.map((s, i) => {
    const n = (s.ts ?? [s.t]).length, mine = pngs.slice(k, k + n); k += n;
    const file = path.join(out, `strip_${String(i).padStart(2, "0")}.jpg`);
    const ins = mine.flatMap((p) => ["-i", p]);
    // the red state label is a caption in the final video, not in the canvas: drawn here so the checker sees what viewers see
    const lab = (j) => (s.label?.[j] ? `${stateText(s.label[j])},` : "");
    execFileSync(ff, ["-v", "error", "-y", ...ins, "-filter_complex", n > 1 ? `${mine.map((_, j) => `[${j}]${lab(j)}scale=270:-1[f${j}]`).join(";")};${mine.map((_, j) => `[f${j}]`).join("")}hstack=inputs=${n}` : `[0]${lab(0)}scale=360:-1`, "-q:v", "4", file], { cwd: fontHere(out, wt) });
    return { ...s, file, end: mine.at(-1) };
  });
}

// the caption font copied next to the frames (drawtext reads it by a plain relative name: no drive-letter escaping)
function fontHere(out, wt) {
  const f = path.join(wt, "supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
  if (fs.existsSync(f) && !fs.existsSync(path.join(out, "font.ttf"))) fs.copyFileSync(f, path.join(out, "font.ttf"));
  return out;
}
export function stateText(t) {
  const x = String(t).toUpperCase().replace(/[^A-Z0-9 !?-]/g, "");
  return `drawtext=fontfile=font.ttf:text='${x}':fontsize=h*0.075:fontcolor=0xFF3B30:borderw=6:bordercolor=white:x=(w-text_w)/2:y=h*0.2-text_h/2`;
}

async function previewStills({ proto, layout, times, out }) {
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, out, times.join(",")], { cwd: proto });
  return times.map((_, i) => path.join(out, `f_${String(i).padStart(3, "0")}.png`));
}

export async function runTopic({ library = [], topic, out, proto, ff, lengthSec = 30, reuse = null, script = null, voice = null, words = null, planOnly = false, vision = true, log, wt = WT, onProgress = null, maxProblems = 0, endCard = true, openings = OPENINGS, resume = false, maxUsd = Infinity, onReady = null, render = true, only = null }) {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now(), apiKey = loadKey(), cacheDir = path.join(out, "steps");
  const save = (f, d) => fs.writeFileSync(path.join(out, f), JSON.stringify(d, null, 1));
  const P = (o) => progress(o, onProgress);
  P({ stage: "script", pct: 1 });
  // resume: the plan already made (and paid for) in this folder, as saved (its layout may have had free fixes since)
  const read0 = (f) => JSON.parse(fs.readFileSync(path.join(out, f), "utf8"));
  const plan = resume
    ? { script: read0("script.json"), layout: read0("layout.json"), trace: read0("trace.json"), costUsd: read0("plan_report.json").planUsd ?? 0, problems: [], warnings: [], resumed: true }
    : await planTopic({ apiKey, topic, lengthSec, reuse, log, script, cacheDir, library, lastOpening: reuse ? null : lastOpeningIn(openings), onStep: (s) => P({ stage: /scene|anchor/.test(s.step) ? "scene" : "script", step: s.step, pct: /scene|anchor/.test(s.step) ? 3 : 2 }) });
  save("script.json", plan.script); save("layout.json", plan.layout); save("trace.json", plan.trace);
  P({ stage: "scene", pct: 4, title: plan.script.title, narration: plan.script.sentences.map((s) => s.text).join(" "), facts: plan.script.facts ?? [], parts: plan.layout.parts.map((p) => p.id) });
  const report = { topic, lengthSec, reuse, planUsd: plan.costUsd, problems: plan.problems, warnings: plan.warnings, planSeconds: (Date.now() - t0) / 1000 };
  save("plan_report.json", report);
  if (!reuse && !plan.resumed && !plan.problems.length && openings) fs.appendFileSync(openings, JSON.stringify({ topic, at: new Date().toISOString(), ...openingOf(plan.layout) }) + "\n");
  if (plan.problems.length > maxProblems) { P({ stage: "failed", reason: "plan", problems: plan.problems }); return { ...report, ok: false }; }
  if (planOnly) return { ...report, ok: true };

  // the voice (one paid take, re-timed by silence)
  P({ stage: "scene", step: "voice", pct: 5 });
  let vUsd = 0;
  if (!voice) {
    const v = await makeVoice({ text: plan.script.sentences.map((s) => s.text.trim()).join(" "), out: path.join(out, "voice"), ff, wt, log });
    voice = v.voice; words = v.words; vUsd = v.usd;
  }
  const roles = plan.script.sentences.map((s) => s.role);
  // a layout that already passed the preview check in this folder (after its repair) is the one to re-render
  const accepted = path.join(cacheDir, "accepted_layout.json");
  let layout = fs.existsSync(accepted) ? JSON.parse(fs.readFileSync(accepted, "utf8")) : plan.layout, extraUsd = 0;
  // the timeline checks (free), then the preview frames and the vision check (one repair round)
  const checkAll = () => { const tl = compile(layout, words, speechEnd(ff, voice), { roles }); return { tl, checks: timelineChecks(layout, tl) }; };
  let { tl, checks } = checkAll();
  save("timeline_checks.json", checks);
  let visionReport = null;
  if (!vision) {
    // no vision check (a re-render of a checked layout, or no Claude credit): the preview stills still set the grading
    preparePage({ layout, tl, proto });
    const pngs = await previewStills({ proto, layout, times: previewTimes(tl, layout).map((s) => s.t), out: path.join(out, "preview") });
    const sat0 = saturationOf(ff, pngs), grade = gradingFor(sat0, layout.world?.sat ?? undefined);
    if (grade) layout = { ...layout, world: { ...layout.world, sat: grade } };
    save("saturation.json", { preview: sat0, grading: grade ?? layout.world?.sat ?? 1.38, vision: "off" });
  }
  if (vision) {
    P({ stage: "scene", step: "preview frames", pct: 6 });
    preparePage({ layout, tl, proto });
    let shots = previewTimes(tl, layout);
    // an approved saved layout was checked when it was approved: only the sentences whose words moved get a new look
    // (none moved: no vision call at all), and no repair (the layout itself is unchanged)
    const approvedSaved = !!reuse && plan.approved;
    if (approvedSaved) shots = shots.filter((s) => (plan.changedRoles ?? []).includes(s.role));
    // premade keeps the one-frame check its approved scenes passed (the owner's decision of 2026-10-28); custom gets strips
    const multi = !reuse, one = (xs) => (multi ? xs : xs.map(({ ts, ...s }) => s));
    shots = one(shots);
    const allTimes = previewTimes(tl, layout);
    const pngsAll = await previewStills({ proto, layout, times: allTimes.map((s) => s.t), out: path.join(out, "preview") });
    // the checked sentences as strips: the start, middle and end of each one's action
    shots = shots.length ? await previewStrips({ proto, layout, shots, out: path.join(out, "preview_strips"), ff, wt }) : [];
    const jpgs = shots.map((s) => s.file);
    // the house style saturation (0.38-0.45): a topic that measures outside it gets its grading corrected
    const sat0 = saturationOf(ff, pngsAll), grade = gradingFor(sat0, layout.world?.sat ?? undefined);
    if (grade) layout = { ...layout, world: { ...layout.world, sat: grade } };
    save("saturation.json", { preview: sat0, grading: grade ?? layout.world?.sat ?? 1.38 });
    P({ stage: "scene", step: "vision check", pct: 7, frames: jpgs.map((f) => path.relative(out, f).split(path.sep).join("/")) });
    const vc = shots.length ? await visionCached({ apiKey, frames: shots, log, cacheDir, multi }) : { frames: [], costUsd: 0 }; extraUsd += vc.costUsd;
    const failed = vc.frames.filter((f) => !f.ok);
    visionReport = { round1: vc.frames, costUsd: vc.costUsd };
    // a repair round on the failing beats, then their frames looked at again (round: 2, 3)
    let still = failed;
    const repairRound = async (round, beats) => {
      // a spending cap: no repair round that could take the video past it (a repair and its look cost about $0.2)
      if (plan.costUsd + vUsd + extraUsd + 0.2 > maxUsd) { visionReport[`skipped${round}`] = `over the $${maxUsd} cap`; return false; }
      P({ stage: "scene", step: round === 2 ? "repair" : "second repair", pct: 7 });
      const rp = await repairLayout({ apiKey, topic, script: plan.script, layout, problems: beats.map((f) => `${f.role}: ${f.problem} (seen: ${f.seen})`), log, cacheDir, saved: !!reuse });
      extraUsd += rp.costUsd;
      if (rp.problems.length) { visionReport[`repairProblems${round}`] = rp.problems; return false; }
      layout = rp.layout; save("layout.json", layout);
      ({ tl, checks } = checkAll());
      preparePage({ layout, tl, proto });
      const again = one(previewTimes(tl, layout)).filter((s) => beats.some((f) => f.role === s.role));
      const strips2 = await previewStrips({ proto, layout, shots: again, out: path.join(out, `preview${round}`), ff, wt });
      const vc2 = await visionCached({ apiKey, frames: strips2, log, cacheDir, multi }); extraUsd += vc2.costUsd;
      visionReport[`round${round}`] = vc2.frames; visionReport.costUsd += vc2.costUsd;
      still = still.filter((f) => !beats.some((b) => b.role === f.role)).concat(vc2.frames.filter((f) => !f.ok));
      return true;
    };
    // the two-way repair (the owner's rule of 2026-10-27): a flagged sentence can be rewritten to say what its frame
    // shows (the words), or the frame changed (the picture), whichever is cheaper and surer: the words first, then the
    // picture for what still fails and for frames that are broken. A new voice take follows changed words (the whole
    // narration: a take spliced from pieces would be heard, and a take costs about $0.025).
    const revoice = async (round) => {
      const v = await makeVoice({ text: plan.script.sentences.map((s) => s.text.trim()).join(" "), out: path.join(out, `voice_r${round}`), ff, wt, log });
      voice = v.voice; words = v.words; vUsd += v.usd;
      save("script.json", plan.script);
    };
    const wordsRound = async (round, beats) => {
      if (plan.costUsd + vUsd + extraUsd + 0.08 > maxUsd) { visionReport[`skipped${round}`] = `over the $${maxUsd} cap`; return; }
      P({ stage: "scene", step: "repair", pct: 7 });
      const rw = await rewordBeats({ apiKey, topic, script: plan.script, layout, failing: beats, log, cacheDir });
      extraUsd += rw.costUsd; visionReport[`words${round}`] = { changed: rw.changed, problems: rw.problems };
      if (!rw.changed.length) return;
      plan.script = rw.script;
      // a cue word the new sentence no longer says: its actions start with the sentence
      const miss = missingWords(layout, plan.script.sentences); if (miss.length) layout = dropWords(layout, miss);
      P({ stage: "scene", step: "voice", pct: 7 });
      await revoice(round);
      ({ tl, checks } = checkAll());
      preparePage({ layout, tl, proto });
      const again = one(previewTimes(tl, layout)).filter((s) => rw.changed.includes(s.role));
      const strips2 = await previewStrips({ proto, layout, shots: again, out: path.join(out, `preview${round}`), ff, wt });
      const vc2 = await visionCached({ apiKey, frames: strips2, log, cacheDir, multi }); extraUsd += vc2.costUsd;
      visionReport[`round${round}`] = vc2.frames; visionReport.costUsd += vc2.costUsd;
      still = still.filter((f) => !rw.changed.includes(f.role)).concat(vc2.frames.filter((f) => !f.ok));
    };
    const broken = (f) => /\bfloat|black|empty frame|blank|inside (the )?(house|geometry|wall)|cut off|clipped|camera (is )?(in|inside)|nothing (is )?(visible|on screen)/i.test(`${f.problem} ${f.seen}`);
    if (approvedSaved && failed.length) {
      // a premade topic: each flagged sentence goes back to its approved wording, which the approved picture shows
      const A = plan.approvedScript, back = failed.map((f) => f.role).filter((r) => A?.sentences.some((s) => s.role === r));
      if (back.length) {
        plan.script = { ...plan.script, sentences: plan.script.sentences.map((s) => (back.includes(s.role) ? { ...A.sentences.find((a) => a.role === s.role) } : s)) };
        P({ stage: "scene", step: "voice", pct: 7 });
        await revoice(2);
        ({ tl, checks } = checkAll());
        visionReport.reverted = back;
        still = still.filter((f) => !back.includes(f.role));
      }
    } else if (failed.length && !failed.every((f) => f.role === "hook")) {
      // only the hook flagged: no repair (the approved videos' hooks are flagged as well)
      const byWords = failed.filter((f) => !broken(f));
      if (byWords.length) await wordsRound(2, byWords);
      // the picture for what would still block the gate, or a broken frame
      if (still.length && (still.length > VISION_FAILS_OK || still.some((f) => MECHANISM.includes(f.role) || broken(f)))) {
        const ok = await repairRound(3, still);
        // a mechanism beat still failing gets a second, small picture repair of just those beats
        // (any beat still failing, not only a mechanism beat: the free aquarium and ice rink runs stopped with a failing
        // beat whose second repair never ran; the owner's round of 2026-10-28)
        if (ok && still.length) await repairRound(4, still);
      }
    }
    visionReport.failing = still.map((f) => f.role);
    save("vision.json", visionReport);
    // the gate, calibrated on the approved videos (they fail 2-3 of 12-13 frames of this check): after the repair rounds
    // the video goes on with at most VISION_FAILS_OK failing beats, and never with a failing mechanism beat
    const blocking = still.length > VISION_FAILS_OK || still.some((f) => MECHANISM.includes(f.role));
    visionReport.passedGate = !blocking;
    save("vision.json", visionReport);
    if (!blocking) fs.writeFileSync(accepted, JSON.stringify(layout, null, 1));
    if (blocking) { P({ stage: "failed", reason: "preview", problems: still.map((f) => `${f.role}: ${f.problem}`) }); return { ...report, ok: false, vision: visionReport, timelineChecks: checks, voiceUsd: vUsd, totalUsd: +(plan.costUsd + vUsd + extraUsd).toFixed(4) }; }
  }
  // the plan is ready (it passed the gate): the production worker uploads it here, so a retry or the CPU fallback renders
  // it without paying for it again; render: false stops here (the fallback's plan machine)
  const ready = { layout, voice, words, roles, script: plan.script, costs: { planUsd: plan.costUsd, voiceUsd: vUsd, checksUsd: +extraUsd.toFixed(4) } };
  if (onReady) await onReady(ready);
  if (render === false) { save("plan_ready.json", { ...report, ok: true, voiceUsd: vUsd, checksUsd: +extraUsd.toFixed(4), totalUsd: +(plan.costUsd + vUsd + extraUsd).toFixed(4) }); return { ...report, ok: true, ready, voiceUsd: vUsd, checksUsd: +extraUsd.toFixed(4), totalUsd: +(plan.costUsd + vUsd + extraUsd).toFixed(4) }; }
  // the full render, the sound, the checks on the result
  const made = await makeVideo({ layout, voice, words, out, proto, ff, roles, wt, onProgress, noend: endCard === false, only });
  P({ stage: "render", step: "checks", pct: 98 });
  const measured = renderChecks({ ff, video: made.files.end, out: path.join(out, "checks") });
  const final = { ...report, ok: true, voiceUsd: vUsd, checksUsd: +extraUsd.toFixed(4), totalUsd: +(plan.costUsd + vUsd + extraUsd).toFixed(4), timelineChecks: checks, vision: visionReport, measured, timing: made.timing, files: made.files, director: made.director, seconds: (Date.now() - t0) / 1000 };
  save("run_report.json", final);
  P({ stage: "done", pct: 100, file: made.files.end });
  return final;
}

if (/run\.mjs$/.test(process.argv[1] ?? "")) {
  const argv = process.argv.slice(2), a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) { const k = argv[i].slice(2); a[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
  const read = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
  const r = await runTopic({ topic: a.topic, out: a.out, proto: a.proto, ff: a.ff, lengthSec: Number(a.length ?? 30), reuse: a.reuse ?? null, script: a.script ? read(a.script) : null, voice: a.voice ?? null, words: a.words ? read(a.words) : null, planOnly: !!a.planOnly, vision: !a.noVision, log: a.log, resume: !!a.resume, maxUsd: a.maxUsd ? Number(a.maxUsd) : Infinity });
  console.log(JSON.stringify({ ok: r.ok, planUsd: r.planUsd, totalUsd: r.totalUsd, problems: r.problems, warnings: r.warnings, seconds: r.seconds, file: r.files?.end, measured: r.measured && { saturation: r.measured.saturation, sceneMax: r.measured.sceneMax } }, null, 1));
}
