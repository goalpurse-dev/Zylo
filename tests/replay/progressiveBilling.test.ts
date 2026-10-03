// Long Form: charge for work done (migration 20261022100000). The pure rules
// (mirroring close_long_form_reservation / commit_long_form_work_done) and their
// wiring. The live SQL is checked with real balances in tests/sql/progressive_billing.sql.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { billingOnClose, committedAfterWork, workCreditsFromUsd, CHEAPEST_CREDIT_USD } from "../../supabase/functions/_shared/longFormReservations.ts";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const QUOTE = 250; // a 10-minute V2 video
const hold = (o: Partial<{ mode: "fixed" | "progressive"; reserved: number; committed: number; workCredits: number; failedByUs: boolean }> = {}) =>
  ({ mode: "progressive" as const, reserved: QUOTE, committed: 0, workCredits: 0, failedByUs: false, ...o });

Deno.test("work credits = 2 x real cost at the cheapest credit ($0.02133), rounded up", () => {
  assertEquals(CHEAPEST_CREDIT_USD, 0.02133);
  assertEquals(workCreditsFromUsd(0), 0);
  assertEquals(workCreditsFromUsd(0.89), 84); // script + voice of the rain project
  assertEquals(workCreditsFromUsd(1.92), 181); // the whole rain project
  assertEquals(workCreditsFromUsd(4.52), 424); // the $4.52 test project
});

Deno.test("progressive commit after each step: grows with the work, never above the quote, never down", () => {
  let committed = 0;
  for (const usd of [0.18, 0.89, 1.4, 4.52]) committed = committedAfterWork({ ...hold({ committed }), workCredits: workCreditsFromUsd(usd) });
  assertEquals(committed, QUOTE); // capped at the quote shown on the Generate button
  assertEquals(committedAfterWork(hold({ committed: 120, workCredits: 80 })), 120); // never goes down
  assertEquals(committedAfterWork(hold({ mode: "fixed", workCredits: 200 })), 0); // existing holds: unchanged
});

Deno.test("delete mid-way: the work done is kept, the unused part comes back", () => {
  const h = hold({ committed: 84, workCredits: workCreditsFromUsd(0.95) }); // a little more landed since the last tick
  assertEquals(billingOnClose(h, "deleted"), { keep: 90, refund: 160 });
});

Deno.test("delete after a costly run: never more than the quote", () => {
  assertEquals(billingOnClose(hold({ committed: 250, workCredits: workCreditsFromUsd(4.52) }), "deleted"), { keep: 250, refund: 0 });
});

Deno.test("failed because of us: everything back, committed credits included", () => {
  assertEquals(billingOnClose(hold({ committed: 180, workCredits: 181, failedByUs: true }), "deleted"), { keep: 0, refund: QUOTE });
  assertEquals(billingOnClose(hold({ committed: 180, workCredits: 181 }), "failed_by_us"), { keep: 0, refund: QUOTE });
  assertEquals(billingOnClose(hold({ committed: 180, workCredits: 181, failedByUs: true }), "idle"), { keep: 0, refund: QUOTE });
});

Deno.test("idle 7 days: the uncommitted part is released (no credits stuck)", () => {
  assertEquals(billingOnClose(hold({ committed: 100, workCredits: 110 }), "idle"), { keep: 110, refund: 140 });
});

Deno.test("existing (fixed) holds keep today's behaviour: delete / idle refund it all", () => {
  assertEquals(billingOnClose(hold({ mode: "fixed", workCredits: 200 }), "deleted"), { keep: 0, refund: QUOTE });
  assertEquals(billingOnClose(hold({ mode: "fixed", workCredits: 200 }), "idle"), { keep: 0, refund: QUOTE });
});

Deno.test("wiring: ticks commit work done; delete keeps it; stage failures refund all; idle closes; SQL mirrors the rules", () => {
  assertMatch(read("supabase/functions/advance-long-form-autopilot/index.ts"), /await commitWorkDone\(admin, id\)/);
  const res = read("supabase/functions/_shared/longFormReservations.ts");
  assertMatch(res, /reason === "project_deleted" \? "deleted" : "failed_by_us"/);
  assertMatch(res, /closeReservation\(admin, \(r as any\)\.project_id, "idle", "idle_7_days"/);
  const sql = read("supabase/migrations/20261022100000_long_form_progressive_billing.sql");
  assertMatch(sql, /ceil\(2 \* sum\(l\.usd\) \/ 0\.02133\)/);
  assertMatch(sql, /alter column billing_mode set default 'progressive'/);
  assert(/full_refund := p_reason = 'failed_by_us' or public\.long_form_failed_by_us\(p_project_id\)/.test(sql));
  // Holds are server-only now.
  assertMatch(sql, /revoke execute on function public\.release_long_form_reservation\(uuid, uuid\) from authenticated/);
});

// Refund rule (migration 20261024100000): finished work is never refunded because some scenes
// failed or a render failed; everything comes back only when the run failed with NO finished scene.
Deno.test("failed by us = the run failed AND there is no finished scene (a failed render no longer counts)", () => {
  const sql = read("supabase/migrations/20261024100000_refund_only_when_no_video.sql");
  assertMatch(sql, /p\.status like '%failed%' or coalesce\(p\.autopilot ->> 'status', ''\) = 'failed'\)\s+and not exists/);
  assertMatch(sql, /s\.is_current and s\.status = 'ready'/);
  assert(!/long_form_render_jobs/.test(sql.split("create or replace function")[1]));
  // Some scenes failed but others are finished -> not "failed by us": the work done is kept.
  assertEquals(billingOnClose(hold({ committed: 180, workCredits: 181, failedByUs: false }), "deleted"), { keep: 181, refund: 69 });
});
