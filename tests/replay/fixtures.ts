// deno-lint-ignore-file no-explicit-any
// Stubs for replaying the Ancient Humans runs. Real model outputs come from
// the saved attempt-2 run (tests/fixtures/stickman/replay/ancient-humans-a2.json:
// its draft document and its real first critic verdict); the few responses
// that run never produced (a passing re-critique, a revision patch, verify
// verdicts) are small handwritten stubs, marked as such.

import { anthropicToolResponse, openAIJsonResponse, entry, type CassetteEntry } from "../../supabase/functions/_shared/stickman/cassette.ts";
import { draftInputFrom, setSegmentText, type Snapshot } from "./harness.ts";

const a2 = JSON.parse(await Deno.readTextFile(new URL("../fixtures/stickman/replay/ancient-humans-a2.json", import.meta.url)));

export const snapshot: Snapshot = {
  project: a2.project,
  storyPlanVersion: a2.storyPlanVersion,
  researchVersion: a2.researchVersion,
  profile: a2.profile,
};
export const storyPlan = a2.storyPlanVersion.story_plan;
export const roleByChapter = new Map<string, string>(storyPlan.chapters.map((c: any) => [c.id, c.role]));
export const savedCritic = a2.script.critic_result;

// Attempt 2's real document, with its two real defects that are now HARD
// failures hand-fixed (a 48-word stakes paragraph, a 2-sentence question).
export const STAKES_LINE = "Night wasn't empty time. It's where the most human part of us was built.";
export const QUESTION_LINE = "So once the sun dropped and firelight was all you had, what did people actually do until morning?";
export function goodDraft(): any {
  const d = draftInputFrom(a2.script.script_document);
  setSegmentText(d, "seg_stakes", STAKES_LINE);
  setSegmentText(d, "seg_core_question", QUESTION_LINE);
  return d;
}

// Answers any verify batch: "supported" for every claim id in the batch
// unless listed in `overrides` (claimId -> verdict fields).
export function verifyResponder(overrides: Record<string, any> = {}) {
  return (request: any) => {
    const ids = [...String(request?.input ?? "").matchAll(/"claimId":\s*"([^"]+)"/g)].map((m) => m[1]);
    return openAIJsonResponse(
      { verdicts: ids.map((claimId) => ({ claimId, verdict: "supported", correctedValue: null, sourceName: "stub source", url: null, ...(overrides[claimId] ?? {}) })) },
      { input_tokens: 4000, output_tokens: 700 },
      [{ type: "web_search_call", status: "completed" }],
    );
  };
}

// HANDWRITTEN — a passing re-critique of the revised script.
export function passingCritic(): any {
  return {
    ...structuredClone(savedCritic),
    overallScore: 7.5,
    overallVerdict: "strong",
    scores: { hook: 8, ending: 7, rhythm: 7, bridging: 7, repetition: 7, specificity: 7, angleStrength: 8, visualConcreteness: 8 },
    issues: [],
    weakestSections: [],
  };
}

// The real first critic verdict (6/10), with its issues pointed at the
// segments the revision stubs patch.
export function failingCritic(extraIssueSegmentIds: string[] = []): any {
  const c = structuredClone(savedCritic);
  c.issues = [
    ...(c.issues ?? []).filter((i: any) => i.segmentIds?.length),
    ...extraIssueSegmentIds.map((id) => ({ lens: "bridging", severity: "major", segmentIds: [id], problem: "Connect this to the viewer.", suggestedFix: "Add a bridge to the viewer's life." })),
  ];
  return c;
}

export function revisionPatch(segments: { id: string; text: string }[]) {
  const d = goodDraft();
  return {
    replacementSegments: segments.map(({ id, text }) => {
      const s = d.narrationSegments.find((x: any) => x.id === id);
      return { id, text, factIds: s.factIds, narrativeFunction: s.narrativeFunction, openLoopIds: s.openLoopIds, payoffIds: s.payoffIds, estimatedSeconds: s.estimatedSeconds };
    }),
  };
}

let seq = 0;
export const draftEntry = (draft: any, usage = {}) => entry(seq++, "draft", "anthropic", "stickman_script_draft", anthropicToolResponse("stickman_script_draft", draft, { output_tokens: 10000, ...usage }));
export const criticEntry = (critic: any) => entry(seq++, "critic", "anthropic", "stickman_script_critic", anthropicToolResponse("stickman_script_critic", critic, { output_tokens: 4200, input_tokens: 20000 }));
export const revisionEntry = (patch: any) => entry(seq++, "revision", "anthropic", "script_revision", anthropicToolResponse("script_revision", patch, { output_tokens: 3000, input_tokens: 16000 }));
export const verifyEntries = (n: number, responder = verifyResponder()): CassetteEntry[] =>
  Array.from({ length: n }, () => ({ ...entry(seq++, "claim_verify", "openai", "claim_verify", null), response: responder as any }));
export const claimFixEntry = (patch: any) => entry(seq++, "claim_fix", "openai", "claim_fix", openAIJsonResponse(patch, { input_tokens: 3000, output_tokens: 2500 }));
// The same draft answered by the OpenAI path (a version started on the backup model).
export const draftEntryOpenAI = (draft: any) => entry(seq++, "draft", "openai", "stickman_script_draft", openAIJsonResponse(draft, { input_tokens: 20000, output_tokens: 10000 }));
