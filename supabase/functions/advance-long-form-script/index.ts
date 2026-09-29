// deno-lint-ignore-file no-explicit-any
// advance-long-form-script/index.ts
//
// The durable async worker behind the Script Engine — same proven shape as
// advance-long-form-research (durable stage machine, self-chained dispatch,
// claim/lease via SKIP LOCKED, never a giant synchronous request):
//
//   draft → critic → (revision, only if the critic found something worth
//   fixing) → finalizing → status: ready | needs_research | failed
//
// CRITICAL PRODUCT PRINCIPLE: narration is the product. This engine's only
// job is turning StoryPlan + NarrativeStrategy + FactGraph + Coverage into
// narration genuinely worth listening to with the screen off. It does NOT
// touch visuals, references, images, or TTS — see VISUAL_ARCHITECTURE.md for
// why that stays a separate, later phase.
//
// CRITICAL COST PRINCIPLE: normal runs must cost 2-3 model calls, not the
// 7-call draft→N-critics→rewrite pattern that was explicitly rejected for
// this milestone. Pass A (Draft) is always 1 call. Pass B (one combined
// Critic covering hook/information/curiosity/pacing/naturalness/payoff/
// factual-grounding as diagnostic LENSES in one structured response, never
// six separate provider calls) is always 1 call. Pass C (selective Revision,
// patching only the affected segments — or, exceptionally, one full
// rewrite) fires ONLY when the critic reports something worth fixing, and
// is skipped entirely otherwise. Deterministic, zero-cost local validators
// run before AND after the paid passes so normal code — not an LLM — catches
// what normal code can catch (duplicate IDs, unknown fact IDs, malformed
// ordering, empty segments, gross repetition).
//
// Script consumes Research's evidence; it never re-researches. No
// web_search tool is ever attached to any call in this file — see the
// OpenAI plumbing section below, which has no web_search code path at all
// (unlike advance-long-form-research's, which conditionally attaches it).
//
// Auth: NOT user-facing (invoked only by start-long-form-script's dispatch,
// this function's own self-chain, or a future cron sweep — none of which a
// normal user can reach directly), same as advance-long-form-research.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEvent } from "../_shared/systemLog.ts";
import { releaseReservationIfActive } from "../_shared/longFormReservations.ts";
import { WORDS_PER_MINUTE, GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";
import { fetchActiveGenerationProfile, isStickmanProfile, nicheFromProfile } from "../_shared/stickman/recipeProfile.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";
import { urlIsLive } from "../_shared/stickman/urlVerify.ts";
import { nicheGuidanceFor } from "../_shared/stickman/nicheGuidance.ts";
import { installCassetteRecorder } from "../_shared/stickman/cassette.ts";
import { sourceIndex, factSources, isLiveUrl } from "../_shared/stickman/claimSources.ts";
import {
  findBannedLecturePhrases,
  findNumberedListEnumerations,
  checkColdOpen,
  checkQuestionCadence,
  checkSpecificity,
  checkBridging,
  checkCallback,
  checkTitleQuestionRestated,
  checkCloserRhythm,
  sanitizeTtsHygiene,
  stripSpokenCitations,
  findSpokenCitations,
  findTtsHygieneIssues,
  findRepeatedStatistics,
  findListicleCloser,
  findJargonDensity,
  findScreenGraphicsNarration,
  findImaginationCrutches,
  findForwardReferences,
  extractSentenceContaining,
  findCallbackReference,
  findHedgingOveruse,
  findPreviewEnumeration,
  findColdOpenTooLong,
  findUndeclaredCheckableSentences,
  findStakesOrQuestionOverrun,
  findCallbackRecap,
  findWeakEvidenceSpecificity,
  findGenericSimileOveruse,
  checkQuestionCadenceHardFloor,
} from "../_shared/stickman/scriptChecks.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCRIPT_ADVANCE_SECRET") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
// Benchmarked against the existing gpt-5-mini deployment already proven on
// Research's structured-output planning/extraction/critic passes (same
// family of task: long structured JSON with careful factual constraints).
// Do not upgrade without first benchmarking a materially cheaper OR
// materially better-quality alternative against the fixtures in this
// engagement's Script static tests — see the final report for the
// reasoning, not just the model name.
const OPENAI_MODEL = "gpt-5-mini";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-script`;

// Phase 1g — the model A/B: draft/revision/critic become configurable per
// stage, Stickman-only and additive (every legacy call site keeps `model:
// OPENAI_MODEL` hardcoded, untouched — see runDraft/CRITIC_INSTRUCTIONS's
// own call sites). Defaults to OPENAI_MODEL (gpt-5-mini) so an unconfigured
// deploy behaves exactly as before. claim_verify/claim extraction always
// stays on gpt-5-mini per the spec ("keep gpt-5-mini for claim
// extraction/verification") — those call sites are untouched.
// Cost rule (Phase 1 FINAL): "style/quality iterations: fixture replay,
// draft stage only, claim verification OFF, paid critic OFF" — see
// stageDraft's own check. Defaults OFF.
const DRAFT_ONLY_TEST_MODE = (Deno.env.get("LONG_FORM_STICKMAN_DRAFT_ONLY_TEST") ?? "").trim().toLowerCase() === "true";
// Phase 1 FINAL model decision: Claude Sonnet 5 is the config DEFAULT for
// the Stickman recipe (draft/revision/critic), chosen over gpt-5.6-sol per
// the decision rule in the Phase 1 FINAL brief — a draft-only Sonnet 5 test
// on the same Lions fixture/Story Plan as gpt-5.6-sol's Run B scored 7.5/10
// by independent judgment (clean pure-scene cold open, every evidence
// section carrying 2+ specific real numbers/named sources, zero screen/
// picture-crutch language, zero spoken-citation tags, a strong closer line)
// — meeting "≥7 AND within 0.5 of Run B (7.5)" without needing the Opus 5.5
// fallback. At ~$0.24/draft call vs gpt-5.6-sol's ~$0.34-0.39, Sonnet 5 is
// materially cheaper for comparable-or-better quality. Legacy is completely
// unaffected — it never reads these constants (see runDraft/CRITIC_INSTRUCTIONS's
// own hardcoded OPENAI_MODEL call sites).
const STICKMAN_DEFAULT_MODEL = "claude-sonnet-5";
const STICKMAN_DRAFT_MODEL = Deno.env.get("LONG_FORM_STICKMAN_DRAFT_MODEL") ?? STICKMAN_DEFAULT_MODEL;
const STICKMAN_REVISION_MODEL = Deno.env.get("LONG_FORM_STICKMAN_REVISION_MODEL") ?? STICKMAN_DEFAULT_MODEL;
const STICKMAN_CRITIC_MODEL = Deno.env.get("LONG_FORM_STICKMAN_CRITIC_MODEL") ?? STICKMAN_DEFAULT_MODEL;

// gpt-5.6-sol pricing (OpenAI, confirmed via developers.openai.com/api/docs/models/gpt-5.6-sol
// as of Sep 2026) — promotional pricing OpenAI lists as available at least
// through November 21, 2026; may change after that. $5.00/1M input,
// $30.00/1M output (cached input at $0.50/1M is not modeled here — none of
// these calls use prompt caching across requests the way the shared
// draft/critic/revision instructions already benefit from within a single
// deploy's identical prefix).
const GPT_5_6_SOL_INPUT_PER_M = 5.0;
const GPT_5_6_SOL_OUTPUT_PER_M = 30.0;
// Phase 1 FINAL — Claude pricing (Anthropic, confirmed current Sep 2026):
// Sonnet 5 $2.00/1M input, $10.00/1M output (this was introductory pricing
// that Anthropic made permanent in Aug 2026, not promotional). Opus 5.5
// $4.00/1M input, $20.00/1M output. Cache discounts follow Anthropic's
// standard, model-independent multiplier structure (documented on their
// pricing page): a 5-minute cache WRITE costs 1.25x the base input rate,
// a cache READ costs 0.1x the base input rate (a flat 90% discount) — see
// pricingForModel's own cache fields below, applied to whichever base rate
// the model resolves to.
const CLAUDE_SONNET_5_INPUT_PER_M = 2.0;
const CLAUDE_SONNET_5_OUTPUT_PER_M = 10.0;
const CLAUDE_OPUS_5_5_INPUT_PER_M = 4.0;
const CLAUDE_OPUS_5_5_OUTPUT_PER_M = 20.0;
function isAnthropicModel(model: string): boolean {
  return model.startsWith("claude-");
}
function pricingForModel(model: string): { input: number; output: number; cacheWrite: number; cacheRead: number } {
  let input: number;
  let output: number;
  if (model === "gpt-5.6-sol") {
    input = GPT_5_6_SOL_INPUT_PER_M;
    output = GPT_5_6_SOL_OUTPUT_PER_M;
  } else if (model === "claude-sonnet-5") {
    input = CLAUDE_SONNET_5_INPUT_PER_M;
    output = CLAUDE_SONNET_5_OUTPUT_PER_M;
  } else if (model === "claude-opus-5-5" || model === "claude-opus-5.5") {
    input = CLAUDE_OPUS_5_5_INPUT_PER_M;
    output = CLAUDE_OPUS_5_5_OUTPUT_PER_M;
  } else {
    input = GPT5_MINI_INPUT_PER_M;
    output = GPT5_MINI_OUTPUT_PER_M;
  }
  return { input, output, cacheWrite: input * 1.25, cacheRead: input * 0.1 };
}

// Phase 1 FINAL — Anthropic Messages API, alongside OpenAI's Responses API.
// Structured output uses Anthropic's tool-use mechanism (a single tool
// definition whose input_schema IS the same JSON-schema object our OpenAI
// calls already build via buildStickmanDraftSchema/buildStickmanCriticSchema/
// buildRevisionSchema — no separate schema authoring needed), with
// tool_choice forcing that exact tool so the response is always the
// structured JSON, never free text. The stable system prompt (draft/critic
// instructions, which already embed the gold example script + before/after
// examples + calibration anchors) gets a cache_control breakpoint so it's
// written to cache once and read cheaply on every subsequent call within
// the cache's TTL — this is the single biggest lever for cost here, since
// that system prompt is thousands of tokens repeated on every call.
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
async function callAnthropic(request: any, timeoutMs: number) {
  const response = await fetch(ANTHROPIC_MESSAGES_URL, {
    method: "POST",
    headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Anthropic ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

// Same defense-in-depth kill switch pattern as LONG_FORM_RESEARCH_PAUSED —
// checked before anything else, before any claim, before any DB write. A
// paused tick disturbs nothing.
const SCRIPT_PAUSED = (Deno.env.get("LONG_FORM_SCRIPT_PAUSED") ?? "").trim().toLowerCase() === "true";

// Auto-chaining a targeted Research repair (see triggerTargetedRepair below)
// dispatches INTO advance-long-form-research, the reverse direction of that
// function's own auto-chain back into this one — same shared secret store,
// just read from this side. Respects Research's own pause flag too: if
// Research is paused, a repair is never started (the script simply settles
// at needs_attention instead of quietly queuing work that won't run).
const RESEARCH_PAUSED = (Deno.env.get("LONG_FORM_RESEARCH_PAUSED") ?? "").trim().toLowerCase() === "true";
const RESEARCH_ADVANCE_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const RESEARCH_ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-research`;
// V1 cap: at most one automatic targeted-research-repair round per Script
// creation workflow. A script built from an already-once-repaired research
// version (repair_round >= this) that still can't be written honestly stops
// at needs_attention instead of chaining another repair — never
// research -> script -> research -> script forever.
const MAX_AUTOMATIC_REPAIR_ROUNDS = 1;

// Phase 1 FINAL — raised from 120s after a real incident: a Claude Sonnet 5
// draft that hit the (also just-raised) 16000-output-token cap needed the
// full generation to complete, and Sonnet 5's observed throughput on this
// workload (~105 output tokens/sec, measured from a truncated 8192-token
// call taking ~78s) puts a full 16000-token generation at ~150s — inside the
// old 120s ceiling would abort a legitimate, still-in-progress generation.
// 180s leaves ~30s of headroom without reaching for the platform's own
// limit (same proportionate-not-maximal philosophy as CRITIC_TIMEOUT_MS's
// own comment below).
const DRAFT_TIMEOUT_MS = 180_000; // one full-script structured generation, single attempt (see callStructured)
// Critic's input (criticInput: full script_document + full evidencePack +
// draftWarnings + length diagnostics) is a strict superset of draft's own
// input (draftInput: narrativeStrategy + storyPlan summary + the same
// evidencePack) plus the entire generated script on top — measurably
// larger, never smaller, than what draft is given 120s for. 60s was half
// of draft's budget for a strictly bigger prompt and a comparably
// reasoning-heavy structured response (9 evaluation lenses across every
// segment). Real incident: a genuine critic call on a 21-segment script
// (~56KB combined input) hit this wall and was aborted by
// AbortSignal.timeout at exactly 60.000s (script 63c3df8b-...). Raised to
// match revision's own budget — proportionate to the real payload, not a
// reach toward the platform's actual limit — while the recovery sweep
// (long-form-script-advance, see 20260924120000) is the actual fix for a
// timeout that still happens occasionally.
const CRITIC_TIMEOUT_MS = 120_000;
const REVISION_TIMEOUT_MS = 120_000; // covers both the common selective-patch path and the exceptional full-rewrite path
const MAX_STAGE_ATTEMPTS = 3;

// The hard cap this milestone was built around: Draft + Critic + (selective
// Revision OR one full rewrite) = 3 normal calls, never a critic/revision
// loop. Bounded malformed-output repair is tracked completely separately
// (repairCalls in meta) so it can never silently inflate this number.
const MAX_SCRIPT_MODEL_CALLS = 3;
const MAX_REPAIR_CALLS = 1;

// Same rate generate-long-form-story-plan already uses to turn a target
// length in minutes into target_words (targetWords = minutes * 150) — reused
// here so narration duration is always computed the same way the word
// budget itself was set, never a second, disconnected timing system. A real
// incident this fixes: per-segment `estimatedSeconds` is a value the MODEL
// itself guesses at generation time, completely disconnected from how many
// words it actually wrote — a script that came in at 1,252 real words (56%
// of a 2,250-word budget) still had its per-segment estimatedSeconds sum to
// something that displayed as a full 15 minutes. Duration must always be
// derived from actual persisted word counts — see computeEstimatedDurationSeconds
// and attachChapterMetrics below — `estimatedSeconds` stays in the schema
// only for shape compatibility with already-persisted documents; nothing in
// this file trusts it for timing anymore.
// Phase 0, Section C.1 — now the shared constant (was a second, independent
// 150 that happened to match generate-long-form-story-plan's own copy but
// disagreed with the frontend's 145 display estimate).

// A script materially under its word budget is a real production mismatch,
// not a stylistic preference — see the existing WORD_BUDGET_TOLERANCE
// (±15%, i.e. 85-115%) below, which already treats anything outside that
// band as worth a warning. This is a SEPARATE, harder floor: below it, the
// video meaningfully fails to deliver the length the user was promised and
// must not become "ready" without at least one attempt to fix it. Bounded
// and tracked completely separately from MAX_SCRIPT_MODEL_CALLS (like
// repairCalls above) so it can never turn into an unbounded expansion loop.
const HARD_MIN_LENGTH_RATIO = 0.75;
const MAX_LENGTH_EXPANSION_CALLS = 1;
// Phase 1c, Section 3 — Stickman-only, additive: legacy keeps triggering
// expansion only below HARD_MIN_LENGTH_RATIO (25% short) unchanged. Stickman
// triggers the same bounded expansion pass at a tighter 10% shortfall so a
// script that's merely somewhat short (not yet 25% short) still gets the one
// repair attempt before finalizing, instead of only ever catching the worst
// cases.
const STICKMAN_LENGTH_EXPANSION_TRIGGER_RATIO = 0.9;

// Same bounded, tracked-separately philosophy as MAX_LENGTH_EXPANSION_CALLS,
// for the OTHER way a script can get stuck once the one automatic research
// repair round (MAX_AUTOMATIC_REPAIR_ROUNDS) is exhausted and real evidence
// gaps remain: a critic-flagged unsupported-precision claim (an exact future
// number no source has published) needs the specific claim softened, not
// more research that already failed to find it. One bounded, validated pass
// — never a second, and never a loop back to research (see stageFinalizing's
// own comment on this invariant).
const MAX_CONSERVATIVE_REWRITE_CALLS = 1;
const CONSERVATIVE_REWRITE_TIMEOUT_MS = 90_000;

// Real per-run cost stayed under $0.05 in live testing for legacy/pre-Phase-1d
// Stickman scripts — this ceiling is a generous emergency circuit breaker
// against a bug or a retry storm, not a pricing assumption. Not used to
// charge users. Phase 1d adds up to STICKMAN_CLAIM_VERIFY_MAX_SEARCHES (8)
// real web_search calls (~$0.03 each incl. search fee) plus one fix call to
// the Stickman path specifically — worst case that alone is ~$0.25-0.30 on
// top of draft/critic/revision, which could trip the OLD $0.30 ceiling on a
// perfectly healthy run. Raised to give real headroom for the new claim
// verify/fix stages while staying well above the ≤$0.35-per-script target
// (research-lite + draft + verify + fix + critic) — still a circuit
// breaker, not a target.
const MAX_SCRIPT_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_SCRIPT_COST_USD") ?? 0.5);

// Phase 1 FINAL — Stickman's own circuit breakers. Its core calls are draft
// + critic + revision + one post-revision re-critique (4, not 3), and on
// Claude Sonnet 5 a healthy full run costs ~$0.45-0.65 (a real Ancient
// Humans run hit $0.4989 before its re-critique), which the gpt-5-mini-era
// $0.50 ceiling would kill mid-pipeline. Legacy keeps 3 / $0.50 unchanged.
// Phase 1 close-out — READY needs critic >= 6.5, not 7. The critic is a quality
// signal, not a coin flip: the same untouched closer scored ending 8 then 5
// across two passes. Both passes are stored (qualitySummary.criticScoreHistory).
const STICKMAN_READY_CRITIC_SCORE = 6.5;
const STICKMAN_STAGE_LEASE_MS = 7 * 60_000;
const MAX_STICKMAN_SCRIPT_MODEL_CALLS = 4;
const MAX_STICKMAN_SCRIPT_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_STICKMAN_SCRIPT_COST_USD") ?? 1.0);

// Phase 0, Section C.3 — GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M now come from
// the shared constants module too (imported below with WORDS_PER_MINUTE).

const SEGMENT_TARGET_MIN_WORDS = 40;
const SEGMENT_TARGET_MAX_WORDS = 120;
const SEGMENT_HARD_MAX_WORDS = 200; // a segment past this is a validator error, not just a style warning
const WORD_BUDGET_TOLERANCE = 0.15; // ±15% of targetWords is fine; only flagged as a warning outside that band, never blocked

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ============================ OpenAI plumbing ============================ */
// Deliberately simpler than advance-long-form-research's — there is no
// web_search code path anywhere in this file, so there's nothing here that
// could accidentally attach it. Kept as its own copy (not a shared import)
// rather than risk touching Research's already-proven, already-deployed
// file for an unrelated milestone.

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function parseJson(raw: string) {
  const clean = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(clean);
}

async function callOpenAI(request: any, timeoutMs: number) {
  const response = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

// Phase 1d — webSearchRequests/actualWebSearchToolCalls are additive: every
// existing call site (draft/critic/revision/length_expansion/conservative_rewrite)
// never passes isWebSearch, so these stay 0 and cost math is byte-identical
// to before. Only runStickmanClaimVerify (new) sets isWebSearch:true — this
// is the first time Script itself makes a real web_search call.
// Phase 1 FINAL — cacheReadTokens/cacheWriteTokens are additive (default 0
// for every OpenAI call, which never populates them): Anthropic's usage
// block reports cache_read_input_tokens/cache_creation_input_tokens
// separately from input_tokens, and they're priced differently (see
// pricingForModel's cacheRead/cacheWrite fields) — tracked here so
// mergeMeta can log real cache reads/writes, not just a blended average.
type UsageTotals = { inputTokens: number; outputTokens: number; reasoningTokens: number; modelCalls: number; webSearchRequests: number; actualWebSearchToolCalls: number; cacheReadTokens: number; cacheWriteTokens: number };
function newUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, modelCalls: 0, webSearchRequests: 0, actualWebSearchToolCalls: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
}
function trackAnthropicUsage(totals: UsageTotals, payload: any) {
  const usage = payload?.usage;
  if (usage) {
    totals.inputTokens += usage.input_tokens ?? 0;
    totals.outputTokens += usage.output_tokens ?? 0;
    totals.cacheReadTokens += usage.cache_read_input_tokens ?? 0;
    totals.cacheWriteTokens += usage.cache_creation_input_tokens ?? 0;
    totals.modelCalls += 1;
  }
}
// Real incident (Phase 1 FINAL format-draft test, "Myth vs Reality"): a
// 1450-word draft across 10 chapters produced a JSON tool_use payload large
// enough to hit the old max_tokens:8192 cap — BOTH the initial call and its
// one repair attempt truncated mid-generation (confirmed via the ledger:
// outputTokens === 16384, exactly 2x the cap), and the incomplete tool_use
// input silently came back with an empty/partial chapters array, which only
// surfaced two stages later as a confusing "chapter_set_mismatch" after
// paying for two wasted calls. Failing fast on stop_reason:"max_tokens" here
// turns that into an immediate, diagnosable error instead.
function extractAnthropicToolInput(payload: any): any {
  if (payload?.stop_reason === "max_tokens") {
    throw new Error(`Anthropic response was truncated by max_tokens (output_tokens=${payload?.usage?.output_tokens}) before completing its tool call — raise ANTHROPIC_DRAFT_MAX_TOKENS or shorten the request.`);
  }
  for (const block of payload?.content ?? []) {
    if (block?.type === "tool_use") return block.input;
  }
  throw new Error("Anthropic response contained no tool_use block");
}
function extractActualToolCalls(payload: any): number {
  let count = 0;
  for (const item of payload?.output ?? []) {
    if (item?.type === "web_search_call") count += 1;
  }
  return count;
}
function trackUsage(totals: UsageTotals, payload: any, isWebSearch = false) {
  const usage = payload?.usage;
  if (usage) {
    totals.inputTokens += usage.input_tokens ?? 0;
    totals.outputTokens += usage.output_tokens ?? 0;
    totals.reasoningTokens += usage.output_tokens_details?.reasoning_tokens ?? 0;
    totals.modelCalls += 1;
  }
  if (isWebSearch) {
    totals.webSearchRequests += 1;
    totals.actualWebSearchToolCalls += extractActualToolCalls(payload);
  }
}

// Single attempt only, same reasoning as Research's callStructured: the
// orchestration layer's own attempt/backoff/reclaim (handleStageFailure)
// handles retries via a fresh invocation, so a call never doubles its own
// worst-case latency by retrying itself.
//
// PROMPT CACHING: `instructions` is always one of the fixed template-literal
// constants below (DRAFT_INSTRUCTIONS / CRITIC_INSTRUCTIONS /
// REVISION_INSTRUCTIONS) — never rebuilt or reordered per request — so the
// stable instruction prefix is byte-identical across every Draft call (and
// every Critic call, and every Revision call), which is exactly the shape
// automatic prompt caching rewards. All per-request variability lives in
// `input`, never mixed into `instructions`.
async function callStructured(baseRequest: any, timeoutMs: number, usageTotals: UsageTotals) {
  const payload = await callOpenAI(baseRequest, timeoutMs);
  trackUsage(usageTotals, payload);
  return parseJson(extractOutputText(payload));
}

// Phase 1 FINAL — provider-agnostic structured call for Stickman's
// configurable draft/revision/critic stages (see STICKMAN_DRAFT_MODEL etc).
// Anthropic uses tool-use (forced via tool_choice) with the EXACT SAME
// JSON-schema object the OpenAI path already builds via
// buildStickmanDraftSchema/buildStickmanCriticSchema/buildRevisionSchema —
// no separate schema authoring per provider. The stable system prompt gets
// a cache_control breakpoint so repeated calls within the cache's TTL (the
// revision call after a draft call, or many scripts in one session) reuse
// the cached prefix instead of re-paying full input price for it every
// time — this prompt is large (gold example script + before/after examples
// + calibration anchors), so this is the single biggest cost lever here.
// Legacy and every non-Stickman-configurable call site never reaches this
// function at all — they call callStructured directly, unchanged.
// 16000 comfortably covers the largest expected draft (a long-video, many-
// chapter script's structured JSON, including per-segment id/factId
// overhead) at Claude Sonnet 5's $10/1M output rate — a worst case of 16000
// output tokens is ~$0.16, the same order of magnitude as a single truncated
// attempt under the old too-small cap, so raising this costs nothing extra
// in the common case (you only pay for tokens actually produced) while
// eliminating the truncation failure mode entirely.
const ANTHROPIC_DRAFT_MAX_TOKENS = 16000;

async function callStickmanModel(model: string, instructions: string, input: string, schema: any, schemaName: string, timeoutMs: number, usage: UsageTotals): Promise<any> {
  if (isAnthropicModel(model)) {
    const payload = await callAnthropic(
      {
        model,
        max_tokens: ANTHROPIC_DRAFT_MAX_TOKENS,
        system: [{ type: "text", text: instructions, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: input }],
        tools: [{ name: schemaName, description: `Produces the ${schemaName} structured result.`, input_schema: schema }],
        tool_choice: { type: "tool", name: schemaName },
      },
      timeoutMs
    );
    trackAnthropicUsage(usage, payload);
    return extractAnthropicToolInput(payload);
  }
  return await callStructured({ model, store: false, instructions, input, text: { format: { type: "json_schema", name: schemaName, strict: true, schema } } }, timeoutMs, usage);
}

// Phase 1d — actualToolCalls is additive (defaults to 0, matching every
// existing non-web-search caller exactly). WEB_SEARCH_PER_CALL mirrors
// Research's own flat per-tool-call fee (see that file's own constant).
// Phase 1g — `model` is additive too (defaults to OPENAI_MODEL, so every
// existing 3-arg call site prices exactly as before); pricingForModel picks
// the right per-token rate so a script that mixes models (the A/B) prices
// each call correctly instead of assuming one global rate.
const WEB_SEARCH_PER_CALL = 0.01;
function ledgerEntry(stage: string, inputTokens: number, outputTokens: number, actualToolCalls = 0, model: string = OPENAI_MODEL, cacheReadTokens = 0, cacheWriteTokens = 0) {
  const pricing = pricingForModel(model);
  const modelCost = (inputTokens * pricing.input + outputTokens * pricing.output + cacheReadTokens * pricing.cacheRead + cacheWriteTokens * pricing.cacheWrite) / 1_000_000;
  const searchCost = actualToolCalls * WEB_SEARCH_PER_CALL;
  return { stage, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, actualToolCalls, estimatedCostUsd: Number((modelCost + searchCost).toFixed(4)) };
}

function mergeMeta(existing: any, usage: UsageTotals, extra?: Record<string, any>, newLedgerEntry?: any) {
  const meta = { ...(existing ?? {}) };
  meta.model = OPENAI_MODEL;
  meta.modelCalls = (meta.modelCalls ?? 0) + usage.modelCalls;
  meta.webSearchRequests = (meta.webSearchRequests ?? 0) + (usage.webSearchRequests ?? 0);
  meta.actualWebSearchToolCalls = (meta.actualWebSearchToolCalls ?? 0) + (usage.actualWebSearchToolCalls ?? 0);
  meta.inputTokens = (meta.inputTokens ?? 0) + usage.inputTokens;
  meta.outputTokens = (meta.outputTokens ?? 0) + usage.outputTokens;
  meta.reasoningTokens = (meta.reasoningTokens ?? 0) + usage.reasoningTokens;
  // Phase 1 FINAL — cache reads/writes logged separately (Anthropic's own
  // usage split); 0 for every OpenAI call, which never populates them.
  meta.cacheReadTokens = (meta.cacheReadTokens ?? 0) + (usage.cacheReadTokens ?? 0);
  meta.cacheWriteTokens = (meta.cacheWriteTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  meta.callLedger = [...(meta.callLedger ?? []), ...(newLedgerEntry ? [newLedgerEntry] : [])];
  // Phase 1g — cost is summed directly from each ledger entry's own
  // estimatedCostUsd (each entry already prices itself with whichever model
  // actually made that call), never recomputed from accumulated raw tokens
  // against one fixed global rate. The old fixed-rate approach was only
  // ever correct because every call in a script used the same model; the
  // model A/B breaks that assumption by design (draft/revision/critic on
  // one model, claim verify on gpt-5-mini always), so summing already-
  // correctly-priced per-call costs is the only way totals stay accurate.
  // For legacy and any pre-1g Stickman ledger entry (no actualToolCalls),
  // this sums to the exact same number the old fixed-rate formula gave.
  const searchCost = meta.actualWebSearchToolCalls * WEB_SEARCH_PER_CALL;
  const totalFromLedger = meta.callLedger.reduce((sum: number, e: any) => sum + (e.estimatedCostUsd ?? 0), 0);
  meta.estimatedSearchCostUsd = Number(searchCost.toFixed(4)); // 0 for legacy and for every Stickman script with no flagged claims
  meta.estimatedModelCostUsd = Number((totalFromLedger - searchCost).toFixed(4));
  meta.estimatedTotalCostUsd = Number(totalFromLedger.toFixed(4));
  return { ...meta, ...(extra ?? {}) };
}

function countWords(text: string): number {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/* ============================ ScriptEvidencePack ============================ */
// Built ONCE at the draft stage, cached into intermediate.evidencePack, and
// reused unchanged by every later pass (critic, revision) — never rebuilt
// per-call, never re-fetches raw research material. This is the single
// biggest cost lever in this file: it compresses a research version's full
// FactGraph + Coverage + Sources (which can be 15-30KB of JSON) down to only
// what a script writer actually needs — WHAT is supported, not the page
// that proved it.
type EvidenceFact = { factId: string; claim: string; classification: string; confidence: string; uncertaintyNotes: string | null };
type EvidenceChapter = {
  chapterId: string;
  title: string;
  purpose: string;
  coverageStatus: "strong" | "moderate" | "weak";
  usableFacts: EvidenceFact[];
  disputes: { factId: string; claim: string; disputeSummary: string | null }[];
  unsupportedAreas: string[];
  // Phase 1 "Stickman Script Mode" — an optional passthrough of the Story
  // Plan's own section role (cold_open/stakes/core_question/evidence/twist/
  // callback_payoff/closer for Stickman; always undefined for the legacy
  // recipe, whose chapters carry no `role` field at all). Additive only —
  // nothing reads this for the legacy path, so legacy behavior is unchanged.
  role?: string;
};
type ScriptEvidencePack = {
  centralQuestion: string;
  viewerPromise: string;
  resolvedLengthMinutes: number;
  targetWords: number;
  overallCoverage: string;
  chapters: EvidenceChapter[];
};

function buildEvidencePack(project: any, storyPlan: any, narrativeStrategy: any, factGraph: any, coverage: any): ScriptEvidencePack {
  const facts: any[] = factGraph?.facts ?? [];
  const coverageByChapter = new Map((coverage?.chapterCoverage ?? []).map((c: any) => [c.chapterId, c]));

  const chapters: EvidenceChapter[] = (storyPlan?.chapters ?? []).map((c: any) => {
    const chapterFacts = facts.filter((f) => (f.chapterIds ?? []).includes(c.id));
    const cov: any = coverageByChapter.get(c.id);
    const status = cov?.status ?? "moderate";
    return {
      chapterId: c.id,
      title: c.title,
      purpose: c.purpose ?? c.summary ?? "",
      coverageStatus: status,
      usableFacts: chapterFacts
        .filter((f) => f.scriptUsable !== false)
        .map((f) => ({ factId: f.id, claim: f.claim, classification: f.classification, confidence: f.confidence, uncertaintyNotes: f.uncertaintyNotes ?? null })),
      disputes: chapterFacts.filter((f) => f.disputed).map((f) => ({ factId: f.id, claim: f.claim, disputeSummary: f.disputeSummary ?? null })),
      unsupportedAreas: status === "strong" ? [] : [cov?.note].filter(Boolean),
      role: typeof c.role === "string" ? c.role : undefined,
    };
  });

  return {
    centralQuestion: narrativeStrategy?.viewerQuestion ?? storyPlan?.hookConcept ?? "",
    viewerPromise: storyPlan?.viewerPromise ?? "",
    resolvedLengthMinutes: project?.resolved_length_minutes ?? 10,
    targetWords: project?.target_words ?? 1500,
    overallCoverage: coverage?.overallCoverage ?? "moderate",
    chapters,
  };
}

function allUsableFactIds(pack: ScriptEvidencePack): string[] {
  const ids = new Set<string>();
  for (const c of pack.chapters) for (const f of c.usableFacts) ids.add(f.factId);
  return Array.from(ids);
}

/* ============================ Deterministic validators (zero AI cost) ============================ */
// Everything in this section is plain code, never a model call. Anything
// normal code can detect must never be spent on a Critic call to detect.

type ValidationIssue = { code: string; message: string; segmentIds?: string[] };
type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };

// Formulaic openers are fine occasionally — flagged only once they become a
// pattern (see section 15/16 of the product brief: "some are natural,
// repeated patterns sound AI-generated"). Checked case-insensitively against
// the first few words of each segment only, never mid-segment.
const FORMULAIC_OPENERS = ["but", "however", "now,", "so,", "here's the thing", "and that's when", "what happened next"];
// Checked anywhere in the text — these phrases are bad wherever they land,
// not just as openers.
const SLOP_PHRASES = [
  "have you ever wondered", "in today's video", "before we begin", "make sure to subscribe",
  "let's delve into", "let's explore", "it is important to note", "one fascinating aspect",
  "another interesting fact", "this begs the question", "in conclusion",
];

function computeActualWords(doc: any): number {
  return (doc.narrationSegments ?? []).reduce((sum: number, s: any) => sum + countWords(s.text), 0);
}
// Derived from actual narration word count at WORDS_PER_MINUTE — never
// summed from per-segment estimatedSeconds (a model self-report, not a
// measurement; see the constant's own comment above for the real incident
// this replaces).
function computeEstimatedDurationSeconds(doc: any): number {
  return Math.round((computeActualWords(doc) / narrationWpm(doc)) * 60);
}

// Phase 2c — the selected voice's measured pace (src/lib/voicePace.ts), set on
// Stickman drafts from the story plan's own target (target_words /
// resolved_length_minutes, which generate-long-form-story-plan derives from
// that pace). Legacy documents never carry it and keep WORDS_PER_MINUTE.
function narrationWpm(doc: any): number {
  const wpm = Number(doc?.narrationWpm);
  return wpm > 0 ? wpm : WORDS_PER_MINUTE;
}
function packWpm(pack: ScriptEvidencePack): number {
  return pack.targetWords > 0 && pack.resolvedLengthMinutes > 0 ? Math.round(pack.targetWords / pack.resolvedLengthMinutes) : WORDS_PER_MINUTE;
}

// Same principle at chapter granularity — the UI's per-chapter duration
// must come from that chapter's actual narration text, not a model-guessed
// number. Attached to every persisted scriptDocument (draft, revision,
// finalizing, and the length-expansion pass) so the frontend can read
// authoritative numbers directly instead of recomputing from segments
// itself (which is exactly the mistake that let the old estimatedSeconds
// field leak into the chapter-duration display too).
function attachChapterMetrics(doc: any) {
  const wordsByChapter = new Map<string, number>();
  for (const s of doc.narrationSegments ?? []) {
    wordsByChapter.set(s.chapterId, (wordsByChapter.get(s.chapterId) ?? 0) + countWords(s.text));
  }
  const chapters = (doc.chapters ?? []).map((c: any) => {
    const words = wordsByChapter.get(c.chapterId) ?? 0;
    return { ...c, actualWords: words, estimatedSeconds: Math.round((words / narrationWpm(doc)) * 60) };
  });
  return { ...doc, chapters };
}

// 2026-09-20 real-incident fix: openLoops (the writer's own internal setup/
// payoff tracking, e.g. {id:"ol_eject", question:"..."}) is given to the
// writer/critic/revision calls as CONTEXT so it can reference "the eject
// question" conceptually — nothing ever instructed it not to echo the bare
// internal id back into the actual spoken narrationText. Real repro
// (project f7dc5503-..., script 49dd2f2f-...): segments s1/s2/s9 shipped to
// "ready" containing literal "(ol_eject)", "(closing the ol_eject
// question)", "(closing the ol_rotation_tilt thread ...)" — a planning
// artifact that would be read aloud verbatim by TTS. Every real occurrence
// found was a clean parenthetical aside referencing the id, so stripping the
// whole parenthetical (never just the bare token, which could otherwise
// leave a dangling "the " or broken clause) is safe and keeps the
// surrounding sentence grammatical. Deterministic, no provider call — run
// unconditionally on every finalized document, not just ones with flagged
// issues, since this is a leak class, not a per-run coincidence.
const INTERNAL_OPEN_LOOP_MARKER = /\s*\([^()]*\bol_[a-z0-9_]+\b[^()]*\)/gi;
function stripInternalOpenLoopMarkers(doc: any) {
  const narrationSegments = (doc.narrationSegments ?? []).map((s: any) => {
    const text = typeof s.text === "string" ? s.text.replace(INTERNAL_OPEN_LOOP_MARKER, "").replace(/\s{2,}/g, " ").trim() : s.text;
    return text === s.text ? s : { ...s, text };
  });
  return { ...doc, narrationSegments };
}

// 2026-09-20 real-incident fix: a chapter the writer flags in
// insufficientEvidenceChapterIds is expected to end up EITHER honestly
// bridged (a hedged sentence or two, softened by the conservative-rewrite
// pass) OR the run held at needs_attention — never ready with the chapter
// simply left empty. Real repro: chapter c6 ("the Moon as a cosmic shield")
// shipped to "ready" with segmentIds: [], actualWords: 0, estimatedSeconds:
// 0 — a real story-plan chapter with literally no narration, rendering as a
// silent 0:00 entry. This happened because the conservative-rewrite pass can
// only SOFTEN existing segment text — it has nothing to rewrite for a
// chapter that was never written at all, so a run softening a DIFFERENT
// weak chapter (which did have text) could still validate clean and reach
// "ready" while c6 stayed hollow. This is the deterministic backstop
// validateScriptDocument itself doesn't check: any story-plan chapter with
// zero narration segments must never be presented as a completed script —
// caught here, after every writer/repair/rewrite attempt, before status can
// become "ready".
function findEmptyChapters(doc: any): { chapterId: string; title: string }[] {
  const coveredChapterIds = new Set((doc.narrationSegments ?? []).map((s: any) => s.chapterId));
  return (doc.chapters ?? [])
    .filter((c: any) => !coveredChapterIds.has(c.chapterId) || (c.segmentIds ?? []).length === 0)
    .map((c: any) => ({ chapterId: c.chapterId, title: c.title }));
}

function findRepeatedNGrams(segments: any[], n = 6): ValidationIssue[] {
  const seen = new Map<string, string[]>();
  for (const s of segments) {
    const words = (s.text ?? "").toLowerCase().replace(/[^a-z0-9\s']/g, "").split(/\s+/).filter(Boolean);
    for (let i = 0; i + n <= words.length; i++) {
      const gram = words.slice(i, i + n).join(" ");
      if (!seen.has(gram)) seen.set(gram, []);
      seen.get(gram)!.push(s.id);
    }
  }
  const issues: ValidationIssue[] = [];
  for (const [gram, ids] of seen) {
    const uniqueSegments = Array.from(new Set(ids));
    if (uniqueSegments.length > 1) issues.push({ code: "repeated_phrase", message: `The exact phrase "${gram}" appears in ${uniqueSegments.length} different segments.`, segmentIds: uniqueSegments });
  }
  return issues;
}

function findRepeatedOpeners(segments: any[]): ValidationIssue[] {
  const counts = new Map<string, string[]>();
  for (const s of segments) {
    const firstWords = (s.text ?? "").trim().toLowerCase().split(/\s+/).slice(0, 2).join(" ");
    const opener = FORMULAIC_OPENERS.find((o) => firstWords.startsWith(o));
    if (opener) {
      if (!counts.has(opener)) counts.set(opener, []);
      counts.get(opener)!.push(s.id);
    }
  }
  const issues: ValidationIssue[] = [];
  for (const [opener, ids] of counts) {
    if (ids.length >= 3) issues.push({ code: "formulaic_opener", message: `"${opener}" is used to open ${ids.length} different segments.`, segmentIds: ids });
  }
  return issues;
}

function findSlopPhrases(segments: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const s of segments) {
    const lower = (s.text ?? "").toLowerCase();
    for (const phrase of SLOP_PHRASES) {
      if (lower.includes(phrase)) issues.push({ code: "slop_phrase", message: `Segment contains the generic phrase "${phrase}".`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// A real, live-tested failure mode: a draft can be perfectly factual and
// still be unusable, because it talks ABOUT the research process instead of
// just delivering the narration ("Here's a delicate place where the
// evidence available for this script ran short..."). A viewer must never
// hear that this is a "script", that "research" or "sources" were
// "available"/"provided"/"supplied", or any first-person disclaimer about
// what could or couldn't be verified. This is a HARD error (see
// validateScriptDocument below) — a script containing this can never become
// ready, the same way one with an invented factId never can.
//
// Deliberately pattern-based, not one string comparison: exact phrases are
// only examples of a concept-family (self-referential meta-commentary about
// evidence/process), so this also matches paraphrases of the same idea the
// literal phrase list would miss.
const META_LANGUAGE_PATTERNS: RegExp[] = [
  /\bthis script\b/i,
  /\b(the )?(available|provided|supplied|included|current) (research|evidence|sources?|material)\b/i,
  /\bfact[\s-]?graph\b/i,
  /\bunsupported chapter\b/i,
  /\bi (can'?t|cannot|couldn'?t) (responsibly|reliably|confidently)?\s*(verify|write|explain|reconstruct|cover)\b/i,
  /\bwithout an? sourced? (reference|material|citation)\b/i,
  /\bscript evidence pack\b/i,
  /\bevidence (pack|available for this (script|video))\b/i,
  /\b(this|the) (narration|section|chapter|segment) (marks|does not|doesn'?t|can'?t|cannot) (attempt|cover|include)\b/i,
  /\bresearch (ran short|fell short)\b/i,
  /\bcritic\b/i,
  /\b(narration|research) (repair|version)\b/i,
  // 2026-09-20 "V1 simplification" pass, SCRIPT SAFETY hard requirement —
  // real incident: the writer's own internal openLoops bookkeeping ids
  // ("ol_eject", "ol_rotation_tilt") leaked verbatim into spoken narration
  // ("...break (ol_eject)?", "closing the ol_eject question"). Internal
  // bookkeeping (loop ids, claim ids, workflow language) must never reach
  // segment.text — this is now caught the same way every other
  // process-language leak already is, everywhere validateScriptDocument
  // runs (draft, revision, expansion, conservative rewrite, and final
  // validation), not just as an end-of-pipeline cleanup pass.
  /\bol_[a-z0-9_]+\b/i,
  /\bopen loop(s)?\b/i,
  /\bclaim[\s-]?id\b/i,
  /\b[a-z0-9]+__c\d+\b/i,
];

function findMetaLanguage(segments: any[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const s of segments) {
    const text = s.text ?? "";
    for (const pattern of META_LANGUAGE_PATTERNS) {
      const match = text.match(pattern);
      if (match) issues.push({ code: "meta_language", message: `Segment exposes internal process language ("${match[0]}") — a viewer must never hear this.`, segmentIds: [s.id] });
    }
  }
  return issues;
}

// Structural checks (hard errors — these mean the output is genuinely
// broken, not just stylistically weak) plus soft signal warnings that get
// forwarded to the Critic as extra context rather than blocking anything.
function validateScriptDocument(doc: any, pack: ScriptEvidencePack, validFactIds: Set<string>): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const segments = doc.narrationSegments ?? [];
  const chapters = doc.chapters ?? [];

  const segmentIds = segments.map((s: any) => s.id);
  const uniqueSegmentIds = new Set(segmentIds);
  if (uniqueSegmentIds.size !== segmentIds.length) errors.push({ code: "duplicate_segment_id", message: "Two or more narration segments share the same id." });

  // Hard error, never a warning — per the Ready Contract, a script
  // containing internal process language can never become ready regardless
  // of how factually correct it otherwise is.
  errors.push(...findMetaLanguage(segments));

  const validChapterIds = new Set(pack.chapters.map((c) => c.chapterId));
  for (const s of segments) {
    if (!validChapterIds.has(s.chapterId)) errors.push({ code: "unknown_chapter_id", message: `Segment ${s.id} references unknown chapterId ${s.chapterId}.`, segmentIds: [s.id] });
    if (!countWords(s.text)) errors.push({ code: "empty_segment", message: `Segment ${s.id} has no narration text.`, segmentIds: [s.id] });
    if (countWords(s.text) > SEGMENT_HARD_MAX_WORDS) errors.push({ code: "segment_too_long", message: `Segment ${s.id} is ${countWords(s.text)} words, over the hard limit.`, segmentIds: [s.id] });
    for (const factId of s.factIds ?? []) {
      // "__none__" is buildSegmentSchema's own placeholder enum value for
      // "no real facts exist to cite" (used whenever factIds is empty, so
      // the schema always has at least one valid enum member) — it is never
      // a real fact reference, so it must never be flagged as an unknown
      // one. Real incident: a Stickman draft with zero usable facts (every
      // segment schema-forced to emit factIds:["__none__"]) failed
      // DRAFT_VALIDATION_FAILED on every single segment because this check
      // rejected the exact placeholder the schema itself required.
      if (factId !== "__none__" && !validFactIds.has(factId)) errors.push({ code: "unknown_fact_id", message: `Segment ${s.id} cites unknown factId ${factId}.`, segmentIds: [s.id] });
    }
  }

  // chapters[] must exactly match the Story Plan's chapter set, in order —
  // Script never adds, drops, or reorders chapters relative to the plan.
  const docChapterIds = chapters.map((c: any) => c.chapterId);
  const planChapterIds = pack.chapters.map((c) => c.chapterId);
  if (JSON.stringify(docChapterIds) !== JSON.stringify(planChapterIds)) {
    errors.push({ code: "chapter_set_mismatch", message: "ScriptDocument chapters do not match the Story Plan's chapters, or are out of order." });
  }

  // sequenceIndex must be strictly increasing within each chapter, and each
  // chapter's segmentIds must exactly match its own segments in that order.
  for (const c of chapters) {
    const chapterSegments = segments.filter((s: any) => s.chapterId === c.chapterId);
    const actualIds = chapterSegments.sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex).map((s: any) => s.id);
    if (JSON.stringify(actualIds) !== JSON.stringify(c.segmentIds)) {
      errors.push({ code: "chapter_segment_order_mismatch", message: `Chapter ${c.chapterId}'s segmentIds do not match its actual segments in order.` });
    }
    for (let i = 1; i < chapterSegments.length; i++) {
      if (!(chapterSegments[i].sequenceIndex > chapterSegments[i - 1].sequenceIndex)) {
        errors.push({ code: "malformed_ordering", message: `Chapter ${c.chapterId} has non-increasing sequenceIndex values.` });
        break;
      }
    }
  }

  // Open loop referential integrity: every openLoop's setup/payoff segment
  // must exist and actually reference the loop back; a loop with no
  // payoffSegmentId is a WARNING (an unresolved loop may still be
  // legitimate mid-revision), never a hard error on its own.
  const segmentById = new Map(segments.map((s: any) => [s.id, s]));
  for (const loop of doc.openLoops ?? []) {
    const setupSegment = segmentById.get(loop.setupSegmentId);
    if (!setupSegment) errors.push({ code: "open_loop_bad_setup", message: `Open loop ${loop.id} references a nonexistent setup segment.` });
    else if (!(setupSegment.openLoopIds ?? []).includes(loop.id)) warnings.push({ code: "open_loop_not_referenced", message: `Open loop ${loop.id}'s setup segment doesn't list it in openLoopIds.`, segmentIds: [loop.setupSegmentId] });

    if (loop.payoffSegmentId) {
      const payoffSegment = segmentById.get(loop.payoffSegmentId);
      if (!payoffSegment) errors.push({ code: "open_loop_bad_payoff", message: `Open loop ${loop.id} references a nonexistent payoff segment.` });
      else if (!(payoffSegment.payoffIds ?? []).includes(loop.id)) warnings.push({ code: "open_loop_payoff_not_referenced", message: `Open loop ${loop.id}'s payoff segment doesn't list it in payoffIds.`, segmentIds: [loop.payoffSegmentId] });
    } else {
      warnings.push({ code: "open_loop_unresolved", message: `Open loop ${loop.id} ("${loop.question}") has no payoff yet.` });
    }
  }

  // Soft signals — never block, always forwarded as Critic context.
  warnings.push(...findRepeatedNGrams(segments), ...findRepeatedOpeners(segments), ...findSlopPhrases(segments));

  const actualWords = computeActualWords(doc);
  const lowBound = pack.targetWords * (1 - WORD_BUDGET_TOLERANCE);
  const highBound = pack.targetWords * (1 + WORD_BUDGET_TOLERANCE);
  if (actualWords < lowBound || actualWords > highBound) {
    warnings.push({ code: "word_budget_off", message: `Script is ${actualWords} words against a ${pack.targetWords}-word budget (±${Math.round(WORD_BUDGET_TOLERANCE * 100)}%).` });
  }
  for (const s of segments) {
    const w = countWords(s.text);
    if (w < SEGMENT_TARGET_MIN_WORDS || w > SEGMENT_TARGET_MAX_WORDS) {
      warnings.push({ code: "segment_length_off", message: `Segment ${s.id} is ${w} words, outside the ${SEGMENT_TARGET_MIN_WORDS}-${SEGMENT_TARGET_MAX_WORDS} target range.`, segmentIds: [s.id] });
    }
  }

  return { errors, warnings };
}

/* ============================ Stickman-only narration craft checks ============================ */
// Phase 1 "Stickman Script Mode" — purely additive. validateScriptDocument
// above is never modified and never called differently for either recipe;
// this wraps it, adding Stickman-only checks on top ONLY when isStickman is
// true. For isStickman=false this is a no-op passthrough — legacy behavior
// is provably identical to calling validateScriptDocument directly.
function validateStickmanNarrationCraft(doc: any, pack: ScriptEvidencePack): ValidationResult {
  const segments = doc.narrationSegments ?? [];
  const plantSeg = doc.plantSegmentIndex != null ? segments[doc.plantSegmentIndex] : undefined;
  const payoffSeg = doc.payoffSegmentIndex != null ? segments[doc.payoffSegmentIndex] : undefined;
  const errors: ValidationIssue[] = [
    ...findBannedLecturePhrases(segments),
    ...findNumberedListEnumerations(segments),
    ...checkColdOpen(segments),
    // Phase 1e/1f/1g — HARD: a listicle recap closer, the narrator
    // describing the screen, a residual TTS-hostile character, a table-of-
    // contents preview in the opening, a cold open that's drifted into
    // analysis, or a callback that recaps instead of paying off are
    // structural defects, not style nits. Real incident this fixes: all
    // four role-dependent checks below used to read doc.chapters[].role —
    // but that field is only populated by enrichStickmanDocument, which
    // runs AFTER stageDraft's own validation. So during the one cheap,
    // bounded draft-repair pass these checks silently matched nothing
    // (empty role sets), and a cold-open/closer/callback defect only
    // surfaced for the first time at FINAL validation post-critic/revision
    // — with no repair budget left, hard-failing an already-paid-for run.
    // pack.chapters[].role is copied from the StoryPlan directly in
    // buildEvidencePack and is correct from the very first call, so these
    // now read role from pack, never from doc.
    ...findListicleCloser(segments, pack.chapters),
    ...findTtsHygieneIssues(segments),
    ...findScreenGraphicsNarration(segments),
    ...findPreviewEnumeration(segments),
    ...findStakesOrQuestionOverrun(segments, pack.chapters),
    ...findCallbackRecap(segments, pack.chapters),
    ...checkQuestionCadenceHardFloor(segments),
    ...findSpokenCitations(segments),
  ];
  const evidenceChapterIds = new Set(pack.chapters.filter((c) => c.role === "evidence").map((c) => c.chapterId));
  const warnings: ValidationIssue[] = [
    // Phase 1 FINAL — demoted from a HARD gate after two real incidents
    // (Myth vs Reality, You vs X format drafts) blocked genuinely excellent,
    // on-brief cold opens purely for using short punchy fragments ("Pulled
    // forward. Off balance.") instead of fewer, longer sentences at the same
    // word count. The 40-70 word cap (checkColdOpen, still HARD) already
    // bounds length; "drifted into analysis" is a semantic judgment the
    // critic's own calibration examples already catch far more reliably
    // than a sentence count ever can. Kept as a WARN lead, not deleted,
    // since an unusually high count can still be worth a critic's second look.
    ...findColdOpenTooLong(segments, pack.chapters),
    ...findHedgingOveruse(segments),
    ...checkQuestionCadence(segments, narrationWpm(doc) === WORDS_PER_MINUTE ? packWpm(pack) : narrationWpm(doc)),
    ...checkSpecificity(segments, evidenceChapterIds),
    ...checkBridging(segments),
    // Phase 1f — verified by segment index + callbackKey, never a
    // model-authored "verbatim quote" string (see checkCallback's own
    // comment for the real paraphrase-mismatch incident this replaces).
    ...checkCallback(segments, doc.plantSegmentIndex, doc.payoffSegmentIndex, doc.callbackKey),
    ...checkTitleQuestionRestated(segments, doc.title ?? ""),
    ...checkCloserRhythm(segments),
    // Phase 1e/1f/1g — WARN: repeated stats, unexplained jargon,
    // imagination crutches, forward-reference/lecture lines, weak evidence
    // specificity, and generic-simile overuse get forced into revision (the
    // Viral Editor's own scoring reads these same deterministic warnings as
    // leads), not blocked outright.
    ...findRepeatedStatistics(segments, plantSeg?.id, payoffSeg?.id),
    ...findJargonDensity(segments),
    ...findImaginationCrutches(segments),
    ...findForwardReferences(segments),
    ...findWeakEvidenceSpecificity(segments, pack.chapters),
    ...findGenericSimileOveruse(segments),
  ];
  return { errors, warnings };
}

function validateWithStickmanExtras(doc: any, pack: ScriptEvidencePack, validFactIds: Set<string>, isStickman: boolean): ValidationResult {
  const base = validateScriptDocument(doc, pack, validFactIds);
  if (!isStickman) return base;
  const extra = validateStickmanNarrationCraft(doc, pack);
  return { errors: [...base.errors, ...extra.errors], warnings: [...base.warnings, ...extra.warnings] };
}

/* ============================ Pass A — Draft ============================ */

const DRAFT_INSTRUCTIONS = `You are Zyvo's Script Engine — a narration writer for illustrated long-form explainer videos. NARRATION IS THE PRODUCT: the video must be worth listening to with the screen off. Visuals come later and support the narration; you are not writing captions for images.

You receive a ScriptEvidencePack (compact, already-verified evidence organized by chapter) plus the video's NarrativeStrategy and StoryPlan. Write the COMPLETE narration for the whole video in one continuous pass — never chapter-by-chapter in isolation, which causes tone drift, repeated introductions, and forgotten open loops. You must understand and honor the whole arc before writing the first sentence.

EVIDENCE DISCIPLINE (the most important rule in this prompt):
- Every chapter has a coverageStatus: strong, moderate, or weak. STRONG means you can confidently explain the supported material. MODERATE means stay within clearly supported claims and avoid unnecessary precision. WEAK means you must NOT improvise missing information — use only the explicitly supported facts provided, shorten or merge the section if there isn't enough to sustain it, use appropriately cautious language, and never fabricate a connective factual claim just to fill space.
- Only use factIds that appear in the ScriptEvidencePack you were given. Never invent a factId. Not every sentence needs one — rhetorical framing, transitions, questions, and storytelling language don't — but any statement asserting a specific fact must cite the factId(s) that support it.
- Preserve uncertainty exactly as given. If a fact is DISPUTED, UNCERTAIN, a REASONABLE_INFERENCE, or a HYPOTHETICAL_ASSUMPTION, the narration must reflect that — never upgrade "evidence is uncertain" into "this definitely happened." Do this naturally, the way a good narrator actually talks: "Researchers aren't completely sure...", "The evidence points toward...", "Under that assumption...", "One likely explanation is..." — never sound academic about it.
- If a chapter's core narrative purpose genuinely cannot be achieved with the evidence you were given, add that chapter's id to insufficientEvidenceChapterIds instead of inventing material to cover the gap. Do not treat "some evidence exists" as "the chapter's purpose is achievable" if the actual claims needed are simply not there.
- A chapter with INCOMPLETE (not absent) evidence is not automatically unwritable. If enough exists to state a true, simplified version of the chapter's core idea, write that — shorter, using only supported facts, bridging naturally into the next supported point, with honest uncertainty where it belongs. For example, if you can't source the exact protocol mechanism, you can still truthfully say devices "listen and wait rather than transmitting whenever they want" if that simplified claim itself is supported — that is a normal narration choice, not a compromise to flag. Only add a chapter to insufficientEvidenceChapterIds when even a simplified, honest version of its core claim has no support at all.

NEVER EXPOSE THE PROCESS — THIS IS AS IMPORTANT AS FACTUAL ACCURACY: a real viewer must never hear that they are listening to "a script", that "research" or "sources" were "available"/"provided"/"supplied"/"included", that a chapter is "unsupported", that you "can't verify" or "can't responsibly write" something, or any other language that refers to your own writing process, the FactGraph, or missing backend data. A viewer must experience a finished narrator who simply chose what to say — never a system explaining its own limitations. If a chapter's evidence is genuinely insufficient, the correct move is ALWAYS to add it to insufficientEvidenceChapterIds (or write the honest simplified bridge described above) — never to write a sentence that talks about the gap itself. "We don't have enough sourced material to explain this" is never acceptable narration, in any phrasing.

LENGTH IS A BUDGET, NOT A QUOTA: targetWords is an approximate production budget, not a padding requirement. A slightly shorter excellent script beats one padded with repeated facts, generic transitions, or rephrased explanations. Aim within roughly ±10-15% of the budget where the story naturally allows it, but never mechanically fill remaining words.

STRUCTURE — question/complication/payoff, not fact-after-fact: strong narration typically moves through something like question/problem → partial answer → consequence → new question/complication → answer → payoff, creating a natural reason to keep listening. This is a tendency, not a rigid template — mechanism explainers, historical reconstructions, survival stories, rise/fall investigations, and hypothetical simulations each need different narrative behavior. Use the NarrativeStrategy and StoryPlan you were given rather than forcing one universal shape. Give useful answers continuously — retention does not mean withholding every answer until the end; the viewer should constantly feel rewarded (answer something → reveal a consequence → create a deeper question → answer it), not starved until a finale.

OPENING: the first 20-40 seconds matter disproportionately. Start fast — establish the question/stakes, deliver useful information early, create a specific curiosity gap, and make the promise of the video clear. Do not spend the opening explaining what the video is about. Avoid "before we begin," "in today's video," "make sure to subscribe," and "have you ever wondered" unless there's an unusually strong specific reason. Start the video.

OPEN LOOPS: NarrativeStrategy already contains planned open loops and payoffs. Track every major deliberate open loop you create with an id, a setup segment, and (when it resolves) a payoff segment. Every major loop you open should eventually close — do not create fake suspense that never pays off.

VOICE — write for speech, not for reading: prefer contractions, clear sentences, varied sentence length, and natural connective language, with occasional short punchy lines. Do not write like an encyclopedia article — avoid "X is a [category] that...", "throughout history", "in conclusion", "it is important to note", "let's delve into", "let's explore", "one fascinating aspect", "another interesting fact", "this begs the question", and generic school-essay structure. The user should feel like a genuinely good YouTube narrator is explaining something to them, one on one.

AVOID REPETITION — one of the strongest quality bars here: never repeat the same fact with different wording, restate the same thesis, re-explain an already-resolved question, repeat an example that makes the same point again, or reuse the same chapter-intro or conclusion language across chapters. Once the viewer understands something, move forward.

AVOID FORMULAIC PATTERNS: some use of "but," "however," "now," "so," "here's the thing," "and that's when," and "what happened next" is natural, but leaning on any one of them repeatedly as a transition crutch reads as AI-generated. Vary your connective language. Do not place a rhetorical question every 20 seconds, or use the same rhetorical-question shape ("So how did they survive?" / "So what happened next?" / "So why does this matter?") repeatedly through the script — use questions only when they genuinely structure curiosity. Humor, where the subject allows it, should come from contrast, human behavior, absurdity, or specific observation — never forced jokes, random slang, or constant sarcasm.

Segment your narration into coherent spoken thoughts (roughly one paragraph's worth of a single idea, not one sentence and not a whole chapter) — these become stable IDs used later for visuals, voice, timeline, and editing, so segment boundaries should fall at genuinely natural spoken pauses.

VISUAL METADATA (per segment — this is what the Visual Director will use instead of re-reading your narration from scratch, so be specific and honest): visualIntent is one sentence naming what the viewer needs to SEE and why. mustShow lists concrete visual elements this segment's beat must include to stay accurate (empty if nothing specific). mustNotShow lists anything the beat must NOT show — most importantly, if this segment says something did NOT happen/exist/work ("no phones", "the tides shrink", "Earth is not flung out of orbit"), mustNotShow must name the specific thing that must not visibly appear happening/present/succeeding; a negation is never satisfied by a generic scene that simply omits it. entities lists the plain names of characters/objects/locations this segment visually involves. locationHint is a short plain-text hint of where this happens (empty string if not location-specific). continuityEntityIds names any EXISTING CANONICAL CAST id(s) (if you were given one) this segment continues — empty array otherwise, never invent an id. exactTextOverlay is a short real fact worth showing as on-screen text (a date, a stat, a label) or null — never invent one. preferredVisualForm is your best call on STORY (character/scene moment), EXPLAINER (mechanism/diagram/comparison), GRAPHIC (a number/label/short text IS the point), or DETAIL (an object/environment close-up).`;

// 2026-09-20 "V1 simplification" pass — CORE ARCHITECTURE CHANGE: the
// Script Engine now produces the small amount of structured visual
// information the Visual Director needs DIRECTLY on each segment, at write
// time, in the SAME call that already reads and understands this narration.
// This is the whole point: THE SCRIPT SEGMENT ITSELF BECOMES THE VISUAL
// CONTRACT — no second LLM system (the old standalone Narration Visual
// Contract compiler) needs to reread the entire narration afterward just to
// rediscover what this call already knew. Field names/shapes deliberately
// mirror the existing NarrationClaim contract fields one-to-one
// (visualCommunicationGoal->visualIntent, requiredVisualFacts->mustShow,
// forbiddenVisualFacts->mustNotShow, entityRequirements->entities,
// preferredVisualForms->preferredVisualForm) — reusing the same concepts
// under the names this task asked for, not inventing a second schema.
// ensureNarrationContract (advance-long-form-visual-plan) detects these
// fields and synthesizes a ready contract from them instantly, with zero
// provider calls — see that function's own comment. Legacy scripts written
// before this change simply don't have these fields, and fall back to the
// old (still-durable, still-working) standalone compiler unchanged.
function buildSegmentSchema(chapterIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "chapterId", "sequenceIndex", "text", "factIds", "narrativeFunction", "openLoopIds", "payoffIds", "estimatedSeconds", "visualIntent", "mustShow", "mustNotShow", "entities", "locationHint", "continuityEntityIds", "exactTextOverlay", "preferredVisualForm"],
    properties: {
      id: { type: "string" },
      chapterId: { type: "string", enum: chapterIds },
      sequenceIndex: { type: "number" },
      text: { type: "string" },
      factIds: { type: "array", items: { type: "string", enum: factIds.length ? factIds : ["__none__"] } },
      narrativeFunction: { type: "string", description: "Short free-text label for this segment's job in the arc, e.g. 'hook', 'partial answer', 'complication', 'payoff' — not a fixed enum, follow what this topic's narrative actually needs." },
      openLoopIds: { type: "array", items: { type: "string" } },
      payoffIds: { type: "array", items: { type: "string" }, description: "Open loop ids THIS segment resolves (the inverse of an openLoop's payoffSegmentId)." },
      estimatedSeconds: { type: "number" },
      visualIntent: { type: "string", description: "What the viewer needs to SEE during this segment and why — the core visual communication goal in one sentence, e.g. 'show the tidal bulge shrinking once the Moon's pull is removed'." },
      mustShow: { type: "array", items: { type: "string" }, description: "Concrete visual elements/facts a beat for this segment MUST include to stay accurate. Empty array if nothing specific is required." },
      mustNotShow: { type: "array", items: { type: "string" }, description: "Concrete visual elements a beat for this segment must NOT show — e.g. a negated claim's forbidden imagery, or something not yet revealed. Empty array if nothing is forbidden." },
      entities: { type: "array", items: { type: "string" }, description: "Plain names of characters/objects/locations this segment mentions or depends on visually. Empty array if none." },
      locationHint: { type: "string", description: "A short plain-text hint of where this segment visually takes place, or an empty string if not location-specific." },
      continuityEntityIds: { type: "array", items: { type: "string" }, description: "Canonical ids (from EXISTING CANONICAL CAST, if you were given one) of RECURRING entities this segment continues. Empty array when there is no existing cast yet or none recur here." },
      exactTextOverlay: { type: ["string", "null"], description: "A short exact on-screen text/number/date this segment calls for (e.g. '1990', '-70°C'), or null if none. Never invent one that isn't a real fact from this segment." },
      preferredVisualForm: { type: "string", enum: ["STORY", "EXPLAINER", "GRAPHIC", "DETAIL"], description: "The general visual approach this segment's content best suits: STORY (character/scene moment), EXPLAINER (mechanism/diagram/comparison), GRAPHIC (a number, label, or short exact text is the point), DETAIL (an object/environment close-up)." },
    },
  };
}

// Phase 1 close-out — Stickman drafts no longer write per-segment visual
// metadata (visual planning moved to the Phase 2 Beat Director). Those fields
// were ~80% of a draft's ~10.5k output tokens, pushing Sonnet 5 drafts to
// ~110-160s, right at the platform's 150s request limit. The fields still
// exist on every segment, filled empty by withEmptyVisualFields, so nothing
// downstream breaks. Legacy keeps buildSegmentSchema unchanged.
const STICKMAN_OMITTED_VISUAL_FIELDS = ["visualIntent", "mustShow", "mustNotShow", "entities", "locationHint", "continuityEntityIds", "exactTextOverlay", "preferredVisualForm"];

function buildStickmanSegmentSchema(chapterIds: string[], factIds: string[]) {
  const base: any = buildSegmentSchema(chapterIds, factIds);
  const properties = Object.fromEntries(Object.entries(base.properties).filter(([k]) => !STICKMAN_OMITTED_VISUAL_FIELDS.includes(k)));
  return { ...base, required: base.required.filter((k: string) => !STICKMAN_OMITTED_VISUAL_FIELDS.includes(k)), properties };
}

function withEmptyVisualFields(segment: any) {
  return {
    visualIntent: "",
    mustShow: [],
    mustNotShow: [],
    entities: [],
    locationHint: "",
    continuityEntityIds: [],
    exactTextOverlay: null,
    preferredVisualForm: null,
    ...segment,
  };
}

const OPEN_LOOP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "setupSegmentId", "question", "expectedPayoffRegion", "payoffSegmentId"],
  properties: {
    id: { type: "string" },
    setupSegmentId: { type: "string" },
    question: { type: "string" },
    expectedPayoffRegion: { type: "string" },
    payoffSegmentId: { type: ["string", "null"] },
  },
};

function buildDraftSchema(chapterIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "narrationSegments", "chapters", "openLoops", "insufficientEvidenceChapterIds"],
    properties: {
      title: { type: "string" },
      narrationSegments: { type: "array", items: buildSegmentSchema(chapterIds, factIds) },
      chapters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["chapterId", "title", "segmentIds"],
          properties: { chapterId: { type: "string", enum: chapterIds }, title: { type: "string" }, segmentIds: { type: "array", items: { type: "string" } } },
        },
      },
      openLoops: { type: "array", items: OPEN_LOOP_SCHEMA },
      insufficientEvidenceChapterIds: { type: "array", items: { type: "string", enum: chapterIds.length ? chapterIds : ["__none__"] } },
    },
  };
}

function draftInput(ctx: { narrativeStrategy: any; storyPlan: any; pack: ScriptEvidencePack; repairNotes?: ValidationIssue[] }) {
  const lines = [
    `NARRATIVE STRATEGY:`,
    JSON.stringify(ctx.narrativeStrategy ?? {}, null, 2),
    ``,
    `STORY PLAN SUMMARY:`,
    JSON.stringify({ recommendedTitle: ctx.storyPlan.recommendedTitle, viewerPromise: ctx.storyPlan.viewerPromise, hookConcept: ctx.storyPlan.hookConcept, narrativeLabel: ctx.storyPlan.narrativeLabel }, null, 2),
    ``,
    `SCRIPT EVIDENCE PACK:`,
    JSON.stringify(ctx.pack, null, 2),
  ];
  if (ctx.repairNotes?.length) {
    lines.push(``, `YOUR PREVIOUS ATTEMPT HAD STRUCTURAL PROBLEMS — FIX THESE EXACTLY:`, JSON.stringify(ctx.repairNotes, null, 2));
  }
  return lines.join("\n");
}

async function runDraft(pack: ScriptEvidencePack, narrativeStrategy: any, storyPlan: any, usage: UsageTotals, repairNotes?: ValidationIssue[]) {
  const chapterIds = pack.chapters.map((c) => c.chapterId);
  const factIds = allUsableFactIds(pack);
  return await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: DRAFT_INSTRUCTIONS,
      input: draftInput({ narrativeStrategy, storyPlan, pack, repairNotes }),
      text: { format: { type: "json_schema", name: "script_draft", strict: true, schema: buildDraftSchema(chapterIds, factIds) } },
    },
    DRAFT_TIMEOUT_MS,
    usage
  );
}

/* ============================ Pass A, STICKMAN BRANCH ============================ */
// Phase 1d "Write, then verify" — a completely separate instructions/schema/
// input from DRAFT_INSTRUCTIONS/buildDraftSchema/draftInput above, which stay
// byte-identical for the legacy/documentary recipe. Reuses buildSegmentSchema
// and OPEN_LOOP_SCHEMA UNCHANGED (per-segment visual metadata is recipe-
// agnostic) — only the top-level draft shape differs.
//
// This REPLACES Phase 1's evidence-first design (factId citations required,
// insufficientEvidenceChapterIds when evidence ran out) with write-first:
// research-lite is now a fast, bounded HELPER (see advance-long-form-research's
// own comment on STICKMAN_RESEARCH_CEILING_USD) whose facts are handed to the
// draft as PREFERRED SOURCES, never a hard requirement. Real incident this
// fixes: with research-first, a script's length was hostage to however many
// facts a ~3-minute search pass found (~11 facts -> ~700 words against a
// ~1450-word target), which routinely under-shot the length gate and routed
// into the legacy per-chapter repair round — which itself timed out
// ("Signal timed out." after 3 attempts) searching for evidence narrow
// enough that a quick search was never going to find it. Write-first writes
// the FULL target length from the model's own general knowledge (which is
// what it would draw on anyway once evidence ran thin) and instead asks the
// model to name every checkable claim it made, so accuracy is verified
// AFTER writing (runStickmanClaimVerify) rather than gating length before it.
// Phase 1e — a real finished script used purely as a STYLE exemplar (rhythm,
// immersion, viewer bridging, concrete specificity) in the draft prompt.
// Embedded as a constant (not read from disk at runtime) so it's part of
// the function's bundled deploy — same file the user asked to be saved at
// docs/stickman/reference-script-after-dark.md, kept in sync by hand. The
// prompt is explicit that the TOPIC/facts/phrases must never be copied —
// this is the only example so far; once 2-3 more from other niches exist,
// add them here too so the model can't fixate on "fire/sleep/on watch."
const STICKMAN_GOLD_EXAMPLE_SCRIPT = `You're lying on packed dirt with your back against a cold rock. The sun dropped behind the hills forty minutes ago, and the last orange light is draining out of the sky. Somewhere in the grass beyond the fire, something is breathing. You can't see it. But it can see you.

Twelve hours of darkness. Every single night. No switch. No door. No lock.

So what did ancient humans actually do after dark?

Start with the thing that made the night survivable at all. Fire. At Wonderwerk Cave in South Africa, a team led by archaeologist Francesco Berna found burned bone and plant ash about one million years old, sitting thirty meters inside the cave, far from where lightning could ever reach. That's the oldest solid evidence of our ancestors controlling fire. One million years of nights spent around the same flickering orange light. Roughly forty thousand generations. By around three hundred thousand years ago, at Qesem Cave in Israel, people were returning to the same central hearth again and again, building it up layer after layer. A fixed spot. A place you came back to when the light died. The first living room. You were built by that fire.

And that fire wasn't cozy. It was a wall.

Because the dark belonged to something else. In Swartkrans Cave, also in South Africa, paleontologist Bob Brain examined the skull of a young human relative more than one and a half million years old. There were two round holes punched through the back of it. He lined them up with the lower fangs of a leopard. They matched almost perfectly. The leopard had carried that child off by the head.

And this isn't only ancient history. Biologist Craig Packer studied two decades of lion attacks on people in Tanzania and found they spike in the ten days after the full moon. Why then? Because that's when the moon rises late, and the first hours after sunset are pitch black. The exact hours people are still awake and outside. Lions figured that out. Our ancestors had to figure it out first.

So how do you sleep when the night is hunting you?

You don't. Not all of you, anyway.

In 2017, anthropologist David Samson put motion-tracking watches on thirty-three Hadza hunter-gatherers in Tanzania and recorded their sleep for twenty days. Across more than two hundred and twenty hours of night, the total time when every adult in the camp was asleep at once came to eighteen minutes. Eighteen. The rest of the night, someone was always awake. Poking the fire. Listening. Usually an older person, because as we age, we naturally drift toward going to bed earlier and waking up earlier. Remember that number. We're coming back to it.

Your grandparents getting up at five in the morning for no reason? That might not be a flaw. That might be a job.

But survival was only half the night. The other half was talking.

Starting in the 1970s, anthropologist Polly Wiessner recorded conversations among the Ju/'hoansi people, hunter-gatherers in the Kalahari Desert of Botswana and Namibia. When she published her analysis in 2014, the split was stunning. During the day, thirty-four percent of conversation was complaints and criticism. Another thirty-one percent was economics. Who has meat. Who owes what. Stories? Just six percent.

Then the sun went down. By firelight, eighty-one percent of conversation was stories.

Stories about people in distant camps. About spirits. About ancestors. About the time someone did something ridiculous on a hunt. Wiessner argued this was where the group learned who everyone really was, who to trust, and how the world worked beyond the next hill.

Now think about your own day. Emails. Logistics. Complaints about the coworker who never refills the coffee. Then night comes, and what do you reach for? A story. A show. A long call with a friend. That pull isn't laziness. It's a million-year-old habit looking for its fire.

So when did they actually sleep?

Here's where it gets surprising. In 2015, sleep researcher Jerome Siegel at UCLA tracked three pre-industrial societies. The Hadza in Tanzania, the San in Namibia, and the Tsimane in Bolivia. Everyone assumed they'd sleep far more than us. They didn't. They slept between 5.7 and 7.1 hours a night. Roughly what you get.

But three things were different.

First, they didn't go to bed at sunset. On average, they fell asleep about 3.3 hours after dark. Those were the fire hours. The story hours.

Second, their sleep followed temperature, not a clock. They drifted off as the air cooled and woke near the coldest point of the night, just before dawn. Your body runs the same program. Your core temperature drops about one degree Celsius as you sink into deep sleep. That's why a warm, stuffy bedroom wrecks your night, and why your feet sticking out of the blanket actually helps.

Third, and this is the one that stings, insomnia was so rare that the San and the Tsimane languages don't even have a word for it. Meanwhile, the U.S. Centers for Disease Control reports that about one in three American adults doesn't get enough sleep.

So what are we doing wrong?

Part of the answer is light. Campfire light glows at roughly 1,900 Kelvin. That's a color scale where lower numbers mean redder, warmer light. Midday sun sits above 5,000. Your phone screen is tuned to look like midday. And your brain's night signal, a hormone called melatonin that tells your body the day is over, gets suppressed by that bright, blue-heavy light.

In 2013, Kenneth Wright at the University of Colorado sent eight people camping in the Rocky Mountains for one week. No flashlights. No phones. Just sunlight and campfire. By the end, their internal clocks had shifted about two hours earlier, lining up almost perfectly with sunrise and sunset. Two hours. In one week.

Then Anne-Marie Chang's team at Harvard had people read either a printed book or a glowing e-reader for four hours before bed, five nights in a row. The e-reader group took longer to fall asleep, released less melatonin, and felt groggier the next morning. Your brain doesn't read the clock. It reads the color of the light. Dim, warm light tells it the sun has set. A glowing screen tells it the day never ended.

Your ancestors ended every day staring into orange. You end yours staring into noon.

But what about waking up in the middle of the night?

In 2001, historian Roger Ekirch at Virginia Tech published more than five hundred references from old diaries, court records, and medical books describing something called first sleep and second sleep. People in pre-industrial Europe would sleep for a few hours, wake for about an hour, pray, talk, tend the fire, then go back down. And in 1992, psychiatrist Thomas Wehr at the National Institutes of Health gave volunteers fourteen hours of darkness every night for four weeks. Their sleep split into two blocks, with one to three calm, wakeful hours in between. During that gap, their levels of prolactin, a hormone linked to deep relaxation, stayed high. They weren't restless. They were calm.

Now, the honest part. Siegel's hunter-gatherers mostly didn't sleep in two blocks. So split sleep probably wasn't universal. But it still tells you something important. Waking up at three in the morning isn't automatically a disorder. For a lot of human history, it was just the middle of the night.

And then there's the sky. On any clear night, every one of your ancestors saw the Milky Way, a river of light splitting the sky in half. Today, according to a 2016 light pollution atlas led by physicist Fabio Falchi, more than a third of humanity can't see it at all. That includes nearly eighty percent of North Americans. There's a real chance you've never seen it once. And even if you tried tonight, your eyes need about thirty minutes of real darkness to reach full night vision. Most of us never give them thirty seconds.

For hundreds of thousands of years, that sky was the ceiling of every bedroom. The calendar. The map. The only screen.

For a million years, night was fire. Stories. Stars. We traded most of it for a light switch.

But not all of it.

Remember those eighteen minutes? Two hundred and twenty hours of night, and only eighteen minutes when everyone slept at once. Someone was always awake. Someone fed the fire. Someone listened to the grass.

So the next time you wake up at three in the morning, and the house is silent, and you feel strange and alone and wide awake.

Maybe you're not broken.

Maybe you're just on watch.`;

// Phase 1e — 8 concrete before/after rewrites, taken directly from the real
// Lions script a human reviewer flagged as bureaucratic/narrated-from-
// outside rather than immersive. Shown as micro-examples of the TRANSFORM,
// not to be copied — the model has its own topic to write.
const STICKMAN_BEFORE_AFTER_EXAMPLES = `BEFORE: "IUCN lists Panthera leo as Vulnerable and does not publish a confident single global headcount, which signals scarcity rather than abundance."
AFTER: "Nobody even knows how many lions are left. That's not a rounding error — that's how rare they've become."

BEFORE: "CITES sets an annotation that establishes a zero annual export quota for bones, bone pieces, skeletons, skulls and teeth removed from wild lions for commercial trade."
AFTER: "Try to ship a wild lion skull across a border to sell it, and international law stops you cold — zero allowed, no exceptions."

BEFORE: "TRAFFIC documents that international rules like CITES govern cross-border trade while domestic laws vary and that some countries still have domestic commercial markets for lion parts."
AFTER: "Cross a border with lion parts and the law slams shut. Stay inside one country, and in a few places, it's still for sale."

BEFORE: "Trophy-hunting revenue for African lions in Tanzania is cited at about $13,500-$49,000 per trophy."
AFTER: "One hunter will pay up to $49,000 just to shoot a single lion — more than most people make in a year."

BEFORE: "FAO warns that where refrigeration and dedicated meat-processing facilities are absent, shelf-life drops to days or hours and safe distribution becomes much harder."
AFTER: "Without a freezer truck waiting nearby, lion meat starts rotting within hours — long before it could ever reach a plate."

BEFORE: "Five reasons. One caveat. [...] Bottom line: live lions = asset. Meat = loss."
AFTER: "So that price tag hanging off the lion's head isn't measuring meat. It's measuring everything meat could never be worth."

BEFORE: "Anthropologist Mary Douglas frames food taboos as rules about purity and categories: animals that 'blur' categories or seem symbolically dangerous become taboo."
AFTER: "A lion on a dinner plate next to mashed potatoes looks wrong to almost everyone. Anthropologists call that reflex a taboo, and it's older than any law."

BEFORE (a "stakes" line that previewed the whole video instead of stating one stake): "The answer is not one single rule but five stacked reasons - supply, law, culture, money, and safety - each one making eating lions less likely."
AFTER: "One choice at a dinner table can collide with international law, ancient ritual, and a tourism economy worth millions."

BEFORE (winning angle given one vague sentence, no numbers): "Big predators sit at the top of the energy pyramid: you need many herbivores and a lot of land to support one adult lion."
AFTER: "It takes roughly 10 kilograms of prey animal to build 1 kilogram of lion. A single adult male eats about 7 kilograms of meat in one sitting — and needs a kill every 3 to 4 days to survive."

BEFORE: "South Africa legally exported as many as 1,771 lion skeletons in 2016."
AFTER: "In one year alone, 1,771 lion skeletons left South Africa in crates, legally, bound for buyers who wanted bones, not steaks."`;

// Phase 1 close-out — alternate style exemplar (Lions Run B, the 7.5/10 calibration
// anchor, docs/phase1/samples/lions-1g-B.md) used whenever a topic overlaps the gold
// example's own topic (prehistoric night life), so the model is never shown a finished
// script about the very thing it is about to write.
const LIONS_RUN_B_EXEMPLAR = "You stand beside a pickup truck at dawn, staring at a dead lion tied across the back. Flies gather around its mane. Behind you, water trembles inside an untouched cooking pot, but nobody reaches for a knife. Nobody adds meat. The entire village kitchen has gone quiet.\n\nBecause being edible has never guaranteed an animal a place on your plate.\n\nIf a lion is made of meat, why do humans almost everywhere leave it uneaten?\n\nStart with the supermarket problem: there are barely any lions to stock. The IUCN classifies lions as Vulnerable, says their population trend is declining, and cannot give one confident current total for all wild lions. Their confirmed range now covers only 18 African countries. Compare that with your normal food supply. FAOSTAT-based counts put cattle, sheep, goats, pigs and chickens at roughly 31.1 billion animals worldwide in 2022. One side is counted by the billion. The other is too uncertain to count confidently at all. Why does that gap matter at dinner? Lions are territorial predators spread across large landscapes, not herds you can harvest repeatedly from one pasture. Remove breeding adults and the supply does not refill like a chicken house. It collapses locally. Market studies, including work linked to Justin Brashares and colleagues in 2004, show the predictable result: as wild mammals become scarce, bushmeat prices rise and buyers switch to other proteins. A goat can produce offspring, milk and meat beside your home. A lion must first be found across miles of bush. Scarcity has already made the choice for you.\n\nSuppose you find one anyway. Now your dinner can fight back. A lion is an ambush hunter armed to drag down animals heavier than a person, and a wounded lion is still dangerous at touching distance. What do you gain for accepting that risk? Mostly muscle from one carcass. A herd animal offers meat without requiring trackers, a powerful rifle, transport and people willing to approach a big cat. Humans usually hunt downward through the food chain because herbivores are more numerous and convert plants directly into flesh. Hunting the hunter means paying for every meal it ate before you arrived. Then the carcass starts losing value. FAO meat-handling guidance stresses rapid chilling, clean processing areas and separate spaces for offal. Without those, wild meat spoils faster and contamination becomes harder to control. Where is your refrigerated truck in the middle of the savanna? Where is the inspected cutting room? A domestic animal reaches a slaughterhouse through an established chain. A dead lion may be hours from electricity, clean water or a buyer. Even if the meat is usable, carrying hundreds of kilograms through heat is a logistics problem your neighborhood butcher never faces. And the strangest part is that meat may be the least valuable thing attached to the animal. In Tanzania, cited trophy fees for one African lion have ranged from about 13,500 dollars to 49,000 dollars. That price buys the hunt and its prestige, not sandwiches. In 2016, legal exports from South Africa peaked at 1,771 lion skeletons, sent to markets seeking bones rather than steaks. So even when lions enter commerce, demand often pulls them toward trophies, skins or body parts. Why turn a rare, expensive animal into stew when buyers value almost everything else more?\n\nBut food is never just chemistry. Put a lion steak beside potatoes and many people feel the same mental brake they feel around a pet, a sacred animal or a national symbol. Anthropologist Mary Douglas explained this in her 1966 book, Purity and Danger: societies build food rules around categories, and animals seen as dangerous, anomalous or symbolically powerful can become improper to eat. The reaction arrives before nutrition does. Your own kitchen works that way. A horse, dog or insect may be ordinary food somewhere else and emotionally impossible inside your home. For communities living beside lions, the animal can represent danger, courage, ancestry or authority all at once. Among Maasai communities, lion hunting historically carried warrior prestige, yet prestige did not turn lion flesh into weekday food. The achievement was confronting the predator. Ethnographic and historical accounts describe lion meat as generally avoided, while claws, teeth, fat or other parts could receive ritual or medicinal uses. That distinction matters. Killing an animal does not automatically mean eating it. Your grandfather may hang antlers on a wall without wanting venison every night. The lion's social meaning can be worth more than its calories. Culture can change, too. Lion Guardians have worked near Amboseli with local pastoralists, including traditional warriors, to monitor lions and reduce killings. The same knowledge once used to track a lion can help keep it alive. That is a deeper shift than swapping one recipe for another: the predator becomes a neighbor whose survival carries status. Are there exceptions? Of course. Lion meat has been consumed in unusual circumstances and sold in a few novelty markets. But novelty proves the boundary. Nobody advertises chicken as a once-in-a-lifetime dare.\n\nSo is the answer simply that eating lions is illegal? No. The law is more specific and more complicated. Under CITES, India's lion population is on Appendix One, the strictest international trade category, while other lion populations are on Appendix Two. Commercial exports of bones, skulls, teeth, claws and skeletons taken from wild lions face an annual quota of zero. Cross a border with those wild parts for sale and the legal door slams shut. But CITES controls international trade, not whatever someone cooks inside every country. Inside national borders, rules differ. TRAFFIC has documented domestic markets for lion parts, including in South Africa, even while international movement is tightly controlled. Legal does not mean easy, cheap or common. Permits, protected areas and hunting restrictions keep wild supply narrow, and a living lion can keep producing value through tourism. A steak is sold once. A lion seen from a safari vehicle can be photographed by new visitors for years. Would you empty the attraction to fill one refrigerator? Conservation law reinforces an economic fact already pushing in the same direction: living lions can remain valuable.\n\nBut strip away the law and taboo, and the meat carries one more problem. Predators eat raw prey - sometimes sick or parasite-bearing animals - and that can leave microscopic hazards tucked into muscle tissue. A steak can look perfectly normal while invisible risks remain inside it. Is every lion infected? No. Is lion meat uniquely poisonous? Also no. The core issue is uncertainty: a wild carnivore arrives without the controlled feed, veterinary history or routine inspection that supermarket livestock routinely carry. Predators can also pick up persistent contaminants over time by eating many prey animals. How much accumulates depends on the chemical and the local environment, so this is not a universal verdict on every carcass. Still, uncertainty alone damages demand. You know the animal was wild. You do not know every carcass it consumed, every microscopic exposure it encountered or every pollutant that may have moved through its food chain. Simple safeguards and checks people rely on with sold meat - traceability, testing and controlled storage - are hardest to guarantee beside a remote kill. Proper testing and thorough cooking matter, yet both are difficult to secure in that setting.\n\nNow return to the untouched cooking pot. It wasn't empty because lion flesh couldn't be cooked. It was empty because cooking only happens after someone accepts the carcass - the danger, the cost and the invisible uncertainties tucked inside its tissue. Flesh becomes food when people trust the path from carcass to mouth; here that path is broken before cooking even begins. The lion is dead. The doubt is not.\n\nThat is why exceptions never become the ordinary dinner. An adventurous restaurant can find one carcass. A desperate hunter can eat one. A custom can loosen. But a food tradition needs dependable supply, safe handling and people who want the next serving. Week after week. Generation after generation. Lions fail that test before the plate reaches the table. They are technically meat. Human life has given them a different job.";

const STICKMAN_DRAFT_INSTRUCTIONS = `You are Zyvo's Stickman Script Engine — you write tight, viral-style spoken narration for short 2D stickman-doodle explainer videos. NARRATION IS THE PRODUCT: the video must be worth listening to with the screen off.

You receive the video's NarrativeStrategy and StoryPlan (including a callbackPlan and a thumbnailConcept), NICHE GUIDANCE (tone + typical evidence types for this niche), an EXPLANATION DEPTH, and a list of PREFERRED SOURCES — facts a research pass already verified for this specific video, organized by section. Write the COMPLETE narration for the whole video, at its full target length, in one continuous pass.

STYLE EXEMPLAR — read this once before writing, then never mention it or copy its topic/facts/phrases: the script below is a real, finished Stickman video that a human reviewer rated highly for exactly the qualities you must match — immersion (it puts the viewer INSIDE a moment, never narrates about the topic from outside), specificity (every claim has a name, a place, a number), rhythm (short fragments break up long explanatory sentences), and constant viewer bridging ("you", "your body", "your grandparents"). Match its RHYTHM, IMMERSION, and SPECIFICITY. Do not copy its topic, its facts, its phrases, or its structure verbatim — you have your own topic and your own StoryPlan to follow.
"""
${STICKMAN_GOLD_EXAMPLE_SCRIPT}
"""

Here are real BEFORE/AFTER rewrites from a script that failed review, showing exactly the transform to make — bureaucratic, narrated-from-outside sentences into vivid, immersive ones. These are examples of the TRANSFORM only; never reuse their topic or wording:
${STICKMAN_BEFORE_AFTER_EXAMPLES}

WRITE FROM YOUR OWN KNOWLEDGE, PREFERRING VERIFIED SOURCES: you are not limited to the preferred sources — use your own general knowledge freely to write a complete, confident, full-length script, exactly as you would for any other topic. When a preferred source covers something you're about to say, use its specific number/name/date instead of your own recollection (it's already confirmed accurate for this video). Never let a thin or empty preferred-sources list shrink the script, hedge the tone, or stop you from covering a section fully — write it exactly as if you were confident in every claim, because every checkable claim you make will be independently verified right after you write it (see CLAIMS below), not before.

CLAIMS: after writing, list every checkable factual claim in the narration — anything asserting a named person/site/study/organization, a specific number, date, distance, or percentage. For each: the exact sentence it appears in (copied verbatim from the segment text), a one-line statement of the claim itself, which segment it's in, and — if it directly restates one of the PREFERRED SOURCES you were given — that source's id (sourceFactId), otherwise null. Rhetorical framing, transitions, questions, and general statements with no specific checkable fact don't need an entry. Be exhaustive, especially for claims from your OWN knowledge (sourceFactId null) — those are exactly the ones that need checking; a script with 20 specific facts should list roughly 20 claims, not just the handful that came from the preferred sources. Only set sourceFactId when the sentence says what that source says — adding a detail the source doesn't contain (a researcher's name, a date, an interpretation) makes it your own claim, so use null.

NEVER EXPOSE THE PROCESS: a viewer must never hear that they are listening to "a script", that "research" or "sources" were "available"/"provided", or any language about your own writing process.

EXPLANATION DEPTH changes how you write the evidence sections, not the total length: "simple" (labeled "Brief" to users) means fewer evidence units per section with more rhythm and momentum between them; "balanced" is the default mix; "deep" means more evidence units AND one extra mechanism explanation per evidence section (a beat that explains HOW or WHY the thing works, not just THAT it happened) — the total word count stays the same regardless of depth; depth changes density and pacing, not runtime.

WORD BUDGETS: the StoryPlan gives you each section's targetWords. Write EACH section to within about 10% of its own targetWords — the sum of every section's budget already equals the video's full target length, so hitting each one means you hit the whole video's length without padding. IMPORTANT: no single narrationSegment may ever exceed ${SEGMENT_HARD_MAX_WORDS} words — an evidence section with a targetWords above that (most of them will be) MUST be split into 2-3 separate segments (each ${SEGMENT_TARGET_MIN_WORDS}-${SEGMENT_TARGET_MAX_WORDS} words, a natural beat/pause between them), never written as one long paragraph in a single segment.

PICTURABLE ≠ DESCRIBING A PICTURE: the StoryPlan also gives you picturableMoments — concrete, real-world content ideas for this section (a specific action, object, comparison, or number). Use them as SOURCE MATERIAL for what to say, never as something to describe visually. Write concrete, specific statements a viewer can see in their head without being told to — "A male lion eats about seven kilos of meat a day" is picturable; "Picture a lion eating seven kilos of meat" is not, it's an instruction. The visuals are a completely separate team's job, created after you write, from your words alone — you must NEVER describe images, icons, arrows, maps, split screens, animations, stickers, graphics, charts, or anything about what appears on screen. If a sentence starts describing a picture, a scene composition, an icon, or an animation instead of just stating the fact, rewrite it as a plain statement of the fact itself.

Write the script following this EXACT structure, matching the StoryPlan's own section roles in order. Each section has a FIXED word budget shape (given as its targetWords) — respect it. The budgets are a length to REACH, not a ceiling to stay safely under: the short roles (cold open, stakes, question) must stay short, but every evidence, twist, callback and closer section should land within about 10% of its targetWords, and the whole script within 10% of the total. Tight, efficient prose that stops at 70-80% of the budget is the most common way a draft fails — fill the evidence sections with more specific substance (another named example, a number and what it means for the viewer, a re-hooking question), never filler.

a) COLD OPEN (role: cold_open, 40-70 words): second person ("You…"), present tense, sensory — drop the viewer directly INTO a moment (a body, a place, a physical sensation) and STOP there. This is a PURE SCENE — no analysis, no explanation of what it means, no "that suddenly rewrites how people see you" commentary. Just the moment. Save the meaning for the sections that follow. No throat-clearing, no "in this video", no restating the title. Sentence count isn't fixed — a handful of longer sentences or a run of short, punchy fragments ("Pulled forward. Off balance.") both work as long as it stays a pure scene within the word budget; a niche whose cold open needs a hard cut between two short beats (like a myth's false scene cutting to the real one) can use that structure freely.
b) STAKES (role: stakes, ≤15 words): exactly ONE short, punchy sentence or fragment. Not a preview of the reasons/evidence to come — just why this matters, in one line.
c) CORE QUESTION (role: core_question, ≤25 words): exactly ONE question sentence — state the question the title promises, then go STRAIGHT into the first piece of evidence in the very next section. Never list the categories of reasons/angles/barriers you're about to cover ("ecology, law, culture..." or "N reasons/barriers/forces" is a table-of-contents preview, not a question — it kills curiosity instead of building it). Never restate the question later in the same wording.
d) EVIDENCE UNITS (role: evidence, one section per angle from the StoryPlan, ~70% of total words, weighted toward your strongest angle): each unit is claim -> named source (a site, study, researcher, or event) -> a precise number (year, size, percent, distance, count) -> plain-language meaning, stated as a concrete fact, never as an instruction to picture/see/imagine it. KNOWLEDGE-FIRST: use your own knowledge for the strongest, most specific concrete facts you know (quantities, rates, distances, dates, named studies or people) — PREFERRED SOURCES are a helper, not a ceiling; don't understate a section just because a source wasn't provided for it, and don't let the section built on your strongest angle end up vaguer than a weaker one. Every evidence section needs AT LEAST 2 specific numbers or named sources — a section with one vague sentence and no numbers has failed its job regardless of how good the underlying angle is. No vague qualifiers like "a long time ago", "many scientists", "some experts", "very big", "really strong", "a lot of" — always the specific figure. Never state the same specific number more than once outside the callback's own plant/payoff pair — say it once, memorably, and refer back to it in words ("that same shortage") rather than repeating the figure.
e) RHETORICAL MINI-QUESTIONS: at least 1 per 150 words of the whole script's body, phrased naturally and never repetitively — vary the wording every time. This is a floor, not a suggestion — a script with only one or two questions across its whole length has failed this rule regardless of how good the prose otherwise is. Make it countable as you write: EVERY evidence section contains at least 2 questions (one near its start to open the sub-question, one mid-section to re-hook before the payoff fact), and the twist opens with one. A 1,450-word script should end up with roughly 10 question marks in the narration — count them before you finish; if you have fewer than 8, add them where a viewer would naturally be wondering something.
f) CALLBACK (role: callback_payoff, 60-100 words): you were given a callbackPlan naming a specific detail, a plant section, and a payoff section, and (usually) an isTwistOrPayoffAngle — the single most surprising angle from the StoryPlan. Plant the callback detail as a natural, concrete moment within the plant section, and pay it off within the payoff section by delivering ONE genuinely NEW meaning or fact connected to the surprising angle — never a recap that restates 2 or more claims/numbers already said earlier. A payoff that just lists "international rules block trade, and culture matters, and tourism pays" is a recap, not a payoff. Report which segment holds the plant as plantSegmentIndex, which segment holds the payoff as payoffSegmentIndex, and a short callbackKey (3-8 words) naming the planted detail as written in the plant ("soot on your finger"). The payoff must name that detail's key noun ("that soot") so it clearly points back — a few words of reference, then the new meaning; never repeat the plant's full description.
g) BRIDGING: tie facts to the viewer's own body, food, home, money, habits, or daily routine THROUGHOUT the script — not only in the closer. Aim for roughly one "you"/"your" reference per 100 words. Vary HOW you bridge — a generic simile template ("like renting a house instead of selling it", "comparable to X", "the way you feel when Y") is allowed ONCE at most across the whole script; every other bridge should connect to something the viewer actually does or has, stated directly, not through a borrowed metaphor.
h) CLOSER (role: closer, 40-80 words): the callback payoff lands FIRST (see f), then zoom out to ONE reflective idea beyond it, then short fragments for rhythm, then one memorable final line. Never a numbered/bulleted/labeled recap of the sections above, never a checklist, never "here's what to take home" — "Five reasons. One caveat." and "Here's a tidy checklist: Supply: ... Law: ..." are both listicles, not endings, even though only one of them uses the word "reasons."
If the StoryPlan includes a "twist" section (100-160 words), use it as an honest complication or surprising wrinkle right before callback_payoff.

STYLE: conversational and confident. Every section mixes short fragments with longer explanatory sentences. Jargon (technical, legal, or bureaucratic terms — "annotation", "quota", "range states", "framework", "commercial trade pathways") must be translated into plain, concrete language in the SAME sentence it's used, or replaced entirely with the plain version. Never coast more than 1-2 sentences without a new fact, hook, question, or callback beat. No filler transitions ("moving on", "let's talk about", "next up", "over the next sections", "we'll do three tasks", "firstly", "in conclusion", "to sum up", "let's dive in"). No numbered lists or "(1) (2) (3)" enumerations. No summary sentences that only repeat what was already said. NEVER write a forward-reference or lecture line that talks about the video's own structure or promises something for later — banned phrases include "later we'll", "keep that in mind", "we'll check", "as we'll see", "here's a checklist", "take home" — say the thing now, in the section where it belongs, instead of promising it.

TTS-SAFE TEXT: plain spoken words only — no brackets, stage directions, emojis, markdown, or symbols a voice model would mispronounce. Never use "=", "&", "->", or curly/smart quotation marks — write "equals", "and", "leads to", and straight punctuation instead. Never wrap invented signage or dialogue in quotation marks as if reading it off a sign. Spell out "percent" and "degrees" rather than using "%"/"°" unless a symbol reads naturally. Write years and large numbers the way they should be spoken aloud when there's any ambiguity. For a hard-to-pronounce name, give it once in its original spelling, then use a spoken-friendly form for the rest of the script. Keep sentences short enough to breathe.

NEVER WRITE A CITATION TAG: a narrator never says "(IUCN: no single global count)", "(Source: FAOSTAT)", "(Brashares et al., 2004)", or "[1]" out loud. Weave the source into the sentence itself as spoken words ("The IUCN says...", "A 2004 study by Brashares and colleagues found...") — never append it afterward in parentheses or brackets as if reading a citation off a slide.

EACH FACT ONCE: a specific number, study, site or named source appears in exactly ONE section. Never reuse a figure or finding from an earlier section to fill a later one (the callback may refer back to it in words, never restate it). If a later section feels thin without it, that section needs its own different fact — not a repeat.

THIN SECTIONS — GO NARROW, NEVER VAGUE: when a section's preferred sources are sparse, do not pad it with vague, unfalsifiable generalities dressed up as findings ("across multiple sites, bones turn up...", "researchers have found patterns...") — a viewer hears that as filler, and it can't be checked. Instead, use one or two specific things you are genuinely confident are true (a named site, species, researcher, or number — every such claim is verified after writing), and say plainly where the evidence stops ("nobody has found a site that proves this directly"). Honest limits are more gripping than fog.

KEEP EVIDENCE IN ITS OWN ERA/CONTEXT: never let evidence from one time, place or population silently stand in for another (records from 1600s Europe are not evidence about Ice Age hunters; a lab study on students is not evidence about all humans). If you use it as an analogy, say so ("we can't see this in the Ice Age directly, but in pre-industrial Europe...") and don't then assert the conclusion as near-certain ("almost certainly") about the original context.

STATE UNCERTAINTY ONCE: honesty about limits is good, but at most 2 hedging/caution sentences in the whole script ("a caution here", "it's worth admitting", "honestly, no", "we can't be certain"). Say it once, briefly, then move on with what IS known.

FINDINGS, NOT METHODS: no lab/method jargon (use-wear, multiproxy, pyromarkers, phytoliths, lipid residues, assemblages, stratigraphy, residue analysis, isotopes...) unless the same sentence instantly translates it into something a viewer can picture. Prefer the finding over how it was measured: "the ash shows animal fat burned for hours", not "lipid pyromarkers in hearth sediment".

STORY OVER METHOD (every section): tell it as people doing things — who hunted, what they held, what the animal did, what happened next, what was left behind — with concrete events a viewer can see. AT MOST ONE short sentence per section about how researchers know it (the lab, the polish, the residue, the dating, "the inference we draw"); never a run of method sentences, and never a sentence whose only content is the method. "A hunter drove the spear into a horse's ribs, again and again — the tip still shows the damage" beats "researchers examining use-wear infer repeated thrusting".

No visual metadata: write narration only. Visual planning is done later from your text.`;

const STICKMAN_DRAFT_INSTRUCTIONS_LIONS_EXEMPLAR = STICKMAN_DRAFT_INSTRUCTIONS.replace(STICKMAN_GOLD_EXAMPLE_SCRIPT, LIONS_RUN_B_EXEMPLAR);

// The gold example is about prehistoric people at night; a topic in that
// territory gets the Lions Run B exemplar instead (see LIONS_RUN_B_EXEMPLAR).
const GOLD_EXAMPLE_TOPIC_PATTERN = /\b(after dark|nighttime|night-time|prehistor\w*|ancient humans?|early humans?|stone age|ice age|paleolithic|palaeolithic|cave ?(men|man|people)|hunter-?gatherers?|campfires?|firelight|neanderthals?)\b/i;

export function exemplarOverlapsGoldTopic(text: string): boolean {
  return GOLD_EXAMPLE_TOPIC_PATTERN.test(text ?? "");
}

// Phase 1d — a checkable claim the draft made, named for later verification
// (runStickmanClaimVerify) rather than gated against evidence up front.
// sourceFactId lets the draft self-report "this one already came from a
// preferred source" so the verify stage can skip it for free (the spec's
// "skip claims already backed by a research-lite fact") without any
// text-similarity guessing.
function buildClaimSchema(factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "segmentId", "claim", "sentence", "sourceFactId"],
    properties: {
      id: { type: "string" },
      segmentId: { type: "string" },
      claim: { type: "string", description: "One-line statement of the checkable fact, e.g. 'The Great Fire of London started in 1666.'" },
      sentence: { type: "string", description: "The EXACT sentence (verbatim, character-for-character) from the segment's text where this claim appears." },
      sourceFactId: { type: ["string", "null"], enum: [...(factIds.length ? factIds : []), null], description: "If this claim directly restates one of the PREFERRED SOURCES facts you were given, that fact's id — otherwise null." },
    },
  };
}

// factIds stays wired through buildSegmentSchema unchanged (a segment MAY
// still cite a preferred-source fact id if one directly supports it — free,
// optional precision) but is no longer required or enforced: the real
// accuracy gate for Stickman is now claims[] + runStickmanClaimVerify, not
// this field. insufficientEvidenceChapterIds is gone — there's no such
// thing as "insufficient evidence" to fall back on in write-first mode.
function buildStickmanDraftSchema(chapterIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["title", "narrationSegments", "chapters", "openLoops", "claims", "plantSegmentIndex", "payoffSegmentIndex", "callbackKey"],
    properties: {
      title: { type: "string" },
      narrationSegments: { type: "array", items: buildStickmanSegmentSchema(chapterIds, factIds) },
      chapters: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["chapterId", "title", "segmentIds"],
          properties: { chapterId: { type: "string", enum: chapterIds }, title: { type: "string" }, segmentIds: { type: "array", items: { type: "string" } } },
        },
      },
      openLoops: { type: "array", items: OPEN_LOOP_SCHEMA },
      claims: { type: "array", items: buildClaimSchema(factIds) },
      // Phase 1f — replaces plantQuote/payoffQuote (a model-self-reported
      // "verbatim quote" that routinely didn't match, since the model
      // paraphrased slightly between writing the narration and copying the
      // quote). 0-based index into narrationSegments in the order you wrote
      // them, plus a short phrase that genuinely appears in both segments —
      // code verifies this and extracts the real sentences, never trusts a
      // free-text quote.
      plantSegmentIndex: { type: "integer", minimum: 0, description: "0-based index into narrationSegments of the segment where the callback detail is planted." },
      payoffSegmentIndex: { type: "integer", minimum: 0, description: "0-based index into narrationSegments of the segment where the callback detail is paid off. Must be greater than plantSegmentIndex." },
      callbackKey: { type: "string", description: "A short (3-8 word) phrase naming the planted detail as written in the plant segment. Its key noun must also appear in the payoff segment." },
    },
  };
}

function stickmanDraftInput(ctx: { narrativeStrategy: any; storyPlan: any; pack: ScriptEvidencePack; niche: string | null; explanationDepth: string; repairNotes?: ValidationIssue[] }) {
  const guidance = nicheGuidanceFor(ctx.niche);
  const preferredSources = ctx.pack.chapters.flatMap((c) =>
    c.usableFacts.map((f) => ({ sourceFactId: f.factId, sectionId: c.chapterId, claim: f.claim, classification: f.classification, confidence: f.confidence }))
  );
  const lines = [
    `NARRATIVE STRATEGY:`,
    JSON.stringify(ctx.narrativeStrategy ?? {}, null, 2),
    ``,
    `STORY PLAN SUMMARY:`,
    JSON.stringify(
      {
        recommendedTitle: ctx.storyPlan.recommendedTitle,
        viewerPromise: ctx.storyPlan.viewerPromise,
        hookConcept: ctx.storyPlan.hookConcept,
        narrativeLabel: ctx.storyPlan.narrativeLabel,
        callbackPlan: ctx.storyPlan.callbackPlan ?? null,
        thumbnailConcept: ctx.storyPlan.thumbnailConcept ?? null,
        chapters:
          ctx.storyPlan.chapters?.map((c: any) => ({
            id: c.id,
            title: c.title,
            role: c.role,
            subQuestion: c.subQuestion,
            purpose: c.purpose ?? c.summary ?? "",
            targetWords: c.targetWords ?? null,
            picturableMoments: c.picturableMoments ?? [],
          })) ?? [],
        candidateAngles: ctx.storyPlan.candidateAngles ?? [],
      },
      null,
      2
    ),
    ``,
    `EXPLANATION DEPTH: ${ctx.explanationDepth}`,
    ``,
    `NICHE GUIDANCE${ctx.niche ? ` (${ctx.niche})` : " (no niche selected — use general guidance)"}:`,
    `- Tone: ${guidance.tone}`,
    `- Typical evidence types for this niche: ${guidance.evidenceTypes}`,
    `- Cold-open style for this niche (an example of the FEELING, invent your own specific scene — never reuse this literally): ${guidance.coldOpenStyle}`,
    `- Evidence shape for this niche — how to internally structure the evidence sections: ${guidance.evidenceShape}`,
    `- Typical credible sources for this niche: ${guidance.typicalSources}`,
    `- Pitfalls to avoid for this specific niche: ${guidance.pitfalls.join("; ")}`,
    ``,
    preferredSources.length
      ? `PREFERRED SOURCES (${preferredSources.length} already-verified facts from a quick research pass — use their specific numbers/names when they overlap with what you were going to say, but write the FULL script regardless of how few or many of these exist):\n${JSON.stringify(preferredSources, null, 2)}`
      : `PREFERRED SOURCES: none found by the research pass for this topic — write the full script entirely from your own knowledge; every checkable claim will be verified after writing.`,
  ];
  if (ctx.repairNotes?.length) {
    lines.push(``, `YOUR PREVIOUS ATTEMPT HAD STRUCTURAL PROBLEMS — FIX THESE EXACTLY:`, JSON.stringify(ctx.repairNotes, null, 2));
  }
  return lines.join("\n");
}

// Deterministically enriches a Stickman script_document's chapters with the
// role/subQuestion the Story Plan already decided (never asked of the
// draft/revision LLM itself — copying known ground truth is more reliable
// than hoping a model repeats it back without drift), and copies
// thumbnailConcept through from the Story Plan for convenience. Called once
// after every fresh Stickman draft (stageDraft) and again after a Stickman
// full_rewrite (stageRevision), since a full_rewrite is a genuinely fresh
// draft-shaped output that hasn't been enriched yet.
// Phase 1e — TTS hygiene auto-fix, applied to a fresh model output BEFORE
// validation ever runs (findTtsHygieneIssues is a HARD check — without this,
// a single curly quote from the model would burn the one bounded draft
// repair attempt on something trivially fixable in code). Sanitizes title
// with the exact same transform as segment text.
// Phase 1 FINAL — also strips spoken-citation tags ("(IUCN: ...)",
// "(Source: ...)", "[1]", "(Author, 2004)") in the same pass, before this
// document is ever validated. See stripSpokenCitations's own comment for
// the real, pervasive incident this fixes.
function sanitizeStickmanDocumentTtsHygiene(doc: any): any {
  const clean = (t: string) => stripSpokenCitations(sanitizeTtsHygiene(t));
  return {
    ...doc,
    title: doc.title != null ? clean(doc.title) : doc.title,
    narrationSegments: (doc.narrationSegments ?? []).map((s: any) => ({ ...s, text: clean(s.text ?? "") })),
  };
}

// Phase 1f — the spec's "store the exact sentences extracted by CODE":
// plantQuote/payoffQuote are no longer model output, they're derived here
// from the (already sanitized, already validated) segments the model named
// via plantSegmentIndex/payoffSegmentIndex/callbackKey, for display/report
// purposes only. Never re-validates — call this after checkCallback has
// already confirmed the key genuinely appears in both segments.
function deriveStickmanCallbackQuotes(doc: any): any {
  const segments = doc.narrationSegments ?? [];
  const plantSeg = doc.plantSegmentIndex != null ? segments[doc.plantSegmentIndex] : undefined;
  const payoffSeg = doc.payoffSegmentIndex != null ? segments[doc.payoffSegmentIndex] : undefined;
  const quoteFor = (seg: any) => {
    const ref = seg ? findCallbackReference(seg.text ?? "", doc.callbackKey ?? "") : null;
    return ref ? extractSentenceContaining(seg.text ?? "", ref) : null;
  };
  const plantQuote = quoteFor(plantSeg);
  const payoffQuote = quoteFor(payoffSeg);
  return { ...doc, plantQuote, payoffQuote };
}

function enrichStickmanDocument(scriptDocument: any, storyPlan: any) {
  const sectionById = new Map((storyPlan.chapters ?? []).map((c: any) => [c.id, c]));
  return {
    ...scriptDocument,
    chapters: (scriptDocument.chapters ?? []).map((c: any) => {
      const section: any = sectionById.get(c.chapterId);
      return { ...c, role: section?.role ?? null, subQuestion: section?.subQuestion ?? "" };
    }),
    thumbnailConcept: storyPlan.thumbnailConcept ?? null,
  };
}

async function runStickmanDraft(pack: ScriptEvidencePack, narrativeStrategy: any, storyPlan: any, niche: string | null, explanationDepth: string, usage: UsageTotals, repairNotes?: ValidationIssue[]) {
  const chapterIds = pack.chapters.map((c) => c.chapterId);
  const factIds = allUsableFactIds(pack);
  const topicText = [storyPlan?.recommendedTitle, storyPlan?.viewerPromise, storyPlan?.hookConcept].filter(Boolean).join(" ");
  const draft = await callStickmanModel(
    STICKMAN_DRAFT_MODEL,
    exemplarOverlapsGoldTopic(topicText) ? STICKMAN_DRAFT_INSTRUCTIONS_LIONS_EXEMPLAR : STICKMAN_DRAFT_INSTRUCTIONS,
    stickmanDraftInput({ narrativeStrategy, storyPlan, pack, niche, explanationDepth, repairNotes }),
    buildStickmanDraftSchema(chapterIds, factIds),
    "stickman_script_draft",
    DRAFT_TIMEOUT_MS,
    usage
  );
  return { ...draft, narrationSegments: (draft.narrationSegments ?? []).map(withEmptyVisualFields) };
}

// Phase 1 FINAL — Claude Sonnet 5's first-pass drafts consistently land
// 20-30% short (format drafts 72-80%; an acceptance run 70% after the
// finalizing expansion pass couldn't close the gap), while its repair re-
// drafts land at 96-98%. Under 85% of target, this names the short sections
// so the one bounded repair adds content where it belongs.
function stickmanDraftLengthIssues(draft: any, storyPlan: any, targetWords: number): { code: string; message: string }[] {
  if (!targetWords) return [];
  const total = computeActualWords(draft);
  if (total >= targetWords * 0.85) return [];
  const wordsByChapter = new Map<string, number>();
  for (const s of draft.narrationSegments ?? []) {
    wordsByChapter.set(s.chapterId, (wordsByChapter.get(s.chapterId) ?? 0) + (s.text ?? "").trim().split(/\s+/).filter(Boolean).length);
  }
  const shortSections = (storyPlan.chapters ?? [])
    .filter((c: any) => c.targetWords && (wordsByChapter.get(c.id) ?? 0) < c.targetWords * 0.8)
    .map((c: any) => `"${c.title}" (${c.role}) has ${wordsByChapter.get(c.id) ?? 0} of its ${c.targetWords} words`);
  return [{
    code: "draft_too_short",
    message: `The script is ${total} words against a ${targetWords}-word target (${Math.round((total / targetWords) * 100)}%). Write the full length — add specific, new substance (another named example, a number with its plain meaning, a question that re-hooks) to the short sections, never filler or repetition: ${shortSections.join("; ") || "spread across the evidence sections"}.`,
  }];
}

async function stageDraft(admin: any, row: ScriptRow, project: any, storyPlan: any, researchVersion: any, isStickman: boolean, niche: string | null) {
  const pack = buildEvidencePack(project, storyPlan, project.narrative_strategy, researchVersion.fact_graph, researchVersion.coverage);
  const usage = newUsageTotals();
  const explanationDepth = project.resolved_explanation_depth ?? "balanced";
  let draft = isStickman
    ? await runStickmanDraft(pack, project.narrative_strategy, storyPlan, niche, explanationDepth, usage)
    : await runDraft(pack, project.narrative_strategy, storyPlan, usage);
  // Phase 1e — TTS hygiene auto-fix BEFORE the first validation pass ever
  // sees it (findTtsHygieneIssues is HARD; without this, a stray curly
  // quote would burn the one bounded repair attempt on something trivially
  // fixable in code, not a real structural problem).
  if (isStickman) draft = { ...sanitizeStickmanDocumentTtsHygiene(draft), narrationWpm: packWpm(pack) };
  let repairCalls = row.meta?.repairCalls ?? 0;

  const factIdSet = new Set(allUsableFactIds(pack));
  let result = validateWithStickmanExtras(draft, pack, factIdSet, isStickman);

  // Bounded, tracked-separately repair: strict json_schema already prevents
  // shape violations, so this only ever fires for semantic invariants a
  // schema can't express (duplicate ids, ordering, chapter/segment
  // mismatch, or — for Stickman — a banned phrase/cold-open violation). One
  // attempt, then fail honestly rather than loop.
  let draftRepairReasons: string[] | undefined;
  // Stickman only: a first draft far under length also earns the one repair.
  // Never blocks on its own — after the repair, only result.errors decide.
  const lengthIssues = isStickman ? stickmanDraftLengthIssues(draft, storyPlan, pack.targetWords) : [];
  if ((result.errors.length || lengthIssues.length) && repairCalls < MAX_REPAIR_CALLS) {
    repairCalls += 1;
    const repairNotes = [...result.errors, ...lengthIssues];
    if (isStickman) draftRepairReasons = repairNotes.map((e: any) => e.code);
    draft = isStickman
      ? await runStickmanDraft(pack, project.narrative_strategy, storyPlan, niche, explanationDepth, usage, repairNotes)
      : await runDraft(pack, project.narrative_strategy, storyPlan, usage, result.errors);
    if (isStickman) draft = sanitizeStickmanDocumentTtsHygiene(draft);
    result = validateWithStickmanExtras(draft, pack, factIdSet, isStickman);
  }

  if (result.errors.length) {
    const meta = mergeMeta(row.meta, usage, { repairCalls }, ledgerEntry("draft", usage.inputTokens, usage.outputTokens, 0, isStickman ? STICKMAN_DRAFT_MODEL : OPENAI_MODEL, usage.cacheReadTokens, usage.cacheWriteTokens));
    // Phase 1c, Process Rule — an error code alone isn't enough to diagnose
    // a failure after the fact. Persist the exact failing validators, their
    // messages, and the offending segment text so this is reproducible
    // without having to re-run (paid) generation just to see what broke.
    const detail = {
      errors: result.errors,
      factCount: pack.chapters.reduce((sum, c) => sum + c.usableFacts.length, 0),
      segments: (draft.narrationSegments ?? []).map((s: any) => ({ id: s.id, chapterId: s.chapterId, text: s.text, factIds: s.factIds })),
    };
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "DRAFT_VALIDATION_FAILED", last_error_at: new Date().toISOString(), meta, detail, worker_lock_until: null }).eq("id", row.id);
    // Phase 6a: the Stickman autopilot re-runs the script from its checkpoint right away.
    if (isStickman) nudgeAutopilot(project.id);
    // Phase 0, Section B — a terminal script failure with nothing committed
    // against the project's reservation yet.
    await releaseReservationIfActive(admin, row.project_id, "script_draft_validation_failed", logEvent);
    return;
  }

  let scriptDocument = attachChapterMetrics({ ...draft, actualWords: computeActualWords(draft), estimatedDurationSeconds: computeEstimatedDurationSeconds(draft) });

  if (isStickman) {
    scriptDocument = enrichStickmanDocument(scriptDocument, storyPlan);
  }

  const meta = mergeMeta(row.meta, usage, { repairCalls, ...(draftRepairReasons ? { draftRepairReasons } : {}) }, ledgerEntry("draft", usage.inputTokens, usage.outputTokens, 0, isStickman ? STICKMAN_DRAFT_MODEL : OPENAI_MODEL, usage.cacheReadTokens, usage.cacheWriteTokens));
  const intermediate = { ...(row.intermediate ?? {}), evidencePack: pack, draftWarnings: result.warnings };

  // Phase 1 FINAL, cost rule — "style/quality iterations: fixture replay,
  // draft stage only, claim verification OFF, paid critic OFF": an
  // env-gated test mode, Stickman-only, that stops right after a valid
  // draft instead of continuing into claim_verify/critic/revision. Defaults
  // OFF (false) so every normal run — including every existing test and
  // all of production — is completely unaffected; only set for a deliberate
  // cheap style-iteration session.
  if (isStickman && DRAFT_ONLY_TEST_MODE) {
    await admin
      .from("long_form_script_versions")
      .update({ script_document: scriptDocument, generation_model: STICKMAN_DRAFT_MODEL, intermediate, meta, status: "needs_attention", last_error_code: "DRAFT_ONLY_TEST_MODE", stage: "finalizing", stage_attempt: 0, worker_lock_until: null })
      .eq("id", row.id);
    return;
  }

  // Phase 1d — Stickman routes through claim_verify/claim_fix (write-first
  // accuracy check) before critic; legacy goes straight to critic, unchanged.
  await admin
    .from("long_form_script_versions")
    .update({ script_document: scriptDocument, generation_model: isStickman ? STICKMAN_DRAFT_MODEL : OPENAI_MODEL, intermediate, meta, stage: isStickman ? "claim_verify" : "critic", stage_attempt: 0, worker_lock_until: null })
    .eq("id", row.id);
}

/* ============================ Phase 1d — claim verify + fix (Stickman only) ============================ */
// "Write, then verify": the draft above wrote the FULL script from its own
// knowledge and named every checkable claim it made (doc.claims). These two
// stages check the ones not already backed by a research-lite fact (batched,
// live-URL-proven the same way Research's own verify calls are — see
// _shared/stickman/urlVerify.ts) and rewrite ONLY the sentences that turned
// out wrong or unconfirmable. Both stages are Stickman-only — legacy never
// enters them (see the dispatch switch) — and both fail toward keeping the
// draft rather than losing it: a failed/timed-out verify batch just leaves
// those specific claims "unverifiable" (still gets softened by the fix
// pass); a failed fix call keeps the pre-fix draft, per the same "an
// optional pass must never destroy the last known-valid document" principle
// already established for length_expansion/runConservativeRewrite.
const STICKMAN_CLAIM_VERIFY_MAX_SEARCHES = 8; // "Max ~8 searches" per the spec — one search call per batch
const STICKMAN_CLAIM_VERIFY_BATCH_SIZE = 4; // "groups of 3-5"
const CLAIM_VERIFY_TIMEOUT_MS = 55_000; // "< 60s per call", matching Research's own verify-call convention

const STICKMAN_CLAIM_VERIFY_INSTRUCTIONS = `You are Zyvo's Claim Verifier for a short Stickman explainer video. You will be given 3-5 specific factual claims made in a finished narration script, each with the exact sentence it appears in. Search the web to check each one independently.

For each claim, report a verdict:
- "supported": your search confirms the claim is accurate as stated.
- "corrected": your search shows the claim is inaccurate, and you found the actually correct value or fact — put a short, specific replacement in correctedValue (e.g. the right year, name, or number).
- "unverifiable": you could not find a confident, citable answer either way.

Always give the sourceName and url of whatever source most informed your verdict, even for "unverifiable" if you found a partially-relevant source — otherwise null. CRITICAL: url must be a real URL you actually found via search this call — never write one from memory, never guess, never invent one.`;

function buildClaimVerdictSchema(claimIds: string[]) {
  const idEnum = claimIds.length ? claimIds : ["__none__"];
  return {
    type: "object",
    additionalProperties: false,
    required: ["verdicts"],
    properties: {
      verdicts: {
        type: "array",
        maxItems: Math.max(claimIds.length, 1),
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claimId", "verdict", "correctedValue", "sourceName", "url"],
          properties: {
            claimId: { type: "string", enum: idEnum },
            verdict: { type: "string", enum: ["supported", "corrected", "unverifiable"] },
            correctedValue: { type: ["string", "null"] },
            sourceName: { type: ["string", "null"] },
            url: { type: ["string", "null"], description: "The exact URL of a source actually found via this call's web search — never invented." },
          },
        },
      },
    },
  };
}

function stickmanClaimVerifyInput(claims: { id: string; claim: string; sentence: string }[]) {
  return [`CLAIMS TO VERIFY (search for each independently):`, JSON.stringify(claims.map((c) => ({ claimId: c.id, claim: c.claim, sentenceItAppearsIn: c.sentence })), null, 2)].join("\n");
}

async function runStickmanClaimVerifyBatch(claims: { id: string; claim: string; sentence: string }[], usageTotals: UsageTotals) {
  try {
    const payload = await callOpenAI(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: STICKMAN_CLAIM_VERIFY_INSTRUCTIONS,
        input: stickmanClaimVerifyInput(claims),
        tools: [{ type: "web_search", search_context_size: "medium" }],
        max_tool_calls: 1,
        text: { format: { type: "json_schema", name: "claim_verify", strict: true, schema: buildClaimVerdictSchema(claims.map((c) => c.id)) } },
      },
      CLAIM_VERIFY_TIMEOUT_MS
    );
    trackUsage(usageTotals, payload, true);
    const parsed = parseJson(extractOutputText(payload));
    const rawVerdicts = parsed?.verdicts ?? [];
    // Same live-fetch proof as Research's verify calls — url_citation
    // annotations come back empty on structured output (see urlVerify.ts's
    // own comment), so a verdict claiming a url that doesn't actually
    // resolve is downgraded to unverifiable rather than trusted.
    const liveChecks = await Promise.all(rawVerdicts.map((v: any) => (v.url ? urlIsLive(v.url) : Promise.resolve(false))));
    const verdicts = rawVerdicts.map((v: any, i: number) => (v.url && !liveChecks[i] ? { ...v, verdict: "unverifiable", correctedValue: null } : v));
    return { verdicts, actualToolCalls: extractActualToolCalls(payload), inputTokens: payload?.usage?.input_tokens ?? 0, outputTokens: payload?.usage?.output_tokens ?? 0, failed: false };
  } catch (error) {
    console.warn(`[advance-long-form-script] claim verify batch failed:`, String(error));
    return { verdicts: [] as any[], actualToolCalls: 0, inputTokens: 0, outputTokens: 0, failed: true };
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function stageClaimVerify(admin: any, row: ScriptRow) {
  const declaredClaims: { id: string; segmentId: string; claim: string; sentence: string; sourceFactId: string | null }[] = row.script_document.claims ?? [];
  // Post-revision pass (see stageRevision): earlier verdicts carry forward;
  // only what the revision introduced is checked.
  const postRevision = row.intermediate?.postRevisionVerify === true;
  const previousVerdicts: any[] = postRevision ? row.intermediate?.claimVerdicts ?? [] : [];
  const verifiedIds = new Set(previousVerdicts.map((v: any) => v.claimId));
  const revisedIds = new Set<string>(row.intermediate?.revisedSegmentIds ?? []);

  // Safety net for under-declared claims (see findUndeclaredCheckableSentences).
  // Only factual roles — a cold open's "the only light for thirty feet" is
  // scene-setting, not a claim, and "softening" it would damage the scene.
  const factualRoles = new Set(["evidence", "twist", "callback_payoff"]);
  const roleByChapterId = new Map((row.script_document.chapters ?? []).map((c: any) => [c.chapterId, c.role]));
  const factualSegments = (row.script_document.narrationSegments ?? []).filter(
    (s: any) => factualRoles.has(roleByChapterId.get(s.chapterId) as string) && (!postRevision || revisedIds.has(s.id)),
  );
  const autoClaims = findUndeclaredCheckableSentences(factualSegments, declaredClaims).map((f, i) => ({
    id: `${postRevision ? "auto_rev_" : "auto_"}${i + 1}`,
    segmentId: f.segmentId,
    claim: f.sentence,
    sentence: f.sentence,
    sourceFactId: null,
  }));
  const claims = [...declaredClaims, ...autoClaims];
  const doc = { ...row.script_document, claims };
  const newClaims = claims.filter((c) => !verifiedIds.has(c.id));
  const autoExtractedClaimCount = (postRevision ? row.intermediate?.autoExtractedClaimCount ?? 0 : 0) + autoClaims.length;

  if (!newClaims.length) {
    const intermediate = { ...(row.intermediate ?? {}), claimVerdicts: previousVerdicts, newClaimVerdictIds: [], autoExtractedClaimCount };
    await admin.from("long_form_script_versions").update({ script_document: doc, intermediate, stage: "claim_fix", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  // "skip claims already backed by a research-lite fact" — the draft
  // self-reports this via sourceFactId, so no text-similarity guessing.
  const alreadyBacked = newClaims.filter((c) => c.sourceFactId);
  const toCheck = newClaims.filter((c) => !c.sourceFactId);
  const batchesToRun = chunk(toCheck, STICKMAN_CLAIM_VERIFY_BATCH_SIZE).slice(0, STICKMAN_CLAIM_VERIFY_MAX_SEARCHES);

  const usage = newUsageTotals();
  const t0 = Date.now();
  const results = await Promise.all(batchesToRun.map((batch) => runStickmanClaimVerifyBatch(batch, usage)));
  const verdictByClaimId = new Map<string, any>();
  for (const r of results) for (const v of r.verdicts) verdictByClaimId.set(v.claimId, v);

  // Any claim outside the ~8-search budget (or whose batch call failed)
  // defaults to "unverifiable" rather than being silently left unchecked —
  // the fix pass then softens it, the same safe default as a real negative
  // result, never treated as implicitly fine just because it wasn't reached.
  // Phase 6f: every verdict keeps the REAL URLs behind it — a research-backed
  // claim gets its fact's sources (live-checked when research ran); a
  // web-searched claim keeps the URL the search cited only if it answers live.
  const { data: researchRow } = row.research_version_id ? await admin.from("long_form_research_versions").select("*").eq("id", row.research_version_id).maybeSingle() : { data: null };
  const srcIndex = sourceIndex(researchRow);
  const checked = await Promise.all(toCheck.map(async (c) => {
    const v = verdictByClaimId.get(c.id) ?? { claimId: c.id, verdict: "unverifiable", correctedValue: null, sourceName: null, url: null };
    const live = v.url ? await isLiveUrl(v.url) : false;
    return { ...v, url: live ? v.url : null, sources: live ? [{ url: v.url, title: v.sourceName ?? null }] : [], ...(v.url && !live ? { droppedUrl: v.url } : {}) };
  }));
  const newVerdicts = [
    ...alreadyBacked.map((c) => { const sources = factSources(c.sourceFactId, researchRow, srcIndex); return { claimId: c.id, verdict: "supported", correctedValue: null, sourceName: sources[0]?.title ?? "preferred source (research-lite)", url: sources[0]?.url ?? null, sources }; }),
    ...checked,
  ];
  const claimVerdicts = [...previousVerdicts, ...newVerdicts];

  const ledger = results.map((r) => ledgerEntry("claim_verify", r.inputTokens, r.outputTokens, r.actualToolCalls));
  const meta = mergeMeta(row.meta, usage, { claimVerifyCalls: (row.meta?.claimVerifyCalls ?? 0) + batchesToRun.length });
  meta.callLedger = [...(meta.callLedger ?? []), ...ledger];
  meta.timings = { ...(meta.timings ?? {}), claimVerifyMs: (row.meta?.timings?.claimVerifyMs ?? 0) + (Date.now() - t0) };

  const intermediate = { ...(row.intermediate ?? {}), claimVerdicts, newClaimVerdictIds: newVerdicts.map((v: any) => v.claimId), autoExtractedClaimCount };
  await admin.from("long_form_script_versions").update({ script_document: doc, intermediate, meta, stage: "claim_fix", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

const STICKMAN_CLAIM_FIX_INSTRUCTIONS = `You are Zyvo's Script Engine, running a targeted ACCURACY FIX pass on an already-written narration. You are given specific segments and, for each, one or more claims that independent verification flagged as either CORRECTED (wrong, with the right value given) or UNVERIFIABLE (no confident source found either way).

For each flagged segment, rewrite ONLY the sentence(s) containing the flagged claim(s) — every other sentence in the segment must come back word-for-word unchanged, and a softened sentence should keep roughly its original length (a lost sentence leaves the next one referring to nothing):
- corrected: replace the wrong value/fact with the correct one given in correctedValue — keep the rest of the sentence and surrounding narration the same.
- unverifiable: either soften the claim into an honest, general statement that doesn't assert the specific unconfirmed number/name/date, or remove it and replace it with a different point that serves the same narrative purpose without an unconfirmable specific claim. Never state an unverifiable claim as a confident fact.

Keep each segment's overall length, structure, narrativeFunction, openLoopIds, and payoffIds the same unless the fix genuinely requires a small adjustment. Never introduce a new checkable claim that wasn't already there and isn't one of the given corrections. Preserve continuity with the neighboring segments you were shown — context only, never to be rewritten.

Write concrete, specific statements a viewer can see in their head without being told to — never describe images, icons, arrows, maps, split screens, animations, stickers, or what's on screen, and never open a sentence with "Picture...", "Visualize...", "Imagine..." or "Think of..." as an instruction to the viewer.`;

function stickmanClaimFixInput(ctx: { targetSegments: any[]; neighborSegments: any[]; flaggedClaims: any[] }) {
  return [
    `SEGMENTS TO FIX:`,
    JSON.stringify(ctx.targetSegments, null, 2),
    ``,
    `FLAGGED CLAIMS FOR THESE SEGMENTS:`,
    JSON.stringify(ctx.flaggedClaims, null, 2),
    ``,
    `NEIGHBORING SEGMENTS (context only — do not rewrite these, do not repeat them):`,
    JSON.stringify(ctx.neighborSegments, null, 2),
  ].join("\n");
}

async function stageClaimFix(admin: any, row: ScriptRow) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const doc = row.script_document;
  const claims: { id: string; segmentId: string; claim: string; sentence: string }[] = doc.claims ?? [];
  const verdicts: any[] = row.intermediate?.claimVerdicts ?? [];
  const verdictByClaimId = new Map(verdicts.map((v: any) => [v.claimId, v]));

  // Auto-extracted claims (stageClaimVerify's safety net) are acted on only
  // when verification found an actual correction. Softening them for being
  // "unverifiable" did real damage in an acceptance run: they're often
  // analogies or rhetorical lines ("That's your evening shift, six hundred
  // centuries early"), and the fix pass rewrote their whole segments,
  // dropping a supported fact and leaving orphaned references behind.
  const actionableIds: Set<string> | null = row.intermediate?.postRevisionVerify === true ? new Set(row.intermediate?.newClaimVerdictIds ?? []) : null;
  const flagged = claims
    .map((c) => ({ ...c, verdict: verdictByClaimId.get(c.id) }))
    .filter((c) => {
      if (!c.verdict) return false;
      if (actionableIds && !actionableIds.has(c.id)) return false;
      if (c.id.startsWith("auto_")) return c.verdict.verdict === "corrected" && !!c.verdict.correctedValue;
      return c.verdict.verdict === "corrected" || c.verdict.verdict === "unverifiable";
    });

  // Store verdicts on the document either way (Phase 1d, Section 7 — "for
  // review later") whether or not a fix pass was needed.
  if (!flagged.length) {
    const scriptDocument = { ...doc, claimVerification: verdicts };
    await admin.from("long_form_script_versions").update({ script_document: scriptDocument, stage: "critic", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const targetSegmentIds = new Set(flagged.map((c) => c.segmentId));
  const segments = doc.narrationSegments ?? [];
  const targetSegments = segments.filter((s: any) => targetSegmentIds.has(s.id));
  const affectedChapterIds = Array.from(new Set(targetSegments.map((s: any) => s.chapterId)));
  const neighborSegments = segments.filter((s: any) => affectedChapterIds.includes(s.chapterId) && !targetSegmentIds.has(s.id));
  const flaggedClaims = flagged.map((c) => ({ segmentId: c.segmentId, claim: c.claim, sentence: c.sentence, verdict: c.verdict.verdict, correctedValue: c.verdict.correctedValue }));
  const factIds = allUsableFactIds(pack);
  const targetSegmentIdList = Array.from(targetSegmentIds) as string[];

  const usage = newUsageTotals();
  let fixedDoc = doc;
  try {
    const result = await callStructured(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: STICKMAN_CLAIM_FIX_INSTRUCTIONS,
        input: stickmanClaimFixInput({ targetSegments, neighborSegments, flaggedClaims }),
        text: { format: { type: "json_schema", name: "claim_fix", strict: true, schema: buildRevisionSchema(targetSegmentIdList, factIds) } },
      },
      REVISION_TIMEOUT_MS,
      usage
    );
    const replacementById = new Map(result.replacementSegments.map((s: any) => [s.id, s]));
    const countWords = (t: string) => (t ?? "").trim().split(/\s+/).filter(Boolean).length;
    const patchedSegments = segments.map((s: any) => {
      const replacement: any = replacementById.get(s.id);
      if (!replacement) return s;
      // A fix rewrites one sentence; a replacement that loses >25% of the
      // segment deleted more than the flagged claim — keep the original.
      if (countWords(replacement.text) < countWords(s.text) * 0.75) {
        console.warn(`[advance-long-form-script] claim fix for ${s.id} dropped too much text, keeping original`);
        return s;
      }
      return { ...s, text: replacement.text, factIds: replacement.factIds, narrativeFunction: replacement.narrativeFunction, openLoopIds: replacement.openLoopIds, payoffIds: replacement.payoffIds, estimatedSeconds: replacement.estimatedSeconds };
    });
    const candidate = sanitizeStickmanDocumentTtsHygiene({ ...doc, narrationSegments: patchedSegments });
    const candidateResult = validateWithStickmanExtras(candidate, pack, new Set(factIds), true);
    if (candidateResult.errors.length) {
      console.warn("[advance-long-form-script] claim fix produced invalid output, keeping pre-fix draft:", JSON.stringify(candidateResult.errors));
    } else {
      fixedDoc = candidate;
    }
  } catch (e) {
    console.warn("[advance-long-form-script] claim fix call failed, keeping pre-fix draft:", String(e));
  }

  const scriptDocument = { ...attachChapterMetrics({ ...fixedDoc, actualWords: computeActualWords(fixedDoc), estimatedDurationSeconds: computeEstimatedDurationSeconds(fixedDoc) }), claimVerification: verdicts };
  const meta = mergeMeta(row.meta, usage, { claimFixCalls: (row.meta?.claimFixCalls ?? 0) + 1 }, ledgerEntry("claim_fix", usage.inputTokens, usage.outputTokens));
  await admin.from("long_form_script_versions").update({ script_document: scriptDocument, meta, stage: "critic", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

/* ============================ Pass B — one combined Critic ============================ */

const CRITIC_INSTRUCTIONS = `You are Zyvo's Script Critic. You diagnose a finished narration draft across several independent lenses in ONE pass — you never rewrite prose yourself (a tiny illustrative snippet is fine, a rewritten segment is not; that's a separate step). You receive the script, the compact evidence pack it was written from, and deterministic warnings already found by code (repeated phrases, formulaic openers, generic phrases, word-budget deviation) — treat those as leads to confirm or dismiss, not as an exhaustive list.

Evaluate across these lenses and report every real issue you find as one entry in "issues":
- HOOK: does the opening earn attention quickly, without throat-clearing?
- INFORMATION: is useful information delivered continuously? Is anything repeated or padded?
- CURIOSITY: does each major section create genuine forward momentum? Are curiosity gaps specific, not fake suspense?
- PACING: does any section drag, or run overlong for what it delivers? Are chapters badly proportioned relative to their importance?
- LENGTH: you are given exact LENGTH DIAGNOSTICS (actualWords vs targetWords, computed from the real narration text, never a guess). If lengthRatio is meaningfully below 1 (the script is materially under budget), report it as type "insufficient_length" and name the SPECIFIC chapters that most need more depth — not a generic "make it longer" note. Depth means causal explanation, lived sequence, consequences, concrete examples — never repetition or filler; say so explicitly in recommendedAction.
- NATURALNESS: does this sound spoken and human, or academic/formulaic/AI-generated? Flag repeated rhetorical patterns and formulaic transitions specifically.
- PAYOFF: does the central promise actually get answered? Are major open loops resolved? Does the ending feel earned?
- FACTUAL GROUNDING: does every factual claim stay within what its cited facts actually support? Does the wording preserve disputed/uncertain/inferred/hypothetical status, or does it overstate confidence? Does any segment cite no factId for a claim that clearly needs one?
- PRODUCTION LANGUAGE: does any segment expose the writing/research process itself — referring to "this script", "the research", "the sources", "the FactGraph", an "unsupported chapter", an inability to "verify" or "responsibly write" something, or any other language a viewer would recognize as talking ABOUT the video instead of just narrating it? A finished narrator never explains their own limitations out loud. ANY instance of this must be reported with severity "high" regardless of how minor it seems — this is a hard blocker for readiness, not a style preference.

For each issue give a severity (low/medium/high), a type, which segmentIds it concerns, a plain description, and a recommendedAction concrete enough that a revision pass could act on it without guessing.

Then give an overallVerdict:
- "strong" — no medium/high issues; the script should ship as-is.
- "needs_revision" — real issues exist, but the script's foundation (hook, structure, central payoff) is sound; targeted fixes to specific segments would resolve them.
- "needs_research" — one or more chapters cannot be honestly written with the evidence available (not a writing-quality problem — a genuine evidence gap that no rewrite can fix).
- "structurally_broken" — exceptional: the central hook is broken, the narrative order is fundamentally wrong, the script repeats itself across the entire document, or the central payoff is simply absent. This should be rare; only use it when nothing short of a full rewrite would fix it.`;

function buildCriticSchema(segmentIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["issues", "hookAssessment", "payoffAssessment", "overallVerdict"],
    properties: {
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["severity", "type", "segmentIds", "description", "recommendedAction"],
          properties: {
            severity: { type: "string", enum: ["low", "medium", "high"] },
            type: {
              type: "string",
              enum: ["hook_weak", "padding", "insufficient_length", "repetition", "pacing_drag", "unnatural_phrasing", "formulaic_transition", "unresolved_open_loop", "missing_payoff", "factual_overreach", "uncertainty_lost", "insufficient_evidence", "production_language", "structural"],
            },
            segmentIds: { type: "array", items: { type: "string", enum: segmentIds.length ? segmentIds : ["__none__"] } },
            description: { type: "string" },
            recommendedAction: { type: "string" },
          },
        },
      },
      hookAssessment: { type: "string" },
      payoffAssessment: { type: "string" },
      overallVerdict: { type: "string", enum: ["strong", "needs_revision", "needs_research", "structurally_broken"] },
    },
  };
}

function criticInput(ctx: { scriptDocument: any; pack: ScriptEvidencePack; draftWarnings: ValidationIssue[] }) {
  const actualWords = computeActualWords(ctx.scriptDocument);
  const lengthRatio = ctx.pack.targetWords > 0 ? Math.round((actualWords / ctx.pack.targetWords) * 100) / 100 : 1;
  return [
    `SCRIPT:`,
    JSON.stringify({ title: ctx.scriptDocument.title, narrationSegments: ctx.scriptDocument.narrationSegments, chapters: ctx.scriptDocument.chapters, openLoops: ctx.scriptDocument.openLoops }, null, 2),
    ``,
    `EVIDENCE PACK IT WAS WRITTEN FROM:`,
    JSON.stringify(ctx.pack, null, 2),
    ``,
    `DETERMINISTIC WARNINGS ALREADY FOUND BY CODE (confirm, dismiss, or expand on these — don't just restate them):`,
    JSON.stringify(ctx.draftWarnings, null, 2),
    ``,
    `LENGTH DIAGNOSTICS (computed from actual narration text, never from a self-reported estimate):`,
    JSON.stringify({ targetWords: ctx.pack.targetWords, actualWords, lengthRatio }, null, 2),
  ].join("\n");
}

function hasMeaningfulIssues(critic: any): boolean {
  return (critic.issues ?? []).some((i: any) => i.severity === "medium" || i.severity === "high");
}

/* ============================ Pass B, STICKMAN BRANCH ============================ */
// Same shape and same downstream routing/revision plumbing as the legacy
// critic (hasMeaningfulIssues/stageRevision are entirely unbranched and
// reused as-is) — only the instructions text and the issue `type` enum
// differ, extended with the 8 structure-beat lenses from the Draft prompt's
// own a-h narration rules, so a beat problem flows into the SAME issues[]
// array (and therefore the same selective-revision targeting by
// segmentIds) rather than a second, disconnected reporting mechanism.
// Phase 1e — the critic is rewritten as a YouTube "Viral Editor": a
// professional script editor judging whether this would actually perform,
// not a proofreader checking structural boxes. The 8 structure-beat
// issue-level checks stay (revision still needs segmentIds to target), but
// the primary readiness signal is now the 8 numeric scores + overallScore
// (see stageFinalizing's readiness rule: overallScore >= STICKMAN_READY_CRITIC_SCORE AND no HARD
// failures AND length within ±10%), not just overallVerdict.
const STICKMAN_CRITIC_INSTRUCTIONS = `You are a professional YouTube script editor reviewing a finished Stickman explainer narration before it goes into production — the same kind of editor a top creator pays to tell them the truth about whether a script will actually perform, not a proofreader checking boxes. You receive the script, the StoryPlan it was written from (including each section's targetWords and picturableMoments), and deterministic warnings already found by code — treat those as leads to confirm or dismiss, not as an exhaustive list.

CALIBRATION — be strict. A 7 means "this would hold attention next to the top channels in this niche," not "it's competent" or "it's fine":
- A reference script scored 9/10: it never once tells the viewer to picture/visualize/imagine anything, never describes a screen element, states every fact as a plain concrete sentence, uses a real cold open that drops the viewer into a physical moment, and lands its closer on one reflective idea with short fragments — no list, no recap.
- A later lions script scored 7.5/10, READY — the first passing example: a clean, pure-scene cold open (5 sentences, no analysis); every evidence section carried 2+ specific numbers or named real sources (IUCN status, "18 African countries", "31.1 billion" farmed animals, a named 2004 study, a real dollar range, a named book and author, a named real conservation organization); no screen/icon narration, no picture/visualize crutch, no listicle closer; honest hedging on uncertain claims ("Is every lion infected? No. Is lion meat uniquely poisonous? Also no.") instead of overclaiming; length landed within 3% of target. It was NOT a 9 — its callback payoff still leaned on a partial recap before the new synthesis line, and its closer's final image was a bit more abstract than the reference's — but those are polish notes on an already-solid, ready script, not disqualifying defects. THIS is what a 7 actually looks like: not perfect, genuinely good.
- A script about why lions aren't eaten scored 4/10, DESPITE having zero structural errors and reasonable specificity, because: (1) it repeatedly told the viewer what to picture/visualize instead of just stating facts ("Picture a pale map dotted with...", "Visualize a border checkpoint...") — stage direction leaking into voiceover, never something a viewer would actually hear; (2) it described on-screen graphics directly ("arrows from the five icons... pointing at the selfie", "the five-item list animating beside the chalkboard"); (3) its closer was a colon-labeled checklist ("Supply: ... Law: ... Culture: ...") dressed up as a "tidy checklist to take home" instead of landing on one idea. Score a script this way LOW even if every deterministic check happens to pass — these are exactly the defects the deterministic checks may miss, and they are disqualifying, not minor.
- A LATER version of the same lions script fixed all of that (no screen narration, no picture/visualize crutch, no listicle closer) and was self-scored 7/10 — but a human editor scored it only 5/10, because: (1) its cold open ran to 130 words and drifted from scene into analysis mid-moment ("That scrap suddenly rewrites how people see you: it can brand you as a supplier of illegal parts...") instead of staying a pure scene; (2) its stakes/core_question sections were given far more room than one line and one question need, so they got filled with a table-of-contents preview ("five concrete barriers... ecology, law, culture, health and economics") that previewed the whole video before any evidence was given; (3) the single STRONGEST angle (the one scored highest on surprise/relatability/visual/payoff) got one vague sentence with zero actual numbers, while weaker angles got real figures — the best idea was the least developed; (4) it used two separate generic simile templates ("like shipping a controlled item abroad", "like choosing to rent a house") that read as inserted rather than organic; (5) its callback payoff recapped several earlier claims instead of adding one new insight; (6) it had roughly 1 rhetorical question across 1135 words. You must catch ALL of these — a clean structural pass (no HARD failures) is necessary but nowhere near sufficient for a 7. A cold open with analysis in it, a stakes/question section that previews the video's structure, a strong angle left underdeveloped, 2+ generic similes, or a recapping callback each independently caps the score well below 7.

Score the script 1-10 on each of these 8 dimensions, being an honest, discriminating editor:
- hook: does the cold open drop the viewer into a moment (a body, a place, a sensation) rather than narrating about the topic from outside it? Does it earn the next 10 seconds?
- angleStrength: is the core answer genuinely the most surprising/satisfying true angle available, or does it feel like whatever facts happened to be easy to find? Does the payoff deliver real "I didn't know that" value?
- specificity: named sources, precise numbers, concrete comparisons — or vague bureaucratic summary?
- visualConcreteness: is every sentence a concrete, specific statement a viewer can picture in their head WITHOUT being told to — or does it describe the screen (icons, arrows, animations, split screens, a map, a chart) or explicitly instruct the viewer to "picture"/"visualize"/"imagine" something? Either failure mode scores this LOW — narration must state facts, never direct a camera or a viewer's imagination.
- rhythm: a real mix of short punchy fragments and longer explanatory sentences, or a wall of same-length sentences?
- bridging: does the script keep connecting facts to the viewer's own body/habits/life throughout, not just bookend it?
- repetition: are stats, phrases, or ideas needlessly repeated (outside a deliberate, clean callback plant/payoff)? A CALLBACK REFERENCE IS NOT A RECAP: the payoff naming the planted detail again in a few words ("that soot", "the stopped watch") is the callback working — never penalize it. A recap is restating 2+ earlier points/stats, or re-describing the plant at length instead of adding new meaning.
- ending: does the closer follow callback payoff -> one reflective idea -> short fragments -> one memorable final line (like the reference script) — or does it recap as a list, a labeled checklist, or "here's what to take home"? Any recap/checklist shape scores this LOW regardless of how the individual sentences read.

Then give an overallScore (1-10) — your holistic verdict as an editor on whether this script is ready to publish, not simply the average of the 8 (weight the ones that would actually make a viewer click away or stay). A script with the "picture/visualize" crutch or a checklist closer cannot score above 5 overall. A script with a cold open that drifts into analysis, a stakes/core_question section that previews the video's structure, its strongest angle left vague and number-free, 2+ generic simile templates, or a callback that recaps instead of paying off cannot score above 6 overall, no matter how strong its other dimensions are.

Identify the 3 weakest sections (by chapterId) — even in an otherwise strong script, name the 3 with the most room to improve — and for each give a specific reason and a concrete rewriteInstructions a writer could act on without guessing. rewriteInstructions must NEVER suggest a checklist, a labeled/numbered recap, a list, or any description of a screen/icon/animation/scene composition — only concrete replacement WORDS the narrator would say (e.g. "replace the CITES-quota sentence with: 'Try to ship a lion skull across a border to sell it, and international law stops you cold.'" — a rewritten line, not a visual direction). If the weakest section is the closer, the rewrite instruction must describe the callback-payoff -> one idea -> short fragments -> final line shape, never a recap structure.

Also report every real structural issue as an entry in "issues" (revision targets these by segmentIds), covering the same 8 structure beats as before (cold_open_weak, stakes_weak, core_question_unclear, evidence_unit_weak, question_cadence_weak, callback_weak, bridging_weak, closer_weak) plus the shared Zyvo issue types: padding, insufficient_length (with LENGTH DIAGNOSTICS given), repetition, pacing_drag, unnatural_phrasing, formulaic_transition, unresolved_open_loop, missing_payoff, factual_overreach, uncertainty_lost, insufficient_evidence, production_language (ANY exposure of the writing process is always severity "high"), structural.

Then give an overallVerdict:
- "strong" — no medium/high issues; the script should ship as-is.
- "needs_revision" — real issues exist, but the script's foundation is sound; targeted fixes to specific segments would resolve them.
- "needs_research" — one or more sections cannot be honestly written with the evidence available.
- "structurally_broken" — exceptional: the cold open doesn't work at all, the core question is never actually answered, or the callback is entirely absent despite a plan for one. Rare — only when nothing short of a full rewrite would fix it.`;

function buildStickmanCriticSchema(segmentIds: string[], chapterIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["scores", "overallScore", "weakestSections", "issues", "hookAssessment", "payoffAssessment", "overallVerdict", "callbackConfirmed"],
    properties: {
      callbackConfirmed: { type: "boolean", description: "true if the payoff clearly refers back to the planted detail (even in different words) and lands a new meaning." },
      scores: {
        type: "object",
        additionalProperties: false,
        required: ["hook", "angleStrength", "specificity", "visualConcreteness", "rhythm", "bridging", "repetition", "ending"],
        properties: {
          hook: { type: "number", minimum: 1, maximum: 10 },
          angleStrength: { type: "number", minimum: 1, maximum: 10 },
          specificity: { type: "number", minimum: 1, maximum: 10 },
          visualConcreteness: { type: "number", minimum: 1, maximum: 10 },
          rhythm: { type: "number", minimum: 1, maximum: 10 },
          bridging: { type: "number", minimum: 1, maximum: 10 },
          repetition: { type: "number", minimum: 1, maximum: 10, description: "10 = no needless repetition; 1 = heavily repetitive." },
          ending: { type: "number", minimum: 1, maximum: 10 },
        },
      },
      overallScore: { type: "number", minimum: 1, maximum: 10 },
      weakestSections: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["chapterId", "reason", "rewriteInstructions"],
          properties: {
            chapterId: { type: "string", enum: chapterIds.length ? chapterIds : ["__none__"] },
            reason: { type: "string" },
            rewriteInstructions: { type: "string", description: "Concrete enough that a writer could act on it without guessing." },
          },
        },
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["severity", "type", "segmentIds", "description", "recommendedAction"],
          properties: {
            severity: { type: "string", enum: ["low", "medium", "high"] },
            type: {
              type: "string",
              enum: [
                "cold_open_weak", "stakes_weak", "core_question_unclear", "evidence_unit_weak", "question_cadence_weak", "callback_weak", "bridging_weak", "closer_weak",
                "hook_weak", "padding", "insufficient_length", "repetition", "pacing_drag", "unnatural_phrasing", "formulaic_transition", "unresolved_open_loop", "missing_payoff", "factual_overreach", "uncertainty_lost", "insufficient_evidence", "production_language", "structural",
              ],
            },
            segmentIds: { type: "array", items: { type: "string", enum: segmentIds.length ? segmentIds : ["__none__"] } },
            description: { type: "string" },
            recommendedAction: { type: "string" },
          },
        },
      },
      hookAssessment: { type: "string" },
      payoffAssessment: { type: "string" },
      overallVerdict: { type: "string", enum: ["strong", "needs_revision", "needs_research", "structurally_broken"] },
    },
  };
}

// Phase 1e — the critic's weakestSections aren't asked twice as separate
// revision input: folded into the SAME issues[] array (severity "high", the
// existing "structural" type) so runSelectiveRevision's existing
// segmentIds-based targeting picks them up automatically, with no second
// revision pathway to keep in sync.
function weakestSectionsAsIssues(weakestSections: { chapterId: string; reason: string; rewriteInstructions: string }[], segments: any[]) {
  return weakestSections.map((w) => ({
    severity: "high" as const,
    type: "structural" as const,
    segmentIds: segments.filter((s: any) => s.chapterId === w.chapterId).map((s: any) => s.id),
    description: `Viral Editor flagged this as one of the 3 weakest sections: ${w.reason}`,
    recommendedAction: w.rewriteInstructions,
  }));
}

async function stageCritic(admin: any, row: ScriptRow, _project: any, storyPlan: any, isStickman: boolean) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const doc = row.script_document;
  const usage = newUsageTotals();
  const segmentIds = (doc.narrationSegments ?? []).map((s: any) => s.id);
  const chapterIds = (storyPlan.chapters ?? []).map((c: any) => c.id);

  const criticModel = isStickman ? STICKMAN_CRITIC_MODEL : OPENAI_MODEL;
  const critic = await callStickmanModel(
    criticModel,
    isStickman ? STICKMAN_CRITIC_INSTRUCTIONS : CRITIC_INSTRUCTIONS,
    criticInput({ scriptDocument: doc, pack, draftWarnings: row.intermediate?.revisionWarnings ?? row.intermediate?.draftWarnings ?? [] }),
    isStickman ? buildStickmanCriticSchema(segmentIds, chapterIds) : buildCriticSchema(segmentIds),
    isStickman ? "stickman_script_critic" : "script_critic",
    CRITIC_TIMEOUT_MS,
    usage
  );

  // Phase 1e — fold weakestSections into issues[] BEFORE anything downstream
  // (routing, revision targeting, stageFinalizing's persisted critic_result)
  // ever reads it, so there is exactly one issue list, not two.
  if (isStickman && critic.weakestSections?.length) {
    critic.issues = [...(critic.issues ?? []), ...weakestSectionsAsIssues(critic.weakestSections, doc.narrationSegments ?? [])];
  }

  const meta = mergeMeta(row.meta, usage, undefined, ledgerEntry("critic", usage.inputTokens, usage.outputTokens, 0, criticModel, usage.cacheReadTokens, usage.cacheWriteTokens));

  // Phase 1e readiness rule — for Stickman, "strong enough to skip revision"
  // now also requires overallScore >= STICKMAN_READY_CRITIC_SCORE (a Viral Editor's holistic verdict),
  // not just the structural overallVerdict: a script with zero flagged
  // issues can still be a 5/10 (flat, unoriginal, jargon-heavy) that the
  // deterministic checks and issue-based lenses don't catch on their own.
  // Below 7, route to selective_revision — which now always has the 3
  // weakest sections queued via the issues[] fold above — for one targeted
  // pass, exactly the same "one bounded attempt, then finalize honestly"
  // shape every other optional pass in this file already uses.
  let routing: "skip" | "selective_revision" | "full_rewrite" | "needs_research";
  if (critic.overallVerdict === "needs_research") routing = "needs_research";
  else if (critic.overallVerdict === "structurally_broken") routing = "full_rewrite";
  else if (critic.overallVerdict === "strong" && !hasMeaningfulIssues(critic) && (!isStickman || (critic.overallScore ?? 10) >= STICKMAN_READY_CRITIC_SCORE)) routing = "skip";
  else routing = "selective_revision";

  // Second pass is the post-revision re-critique (see stageRevision): its
  // score is final — always finalize, never a second revision.
  const criticPasses = (row.intermediate?.criticPasses ?? 0) + 1;
  const isRecritique = isStickman && criticPasses >= 2;
  const intermediate = {
    ...(row.intermediate ?? {}),
    ...(isStickman ? { criticPasses } : {}),
    ...(isRecritique ? { firstCriticResult: row.critic_result } : { criticRouting: routing }),
  };
  const nextStage = isRecritique || routing === "skip" || routing === "needs_research" ? "finalizing" : "revision";
  await admin.from("long_form_script_versions").update({ critic_result: critic, critic_model: criticModel, intermediate, meta, stage: nextStage, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

/* ============================ Pass C — selective Revision (or, exceptionally, one full rewrite) ============================ */

const REVISION_INSTRUCTIONS = `You are Zyvo's Script Revision Director. You are given a small set of narration segments that a Critic flagged, the specific issues raised about each, the neighboring segments for continuity (not to be rewritten), and the evidence available to the affected chapters. Rewrite ONLY the flagged segments so they resolve the critic's issues.

Rules:
- You may only reference factIds provided in this context. Never invent a new factId, and never invent a claim that isn't supported by one of the provided facts.
- Preserve continuity with the neighboring segments you were shown — do not contradict them or repeat what they already established.
- Address the specific issue(s) raised for each segment; don't rewrite for the sake of rewriting.
- Every segment you were asked to replace must appear exactly once in your output, identified by its original id.
- Follow the same narration craft rules as the original draft: natural spoken language, no formulaic transitions, preserve uncertainty/dispute language exactly, no padding.`;

// Stickman revision also declares the new checkable claims it introduces, so
// they go through claim verification before the re-critique (write-first,
// verified after — the same contract as the draft).
function buildStickmanRevisionSchema(targetSegmentIds: string[], factIds: string[]) {
  const base: any = buildRevisionSchema(targetSegmentIds, factIds);
  return { ...base, required: [...base.required, "claims"], properties: { ...base.properties, claims: { type: "array", items: buildClaimSchema(factIds) } } };
}

function buildRevisionSchema(targetSegmentIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["replacementSegments"],
    properties: {
      replacementSegments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "text", "factIds", "narrativeFunction", "openLoopIds", "payoffIds", "estimatedSeconds"],
          properties: {
            id: { type: "string", enum: targetSegmentIds.length ? targetSegmentIds : ["__none__"] },
            text: { type: "string" },
            factIds: { type: "array", items: { type: "string", enum: factIds.length ? factIds : ["__none__"] } },
            narrativeFunction: { type: "string" },
            openLoopIds: { type: "array", items: { type: "string" } },
            payoffIds: { type: "array", items: { type: "string" } },
            estimatedSeconds: { type: "number" },
          },
        },
      },
    },
  };
}

function revisionInput(ctx: { targetSegments: any[]; neighborSegments: any[]; issues: any[]; pack: ScriptEvidencePack; affectedChapterIds: string[]; callbackContext?: { callbackKey: string; plantSegmentId: string | null; payoffSegmentId: string | null } }) {
  const relevantPack = { ...ctx.pack, chapters: ctx.pack.chapters.filter((c) => ctx.affectedChapterIds.includes(c.chapterId)) };
  const lines = [
    `SEGMENTS TO REVISE:`,
    JSON.stringify(ctx.targetSegments, null, 2),
    ``,
    `CRITIC ISSUES FOR THESE SEGMENTS:`,
    JSON.stringify(ctx.issues, null, 2),
    ``,
    `NEIGHBORING SEGMENTS (context only — do not rewrite these, do not repeat them):`,
    JSON.stringify(ctx.neighborSegments, null, 2),
    ``,
    `EVIDENCE AVAILABLE TO THE AFFECTED CHAPTERS:`,
    JSON.stringify(relevantPack, null, 2),
  ];
  // Phase 1f — only present for Stickman, and only when the plant or payoff
  // segment is actually one of the ones being touched, so the model knows
  // exactly which phrase it must preserve verbatim in its rewrite.
  if (ctx.callbackContext) {
    const touchesPlant = ctx.callbackContext.plantSegmentId && ctx.targetSegments.some((s) => s.id === ctx.callbackContext!.plantSegmentId);
    const touchesPayoff = ctx.callbackContext.payoffSegmentId && ctx.targetSegments.some((s) => s.id === ctx.callbackContext!.payoffSegmentId);
    if (touchesPlant || touchesPayoff) {
      lines.push(``, `CALLBACK TO KEEP: the planted detail is "${ctx.callbackContext.callbackKey}". Your rewrite of ${touchesPlant ? "the plant segment" : ""}${touchesPlant && touchesPayoff ? " and " : ""}${touchesPayoff ? "the payoff segment" : ""} must still name its key noun so the payoff clearly points back to it — a short reference, never a repeat of the plant's description.`);
    }
  }
  return lines.join("\n");
}

// Selective by default: only the flagged segments plus same-chapter
// neighbors go to the model, never the whole script. Keeps revision cheap
// and — just as importantly — keeps every untouched segment byte-identical,
// so a good section can never be accidentally degraded by an unrelated fix.
// Phase 1 — `instructions` defaults to the legacy REVISION_INSTRUCTIONS, so
// every existing call site (none of which pass a 5th argument) is provably
// unaffected. Stickman calls pass STICKMAN_REVISION_INSTRUCTIONS instead;
// everything else about the function (schema, targeting, patch mechanics)
// stays identical for both recipes.
async function runSelectiveRevision(doc: any, pack: ScriptEvidencePack, critic: any, usage: UsageTotals, instructions: string = REVISION_INSTRUCTIONS, model: string = OPENAI_MODEL) {
  const flaggedIds = new Set<string>((critic.issues ?? []).filter((i: any) => i.severity === "medium" || i.severity === "high").flatMap((i: any) => i.segmentIds ?? []));
  const segments = doc.narrationSegments ?? [];
  const segmentById = new Map(segments.map((s: any) => [s.id, s]));
  const targetSegments = Array.from(flaggedIds).map((id) => segmentById.get(id)).filter(Boolean);
  const affectedChapterIds = Array.from(new Set(targetSegments.map((s: any) => s.chapterId)));
  const neighborSegments = segments.filter((s: any) => affectedChapterIds.includes(s.chapterId) && !flaggedIds.has(s.id));
  const relevantIssues = (critic.issues ?? []).filter((i: any) => (i.segmentIds ?? []).some((id: string) => flaggedIds.has(id)));
  const factIds = allUsableFactIds(pack);
  const callbackContext = doc.callbackKey
    ? { callbackKey: doc.callbackKey, plantSegmentId: doc.plantSegmentIndex != null ? segments[doc.plantSegmentIndex]?.id ?? null : null, payoffSegmentId: doc.payoffSegmentIndex != null ? segments[doc.payoffSegmentIndex]?.id ?? null : null }
    : undefined;

  const isStickmanRevision = instructions === STICKMAN_REVISION_INSTRUCTIONS;
  const result = await callStickmanModel(
    model,
    instructions,
    revisionInput({ targetSegments, neighborSegments, issues: relevantIssues, pack, affectedChapterIds, callbackContext }),
    isStickmanRevision ? buildStickmanRevisionSchema(Array.from(flaggedIds), factIds) : buildRevisionSchema(Array.from(flaggedIds), factIds),
    "script_revision",
    REVISION_TIMEOUT_MS,
    usage
  );

  const replacementById = new Map(result.replacementSegments.map((s: any) => [s.id, s]));
  const patchedSegments = segments.map((s: any) => {
    const replacement = replacementById.get(s.id);
    if (!replacement) return s;
    // chapterId/sequenceIndex are never taken from the model — preserved
    // from the original segment by construction, so revision can never
    // move a segment to a different chapter or reorder the script.
    return { ...s, text: replacement.text, factIds: replacement.factIds, narrativeFunction: replacement.narrativeFunction, openLoopIds: replacement.openLoopIds, payoffIds: replacement.payoffIds, estimatedSeconds: replacement.estimatedSeconds };
  });
  if (!isStickmanRevision) return { ...doc, narrationSegments: patchedSegments };
  // rev_ ids never collide with the draft's own claim ids; only claims on a
  // segment this revision actually replaced are kept.
  const revisionClaims = (result.claims ?? [])
    .filter((c: any) => replacementById.has(c.segmentId))
    .map((c: any, i: number) => ({ ...c, id: `rev_${i + 1}` }));
  return { ...doc, narrationSegments: patchedSegments, claims: [...(doc.claims ?? []).filter((c: any) => !String(c.id).startsWith("rev_")), ...revisionClaims] };
}

// Chapters furthest below their "fair share" of the word budget first —
// deliberately simple and deterministic rather than trying to infer which
// chapters are "most interesting" to expand. A chapter already at or above
// its fair share is never targeted even if the whole script is short
// overall; expansion should land where the deficit actually is.
function selectUnderLengthSegments(doc: any, pack: ScriptEvidencePack): Set<string> {
  const wordsByChapter = new Map<string, number>();
  const segmentsByChapter = new Map<string, any[]>();
  for (const s of doc.narrationSegments ?? []) {
    wordsByChapter.set(s.chapterId, (wordsByChapter.get(s.chapterId) ?? 0) + countWords(s.text));
    if (!segmentsByChapter.has(s.chapterId)) segmentsByChapter.set(s.chapterId, []);
    segmentsByChapter.get(s.chapterId)!.push(s);
  }
  const fairShare = pack.targetWords / Math.max(pack.chapters.length, 1);
  const rankedChapters = pack.chapters
    .map((c) => ({ chapterId: c.chapterId, deficit: fairShare - (wordsByChapter.get(c.chapterId) ?? 0) }))
    .filter((c) => c.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit);

  const targetSegmentIds = new Set<string>();
  for (const c of rankedChapters) {
    for (const s of segmentsByChapter.get(c.chapterId) ?? []) targetSegmentIds.add(s.id);
  }
  return targetSegmentIds;
}

// One bounded, tracked-separately (see MAX_LENGTH_EXPANSION_CALLS/meta.expansionCalls)
// pass that rewrites the chapters furthest under their word-budget share
// with substantially richer content — never a padding pass. Reuses the same
// selective-patch mechanism as runSelectiveRevision (same schema, same
// "only touch flagged segments, everything else stays byte-identical"
// guarantee) with different targeting (word deficit, not critic severity)
// and different instructions (add real value, not fix flagged issues).
const EXPANSION_INSTRUCTIONS = `You are Zyvo's Script Engine, running a TARGETED EXPANSION pass on an already-valid narration that came in significantly under its word budget. You are given the full evidence available to the affected chapters and the specific segments identified as under-developed relative to their fair share of the budget.

Rewrite ONLY the given segments — replace each with a substantially longer, richer version that adds genuine value, not filler:
- concrete operational detail and lived sequence: what actually happens, step by step
- causal explanation: why this leads to that
- consequences and stakes
- a specific example grounded in the evidence you were given
- natural callbacks to earlier setups/open loops where relevant, so the chapters feel like one continuous story handing off to the next, not independent mini-essays

DO NOT pad: never repeat a fact already stated elsewhere in the script, never add a generic transition sentence, never restate the same point in different words, never add a sentence that carries no new information just to add length.

DISTINGUISH KNOWN FROM RECONSTRUCTED: where a cited fact is a REASONABLE_INFERENCE or HYPOTHETICAL_ASSUMPTION, keep language like "a plausible version of this would..." or "that likely meant..." — but don't hedge every sentence; state directly SUPPORTED_FACT claims plainly and confidently.

AVOID REPORT/INSTITUTIONAL LANGUAGE: if a technical term or acronym is necessary, explain what it does in plain words before or instead of naming it. Never use institutional phrasing like "these are the tradeoffs planners expect" or "experiments of this style" — narrate the way a documentary host explains something to a person, never like a technical report summarizing itself. Do not copy an evidence claim's own dense phrasing verbatim into narration — translate it into how a person would actually say it out loud.

PRECISION — never conflate distinct systems: if the evidence describes a specific named mechanism or process, do not attribute a DIFFERENT mechanism's function to it unless the evidence explicitly supports that link (e.g., a resource-production system and a life-support recycling system are not interchangeable just because both matter for the same resource — check which fact actually supports which claim).

Every segment must stay within ${SEGMENT_TARGET_MIN_WORDS}-${SEGMENT_HARD_MAX_WORDS} words. Never introduce a factId that isn't in the evidence you were given. Never change chapterId, sequenceIndex, openLoopIds, or payoffIds unless the segment's own openLoopIds/payoffIds genuinely need updating because of what you added.`;

// Phase 1e, Section 6 — Stickman's own expansion instructions: new
// picturable material (a fresh example, comparison, or viewer-bridge
// moment), never filler and never a repeated statistic. Legacy keeps
// EXPANSION_INSTRUCTIONS byte-identical; runLengthExpansion's `instructions`
// param defaults to it, so this is purely additive.
const STICKMAN_EXPANSION_INSTRUCTIONS = `You are Zyvo's Stickman Script Engine, running a TARGETED EXPANSION pass on an already-valid narration that came in significantly under its word budget. You are given the affected sections' picturableMoments (concrete, real-world content ideas — for the separate visual team, not something to describe) and any preferred-source facts available to them, plus the specific segments identified as under-developed relative to their fair share of the budget.

Rewrite ONLY the given segments — replace each with a substantially longer, richer version that adds genuine NEW concrete material:
- a fresh concrete example, comparison, or specific fact the viewer can picture in their head WITHOUT being told to — draw on the section's picturableMoments if any are unused, or invent a new equally concrete one from your own knowledge, stated as a plain fact
- a viewer-bridging moment connecting the point to the viewer's own body, habits, or daily life
- causal explanation: why this leads to that, stated concretely, not as an abstract mechanism

Write concrete, specific statements a viewer can see in their head without being told to. The visuals are created separately — never describe images, icons, arrows, maps, split screens, animations, stickers, or what's on screen. Never open a sentence with "Picture...", "Visualize...", "Imagine..." or "Think of...". Never write a forward-reference or lecture line ("later we'll", "keep that in mind", "we'll check", "as we'll see", "here's a checklist", "take home").

DO NOT pad: never repeat a fact or specific number already stated elsewhere in the script (outside the callback's own plant/payoff pair), never add a generic transition sentence, never restate the same point in different words, never add a sentence that carries no new information just to add length.

TTS-SAFE TEXT: same rules as the original draft — no "=", "&", "->", curly quotes, or emoji; plain spoken words only.

Every segment must stay within ${SEGMENT_TARGET_MIN_WORDS}-${SEGMENT_HARD_MAX_WORDS} words. Never change chapterId, sequenceIndex, openLoopIds, or payoffIds unless the segment's own openLoopIds/payoffIds genuinely need updating because of what you added.`;

function expansionInput(ctx: { targetSegments: any[]; neighborSegments: any[]; pack: ScriptEvidencePack; affectedChapterIds: string[] }) {
  const relevantPack = { ...ctx.pack, chapters: ctx.pack.chapters.filter((c) => ctx.affectedChapterIds.includes(c.chapterId)) };
  return [
    `SEGMENTS TO EXPAND (rewrite these, substantially longer, with genuinely new content — not padding):`,
    JSON.stringify(ctx.targetSegments, null, 2),
    ``,
    `NEIGHBORING SEGMENTS (context only — do not rewrite these, do not repeat their content):`,
    JSON.stringify(ctx.neighborSegments, null, 2),
    ``,
    `EVIDENCE AVAILABLE TO THE AFFECTED CHAPTERS:`,
    JSON.stringify(relevantPack, null, 2),
  ].join("\n");
}

async function runLengthExpansion(doc: any, pack: ScriptEvidencePack, targetSegmentIds: Set<string>, usage: UsageTotals, instructions: string = EXPANSION_INSTRUCTIONS) {
  const segments = doc.narrationSegments ?? [];
  const segmentById = new Map(segments.map((s: any) => [s.id, s]));
  const targetSegments = Array.from(targetSegmentIds).map((id) => segmentById.get(id)).filter(Boolean);
  const affectedChapterIds = Array.from(new Set(targetSegments.map((s: any) => s.chapterId)));
  const neighborSegments = segments.filter((s: any) => affectedChapterIds.includes(s.chapterId) && !targetSegmentIds.has(s.id));
  const factIds = allUsableFactIds(pack);

  const result = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions,
      input: expansionInput({ targetSegments, neighborSegments, pack, affectedChapterIds }),
      text: { format: { type: "json_schema", name: "script_expansion", strict: true, schema: buildRevisionSchema(Array.from(targetSegmentIds), factIds) } },
    },
    REVISION_TIMEOUT_MS,
    usage
  );

  const replacementById = new Map(result.replacementSegments.map((s: any) => [s.id, s]));
  const patchedSegments = segments.map((s: any) => {
    const replacement = replacementById.get(s.id);
    if (!replacement) return s;
    return { ...s, text: replacement.text, factIds: replacement.factIds, narrativeFunction: replacement.narrativeFunction, openLoopIds: replacement.openLoopIds, payoffIds: replacement.payoffIds };
  });
  return { ...doc, narrationSegments: patchedSegments };
}

// Every segment belonging to one of the given chapters — deliberately whole
// chapters, not individual critic-flagged segments, since an unsupported
// exact number in one sentence of a chapter usually means the WHOLE
// chapter's framing leans on precision the evidence doesn't have; softening
// just the one flagged sentence in isolation risks leaving a neighboring
// sentence in the same chapter making the same kind of unsupported claim.
function selectSegmentsForChapters(doc: any, chapterIds: string[]): Set<string> {
  const chapterIdSet = new Set(chapterIds);
  const targetSegmentIds = new Set<string>();
  for (const s of doc.narrationSegments ?? []) {
    if (chapterIdSet.has(s.chapterId)) targetSegmentIds.add(s.id);
  }
  return targetSegmentIds;
}

// Reached only once the one automatic research repair round is exhausted
// (MAX_AUTOMATIC_REPAIR_ROUNDS) and real evidence gaps remain — see
// stageFinalizing's own comment on why this must never route back to
// research again. Distinct from EXPANSION_INSTRUCTIONS (adds depth) and
// REVISION_INSTRUCTIONS (fixes flagged craft issues): this ONLY removes or
// softens claims the evidence doesn't support, and is explicitly forbidden
// from inventing a replacement number just to fill the gap.
const CONSERVATIVE_REWRITE_INSTRUCTIONS = `You are Zyvo's Conservative Narration Editor. A Critic has identified narration segments that state exact, precise details (numbers, schedules, specific quantities) which the available evidence does NOT actually support — usually because the detail concerns a FUTURE or hypothetical operation (e.g. an exact future Mars mission's exercise minutes, an exact future ISRU plant's startup time) that no authoritative source has published yet. The underlying IDEA is not wrong; only the false precision is.

Your only job: remove or soften the UNSUPPORTED PRECISION in each given segment, without losing the segment's story value.
- Replace an invented/unsupported exact number, date, or schedule with honest, general framing that still conveys why it matters (the cause, the tradeoff, the consequence) — e.g. turn "the crew exercises for exactly 95 minutes" into something like "exercise would be a protected part of the schedule, with the exact regimen depending on what partial-gravity research ultimately shows."
- Never invent a DIFFERENT specific number, date, or statistic to replace the one you removed — vagueness in service of honesty is the goal, not a different fabrication.
- Preserve every fact that IS actually supported by its cited evidence — only touch the specific unsupported-precision claim itself, not the whole segment's content.
- Preserve continuity with the neighboring segments you were shown — do not contradict them or repeat what they already established.
- Every segment you were asked to rewrite must appear exactly once in your output, identified by its original id.
- Follow the same narration craft rules as the original draft: natural spoken language, no formulaic transitions, no institutional/report phrasing.`;

async function runConservativeRewrite(doc: any, pack: ScriptEvidencePack, targetSegmentIds: Set<string>, issues: any[], usage: UsageTotals) {
  const segments = doc.narrationSegments ?? [];
  const segmentById = new Map(segments.map((s: any) => [s.id, s]));
  const targetSegments = Array.from(targetSegmentIds).map((id) => segmentById.get(id)).filter(Boolean);
  const affectedChapterIds = Array.from(new Set(targetSegments.map((s: any) => s.chapterId)));
  const neighborSegments = segments.filter((s: any) => affectedChapterIds.includes(s.chapterId) && !targetSegmentIds.has(s.id));
  const relevantIssues = issues.filter((i: any) => (i.segmentIds ?? []).some((id: string) => targetSegmentIds.has(id)));
  const factIds = allUsableFactIds(pack);

  const result = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: CONSERVATIVE_REWRITE_INSTRUCTIONS,
      input: revisionInput({ targetSegments, neighborSegments, issues: relevantIssues, pack, affectedChapterIds }),
      text: { format: { type: "json_schema", name: "conservative_rewrite", strict: true, schema: buildRevisionSchema(Array.from(targetSegmentIds), factIds) } },
    },
    CONSERVATIVE_REWRITE_TIMEOUT_MS,
    usage
  );

  const replacementById = new Map(result.replacementSegments.map((s: any) => [s.id, s]));
  const patchedSegments = segments.map((s: any) => {
    const replacement = replacementById.get(s.id);
    if (!replacement) return s;
    return { ...s, text: replacement.text, factIds: replacement.factIds, narrativeFunction: replacement.narrativeFunction, openLoopIds: replacement.openLoopIds, payoffIds: replacement.payoffIds, estimatedSeconds: replacement.estimatedSeconds };
  });
  return { ...doc, narrationSegments: patchedSegments };
}

// Phase 1 — condensed recap of the Stickman draft's own craft rules, in the
// same spirit as the legacy REVISION_INSTRUCTIONS' own closing line ("Follow
// the same narration craft rules as the original draft") — just naming what
// those rules actually are for this recipe, since a selective-revision call
// never sees STICKMAN_DRAFT_INSTRUCTIONS itself.
const STICKMAN_REVISION_INSTRUCTIONS = `You are Zyvo's Stickman Script Revision Director. You are given a small set of narration segments that a Critic flagged, the specific issues raised about each, the neighboring segments for continuity (not to be rewritten), and the evidence available to the affected sections. Rewrite ONLY the flagged segments so they resolve the critic's issues. Keep every segment's role shape: a stakes segment stays ONE punchy line (~15 words) and a core-question segment stays ONE question (~25 words) no matter what the critic asked for — put new substance, bridges and examples into evidence sections, never into those two. Each fact still appears in only one section: don't pull a figure from another section to fill a flagged one.

Rules:
- factIds may only reference facts provided in this context — never invent a factId.
- WRITE-FIRST, VERIFIED AFTER (same as the original draft): when the critic asks for specificity — a number, a named site/study/researcher, a date — prefer the provided evidence, and otherwise use specific facts from your own knowledge that you are confident are true. A vague qualifier ("dozens of sites", "hundreds of records") is never an acceptable fix when a precise, true figure or name exists. List EVERY new checkable claim you introduce (named person/site/study/organization, number, date, percentage) in "claims", each with the exact sentence it appears in (copied verbatim from your rewrite) and its segmentId, sourceFactId set only when the sentence says exactly what that provided fact says. These are all verified after you write; wrong ones get corrected, so never guess — if you aren't sure of a figure, name something you are sure of instead.
- Preserve continuity with the neighboring segments you were shown — do not contradict them or repeat what they already established.
- Address the specific issue(s) raised for each segment; don't rewrite for the sake of rewriting.
- Every segment you were asked to replace must appear exactly once in your output, identified by its original id.
- Follow the Stickman Script Mode craft rules from the original draft: second-person cold opens stay second person; evidence units stay claim -> named source -> precise number -> plain meaning, with no vague qualifiers ("a long time ago", "many scientists", "very big"); rhetorical mini-questions stay natural and non-repetitive; bridging ("you"/"your") stays present; TTS-safe plain spoken text only; no lecture/filler phrases ("in this video", "let's talk about", "moving on"); no numbered-list enumerations; no forward-reference/lecture lines ("later we'll", "keep that in mind", "we'll check", "as we'll see", "here's a checklist", "take home") — say the thing now.
- PICTURABLE ≠ DESCRIBING A PICTURE: write concrete, specific statements a viewer can see in their head without being told to. Never describe images, icons, arrows, maps, split screens, animations, stickers, or what's on screen — visuals are a separate team's job. Don't open sentences with "Picture...", "Visualize...", "Imagine..." or "Think of..." as an instruction to the viewer — just state the fact.
- If you are rewriting the closer, it must never become a numbered/labeled/checklist recap ("Five reasons.", "Supply: ... Law: ...", "here's a checklist", "take home") — land on ONE reflective idea with short fragments and one memorable final line, the same shape as any other section's ending, never a list.
- If the flagged segment is the callback's plant or payoff segment (given to you in context), keep a clear reference back to the planted detail — its key noun (e.g. "that soot", "the stopped watch") — but never restate the plant's full description; a payoff refers back in a few words and then adds the NEW meaning.
- State uncertainty once: never add a hedging/caution sentence ("a caution here", "it's worth admitting", "honestly, no", "we can't be certain") if the script already has two.
- Findings, not methods: no lab/method jargon (use-wear, multiproxy, pyromarkers, phytoliths, lipid residues, assemblages, residue analysis...) unless the same sentence translates it into something a viewer can picture.`;

// Exceptional path — only reached when the Critic itself declared the
// script structurally_broken. Re-runs the full Draft pass, but with the
// Critic's own findings folded in as repair-style context so it doesn't
// reproduce the same structural mistake.
async function runFullRewrite(pack: ScriptEvidencePack, narrativeStrategy: any, storyPlan: any, critic: any, usage: UsageTotals, isStickman: boolean, niche: string | null, explanationDepth: string) {
  const notes: ValidationIssue[] = (critic.issues ?? []).map((i: any) => ({ code: `critic_${i.type}`, message: `${i.description} — ${i.recommendedAction}`, segmentIds: i.segmentIds }));
  return isStickman
    ? await runStickmanDraft(pack, narrativeStrategy, storyPlan, niche, explanationDepth, usage, notes)
    : await runDraft(pack, narrativeStrategy, storyPlan, usage, notes);
}

async function stageRevision(admin: any, row: ScriptRow, project: any, storyPlan: any, isStickman: boolean, niche: string | null) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const routing = row.intermediate.criticRouting as "selective_revision" | "full_rewrite";
  const usage = newUsageTotals();
  const explanationDepth = project.resolved_explanation_depth ?? "balanced";

  let revisedDoc =
    routing === "full_rewrite"
      ? await runFullRewrite(pack, project.narrative_strategy, storyPlan, row.critic_result, usage, isStickman, niche, explanationDepth)
      : await runSelectiveRevision(row.script_document, pack, row.critic_result, usage, isStickman ? STICKMAN_REVISION_INSTRUCTIONS : REVISION_INSTRUCTIONS, isStickman ? STICKMAN_REVISION_MODEL : OPENAI_MODEL);
  if (isStickman) revisedDoc = sanitizeStickmanDocumentTtsHygiene(revisedDoc);

  const factIdSet = new Set(allUsableFactIds(pack));
  let result = validateWithStickmanExtras(revisedDoc, pack, factIdSet, isStickman);

  // Phase 1 FINAL — a selective revision patches individual segments, so a
  // HARD failure confined to specific segments is rolled back segment-by-
  // segment to the validated pre-revision text instead of discarding every
  // other improvement. Real incident: a revision bloated the stakes line to
  // 44 words (stakes_overrun), and the whole revision — including its fixes
  // to the three weakest sections — was thrown away with it.
  let rolledBackSegmentIds: string[] = [];
  if (isStickman && routing === "selective_revision" && result.errors.length && result.errors.every((e: any) => e.segmentIds?.length)) {
    const badIds = new Set<string>(result.errors.flatMap((e: any) => e.segmentIds));
    const originalById = new Map((row.script_document.narrationSegments ?? []).map((s: any) => [s.id, s]));
    if ([...badIds].every((id) => originalById.has(id))) {
      const candidate = { ...revisedDoc, narrationSegments: (revisedDoc.narrationSegments ?? []).map((s: any) => (badIds.has(s.id) ? originalById.get(s.id) : s)) };
      const candidateResult = validateWithStickmanExtras(candidate, pack, factIdSet, isStickman);
      if (!candidateResult.errors.length) {
        revisedDoc = { ...candidate, claims: (candidate.claims ?? []).filter((c: any) => !(String(c.id).startsWith("rev_") && badIds.has(c.segmentId))) };
        result = candidateResult;
        rolledBackSegmentIds = [...badIds];
      }
    }
  }

  if (result.errors.length) {
    // Selective revision (and full_rewrite's exceptional path) is an
    // OPTIONAL improvement over a draft that stageDraft already proved
    // valid (it only ever persists a document that already passed this
    // same validator) — row.script_document is that untouched checkpoint,
    // since this branch never writes to it. A revision that fails
    // deterministic validation must never destroy that checkpoint: fall
    // back to finalizing the existing valid draft as-is (the Critic's
    // notes still reach the user via stageFinalizing's qualitySummary)
    // instead of throwing away a perfectly usable narration over an
    // optional polish pass that didn't land. revisionValidationErrors is
    // persisted (never was before) so a real failure here is diagnosable
    // afterward instead of just a bare error code with no detail.
    const meta = mergeMeta(row.meta, usage, { revisionKind: null, revisionFallbackReason: "revision_validation_failed" }, ledgerEntry(`revision_${routing}`, usage.inputTokens, usage.outputTokens, 0, isStickman ? STICKMAN_REVISION_MODEL : OPENAI_MODEL, usage.cacheReadTokens, usage.cacheWriteTokens));
    const intermediate = { ...(row.intermediate ?? {}), revisionValidationErrors: result.errors };
    await admin
      .from("long_form_script_versions")
      .update({ intermediate, meta, stage: "finalizing", stage_attempt: 0, worker_lock_until: null })
      .eq("id", row.id);
    return;
  }

  let scriptDocument = attachChapterMetrics({ ...revisedDoc, actualWords: computeActualWords(revisedDoc), estimatedDurationSeconds: computeEstimatedDurationSeconds(revisedDoc) });
  // Selective revision spreads row.script_document first (see
  // runSelectiveRevision), so it already carries the role/subQuestion/
  // thumbnailConcept enrichment stageDraft applied — only a full_rewrite
  // (a genuinely fresh draft call) needs it reapplied here.
  if (isStickman && routing === "full_rewrite") {
    scriptDocument = enrichStickmanDocument(scriptDocument, storyPlan);
  }
  const meta = mergeMeta(row.meta, usage, { revisionKind: routing }, ledgerEntry(`revision_${routing}`, usage.inputTokens, usage.outputTokens, 0, isStickman ? STICKMAN_REVISION_MODEL : OPENAI_MODEL, usage.cacheReadTokens, usage.cacheWriteTokens));
  const intermediate = { ...(row.intermediate ?? {}), revisionWarnings: result.warnings, ...(rolledBackSegmentIds.length ? { revisionRolledBackSegmentIds: rolledBackSegmentIds } : {}) };
  // Phase 1 FINAL — Stickman readiness is judged on the critic's score, but
  // the critic used to score only the PRE-revision draft: a real acceptance
  // run (Ancient Humans) was revised against the critic's exact notes, then
  // finalized still carrying the stale 6/10, so any script that needed a
  // revision could never reach READY. One bounded re-critique of the revised
  // document (stageCritic forces finalizing on its second pass — never a
  // second revision) makes the final score describe the script that ships.
  // The revision may add facts (write-first), so for Stickman the re-critique
  // is preceded by a claim-verify pass: after a selective revision it checks
  // ONLY what the revision introduced (earlier verdicts carry forward); after
  // a full rewrite every claim is new, so it verifies from scratch.
  const recritique = isStickman && (row.intermediate?.criticPasses ?? 1) < 2;
  const nextStage = recritique ? "claim_verify" : "finalizing";
  if (recritique) {
    const revisedSegmentIds = (scriptDocument.narrationSegments ?? [])
      .filter((s: any) => s.text !== (row.script_document.narrationSegments ?? []).find((o: any) => o.id === s.id)?.text)
      .map((s: any) => s.id);
    Object.assign(
      intermediate,
      routing === "full_rewrite" ? { postRevisionVerify: false, claimVerdicts: [] } : { postRevisionVerify: true, revisedSegmentIds },
    );
  }
  await admin
    .from("long_form_script_versions")
    .update({ script_document: scriptDocument, revision_model: isStickman ? STICKMAN_REVISION_MODEL : OPENAI_MODEL, intermediate, meta, stage: nextStage, stage_attempt: 0, worker_lock_until: null })
    .eq("id", row.id);
}

/* ============================ Finalizing — zero-cost re-validation (usually) ============================ */
// Deterministic and free in the common case. The one exception is the
// length quality gate inside stageFinalizing below: if the persisted
// narration is materially under its word budget, it spends its one bounded
// expansion call (tracked separately, like repairCalls — see
// HARD_MIN_LENGTH_RATIO/MAX_LENGTH_EXPANSION_CALLS) before the rest of this
// stage's logic (still zero-cost) decides the final status.

// Unions two independent "this chapter isn't solid" signals: the writer's
// own insufficientEvidenceChapterIds, and any chapter the Critic separately
// flagged with an "insufficient_evidence" issue (real case: the writer
// wrote an honest bridge for a chapter instead of abandoning it, but the
// Critic judged that bridge didn't actually deliver on the chapter's
// promise — see the real Wi-Fi ch5 propagation gap). Used both to decide
// what a targeted repair should target AND what the user-facing
// researchWarnings list shows — a chapter must never disappear from one
// without disappearing from the other.
function unionWeakChapterIds(doc: any, critic: any, insufficientChapterIds: string[]): string[] {
  const segmentChapterById = new Map((doc.narrationSegments ?? []).map((s: any) => [s.id, s.chapterId]));
  const insufficientEvidenceIssues = (critic?.issues ?? []).filter((i: any) => i.type === "insufficient_evidence");
  const chapterIdSet = new Set<string>(insufficientChapterIds);
  for (const issue of insufficientEvidenceIssues) {
    for (const segId of issue.segmentIds ?? []) {
      const chId = segmentChapterById.get(segId);
      if (chId) chapterIdSet.add(chId as string);
    }
  }
  return Array.from(chapterIdSet);
}

function buildRepairChapters(pack: ScriptEvidencePack, doc: any, critic: any, storyPlan: any, insufficientChapterIds: string[]) {
  const segmentChapterById = new Map((doc.narrationSegments ?? []).map((s: any) => [s.id, s.chapterId]));
  const insufficientEvidenceIssues = (critic?.issues ?? []).filter((i: any) => i.type === "insufficient_evidence");
  return unionWeakChapterIds(doc, critic, insufficientChapterIds).map((chapterId) => {
    const planChapter = (storyPlan?.chapters ?? []).find((c: any) => c.id === chapterId);
    const packChapter = pack.chapters.find((c) => c.chapterId === chapterId);
    const criticNotes = insufficientEvidenceIssues.filter((i: any) => (i.segmentIds ?? []).some((id: string) => segmentChapterById.get(id) === chapterId)).map((i: any) => i.description);
    const missingEvidenceDescription = [...(packChapter?.unsupportedAreas ?? []), ...criticNotes].join(" ") || "This chapter's core claim is not supported by the current evidence.";
    return { chapterId, title: planChapter?.title ?? packChapter?.title ?? chapterId, purpose: planChapter?.purpose ?? "", keyQuestions: planChapter?.keyQuestions ?? [], missingEvidenceDescription };
  });
}

// Creates ResearchVersion N+1 (parent_research_version_id = the research
// this script was built from, repair_round = parent + 1) and dispatches
// advance-long-form-research's repair_planning stage on it — NOT a full
// re-research, see that function's own repair pipeline. Returns whether a
// repair was actually started; false means the caller should settle at
// needs_attention instead of needs_research (nothing is actually in flight
// to justify the "we're working on it" status).
async function triggerTargetedRepair(admin: any, row: ScriptRow, project: any, storyPlan: any, pack: ScriptEvidencePack, doc: any, critic: any, insufficientChapterIds: string[], parentRepairRound: number): Promise<boolean> {
  if (RESEARCH_PAUSED || !RESEARCH_ADVANCE_SECRET) return false;
  const repairChapters = buildRepairChapters(pack, doc, critic, storyPlan, insufficientChapterIds);
  if (!repairChapters.length) return false;

  const { count } = await admin.from("long_form_research_versions").select("id", { count: "exact", head: true }).eq("project_id", project.id).eq("story_plan_version_id", row.story_plan_version_id);
  const nextVersion = (count ?? 0) + 1;
  const { data: repairRow, error } = await admin
    .from("long_form_research_versions")
    .insert({
      project_id: project.id,
      story_plan_version_id: row.story_plan_version_id,
      version: nextVersion,
      status: "researching",
      stage: "repair_planning",
      parent_research_version_id: row.research_version_id,
      repair_round: parentRepairRound + 1,
      repair_context: { chapters: repairChapters },
      research_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !repairRow) return false;

  backgroundDispatch(
    fetch(RESEARCH_ADVANCE_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": RESEARCH_ADVANCE_SECRET }, body: JSON.stringify({ researchVersionId: repairRow.id }) })
  );
  return true;
}

async function stageFinalizing(admin: any, row: ScriptRow, project: any, storyPlan: any, isStickman: boolean) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  let doc = row.script_document;
  let meta = row.meta;

  // 2026-09-20 "V1 simplification" pass, SCRIPT SAFETY hard requirement —
  // sanitize BEFORE validating, not after: a leaked internal marker like
  // "(ol_eject)" is a clean parenthetical aside in every real occurrence
  // found (see stripInternalOpenLoopMarkers' own comment) and is safely,
  // deterministically removable — doing this first means the common case
  // never even reaches findMetaLanguage's ol_* pattern below, so a script
  // that only had this one cosmetic leak still reaches "ready" (fixed, not
  // held). Anything that SURVIVES stripping (a bare, non-parenthetical
  // mention) is a genuinely different defect and correctly still trips the
  // same hard meta-language gate every other process-language leak already
  // goes through — never silently shipped either way.
  doc = stripInternalOpenLoopMarkers(doc);
  // Phase 1e — same "sanitize before validating" principle, Stickman-only:
  // defense in depth in case critic/revision reintroduced a TTS-hostile
  // character (findTtsHygieneIssues is HARD).
  if (isStickman) doc = sanitizeStickmanDocumentTtsHygiene(doc);

  // LENGTH QUALITY GATE — actual narration length is authoritative, never
  // inherited from the Story Plan target or a model's own estimatedSeconds
  // guess (see WORDS_PER_MINUTE's comment for the real incident this fixes:
  // a script at 56% of its word budget still displayed as a full 15
  // minutes). A script this far under budget must not silently become
  // "ready" — spend the one bounded expansion call before deciding status.
  const actualWordsBeforeExpansion = computeActualWords(doc);
  const lengthRatio = pack.targetWords > 0 ? actualWordsBeforeExpansion / pack.targetWords : 1;
  const expansionCallsUsed = meta?.expansionCalls ?? 0;
  const expansionTriggerRatio = isStickman ? STICKMAN_LENGTH_EXPANSION_TRIGGER_RATIO : HARD_MIN_LENGTH_RATIO;

  if (lengthRatio < expansionTriggerRatio && expansionCallsUsed < MAX_LENGTH_EXPANSION_CALLS) {
    const targetSegmentIds = selectUnderLengthSegments(doc, pack);
    if (targetSegmentIds.size) {
      const usage = newUsageTotals();
      try {
        let expandedDoc = await runLengthExpansion(doc, pack, targetSegmentIds, usage, isStickman ? STICKMAN_EXPANSION_INSTRUCTIONS : EXPANSION_INSTRUCTIONS);
        if (isStickman) expandedDoc = sanitizeStickmanDocumentTtsHygiene(expandedDoc);
        const expandedResult = validateWithStickmanExtras(expandedDoc, pack, new Set(allUsableFactIds(pack)), isStickman);
        if (!expandedResult.errors.length) {
          doc = attachChapterMetrics({ ...expandedDoc, actualWords: computeActualWords(expandedDoc), estimatedDurationSeconds: computeEstimatedDurationSeconds(expandedDoc) });
          meta = mergeMeta(meta, usage, { expansionCalls: expansionCallsUsed + 1 }, ledgerEntry("length_expansion", usage.inputTokens, usage.outputTokens));
          await admin.from("long_form_script_versions").update({ script_document: doc, meta }).eq("id", row.id);
        } else {
          // Same fallback principle as stageRevision's own fix: an
          // optional improvement that fails deterministic validation must
          // never destroy the last known-valid document. The script stays
          // short, but it stays valid, and one bounded attempt is the
          // contract — never loop.
          meta = mergeMeta(meta, usage, { expansionCalls: expansionCallsUsed + 1, expansionFallbackReason: "expansion_validation_failed" }, ledgerEntry("length_expansion", usage.inputTokens, usage.outputTokens));
          await admin.from("long_form_script_versions").update({ meta }).eq("id", row.id);
        }
      } catch (e) {
        meta = mergeMeta(meta, usage, { expansionCalls: expansionCallsUsed + 1, expansionFallbackReason: "expansion_call_failed" });
        await admin.from("long_form_script_versions").update({ meta }).eq("id", row.id);
      }
    }
  }

  const factIdSet = new Set(allUsableFactIds(pack));
  const result = validateWithStickmanExtras(doc, pack, factIdSet, isStickman);

  const routing = row.intermediate?.criticRouting;
  const insufficientChapterIds: string[] = doc.insufficientEvidenceChapterIds ?? [];

  // Union with critic-flagged chapters too — not just what the writer
  // self-flagged. Real case this fixes: the writer wrote an honest bridge
  // for a chapter (so insufficientEvidenceChapterIds stayed empty) but the
  // Critic judged that bridge didn't actually deliver on the chapter's
  // promise. Without this union, a needs_attention script could show the
  // user an empty "what needs more research" list despite a real, specific,
  // known gap. Computed before the status decision below — the conservative
  // rewrite branch needs exactly this same chapter set to know what to soften.
  const weakChapterIds = unionWeakChapterIds(doc, row.critic_result, insufficientChapterIds);

  // READY CONTRACT: schema/fact-id/meta-language validators must all pass
  // (result.errors), AND the Critic must not have returned needs_research,
  // AND the writer itself must not have flagged any chapter as unwritable —
  // UNLESS a conservative rewrite has already resolved that by softening the
  // specific unsupported claims (see below), in which case `result` is
  // superseded by `finalValidationResult` computed against the rewritten doc.
  // needs_research is a diagnostic/provisional status, never a final one —
  // it becomes needs_research (a targeted repair just started), ready (a
  // conservative rewrite resolved it), or needs_attention (repair budget
  // already used AND the rewrite itself couldn't be attempted/validated).
  let status: "ready" | "needs_research" | "needs_attention" | "failed";
  let finalValidationResult = result;
  let conservativeRewriteApplied = false;
  if (result.errors.length) {
    status = "failed";
  } else if (routing === "needs_research" || insufficientChapterIds.length > 0) {
    const { data: researchVersionRow } = await admin.from("long_form_research_versions").select("repair_round").eq("id", row.research_version_id).maybeSingle();
    const repairRound = researchVersionRow?.repair_round ?? 0;
    // Phase 1d — the legacy per-chapter research-repair round is disabled
    // for Stickman entirely (never even attempted, regardless of repairRound):
    // real incident this fixes — a repair round searching for evidence
    // narrow enough to support one specific under-covered chapter timed out
    // ("Signal timed out." after 3 attempts on "night toolwork repairs"/
    // "night foraging" chapters of a real Ancient-Humans run) and left the
    // script permanently stuck at needs_research with no further automatic
    // action. Stickman's own accuracy mechanism is claim_verify/claim_fix
    // (already run before critic even saw this draft) plus the conservative
    // rewrite below — never this shared legacy path. Legacy (isStickman
    // false) keeps its exact original behavior.
    if (!isStickman && repairRound < MAX_AUTOMATIC_REPAIR_ROUNDS) {
      const triggered = await triggerTargetedRepair(admin, row, project, storyPlan, pack, doc, row.critic_result, insufficientChapterIds, repairRound);
      status = triggered ? "needs_research" : "needs_attention";
    } else if ((meta?.conservativeRewriteCalls ?? 0) < MAX_CONSERVATIVE_REWRITE_CALLS && weakChapterIds.length) {
      // The one automatic research repair round for this Research lineage is
      // already spent (see MAX_AUTOMATIC_REPAIR_ROUNDS's own invariant: never
      // a second one, never routing back to research from here) and a real
      // evidence gap remains. More research already failed to find this —
      // softening the specific unsupported-precision claims is the bounded,
      // deterministic alternative to either blocking the project forever or
      // looping the user back through Improve Research for something no
      // search will ever resolve.
      const targetSegmentIds = selectSegmentsForChapters(doc, weakChapterIds);
      const usage = newUsageTotals();
      try {
        let rewrittenDoc = await runConservativeRewrite(doc, pack, targetSegmentIds, row.critic_result?.issues ?? [], usage);
        if (isStickman) rewrittenDoc = sanitizeStickmanDocumentTtsHygiene(rewrittenDoc);
        const rewrittenResult = validateWithStickmanExtras(rewrittenDoc, pack, factIdSet, isStickman);
        if (!rewrittenResult.errors.length) {
          doc = attachChapterMetrics({ ...rewrittenDoc, actualWords: computeActualWords(rewrittenDoc), estimatedDurationSeconds: computeEstimatedDurationSeconds(rewrittenDoc) });
          finalValidationResult = rewrittenResult;
          conservativeRewriteApplied = true;
          meta = mergeMeta(meta, usage, { conservativeRewriteCalls: (meta?.conservativeRewriteCalls ?? 0) + 1 }, ledgerEntry("conservative_rewrite", usage.inputTokens, usage.outputTokens));
          status = "ready";
        } else {
          // Same fallback principle as expansion's own fix: an optional
          // improvement that fails deterministic validation must never
          // destroy the last known-valid document, and never retries beyond
          // its one bounded attempt.
          meta = mergeMeta(meta, usage, { conservativeRewriteCalls: (meta?.conservativeRewriteCalls ?? 0) + 1, conservativeRewriteFallbackReason: "rewrite_validation_failed" }, ledgerEntry("conservative_rewrite", usage.inputTokens, usage.outputTokens));
          status = "needs_attention";
        }
      } catch (e) {
        meta = mergeMeta(meta, usage, { conservativeRewriteCalls: (meta?.conservativeRewriteCalls ?? 0) + 1, conservativeRewriteFallbackReason: "rewrite_call_failed" });
        status = "needs_attention";
      }
    } else {
      status = "needs_attention";
    }
  } else {
    status = "ready";
  }

  const researchWarnings = conservativeRewriteApplied
    ? [
        ...weakChapterIds.map((id: string) => `Chapter "${pack.chapters.find((c) => c.chapterId === id)?.title ?? id}" had some exact details reframed as reconstruction — the evidence supports the concept, not the precise figures.`),
        ...(pack.overallCoverage !== "strong" ? [`Overall research coverage was assessed as "${pack.overallCoverage}" — some sections use deliberately cautious language.`] : []),
      ]
    : [
        ...weakChapterIds.map((id: string) => `Chapter "${pack.chapters.find((c) => c.chapterId === id)?.title ?? id}" could not be fully written from the available evidence.`),
        ...(pack.overallCoverage !== "strong" ? [`Overall research coverage was assessed as "${pack.overallCoverage}" — some sections use deliberately cautious language.`] : []),
      ];

  // Deterministic backstop, independent of how status was decided above: a
  // chapter with zero narration must never ship as part of a "ready"
  // script (see findEmptyChapters' own comment for the real incident) —
  // downgrade rather than silently present a hollow 0:00 chapter as done.
  const emptyChapters = status === "ready" ? findEmptyChapters(doc) : [];
  if (emptyChapters.length) {
    status = "needs_attention";
  }

  // Phase 1c, Section 3 / Phase 1e readiness rule — same "deterministic
  // backstop, downgrade rather than block" pattern as emptyChapters just
  // above, Stickman-only and additive (legacy's word_budget_off stays a
  // WARNING-only signal, unchanged). Real incident this fixes: the Lions
  // sample finished at 658/1305 words (50%, over 25% short) after the one
  // bounded expansion attempt above had already run and its result failed
  // validation (so the pre-expansion draft was kept, per that block's own
  // fallback) — nothing downstream of that ever stopped the script from
  // reaching a non-blocking status, because validateScriptDocument only
  // ever WARNS on word budget, never hard-errors. Phase 1e tightens the bar
  // from "not more than 25% short" to the spec's actual readiness rule:
  // length within ±10% AND the Viral Editor's overallScore >= STICKMAN_READY_CRITIC_SCORE AND no HARD
  // failures — below any of those, "one more targeted revision" already
  // happened (stageCritic routes below it into selective_revision, which folds
  // the 3 weakest sections into the same pass), so there is nothing left to
  // retry here; this only decides the final honest status.
  const finalLengthRatio = pack.targetWords > 0 ? computeActualWords(doc) / pack.targetWords : 1;
  const lengthOutsideTenPercent = finalLengthRatio < 0.9 || finalLengthRatio > 1.1;
  const criticOverallScore = row.critic_result?.overallScore ?? null;
  const criticScoreTooLow = criticOverallScore != null && criticOverallScore < STICKMAN_READY_CRITIC_SCORE;
  const readinessRuleFailed = isStickman && status === "ready" && (lengthOutsideTenPercent || criticScoreTooLow);
  if (readinessRuleFailed) {
    status = "needs_attention";
  }

  // A critic-confirmed callback overrides the deterministic callback warnings
  // (a paraphrased reference is still a callback).
  const stickmanFinalWarnings = row.critic_result?.callbackConfirmed === true
    ? finalValidationResult.warnings.filter((w: any) => !String(w.code).startsWith("callback_"))
    : finalValidationResult.warnings;
  const qualitySummary = {
    overallVerdict: row.critic_result?.overallVerdict ?? null,
    revisionSkipped: !meta?.revisionKind,
    warningCount: isStickman ? stickmanFinalWarnings.length : finalValidationResult.warnings.length,
    expansionUsed: (meta?.expansionCalls ?? 0) > 0,
    conservativeRewriteApplied,
    ...(isStickman
      ? {
          criticScores: row.critic_result?.scores ?? null,
          criticOverallScore,
          criticScoreHistory: [row.intermediate?.firstCriticResult, row.critic_result].filter(Boolean).map((c: any) => ({ overallScore: c.overallScore ?? null, scores: c.scores ?? null })),
          callbackConfirmedByCritic: row.critic_result?.callbackConfirmed ?? null,
        }
      : {}),
  };

  // Phase 1f — derive display plantQuote/payoffQuote from the verified
  // index+callbackKey now that the document is final, for reporting only.
  if (isStickman) doc = deriveStickmanCallbackQuotes(doc);

  const finalDocument = stripInternalOpenLoopMarkers({
    ...doc,
    researchWarnings: [
      ...researchWarnings,
      ...emptyChapters.map((c) => `Chapter "${c.title}" could not be narrated from the available evidence and needs your review before this script is final.`),
      ...(readinessRuleFailed && lengthOutsideTenPercent
        ? [`This script is ${computeActualWords(doc)} words against a ${pack.targetWords}-word target (${Math.round(finalLengthRatio * 100)}% of budget) — outside the ±10% length target even after an automatic expansion attempt.`]
        : []),
      ...(readinessRuleFailed && criticScoreTooLow
        ? [`The Viral Editor scored this script ${criticOverallScore}/10 overall (needs ${STICKMAN_READY_CRITIC_SCORE}+ to ship) — see checkResults/qualitySummary.criticScores for the per-dimension breakdown and the weakest sections it flagged.`]
        : []),
    ],
    qualitySummary,
    // Phase 1, Section 5 — the full set of Stickman-specific deterministic
    // check results (both the legacy structural/meta-language checks and
    // the Stickman-only narration-craft checks), exposed on the document
    // itself rather than only living in server logs. Absent entirely for
    // the legacy recipe — never attached, never an empty object either.
    ...(isStickman ? { checkResults: { hard: finalValidationResult.errors, warn: stickmanFinalWarnings } } : {}),
  });

  if (status === "failed") {
    const detail = { errors: result.errors, actualWords: computeActualWords(doc) };
    await admin.from("long_form_script_versions").update({ status, script_document: finalDocument, meta, last_error_code: "FINAL_VALIDATION_FAILED", last_error_at: new Date().toISOString(), detail, worker_lock_until: null }).eq("id", row.id);
    if (isStickman) nudgeAutopilot(project.id); // Phase 6a: the autopilot retries or reports it
    return;
  }

  // meta is included here (not just in the mid-function expansion write
  // above) specifically so conservativeRewriteCalls is durably persisted
  // even when no expansion ran this pass — without it, a crash/retry right
  // after this point could re-attempt the "bounded to one" conservative
  // rewrite a second time, since nothing would remember the first attempt.
  await admin.from("long_form_script_versions").update({ status, script_document: finalDocument, meta, worker_lock_until: null }).eq("id", row.id);
  // Promote current_* for every non-failure outcome (ready, needs_research,
  // needs_attention) — same reasoning as Research's own current_research_version_id
  // promotion on both ready and needs_attention: this is the most useful
  // thing to show/compare against, whatever its status.
  await admin.from("long_form_projects").update({ current_script_version_id: row.id, updated_at: new Date().toISOString() }).eq("id", project.id);
  // Phase 6a: the Stickman autopilot marks the run done (and notifies) right away.
  if (isStickman) nudgeAutopilot(project.id);
}

/* ============================ Dispatch + failure handling ============================ */

type ScriptRow = any;

function backgroundDispatch(promise: Promise<unknown>) {
  if (SCRIPT_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[advance-long-form-script] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

async function dispatchNext(id: string) {
  await fetch(SELF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
    body: JSON.stringify({ scriptVersionId: id }),
  });
}

// stage_attempt is NO LONGER incremented here — claim_long_form_script_stage
// (_by_id) now increments it atomically at claim time (see the 20260916120000
// crash-safety migration), so a worker that disappears before this function
// ever runs still leaves a durable, counted attempt. This just reads the
// already-current value; incrementing again here would overcount.
async function handleStageFailure(admin: any, row: ScriptRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
  console.error(`[advance-long-form-script] stage ${row.stage} failed (attempt ${attempt}) for script ${row.id}:`, errorCode);

  if (attempt >= MAX_STAGE_ATTEMPTS) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    // Phase 0, Section B — retries exhausted, this is now a terminal failure.
    await releaseReservationIfActive(admin, row.project_id, "script_stage_attempts_exhausted", logEvent);
    return;
  }

  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_script_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id);
}

/* ============================ Budget gate ============================ */

// Phase 1 FINAL — worst-case cost of each Stickman stage (Claude Sonnet 5
// draft incl. its one bounded repair, critic, revision; gpt-5-mini verify/
// fix/finalizing extras), so the gate refuses a stage that COULD push a run
// past its cap instead of only noticing afterwards. Set the cap per run with
// LONG_FORM_MAX_STICKMAN_SCRIPT_COST_USD.
// Highest observed on Sonnet 5 runs: draft+repair $0.2813, critic $0.0950,
// revision $0.0751, verify (2 batches) $0.0501, fix $0.0064.
const STICKMAN_STAGE_WORST_CASE_USD: Record<string, number> = {
  draft: 0.3,
  claim_verify: 0.06,
  claim_fix: 0.01,
  critic: 0.1,
  revision: 0.08,
  finalizing: 0.02,
};

export function scriptBudgetGate(row: any, maxStickmanCostUsd: number = MAX_STICKMAN_SCRIPT_COST_USD): { code: string } | null {
  // Defense in depth against a bug that would otherwise loop past the
  // documented call cap — checked even though normal control flow can
  // never reach 3 real calls plus more than one bounded repair on its own.
  // Scoped to stages that can actually DISPATCH a model call: "finalizing"
  // is documented (see stageFinalizing below) as zero-cost re-validation —
  // it never calls the model — so a row that legitimately spent all 3
  // calls on draft/critic/revision and is simply waiting to be finalized
  // must never be blocked here. A real incident: exactly this happened —
  // a ScriptVersion with 3 successful calls reached stage="finalizing" and
  // was killed by this same check before stageFinalizing ever ran, even
  // though finalizing was about to make its 0th provider call, not a 4th.
  if (row.stage === "finalizing") return null;
  // Phase 1d — claimVerifyCalls/claimFixCalls are exempted the same way
  // repairCalls/expansionCalls already are: bounded, tracked-separately
  // extras (see stageClaimVerify's own ~8-search cap and stageClaimFix's
  // one-call bound), never counted against the 3 core draft/critic/revision calls.
  const callsSoFar =
    (row.meta?.modelCalls ?? 0) - (row.meta?.repairCalls ?? 0) - (row.meta?.expansionCalls ?? 0) - (row.meta?.claimVerifyCalls ?? 0) - (row.meta?.claimFixCalls ?? 0);
  // A Stickman draft always carries a claims[] array (required by its
  // schema); a legacy document never does — the profile isn't loaded yet here.
  // A row still at "draft" has spent nothing yet, so legacy's limits are safe there.
  const isStickmanRow = Array.isArray(row.script_document?.claims);
  const maxCalls = isStickmanRow ? MAX_STICKMAN_SCRIPT_MODEL_CALLS : MAX_SCRIPT_MODEL_CALLS;
  const spent = row.meta?.estimatedTotalCostUsd ?? 0;
  if (callsSoFar >= maxCalls) return { code: "MODEL_CALL_CAP_EXCEEDED" };
  if (isStickmanRow) {
    const next = STICKMAN_STAGE_WORST_CASE_USD[row.stage] ?? 0;
    if (spent + next > maxStickmanCostUsd) return { code: "COST_CEILING_EXCEEDED" };
  } else if (spent >= MAX_SCRIPT_COST_USD) {
    return { code: "COST_CEILING_EXCEEDED" };
  }
  return null;
}

/* ============================ Stage runner ============================ */

// One stage for one claimed row — the exact dispatch production runs, shared
// with the offline replay harness (tests/replay) so replays exercise the real
// switch, gate and failure handling rather than a copy.
export async function runScriptStage(admin: any, row: any): Promise<{ failed?: boolean; error?: boolean; stage: string }> {
  const gate = scriptBudgetGate(row);
  if (gate) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: gate.code, last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    if (gate.code === "MODEL_CALL_CAP_EXCEEDED") await releaseReservationIfActive(admin, row.project_id, "script_model_call_cap_exceeded", logEvent);
    else await releaseReservationIfActive(admin, row.project_id, "script_cost_ceiling_exceeded", logEvent);
    return { failed: true, stage: row.stage };
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: storyVersion } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", row.story_plan_version_id).maybeSingle();
  const { data: researchVersion } = await admin.from("long_form_research_versions").select("fact_graph, coverage").eq("id", row.research_version_id).maybeSingle();

  if (!project || !storyVersion || !researchVersion) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "PROJECT_PLAN_OR_RESEARCH_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    await releaseReservationIfActive(admin, row.project_id, "script_project_plan_or_research_missing", logEvent);
    return { failed: true, stage: row.stage };
  }
  const storyPlan = storyVersion.story_plan;

  // Phase 1 "Stickman Script Mode" — the active generation profile always
  // exists by this point (create-long-form-production-setup creates it
  // before a project can ever reach Script). Fetched once per invocation
  // and threaded through every stage rather than re-queried per stage.
  const profile = await fetchActiveGenerationProfile(admin, row.project_id);
  const isStickman = isStickmanProfile(profile);
  const niche = nicheFromProfile(profile);

  // Phase 1 close-out — paid-call checkpoint (Stickman). Real incident: a
  // Sonnet 5 draft outlived the platform's request limit, the invocation was
  // killed with nothing recorded, the lease expired, and the recovery sweep
  // re-ran the draft — a second paid call no ledger ever saw. Now each stage
  // records {stage, claimAttempt} before it runs; a completed stage rewrites
  // intermediate without it (every stage spreads its claim-time snapshot), a
  // thrown stage clears it below. A marker still present for the previous
  // claim of this same stage means that invocation died mid-call: log it and
  // fail the row — never re-run it silently and pay twice.
  if (isStickman) {
    const inFlight = row.intermediate?.inFlightCall;
    if (inFlight && inFlight.stage === row.stage && inFlight.claimAttempt === (row.stage_attempt ?? 0) - 1) {
      await logEvent("advance-long-form-script", "error", "script_stage_call_interrupted", { scriptVersionId: row.id, projectId: row.project_id, stage: row.stage, startedAt: inFlight.startedAt, message: "A paid stage call was interrupted mid-flight; the row is failed instead of silently re-running it." });
      await admin
        .from("long_form_script_versions")
        .update({ status: "failed", last_error_code: "STAGE_CALL_INTERRUPTED", last_error_at: new Date().toISOString(), worker_lock_until: null, intermediate: { ...(row.intermediate ?? {}), inFlightCall: null, interruptedCall: inFlight } })
        .eq("id", row.id);
      await releaseReservationIfActive(admin, row.project_id, "script_stage_call_interrupted", logEvent);
      return { failed: true, stage: row.stage };
    }
    // The lease must outlive the longest stage (draft timeout 180s) and the
    // platform's background wall clock (~400s), so the sweep can never
    // reclaim a row whose invocation is still alive.
    await admin
      .from("long_form_script_versions")
      .update({
        intermediate: { ...(row.intermediate ?? {}), inFlightCall: { stage: row.stage, claimAttempt: row.stage_attempt ?? 0, startedAt: new Date().toISOString() } },
        worker_lock_until: new Date(Date.now() + STICKMAN_STAGE_LEASE_MS).toISOString(),
      })
      .eq("id", row.id);
  }

  try {
    switch (row.stage) {
      case "draft":
        await stageDraft(admin, row, project, storyPlan, researchVersion, isStickman, niche);
        break;
      case "claim_verify":
        await stageClaimVerify(admin, row);
        break;
      case "claim_fix":
        await stageClaimFix(admin, row);
        break;
      case "critic":
        await stageCritic(admin, row, project, storyPlan, isStickman);
        break;
      case "revision":
        await stageRevision(admin, row, project, storyPlan, isStickman, niche);
        break;
      case "finalizing":
        await stageFinalizing(admin, row, project, storyPlan, isStickman);
        break;
      default:
        throw new Error(`Unknown stage: ${row.stage}`);
    }
    return { stage: row.stage };
  } catch (error) {
    // A thrown stage finished (with an error), so it isn't "interrupted".
    if (isStickman) await admin.from("long_form_script_versions").update({ intermediate: row.intermediate ?? {} }).eq("id", row.id);
    await handleStageFailure(admin, row, error);
    return { error: true, stage: row.stage };
  }
}

/* ============================ Cassette recording ============================ */

// Env-gated (LONG_FORM_SCRIPT_RECORD_CASSETTES=true), off in production: every
// provider exchange of a stage invocation is saved to the private
// "script-cassettes" bucket as <scriptVersionId>/<ts>-<stage>.json, so a paid
// run can be diagnosed and replayed offline afterwards instead of re-paid.
const RECORD_CASSETTES = (Deno.env.get("LONG_FORM_SCRIPT_RECORD_CASSETTES") ?? "").trim().toLowerCase() === "true";
const cassetteRecorder = RECORD_CASSETTES
  ? installCassetteRecorder([(() => {
      try {
        return new URL(SUPABASE_URL).host;
      } catch {
        return "";
      }
    })()])
  : null;

// Only internal test projects are ever recorded (owner on the test domain
// every harness creates); anything captured for a real user is discarded.
async function isTestProject(admin: any, projectId: string): Promise<boolean> {
  const { data: project } = await admin.from("long_form_projects").select("user_id").eq("id", projectId).maybeSingle();
  if (!project?.user_id) return false;
  const { data } = await admin.auth.admin.getUserById(project.user_id);
  return String(data?.user?.email ?? "").toLowerCase().endsWith("@zyvo-internal.test");
}

async function saveCassette(admin: any, row: any) {
  if (!cassetteRecorder) return;
  const entries = cassetteRecorder.drain();
  if (!entries.length) return;
  if (!(await isTestProject(admin, row.project_id))) return;
  const path = `${row.id}/${Date.now()}-${row.stage}.json`;
  const payload = JSON.stringify({ scriptVersionId: row.id, projectId: row.project_id, stage: row.stage, recordedAt: new Date().toISOString(), entries });
  const { error } = await admin.storage.from("script-cassettes").upload(path, new Blob([payload], { type: "application/json" }), { contentType: "application/json", upsert: false });
  if (error) console.warn("[advance-long-form-script] cassette upload failed:", error.message);
}

/* ============================ Handler ============================ */

async function handleRequest(req: Request) {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  if (!ADVANCE_SECRET || secret !== ADVANCE_SECRET) return json({ error: "Unauthorized" }, 401);

  if (SCRIPT_PAUSED) return json({ paused: true, claimed: false });
  if (!OPENAI_KEY) return json({ error: "Script Engine is not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const targetId = body?.scriptVersionId ? String(body.scriptVersionId) : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: claimedRows } = targetId
    ? await admin.rpc("claim_long_form_script_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_script_stage", { p_limit: 1 });

  const row = claimedRows?.[0];
  if (!row) return json({ claimed: false });

  // Phase 1 close-out — the stage runs in the background and the request is
  // answered immediately: a Sonnet 5 draft takes ~110-160s, and a request
  // held open that long hits the platform's 150s limit and is killed.
  const work = (async () => {
    cassetteRecorder?.setStage(row.stage);
    const result = await runScriptStage(admin, row);
    await saveCassette(admin, row);
    if (!result.failed && !result.error && row.stage !== "finalizing") await dispatchNext(row.id);
  })().catch((e) => console.error("[advance-long-form-script] background stage failed", e));
  const rt = (globalThis as any).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(work);
  else await work;
  return json({ claimed: true, id: row.id, stage: row.stage, accepted: true }, 202);
}

// Offline replay tests import this module for runScriptStage/scriptBudgetGate
// and must not bind a port.
if ((Deno.env.get("SCRIPT_ENGINE_OFFLINE_TEST") ?? "") !== "true") Deno.serve(handleRequest);
