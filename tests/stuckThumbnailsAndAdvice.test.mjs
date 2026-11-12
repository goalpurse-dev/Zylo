import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { traceLimitWaitMs, TRACE_LIMIT_MAX_WAITS, stuckEmailNow, STUCK_BURST } from "../supabase/functions/_shared/stuckJobs.ts";
import { SERVICES, judge, failureKind, countFailureKinds, stuckJobsLines, dailyReport } from "../supabase/functions/_shared/opsHealth.js";

// 2026-11-07: idea thumbnails (image:flux2.klein9bkv, free) were left "running" when Supabase's
// per-chain call limit refused the hand-off to runware-image; the sweeper refunded them 30 min
// later and emailed each time. The alert for real users' failures said "top up" with $22 left.
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");
const runware = SERVICES.find((s) => s.id === "runware");

test("the per-chain call limit is recognised and its wait read; other errors are not", () => {
  const e = new Error("Rate limit exceeded for trace 01a1b70aed50797e89d8ff643dc4fbdd. Retry after 29930ms.");
  e.name = "RateLimitError";
  assert.equal(traceLimitWaitMs(e), 29930);
  assert.equal(traceLimitWaitMs("RateLimitError: Rate limit exceeded for trace x. Retry after 29254ms."), 29254);
  assert.equal(traceLimitWaitMs("RateLimitError: Rate limit exceeded for trace x."), 30000, "no hint: 30 s");
  assert.equal(traceLimitWaitMs("RateLimitError: Rate limit exceeded for trace x. Retry after 999999ms."), 90000, "capped");
  assert.equal(traceLimitWaitMs(new TypeError("error sending request: connection reset")), null);
  assert.ok(TRACE_LIMIT_MAX_WAITS >= 3);
});

test("job-worker puts a refused hand-off back in the queue instead of leaving it running", () => {
  const jw = read("supabase/functions/job-worker/index.ts");
  const i = jw.indexOf("handoff_fetch_threw"), j = jw.indexOf("mark_generation_reconciliation_required", i);
  const block = jw.slice(i, j);
  assert.match(block, /traceLimitWaitMs\(fetchErr\)/);
  assert.match(block, /status: "queued", progress: 0, retry_after:/);
  assert.match(block, /\.eq\("claimed_by", workerId\)\.eq\("status", "running"\)/);
  assert.match(block, /TRACE_LIMIT_MAX_WAITS/);
});

test("stuck jobs: an email at once only for a burst, and at most once an hour; else the daily email", () => {
  assert.equal(stuckEmailNow(2), false);
  assert.equal(stuckEmailNow(STUCK_BURST), true);
  const sw = read("supabase/functions/generation-sweeper/index.ts");
  assert.doesNotMatch(sw, /alertOnce\(admin, "stuck_jobs", 900/);
  assert.match(sw, /if \(stuckEmailNow\(recent\.length\)\)/);
  assert.match(sw, /alertOnce\(admin, "stuck_jobs_burst", STUCK_BURST_WINDOW_S/);
  const lines = stuckJobsLines([{ tool_key: "image:flux2.klein9bkv", details: { creditsRefunded: 0 } }, { tool_key: "image:flux2.klein9bkv", details: {} }, { tool_key: "video:x", details: { creditsRefunded: 5 } }]);
  assert.match(lines[0], /24 hours: 3, refunded automatically \(5 credits/);
  assert.match(lines[0], /image:flux2\.klein9bkv ×2, video:x ×1/);
  assert.match(stuckJobsLines([])[0], /none/);
  assert.match(dailyReport([], "2026-11-07T07:00:00Z", lines).text, /Stuck jobs in the last 24 hours: 3/);
  assert.match(read("supabase/functions/ops-health/index.ts"), /dailyReport\(results, now, await stuckLines\(\)\)/);
});

test("failure kinds: the user's own credits don't count; only a money refusal says top up", () => {
  assert.equal(failureKind("INSUFFICIENT_CREDITS", "You don't have enough credits for this."), "user");
  assert.equal(failureKind("STUCK_TIMEOUT", "This took too long on our side"), "stuck");
  assert.equal(failureKind("PROVIDER_GENERATION_FAILED", "The provider couldn't complete this generation."), "provider");
  assert.equal(failureKind(null, "Error: Runware (402) insufficient balance"), "balance");
  assert.equal(failureKind(null, "Error: prompt check: face_modifier_not_allowed"), "other");
  assert.deepEqual(countFailureKinds([{ code: "INSUFFICIENT_CREDITS" }, { code: "STUCK_TIMEOUT" }, { code: "PROVIDER_GENERATION_FAILED" }]), { stuck: 1, provider: 1 });
});

test("the 7:10 PM alert: 3 Runware internal errors with $22 left no longer says top up", () => {
  const j = judge(runware, { reachable: true, balance: 22.18, perDay: 5.8, failures: 3, failingUsers: 1, failureKinds: { provider: 3 } });
  assert.match(j.red[0], /3 failures for 1 real user in the last hour \(errors on Runware's side\)/);
  assert.doesNotMatch(j.todo, /Top up/);
  assert.match(j.todo, /not a balance problem/);
  const stuck = judge(runware, { reachable: true, balance: 22.18, perDay: 5.8, failures: 3, failingUsers: 2, failureKinds: { stuck: 3 } });
  assert.match(stuck.todo, /on our side/);
  assert.doesNotMatch(stuck.todo, /Top up/);
  const money = judge(runware, { reachable: true, balance: 22.18, perDay: 5.8, failures: 4, failingUsers: 2, failureKinds: { balance: 4 } });
  assert.match(money.todo, /Top up at my\.runware\.ai/);
  const low = judge(runware, { reachable: true, balance: 2, perDay: 6, failures: 3, failingUsers: 1, failureKinds: { provider: 3 } });
  assert.match(low.todo, /Top up/, "running out is still top up");
  assert.match(read("supabase/functions/ops-health/index.ts"), /failureKind\(j\.error_code, j\.error\) !== "user"/);
});
