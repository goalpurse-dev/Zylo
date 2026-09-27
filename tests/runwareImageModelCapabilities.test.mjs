import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "provider adapter transport" incident — real Atlantis
// production failures, independently confirmed live in system_logs before
// any fix: Kling O3 task creation rejected outright for carrying
// negativePrompt ("Unsupported use of 'negativePrompt' parameter..."), and
// every reference image routed through Runware's imageUpload re-hosting
// step even though Kling O3 accepts an already-public HTTPS URL directly
// (imageUpload itself failing with invalidImage before inference ever
// started). Source-pattern tests — runware-image is a Deno edge function
// making real outbound HTTP calls with no fetch-mock harness in this repo,
// matching the same convention tests/reference-pipeline.test.mjs already
// uses for this exact file.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("A: Kling O3 is registered with supportsNegativePrompt: false and referenceInputMode: 'direct' in the explicit model-capability table", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  const tableBlock = text.slice(text.indexOf("const IMAGE_MODEL_CAPABILITIES"), text.indexOf("const IMAGE_MODEL_CAPABILITIES") + 400);
  assert.match(tableBlock, /\[KLING_O3_AIR\]:\s*\{\s*supportsNegativePrompt:\s*false,\s*referenceInputMode:\s*"direct"\s*\}/);
});

test("default capability preserves every other model's existing proven behavior (negativePrompt attached, upload-then-reference) — never a global change", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  const defaultsBlock = text.slice(text.indexOf("const DEFAULT_IMAGE_MODEL_CAPABILITIES"), text.indexOf("const DEFAULT_IMAGE_MODEL_CAPABILITIES") + 200);
  assert.match(defaultsBlock, /supportsNegativePrompt:\s*true/);
  assert.match(defaultsBlock, /referenceInputMode:\s*"upload"/);
});

test("B: a model with referenceInputMode 'direct' pushes the accessible URL straight into runwareRefs and never calls uploadImageToRunware for it", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  const loopStart = text.indexOf("for (const url of referenceImages) {");
  const loopBlock = text.slice(loopStart, text.indexOf("console.log(\"[runware-image] runwareRefs ready\"", loopStart));
  const directBranch = /if \(capabilities\.referenceInputMode === "direct"\) \{[\s\S]*?runwareRefs\.push\(url\);[\s\S]*?continue;\s*\}/;
  assert.match(loopBlock, directBranch);
  // The direct branch must return (continue) BEFORE the upload call is ever
  // reached for that same url.
  const directIndex = loopBlock.search(directBranch);
  const uploadIndex = loopBlock.indexOf("await uploadImageToRunware(url)");
  assert.ok(directIndex >= 0 && uploadIndex > directIndex, "direct-mode branch must precede and short-circuit the upload call");
});

test("D: when negativePrompt is unsupported, its content is folded into the positive prompt (AVOID:) instead of being silently dropped", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  assert.match(text, /safeNegative && !capabilities\.supportsNegativePrompt/);
  assert.match(text, /AVOID: \$\{safeNegative\}/);
});

test("negativePrompt is only ever attached to the Runware task when the model's own capability says it's supported", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  assert.match(text, /\.\.\.\(safeNegative && capabilities\.supportsNegativePrompt \? \{ negativePrompt: safeNegative \} : \{\}\)/);
});

test("error taxonomy: unsupported-parameter and reference-transport failures get their own stable codes, distinct from the generic PROVIDER_GENERATION_FAILED catch-all", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  assert.match(text, /code:\s*"PROVIDER_UNSUPPORTED_PARAMETER"/);
  assert.match(text, /code:\s*"REFERENCE_TRANSPORT_FAILED"/);
  assert.match(text, /code:\s*"PROVIDER_TASK_REJECTED"/);
});

test("C: reference-count clamping (clampReferenceImageCount) still runs for every model, including Kling O3, after the direct/upload split", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  const afterLoop = text.slice(text.indexOf("runwareRefs ready"));
  assert.match(afterLoop, /clampReferenceImageCount\(runwareRefs, airTag\)/);
});
