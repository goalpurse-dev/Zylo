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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_PLAN_ADVANCE_SECRET") ?? "";
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
const PLAN_TIMEOUT_MS = 140_000;
const MAX_STAGE_ATTEMPTS = 3;
const MAX_REPAIR_CALLS = 1;
const MAX_VISUAL_PLAN_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_VISUAL_PLAN_COST_USD") ?? 0.3);

const GPT5_MINI_INPUT_PER_M = 0.25;
const GPT5_MINI_OUTPUT_PER_M = 2.0;

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

CORE QUESTION — ask this for every narration region, never anything weaker: "What does the viewer need to SEE right now?" Valid reasons include: understand a mechanism, see story progression, observe a state change, meet a new person, enter a new location, see evidence or an object, understand scale, understand geography, feel an emotional beat, see a before/after, see cause/effect, refresh visual attention, or set up a later payoff. Never "what image matches this sentence" — a VisualBeat is not one image per sentence, and it is not equivalent to an image at all: it describes what the viewer should see during a narration interval and why.

VISUAL MODE: choose STORY (character/location/prop/continuity-heavy), EXPLAINER (mechanisms/diagrams/cutaways, minimal character continuity), or HYBRID (both), based on what this specific topic actually is — a personal/experiential topic skews STORY, a mechanism/how-it-works topic skews EXPLAINER, a topic combining a recurring human element with real explanation (e.g. a survival story that also explains the physics of cold) is HYBRID. Report an approximate visualMix (storyIllustrationPct/explainerGraphicsPct/mapDataPct, roughly summing to 100) as planning metadata only — never a quota to force.

MINIMIZE EXPENSIVE GENERATIONS — this is as important as narrative judgment: track a baseSetupKey per visual "setup" (a specific location + camera angle + composition family, e.g. "longhouse_hearth_cam_A"), and deliberately have MULTIPLE beats share the same baseSetupKey when the underlying scene hasn't fundamentally changed. Use NEW_SETUP only for: a new location, a new major time period, a new environment, a new character introduction, a major concept shift, new explanatory grammar, a large camera geometry change, a major reveal, or genuinely significant visual novelty. Use REUSE_WITH_DELTA for: the same location, the same continuity sequence, the same composition family, a local story change (e.g. sitting → standing, hearth off → hearth lit, dry → snow-covered), or whenever stability itself helps the viewer notice the progression. A topic with real continuity (recurring people/places) should show real reuse in your baseSetupKey assignments, not a fresh setup for every beat.

shotStrategy and renderMethod are INDEPENDENT axes — never assume one implies the other. shotStrategy describes the STORYBOARD role (NEW_SETUP, REUSE_WITH_DELTA, INSERT, DETAIL, DIAGRAM, MAP, COMPARISON, TEXT_INFOGRAPHIC). renderMethod describes HOW it would actually be produced later (GENERATE, EDIT, REUSE, CROP, COMPOSITE, PROGRAMMATIC_GRAPHIC) — e.g. an INSERT is often PROGRAMMATIC_GRAPHIC, a REUSE_WITH_DELTA is often EDIT, a DIAGRAM is often PROGRAMMATIC_GRAPHIC or GENERATE depending on complexity. Choose whichever combination is actually correct for that beat.

VISUAL TYPES (use the closest fit, don't invent new ones): STORY_ILLUSTRATION, ENVIRONMENT, CHARACTER, OBJECT_DETAIL, DIAGRAM, MAP, COMPARISON, CUTAWAY, TIMELINE, PROGRAMMATIC_GRAPHIC.

PROGRAMMATIC TEXT: never plan an image-generated beat to carry important text (titles, labels, numbers, arrows, captions, charts, UI, timelines) — those are TEXT_INFOGRAPHIC/PROGRAMMATIC_GRAPHIC beats rendered later by code, not by an image model. Note this in forbiddenElements when relevant (e.g. "no readable text in the generated image").

ENTITY REGISTRY: extract every CHARACTER, LOCATION, IMPORTANT_OBJECT, VEHICLE_MACHINE, and DIAGRAM_SUBJECT that actually recurs or matters, classify importance as HERO (central, recurring, identity-sensitive), RECURRING (appears multiple times, matters but isn't central), or INCIDENTAL (appears once, low stakes) — and set referenceNeeded/referencePriority based on how much it would actually cost the video's consistency to NOT have a locked reference for it. An object mentioned once in passing is referenceNeeded:false. A hero character, a recurring vehicle, or a location returned to multiple times is referenceNeeded:true with priority high.

CONTINUITY GROUPS: group beats that share the same visual world-state into a ContinuityGroup (e.g. "longhouse_night", "viking_ship_storm") with a locationId, a small set of cameraAnchors (not unlimited views — a handful of named angles a scene can return to), the props that matter for that sequence, and which entities persist through it. Track WorldState as SPARSE inheritedState key/value pairs — only variables actually likely to cause a visible continuity error for THIS topic (e.g. timeOfDay, weather, outfit, a held object's location, a fire's state) — never a universal state model. A beat inherits the previous stable state in its group rather than silently resetting it.

REVEAL CONSTRAINTS: if the narration reveals something specific (a secret, a twist, an object "he hadn't noticed yet"), the beat(s) before that reveal must not show it — note this explicitly in revealConstraints. This is a core anti-spoiler requirement, not optional polish.

FACTUAL VISUAL CONSTRAINTS: when a beat makes a visual claim that is itself a factual claim (a historical garment, a technical diagram, a specific device), cite the factId(s) it should stay consistent with in factualVisualConstraints. Not every beat needs this — only ones making a real factual visual claim.

VISUAL PAYOFFS: track a narratively important recurring visual element (e.g. cracked boots shown early, failing later) with a setupBeatId and, once resolved, a payoffBeatId. Don't overuse this — only for genuinely deliberate visual throughlines.

PACING: do not use a fixed "new image every N seconds" rule. High-information sections change roughly every 3-8 seconds; slower narrative sections roughly every 6-15 seconds; an important/emotional beat can hold 12-20 seconds. Cover every meaningful narration region — not every sentence needs its own beat, but do not leave a 30-60+ second stretch of narration with no visual beat at all unless that gap is a deliberate choice (rare).`;

function visualPlanInput(ctx: { narrativeStrategy: any; storyPlan: any; scriptDocument: any; facts: { id: string; claim: string }[]; repairNotes?: any[] }) {
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
  if (ctx.repairNotes?.length) {
    lines.push(``, `YOUR PREVIOUS ATTEMPT HAD STRUCTURAL PROBLEMS — FIX THESE EXACTLY:`, JSON.stringify(ctx.repairNotes, null, 2));
  }
  return lines.join("\n");
}

/* ============================ Deterministic validators (zero AI cost) ============================ */

type ValidationIssue = { code: string; message: string; beatIds?: string[] };
type ValidationResult = { errors: ValidationIssue[]; warnings: ValidationIssue[] };

function validateVisualPlan(plan: any, scriptDocument: any, validFactIds: Set<string>): ValidationResult {
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

  const scriptDuration = scriptDocument.estimatedDurationSeconds ?? 0;
  const planDuration = beats.length ? Math.max(...beats.map((b) => b.estimatedEndSeconds)) : 0;
  if (scriptDuration > 0 && Math.abs(planDuration - scriptDuration) / scriptDuration > 0.25) {
    warnings.push({ code: "duration_mismatch", message: `Plan's total duration (${planDuration}s) diverges from the script's estimated duration (${scriptDuration}s) by more than 25%.` });
  }

  return { errors, warnings };
}

/* ============================ Storyboard summary (zero cost) ============================ */

function computeStoryboardSummary(plan: any) {
  const beats: any[] = plan.visualBeats ?? [];
  const baseSetupKeys = new Set(beats.filter((b) => b.shotStrategy === "NEW_SETUP" && b.baseSetupKey).map((b) => b.baseSetupKey));
  return {
    totalVisualBeats: beats.length,
    estimatedBaseSetups: baseSetupKeys.size,
    estimatedEdits: beats.filter((b) => b.shotStrategy === "REUSE_WITH_DELTA" && b.renderMethod === "EDIT").length,
    estimatedInserts: beats.filter((b) => b.shotStrategy === "INSERT").length,
    estimatedDiagrams: beats.filter((b) => b.visualType === "DIAGRAM" || b.shotStrategy === "DIAGRAM").length,
    estimatedMaps: beats.filter((b) => b.visualType === "MAP" || b.shotStrategy === "MAP").length,
    estimatedProgrammaticGraphics: beats.filter((b) => b.renderMethod === "PROGRAMMATIC_GRAPHIC").length,
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

async function runVisualDirector(narrativeStrategy: any, storyPlan: any, scriptDocument: any, facts: { id: string; claim: string }[], usage: UsageTotals, repairNotes?: ValidationIssue[]) {
  const chapterIds = (scriptDocument.chapters ?? []).map((c: any) => c.chapterId);
  const segmentIds = (scriptDocument.narrationSegments ?? []).map((s: any) => s.id);
  const factIds = facts.map((f) => f.id);
  return await callStructured(
    {
      model: OPENAI_MODEL,
      store: false,
      instructions: VISUAL_DIRECTOR_INSTRUCTIONS,
      input: visualPlanInput({ narrativeStrategy, storyPlan, scriptDocument, facts, repairNotes }),
      text: { format: { type: "json_schema", name: "visual_plan", strict: true, schema: buildVisualPlanSchema(chapterIds, segmentIds, factIds) } },
    },
    PLAN_TIMEOUT_MS,
    usage
  );
}

async function stagePlanning(admin: any, row: VisualPlanRow, project: any, scriptDocument: any, factGraph: any) {
  const facts = compactFacts(factGraph);
  const usage = newUsageTotals();
  let plan = await runVisualDirector(project.narrative_strategy, project.storyPlan, scriptDocument, facts, usage);
  let repairCalls = row.meta?.repairCalls ?? 0;

  const validFactIds = new Set(facts.map((f) => f.id));
  let result = validateVisualPlan(plan, scriptDocument, validFactIds);

  if (result.errors.length && repairCalls < MAX_REPAIR_CALLS) {
    repairCalls += 1;
    plan = await runVisualDirector(project.narrative_strategy, project.storyPlan, scriptDocument, facts, usage, result.errors);
    result = validateVisualPlan(plan, scriptDocument, validFactIds);
  }

  const ledger = ledgerEntry("planning", usage.inputTokens, usage.outputTokens);
  const meta = mergeMeta(row.meta, usage, { repairCalls }, ledger);

  if (result.errors.length) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", last_error_code: "VISUAL_PLAN_VALIDATION_FAILED", last_error_at: new Date().toISOString(), meta, worker_lock_until: null }).eq("id", row.id);
    return;
  }

  const entityRegistry = plan.entityRegistry ?? [];
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
    .eq("id", row.id);
}

async function stageFinalizing(admin: any, row: VisualPlanRow, project: any, _scriptDocument: any) {
  const plan = row.visual_plan;
  const storyboardSummary = computeStoryboardSummary(plan);
  await admin.from("long_form_visual_plan_versions").update({ status: "ready", storyboard_summary: storyboardSummary, worker_lock_until: null }).eq("id", row.id);
  await admin.from("long_form_projects").update({ current_visual_plan_version_id: row.id, updated_at: new Date().toISOString() }).eq("id", project.id);
}

/* ============================ Dispatch + failure handling ============================ */

function backgroundDispatch(promise: Promise<unknown>) {
  if (VISUAL_PLAN_PAUSED) return;
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = promise.catch((e: unknown) => console.error("[advance-long-form-visual-plan] dispatch failed", e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}
async function dispatchNext(id: string) {
  await fetch(SELF_URL, { method: "POST", headers: { "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualPlanVersionId: id }) });
}
// stage_attempt is NO LONGER incremented here — claim_long_form_visual_plan_stage
// (_by_id) now increments it atomically at claim time (see the 20260916120000
// crash-safety migration); incrementing again here would overcount.
async function handleStageFailure(admin: any, row: VisualPlanRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
  console.error(`[advance-long-form-visual-plan] stage ${row.stage} failed (attempt ${attempt}) for plan ${row.id}:`, errorCode);
  if (attempt >= MAX_STAGE_ATTEMPTS) {
    await admin.from("long_form_visual_plan_versions").update({ status: "failed", last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return;
  }
  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_visual_plan_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id);
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  if (!ADVANCE_SECRET || secret !== ADVANCE_SECRET) return json({ error: "Unauthorized" }, 401);
  if (VISUAL_PLAN_PAUSED) return json({ paused: true, claimed: false });
  if (!OPENAI_KEY) return json({ error: "Visual Plan is not configured" }, 500);

  const body = await req.json().catch(() => ({}));
  const targetId = body?.visualPlanVersionId ? String(body.visualPlanVersionId) : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: claimedRows } = targetId
    ? await admin.rpc("claim_long_form_visual_plan_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_visual_plan_stage", { p_limit: 1 });

  const row = claimedRows?.[0];
  if (!row) return json({ claimed: false });

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
        await stageFinalizing(admin, row, projectWithStoryPlan, scriptDocument);
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
