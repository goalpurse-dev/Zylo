// Phase 4c — the bible rebuild died with a bare 500: a truncated draft made
// JSON.parse throw uncaught. Truncation and bad JSON are now named errors.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { parseDraftPayload, BIBLE_MAX_OUTPUT_TOKENS } from "../../supabase/functions/_shared/stickman/productionBible.ts";

Deno.test("bible draft: truncated (incomplete) and unparseable responses are named errors that carry the usage", () => {
  const e1 = assertThrows(() => parseDraftPayload({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, usage: { input_tokens: 5000, output_tokens: 6000 }, output: [] })) as any;
  assert(e1.message.startsWith("PRODUCTION_BIBLE_TRUNCATED: max_output_tokens after 6000 output tokens"), e1.message);
  assertEquals([e1.inputTokens, e1.outputTokens], [5000, 6000]);
  const e2 = assertThrows(() => parseDraftPayload({ status: "completed", output_text: '{"hero": {"exists": fa', usage: { input_tokens: 1, output_tokens: 2 } })) as any;
  assert(e2.message.startsWith("PRODUCTION_BIBLE_UNPARSEABLE"), e2.message);
  assertEquals(parseDraftPayload({ status: "completed", output_text: '```json\n{"a":1}\n```', usage: {} }).draft, { a: 1 } as any);
  assert(BIBLE_MAX_OUTPUT_TOKENS >= 16000);
});
