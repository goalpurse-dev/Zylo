// deno-lint-ignore-file no-explicit-any
// advance-long-form-visual-world/index.ts
//
// The durable worker behind Visual World / Canonical References — the
// first real image-production milestone. Same proven stage-machine shape
// as Research/Script/Visual Plan (self-chained dispatch, claim/lease via
// SKIP LOCKED with claim-time attempt increment — see the 20260916120000
// crash-safety migration, inherited from day one here rather than
// rediscovered later):
//
//   planning (ONE Reference Planner OpenAI call, cost-ceiling-guarded, at
//   most one bounded repair; deterministic view-count derivation needs no
//   LLM at all — see _shared/visualWorldStyle.ts) -> generating (claim one
//   pending long_form_reference_assets row per invocation, submit its
//   Runware job through the SAME jobs/job-worker pipeline every other Zyvo
//   image tool uses — see generate-long-form-preview for the proven
//   zero-credit job-insert shape this mirrors — then watch it to
//   completion) -> finalizing (zero-cost: build the reference board layout
//   metadata, roll up real cost, persist).
//
// Reference generation deliberately does NOT reimplement Runware
// submission/polling/heartbeat — job-worker + runware-image already do
// that durably. This function's own crash-safety is about its OWN
// orchestration step (has a job been created yet for this asset; has that
// job finished) at the row level, not about re-deriving Runware's retry
// logic.
//
// Auth: NOT user-facing — invoked only by start-long-form-visual-world's
// dispatch or this function's own self-chain, both presenting the shared
// x-cron-secret header.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ZYVO_STYLE_SPEC, createStyleBible, deriveRequiredViews, resolveEffectiveEntityCategory, REFERENCE_PLAN_BUDGET, compileReferencePrompt, compileDerivedSheetEdit, estimateReferenceCosts, getStylePresetForProject, validateCompiledReferencePrompt, validateCanonicalReferencePrompt, deriveReferenceQAExpectations, CHARACTER_REFERENCE_ROLES, CHARACTER_IDENTITY_SPEC_SCHEMA, FACE_CROP_RECT, findMissingRequiredViewRows, ADOPT_SOURCE_ANGLE, SHEET_PROMPT_CONTRACT_VERSION, SHEET_PROMPT_COMPILER_VERSION, CHARACTER_SHEET_CONTRACT_VERSION, STYLE_LOCK_CONTRACT_VERSION } from "../_shared/visualWorldStyle.ts";
import { resolveReferenceReuse, type ReuseMatch } from "../_shared/visualWorldReconciliation.ts";
import { ensureReferenceJob, referenceJobResult } from "../_shared/visualWorldJobs.ts";
import { isCanonicalReference, characterReferenceStrategy } from "../_shared/characterTurnaround.js";
import { referenceRendererPolicy, acceptedIdentityAnchor, compileGeometryEdit, IDENTITY_ANCHOR_ANGLES, clampPositivePrompt, CHARACTER_SHEET_RENDERER_POLICY_VERSION, KLING_SHEET_RENDERER_POLICY_VERSION } from "../_shared/referenceRendererPolicy.js";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { runCharacterPackQA, runSheetQA, runCharacterReferenceSheetQA, runCanonicalReferenceQA } from "../_shared/referenceQA.ts";
import { analyzeReferenceHierarchy } from "../_shared/referenceHierarchy.ts";
import { GPT5_MINI_INPUT_PER_M, GPT5_MINI_OUTPUT_PER_M } from "../../../src/lib/longFormPipelineConstants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ADVANCE_SECRET = Deno.env.get("LONG_FORM_VISUAL_WORLD_ADVANCE_SECRET") ?? "";
const RECOVERY_SECRET = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const OPENAI_RESPONSES = "https://api.openai.com/v1/responses";
const OPENAI_MODEL = "gpt-5-mini";
const SELF_URL = `${SUPABASE_URL}/functions/v1/advance-long-form-visual-world`;

const VISUAL_WORLD_PAUSED = (Deno.env.get("LONG_FORM_VISUAL_WORLD_PAUSED") ?? "").trim().toLowerCase() === "true";

const PLAN_TIMEOUT_MS = 90_000; // one compact planning call — canonical specs + constraints only, no web_search, no VisualBeat-scale output
const MAX_STAGE_ATTEMPTS = 3;
const MAX_REPAIR_CALLS = 1;
// Part 4 item 8 — planning only, deliberately small: no web_search, no raw
// source pages, just structured reasoning over already-compact context.
const MAX_REFERENCE_PLAN_COST_USD = Number(Deno.env.get("LONG_FORM_MAX_REFERENCE_PLAN_COST_USD") ?? 0.05);
// V1 default per the milestone spec (Part 8) — the cheapest ALREADY-
// INTEGRATED Runware image model in this codebase (see providers.ts), used
// today for Long Form's own free concept-preview images
// (generate-long-form-preview). The specific models named in the milestone
// spec (FLUX.2 [klein] 9B KV, Kling IMAGE O3, Seedream 5.0 Pro, Recraft
// V4.1, Qwen Image Edit Plus) do NOT exist anywhere in this codebase's
// provider registry — inventing their Runware AIR tags from memory was
// explicitly out of bounds, so V1 renders through this verified entry
// until the real tags are supplied/confirmed.

// Phase 0, Section C.3 — GPT5_MINI_INPUT_PER_M/OUTPUT_PER_M now imported
// from the shared constants module above.

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/* ============================ OpenAI plumbing (same pattern as every other stage machine) ============================ */

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
type UsageTotals = { inputTokens: number; outputTokens: number; modelCalls: number };
function newUsageTotals(): UsageTotals {
  return { inputTokens: 0, outputTokens: 0, modelCalls: 0 };
}
function trackUsage(totals: UsageTotals, payload: any) {
  const usage = payload?.usage;
  if (usage) {
    totals.inputTokens += usage.input_tokens ?? 0;
    totals.outputTokens += usage.output_tokens ?? 0;
    totals.modelCalls += 1;
  }
}
async function callStructured(baseRequest: any, timeoutMs: number, usageTotals: UsageTotals) {
  const payload = await callOpenAI(baseRequest, timeoutMs);
  trackUsage(usageTotals, payload);
  return parseJson(extractOutputText(payload));
}
function mergeMeta(existing: any, usage: UsageTotals, extra?: Record<string, any>) {
  const meta = { ...(existing ?? {}) };
  meta.model = OPENAI_MODEL;
  meta.modelCalls = (meta.modelCalls ?? 0) + usage.modelCalls;
  meta.inputTokens = (meta.inputTokens ?? 0) + usage.inputTokens;
  meta.outputTokens = (meta.outputTokens ?? 0) + usage.outputTokens;
  meta.estimatedModelCostUsd = Number(((meta.inputTokens * GPT5_MINI_INPUT_PER_M + meta.outputTokens * GPT5_MINI_OUTPUT_PER_M) / 1_000_000).toFixed(4));
  const referenceImageCostUsd = meta.referenceImageCostUsd ?? 0;
  meta.referenceImageCostUsd = referenceImageCostUsd;
  meta.estimatedTotalCostUsd = Number((meta.estimatedModelCostUsd + referenceImageCostUsd).toFixed(4));
  return { ...meta, ...(extra ?? {}) };
}

/* ============================ Reference Planner (ONE call, Part 4) ============================ */

const REFERENCE_PLANNER_INSTRUCTIONS = `You are Zyvo's Visual World Reference Planner for a long-form 2D illustrated documentary video. You receive the Visual Plan's EntityRegistry (already filtered to entities that need a canonical reference), the ContinuityGroups, a compact storyboard summary, the topic/narrative context, and relevant factual constraints from Research.

Your ONLY job: for each given entity, write a CANONICAL APPEARANCE SPECIFICATION detailed enough that an image model can render the SAME identifiable subject consistently across multiple separate reference images. Do not decide camera angles or how many views — that is handled deterministically elsewhere. Do not write image prompts — that is handled deterministically elsewhere.

For a CHARACTER: describe age range, build, distinguishing features, hair, typical attire/materials appropriate to the topic's real historical/factual context, and overall visual impression — concrete enough to be unambiguous, never generic ("a person"). Do NOT describe environment, location, backdrop, occupation, role, or where this character is typically seen — CHARACTER identity must stay completely decoupled from LOCATION identity; locations are established by their own separate canonical references. A character's canonicalSpec is about the PERSON's APPEARANCE only, never their job/setting.
For a LOCATION: describe its structure, materials, scale, mood, and defining visual features.
For an IMPORTANT_OBJECT or VEHICLE_MACHINE: describe its form, materials, scale, and defining details.

CHARACTER IDENTITY SPEC (HERO and RECURRING characters only — set to null for LOCATION/IMPORTANT_OBJECT/VEHICLE_MACHINE/INCIDENTAL entities): in addition to canonicalSpec, fill out the structured characterIdentitySpec object with concrete, specific values for every field (apparentAge, sexPresentation, faceShape, faceWidth, jawShape, chinShape, noseShape, noseSize, eyeShape, eyeSpacing, eyebrowShape, earShape, hairline, hairstyle, hairColor, facialHair, skinTone, heightImpression, shoulderWidth, torsoBuild, limbBuild, distinguishingFeatures, silhouetteSignature, outfitSpec). Every field must be a short, concrete, unambiguous phrase (e.g. "narrow oval face", "moderately angular jaw") — never vague filler like "average" or "normal" with no further detail, and never an occupation/role/environment word (no "technician", "operator", "pilot" etc. — those belong in canonicalSpec/narrative context only, not in appearance fields). outfitSpec.abstractPatches must describe any patch/insignia as BLANK or an abstract icon only — never as containing letters, names or numbers.

CAST DIFFERENTIATION (critical — apply across ALL character entities in this same response together, since you can see the whole filtered cast at once): every HERO/RECURRING character must differ from every OTHER HERO/RECURRING character across MULTIPLE high-salience identity dimensions — face shape, jaw, nose, eyes, hairline, apparent age, height impression, shoulder width, torso build, and silhouette signature are all fair differentiation levers. Do NOT make two characters differ ONLY by hair, only by shirt/outfit color, or only by facial hair — that is not sufficient differentiation and characters must remain visually distinguishable by silhouette alone, not just by color-coding. Deliberately vary face shape/jaw/build/age impression across the cast the same way a real character designer would.

FACTUAL CONSTRAINTS: ground every canonical spec in what Research actually established — if a common visual myth about this topic exists (e.g. a historically inaccurate but popular depiction), note it explicitly as a forbidden element rather than silently reproducing it. Only state constraints Research actually supports; do not invent new claims.

Also provide one short "visualStyleNotes" string: a project-specific mood/palette inflection within Zyvo's locked illustrated-documentary style (e.g. "cold, muted blues and greys for a winter survival story") — never a new style, never contradicting the style lock.`;

function referencePlannerInput(ctx: {
  topic: string;
  entities: any[];
  continuityGroups: any[];
  storyboardSummary: any;
  compactFacts: { id: string; claim: string }[];
  // 2026-09-19 "Visual World incremental reconciliation" pass: only set
  // during a reconciliation (Update Visual World) where some of the cast is
  // being REUSED verbatim from a parent world version rather than re-
  // planned. The planner instructions' own "CAST DIFFERENTIATION" rule
  // ("apply across ALL character entities... since you can see the whole
  // filtered cast at once") depends on seeing every character in one
  // response — scoping `entities` down to only the genuinely missing ones
  // would silently break that guarantee for a NEW character planned in
  // isolation from an already-established cast it must still look visibly
  // different from. This surfaces the already-decided cast as read-only
  // context: never re-described, never re-output, only used so a new
  // character can be differentiated from faces that already exist.
  existingCastContext?: { id: string; name: string; category: string; canonicalSpec: string }[];
}) {
  return [
    `TOPIC: ${ctx.topic}`,
    ``,
    `ENTITIES NEEDING A CANONICAL REFERENCE:`,
    JSON.stringify(ctx.entities.map((e: any) => ({ id: e.id, category: e.category, name: e.name, importance: e.importance })), null, 2),
    ``,
    ...(ctx.existingCastContext?.length
      ? [
          `ALREADY-ESTABLISHED CAST (reused from a prior Visual World version — already finalized, do NOT redescribe or output a spec for these; every entity above must remain visually DISTINCT from every one of these, using the same face/jaw/build/age differentiation rules the CAST DIFFERENTIATION rule describes):`,
          JSON.stringify(ctx.existingCastContext, null, 2),
          ``,
        ]
      : []),
    `CONTINUITY GROUPS (for location/setting context only):`,
    JSON.stringify(ctx.continuityGroups.map((g: any) => ({ id: g.id, label: g.label, locationId: g.locationId, importantProps: g.importantProps })), null, 2),
    ``,
    `STORYBOARD SUMMARY:`,
    JSON.stringify(ctx.storyboardSummary ?? {}, null, 2),
    ``,
    `RESEARCH FACTS (use to ground factual constraints — never invent beyond these):`,
    JSON.stringify(ctx.compactFacts, null, 2),
  ].join("\n");
}

function buildReferencePlannerSchema(entityIds: string[]) {
  const idEnum = entityIds.length ? entityIds : ["__none__"];
  return {
    type: "object",
    additionalProperties: false,
    required: ["visualStyleNotes", "entities"],
    properties: {
      visualStyleNotes: { type: "string" },
      entities: {
        type: "array",
        maxItems: entityIds.length || 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["entityId", "canonicalSpec", "characterIdentitySpec", "factualConstraints", "forbiddenElements"],
          properties: {
            entityId: { type: "string", enum: idEnum },
            canonicalSpec: { type: "string" },
            // null for LOCATION/IMPORTANT_OBJECT/VEHICLE_MACHINE/INCIDENTAL —
            // only HERO/RECURRING CHARACTER entities get a populated spec.
            characterIdentitySpec: { anyOf: [CHARACTER_IDENTITY_SPEC_SCHEMA, { type: "null" }] },
            factualConstraints: { type: "array", items: { type: "string" }, maxItems: 8 },
            forbiddenElements: { type: "array", items: { type: "string" }, maxItems: 8 },
          },
        },
      },
    },
  };
}

/* ============================ Stage handlers ============================ */

type VisualWorldRow = any;

// 2026-09-19 production incident fix — real Mars bug: Visual World
// reconciliation's "reuse compatible assets" mechanism (stagePlanning,
// below) copied a matched parent asset's row VERBATIM — including its own
// render_model/prompt_snapshot/qa_expectations — with no check that the
// parent was actually generated under the SAME renderer/prompt-contract the
// CURRENT Visual World is supposed to use. Mars's parent world (v1) was
// built back on 2026-09-10, before the Kling IMAGE O3 canonical-sheet
// migration (20260913050000) and the "[STYLE LOCK]" contract rewrite ever
// existed — its own character sheets were real FLUX Klein 4B / Qwen
// generations under the OLD "[STYLE]"-only, fixed 4-panel-position prompt.
// Reusing them verbatim silently reintroduced stale, off-style, wrong-
// renderer sheets into an otherwise current Visual World: automated
// structural QA caught 3 of 4 (they violated NEWER structural requirements
// the old template never had, e.g. a required action-pose panel) and
// correctly triggered a real regenerate — but the maintenance technician's
// old sheet happened to still pass STRUCTURAL QA (nothing checks art STYLE
// consistency — see checkStyleConsistency below, added this same pass) and
// silently remained "canonical" under a completely different visual
// language, exactly matching the reported "different art style" /
// "still showing old incorrect reference sheets" incidents — they are the
// SAME root cause, not two separate bugs.
//
// Fix: a parent CHARACTER sheet is only eligible for zero-cost reuse when
// its OWN persisted qa_expectations record the CURRENT renderer/prompt/
// style-contract versions (stamped on every sheet since the Part 7/14
// provenance pass — see the isSheetRole branch further down in
// stageGenerating). Missing or mismatched versions mean "generated under a
// retired contract" — never silently trusted, always falls through to a
// fresh generation under the CURRENT contract instead, exactly like a
// genuinely-missing entity would.
function isStaleCharacterSheetAsset(view: { referenceType: string; angle: string }, candidate: any): boolean {
  if (view.referenceType !== "character_reference" || view.angle !== "character_reference_sheet") return false;
  const exp = candidate?.qa_expectations ?? {};
  return exp.rendererPolicyVersion !== KLING_SHEET_RENDERER_POLICY_VERSION
    || exp.promptContractVersion !== CHARACTER_SHEET_CONTRACT_VERSION
    || exp.styleContractVersion !== STYLE_LOCK_CONTRACT_VERSION;
}

export async function stagePlanning(admin: any, row: VisualWorldRow, project: any, visualPlan: any) {
  const knownSpent = row.meta?.estimatedTotalCostUsd ?? 0;
  if (knownSpent >= MAX_REFERENCE_PLAN_COST_USD) {
    throw new Error(`reference_plan_cost_ceiling_reached: $${knownSpent.toFixed(4)} already spent under the $${MAX_REFERENCE_PLAN_COST_USD} planning ceiling`);
  }

  const entityRegistry: any[] = visualPlan.entity_registry ?? [];
  const continuityGroups: any[] = visualPlan.continuity_groups ?? [];
  const hierarchy = analyzeReferenceHierarchy({
    topic: project.topic,
    title: project.selected_title ?? project.selected_idea_title ?? "",
    narrativeStrategy: project.narrative_strategy ?? {},
    entities: entityRegistry,
    continuityGroups,
    visualBeats: visualPlan.visual_plan?.visualBeats ?? visualPlan.visual_plan?.visual_beats ?? [],
    budget: REFERENCE_PLAN_BUDGET,
  });
  const referenceNeededEntities = hierarchy.selectedEntities;

  // The project's ACTUAL selected style (Look page's Style Picker), resolved
  // the same way the frontend does — never the legacy style_key/"Zyvo
  // Illustrated Documentary" concept Visual World shipped with in V1 (see
  // that constant's own removal). Falls back to the default preset (which
  // happens to also be named "Classic 2D Documentary") if the project
  // somehow has no selection, exactly like getStylePreset's own fallback.
  const stylePreset = getStylePresetForProject(project.visual_style_preset);

  if (referenceNeededEntities.length === 0 && !hierarchy.diagramStyleNeeded) {
    // Nothing to plan or render — a video whose Visual Plan found no
    // recurring people/places/objects worth a canonical reference.
    await admin
      .from("long_form_visual_world_versions")
      .update({ reference_plan: { visualStyle: stylePreset.name, visualStyleNotes: "", styleBible: createStyleBible(stylePreset), styleAnchorPolicy: "structured_style_bible_only", heroSubjects: hierarchy.heroSubjects, majorRecurringSubjects: hierarchy.majorRecurringSubjects, secondarySubjects: hierarchy.secondarySubjects, optionalSubjects: hierarchy.optionalSubjects, selectedReferences: [], excludedReferences: hierarchy.excludedReferences, entities: [] }, style_spec: stylePreset, style_preset_id: stylePreset.id, stage: "finalizing", stage_attempt: 0, worker_lock_until: null })
      .eq("id", row.id);
    return;
  }

  // Same trace as advance-long-form-visual-plan: Script -> Research ->
  // FactGraph, compacted to {id, claim} pairs (never the raw FactGraph,
  // never sources) — grounds factual constraints without re-sending
  // evidence the Reference Planner doesn't need.
  const { data: scriptRow } = await admin.from("long_form_script_versions").select("research_version_id").eq("id", row.script_version_id).maybeSingle();
  const { data: researchRow } = scriptRow?.research_version_id
    ? await admin.from("long_form_research_versions").select("fact_graph").eq("id", scriptRow.research_version_id).maybeSingle()
    : { data: null };
  const compactFacts = ((researchRow?.fact_graph?.facts ?? []) as any[]).filter((f) => f.scriptUsable !== false).map((f) => ({ id: f.id, claim: f.claim }));

  // 2026-09-19 "Visual World incremental reconciliation" pass: when this
  // world is reconciling from a parent (row.parent_visual_world_version_id
  // is only ever set by start_visual_world_reconciliation, i.e. an explicit
  // "Update Visual World" click — never a fresh build or a plain "Rebuild"/
  // regenerate, both of which leave this null and take the exact original
  // code path below unmodified), split required entities into ones the
  // compatibility resolver already confirmed are covered by the PARENT
  // world (reused verbatim — zero LLM call, zero provider call, zero cost)
  // and ones that genuinely need planning. Matched by resolveReferenceReuse
  // — the server-side twin of visualWorldCompatibility.js's own fixed
  // matching logic (preserved entity id first, then exact name+category).
  let reuseMatches: ReuseMatch[] = [];
  let parentReferencePlan: any = null;
  const parentAssetsByEntityId = new Map<string, any[]>();
  // Full rebuilds also reconcile against the adopted world, but keep
  // parent_visual_world_version_id null so they remain explicit reviewable
  // versions. start-long-form-visual-world records the reuse source in meta.
  const reuseSourceWorldId = row.parent_visual_world_version_id ?? row.meta?.reuseSourceVisualWorldVersionId ?? null;
  if (reuseSourceWorldId) {
    const { data: parentWorld } = await admin.from("long_form_visual_world_versions").select("reference_plan, style_preset_id").eq("id", reuseSourceWorldId).maybeSingle();
    // Semantic selection above is always independent. Compatibility is a
    // second pass and may only consider pixels from the same style contract.
    parentReferencePlan = !parentWorld?.style_preset_id || parentWorld.style_preset_id === stylePreset.id ? parentWorld?.reference_plan ?? null : null;
    if (parentReferencePlan?.entities?.length) {
      reuseMatches = resolveReferenceReuse(referenceNeededEntities.map((e: any) => ({ id: e.id, name: e.name, category: e.category })), parentReferencePlan.entities);
    }
    if (reuseMatches.length) {
      const { data: parentAssets } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", reuseSourceWorldId);
      const replacedIds = new Set((parentAssets ?? []).map((asset: any) => asset.replaces_asset_id).filter(Boolean));
      // Only the current leaf of each immutable history chain can be reused.
      // Looking at succeeded rows alone could resurrect an older image when
      // its newer replacement failed or was rejected.
      for (const a of (parentAssets ?? []).filter((asset: any) => !replacedIds.has(asset.id) && asset.status === "succeeded" && asset.result_url)) {
        const list = parentAssetsByEntityId.get(a.entity_id) ?? [];
        list.push(a);
        parentAssetsByEntityId.set(a.entity_id, list);
      }
    }
  }
  const reuseByNewId = new Map(reuseMatches.map((m) => [m.newEntityId, m.parentEntityId]));
  const parentEntityById = new Map((parentReferencePlan?.entities ?? []).map((e: any) => [e.entityId, e]));
  // entitiesToPlan is exactly referenceNeededEntities whenever there's no
  // parent (or nothing matched) — the ORIGINAL, unmodified behavior for
  // every fresh build / full regenerate.
  const entitiesToPlan = referenceNeededEntities.filter((e: any) => !reuseByNewId.has(e.id));
  const entitiesToReuse = referenceNeededEntities.filter((e: any) => reuseByNewId.has(e.id));

  const usage = newUsageTotals();
  const entityIds = entitiesToPlan.map((e: any) => e.id);
  // A fully-compatible reconciliation (every required entity reused) skips
  // the LLM call entirely — real zero cost, not just a small one.
  let llmResult: any = { visualStyleNotes: "", entities: [] };
  let attempts = 0;
  if (entitiesToPlan.length > 0) {
    let lastError: unknown = null;
    while (attempts <= MAX_REPAIR_CALLS) {
      attempts += 1;
      try {
        llmResult = await callStructured(
          {
            model: OPENAI_MODEL,
            store: false,
            instructions: REFERENCE_PLANNER_INSTRUCTIONS,
            input: referencePlannerInput({
              topic: project.topic,
              entities: entitiesToPlan,
              continuityGroups,
              storyboardSummary: visualPlan.storyboard_summary,
              compactFacts,
              existingCastContext: entitiesToReuse.length
                ? entitiesToReuse.map((e: any) => ({ id: e.id, name: e.name, category: e.category, canonicalSpec: parentEntityById.get(reuseByNewId.get(e.id))?.canonicalSpec ?? "" }))
                : undefined,
            }),
            text: { format: { type: "json_schema", name: "reference_plan", strict: true, schema: buildReferencePlannerSchema(entityIds) } },
          },
          PLAN_TIMEOUT_MS,
          usage
        );
        break;
      } catch (error) {
        lastError = error;
        if (attempts > MAX_REPAIR_CALLS) throw error;
      }
    }
    if (!llmResult) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  // Deterministic merge: requiredViews and referencePriority NEVER come
  // from the LLM (see _shared/visualWorldStyle.ts) — only canonicalSpec/
  // factualConstraints/forbiddenElements do. A REUSED entity's canonicalSpec/
  // characterIdentitySpec/factualConstraints/forbiddenElements are copied
  // verbatim from the PARENT world's own already-finalized reference_plan
  // entry — never re-derived, never re-asked of the LLM.
  const llmByEntityId = new Map((llmResult.entities ?? []).map((e: any) => [e.entityId, e]));
  const plannedViews = (entity: any, effectiveCategory: string) => {
    if (effectiveCategory === "LOCATION" && entity.referenceFormat === "location_board") {
      return [{ referenceType: "location_reference", angle: "location_reference_board", purpose: "Coordinated reusable world sheet" }];
    }
    return deriveRequiredViews(entity, continuityGroups);
  };
  const planEntities = referenceNeededEntities.map((entity: any) => {
    // 2026-09-20 "plants aren't characters" fix — the PERSISTED
    // entityCategory must match the same deterministic reclassification
    // deriveRequiredViews itself applies, never the raw (sometimes wrong)
    // LLM category — otherwise a plant's stored entityCategory would still
    // read "CHARACTER" (misgrouping it under Characters in the UI) even
    // though its actual generated reference is correctly an environment
    // shot. See resolveEffectiveEntityCategory's own comment.
    const effectiveCategory = resolveEffectiveEntityCategory(entity);
    const reusedFromEntityId = reuseByNewId.get(entity.id);
    if (reusedFromEntityId) {
      const parentEntity = parentEntityById.get(reusedFromEntityId);
      return {
        entityId: entity.id,
        entityName: entity.name,
        entityCategory: effectiveCategory,
        referencePriority: entity.referencePriority,
        canonicalSpec: parentEntity?.canonicalSpec ?? "",
        characterIdentitySpec: effectiveCategory === "CHARACTER" ? parentEntity?.characterIdentitySpec ?? null : null,
        requiredViews: plannedViews(entity, effectiveCategory),
        factualConstraints: parentEntity?.factualConstraints ?? [],
        forbiddenElements: parentEntity?.forbiddenElements ?? [],
        subjectRole: entity.subjectRole,
        importanceTier: entity.importanceTier,
        importanceScore: entity.importanceScore,
        expectedReuseCount: entity.expectedReuseCount,
        expectedSceneUsage: entity.expectedSceneUsage,
        estimatedSceneCoverage: entity.estimatedSceneCoverage,
        sourceBeatIds: entity.sourceBeatIds,
        sourceSequenceIds: entity.sourceSequenceIds,
        identitySensitivity: entity.identitySensitivity,
        continuityImportance: entity.continuityImportance,
        storyImportance: entity.storyImportance,
        visualIdentityImportance: entity.visualIdentityImportance,
        referenceCostEstimate: entity.referenceCostEstimate,
        referenceFormat: entity.referenceFormat,
        requiredForCompletion: entity.requiredForCompletion,
        isCoreIdentity: entity.isCoreIdentity,
        isComparisonOnly: entity.isComparisonOnly,
        isToolOnly: entity.isToolOnly,
        isHypotheticalReconstruction: entity.isHypotheticalReconstruction,
        uiPriority: entity.uiPriority,
        selectionReason: entity.selectionReason,
        reusedFromEntityId,
      };
    }
    const llmEntity = llmByEntityId.get(entity.id) ?? { canonicalSpec: "", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] };
    return {
      entityId: entity.id,
      entityName: entity.name,
      entityCategory: effectiveCategory,
      referencePriority: entity.referencePriority,
      canonicalSpec: llmEntity.canonicalSpec,
      // Only meaningful for CHARACTER entities — deterministically nulled
      // out for anything else regardless of what the LLM returned, so a
      // model mistake can never smuggle identity fields onto a LOCATION/
      // OBJECT/ECOSYSTEM/CELESTIAL row.
      characterIdentitySpec: effectiveCategory === "CHARACTER" ? llmEntity.characterIdentitySpec ?? null : null,
      requiredViews: plannedViews(entity, effectiveCategory),
      factualConstraints: llmEntity.factualConstraints ?? [],
      forbiddenElements: llmEntity.forbiddenElements ?? [],
      subjectRole: entity.subjectRole,
      importanceTier: entity.importanceTier,
      importanceScore: entity.importanceScore,
      expectedReuseCount: entity.expectedReuseCount,
      expectedSceneUsage: entity.expectedSceneUsage,
      estimatedSceneCoverage: entity.estimatedSceneCoverage,
      sourceBeatIds: entity.sourceBeatIds,
      sourceSequenceIds: entity.sourceSequenceIds,
      identitySensitivity: entity.identitySensitivity,
      continuityImportance: entity.continuityImportance,
      storyImportance: entity.storyImportance,
      visualIdentityImportance: entity.visualIdentityImportance,
      referenceCostEstimate: entity.referenceCostEstimate,
      referenceFormat: entity.referenceFormat,
      requiredForCompletion: entity.requiredForCompletion,
      isCoreIdentity: entity.isCoreIdentity,
      isComparisonOnly: entity.isComparisonOnly,
      isToolOnly: entity.isToolOnly,
      isHypotheticalReconstruction: entity.isHypotheticalReconstruction,
      uiPriority: entity.uiPriority,
      selectionReason: entity.selectionReason,
    };
  });
  if (hierarchy.diagramStyleNeeded) {
    const parentDiagramEntity = parentEntityById.get("__diagram_style_reference__");
    planEntities.push({
      entityId: "__diagram_style_reference__",
      entityName: "Diagram visual language",
      entityCategory: "DIAGRAM_STYLE_REFERENCE",
      referencePriority: 99,
      canonicalSpec: "A minimal content-neutral specimen defining the visual language for maps, diagrams and overlays.",
      characterIdentitySpec: null,
      requiredViews: [{ referenceType: "diagram_style_reference", angle: "canonical_diagram_style", purpose: "Authoritative minimal diagram visual language" }],
      factualConstraints: [],
      forbiddenElements: ["readable text", "labels", "dense infographic layout", "project facts"],
      subjectRole: "graphic_language_anchor",
      importanceTier: hierarchy.heroSubjects.some((subject: any) => subject.subjectRole === "main_concept" && subject.referenceFormat === "diagram_board") ? "CORE" : "MAJOR",
      importanceScore: hierarchy.heroSubjects.some((subject: any) => subject.referenceFormat === "diagram_board") ? 100 : 75,
      expectedReuseCount: 0,
      referenceFormat: "diagram_board",
      isCoreIdentity: hierarchy.heroSubjects.some((subject: any) => subject.referenceFormat === "diagram_board"),
      isComparisonOnly: false,
      isToolOnly: false,
      isHypotheticalReconstruction: false,
      uiPriority: hierarchy.heroSubjects.some((subject: any) => subject.referenceFormat === "diagram_board") ? 100 : 75,
      selectionReason: "Shared diagram language for graphic beats",
      ...(parentDiagramEntity ? { reusedFromEntityId: "__diagram_style_reference__" } : {}),
    });
  }
  const plannedAssetCount = planEntities.reduce((count: number, entity: any) => count + (entity.requiredViews?.length ?? 0), 0);
  if (plannedAssetCount > REFERENCE_PLAN_BUDGET.maxAssets) throw new Error(`reference_plan_asset_ceiling_exceeded: ${plannedAssetCount} > ${REFERENCE_PLAN_BUDGET.maxAssets}`);
  const referencePlan = {
    planningContractVersion: "episode-semantic-reference-plan-v2",
    selectionAuthority: "current_episode_intelligence",
    reuseEvaluatedAfterSelection: true,
    sourceSnapshot: { scriptVersionId: row.script_version_id, visualPlanVersionId: row.visual_plan_version_id },
    visualStyle: stylePreset.name,
    styleBible: createStyleBible(stylePreset),
    styleAnchorPolicy: "structured_style_bible_only",
    visualStyleNotes: llmResult.visualStyleNotes || "",
    referenceBudget: REFERENCE_PLAN_BUDGET,
    heroSubjects: hierarchy.heroSubjects,
    majorRecurringSubjects: hierarchy.majorRecurringSubjects,
    secondarySubjects: hierarchy.secondarySubjects,
    optionalSubjects: hierarchy.optionalSubjects,
    selectedReferences: hierarchy.selectedReferences,
    excludedReferences: hierarchy.excludedReferences,
    budget: { ...REFERENCE_PLAN_BUDGET, requestedEntityCount: entityRegistry.filter((entity: any) => entity.referenceNeeded).length, selectedEntityCount: referenceNeededEntities.length, plannedAssetCount, diagramStyleNeeded: hierarchy.diagramStyleNeeded },
    entities: planEntities,
  };

  // Create one PENDING long_form_reference_assets row per required view —
  // real child rows, never a JSONB array (see the migration's own
  // reasoning) — so each image gets its own independent job/retry/status/
  // cost from the moment it exists. Views the user explicitly unchecked
  // before generation (Part 10 — "entityId:angle" keys) are skipped here,
  // never created as asset rows at all. qa_expectations (Part 17) is
  // computed here too — deterministic, from the view/role alone, never from
  // any model output.
  //
  // A REUSED entity's own required views are instead COPIED — a real new
  // row per view, already `status:'succeeded'`, carrying the PARENT's own
  // result_url/render_model/qa_status/qa_result verbatim (item 2: "prefer
  // immutable asset reuse/linkage rather than duplicating image bytes" —
  // this links to the SAME result_url, a new storage object is never
  // written) plus explicit provenance (source_visual_world_version_id/
  // source_reference_asset_id/reuse_reason). If a reused entity's parent
  // asset for a SPECIFIC view can't be found (a partial-coverage case — the
  // entity matched, but this exact angle wasn't in the parent), that one
  // view still falls back to a normal pending row rather than being
  // silently dropped.
  const excludedViewKeys = new Set((row.excluded_views ?? []) as string[]);
  const copiedAssetRows: any[] = [];
  const pendingAssetRows: any[] = [];
  for (const entity of planEntities) {
    const views = entity.requiredViews.filter((view: any) => !excludedViewKeys.has(`${entity.entityId}:${view.angle}`));
    const parentAssetsForEntity = entity.reusedFromEntityId ? parentAssetsByEntityId.get(entity.reusedFromEntityId) ?? [] : [];
    for (const view of views) {
      const rawMatch = parentAssetsForEntity.find((a: any) => a.angle_or_view === view.angle && a.reference_type === view.referenceType);
      // The core fix: a structurally-matching parent asset generated under a
      // RETIRED renderer/prompt/style contract is never silently reused —
      // see isStaleCharacterSheetAsset's own comment for the exact Mars
      // incident this closes.
      // A visually rejected parent is history, never a reusable canonical
      // reference. This matters during incremental repair: Atlantis had
      // structurally matching location/object rows whose pixels were
      // rejected for text-heavy infographic composition. Reusing them by
      // angle alone would preserve the exact defect the rebuild is meant
      // to repair.
      const match = rawMatch && rawMatch.qa_status !== "rejected" && !isStaleCharacterSheetAsset(view, rawMatch) ? rawMatch : null;
      if (match) {
        // 2026-09-19 production incident fix — real Mars stuck world
        // d64cce75 (planning stage, 0 reference_asset rows,
        // last_error_code "null value in column generation_type... not-null
        // constraint"): generation_type describes WHAT KIND OF PIXEL SOURCE
        // produced this row (provider / deterministic_crop /
        // turnaround_master — see canonicalReference()'s own semantics,
        // referenceRendererPolicy.js) — it is NOT the right place to encode
        // "was this reused across a Visual World reconciliation," which
        // source_visual_world_version_id/source_reference_asset_id/
        // reuse_reason below already exist specifically to answer. A copied
        // row's pixels genuinely came from whatever produced the PARENT row
        // (usually a real provider call, but could be a deterministic_crop
        // or turnaround_master if the parent itself was one) — preserving
        // it verbatim is what keeps canonicalReference()'s own
        // generation_type-sensitive gating (deterministic_crop/
        // role_edit_experiment require an approved reviewStatus;
        // turnaround_master is never canonical at all) correct for a reused
        // row exactly the same way it was correct for the row it came from.
        // Inventing a new "world_reused" value here (the actual root cause
        // of the incident) was wrong on two counts: it discarded that real
        // semantic information, AND — because it was set on every copied
        // row while the sibling pendingAssetRows below never set
        // generation_type at all — combining both shapes into ONE bulk
        // `.insert(assetRows)` call made PostgREST build a single INSERT
        // whose column list is the UNION of every row's own keys; any row
        // missing a key that a SIBLING row in the same array supplies gets
        // an explicit SQL NULL for it (jsonb_populate_recordset always
        // materializes a value for every column in that union, never
        // "omitted -> let the table default apply") — silently bypassing
        // generation_type's own `default 'provider'` for every pending row,
        // and failing the whole batch atomically (this is why the stuck
        // world has exactly 0 asset rows, not 6 succeeded + a failed 8).
        copiedAssetRows.push({
          visual_world_version_id: row.id,
          entity_id: entity.entityId,
          reference_type: view.referenceType,
          angle_or_view: view.angle,
          status: "succeeded",
          result_url: match.result_url,
          render_model: match.render_model,
          prompt_snapshot: match.prompt_snapshot,
          cost_usd: 0,
          generation_latency_ms: match.generation_latency_ms,
          qa_expectations: match.qa_expectations,
          qa_status: match.qa_status,
          qa_result: match.qa_result,
          generation_type: match.generation_type ?? "provider",
          source_visual_world_version_id: reuseSourceWorldId,
          source_reference_asset_id: match.id,
          reuse_reason: entity.entityId === entity.reusedFromEntityId ? "same_entity_id" : "name_and_category_match",
        });
      } else {
        pendingAssetRows.push({
          visual_world_version_id: row.id,
          entity_id: entity.entityId,
          reference_type: view.referenceType,
          angle_or_view: view.angle,
          status: "pending",
          // Explicit, not relied on as an omitted-column default (see the
          // comment above this block) — every genuinely fresh row here will
          // be filled by a real provider generation job, the exact
          // long-established meaning of "provider" everywhere else in this
          // codebase; never a new value invented for this pass.
          generation_type: "provider",
          qa_expectations: deriveReferenceQAExpectations(view, null),
        });
      }
    }
  }
  const assetRows = [...copiedAssetRows, ...pendingAssetRows];

  // Part 16 — estimate the cost of actually rendering this plan across all
  // three render tiers BEFORE any image is generated, stored internally
  // only (never shown to users, never a render commitment). Scoped to the
  // genuinely-new rows only — a copied row costs nothing to (re)render.
  const projectedCost = estimateReferenceCosts(pendingAssetRows.length);
  const meta = mergeMeta(row.meta, usage, { repairCalls: Math.max(0, attempts - 1), projectedCost });
  if (assetRows.length) {
    const { error: insertError } = await admin.from("long_form_reference_assets").insert(assetRows);
    if (insertError) throw new Error(`Could not create reference asset rows: ${insertError.message}`);
  }

  await admin
    .from("long_form_visual_world_versions")
    .update({
      reference_plan: referencePlan,
      style_spec: stylePreset,
      style_preset_id: stylePreset.id,
      meta,
      reused_asset_count: copiedAssetRows.length,
      new_asset_count: pendingAssetRows.length,
      stage: pendingAssetRows.length ? "generating" : "finalizing",
      stage_attempt: 0,
      worker_lock_until: null,
    })
    .eq("id", row.id);
}

// Character Pack QA (Part 8/9, old per-angle taxonomy — RECURRING/legacy
// HERO packs still use it) — only these three roles ever get a QA verdict.
// Face is excluded deliberately: it's a deterministic crop of an already-
// approved master (Part 5), so it inherits approval mechanically rather
// than needing its own vision call. Outfit/Action-pose are excluded too —
// Part 8's own worked example only ever lists Identity Master, Face,
// Profile, Back as QA inputs.
const QA_ELIGIBLE_ROLES = new Set(["three_quarter_neutral", "profile", "back"]);
// Multi-view SHEET taxonomy (superseded by the component pack below — kept
// only for any historical/legacy row still using it; proven unreliable,
// replaced rather than re-attempted with new wording).
const SHEET_QA_ROLES = new Set(["identity_outfit_sheet", "face_sheet", "profile_silhouette_sheet"]);
// character_reference_sheet is deliberately treated as isSheet-equivalent
// purely so it inherits the SAME allowFallback exclusion below (no
// automatic paid retry-on-rejection for an expensive multi-panel
// generation without human review) — its own dedicated `if` branch above
// in runQACheckpoint is checked first, so this never routes it through the
// OLD 3-role sheet QA logic.
const NO_AUTO_FALLBACK_SHEET_ROLES = new Set([...SHEET_QA_ROLES, "character_reference_sheet"]);
// Component-based HERO pack (reference-rendering-architecture fix): every
// independently-generated/edited component gets its own QA verdict.
// face_front (deterministic crop) and silhouette_* (adopted) are excluded —
// both inherit approval mechanically from their already-approved source,
// same reasoning as the old Face-crop mechanism.
const COMPONENT_QA_ROLES = new Set(["identity_outfit_three_quarter", "identity_outfit_side", "identity_outfit_back", "face_side", "face_back"]);
const COMPONENT_FACE_GROUP = new Set(["face_side", "face_back"]);
// Real incident (2026-09-11): only these roles ever contaminated a dispatch
// with a stray secondary reference — single-reference-only lockdown is
// scoped here, not to face_side/face_back (whose REFERENCE 2 is face_front,
// a deterministic crop of the SAME anchor, not the legacy face_closeup
// asset that caused the incident). face_sheet/profile_silhouette_sheet
// joined this set the same day (sheet pack v4) when they became
// identity-derived Qwen edits — Part 3/4 of that fix explicitly requires
// exactly ONE reference image, hard-asserted, for the same reason.
const IDENTITY_OUTFIT_GEOMETRY_ROLES = new Set(["identity_outfit_side", "identity_outfit_back", "face_sheet", "profile_silhouette_sheet"]);
// Sheet pack v4: these two derive their ENTIRE prompt from
// compileDerivedSheetEdit (identity-preservation framing + the sheet's own
// 3-view layout contract) rather than compileGeometryEdit's rotation-edit
// framing — both compile from the SAME reference image, but "preserve
// identity while producing 3 NEW views" is a different instruction shape
// than "rotate the camera angle of THIS pose".
const DERIVED_SHEET_ROLES = new Set(["face_sheet", "profile_silhouette_sheet"]);

// Two checkpoints, matching the two moments a real QA decision is actually
// possible: (1) the master alone, the instant it succeeds — nothing else
// exists yet to compare it against, so this call only checks isolation/
// text/style; (2) the full pack once a geometry-derived Profile or Back
// succeeds — by now the master is guaranteed already qa_status='approved'
// (accepted_reference_identity required it before this asset could even
// dispatch), so this call judges identity/orientation consistency across
// whichever of {master, face, profile, back} currently exist. On rejection,
// exactly ONE bounded fallback attempt is created per role (Part 9/13) —
// never more; a fallback that also fails QA is left qa_status='rejected' as
// a terminal "Needs review" state, and this function never retries again.
async function runQACheckpoint(admin: any, row: VisualWorldRow, asset: any) {
  const isSheet = SHEET_QA_ROLES.has(asset.angle_or_view);
  const isComponent = COMPONENT_QA_ROLES.has(asset.angle_or_view);
  const isMaster = asset.angle_or_view === "three_quarter_neutral" || asset.angle_or_view === "identity_outfit_sheet" || asset.angle_or_view === "identity_outfit_three_quarter";
  const isCanonicalQualityV1 = asset.qa_expectations?.expectedSubjectCount === 1;
  let result;
  if (asset.angle_or_view === "character_reference_sheet") {
    // One canonical character sheet (2026-09-13, major simplification):
    // QA's the single sheet image directly — no cross-sheet anchor, no
    // dependents, nothing else to compare against or unblock.
    const entity = row.reference_plan?.entities?.find((e: any) => e.entityId === asset.entity_id);
    const view = entity?.requiredViews?.find((v: any) => v.angle === "character_reference_sheet");
    result = await runCharacterReferenceSheetQA(asset.result_url, view?.importance, row.style_spec?.name);
  } else if (isCanonicalQualityV1 && !isMaster && !["profile", "back", "face_closeup"].includes(asset.angle_or_view)) {
    result = await runCanonicalReferenceQA(asset.result_url, asset.qa_expectations ?? {}, row.style_spec?.name);
  } else if (isSheet) {
    if (asset.angle_or_view === "identity_outfit_sheet") {
      result = await runSheetQA("identity_outfit_sheet", asset.result_url);
    } else {
      // Part 11 (2026-09-11 architecture reversal): Face/Profile sheets QA
      // independently — the Identity/Outfit sheet is no longer a hard
      // prerequisite. Real incident this fixes: this branch used to THROW
      // (a stage failure) when no accepted anchor existed yet, meaning
      // Face/Profile could never even reach a QA verdict until Identity/
      // Outfit was approved — exactly the cross-sheet dependency Part 11
      // asks to remove. runSheetQA already supports an optional anchorUrl
      // (sameIdentityAsAnchor defaults true when omitted); pass it only
      // when genuinely available, never block on its absence.
      const { data: siblings, error } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id);
      if (error) throw error;
      const canonical = (siblings ?? []).filter(isCanonicalReference);
      const anchor = acceptedIdentityAnchor(canonical, asset);
      assertSheetAnchor(asset, anchor);
      if (asset.input_reference_asset_ids?.length !== 1 || asset.input_reference_asset_ids[0] !== anchor.id) throw new Error("SHEET_QA_IDENTITY_MISMATCH");
      result = await runSheetQA(asset.angle_or_view as any, asset.result_url, anchor.result_url);
    }
  } else if (isComponent && asset.angle_or_view === "identity_outfit_three_quarter") {
    // The anchor alone, the instant it succeeds — nothing else exists yet
    // to compare it against, so this only checks isolation/text/style.
    result = await runCharacterPackQA({ masterUrl: asset.result_url });
  } else if (isComponent) {
    const { data: siblings, error } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id);
    if (error) throw error;
    const canonical = (siblings ?? []).filter(isCanonicalReference);
    const currentOf = (angle: string) => {
      const rows = canonical.filter((a: any) => a.angle_or_view === angle && a.status === "succeeded" && a.result_url);
      const replacedIds = new Set(rows.map((a: any) => a.replaces_asset_id).filter(Boolean));
      return rows.find((a: any) => !replacedIds.has(a.id))?.result_url ?? null;
    };
    if (COMPONENT_FACE_GROUP.has(asset.angle_or_view)) {
      // Face group compares against its OWN head-and-shoulders anchor
      // (face_front), not the full-body identity anchor — comparing a head
      // crop's orientation against a full-body three-quarter shot would be
      // apples-to-oranges.
      const faceFrontUrl = currentOf("face_front");
      if (!faceFrontUrl) throw new Error("FACE_FRONT_NOT_READY");
      result = await runCharacterPackQA({
        masterUrl: faceFrontUrl,
        profileUrl: asset.angle_or_view === "face_side" ? asset.result_url : currentOf("face_side"),
        backUrl: asset.angle_or_view === "face_back" ? asset.result_url : currentOf("face_back"),
      });
    } else {
      const anchor = acceptedIdentityAnchor(canonical, asset);
      if (!anchor) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
      result = await runCharacterPackQA({
        masterUrl: anchor.result_url,
        faceUrl: currentOf("face_front"),
        profileUrl: asset.angle_or_view === "identity_outfit_side" ? asset.result_url : currentOf("identity_outfit_side"),
        backUrl: asset.angle_or_view === "identity_outfit_back" ? asset.result_url : currentOf("identity_outfit_back"),
      });
    }
  } else if (isMaster) {
    result = await runCharacterPackQA({ masterUrl: asset.result_url });
  } else {
    const { data: siblings, error } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id);
    if (error) throw error;
    const canonical = (siblings ?? []).filter(isCanonicalReference);
    const anchor = acceptedIdentityAnchor(canonical, asset);
    if (!anchor) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
    const currentOf = (angle: string) => {
      const rows = canonical.filter((a: any) => a.angle_or_view === angle && a.status === "succeeded" && a.result_url);
      const replacedIds = new Set(rows.map((a: any) => a.replaces_asset_id).filter(Boolean));
      return rows.find((a: any) => !replacedIds.has(a.id))?.result_url ?? null;
    };
    result = await runCharacterPackQA({
      masterUrl: anchor.result_url,
      faceUrl: currentOf("face_closeup"),
      profileUrl: asset.angle_or_view === "profile" ? asset.result_url : currentOf("profile"),
      backUrl: asset.angle_or_view === "back" ? asset.result_url : currentOf("back"),
    });
  }
  const { error: recordError } = await admin.rpc("record_reference_qa_result", { p_asset_id: asset.id, p_approved: result.approved, p_qa_result: { ...result, assetId: asset.id, role: asset.angle_or_view, anchorId: asset.input_reference_asset_ids?.[0] ?? null } });
  if (recordError) throw recordError;
  asset.qa_status = result.approved ? "approved" : "rejected";
  // Fallback is allowed for: every sheet role (Part 13, including the
  // Identity/Outfit sheet itself), every component role except the
  // three_quarter anchor itself (matches the prior task's "no automatic
  // master fallback" scope boundary), and the old taxonomy's Profile/Back.
  const allowFallback = isSheet || (isComponent && asset.angle_or_view !== "identity_outfit_three_quarter") || (!isSheet && !isComponent && !isMaster);
  if (allowFallback && !NO_AUTO_FALLBACK_SHEET_ROLES.has(asset.angle_or_view) && !result.approved && !asset.fallback_of_asset_id) {
    // Exactly one fallback — a new pending row for the SAME entity/angle,
    // superseding this rejected attempt immediately (Part 13: history is
    // preserved, never deleted; canonicalReference/currentReferenceAssets
    // already stop counting a replaced row). The normal claim RPC picks
    // this up next tick through the identical geometry-dispatch code path;
    // stageGenerating's own fallback_of_asset_id check adds an explicit
    // retry-emphasis line to the prompt so this is a genuinely different
    // attempt, not an identical same-inputs retry (Part 9 forbids that).
    // Known, disclosed limitation: this codebase has exactly ONE verified
    // geometry-edit-capable renderer (Qwen Image Edit Plus) — there is no
    // second/stronger verified renderer to escalate to, so the fallback
    // stays on the same renderer with a strengthened configuration rather
    // than Part 9's literal "next verified stronger renderer". If a second
    // edit-capable renderer is ever verified and added, this is the tier
    // that should switch to it.
    const { error: fallbackError } = await admin.from("long_form_reference_assets").insert({
      visual_world_version_id: row.id, entity_id: asset.entity_id, reference_type: asset.reference_type, angle_or_view: asset.angle_or_view,
      status: "pending", replaces_asset_id: asset.id, fallback_of_asset_id: asset.id, qa_expectations: asset.qa_expectations,
    });
    if (fallbackError) throw fallbackError;
  }
}

// Part 5/6 of the reliability fix (2026-09-13): "a provider-successful job
// must NEVER be lost." This is that durable reconciliation contract —
// idempotent (running it twice is a no-op the second time, since the asset
// is already terminal after the first pass), no provider calls of its own,
// safe to call for ANY world regardless of its own status/stage. Extracted
// out of stageGenerating's own body so it can ALSO be invoked as a
// standalone orphan-recovery path (see the handler's recoveryOnly branch
// below) for a world that has already moved past 'generating' — a genuine
// gap found during audit: the claim RPC for the WORLD's own stage only
// matches status in ('planning','generating'), so a world already at
// 'needs_attention' could never be re-claimed to reconcile a straggling
// asset through the normal stage machinery, even though nothing about
// fixing ONE asset's row requires re-entering that machinery at all.
export function referenceJobRecoveryAction(job: any, nowMs = Date.now()) {
  if (!job) return "missing_job";
  if (["succeeded", "failed", "canceled"].includes(job.status)) return "terminal";
  if (job.status === "queued") {
    const retryAt = job.retry_after ? Date.parse(job.retry_after) : 0;
    return !Number.isFinite(retryAt) || retryAt <= nowMs ? "dispatch_queued" : "wait";
  }
  if (!["running", "processing"].includes(job.status)) return "wait";
  const leaseExpired = !job.lease_expires_at || Date.parse(job.lease_expires_at) <= nowMs;
  const heartbeatStale = !job.heartbeat_at || Date.parse(job.heartbeat_at) <= nowMs - 30_000;
  if (!leaseExpired || !heartbeatStale) return "wait";
  const providerTaskId = String(job.provider_task_id ?? job.settings?.provider_job_id ?? "").trim();
  if (providerTaskId && job.submission_state === "submitted") return "resume_provider";
  if (!providerTaskId && job.submission_state === "pending") {
    return Number(job.attempts ?? 0) >= Number(job.max_attempts ?? 3) ? "fail_exhausted" : "requeue_unsubmitted";
  }
  // Never blindly create a second provider request when submission may
  // already have happened but its acknowledgement was lost.
  return "fail_uncertain";
}

async function kickExistingReferenceJob(jobId: string, recoverExistingProvider = false) {
  await fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId, ...(recoverExistingProvider ? { recoverExistingProvider: true } : {}) }),
  }).catch((error) => console.error("Reference job recovery dispatch failed", error));
}

async function reconcileNonterminalAssets(admin: any, row: VisualWorldRow, current: any[]) {
  for (const asset of current.filter((a: any) => a.job_id && ["pending", "running"].includes(a.status))) {
    const { data: job, error } = await admin.from("jobs").select("id,status,result_url,output,created_at,updated_at,settings,input,prompt,retry_after,attempts,max_attempts,heartbeat_at,lease_expires_at,provider_task_id,submission_state").eq("id", asset.job_id).maybeSingle();
    if (error) throw error;
    const result = referenceJobResult(job);
    if (result) {
      try { assertReferenceCompletion(asset, job); }
      catch (error) {
        const code = error instanceof Error ? error.message : "REFERENCE_COMPLETION_MISMATCH";
        const { error: mismatchError } = await admin.from("long_form_reference_assets").update({ status: "failed", lease_until: null, last_error_code: code, last_error_at: new Date().toISOString() }).eq("id", asset.id).eq("job_id", asset.job_id);
        if (mismatchError) throw mismatchError;
        Object.assign(asset, { status: "failed", last_error_code: code });
        continue;
      }
      const { error: updateError } = await admin.from("long_form_reference_assets").update({ ...result, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("job_id", asset.job_id);
      if (updateError) throw updateError;
      Object.assign(asset, result);
      continue;
    }

    const recoveryAction = referenceJobRecoveryAction(job);
    if (recoveryAction === "missing_job") {
      const { error: missingError } = await admin.from("long_form_reference_assets").update({ status: "failed", lease_until: null, last_error_code: "JOB_RECORD_MISSING", last_error_at: new Date().toISOString() }).eq("id", asset.id).eq("job_id", asset.job_id);
      if (missingError) throw missingError;
      Object.assign(asset, { status: "failed", last_error_code: "JOB_RECORD_MISSING" });
    } else if (recoveryAction === "dispatch_queued") {
      // claim_generation_job is atomic; concurrent cron/self-chain nudges
      // can only produce one owner and one provider submission.
      await kickExistingReferenceJob(job.id);
    } else if (recoveryAction === "resume_provider") {
      // Re-adopt the expired job lease and poll the SAME provider task id.
      await kickExistingReferenceJob(job.id, true);
    } else if (recoveryAction === "requeue_unsubmitted") {
      const { data: requeued, error: requeueError } = await admin.rpc("requeue_expired_unsubmitted_job", { p_job_id: job.id, p_retry_after: new Date().toISOString() });
      if (requeueError) throw requeueError;
      if (requeued) await kickExistingReferenceJob(job.id);
    } else if (recoveryAction === "fail_exhausted" || recoveryAction === "fail_uncertain") {
      const code = recoveryAction === "fail_exhausted" ? "REFERENCE_JOB_ATTEMPTS_EXHAUSTED" : "REFERENCE_PROVIDER_SUBMISSION_UNCERTAIN";
      const { error: failError } = await admin.rpc("fail_and_refund_generation_job", { p_job_id: job.id, p_error_code: code, p_error: code, p_provider_task_id: null });
      if (failError) throw failError;
    }
  }
  // A crash after saving provider success must resume QA on the next tick.
  for (const asset of current) {
    const entity = row.reference_plan?.entities?.find((candidate: any) => candidate.entityId === asset.entity_id);
    const plannedView = entity?.requiredViews?.find((view: any) => view.angle === asset.angle_or_view);
    // Manual retry rows created before the retry-contract migration did not
    // carry qa_expectations. Rebuild the contract from the authoritative
    // active plan so a successful replacement can never silently bypass QA.
    if (asset.status === "succeeded" && asset.qa_status == null && plannedView && !asset.qa_expectations) {
      asset.qa_expectations = deriveReferenceQAExpectations(plannedView, null);
      const { error: expectationsError } = await admin.from("long_form_reference_assets").update({ qa_expectations: asset.qa_expectations }).eq("id", asset.id);
      if (expectationsError) throw expectationsError;
    }
    if (asset.status === "succeeded" && asset.qa_status == null && (plannedView || asset.qa_expectations?.expectedSubjectCount === 1 || QA_ELIGIBLE_ROLES.has(asset.angle_or_view) || SHEET_QA_ROLES.has(asset.angle_or_view) || COMPONENT_QA_ROLES.has(asset.angle_or_view) || asset.angle_or_view === "character_reference_sheet")) {
      try {
        await runQACheckpoint(admin, row, asset);
      } catch (error) {
        const attempts = Number(asset.claim_attempts ?? 0) + 1;
        const exhausted = attempts >= 3;
        const code = error instanceof Error ? error.message.slice(0, 300) : "REFERENCE_QA_FAILED";
        const { error: qaError } = await admin.from("long_form_reference_assets").update({
          status: exhausted ? "failed" : "succeeded",
          claim_attempts: attempts,
          lease_until: null,
          last_error_code: exhausted ? "REFERENCE_QA_ATTEMPTS_EXHAUSTED" : code,
          last_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", asset.id).eq("job_id", asset.job_id);
        if (qaError) throw qaError;
        if (exhausted) Object.assign(asset, { status: "failed", last_error_code: "REFERENCE_QA_ATTEMPTS_EXHAUSTED" });
        else throw error;
      }
    }
  }
}

async function stageGenerating(admin: any, row: VisualWorldRow, project: any) {
  const { data: saved, error: readError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id);
  if (readError) throw readError;
  let replaced = new Set((saved ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
  let current = (saved ?? []).filter((a: any) => !replaced.has(a.id));

  // Self-heal (reliability pass): a required view with NO row at all is a
  // real bug, not a "planned, not yet requested" state — once Build has run
  // (this stage only executes after it has), every selected required view
  // for every entity must have a real row so it can actually progress
  // through WAITING_FOR_DEPENDENCY -> PENDING -> ... Real incident this
  // fixes: e_protagonist's Identity/Outfit sheet got approved, but Face/
  // Profile sheets had literally never been inserted (a taxonomy change
  // left them missing), so the frontend synthesized "Planned" placeholders
  // forever — nothing was ever wrong with claim eligibility, there was
  // simply no row to claim. This check is a cheap SELECT-driven diff, never
  // a provider call, and self-corrects any future taxonomy/planning gap the
  // same way, not just this one incident.
  const excludedViews = new Set((row.excluded_views ?? []) as string[]);
  const missingViews = findMissingRequiredViewRows(row.reference_plan?.entities ?? [], current, excludedViews);
  const missingRows = missingViews.map((m) => {
    const entity = row.reference_plan.entities.find((e: any) => e.entityId === m.entity_id);
    const view = entity.requiredViews.find((v: any) => v.angle === m.angle_or_view);
    return { visual_world_version_id: row.id, entity_id: m.entity_id, reference_type: m.reference_type, angle_or_view: m.angle_or_view, status: "pending", qa_expectations: deriveReferenceQAExpectations(view, null) };
  });
  if (missingRows.length) {
    // Real incident (2026-09-13, found live on Mars): this used to be a
    // plain admin.from(...).insert(missingRows) — a separate round trip
    // from the SELECT above with no lock in between, so two concurrent
    // invocations of this same world (the recovery cron and this function's
    // own self-chain can legitimately overlap) each computed "this view is
    // missing" and each inserted their own row, producing real duplicate
    // asset rows (and real duplicate provider spend once each one got
    // dispatched). ensure_missing_reference_asset_rows takes a row lock on
    // the world before re-checking and inserting, so a second concurrent
    // caller blocks until the first commits, then correctly finds nothing
    // left to insert.
    const { error: healError } = await admin.rpc("ensure_missing_reference_asset_rows", { p_visual_world_version_id: row.id, p_candidates: missingRows });
    if (healError) throw healError;
    const { data: resaved, error: resavedError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id);
    if (resavedError) throw resavedError;
    replaced = new Set((resaved ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
    current = (resaved ?? []).filter((a: any) => !replaced.has(a.id));
  }

  // Free reconciliation does not claim assets or increment paid attempts.
  await reconcileNonterminalAssets(admin, row, current);
  const { data: claimed, error: claimError } = await admin.rpc("claim_long_form_reference_asset_for_version", { p_visual_world_version_id: row.id });
  if (claimError) throw claimError;
  const asset = claimed?.[0];
  if (asset) {
   try {
    const entity = row.reference_plan?.entities?.find((e: any) => e.entityId === asset.entity_id);
    if (!entity) throw new Error("REFERENCE_SPEC_MISSING");
    const view = entity.requiredViews.find((v: any) => v.angle === asset.angle_or_view);
    if (!view) throw new Error("REFERENCE_VIEW_MISSING");

    let referenceImageUrl: string | string[] | null = null;
    let prompt: string;
    let terminalWithoutDispatch = false;

    const rendererPolicy = referenceRendererPolicy(asset);
    if (rendererPolicy.method === "ADOPT") {
      // silhouette_front/side/back (Part 10/11): zero-cost alias of the
      // already-accepted identity_outfit_* component for the SAME
      // orientation — duplicating an identical full-body shot under a
      // second label would be pure waste. Never dispatches to any renderer.
      const sourceAngle = ADOPT_SOURCE_ANGLE[asset.angle_or_view];
      if (!sourceAngle) throw new Error("ADOPT_SOURCE_ANGLE_UNKNOWN");
      const { data: candidates, error: sourceError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id).eq("angle_or_view", sourceAngle);
      if (sourceError) throw sourceError;
      const eligible = (candidates ?? []).filter(isCanonicalReference);
      const anyQaTracked = eligible.some((a: any) => a.qa_status != null);
      const replacedIds = new Set(eligible.map((a: any) => a.replaces_asset_id).filter(Boolean));
      const source = eligible
        .filter((a: any) => a.status === "succeeded" && a.result_url && (a.qa_status === "approved" || (a.qa_status == null && !anyQaTracked && !replacedIds.has(a.id))))
        .reduce((latest: any, a: any) => (!latest || a.created_at > latest.created_at ? a : latest), null);
      if (!source) throw new Error("ADOPT_SOURCE_NOT_ACCEPTED_YET");
      const { error: adoptError } = await admin.from("long_form_reference_assets").update({
        status: "succeeded", result_url: source.result_url, generation_type: "adopted",
        source_master_asset_id: source.id, render_model: source.render_model, input_reference_asset_ids: [source.id],
        cost_usd: 0, qa_status: "approved", qa_result: { note: `adopted — identical to already-accepted ${sourceAngle}, no independent generation or QA needed` },
        generation_latency_ms: 0, updated_at: new Date().toISOString(),
      }).eq("id", asset.id);
      if (adoptError) throw adoptError;
      terminalWithoutDispatch = true; // reuses the "already terminal, skip dispatch" flag below
      prompt = "";
    } else if (rendererPolicy.method === "CROP") {
      // Face Detail (Part 5): NEVER an independent generation — a
      // deterministic pixel crop of the accepted Identity Master, gated on
      // the SAME accepted-identity check geometry roles use (a crop of an
      // unreviewed/rejected master is still unreviewed/rejected).
      const { data: candidates, error: anchorError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id);
      if (anchorError) throw anchorError;
      const anchor = acceptedIdentityAnchor(candidates ?? [], asset);
      if (!anchor) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
      if (DERIVED_SHEET_ROLES.has(asset.angle_or_view)) assertSheetAnchor(asset, anchor);
      const prefix = `${SUPABASE_URL}/storage/v1/object/public/generated/`;
      if (!anchor.result_url?.startsWith(prefix)) throw new Error("UNEXPECTED_MASTER_STORAGE_URL");
      const response = await fetch(anchor.result_url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error("MASTER_DOWNLOAD_FAILED");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 20_000_000) throw new Error("MASTER_EXCEEDS_CROP_MEMORY_LIMIT");
      const source = PNG.sync.read(Buffer.from(bytes));
      if (source.width !== 1024 || source.height !== 1024) throw new Error("UNEXPECTED_MASTER_DIMENSIONS");
      const rect = FACE_CROP_RECT;
      const data = new Uint8Array(rect.width * rect.height * 4);
      for (let y = 0; y < rect.height; y++) {
        const start = ((rect.y + y) * source.width + rect.x) * 4;
        data.set(source.data.subarray(start, start + rect.width * 4), y * rect.width * 4);
      }
      const png = PNG.sync.write({ width: rect.width, height: rect.height, data: Buffer.from(data) });
      const path = `long-form/identity-crops/${asset.id}.png`;
      const { error: uploadError } = await admin.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);
      const { error: cropError } = await admin.from("long_form_reference_assets").update({
        status: "succeeded", result_url: publicUrl.publicUrl, generation_type: "deterministic_crop",
        source_master_asset_id: anchor.id, source_crop_key: asset.angle_or_view, source_crop_rect: rect,
        cost_usd: 0, render_model: "deterministic:rgba-crop-v1", input_reference_asset_ids: [anchor.id],
        qa_status: "approved", qa_result: { note: "deterministic crop — identity inherited pixel-for-pixel from the approved Identity Master, no independent QA needed" },
        generation_latency_ms: 0, updated_at: new Date().toISOString(),
      }).eq("id", asset.id);
      if (cropError) throw cropError;
      terminalWithoutDispatch = true;
      prompt = "";
    } else if (rendererPolicy.requiresIdentityAnchor && !asset.edit_instruction) {
      const { data: candidates, error: anchorError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id);
      if (anchorError) throw anchorError;
      const anchor = acceptedIdentityAnchor(candidates ?? [], asset);
      if (!anchor) throw new Error("ACCEPTED_IDENTITY_ANCHOR_REQUIRED");
      let referenceUrls: string[];
      if (IDENTITY_OUTFIT_GEOMETRY_ROLES.has(asset.angle_or_view)) {
        // Real incident (2026-09-11): a stray, never-QA'd face_closeup asset
        // (qa_status:null, generated under the old taxonomy, its pixels
        // violating its own prompt) was picked up as REFERENCE 2 here and
        // visibly contaminated a live Qwen Identity/Outfit test — wrong
        // person, wrong outfit, wrong illustration style, confirmed by both
        // manual review and runCharacterPackQA. Identity/Outfit geometry
        // edits (side/back) now use ONLY the single accepted canonical
        // anchor, with hard assertions rather than best-effort filtering —
        // no legacy-taxonomy row, qa_status:null row, rejected row, or
        // secondary identity reference of any kind can reach this dispatch.
        // The independent SQL cross-check guards against the JS/SQL mirror
        // drift class of bug already found once this session
        // (reference_geometry_role).
        const { data: independentAnchorId, error: anchorCheckError } = await admin.rpc("accepted_reference_identity", { p_world: row.id, p_entity: asset.entity_id });
        if (anchorCheckError) throw anchorCheckError;
        if (independentAnchorId !== anchor.id) throw new Error("IDENTITY_ANCHOR_MISMATCH");
        if (anchor.reference_type !== "character_reference" || !IDENTITY_ANCHOR_ANGLES.has(anchor.angle_or_view)) throw new Error("IDENTITY_ANCHOR_INVALID_ANGLE");
        if (anchor.qa_status !== "approved") throw new Error("IDENTITY_ANCHOR_NOT_APPROVED");
        if (!anchor.result_url) throw new Error("IDENTITY_ANCHOR_MISSING_URL");
        referenceUrls = [anchor.result_url];
        if (referenceUrls.length !== 1) throw new Error("IDENTITY_OUTFIT_REFERENCE_COUNT_INVALID");
        asset.input_reference_asset_ids = [anchor.id];
      } else {
        // Part 6: REFERENCE 1 (Identity Master, full outfit/body/proportions) +
        // REFERENCE 2 (Face Detail crop, facial construction) when the Face
        // crop is already available — verified within Qwen Image Edit Plus's
        // documented range (min 1, max 3 referenceImages), never assumed.
        // Falls back to the master alone if Face hasn't succeeded yet, or on
        // a fallback attempt if it genuinely isn't available for this entity.
        // NOTE: still applies to face_side/face_back only, where REFERENCE 2
        // is face_front — a deterministic crop of THIS SAME anchor, not the
        // legacy face_closeup asset that caused the incident above.
        const faceSibling = (candidates ?? []).filter(isCanonicalReference).find((a: any) => ["face_closeup", "face_front"].includes(a.angle_or_view) && a.status === "succeeded" && a.result_url);
        referenceUrls = [anchor.result_url, faceSibling?.result_url].filter(Boolean) as string[];
        asset.input_reference_asset_ids = referenceUrls.length > 1 ? [anchor.id, faceSibling.id] : [anchor.id];
      }
      referenceImageUrl = referenceUrls;
      if (DERIVED_SHEET_ROLES.has(asset.angle_or_view)) assertSheetAnchor(asset, anchor);
      // Real incident (2026-09-13): this call site still pointed at the OLD
      // compileDerivedSheetEdit (visualWorldStyle.ts) — never updated when
      // characterSheetContract.js's compileIsolatedSheetEdit was introduced
      // for the v5 sheet-isolation gate. That gate's enqueue_long_form_
      // reference_job now HARD-REQUIRES the prompt to start with "ROLE
      // CONTRACT: {role}." (see 20260911200936_sheet_role_isolation.sql) —
      // the old compiler never produced that prefix, so every Face/Profile
      // dispatch threw SHEET_ROLE_CONTRACT_MISMATCH before a jobs row could
      // ever be created (Face stuck at claim_attempts 3, Profile already
      // CLAIMS_EXHAUSTED). Local code (characterSheetContract.js) was
      // correct; the LIVE deployed dispatch path was never updated to call
      // it — exactly the local/live mismatch class this project keeps
      // hitting.
      prompt = DERIVED_SHEET_ROLES.has(asset.angle_or_view)
        ? compileIsolatedSheetEdit(asset.angle_or_view, row.style_spec?.summary)
        : compileGeometryEdit(asset, row.style_spec?.summary, entity.characterIdentitySpec, referenceUrls.length);
      // compileIsolatedSheetEdit's layout wording deliberately keeps the same
      // key phrases as the old compileDerivedSheetEdit (e.g. "exactly three
      // head-and-shoulders views of the same exact character"), so the
      // existing CHARACTER_FACE_SHEET/CHARACTER_PROFILE_SILHOUETTE_SHEET
      // checks apply unchanged as a free safety net against a future
      // regression in that compiler.
      if (DERIVED_SHEET_ROLES.has(asset.angle_or_view)) validateCompiledReferencePrompt(view, prompt);
      if (asset.fallback_of_asset_id) {
        prompt += DERIVED_SHEET_ROLES.has(asset.angle_or_view)
          ? "\nRETRY: a previous attempt for this exact sheet failed identity/layout review. Pay extremely close attention to matching the reference image's exact identity while still producing the three genuinely distinct views requested above — both requirements are mandatory, neither is optional."
          : "\nRETRY: a previous attempt for this exact role failed identity/orientation review. Pay extremely close attention to matching the reference image(s)' exact facial identity while still genuinely rotating the camera angle as instructed above — both requirements are mandatory, neither is optional.";
      }
      if (asset.edit_instruction) prompt += "\nAdditional requested edit (preserve target orientation and identity): " + asset.edit_instruction;
      // Real incident (2026-09-11): compileGeometryEdit's own 1900-char clamp
      // only covers ITS output — the two appends above run after it and can
      // silently push a compliant prompt back over Runware's positivePrompt
      // limit (confirmed live: a fallback_of_asset_id retry's RETRY suffix
      // did exactly this, 400ing at task creation). Re-clamp here as the
      // true final step, immediately before this becomes the dispatched
      // prompt.
      prompt = clampPositivePrompt(prompt);
      const derivedSheetVersionFields = DERIVED_SHEET_ROLES.has(asset.angle_or_view) ? { promptContractVersion: SHEET_CONTRACT_VERSION, promptCompilerVersion: SHEET_CONTRACT_VERSION } : {};
      const { error: provenanceError } = await admin.from("long_form_reference_assets").update({ input_reference_asset_ids: asset.input_reference_asset_ids, qa_expectations: { ...deriveReferenceQAExpectations(view, anchor.id), ...derivedSheetVersionFields } }).eq("id", asset.id);
      if (provenanceError) throw provenanceError;
    } else if (asset.edit_instruction) {
      // Edit flow (Part 11/12/13): a controlled transformation of the
      // PARENT's exact image, never a fresh from-spec generation. The parent
      // is always this row's own replaces_asset_id — edit_long_form_reference_asset
      // sets both together and never creates an edit row without one.
      const { data: parent } = await admin.from("long_form_reference_assets").select("result_url").eq("id", asset.replaces_asset_id).maybeSingle();
      if (!parent?.result_url) throw new Error("EDIT_SOURCE_MISSING");
      referenceImageUrl = parent.result_url;
      // Part 14 observability: record the operation explicitly rather than
      // leaving it only inferable from edit_instruction/replaces_asset_id —
      // "what EXACT request created this image" should never require
      // reverse-engineering column combinations.
      await admin.from("long_form_reference_assets").update({ qa_expectations: { ...(asset.qa_expectations ?? {}), operation: "edit" } }).eq("id", asset.id);
      prompt = [
        "[STYLE LOCK]", (row.style_spec ?? ZYVO_STYLE_SPEC).summary,
        "", "[EDIT THE SUPPLIED REFERENCE IMAGE]",
        "Treat the supplied image as the exact source asset. Make ONLY the requested change below. Preserve every other aspect of the image exactly: identity, pose, framing, background, style, and everything not explicitly mentioned.",
        `Requested change: ${asset.edit_instruction}`,
        "", "[CANONICAL REFERENCE NEGATIVE CONTRACT]", "NO infographic layout, explainer board, presentation board, educational poster, diagram, arrows, callouts or annotations.", "NO collage, split screen, contact sheet, multi-panel layout, duplicate subject, repeated copies or alternate views in one image.", "NO readable text, labels, captions, legends, logos, UI, numbers, symbols posing as text or watermarks.", "NO narrative action, before/after comparison, process sequence or finished story scene.",
      ].join("\n");
    } else {
      // Dependency graph (Part 5): PROFILE/FACE derive from their entity's
      // own IDENTITY_3Q anchor rather than three independent generations —
      // the claim RPC already guarantees the anchor is terminal by the time
      // this row is claimable (see claim_long_form_reference_asset_for_version's
      // gating). If it succeeded, condition on its image; if it failed,
      // fall back to independent generation rather than stalling forever —
      // one failed asset must never block another (Part 15).
      // Multi-view SHEET roles (Part 10) are deliberately EXCLUDED from
      // reference-conditioning even though they have a dependsOnAngle entry
      // (used only for the QA-approval GATE, enforced separately by
      // claim_long_form_reference_asset_for_version) — we already proved
      // reference-conditioned FLUX frequently copies the source composition
      // instead of rotating it; sheets are generated INDEPENDENTLY from
      // CharacterIdentitySpec instead of "copy source image then rotate it".
      const isSheetRole = view.referenceType === "character_reference" && ["identity_outfit_sheet", "face_sheet", "profile_silhouette_sheet", "character_reference_sheet"].includes(view.angle);
      const dependsOnAngle = isSheetRole ? null : view.referenceType === "character_reference" ? CHARACTER_REFERENCE_ROLES[view.angle as keyof typeof CHARACTER_REFERENCE_ROLES]?.dependsOnAngle : null;
      let identityAnchorId: string | null = null;
      // A role replacement remains one role. Turnaround masters use their
      // dedicated job/crop path; no per-view loop may silently recreate one.
      const strategy = characterReferenceStrategy(entity, row.renderer_tool_key, { strategy: entity.characterReferenceStrategy === "MULTIVIEW_MASTER" ? "INDEPENDENT" : entity.characterReferenceStrategy });
      if (dependsOnAngle && strategy !== "INDEPENDENT") {
        const { data: allAnchorRows } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id).eq("entity_id", asset.entity_id).eq("angle_or_view", dependsOnAngle);
        const anchorRows = (allAnchorRows ?? []).filter(isCanonicalReference);
        const anchorReplaced = new Set((anchorRows ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
        const anchor = (anchorRows ?? []).find((a: any) => !anchorReplaced.has(a.id));
        if (anchor?.status === "succeeded" && anchor.result_url) {
          referenceImageUrl = anchor.result_url;
          identityAnchorId = anchor.id;
        }
      }
      // Real incident (2026-09-14): Regenerate on the canonical
      // character_reference_sheet used to optionally send the approved
      // predecessor sheet as an identity/style reference (Part 3B of the
      // prior Kling migration). Live evidence showed Kling over-copying
      // that reference instead of producing a genuinely fresh generation —
      // that allowance is RETRACTED. Regenerate is now ALWAYS a from-scratch
      // generation: no reference image, ever, regardless of what the
      // predecessor's status/qa_status was. The previous image stays in
      // history (replaces_asset_id) but is never fed back into generation —
      // only Edit Reference (Qwen, above) ever conditions on the current
      // image.
      const isCanonicalKlingSheet = view.angle === "character_reference_sheet";
      prompt = asset.prompt_snapshot || compileReferencePrompt({ styleSpec: row.style_spec ?? ZYVO_STYLE_SPEC, visualStyleNotes: row.reference_plan?.visualStyleNotes, entityName: entity.entityName, canonicalSpec: entity.canonicalSpec, identitySpec: entity.characterIdentitySpec, view, factualConstraints: entity.factualConstraints, forbiddenElements: entity.forbiddenElements });
      validateCompiledReferencePrompt(view, prompt);
      if (identityAnchorId) {
        await admin.from("long_form_reference_assets").update({ input_reference_asset_ids: [identityAnchorId], qa_expectations: deriveReferenceQAExpectations(view, identityAnchorId) }).eq("id", asset.id);
      } else if (isSheetRole) {
        // Part 7/14: debug/admin-visible provenance of WHICH architecture
        // AND which renderer produced this asset — real incident this
        // addresses: without this, there was no way to tell a v3 (Klein)
        // sheet apart from a v4 (Kling) sheet or a stale/legacy row other
        // than manually reading its prompt_snapshot text.
        await admin.from("long_form_reference_assets").update({
          input_reference_asset_ids: [],
          qa_expectations: {
            ...deriveReferenceQAExpectations(view, null),
            promptContractVersion: isCanonicalKlingSheet ? CHARACTER_SHEET_CONTRACT_VERSION : SHEET_PROMPT_CONTRACT_VERSION,
            promptCompilerVersion: isCanonicalKlingSheet ? CHARACTER_SHEET_CONTRACT_VERSION : SHEET_PROMPT_COMPILER_VERSION,
            rendererPolicyVersion: isCanonicalKlingSheet ? KLING_SHEET_RENDERER_POLICY_VERSION : CHARACTER_SHEET_RENDERER_POLICY_VERSION,
            operation: asset.replaces_asset_id ? "regenerate" : "generate",
            // Part 7 of the 2026-09-14 fix: the selected project style is
            // now a first-class hard input to the sheet prompt — persist
            // WHICH style and WHICH version of the style-lock contract
            // actually produced this image, same observability discipline
            // as promptContractVersion/rendererPolicyVersion above.
            ...(isCanonicalKlingSheet ? { stylePresetId: project.visual_style_preset ?? null, styleContractVersion: STYLE_LOCK_CONTRACT_VERSION } : {}),
          },
        }).eq("id", asset.id);
      } else if (view.referenceType === "object_reference") {
        // Regenerate rows inherit the predecessor's QA contract. Refresh
        // object expectations at dispatch so retries immediately benefit
        // from the coherent-equipment-system rule instead of repeating a
        // stale false rejection for sensor + console style references.
        asset.qa_expectations = deriveReferenceQAExpectations(view, null);
        await admin.from("long_form_reference_assets").update({ qa_expectations: asset.qa_expectations }).eq("id", asset.id);
      }
    }

    if (!terminalWithoutDispatch) {
      validateCanonicalReferencePrompt(prompt, view.angle);
      const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", project.user_id).maybeSingle();
      const jobId = await ensureReferenceJob(admin, asset, row, project, prompt, profile?.plan_code ?? "free", referenceImageUrl);
      // This is only a latency optimization: the jobs sweep owns recovery.
      const dispatch = fetch(`${SUPABASE_URL}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch((e) => console.error("Reference job dispatch failed", e));
      const rt = (globalThis as any).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(dispatch);
      else await dispatch;
    }
   } catch (assetError) {
    // Real incident (2026-09-13): a per-asset exception (e.g.
    // SHEET_ROLE_CONTRACT_MISMATCH) used to propagate all the way to this
    // function's OUTER catch, which calls handleStageFailure on the WHOLE
    // WORLD — meaning one broken role (Face) consumed the world's own
    // stage_attempt/backoff budget and could eventually fail the entire
    // Visual World, blocking every OTHER role/entity too ("one failed
    // reference must not lock the whole board"). Isolate the failure to
    // THIS asset instead.
    //
    // job_id still null means no provider job was ever created for this
    // claim — a PRE-DISPATCH failure. There is no result to supersede and
    // nothing was spent, so recover the SAME row rather than creating a
    // replacement: "refund" the claim attempt it just consumed (so this
    // never burns toward CLAIMS_EXHAUSTED — that budget is for genuine
    // provider attempts only) and give it a short backoff lease so the next
    // self-chained tick doesn't hot-loop against a still-broken cause. The
    // `.eq("job_id", null)` guard avoids clobbering a genuine race where
    // dispatch actually succeeded concurrently with this catch firing.
    const code = assetError instanceof Error
      ? assetError.message.slice(0, 300)
      : (() => { try { return JSON.stringify(assetError).slice(0, 300); } catch { return String(assetError).slice(0, 300); } })();
    // Real incident (2026-09-13, found live on Mars): REFERENCE_VIEW_MISSING/
    // REFERENCE_SPEC_MISSING mean this row's entity+angle is no longer part
    // of the CURRENT reference plan at all (a taxonomy change retired it) —
    // a PERMANENT condition, not a transient one. The refund-and-retry path
    // below exists for transient pre-dispatch failures and assumes the next
    // attempt might succeed; for a permanently retired role it never will,
    // so it would otherwise loop forever every ~15s, burning a claim slot
    // every cycle that a genuinely current role could have used instead.
    // Fail it terminally and mark it stale (the same flag the rest of the
    // codebase already uses for "content no longer matches what's current")
    // instead of refunding the attempt.
    const isPermanentlyOrphaned = code.startsWith("REFERENCE_VIEW_MISSING") || code.startsWith("REFERENCE_SPEC_MISSING");
    if (isPermanentlyOrphaned) {
      const { error: orphanError } = await admin.from("long_form_reference_assets").update({
        status: "failed", stale: true, lease_until: null,
        last_error_code: code, last_error_at: new Date().toISOString(),
      }).eq("id", asset.id).is("job_id", null);
      if (orphanError) throw orphanError;
    } else if (!asset.job_id) {
      const exhausted = Number(asset.claim_attempts ?? 0) >= 3;
      const { error: recoverError } = await admin.from("long_form_reference_assets").update({
        status: exhausted ? "failed" : "running",
        lease_until: exhausted ? null : new Date(Date.now() + 15_000).toISOString(),
        // Preserve the causal error when the retry budget is exhausted;
        // replacing it with a generic marker made production failures
        // impossible to diagnose after the third attempt.
        last_error_code: exhausted ? `REFERENCE_DISPATCH_ATTEMPTS_EXHAUSTED: ${code}` : code,
        last_error_at: new Date().toISOString(),
      }).eq("id", asset.id).is("job_id", null);
      if (recoverError) throw recoverError;
    } else {
      // A job DOES exist — this is a post-dispatch issue (e.g. a genuine
      // reconciliation/QA-checkpoint exception), not a pre-dispatch one.
      // Record it on the asset for visibility but do not "refund" a claim
      // attempt that legitimately reached the provider.
      const { error: recordErr } = await admin.from("long_form_reference_assets").update({ last_error_code: code, last_error_at: new Date().toISOString() }).eq("id", asset.id);
      if (recordErr) throw recordErr;
    }
   }
  }
  const { data: refreshedRows, error: refreshError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id);
  const refreshed = (refreshedRows ?? []).filter(isCanonicalReference);
  if (refreshError) throw refreshError;
  const oldIds = new Set((refreshed ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
  const currentRows = (refreshed ?? []).filter((a: any) => !oldIds.has(a.id));
  const plannedViewKeys = new Set((row.reference_plan?.entities ?? []).flatMap((entity: any) =>
    (entity.requiredViews ?? []).map((view: any) => `${entity.entityId}:${view.referenceType}:${view.angle}`)
  ));
  // Provider success is not workflow completion. Every successful current
  // reference required by the active plan must have an explicit QA verdict
  // before finalization. Retired historical taxonomy rows do not block it.
  const allTerminal = currentRows.every((a: any) => ["succeeded", "failed"].includes(a.status))
    && currentRows.every((a: any) => a.status !== "succeeded" || a.qa_status != null || !plannedViewKeys.has(`${a.entity_id}:${a.reference_type}:${a.angle_or_view}`));
  const { error: checkpointError } = await admin.from("long_form_visual_world_versions").update({ status: "generating", stage: allTerminal ? "finalizing" : "generating", stage_attempt: 0, worker_lock_until: allTerminal || asset ? null : new Date(Date.now() + 10000).toISOString() }).eq("id", row.id);
  if (checkpointError) throw checkpointError;
}
// Zero-cost — programmatic board layout + final cost rollup + terminal
// status. Never fabricates a "finished gap round"; just reflects whatever
// asset rows actually reached succeeded/failed.
async function stageFinalizing(admin: any, row: VisualWorldRow, project: any) {
  const { data: assets, error } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id);
  if (error) throw error;
  const replaced = new Set((assets ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
  const rows = (assets ?? []).filter((a: any) => isCanonicalReference(a) && !replaced.has(a.id));
  const plannedViewKeys = new Set((row.reference_plan?.entities ?? []).flatMap((entity: any) =>
    (entity.requiredViews ?? []).map((view: any) => `${entity.entityId}:${view.referenceType}:${view.angle}`)
  ));
  const qaPending = rows.filter((a: any) => a.status === "succeeded" && a.qa_status == null
    && plannedViewKeys.has(`${a.entity_id}:${a.reference_type}:${a.angle_or_view}`));
  if (qaPending.length) {
    const { error: reopenError } = await admin.from("long_form_visual_world_versions").update({ status: "generating", stage: "generating", stage_attempt: 0, worker_lock_until: null, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (reopenError) throw reopenError;
    return;
  }
  const succeeded = rows.filter((a: any) => a.status === "succeeded");
  // Production Ready must mean "provider returned an ACCEPTABLE reference"
  // (Part 7) — a row stuck at qa_status:'rejected' (its one bounded
  // fallback also failed review) is a real completion gap, not a silent
  // success, so it counts toward needs_attention the same way a hard
  // generation failure does.
  const needsReview = rows.filter((a: any) => a.status === "succeeded" && a.qa_status === "rejected");
  const failed = rows.filter((a: any) => a.status === "failed");

  const byEntity = new Map<string, any[]>();
  for (const a of succeeded.filter((a: any) => a.qa_status !== "rejected")) {
    if (!byEntity.has(a.entity_id)) byEntity.set(a.entity_id, []);
    byEntity.get(a.entity_id)!.push({ assetId: a.id, angle: a.angle_or_view, url: a.result_url });
  }
  const referenceBoardMeta = {
    sections: (row.reference_plan?.entities ?? [])
      .filter((e: any) => byEntity.has(e.entityId))
      .map((e: any) => ({ entityId: e.entityId, entityName: e.entityName, category: e.entityCategory, views: byEntity.get(e.entityId) })),
  };

  const totalReferenceCost = (assets ?? []).reduce((sum: number, a: any) => sum + Number(a.cost_usd ?? 0), 0);
  const meta = { ...(row.meta ?? {}), totalAssets: rows.length, succeededAssets: succeeded.length, failedAssets: failed.length, needsReviewAssets: needsReview.length, referenceImageCostUsd: totalReferenceCost };
  meta.estimatedTotalCostUsd = Number(((meta.estimatedModelCostUsd ?? 0) + totalReferenceCost).toFixed(4));

  await admin.from("long_form_visual_world_versions").update({ reference_board_meta: referenceBoardMeta, meta, worker_lock_until: null, updated_at: new Date().toISOString() }).eq("id", row.id);
  // Real incident (2026-09-14, "FINAL VISUAL WORLD POLISH"): status used to
  // be computed inline right here, scoped to isCanonicalReference(a) &&
  // !replaced — NOT to the current reference plan's requiredViews. Found
  // live on Mars: 8 rows from retired taxonomies (old three_quarter_neutral/
  // profile/face_closeup component-pack, old identity_outfit_sheet/
  // face_sheet/profile_silhouette_sheet 3-sheet-pack — none of these angles
  // exist in requiredViews anymore) kept the world stuck at
  // 'needs_attention' forever even once every CURRENTLY required reference
  // was resolved. reconcile_visual_world_completion_status (SQL) is now the
  // ONE authoritative, correctly-scoped computation — reused here and from
  // every other resolution path (manual approval, the reconciliation loop
  // below) so this can never drift out of sync with itself again.
  const { error: reconcileError } = await admin.rpc("reconcile_visual_world_completion_status", { p_visual_world_version_id: row.id });
  if (reconcileError) throw reconcileError;
}

/* ============================ Failure handling — claim-time attempt, no double-increment ============================ */

async function dispatchNext(id: string) {
  await fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: id }) });
}

function stringifyStageError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    const parts = [e.message, e.code, e.details, e.hint].filter((v) => typeof v === "string" && v.length);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

async function handleStageFailure(admin: any, row: VisualWorldRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = stringifyStageError(error).slice(0, 300);
  console.error(`[advance-long-form-visual-world] stage ${row.stage} failed (attempt ${attempt}) for visual world ${row.id}:`, errorCode);
  if (attempt >= MAX_STAGE_ATTEMPTS) {
    await admin.from("long_form_visual_world_versions").update({ status: "failed", last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return;
  }
  const backoffSeconds = 15 * attempt;
  await admin
    .from("long_form_visual_world_versions")
    .update({ last_error_code: errorCode, last_error_at: new Date().toISOString(), worker_lock_until: new Date(Date.now() + backoffSeconds * 1000).toISOString() })
    .eq("id", row.id);
}

/* ============================ Handler ============================ */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = req.headers.get("x-cron-secret");
  const recoveryOnly = Boolean(RECOVERY_SECRET && req.headers.get("x-recovery-secret") === RECOVERY_SECRET);
  if ((!ADVANCE_SECRET || secret !== ADVANCE_SECRET) && !recoveryOnly) return json({ error: "Unauthorized" }, 401);
  if (VISUAL_WORLD_PAUSED) return json({ paused: true, claimed: false });

  const body = await req.json().catch(() => ({}));
  const targetId = body?.visualWorldVersionId ? String(body.visualWorldVersionId) : null;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  if (recoveryOnly) {
    if (!targetId) return json({ error: "Target required" }, 400);
    const { data: target } = await admin.from("long_form_visual_world_versions").select("stage").eq("id", targetId).maybeSingle();
    // 2026-09-19 production incident fix — real Mars stuck world d64cce75:
    // this gate used to exclude 'planning', the exact stage a genuinely
    // stuck world (a deterministic row-construction bug, in this incident's
    // case) can never otherwise recover from — see this migration's own
    // comment (20260930360000) for the full trace. 'planning' does one real
    // OpenAI call, bounded by stagePlanning's own $0.05 cost ceiling
    // (MAX_REFERENCE_PLAN_COST_USD) before it ever fires — recovering it is
    // exactly as safe as recovering 'generating', which this gate already
    // allowed.
    if (!target || !["planning", "generating", "finalizing"].includes(target.stage)) return json({ claimed: false });
  }

  const { data: claimedRows } = targetId
    ? await admin.rpc("claim_long_form_visual_world_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_visual_world_stage", { p_limit: 1 });

  const row = claimedRows?.[0];
  if (!row) {
    // Part 5/6 orphan recovery: the world's own stage-claim only matches
    // status in ('planning','generating') — a world already past that
    // (needs_attention/ready/failed) can never be re-claimed through the
    // normal stage machinery, but fixing ONE straggling asset's row never
    // needed that machinery in the first place. Only reachable for a
    // recovery-cron/targeted call (never the plain self-chain, which always
    // passes a target it just claimed); no-ops instantly for the normal
    // case where nothing is actually orphaned.
    if (recoveryOnly && targetId) {
      const { data: worldRow } = await admin.from("long_form_visual_world_versions").select("*").eq("id", targetId).maybeSingle();
      if (worldRow) {
        const { data: assets } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", targetId);
        const replaced = new Set((assets ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
        const current = (assets ?? []).filter((a: any) => !replaced.has(a.id));
        const hadOrphan = current.some((a: any) => a.job_id && ["pending", "running"].includes(a.status));
        if (hadOrphan) {
          await reconcileNonterminalAssets(admin, worldRow, current);
        }
        // Part 3 of the 2026-09-14 fix: reconcile the world's OWN status on
        // every recovery-cron touch, not only when an orphan was found —
        // real incident this closes: a world can be stuck at
        // 'needs_attention' with no orphan at all (e.g. a stale status left
        // over from before a scoping bug in stageFinalizing was fixed, or
        // simply never re-evaluated after a later manual resolution) and
        // nothing would otherwise ever revisit it. This RPC is cheap and
        // idempotent (a no-op once status already matches reality), so
        // calling it unconditionally here is exactly what "automatic
        // reconciliation, no user refresh required" means.
        if (worldRow.status === "needs_attention") {
          await admin.rpc("reconcile_visual_world_completion_status", { p_visual_world_version_id: targetId });
        }
        if (hadOrphan) {
          return json({ claimed: false, orphanReconciled: true });
        }
      }
    }
    return json({ claimed: false });
  }

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: visualPlanRow } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", row.visual_plan_version_id).maybeSingle();

  if (!project || !visualPlanRow) {
    await admin.from("long_form_visual_world_versions").update({ status: "failed", last_error_code: "PROJECT_OR_PLAN_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }

  try {
    switch (row.stage) {
      case "planning":
        // 2026-09-19 production incident fix — real Mars stuck world
        // d64cce75: this used to unconditionally refuse to run stagePlanning
        // for ANY recovery-secret-authenticated call, permanently blocking
        // recovery from ever reaching a world stuck in 'planning' — the
        // SECOND, independent gate with this exact exclusion (the first was
        // the recovery cron's own stage filter and this file's own
        // recoveryOnly stage check just above, both fixed in
        // 20260930360000). Confirmed live: widening those two alone got the
        // cron to finally reclaim d64cce75 (stage_attempt 1 -> 2), only to
        // hit this exact throw with last_error_code "Reference planning is
        // not configured" — a real, previously-invisible THIRD layer of the
        // same "planning was never meant to be recoverable" gap.
        //
        // The cron never CREATES a 'planning'-stage row — every row it can
        // ever reach here was already dispatched at least once through the
        // normal path (start-long-form-visual-world / reconcile-long-form-
        // visual-world), so "recovery retries an already-dispatched
        // planning stage" and "recovery originates a brand-new one" are not
        // actually two different cases in practice; blocking recoveryOnly
        // here blocked the ONLY case that ever occurs, not some narrower
        // unattended-origination risk. The real safety net for repeated-
        // planning-attempt cost was already in place before this fix and
        // still applies unchanged: MAX_REFERENCE_PLAN_COST_USD's own
        // pre-call ceiling (stagePlanning's very first check) plus
        // claim_long_form_visual_world_stage's existing 3-attempt cap
        // (auto-fails to a terminal, non-retrying status — see item 6).
        // `!OPENAI_KEY` alone remains a hard stop either way — a genuinely
        // unconfigured environment must never attempt this regardless of
        // caller.
        if (!OPENAI_KEY) throw new Error("Reference planning is not configured");
        await stagePlanning(admin, row, project, visualPlanRow);
        break;
      case "generating":
        await stageGenerating(admin, row, project);
        break;
      case "finalizing":
        await stageFinalizing(admin, row, project);
        break;
      default:
        throw new Error(`Unknown stage: ${row.stage}`);
    }
    if (row.stage !== "finalizing") await dispatchNext(row.id);
    return json({ claimed: true, id: row.id, stage: row.stage });
  } catch (error) {
    await handleStageFailure(admin, row, error);
    return json({ claimed: true, id: row.id, stage: row.stage, error: true });
  }
});
import { assertSheetAnchor, assertReferenceCompletion, compileIsolatedSheetEdit, SHEET_CONTRACT_VERSION } from "../_shared/characterSheetContract.js";
