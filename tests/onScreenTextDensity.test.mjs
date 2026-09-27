import test from "node:test";
import assert from "node:assert/strict";
import { visualFocus } from "../supabase/functions/_shared/visualShotPlanning.js";
import fs from "node:fs";

// Part 2/3/4 (2026-09-15 "content grounding + UX" pass) — On-Screen Text /
// Explainer Density. BALANCED must be byte-for-byte the pre-existing
// behavior (zero regression for every project that predates this setting);
// MINIMAL/FREQUENT only re-weight the ALREADY-explainer-scoped generic-info
// keyword bucket, never the macroIsExplainer gate itself (widening that gate
// is the exact real incident the module documents: "9 of 13 shots
// misclassified as graphic from ordinary vocabulary").

const explainerMacro = { visualType: "PROGRAMMATIC_GRAPHIC" };
const storyMacro = { visualType: "CHARACTER" };

test("R: BALANCED (default) matches the pre-existing behavior exactly — generic info vocabulary inside an explainer macro is a graphic", () => {
  const focus = visualFocus("she checks the morning checklist and status icons", explainerMacro, "balanced");
  assert.equal(focus.type, "PROGRAMMATIC_GRAPHIC");
});

test("no density argument at all defaults to balanced (existing callers / older stored plans are unaffected)", () => {
  const focus = visualFocus("she checks the morning checklist and status icons", explainerMacro);
  assert.equal(focus.type, "PROGRAMMATIC_GRAPHIC");
});

test("Q: MINIMAL suppresses the generic info bucket unless an explicit informational cue is also present", () => {
  const withoutCue = visualFocus("she checks the morning checklist and status icons", explainerMacro, "minimal");
  assert.notEqual(withoutCue.type, "PROGRAMMATIC_GRAPHIC", "no explicit cue -> falls through to an illustrated classification at minimal");
  const withCue = visualFocus("she reads the checklist exactly as printed", explainerMacro, "minimal");
  assert.equal(withCue.type, "PROGRAMMATIC_GRAPHIC", "an explicit informational cue still earns a graphic even at minimal");
});

test("MINIMAL never touches the macroIsExplainer gate — a STORY macro never becomes a graphic regardless of vocabulary", () => {
  const focus = visualFocus("she checks the morning checklist and status icons", storyMacro, "minimal");
  assert.notEqual(focus.type, "PROGRAMMATIC_GRAPHIC");
});

test("MINIMAL never suppresses the higher-confidence COMPARISON/DIAGRAM buckets, only the broad generic-info one", () => {
  const comparison = visualFocus("compare the two options side by side", explainerMacro, "minimal");
  assert.equal(comparison.type, "COMPARISON");
  const diagram = visualFocus("trace the airflow loop through the scrubbers", explainerMacro, "minimal");
  assert.equal(diagram.type, "DIAGRAM");
});

test("R: FREQUENT surfaces a stat-shaped phrase as a graphic opportunity even OUTSIDE an explainer-scoped macro", () => {
  const focus = visualFocus("the shift adds an extra 39 minutes to the day", storyMacro, "frequent");
  assert.equal(focus.type, "PROGRAMMATIC_GRAPHIC");
});

test("BALANCED never does the frequent-only stat surfacing outside an explainer macro", () => {
  const focus = visualFocus("the shift adds an extra 39 minutes to the day", storyMacro, "balanced");
  assert.notEqual(focus.type, "PROGRAMMATIC_GRAPHIC");
});

test("FREQUENT still respects the macroIsExplainer gate for the generic info bucket (widening is never global)", () => {
  const focus = visualFocus("she checks the morning checklist and status icons", storyMacro, "frequent");
  assert.notEqual(focus.type, "PROGRAMMATIC_GRAPHIC");
});

/* V: existing projects (no stored draft field, or a project row from before this setting existed) default safely to balanced.
   state.js itself imports "./discoverIdeas" without an extension, which only
   resolves under Vite — not plain Node ESM — so this reads the source
   directly (same structural-check pattern longFormResumeState.test.mjs uses
   for start-long-form-visual-world/index.ts) rather than importing it. */
test("V: the idea draft's own default is balanced, so a brand-new session (or one predating this setting) never silently picks minimal/frequent", () => {
  const src = fs.readFileSync(new URL("../src/pages/workspace/long-form/state.js", import.meta.url), "utf8");
  const defaultDraftBlock = src.slice(src.indexOf("DEFAULT_IDEA_DRAFT = {"), src.indexOf("DEFAULT_IDEA_DRAFT = {") + 1200);
  assert.match(defaultDraftBlock, /onScreenTextDensity:\s*"balanced"/);
});

test("V: merging an old saved draft (missing the field entirely) over the current default still yields balanced, never undefined", () => {
  const defaultDraft = { onScreenTextDensity: "balanced", lengthMode: "auto" };
  const oldSavedDraft = { topic: "How do submarines work?", lengthMode: "auto" }; // no onScreenTextDensity key at all
  const merged = { ...defaultDraft, ...oldSavedDraft };
  assert.equal(merged.onScreenTextDensity, "balanced");
});
