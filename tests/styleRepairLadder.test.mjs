import test from "node:test";
import assert from "node:assert/strict";
import { classifyStyleRepairStage, styleReinforcementReferenceInstruction, STYLE_REINFORCEMENT_NEGATIVE_SUFFIX } from "../supabase/functions/_shared/styleRepairLadder.ts";

// 2026-09-23 "systemic production stabilization" pass, Item A — real
// Atlantis finding: QA already correctly flags styleMismatchSeverity:"major"
// (failureType STYLE_ABANDONED) on every drifted shot, but repairLadder.ts's
// determineRepairAction has always mapped it to a plain FRESH_GENERATE, same
// as every other failure — the next Regenerate click resent the identical
// prompt/references with no stronger style lock and no bound on retries.
// This ladder is the missing decision layer for exactly that gap.

test("no prior style failure at all -> NONE (first attempt, nothing to reinforce yet)", () => {
  assert.equal(classifyStyleRepairStage([]), "NONE");
  assert.equal(classifyStyleRepairStage([null]), "NONE");
});

test("a non-style prior failure -> NONE (this ladder only ever reacts to STYLE_ABANDONED)", () => {
  assert.equal(classifyStyleRepairStage(["REFERENCE_LEAKAGE"]), "NONE");
});

test("one consecutive style failure -> REINFORCE (the first stronger style/reference retry)", () => {
  assert.equal(classifyStyleRepairStage(["STYLE_ABANDONED"]), "REINFORCE");
});

test("two consecutive style failures -> REINFORCE (the explicitly-allowed optional second retry)", () => {
  assert.equal(classifyStyleRepairStage(["STYLE_ABANDONED", "STYLE_ABANDONED"]), "REINFORCE");
});

test("three or more consecutive style failures -> NEEDS_FIX (stop silently retrying, no infinite loop)", () => {
  assert.equal(classifyStyleRepairStage(["STYLE_ABANDONED", "STYLE_ABANDONED", "STYLE_ABANDONED"]), "NEEDS_FIX");
  assert.equal(classifyStyleRepairStage(["STYLE_ABANDONED", "STYLE_ABANDONED", "STYLE_ABANDONED", "STYLE_ABANDONED"]), "NEEDS_FIX");
});

test("only an UNBROKEN run from the most recent attempt counts — a style failure before a different, already-fixed failure restarts the count", () => {
  // most-recent-first: the immediately preceding attempt failed for a
  // DIFFERENT reason, so the one style failure before that is not part of
  // an unbroken run ending at "now" — this shot is effectively on a fresh
  // style-repair count.
  assert.equal(classifyStyleRepairStage(["REFERENCE_LEAKAGE", "STYLE_ABANDONED"]), "NONE");
});

test("styleReinforcementReferenceInstruction is explicit that the reference controls style only, never subject/composition — the exact safeguard against the prior 'literal pixels forced the wrong subject' incident", () => {
  const text = styleReinforcementReferenceInstruction(3);
  assert.match(text, /Reference 3/);
  assert.match(text, /style reference only/i);
  assert.match(text, /Do not copy its subject/i);
});

test("STYLE_REINFORCEMENT_NEGATIVE_SUFFIX names no specific style/subject/project — stays generic for any future style", () => {
  assert.doesNotMatch(STYLE_REINFORCEMENT_NEGATIVE_SUFFIX, /Atlantis|Plato|documentary|cartoon/i);
});
