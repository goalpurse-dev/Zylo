import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-09-22 "permanently separate PLAN/COMPILE from PAID GENERATION" pass
// — §2/§9: both real callers that used to self-chain straight from the old
// coupled start-long-form-scene-generation must now go through the explicit
// three-step sequence: compile-long-form-scenes (never claimable) ->
// authorizeCompiledScenesForDispatch (the only place allowed to make a scene
// claimable) -> an explicit dispatch kick. Source-pattern tests, this
// codebase's established convention for Deno edge-function entrypoints with
// no fetch-mock harness.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

for (const FN of [
  "supabase/functions/charge-long-form-episode-generation/index.ts",
  "supabase/functions/rebuild-long-form-episode-generation/index.ts",
]) {
  test(`${FN}: never calls the old coupled start-long-form-scene-generation`, async () => {
    const text = await source(FN);
    assert.doesNotMatch(text, /functions\/v1\/start-long-form-scene-generation/);
  });

  test(`${FN}: compiles via compile-long-form-scenes`, async () => {
    const text = await source(FN);
    assert.match(text, /functions\/v1\/compile-long-form-scenes/);
  });

  test(`${FN}: explicitly authorizes exactly this charge's beats before any dispatch kick`, async () => {
    const text = await source(FN);
    assert.match(text, /import \{ authorizeCompiledScenesForDispatch \} from "\.\.\/_shared\/sceneGenerationAuthorization\.ts";/);
    const authorizeIdx = text.indexOf("authorizeCompiledScenesForDispatch(admin,");
    const dispatchIdx = text.indexOf("functions/v1/advance-long-form-scene-generation");
    assert.ok(authorizeIdx > -1 && dispatchIdx > -1 && authorizeIdx < dispatchIdx, "authorization must run BEFORE the dispatch kick");
  });

  test(`${FN}: dispatch is only kicked when at least one beat was actually authorized`, async () => {
    const text = await source(FN);
    const dispatchBlockStart = text.indexOf("if (authResult?.authorized?.length) {");
    assert.ok(dispatchBlockStart > -1);
    const dispatchCallIdx = text.indexOf("functions/v1/advance-long-form-scene-generation", dispatchBlockStart);
    assert.ok(dispatchCallIdx > dispatchBlockStart && dispatchCallIdx < dispatchBlockStart + 400);
  });

  test(`${FN}: the dispatch kick carries the x-cron-secret header advance-long-form-scene-generation requires`, async () => {
    const text = await source(FN);
    assert.match(text, /"x-cron-secret": ADVANCE_SECRET/);
  });

  test(`${FN}: only runs compile/authorize/dispatch on a fresh charge, never a replayed alreadyCharged one`, async () => {
    const text = await source(FN);
    assert.match(text, /if \(charge\?\.charged && !charge\?\.alreadyCharged\) \{/);
  });
}
