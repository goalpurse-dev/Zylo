// Phase 6c — the Scenes step: bible -> beat director -> draw every scene,
// never stuck (heartbeat budgets, resume once-per-budget, clear failure),
// plain-word warnings, and credits per scene by tier.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { decideScenes, drawingEta, plainWarning, plainWarnings, sceneCredits, segmentForWord, sceneSummary, SCENE_CONCURRENCY, SCENES_MAX_RESUMES, type ScenesInput } from "../../supabase/functions/_shared/stickman/scenes.ts";

const T0 = "2026-09-28T20:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const noImages = { queued: 0, rendering: 0, renderingExpired: [], ready: 0, failed: 0, total: 0 };
const input = (o: Partial<ScenesInput> & { nowS: number }): ScenesInput => ({
  now: at(o.nowS), scenes: { status: "running", startedAt: T0, resumes: 0, dispatched: {}, ...(o.scenes ?? {}) } as any,
  bible: o.bible === undefined ? { id: "b", status: "frozen", created_at: T0 } : o.bible, plan: o.plan ?? null, images: o.images ?? noImages, tier: o.tier ?? "V2",
});
const plan = (o: any = {}) => ({ id: "p1", status: "ready_with_warnings", created_at: at(10), beatCount: 120, ...o });
const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));

Deno.test("chain: bible (if needed) -> beat plan -> create scenes -> draw 6 at a time -> done, no clicks", () => {
  assertEquals(decideScenes(input({ nowS: 0, bible: null })).action.kind, "build_bible");
  assertEquals(decideScenes(input({ nowS: 1 })).action, { kind: "build_beats", resume: false });
  assertEquals(decideScenes(input({ nowS: 60, scenes: { dispatched: { beats: at(1) } } as any, plan: plan({ status: "building" }) })).action.kind, "wait");
  assertEquals(decideScenes(input({ nowS: 170, plan: plan() })).action, { kind: "create_scenes", planId: "p1" });
  const d = decideScenes(input({ nowS: 175, plan: plan(), images: { ...noImages, queued: 120, total: 120 } }));
  assertEquals(d.action, { kind: "draw", planId: "p1", slots: SCENE_CONCURRENCY, requeue: [], fail: [] });
  assertEquals(d.stage, "drawing");
  // 6 drawing, none free -> wait; one lands -> one more slot.
  assertEquals(decideScenes(input({ nowS: 180, plan: plan(), images: { ...noImages, queued: 114, rendering: 6, total: 120 } })).action.kind, "wait");
  assertEquals((decideScenes(input({ nowS: 185, plan: plan(), images: { ...noImages, queued: 113, rendering: 5, ready: 2, total: 120 } })).action as any).slots, 1);
  // Every scene settled (a failed scene is flagged on the review page, not a run failure).
  // 2026-10-07: the failed ones get one free second pass first; after it the run is done with them covered.
  const settled = { ...noImages, ready: 118, failed: 2, total: 120 };
  assertEquals(decideScenes(input({ nowS: 400, plan: plan(), images: settled })).action, { kind: "retry_failed", planId: "p1" });
  const done = decideScenes(input({ nowS: 600, plan: plan(), scenes: { secondPassAt: at(400) } as any, images: settled }));
  assertEquals(done.action.kind, "done");
  assertEquals(decideScenes(input({ nowS: 400, plan: plan(), images: { ...noImages, ready: 120, total: 120 } })).action.kind, "done");
});

Deno.test("watchdog: a stalled beat plan or bible is resumed, then the run stops with a clear Retry", () => {
  const stalled = decideScenes(input({ nowS: 1000, scenes: { dispatched: { beats: at(1) } } as any, plan: plan({ status: "building", created_at: at(1) }) }));
  assertEquals(stalled.action, { kind: "build_beats", resume: true });
  const capped = decideScenes(input({ nowS: 1000, scenes: { resumes: SCENES_MAX_RESUMES, dispatched: { beats: at(1) } } as any, plan: plan({ status: "building", created_at: at(1) }) }));
  assertEquals(capped.action.kind, "fail");
  assertEquals(decideScenes(input({ nowS: 500, bible: { id: "b", status: "failed", created_at: T0 }, scenes: { dispatched: { bible: at(1) } } as any })).action, { kind: "build_bible", resume: true });
});

Deno.test("6c e2e fixes: a plan that failed VALIDATION stops with Retry (no paid re-runs); a recent lock's bible build counts as in flight; auto fast cuts are never flags", () => {
  const failedPlan = plan({ status: "failed", errorCode: "WINDOW_VALIDATION_FAILED" });
  assertEquals(decideScenes(input({ nowS: 300, scenes: { dispatched: { beats: at(1) } } as any, plan: failedPlan })).action.kind, "fail");
  // A stalled/provider-failed plan is still resumed.
  assertEquals(decideScenes(input({ nowS: 300, scenes: { dispatched: { beats: at(1) } } as any, plan: plan({ status: "failed", errorCode: "STALLED" }) })).action, { kind: "build_beats", resume: true });
  // Bible dispatched by the lock 30 s ago -> wait (no second build).
  assertEquals(decideScenes(input({ nowS: 30, bible: null, scenes: { dispatched: { bible: at(0) } } as any })).action.kind, "wait");
  assertMatch(read("supabase/functions/start-long-form-autopilot/index.ts"), /dispatched: lockedRecently \? \{ bible: sv\.locked_at \} : \{\}/);
  assertEquals(plainWarnings([{ code: "auto_punch" }]), []);
  // Retry (free) looks only at plans made after the retry — the failed one is never picked up again.
  assertMatch(read("supabase/functions/_shared/stickman/scenesState.ts"), /\.gte\("created_at", \(sc as any\)\.retriedAt \?\? sc\.startedAt\)/);
  assertMatch(read("supabase/functions/start-long-form-autopilot/index.ts"), /status: "running", resumes: 0, dispatched: \{\}, failedReason: null, retries: \(sc\.retries \?\? 0\) \+ 1, retriedAt: now/);
  // After Retry the plan is missing again -> a fresh build (not a resume, not a failure).
  assertEquals(decideScenes(input({ nowS: 5, scenes: { retriedAt: at(0), dispatched: {} } as any, plan: null })).action, { kind: "build_beats", resume: false });
});

Deno.test("watchdog: a scene whose worker died is re-queued (twice), then marked failed (never a forever spinner)", () => {
  // 2026-10-07: attempts count worker deaths only; a deferred retry (attempts 0, lease over) is queued again like any other.
  const d = decideScenes(input({ nowS: 600, plan: plan(), images: { ...noImages, queued: 0, rendering: 2, renderingExpired: [{ id: "a", attempts: 2 }, { id: "b", attempts: 3 }], ready: 118, total: 120 } }));
  assertEquals(d.action, { kind: "draw", planId: "p1", slots: 1, requeue: ["a"], fail: ["b"] });
});

Deno.test("ETA range from measured timings; credits per scene by tier", () => {
  // V2: 9.7-12.1 s per scene at 6 at a time (136 scenes measured in 229 s).
  const [lo, hi] = drawingEta(136, "V2");
  assert(lo >= 200 && lo <= 240 && hi > lo, `${lo}-${hi}`);
  assertEquals([sceneCredits("V2"), sceneCredits("V3"), sceneCredits("V4")], [1, 4, 5]); // Phase 7: scene REGENERATE add-on prices
});

Deno.test("plain words only: warning codes, summaries and sections read like a person wrote them", () => {
  assertEquals(plainWarning("viewer_missing"), "The main character may be missing");
  // Director notes never flag a scene; only real image problems do.
  assertEquals(plainWarnings([{ code: "subject_run" }, { code: "subject_repeat" }, { code: "concept_without_device" }]), []);
  assertEquals(plainWarnings(["image_failed", "duplicate", "text_mismatch"]).length, 3);
  for (const code of ["ungrounded_name", "concept_without_device", "crowd_without_group", "short_text_rate", "establishing_without_place", "something_new"]) assert(!/_/.test(plainWarning(code)), code);
  assertEquals(sceneSummary({ userSummary: "Viewer's hands grip a shield rim. Then more." }), "Viewer's hands grip a shield rim.");
  const segs = [{ id: "s1", text: "one two three", chapterId: "c1" }, { id: "s2", text: "four five", chapterId: "c2" }];
  assertEquals(segmentForWord(segs, 3)?.chapterId, "c2");
});

Deno.test("server-side + display-only wiring", () => {
  const adv = read("supabase/functions/advance-long-form-autopilot/index.ts");
  assertMatch(adv, /if \(ap\.phase === "scenes"\) return await advanceScenes/);
  assertMatch(adv, /render-long-form-scene/);
  const worker = read("supabase/functions/render-long-form-scene/index.ts");
  assert(!/commitReservationSpend/.test(worker)); // Phase 7 fixed quote: the scene worker never touches the reservation
  assertMatch(worker, /refundSceneAddon/); // a paid redraw that fails is refunded
  assertMatch(worker, /claim_long_form_scene_image/);
  assert(!/toTarget\(|\.encodeJPEG\(/.test(worker), "no full-size re-encode at the edge");
  const upd = read("supabase/functions/update-long-form-scene/index.ts");
  assertMatch(upd, /IP_MARKS\.test\(description\) \|\| IP_LOOKALIKE\.test\(description\)/);
  assertMatch(upd, /compileBeatPrompt\(/);
  const page = read("src/pages/workspace/long-form/scenes.jsx");
  assert(!/visualConcept|positivePrompt|lintErrors|beat_plan_version_id/.test(page), "no internal fields on the page");
});
