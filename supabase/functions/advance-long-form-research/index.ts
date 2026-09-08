// deno-lint-ignore-file no-explicit-any
// advance-long-form-research/index.ts
//
// The durable async worker behind Research. Replaces the old single
// synchronous request (generate-long-form-research) that had to run the
// entire Planner → Search → Extractor → Critic → optional Gap Search →
// final Extractor pipeline inside one HTTP response — confirmed (twice,
// identically) to hit Supabase's flat 150s "Request idle timeout" on every
// plan tier, independent of wall-clock allowance. No amount of internal
// timeout tuning fixes a gateway-level limit, so the pipeline itself is now
// split into durable STAGES, one per invocation:
//
//   planning → initial_search → initial_extraction → coverage_review
//   → (gap_search → final_extraction, only if the critic found real gaps)
//   → finalizing → status: ready | needs_attention | failed
//
// Every stage: does its OpenAI work, PERSISTS the result, THEN advances —
// in that order — so a crashed/killed worker never re-runs a stage that
// already succeeded and never double-spends on it. long_form_research_versions
// IS the durable workflow state (stage, stage_attempt, worker_lock_until,
// intermediate); there's no separate job-queue entity, since forcing this
// into the unrelated `jobs` table (built for image/video provider jobs)
// would be an unnatural fit for a multi-stage LLM pipeline.
//
// Dispatch: after a stage succeeds, this function fires a fire-and-forget
// self-invocation (EdgeRuntime.waitUntil) for the SAME research version so
// the next stage starts immediately — no cron round-trip needed for the
// common case. A cron sweep (see the 20260910120000 migration) is the
// safety net for anything whose self-chain call didn't land (crashed
// process, transient network failure) — it just calls this same function
// with no specific id, and claim_long_form_research_stage() picks up
// whatever's actually due.
//
// IMPORTANT: every prompt, schema, and quality rule below is copied
// UNCHANGED from the old synchronous generate-long-form-research — this is
// an orchestration change, not an intelligence change.
//
// Auth: NOT a user-facing function (verify_jwt=false) — invoked only by
// start-long-form-research's dispatch, this function's own self-chain, or
// the cron trigger, all of which present the shared x-cron-secret header.
// A normal user can never reach this directly.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-research`;

// Emergency kill switch — checked before anything else in the handler
// (before claiming a row, before touching the DB at all, before any OpenAI
// call). Does not claim, does not touch worker_lock_until/stage_attempt, does
// not mutate any Research Version — a paused tick is a true no-op so nothing
// about existing progress is disturbed while paused.
const RESEARCH_PAUSED = (Deno.env.get("LONG_FORM_RESEARCH_PAUSED") ?? "").trim().toLowerCase() === "true";

const PLAN_TIMEOUT_MS = 75_000; // observed real: ~47s
const SEARCH_TIMEOUT_MS = 60_000; // single query per request now (see below) — a single web_search round is comfortably faster than the old multi-query batches
const EXTRACT_TIMEOUT_MS = 140_000; // now single-attempt (see callStructured) — pushed to the safe practical ceiling under the 150s gateway wall (leaves ~10s for DB round-trips); some topics' extraction genuinely needs more than 130s under real content volume
const CRITIC_TIMEOUT_MS = 60_000;

const MAX_SEARCH_TASKS = 6; // how many tasks the Research Planner itself may propose — flattened + capped by INITIAL_QUERY_BUDGET below, not used as a search count directly anymore
const MAX_QUERIES_PER_TASK = 3;
const MAX_GAP_TASKS = 4;
const MAX_STAGE_ATTEMPTS = 3;

// ---- Search architecture (rewritten after a real incident) ----------------
// The retrieval unit used to be "1 Responses request = up to 3 queries,
// model decides how many times to search." A controlled test proved
// max_tool_calls isn't a trustworthy hard ceiling even at the REQUEST level
// (sent 3, OpenAI performed 4) — so the fix is architectural, not a bigger
// number: ONE planned query now equals ONE retrieval Responses request,
// period. The planner's tasks (1-3 candidate queries each) are flattened
// into a single bounded queue and executed one query per call, each capped
// at max_tool_calls:1 as an additional (not sole) provider-side restraint.
const INITIAL_QUERY_BUDGET = Number(Deno.env.get("LONG_FORM_INITIAL_QUERY_BUDGET") ?? 8);
const GAP_QUERY_BUDGET = Number(Deno.env.get("LONG_FORM_GAP_QUERY_BUDGET") ?? 4);
const ABSOLUTE_SEARCH_REQUEST_BUDGET = INITIAL_QUERY_BUDGET + GAP_QUERY_BUDGET; // 12 by default
const SEARCH_CONCURRENCY = 3; // small batch, not all-at-once — speed + cost control + bounded provider latency amplification

// Our own orchestration is authoritative, not max_tool_calls (proven
// unreliable). This is the real ceiling: if OpenAI occasionally performs 2
// tool calls per single-query request despite max_tool_calls:1, we observe
// it here and stop issuing further searches well before hundreds could
// accumulate. 20 = 12 intended requests + generous room for occasional
// provider overrun, never anywhere near the previous incident's scale.
const MAX_ACTUAL_WEB_SEARCH_TOOL_CALLS_PER_RESEARCH = Number(Deno.env.get("LONG_FORM_MAX_SEARCH_CALLS_PER_RESEARCH") ?? 20);
const MAX_ESTIMATED_COST_PER_RESEARCH_USD = Number(Deno.env.get("LONG_FORM_MAX_COST_PER_RESEARCH_USD") ?? 0.5);
// Platform-wide guard, independent of any single Research Version — the
// backstop against a bug that spins up many versions, not just one runaway
// version. Uses actualWebSearchToolCalls (real billed calls), never request
// count. 1,000/day covers ~80 fully-researched videos at the new ~12-search
// budget, generous against today's near-zero production volume while still
// catching a true runaway well before it becomes a large overnight bill.
const MAX_PLATFORM_WEB_SEARCH_CALLS_PER_DAY = Number(Deno.env.get("LONG_FORM_MAX_PLATFORM_SEARCHES_PER_DAY") ?? 1000);

// ---- Targeted Research Repair budgets (deliberately much smaller than a
// full research pass) — a repair exists specifically so 1-2 weak chapters
// never cost anywhere near the ~$0.36 a full research run costs. These are
// separate constants, never reused from the full-research budget above, and
// are passed explicitly into searchBudgetExhausted/runQueueBatch only for
// repair_search — every other call site keeps using the full-research
// ceilings unchanged.
const MAX_TARGETED_QUERIES = Number(Deno.env.get("LONG_FORM_MAX_TARGETED_QUERIES") ?? 4); // roughly 1-2 per weak chapter
const MAX_TARGETED_WEB_SEARCH_TOOL_CALLS = Number(Deno.env.get("LONG_FORM_MAX_TARGETED_SEARCH_CALLS") ?? 8); // still generous over max_tool_calls:1 x 4 queries, same "provider can exceed the hint" defense as full research
const MAX_TARGETED_RESEARCH_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_TARGETED_RESEARCH_COST_USD") ?? 0.2);
const LONG_FORM_SCRIPT_ADVANCE_SECRET = Deno.env.get("LONG_FORM_SCRIPT_ADVANCE_SECRET") ?? "";
const SCRIPT_ADVANCE_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-script`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ============================ OpenAI plumbing (unchanged) ============================ */

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

function extractCitations(payload: any): { url: string; title: string }[] {
  const out: { url: string; title: string }[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      for (const annotation of content?.annotations ?? []) {
        if (annotation?.type === "url_citation" && annotation?.url) {
          out.push({ url: annotation.url, title: annotation.title || annotation.url });
        }
      }
    }
  }
  return out;
}

// The actual number of times the model invoked the web_search tool within
// ONE Responses request — this is NOT the same number as "we made one
// web-search-enabled request." A single request can contain several
// "web_search_call" output items (one per underlying search the model
// chose to run), and OpenAI bills per actual tool call, not per request.
// This was the root cause of a real incident: telemetry counted requests
// (webSearchRequests below) and used that for cost estimation, silently
// undercounting real spend by whatever multiple the model actually searched.
function extractActualToolCalls(payload: any): number {
  let count = 0;
  for (const item of payload?.output ?? []) {
    if (item?.type === "web_search_call") count += 1;
  }
  return count;
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

// webSearchRequests: how many Responses API calls we made with web_search
// enabled. actualWebSearchToolCalls: how many times the model actually
// invoked the tool across those calls — the number OpenAI actually bills
// against and the one meant for cost calculation. These are deliberately
// two separate fields, never conflated (see extractActualToolCalls above).
type UsageTotals = { inputTokens: number; outputTokens: number; reasoningTokens: number; modelCalls: number; webSearchRequests: number; actualWebSearchToolCalls: number };
function newUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, modelCalls: 0, webSearchRequests: 0, actualWebSearchToolCalls: 0 };
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

// Single attempt only — deliberately different from the old synchronous
// version's immediate in-call "repair" retry. That pattern doubled a call's
// worst-case latency (initial attempt + a full second attempt on failure),
// which is exactly what pushed a single STAGE past the 150s gateway idle
// timeout in real testing (a ~90s extraction timeout followed immediately
// by another ~90s repair attempt = ~180s in one invocation, recreating the
// original problem one level down). The orchestration layer already has a
// proper retry mechanism — handleStageFailure's attempt/backoff/reclaim —
// so a malformed or slow response now just fails this attempt and lets that
// mechanism retry via a fresh, independent invocation instead of stacking a
// second attempt inside the same one.
async function callStructured(baseRequest: any, timeoutMs: number, usageTotals: UsageTotals) {
  const payload = await callOpenAI(baseRequest, timeoutMs);
  trackUsage(usageTotals, payload);
  return parseJson(extractOutputText(payload));
}

function normalizeUrl(rawUrl: string) {
  try {
    const u = new URL(rawUrl);
    u.hash = "";
    const dropParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "fbclid", "gclid"];
    for (const p of dropParams) u.searchParams.delete(p);
    let path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path}${u.search}`;
  } catch {
    return rawUrl.toLowerCase();
  }
}

function shortSourceId() {
  return `src_${Math.random().toString(36).slice(2, 10)}`;
}

/* ============================ Prompts / schemas (unchanged from the sync version) ============================ */

const NARRATIVE_PRIMITIVES = [
  "mechanism", "process", "mystery", "lived_experience", "survival", "chronology", "rise_and_fall", "cause_effect",
  "misconception", "hypothetical", "comparison", "biography", "engineering_breakdown", "scientific_explanation",
  "economic_explanation", "investigation", "reconstruction", "day_in_the_life", "problem_solution",
];

const RESEARCH_MODE_GUIDE = `Research strategy must adapt to what the topic actually is — do not run the same playbook for every video. A mechanism/engineering topic wants standards bodies, official documentation, and technical references. A historical topic wants scholarship, museums, universities, and primary material, while catching common myths. A business/economic topic wants company history, financial data where available, contemporary reporting, and credible retrospectives, distinguishing established chronology from disputed popular narratives. A scientific/medical topic wants peer-reviewed research and reputable institutions, with real attention to individual variation and uncertainty instead of dramatic anecdotes. A hypothetical/"what if" topic needs its evidence split into an established baseline, high-confidence derived consequences, model-dependent consequences, and speculation — never presented as equally certain. These are illustrations of the KIND of judgment to apply, not a fixed list of topic categories — reason about what THIS topic actually needs.`;

const RESEARCH_PLANNER_INSTRUCTIONS = `You are Zyvo's Research Planner for long-form 2D explainer videos. You receive a completed Story Plan (with its TopicModel and NarrativeStrategy) and must decide what evidence is actually needed before a script can be written — you do not search or write anything yourself yet.

${RESEARCH_MODE_GUIDE}

For every research question you define: state its purpose (why the script needs this answered), which chapters it feeds, how important it is, what kind of source would actually be authoritative for it, and whether an important/surprising/disputed claim like this deserves more than one independent source.

Then translate your research questions into a bounded search strategy: group related questions into a small number of focused search tasks (each task is one real research effort covering 1-3 closely related questions), and give each task 1-3 concrete search queries a search engine could actually run — specific enough to find authoritative sources, not vague topic restatements.

Identify claims likely to be disputed or mythologized (common misconceptions repeated as fact), and note where primary/authoritative sources specifically matter versus where reputable secondary scholarship is sufficient — primary sources are not automatically better; they can carry bias or outdated understanding, so recommend pairing them with modern interpretation where that matters.

Be honest about time-sensitivity: if facts could meaningfully change or need to reflect the current moment, say so.`;

function researchPlannerInput(ctx: { topic: string; topicModel: any; narrativeStrategy: any; storyPlan: any; resolvedLengthMinutes: number; resolvedExplanationDepth: string }) {
  return [
    `TOPIC: ${ctx.topic}`,
    `RESOLVED LENGTH: ${ctx.resolvedLengthMinutes} minutes, DEPTH: ${ctx.resolvedExplanationDepth}`,
    ``,
    `TOPIC MODEL:`,
    JSON.stringify(ctx.topicModel, null, 2),
    ``,
    `NARRATIVE STRATEGY:`,
    JSON.stringify(ctx.narrativeStrategy, null, 2),
    ``,
    `STORY PLAN (chapters, working research questions, risk flags already flagged during planning):`,
    JSON.stringify(
      {
        recommendedTitle: ctx.storyPlan.recommendedTitle,
        viewerPromise: ctx.storyPlan.viewerPromise,
        narrativeLabel: ctx.storyPlan.narrativeLabel,
        chapters: ctx.storyPlan.chapters,
        researchQuestions: ctx.storyPlan.researchQuestions,
        researchRiskFlags: ctx.storyPlan.researchRiskFlags,
      },
      null,
      2
    ),
  ].join("\n");
}

const SOURCE_TYPES = [
  "official_documentation", "government", "academic", "standards_org", "peer_reviewed", "museum",
  "reference_institution", "professional_org", "technical_documentation", "journalism", "specialist_publication",
  "book_reference", "community", "other",
];

const RESEARCH_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["researchMode", "timeSensitivity", "factualityRisk", "researchQuestions", "likelyDisputes", "requiredPrimarySources", "searchStrategy"],
  properties: {
    researchMode: { type: "string", description: "Short, human-readable description of the research approach for this specific topic." },
    timeSensitivity: { type: "string", enum: ["low", "medium", "high"] },
    factualityRisk: { type: "string", enum: ["low", "medium", "high"] },
    researchQuestions: {
      type: "array",
      minItems: 4,
      maxItems: 16,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "question", "purpose", "chapterIds", "importance", "preferredSourceTypes", "requiresMultipleSources"],
        properties: {
          id: { type: "string" },
          question: { type: "string" },
          purpose: { type: "string" },
          chapterIds: { type: "array", items: { type: "string" }, maxItems: 6 },
          importance: { type: "string", enum: ["critical", "important", "nice_to_have"] },
          preferredSourceTypes: { type: "array", items: { type: "string", enum: SOURCE_TYPES }, maxItems: 4 },
          requiresMultipleSources: { type: "boolean" },
        },
      },
    },
    likelyDisputes: { type: "array", items: { type: "string" }, maxItems: 8 },
    requiredPrimarySources: { type: "array", items: { type: "string" }, maxItems: 8 },
    searchStrategy: {
      type: "array",
      minItems: 3,
      maxItems: MAX_SEARCH_TASKS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "focus", "queries", "targetQuestionIds"],
        properties: {
          id: { type: "string" },
          focus: { type: "string", description: "Short label for what this search task is trying to establish." },
          queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: MAX_QUERIES_PER_TASK },
          targetQuestionIds: { type: "array", items: { type: "string" }, maxItems: 4 },
        },
      },
    },
  },
};

const RETRIEVAL_INSTRUCTIONS = `You are a fact-finding researcher for a YouTube explainer video. You will be given a research focus and ONE specific search query — search for real, authoritative sources and report back concise, well-cited findings for that single query. Prioritize official documentation, standards bodies, government/academic institutions, peer-reviewed research, museums, and reputable specialist journalism over generic blogs, SEO content, forums, or unsourced listicles. Do not present a single blog's claim as settled fact. If sources disagree, say so explicitly. If something is commonly believed but likely a myth, flag that. Write your findings as clear prose with inline citations to the specific sources you used — do not fabricate a source that isn't one you actually found.`;

function retrievalInput(entry: { focus: string; query: string; targetQuestionIds: string[] }, questionLookup: Record<string, string>) {
  const questions = (entry.targetQuestionIds ?? []).map((id) => questionLookup[id]).filter(Boolean);
  return [
    `RESEARCH FOCUS: ${entry.focus}`,
    questions.length ? `QUESTIONS THIS MUST ANSWER:\n${questions.map((q) => `- ${q}`).join("\n")}` : "",
    `SEARCH QUERY TO RUN: ${entry.query}`,
    `Find real, current, authoritative sources and report concrete findings with citations.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ONE query = ONE Responses request now (the actual fix for the incident —
// see the architecture note above the budget constants). max_tool_calls:1
// is still set as an additional provider-side restraint, but per the
// controlled test on 2026-09-07 (sent 3, OpenAI performed 4), it is
// explicitly NOT trusted as a guaranteed hard limit — our own orchestration
// (the queue budget + MAX_ACTUAL_WEB_SEARCH_TOOL_CALLS_PER_RESEARCH check
// after every single response) is what's actually authoritative.
async function runRetrieval(entry: { id: string; focus: string; query: string; targetQuestionIds: string[] }, questionLookup: Record<string, string>, usageTotals: UsageTotals) {
  try {
    const payload = await callOpenAI(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: RETRIEVAL_INSTRUCTIONS,
        input: retrievalInput(entry, questionLookup),
        tools: [{ type: "web_search", search_context_size: "medium" }],
        max_tool_calls: 1,
      },
      SEARCH_TIMEOUT_MS
    );
    trackUsage(usageTotals, payload, true);
    return {
      id: entry.id,
      focus: entry.focus,
      text: extractOutputText(payload).trim(),
      citations: extractCitations(payload),
      actualToolCalls: extractActualToolCalls(payload),
      inputTokens: payload?.usage?.input_tokens ?? 0,
      outputTokens: payload?.usage?.output_tokens ?? 0,
      failed: false,
    };
  } catch (error) {
    console.warn(`[advance-long-form-research] query ${entry.id} failed:`, String(error));
    return { id: entry.id, focus: entry.focus, text: "", citations: [], actualToolCalls: 0, inputTokens: 0, outputTokens: 0, failed: true };
  }
}

const EXTRACTOR_INSTRUCTIONS = `You are Zyvo's Source & Fact Extractor for a long-form explainer video's Research stage. You receive raw research findings (already gathered by web search, with real candidate sources) plus the Story Plan they must support. Turn this into a clean evidence base.

SOURCES: you may only use the exact candidate source ids you were given — never invent a new id or a new URL. Keep a candidate only if it is actually credible enough to support a factual claim; drop ones that are clearly low-quality, irrelevant, or duplicate. Assign each kept source a realistic sourceType and qualityTier:
TIER A: official documentation, government/standards bodies, primary documents, peer-reviewed research, universities/academic institutions.
TIER B: museums, respected reference institutions, professional organizations, established technical documentation, strong secondary scholarship.
TIER C: major reputable journalism, respected specialist publications, credible books/reference works.
LOWER: generic SEO blogs, anonymous sites, unsourced listicles, content farms, AI-generated pages, forums — do not let LOWER-tier material stand as the sole support for an important claim; only keep it at all if it adds real, checkable value (e.g. an eyewitness/community account where lived experience is actually the subject).

FACTS: create Fact objects for the meaningful, useful factual units a script would need — core mechanisms, important numbers, causal claims, historical events, unusual/surprising facts, chapter-defining information, and anything a skeptical viewer might question. Do NOT create a fact for every sentence; an 8-15 minute video needs perhaps 25-60 well-chosen facts, not hundreds of trivial ones. Do not create a Fact for a storytelling example/illustration that isn't itself a claim about reality — that belongs to the future script, not the evidence base.

CLASSIFICATION (use exactly these values): SUPPORTED_FACT (clearly established, well-sourced), SUPPORTED_INTERPRETATION (a reasonable scholarly/expert reading of evidence, not a raw fact), REASONABLE_INFERENCE (follows logically from established facts but isn't itself directly documented), DISPUTED (credible sources actively disagree), UNCERTAIN (genuinely unclear or under-evidenced), HYPOTHETICAL_ASSUMPTION (a modeling assumption or speculative consequence, common for "what if" topics).

For hypothetical/"what if" topics specifically: classify an established starting fact as SUPPORTED_FACT, a consequence that directly follows from physics/established science as REASONABLE_INFERENCE, a consequence that depends on modeling assumptions as UNCERTAIN, and genuine speculation as HYPOTHETICAL_ASSUMPTION — never let speculation read as equally certain as a measured fact.

CONFIDENCE must reflect source quality, corroboration, agreement across sources, and specificity — not how confidently you can phrase a sentence. A single LOWER-tier source, even paraphrased assertively, should never produce "high" confidence. Prefer multiple independent sources for disputed claims, scientific/medical claims, surprising statistics, causal business/economic claims, and sensitive historical interpretations — but do not demand two sources for trivial statements.

DISPUTES: if sources disagree, create a fact with disputed:true and a plain-language disputeSummary describing the disagreement — never silently pick a side and hide the conflict.

Every fact needs chapterIds (which chapters it supports) and, where applicable, researchQuestionIds (which research question it answers). Set scriptUsable:false only for a fact too uncertain or too tangential to responsibly use in the video at all.`;

function extractorInput(ctx: { storyPlan: any; researchPlan: any; findings: { focus: string; text: string }[]; candidateSources: { id: string; url: string; title: string }[]; existingFacts?: any[] }) {
  const lines = [
    `STORY PLAN CHAPTERS:`,
    JSON.stringify(ctx.storyPlan.chapters.map((c: any) => ({ id: c.id, title: c.title, summary: c.summary, keyQuestions: c.keyQuestions })), null, 2),
    ``,
    `RESEARCH QUESTIONS:`,
    // A targeted repair row has no research_plan at all (it never runs
    // stagePlanning — see the repair pipeline) — null is expected there,
    // not a bug, so this must degrade gracefully rather than crash.
    JSON.stringify(ctx.researchPlan?.researchQuestions ?? [], null, 2),
    ``,
    `CANDIDATE SOURCES (use ONLY these ids, drop any you don't actually use):`,
    JSON.stringify(ctx.candidateSources, null, 2),
    ``,
    `RESEARCH FINDINGS:`,
    ctx.findings.map((f) => `--- ${f.focus} ---\n${f.text || "(no usable findings for this task)"}`).join("\n\n"),
  ];
  if (ctx.existingFacts?.length) {
    lines.push(``, `EXISTING FACTS FROM AN EARLIER PASS (extend/refine, do not needlessly discard):`, JSON.stringify(ctx.existingFacts, null, 2));
  }
  return lines.join("\n");
}

function buildExtractorSchema(candidateIds: string[]) {
  const idEnum = candidateIds.length ? candidateIds : ["__none__"];
  return {
    type: "object",
    additionalProperties: false,
    required: ["sources", "facts"],
    properties: {
      sources: {
        type: "array",
        maxItems: candidateIds.length || 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "sourceType", "qualityTier", "relevance", "credibilityNotes", "chaptersSupported"],
          properties: {
            id: { type: "string", enum: idEnum },
            sourceType: { type: "string", enum: SOURCE_TYPES },
            qualityTier: { type: "string", enum: ["A", "B", "C", "LOWER"] },
            relevance: { type: "string" },
            credibilityNotes: { type: "string" },
            chaptersSupported: { type: "array", items: { type: "string" }, maxItems: 8 },
          },
        },
      },
      facts: {
        type: "array",
        maxItems: 70,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "claim", "classification", "confidence", "sourceIds", "chapterIds", "researchQuestionIds", "disputed", "disputeSummary", "uncertaintyNotes", "temporalScope", "geographicScope", "scriptUsable"],
          properties: {
            id: { type: "string" },
            claim: { type: "string" },
            classification: { type: "string", enum: ["SUPPORTED_FACT", "SUPPORTED_INTERPRETATION", "REASONABLE_INFERENCE", "DISPUTED", "UNCERTAIN", "HYPOTHETICAL_ASSUMPTION"] },
            confidence: { type: "string", enum: ["low", "medium", "high"] },
            sourceIds: { type: "array", items: { type: "string", enum: idEnum }, maxItems: 5 },
            chapterIds: { type: "array", items: { type: "string" }, maxItems: 6 },
            researchQuestionIds: { type: "array", items: { type: "string" }, maxItems: 4 },
            disputed: { type: "boolean" },
            disputeSummary: { type: ["string", "null"] },
            uncertaintyNotes: { type: ["string", "null"] },
            temporalScope: { type: ["string", "null"] },
            geographicScope: { type: ["string", "null"] },
            scriptUsable: { type: "boolean" },
          },
        },
      },
    },
  };
}

const CRITIC_INSTRUCTIONS = `You are Zyvo's Research Coverage Critic. You receive a Story Plan and the FactGraph built for it, and must honestly grade whether the research actually supports the script that needs to be written — not just whether facts exist in general.

For each chapter, judge coverage as "strong" (its key questions are well-answered with credible, ideally corroborated facts), "moderate" (partially answered or resting on thinner sourcing), or "weak" (key questions remain unanswered or only weakly supported). List research questions that remain genuinely unanswered. Flag important claims resting on only one, or only low-tier, sources. Flag evidence that looks outdated or barely relevant to what the chapter actually needs.

If real gaps exist, propose a SMALL, targeted set of follow-up search tasks (same shape as a search strategy) aimed only at the specific gaps — do not re-research things already well covered. If coverage is already strong throughout, return an empty gap list rather than manufacturing busywork.

Give an honest overallCoverage: "strong" only if the video could genuinely be scripted responsibly right now, "moderate" if usable but thin in places, "weak" if major chapters lack real support.`;

function criticInput(ctx: { storyPlan: any; researchPlan: any; facts: any[]; sources: any[] }) {
  return [
    `STORY PLAN CHAPTERS:`,
    JSON.stringify(ctx.storyPlan.chapters.map((c: any) => ({ id: c.id, title: c.title, keyQuestions: c.keyQuestions })), null, 2),
    ``,
    `RESEARCH QUESTIONS:`,
    // Same null-safety as extractorInput above — a repair row never ran
    // stagePlanning, so research_plan is legitimately null here.
    JSON.stringify((ctx.researchPlan?.researchQuestions ?? []).map((q: any) => ({ id: q.id, question: q.question, importance: q.importance })), null, 2),
    ``,
    `SOURCES (id, tier, type):`,
    JSON.stringify(ctx.sources.map((s: any) => ({ id: s.id, qualityTier: s.qualityTier, sourceType: s.sourceType })), null, 2),
    ``,
    `FACTS:`,
    JSON.stringify(ctx.facts.map((f: any) => ({ id: f.id, claim: f.claim, classification: f.classification, confidence: f.confidence, sourceIds: f.sourceIds, chapterIds: f.chapterIds, disputed: f.disputed })), null, 2),
  ].join("\n");
}

const CRITIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chapterCoverage", "unansweredQuestionIds", "weaklySupportedClaims", "conflicts", "staleOrIrrelevantNotes", "gapQueries", "overallCoverage"],
  properties: {
    chapterCoverage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["chapterId", "status", "note"],
        properties: { chapterId: { type: "string" }, status: { type: "string", enum: ["strong", "moderate", "weak"] }, note: { type: "string" } },
      },
    },
    unansweredQuestionIds: { type: "array", items: { type: "string" }, maxItems: 12 },
    weaklySupportedClaims: { type: "array", items: { type: "string" }, maxItems: 10 },
    conflicts: { type: "array", items: { type: "string" }, maxItems: 10 },
    staleOrIrrelevantNotes: { type: "array", items: { type: "string" }, maxItems: 8 },
    gapQueries: {
      type: "array",
      maxItems: MAX_GAP_TASKS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "focus", "queries", "targetChapterIds"],
        properties: { id: { type: "string" }, focus: { type: "string" }, queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 }, targetChapterIds: { type: "array", items: { type: "string" }, maxItems: 4 } },
      },
    },
    overallCoverage: { type: "string", enum: ["strong", "moderate", "weak"] },
  },
};

/* ============================ Meta (cost + timing telemetry) ============================ */

const GPT5_MINI_INPUT_PER_M = 0.25;
const GPT5_MINI_OUTPUT_PER_M = 2.0;
const WEB_SEARCH_PER_CALL = 0.01;

// Compact per-stage provider-call ledger appended to meta.callLedger — no
// huge response bodies, no sensitive data, just enough to answer "why did
// this cost $X" without guessing: one entry per OpenAI request this stage
// made, with its real actual-tool-call count and token/cost breakdown.
function ledgerEntries(
  stage: string,
  requestType: "plan" | "web_search" | "extract" | "critic",
  calls: { queryId?: string; actualToolCalls?: number; inputTokens: number; outputTokens: number }[]
) {
  return calls.map((c) => ({
    stage,
    ...(c.queryId ? { queryId: c.queryId } : {}),
    requestType,
    actualToolCalls: c.actualToolCalls ?? 0,
    inputTokens: c.inputTokens,
    outputTokens: c.outputTokens,
    estimatedCostUsd: Number(((c.inputTokens * GPT5_MINI_INPUT_PER_M + c.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000 + (c.actualToolCalls ?? 0) * WEB_SEARCH_PER_CALL).toFixed(4)),
  }));
}

function mergeMeta(existing: any, usage: UsageTotals, timingKey: string | null, timingMs: number | null, extra?: Record<string, any>, newLedgerEntries?: any[]) {
  const meta = { ...(existing ?? {}) };
  meta.model = OPENAI_MODEL;
  meta.modelCalls = (meta.modelCalls ?? 0) + usage.modelCalls;
  meta.webSearchRequests = (meta.webSearchRequests ?? 0) + usage.webSearchRequests;
  meta.actualWebSearchToolCalls = (meta.actualWebSearchToolCalls ?? 0) + usage.actualWebSearchToolCalls;
  meta.inputTokens = (meta.inputTokens ?? 0) + usage.inputTokens;
  meta.outputTokens = (meta.outputTokens ?? 0) + usage.outputTokens;
  meta.reasoningTokens = (meta.reasoningTokens ?? 0) + usage.reasoningTokens;
  // Cost is calculated from actualWebSearchToolCalls (what OpenAI actually
  // bills), never webSearchRequests (how many calls WE made) — conflating
  // these two was the root cause of a real cost-telemetry undercount.
  const modelCost = (meta.inputTokens * GPT5_MINI_INPUT_PER_M + meta.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000;
  const searchCost = meta.actualWebSearchToolCalls * WEB_SEARCH_PER_CALL;
  meta.estimatedModelCostUsd = Number(modelCost.toFixed(4));
  meta.estimatedSearchCostUsd = Number(searchCost.toFixed(4));
  meta.estimatedTotalCostUsd = Number((modelCost + searchCost).toFixed(4));
  meta.timings = { ...(meta.timings ?? {}) };
  if (timingKey && timingMs != null) meta.timings[timingKey] = timingMs;
  if (extra) Object.assign(meta, extra);
  if (newLedgerEntries?.length) meta.callLedger = [...(meta.callLedger ?? []), ...newLedgerEntries];
  return meta;
}

/* ============================ Spend guards ============================ */

// Platform-wide circuit breaker, independent of any single Research
// Version — catches a bug that spins up many versions, not just one
// runaway one. Scans meta.actualWebSearchToolCalls across recent versions
// rather than requiring a dedicated counter table, since Research volume is
// near-zero today; revisit if that scan ever gets expensive.
async function platformSearchCallsLast24h(admin: any): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin.from("long_form_research_versions").select("meta").gte("created_at", since);
  return (data ?? []).reduce((sum: number, r: any) => sum + (r.meta?.actualWebSearchToolCalls ?? 0), 0);
}

// Checked before EVERY batch of the search queue (not just once per stage)
// — "before issuing another retrieval request, estimate whether it can fit
// inside remaining budget conservatively." If either the per-Research
// ceiling or the platform-wide daily guard is already at/over its limit,
// stop issuing further searches immediately — whatever already succeeded
// remains usable, and the needs_attention heuristic honestly reflects thin
// coverage rather than the pipeline silently spending past its ceiling.
// maxCalls/maxCost default to the full-research ceilings so every existing
// call site (initial_search, gap_search) behaves identically to before —
// only repair_search passes the smaller targeted ceilings explicitly.
async function searchBudgetExhausted(admin: any, meta: any, maxCalls = MAX_ACTUAL_WEB_SEARCH_TOOL_CALLS_PER_RESEARCH, maxCost = MAX_ESTIMATED_COST_PER_RESEARCH_USD): Promise<boolean> {
  const usedCalls = meta?.actualWebSearchToolCalls ?? 0;
  const usedCost = meta?.estimatedTotalCostUsd ?? 0;
  if (usedCalls >= maxCalls || usedCost >= maxCost) return true;
  const platformUsed = await platformSearchCallsLast24h(admin);
  return platformUsed >= MAX_PLATFORM_WEB_SEARCH_CALLS_PER_DAY;
}

/* ============================ Stage handlers ============================ */

type ResearchRow = any;
type QueueEntry = {
  id: string;
  focus: string;
  query: string;
  targetQuestionIds: string[];
  status: "pending" | "succeeded" | "failed";
  attempts: number;
  actualToolCalls: number;
  citations: { url: string; title: string }[];
  text: string;
};

// Flattens Planner tasks (or Critic gap tasks) — each carrying 1-3
// candidate queries — into a bounded, individually-addressable queue. This
// is the actual fix for the incident: the retrieval unit is now ONE query
// per request, never "up to 3 queries, model decides how many searches."
function flattenToQueue(tasks: any[], budget: number, phase: string): QueueEntry[] {
  const entries: QueueEntry[] = [];
  let i = 0;
  for (const task of tasks) {
    for (const query of task.queries ?? []) {
      if (entries.length >= budget) return entries;
      entries.push({
        id: `${phase}_${task.id}_${i++}`,
        focus: task.focus,
        query,
        targetQuestionIds: task.targetQuestionIds ?? [],
        status: "pending",
        attempts: 0,
        actualToolCalls: 0,
        citations: [],
        text: "",
      });
    }
  }
  return entries;
}

// Runs ONE small concurrent batch of whatever's still "pending" in the
// queue, checkpointing immediately after — the caller persists the
// returned queue+meta before doing anything else, so a worker that dies
// right after this call resumes at the next pending entry, never repeating
// one that already succeeded or failed (and never double-billing it).
// Processes only ONE batch per call (not the whole queue) — 8 initial
// queries / 3 concurrency is 3 rounds at up to ~60s each, comfortably
// exceeding a single invocation's safe budget if done all at once, so the
// existing self-chain dispatch (unchanged, already fires after any
// successful stage function) naturally continues the next round.
async function runQueueBatch(
  admin: any,
  row: ResearchRow,
  queue: QueueEntry[],
  questionLookup: Record<string, string>,
  stageName: "initial_search" | "gap_search" | "repair_search",
  timingKey: string,
  budgetOverrides?: { maxCalls: number; maxCost: number }
) {
  const pending = queue.filter((e) => e.status === "pending");
  if (pending.length === 0) return { queue, meta: row.meta, done: true };

  if (await searchBudgetExhausted(admin, row.meta, budgetOverrides?.maxCalls, budgetOverrides?.maxCost)) {
    const exhausted = queue.map((e) => (e.status === "pending" ? { ...e, status: "failed" as const } : e));
    return { queue: exhausted, meta: { ...(row.meta ?? {}), searchBudgetExhausted: true }, done: true };
  }

  const t0 = Date.now();
  const batch = pending.slice(0, SEARCH_CONCURRENCY);
  const usage = newUsageTotals();
  const results = await Promise.all(batch.map((entry) => runRetrieval(entry, questionLookup, usage)));

  const resultById = new Map(results.map((r) => [r.id, r]));
  const updatedQueue = queue.map((e) => {
    const r = resultById.get(e.id);
    if (!r) return e;
    return { ...e, status: (r.failed ? "failed" : "succeeded") as QueueEntry["status"], attempts: e.attempts + 1, actualToolCalls: r.actualToolCalls, citations: r.citations, text: r.text };
  });

  const ledger = ledgerEntries(
    stageName,
    "web_search",
    results.map((r) => ({ queryId: r.id, actualToolCalls: r.actualToolCalls, inputTokens: r.inputTokens, outputTokens: r.outputTokens }))
  );
  // Timing accumulates across batches (this stage spans multiple
  // invocations now) rather than overwriting — mergeMeta's own timingKey
  // param does a plain overwrite, appropriate for single-call stages, so
  // the running total is added manually here instead.
  const meta = mergeMeta(row.meta, usage, null, null, undefined, ledger);
  meta.timings = { ...(meta.timings ?? {}), [timingKey]: (row.meta?.timings?.[timingKey] ?? 0) + (Date.now() - t0) };
  const done = !updatedQueue.some((e) => e.status === "pending");
  return { queue: updatedQueue, meta, done };
}

async function stagePlanning(admin: any, row: ResearchRow, project: any, storyPlan: any) {
  const usage = newUsageTotals();
  const t0 = Date.now();
  const researchPlan = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: RESEARCH_PLANNER_INSTRUCTIONS,
      input: researchPlannerInput({
        topic: project.topic,
        topicModel: project.topic_model,
        narrativeStrategy: project.narrative_strategy,
        storyPlan,
        resolvedLengthMinutes: project.resolved_length_minutes,
        resolvedExplanationDepth: project.resolved_explanation_depth,
      }),
      text: { format: { type: "json_schema", name: "research_plan", strict: true, schema: RESEARCH_PLAN_SCHEMA } },
    },
    PLAN_TIMEOUT_MS,
    usage
  );

  const ledger = ledgerEntries("planning", "plan", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, "planningMs", Date.now() - t0, undefined, ledger);
  await admin.from("long_form_research_versions").update({ research_plan: researchPlan, meta, stage: "initial_search", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

// Resumable across multiple invocations — see runQueueBatch. Builds the
// queue once (first invocation for this stage: row.intermediate.searchQueue
// doesn't exist yet), then each call processes one small concurrent batch
// of whatever's still "pending", persists immediately, and either advances
// (queue exhausted) or leaves the stage as-is so the existing self-chain
// dispatch naturally continues with the next batch. stage_attempt is
// reserved for genuine failure retries, never touched for this kind of
// normal multi-invocation progress.
async function stageInitialSearch(admin: any, row: ResearchRow, _project: any, _storyPlan: any) {
  const researchPlan = row.research_plan;
  const questionLookup: Record<string, string> = {};
  for (const q of researchPlan.researchQuestions) questionLookup[q.id] = q.question;

  const queue: QueueEntry[] = row.intermediate?.searchQueue ?? flattenToQueue(researchPlan.searchStrategy, INITIAL_QUERY_BUDGET, "initial");
  const { queue: updatedQueue, meta: batchMeta, done } = await runQueueBatch(admin, row, queue, questionLookup, "initial_search", "initialSearchMs");

  if (!done) {
    // Mid-queue checkpoint only — same stage, next self-chained invocation
    // picks up the remaining pending entries.
    const intermediate = { ...(row.intermediate ?? {}), searchQueue: updatedQueue };
    // stage_attempt: 0 — real forward progress was just made and persisted,
    // so the claim-time attempt counter (see the crash-safety migration)
    // resets here. Otherwise a healthy multi-round stage (several batches/
    // queue rounds, each its own claim) would exhaust MAX_STAGE_ATTEMPTS
    // from normal successful progress alone, with zero actual failures.
    await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const succeeded = updatedQueue.filter((e) => e.status === "succeeded");
  if (succeeded.length === 0 && updatedQueue.length > 0) {
    throw new Error("All initial research queries failed");
  }

  // Citations travel WITH each finding now (not deduped into one global
  // candidate list here) — extraction batching derives its own per-batch
  // candidate sources from whichever findings landed in that batch. Any
  // cross-batch or cross-phase URL duplication still collapses correctly at
  // final persistence (upsert on normalized_url).
  //
  // Clear searchQueue once consumed into retrievalFindings — otherwise the
  // later gap_search stage's `row.intermediate?.searchQueue ?? flattenToQueue(...)`
  // would find this (fully-resolved, initial-phase) queue still present and
  // wrongly treat gap search as already done instead of building its own.
  const intermediate = {
    ...(row.intermediate ?? {}),
    searchQueue: undefined,
    retrievalFindings: succeeded.map((e) => ({ focus: e.focus, text: e.text, citations: e.citations })),
  };
  batchMeta.initialSearchCalls = updatedQueue.length;
  batchMeta.initialFailedCalls = updatedQueue.length - succeeded.length;
  await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage: "initial_extraction", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

/* ============================ Extraction batching + merge ============================ */
// Added after a real incident: a single extraction call over ALL findings
// at once measured up to ~140s for content-heavy topics (Medieval London,
// 72-Hours-Without-Sleep), right at the edge of the platform's per-
// invocation ceiling. Splitting into bounded batches — each comfortably
// small — plus a dedicated merge pass keeps every individual call well
// inside limits WITHOUT reducing how much evidence gets extracted.
//
// A fixed ITEM COUNT alone turned out not to be a safe proxy for latency:
// the 2026-09-08 Viking incident's real payload (inspected directly from
// the failed row's persisted intermediate state) showed individual
// retrieval findings of ~9,000-11,200 characters each (dense museum-
// catalogue/archaeological-report content) — a "3 findings per batch" cap
// produced one batch of ~29,900 combined characters that took ~139.65s
// (meta.timings.extractionMs on that row), right at the 140s wall, and the
// NEXT batch (~31,300 chars) then timed out on all 3 stage attempts,
// failing the whole Research Version without ever reaching the merge step.
//
// A SECOND incident (same day, same row, after the size-aware fix above was
// already deployed and had already proven itself — two other ~9-11K-char
// batches succeeded at 63.3s and 113.7s) showed that similar character count
// does NOT guarantee similar completion time: a ~11,002-char batch was
// claimed multiple times and simply disappeared each time — no timeout was
// ever caught, stage_attempt never moved, nothing was ever logged as
// failed. The worker was killed at the platform level before this file's
// own AbortSignal/catch could run at all. No amount of in-process error
// handling can defend against that — the fix is a durable, atomic CLAIM
// record persisted BEFORE the risky provider call even begins (see
// claimBatchForExtraction below and the 20260916120000 migration for the
// identical fix at the row/stage level), plus a lower size target with real
// margin, since we now know a "successful at this size" data point doesn't
// bound the worst case.
const MAX_FINDINGS_PER_EXTRACTION_BATCH = 2; // hard ceiling regardless of size
const MAX_EXTRACTION_BATCH_CHARS = 6_000; // halved again after the second incident above — a ~9,301-char batch measured 63.3s; scaling roughly linearly (it isn't exactly, but no better model exists yet) puts ~6,000 chars around ~40s, leaving real margin under the 140s ceiling even given the observed variance. Retune from real production durationMs samples (persisted per batch below) rather than guessing further.
const MAX_SINGLE_FINDING_CHARS = MAX_EXTRACTION_BATCH_CHARS; // a finding at/above this alone gets chunked (see chunkFinding) rather than silently defeating the batch budget by itself
const MAX_CANDIDATE_SOURCES_PER_BATCH = 20; // secondary bound (raw, pre-dedup citation count) — input character count isn't the only latency/output-size driver: more candidate sources means a larger schema id-enum and more source objects the model has to produce. Deliberately generous since raw citations often collapse via normalizeUrl before actually mattering, but still closes a batch early for an unusually citation-dense set of findings even if under the char budget.
const MAX_EXTRACTION_BATCH_CLAIMS = MAX_STAGE_ATTEMPTS; // reuse the existing convention (3) rather than inventing a second ceiling — see claimBatchForExtraction
const EXTRACTION_BATCH_LEASE_MS = 170_000; // a little over EXTRACT_TIMEOUT_MS (140s) so a call that is genuinely still running is never reclaimed out from under itself, but short enough that a worker that silently disappeared is noticed and retried quickly
const EXTRACTION_WORST_CASE_COST_USD = 0.05; // conservative per-call reservation for the pre-dispatch budget guard below — real observed costs are $0.014-0.018/call; this is deliberately generous so the guard can't be fooled by an unusually large call without needing precise token prediction
const MIN_EXTRACTION_UNIT_CHARS = 1_500; // the true floor for splitting — below this, further chunking would fragment evidence into meaninglessly small, context-free pieces rather than making a call meaningfully safer

type Finding = { focus: string; text: string; citations: { url: string; title: string }[] };
type ExtractionBatch = {
  status: "pending" | "running" | "succeeded" | "failed";
  findings: Finding[];
  facts: any[];
  sources: any[];
  // Crash-safety fields — see claimBatchForExtraction. claimAttempts is
  // incremented and persisted BEFORE every provider call, specifically so a
  // worker that disappears mid-call still leaves a durable, counted attempt
  // even though it never reached its own success/failure handling.
  claimAttempts?: number;
  lastClaimedAt?: string;
  leaseUntil?: string;
  lastErrorCode?: string;
  lastErrorAt?: string;
  // Durable per-batch telemetry — set only once a batch actually succeeds.
  // Never surfaced in user-facing UI — this is purely so real production
  // samples can later inform retuning the size constants above.
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  providerResponseId?: string; // observability only — NOT an exactly-once billing guarantee
};

// Splits ONE finding's text into bounded pieces when it alone would blow
// the per-batch character budget — every piece keeps the SAME citations
// array (a citation describes the finding's sources as a whole, not a
// specific character range), so provenance is never fragmented into
// fictitious per-chunk sources; a chunk is still attributed to exactly the
// same sourceIds the original finding would have been. Splits on paragraph
// boundaries so we don't cut mid-sentence; falls back to a hard slice for a
// single paragraph that's still oversized on its own.
function chunkFinding(finding: Finding, maxChars: number): Finding[] {
  const text = finding.text || "";
  if (text.length <= maxChars) return [finding];
  const paragraphs = text.split(/\n{2,}/);
  const pieces: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current) {
      pieces.push(current);
      current = para;
    } else {
      current = candidate;
    }
    while (current.length > maxChars) {
      pieces.push(current.slice(0, maxChars));
      current = current.slice(maxChars);
    }
  }
  if (current) pieces.push(current);
  return pieces.map((pieceText, i) => ({
    focus: pieces.length > 1 ? `${finding.focus} (part ${i + 1}/${pieces.length})` : finding.focus,
    text: pieceText,
    citations: finding.citations,
  }));
}

// Size-aware partitioning: a batch respects a hard item-count ceiling
// (MAX_FINDINGS_PER_EXTRACTION_BATCH), an approximate character budget
// (MAX_EXTRACTION_BATCH_CHARS), AND a candidate-source-count budget
// (MAX_CANDIDATE_SOURCES_PER_BATCH) — whichever is hit first closes the
// batch. Real findings vary wildly in density (a short factual snippet vs.
// a dense catalogue dump can both be "one finding"), so item count alone
// isn't a safe latency proxy — see the constants' comments above for the
// real incidents that proved this. An oversized single finding is chunked
// first (chunkFinding) so it can never defeat the budget just by being one
// item.
function buildExtractionBatches(findings: Finding[]): ExtractionBatch[] {
  const units = findings.flatMap((f) => chunkFinding(f, MAX_SINGLE_FINDING_CHARS));
  const batches: ExtractionBatch[] = [];
  let current: Finding[] = [];
  let currentChars = 0;
  let currentCitations = 0;
  for (const unit of units) {
    const unitChars = (unit.text || "").length;
    const unitCitations = (unit.citations || []).length;
    const wouldOverflow =
      current.length > 0 &&
      (current.length >= MAX_FINDINGS_PER_EXTRACTION_BATCH || currentChars + unitChars > MAX_EXTRACTION_BATCH_CHARS || currentCitations + unitCitations > MAX_CANDIDATE_SOURCES_PER_BATCH);
    if (wouldOverflow) {
      batches.push({ status: "pending", findings: current, facts: [], sources: [] });
      current = [];
      currentChars = 0;
      currentCitations = 0;
    }
    current.push(unit);
    currentChars += unitChars;
    currentCitations += unitCitations;
  }
  if (current.length) batches.push({ status: "pending", findings: current, facts: [], sources: [] });
  return batches;
}

// AbortSignal.timeout (see callOpenAI) surfaces as a DOMException named
// "TimeoutError" on standard runtimes; matched by message too as a fallback
// since the exact name/wording isn't a stable contract across Deno versions
// (one real Viking failure's persisted last_error_code reads "Signal timed
// out.", confirming timeouts don't always come through as a clean
// Error/TimeoutError pair here).
function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error && error.name === "TimeoutError") return true;
  return /timed?\s*out/i.test(error instanceof Error ? error.message : String(error));
}

// A batch can still be claimed if it's genuinely new work (pending), OR if
// it's "running" but its lease has expired — that second case is the crash-
// safety signal: a PREVIOUS claim's holder never came back to mark it
// succeeded or failed, which can only mean it disappeared before finishing.
// We don't need to know why (platform kill, crash, network failure); an
// expired lease on "running" work IS proof the previous execution did not
// complete.
function isBatchClaimable(b: ExtractionBatch): boolean {
  if (b.status === "pending") return true;
  if (b.status === "running") return !b.leaseUntil || new Date(b.leaseUntil).getTime() < Date.now();
  return false;
}

// A finding-set can still be divided further: either it has more than one
// finding (split by finding), or its single finding is still above the
// true minimum unit floor (re-chunk smaller). Only a genuinely single,
// already-minimal finding is truly unsplittable — that case must fail
// honestly rather than loop.
function canSplitFurther(findings: Finding[]): boolean {
  if (findings.length > 1) return true;
  return (findings[0]?.text?.length ?? 0) > MIN_EXTRACTION_UNIT_CHARS;
}

// Divides a finding-set into smaller pieces — by finding count when there's
// more than one, or by re-chunking the single finding smaller when there's
// only one. Every split strictly shrinks the unit (bounded below by
// MIN_EXTRACTION_UNIT_CHARS via canSplitFurther), so repeated splitting is
// guaranteed to terminate — never unbounded recursion.
function splitFindingsFurther(findings: Finding[]): Finding[][] {
  if (findings.length > 1) {
    const mid = Math.ceil(findings.length / 2);
    return [findings.slice(0, mid), findings.slice(mid)];
  }
  const only = findings[0];
  const targetMax = Math.max(MIN_EXTRACTION_UNIT_CHARS, Math.ceil(only.text.length / 2));
  const chunks = chunkFinding(only, targetMax);
  const mid = Math.ceil(chunks.length / 2);
  const left = chunks.slice(0, mid);
  const right = chunks.slice(mid);
  return right.length ? [left, right] : [left];
}

// Runs extraction for ONE claimable batch (pending, or "running" with an
// expired lease — see isBatchClaimable). This is the crash-safety core:
//
// 1. A batch that already failed to complete at least twice (claimAttempts
//    >= 2 — whether via a caught timeout or via disappearing entirely; an
//    expired lease can't tell which, and doesn't need to) is split BEFORE
//    spending another provider call on a payload already proven too big or
//    too slow, rather than resending the identical thing a third time.
// 2. A conservative worst-case cost reservation runs before every dispatch
//    — see EXTRACTION_WORST_CASE_COST_USD.
// 3. The CLAIM itself — status: "running", claimAttempts incremented,
//    a fresh lease — is persisted to the database BEFORE the provider call
//    begins. This is the one durable write that makes crash-safety actually
//    work: even if this invocation is killed on the very next line, the
//    claim already survived, so the next invocation's isBatchClaimable
//    check (once the lease expires) knows a previous attempt was made and
//    counts against MAX_EXTRACTION_BATCH_CLAIMS — it can never re-claim the
//    exact same unit of work forever.
// 4. On a caught failure (timeout or otherwise), the batch is reset to
//    "pending" immediately (not left to wait out the full lease) so the
//    very next self-chained invocation can retry — or split — right away.
// 5. A single, already-minimal unit that still exhausts
//    MAX_EXTRACTION_BATCH_CLAIMS throws a distinguishable diagnostic to
//    fail the stage honestly rather than loop.
async function runExtractionBatchStage(admin: any, row: ResearchRow, storyPlan: any, batches: ExtractionBatch[], timingKey: string) {
  const idx = batches.findIndex(isBatchClaimable);
  if (idx === -1) {
    // Either every batch has succeeded (done), or some batch is "running"
    // under a still-live lease (another invocation may be actively working
    // on it right now) — either way there's nothing safe to claim, and this
    // is NOT "progress," so the caller must not reset stage_attempt.
    return { batches, meta: row.meta, done: batches.every((b) => b.status === "succeeded"), progressed: false };
  }

  const batch = batches[idx];
  const priorClaims = batch.claimAttempts ?? 0;

  if (priorClaims >= 2 && canSplitFurther(batch.findings)) {
    const parts = splitFindingsFurther(batch.findings);
    const splitBatches: ExtractionBatch[] = parts.map((findings) => ({ status: "pending", findings, facts: [], sources: [] }));
    const withSplit = [...batches.slice(0, idx), ...splitBatches, ...batches.slice(idx + 1)];
    console.warn(
      `[advance-long-form-research] extraction batch reclaimed after ${priorClaims} prior claim(s) with no success (last error: ${batch.lastErrorCode ?? "none recorded — worker likely disappeared"}) — splitting into ${splitBatches.length} smaller unit(s) before retrying, research ${row.id}`
    );
    return { batches: withSplit, meta: row.meta, done: false, progressed: false };
  }

  if (priorClaims >= MAX_EXTRACTION_BATCH_CLAIMS) {
    throw new Error(`extraction_batch_too_large: a minimal ~${(batch.findings[0]?.text || "").length}-char unit still failed to complete after ${priorClaims} claims`);
  }

  // Conservative cost reservation BEFORE dispatch — a hard-killed call may
  // spend real money without ever returning usage we can track. This can't
  // account for that spend precisely, but it guarantees we never KNOWINGLY
  // dispatch a call that would push tracked spend past the ceiling in the
  // worst case, on top of the hard claimAttempts cap already bounding how
  // many times any one unit can be dispatched at all.
  const knownSpent = row.meta?.estimatedTotalCostUsd ?? 0;
  if (knownSpent + EXTRACTION_WORST_CASE_COST_USD > MAX_ESTIMATED_COST_PER_RESEARCH_USD) {
    throw new Error(`research_cost_ceiling_reached: $${knownSpent.toFixed(4)} known spent, refusing to dispatch another extraction batch under the $${MAX_ESTIMATED_COST_PER_RESEARCH_USD} ceiling`);
  }

  // CLAIM — persisted BEFORE calling the provider. This write is the entire
  // point: it survives even if this invocation is killed on the next line.
  const claimAttempts = priorClaims + 1;
  const claimedAt = Date.now();
  const claimedBatches = batches.map((b, i) =>
    i === idx ? { ...b, status: "running" as const, claimAttempts, lastClaimedAt: new Date(claimedAt).toISOString(), leaseUntil: new Date(claimedAt + EXTRACTION_BATCH_LEASE_MS).toISOString() } : b
  );
  await admin.from("long_form_research_versions").update({ intermediate: { ...(row.intermediate ?? {}), extractionBatches: claimedBatches } }).eq("id", row.id);

  const candidateMap = new Map<string, { id: string; url: string; title: string }>();
  for (const finding of batch.findings) {
    for (const citation of finding.citations ?? []) {
      const key = normalizeUrl(citation.url);
      if (!candidateMap.has(key)) candidateMap.set(key, { id: shortSourceId(), url: citation.url, title: citation.title });
    }
  }
  const candidates = Array.from(candidateMap.values());

  const usage = newUsageTotals();
  const t0 = Date.now();
  let result: any;
  let providerResponseId: string | undefined;
  try {
    const payload = await callOpenAI(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: EXTRACTOR_INSTRUCTIONS,
        input: extractorInput({ storyPlan, researchPlan: row.research_plan, findings: batch.findings, candidateSources: candidates }),
        text: { format: { type: "json_schema", name: "research_extraction", strict: true, schema: buildExtractorSchema(candidates.map((c) => c.id)) } },
      },
      EXTRACT_TIMEOUT_MS
    );
    trackUsage(usage, payload);
    providerResponseId = typeof payload?.id === "string" ? payload.id : undefined;
    result = parseJson(extractOutputText(payload));
  } catch (error) {
    // We caught this ourselves, so we KNOW right now it failed — reset to
    // "pending" immediately rather than waiting out the full lease, so the
    // next self-chained invocation can retry (or split, per the
    // claimAttempts>=2 check above) as soon as possible.
    const errorCode = (error instanceof Error ? error.message : String(error)).slice(0, 300);
    const failedBatches = claimedBatches.map((b, i) => (i === idx ? { ...b, status: "pending" as const, leaseUntil: undefined, lastErrorCode: errorCode, lastErrorAt: new Date().toISOString() } : b));
    await admin.from("long_form_research_versions").update({ intermediate: { ...(row.intermediate ?? {}), extractionBatches: failedBatches } }).eq("id", row.id);
    return { batches: failedBatches, meta: row.meta, done: false, progressed: false };
  }

  const sourceLookup = new Map(candidates.map((c) => [c.id, c]));
  const sourcesFull = result.sources.map((s: any) => ({ ...s, ...sourceLookup.get(s.id) }));
  const durationMs = Date.now() - t0;
  const estimatedCostUsd = Number(((usage.inputTokens * GPT5_MINI_INPUT_PER_M + usage.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));

  const updatedBatches = claimedBatches.map((b, i) =>
    i === idx
      ? {
          ...b,
          status: "succeeded" as const,
          facts: result.facts,
          sources: sourcesFull,
          leaseUntil: undefined,
          startedAt: new Date(t0).toISOString(),
          completedAt: new Date().toISOString(),
          durationMs,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostUsd,
          providerResponseId,
        }
      : b
  );
  const ledger = ledgerEntries("extraction_batch", "extract", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, null, null, undefined, ledger);
  meta.timings = { ...(meta.timings ?? {}), [timingKey]: (row.meta?.timings?.[timingKey] ?? 0) + durationMs };

  const done = !updatedBatches.some((b) => b.status !== "succeeded");
  return { batches: updatedBatches, meta, done, progressed: true };
}

const MERGE_INSTRUCTIONS = `You are Zyvo's Fact Merge & Deduplication step. You receive multiple independently-extracted batches of facts and sources about the same video topic — each batch was extracted from a different subset of research findings in isolation, so the SAME real-world claim may appear more than once, phrased differently, sometimes with different confidence levels or even different classifications.

Your job:
1. Identify facts across batches that describe the SAME underlying claim and merge them into ONE fact, combining their sourceIds (deduplicated) and chapterIds/researchQuestionIds.
2. Confidence in a merged fact must reflect genuinely independent corroboration only. If the same claim was independently found via clearly different sources across batches, that is real corroboration and confidence may end up higher than any single batch assigned. But if two batches each had only one weak or single source for a similar claim, do NOT invent higher confidence just because the claim appears twice — keep the lower, more honest confidence. Coincidental duplication across extraction batches is not corroboration.
3. Preserve every dispute: if any batch marked a claim disputed, the merged fact must remain disputed:true with a clear disputeSummary describing the disagreement — never resolve a dispute by silently picking a side during merge.
4. Preserve genuinely distinct facts as separate entries — do not force topically-similar but substantively different claims together.
5. Do not invent new claims, new sources, or new sourceIds that were not present in the input batches.
6. If existing approved facts from an earlier pass are provided, treat them as already-approved: merge any new batches into them using the same rules above, and never discard an existing fact without a specific stated reason (e.g. a new batch's evidence directly supersedes or corrects it — say so in uncertaintyNotes).
7. Your output "sources" array MUST include every source that appears in ANY surviving fact's sourceIds — including sources from existing approved facts you did not otherwise touch this round. A source that is still cited by a kept fact is never dropped from "sources", even if this round's new batches never mentioned it.`;

function mergeInput(ctx: { storyPlan: any; batches: { facts: any[]; sources: any[] }[]; existingFacts?: any[]; existingSources?: any[] }) {
  const lines = [`STORY PLAN CHAPTERS:`, JSON.stringify(ctx.storyPlan.chapters.map((c: any) => ({ id: c.id, title: c.title })), null, 2), ``];
  ctx.batches.forEach((b, i) => {
    lines.push(`BATCH ${i + 1} SOURCES:`, JSON.stringify(b.sources, null, 2), `BATCH ${i + 1} FACTS:`, JSON.stringify(b.facts, null, 2), ``);
  });
  if (ctx.existingFacts?.length) {
    lines.push(`EXISTING APPROVED SOURCES (from an earlier pass):`, JSON.stringify(ctx.existingSources ?? [], null, 2));
    lines.push(`EXISTING APPROVED FACTS (from an earlier pass — merge new batches into these per the rules above):`, JSON.stringify(ctx.existingFacts, null, 2));
  }
  return lines.join("\n");
}

async function mergeExtractedFacts(
  row: ResearchRow,
  storyPlan: any,
  batches: ExtractionBatch[],
  existingFacts: any[] | undefined,
  existingSources: any[] | undefined,
  usage: UsageTotals
) {
  const allSources = [...batches.flatMap((b) => b.sources), ...(existingSources ?? [])];
  const idEnum = allSources.map((s: any) => s.id);
  const merged = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: MERGE_INSTRUCTIONS,
      input: mergeInput({ storyPlan, batches, existingFacts, existingSources }),
      text: { format: { type: "json_schema", name: "research_merge", strict: true, schema: buildExtractorSchema(idEnum) } },
    },
    EXTRACT_TIMEOUT_MS,
    usage
  );
  // Belt-and-suspenders beyond MERGE_INSTRUCTIONS rule 7: don't trust the
  // model to faithfully re-list every still-cited source in its own
  // "sources" output (observed in real testing — the model can merge facts
  // correctly while quietly dropping untouched sources from "sources").
  // Derive the definitive source list from what surviving facts actually
  // cite, so long_form_research_sources can never end up missing a source
  // fact_graph.facts still reference.
  const sourceLookup = new Map(allSources.map((s: any) => [s.id, s]));
  const modelSourceLookup = new Map(merged.sources.map((s: any) => [s.id, s]));
  const citedIds = new Set<string>(merged.facts.flatMap((f: any) => f.sourceIds ?? []));
  const sourcesFull = Array.from(citedIds)
    .map((id) => ({ ...sourceLookup.get(id), ...modelSourceLookup.get(id) }))
    .filter((s: any) => s.id);
  return { facts: merged.facts, sourcesFull };
}

async function stageInitialExtraction(admin: any, row: ResearchRow, _project: any, storyPlan: any) {
  const findings: Finding[] = row.intermediate?.retrievalFindings ?? [];
  const batches: ExtractionBatch[] = row.intermediate?.extractionBatches ?? buildExtractionBatches(findings);
  const { batches: updatedBatches, meta: batchMeta, done, progressed } = await runExtractionBatchStage(admin, row, storyPlan, batches, "extractionMs");

  if (!done) {
    const intermediate = { ...(row.intermediate ?? {}), extractionBatches: updatedBatches };
    // stage_attempt only resets to 0 when a batch just genuinely SUCCEEDED
    // this call (progressed) — a claim that ended in a retryable failure or
    // a preemptive split must NOT reset it, so the row-level claim-time
    // counter (see the crash-safety migration) still accumulates across
    // repeated unproductive row-claims and eventually reaps a stage that
    // never manages to land a single successful batch, even if a bug in the
    // batch-level claimAttempts logic somehow let it loop.
    const update: Record<string, unknown> = { intermediate, meta: batchMeta, worker_lock_until: null };
    if (progressed) update.stage_attempt = 0;
    await admin.from("long_form_research_versions").update(update).eq("id", row.id);
    return;
  }

  const usage = newUsageTotals();
  const { facts: v1Facts, sourcesFull: v1SourcesFull } = await mergeExtractedFacts(row, storyPlan, updatedBatches, undefined, undefined, usage);
  const ledger = ledgerEntries("initial_extraction_merge", "extract", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(batchMeta, usage, null, null, undefined, ledger);

  const intermediate = { ...(row.intermediate ?? {}), extractionBatches: undefined, v1Facts, v1SourcesFull };
  await admin.from("long_form_research_versions").update({ fact_graph: { facts: v1Facts }, intermediate, meta, stage: "coverage_review", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

async function stageCoverageReview(admin: any, row: ResearchRow, _project: any, storyPlan: any) {
  const usage = newUsageTotals();
  const t0 = Date.now();
  const facts = row.intermediate?.v1Facts ?? [];
  const sources = row.intermediate?.v1SourcesFull ?? [];

  const coverage = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: CRITIC_INSTRUCTIONS,
      input: criticInput({ storyPlan, researchPlan: row.research_plan, facts, sources }),
      text: { format: { type: "json_schema", name: "research_coverage", strict: true, schema: CRITIC_SCHEMA } },
    },
    CRITIC_TIMEOUT_MS,
    usage
  );

  const hasGaps = Array.isArray(coverage.gapQueries) && coverage.gapQueries.length > 0;
  const ledger = ledgerEntries("coverage_review", "critic", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, "coverageMs", Date.now() - t0, undefined, ledger);
  await admin.from("long_form_research_versions").update({ coverage, meta, stage: hasGaps ? "gap_search" : "finalizing", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

async function stageGapSearch(admin: any, row: ResearchRow, _project: any, _storyPlan: any) {
  // Gap search is a refinement, not required evidence — if the per-Research
  // or platform-wide budget is already exhausted before this even starts,
  // skip straight to finalizing with what already exists. The existing
  // needs_attention heuristic already handles "coverage turned out thin"
  // honestly; runQueueBatch applies the same check again before every
  // subsequent batch too, so a mid-flight exhaustion also stops cleanly.
  if (await searchBudgetExhausted(admin, row.meta)) {
    const meta = { ...(row.meta ?? {}), gapSearchCalls: 0, gapSearchSkippedReason: "BUDGET_EXHAUSTED" };
    await admin.from("long_form_research_versions").update({ meta, stage: "finalizing", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const gapTasks = (row.coverage?.gapQueries ?? []).slice(0, MAX_GAP_TASKS);
  const queue: QueueEntry[] = row.intermediate?.searchQueue ?? flattenToQueue(gapTasks, GAP_QUERY_BUDGET, "gap");
  const { queue: updatedQueue, meta: batchMeta, done } = await runQueueBatch(admin, row, queue, {}, "gap_search", "gapSearchMs");

  if (!done) {
    const intermediate = { ...(row.intermediate ?? {}), searchQueue: updatedQueue };
    // stage_attempt: 0 — real forward progress was just made and persisted,
    // so the claim-time attempt counter (see the crash-safety migration)
    // resets here. Otherwise a healthy multi-round stage (several batches/
    // queue rounds, each its own claim) would exhaust MAX_STAGE_ATTEMPTS
    // from normal successful progress alone, with zero actual failures.
    await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const succeeded = updatedQueue.filter((e) => e.status === "succeeded");

  // gap-phase searchQueue is done with its job once consumed into
  // gapFindings — clear it so a later "Regenerate Research" (a fresh
  // version, fresh intermediate) never confuses old queue state with new.
  const intermediate = {
    ...(row.intermediate ?? {}),
    searchQueue: undefined,
    gapFindings: succeeded.map((e) => ({ focus: e.focus, text: e.text, citations: e.citations })),
  };
  batchMeta.gapSearchCalls = updatedQueue.length;
  await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage: "final_extraction", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

async function stageFinalExtraction(admin: any, row: ResearchRow, project: any, storyPlan: any) {
  const gapFindings: Finding[] = row.intermediate?.gapFindings ?? [];
  const batches: ExtractionBatch[] = row.intermediate?.extractionBatches ?? buildExtractionBatches(gapFindings);

  let updatedBatches: ExtractionBatch[], batchMeta: any, done: boolean, progressed: boolean;
  try {
    ({ batches: updatedBatches, meta: batchMeta, done, progressed } = await runExtractionBatchStage(admin, row, storyPlan, batches, "finalExtractionMs"));
  } catch (error) {
    // Gap search / final extraction is OPTIONAL refinement, not required
    // evidence — see stageGapSearch's identical philosophy just above. If
    // this fails SPECIFICALLY because it would exceed the cost ceiling, and
    // a complete, internally-consistent PRE-GAP checkpoint already exists
    // (v1Facts from stageInitialExtraction, still sitting untouched in
    // row.fact_graph/row.coverage since this stage's own merge never ran),
    // degrade gracefully to that checkpoint instead of failing the whole
    // Research Version. This never merges the half-finished gap batches in
    // — stageFinalizing reads row.fact_graph/row.coverage exactly as they
    // already are, which at this point IS the last consistent package.
    const hasConsistentCheckpoint = ((row.intermediate?.v1Facts?.length as number | undefined) ?? row.fact_graph?.facts?.length ?? 0) > 0;
    if (error instanceof Error && error.message.startsWith("research_cost_ceiling_reached") && hasConsistentCheckpoint) {
      console.warn(`[advance-long-form-research] gap extraction hit the cost ceiling for research ${row.id} — finalizing with the last consistent pre-gap checkpoint instead of failing`);
      await stageFinalizing(admin, { ...row, meta: { ...(row.meta ?? {}), completionReason: "budget_ceiling_reached" } }, project, storyPlan);
      return;
    }
    throw error;
  }

  if (!done) {
    const intermediate = { ...(row.intermediate ?? {}), extractionBatches: updatedBatches };
    // See stageInitialExtraction's identical comment: only reset stage_attempt
    // when a batch actually succeeded this call, never on a retry/split.
    const update: Record<string, unknown> = { intermediate, meta: batchMeta, worker_lock_until: null };
    if (progressed) update.stage_attempt = 0;
    await admin.from("long_form_research_versions").update(update).eq("id", row.id);
    return;
  }

  const usage = newUsageTotals();
  const existingFacts = row.intermediate?.v1Facts ?? [];
  const existingSources = row.intermediate?.v1SourcesFull ?? [];
  const { facts: finalFacts, sourcesFull: finalSourcesFull } = await mergeExtractedFacts(row, storyPlan, updatedBatches, existingFacts, existingSources, usage);
  const ledger = ledgerEntries("final_extraction_merge", "extract", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(batchMeta, usage, null, null, undefined, ledger);

  const intermediate = { ...(row.intermediate ?? {}), extractionBatches: undefined, finalSourcesFull };
  // Coverage was assessed BEFORE gap search ran — it's now stale relative to
  // this merged FactGraph (a real issue: e.g. a chapter graded "weak" pre-gap
  // may already be well-covered post-merge). final_coverage_review recomputes
  // it against the true final evidence rather than leaving the pre-gap
  // assessment displayed as if it were still accurate.
  await admin.from("long_form_research_versions").update({ fact_graph: { facts: finalFacts }, intermediate, meta, stage: "final_coverage_review", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

// Only reached when a gap round actually ran (coverage_review skips
// straight to finalizing otherwise, since nothing changed since its own
// assessment). Same critic call as coverage_review, re-run against the
// TRUE final, post-merge FactGraph — this is what fixes the stale-coverage
// issue found in earlier testing (a chapter's stored status could remain
// "weak" even after gap search demonstrably filled it in).
async function stageFinalCoverageReview(admin: any, row: ResearchRow, _project: any, storyPlan: any) {
  const usage = newUsageTotals();
  const t0 = Date.now();
  const facts = row.fact_graph?.facts ?? [];
  const sources = row.intermediate?.finalSourcesFull ?? [];

  const coverage = await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: CRITIC_INSTRUCTIONS,
      input: criticInput({ storyPlan, researchPlan: row.research_plan, facts, sources }),
      text: { format: { type: "json_schema", name: "research_coverage", strict: true, schema: CRITIC_SCHEMA } },
    },
    CRITIC_TIMEOUT_MS,
    usage
  );

  const ledger = ledgerEntries("final_coverage_review", "critic", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, "finalCoverageMs", Date.now() - t0, undefined, ledger);
  await admin.from("long_form_research_versions").update({ coverage, meta, stage: "finalizing", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

/* ============================ Targeted Research Repair ============================ */
// Triggered by advance-long-form-script when its Critic determines specific
// chapters can't be written honestly from the current evidence — NOT a full
// re-research. repair_planning -> repair_search -> repair_extraction ->
// repair_coverage -> finalizing (reused as-is). Every one of these reuses
// the exact same proven machinery as the full pipeline (flattenToQueue,
// runQueueBatch, buildExtractionBatches, mergeExtractedFacts, the Coverage
// Critic) — only the INPUT is narrower (a handful of named chapters, not
// the whole topic) and the BUDGET is smaller (MAX_TARGETED_* above, not the
// full-research ceilings).

const REPAIR_PLANNER_INSTRUCTIONS = `You are Zyvo's Targeted Research Repair Planner. A Script writer already tried to write specific chapters of a video and could not, because the evidence available didn't actually cover what those chapters need to say. You are given each affected chapter's title, purpose, key questions, and a specific description of exactly what's missing — not a fresh topic to research broadly.

Your only job: for each chapter, propose 1-2 NARROW search queries that would find an authoritative source for the EXACT missing claim. Name the specific technical/factual concept from the chapter's purpose and key questions directly in the query — never a generic restatement of the overall video topic.

Example: if the missing claim is about how Wi-Fi devices avoid transmitting over each other, a good query is "IEEE 802.11 DCF CSMA/CA carrier sense backoff authoritative source" — NOT "Wi-Fi protocol information" and NOT "how does Wi-Fi work". A bad, overly broad query for a specific gap is the single most common way a targeted repair wastes its small budget on irrelevant results.

Produce at most one search task per chapter you were given, and never invent a chapter that wasn't given to you.`;

const REPAIR_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["searchStrategy"],
  properties: {
    searchStrategy: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "focus", "queries", "targetChapterIds"],
        properties: {
          id: { type: "string" },
          focus: { type: "string", description: "The exact missing claim this task targets, not the general topic." },
          queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          targetChapterIds: { type: "array", items: { type: "string" }, maxItems: 1 },
        },
      },
    },
  },
};

function repairPlannerInput(ctx: { chapters: { chapterId: string; title: string; purpose: string; keyQuestions: string[]; missingEvidenceDescription: string }[] }) {
  return [`CHAPTERS THAT COULD NOT BE WRITTEN FROM CURRENT EVIDENCE:`, JSON.stringify(ctx.chapters, null, 2)].join("\n");
}

async function stageRepairPlanning(admin: any, row: ResearchRow, _project: any, _storyPlan: any) {
  const usage = newUsageTotals();
  const t0 = Date.now();
  const chapters = row.repair_context?.chapters ?? [];
  const repairPlan = await callStructured(
    { model: OPENAI_MODEL, store: false, instructions: REPAIR_PLANNER_INSTRUCTIONS, input: repairPlannerInput({ chapters }), text: { format: { type: "json_schema", name: "repair_plan", strict: true, schema: REPAIR_PLAN_SCHEMA } } },
    PLAN_TIMEOUT_MS,
    usage
  );
  const ledger = ledgerEntries("repair_planning", "plan", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, "repairPlanningMs", Date.now() - t0, undefined, ledger);
  const intermediate = { ...(row.intermediate ?? {}), repairPlan };
  await admin.from("long_form_research_versions").update({ intermediate, meta, stage: "repair_search", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

async function stageRepairSearch(admin: any, row: ResearchRow, _project: any, _storyPlan: any) {
  const tasks = row.intermediate?.repairPlan?.searchStrategy ?? [];
  const queue: QueueEntry[] = row.intermediate?.searchQueue ?? flattenToQueue(tasks, MAX_TARGETED_QUERIES, "repair");
  const { queue: updatedQueue, meta: batchMeta, done } = await runQueueBatch(admin, row, queue, {}, "repair_search", "repairSearchMs", { maxCalls: MAX_TARGETED_WEB_SEARCH_TOOL_CALLS, maxCost: MAX_TARGETED_RESEARCH_COST_USD });

  if (!done) {
    const intermediate = { ...(row.intermediate ?? {}), searchQueue: updatedQueue };
    // stage_attempt: 0 — real forward progress was just made and persisted,
    // so the claim-time attempt counter (see the crash-safety migration)
    // resets here. Otherwise a healthy multi-round stage (several batches/
    // queue rounds, each its own claim) would exhaust MAX_STAGE_ATTEMPTS
    // from normal successful progress alone, with zero actual failures.
    await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const succeeded = updatedQueue.filter((e) => e.status === "succeeded");
  // Cheap deterministic relevance pre-filter BEFORE extraction ever sees a
  // result — this is what the real Wi-Fi gap search was missing: a query
  // aimed at CSMA/CA that actually returned WPA3 content had nothing
  // stopping it from being treated as coverage. Score by keyword overlap
  // between the finding's own text and the repair task's focus/queries (the
  // exact missing claim, not the general topic) — a near-zero-overlap
  // finding almost certainly answered a different question than the one
  // asked, regardless of how authoritative its source is. This is a signal,
  // not a hard gate on its own: the extractor's existing "drop irrelevant
  // candidates" instruction is the second, independent layer that actually
  // decides what becomes a fact.
  const taskByFocus = new Map(tasks.map((t: any) => [t.focus, t]));
  const relevantFindings = succeeded
    .map((e) => {
      const task = taskByFocus.get(e.focus);
      const keywords = `${task?.focus ?? ""} ${(task?.queries ?? []).join(" ")}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w: string) => w.length > 3);
      const textLower = e.text.toLowerCase();
      const overlap = keywords.length ? keywords.filter((w: string) => textLower.includes(w)).length / keywords.length : 1;
      return { entry: e, overlap };
    })
    .filter((r) => r.overlap >= 0.15) // low bar — this only drops findings that are almost certainly about a different subject entirely
    .map((r) => r.entry);

  const intermediate = {
    ...(row.intermediate ?? {}),
    searchQueue: undefined,
    repairFindings: relevantFindings.map((e) => ({ focus: e.focus, text: e.text, citations: e.citations })),
    repairFilteredOutCount: succeeded.length - relevantFindings.length,
  };
  batchMeta.repairSearchCalls = updatedQueue.length;
  await admin.from("long_form_research_versions").update({ intermediate, meta: batchMeta, stage: "repair_extraction", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

// Maps a persisted long_form_research_sources row (snake_case DB columns)
// back to the camelCase shape mergeExtractedFacts expects — the same shape
// runExtractionBatchStage/mergeExtractedFacts already produce in-memory
// during a normal run. A repair's "existing sources" have to come from this
// table (not from any in-memory intermediate) because the repair is a brand
// new row with no memory of what the PARENT row did.
function dbSourceToFull(dbRow: any) {
  return { id: dbRow.id, url: dbRow.url, title: dbRow.title, sourceType: dbRow.source_type, qualityTier: dbRow.quality_tier, relevance: dbRow.relevance, credibilityNotes: dbRow.credibility_notes, chaptersSupported: dbRow.chapters_supported ?? [] };
}

async function stageRepairExtraction(admin: any, row: ResearchRow, _project: any, storyPlan: any) {
  const findings: Finding[] = row.intermediate?.repairFindings ?? [];
  const batches: ExtractionBatch[] = row.intermediate?.extractionBatches ?? buildExtractionBatches(findings);
  const { batches: updatedBatches, meta: batchMeta, done, progressed } = await runExtractionBatchStage(admin, row, storyPlan, batches, "repairExtractionMs");

  if (!done) {
    const intermediate = { ...(row.intermediate ?? {}), extractionBatches: updatedBatches };
    // See stageInitialExtraction's identical comment: only reset stage_attempt
    // when a batch actually succeeded this call, never on a retry/split.
    const update: Record<string, unknown> = { intermediate, meta: batchMeta, worker_lock_until: null };
    if (progressed) update.stage_attempt = 0;
    await admin.from("long_form_research_versions").update(update).eq("id", row.id);
    return;
  }

  const parentId = row.parent_research_version_id;
  const { data: parentRow } = await admin.from("long_form_research_versions").select("fact_graph").eq("id", parentId).maybeSingle();
  const { data: parentSourceRows } = await admin.from("long_form_research_sources").select("*").eq("research_version_id", parentId);
  const existingFacts = parentRow?.fact_graph?.facts ?? [];
  const existingSources = (parentSourceRows ?? []).map(dbSourceToFull);

  const usage = newUsageTotals();
  const { facts: mergedFacts, sourcesFull: mergedSourcesFull } = await mergeExtractedFacts(row, storyPlan, updatedBatches, existingFacts, existingSources, usage);
  const ledger = ledgerEntries("repair_extraction_merge", "extract", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(batchMeta, usage, null, null, undefined, ledger);
  const intermediate = { ...(row.intermediate ?? {}), extractionBatches: undefined, repairSourcesFull: mergedSourcesFull };
  await admin.from("long_form_research_versions").update({ fact_graph: { facts: mergedFacts }, intermediate, meta, stage: "repair_coverage", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

// Full-consistency coverage view (all chapters, same call as
// final_coverage_review) rather than a partial per-chapter-only check — a
// repair to one chapter can change how honest the OVERALL video looks
// (e.g. resolving an open loop elsewhere), so every chapter gets a fresh,
// consistent status even though only a couple of chapters actually
// received new evidence this round.
async function stageRepairCoverage(admin: any, row: ResearchRow, _project: any, storyPlan: any) {
  const usage = newUsageTotals();
  const t0 = Date.now();
  const facts = row.fact_graph?.facts ?? [];
  const sources = row.intermediate?.repairSourcesFull ?? [];
  const coverage = await callStructured(
    { model: OPENAI_MODEL, store: false, instructions: CRITIC_INSTRUCTIONS, input: criticInput({ storyPlan, researchPlan: row.research_plan, facts, sources }), text: { format: { type: "json_schema", name: "research_coverage", strict: true, schema: CRITIC_SCHEMA } } },
    CRITIC_TIMEOUT_MS,
    usage
  );
  const ledger = ledgerEntries("repair_coverage", "critic", [{ inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }]);
  const meta = mergeMeta(row.meta, usage, "repairCoverageMs", Date.now() - t0, undefined, ledger);
  await admin.from("long_form_research_versions").update({ coverage, meta, stage: "finalizing", stage_attempt: 0, worker_lock_until: null }).eq("id", row.id);
}

async function stageFinalizing(admin: any, row: ResearchRow, project: any, storyPlan: any) {
  const finalFacts = row.fact_graph?.facts ?? [];
  // repairSourcesFull is a repair row's own key (see stageRepairExtraction)
  // — without it here, a repaired version's sources would never make it
  // into long_form_research_sources at all (facts would still persist fine,
  // but provenance/citation data would silently go missing for every
  // targeted repair).
  const finalSourcesFull = row.intermediate?.finalSourcesFull ?? row.intermediate?.repairSourcesFull ?? row.intermediate?.v1SourcesFull ?? [];

  const weakChapterCount = (row.coverage?.chapterCoverage ?? []).filter((c: any) => c.status === "weak").length;
  const totalChapters = storyPlan.chapters.length;
  const needsAttention = finalSourcesFull.length === 0 || finalFacts.length === 0 || (totalChapters > 0 && weakChapterCount / totalChapters > 0.4);
  const status = needsAttention ? "needs_attention" : "ready";

  if (finalSourcesFull.length) {
    const rows = finalSourcesFull.map((s: any) => ({
      id: s.id,
      research_version_id: row.id,
      url: s.url,
      normalized_url: normalizeUrl(s.url),
      title: s.title,
      publisher: null,
      source_type: s.sourceType,
      quality_tier: s.qualityTier,
      relevance: s.relevance,
      credibility_notes: s.credibilityNotes,
      chapters_supported: s.chaptersSupported ?? [],
    }));
    const { error: sourcesError } = await admin.from("long_form_research_sources").upsert(rows, { onConflict: "research_version_id,normalized_url" });
    if (sourcesError) console.error("[advance-long-form-research] failed to persist sources:", sourcesError.message);
  }

  const completedAt = new Date();
  const totalMs = row.research_started_at ? completedAt.getTime() - new Date(row.research_started_at).getTime() : null;
  const meta = { ...(row.meta ?? {}), totalSources: finalSourcesFull.length, totalFacts: finalFacts.length, timings: { ...(row.meta?.timings ?? {}), totalMs } };

  await admin
    .from("long_form_research_versions")
    .update({ status, meta, research_completed_at: completedAt.toISOString(), worker_lock_until: null })
    .eq("id", row.id);

  await admin.from("long_form_projects").update({ current_research_version_id: row.id, updated_at: completedAt.toISOString() }).eq("id", project.id);

  // Auto-chain into a new ScriptVersion — only for repair rows
  // (parent_research_version_id set). The whole point of a targeted repair
  // is that the user never has to manually reconstruct the pipeline: once
  // the repaired evidence lands, a fresh Script attempt starts on its own.
  // A normal/original research version never does this — that stays the
  // user's own "Write Script" action. Fires on both ready and
  // needs_attention (a needs_attention repair is still worth attempting to
  // script — see advance-long-form-script's own repair-round-1 handling for
  // what happens if that attempt still can't be made honest), never on a
  // repair that itself failed.
  if ((status === "ready" || status === "needs_attention") && row.parent_research_version_id && LONG_FORM_SCRIPT_ADVANCE_SECRET) {
    const { count: existingScriptCount } = await admin
      .from("long_form_script_versions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .eq("story_plan_version_id", row.story_plan_version_id)
      .eq("research_version_id", row.id);
    const nextVersion = (existingScriptCount ?? 0) + 1;
    const { data: newScript } = await admin
      .from("long_form_script_versions")
      .insert({ project_id: project.id, story_plan_version_id: row.story_plan_version_id, research_version_id: row.id, version: nextVersion, status: "drafting", stage: "draft" })
      .select("id")
      .single();
    if (newScript) {
      backgroundDispatch(
        fetch(SCRIPT_ADVANCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-cron-secret": LONG_FORM_SCRIPT_ADVANCE_SECRET },
          body: JSON.stringify({ scriptVersionId: newScript.id }),
        })
      );
    }
  }
}

/* ============================ Dispatch + failure handling ============================ */

function backgroundDispatch(promise: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[advance-long-form-research] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

async function dispatchNext(id: string) {
  await fetch(SELF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET },
    body: JSON.stringify({ researchVersionId: id }),
  });
}

// Linear backoff (15s, 30s, 45s) — bounded retries without hammering OpenAI.
// The stage itself is unchanged on a retryable failure, so the next attempt
// resumes from exactly where it failed, never re-running an earlier
// (already-paid-for) stage.
//
// stage_attempt is NO LONGER incremented here — see the crash-safety
// migration (20260916120000): claim_long_form_research_stage(_by_id) now
// increments it atomically at CLAIM time, before any provider work begins,
// specifically so a worker that disappears (platform kill, crash, network
// failure) BEFORE this function ever runs still leaves a durable, counted
// attempt. This function just reads the already-current row.stage_attempt
// to decide terminal-vs-backoff; double-incrementing here would overcount.
async function handleStageFailure(admin: any, row: ResearchRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
  console.error(`[advance-long-form-research] stage ${row.stage} failed (attempt ${attempt}) for research ${row.id}:`, errorCode);

  if (attempt >= MAX_STAGE_ATTEMPTS) {
    await admin
      .from("long_form_research_versions")
      .update({ status: "failed", last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: null })
      .eq("id", row.id);
    return;
  }

  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_research_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id);
  // Deliberately no immediate self-dispatch here — worker_lock_until is set
  // in the future, so an immediate retry would just fail to claim anyway.
  // The cron safety net picks it up once the lease naturally expires.
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  if (!ADVANCE_SECRET || secret !== ADVANCE_SECRET) return json({ error: "Unauthorized" }, 401);

  // Kill switch — checked before the row claim, before any OpenAI key check,
  // before touching the database at all. No claim means no lease is taken,
  // no stage_attempt is touched, and no in-flight run is disturbed; it just
  // sits exactly where it is until unpaused.
  if (RESEARCH_PAUSED) return json({ paused: true, claimed: false });

  if (!OPENAI_KEY) return json({ error: "Research is not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const targetId = body?.researchVersionId ? String(body.researchVersionId) : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: claimedRows } = targetId
    ? await admin.rpc("claim_long_form_research_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_research_stage", { p_limit: 1 });

  const row = claimedRows?.[0];
  if (!row) return json({ claimed: false });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: storyVersion } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", row.story_plan_version_id).maybeSingle();

  if (!project || !storyVersion) {
    await admin.from("long_form_research_versions").update({ status: "failed", last_error_code: "PROJECT_OR_PLAN_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }
  const storyPlan = storyVersion.story_plan;

  try {
    switch (row.stage) {
      case "planning":
        await stagePlanning(admin, row, project, storyPlan);
        break;
      case "initial_search":
        await stageInitialSearch(admin, row, project, storyPlan);
        break;
      case "initial_extraction":
        await stageInitialExtraction(admin, row, project, storyPlan);
        break;
      case "coverage_review":
        await stageCoverageReview(admin, row, project, storyPlan);
        break;
      case "gap_search":
        await stageGapSearch(admin, row, project, storyPlan);
        break;
      case "final_extraction":
        await stageFinalExtraction(admin, row, project, storyPlan);
        break;
      case "final_coverage_review":
        await stageFinalCoverageReview(admin, row, project, storyPlan);
        break;
      case "repair_planning":
        await stageRepairPlanning(admin, row, project, storyPlan);
        break;
      case "repair_search":
        await stageRepairSearch(admin, row, project, storyPlan);
        break;
      case "repair_extraction":
        await stageRepairExtraction(admin, row, project, storyPlan);
        break;
      case "repair_coverage":
        await stageRepairCoverage(admin, row, project, storyPlan);
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
