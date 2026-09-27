import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
// Shot 1 hit a transient vision-QA infra failure (QA_UNAVAILABLE — an API
// call issue, never a real content judgment) and was immediately recorded
// as qa_status='rejected'. Its REUSE dependent (Shot 2) then failed with
// REUSE_SOURCE_REJECTED as a direct, avoidable consequence — REUSE
// correctly refuses to inherit from a REAL rejection, but this was never a
// real one. Source-pattern tests, this codebase's established convention
// for this Deno entrypoint.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const FN = "supabase/functions/advance-long-form-scene-generation/index.ts";

test("retries are keyed on the RESULT's own failureType, not just a thrown exception — runSceneQA swallows its own errors and returns a normal QA_UNAVAILABLE-shaped result rather than throwing", async () => {
  const text = await source(FN);
  assert.match(text, /if \(result\?\.failureType !== "QA_UNAVAILABLE"\) break;/);
});

test("a bounded number of retries, never unbounded", async () => {
  const text = await source(FN);
  assert.match(text, /const QA_UNAVAILABLE_MAX_ATTEMPTS = 3;/);
  assert.match(text, /for \(let attempt = 1; attempt <= QA_UNAVAILABLE_MAX_ATTEMPTS; attempt\+\+\)/);
});

test("when QA is genuinely unavailable after all retries, the function returns WITHOUT recording any qa result — never a false hard rejection", async () => {
  const text = await source(FN);
  const idx = text.indexOf("const QA_UNAVAILABLE_MAX_ATTEMPTS = 3;");
  const block = text.slice(idx, text.indexOf("record_scene_qa_result", idx));
  assert.match(block, /if \(!result\) \{/);
  assert.match(block, /return;/);
  // Must never call record_scene_qa_result with approved:false purely
  // because QA infra failed — that call now only happens further down,
  // after this early return, using a REAL result.
});

test("a scene left with qa_status null after exhausted retries is picked up again by reconcileNonterminal's own existing sweep — no separate new retry mechanism needed", async () => {
  const text = await source(FN);
  assert.match(text, /\.eq\("status", "succeeded"\)\.is\("qa_status", null\)/);
});
