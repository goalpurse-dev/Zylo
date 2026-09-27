import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { compileFullStyleLock, ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";

// 2026-09-19 "V1 reliability patch" Task 7 (full style lock) + Task 8 (hide
// provider/model names). compileFullStyleLock is a pure function (real
// unit test); provider-name removal is checked via source patterns (this
// codebase's established convention for JSX/UI surfaces).

test("compileFullStyleLock includes every major field (linework/shading/texture/palette/proportions), not just a one-sentence summary", () => {
  const out = compileFullStyleLock(ZYVO_STYLE_SPEC);
  assert.match(out, /Linework:/);
  assert.match(out, /Shading:/);
  assert.match(out, /Texture:/);
  assert.match(out, /Palette:/);
  assert.match(out, /Proportions:/);
  assert.match(out, new RegExp(ZYVO_STYLE_SPEC.name));
});

test("compileFullStyleLock still carries the negative constraints (Do not: ...)", () => {
  const out = compileFullStyleLock(ZYVO_STYLE_SPEC);
  if (ZYVO_STYLE_SPEC.negativeConstraints?.length) assert.match(out, /Do not:/);
});

// 2026-09-20 "fix oversized prompts" pass updated this: compileScenePrompt
// now prefers the full style lock for every normal-size prompt, falling
// back to the compact compileStyleLock ONLY as the final budget-drop tier
// (see scenePromptBudgetStyleFallback.test.mjs for the functional proof) —
// a genuinely oversized beat sheds verbosity rather than throwing
// SCENE_PROMPT_REPLAN_REQUIRED. This test now checks the DEFAULT path
// (drop.compactStyle false) still prefers the full breakdown.
test("compileScenePrompt (fresh GENERATE) prefers the FULL style lock by default, only falling back to the compact form under real budget pressure", () => {
  const src = fs.readFileSync(new URL("../supabase/functions/_shared/sceneRenderPlan.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function compileScenePrompt"), src.indexOf("export function compileEditInstruction"));
  assert.match(fn, /drop\.compactStyle \? compileStyleLock\(styleSpec\) : compileFullStyleLock\(styleSpec\)/, "full style lock must be the default; compact is only the explicit budget-drop fallback");
});

test("no literal schematic/blueprint/technical-drawing/infographic wording is baked into any scene or graphic prompt compiler as an instruction", () => {
  const keyword = /\b(schematic|blueprint|technical drawing|engineering diagram)\b/i;
  for (const file of ["sceneRenderPlan.ts", "graphicSpec.ts"]) {
    const src = fs.readFileSync(new URL(`../supabase/functions/_shared/${file}`, import.meta.url), "utf8");
    // Only real prompt-string lines matter — a // comment mentioning the
    // word (e.g. explaining WHY it's avoided) is not a live instruction.
    const codeLines = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*"));
    const offenders = codeLines.filter((l) => keyword.test(l));
    assert.equal(offenders.length, 0, `${file} has live (non-comment) code referencing forbidden style-drift wording: ${offenders.join(" | ")}`);
  }
});

/* ---- Task 8: hide provider/model names ---- */
test("SCENE_GENERATION_TIERS no longer carries a provider/model name field", () => {
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/scenePricing.js", import.meta.url), "utf8");
  const catalogSrc = src.slice(src.indexOf("SCENE_GENERATION_TIERS = ["), src.indexOf("];", src.indexOf("SCENE_GENERATION_TIERS = [")));
  assert.doesNotMatch(catalogSrc, /Kling|Qwen|Seedream|FLUX|Runware/i);
  assert.doesNotMatch(catalogSrc, /model\s*:/);
});

test("GenerateWorkspace's TIER_BLURB no longer names any provider/model", () => {
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  const blurbSrc = src.slice(src.indexOf("const TIER_BLURB"), src.indexOf("};", src.indexOf("const TIER_BLURB")));
  assert.doesNotMatch(blurbSrc, /Kling|Qwen|Seedream|FLUX|Runware/i);
});

test("the episode-generation activity feed never appends a provider/model name suffix", () => {
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/GenerateWorkspace.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /modelLabel/);
});

test("VisualWorldWorkspace's Generation Models panel shows Zyvo-branded labels, never the underlying provider name", () => {
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/VisualWorldWorkspace.jsx", import.meta.url), "utf8");
  const panelSrc = src.slice(src.indexOf("const rows = ["), src.indexOf("];", src.indexOf("const rows = [")));
  assert.doesNotMatch(panelSrc, /Kling|Qwen|Seedream|FLUX|Runware/i, "the actual rendered row data must never name a provider");
  assert.match(panelSrc, /Zyvo/);
});
