// A scene never fails on its first error, and a scene that can't be drawn never
// holds the video up (2026-10-07).
//
// What happened (6-7 Oct): Runware refused draws for six hours. A scene stopped
// after three quick tries, the edit refused to open while any scene had no
// picture, and the render refused "N scenes still need a picture": one user's
// video sat at 131 of 132 scenes with 250 credits held.
//
// Now: the normal prompt -> 3 retries with growing waits (5 s, 20 s, 60 s, plus
// jitter) -> the simplified safe prompt -> the safe prompt on the backup model ->
// COVERED: the scene is marked failed, and the picture before it stays on screen
// over its time with a different, gentle move. The editor and the render take
// the covered version; "Try again (free)" later puts the real picture in.
// A failed upscale never fails a scene. Everything here is $0 (stubbed draws).
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { BACKUP_TIER, classifyFailure, climbLadder, fitsInProcess, ladderOf, nextRung, PROVIDER_TIMEOUT_MS, SAFE_STEP, SCENE_LADDER, type LadderState, type RungKind } from "../../supabase/functions/_shared/stickman/sceneLadder.ts";
import { SCENE_LEASE_S, SCENE_MAX_ATTEMPTS } from "../../supabase/functions/_shared/stickman/scenes.ts";
import { buildInitialEdit, coverMissingScenes, coverMotions, coveredClips, validateEdit, withEnds, COVER_MOTION_SPEED } from "../../src/lib/stickmanEdit.js";
import { compileEdit } from "../../supabase/functions/_shared/stickman/editRender.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const E504 = "Error: runware 504: \"Gateway Timeout\"";
const ETIMEOUT = "TimeoutError: The signal has been aborted";
const EINTERNAL = "Error: runware 200: [{\"code\":\"internalError\",\"message\":\"Internal error\"}]";
const EBALANCE = "Error: runware 200: [{\"message\":\"Insufficient available balance. Some of your credits are currently reserved for requests in progress\"}]";
const ESAFETY = "Error: runware 200: [{\"code\":\"providerError\",\"message\":\"Blocked by the provider's safety filter\"}]";
const EPROMPT = "Error: prompt check: relative_reference";

// One worker's climb against a scripted provider. `script` is what each draw does, in order.
type Step = "ok" | "check" | string;
async function climb(script: Step[], opts: { state?: LadderState; canDefer?: boolean; secondsPerDraw?: number } = {}) {
  const state = opts.state ?? ladderOf(null);
  const drawn: RungKind[] = [], waits: number[] = [];
  let clock = 0, renewed = 0, i = 0;
  const out = await climbLadder<{ failed: boolean }>({
    state, canDefer: opts.canDefer ?? true, rand: () => 0,
    draw: (rung) => { drawn.push(rung); clock += opts.secondsPerDraw ?? 8; const s = script[i++] ?? "ok"; if (s === "ok") return Promise.resolve({ failed: false }); if (s === "check") return Promise.resolve({ failed: true }); return Promise.reject(new Error(s.replace(/^Error: /, ""))); },
    sleep: (ms) => { waits.push(ms / 1000); clock += ms / 1000; return Promise.resolve(); },
    renewLease: () => { renewed++; return Promise.resolve(); },
    elapsedS: () => clock,
  });
  return { out, state, drawn, waits, renewed };
}

Deno.test("the ladder: normal, 3 retries after 5 s / 20 s / 60 s, the safe prompt, the backup model", () => {
  assertEquals(SCENE_LADDER.map((r) => `${r.kind}:${r.waitS}`), ["normal:0", "normal:5", "normal:20", "normal:60", "safe:0", "backup:0"]);
  assertEquals(BACKUP_TIER, { V2: "V3", V3: "V2", V4: "V2" });
  // Jitter only ever adds (up to a quarter).
  assertEquals((nextRung(2, "provider", 0, () => 0) as any).waitS, 60);
  assertEquals((nextRung(2, "provider", 0, () => 1) as any).waitS, 75);
  // What kind of failure it was.
  for (const e of [E504, ETIMEOUT, EINTERNAL, "TypeError: error sending request", "Error: qa 500", "Error: fetch 502"]) assertEquals(classifyFailure(e), "provider", e);
  assertEquals(classifyFailure(EBALANCE), "balance");
  assertEquals(classifyFailure(ESAFETY), "safety");
  assertEquals(classifyFailure(EPROMPT), "prompt");
  assertEquals(classifyFailure("image_failed"), "check");
  // A hung provider call ends inside the scene's lease (the proxy alone would wait 170 s).
  assert(PROVIDER_TIMEOUT_MS / 1000 < SCENE_LEASE_S);
});

Deno.test("one 504 is not a failed scene: it is drawn on the first retry, 5 s later", async () => {
  const { out, drawn, waits, state } = await climb([E504, "ok"]);
  assertEquals(out.kind, "drawn");
  assertEquals(drawn, ["normal", "normal"]);
  assertEquals(waits, [5]);
  assertEquals(state.failures.length, 1);
});

Deno.test("504, timeout, internalError in a row: each retry waits longer; the 60 s wait is handed on, never slept through", async () => {
  const first = await climb([E504, ETIMEOUT, EINTERNAL]);
  assertEquals(first.drawn, ["normal", "normal", "normal"]);
  assertEquals(first.waits, [5, 20]);
  assertEquals(first.out, { kind: "deferred", result: null, waitS: 60 });
  assertEquals(first.state.step, 3, "the step is kept for the next worker");
  assert(first.renewed === 2, "the lease is renewed before every further draw");
  // The next worker carries on from the kept step: third retry, safe prompt, backup model.
  const second = await climb([E504, E504, "ok"], { state: ladderOf({ ladder: first.state }) });
  assertEquals(second.drawn, ["normal", "safe", "backup"]);
  assertEquals(second.out.kind, "drawn");
  assertEquals((second.out as any).rung, "backup");
  assertEquals(second.waits, [], "the safe prompt and the backup model don't wait");
});

Deno.test("a scene that ALWAYS fails ends covered after exactly 6 draws (never a loop, never a raw error)", async () => {
  const first = await climb(Array(9).fill(E504));
  const second = await climb(Array(9).fill(E504), { state: ladderOf({ ladder: first.state }) });
  assertEquals([...first.drawn, ...second.drawn], ["normal", "normal", "normal", "normal", "safe", "backup"]);
  assertEquals(second.out.kind, "covered");
  assertEquals(second.state.failures.length, 6);
  assert(second.state.failures[4].startsWith("safe: ") && second.state.failures[5].startsWith("backup: "));
});

Deno.test("a refusal of the prompt (safety, our prompt rule) goes straight to the safe prompt; waiting would change nothing", async () => {
  for (const e of [ESAFETY, EPROMPT]) {
    const { drawn, waits, out } = await climb([e, "ok"]);
    assertEquals(drawn, ["normal", "safe"], e);
    assertEquals(waits, []);
    assertEquals((out as any).rung, "safe");
  }
  assertEquals(nextRung(SAFE_STEP, "safety", 0), { covered: false, step: SAFE_STEP + 1, waitS: 0 });
  assertEquals(nextRung(SAFE_STEP + 1, "safety", 0), { covered: true });
});

Deno.test("our own image checks: one more normal draw, then the safe prompt, then the backup model (no waits)", async () => {
  const { drawn, waits, out } = await climb(["check", "check", "check", "check"]);
  assertEquals(drawn, ["normal", "normal", "safe", "backup"]);
  assertEquals(waits, []);
  assertEquals(out.kind, "covered");
});

Deno.test("a balance refusal is not a step: the scene waits where it is and drawing pauses", async () => {
  const { out, state, drawn } = await climb([E504, EBALANCE]);
  assertEquals(out.kind, "balance");
  assertEquals(drawn.length, 2);
  assertEquals(state.step, 1, "it carries on from the same retry when the balance is back");
});

Deno.test("slow draws: the worker hands the scene on instead of running past its time", async () => {
  // Two 60 s draws: the next step no longer fits, so it is deferred with no wait (the watchdog queues it at once).
  const slow = await climb([E504, E504, "ok"], { secondsPerDraw: 60 });
  assertEquals(slow.drawn.length, 2);
  assertEquals(slow.out.kind, "deferred");
  assertEquals(fitsInProcess(20, 60, true), "defer");
  assertEquals(fitsInProcess(20, 20, true), "run");
  // A split scene's own picture is not watched by the autopilot: it does every step itself.
  const split = await climb(Array(9).fill(E504), { canDefer: false });
  assertEquals(split.drawn.length, 6);
  assertEquals(split.waits, [5, 20, 60]);
  assertEquals(split.out.kind, "covered");
  assertEquals(fitsInProcess(280, 60, false), "stop");
});

// ---------------- the covered scene in the edit and the render ----------------
const scene = (n: number, startMs: number, drawn = true) => ({ sceneId: drawn ? `s${n}` : null, imageVersion: drawn ? 1 : null, number: n, startMs, narration: `line ${n}`, imageUrl: drawn ? `https://x/${n}.jpg` : null, overlay: drawn ? null : { text: "LOST", x: 0, y: 0 }, camera: null });
const words = Array.from({ length: 400 }, (_, i) => ({ text: `w${i}`, startMs: i * 250, endMs: i * 250 + 200 }));
const audio = { url: "https://x/a.mp3", durationMs: 30_000 };
const build = (scenes: any[]) => buildInitialEdit({ scenes, words, audio, narrationId: "n1", seed: "p1" });

Deno.test("covered: the picture before stays on screen over the failed scene's time, with a different gentle move", () => {
  const doc = build([scene(1, 0), scene(2, 5000), scene(3, 10000, false), scene(4, 15000), scene(5, 20000)]);
  assertEquals(validateEdit(doc), [], "a valid edit: the editor opens and the render starts");
  assertEquals(doc.clips.length, 5, "the failed scene keeps its place and its time (no hole, nothing shifts)");
  const c = doc.clips[2];
  assertEquals([c.beatSequence, c.covered, c.coveredBy], [3, true, 2]);
  assertEquals([c.image, c.sceneId, c.imageVersion], ["https://x/2.jpg", "s2", 1], "scene 2's picture (and its full-size master)");
  assertEquals(c.startMs, 10000);
  assert(c.motion !== doc.clips[1].motion, `a different move than the clip before (${c.motion})`);
  assertEquals(c.motionSpeed, COVER_MOTION_SPEED, "a subtle one");
  assertEquals(doc.texts.length, 0, "the words planned for the lost picture are not put on another one");
  assertEquals(coveredClips(doc).map((x: any) => x.beatSequence), [3]);
  // The render compiles it like any other clip.
  const seq = compileEdit(doc, words);
  assertEquals(seq.clips.length, 5);
  assertEquals(seq.clips[2].image, "https://x/2.jpg");
});

Deno.test("covered: the very first scene takes the next picture; several in a row all take the last good one", () => {
  const first = build([scene(1, 0, false), scene(2, 5000), scene(3, 10000)]);
  assertEquals(validateEdit(first), []);
  assertEquals([first.clips[0].covered, first.clips[0].image, first.clips[0].coveredBy], [true, "https://x/2.jpg", 2]);
  const run = build([scene(1, 0), scene(2, 5000, false), scene(3, 10000, false), scene(4, 15000, false), scene(5, 20000)]);
  assertEquals(validateEdit(run), []);
  assertEquals(run.clips.map((c: any) => c.image), ["https://x/1.jpg", "https://x/1.jpg", "https://x/1.jpg", "https://x/1.jpg", "https://x/5.jpg"]);
  for (let i = 1; i <= 3; i++) assert(run.clips[i].motion !== run.clips[i - 1].motion, `clip ${i} moves differently from clip ${i - 1}`);
  // No picture at all is the one case with nothing to show (the run is refunded instead).
  assertEquals(coverMissingScenes([scene(1, 0, false), scene(2, 5000, false)]), []);
  // The user's own choice of move on a covered clip is kept.
  const manual = coverMotions({ ...run, clips: run.clips.map((c: any, i: number) => (i === 2 ? { ...c, motion: "hold", motionManual: true } : c)) });
  assertEquals(manual.clips[2].motion, "hold");
  assert(withEnds(run).every((c: any) => c.endMs > c.startMs));
});

Deno.test("wiring: the editor and the render never wait for a failed scene; a redraw replaces the cover", () => {
  const lib = read("supabase/functions/_shared/stickman/editDoc.ts");
  // Only scenes still queued / on a worker are waited for.
  assertMatch(lib, /const drawing = new Set\(\(imgs \?\? \[\]\)\.filter\(\(i: any\) => i\.status === "queued" \|\| i\.status === "rendering"\)\.map\(\(i: any\) => i\.beat_sequence\)\);/);
  assertMatch(lib, /if \(scenes\.some\(\(s: any\) => !s\.imageUrl && drawing\.has\(s\.number\)\)\) return \{ ok: false, status: 409/);
  assertMatch(lib, /"edit_covered_scenes"/);
  // "Try again (free)" later: the clip gets its own picture and its own words back.
  assertMatch(lib, /if \(c\.covered\) \{[\s\S]{0,420}const \{ covered: _c, coveredBy: _b, \.\.\.rest \} = c;[\s\S]{0,300}return \{ \.\.\.rest, image: s\.image_url, sceneId: s\.id, imageVersion: s\.version, motionSpeed: 1 \};/);
  const render = read("supabase/functions/long-form-render/index.ts");
  assert(!/still need\$\{|still needs its picture|A finished video never has an empty or failed scene/.test(render), "no refusal for a scene's picture");
  assertMatch(render, /"render_with_covered_scenes"/);
  assertMatch(render, /const usable = \(scenes \?\? \[\]\)\.filter\(\(s: any\) => s\.image_url && s\.status === "ready"\);/);
});

Deno.test("wiring: the worker climbs the ladder, keeps the step on the row, and never fails a scene for its upscale", () => {
  const w = read("supabase/functions/render-long-form-scene/index.ts");
  assertMatch(w, /const climb = \(\) => climbLadder\(\{/);
  assertMatch(w, /const drawTier = rung === "backup" \|\| useBackupModel \? BACKUP_TIER\[tier\] : tier;/);
  assertMatch(w, /const contract = rung !== "normal" \|\| textFree \? safeFallbackContract\(beat\.contract, set\) : beat\.contract;/);
  assertMatch(w, /signal: AbortSignal\.timeout\(PROVIDER_TIMEOUT_MS\)/);
  // Deferred: the row keeps its lease for the wait, the attempt is not counted, the step is kept.
  assertMatch(w, /lease_until: new Date\(Date\.now\(\) \+ deferS \* 1000\)\.toISOString\(\), attempts: notCounted, cost_usd: costUsd, qa: \{ waiting: overloadWaitS != null \? "high_demand" : "retry", ladder: ladderState, /);
  // Out of balance: back to the queue with the step kept.
  assertMatch(w, /status: "queued", lease_until: null, attempts: notCounted, cost_usd: costUsd, qa: \{ waiting: "provider_balance", ladder: ladderState, /);
  // Covered: failed on the row (the card says "Try again (free)"), logged, a paid redraw refunded.
  assertMatch(w, /status: "failed", error: "image_failed", cost_usd: costUsd, qa: \{ covered: true,/);
  assertEquals(w.match(/"scene_covered"/g)?.length, 2, "the ladder's end and the unexpected-error path");
  assertMatch(w, /await refundSceneAddon\(scene\);\s+return \{ failed: true \};/);
  // Upscale: one retry, then the original picture is kept and logged.
  const post = w.slice(w.indexOf("postProcess: async (url) => {"), w.indexOf("// The text is an editable layer"));
  assertMatch(post, /for \(let attempt = 1; attempt <= 2; attempt\+\+\)/);
  assertMatch(post, /"scene_upscale_skipped"/);
  assertMatch(post, /return \{ bytes: kept, cost: 0 \};/);
  assert(!/throw/.test(post), "the upscale step never throws");
  assertMatch(w, /\.\.\.\(upscaleSkipped \? \{ upscaleSkipped \} : \{\}\)/);
  // The watchdog counts worker deaths only.
  assertEquals(SCENE_MAX_ATTEMPTS, 3);
  // The scene card and the paused line are already there.
  const ui = read("src/pages/workspace/long-form/scenes.jsx");
  assertMatch(ui, /Try again \(free\)/);
});

// ---------------- an outage is waited out; one bad scene is covered; no scene at all is refunded ----------------
import { outageDecision, OUTAGE_MAX_REQUEUES, OUTAGE_MAX_S, providerOnly } from "../../supabase/functions/_shared/stickman/sceneLadder.ts";
import { decideScenes, type ScenesInput } from "../../supabase/functions/_shared/stickman/scenes.ts";
import { heldUntil, isFresh, mayAlert, REFUSAL_HOLD_S, guardDecision as guard } from "../../supabase/functions/_shared/runwareBalance.ts";

Deno.test("the provider is DOWN (every step failed, nothing finished anywhere lately): the scene waits, it is not covered", () => {
  const NOW = Date.parse("2026-10-07T01:00:00.000Z");
  const all504 = ["x 504", "x 504", "x 504", "x 504", "safe: x 504", "backup: TimeoutError: aborted"];
  assert(providerOnly(all504));
  assertEquals(outageDecision({ failures: all504, readyLately: 0, pendingOthers: 5, outage: null, nowMs: NOW }), { kind: "wait", outage: { count: 1, since: "2026-10-07T01:00:00.000Z" } });
  // Other scenes ARE being drawn: it is this scene, so it is covered.
  assertEquals(outageDecision({ failures: all504, readyLately: 3, pendingOthers: 5, outage: null, nowMs: NOW }).kind, "cover");
  // The only scene left is covered at once: a finished video never waits for one picture.
  assertEquals(outageDecision({ failures: all504, readyLately: 0, pendingOthers: 0, outage: null, nowMs: NOW }).kind, "cover");
  // A scene refused for what it shows, or failing our own checks, is never an outage.
  assertEquals(outageDecision({ failures: ["x 504", "safe: image_failed", "backup: image_failed"], readyLately: 0, pendingOthers: 5, outage: null, nowMs: NOW }).kind, "cover");
  assert(!providerOnly(["Error: prompt check: relative_reference", "safe: x 504"]));
  // It does not wait for ever: a few rounds, six hours at most, then it is covered (and the run can end / refund).
  assertEquals(outageDecision({ failures: all504, readyLately: 0, pendingOthers: 5, outage: { count: OUTAGE_MAX_REQUEUES, since: "2026-10-07T00:10:00.000Z" }, nowMs: NOW }).kind, "cover");
  assertEquals(outageDecision({ failures: all504, readyLately: 0, pendingOthers: 5, outage: { count: 1, since: new Date(NOW - OUTAGE_MAX_S * 1000 - 1000).toISOString() }, nowMs: NOW }).kind, "cover");
  const w = read("supabase/functions/render-long-form-scene/index.ts");
  assertMatch(w, /status: "queued", lease_until: null, attempts: notCounted, cost_usd: costUsd, qa: \{ waiting: "provider_outage", outage: od\.outage,/);
  // The count survives a deferred retry and a balance wait (the chaos run found it was being lost: a scene could wait for ever).
  assertEquals(w.match(/ladder: ladderState, \.\.\.keepOutage \}/g)?.length, 2);
  assertMatch(w, /await markProviderDown\(admin, /);
});

Deno.test("a refusal holds the pause for 5 minutes (on 6-7 Oct it resumed every minute for six hours); one alert an hour at most", () => {
  const now = "2026-10-07T01:00:00.000Z";
  const until = heldUntil(now);
  assertEquals(REFUSAL_HOLD_S, 300);
  // The guard treats the held reading as fresh, so nothing is claimed, until the hold is over.
  assert(isFresh(until, "2026-10-07T01:04:50.000Z"));
  assert(!isFresh(until, "2026-10-07T01:05:01.000Z"));
  // After the hold a fresh balance decides again (above the threshold: resume by itself).
  assertEquals(guard({ threshold_usd: 15, balance_usd: 40, checked_at: until, paused: true, paused_since: now, alerted_at: now }, 40, "2026-10-07T01:05:05.000Z").resumed, true);
  assertEquals(guard({ threshold_usd: 15, balance_usd: 9, checked_at: until, paused: true, paused_since: now, alerted_at: now }, 9, "2026-10-07T01:05:05.000Z").paused, true);
  assert(mayAlert(null, now) && !mayAlert("2026-10-07T00:30:00.000Z", now) && mayAlert("2026-10-06T23:59:00.000Z", now));
  const g = read("supabase/functions/_shared/runwareBalance.ts");
  assertEquals(g.match(/checked_at: heldUntil\(now\)/g)?.length, 2, "an out-of-balance refusal and an outage both hold");
});

const T = "2026-10-07T01:00:00.000Z";
const scenesInput = (images: Partial<ScenesInput["images"]>, scenes: any = {}): ScenesInput => ({
  now: T, scenes: { status: "running", startedAt: T, resumes: 0, dispatched: {}, ...scenes }, bible: { id: "b", status: "frozen", created_at: T },
  plan: { id: "p1", status: "ready", created_at: T, beatCount: 10 }, images: { queued: 0, rendering: 0, renderingExpired: [], ready: 0, failed: 0, total: 10, ...images }, tier: "V2",
});

Deno.test("the run's end: failed scenes get ONE free second pass; with not one scene drawn the run fails (and the hold goes back)", () => {
  assertEquals(decideScenes(scenesInput({ ready: 8, failed: 2 })).action, { kind: "retry_failed", planId: "p1" });
  assertEquals(decideScenes(scenesInput({ ready: 8, failed: 2 }, { secondPassAt: T })).action.kind, "done", "one pass, never a loop");
  assertEquals(decideScenes(scenesInput({ ready: 0, failed: 10 }, { secondPassAt: T })).action, { kind: "fail", reason: "no scene could be drawn" });
  // No scene finished for six hours (a provider that stays down, our balance left empty): the drawing stops waiting.
  const stuck = (h: number, scenes: any = {}) => decideScenes({ ...scenesInput({ queued: 6, ready: 4, lastProgressAt: new Date(Date.parse(T) - h * 3600 * 1000).toISOString() }, scenes) }).action.kind;
  assertEquals([stuck(5), stuck(6.1), stuck(6.1, { gaveUpAt: T })], ["draw", "give_up_drawing", "draw"]);
  assertEquals(decideScenes(scenesInput({ ready: 4, failed: 6 }, { gaveUpAt: T })).action.kind, "done", "no second pass after giving up");
  assertEquals(decideScenes(scenesInput({ ready: 0, failed: 10 }, { gaveUpAt: T })).action.kind, "fail");
  // A redraw of single scenes on a finished video ends as before (no second pass, never a refund of the whole video).
  assertEquals(decideScenes(scenesInput({ ready: 9, failed: 1 }, { regenerating: true })).action.kind, "done");
  const a = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assertMatch(a, /case "retry_failed": \{[\s\S]{0,300}\(sc as any\)\.secondPassAt = now;[\s\S]{0,400}\.eq\("is_current", true\)\.eq\("status", "failed"\)/);
  // The failed run goes through the one place that gives the whole hold back when no scene exists.
  assertMatch(a, /await logEvent\("advance-long-form-autopilot", "error", "scenes_failed"[\s\S]{0,400}await releaseIfNoVideoPossible\(projectId, ap, a\.reason, now\);/);
});
