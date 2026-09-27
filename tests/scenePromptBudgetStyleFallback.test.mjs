import test from "node:test";
import assert from "node:assert/strict";
import { compileScenePrompt } from "../supabase/functions/_shared/sceneRenderPlan.ts";
import { ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";

// 2026-09-20 "fix oversized prompts" pass — real Mars finding: 6 beats
// exceeded the 1900-char hard ceiling even after dropping world state/
// continuity/forbidden, because compileFullStyleLock's complete field-by-
// field breakdown had nowhere left to shrink. A final fallback tier drops
// to the compact compileStyleLock form (name + summary + negatives) rather
// than ever throwing SCENE_PROMPT_REPLAN_REQUIRED for a merely-verbose
// (not truly unrepresentable) scene.

function baseInput(overrides = {}) {
  return {
    sceneType: "STORY_SCENE", shotSize: "MEDIUM", cameraFraming: "medium shot", focalSubject: "the protagonist",
    informationToCommunicate: "The protagonist checks the morning readout.",
    characterIdentityBlocks: [], locationDescription: "Habitat common module", worldStateNotes: [], continuityNote: null,
    factualConstraints: [], forbiddenElements: [], reserveTextSafeArea: false, semanticNotes: null,
    ...overrides,
  };
}

test("a normal-length scene prompt uses the FULL style lock and fits comfortably under budget", () => {
  const prompt = compileScenePrompt(ZYVO_STYLE_SPEC, baseInput());
  assert.ok(prompt.length <= 1900);
  assert.match(prompt, /Linework:/, "full style lock breakdown must be present for a normal-size prompt");
});

test("a beat with enough other real content to push past budget falls back to the COMPACT style lock rather than throwing SCENE_PROMPT_REPLAN_REQUIRED", () => {
  const heavyInput = baseInput({
    informationToCommunicate: "A".repeat(200),
    characterIdentityBlocks: ["Protagonist: present, canonical identity established via reference image 1, mid-30s male presentation with olive skin tone and short brown hair."],
    locationDescription: "A".repeat(100),
    factualConstraints: ["B".repeat(100)],
    semanticNotes: "F".repeat(150),
  });
  const prompt = compileScenePrompt(ZYVO_STYLE_SPEC, heavyInput);
  assert.ok(prompt.length <= 1900, `prompt was ${prompt.length} chars`);
  assert.doesNotMatch(prompt, /Linework:/, "must have fallen back to the compact style lock, not the full breakdown");
  assert.match(prompt, /STYLE LOCK/);
});

test("the compact style-lock fallback still names the real style (never silently drops style identity entirely)", () => {
  const heavyInput = baseInput({ informationToCommunicate: "A".repeat(150), factualConstraints: ["B".repeat(100)], semanticNotes: "C".repeat(150) });
  const prompt = compileScenePrompt(ZYVO_STYLE_SPEC, heavyInput);
  assert.match(prompt, new RegExp(ZYVO_STYLE_SPEC.name));
});
