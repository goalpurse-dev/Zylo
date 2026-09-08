// deno-lint-ignore-file no-explicit-any
// generate-long-form-story-plan/index.ts
//
// The first real intelligence layer for a Long Form video — NOT the script.
// Two logical AI passes over gpt-5-mini via the Responses API, mirroring
// thirty-days-planner's callOpenAI/extractOutputText/parseJson pattern
// (same model family already vetted in this codebase for "planner"-class
// structured JSON, distinct from generate-long-form-ideas' Chat Completions
// + gpt-4o-mini, which is tuned for cheap high-volume idea candidates, not
// single-shot planning quality):
//
//   PASS A — Topic Understanding: what KIND of video this actually is
//     (mechanism? lived experience? rise-and-fall? some combination?),
//     independent of format/length — produces an internal TopicModel.
//   PASS B — Narrative Director + Story Plan: given the TopicModel, decide
//     how to TELL this specific story and turn that into the polished,
//     user-facing Story Plan (title, hook, chapters, research questions).
//
// Both a manually-typed topic and a selected discovered idea funnel through
// this exact same function — a discovered idea's narrativeArchetype is
// passed only as `narrativeArchetypeHint`, a hint Pass A/B may override.
// There is deliberately no separate "manual" vs "discovery" engine.
//
// Neither pass is allowed to invent facts: anything that would need
// verification (a date, a statistic, a technical figure, a historical
// claim) must come back as a researchQuestion/researchRiskFlag, not as an
// asserted fact — the real factual layer is a later milestone.
//
// POST { projectId, regenerate?: boolean }
// Returns { project, storyPlan }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const TOPIC_TIMEOUT_MS = 45_000;
const STORY_TIMEOUT_MS = 90_000;

const WORDS_PER_MINUTE = 150; // spoken-narration average for a YouTube explainer; revisit per-narrator once Channel DNA exists
const AUTO_LENGTH_MIN = 8;
const AUTO_LENGTH_MAX = 15;
const MAX_VERSIONS_PER_PROJECT = 10;
const LOCK_STALE_MS = 90_000; // a claim older than this is assumed to be a crashed/timed-out attempt, safe to reclaim

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

// One retry with an explicit "your last output was invalid" correction —
// the same repair shape thirty-days-planner uses for its critic/repair
// pass, applied here directly to malformed/incomplete structured output
// rather than to a separate quality critique.
async function callWithRepair(baseRequest: any, timeoutMs: number, schemaName: string) {
  try {
    const payload = await callOpenAI(baseRequest, timeoutMs);
    return parseJson(extractOutputText(payload));
  } catch (firstError) {
    const repairRequest = {
      ...baseRequest,
      input: `${baseRequest.input}\n\nYour previous response was invalid or incomplete (${
        firstError instanceof Error ? firstError.message.slice(0, 200) : "parse error"
      }). Return ONLY a single valid JSON object that strictly matches the "${schemaName}" schema. No markdown, no commentary.`,
    };
    const payload = await callOpenAI(repairRequest, timeoutMs);
    return parseJson(extractOutputText(payload));
  }
}

/* ============================ Narrative primitives ============================ */

const NARRATIVE_PRIMITIVES = [
  "mechanism",
  "process",
  "mystery",
  "lived_experience",
  "survival",
  "chronology",
  "rise_and_fall",
  "cause_effect",
  "misconception",
  "hypothetical",
  "comparison",
  "biography",
  "engineering_breakdown",
  "scientific_explanation",
  "economic_explanation",
  "investigation",
  "reconstruction",
  "day_in_the_life",
  "problem_solution",
];

/* ============================ Pass A: Topic Understanding ============================ */

const TOPIC_INSTRUCTIONS = `You are Zyvo's Topic Understanding Engine for long-form 2D explainer videos. Your ONLY job is to understand what KIND of video a topic should become — you are not writing a script, a title, or chapters yet.

Topic type must generalize far beyond surface domain (history/science/tech alone is never a sufficient answer). Think in narrative primitives instead — the SHAPE of the story, not its subject:
${NARRATIVE_PRIMITIVES.map((p) => `- ${p}`).join("\n")}

Most real topics combine two or three of these, not one. A mechanism topic (how Wi-Fi works) is mechanism+process. A historical survival topic is lived_experience+survival+reconstruction. A corporate collapse is rise_and_fall+cause_effect, often with misconception baked in. A "what if" is hypothetical+cause_effect. Pick whichever combination genuinely fits — do not force a topic into a single primitive, and do not default to the same combination for every request just because it worked before.

If the user is arriving from a discovered idea, its narrativeArchetype is only a HINT of the ORIGINAL guess — you may refine it, combine it with other primitives, or override it entirely once you actually understand the topic. Do not treat it as binding.

Be honest about factuality risk. Do not resolve open factual questions yourself — a Research stage exists later. Anything that would need a real date, statistic, technical measurement, quote, or specific historical/medical claim to verify belongs in researchNeeds, not asserted as fact anywhere in your output.

Also recommend (not decide) a length and depth for THIS topic, reasoned from its actual breadth, mechanism count, and narrative complexity — a simple single mechanism rarely needs more than the low end of a typical explainer; a topic with several interacting causes, a longer timeline, or multiple things to reconstruct usually needs more room. These are recommendations only; the caller may override them with an explicit user choice.`;

function topicInput(ctx: {
  topic: string;
  selectedIdeaTitle: string | null;
  selectedIdeaAngle: string | null;
  narrativeArchetypeHint: string | null;
  lengthMode: string;
  customLengthMinutes: number | null;
  depthMode: string;
  customExplanationDepth: string | null;
}) {
  const lines = [
    `TOPIC: ${ctx.topic}`,
    `FORMAT: 2D explainer, long-form YouTube video`,
  ];
  if (ctx.selectedIdeaTitle) lines.push(`DISCOVERED IDEA TITLE: ${ctx.selectedIdeaTitle}`);
  if (ctx.selectedIdeaAngle) lines.push(`DISCOVERED IDEA ANGLE: ${ctx.selectedIdeaAngle}`);
  if (ctx.narrativeArchetypeHint) lines.push(`ORIGINAL ARCHETYPE HINT (refine or override freely): ${ctx.narrativeArchetypeHint}`);
  lines.push(
    ctx.lengthMode === "custom"
      ? `LENGTH: fixed by the user at ${ctx.customLengthMinutes} minutes — still recommend your own honest read of what the topic needs, it will simply not be used.`
      : `LENGTH: auto — your recommendedLengthMinutes will be used (clamped to a sane explainer range).`
  );
  lines.push(
    ctx.depthMode === "custom"
      ? `DEPTH: fixed by the user at "${ctx.customExplanationDepth}" — still recommend your own honest read, it will simply not be used.`
      : `DEPTH: auto — your recommendedExplanationDepth will be used.`
  );
  return lines.join("\n");
}

const TOPIC_MODEL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "canonicalTopic",
    "primaryDomain",
    "secondaryDomains",
    "topicTypes",
    "centralQuestion",
    "viewerPriorKnowledge",
    "viewerExpectedAnswer",
    "knowledgeGap",
    "coreEntities",
    "coreMechanisms",
    "likelyMisconceptions",
    "temporalScope",
    "geographicScope",
    "factualityRisk",
    "researchNeeds",
    "visualPotential",
    "recommendedNarrativeModes",
    "recommendedLengthMinutes",
    "recommendedExplanationDepth",
  ],
  properties: {
    canonicalTopic: { type: "string", description: "A clean, specific restatement of the topic." },
    primaryDomain: { type: "string" },
    secondaryDomains: { type: "array", items: { type: "string" }, maxItems: 4 },
    topicTypes: { type: "array", items: { type: "string", enum: NARRATIVE_PRIMITIVES }, minItems: 1, maxItems: 4 },
    centralQuestion: { type: "string", description: "The one question the video ultimately answers." },
    viewerPriorKnowledge: { type: "string", description: "What a typical curious viewer already knows walking in." },
    viewerExpectedAnswer: { type: "string", description: "What the viewer should understand by the end." },
    knowledgeGap: { type: "string", description: "The gap between prior knowledge and the expected answer that the video must close." },
    coreEntities: { type: "array", items: { type: "string" }, maxItems: 10 },
    coreMechanisms: { type: "array", items: { type: "string" }, maxItems: 10, description: "Mechanisms, causes, forces, or steps the video needs to explain — empty if not a mechanism-shaped topic." },
    likelyMisconceptions: { type: "array", items: { type: "string" }, maxItems: 6 },
    temporalScope: { type: "string", description: "The time span the topic covers, e.g. 'a single moment', 'several decades', 'ongoing'." },
    geographicScope: { type: "string" },
    factualityRisk: { type: "string", enum: ["low", "medium", "high"] },
    researchNeeds: { type: "array", items: { type: "string" }, maxItems: 12, description: "Concrete things that must be verified later — dates, figures, quotes, technical claims." },
    visualPotential: { type: "string", enum: ["low", "medium", "high"] },
    recommendedNarrativeModes: { type: "array", items: { type: "string", enum: NARRATIVE_PRIMITIVES }, minItems: 1, maxItems: 4 },
    recommendedLengthMinutes: { type: "integer", minimum: 5, maximum: 25 },
    recommendedExplanationDepth: { type: "string", enum: ["simple", "balanced", "deep"] },
  },
};

/* ============================ Pass B: Narrative Strategy + Story Plan ============================ */

const STORY_INSTRUCTIONS = `You are Zyvo's Narrative Director and Story Producer for long-form 2D explainer videos. You receive a structured TopicModel (already-completed topic understanding) plus the resolved length/depth for this specific video. Your job is to decide the best way to TELL this exact story, then turn that decision into a polished Story Plan — still not the script.

Do not default to one fixed template for every video. The narrative modes in the TopicModel tell you the shape this story should take; a mechanism topic wants a different structure than a lived-experience/survival topic or a rise-and-fall topic. Design chapters that reflect that specific shape.

TITLE QUALITY: avoid generic patterns like "The Fascinating World of...", "Exploring...", "Everything You Need to Know About...", "The Ultimate Guide to...". Be specific — a title should promise a specific payoff a curious viewer can picture. Return exactly one recommended title and exactly two distinct alternatives.

VIEWER PROMISE: 1-2 sentences stating exactly what the viewer will understand by the end — not marketing language, a real answer to "what will I actually know?"

HOOK CONCEPT: describe HOW the opening should pull the viewer in — the angle, the image, the question, the moment it opens on — as story architecture, not as finished narration. A few sentences, not a script.

CHAPTERS: use however many chapters this specific story actually needs (typically 5-9) — never force a fixed count. Every chapter must have a real reason to exist. Never use generic chapter titles like "Introduction", "Background", "Main Topic", "Conclusion" — a good chapter title names what actually happens or is revealed in it. estimatedMinutes across all chapters should sum to approximately the target length. Each chapter needs: a title, estimatedMinutes, a purpose (why this chapter exists in the story, not what topic it covers), a summary (what it actually covers), and keyQuestions (what research/script must answer to write it).

NEVER invent specific facts — no confident dates, statistics, quotes, technical measurements, or historical/medical claims anywhere in chapter summaries or the hook. If a chapter needs a specific fact to work, phrase it as something research must confirm, and add it to researchQuestions/researchRiskFlags instead of asserting it.

NARRATIVE LABEL must be a short, user-friendly phrase describing the story type (e.g. "Mechanism Explainer", "Historical Reconstruction", "Rise & Fall") — never an internal enum name or underscored token.`;

function storyInput(ctx: {
  topicModel: any;
  resolvedLengthMinutes: number;
  resolvedExplanationDepth: string;
  targetWords: number;
  narrativeArchetypeHint: string | null;
}) {
  return [
    `TOPIC MODEL (already understood — build on this, do not re-derive it):`,
    JSON.stringify(ctx.topicModel, null, 2),
    ``,
    `RESOLVED LENGTH: ${ctx.resolvedLengthMinutes} minutes`,
    `RESOLVED DEPTH: ${ctx.resolvedExplanationDepth}`,
    `TARGET WORD COUNT: ~${ctx.targetWords} words total (use this to judge how much a chapter can realistically cover)`,
    ctx.narrativeArchetypeHint ? `ORIGINAL ARCHETYPE HINT (already folded into topicTypes if still relevant): ${ctx.narrativeArchetypeHint}` : ``,
  ]
    .filter(Boolean)
    .join("\n");
}

const CHAPTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "estimatedMinutes", "purpose", "summary", "keyQuestions"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    estimatedMinutes: { type: "number", minimum: 0.5, maximum: 12 },
    purpose: { type: "string" },
    summary: { type: "string" },
    keyQuestions: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};

const NARRATIVE_STRATEGY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "viewerQuestion",
    "viewerPromise",
    "centralThesis",
    "primaryNarrativeMode",
    "supportingNarrativeModes",
    "openingStrategy",
    "informationRevealOrder",
    "plannedOpenLoops",
    "plannedPayoffs",
    "endingPayoff",
  ],
  properties: {
    viewerQuestion: { type: "string" },
    viewerPromise: { type: "string" },
    centralThesis: { type: "string" },
    primaryNarrativeMode: { type: "string", enum: NARRATIVE_PRIMITIVES },
    supportingNarrativeModes: { type: "array", items: { type: "string", enum: NARRATIVE_PRIMITIVES }, maxItems: 3 },
    openingStrategy: { type: "string" },
    informationRevealOrder: { type: "array", items: { type: "string" }, maxItems: 10, description: "The order in which ideas/facts should be revealed, as short labels." },
    plannedOpenLoops: { type: "array", items: { type: "string" }, maxItems: 5 },
    plannedPayoffs: { type: "array", items: { type: "string" }, maxItems: 5 },
    endingPayoff: { type: "string" },
  },
};

const STORY_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["narrativeStrategy", "storyPlan"],
  properties: {
    narrativeStrategy: NARRATIVE_STRATEGY_SCHEMA,
    storyPlan: {
      type: "object",
      additionalProperties: false,
      required: [
        "recommendedTitle",
        "alternativeTitles",
        "viewerPromise",
        "hookConcept",
        "narrativeLabel",
        "chapters",
        "researchQuestions",
        "researchRiskFlags",
      ],
      properties: {
        recommendedTitle: { type: "string" },
        alternativeTitles: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
        viewerPromise: { type: "string" },
        hookConcept: { type: "string" },
        narrativeLabel: { type: "string" },
        chapters: { type: "array", items: CHAPTER_SCHEMA, minItems: 5, maxItems: 9 },
        researchQuestions: { type: "array", items: { type: "string" }, maxItems: 15 },
        researchRiskFlags: { type: "array", items: { type: "string" }, maxItems: 10 },
      },
    },
  },
};

/* ============================ Resolution logic (Part 3) ============================ */

function resolveLengthAndDepth(project: any, topicModel: any) {
  const resolvedLengthMinutes =
    project.length_mode === "custom" && project.custom_length_minutes
      ? project.custom_length_minutes
      : Math.min(AUTO_LENGTH_MAX, Math.max(AUTO_LENGTH_MIN, Math.round(Number(topicModel.recommendedLengthMinutes) || 10)));

  const autoDepth = ["simple", "balanced", "deep"].includes(topicModel.recommendedExplanationDepth)
    ? topicModel.recommendedExplanationDepth
    : "balanced";
  const resolvedExplanationDepth = project.depth_mode === "custom" && project.custom_explanation_depth ? project.custom_explanation_depth : autoDepth;

  const targetWords = Math.round(resolvedLengthMinutes * WORDS_PER_MINUTE);

  return { resolvedLengthMinutes, resolvedExplanationDepth, targetWords };
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  if (!OPENAI_KEY) return err(req, "Story Plan generation is not configured", 500);

  const body = await req.json().catch(() => ({}));
  const projectId = String(body?.projectId ?? "").trim();
  const regenerate = body?.regenerate === true;
  if (!projectId) return err(req, "Missing projectId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (!project) return err(req, "Project not found", 404);
  if (project.user_id !== user.id) return err(req, "Forbidden", 403);

  // Idempotent no-op: a plan already exists and this isn't an explicit
  // regenerate — hand back what's already there instead of burning another
  // generation (covers a Story page remount finding status already settled).
  if (!regenerate && project.current_story_plan_version_id) {
    const { data: version } = await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", project.current_story_plan_version_id).maybeSingle();
    if (version) return ok(req, { project, storyPlan: version.story_plan });
  }

  if (regenerate) {
    const { count } = await admin.from("long_form_story_plan_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    if ((count ?? 0) >= MAX_VERSIONS_PER_PROJECT) {
      return err(req, "You've reached the regeneration limit for this project.", 429, { code: "TOO_MANY_VERSIONS" });
    }
  }

  // Optimistic lock — claim the right to generate. A concurrent request
  // (double-click, or a second Story page mount) either finds this already
  // claimed and freshly-timestamped (409, caller should just wait/poll) or
  // finds a stale claim from a crashed attempt and safely reclaims it.
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const { data: claimed } = await admin
    .from("long_form_projects")
    .update({ generation_started_at: new Date().toISOString() })
    .eq("id", projectId)
    .or(`generation_started_at.is.null,generation_started_at.lt.${staleBefore}`)
    .select("id")
    .maybeSingle();

  if (!claimed) {
    return err(req, "A Story Plan is already being generated for this project.", 409, { code: "GENERATION_IN_PROGRESS" });
  }

  try {
    const topicModel = await callWithRepair(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: TOPIC_INSTRUCTIONS,
        input: topicInput({
          topic: project.topic,
          selectedIdeaTitle: project.selected_idea_title,
          selectedIdeaAngle: project.selected_idea_angle,
          narrativeArchetypeHint: project.narrative_archetype_hint,
          lengthMode: project.length_mode,
          customLengthMinutes: project.custom_length_minutes,
          depthMode: project.depth_mode,
          customExplanationDepth: project.custom_explanation_depth,
        }),
        text: { format: { type: "json_schema", name: "topic_model", strict: true, schema: TOPIC_MODEL_SCHEMA } },
      },
      TOPIC_TIMEOUT_MS,
      "topic_model"
    );

    const { resolvedLengthMinutes, resolvedExplanationDepth, targetWords } = resolveLengthAndDepth(project, topicModel);

    const storyResult = await callWithRepair(
      {
        model: OPENAI_MODEL,
        store: false,
        instructions: STORY_INSTRUCTIONS,
        input: storyInput({
          topicModel,
          resolvedLengthMinutes,
          resolvedExplanationDepth,
          targetWords,
          narrativeArchetypeHint: project.narrative_archetype_hint,
        }),
        text: { format: { type: "json_schema", name: "story_plan_result", strict: true, schema: STORY_PLAN_SCHEMA } },
      },
      STORY_TIMEOUT_MS,
      "story_plan_result"
    );

    const { narrativeStrategy, storyPlan } = storyResult;

    const { count: versionCount } = await admin.from("long_form_story_plan_versions").select("id", { count: "exact", head: true }).eq("project_id", projectId);
    const nextVersion = (versionCount ?? 0) + 1;

    const { data: version, error: versionError } = await admin
      .from("long_form_story_plan_versions")
      .insert({ project_id: projectId, version: nextVersion, story_plan: storyPlan, generation_model: OPENAI_MODEL })
      .select("id, version, story_plan, created_at")
      .single();
    if (versionError || !version) throw new Error("Could not save story plan version");

    const { data: updatedProject, error: updateError } = await admin
      .from("long_form_projects")
      .update({
        status: "story_ready",
        topic_model: topicModel,
        narrative_strategy: narrativeStrategy,
        resolved_length_minutes: resolvedLengthMinutes,
        resolved_explanation_depth: resolvedExplanationDepth,
        target_words: targetWords,
        current_story_plan_version_id: version.id,
        generation_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .select("*")
      .single();
    if (updateError || !updatedProject) throw new Error("Could not finalize project");

    return ok(req, { project: updatedProject, storyPlan });
  } catch (error) {
    await admin
      .from("long_form_projects")
      .update({ status: "planning_failed", generation_started_at: null, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    console.error("generate-long-form-story-plan failed", error);
    return err(req, "We couldn't create the Story Plan.", 500);
  }
});
