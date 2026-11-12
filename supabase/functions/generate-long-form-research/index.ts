// deno-lint-ignore-file no-explicit-any
// generate-long-form-research/index.ts
//
// The Research + Factuality Engine. Builds a trusted evidence layer BEFORE
// any script is written, so the future Script Engine narrates from vetted
// facts instead of improvising while browsing the internet:
//
//   PASS A — Research Planner (structured, no search): reads TopicModel +
//     NarrativeStrategy + StoryPlan and decides what actually needs
//     verification, per chapter, with a bounded search strategy.
//   RETRIEVAL — one gpt-5-mini + web_search call per search-strategy item,
//     run concurrently. Real citations come from the Responses API's own
//     url_citation annotations, never from the model typing a URL from
//     memory.
//   PASS B — Source/Fact Extractor (structured, no search): turns the
//     retrieved findings + real candidate sources into a FactGraph. Source
//     ids are injected into the schema itself as an enum of the exact
//     candidate ids, so the model cannot invent a sourceId that doesn't
//     correspond to a real citation ("no research laundering").
//   PASS C — Coverage/Conflict Critic (structured, no search): grades
//     chapter coverage and requests a small, bounded set of gap searches.
//   GAP RETRIEVAL — same mechanism as initial retrieval, only if needed.
//   PASS B (final) — merges initial + gap findings into the final FactGraph.
//
// Idempotent on (project_id, story_plan_version_id): re-entering Research
// for the same Story Plan version loads existing research instead of
// researching again (enforced by a partial unique index on "researching"
// rows, mirroring the discovery-session/project uniqueness pattern already
// used elsewhere in Long Form).
//
// POST { projectId, regenerate?: boolean }
// Returns { project, research: { id, version, status, research_plan,
//   fact_graph, coverage, meta, sources } }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";

const PLAN_TIMEOUT_MS = 75_000;
const SEARCH_TIMEOUT_MS = 110_000; // measured real concurrent web_search latency with realistic multi-query prompts ranges up to ~78s
const EXTRACT_TIMEOUT_MS = 90_000;
const CRITIC_TIMEOUT_MS = 45_000;

const MAX_SEARCH_TASKS = 6; // initial retrieval budget — each task's model call may itself run several underlying searches
const MAX_QUERIES_PER_TASK = 3;
const MAX_GAP_TASKS = 4;
const MAX_VERSIONS_PER_PROJECT = 6;
const LOCK_STALE_MS = 6 * 60_000; // research runs longer than story planning — a claim older than this is a crashed attempt

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}

// Real, API-verified citations from the web_search tool's own grounding
// metadata — never the model recalling a URL from memory.
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

// Internal-only cost telemetry — reads the `usage` block every Responses API
// call already returns (input_tokens, output_tokens, and
// output_tokens_details.reasoning_tokens, which is a breakdown WITHIN
// output_tokens, not additional to it) and accumulates it. Purely additive:
// no prompt, schema, or pipeline behavior changes, and never sent to the
// client — see the `meta` stripping right before the handler's response.
type UsageTotals = { inputTokens: number; outputTokens: number; reasoningTokens: number; modelCalls: number; webSearchCalls: number };
function newUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, reasoningTokens: 0, modelCalls: 0, webSearchCalls: 0 };
}
function trackUsage(totals: UsageTotals, payload: any, isWebSearch = false) {
  const usage = payload?.usage;
  if (!usage) return;
  totals.inputTokens += usage.input_tokens ?? 0;
  totals.outputTokens += usage.output_tokens ?? 0;
  totals.reasoningTokens += usage.output_tokens_details?.reasoning_tokens ?? 0;
  totals.modelCalls += 1;
  if (isWebSearch) totals.webSearchCalls += 1;
}

async function callStructuredWithRepair(baseRequest: any, timeoutMs: number, schemaName: string, usageTotals?: UsageTotals) {
  try {
    const payload = await callOpenAI(baseRequest, timeoutMs);
    if (usageTotals) trackUsage(usageTotals, payload);
    return parseJson(extractOutputText(payload));
  } catch (firstError) {
    const repairRequest = {
      ...baseRequest,
      input: `${baseRequest.input}\n\nYour previous response was invalid or incomplete (${
        firstError instanceof Error ? firstError.message.slice(0, 200) : "parse error"
      }). Return ONLY a single valid JSON object that strictly matches the "${schemaName}" schema. No markdown, no commentary.`,
    };
    const payload = await callOpenAI(repairRequest, timeoutMs);
    if (usageTotals) trackUsage(usageTotals, payload);
    return parseJson(extractOutputText(payload));
  }
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

/* ============================ Pass A: Research Planner ============================ */

const RESEARCH_MODE_GUIDE = `Research strategy must adapt to what the topic actually is — do not run the same playbook for every video. A mechanism/engineering topic wants standards bodies, official documentation, and technical references. A historical topic wants scholarship, museums, universities, and primary material, while catching common myths. A business/economic topic wants company history, financial data where available, contemporary reporting, and credible retrospectives, distinguishing established chronology from disputed popular narratives. A scientific/medical topic wants peer-reviewed research and reputable institutions, with real attention to individual variation and uncertainty instead of dramatic anecdotes. A hypothetical/"what if" topic needs its evidence split into an established baseline, high-confidence derived consequences, model-dependent consequences, and speculation — never presented as equally certain. These are illustrations of the KIND of judgment to apply, not a fixed list of topic categories — reason about what THIS topic actually needs.`;

const RESEARCH_PLANNER_INSTRUCTIONS = `You are Zyvo's Research Planner for long-form 2D explainer videos. You receive a completed Story Plan (with its TopicModel and NarrativeStrategy) and must decide what evidence is actually needed before a script can be written — you do not search or write anything yourself yet.

${RESEARCH_MODE_GUIDE}

For every research question you define: state its purpose (why the script needs this answered), which chapters it feeds, how important it is, what kind of source would actually be authoritative for it, and whether an important/surprising/disputed claim like this deserves more than one independent source.

Then translate your research questions into a bounded search strategy: group related questions into a small number of focused search tasks (each task is one real research effort covering 1-3 closely related questions), and give each task 1-3 concrete search queries a search engine could actually run — specific enough to find authoritative sources, not vague topic restatements.

Identify claims likely to be disputed or mythologized (common misconceptions repeated as fact), and note where primary/authoritative sources specifically matter versus where reputable secondary scholarship is sufficient — primary sources are not automatically better; they can carry bias or outdated understanding, so recommend pairing them with modern interpretation where that matters.

Be honest about time-sensitivity: if facts could meaningfully change or need to reflect the current moment, say so.`;

function researchPlannerInput(ctx: {
  topic: string;
  topicModel: any;
  narrativeStrategy: any;
  storyPlan: any;
  resolvedLengthMinutes: number;
  resolvedExplanationDepth: string;
}) {
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
  "official_documentation",
  "government",
  "academic",
  "standards_org",
  "peer_reviewed",
  "museum",
  "reference_institution",
  "professional_org",
  "technical_documentation",
  "journalism",
  "specialist_publication",
  "book_reference",
  "community",
  "other",
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

/* ============================ Retrieval ============================ */

const RETRIEVAL_INSTRUCTIONS = `You are a fact-finding researcher for a YouTube explainer video. You will be given a research focus and specific queries — search for real, authoritative sources and report back concise, well-cited findings. Prioritize official documentation, standards bodies, government/academic institutions, peer-reviewed research, museums, and reputable specialist journalism over generic blogs, SEO content, forums, or unsourced listicles. Do not present a single blog's claim as settled fact. If sources disagree, say so explicitly. If something is commonly believed but likely a myth, flag that. Write your findings as clear prose with inline citations to the specific sources you used — do not fabricate a source that isn't one you actually found.`;

function retrievalInput(task: { focus: string; queries: string[]; targetQuestionIds: string[] }, questionLookup: Record<string, string>) {
  const questions = task.targetQuestionIds.map((id) => questionLookup[id]).filter(Boolean);
  return [
    `RESEARCH FOCUS: ${task.focus}`,
    questions.length ? `QUESTIONS THIS MUST ANSWER:\n${questions.map((q) => `- ${q}`).join("\n")}` : "",
    `SEARCH QUERIES TO RUN: ${task.queries.join(" | ")}`,
    `Find real, current, authoritative sources and report concrete findings with citations.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function runRetrieval(
  task: { id: string; focus: string; queries: string[]; targetQuestionIds: string[] },
  questionLookup: Record<string, string>,
  usageTotals?: UsageTotals
) {
  try {
    const payload = await callOpenAI(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: RETRIEVAL_INSTRUCTIONS,
        input: retrievalInput(task, questionLookup),
        tools: [{ type: "web_search", search_context_size: "medium" }],
      },
      SEARCH_TIMEOUT_MS
    );
    if (usageTotals) trackUsage(usageTotals, payload, true);
    return { taskId: task.id, focus: task.focus, text: extractOutputText(payload).trim(), citations: extractCitations(payload), failed: false };
  } catch (error) {
    console.warn(`[generate-long-form-research] search task ${task.id} failed:`, String(error));
    return { taskId: task.id, focus: task.focus, text: "", citations: [], failed: true };
  }
}

/* ============================ Pass B: Source / Fact Extractor ============================ */

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

function extractorInput(ctx: {
  storyPlan: any;
  researchPlan: any;
  findings: { focus: string; text: string }[];
  candidateSources: { id: string; url: string; title: string }[];
  existingFacts?: any[];
}) {
  const lines = [
    `STORY PLAN CHAPTERS:`,
    JSON.stringify(ctx.storyPlan.chapters.map((c: any) => ({ id: c.id, title: c.title, summary: c.summary, keyQuestions: c.keyQuestions })), null, 2),
    ``,
    `RESEARCH QUESTIONS:`,
    JSON.stringify(ctx.researchPlan.researchQuestions, null, 2),
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
          required: [
            "id",
            "claim",
            "classification",
            "confidence",
            "sourceIds",
            "chapterIds",
            "researchQuestionIds",
            "disputed",
            "disputeSummary",
            "uncertaintyNotes",
            "temporalScope",
            "geographicScope",
            "scriptUsable",
          ],
          properties: {
            id: { type: "string" },
            claim: { type: "string" },
            classification: {
              type: "string",
              enum: ["SUPPORTED_FACT", "SUPPORTED_INTERPRETATION", "REASONABLE_INFERENCE", "DISPUTED", "UNCERTAIN", "HYPOTHETICAL_ASSUMPTION"],
            },
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

/* ============================ Pass C: Coverage Critic ============================ */

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
    JSON.stringify(ctx.researchPlan.researchQuestions.map((q: any) => ({ id: q.id, question: q.question, importance: q.importance })), null, 2),
    ``,
    `SOURCES (id, tier, type):`,
    JSON.stringify(ctx.sources.map((s: any) => ({ id: s.id, qualityTier: s.qualityTier, sourceType: s.sourceType })), null, 2),
    ``,
    `FACTS:`,
    JSON.stringify(
      ctx.facts.map((f: any) => ({ id: f.id, claim: f.claim, classification: f.classification, confidence: f.confidence, sourceIds: f.sourceIds, chapterIds: f.chapterIds, disputed: f.disputed })),
      null,
      2
    ),
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
        properties: {
          chapterId: { type: "string" },
          status: { type: "string", enum: ["strong", "moderate", "weak"] },
          note: { type: "string" },
        },
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
        properties: {
          id: { type: "string" },
          focus: { type: "string" },
          queries: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 },
          targetChapterIds: { type: "array", items: { type: "string" }, maxItems: 4 },
        },
      },
    },
    overallCoverage: { type: "string", enum: ["strong", "moderate", "weak"] },
  },
};

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  if (!OPENAI_KEY) return err(req, "Research is not configured", 500);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);
  if (!project.current_story_plan_version_id) return err(req, "This project needs a Story Plan before Research can begin", 400);

  const storyPlanVersionId = project.current_story_plan_version_id;

  const { data: storyVersion } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", storyPlanVersionId).maybeSingle();
  if (!storyVersion) return err(req, "Story Plan version not found", 404);
  const storyPlan = storyVersion.story_plan;

  // Idempotent no-op: research already exists for this EXACT story plan
  // version — hand it back instead of researching again.
  if (!regenerate) {
    const { data: existing } = await admin
      .from("long_form_research_versions")
      .select("*")
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId)
      .in("status", ["ready", "needs_attention"])
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing) {
      const { data: sources } = await admin.from("long_form_research_sources").select("*").eq("research_version_id", existing.id);
      const { meta: _meta, ...existingForClient } = existing;
      return ok(req, { project, research: { ...existingForClient, sources: sources ?? [] } });
    }
  }

  if (regenerate) {
    const { count } = await admin
      .from("long_form_research_versions")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("story_plan_version_id", storyPlanVersionId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the research regeneration limit for this Story Plan.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  // Claim the lock by inserting the "researching" row itself — the partial
  // unique index on (project_id, story_plan_version_id) WHERE status =
  // 'researching' makes a concurrent duplicate insert fail with 23505.
  const { count: versionCount } = await admin
    .from("long_form_research_versions")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("story_plan_version_id", storyPlanVersionId);
  const nextVersion = (versionCount ?? 0) + 1;

  let researchVersionId: string;
  {
    const { data: inserted, error: insertError } = await admin
      .from("long_form_research_versions")
      .insert({
        project_id: projectId,
        story_plan_version_id: storyPlanVersionId,
        version: nextVersion,
        status: "researching",
        research_started_at: new Date().toISOString(),
        generation_started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Either a genuinely concurrent request, or a crashed attempt whose
        // lock is stale enough to safely reclaim.
        const { data: stuck } = await admin
          .from("long_form_research_versions")
          .select("id, generation_started_at")
          .eq("project_id", projectId)
          .eq("story_plan_version_id", storyPlanVersionId)
          .eq("status", "researching")
          .maybeSingle();

        const staleBefore = Date.now() - LOCK_STALE_MS;
        if (stuck && new Date(stuck.generation_started_at).getTime() < staleBefore) {
          await admin.from("long_form_research_versions").update({ status: "failed", generation_started_at: null }).eq("id", stuck.id);
          const { data: retried, error: retryError } = await admin
            .from("long_form_research_versions")
            .insert({
              project_id: projectId,
              story_plan_version_id: storyPlanVersionId,
              version: nextVersion + 1,
              status: "researching",
              research_started_at: new Date().toISOString(),
              generation_started_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (retryError || !retried) return err(req, "Could not start research", 500);
          researchVersionId = retried.id;
        } else {
          return err(req, "Research is already running for this Story Plan.", 409, { code: "GENERATION_IN_PROGRESS" });
        }
      } else {
        return err(req, "Could not start research", 500);
      }
    } else {
      researchVersionId = inserted!.id;
    }
  }

  const usageTotals = newUsageTotals();
  // Diagnostic-only wall-clock timing per stage, alongside the cost
  // telemetry — same internal `meta` column, same non-behavioral intent, no
  // prompt/schema/control-flow changes anywhere below.
  const timings: Record<string, number> = {};
  const runStart = Date.now();

  try {
    const topicModel = project.topic_model;
    const narrativeStrategy = project.narrative_strategy;

    // ---- PASS A: Research Planner ----
    const tPlanStart = Date.now();
    const researchPlan = await callStructuredWithRepair(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: RESEARCH_PLANNER_INSTRUCTIONS,
        input: researchPlannerInput({
          topic: project.topic,
          topicModel,
          narrativeStrategy,
          storyPlan,
          resolvedLengthMinutes: project.resolved_length_minutes,
          resolvedExplanationDepth: project.resolved_explanation_depth,
        }),
        text: { format: { type: "json_schema", name: "research_plan", strict: true, schema: RESEARCH_PLAN_SCHEMA } },
      },
      PLAN_TIMEOUT_MS,
      "research_plan",
      usageTotals
    );
    timings.planMs = Date.now() - tPlanStart;

    const questionLookup: Record<string, string> = {};
    for (const q of researchPlan.researchQuestions) questionLookup[q.id] = q.question;

    // ---- RETRIEVAL (initial, concurrent) ----
    const tInitialSearchStart = Date.now();
    const searchTasks = researchPlan.searchStrategy.slice(0, MAX_SEARCH_TASKS);
    const initialResults = await Promise.all(searchTasks.map((task: any) => runRetrieval(task, questionLookup, usageTotals)));
    timings.initialSearchMs = Date.now() - tInitialSearchStart;

    const candidateMap = new Map<string, { id: string; url: string; title: string }>();
    for (const result of initialResults) {
      for (const citation of result.citations) {
        const key = normalizeUrl(citation.url);
        if (!candidateMap.has(key)) candidateMap.set(key, { id: shortSourceId(), url: citation.url, title: citation.title });
      }
    }

    const initialSearchCalls = searchTasks.length;
    const initialFailedCalls = initialResults.filter((r) => r.failed).length;
    if (initialFailedCalls === initialSearchCalls && initialSearchCalls > 0) {
      throw new Error("All initial research searches failed");
    }

    // ---- PASS B (v1): Source / Fact Extractor ----
    const tExtractStart = Date.now();
    let candidates = Array.from(candidateMap.values());
    const v1 = await callStructuredWithRepair(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: EXTRACTOR_INSTRUCTIONS,
        input: extractorInput({
          storyPlan,
          researchPlan,
          findings: initialResults.map((r) => ({ focus: r.focus, text: r.text })),
          candidateSources: candidates,
        }),
        text: { format: { type: "json_schema", name: "research_extraction", strict: true, schema: buildExtractorSchema(candidates.map((c) => c.id)) } },
      },
      EXTRACT_TIMEOUT_MS,
      "research_extraction",
      usageTotals
    );
    timings.extractMs = Date.now() - tExtractStart;

    // ---- PASS C: Coverage Critic ----
    const tCriticStart = Date.now();
    const sourceLookupV1 = new Map(candidates.map((c) => [c.id, c]));
    const v1SourcesFull = v1.sources.map((s: any) => ({ ...s, ...sourceLookupV1.get(s.id) }));
    const coverage = await callStructuredWithRepair(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: CRITIC_INSTRUCTIONS,
        input: criticInput({ storyPlan, researchPlan, facts: v1.facts, sources: v1SourcesFull }),
        text: { format: { type: "json_schema", name: "research_coverage", strict: true, schema: CRITIC_SCHEMA } },
      },
      CRITIC_TIMEOUT_MS,
      "research_coverage",
      usageTotals
    );
    timings.criticMs = Date.now() - tCriticStart;

    // ---- GAP RETRIEVAL (only if the critic found real gaps) ----
    let gapSearchCalls = 0;
    let finalFacts = v1.facts;
    let finalSourcesFull = v1SourcesFull;

    if (Array.isArray(coverage.gapQueries) && coverage.gapQueries.length > 0) {
      const tGapSearchStart = Date.now();
      const gapTasks = coverage.gapQueries.slice(0, MAX_GAP_TASKS);
      gapSearchCalls = gapTasks.length;
      const gapResults = await Promise.all(gapTasks.map((task: any) => runRetrieval({ ...task, targetQuestionIds: [] }, {}, usageTotals)));
      timings.gapSearchMs = Date.now() - tGapSearchStart;

      for (const result of gapResults) {
        for (const citation of result.citations) {
          const key = normalizeUrl(citation.url);
          if (!candidateMap.has(key)) candidateMap.set(key, { id: shortSourceId(), url: citation.url, title: citation.title });
        }
      }
      candidates = Array.from(candidateMap.values());

      const allFindings = [...initialResults.map((r) => ({ focus: r.focus, text: r.text })), ...gapResults.map((r) => ({ focus: r.focus, text: r.text }))];

      const tFinalExtractStart = Date.now();
      const merged = await callStructuredWithRepair(
        {
          model: OPENAI_MODEL,
          store: false,
          instructions: EXTRACTOR_INSTRUCTIONS,
          input: extractorInput({ storyPlan, researchPlan, findings: allFindings, candidateSources: candidates, existingFacts: v1.facts }),
          text: { format: { type: "json_schema", name: "research_extraction", strict: true, schema: buildExtractorSchema(candidates.map((c) => c.id)) } },
        },
        EXTRACT_TIMEOUT_MS,
        "research_extraction",
        usageTotals
      );
      timings.finalExtractMs = Date.now() - tFinalExtractStart;

      const sourceLookupFinal = new Map(candidates.map((c) => [c.id, c]));
      finalFacts = merged.facts;
      finalSourcesFull = merged.sources.map((s: any) => ({ ...s, ...sourceLookupFinal.get(s.id) }));
    }

    // Deterministic, cost-free "needs_attention" heuristic — no third critic
    // pass. Genuinely thin research shouldn't quietly present as ready.
    const weakChapterCount = (coverage.chapterCoverage ?? []).filter((c: any) => c.status === "weak").length;
    const totalChapters = storyPlan.chapters.length;
    const needsAttention = finalSourcesFull.length === 0 || finalFacts.length === 0 || (totalChapters > 0 && weakChapterCount / totalChapters > 0.4);
    const status = needsAttention ? "needs_attention" : "ready";

    // ---- Persist ----
    if (finalSourcesFull.length) {
      const rows = finalSourcesFull.map((s: any) => ({
        id: s.id,
        research_version_id: researchVersionId,
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
      const { error: sourcesError } = await admin.from("long_form_research_sources").insert(rows);
      if (sourcesError) console.error("[generate-long-form-research] failed to persist sources:", sourcesError.message);
    }

    // Real per-run cost telemetry from actual `usage` blocks — not an
    // estimate. Current published rates (verified against the OpenAI
    // pricing page at implementation time): gpt-5-mini $0.25/1M input,
    // $2.00/1M output (reasoning tokens are already included within
    // output_tokens, not billed separately); web_search tool $10/1k calls
    // plus search-content tokens billed as ordinary input tokens at the
    // model's input rate (no fixed token block for gpt-5-mini, unlike
    // gpt-4o-mini/gpt-4.1-mini). Internal only — never returned to the
    // client, see the destructure right before the final response below.
    const GPT5_MINI_INPUT_PER_M = 0.25;
    const GPT5_MINI_OUTPUT_PER_M = 2.0;
    const WEB_SEARCH_PER_CALL = 0.01;
    const estimatedModelCostUsd = (usageTotals.inputTokens * GPT5_MINI_INPUT_PER_M + usageTotals.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000;
    const estimatedSearchCostUsd = usageTotals.webSearchCalls * WEB_SEARCH_PER_CALL;
    timings.totalMs = Date.now() - runStart;

    const meta = {
      initialSearchCalls,
      initialFailedCalls,
      gapSearchCalls,
      totalSources: finalSourcesFull.length,
      totalFacts: finalFacts.length,
      model: OPENAI_MODEL,
      modelCalls: usageTotals.modelCalls,
      webSearchCalls: usageTotals.webSearchCalls,
      inputTokens: usageTotals.inputTokens,
      outputTokens: usageTotals.outputTokens,
      reasoningTokens: usageTotals.reasoningTokens,
      estimatedModelCostUsd: Number(estimatedModelCostUsd.toFixed(4)),
      estimatedSearchCostUsd: Number(estimatedSearchCostUsd.toFixed(4)),
      estimatedTotalCostUsd: Number((estimatedModelCostUsd + estimatedSearchCostUsd).toFixed(4)),
      timings,
    };

    const { data: updatedVersion, error: updateError } = await admin
      .from("long_form_research_versions")
      .update({
        status,
        research_plan: researchPlan,
        fact_graph: { facts: finalFacts },
        coverage,
        meta,
        time_sensitive: researchPlan.timeSensitivity !== "low",
        research_model: OPENAI_MODEL,
        research_completed_at: new Date().toISOString(),
        generation_started_at: null,
      })
      .eq("id", researchVersionId)
      .select("*")
      .single();
    if (updateError || !updatedVersion) throw new Error("Could not finalize research version");

    const { data: updatedProject } = await admin
      .from("long_form_projects")
      .update({ current_research_version_id: researchVersionId, updated_at: new Date().toISOString() })
      .eq("id", projectId)
      .select("*")
      .single();

    const { data: finalSourceRows } = await admin.from("long_form_research_sources").select("*").eq("research_version_id", researchVersionId);

    // meta carries internal cost telemetry — never sent to the client, even
    // though it's fully persisted in the database for internal analysis.
    const { meta: _meta, ...versionForClient } = updatedVersion;
    return ok(req, { project: updatedProject ?? project, research: { ...versionForClient, sources: finalSourceRows ?? [] } });
  } catch (error) {
    await admin.from("long_form_research_versions").update({ status: "failed", generation_started_at: null }).eq("id", researchVersionId);
    console.error("generate-long-form-research failed", error);
    return err(req, "We couldn't finish researching this video.", 500);
  }
});
