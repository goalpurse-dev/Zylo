import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "FINAL stabilization pass" §3 — real Atlantis live-state
// evidence: Shot 1 (GENERATE) was QA-rejected; Shot 2 (REUSE of Shot 1) was
// nonetheless claimed, resolved, and marked qa_status='approved' with the
// reason "zero-cost reuse of an already-approved scene" — a false
// statement. Same pattern repeated for Shot 3 (rejected) -> Shot 5 (REUSE,
// approved). A REUSE/CROP/COMPOSITE scene must never outlive — or
// misrepresent — its source's actual QA outcome. Fixed in two places:
// the durable SQL claim gate (never claim a dependent while its source
// succeeded-but-was-rejected) and processZeroCostScene itself (defense in
// depth for anything already claimed before its source was rejected out
// from under it).

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("§3 SQL: the dependency gate refuses a source that succeeded but failed QA — not just one that's merely still running/failed-but-retriable", async () => {
  const sql = await source("supabase/migrations/20261001200000_long_form_reuse_never_outlives_source_qa.sql");
  assert.match(sql, /src\.status = 'succeeded' and \(src\.qa_status is null or src\.qa_status = 'approved'\)/);
  // The old, QA-blind condition (bare status='succeeded') must be gone from
  // the live function body, not merely superseded by a migration an
  // environment could skip.
  assert.doesNotMatch(sql, /src\.status = 'succeeded' or \(src\.status = 'failed'/);
});

test("§3 SQL: a permanently-exhausted (claim_attempts >= 3) failed source still unblocks its dependent regardless of qa_status — that source will never produce a QA outcome at all", async () => {
  const sql = await source("supabase/migrations/20261001200000_long_form_reuse_never_outlives_source_qa.sql");
  assert.match(sql, /or \(src\.status = 'failed' and src\.claim_attempts >= 3\)/);
});

test("§3 JS: processZeroCostScene's REUSE branch throws a distinct REUSE_SOURCE_REJECTED error instead of inheriting qa_status when the source is qa_status='rejected'", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const reuseBlock = text.slice(text.indexOf('if (plan.render_strategy === "REUSE")'), text.indexOf('if (plan.render_strategy === "CROP"'));
  assert.match(reuseBlock, /if \(source\.qa_status === "rejected"\) throw new Error\("REUSE_SOURCE_REJECTED"\);/);
  // The rejected-source check must run BEFORE the update that would
  // otherwise hardcode qa_status:"approved" on the copy.
  const checkIndex = reuseBlock.indexOf('source.qa_status === "rejected"');
  const updateIndex = reuseBlock.indexOf(".update({");
  assert.ok(checkIndex >= 0 && updateIndex > checkIndex, "the QA-rejected check must precede the update that copies the source's outcome");
});

test("§3 JS: the REUSE copy inherits the source's ACTUAL qa_status (never a hardcoded 'approved'), and its recorded reason never claims an approval that didn't happen", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  assert.match(text, /qa_status: source\.qa_status \?\? "approved"/);
  assert.doesNotMatch(text, /qa_status: "approved", qa_result: \{ inheritedFrom: source\.id, reason: "zero-cost reuse of an already-approved scene" \}/, "the old unconditional hardcode must be gone, not just supplemented");
});

test("§3 JS: CROP and COMPOSITE also refuse to build derived pixels from a QA-rejected source, with their own distinctly-named errors", async () => {
  const text = await source("supabase/functions/advance-long-form-scene-generation/index.ts");
  const cropBlock = text.slice(text.indexOf('if (plan.render_strategy === "CROP" || plan.render_strategy === "COMPOSITE")'), text.indexOf("const base = await fetchAndDecodeImage"));
  assert.match(cropBlock, /if \(source\.qa_status === "rejected"\) throw new Error\(`\$\{plan\.render_strategy\}_SOURCE_REJECTED`\);/);
});
