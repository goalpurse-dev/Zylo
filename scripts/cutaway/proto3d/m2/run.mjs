// M2: a topic, end to end with no hand work:
//   plan (script, facts, scene, solver, repair) -> voice -> timeline checks -> preview frames + vision check (one
//   repair round for failing beats) -> render -> sound -> the video -> measured checks + contact sheet.
//   node m2/run.mjs --topic "a water well" --out DIR --proto PROTO --ff FFMPEG [--length 30] [--reuse french_drain]
//        [--script approved.json (a given script)] [--voice v.mp3 --words w.json (a given voice)] [--planOnly]
//        [--noVision] [--log spend.jsonl]
// Progress goes to stdout as PROGRESS lines; everything (script, facts, layout, trace, checks, files) is saved in DIR.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planTopic, repairLayout } from "./planner.mjs";
import { loadKey } from "./llm.mjs";
import { makeVoice } from "./voice.mjs";
import { makeVideo, preparePage, runProcess } from "./make.mjs";
import { compile } from "./compile.mjs";
import { speechEnd } from "../speechEnd.mjs";
import { gradingFor, previewTimes, renderChecks, saturationOf, shrink, timelineChecks, visionCheck } from "./checks.mjs";
import { sheet } from "./sheet.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const WT = path.resolve(here, "../../../..");
export const VISION_FAILS_OK = 2;
const progress = (o, cb) => { console.log(`PROGRESS ${JSON.stringify(o)}`); cb?.(o); };

// the vision check, cached by the exact frames (and sentences) it is given: a re-run with the same frames is free
async function visionCached({ apiKey, frames, log, cacheDir }) {
  const h = crypto.createHash("sha1"); for (const f of frames) { h.update(f.text); h.update(fs.readFileSync(f.file)); }
  const file = path.join(cacheDir, `vision_${h.digest("hex").slice(0, 16)}.json`);
  if (fs.existsSync(file)) return { ...JSON.parse(fs.readFileSync(file, "utf8")), costUsd: 0 };
  const r = await visionCheck({ apiKey, frames, log });
  fs.mkdirSync(cacheDir, { recursive: true }); fs.writeFileSync(file, JSON.stringify(r, null, 1));
  return r;
}

async function previewStills({ proto, layout, times, out }) {
  await runProcess(process.execPath, [path.join(proto, "m2", "stills.mjs"), `m2_${layout.key}.html`, out, times.join(",")], { cwd: proto });
  return times.map((_, i) => path.join(out, `f_${String(i).padStart(3, "0")}.png`));
}

export async function runTopic({ topic, out, proto, ff, lengthSec = 30, reuse = null, script = null, voice = null, words = null, planOnly = false, vision = true, log, wt = WT, onProgress = null, maxProblems = 0, endCard = true }) {
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now(), apiKey = loadKey(), cacheDir = path.join(out, "steps");
  const save = (f, d) => fs.writeFileSync(path.join(out, f), JSON.stringify(d, null, 1));
  const P = (o) => progress(o, onProgress);
  P({ stage: "script", pct: 1 });
  const plan = await planTopic({ apiKey, topic, lengthSec, reuse, log, script, cacheDir, onStep: (s) => P({ stage: /scene|anchor/.test(s.step) ? "scene" : "script", step: s.step, pct: /scene|anchor/.test(s.step) ? 3 : 2 }) });
  save("script.json", plan.script); save("layout.json", plan.layout); save("trace.json", plan.trace);
  P({ stage: "scene", pct: 4, title: plan.script.title, narration: plan.script.sentences.map((s) => s.text).join(" "), facts: plan.script.facts ?? [], parts: plan.layout.parts.map((p) => p.id) });
  const report = { topic, lengthSec, reuse, planUsd: plan.costUsd, problems: plan.problems, warnings: plan.warnings, planSeconds: (Date.now() - t0) / 1000 };
  save("plan_report.json", report);
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
  if (vision) {
    P({ stage: "scene", step: "preview frames", pct: 6 });
    preparePage({ layout, tl, proto });
    let shots = previewTimes(tl);
    const pngs = await previewStills({ proto, layout, times: shots.map((s) => s.t), out: path.join(out, "preview") });
    const jpgs = shrink(ff, pngs, path.join(out, "preview_small"));
    // the house style saturation (0.38-0.45): a topic that measures outside it gets its grading corrected
    const sat0 = saturationOf(ff, pngs), grade = gradingFor(sat0, layout.world?.sat ?? undefined);
    if (grade) layout = { ...layout, world: { ...layout.world, sat: grade } };
    save("saturation.json", { preview: sat0, grading: grade ?? layout.world?.sat ?? 1.38 });
    shots = shots.map((s, i) => ({ ...s, file: jpgs[i] }));
    P({ stage: "scene", step: "vision check", pct: 7, frames: jpgs.map((f) => path.relative(out, f).split(path.sep).join("/")) });
    const vc = await visionCached({ apiKey, frames: shots, log, cacheDir }); extraUsd += vc.costUsd;
    const failed = vc.frames.filter((f) => !f.ok);
    visionReport = { round1: vc.frames, costUsd: vc.costUsd };
    if (failed.length) {
      P({ stage: "scene", step: "repair", pct: 7 });
      const rp = await repairLayout({ apiKey, topic, script: plan.script, layout, problems: failed.map((f) => `${f.role}: ${f.problem} (seen: ${f.seen})`), log, cacheDir, saved: !!reuse });
      extraUsd += rp.costUsd;
      if (!rp.problems.length) {
        layout = rp.layout; save("layout.json", layout);
        ({ tl, checks } = checkAll());
        preparePage({ layout, tl, proto });
        const again = previewTimes(tl).filter((s) => failed.some((f) => f.role === s.role));
        const pngs2 = await previewStills({ proto, layout, times: again.map((s) => s.t), out: path.join(out, "preview2") });
        const jpgs2 = shrink(ff, pngs2, path.join(out, "preview2_small"));
        const vc2 = await visionCached({ apiKey, frames: again.map((s, i) => ({ ...s, file: jpgs2[i] })), log, cacheDir }); extraUsd += vc2.costUsd;
        visionReport.round2 = vc2.frames; visionReport.costUsd += vc2.costUsd;
      } else visionReport.repairProblems = rp.problems;
    }
    const still = (visionReport.round2 ?? []).filter((f) => !f.ok).concat(visionReport.round2 ? [] : failed);
    visionReport.failing = still.map((f) => f.role);
    save("vision.json", visionReport);
    // the gate, calibrated on the approved videos (they fail 2-3 of 12-13 frames of this check): after the repair round
    // the video goes on with at most VISION_FAILS_OK failing beats, and never with a failing hero (name) beat
    const blocking = still.length > VISION_FAILS_OK || still.some((f) => f.role === "name");
    visionReport.passedGate = !blocking;
    save("vision.json", visionReport);
    if (!blocking) fs.writeFileSync(accepted, JSON.stringify(layout, null, 1));
    if (blocking) { P({ stage: "failed", reason: "preview", problems: still.map((f) => `${f.role}: ${f.problem}`) }); return { ...report, ok: false, vision: visionReport, timelineChecks: checks, voiceUsd: vUsd, totalUsd: +(plan.costUsd + vUsd + extraUsd).toFixed(4) }; }
  }
  // the full render, the sound, the checks on the result
  const made = await makeVideo({ layout, voice, words, out, proto, ff, roles, wt, onProgress, noend: endCard === false });
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
  const r = await runTopic({ topic: a.topic, out: a.out, proto: a.proto, ff: a.ff, lengthSec: Number(a.length ?? 30), reuse: a.reuse ?? null, script: a.script ? read(a.script) : null, voice: a.voice ?? null, words: a.words ? read(a.words) : null, planOnly: !!a.planOnly, vision: !a.noVision, log: a.log });
  console.log(JSON.stringify({ ok: r.ok, planUsd: r.planUsd, totalUsd: r.totalUsd, problems: r.problems, warnings: r.warnings, seconds: r.seconds, file: r.files?.end, measured: r.measured && { saturation: r.measured.saturation, sceneMax: r.measured.sceneMax } }, null, 1));
}
