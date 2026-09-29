// Phase 3b — cost ledger helpers (offline).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { ledgerRow, recordCost, summarizeStageRows } from "../../supabase/functions/_shared/costLedger.ts";

Deno.test("ledger row: provider, model, stage, units (nulls dropped) and USD rounded to 6 dp", () => {
  const row = ledgerRow({ projectId: "p1", stage: "narration", provider: "elevenlabs", model: "eleven_flash_v2_5", units: { calls: 1, characters: 6310, providerCredits: 1577, images: undefined }, usd: 1.8930000004, sourceTable: "long_form_narration_audio_versions", sourceId: "r1" });
  assertEquals(row, { project_id: "p1", user_id: null, stage: "narration", provider: "elevenlabs", model: "eleven_flash_v2_5", units: { calls: 1, characters: 6310, providerCredits: 1577 }, usd: 1.893, estimated: true, source_table: "long_form_narration_audio_versions", source_id: "r1" });
});

Deno.test("Phase 7: account-level rows (no project) and real costs flagged estimated: false", () => {
  const row = ledgerRow({ userId: "u1", stage: "other", provider: "openai", model: "gpt-4o-mini", units: { calls: 3, purpose: "ideas" } as any, usd: 0.0021, estimated: false });
  assertEquals([row.project_id, row.user_id, row.estimated], [null, "u1", false]);
});

Deno.test("recordCost never fails the stage that paid for the call", async () => {
  const failing = { from: () => ({ insert: () => Promise.resolve({ error: { message: "db down" } }) }) };
  const throwing = { from: () => ({ insert: () => { throw new Error("boom"); } }) };
  await recordCost(failing, { projectId: "p", stage: "bible", provider: "openai", units: {}, usd: 0.02 });
  await recordCost(throwing, { projectId: "p", stage: "bible", provider: "openai", units: {}, usd: 0.02 });
  let inserted: any = null;
  await recordCost({ from: (t: string) => ({ insert: (r: any) => { inserted = { t, r }; return Promise.resolve({ error: null }); } }) }, { projectId: "p", stage: "beats", provider: "anthropic", model: "claude-sonnet-5", units: { calls: 9 }, usd: 0.18 });
  assertEquals(inserted.t, "long_form_cost_ledger");
  assertEquals(inserted.r.stage, "beats");
});

Deno.test("cost by stage: ledger + script/research callLedger rows merge per stage, in pipeline order, with a total", () => {
  const s = summarizeStageRows([
    { stage: "script", usd: "0.237", calls: "1", source: "long_form_script_versions.meta.callLedger" },
    { stage: "research", usd: "0", calls: "0", source: "long_form_research_versions.meta.callLedger" },
    { stage: "beats", usd: "0.18", calls: "9", source: "long_form_cost_ledger" },
    { stage: "bible", usd: "0.0236", calls: "2", source: "long_form_cost_ledger" },
    { stage: "bible", usd: "0.0113", calls: "1", source: "long_form_cost_ledger" },
  ]);
  assertEquals(s.stages.map((x) => [x.stage, x.usd, x.calls]), [["script", 0.237, 1], ["bible", 0.0349, 3], ["beats", 0.18, 9]]);
  assertEquals(s.totalUsd, 0.4519);
  assert(!s.stages.some((x) => x.stage === "research"), "empty stages are omitted");
});
