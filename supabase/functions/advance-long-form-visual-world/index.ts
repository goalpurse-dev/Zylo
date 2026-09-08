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
import { ZYVO_STYLE_SPEC, deriveRequiredViews, compileReferencePrompt, estimateReferenceCosts } from "../_shared/visualWorldStyle.ts";
import { ensureReferenceJob, referenceJobResult } from "../_shared/visualWorldJobs.ts";

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

const GPT5_MINI_INPUT_PER_M = 0.25;
const GPT5_MINI_OUTPUT_PER_M = 2.0;

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

For a CHARACTER: describe age range, build, distinguishing features, hair, typical attire/materials appropriate to the topic's real historical/factual context, and overall visual impression — concrete enough to be unambiguous, never generic ("a person").
For a LOCATION: describe its structure, materials, scale, mood, and defining visual features.
For an IMPORTANT_OBJECT or VEHICLE_MACHINE: describe its form, materials, scale, and defining details.

FACTUAL CONSTRAINTS: ground every canonical spec in what Research actually established — if a common visual myth about this topic exists (e.g. a historically inaccurate but popular depiction), note it explicitly as a forbidden element rather than silently reproducing it. Only state constraints Research actually supports; do not invent new claims.

Also provide one short "visualStyleNotes" string: a project-specific mood/palette inflection within Zyvo's locked illustrated-documentary style (e.g. "cold, muted blues and greys for a winter survival story") — never a new style, never contradicting the style lock.`;

function referencePlannerInput(ctx: {
  topic: string;
  entities: any[];
  continuityGroups: any[];
  storyboardSummary: any;
  compactFacts: { id: string; claim: string }[];
}) {
  return [
    `TOPIC: ${ctx.topic}`,
    ``,
    `ENTITIES NEEDING A CANONICAL REFERENCE:`,
    JSON.stringify(ctx.entities.map((e: any) => ({ id: e.id, category: e.category, name: e.name, importance: e.importance })), null, 2),
    ``,
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
          required: ["entityId", "canonicalSpec", "factualConstraints", "forbiddenElements"],
          properties: {
            entityId: { type: "string", enum: idEnum },
            canonicalSpec: { type: "string" },
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

async function stagePlanning(admin: any, row: VisualWorldRow, project: any, visualPlan: any) {
  const knownSpent = row.meta?.estimatedTotalCostUsd ?? 0;
  if (knownSpent >= MAX_REFERENCE_PLAN_COST_USD) {
    throw new Error(`reference_plan_cost_ceiling_reached: $${knownSpent.toFixed(4)} already spent under the $${MAX_REFERENCE_PLAN_COST_USD} planning ceiling`);
  }

  const entityRegistry: any[] = visualPlan.entity_registry ?? [];
  const continuityGroups: any[] = visualPlan.continuity_groups ?? [];
  const referenceNeededEntities = entityRegistry.filter((e: any) => e.referenceNeeded);

  if (referenceNeededEntities.length === 0) {
    // Nothing to plan or render — a video whose Visual Plan found no
    // recurring people/places/objects worth a canonical reference.
    await admin
      .from("long_form_visual_world_versions")
      .update({ reference_plan: { visualStyleNotes: "", entities: [] }, style_spec: ZYVO_STYLE_SPEC, stage: "finalizing", stage_attempt: 0, worker_lock_until: null })
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

  const usage = newUsageTotals();
  const entityIds = referenceNeededEntities.map((e: any) => e.id);
  let llmResult: any;
  let attempts = 0;
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
            entities: referenceNeededEntities,
            continuityGroups,
            storyboardSummary: visualPlan.storyboard_summary,
            compactFacts,
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

  // Deterministic merge: requiredViews and referencePriority NEVER come
  // from the LLM (see _shared/visualWorldStyle.ts) — only canonicalSpec/
  // factualConstraints/forbiddenElements do.
  const llmByEntityId = new Map((llmResult.entities ?? []).map((e: any) => [e.entityId, e]));
  const planEntities = referenceNeededEntities.map((entity: any) => {
    const llmEntity = llmByEntityId.get(entity.id) ?? { canonicalSpec: "", factualConstraints: [], forbiddenElements: [] };
    return {
      entityId: entity.id,
      entityName: entity.name,
      entityCategory: entity.category,
      referencePriority: entity.referencePriority,
      canonicalSpec: llmEntity.canonicalSpec,
      requiredViews: deriveRequiredViews(entity, continuityGroups),
      factualConstraints: llmEntity.factualConstraints ?? [],
      forbiddenElements: llmEntity.forbiddenElements ?? [],
    };
  });
  const referencePlan = { visualStyle: ZYVO_STYLE_SPEC.name, visualStyleNotes: llmResult.visualStyleNotes ?? "", entities: planEntities };

  // Create one PENDING long_form_reference_assets row per required view —
  // real child rows, never a JSONB array (see the migration's own
  // reasoning) — so each image gets its own independent job/retry/status/
  // cost from the moment it exists. Views the user explicitly unchecked
  // before generation (Part 10 — "entityId:angle" keys) are skipped here,
  // never created as asset rows at all.
  const excludedViewKeys = new Set((row.excluded_views ?? []) as string[]);
  const assetRows = planEntities.flatMap((entity: any) =>
    entity.requiredViews
      .filter((view: any) => !excludedViewKeys.has(`${entity.entityId}:${view.angle}`))
      .map((view: any) => ({
        visual_world_version_id: row.id,
        entity_id: entity.entityId,
        reference_type: view.referenceType,
        angle_or_view: view.angle,
        status: "pending",
      }))
  );

  // Part 16 — estimate the cost of actually rendering this plan across all
  // three render tiers BEFORE any image is generated, stored internally
  // only (never shown to users, never a render commitment).
  const projectedCost = estimateReferenceCosts(assetRows.length);
  const meta = mergeMeta(row.meta, usage, { repairCalls: attempts - 1, projectedCost });
  if (assetRows.length) {
    const { error: insertError } = await admin.from("long_form_reference_assets").insert(assetRows);
    if (insertError) throw new Error(`Could not create reference asset rows: ${insertError.message}`);
  }

  await admin
    .from("long_form_visual_world_versions")
    .update({
      reference_plan: referencePlan,
      style_spec: ZYVO_STYLE_SPEC,
      meta,
      stage: assetRows.length ? "generating" : "finalizing",
      stage_attempt: 0,
      worker_lock_until: null,
    })
    .eq("id", row.id);
}

async function stageGenerating(admin: any, row: VisualWorldRow, project: any) {
  const { data: saved, error: readError } = await admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", row.id);
  if (readError) throw readError;
  const replaced = new Set((saved ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
  const current = (saved ?? []).filter((a: any) => !replaced.has(a.id));
  // Free reconciliation does not claim assets or increment paid attempts.
  for (const asset of current.filter((a: any) => a.job_id && ["pending", "running"].includes(a.status))) {
    const { data: job, error } = await admin.from("jobs").select("status,result_url,output,created_at,updated_at").eq("id", asset.job_id).maybeSingle();
    if (error) throw error;
    const result = referenceJobResult(job);
    if (result) {
      const { error: updateError } = await admin.from("long_form_reference_assets").update({ ...result, updated_at: new Date().toISOString() }).eq("id", asset.id).eq("job_id", asset.job_id);
      if (updateError) throw updateError;
      Object.assign(asset, result);
    }
  }
  const { data: claimed, error: claimError } = await admin.rpc("claim_long_form_reference_asset_for_version", { p_visual_world_version_id: row.id });
  if (claimError) throw claimError;
  const asset = claimed?.[0];
  if (asset) {
    const entity = row.reference_plan?.entities?.find((e: any) => e.entityId === asset.entity_id);
    if (!entity) throw new Error("REFERENCE_SPEC_MISSING");
    const view = entity.requiredViews.find((v: any) => v.angle === asset.angle_or_view);
    if (!view) throw new Error("REFERENCE_VIEW_MISSING");
    const prompt = asset.prompt_snapshot || compileReferencePrompt({ styleSpec: row.style_spec ?? ZYVO_STYLE_SPEC, visualStyleNotes: row.reference_plan?.visualStyleNotes, entityName: entity.entityName, canonicalSpec: entity.canonicalSpec, view, factualConstraints: entity.factualConstraints, forbiddenElements: entity.forbiddenElements });
    const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", project.user_id).maybeSingle();
    const jobId = await ensureReferenceJob(admin, asset, row, project, prompt, profile?.plan_code ?? "free");
    // This is only a latency optimization: the jobs sweep owns recovery.
    const dispatch = fetch(`${SUPABASE_URL}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ jobId }) }).catch((e) => console.error("Reference job dispatch failed", e));
    const rt = (globalThis as any).EdgeRuntime;
    if (rt?.waitUntil) rt.waitUntil(dispatch);
    else await dispatch;
  }
  const { data: refreshed, error: refreshError } = await admin.from("long_form_reference_assets").select("id,status,replaces_asset_id").eq("visual_world_version_id", row.id);
  if (refreshError) throw refreshError;
  const oldIds = new Set((refreshed ?? []).map((a: any) => a.replaces_asset_id).filter(Boolean));
  const allTerminal = (refreshed ?? []).filter((a: any) => !oldIds.has(a.id)).every((a: any) => ["succeeded", "failed"].includes(a.status));
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
  const rows = (assets ?? []).filter((a: any) => !replaced.has(a.id));
  const succeeded = rows.filter((a: any) => a.status === "succeeded");
  const failed = rows.filter((a: any) => a.status === "failed");

  const byEntity = new Map<string, any[]>();
  for (const a of succeeded) {
    if (!byEntity.has(a.entity_id)) byEntity.set(a.entity_id, []);
    byEntity.get(a.entity_id)!.push({ assetId: a.id, angle: a.angle_or_view, url: a.result_url });
  }
  const referenceBoardMeta = {
    sections: (row.reference_plan?.entities ?? [])
      .filter((e: any) => byEntity.has(e.entityId))
      .map((e: any) => ({ entityId: e.entityId, entityName: e.entityName, category: e.entityCategory, views: byEntity.get(e.entityId) })),
  };

  const totalReferenceCost = (assets ?? []).reduce((sum: number, a: any) => sum + Number(a.cost_usd ?? 0), 0);
  const meta = { ...(row.meta ?? {}), totalAssets: rows.length, succeededAssets: succeeded.length, failedAssets: failed.length, referenceImageCostUsd: totalReferenceCost };
  meta.estimatedTotalCostUsd = Number(((meta.estimatedModelCostUsd ?? 0) + totalReferenceCost).toFixed(4));

  // needs_attention (never a hard failure) when SOME but not all references
  // came through — a partial Visual World is still usable; only zero
  // successful assets out of a nonzero plan is a true failure.
  const status = rows.length === 0 ? "ready" : succeeded.length === 0 ? "failed" : failed.length > 0 ? "needs_attention" : "ready";

  await admin.from("long_form_visual_world_versions").update({ status, reference_board_meta: referenceBoardMeta, meta, worker_lock_until: null, updated_at: new Date().toISOString() }).eq("id", row.id);
  if (status !== "failed") {
    await admin.from("long_form_projects").update({ current_visual_world_version_id: row.id, updated_at: new Date().toISOString() }).eq("id", project.id).eq("current_visual_plan_version_id", row.visual_plan_version_id);
  }
}

/* ============================ Failure handling — claim-time attempt, no double-increment ============================ */

async function dispatchNext(id: string) {
  await fetch(SELF_URL, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json", "x-cron-secret": ADVANCE_SECRET }, body: JSON.stringify({ visualWorldVersionId: id }) });
}

async function handleStageFailure(admin: any, row: VisualWorldRow, error: unknown) {
  const attempt = row.stage_attempt ?? 1;
  const errorCode = error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300);
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
    if (!target || !["generating", "finalizing"].includes(target.stage)) return json({ claimed: false });
  }

  const { data: claimedRows } = targetId
    ? await admin.rpc("claim_long_form_visual_world_stage_by_id", { p_id: targetId })
    : await admin.rpc("claim_long_form_visual_world_stage", { p_limit: 1 });

  const row = claimedRows?.[0];
  if (!row) return json({ claimed: false });

  const { data: project } = await admin.from("long_form_projects").select("*").eq("id", row.project_id).maybeSingle();
  const { data: visualPlanRow } = await admin.from("long_form_visual_plan_versions").select("*").eq("id", row.visual_plan_version_id).maybeSingle();

  if (!project || !visualPlanRow) {
    await admin.from("long_form_visual_world_versions").update({ status: "failed", last_error_code: "PROJECT_OR_PLAN_MISSING", last_error_at: new Date().toISOString(), worker_lock_until: null }).eq("id", row.id);
    return json({ claimed: true, id: row.id, failed: true });
  }

  try {
    switch (row.stage) {
      case "planning":
        if (recoveryOnly || !OPENAI_KEY) throw new Error("Reference planning is not configured");
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
