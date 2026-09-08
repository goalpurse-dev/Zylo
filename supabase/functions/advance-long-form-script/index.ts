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

const DRAFT_TIMEOUT_MS = 120_000; // one full-script structured generation, single attempt (see callStructured)
const CRITIC_TIMEOUT_MS = 60_000;
const REVISION_TIMEOUT_MS = 90_000; // covers both the common selective-patch path and the exceptional full-rewrite path
const MAX_STAGE_ATTEMPTS = 3;

// The hard cap this milestone was built around: Draft + Critic + (selective
// Revision OR one full rewrite) = 3 normal calls, never a critic/revision
// loop. Bounded malformed-output repair is tracked completely separately
// (repairCalls in meta) so it can never silently inflate this number.
const MAX_SCRIPT_MODEL_CALLS = 3;
const MAX_REPAIR_CALLS = 1;

// Real per-run cost stayed under $0.05 in live testing (see final report) —
// this ceiling is a generous emergency circuit breaker against a bug or a
// retry storm, not a pricing assumption. Not used to charge users.
const MAX_SCRIPT_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_SCRIPT_COST_USD") ?? 0.3);

const GPT5_MINI_INPUT_PER_M = 0.25;
const GPT5_MINI_OUTPUT_PER_M = 2.0;

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

type UsageTotals = { inputTokens: number; outputTokens: number; reasoningTokens: number; modelCalls: number };
function newUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, modelCalls: 0 };
}
function trackUsage(totals: UsageTotals, payload: any) {
  const usage = payload?.usage;
  if (usage) {
    totals.inputTokens += usage.input_tokens ?? 0;
    totals.outputTokens += usage.output_tokens ?? 0;
    totals.reasoningTokens += usage.output_tokens_details?.reasoning_tokens ?? 0;
    totals.modelCalls += 1;
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

function ledgerEntry(stage: string, inputTokens: number, outputTokens: number) {
  return { stage, inputTokens, outputTokens, estimatedCostUsd: Number(((inputTokens * GPT5_MINI_INPUT_PER_M + outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4)) };
}

function mergeMeta(existing: any, usage: UsageTotals, extra?: Record<string, any>, newLedgerEntry?: any) {
  const meta = { ...(existing ?? {}) };
  meta.model = OPENAI_MODEL;
  meta.modelCalls = (meta.modelCalls ?? 0) + usage.modelCalls;
  meta.inputTokens = (meta.inputTokens ?? 0) + usage.inputTokens;
  meta.outputTokens = (meta.outputTokens ?? 0) + usage.outputTokens;
  meta.reasoningTokens = (meta.reasoningTokens ?? 0) + usage.reasoningTokens;
  meta.estimatedModelCostUsd = Number(((meta.inputTokens * GPT5_MINI_INPUT_PER_M + meta.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));
  meta.estimatedTotalCostUsd = meta.estimatedModelCostUsd; // no search cost in Script, ever — kept as its own field for shape parity with Research's meta and future-proofing
  meta.callLedger = [...(meta.callLedger ?? []), ...(newLedgerEntry ? [newLedgerEntry] : [])];
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
function computeEstimatedDurationSeconds(doc: any): number {
  return Math.round((doc.narrationSegments ?? []).reduce((sum: number, s: any) => sum + (Number(s.estimatedSeconds) || 0), 0));
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
      if (!validFactIds.has(factId)) errors.push({ code: "unknown_fact_id", message: `Segment ${s.id} cites unknown factId ${factId}.`, segmentIds: [s.id] });
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

Segment your narration into coherent spoken thoughts (roughly one paragraph's worth of a single idea, not one sentence and not a whole chapter) — these become stable IDs used later for visuals, voice, timeline, and editing, so segment boundaries should fall at genuinely natural spoken pauses.`;

function buildSegmentSchema(chapterIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "chapterId", "sequenceIndex", "text", "factIds", "narrativeFunction", "openLoopIds", "payoffIds", "estimatedSeconds"],
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
    },
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

async function stageDraft(admin: any, row: ScriptRow, project: any, storyPlan: any, researchVersion: any) {
  const pack = buildEvidencePack(project, storyPlan, project.narrative_strategy, researchVersion.fact_graph, researchVersion.coverage);
  const usage = newUsageTotals();
  let draft = await runDraft(pack, project.narrative_strategy, storyPlan, usage);
  let repairCalls = row.meta?.repairCalls ?? 0;

  const factIdSet = new Set(allUsableFactIds(pack));
  let result = validateScriptDocument(draft, pack, factIdSet);

  // Bounded, tracked-separately repair: strict json_schema already prevents
  // shape violations, so this only ever fires for semantic invariants a
  // schema can't express (duplicate ids, ordering, chapter/segment
  // mismatch). One attempt, then fail honestly rather than loop.
  if (result.errors.length && repairCalls < MAX_REPAIR_CALLS) {
    repairCalls += 1;
    draft = await runDraft(pack, project.narrative_strategy, storyPlan, usage, result.errors);
    result = validateScriptDocument(draft, pack, factIdSet);
  }

  if (result.errors.length) {
    const meta = mergeMeta(row.meta, usage, { repairCalls }, ledgerEntry("draft", usage.inputTokens, usage.outputTokens));
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "DRAFT_VALIDATION_FAILED", last_error_at: new Date().toISOString(), meta, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const scriptDocument = { ...draft, actualWords: computeActualWords(draft), estimatedDurationSeconds: computeEstimatedDurationSeconds(draft) };
  const meta = mergeMeta(row.meta, usage, { repairCalls }, ledgerEntry("draft", usage.inputTokens, usage.outputTokens));
  const intermediate = { ...(row.intermediate ?? {}), evidencePack: pack, draftWarnings: result.warnings };
  await admin
    .from("long_form_script_versions")
    .update({ script_document: scriptDocument, generation_model: OPENAI_MODEL, intermediate, meta, stage: "critic", stage_attempt: 0, worker_lock_until: null })
    .eq("id", row.id);
}

/* ============================ Pass B — one combined Critic ============================ */

const CRITIC_INSTRUCTIONS = `You are Zyvo's Script Critic. You diagnose a finished narration draft across several independent lenses in ONE pass — you never rewrite prose yourself (a tiny illustrative snippet is fine, a rewritten segment is not; that's a separate step). You receive the script, the compact evidence pack it was written from, and deterministic warnings already found by code (repeated phrases, formulaic openers, generic phrases, word-budget deviation) — treat those as leads to confirm or dismiss, not as an exhaustive list.

Evaluate across these lenses and report every real issue you find as one entry in "issues":
- HOOK: does the opening earn attention quickly, without throat-clearing?
- INFORMATION: is useful information delivered continuously? Is anything repeated or padded?
- CURIOSITY: does each major section create genuine forward momentum? Are curiosity gaps specific, not fake suspense?
- PACING: does any section drag, or run overlong for what it delivers? Are chapters badly proportioned relative to their importance?
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
              enum: ["hook_weak", "padding", "repetition", "pacing_drag", "unnatural_phrasing", "formulaic_transition", "unresolved_open_loop", "missing_payoff", "factual_overreach", "uncertainty_lost", "insufficient_evidence", "production_language", "structural"],
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
  return [
    `SCRIPT:`,
    JSON.stringify({ title: ctx.scriptDocument.title, narrationSegments: ctx.scriptDocument.narrationSegments, chapters: ctx.scriptDocument.chapters, openLoops: ctx.scriptDocument.openLoops }, null, 2),
    ``,
    `EVIDENCE PACK IT WAS WRITTEN FROM:`,
    JSON.stringify(ctx.pack, null, 2),
    ``,
    `DETERMINISTIC WARNINGS ALREADY FOUND BY CODE (confirm, dismiss, or expand on these — don't just restate them):`,
    JSON.stringify(ctx.draftWarnings, null, 2),
  ].join("\n");
}

function hasMeaningfulIssues(critic: any): boolean {
  return (critic.issues ?? []).some((i: any) => i.severity === "medium" || i.severity === "high");
}

async function stageCritic(admin: any, row: ScriptRow, _project: any, _storyPlan: any) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const doc = row.script_document;
  const usage = newUsageTotals();
  const segmentIds = (doc.narrationSegments ?? []).map((s: any) => s.id);

  const critic = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: CRITIC_INSTRUCTIONS,
      input: criticInput({ scriptDocument: doc, pack, draftWarnings: row.intermediate?.draftWarnings ?? [] }),
      text: { format: { type: "json_schema", name: "script_critic", strict: true, schema: buildCriticSchema(segmentIds) } },
    },
    CRITIC_TIMEOUT_MS,
    usage
  );

  const meta = mergeMeta(row.meta, usage, undefined, ledgerEntry("critic", usage.inputTokens, usage.outputTokens));

  let routing: "skip" | "selective_revision" | "full_rewrite" | "needs_research";
  if (critic.overallVerdict === "needs_research") routing = "needs_research";
  else if (critic.overallVerdict === "structurally_broken") routing = "full_rewrite";
  else if (critic.overallVerdict === "strong" && !hasMeaningfulIssues(critic)) routing = "skip";
  else routing = "selective_revision";

  const intermediate = { ...(row.intermediate ?? {}), criticRouting: routing };
  const nextStage = routing === "skip" || routing === "needs_research" ? "finalizing" : "revision";
  await admin.from("long_form_script_versions").update({ critic_result: critic, critic_model: OPENAI_MODEL, intermediate, meta, stage: nextStage, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

/* ============================ Pass C — selective Revision (or, exceptionally, one full rewrite) ============================ */

const REVISION_INSTRUCTIONS = `You are Zyvo's Script Revision Director. You are given a small set of narration segments that a Critic flagged, the specific issues raised about each, the neighboring segments for continuity (not to be rewritten), and the evidence available to the affected chapters. Rewrite ONLY the flagged segments so they resolve the critic's issues.

Rules:
- You may only reference factIds provided in this context. Never invent a new factId, and never invent a claim that isn't supported by one of the provided facts.
- Preserve continuity with the neighboring segments you were shown — do not contradict them or repeat what they already established.
- Address the specific issue(s) raised for each segment; don't rewrite for the sake of rewriting.
- Every segment you were asked to replace must appear exactly once in your output, identified by its original id.
- Follow the same narration craft rules as the original draft: natural spoken language, no formulaic transitions, preserve uncertainty/dispute language exactly, no padding.`;

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

function revisionInput(ctx: { targetSegments: any[]; neighborSegments: any[]; issues: any[]; pack: ScriptEvidencePack; affectedChapterIds: string[] }) {
  const relevantPack = { ...ctx.pack, chapters: ctx.pack.chapters.filter((c) => ctx.affectedChapterIds.includes(c.chapterId)) };
  return [
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
  ].join("\n");
}

// Selective by default: only the flagged segments plus same-chapter
// neighbors go to the model, never the whole script. Keeps revision cheap
// and — just as importantly — keeps every untouched segment byte-identical,
// so a good section can never be accidentally degraded by an unrelated fix.
async function runSelectiveRevision(doc: any, pack: ScriptEvidencePack, critic: any, usage: UsageTotals) {
  const flaggedIds = new Set<string>((critic.issues ?? []).filter((i: any) => i.severity === "medium" || i.severity === "high").flatMap((i: any) => i.segmentIds ?? []));
  const segments = doc.narrationSegments ?? [];
  const segmentById = new Map(segments.map((s: any) => [s.id, s]));
  const targetSegments = Array.from(flaggedIds).map((id) => segmentById.get(id)).filter(Boolean);
  const affectedChapterIds = Array.from(new Set(targetSegments.map((s: any) => s.chapterId)));
  const neighborSegments = segments.filter((s: any) => affectedChapterIds.includes(s.chapterId) && !flaggedIds.has(s.id));
  const relevantIssues = (critic.issues ?? []).filter((i: any) => (i.segmentIds ?? []).some((id: string) => flaggedIds.has(id)));
  const factIds = allUsableFactIds(pack);

  const result = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: REVISION_INSTRUCTIONS,
      input: revisionInput({ targetSegments, neighborSegments, issues: relevantIssues, pack, affectedChapterIds }),
      text: { format: { type: "json_schema", name: "script_revision", strict: true, schema: buildRevisionSchema(Array.from(flaggedIds), factIds) } },
    },
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
  return { ...doc, narrationSegments: patchedSegments };
}

// Exceptional path — only reached when the Critic itself declared the
// script structurally_broken. Re-runs the full Draft pass, but with the
// Critic's own findings folded in as repair-style context so it doesn't
// reproduce the same structural mistake.
async function runFullRewrite(pack: ScriptEvidencePack, narrativeStrategy: any, storyPlan: any, critic: any, usage: UsageTotals) {
  const notes: ValidationIssue[] = (critic.issues ?? []).map((i: any) => ({ code: `critic_${i.type}`, message: `${i.description} — ${i.recommendedAction}`, segmentIds: i.segmentIds }));
  return await runDraft(pack, narrativeStrategy, storyPlan, usage, notes);
}

async function stageRevision(admin: any, row: ScriptRow, project: any, storyPlan: any) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const routing = row.intermediate.criticRouting as "selective_revision" | "full_rewrite";
  const usage = newUsageTotals();

  const revisedDoc =
    routing === "full_rewrite"
      ? await runFullRewrite(pack, project.narrative_strategy, storyPlan, row.critic_result, usage)
      : await runSelectiveRevision(row.script_document, pack, row.critic_result, usage);

  const factIdSet = new Set(allUsableFactIds(pack));
  const result = validateScriptDocument(revisedDoc, pack, factIdSet);
  if (result.errors.length) {
    const meta = mergeMeta(row.meta, usage, undefined, ledgerEntry(`revision_${routing}`, usage.inputTokens, usage.outputTokens));
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "REVISION_VALIDATION_FAILED", last_error_at: new Date().toISOString(), meta, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const scriptDocument = { ...revisedDoc, actualWords: computeActualWords(revisedDoc), estimatedDurationSeconds: computeEstimatedDurationSeconds(revisedDoc) };
  const meta = mergeMeta(row.meta, usage, { revisionKind: routing }, ledgerEntry(`revision_${routing}`, usage.inputTokens, usage.outputTokens));
  const intermediate = { ...(row.intermediate ?? {}), revisionWarnings: result.warnings };
  await admin
    .from("long_form_script_versions")
    .update({ script_document: scriptDocument, revision_model: OPENAI_MODEL, intermediate, meta, stage: "finalizing", stage_attempt: 0, worker_lock_until: null })
    .eq("id", row.id);
}

/* ============================ Finalizing — zero-cost re-validation ============================ */

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

async function stageFinalizing(admin: any, row: ScriptRow, project: any, storyPlan: any) {
  const pack: ScriptEvidencePack = row.intermediate.evidencePack;
  const doc = row.script_document;
  const factIdSet = new Set(allUsableFactIds(pack));
  const result = validateScriptDocument(doc, pack, factIdSet);

  const routing = row.intermediate?.criticRouting;
  const insufficientChapterIds: string[] = doc.insufficientEvidenceChapterIds ?? [];

  // READY CONTRACT: schema/fact-id/meta-language validators must all pass
  // (result.errors), AND the Critic must not have returned needs_research,
  // AND the writer itself must not have flagged any chapter as unwritable.
  // needs_research is a diagnostic/provisional status, never a final one —
  // it either becomes needs_research (a targeted repair just started) or
  // needs_attention (repair budget already used, or couldn't be started).
  let status: "ready" | "needs_research" | "needs_attention" | "failed";
  if (result.errors.length) {
    status = "failed";
  } else if (routing === "needs_research" || insufficientChapterIds.length > 0) {
    const { data: researchVersionRow } = await admin.from("long_form_research_versions").select("repair_round").eq("id", row.research_version_id).maybeSingle();
    const repairRound = researchVersionRow?.repair_round ?? 0;
    if (repairRound < MAX_AUTOMATIC_REPAIR_ROUNDS) {
      const triggered = await triggerTargetedRepair(admin, row, project, storyPlan, pack, doc, row.critic_result, insufficientChapterIds, repairRound);
      status = triggered ? "needs_research" : "needs_attention";
    } else {
      status = "needs_attention";
    }
  } else {
    status = "ready";
  }

  // Union with critic-flagged chapters too — not just what the writer
  // self-flagged. Real case this fixes: the writer wrote an honest bridge
  // for a chapter (so insufficientEvidenceChapterIds stayed empty) but the
  // Critic judged that bridge didn't actually deliver on the chapter's
  // promise. Without this union, a needs_attention script could show the
  // user an empty "what needs more research" list despite a real, specific,
  // known gap.
  const weakChapterIds = unionWeakChapterIds(doc, row.critic_result, insufficientChapterIds);
  const researchWarnings = [
    ...weakChapterIds.map((id: string) => `Chapter "${pack.chapters.find((c) => c.chapterId === id)?.title ?? id}" could not be fully written from the available evidence.`),
    ...(pack.overallCoverage !== "strong" ? [`Overall research coverage was assessed as "${pack.overallCoverage}" — some sections use deliberately cautious language.`] : []),
  ];

  const qualitySummary = {
    overallVerdict: row.critic_result?.overallVerdict ?? null,
    revisionSkipped: !row.meta?.revisionKind,
    warningCount: result.warnings.length,
  };

  const finalDocument = { ...doc, researchWarnings, qualitySummary };

  if (status === "failed") {
    await admin.from("long_form_script_versions").update({ status, script_document: finalDocument, last_error_code: "FINAL_VALIDATION_FAILED", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return;
  }

  await admin.from("long_form_script_versions").update({ status, script_document: finalDocument, worker_lock_until: null }).eq("id", row.id);
  // Promote current_* for every non-failure outcome (ready, needs_research,
  // needs_attention) — same reasoning as Research's own current_research_version_id
  // promotion on both ready and needs_attention: this is the most useful
  // thing to show/compare against, whatever its status.
  await admin.from("long_form_projects").update({ current_script_version_id: row.id, updated_at: new Date().toISOString() }).eq("id", project.id);
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
    return;
  }

  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_script_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id);
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
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

  // Defense in depth against a bug that would otherwise loop past the
  // documented call cap — checked even though normal control flow can
  // never reach 3 real calls plus more than one bounded repair on its own.
  const callsSoFar = (row.meta?.modelCalls ?? 0) - (row.meta?.repairCalls ?? 0);
  if (callsSoFar >= MAX_SCRIPT_MODEL_CALLS) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "MODEL_CALL_CAP_EXCEEDED", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }
  if ((row.meta?.estimatedTotalCostUsd ?? 0) >= MAX_SCRIPT_COST_USD) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "COST_CEILING_EXCEEDED", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: storyVersion } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", row.story_plan_version_id).maybeSingle();
  const { data: researchVersion } = await admin.from("long_form_research_versions").select("fact_graph, coverage").eq("id", row.research_version_id).maybeSingle();

  if (!project || !storyVersion || !researchVersion) {
    await admin.from("long_form_script_versions").update({ status: "failed", last_error_code: "PROJECT_PLAN_OR_RESEARCH_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }
  const storyPlan = storyVersion.story_plan;

  try {
    switch (row.stage) {
      case "draft":
        await stageDraft(admin, row, project, storyPlan, researchVersion);
        break;
      case "critic":
        await stageCritic(admin, row, project, storyPlan);
        break;
      case "revision":
        await stageRevision(admin, row, project, storyPlan);
        break;
      case "finalizing":
        await stageFinalizing(admin, row, project, storyPlan);
        break;
      default:
        throw new Error(`Unknown stage: ${row.stage}`);
    }

    if (row.stage !== "finalizing") backgroundDispatch(dispatchNext(row.id));
    return json({ claimed: true, id: row.id, stage: row.stage });
  } catch (error) {
    await handleStageFailure(admin, row, error);
    return json({ claimed: true, id: row.id, stage: row.stage, error: true });
  }
});
