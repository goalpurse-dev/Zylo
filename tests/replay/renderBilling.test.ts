// Phase 5b — what a render outcome does to the project's credit reservation.
import { assertEquals } from "jsr:@std/assert@1";
import { renderBillingDecision } from "../../supabase/functions/_shared/longFormReservations.ts";

Deno.test("render billing (Phase 7 fixed quote): done settles the full quote; a failed render keeps it (free retry)", () => {
  assertEquals(renderBillingDecision("done", true, { committed_credits: 120 }), "settle");
  assertEquals(renderBillingDecision("done", false, { committed_credits: 0 }), "settle");
  assertEquals(renderBillingDecision("failed", true, { committed_credits: 0 }), "keep"); // Phase 7: a failed render keeps the quote (retry is free)
  assertEquals(renderBillingDecision("failed", true, { committed_credits: 40 }), "keep");
  assertEquals(renderBillingDecision("failed", false, { committed_credits: 0 }), "keep");
  assertEquals(renderBillingDecision("done", true, null), "keep");
});
