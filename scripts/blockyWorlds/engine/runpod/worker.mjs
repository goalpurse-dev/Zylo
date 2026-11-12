// Blocky Worlds RunPod worker (docs/blocky-worlds-pipeline.md). One job, then RESULT {...} on stdout (handler.py returns it).
//
// PRODUCTION ({ job: {...} } from blocky-worlds-render; signed URLs and a callback token only, never a storage key):
//   role "prepare": the story director (lib/director directStory: mock by default, free; "anthropic" with the job's
//                   director.provider + ANTHROPIC_KEY) IN PARALLEL with the voice (ElevenLabs, ELEVENLABS_KEY from the
//                   RunPod secret; or the run's earlier take, never bought twice); as soon as the director answers, its
//                   STORY-CRITICAL items (lib/critical.js) are resolved kit -> library -> builder FIRST (2026-11-08) ->
//                   trim + word timings -> planVideo ({ direction }: the production list is the planner's source of
//                   truth; + { built, library, criticalMode "reject" }: an item still unbuilt fails the run,
//                   CRITICAL_UNBUILT, no retry, refunded) -> the other needs built (buildFor) -> checkTimeline +
//                   checkVisuals + checkSubjects + checkProduction (ANY miss stops here: nothing is rendered, the run is
//                   refunded; never skipped) -> timeline.json (+ production.json) up -> "planned" (with the capability
//                   gaps: the worker has no Supabase key, the edge function logs them) -> music A + SFX cues + the mix
//                   -> mix.m4a up. No GPU needed.
//                   The server sets job.prepare.director { provider, model? } and job.prepare.builder { provider,
//                   library (snapshot), budget: { maxUsd } } from its secrets (render.js prepareProduction); a builder
//                   asset goes back as a "built" event, the spend in "planned" and in the job's end (spend).
//   role "chunk":   GPU check (NO_GPU -> handler.py retires this worker) -> frames [from, to) -> seg (1080p, squeezed
//                   under the upload limit) + web (720p) up, progress events as it goes.
//   role "finish":  the segments joined by stream copy + the mix -> final.mp4; the same for web.mp4; poster.jpg. No GPU.
//   role "stills" / "objectStills" (2026-11-08, runpod/stillsRole.mjs): timeline stills in one page load / the builder's
//                   object stills, through the frame guards; JPEGs to signed URLs or inline. Sent by dev/runpodStills.mjs
//                   and runpod/stillRendererRunpod.mjs (no callback: the laptop polls RunPod).
//   Events go to job.callback.url ({ runId, jobId, token, event, ... }); a callback that can't be reached never fails
//   the job (RunPod's webhook and the sweeper cover it).
//   STALE WORKER (2026-11-06; run 7b4c0d8b's prepare ran on a worker of the image before, still alive after the
//   endpoint switch: mock director, $0.26 of builder for nothing, mix crash): job.minBuild (the server's
//   _shared/blockyWorlds/renderBuild.js, written by runpod/setup.mjs) vs this image's BUILD_ID (buildContext.mjs):
//   older -> RESULT { ok: false, code: "STALE_WORKER" } before anything is downloaded or paid for; handler.py retires
//   the worker, the server retries elsewhere (render.js retryOf, not counted as a failed try).
//
// STAGING (inline or { jobUrl }; runpod/dispatch.mjs): { mode, timelineUrl, pages, ranges: [{ from, to, upload }],
//   whole: { mixUrl, upload } | null, uploads: { report } } as before.
//
// mode: "gpu" (RunPod), "cpu" (SwiftShader, tests), "local" (this laptop's GPU, the dry run).
//   node runpod/worker.mjs '{"job": {...}}'  |  node runpod/worker.mjs '{"jobUrl": "https://..."}'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { useGpu, useSoftware } from "./gpu.mjs";
import { concat, renderParallel } from "../render.mjs";
import { stillsJob, objectStillsJob } from "./stillsRole.mjs";
import { simpleStillsJob } from "./simpleRole.mjs"; // 2026-11-10 simple-style TEST page (page/simple/), stills only
import { applyStoryboard, storyboardChecks } from "../lib/storyboard.js"; // STORYBOARD (2026-11-11): job.prepare.storyboard
import { paramsFromPrompts, writePromptsByScene, enrichPrompts, checkPrompts } from "../lib/shotPrompts.js";
import { directStoryboard } from "../lib/storyboardDirector.js"; // the automatic storyboard (job.prepare.storyboard.auto)

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FF = process.env.FFMPEG ?? "ffmpeg";
const MAX_UPLOAD = 48 * 1024 * 1024;
const coded = (code, message) => Object.assign(new Error(message), { code });

// ---------------------------------------------------------------- files by URL (https signed URLs, or file:// for tests)
export async function get(url, file) {
  if (!url) throw coded("BAD_JOB", `no URL for ${file ? path.basename(file) : "a download"}`);
  const b = url.startsWith("file://") ? fs.readFileSync(fileURLToPath(url)) : await fetch(url, { signal: AbortSignal.timeout(120000) }).then(async (r) => { if (!r.ok) throw new Error(`download ${r.status} ${url.split("?")[0]}`); return Buffer.from(await r.arrayBuffer()); });
  if (file) fs.writeFileSync(file, b); return b;
}
export async function put(url, file, type) {
  if (!url) throw coded("BAD_JOB", `no upload URL for ${path.basename(file)}`);
  if (url.startsWith("file://")) { const dst = fileURLToPath(url); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(file, dst); return; }
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { method: "PUT", headers: { "Content-Type": type, "x-upsert": "true" }, body: fs.readFileSync(file), signal: AbortSignal.timeout(180000) });
      if (r.ok) return;
      const t = (await r.text()).slice(0, 200);
      if (r.status < 500 || i >= 3) throw coded("UPLOAD_FAILED", `upload ${path.basename(file)} ${r.status} ${t}`);
    } catch (e) { if (e.code === "UPLOAD_FAILED" || i >= 3) throw coded("UPLOAD_FAILED", e.message); }
    await new Promise((s) => setTimeout(s, 1500 * i));
  }
}
const ffmpeg = (args) => { const p = spawnSync(FF, ["-v", "error", "-y", ...args], { encoding: "utf8", maxBuffer: 1 << 26 }); if (p.status !== 0) throw new Error(`ffmpeg failed: ${(p.stderr || "").slice(-500)}`); };
const probeDuration = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

/** the callback: { runId, jobId, token, attempt, event, ...data }; 3 tries, never throws */
export function poster(job) {
  return async (event, data = {}) => {
    if (!job.callback?.url) { console.log(`EVENT ${event} ${JSON.stringify(data).slice(0, 300)}`); return; }
    const body = JSON.stringify({ runId: job.runId, jobId: job.jobId, token: job.callback.token, attempt: job.attempt ?? 1, event, ...data });
    for (let i = 1; i <= 3; i++) {
      try { const r = await fetch(job.callback.url, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(15000) }); await r.body?.cancel(); if (r.ok || r.status < 500) return; } catch { /* try again */ }
      await new Promise((s) => setTimeout(s, 1000 * i));
    }
  };
}

// ---------------------------------------------------------------- the pre-render checks (THE RULE)
/**
 * checkTimeline + checkVisuals + checkSubjects on a planned timeline. A planner without any of the three is a failure,
 * never a skip. -> { passed, timeline, missing, subjects }; the caller stops before any render when !passed.
 */
export function preRenderChecks(plan, tl, script, kit) {
  // checkProduction is required whenever the plan was made from a production list (tl.production)
  for (const f of ["checkTimeline", "checkVisuals", "checkSubjects", ...(tl?.production ? ["checkProduction"] : [])]) if (typeof plan?.[f] !== "function") throw coded("PLAN_FAILED", `plan.mjs has no ${f}(): the pre-render checks can't run, so nothing is rendered`);
  const timeline = plan.checkTimeline(tl) ?? [], missing = plan.checkVisuals(tl, script) ?? [], subjects = plan.checkSubjects(tl) ?? [];
  const production = tl?.production ? plan.checkProduction(tl) ?? [] : [];
  const kitMissing = kitProblems(tl, kit);
  return { passed: !timeline.length && !missing.length && !subjects.length && !production.length && !kitMissing.length, timeline, missing, subjects, production, kit: kitMissing };
}
/**
 * Every object the plan puts on screen must be one the engine's kit can build (page/kit/objects.js resolveObject +
 * its states): the engine page refuses the timeline otherwise, on every GPU, so it is checked here, before any render
 * (2026-11-05 dry run: the planner placed a "ladder" the kit did not have yet; 8 GPU tries were spent on it).
 */
export function kitProblems(tl, kit) {
  if (typeof kit?.resolveObject !== "function" || !kit?.OBJECTS) throw coded("PLAN_FAILED", "the kit's object catalog is not loaded: the pre-render checks can't run, so nothing is rendered");
  const out = [];
  (tl.shots ?? []).forEach((s, i) => {
    for (const o of s.objects ?? []) {
      if (o?.asset) { if (tl.assets?.[o.asset]?.kind !== "object") out.push(`shot ${i} (#${s.line}): built object "${o.name}" has no blueprint in timeline.assets`); continue; }
      const key = kit.resolveObject(o?.name);
      if (!key) { out.push(`shot ${i} (#${s.line}): the kit has no object "${o?.name}"`); continue; }
      const states = kit.OBJECTS[key]?.states ?? [], st = o.state ?? kit.OBJECTS[key]?.state;
      if (states.length && !states.includes(st)) out.push(`shot ${i} (#${s.line}): object "${key}" has no state "${st}"`);
    }
  });
  return out;
}
export const loadKit = () => import(pathToFileURL(path.join(ENGINE, "page", "kit", "objects.js")).href);
export function checkFailure(c) {
  if (c.missing.length) return coded("VISUAL_CHECK", `${c.missing.length} line(s) show nothing for a spoken noun: ${c.missing.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).join("/")}`).join(", ")}`);
  if (c.production?.length) return coded("PRODUCTION_CHECK", `${c.production.length} line(s) miss an item the story needs: ${c.production.slice(0, 5).map((m) => `#${m.line} ${(m.missing ?? []).map((x) => x.name).join("/")}`).join(", ")}`);
  if (c.subjects.length) return coded("SUBJECT_CHECK", `${c.subjects.length} shot(s) don't show who the line is about: ${c.subjects.slice(0, 5).map((m) => `shot ${m.shot} (#${m.line}) ${m.problem}`).join(", ")}`);
  if (c.kit?.length) return coded("KIT_MISSING", `${c.kit.length} object(s) the engine's kit can't build: ${c.kit.slice(0, 5).join("; ")}`);
  if (c.timeline.length) return coded("PLAN_FAILED", `the timeline has ${c.timeline.length} problem(s): ${c.timeline.slice(0, 5).join("; ")}`);
  return null;
}
/** the still gate's verdict (lib/vision/gatePass.js report): a shot still failing a HARD rule after every re-plan -> STILL_GATE */
export function stillGateFailure(report, mode = "reject") {
  if (mode !== "reject") return null;
  const hard = (report?.unresolved ?? []).filter((u) => u.hard);
  if (!hard.length) return null;
  const e = coded("STILL_GATE", `${hard.length} shot(s) still blank after every re-plan (the still gate): ${hard.slice(0, 5).map((u) => `shot ${u.shot}${u.line != null ? ` (#${u.line})` : ""} ${u.codes.join("+")}`).join(", ")}`);
  e.stillGate = hard.slice(0, 20);
  return e;
}
/**
 * The plan was rejected (lib/critical.js criticalGate, mode "reject"): a story-critical item the builder could not make
 * (failed, cap reached, builder off). CRITICAL_UNBUILT: no retry, the run is refunded (render.js NO_RETRY); the page says
 * which things (contract.js failReason reads the quoted names before " — "). report = the gate's { unresolved }.
 */
/** the gate rejects only on a real (AI) director's list; the free mock's guesses are reported (tl.critical) */
export const criticalStrict = (d) => Boolean(d?.production) && d.provider !== "mock" && !d.fellBack;
export function criticalUnbuilt(report, crit = null) {
  const list = report?.unresolved ?? [];
  const why = (r) => crit?.unbuilt?.find((u) => u.name === r.name || (u.id && u.id === r.id))?.reason ?? (crit?.wanted?.some((w) => w.name === r.name) ? "not built" : "not tried before the plan");
  const names = list.map((r) => `"${String(r.name).replace(/"/g, "'").slice(0, 60)}"`).join(", ");
  const e = coded("CRITICAL_UNBUILT", `couldn't build the story's ${list.length === 1 ? "critical item" : `${list.length} critical items`}: ${names} — ${list.map((r) => `${r.name} [${(r.why ?? []).join("+")}]: ${why(r)}`).join("; ")}`.slice(0, 1400));
  e.critical = { unresolved: list.map((r) => ({ id: r.id, name: r.name, why: r.why ?? [], reason: why(r) })) };
  return e;
}
const normalizeScript = (s) => ({ ...s, lines: (s?.lines ?? []).map((l) => (Array.isArray(l) ? { part: l[0], text: l[1] } : typeof l === "string" ? { part: "line", text: l } : l)) });

// ---------------------------------------------------------------- prepare: voice -> plan + checks -> mix
/** the builder's per-need outcome, small enough for the job row: why each thing was built, found or carded */
export const builderLines = (report) => (report?.byNeed ?? []).slice(0, 30).map((n) => ({ name: String(n.name ?? "").slice(0, 60), kind: n.kind, source: n.source, reason: n.reason ? String(n.reason).slice(0, 160) : null, attempts: n.attempts ?? 0, costUsd: +Number(n.costUsd || 0).toFixed(5),
  ...(n.verdicts?.length ? { verdicts: n.verdicts.slice(-3).map((v) => (v.error ? { error: String(v.error).slice(0, 120) } : v.problems ? { problems: v.problems.slice(0, 3).map((x) => String(x).slice(0, 80)) } : { ok: !!v.ok, confidence: v.confidence ?? null, reads_as: v.reads_as ? String(v.reads_as).slice(0, 60) : null })) } : {}) }));

/** Chrome's flags for the prepare job's stills (the builder's vision check): the GPU when there is one, else
 * SwiftShader; never Chrome's defaults (they lack --no-sandbox: Chrome refuses to start as root in the container) */
async function stillChrome(mode) {
  if (process.env.CHROME_ARGS || process.env.SOFTWARE_GL || mode === "local") return;
  if (mode === "cpu") { useSoftware(); return; }
  try { await useGpu(); } catch (e) { console.log(`builder stills: no GPU (${String(e.message).slice(0, 120)}), SwiftShader`); useSoftware(); }
}

/**
 * The prepare job's own time limit (render.js RENDER.runSec.prepare: 420 s since 2026-11-06, the shot review's window).
 * The builder keeps the window it had under the old 300 s limit (it ends BUILDER_END_SEC after the job's start, and
 * never later than AFTER_BUILDER_SEC before the limit); the shot review gets its own window after the builder and must
 * end REVIEW_AFTER_SEC before the limit (music + SFX + the mix ~40 s, the uploads and a margin).
 */
const PREPARE_SEC = 420, AFTER_BUILDER_SEC = 75, BUILDER_END_SEC = 225, REVIEW_AFTER_SEC = 70;
/**
 * THE HARD STILL GATE (owner, 2026-11-09; lib/stillGate.js + lib/vision/gatePass.js): after the review, a still of every
 * shot through the free pixel + geometry gate, failing shots re-planned (action -> reaction -> world wide -> a passing
 * shot's framing) and gated again; a shot still failing a HARD rule (flat / wall / sky-only / camera inside / blocked /
 * too dark / blown out) fails the run (STILL_GATE, nothing rendered). Its window: the last GATE_SEC before the review's
 * old end (the review ends that much earlier; the gate reuses the review's stills of unchanged shots, so it renders few).
 * job.prepare.stillGate = { mode: "reject" (default) | "report" | "off", rounds } (env BLOCKY_WORLDS_STILL_GATE).
 */
const GATE_SEC = 45;
// default "reject" on RunPod (mode gpu / cpu); "off" for a job of mode "local" unless it asks (2026-11-08: no renders
// on the laptop: a local dry run / test must never open Chrome for the gate by surprise)
export const stillGateMode = (p = {}, jobMode = "gpu") => { const m = String(p.stillGate?.mode ?? process.env.BLOCKY_WORLDS_STILL_GATE ?? (jobMode === "local" ? "off" : "reject")).toLowerCase(); return ["reject", "report", "off"].includes(m) ? m : "reject"; };
/** the gate's report for visual-check.json / "planned": counts + the shots it touched (bounded) */
export const gateBrief = (r) => (r ? { cached: r.cached, passes: r.passes.length, failedFirst: r.shots.filter((x) => Array.isArray(x.first)).length, fixed: r.fixed.length, unresolved: r.unresolved.map((u) => ({ shot: u.shot, codes: u.codes, hard: u.hard })).slice(0, 30), unverified: r.unverified.length, warn: r.warn.length, ms: r.ms, stopped: r.stopped ?? null } : null);

export async function prepare(job, dir, post, { planModule = null, voiceFn = null, kitModule = null, builder: builderIn = null } = {}) {
  const p = job.prepare ?? {}, timing = {}, jobT0 = Date.now();
  const lap = async (k, fn) => { const t = Date.now(); const r = await fn(); timing[k] = +((Date.now() - t) / 1000).toFixed(2); return r; };
  const script = normalizeScript(p.script);
  if (!script.lines.length) throw coded("BAD_JOB", "the script has no lines");
  const mp3 = path.join(dir, "voice.mp3"), takeJson = path.join(dir, "take.json");
  if (p.resume?.timeline) return resumePrepare(job, dir, post, { voiceFn, script, mp3, takeJson, timing, lap });

  // 0. the builder (lib/builder: a missing kit object or world never fails a run)
  const plan = planModule ?? (await import(pathToFileURL(path.join(ENGINE, "plan.mjs")).href));
  const kit = kitModule ?? (await loadKit());
  const B = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "index.js")).href);
  const { snapshotCache } = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "cache.js")).href);
  const blog = [];
  const library = snapshotCache(p.builder?.library ?? [], { onSave: async (asset) => { await post("built", { asset: { ...asset, still_path: asset.still_path ? path.basename(asset.still_path) : null } }); } });
  // the story-critical gate's library(name) (lib/critical.js): the snapshot + what this video built, synchronous
  const libraryFind = (name) => library.find?.("object", [name]) ?? null;
  const prepareSec = Number(p.limits?.prepareSec) || PREPARE_SEC;
  const until = jobT0 + Math.min(BUILDER_END_SEC, prepareSec - AFTER_BUILDER_SEC) * 1000;
  const gateMode = stillGateMode(p, job.mode ?? "gpu"), gateOn = gateMode !== "off";
  const gateUntil = jobT0 + (prepareSec - REVIEW_AFTER_SEC) * 1000;
  const reviewUntil = gateUntil - (gateOn ? GATE_SEC * 1000 : 0);
  const builder = builderIn ?? B.makeBuilder({
    provider: await B.providerFromConfig({ provider: p.builder?.provider ?? process.env.BLOCKY_WORLDS_BUILDER ?? "off", idea: p.idea ?? null }),
    cache: library, budget: { ...(p.builder?.budget ?? {}), until }, stillDir: path.join(dir, "stills"), log: (m) => { blog.push(m); console.log(`builder: ${m}`); },
    beforeStills: () => stillChrome(job.mode ?? "gpu"),
  });
  // the shot review's still renderer, opened and WARMED early (2026-11-07): the test runs lost 87-176 s of the review's
  // window to a cold page load; a warm reload of a similar timeline in the same Chrome measured ~5x faster. It is warmed
  // with the first early plan (below) while the voice, the director and the builder run; off when the review is off.
  const V = await import(pathToFileURL(path.join(ENGINE, "lib", "vision", "index.js")).href);
  const reviewOn = Boolean(V.judgeFromConfig(p.review ?? {}, { apiKey: process.env.ANTHROPIC_KEY ?? null }));
  // the still gate renders on the same warm page (its own stills, and the review's measured ones): on when either is on
  const reviewStills = reviewOn || gateOn ? V.makeReviewStills({ dir: path.join(dir, "review"), size: Number(p.review?.stillSize) || undefined, beforeStills: () => stillChrome(job.mode ?? "gpu"), log: (m) => console.log(`review: ${m}`) }) : null;
  const warmReview = (early) => { if (reviewStills) { console.log(`review: warming the stills page at ${((Date.now() - jobT0) / 1000).toFixed(1)} s`); reviewStills.warm(early); } };
  // what the director and the builder spent, for the server's cost ledger (render.js aiLedger): "planned" reports the
  // spend so far; the job's end (done output / failed event) reports the totals and what "planned" said, so a call that
  // ends after "planned", or a job that fails before it, is still billed once
  const spend = { directorUsd: 0, directorModel: null, builderUsd: 0, plannedDirectorUsd: 0, plannedBuilderUsd: 0, reviewUsd: 0, reviewModel: null, plannedReviewUsd: 0 };
  const spendNow = () => ({ ...spend, builderUsd: +Number(builder.spent ?? spend.builderUsd ?? 0).toFixed(5) });
  let builtReport = null;
  const directorOn = !(p.director === false || p.director?.provider === "off");
  // without a story director nothing is built before the plan (2026-11-08, STORY-CRITICAL FIRST): no money goes to the
  // needs of an undirected early plan (run 707609b1 spent its designs on things the plan never showed); the plan's
  // needs are built after planning (builder.buildFor). The early plan only warms the review's still page.
  if (!directorOn) {
    try { warmReview(plan.planVideo({ script, words: plan.estimateWords ? plan.estimateWords(script) : null, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null })); }
    catch (e) { console.log(`review: no early plan (${e.message})`); }
  }
  // the story director runs while the voice is made (it needs only the script) and never fails a run (directStory falls
  // back to the mock's list); as soon as it answers, the builder starts on what the list needs built: the needs of a
  // plan made from its production list (match.builderNeeds after the planner's refinements, lib/direction.js).
  // A retry reuses the list an earlier try stored (p.director.stored: never paid for twice); a new list is stored at
  // once (p.out.direction), before the expensive steps after it.
  const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
  const directing = (async () => {
    if (!directorOn) return null;
    try {
      const { directStory } = await import(pathToFileURL(path.join(ENGINE, "lib", "director", "index.js")).href);
      let stored = null;
      if (p.director?.stored) {
        try { stored = JSON.parse(String(await get(p.director.stored))); } catch (e) { console.log(`director: no stored list (${String(e.message).slice(0, 120)})`); }
        if (!stored?.production?.lines) stored = null;
      }
      const provider = stored ? { model: stored.model ?? null, direct: async () => ({ data: stored.production, costUsd: 0, model: stored.model ?? null }) }
        : p.director?.provider === "anthropic" && process.env.ANTHROPIC_KEY ? "anthropic" : "mock";
      const d = await directStory({ script, idea: p.idea ?? null, provider, apiKey: process.env.ANTHROPIC_KEY ?? null, ...(p.director?.model ? { model: p.director.model } : {}), exists, runId: job.runId ?? null, source: "prepare", log: (m) => console.log(`director: ${m}`) });
      if (stored) { d.reused = true; d.ms = 0; if (stored.fellBack) d.fellBack = true; console.log("director: the list an earlier try stored (no paid call)"); }
      spend.directorUsd = Number(d?.costUsd) || 0; spend.directorModel = d?.model ?? null;
      if (!stored && d?.provider === "anthropic" && !d.fellBack && p.out?.direction) {
        const f = path.join(dir, "direction.json");
        fs.writeFileSync(f, JSON.stringify({ v: 1, provider: d.provider, model: d.model ?? null, fellBack: false, costUsd: d.costUsd ?? 0, production: d.production }));
        await put(p.out.direction, f, "application/json").catch((e) => console.log(`direction.json upload: ${e.message}`)); // bookkeeping never fails a run
      }
      return d;
    } catch (e) { console.log(`director: skipped (${e.message})`); return null; }
  })();
  // STORY-CRITICAL FIRST (owner 2026-11-08: "The builder must build every story-critical object BEFORE planning, or the
  // plan must be rejected"; lib/critical.js). As soon as the director answers (the voice is still being made): an early
  // plan from estimated timings in report mode gives the critical items (the rule's thing, the planted prop, the twist's
  // thing, a set piece named twice, the creature) resolved kit (head-noun guard) -> library; the ones left go to the
  // builder FIRST, within its cap. Only when every one is resolved do the early plan's other needs start (a run that is
  // going to be rejected buys nothing more). The plan below runs with criticalMode "reject" and these results.
  const critical = directing.then(async (d) => {
    const c = { items: [], wanted: [], built: {}, unbuilt: [], report: null, error: null };
    if (!d?.production) return c;
    let early = null;
    try { early = plan.planVideo({ script, words: plan.estimateWords ? plan.estimateWords(script) : null, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null, direction: d, exists, criticalMode: "report", library: libraryFind }); }
    catch (e) { c.error = `early plan failed: ${String(e.message).slice(0, 200)}`; console.log(`critical: ${c.error}`); return c; }
    warmReview(early);
    c.items = early.critical?.items ?? [];
    // the free mock director's list (or a fallback to it) is a guess from the words ("think", "hunt", "strip"), not the
    // story's critical things: it is only reported, never built or rejected on (criticalStrict below)
    c.wanted = criticalStrict(d) ? early.critical?.unresolved ?? [] : [];
    if (!criticalStrict(d) && early.critical?.unresolved?.length) console.log(`critical: mock director list, report only (unresolved: ${early.critical.unresolved.map((x) => x.name).join(", ")})`);
    if (c.wanted.length) {
      console.log(`critical: building ${c.wanted.map((x) => `"${x.name}" (${(x.why ?? []).join("+")})`).join(", ")} before the plan`);
      const r = typeof builder.buildCritical === "function" ? await builder.buildCritical(c.wanted)
        : { built: {}, unbuilt: c.wanted.map((x) => ({ ...x, reason: "this builder can't build before the plan" })), report: null };
      Object.assign(c, { built: r.built, unbuilt: r.unbuilt, report: r.report });
    }
    if (!c.unbuilt.length) {
      try {
        const { needsFromTimeline } = await import(pathToFileURL(path.join(ENGINE, "lib", "builder", "apply.js")).href);
        builder.prefetch(needsFromTimeline(early, { kit }), kit);
      } catch (e) { console.log(`builder: no directed early start (${e.message})`); }
    } else console.log(`critical: not built: ${c.unbuilt.map((x) => `"${x.name}" (${x.reason})`).join("; ")}`);
    return c;
  }).catch((e) => ({ items: [], wanted: [], built: {}, unbuilt: [], report: null, error: String(e?.message ?? e).slice(0, 200) }));
  // THE AUTOMATIC STORYBOARD (job.prepare.storyboard = { auto: true }, 2026-11-12): the AI director writes the storyboard
  // (lib/storyboardDirector.js: the bible, then every scene in parallel) WHILE the voice is made; its spend is the director's
  const boarding = p.storyboard?.auto ? directing.then(async (d) => {
    const early = plan.planVideo({ script, words: plan.estimateWords ? plan.estimateWords(script) : null, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null, direction: d, exists, criticalMode: "report", library: libraryFind, scenes: p.scenes ?? null });
    if (!process.env.ANTHROPIC_KEY) throw coded("NOT_CONFIGURED", "no Anthropic key for the storyboard director");
    await post("progress", { stage: "storyboard", pct: 4 });
    const r = await directStoryboard({ apiKey: process.env.ANTHROPIC_KEY, script, cast: early.cast ?? {}, scenes: early.scenes ?? p.scenes ?? null, title: script.title ?? "", capUsd: Number(p.storyboard.capUsd) || 0.25, log: (m) => console.log(m) });
    spend.directorUsd += r.costUsd; spend.plannedDirectorUsd += r.costUsd;
    console.log(`storyboard: ${r.board.lines.length} lines, ${r.fellBack.length} on the engine planner (${r.ms} ms, $${r.costUsd})`);
    return r.board;
  }).catch((e) => { throw e.code ? e : coded("STORYBOARD_FAILED", String(e.message ?? e).slice(0, 300)); }) : null;
  boarding?.catch(() => {}); // awaited below (an early rejection must not be unhandled)
  try {
  // 1. the voice: the run's earlier take, or one new paid take uploaded at once
  await post("progress", { stage: "voice", pct: 2 });
  const reuse = Boolean(p.voice?.get);
  if (!reuse && !p.voice?.put) throw coded("BAD_JOB", "no voice URLs");
  if (reuse) {
    try { await get(p.voice.get.mp3, mp3); await get(p.voice.get.take, takeJson); } catch (e) { throw coded("VOICE_DOWNLOAD", `the run's take could not be downloaded: ${e.message}`); }
  } else if (!process.env.ELEVENLABS_KEY && !voiceFn) throw coded("VOICE_CONFIG", "no ElevenLabs key in the worker (RunPod secret blocky_elevenlabs)");
  const voice = voiceFn ?? (await import(pathToFileURL(path.join(ENGINE, "voice", "eleven.mjs")).href)).elevenVoice;
  let v = null;
  try {
    [v] = await Promise.all([lap("voice", async () => { if (boarding && p.storyboard?.voiceAfter) await boarding; return voice({ lines: script.lines, outDir: dir, apiKey: process.env.ELEVENLABS_KEY ?? null }); }), /* voiceAfter: no paid take before the storyboard is written (render.js switch) */ lap("director", () => directing), ...(boarding ? [lap("storyboard", () => boarding)] : [])]); // the storyboard is written while the voice is made
  } catch (e) {
    const m = String(e.message ?? e);
    throw coded(/VOICE_CONFIG/.test(m) ? "VOICE_CONFIG" : /quota|credits|payment|insufficient|\b40[12]\b/i.test(m) ? "PROVIDER_BALANCE" : /different script/.test(m) ? "BAD_JOB" : "VOICE_FAILED", m.slice(0, 600));
  } finally {
    // a take that was bought is kept even if the trim after it failed: a retry gets it back instead of paying again
    if (!reuse && fs.existsSync(takeJson) && fs.existsSync(mp3)) {
      const take = JSON.parse(fs.readFileSync(takeJson, "utf8"));
      await put(p.voice.put.mp3, mp3, "audio/mpeg");
      await put(p.voice.put.take, takeJson, "application/json");
      await post("voiced", { costUsd: take.costUsd ?? null, billedChars: take.billedChars ?? null, chars: take.chars ?? null });
    }
  }

  // 2. the plan, the builder's things put in (each change re-checked; one that breaks a check is undone), then the
  //    three checks + the kit check: any miss stops the run here, before any render
  await post("progress", { stage: "plan", pct: 8 });
  const direction = await directing;
  const crit = await lap("critical", () => critical);
  if (crit.report) builtReport = crit.report;
  // the plan with the critical items' results; one still unresolved REJECTS it: CRITICAL_UNBUILT (no retry, refunded)
  let tl;
  try {
    tl = await lap("plan", () => plan.planVideo({ script, words: v.words, idea: p.idea ?? {}, lengthSec: p.lengthSec ?? null, direction, exists, built: crit.built, library: libraryFind, criticalMode: criticalStrict(direction) ? "reject" : "report", scenes: p.scenes ?? null }));
  } catch (e) {
    if (e.critical) throw criticalUnbuilt(e.critical, crit);
    throw e;
  }
  if (direction) {
    const prodFile = path.join(dir, "production.json");
    fs.writeFileSync(prodFile, JSON.stringify({ provider: direction.provider, model: direction.model, fellBack: direction.fellBack, costUsd: direction.costUsd, ms: direction.ms, problems: direction.problems, production: direction.production, refined: tl.production ?? null, gaps: direction.match.gaps, summary: direction.match.summary }));
    if (p.out?.production) await put(p.out.production, prodFile, "application/json").catch((e) => console.log(`production.json upload: ${e.message}`)); // bookkeeping never fails a run
  }
  // STORYBOARD (owner 2026-11-11): job.prepare.storyboard = { board (lib/storyboards/*.js data), prompts (the shot prompt
  // pairs) }: the storyboard drives the scene list + the shots; the prompts give each board shot its face changes and
  // action starts; its hard checks (the rule, every action verb animated, the places) stop the run on any problem
  if (p.storyboard?.auto) {
    p.storyboard.board = await boarding; // written while the voice was made
    await post("progress", { stage: "prompts", pct: 9 });
    const board0 = p.storyboard.board;
    const tl0 = applyStoryboard(tl, board0);
    // every scene's shot prompts in parallel, then the free fixes (verbs as timed actions, the state from the facts, HOW)
    const w = await lap("prompts", () => writePromptsByScene({ apiKey: process.env.ANTHROPIC_KEY, tl: tl0, board: board0, capUsd: Number(p.storyboard.promptsCapUsd) || 0.3, perShot: Number(p.storyboard.perShot) || 520, log: (m) => console.log(m) })).catch((e) => { throw coded("STORYBOARD_FAILED", `shot prompts: ${String(e.message).slice(0, 200)}`); });
    spend.directorUsd += w.costUsd; spend.plannedDirectorUsd += w.costUsd;
    p.storyboard.prompts = enrichPrompts(w.data, tl0).prompts;
    const pc = checkPrompts(p.storyboard.prompts, tl0, board0);
    console.log(`shot prompts: ${p.storyboard.prompts.length}/${tl0.shots.length} shots; checks ${Object.entries(pc).map(([k, v]) => `${k} ${v.length}`).join(", ")}`);
  }
  if (p.storyboard?.board) {
    await post("progress", { stage: "checks", pct: 10 });
    tl = applyStoryboard(tl, p.storyboard.board);
    if (Array.isArray(p.storyboard.prompts)) tl = paramsFromPrompts(tl, p.storyboard.prompts).tl;
    const sc = storyboardChecks(tl, p.storyboard.board), bad = Object.entries(sc).flatMap(([k, v]) => v.map((m) => `${k}: ${m}`));
    console.log(`storyboard ${p.storyboard.board.id}: ${tl.shots.length} shots (${tl.shots.filter((s) => s.board).length} storyboard); checks ${bad.length}`);
    if (bad.length) throw Object.assign(new Error(`the storyboard checks fail: ${bad.slice(0, 12).join("; ")}`), { code: "STORYBOARD_CHECKS" });
  }
  tl.audio = { voice: "voice.wav", music: "music.wav" };
  const built = await lap("build", () => builder.buildFor(tl, { plan, kit }));
  builtReport = built.report;
  // 2b. the shot review (lib/vision, owner 2026-11-06): a still of every shot, an AI vision check of each line against
  //     the story (who, things, action, place, time), misses re-planned (each fix re-checked by the same checks as
  //     below), the rest a picture card or recorded. Never fails the run; its own money cap and time window.
  //     A prepare retry reviews again (the timeline is planned again); a resumed prepare never does (resumePrepare).
  let review = null;
  try {
    review = await lap("review", () => V.reviewForPrepare({
      tl, script, premise: p.idea?.topic ?? p.idea?.premise ?? null, config: p.review ?? {}, apiKey: process.env.ANTHROPIC_KEY ?? null,
      plan, kit, kitProblems, builder, dir, until: reviewUntil, beforeStills: () => stillChrome(job.mode ?? "gpu"), ...(reviewStills ? { stills: reviewStills } : {}), log: (m) => console.log(`review: ${m}`),
    }));
    spend.reviewUsd = Number(review?.costUsd) || 0; spend.reviewModel = review?.summary?.model ?? null;
    if (review?.report && p.out?.shotReview) await put(p.out.shotReview, path.join(dir, "shot-review.json"), "application/json").catch((e) => console.log(`shot-review.json upload: ${e.message}`)); // bookkeeping never fails a run
  } catch (e) { console.log(`review: skipped (${String(e.message).slice(0, 160)})`); }
  // 2c. THE HARD STILL GATE (lib/vision/gatePass.js): every shot's still through the pixel + geometry gate (the review's
  //     measurements of unchanged shots reused), failing shots re-planned and gated again, each change re-checked
  let gate = null;
  try {
    if (gateOn && reviewStills) {
      const { gateShots } = await import(pathToFileURL(path.join(ENGINE, "lib", "vision", "gatePass.js")).href);
      await post("progress", { stage: "stills", pct: 11 });
      gate = await lap("stillGate", () => gateShots({ tl, stills: () => reviewStills.get(), cache: reviewStills.gateCache, check: V.checksFor(plan, script, kit, kitProblems), until: gateUntil, rounds: Math.max(0, Math.min(3, Number(p.stillGate?.rounds ?? 2))), log: (m) => console.log(`gate: ${m}`) }));
    }
  } catch (e) { console.log(`gate: skipped (${String(e.message).slice(0, 160)})`); }
  finally { await reviewStills?.close().catch(() => {}); } // its Chrome is not needed after the review and the gate
  const checks = preRenderChecks(plan, tl, script, kit);
  const checkFile = path.join(dir, "visual-check.json");
  fs.writeFileSync(checkFile, JSON.stringify({ ...checks, report: tl.visualReport ?? null, builder: { ...built, log: blog }, review: review?.summary ?? null, stillGate: gate ? { mode: gateMode, ...gate.report } : { mode: gateMode, ran: false } }, null, 1));
  if (p.out?.visualCheck) await put(p.out.visualCheck, checkFile, "application/json");
  const bad = checkFailure(checks);
  if (bad) throw bad;
  const gateBad = gate ? stillGateFailure(gate.report, gateMode) : null;
  if (gateBad) throw gateBad;
  const tlPath = path.join(dir, "timeline.json");
  fs.writeFileSync(tlPath, JSON.stringify(tl));
  // WORLD CONTINUITY: the story's world bible (tl.world) next to the timeline (bookkeeping: never fails the run)
  if (tl.world) await (await import(pathToFileURL(path.join(ENGINE, "lib", "worldBible.js")).href)).saveWorldBible(dir, tl).catch(() => null);
  await put(p.out.timeline, tlPath, "application/json");
  const planned = { frames: Math.round(tl.duration * (tl.fps ?? 24)), duration: tl.duration, shots: tl.shots.length, builder: { costUsd: built.report.costUsd, built: built.applied.length, cards: built.cards.length, ms: built.report.ms, needs: builderLines(built.report) },
    ...(direction ? { director: { provider: direction.provider, model: direction.model ?? null, fellBack: !!direction.fellBack, reused: !!direction.reused, costUsd: direction.costUsd ?? 0, ms: direction.ms ?? null }, gaps: (direction.match?.gaps ?? []).slice(0, 200) } : {}),
    ...(review?.summary ? { review: review.summary } : {}),
    ...(gate ? { stillGate: gateBrief(gate.report) } : {}),
    ...(tl.critical ? { critical: (tl.critical.items ?? []).slice(0, 20).map((r) => ({ name: String(r.name).slice(0, 60), why: r.why, source: r.source })) } : {}),
    timing: { ...timing } };
  await post("planned", planned);
  spend.plannedBuilderUsd = Number(planned.builder.costUsd) || 0; spend.plannedDirectorUsd = Number(planned.director?.costUsd) || 0; spend.plannedReviewUsd = Number(planned.review?.costUsd) || 0;

  // 3. music A + the SFX cues + the final mix (the chunks render meanwhile)
  const musicWav = path.join(dir, "music.wav"), mixM4a = path.join(dir, "mix.m4a");
  const { bedFromLoop, mixAudio } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const { sfxCues } = await import(pathToFileURL(path.join(ENGINE, "lib", "sfx.js")).href);
  await lap("music", () => bedFromLoop(p.music ?? "A", tl.duration, musicWav));
  // SIMPLE LOOK (owner 2026-11-10): almost no SFX (one low boom on the rule's key word), the music ~12 dB under the voice
  const { simpleCues, AUDIO_SIMPLE } = await import(pathToFileURL(path.join(ENGINE, "lib", "audioPlan.js")).href);
  const simpleAudio = tl.look === "simple";
  const cues = p.sfx === false ? [] : simpleAudio ? simpleCues(tl, sfxCues(tl)) : sfxCues(tl);
  const audio = await lap("mix", () => mixAudio({ voice: v.wav, music: musicWav, out: mixM4a, duration: tl.duration, sfxCues: cues, ...(simpleAudio ? { musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb } : {}) }));
  await put(p.out.mix, mixM4a, "audio/mp4");
  return { role: "prepare", planned, builder: { ...built.report, applied: built.applied, reverted: built.reverted, cards: built.cards, added: library.added.map((a) => ({ id: a.id, kind: a.kind, name: a.name })) }, voice: { reused: reuse, costUsd: reuse ? 0 : v.costUsd ?? null, billedChars: v.billedChars ?? null, chars: v.chars ?? null, wpm: v.wpm, duration: v.duration }, audio: { lufs: audio.lufs, truePeak: audio.truePeak, sfxCues: cues.length }, timing, spend: spendNow() };
  } catch (e) {
    // the spend goes back with the failure (a director still answering gets up to 20 s to say what it cost)
    let t;
    await Promise.race([directing.then(() => critical), new Promise((s) => { t = setTimeout(s, 20000); })]).catch(() => {});
    clearTimeout(t);
    try { e.spend = spendNow(); if (builtReport) e.builder = { built: builtReport.built, cards: builtReport.cards, costUsd: builtReport.costUsd, needs: builderLines(builtReport) }; } catch { /* bookkeeping never hides the real error */ }
    throw e;
  } finally { await builder.close().catch(() => {}); await reviewStills?.close().catch(() => {}); }
}

/**
 * A prepare RETRY after an earlier try already planned (the server split that plan into chunks and they render from its
 * timeline.json): nothing is directed, built, planned or checked again (the checks passed on that very timeline and the
 * server re-read their report); the stored timeline + the stored voice take give the music, the SFX and the mix, so the
 * mix always matches the frames the chunks render (run 707609b1: try 2 re-planned with a new director list while try 1's
 * chunks were rendering, and paid the director again).
 */
async function resumePrepare(job, dir, post, { voiceFn, script, mp3, takeJson, timing, lap }) {
  const p = job.prepare;
  if (!p.voice?.get) throw coded("BAD_JOB", "a resumed prepare needs the run's stored take");
  await post("progress", { stage: "mix", pct: 12 });
  const tlPath = path.join(dir, "timeline.json");
  try { await get(p.resume.timeline, tlPath); } catch (e) { throw coded("BAD_JOB", `the planned timeline could not be downloaded: ${e.message}`); }
  const tl = JSON.parse(fs.readFileSync(tlPath, "utf8"));
  try { await get(p.voice.get.mp3, mp3); await get(p.voice.get.take, takeJson); } catch (e) { throw coded("VOICE_DOWNLOAD", `the run's take could not be downloaded: ${e.message}`); }
  const voice = voiceFn ?? (await import(pathToFileURL(path.join(ENGINE, "voice", "eleven.mjs")).href)).elevenVoice;
  let v;
  try { v = await lap("voice", () => voice({ lines: script.lines, outDir: dir, apiKey: null })); }
  catch (e) { throw coded(/different script/.test(String(e.message)) ? "BAD_JOB" : "VOICE_FAILED", String(e.message ?? e).slice(0, 600)); }
  const musicWav = path.join(dir, "music.wav"), mixM4a = path.join(dir, "mix.m4a");
  const { bedFromLoop, mixAudio } = await import(pathToFileURL(path.join(ENGINE, "audio", "mix.mjs")).href);
  const { sfxCues } = await import(pathToFileURL(path.join(ENGINE, "lib", "sfx.js")).href);
  await lap("music", () => bedFromLoop(p.music ?? "A", tl.duration, musicWav));
  // SIMPLE LOOK (owner 2026-11-10): almost no SFX (one low boom on the rule's key word), the music ~12 dB under the voice
  const { simpleCues, AUDIO_SIMPLE } = await import(pathToFileURL(path.join(ENGINE, "lib", "audioPlan.js")).href);
  const simpleAudio = tl.look === "simple";
  const cues = p.sfx === false ? [] : simpleAudio ? simpleCues(tl, sfxCues(tl)) : sfxCues(tl);
  const audio = await lap("mix", () => mixAudio({ voice: v.wav, music: musicWav, out: mixM4a, duration: tl.duration, sfxCues: cues, ...(simpleAudio ? { musicUnderVoiceDb: AUDIO_SIMPLE.musicUnderVoiceDb } : {}) }));
  await put(p.out.mix, mixM4a, "audio/mp4");
  const spend = { directorUsd: 0, directorModel: null, builderUsd: 0, plannedDirectorUsd: 0, plannedBuilderUsd: 0 };
  return { role: "prepare", resumed: true, planned: { frames: Math.round(tl.duration * (tl.fps ?? 24)), duration: tl.duration, shots: tl.shots?.length ?? 0 }, voice: { reused: true, costUsd: 0, wpm: v.wpm, duration: v.duration }, audio: { lufs: audio.lufs, truePeak: audio.truePeak, sfxCues: cues.length }, timing, spend };
}

// ---------------------------------------------------------------- chunk: frames [from, to) -> seg + web
async function renderer(mode) { return mode === "gpu" ? useGpu() : mode === "cpu" ? useSoftware() : "local (this machine's Chrome)"; }

export async function chunk(job, dir, post) {
  const c = job.chunk, timing = {};
  let t = Date.now();
  const gl = await renderer(job.mode ?? "gpu");
  timing.gpuCheck = +((Date.now() - t) / 1000).toFixed(2);
  const tlPath = path.join(dir, "timeline.json");
  await get(c.timeline, tlPath);
  if (c.crf) process.env.RENDER_CRF = String(c.crf);
  const seg = path.join(dir, "seg.mp4"), web = path.join(dir, "web.mp4");
  let lastPct = -1;
  t = Date.now();
  let res;
  try {
    res = await renderParallel({ timelinePath: tlPath, out: seg, from: c.from, to: c.to, workers: c.pages ?? 1, onProgress: (o) => { const step = Math.floor((o.pct ?? 0) / 20) * 20; if (step > lastPct) { lastPct = step; post("progress", { stage: "render", pct: Math.min(95, step) }).catch(() => {}); } } });
  } catch (e) {
    // the engine page refusing the timeline is the same on every GPU: no retry (render.js NO_RETRY)
    if (/engine: the timeline has \d+ problem/.test(String(e.message))) throw coded("TIMELINE_INVALID", e.message);
    throw e;
  }
  timing.render = +((Date.now() - t) / 1000).toFixed(2);
  // the upload limit (50 MB a file): a busy chunk is squeezed again (higher CRF, same frames) until it fits
  const max = Number(c.maxBytes ?? MAX_UPLOAD);
  for (let crf = Number(c.crf ?? 21) + 4; fs.statSync(seg).size > max && crf <= 36; crf += 4) {
    const smaller = seg.replace(/\.mp4$/, `_crf${crf}.mp4`);
    ffmpeg(["-i", seg, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", smaller]);
    fs.renameSync(smaller, seg);
  }
  if (fs.statSync(seg).size > max) throw coded("CHUNK_TOO_BIG", `chunk ${c.index} is ${fs.statSync(seg).size} bytes even at CRF 36`);
  // the 720p web copy of this chunk (same settings in every chunk, so the finish joins them by stream copy)
  t = Date.now();
  ffmpeg(["-i", seg, "-vf", "scale=720:1280", "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", web]);
  timing.web = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await put(c.out.seg, seg, "video/mp4");
  await put(c.out.web, web, "video/mp4");
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  // the frame guards' log (render.mjs): flat (one-colour) shots re-rendered with a safe camera, black frames replaced
  const flat = (res.chunks ?? []).flatMap((x) => x.flat ?? []), replaced = (res.chunks ?? []).reduce((n, x) => n + (x.reused ?? 0), 0);
  if (flat.length) console.log(`chunk ${c.index}: flat shots saved by the guard: ${JSON.stringify(flat)}`);
  return { role: "chunk", index: c.index, from: c.from, to: c.to, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(seg).size, webBytes: fs.statSync(web).size, renderer: gl, timing, ...(flat.length ? { flat } : {}), ...(replaced ? { replacedFrames: replaced } : {}) };
}

// ---------------------------------------------------------------- finish: join + mux + poster
export async function finish(job, dir) {
  const f = job.finish, timing = {};
  let t = Date.now();
  const segs = [], webs = [], mix = path.join(dir, "mix.m4a");
  await Promise.all([
    ...f.segs.map(async (u, i) => { const p = path.join(dir, `seg_${String(i).padStart(3, "0")}.mp4`); await get(u, p); segs[i] = p; }),
    ...f.webs.map(async (u, i) => { const p = path.join(dir, `web_${String(i).padStart(3, "0")}.mp4`); await get(u, p); webs[i] = p; }),
    get(f.mix, mix),
  ]);
  timing.download = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  const mux = async (parts, out) => {
    const silent = out.replace(/\.mp4$/, "_silent.mp4");
    await concat(parts, silent);
    ffmpeg(["-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "copy", "-shortest", "-movflags", "+faststart", out]);
    return out;
  };
  const final = await mux(segs, path.join(dir, "final.mp4")), web = await mux(webs, path.join(dir, "web.mp4"));
  const durationSec = +probeDuration(final).toFixed(3);
  const poster = path.join(dir, "poster.jpg");
  ffmpeg(["-ss", String(Math.min(1.5, durationSec / 2)), "-i", web, "-frames:v", "1", "-q:v", "3", poster]);
  timing.join = +((Date.now() - t) / 1000).toFixed(2);
  t = Date.now();
  await put(f.out.final, final, "video/mp4");
  await put(f.out.web, web, "video/mp4");
  await put(f.out.poster, poster, "image/jpeg");
  timing.upload = +((Date.now() - t) / 1000).toFixed(2);
  return { role: "finish", durationSec, bytes: fs.statSync(final).size, webBytes: fs.statSync(web).size, timing };
}

// ---------------------------------------------------------------- stills / objectStills (runpod/stillsRole.mjs)
// the laptop's still renders moved here (2026-11-08): timeline stills in one page load, the builder's object stills
const stillsRole = (job, dir, _post, opts = {}) => stillsJob(job, dir, { gpuCheck: opts.gpuCheck ?? renderer, get, put });
const objectStillsRole = (job, dir, _post, opts = {}) => objectStillsJob(job, dir, { gpuCheck: opts.gpuCheck ?? renderer, put, makeRenderer: opts.makeRenderer ?? null });

/** this image's build ("20261106T120000-1a2b3c4d5e6f", buildContext.mjs); null in a repo checkout (no BUILD_ID file) */
export function buildOf(engine = ENGINE) {
  try { return fs.readFileSync(path.join(engine, "BUILD_ID"), "utf8").trim() || null; } catch { return null; }
}
/** why this worker must not run a job that needs minBuild (null: it may). Builds compare by their time part. */
export function staleBuild(own, minBuild) {
  if (!minBuild || !own) return null; // no requirement, or a repo checkout (dev / dry run)
  const a = String(own).split("-")[0], b = String(minBuild).split("-")[0];
  return a < b ? `this worker runs build ${own}, the job needs ${minBuild} or newer` : null;
}

/** one production job -> its RESULT (never throws); the worker's own done/failed event goes to the callback too */
export async function runJob(job, opts = {}) {
  const t0 = Date.now(), post = opts.post ?? poster(job);
  // a stale worker stops before the temp folder, the GPU check, any download or any paid call
  const stale = staleBuild(opts.build !== undefined ? opts.build : buildOf(), job.minBuild);
  if (stale) {
    const result = { ok: false, role: job.role, code: "STALE_WORKER", error: stale, totalS: +((Date.now() - t0) / 1000).toFixed(2) };
    await post("failed", { code: result.code, message: result.error });
    return result;
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bw-${job.role}-`));
  let result;
  try {
    const fn = { prepare, chunk, finish, stills: stillsRole, objectStills: objectStillsRole, simpleStills: (j, d, _p, o = {}) => simpleStillsJob(j, d, { gpuCheck: o.gpuCheck ?? renderer, put }) }[job.role];
    if (!fn) throw coded("BAD_JOB", `unknown role ${job.role}`);
    const r = await fn(job, dir, post, opts);
    result = { ok: true, ...r, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : os.hostname(), totalS: +((Date.now() - t0) / 1000).toFixed(2) };
    await post("done", { output: result });
  } catch (e) {
    result = { ok: false, role: job.role, code: e.code ?? "RENDER_FAILED", error: String(e.message ?? e).slice(0, 1500), totalS: +((Date.now() - t0) / 1000).toFixed(2), ...(e.spend ? { spend: e.spend } : {}), ...(e.builder ? { builder: e.builder } : {}) };
    await post("failed", { code: result.code, message: result.error, ...(e.spend ? { spend: e.spend } : {}), ...(e.builder ? { builder: e.builder } : {}) });
  } finally {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 }); } catch { /* a temp folder never fails a job */ }
  }
  return result;
}

// ---------------------------------------------------------------- staging (runpod/dispatch.mjs), unchanged
async function staging(input) {
  const t0 = Date.now(), timing = {};
  const lap = (k, t) => { timing[k] = +((Date.now() - t) / 1000).toFixed(2); };
  let job = null, report = null;
  try {
    job = input.jobUrl ? JSON.parse(String(await get(input.jobUrl))) : input;
    if (job.crf) process.env.RENDER_CRF = String(job.crf);
    const mode = job.mode ?? "gpu", dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-"));
    let t = Date.now();
    const gl = await renderer(mode);
    lap("gpuCheck", t);
    t = Date.now();
    const tlPath = path.join(dir, "timeline.json");
    await get(job.timelineUrl, tlPath);
    lap("download", t);
    const chunks = [];
    t = Date.now();
    for (const [i, r] of (job.ranges ?? []).entries()) {
      const out = path.join(dir, `chunk${i}.mp4`);
      const res = await renderParallel({ timelinePath: tlPath, out, from: r.from, to: r.to, workers: job.pages ?? 1 });
      for (let crf = Number(job.crf ?? 20) + 4; fs.statSync(out).size > MAX_UPLOAD && crf <= 36; crf += 4) {
        const smaller = out.replace(/.mp4$/, `_crf${crf}.mp4`);
        execFileSync(FF, ["-v", "error", "-y", "-i", out, "-c:v", "libx264", "-crf", String(crf), "-preset", "medium", "-pix_fmt", "yuv420p", smaller]);
        fs.renameSync(smaller, out);
      }
      if (r.upload) await put(r.upload, out, "video/mp4");
      chunks.push({ from: r.from, to: r.to, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(out).size });
    }
    if (job.whole) {
      const silent = path.join(dir, "silent.mp4"), mix = path.join(dir, "mix.m4a"), final = path.join(dir, "final.mp4");
      const res = await renderParallel({ timelinePath: tlPath, out: silent, workers: job.pages ?? 1 });
      await get(job.whole.mixUrl, mix);
      const p = spawnSync(FF, ["-v", "error", "-y", "-i", silent, "-i", mix, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", final], { encoding: "utf8" });
      if (p.status !== 0) throw new Error(`mux failed: ${p.stderr.slice(-400)}`);
      if (job.whole.upload) await put(job.whole.upload, final, "video/mp4");
      chunks.push({ whole: true, frames: res.frames, msPerFrame: res.msPerFrame, loadS: res.loadS, bytes: fs.statSync(final).size });
    }
    lap("render", t);
    report = { ok: true, mode, renderer: gl, host: process.env.RUNPOD_POD_ID ? `runpod ${process.env.RUNPOD_POD_ID}` : os.hostname(), chunks, timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
  } catch (e) {
    report = { ok: false, code: e.code ?? "RENDER_FAILED", error: String(e.message).slice(0, 1500), timing: { ...timing, total: +((Date.now() - t0) / 1000).toFixed(2) } };
  }
  if (job?.uploads?.report) { const f = path.join(os.tmpdir(), "bw-report.json"); fs.writeFileSync(f, JSON.stringify(report)); await put(job.uploads.report, f, "application/json").catch(() => {}); }
  return report;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : process.env.JOB_FILE ? JSON.parse(fs.readFileSync(process.env.JOB_FILE, "utf8")) : { jobUrl: process.env.JOB_URL };
  const result = input.job ? await runJob(input.job) : await staging(input);
  // the exit waits for the line to be written: to a pipe, stdout is async and process.exit() cut a big RESULT (the
  // inline stills, 2026-11-08: handler.py got "Unterminated string" at char 353)
  process.stdout.write(`RESULT ${JSON.stringify(result)}\n`, () => process.exit(result.ok ? 0 : 1));
}
