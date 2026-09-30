// Phase 6a — the Stickman autopilot: chain, watchdog/resume, never backwards.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { decideAutopilot, MAX_RESUMES, STAGE_SECONDS, type AutopilotInput } from "../../supabase/functions/_shared/stickman/autopilot.ts";

const T0 = "2026-09-28T15:00:00.000Z";
const at = (s: number) => new Date(Date.parse(T0) + s * 1000).toISOString();
const input = (over: Partial<AutopilotInput> & { nowS: number }): AutopilotInput => ({
  now: at(over.nowS), autopilot: { status: "running", startedAt: T0, resumes: 0, ...(over.autopilot ?? {}) },
  plan: over.plan ?? null, research: over.research ?? null, script: over.script ?? null,
});
const plan = { id: "p1", created_at: at(80) };
const research = (o: any = {}) => ({ id: "r1", status: "researching", stage: "lite_verify", stage_started_at: at(100), worker_lock_until: null, created_at: at(82), ...o });
const script = (o: any = {}) => ({ id: "s1", status: "drafting", stage: "draft", stage_started_at: at(300), worker_lock_until: null, created_at: at(300), has_document: false, ...o });

Deno.test("chain: plan -> research -> script -> done, with NO user step in between", () => {
  assertEquals(decideAutopilot(input({ nowS: 1 })).action.kind, "generate_plan");
  assertEquals(decideAutopilot(input({ nowS: 30, autopilot: { dispatched: { plan: at(1) } } as any })).action.kind, "wait");
  assertEquals(decideAutopilot(input({ nowS: 81, plan })).action.kind, "start_research");
  assertEquals(decideAutopilot(input({ nowS: 120, plan, research: research(), autopilot: { dispatched: { plan: at(1), research: at(81) } } as any })).action.kind, "wait");
  // A thin research-lite result (needs_attention) is NOT a gate: straight on to the script.
  const d = decideAutopilot(input({ nowS: 260, plan, research: research({ status: "needs_attention", stage: "finalizing" }) }));
  assertEquals(d.action.kind, "start_script");
  assertEquals(d.uiStage, "write");
  // Nearly every Stickman script ends needs_attention — that's "ready for review", not a gate.
  const done = decideAutopilot(input({ nowS: 600, plan, research: research({ status: "needs_attention" }), script: script({ status: "needs_attention", stage: "finalizing", has_document: true }) }));
  assertEquals(done.action, { kind: "done", scriptVersionId: "s1" });
  assertEquals(done.progress, 1);
});

Deno.test("watchdog: no heartbeat for expected + 90 s -> resume from the checkpoint; a held worker lock is never 'stale'", () => {
  // Research stage started at 100 s; lite_verify budget 100 s + 90 s grace -> stale after 290 s.
  assertEquals(decideAutopilot(input({ nowS: 280, plan, research: research() })).action.kind, "wait");
  const stale = decideAutopilot(input({ nowS: 300, plan, research: research() }));
  assertEquals(stale.action.kind, "resume_research");
  assert(stale.stale);
  // Same age, but a worker holds the lock right now -> keep waiting.
  assertEquals(decideAutopilot(input({ nowS: 300, plan, research: research({ worker_lock_until: at(360) }) })).action.kind, "wait");
  // Script draft: 240 s + 90 s.
  assertEquals(decideAutopilot(input({ nowS: 300 + 331, plan, research: research({ status: "ready" }), script: script() })).action.kind, "resume_script");
  // A failed script is re-run (a resume), never left dead.
  assertEquals(decideAutopilot(input({ nowS: 700, plan, research: research({ status: "ready" }), script: script({ status: "failed" }) })).action.kind, "start_script");
});

Deno.test("after 2 failed resumes -> a clear failed state (Retry is free), never an endless loop", () => {
  const d = decideAutopilot(input({ nowS: 900, plan, research: research(), autopilot: { resumes: MAX_RESUMES } as any }));
  assertEquals(d.action.kind, "fail");
  assert((d.action as any).reason.includes("after 2 resumes"));
  const failed = decideAutopilot(input({ nowS: 950, plan, autopilot: { status: "failed", failedReason: "x" } as any }));
  assertEquals(failed.action.kind, "fail");
});

Deno.test("progress never goes backwards; ETA is an honest range from measured timings; stage text matches the real stage", () => {
  const early = decideAutopilot(input({ nowS: 5 }));
  assertEquals(early.uiStage, "plan");
  const [lo, hi] = early.etaSeconds;
  const all = Object.values(STAGE_SECONDS);
  assert(lo >= all.reduce((a, [t]) => a + t, 0) - 10 && hi >= lo);
  // The stored max wins over a lower recomputed value (e.g. right after a stage switch).
  const d = decideAutopilot(input({ nowS: 81, plan, autopilot: { progressMax: 0.3 } as any }));
  assert(d.progress >= 0.3);
  // Mid-script the UI says Fact-checking during claim_verify — never "Wrapping up" in phase 1.
  assertEquals(decideAutopilot(input({ nowS: 500, plan, research: research({ status: "ready" }), script: script({ stage: "claim_verify", stage_started_at: at(480) }) })).uiStage, "verify");
  assertEquals(decideAutopilot(input({ nowS: 120, plan, research: research({ stage: "finalizing" }) })).uiStage, "research");
});

// 3f65a0c7: the script worker went critic (Polishing) -> back to a draft/verify stage and the
// step list jumped backwards. The furthest stage reached (stageMax) wins; progress stays monotonic.
Deno.test("the step list never goes backwards: stageMax holds Polishing when the worker returns to a draft", () => {
  const polishing = decideAutopilot(input({ nowS: 700, plan, research: research({ status: "ready" }), script: script({ status: "critiquing", stage: "critic", stage_started_at: at(650) }) }));
  assertEquals(polishing.uiStage, "polish");
  const back = input({ nowS: 720, plan, research: research({ status: "ready" }), script: script({ status: "drafting", stage: "draft", stage_started_at: at(715) }) });
  back.autopilot = { ...back.autopilot, stageMax: polishing.uiStage, progressMax: polishing.progress };
  const d = decideAutopilot(back);
  assertEquals(d.uiStage, "polish");
  assert(d.progress >= polishing.progress);
  // Without a recorded max (a brand-new chain) the worker's own stage is shown.
  assertEquals(decideAutopilot(input({ nowS: 720, plan, research: research({ status: "ready" }), script: script({ stage: "draft", stage_started_at: at(715) }) })).uiStage, "write");
});
