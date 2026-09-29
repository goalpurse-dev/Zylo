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
import { requireUserOrAutopilot } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { releaseReservationIfActive } from "../_shared/longFormReservations.ts";
import { WORDS_PER_MINUTE } from "../../../src/lib/longFormPipelineConstants.ts";
import { wordsPerMinuteForProfile } from "../../../src/lib/voicePace.ts";
import { fetchActiveGenerationProfile, isStickmanProfile, nicheFromProfile } from "../_shared/stickman/recipeProfile.ts";
import { nudgeAutopilot } from "../_shared/stickman/autopilotNudge.ts";
import { nicheGuidanceFor } from "../_shared/stickman/nicheGuidance.ts";
import { enforceStickmanTitleRules, validateStickmanSectionShape, validateStickmanCallbackTiming } from "../_shared/stickman/scriptChecks.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { recordCost } from "../_shared/costLedger.ts";
import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const TOPIC_TIMEOUT_MS = 45_000;
const STORY_TIMEOUT_MS = 90_000;
// WORDS_PER_MINUTE (Phase 0, Section C.1) now comes from the shared
// src/lib/longFormPipelineConstants.ts — see that file for why (it used to
// independently disagree with the frontend's own display estimate).
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

// Phase 6d-1: every call's tokens are summed per request (AsyncLocalStorage,
// safe with concurrent requests in one isolate) and written to the cost ledger.
type Usage = { calls: number; inputTokens: number; outputTokens: number };
const usageStore = new AsyncLocalStorage<Usage>();
async function callOpenAI(request: any, timeoutMs: number) {
  const response = await fetch(OPENAI_RESPONSES, {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const payload = await response.json();
  const acc = usageStore.getStore();
  if (acc) { acc.calls++; acc.inputTokens += payload?.usage?.input_tokens ?? 0; acc.outputTokens += payload?.usage?.output_tokens ?? 0; }
  return payload;
}
const storyPlanUsd = (u: Usage) => (u.inputTokens * GPT5_MINI_INPUT_PER_M + u.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000;

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

/* ============================ Pass B, STICKMAN BRANCH — viral explainer Story Plan ============================ */
// Phase 1 "Stickman Script Mode" — completely separate constants from
// TOPIC_INSTRUCTIONS/STORY_INSTRUCTIONS/CHAPTER_SCHEMA/STORY_PLAN_SCHEMA/
// storyInput above, which stay byte-identical for the legacy/documentary
// recipe. Pass A (Topic Understanding) is shared unbranched — deciding
// "what kind of story is this" is genuinely recipe-agnostic; only Pass B
// (how to structure and title it) differs for a viral stickman explainer.

const STICKMAN_STORY_INSTRUCTIONS = `You are Zyvo's Narrative Director for Stickman Doodle Explainer videos — short, punchy, viral-style YouTube explainers narrated over simple animated stickman illustrations. You receive a structured TopicModel plus the resolved length/depth for this specific video. Your job is to turn it into a Story Plan built for RETENTION and CURIOSITY, not a documentary structure.

STEP 1 — ANGLE SELECTION (do this BEFORE planning sections): from your own general knowledge, generate exactly 5 candidateAngles — genuinely different answers to the title's core question (different mechanisms, causes, or explanations, not five phrasings of the same idea). Score each 1-10 on surpriseScore (how much it subverts the viewer's assumption), relatabilityScore (how easily a viewer connects it to their own life/body/experience), visualPotentialScore (how easily a stickman-doodle scene could show it), and payoffScore (how satisfying it would feel as the answer). Mark selected:true on the 3-4 angles you choose as the spine of the evidence sections — pick for the best COMBINATION of scores, not just the single highest one, and make sure the selected set together tells a complete, non-redundant story. Mark selected:true on exactly one further angle as isTwistOrPayoffAngle: the SINGLE most surprising true angle of the 5 — this becomes the twist section (if the topic supports an honest one) or the core reveal of the callback_payoff. A later research pass will find sources to SUPPORT whichever angles you pick here — it never gets to pick the angles itself, so choose the version of this story you'd actually want to watch.

TITLE: follow a proven high-retention format — "What Did [Group] Do [X]?", "How Did [Group] Survive [X]?", "Why Don't We [X]?", "What If [X]?", "Why Do You [X]?", or "The [Name] Effect" — adapted naturally to this specific topic, never forced. The title must be 60 characters or fewer, contain no colon, and never give away the answer — it should create a genuine curiosity gap. It must be SPECIFIC to this exact video: if the same title could plausibly headline 5 different videos, it is too generic and must be rewritten. If a DISCOVERED IDEA TITLE was given, keep it as recommendedTitle exactly — do not rewrite it into something else, only propose alternativeTitles in the same spirit if useful.

STEP 2 — SECTIONS WITH A BEAT SHEET (never chapters — internal planning labels only, NEVER spoken aloud as headings in the finished video): structure the story as, in this exact order:
1. cold_open — the opening hook moment. Drop the viewer INTO a moment (a body, a place, a sensation) — never narrate about the topic from outside it. This is a SHORT, PURE scene — no analysis, no explanation, nothing about barriers/reasons/factors. Just the moment.
2. stakes — why this matters, in ONE short sentence or fragment. Not a preview of the evidence to come — just the stakes.
3. core_question — the single question this video promises to answer, as ONE question sentence. Do NOT preview the answer, do NOT list the categories of reasons/barriers/factors you're about to cover — go straight from the question into the first piece of evidence.
4. evidence — one section per SELECTED angle from Step 1 (so 3-4 evidence sections, each built around one chosen angle as its sub-question). This is the bulk of the video — the section built on your strongest-scoring selected angle should carry the most weight and get the most specific, numbers-rich treatment.
5. twist (OPTIONAL, at most one) — built around your isTwistOrPayoffAngle, as an honest complication or "but here's the thing" pivot, if it works better as a twist than saved for the payoff. Omit entirely if the isTwistOrPayoffAngle instead belongs in callback_payoff.
6. callback_payoff — pays off the planted detail AND, if not already used as the twist, delivers the isTwistOrPayoffAngle as the final reveal. Must land on NEW meaning, never a recap of 2 or more stats/points already stated elsewhere.
7. closer — lands on ONE resonant final image or idea, in short fragments — never a numbered or listed recap of the sections above.

Every section needs: id, title, role, estimatedMinutes, purpose, summary, keyQuestions, subQuestion (required non-empty for "evidence", empty string otherwise), targetWords, and picturableMoments.
- targetWords: a rough per-section word estimate — code will replace this with the real, fixed-shape budget afterward (cold_open/stakes/core_question stay short and punchy by design; evidence carries most of the length), so don't overthink this number, just give a reasonable guess proportional to how much each section needs to say.
- picturableMoments: 3-6 concrete, specific, real-world things this section could be ABOUT — a specific action a person/animal does, an object, a concrete comparison, a specific number or measurement. These are content ideas for the separate visual team to illustrate later — write them as plain facts/scenarios ("A male lion eats about seven kilos of meat a day", "A customs officer opens a crate at a border checkpoint"), never as an instruction to picture, see, imagine, or visualize anything, and never phrased as a description of a screen, icon, animation, or graphic. The eventual narration will state these as facts, in its own voice — it will never tell the viewer to picture, see, imagine, or visualize them, and it will never describe on-screen elements (icons, arrows, split screens, animations, stickers, charts, maps).

CALLBACK: plan exactly ONE callback — a specific, concrete detail (an object, a number, an image, a phrase) that can be planted within the first 25% of the script's runtime and explicitly paid off again near the end. Describe it as callbackPlan: {detail, plantSectionId, payoffSectionId} — detail is a plain description of the specific thing being planted and paid off (not finished narration prose, the actual writing happens later), plantSectionId must be an early section's id (within the first 25% of total estimated runtime), payoffSectionId must be the callback_payoff section's id.

THUMBNAIL CONCEPT: propose thumbnailConcept: {headline, scene} — headline is 1 to 3 words, ALL CAPS, usually ending in "?"; scene is a short plain description of the visual moment the thumbnail should depict.

NEVER invent specific facts — no confident dates, statistics, quotes, technical measurements, or historical/medical claims anywhere in section summaries, the hook, or the callback detail. If a section needs a specific fact to work, phrase it as something research must confirm, and add it to researchQuestions/researchRiskFlags instead of asserting it. This applies to summaries/purposes/keyQuestions only — candidateAngles themselves are your own general-knowledge hypotheses about the ANSWER, not asserted facts; they get verified or softened later.

VIEWER PROMISE and HOOK CONCEPT follow the same bar as any other explainer: a real, specific answer to "what will I actually know?", and a concrete description of how the cold_open should pull the viewer in.`;

const STICKMAN_CANDIDATE_ANGLE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["angle", "surpriseScore", "relatabilityScore", "visualPotentialScore", "payoffScore", "selected", "isTwistOrPayoffAngle"],
  properties: {
    angle: { type: "string", description: "A genuinely distinct candidate answer/explanation, in your own words — a hypothesis to be verified later, not an asserted fact." },
    surpriseScore: { type: "number", minimum: 1, maximum: 10 },
    relatabilityScore: { type: "number", minimum: 1, maximum: 10 },
    visualPotentialScore: { type: "number", minimum: 1, maximum: 10 },
    payoffScore: { type: "number", minimum: 1, maximum: 10 },
    selected: { type: "boolean", description: "true if this angle became one of the evidence sections' sub-questions." },
    isTwistOrPayoffAngle: { type: "boolean", description: "true for exactly one angle overall — the single most surprising one, used as the twist section or the callback_payoff's core reveal." },
  },
};

const STICKMAN_SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "role", "estimatedMinutes", "purpose", "summary", "keyQuestions", "subQuestion", "targetWords", "picturableMoments"],
  properties: {
    id: { type: "string" },
    title: { type: "string", description: "Internal planning label only — never spoken aloud or shown as an on-screen heading." },
    role: { type: "string", enum: ["cold_open", "stakes", "core_question", "evidence", "twist", "callback_payoff", "closer"] },
    estimatedMinutes: { type: "number", minimum: 0.1, maximum: 12 },
    purpose: { type: "string" },
    summary: { type: "string" },
    keyQuestions: { type: "array", items: { type: "string" }, maxItems: 6 },
    subQuestion: { type: "string", description: "The specific sub-question this section answers. Required (non-empty) when role is 'evidence'; an empty string for every other role." },
    targetWords: { type: "number", minimum: 10, description: "This section's share of the total word budget — all sections' targetWords should sum close to the video's total target word count." },
    picturableMoments: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" }, description: "3-6 concrete, showable images for this section (a person/object/comparison/on-screen number) — never an abstract idea." },
  },
};

const STICKMAN_CALLBACK_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["detail", "plantSectionId", "payoffSectionId"],
  properties: {
    detail: { type: "string" },
    plantSectionId: { type: "string" },
    payoffSectionId: { type: "string" },
  },
};

const STICKMAN_THUMBNAIL_CONCEPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "scene"],
  properties: {
    headline: { type: "string" },
    scene: { type: "string" },
  },
};

const STICKMAN_STORY_PLAN_SCHEMA = {
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
        "candidateAngles",
        "chapters",
        "callbackPlan",
        "thumbnailConcept",
        "researchQuestions",
        "researchRiskFlags",
      ],
      properties: {
        recommendedTitle: { type: "string" },
        alternativeTitles: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
        viewerPromise: { type: "string" },
        hookConcept: { type: "string" },
        narrativeLabel: { type: "string" },
        candidateAngles: { type: "array", items: STICKMAN_CANDIDATE_ANGLE_SCHEMA, minItems: 5, maxItems: 5 },
        chapters: { type: "array", items: STICKMAN_SECTION_SCHEMA, minItems: 6, maxItems: 10 },
        callbackPlan: STICKMAN_CALLBACK_PLAN_SCHEMA,
        thumbnailConcept: STICKMAN_THUMBNAIL_CONCEPT_SCHEMA,
        researchQuestions: { type: "array", items: { type: "string" }, maxItems: 15 },
        researchRiskFlags: { type: "array", items: { type: "string" }, maxItems: 10 },
      },
    },
  },
};

function stickmanStoryInput(ctx: {
  topicModel: any;
  resolvedLengthMinutes: number;
  resolvedExplanationDepth: string;
  targetWords: number;
  narrativeArchetypeHint: string | null;
  selectedIdeaTitle: string | null;
  selectedIdeaAngle: string | null;
  niche: string | null;
  repairNote?: string;
}) {
  const guidance = nicheGuidanceFor(ctx.niche);
  const lines = [
    `TOPIC MODEL (already understood — build on this, do not re-derive it):`,
    JSON.stringify(ctx.topicModel, null, 2),
    ``,
    `RESOLVED LENGTH: ${ctx.resolvedLengthMinutes} minutes`,
    `RESOLVED DEPTH: ${ctx.resolvedExplanationDepth}`,
    `TARGET WORD COUNT: ~${ctx.targetWords} words total (use this to judge how much a section can realistically cover)`,
    ``,
    `NICHE GUIDANCE${ctx.niche ? ` (${ctx.niche})` : " (no niche selected — use general guidance)"}:`,
    `- Tone: ${guidance.tone}`,
    `- Typical evidence types for this niche: ${guidance.evidenceTypes}`,
    `- Proven title formulas for this niche (adapt one, don't reuse verbatim): ${guidance.titleFormulas.join(" | ")}`,
    `- How the cold open should feel in this niche (an example of the STYLE, invent your own specific scene, never reuse this literally): ${guidance.coldOpenStyle}`,
    `- Evidence shape for this niche — how the evidence sections should be internally structured: ${guidance.evidenceShape}`,
    `- Typical credible sources a viewer would expect for this niche: ${guidance.typicalSources}`,
    `- Pitfalls to avoid for this specific niche: ${guidance.pitfalls.join("; ")}`,
  ];
  if (ctx.selectedIdeaTitle) lines.push(``, `DISCOVERED IDEA TITLE (keep this as recommendedTitle exactly): ${ctx.selectedIdeaTitle}`);
  if (ctx.selectedIdeaAngle) lines.push(`DISCOVERED IDEA ANGLE (build the hookConcept/viewerPromise around this): ${ctx.selectedIdeaAngle}`);
  if (ctx.narrativeArchetypeHint) lines.push(`ORIGINAL ARCHETYPE HINT (already folded into topicTypes if still relevant): ${ctx.narrativeArchetypeHint}`);
  if (ctx.repairNote) lines.push(``, `YOUR PREVIOUS ATTEMPT HAD A STRUCTURAL PROBLEM — FIX THIS EXACTLY:`, ctx.repairNote);
  return lines.join("\n");
}

// Phase 1e — deterministic safety net for the beat sheet's word budgets:
// proportionally rescale every section's targetWords so they sum EXACTLY to
// the real total, preserving the model's relative weighting (an evidence
// section asked for 2x a stakes section keeps that ~2x ratio) rather than
// distributing the rounding error evenly or ignoring it. Never lets a
// model's arithmetic mistake leave the draft with a budget that can't
// possibly sum to the target.
//
// Phase 1g — REPLACES letting the model pick each section's targetWords
// (Phase 1e's version of this function just rescaled the model's own
// numbers proportionally). Real incident this fixes: the model gave
// "stakes" 90 words and "core_question" 60 — far more than a punchy stakes
// line or a single question sentence needs — so the draft filled that
// space with a table-of-contents preview ("five concrete barriers...
// Ecology limits... Law can...") instead of real content, and the
// strongest evidence angle got squeezed into one vague, number-free
// sentence. Now the SHAPE (word range per role) is a fixed, code-owned
// rule, never left to the model to invent per topic:
// cold_open 40-70 (pure scene), stakes <=15 (one line), core_question
// <=25 (one question), twist 100-160, callback_payoff 60-100, closer
// 40-80 — and evidence sections together get ~70% of the total, weighted
// by each section's own originating angle's combined score (surprise +
// relatability + visual + payoff) so the strongest angle earns the most
// room instead of an equal, generic split.
const STICKMAN_BEAT_RANGES: Record<string, [number, number]> = {
  cold_open: [40, 70],
  stakes: [1, 15],
  core_question: [1, 25],
  twist: [100, 160],
  callback_payoff: [60, 100],
  closer: [40, 80],
};
const STICKMAN_BEAT_MIDPOINT: Record<string, number> = {
  cold_open: 55,
  stakes: 12,
  core_question: 20,
  twist: 130,
  callback_payoff: 80,
  closer: 60,
};
const STICKMAN_EVIDENCE_SHARE = 0.7;

function angleStrength(angle: any): number {
  return (Number(angle?.surpriseScore) || 0) + (Number(angle?.relatabilityScore) || 0) + (Number(angle?.visualPotentialScore) || 0) + (Number(angle?.payoffScore) || 0);
}

function computeStickmanBeatWordBudgets(chapters: any[], candidateAngles: any[], totalTargetWords: number): any[] {
  const evidenceChapters = chapters.filter((c) => c.role === "evidence");
  const nonEvidenceChapters = chapters.filter((c) => c.role !== "evidence");

  const evidenceTotal = Math.round(totalTargetWords * STICKMAN_EVIDENCE_SHARE);
  const nonEvidenceTotal = Math.max(0, totalTargetWords - evidenceTotal);

  const nonEvidenceWeightSum = nonEvidenceChapters.reduce((s, c) => s + (STICKMAN_BEAT_MIDPOINT[c.role] ?? 40), 0) || 1;
  const wordsByChapterId: Record<string, number> = {};
  for (const c of nonEvidenceChapters) {
    const weight = STICKMAN_BEAT_MIDPOINT[c.role] ?? 40;
    let words = Math.round((weight / nonEvidenceWeightSum) * nonEvidenceTotal);
    const range = STICKMAN_BEAT_RANGES[c.role];
    if (range) words = Math.min(range[1], Math.max(range[0], words));
    wordsByChapterId[c.id] = words;
  }

  // Evidence chapters are generated one-per-selected-angle, in the same
  // order the angles appear in candidateAngles (the draft prompt's own
  // instruction: "one section per SELECTED angle") — so the i-th evidence
  // chapter is weighted by the i-th selected, non-twist angle's strength.
  const nonTwistSelectedAngles = (candidateAngles ?? []).filter((a) => a?.selected && !a?.isTwistOrPayoffAngle);
  const strengths = evidenceChapters.map((_, i) => angleStrength(nonTwistSelectedAngles[i]) || 1);
  const strengthSum = strengths.reduce((s, v) => s + v, 0) || 1;
  evidenceChapters.forEach((c, i) => {
    wordsByChapterId[c.id] = Math.max(60, Math.round((strengths[i] / strengthSum) * evidenceTotal));
  });

  const chaptersWithBudgets = chapters.map((c) => ({ ...c, targetWords: wordsByChapterId[c.id] ?? c.targetWords ?? 60 }));

  // Rounding can drift the sum by a few words — correct it entirely on the
  // single largest EVIDENCE section (the one best able to absorb ±5 words
  // without leaving its fixed-role range) rather than leaving a silent
  // mismatch or nudging a tightly-capped role (like stakes) out of range.
  const drift = totalTargetWords - chaptersWithBudgets.reduce((s, c) => s + c.targetWords, 0);
  if (drift !== 0) {
    const evidenceInResult = chaptersWithBudgets.filter((c) => c.role === "evidence");
    const biggest = (evidenceInResult.length ? evidenceInResult : chaptersWithBudgets).reduce((max, c) => (c.targetWords > max.targetWords ? c : max), (evidenceInResult.length ? evidenceInResult : chaptersWithBudgets)[0]);
    biggest.targetWords += drift;
  }
  return chaptersWithBudgets;
}

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

  const { user, authError, internal } = await requireUserOrAutopilot(req);
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

  // Phase 1 "Stickman Script Mode" — the active generation profile always
  // exists by this point (create-long-form-production-setup creates it
  // before the project ever leaves "planning" for the Story page). Niche
  // has no dedicated column; it only ever lives in the profile's
  // raw_setup_snapshot (see recipeProfile.ts's own comment).
  const profile = await fetchActiveGenerationProfile(admin, projectId);
  const isStickman = isStickmanProfile(profile);
  const niche = nicheFromProfile(profile);

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

  // Phase 6d-1: the story plan's calls go into the cost ledger (success or failure).
  const usage: Usage = { calls: 0, inputTokens: 0, outputTokens: 0 };
  return await usageStore.run(usage, async () => {
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

    const resolvedLength = resolveLengthAndDepth(project, topicModel);
    const { resolvedLengthMinutes, resolvedExplanationDepth } = resolvedLength;
    // Phase 2c — Stickman targets the SELECTED voice's measured pace
    // (src/lib/voicePace.ts; 145 when uncalibrated). Legacy is untouched.
    const targetWords = isStickman ? Math.round(resolvedLengthMinutes * wordsPerMinuteForProfile(profile).wordsPerMinute) : resolvedLength.targetWords;

    let narrativeStrategy: any;
    let storyPlan: any;

    if (isStickman) {
      let storyResult = await callWithRepair(
        {
          model: OPENAI_MODEL,
          store: false,
          instructions: STICKMAN_STORY_INSTRUCTIONS,
          input: stickmanStoryInput({
            topicModel,
            resolvedLengthMinutes,
            resolvedExplanationDepth,
            targetWords,
            narrativeArchetypeHint: project.narrative_archetype_hint,
            selectedIdeaTitle: project.selected_idea_title,
            selectedIdeaAngle: project.selected_idea_angle,
            niche,
          }),
          text: { format: { type: "json_schema", name: "stickman_story_plan_result", strict: true, schema: STICKMAN_STORY_PLAN_SCHEMA } },
        },
        STORY_TIMEOUT_MS,
        "stickman_story_plan_result"
      );

      // One bounded, targeted repair for the section-shape invariant (order
      // and evidence-count, which a json_schema enum can't express on its
      // own) — same "your previous attempt was invalid, fix this exactly"
      // pattern callWithRepair already uses for malformed JSON, applied one
      // level up for a semantic (not parse) violation. If it's still wrong
      // after one repair, proceed anyway rather than blocking Story Plan
      // entirely over a structural shape issue Script's own downstream
      // checks can still work around.
      let shapeIssues = [
        ...validateStickmanSectionShape(storyResult.storyPlan.chapters),
        ...validateStickmanCallbackTiming(storyResult.storyPlan.callbackPlan, storyResult.storyPlan.chapters),
      ];
      if (shapeIssues.length) {
        const repairNote = shapeIssues.map((i) => i.message).join(" ");
        storyResult = await callWithRepair(
          {
            model: OPENAI_MODEL,
            store: false,
            instructions: STICKMAN_STORY_INSTRUCTIONS,
            input: stickmanStoryInput({
              topicModel,
              resolvedLengthMinutes,
              resolvedExplanationDepth,
              targetWords,
              narrativeArchetypeHint: project.narrative_archetype_hint,
              selectedIdeaTitle: project.selected_idea_title,
              selectedIdeaAngle: project.selected_idea_angle,
              niche,
              repairNote,
            }),
            text: { format: { type: "json_schema", name: "stickman_story_plan_result", strict: true, schema: STICKMAN_STORY_PLAN_SCHEMA } },
          },
          STORY_TIMEOUT_MS,
          "stickman_story_plan_result"
        );
      }

      narrativeStrategy = storyResult.narrativeStrategy;
      storyPlan = storyResult.storyPlan;

      // Deterministic, unconditional title guarantees (Phase 1, Section 2) —
      // applied whether the title came from the model or was kept verbatim
      // from a selected idea. Never blocks the stage; only ever tightens.
      const { title: enforcedTitle } = enforceStickmanTitleRules(
        project.selected_idea_title && storyPlan.recommendedTitle === project.selected_idea_title
          ? project.selected_idea_title
          : storyPlan.recommendedTitle
      );
      storyPlan = { ...storyPlan, recommendedTitle: enforcedTitle };

      // Phase 1g — the model's own per-section targetWords guesses (whatever
      // it output to satisfy the schema) are discarded and replaced entirely
      // with code-computed, role-shaped budgets — see
      // computeStickmanBeatWordBudgets's own comment for why (a real
      // incident: model-chosen budgets gave "stakes"/"core_question" far
      // more room than a punchy line or one question needs, which the draft
      // then filled with a table-of-contents preview instead of content).
      storyPlan = { ...storyPlan, chapters: computeStickmanBeatWordBudgets(storyPlan.chapters, storyPlan.candidateAngles, targetWords) };
    } else {
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
      narrativeStrategy = storyResult.narrativeStrategy;
      storyPlan = storyResult.storyPlan;
    }

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
    // Phase 6a: the Stickman autopilot starts research-lite right away.
    if (isStickman) nudgeAutopilot(projectId);

    return ok(req, { project: updatedProject, storyPlan });
  } catch (error) {
    await admin
      .from("long_form_projects")
      .update({ status: "planning_failed", generation_started_at: null, updated_at: new Date().toISOString() })
      .eq("id", projectId);
    // Phase 0, Section B — a Story Plan failure can happen AFTER
    // create-long-form-production-setup already reserved credits for this
    // project (Story Plan runs on its own page, separate from Setup) —
    // exactly the "terminal failure before any spend" case.
    // Phase 6a: an autopilot call is retried by the autopilot (and a final
    // failure offers a FREE retry), so the reservation must stay in place.
    if (!internal) await releaseReservationIfActive(admin, projectId, "story_plan_failed", logEvent);
    console.error("generate-long-form-story-plan failed", error);
    return err(req, "We couldn't create the Story Plan.", 500);
  } finally {
    if (usage.calls) await recordCost(admin, { projectId, stage: "story_plan", provider: "openai", model: OPENAI_MODEL, units: { ...usage }, usd: storyPlanUsd(usage), sourceTable: "long_form_projects", sourceId: projectId });
  }
  });
});
