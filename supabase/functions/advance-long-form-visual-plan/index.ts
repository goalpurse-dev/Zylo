// deno-lint-ignore-file no-explicit-any
// advance-long-form-visual-plan/index.ts
//
// The durable worker behind the VisualBeat Director + Rough Storyboard.
// Same proven shape as advance-long-form-research/advance-long-form-script
// (durable stage machine, self-chained dispatch, claim/lease via SKIP
// LOCKED) but deliberately only TWO stages — this is explicitly NOT meant
// to become a many-stage worker just because Research needed one:
//
//   planning (the one main Visual Director call, with its own bounded
//   inline repair if deterministic validation fails — no separate repair
//   stage) → finalizing (zero-cost: re-validate, compute storyboard
//   economics, persist)
//
// No Visual/Continuity/Storyboard/Entity Critic calls — deterministic
// validators do everything a critic call would otherwise be paid for.
//
// Visual Plan consumes the READY Script; it never re-researches and never
// attaches web_search. Input is the ScriptDocument + NarrativeStrategy +
// StoryPlan + a compact list of usable facts — never raw retrieval notes,
// full sources, or the whole FactGraph.
//
// Auth: NOT user-facing — invoked only by start-long-form-visual-plan's
// dispatch or this function's own self-chain, both presenting the shared
// x-cron-secret header.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { establishFirstSetups } from "../_shared/visualPlanDeterministic.js";
import { refineVisualSequences, retimeVisualBeats, visualDensity } from "../_shared/visualShotPlanning.js";
import { compileContractBatch, batchSegmentsByChapter, NARRATION_CONTRACT_COMPILER_VERSION } from "../_shared/narrationVisualContract.ts";
import { validatePlanContract, sequenceEpisode, canonicalizePlanCast } from "../_shared/visualDirectorReliability.js";
import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_PLAN_ADVANCE_SECRET") ?? "";
const RECOVERY_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
// Same benchmarking rationale as Script: already proven on comparably
// large structured-output planning tasks (Research's planner, Script's
// draft). Do not upgrade without measuring a materially cheaper or
// materially better alternative against real output first.
const OPENAI_MODEL = "gpt-5-mini";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-plan`;

const VISUAL_PLAN_PAUSED = (Deno.env.get("LONG_FORM_VISUAL_PLAN_PAUSED") ?? "").trim().toLowerCase() === "true";

// A single call asking for 80-110 detailed VisualBeats is plausibly one of
// the largest structured-output requests in this system — generous timeout,
// but still comfortably inside the platform's per-invocation ceiling; the
// async stage machine (not a bigger timeout) is the real protection against
// the flat 150s gateway idle-timeout already hit twice by Research.
const PLAN_TIMEOUT_MS = 240_000;
const MAX_STAGE_ATTEMPTS = 3;
const MAX_REPAIR_CALLS = 1;
const MAX_VISUAL_PLAN_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_VISUAL_PLAN_COST_USD") ?? 0.3);

// Phase 0, Section C.3 — GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M now imported
// from the shared constants module above.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ============================ OpenAI plumbing ============================ */
// No web_search code path anywhere in this file — same discipline as
// advance-long-form-script.

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
// Single attempt only — same reasoning as Research/Script's callStructured:
// the orchestration layer's attempt/backoff/reclaim handles retries via a
// fresh invocation. `instructions` is always the fixed VISUAL_DIRECTOR_
// INSTRUCTIONS constant, never rebuilt per request — prompt-caching
// friendly, same discipline as Script.
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
  meta.estimatedTotalCostUsd = meta.estimatedModelCostUsd; // no search cost, ever
  meta.callLedger = [...(meta.callLedger ?? []), ...(newLedgerEntry ? [newLedgerEntry] : [])];
  return { ...meta, ...(extra ?? {}) };
}

/* ============================ Compact evidence for factual visual constraints ============================ */
// Never the whole FactGraph, never raw sources — just id+claim for facts a
// visual claim might need to cite, exactly mirroring Script's
// ScriptEvidencePack philosophy (compress to WHAT is supported).
function compactFacts(factGraph: any): { id: string; claim: string }[] {
  return (factGraph?.facts ?? []).filter((f: any) => f.scriptUsable !== false).map((f: any) => ({ id: f.id, claim: f.claim }));
}

/* ============================ Schema ============================ */

const ENTITY_CATEGORIES = ["CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE", "DIAGRAM_SUBJECT"];
const ENTITY_IMPORTANCE = ["HERO", "RECURRING", "INCIDENTAL"];
const REFERENCE_PRIORITY = ["high", "medium", "low"];
const VISUAL_TYPES = ["STORY_ILLUSTRATION", "ENVIRONMENT", "CHARACTER", "OBJECT_DETAIL", "DIAGRAM", "MAP", "COMPARISON", "CUTAWAY", "TIMELINE", "PROGRAMMATIC_GRAPHIC"];
const SHOT_STRATEGIES = ["NEW_SETUP", "REUSE_WITH_DELTA", "INSERT", "DETAIL", "DIAGRAM", "MAP", "COMPARISON", "TEXT_INFOGRAPHIC"];
const RENDER_METHODS = ["GENERATE", "EDIT", "REUSE", "CROP", "COMPOSITE", "PROGRAMMATIC_GRAPHIC"];
const SHOT_SIZES = ["WIDE", "MEDIUM", "CLOSE", "DETAIL", "INSERT"];
const VISUAL_MODES = ["STORY", "EXPLAINER", "HYBRID"];

const KEY_VALUE_SCHEMA = { type: "object", additionalProperties: false, required: ["key", "value"], properties: { key: { type: "string" }, value: { type: "string" } } };

function buildEntitySchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "category", "name", "importance", "referenceNeeded", "referencePriority"],
    properties: {
      id: { type: "string" },
      category: { type: "string", enum: ENTITY_CATEGORIES },
      name: { type: "string" },
      importance: { type: "string", enum: ENTITY_IMPORTANCE },
      referenceNeeded: { type: "boolean" },
      referencePriority: { type: "string", enum: REFERENCE_PRIORITY },
    },
  };
}

function buildContinuityGroupSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["id", "label", "locationId", "cameraAnchors", "importantProps", "persistentEntityIds", "inheritedState"],
    properties: {
      id: { type: "string" },
      label: { type: "string" },
      locationId: { type: ["string", "null"] },
      cameraAnchors: { type: "array", items: { type: "string" } },
      importantProps: { type: "array", items: { type: "string" } },
      persistentEntityIds: { type: "array", items: { type: "string" } },
      // Sparse key/value pairs, not a fixed object — WorldState stays
      // whatever variables this specific topic actually needs (timeOfDay,
      // weather, outfit, propState, ...), never a universal RPG schema.
      inheritedState: { type: "array", items: KEY_VALUE_SCHEMA },
    },
  };
}

function buildVisualBeatSchema(chapterIds: string[], segmentIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "id", "chapterId", "sequenceIndex", "narrationSegmentIds", "estimatedStartSeconds", "estimatedEndSeconds",
      "informationToCommunicate", "narrativeFunction", "revealConstraints", "visualType", "shotStrategy", "renderMethod",
      "shotSize", "continuityGroupId", "primaryEntityIds", "supportingEntityIds", "locationId", "baseSetupKey",
      "deltaInstruction", "factualVisualConstraints", "forbiddenElements",
    ],
    properties: {
      id: { type: "string" },
      chapterId: { type: "string", enum: chapterIds },
      sequenceIndex: { type: "number" },
      narrationSegmentIds: { type: "array", items: { type: "string", enum: segmentIds.length ? segmentIds : ["__none__"] } },
      estimatedStartSeconds: { type: "number" },
      estimatedEndSeconds: { type: "number" },
      informationToCommunicate: { type: "string", description: "What information the image must convey — never a literal restatement of the narration sentence." },
      narrativeFunction: { type: "string" },
      revealConstraints: { type: "array", items: { type: "string" }, description: "Anti-spoiler notes: what must NOT be visible before the narration reveals it." },
      visualType: { type: "string", enum: VISUAL_TYPES },
      shotStrategy: { type: "string", enum: SHOT_STRATEGIES },
      renderMethod: { type: "string", enum: RENDER_METHODS },
      shotSize: { type: "string", enum: SHOT_SIZES },
      continuityGroupId: { type: ["string", "null"] },
      primaryEntityIds: { type: "array", items: { type: "string" } },
      supportingEntityIds: { type: "array", items: { type: "string" } },
      locationId: { type: ["string", "null"] },
      baseSetupKey: { type: ["string", "null"], description: "Shared key across beats reusing the same base generation, e.g. 'longhouse_hearth_cam_A' — deliberately reused across beats to minimize expensive generations." },
      deltaInstruction: { type: ["string", "null"], description: "What changes relative to the base setup — required whenever shotStrategy is REUSE_WITH_DELTA." },
      factualVisualConstraints: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["description", "factIds"], properties: { description: { type: "string" }, factIds: { type: "array", items: { type: "string", enum: factIds.length ? factIds : ["__none__"] } } } },
      },
      forbiddenElements: { type: "array", items: { type: "string" } },
    },
  };
}

function buildVisualPlanSchema(chapterIds: string[], segmentIds: string[], factIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["visualMode", "visualMix", "entityRegistry", "continuityGroups", "visualBeats", "visualPayoffs"],
    properties: {
      visualMode: { type: "string", enum: VISUAL_MODES },
      visualMix: {
        type: "object",
        additionalProperties: false,
        required: ["storyIllustrationPct", "explainerGraphicsPct", "mapDataPct"],
        properties: { storyIllustrationPct: { type: "number" }, explainerGraphicsPct: { type: "number" }, mapDataPct: { type: "number" } },
      },
      entityRegistry: { type: "array", items: buildEntitySchema() },
      continuityGroups: { type: "array", items: buildContinuityGroupSchema() },
      visualBeats: { type: "array", items: buildVisualBeatSchema(chapterIds, segmentIds, factIds) },
      visualPayoffs: {
        type: "array",
        items: { type: "object", additionalProperties: false, required: ["description", "setupBeatId", "payoffBeatId"], properties: { description: { type: "string" }, setupBeatId: { type: "string" }, payoffBeatId: { type: ["string", "null"] } } },
      },
    },
  };
}

/* ============================ Prompt ============================ */

const VISUAL_DIRECTOR_INSTRUCTIONS = `You are Zyvo's Visual Director. You receive a finished, READY narration (already research-grounded and retention-tested) and turn it into a Rough Storyboard — the plan for what the viewer will SEE, not the final images themselves.

OUTPUT GRANULARITY: your visualBeats response items are MACRO SEQUENCES, preserving the purpose, reveals, facts, locations and continuity of a complete narrated idea. A deterministic shot planner subsequently expands these into shot-level VisualBeats with semantic narration ranges, varied camera/graphic progression and a visual-density gate. Do not force an image quota. Plan coherent sequence boundaries and preserve all narration coverage; the final on-screen shots will usually last 4-10 seconds and share render assets.

CORE QUESTION — ask this for every narration region, never anything weaker: "What does the viewer need to SEE right now?" Valid reasons include: understand a mechanism, see story progression, observe a state change, meet a new person, enter a new location, see evidence or an object, understand scale, understand geography, feel an emotional beat, see a before/after, see cause/effect, refresh visual attention, or set up a later payoff. Never "what image matches this sentence" — a VisualBeat is not one image per sentence, and it is not equivalent to an image at all: it describes what the viewer should see during a narration interval and why.

VISUAL MODE: choose STORY (character/location/prop/continuity-heavy), EXPLAINER (mechanisms/diagrams/cutaways, minimal character continuity), or HYBRID (both), based on what this specific topic actually is — a personal/experiential topic skews STORY, a mechanism/how-it-works topic skews EXPLAINER, a topic combining a recurring human element with real explanation (e.g. a survival story that also explains the physics of cold) is HYBRID. Report an approximate visualMix (storyIllustrationPct/explainerGraphicsPct/mapDataPct, roughly summing to 100) as planning metadata only — never a quota to force.

MINIMIZE EXPENSIVE GENERATIONS — this is as important as narrative judgment: track a baseSetupKey per visual "setup" (a specific location + camera angle + composition family, e.g. "longhouse_hearth_cam_A"), and deliberately have MULTIPLE beats share the same baseSetupKey when the underlying scene hasn't fundamentally changed. Use NEW_SETUP only for: a new location, a new major time period, a new environment, a new character introduction, a major concept shift, new explanatory grammar, a large camera geometry change, a major reveal, or genuinely significant visual novelty. Use REUSE_WITH_DELTA for: the same location, the same continuity sequence, the same composition family, a local story change (e.g. sitting → standing, hearth off → hearth lit, dry → snow-covered), or whenever stability itself helps the viewer notice the progression. A topic with real continuity (recurring people/places) should show real reuse in your baseSetupKey assignments, not a fresh setup for every beat.

shotStrategy and renderMethod are INDEPENDENT axes — never assume one implies the other. shotStrategy describes the STORYBOARD role (NEW_SETUP, REUSE_WITH_DELTA, INSERT, DETAIL, DIAGRAM, MAP, COMPARISON, TEXT_INFOGRAPHIC). renderMethod describes HOW it would actually be produced later (GENERATE, EDIT, REUSE, CROP, COMPOSITE, PROGRAMMATIC_GRAPHIC) — e.g. an INSERT is often PROGRAMMATIC_GRAPHIC, a REUSE_WITH_DELTA is often EDIT, a DIAGRAM is often PROGRAMMATIC_GRAPHIC or GENERATE depending on complexity. Choose whichever combination is actually correct for that beat.

VISUAL TYPES (use the closest fit, don't invent new ones): STORY_ILLUSTRATION, ENVIRONMENT, CHARACTER, OBJECT_DETAIL, DIAGRAM, MAP, COMPARISON, CUTAWAY, TIMELINE, PROGRAMMATIC_GRAPHIC.

PROGRAMMATIC TEXT: never plan an image-generated beat to carry important text (titles, labels, numbers, arrows, captions, charts, UI, timelines) — those are TEXT_INFOGRAPHIC/PROGRAMMATIC_GRAPHIC beats rendered later by code, not by an image model. Note this in forbiddenElements when relevant (e.g. "no readable text in the generated image").

ENTITY REGISTRY: extract every CHARACTER, LOCATION, IMPORTANT_OBJECT, VEHICLE_MACHINE, and DIAGRAM_SUBJECT that actually recurs or matters, classify importance as HERO (central, recurring, identity-sensitive), RECURRING (appears multiple times, matters but isn't central), or INCIDENTAL (appears once, low stakes) — and set referenceNeeded/referencePriority based on how much it would actually cost the video's consistency to NOT have a locked reference for it. An object mentioned once in passing is referenceNeeded:false. A hero character, a recurring vehicle, or a location returned to multiple times is referenceNeeded:true with priority high.

CAST BINDING (authoritative — read this before inventing any character): if EXISTING CANONICAL CAST is provided below, it is this project's real, already-established Visual World cast, not inspiration. Before adding a new CHARACTER, check whether an existing cast member's established role/domain already semantically matches the narration (e.g. narration about growing/harvesting/soil/crops matches a character whose domain is agriculture; narration about power/batteries/electrical systems matches a character whose domain is power/electrical; narration about repair/maintenance/life-support matches a character whose domain is technical upkeep). When one matches, reuse that EXACT existing entity id/name — never invent a new, similarly-generic character ("a farmer", "a technician", "a crew member") when an established one already fills that role. A character is not owned by the chapter that introduces it: the SAME existing character should recur in later chapters whenever the narration makes them relevant again, exactly like a real recurring cast member would. Only add a genuinely NEW character when no existing one plausibly fits the narrated role.

CONTINUITY GROUPS: group beats that share the same visual world-state into a ContinuityGroup (e.g. "longhouse_night", "viking_ship_storm") with a locationId, a small set of cameraAnchors (not unlimited views — a handful of named angles a scene can return to), the props that matter for that sequence, and which entities persist through it. Track WorldState as SPARSE inheritedState key/value pairs — only variables actually likely to cause a visible continuity error for THIS topic (e.g. timeOfDay, weather, outfit, a held object's location, a fire's state) — never a universal state model. A beat inherits the previous stable state in its group rather than silently resetting it.

REVEAL CONSTRAINTS: if the narration reveals something specific (a secret, a twist, an object "he hadn't noticed yet"), the beat(s) before that reveal must not show it — note this explicitly in revealConstraints. This is a core anti-spoiler requirement, not optional polish.

FACTUAL VISUAL CONSTRAINTS: when a beat makes a visual claim that is itself a factual claim (a historical garment, a technical diagram, a specific device), cite the factId(s) it should stay consistent with in factualVisualConstraints. Not every beat needs this — only ones making a real factual visual claim.

VISUAL PAYOFFS: track a narratively important recurring visual element (e.g. cracked boots shown early, failing later) with a setupBeatId and, once resolved, a payoffBeatId. Don't overuse this — only for genuinely deliberate visual throughlines.

PACING: do not use a fixed "new image every N seconds" rule. High-information sections change roughly every 3-8 seconds; slower narrative sections roughly every 6-15 seconds; an important/emotional beat can hold 12-20 seconds. Cover every meaningful narration region — not every sentence needs its own beat, but do not leave a 30-60+ second stretch of narration with no visual beat at all unless that gap is a deliberate choice (rare).`;

function visualPlanInput(ctx: { narrativeStrategy: any; storyPlan: any; scriptDocument: any; facts: { id: string; claim: string }[]; repairNotes?: any[]; existingCast?: any[] }) {
  const lines = [
    `NARRATIVE STRATEGY:`,
    JSON.stringify(ctx.narrativeStrategy ?? {}, null, 2),
    ``,
    `STORY PLAN CHAPTERS:`,
    JSON.stringify((ctx.storyPlan?.chapters ?? []).map((c: any) => ({ id: c.id, title: c.title, purpose: c.purpose ?? c.summary })), null, 2),
    ``,
    `READY SCRIPT (title, chapters, narration segments with their real ids — plan beats against THESE segment ids):`,
    JSON.stringify({ title: ctx.scriptDocument.title, chapters: ctx.scriptDocument.chapters, narrationSegments: ctx.scriptDocument.narrationSegments }, null, 2),
    ``,
    `USABLE FACTS (id + claim only — cite factIds in factualVisualConstraints where a beat makes a real factual visual claim):`,
    JSON.stringify(ctx.facts, null, 2),
  ];
  // 2026-09-19 "cast director / authoritative character binding" V1 fix:
  // the project's real, already-established Visual World cast (from the
  // current adopted plan, when one exists — a first-ever plan for a
  // project has none, and this section is simply omitted). See the
  // instructions' own CAST BINDING section for how this must be used —
  // reuse by exact id, never invent a near-duplicate generic role.
  if (ctx.existingCast?.length) {
    lines.push(``, `EXISTING CANONICAL CAST (real, already-established — reuse these exact ids/names per the CAST BINDING rule; do not invent a near-duplicate):`, JSON.stringify(ctx.existingCast, null, 2));
  }
  if (ctx.repairNotes?.length) {
    lines.push(``, `YOUR PREVIOUS ATTEMPT HAD STRUCTURAL PROBLEMS — FIX THESE EXACTLY:`, JSON.stringify(ctx.repairNotes, null, 2));
  }
  return lines.join("\n");
}

// 2026-09-20 "V1 simplification" pass — SIMPLIFY VISUAL PLANNING: a single
// call covering a whole 14-minute narration (~80-110 beats) is exactly the
// "multi-minute monolithic planning call" this task exists to remove — real
// incident: PLAN_TIMEOUT_MS (240s) already exceeds the platform's own
// wall-clock ceiling other stages had to work around (see research's
// EXTRACT_TIMEOUT_MS comment). For a new-style script, planning is now
// CHAPTER-BOUNDED: one provider call per chapter, each intentionally small
// (one chapter's segments, not the whole video), persisted immediately.
// This addendum is appended to the SAME VISUAL_DIRECTOR_INSTRUCTIONS
// (unchanged — same quality bar, same rules) telling the model it's only
// planning ONE chapter this call and must build on what earlier chapters
// already established rather than re-deriving the whole cast/continuity
// model from scratch every time.
const CHAPTER_BOUNDED_ADDENDUM = `

CHAPTER-BOUNDED CALL: you are planning ONLY the ONE chapter given to you below — other chapters were already planned in separate calls, or will be planned next. Your visualBeats must all belong to THIS chapter. If "ENTITIES/LOCATIONS ALREADY ESTABLISHED" is provided, those are real, already-locked entities from earlier chapters of this SAME video — reuse their exact ids whenever this chapter's narration involves them again; only add a genuinely NEW entityRegistry entry for something not already established. Likewise, only add continuityGroups for setups THIS chapter introduces or genuinely returns to.`;

function visualPlanInputForChapter(ctx: {
  narrativeStrategy: any;
  chapter: { chapterId: string; title: string; purpose?: string };
  segments: any[];
  facts: { id: string; claim: string }[];
  existingCast?: any[];
  priorEntities?: any[];
  priorContinuityGroups?: any[];
  repairNotes?: any[];
}) {
  const lines = [
    `NARRATIVE STRATEGY:`,
    JSON.stringify(ctx.narrativeStrategy ?? {}, null, 2),
    ``,
    `THIS CHAPTER:`,
    JSON.stringify({ id: ctx.chapter.chapterId, title: ctx.chapter.title, purpose: (ctx.chapter as any).purpose ?? (ctx.chapter as any).summary ?? "" }, null, 2),
    ``,
    `THIS CHAPTER'S NARRATION SEGMENTS — each already carries the Script Engine's own visual intent (visualIntent/mustShow/mustNotShow/entities/locationHint/preferredVisualForm); use it directly instead of re-deriving meaning from the raw text:`,
    JSON.stringify(ctx.segments, null, 2),
    ``,
    `USABLE FACTS (id + claim only — cite factIds in factualVisualConstraints where a beat makes a real factual visual claim):`,
    JSON.stringify(ctx.facts, null, 2),
  ];
  if (ctx.existingCast?.length) {
    lines.push(``, `EXISTING CANONICAL CAST (real, already-established for this whole project — reuse these exact ids/names per the CAST BINDING rule):`, JSON.stringify(ctx.existingCast, null, 2));
  }
  if (ctx.priorEntities?.length) {
    lines.push(``, `ENTITIES/LOCATIONS ALREADY ESTABLISHED EARLIER IN THIS VIDEO:`, JSON.stringify(ctx.priorEntities, null, 2));
  }
  if (ctx.priorContinuityGroups?.length) {
    lines.push(``, `CONTINUITY GROUPS ALREADY ESTABLISHED EARLIER (reuse via REUSE_WITH_DELTA only if this chapter genuinely returns to that exact setup):`, JSON.stringify(ctx.priorContinuityGroups, null, 2));
  }
  if (ctx.repairNotes?.length) {
    lines.push(``, `YOUR PREVIOUS ATTEMPT AT THIS CHAPTER HAD STRUCTURAL PROBLEMS — FIX THESE EXACTLY:`, JSON.stringify(ctx.repairNotes, null, 2));
  }
  return lines.join("\n");
}

// Intentionally small and well under any platform wall-clock ceiling — one
// chapter's worth of beats (typically 8-16), never a whole video's.
const CHAPTER_PLAN_TIMEOUT_MS = 90_000;

async function runVisualDirectorForChapter(ctx: {
  narrativeStrategy: any;
  chapter: { chapterId: string; title: string; purpose?: string };
  segments: any[];
  facts: { id: string; claim: string }[];
  existingCast?: any[];
  priorEntities?: any[];
  priorContinuityGroups?: any[];
  repairNotes?: ValidationIssue[];
}, usage: UsageTotals) {
  const chapterIds = [ctx.chapter.chapterId];
  const segmentIds = ctx.segments.map((s: any) => s.id);
  const factIds = ctx.facts.map((f) => f.id);
  return await callStructured(
    {
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 16000,
      store: false,
      instructions: VISUAL_DIRECTOR_INSTRUCTIONS + CHAPTER_BOUNDED_ADDENDUM,
      input: visualPlanInputForChapter(ctx),
      text: { format: { type: "json_schema", name: "visual_plan_chapter", strict: true, schema: buildVisualPlanSchema(chapterIds, segmentIds, factIds) } },
    },
    CHAPTER_PLAN_TIMEOUT_MS,
    usage
  );
}

/* ============================ Deterministic validators (zero AI cost) ============================ */

type ValidationIssue = { code: string; message: string; beatIds?: string[] };
type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };

// strictDuration: only meaningful for the FINAL, post-refinement plan
// (stageFinalizing) — the macro-level plan validated in stagePlanning is
// planning-level metadata that refineVisualSequences' buildSegmentWindows
// deterministically re-times from real per-segment word counts regardless
// of what the macro's own estimatedStartSeconds/EndSeconds said, so a
// divergence at that stage doesn't reflect a real defect and must never
// force a costly repair call over something refinement fixes for free.
function validateVisualPlan(plan: any, scriptDocument: any, validFactIds: Set<string>, strictDuration = false): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const beats: any[] = plan.visualBeats ?? [];
  const entityIds = new Set((plan.entityRegistry ?? []).map((e: any) => e.id));
  const locationIds = new Set((plan.entityRegistry ?? []).filter((e: any) => e.category === "LOCATION").map((e: any) => e.id));
  const continuityGroupIds = new Set((plan.continuityGroups ?? []).map((c: any) => c.id));
  const segmentIds = new Set((scriptDocument.narrationSegments ?? []).map((s: any) => s.id));
  const chapterIds = new Set((scriptDocument.chapters ?? []).map((c: any) => c.chapterId));

  const beatIdList = beats.map((b) => b.id);
  if (new Set(beatIdList).size !== beatIdList.length) errors.push({ code: "duplicate_beat_id", message: "Two or more VisualBeats share the same id." });

  const baseSetupsEstablished = new Set<string>();
  let previousSeq: number | null = null;
  for (const beat of beats) {
    if (!chapterIds.has(beat.chapterId)) errors.push({ code: "unknown_chapter_id", message: `Beat ${beat.id} references unknown chapterId ${beat.chapterId}.`, beatIds: [beat.id] });
    for (const segId of beat.narrationSegmentIds ?? []) {
      if (!segmentIds.has(segId)) errors.push({ code: "unknown_segment_id", message: `Beat ${beat.id} references unknown narrationSegmentId ${segId}.`, beatIds: [beat.id] });
    }
    for (const c of beat.factualVisualConstraints ?? []) {
      for (const factId of c.factIds ?? []) {
        if (!validFactIds.has(factId)) errors.push({ code: "unknown_fact_id", message: `Beat ${beat.id} cites unknown factId ${factId}.`, beatIds: [beat.id] });
      }
    }
    if (beat.continuityGroupId && !continuityGroupIds.has(beat.continuityGroupId)) errors.push({ code: "unknown_continuity_group", message: `Beat ${beat.id} references unknown continuityGroupId ${beat.continuityGroupId}.`, beatIds: [beat.id] });
    if (beat.locationId && !locationIds.has(beat.locationId)) errors.push({ code: "unknown_location_id", message: `Beat ${beat.id} references unknown locationId ${beat.locationId}.`, beatIds: [beat.id] });
    for (const entId of [...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])]) {
      if (!entityIds.has(entId)) errors.push({ code: "unknown_entity_id", message: `Beat ${beat.id} references unknown entityId ${entId}.`, beatIds: [beat.id] });
    }

    if (beat.estimatedEndSeconds <= beat.estimatedStartSeconds) errors.push({ code: "invalid_timing", message: `Beat ${beat.id} has end <= start.`, beatIds: [beat.id] });
    if (beat.estimatedStartSeconds < 0) errors.push({ code: "negative_timing", message: `Beat ${beat.id} has a negative start time.`, beatIds: [beat.id] });
    if (previousSeq !== null && beat.sequenceIndex <= previousSeq) errors.push({ code: "malformed_ordering", message: `Beat ${beat.id}'s sequenceIndex is not strictly increasing.`, beatIds: [beat.id] });
    previousSeq = beat.sequenceIndex;

    if (beat.shotStrategy === "REUSE_WITH_DELTA") {
      if (!beat.baseSetupKey) errors.push({ code: "reuse_missing_base_setup_key", message: `Beat ${beat.id} is REUSE_WITH_DELTA but has no baseSetupKey.`, beatIds: [beat.id] });
      else if (!baseSetupsEstablished.has(beat.baseSetupKey)) errors.push({ code: "reuse_before_setup", message: `Beat ${beat.id} reuses baseSetupKey "${beat.baseSetupKey}" before any earlier beat established it.`, beatIds: [beat.id] });
      if (!beat.deltaInstruction) warnings.push({ code: "reuse_missing_delta_instruction", message: `Beat ${beat.id} is REUSE_WITH_DELTA but has no deltaInstruction.`, beatIds: [beat.id] });
    }
    if (beat.baseSetupKey) baseSetupsEstablished.add(beat.baseSetupKey);
  }

  for (const group of plan.continuityGroups ?? []) {
    if (group.locationId && !locationIds.has(group.locationId)) errors.push({ code: "continuity_group_unknown_location", message: `Continuity group ${group.id} references unknown locationId.` });
    for (const entId of group.persistentEntityIds ?? []) {
      if (!entityIds.has(entId)) errors.push({ code: "continuity_group_unknown_entity", message: `Continuity group ${group.id} references unknown entityId ${entId}.` });
    }
  }

  const beatById = new Map(beats.map((b) => [b.id, b]));
  for (const payoff of plan.visualPayoffs ?? []) {
    if (!beatById.has(payoff.setupBeatId)) errors.push({ code: "payoff_bad_setup", message: `Visual payoff references unknown setupBeatId ${payoff.setupBeatId}.` });
    if (payoff.payoffBeatId && !beatById.has(payoff.payoffBeatId)) errors.push({ code: "payoff_bad_payoff", message: `Visual payoff references unknown payoffBeatId ${payoff.payoffBeatId}.` });
  }

  // Coverage: every narration segment should fall inside at least one
  // beat's time range OR be directly listed in a beat's
  // narrationSegmentIds — a soft signal (warning), not a hard block, since
  // occasional intentional silence is fine, but this catches accidental
  // large dead zones.
  const coveredSegmentIds = new Set(beats.flatMap((b) => b.narrationSegmentIds ?? []));
  const uncovered = (scriptDocument.narrationSegments ?? []).filter((s: any) => !coveredSegmentIds.has(s.id));
  if (uncovered.length) warnings.push({ code: "uncovered_segments", message: `${uncovered.length} narration segment(s) have no VisualBeat covering them.`, beatIds: uncovered.map((s: any) => s.id) });

  // The script's narration is the master clock (see refineVisualSequences'
  // buildSegmentWindows, which derives shot timing from real per-segment
  // word counts specifically so this never diverges in normal operation) —
  // a plan that still doesn't match after that is a genuine defect, not a
  // cosmetic detail. Real incident: a plan reached READY with a 570s
  // storyboard against an 811s script (a 42% divergence) because this was
  // only ever a warning. This is deterministic timeline math, not something
  // that needs a model repair — so a mismatch this large blocks READY
  // outright rather than requiring a provider call to fix. A small residual
  // (rounding, a deliberate cold-open/outro without narration) stays a
  // warning rather than blocking legitimate plans.
  const scriptDuration = scriptDocument.estimatedDurationSeconds ?? 0;
  const planDuration = beats.length ? Math.max(...beats.map((b) => b.estimatedEndSeconds)) : 0;
  if (scriptDuration > 0) {
    const divergence = Math.abs(planDuration - scriptDuration) / scriptDuration;
    const issue = { code: "duration_mismatch", message: `Plan's total duration (${planDuration}s) diverges from the script's estimated duration (${scriptDuration}s) by ${Math.round(divergence * 100)}%.` };
    if (divergence > 0.1 && strictDuration) errors.push(issue);
    else if (divergence > 0.05) warnings.push(issue);
  }

  return { errors, warnings };
}

/* ============================ Storyboard summary (zero cost) ============================ */

function computeStoryboardSummary(plan: any) {
  const beats: any[] = plan.visualBeats ?? [];
  const baseSetupKeys = new Set(beats.filter((b) => b.shotStrategy === "NEW_SETUP" && b.baseSetupKey).map((b) => b.baseSetupKey));
  return {
    totalVisualBeats: beats.length,
    totalSequences: plan.visualSequences?.length ?? 0,
    estimatedBaseSetups: baseSetupKeys.size,
    estimatedEdits: beats.filter((b) => b.shotStrategy === "REUSE_WITH_DELTA" && b.renderMethod === "EDIT").length,
    estimatedInserts: beats.filter((b) => b.shotStrategy === "INSERT").length,
    estimatedDiagrams: beats.filter((b) => b.visualType === "DIAGRAM" || b.shotStrategy === "DIAGRAM").length,
    estimatedMaps: beats.filter((b) => b.visualType === "MAP" || b.shotStrategy === "MAP").length,
    estimatedProgrammaticGraphics: beats.filter((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC").length,
    estimatedCrops: beats.filter((b) => b.renderMethod === "CROP").length,
    estimatedReuseEvents: beats.filter((b) => b.shotStrategy === "REUSE_WITH_DELTA").length,
  };
}

function worldStateModelFromGroups(continuityGroups: any[]) {
  const model: Record<string, Record<string, string>> = {};
  for (const g of continuityGroups ?? []) {
    model[g.id] = Object.fromEntries((g.inheritedState ?? []).map((kv: any) => [kv.key, kv.value]));
  }
  return model;
}

/* ============================ Stage handlers ============================ */

type VisualPlanRow = any;

async function runVisualDirector(narrativeStrategy: any, storyPlan: any, scriptDocument: any, facts: { id: string; claim: string }[], usage: UsageTotals, repairNotes?: ValidationIssue[], existingCast?: any[]) {
  const chapterIds = (scriptDocument.chapters ?? []).map((c: any) => c.chapterId);
  const segmentIds = (scriptDocument.narrationSegments ?? []).map((s: any) => s.id);
  const factIds = facts.map((f) => f.id);
  return await callStructured(
    {
      model: OPENAI_MODEL,
      reasoning: { effort: "low" },
      max_output_tokens: 40000,
      store: false,
      instructions: VISUAL_DIRECTOR_INSTRUCTIONS,
      input: visualPlanInput({ narrativeStrategy, storyPlan, scriptDocument, facts, repairNotes, existingCast }),
      text: { format: { type: "json_schema", name: "visual_plan", strict: true, schema: buildVisualPlanSchema(chapterIds, segmentIds, factIds) } },
    },
    PLAN_TIMEOUT_MS,
    usage
  );
}

// 2026-09-19 "make the narration contract mandatory" V1 fix — real Mars
// finding: analyze-long-form-narration-contract has always been a fully
// working, real compiler (compileNarrationVisualContract genuinely runs a
// gpt-5-mini call and persists real claims), but it is an ANALYSIS-ONLY
// standalone endpoint with zero callers anywhere in the app — it never sets
// project.current_narration_contract_version_id, and nothing else does
// either. Every real project's pointer is therefore permanently null,
// stageFinalizing's own contract read (below) always no-ops, beats never
// get a narrationClaimId, and every PROGRAMMATIC_GRAPHIC beat later throws
// GRAPHIC_REPLAN_REQUIRED at scene-compile time (start-long-form-scene-
// generation) — exactly the "19 planned graphics, 0 compile" incident.
// This makes contract compilation a genuine, automatic prerequisite of
// planning: reuses the compile function unchanged, short-circuits to a
// no-op when a ready contract for the CURRENT script version already
// exists (so a replan attempt or retry never recompiles for free), and
// throws (routing through the exact same handleStageFailure retry/hold
// semantics every other planning failure already uses) if compilation
// fails — "fail planning, hold for replan" rather than let a plan reach
// 'ready' with graphics that can never compile.
// 2026-09-20 "V1 simplification" pass — CORE ARCHITECTURE CHANGE: for a
// script written by the new Script Engine, the narration segments already
// carry the small amount of structured visual information a director needs
// (visualIntent, mustShow, mustNotShow, entities, locationHint,
// continuityEntityIds, exactTextOverlay, preferredVisualForm — see
// buildSegmentSchema's own comment in advance-long-form-script). This maps
// those fields onto the EXISTING NarrationClaim shape one-to-one — no new
// concept, no new table, no LLM call, no batching/lease/recovery surface at
// all. This is the literal meaning of "the script segment itself becomes
// the visual contract": ensureNarrationContract below detects this shape
// and persists a ready contract INSTANTLY from data the Script Engine
// already produced, instead of paying a second LLM system to reread the
// entire narration and rediscover it. A legacy script (written before this
// change) simply has no visualIntent field on its segments and falls
// through unchanged to the old durable multi-batch LLM compiler beneath
// this function — recovery/leases/batches remain exactly as built, but now
// only ever exercised for old projects, never new ones.
const PREFERRED_FORM_TO_VISUAL_FORMS: Record<string, string[]> = {
  STORY: ["CHARACTER_ACTION"],
  EXPLAINER: ["DIAGRAM"],
  GRAPHIC: ["TEXT_EMPHASIS"],
  DETAIL: ["OBJECT_DETAIL"],
};
function synthesizeClaimsFromSegments(segments: any[]): any[] {
  return segments.map((s: any) => {
    const mustNotShow: string[] = s.mustNotShow ?? [];
    const entities: string[] = s.entities ?? [];
    const exactText: string | null = s.exactTextOverlay ?? null;
    return {
      claimId: `${s.id}__inline`,
      narrationSegmentIds: [s.id],
      chapterId: s.chapterId ?? null,
      narrationText: s.text,
      claimType: mustNotShow.length ? "NEGATION" : "FACT",
      primaryConcepts: entities,
      // A meta-commentary segment ("here's the checklist...") can honestly
      // have no entity/location — never leave this falsy, or finalization's
      // CLAIM_INCOMPLETE check fails the whole plan (real Atlantis incident).
      primarySubject: entities[0] || s.locationHint || "the narrated idea",
      entityRequirements: entities.map((entity: string) => ({ entity, criticality: "MEDIUM" })),
      forbiddenEntities: [],
      requiredVisualFacts: s.mustShow ?? [],
      forbiddenVisualFacts: mustNotShow,
      negativeClaims: mustNotShow,
      positiveClaims: [],
      comparisonClaims: [],
      causeEffectClaims: [],
      temporalClaims: [],
      quantitativeClaims: [],
      entitiesMentioned: entities,
      stateBefore: "",
      stateAfter: "",
      visualCommunicationGoal: s.visualIntent || "Communicate this segment's narration visually.",
      planningMode: s.preferredVisualForm === "EXPLAINER" || s.preferredVisualForm === "GRAPHIC" ? "EXPLAINER" : "STORY",
      contentMode: "MIXED",
      preferredVisualForms: PREFERRED_FORM_TO_VISUAL_FORMS[s.preferredVisualForm as string] ?? ["CHARACTER_ACTION"],
      graphicPrimitives: [],
      continuityRequirement: (s.continuityEntityIds ?? []).length ? "MEDIUM" : "LOW",
      textOverlayCandidate: { recommended: Boolean(exactText), semanticText: exactText ?? "", importance: exactText ? "HIGH" : "LOW" },
      allowedAmbiguity: "MEDIUM",
      emphasis: "MEDIUM",
      confidence: 1,
    };
  });
}

// 2026-09-20 durable-contract-compilation fix — real incident: a fresh
// project's compileNarrationVisualContract call (batched by chapter, each
// batch its own ~120s request plus a possible repair call) ran as ONE
// uninterruptible block inside a single stagePlanning invocation, with no
// checkpoint until the very end. Confirmed live on a real project: two
// separate long_form_narration_contract_versions rows for the SAME script
// version, both stuck status='compiling' with zero saved claims — the
// platform's own wall-clock limit killed the invocation mid-compile (see
// research's own EXTRACT_TIMEOUT_MS comment for the same confirmed 150s
// ceiling), and since ensureNarrationContract always inserted a brand-new
// row unless a READY one existed, every retry threw away all prior batches
// and started over from chapter 1, forever.
//
// Now mirrors advance-long-form-research's own proven batch-checkpoint
// architecture: ONE chapter batch compiled per call, persisted immediately
// (batches jsonb), with this row's own stage_attempt/worker_lock_until lease
// so a dead worker's row can be safely reclaimed (never double-worked while
// a lease is still live, never silently overwritten by a stale worker that
// finally wakes up after being superseded — every write is fenced on the
// lease value this invocation itself just claimed).
const CONTRACT_BATCH_LEASE_MS = 130_000; // a little over callResponses' own 120s per-request timeout (narrationVisualContract.ts) so a call that's genuinely still running is never reclaimed out from under itself, short enough that the confirmed failure mode (worker disappearance) is noticed and retried quickly
const MAX_CONTRACT_STAGE_ATTEMPTS = 6; // each attempt should persist real progress (one batch) unless something is genuinely broken; stage_attempt resets to 0 on every successful batch (see below), so this only ever bounds REPEATED failures, never a healthy multi-chapter compile
type ContractStageResult = { ready: true; id: string } | { ready: false };

export async function ensureNarrationContract(admin: any, project: any, scriptDocument: any, reserve: () => Promise<void>): Promise<ContractStageResult> {
  if (project.current_narration_contract_version_id) {
    const { data: existing } = await admin.from("long_form_narration_contract_versions").select("id, status, script_version_id").eq("id", project.current_narration_contract_version_id).eq("project_id", project.id).maybeSingle();
    if (existing && existing.status === "ready" && existing.script_version_id === project.current_script_version_id) {
      return { ready: true, id: existing.id };
    }
  }
  // Real Mars finding: the project's OWN pointer can be null (or stale)
  // while a perfectly good READY contract for this exact script version
  // already exists (e.g. compiled earlier via analyze-long-form-narration-
  // contract, or from a prior attempt on this same script). Reuse it and
  // backfill the pointer rather than paying for a redundant recompile —
  // the pointer check above is an optimization for the common case, this
  // is the correctness fallback for "a contract already exists, it just
  // was never wired up."
  const { data: readyExisting } = await admin.from("long_form_narration_contract_versions").select("id").eq("project_id", project.id).eq("script_version_id", project.current_script_version_id).eq("status", "ready").order("version", { ascending: false }).limit(1).maybeSingle();
  if (readyExisting) {
    await admin.from("long_form_projects").update({ current_narration_contract_version_id: readyExisting.id, updated_at: new Date().toISOString() }).eq("id", project.id).throwOnError();
    return { ready: true, id: readyExisting.id };
  }

  const segments = scriptDocument.narrationSegments ?? [];
  if (!segments.length) throw new Error("NARRATION_CONTRACT_NO_SEGMENTS");

  // CORE V1 SIMPLIFICATION: a script written by the new Script Engine
  // carries visualIntent (and the rest of the inline visual metadata)
  // directly on every segment — see synthesizeClaimsFromSegments' own
  // comment. No provider call, no batches, no lease: this contract is
  // "compiled" and marked ready in the same tick it's created.
  if (segments.every((s: any) => s.visualIntent != null)) {
    const { data: versionRow } = await admin.from("long_form_narration_contract_versions").select("version").eq("project_id", project.id).eq("script_version_id", project.current_script_version_id).order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (versionRow?.version ?? 0) + 1;
    const claims = synthesizeClaimsFromSegments(segments);
    const { data: inserted, error: insertError } = await admin.from("long_form_narration_contract_versions").insert({
      project_id: project.id, script_version_id: project.current_script_version_id, version: nextVersion,
      status: "ready", compiler_version: `${NARRATION_CONTRACT_COMPILER_VERSION}-inline`, model: "none",
      claims, stats: { llmCalls: 0, repairCalls: 0, inputTokens: 0, outputTokens: 0, estimatedModelCostUsd: 0, latencyMs: 0, batches: 0, droppedClaims: 0, synthesizedInline: true },
    }).select("id").single();
    if (insertError || !inserted) throw new Error("NARRATION_CONTRACT_INSERT_FAILED");
    await admin.from("long_form_projects").update({ current_narration_contract_version_id: inserted.id, updated_at: new Date().toISOString() }).eq("id", project.id).throwOnError();
    return { ready: true, id: inserted.id };
  }

  // An in-progress compiler for this EXACT identity (script version +
  // compiler version) is reused/resumed, never duplicated — this is the
  // direct fix for the confirmed incident (two "compiling" rows for the same
  // script version, each losing its own progress to the next retry).
  const { data: compiling } = await admin
    .from("long_form_narration_contract_versions")
    .select("*")
    .eq("project_id", project.id)
    .eq("script_version_id", project.current_script_version_id)
    .eq("compiler_version", NARRATION_CONTRACT_COMPILER_VERSION)
    .eq("status", "compiling")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  let contractRow = compiling;
  if (contractRow) {
    // A live (unexpired) lease means another invocation may genuinely still
    // be inside its own batch call right now — report "not ready yet" and
    // let the caller's self-chain retry shortly, rather than starting a
    // second concurrent compiler for the same identity.
    if (contractRow.worker_lock_until && new Date(contractRow.worker_lock_until).getTime() > Date.now()) {
      return { ready: false };
    }
    if ((contractRow.stage_attempt ?? 0) >= MAX_CONTRACT_STAGE_ATTEMPTS) {
      await admin.from("long_form_narration_contract_versions").update({ status: "failed", last_error_code: "NARRATION_CONTRACT_STAGE_ATTEMPTS_EXHAUSTED", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", contractRow.id);
      throw new Error("NARRATION_CONTRACT_COMPILE_FAILED");
    }
    // Claim: fenced on the exact lease value we just read (null or a past
    // timestamp) — a concurrent invocation racing to claim the same row
    // fails this update (0 rows affected) rather than both proceeding.
    const priorLock = contractRow.worker_lock_until;
    const claimedLease = new Date(Date.now() + CONTRACT_BATCH_LEASE_MS).toISOString();
    const attempt = (contractRow.stage_attempt ?? 0) + 1;
    let claimQuery = admin.from("long_form_narration_contract_versions").update({ worker_lock_until: claimedLease, stage_attempt: attempt }).eq("id", contractRow.id);
    claimQuery = priorLock == null ? claimQuery.is("worker_lock_until", null) : claimQuery.eq("worker_lock_until", priorLock);
    const { data: claimed } = await claimQuery.select("*").maybeSingle();
    if (!claimed) return { ready: false }; // lost the race — another invocation claimed it first
    contractRow = claimed;
  } else {
    // Genuinely nothing in progress for this identity — this is the ONE real
    // "provider work is starting" moment, so this is the only place that
    // spends the caller's reservation; every resume below reuses this same
    // reservation rather than spending a new one per chapter batch (a
    // contract with N chapters previously meant N invocations of
    // stagePlanning, which would otherwise burn N reservations against a
    // budget meant to cover "the contract phase" as a single unit of work).
    await reserve();
    const { data: versionRow } = await admin.from("long_form_narration_contract_versions").select("version").eq("project_id", project.id).eq("script_version_id", project.current_script_version_id).order("version", { ascending: false }).limit(1).maybeSingle();
    const nextVersion = (versionRow?.version ?? 0) + 1;
    const { data: inserted, error: insertError } = await admin.from("long_form_narration_contract_versions").insert({
      project_id: project.id, script_version_id: project.current_script_version_id, version: nextVersion, status: "compiling", compiler_version: NARRATION_CONTRACT_COMPILER_VERSION, model: "gpt-5-mini",
      stage_attempt: 1, worker_lock_until: new Date(Date.now() + CONTRACT_BATCH_LEASE_MS).toISOString(),
    }).select("*").single();
    if (insertError || !inserted) throw new Error("NARRATION_CONTRACT_INSERT_FAILED");
    contractRow = inserted;
  }

  const validSegmentIds = new Set(segments.map((s: any) => s.id));
  let batches: any[] = contractRow.batches;
  if (!batches) {
    batches = batchSegmentsByChapter(segments).map((b: any) => ({ status: "pending", input: b, claims: null, llmCalls: 0, repairCalls: 0, inputTokens: 0, outputTokens: 0, droppedClaims: 0 }));
    await admin.from("long_form_narration_contract_versions").update({ batches }).eq("id", contractRow.id);
    contractRow = { ...contractRow, batches };
  }

  const idx = batches.findIndex((b: any) => b.status !== "succeeded");
  if (idx !== -1) {
    let result;
    try {
      result = await compileContractBatch(batches[idx].input, OPENAI_KEY, validSegmentIds);
    } catch (error) {
      // A real call failure (network/timeout, or the worker itself dying
      // before this ever returns) — release the lease so the NEXT
      // invocation can retry this exact batch. Bounded by stage_attempt via
      // the claim-time check above, never an unbounded retry loop, and every
      // batch already succeeded before this one stays exactly as it is.
      console.error(`[advance-long-form-visual-plan] contract batch ${idx}/${batches.length} failed for contract ${contractRow.id}:`, error instanceof Error ? error.message : String(error));
      await admin.from("long_form_narration_contract_versions").update({ worker_lock_until: null }).eq("id", contractRow.id).eq("worker_lock_until", contractRow.worker_lock_until);
      return { ready: false };
    }
    const updatedBatches = batches.map((b: any, i: number) =>
      i === idx ? { ...b, status: "succeeded", claims: result.claims, llmCalls: result.llmCalls, repairCalls: result.repairCalls, inputTokens: result.inputTokens, outputTokens: result.outputTokens, droppedClaims: result.droppedClaims } : b
    );
    // Real forward progress just happened and is persisted — release the
    // lease and reset stage_attempt to 0 immediately (mirrors research's own
    // runExtractionBatchStage): a healthy multi-chapter compile must never
    // exhaust MAX_CONTRACT_STAGE_ATTEMPTS from normal successful progress.
    const { data: persisted } = await admin
      .from("long_form_narration_contract_versions")
      .update({ batches: updatedBatches, stage_attempt: 0, worker_lock_until: null })
      .eq("id", contractRow.id)
      .eq("worker_lock_until", contractRow.worker_lock_until)
      .select("id")
      .maybeSingle();
    if (!persisted) return { ready: false }; // fenced out — a newer attempt now owns this row; never trust our own in-memory result past this point
    if (updatedBatches.some((b: any) => b.status !== "succeeded")) return { ready: false };
    contractRow = { ...contractRow, batches: updatedBatches };
  }

  // Every batch succeeded — assemble the final claim set/stats exactly as
  // the original single-call compiler did, then finalize.
  try {
    const finalBatches: any[] = contractRow.batches;
    const claims: any[] = [];
    const seenClaimIds = new Set<string>();
    let totalDropped = 0, llmCalls = 0, repairCalls = 0, inputTokens = 0, outputTokens = 0;
    for (const b of finalBatches) {
      llmCalls += b.llmCalls ?? 0; repairCalls += b.repairCalls ?? 0; inputTokens += b.inputTokens ?? 0; outputTokens += b.outputTokens ?? 0;
      for (const claim of b.claims ?? []) {
        if (seenClaimIds.has(claim.claimId)) { totalDropped++; continue; }
        seenClaimIds.add(claim.claimId);
        claims.push(claim);
      }
      totalDropped += b.droppedClaims ?? 0;
    }
    const coveredSegments = new Set(claims.flatMap((c: any) => c.narrationSegmentIds));
    if (!claims.length || totalDropped || segments.some((s: any) => !coveredSegments.has(s.id))) {
      throw new Error("NARRATION_CONTRACT_INCOMPLETE: repair semantic claims before planning");
    }
    const stats = {
      llmCalls, repairCalls, inputTokens, outputTokens,
      estimatedModelCostUsd: Number(((inputTokens * GPT5_MINI_INPUT_PER_M + outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4)),
      batches: finalBatches.length, droppedClaims: totalDropped,
    };
    await admin.from("long_form_narration_contract_versions").update({ status: "ready", claims, stats, updated_at: new Date().toISOString() }).eq("id", contractRow.id).throwOnError();
    await admin.from("long_form_projects").update({ current_narration_contract_version_id: contractRow.id, updated_at: new Date().toISOString() }).eq("id", project.id).throwOnError();
    return { ready: true, id: contractRow.id };
  } catch (error) {
    await admin.from("long_form_narration_contract_versions").update({ status: "failed", last_error_code: String(error).slice(0, 200), last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", contractRow.id);
    throw new Error("NARRATION_CONTRACT_COMPILE_FAILED");
  }
}

// 2026-09-19 "cast director / authoritative character binding" V1 fix.
// Reuses the project's own already-adopted VisualPlanVersion entity
// registry (current_visual_plan_version_id) as the canonical cast — never a
// separate registry, never a duplicated concept. Returns [] for a
// project's first-ever plan (nothing to reuse yet) or when that plan has
// no CHARACTER entries. Compact (id/name/category/importance only, no
// canonicalSpec/requiredViews) — enough for the LLM to bind by role, not
// enough to duplicate the whole entity schema into every prompt.
async function fetchExistingCast(admin: any, project: any): Promise<any[]> {
  if (!project.current_visual_plan_version_id) return [];
  const { data: priorPlan } = await admin.from("long_form_visual_plan_versions").select("entity_registry").eq("id", project.current_visual_plan_version_id).maybeSingle();
  const { data: world } = await admin.from("long_form_visual_world_versions").select("reference_plan").eq("id", project.current_visual_world_version_id).maybeSingle();
  const prior = (priorPlan?.entity_registry ?? []).filter((e: any) => e.category === "CHARACTER");
  const canonical = (world?.reference_plan?.entities ?? []).filter((e: any) => e.entityCategory === "CHARACTER");
  return canonical.length ? canonical.map((e: any) => ({ ...prior.find((p: any) => p.id === e.entityId), id: e.entityId, name: e.entityName, category: "CHARACTER", importance: prior.find((p: any) => p.id === e.entityId)?.importance ?? "RECURRING", referenceNeeded: true })) : prior;
}

// 2026-09-19 "cast director" V1 fix — deterministic, non-blocking safety
// net: a NEW character entity (not present in existingCast) whose name is a
// bare generic role noun (never a proper name/description) is exactly the
// "a farmer"/"a technician"/"a crew member" pattern the CAST BINDING
// instruction asks the LLM not to produce when an existing cast member
// already fits. This can't prove a real semantic mismatch (that would need
// another LLM call, out of scope for a V1 fix) — it's reported as a
// warning for visibility, never a hard planning failure, since a genuinely
// new generic-sounding role can be legitimate (a project's first-ever
// plan, or a real new character the story just introduced).
const GENERIC_ROLE_NAME = /^(a|an|the)?\s*(farmer|technician|crew member|worker|officer|specialist|engineer|scientist|guard|soldier|doctor|nurse|pilot|driver|operator|mechanic)s?$/i;
function detectGenericCastReplacements(entityRegistry: any[], existingCast: any[]): string[] {
  if (!existingCast.length) return [];
  const existingIds = new Set(existingCast.map((e) => e.id));
  return entityRegistry
    .filter((e: any) => e.category === "CHARACTER" && !existingIds.has(e.id) && GENERIC_ROLE_NAME.test(String(e.name ?? "").trim()))
    .map((e: any) => e.id);
}

function emptyAccumulatedPlan() {
  return { visualMode: "HYBRID", visualMix: { storyIllustrationPct: 34, explainerGraphicsPct: 33, mapDataPct: 33 }, entityRegistry: [], continuityGroups: [], visualBeats: [], visualPayoffs: [] };
}

// Folds ONE chapter's output into the running accumulated plan — entities/
// continuityGroups deduped by id (first-seen kept), beats/payoffs appended.
// Extracted so a concurrent wave (see planNextChapter) can fold multiple
// chapters' results in chapter order after Promise.all resolves, exactly as
// if they'd completed one at a time.
// 2026-09-21 "fix cross-chapter beat id collisions" pass — real Atlantis
// incident: chapters plan concurrently, each in its own isolated model call
// with no visibility into sibling chapters' chosen beat ids (buildVisualBeatSchema's
// `id` field has no pattern/uniqueness constraint at all). Two independently
// planned chapters landing on the same short id (e.g. both naming a beat
// "vb6_01") produced validateVisualPlan's duplicate_beat_id — and, since a
// visualPayoff's setupBeatId/payoffBeatId is dropped/orphaned whenever the
// beat it names collides and gets shadowed, payoff_bad_payoff right after
// it. This makes every beat id globally unique BY CONSTRUCTION, immediately
// after each chapter's response comes back and before any merge — no LLM
// coordination required, so it can never collide again. Only `id` and this
// chapter's OWN payoff references to it are renamed: baseSetupKey/
// continuityGroupId/entity ids are deliberately left untouched — those are
// genuinely cross-chapter continuity keys (priorContinuityGroups/
// priorEntities are shown to later chapters specifically so they CAN be
// reused across chapters), unlike a beat id, which only ever identifies one
// beat row and was never meant to be referenced from another chapter.
function namespaceChapterBeatIds(chapterId: string, chapterPlan: any): any {
  const beats: any[] = chapterPlan.visualBeats ?? [];
  const renameMap = new Map<string, string>(beats.map((b) => [b.id, `${chapterId}__${b.id}`]));
  const renamedBeats = beats.map((b) => ({ ...b, id: renameMap.get(b.id) }));
  const renamedPayoffs = (chapterPlan.visualPayoffs ?? []).map((p: any) => ({
    ...p,
    setupBeatId: renameMap.get(p.setupBeatId) ?? p.setupBeatId,
    payoffBeatId: p.payoffBeatId ? renameMap.get(p.payoffBeatId) ?? p.payoffBeatId : p.payoffBeatId,
  }));
  return { ...chapterPlan, visualBeats: renamedBeats, visualPayoffs: renamedPayoffs };
}

function mergeChapterIntoAccumulated(accumulated: any, chapterPlan: any) {
  const mergedEntities = [...accumulated.entityRegistry];
  const entityIds = new Set(mergedEntities.map((e: any) => e.id));
  for (const e of chapterPlan.entityRegistry ?? []) if (!entityIds.has(e.id)) { mergedEntities.push(e); entityIds.add(e.id); }

  const mergedGroups = [...accumulated.continuityGroups];
  const groupIds = new Set(mergedGroups.map((g: any) => g.id));
  for (const g of chapterPlan.continuityGroups ?? []) if (!groupIds.has(g.id)) { mergedGroups.push(g); groupIds.add(g.id); }

  return {
    visualMode: chapterPlan.visualMode ?? accumulated.visualMode,
    visualMix: chapterPlan.visualMix ?? accumulated.visualMix,
    entityRegistry: mergedEntities,
    continuityGroups: mergedGroups,
    visualBeats: [...accumulated.visualBeats, ...(chapterPlan.visualBeats ?? [])],
    visualPayoffs: [...accumulated.visualPayoffs, ...(chapterPlan.visualPayoffs ?? [])],
  };
}

// 2026-09-20 "bounded chapter concurrency" pass — real incident: v3's own
// call ledger confirmed 7 chapters planned strictly serially, ~8.5 minutes
// wall clock for a 7-chapter script. Each chapter call is independent (no
// chapter needs another chapter's OWN fresh output — cross-chapter cast/
// continuity already flows through accumulated entityRegistry/
// continuityGroups from PREVIOUSLY COMPLETED waves, unchanged), so up to
// MAX_CHAPTER_CONCURRENCY chapters now run concurrently per invocation —
// same bounded-concurrency principle already proven for search
// (SEARCH_CONCURRENCY) and extraction (EXTRACTION_CONCURRENCY). A chapter
// that fails is simply left out of plannedChapterIds and retried alone next
// invocation — it never blocks or duplicates its wave-mates, which persist
// normally. reserve() is still spent exactly ONCE for the whole phase.
const MAX_CHAPTER_CONCURRENCY = 4;

async function planNextChapter(
  admin: any,
  row: VisualPlanRow,
  project: any,
  scriptDocument: any,
  facts: { id: string; claim: string }[],
  existingCast: any[],
  reserve: () => Promise<void>
): Promise<{ done: true; plan: any } | { done: false }> {
  const chapters: any[] = scriptDocument.chapters ?? [];
  const plannedChapterIds: string[] = row.meta?.plannedChapterIds ?? [];
  const accumulated = row.visual_plan?.visualBeats ? row.visual_plan : emptyAccumulatedPlan();

  const pending = chapters.filter((c: any) => !plannedChapterIds.includes(c.chapterId));
  if (!pending.length) return { done: true, plan: accumulated };

  // Empty chapters (no narration) are skipped deterministically before any
  // real chapter is dispatched this call — zero provider calls, never
  // counted toward the concurrency wave (see the original single-chapter
  // fix's own comment: defense in depth against a script with a hollow
  // chapter reaching this stage at all).
  const emptyChapter = pending.find((c: any) => !(scriptDocument.narrationSegments ?? []).some((s: any) => s.chapterId === c.chapterId));
  if (emptyChapter) {
    const nextPlanned = [...plannedChapterIds, emptyChapter.chapterId];
    row.meta = { ...(row.meta ?? {}), plannedChapterIds: nextPlanned };
    await admin.from("long_form_visual_plan_versions").update({ meta: row.meta, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id).eq("stage_started_at", row.stage_started_at);
    return { done: false };
  }

  if (!plannedChapterIds.length) await reserve();

  const wave = pending.slice(0, MAX_CHAPTER_CONCURRENCY);
  const outcomes = await Promise.all(
    wave.map(async (chapter: any) => {
      const chapterSegments = (scriptDocument.narrationSegments ?? []).filter((s: any) => s.chapterId === chapter.chapterId);
      const usage = newUsageTotals();
      const repairNotes: ValidationIssue[] | undefined = row.meta?.chapterRepairNotes?.[chapter.chapterId];
      try {
        const chapterPlan = await runVisualDirectorForChapter(
          {
            narrativeStrategy: project.narrative_strategy,
            chapter,
            segments: chapterSegments,
            facts,
            existingCast,
            priorEntities: accumulated.entityRegistry,
            priorContinuityGroups: accumulated.continuityGroups,
            repairNotes,
          },
          usage
        );
        return { chapterId: chapter.chapterId as string, ok: true as const, chapterPlan, usage };
      } catch (error) {
        console.error(`[advance-long-form-visual-plan] chapter ${chapter.chapterId} planning failed (will retry alone next invocation):`, error instanceof Error ? error.message : String(error));
        return { chapterId: chapter.chapterId as string, ok: false as const, usage };
      }
    })
  );

  // Promise.all preserves input order regardless of resolution timing, so
  // folding in `outcomes` order is the same as folding chapters one at a
  // time in real chapter order — beat ordering is unaffected by concurrency.
  let merged = accumulated;
  const nextPlanned = [...plannedChapterIds];
  const usage = newUsageTotals();
  const ledger: any[] = [];
  for (const o of outcomes) {
    usage.inputTokens += o.usage.inputTokens;
    usage.outputTokens += o.usage.outputTokens;
    usage.modelCalls += o.usage.modelCalls;
    usage.reasoningTokens += o.usage.reasoningTokens;
    if (!o.ok) continue; // left out of plannedChapterIds -> retried alone next invocation, never duplicated
    merged = mergeChapterIntoAccumulated(merged, namespaceChapterBeatIds(o.chapterId, o.chapterPlan));
    nextPlanned.push(o.chapterId);
    ledger.push(ledgerEntry("planning_chapter", o.usage.inputTokens, o.usage.outputTokens));
  }

  // If the ENTIRE wave failed (zero real progress), this must behave exactly
  // like the old single-chapter version's own uncaught throw — routed
  // through the normal handleStageFailure retry/backoff path — rather than
  // silently resetting stage_attempt to 0 with nothing actually persisted,
  // which would let a systematically-failing wave loop forever and dodge
  // MAX_STAGE_ATTEMPTS entirely.
  if (nextPlanned.length === plannedChapterIds.length) {
    throw new Error(`chapter_planning_wave_failed: all ${wave.length} chapter(s) in this wave (${wave.map((c: any) => c.chapterId).join(",")}) failed`);
  }

  const meta = mergeMeta(row.meta, usage, { plannedChapterIds: nextPlanned }, undefined);
  meta.callLedger = [...(meta.callLedger ?? []), ...ledger];

  await admin
    .from("long_form_visual_plan_versions")
    .update({ visual_plan: merged, meta, stage_attempt: 0, worker_lock_until: null })
    .eq("id", row.id)
    .eq("stage_started_at", row.stage_started_at)
    .throwOnError();

  return { done: false };
}

// 2026-09-20 real-incident fix — "If the Sun Vanished Right Now" (project
// cf3ebf6e-..., visual plan attempts 7ed7bdca-... and 70cc0cdf-...): chapter-
// bounded planning worked exactly as designed (all 7 chapters planned,
// persisted, zero timeouts) but each chapter's beats carry CHAPTER-LOCAL
// sequenceIndex/timing — a model call scoped to one chapter has no way to
// know where earlier chapters left off. Concatenating those beats and
// feeding them straight into the episode-global validateVisualPlan meant
// every chapter restarted its own numbering/clock at 0, producing
// "sequenceIndex is not strictly increasing" at every chapter boundary and
// a total duration of 90s against a real ~628s script (only chapter 7's
// short local range survived as the "final" duration). This is a
// deterministic merge defect, not an LLM quality problem — fixed with ONE
// authoritative normalization pass, no new model call, run once right after
// all chapters are merged and BEFORE validateVisualPlan/canonicalizePlanCast/
// establishFirstSetups ever see the plan.
// 2026-09-20 real-incident fix, round 4 (v4) — durations were STILL wrong
// (362s vs a real 628s) after round 3's start-anchoring fix. Root cause:
// that fix only re-anchored each beat's START from its first narration
// segment, but its DURATION still came from `estimatedEndSeconds -
// estimatedStartSeconds` — the model's own CHAPTER-LOCAL numbers, which are
// exactly what's unreliable (a chapter call has no idea how many real
// seconds it actually spans). Every beat's real span now comes ENTIRELY
// from the narration segments it references — start from the EARLIEST
// referenced segment's real cumulative start, end from the LATEST
// referenced segment's real cumulative end — never the model's own
// duration guess. A beat with no resolvable segment reference still falls
// back to its own chapter's real anchor (never "chapter starts at 0").
function normalizeEpisodeSequencing(plan: any, scriptDocument: any) {
  const chapters: any[] = scriptDocument.chapters ?? [];
  const segments: any[] = scriptDocument.narrationSegments ?? [];
  const chapterOrder = new Map(chapters.map((c: any, i: number) => [c.chapterId, i]));

  // Narration is the master clock: each segment's real cumulative
  // start/end is derived purely from real per-segment estimatedSeconds, in
  // real script order — never a chapter's own beat trusting it starts at 0.
  const orderedSegments = [...segments].sort((a: any, b: any) => a.sequenceIndex - b.sequenceIndex);
  const segmentStart = new Map<string, number>();
  const segmentEnd = new Map<string, number>();
  let cursor = 0;
  for (const s of orderedSegments) {
    segmentStart.set(s.id, cursor);
    cursor += s.estimatedSeconds ?? 0;
    segmentEnd.set(s.id, cursor);
  }

  // Fallback anchor for a beat with NO resolvable segment reference at
  // all — that chapter's own first real segment's cumulative position,
  // never a bare chapter-local value assuming the chapter starts at 0.
  const chapterStart = new Map<string, number>();
  for (const c of chapters) {
    const firstSeg = orderedSegments.find((s: any) => s.chapterId === c.chapterId);
    chapterStart.set(c.chapterId, firstSeg ? (segmentStart.get(firstSeg.id) as number) : 0);
  }

  // Beats are already appended in real chapter order by planNextChapter —
  // this sort is a defensive guarantee, not a load-bearing reorder: chapter
  // order first, then each chapter's own (chapter-local) sequenceIndex.
  const beats = [...(plan.visualBeats ?? [])].sort((a: any, b: any) => {
    const ca = chapterOrder.get(a.chapterId) ?? 0;
    const cb = chapterOrder.get(b.chapterId) ?? 0;
    if (ca !== cb) return ca - cb;
    return (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0);
  });

  // A hard floor, never regressed below — guarantees global monotonicity
  // even in the worst case (every beat unresolvable), and means two beats
  // that happen to reference the SAME segment are placed sequentially
  // (never exactly overlapping) while each keeps its own real span length.
  let floor = 0;
  const normalizedBeats = beats.map((b: any, i: number) => {
    const resolvedIds = (b.narrationSegmentIds ?? []).filter((id: string) => segmentStart.has(id));
    let rawStart: number;
    let rawEnd: number;
    if (resolvedIds.length) {
      rawStart = Math.min(...resolvedIds.map((id: string) => segmentStart.get(id) as number));
      rawEnd = Math.max(...resolvedIds.map((id: string) => segmentEnd.get(id) as number));
    } else {
      const localDuration = Math.max(1, (b.estimatedEndSeconds ?? 0) - (b.estimatedStartSeconds ?? 0));
      rawStart = (chapterStart.get(b.chapterId) ?? floor) + (b.estimatedStartSeconds ?? 0);
      rawEnd = rawStart + localDuration;
    }
    const start = Math.max(rawStart, floor);
    const delta = start - rawStart; // however far the floor pushed this beat forward
    const end = Math.max(start + 1, rawEnd + delta); // shift end by the same amount, preserving this beat's own real span
    floor = end;
    return {
      ...b,
      // The LLM's own chapter-local numbering is preserved for debugging,
      // never trusted downstream — sequenceIndex below is the ONLY value
      // any later stage (validation, sequencing, storyboard summary,
      // compilation) may read as authoritative ordering.
      chapterLocalSequenceIndex: b.sequenceIndex,
      sequenceIndex: i,
      estimatedStartSeconds: start,
      estimatedEndSeconds: end,
    };
  });
  return { ...plan, visualBeats: normalizedBeats };
}

// 2026-09-20 real-incident fix, round 4 (v4) — the round-3 fix only nulled
// a fake locationId for beats CLASSIFIED as abstract (visualType/
// shotStrategy/renderMethod) — but v4's real failures were genuine
// STORY/ENVIRONMENT beats depicting Earth's surface ("earth_surface_
// closeup_lab", "earth_horizon_outdoor") that should have resolved to the
// registry's real "Earth" entity, not been left broken. A locationId must
// always be either a real registered LOCATION id or null — this replaces
// the narrower round-3 check with real deterministic resolution: exact
// match kept; an explicit abstract phrase (system-wide/cross-section/
// diagram/timeline/schematic) -> null; a referenced entity that's itself a
// registered location -> use it; otherwise the best keyword-overlap match
// against every registered location's own id/name -> use it; otherwise
// null. Never an LLM repair call.
const ABSTRACT_LOCATION_PATTERNS = [/\bsystem wide\b/, /\bcross section\b/, /\bdiagram\b/, /\btimeline\b/, /\bschematic\b/, /\bwide shot\b/];
const LOCATION_MATCH_STOPWORDS = new Set(["the", "and", "for", "with", "view", "shot", "scene", "close", "closeup", "outdoor", "indoor"]);
function tokenizeForLocationMatch(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((w) => w.length >= 3 && !LOCATION_MATCH_STOPWORDS.has(w))
  );
}
function resolveLocationId(rawLocationId: string | null | undefined, contextEntityIds: string[], locationEntities: any[], extraText?: string): string | null {
  if (!rawLocationId) return null;
  const locationIds = new Set(locationEntities.map((e: any) => e.id));
  if (locationIds.has(rawLocationId)) return rawLocationId;

  const normalized = rawLocationId.toLowerCase().replace(/[^a-z0-9]+/g, " ");
  if (ABSTRACT_LOCATION_PATTERNS.some((re) => re.test(normalized))) return null;

  // A referenced entity that IS ITSELF a registered location (e.g. the
  // model literally listed the canonical "Earth" id among primary/
  // supporting/persistent entities) is the strongest possible signal.
  const directEntityMatch = (contextEntityIds ?? []).find((id) => locationIds.has(id));
  if (directEntityMatch) return directEntityMatch;

  // Otherwise: the freeform description's own words, matched against every
  // registered location's own id+name — most-overlapping wins.
  const words = tokenizeForLocationMatch(`${rawLocationId} ${extraText ?? ""}`);
  let best: string | null = null;
  let bestScore = 0;
  for (const loc of locationEntities) {
    const locWords = tokenizeForLocationMatch(`${loc.id} ${loc.name ?? ""}`);
    let score = 0;
    for (const w of locWords) if (words.has(w)) score++;
    if (score > bestScore) {
      bestScore = score;
      best = loc.id;
    }
  }
  return bestScore > 0 ? best : null;
}
function normalizeLocationIds(plan: any) {
  const locationEntities = (plan.entityRegistry ?? []).filter((e: any) => e.category === "LOCATION");
  const visualBeats = (plan.visualBeats ?? []).map((b: any) => {
    const resolved = resolveLocationId(b.locationId, [...(b.primaryEntityIds ?? []), ...(b.supportingEntityIds ?? [])], locationEntities);
    return resolved === (b.locationId ?? null) ? b : { ...b, locationId: resolved };
  });
  const continuityGroups = (plan.continuityGroups ?? []).map((g: any) => {
    const resolved = resolveLocationId(g.locationId, g.persistentEntityIds ?? [], locationEntities, g.label);
    return resolved === (g.locationId ?? null) ? g : { ...g, locationId: resolved };
  });
  return { ...plan, visualBeats, continuityGroups };
}

async function stagePlanning(admin: any, row: VisualPlanRow, project: any, scriptDocument: any, factGraph: any) {
  const facts = compactFacts(factGraph);
  const usage = newUsageTotals();
  async function reserve() {
    const { data, error } = await admin.rpc("reserve_visual_plan_provider_call", { p_id: row.id, p_claim: row.stage_started_at });
    if (error || !data) throw new Error("PROVIDER_CALL_BUDGET_EXHAUSTED");
    row.meta = { ...(row.meta ?? {}), providerCallsReserved: (row.meta?.providerCallsReserved ?? 0) + 1 };
  }
  // 2026-09-20 durable-contract-compilation fix: ensureNarrationContract now
  // does AT MOST one chapter batch of real work per call and reports back
  // whether the contract is actually ready — reserve() is no longer called
  // unconditionally here (it now lives inside ensureNarrationContract,
  // spent exactly once per contract, on the call that first starts it; see
  // that function's own comment for why calling it on every resumption
  // would otherwise burn through providerCallLimit purely from healthy
  // multi-chapter progress). A "not ready yet" result is NOT a failure —
  // real progress (if any) is already durably persisted on the contract
  // row itself — so this returns normally (never throws) and clears this
  // row's own lease so the self-chain dispatch below can re-claim it
  // immediately for the next batch, rather than waiting out the full
  // outer stage lease between every single chapter.
  const contractResult = await ensureNarrationContract(admin, project, scriptDocument, reserve);
  if (!contractResult.ready) {
    await admin.from("long_form_visual_plan_versions").update({ meta: row.meta, stage_attempt: 0, worker_lock_until: null }).eq("id", row.id).eq("stage_started_at", row.stage_started_at);
    return;
  }
  const contractVersionId = contractResult.id;
  const existingCast = await fetchExistingCast(admin, project);

  // 2026-09-20 "V1 simplification" pass — CHAPTER-BOUNDED PLANNING for a
  // new-style script (see planNextChapter's own comment): one chapter's
  // provider call and persistence per invocation, so a failure or worker
  // death only ever loses the ONE chapter in flight, never earlier
  // completed chapters. A legacy script (no inline visual metadata) keeps
  // the original single monolithic call unchanged below.
  const isChapterBounded = (scriptDocument.narrationSegments ?? []).every((s: any) => s.visualIntent != null);
  let plan: any;
  let repairCalls = row.meta?.repairCalls ?? 0;
  let deterministicAdjustments: any[] = [];

  if (isChapterBounded) {
    const chapterResult = await planNextChapter(admin, row, project, scriptDocument, facts, existingCast, reserve);
    if (!chapterResult.done) return; // one chapter persisted this call — self-chain continues to the next
    plan = normalizeEpisodeSequencing(chapterResult.plan, scriptDocument);
    const normalized = establishFirstSetups(canonicalizePlanCast(plan, existingCast));
    plan = normalized.plan;
    deterministicAdjustments = normalized.changes;
  } else {
    await reserve();
    plan = await runVisualDirector(project.narrative_strategy, project.storyPlan, scriptDocument, facts, usage, undefined, existingCast);
    plan = canonicalizePlanCast(plan, existingCast);
    let normalized = establishFirstSetups(plan);
    plan = normalized.plan;
    deterministicAdjustments = normalized.changes;
  }

  // Deterministic, no provider call, applies regardless of path — a fake
  // freeform locationId (e.g. "space diagram", "earth_surface_closeup_lab")
  // on any beat or continuity group must never reach validation as a hard
  // failure; it's either resolved to a real registered LOCATION entity or
  // set to null (see the function's own comment for the real incident).
  plan = normalizeLocationIds(plan);

  const validFactIds = new Set(facts.map((f) => f.id));
  let result = validateVisualPlan(plan, scriptDocument, validFactIds);

  // CORRECT PIPELINE ORDER: model output -> normalize -> validate -> repair
  // (if still needed) -> normalize AGAIN -> validate again. The repair call
  // is a full fresh regeneration, not a patch — its output has never been
  // through establishFirstSetups, so validating it directly (as this used
  // to) could fail on a reuse_before_setup violation the repair call itself
  // introduced, even though that class of error is always deterministically
  // fixable. Real incident: the repair call's own output introduced two new
  // first-occurrence violations under a different beat-id scheme than the
  // initial call, and since normalization never ran on it, both survived
  // straight through to the terminal VISUAL_PLAN_VALIDATION_FAILED (Visual
  // Plan 257d6183-...). Because normalization already ran BEFORE this first
  // validation too, a plan whose ONLY problem was reuse_before_setup never
  // reaches the repair branch at all — it's already fixed for free.
  //
  // The chapter-bounded path deliberately does NOT retry via a whole-plan
  // monolithic repair call here — that would reintroduce exactly the
  // multi-minute single-call problem chapter-bounding exists to remove. A
  // validation failure surviving normalization on a chapter-bounded plan
  // fails cleanly below instead (rare in practice: per-chapter calls are
  // small and normalization already fixes the common defect class).
  if (!isChapterBounded && result.errors.length && repairCalls < MAX_REPAIR_CALLS && row.meta.providerCallsReserved < (row.meta.providerCallLimit ?? 3)) {
    await reserve();
    repairCalls += 1;
    plan = await runVisualDirector(project.narrative_strategy, project.storyPlan, scriptDocument, facts, usage, result.errors, existingCast);
    plan = canonicalizePlanCast(plan, existingCast);
    const normalized = establishFirstSetups(plan);
    plan = normalized.plan;
    deterministicAdjustments = [...deterministicAdjustments, ...normalized.changes];
    result = validateVisualPlan(plan, scriptDocument, validFactIds);
  }

  // Chapter-bounded: real usage/cost was already recorded per-chapter
  // inside planNextChapter's own mergeMeta calls — this final wrap-up only
  // adds the extra summary fields, never a second (zero-token) ledger entry
  // on top of the real per-chapter ones.
  const genericCastWarnings = detectGenericCastReplacements(plan.entityRegistry ?? [], existingCast);
  const summaryExtra = { repairCalls, validation: result, deterministicAdjustments, existingCastSize: existingCast.length, genericCastWarnings };
  const meta = isChapterBounded ? { ...row.meta, ...summaryExtra } : mergeMeta(row.meta, usage, summaryExtra, ledgerEntry("planning", usage.inputTokens, usage.outputTokens));

  if (result.errors.length) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", visual_plan: plan, last_error_code: "VISUAL_PLAN_VALIDATION_FAILED", last_error_at: new Date().toISOString(), meta, worker_lock_until: null }).eq("id", row.id).eq("stage_started_at", row.stage_started_at);
    return;
  }

  const entityRegistry = plan.entityRegistry ?? [];
  plan.narrationContractVersionId = contractVersionId;
  const continuityGroups = plan.continuityGroups ?? [];
  await admin
    .from("long_form_visual_plan_versions")
    .update({
      visual_plan: plan,
      visual_mode: plan.visualMode,
      entity_registry: entityRegistry,
      continuity_groups: continuityGroups,
      world_state_model: worldStateModelFromGroups(continuityGroups),
      generation_model: OPENAI_MODEL,
      meta,
      stage: "finalizing",
      stage_attempt: 0,
      worker_lock_until: null,
    })
    .eq("id", row.id).eq("stage_started_at", row.stage_started_at).throwOnError();
}

async function stageFinalizing(admin: any, row: VisualPlanRow, project: any, scriptDocument: any, factGraph: any) {
  const preNormalized = establishFirstSetups(row.visual_plan);
  // Part 2/3/4 (2026-09-15 content-grounding pass): the On-Screen Text /
  // Explainer Density project setting is consumed HERE, once, at Storyboard
  // compile time — never re-read at Scene Generation time, since
  // refineVisualSequences's own shotPlannerVersion guard means a project
  // whose storyboard already exists never reprocesses this pass anyway.
  const textDensity = ["minimal", "balanced", "frequent"].includes(project?.on_screen_text_density) ? project.on_screen_text_density : "balanced";
  // 2026-09-16 "production invariants" pass — closing a real wiring gap
  // found auditing Mars: the Narration Visual Contract (compiled via the
  // standalone analyze-long-form-narration-contract endpoint) was already
  // being read at SCENE-compile time (start-long-form-scene-generation, for
  // prompt semantic notes and reference criticality) but NEVER here, at
  // STORYBOARD/shot-planning time — meaning every contract-driven render-
  // strategy/diversity decision refineVisualSequences+assignRenderStrategies
  // can make (Sections 6-10 of the "rebuild the Visual Director" pass) never
  // actually ran for ANY real project through this normal pipeline; Mars's
  // one "improved" run only got it because a manual one-off script spliced
  // contractClaims in directly, bypassing this function entirely. This only
  // READS an already-compiled contract if one exists (same lookup
  // start-long-form-scene-generation already does) — it never triggers a
  // new (paid) compilation, so a project with no contract yet behaves
  // exactly as before.
  const contractVersionId = row.visual_plan?.narrationContractVersionId;
  if (!contractVersionId) throw new Error("NARRATION_CONTRACT_REQUIRED");
  const { data: contractRow, error: contractError } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", contractVersionId).eq("project_id", project.id).maybeSingle();
  if (contractError || contractRow?.status !== "ready" || contractRow?.script_version_id !== project.current_script_version_id || !contractRow?.claims?.length) throw new Error("NARRATION_CONTRACT_REQUIRED");
  const contractClaims = contractRow.claims;
  const refined = refineVisualSequences(preNormalized.plan, scriptDocument, textDensity, contractClaims);
  // refineVisualSequences computes its own first-occurrence tracking fresh
  // (a local `established` Set keyed off each macro beat's baseSetupKey) to
  // decide the fine-grained shots' own shotStrategy — it does not consume
  // the macro-level shotStrategy this function just normalized, so THAT
  // normalization pass doesn't by itself guarantee the shot-level output is
  // clean. Validation runs on the fine-grained array (plan.visualBeats,
  // post-refinement), so per the invariant that first-setup normalization
  // must run on the EXACT final array validation receives, it has to run
  // again here, after refinement — normalizing the pre-refinement macro
  // array alone left this stage with no safety net on what it actually
  // validates.
  const postNormalized = establishFirstSetups(refined);
  // NARRATION IS THE MASTER CLOCK: retimes every shot against the script's
  // real, CURRENT per-segment word-count timing — never a no-op skip, since
  // it's the only place this stage re-derives timing from the narration
  // rather than trusting whatever the plan already has. Safe unconditionally:
  // a plan refineVisualSequences just correctly real-timed rescales real-to-
  // real (a no-op); a legacy plan generated before this fix (already at
  // shotPlannerVersion, so refineVisualSequences above was a pass-through
  // clone) gets its drifted absolute timestamps corrected in place, with any
  // shot the correction would push over its duration limit re-split locally
  // — never a provider call either way. Real incident: a legacy plan's
  // shot-level timing summed to 570s against its script's real 811s.
  const plan = retimeVisualBeats(postNormalized.plan, scriptDocument);
  // Part 4 of the 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass: durably pin
  // EXACTLY which contract version this plan's semantics came from, inside
  // the plan JSON itself — the real bug this closes: Mars's beats carry
  // real claim IDs from a specific contract version while
  // project.current_narration_contract_version_id reads NULL today (the
  // pointer moved/was never set independently of what actually produced
  // this plan). Every later stage (scene compile, graphic compile) must
  // read THIS pinned value, never re-resolve "whatever is current".
  (plan as any).narrationContractVersionId = contractVersionId;
  sequenceEpisode(plan.visualBeats);
  const contractErrors = validatePlanContract(plan, contractRow, project.current_script_version_id);
  if (contractErrors.length) throw new Error(`NARRATION_CONTRACT_REPLAN_REQUIRED:${contractErrors.slice(0, 5).join(";")}`);
  const changes = [...preNormalized.changes, ...postNormalized.changes];
  // 2026-09-19 "make the narration contract mandatory" V1 fix, preflight
  // half: start-long-form-scene-generation fails closed on a
  // PROGRAMMATIC_GRAPHIC beat with no narrationClaimId (GRAPHIC_REPLAN_
  // REQUIRED, by design — no silent legacy text fallback). A plan must never
  // reach 'ready' carrying a graphic beat that is ALREADY known to fail that
  // gate — that is precisely how Mars shipped 19 GRAPHIC beats, 0 compiling
  // scene rows. ensureNarrationContract (stagePlanning) guarantees a real
  // contract exists by this point; if a graphic beat still has no bound
  // claim, the contract's own compiler didn't cover that narration range —
  // hold this plan for replan rather than let it look "ready".
  const unclaimedGraphicBeats = (plan.visualBeats ?? []).filter((b: any) => b.renderMethod === "PROGRAMMATIC_GRAPHIC" && !b.narrationClaimId);
  if (unclaimedGraphicBeats.length) throw new Error(`GRAPHIC_BEATS_MISSING_CONTRACT_CLAIM:${unclaimedGraphicBeats.length}`);
  const density = visualDensity(plan);
  if (!density.passed) throw new Error("INSUFFICIENT_VISUAL_DENSITY");
  const validation = validateVisualPlan(plan, scriptDocument, new Set(compactFacts(factGraph).map(f => f.id)), true);
  if (validation.errors.length) throw new Error("VISUAL_PLAN_VALIDATION_FAILED");
  const storyboardSummary = computeStoryboardSummary(plan);
  // 2026-09-19 "cast director" V1 fix — Part "add an episode-level cast-
  // presence ledger so a recurring character is not introduced and then
  // accidentally forgotten." Kept deliberately simple (per-entity distinct-
  // chapter-appearance counts, informational only, never a hard gate) —
  // real scheduling/enforcement is explicitly out of scope for V1.
  const castPresence: Record<string, string[]> = {};
  for (const beat of plan.visualBeats ?? []) {
    for (const entityId of [...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])]) {
      if (!castPresence[entityId]) castPresence[entityId] = [];
      if (!castPresence[entityId].includes(beat.chapterId)) castPresence[entityId].push(beat.chapterId);
    }
  }
  await admin.from("long_form_visual_plan_versions").update({ status: "ready", visual_plan: plan, visual_mode: plan.visualMode, entity_registry: plan.entityRegistry, continuity_groups: plan.continuityGroups, world_state_model: worldStateModelFromGroups(plan.continuityGroups), generation_model: OPENAI_MODEL, meta: { ...row.meta, validation, deterministicAdjustments: [...(row.meta?.deterministicAdjustments ?? []), ...changes], castPresence }, last_error_code: null, storyboard_summary: storyboardSummary, worker_lock_until: null }).eq("id", row.id).eq("stage_started_at", row.stage_started_at).throwOnError();
  // 2026-09-19 "Replan Episode Visuals" pass (items 2/3/8), refined
  // 2026-09-20 (real incident — "If the Sun Vanished Right Now"): the
  // original rule ("has a parent -> always requires manual review") assumed
  // a parent row means "an explicit replan of an already-usable plan the
  // user reviewed." That's false whenever the parent never actually became
  // usable (e.g. it failed validation) — a plain RETRY after a failure also
  // gets a parent pointer from start_visual_plan_version, but there was
  // never anything for the user to review or lose. Real repro: v1 failed,
  // v2 (v1's "child") finished validation cleanly but sat un-adopted forever
  // because v2.parent_visual_plan_version_id was non-null, even though the
  // project had NO usable plan at all. The real distinction is not "does
  // this row have a parent" but "does the project currently have an
  // ADOPTED, READY plan worth protecting" — only then must a new one wait
  // for a real user review (adopt_visual_plan_version, "Use This Plan").
  const { data: currentProjectPointer } = await admin.from("long_form_projects").select("current_visual_plan_version_id").eq("id", project.id).maybeSingle();
  let currentIsUsable = false;
  if (currentProjectPointer?.current_visual_plan_version_id) {
    const { data: currentPlan } = await admin.from("long_form_visual_plan_versions").select("status").eq("id", currentProjectPointer.current_visual_plan_version_id).maybeSingle();
    currentIsUsable = currentPlan?.status === "ready";
  }
  if (!currentIsUsable) {
    await admin.from("long_form_projects").update({ current_visual_plan_version_id: row.id, updated_at: new Date().toISOString() }).eq("id", project.id).eq("current_script_version_id", row.script_version_id).throwOnError();
  }
}

/* ============================ Dispatch + failure handling ============================ */

function backgroundDispatch(promise: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[advance-long-form-visual-plan] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}
async function dispatchNext(id: string) {
  const response = await fetch(SELF_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualPlanVersionId: id }) });
  if (!response.ok) throw new Error(`Visual Plan dispatch HTTP ${response.status}`);
}
// stage_attempt is NO LONGER incremented here — claim_long_form_visual_plan_stage
// (_by_id) now increments it atomically at claim time (see the 20260916120000
// crash-safety migration); incrementing again here would overcount.
async function handleStageFailure(admin: any, row: VisualPlanRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
  console.error(`[advance-long-form-visual-plan] stage ${row.stage} failed (attempt ${attempt}) for plan ${row.id}:`, errorCode);
  if (attempt >= MAX_STAGE_ATTEMPTS || (row.stage === "planning" && (row.meta?.providerCallsReserved ?? 0) >= (row.meta?.providerCallLimit ?? 3))) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id).eq("stage_started_at", row.stage_started_at);
    return;
  }
  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_visual_plan_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id).eq("stage_started_at", row.stage_started_at);
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  const recovery = Boolean(RECOVERY_SECRET && req.headers.get("x-recovery-secret") === RECOVERY_SECRET);
  if ((!ADVANCE_SECRET || secret !== ADVANCE_SECRET) && !recovery) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.action === "diagnose") return json({ paused: VISUAL_PLAN_PAUSED, advanceSecretConfigured: Boolean(ADVANCE_SECRET), openAIConfigured: Boolean(OPENAI_KEY), claimed: false });
  if (!OPENAI_KEY) return json({ error: "Visual Plan is not configured" }, 500);

  const targetId = body?.visualPlanVersionId ? String(body.visualPlanVersionId) : null;
  if (recovery && !targetId) return json({ error: "Target required" }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  if (VISUAL_PLAN_PAUSED) {
    const { data: target } = targetId ? await admin.from("long_form_visual_plan_versions").select("meta").eq("id", targetId).maybeSingle() : { data: null };
    if (target?.meta?.resumeWhilePaused !== true) return json({ paused: true, claimed: false });
  }

  const { data: claimedRows, error: claimError } = targetId
    ? await admin.rpc("claim_long_form_visual_plan_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_visual_plan_stage", { p_limit: 1 });
  if (claimError) { console.error("[visual-plan] claim failed", claimError.code); return json({ error: "Claim failed" }, 500); }

  const row = claimedRows?.[0];
  if (!row) return json({ claimed: false });
  console.info("[visual-plan] claimed", { id: row.id, stage: row.stage, attempt: row.stage_attempt, startedAt: row.stage_started_at, lease: row.worker_lock_until });
  const work = async () => {

  if ((row.meta?.estimatedTotalCostUsd ?? 0) >= MAX_VISUAL_PLAN_COST_USD) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", last_error_code: "COST_CEILING_EXCEEDED", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: scriptRow } = await admin.from("long_form_script_versions").select("script_document, story_plan_version_id, research_version_id").eq("id", row.script_version_id).maybeSingle();
  const { data: storyPlanRow } = scriptRow ? await admin.from("long_form_story_plan_versions").select("story_plan").eq("id", scriptRow.story_plan_version_id).maybeSingle() : { data: null };
  const { data: researchRow } = scriptRow ? await admin.from("long_form_research_versions").select("fact_graph").eq("id", scriptRow.research_version_id).maybeSingle() : { data: null };

  if (!project || !scriptRow || !storyPlanRow) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", last_error_code: "PROJECT_SCRIPT_OR_PLAN_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }
  const projectWithStoryPlan = { ...project, storyPlan: storyPlanRow.story_plan };
  const scriptDocument = scriptRow.script_document;
  const factGraph = researchRow?.fact_graph ?? { facts: [] };

  try {
    switch (row.stage) {
      case "planning":
        await stagePlanning(admin, row, projectWithStoryPlan, scriptDocument, factGraph);
        break;
      case "finalizing":
        await stageFinalizing(admin, row, projectWithStoryPlan, scriptDocument, factGraph);
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
  };
  EdgeRuntime.waitUntil(work().catch(error => handleStageFailure(admin, row, error)));
  return json({ claimed: true, id: row.id, stage: row.stage, attempt: row.stage_attempt });
});
