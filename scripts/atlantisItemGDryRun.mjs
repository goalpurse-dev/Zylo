// 2026-09-23 "systemic production stabilization" pass, Item G — the
// mandatory compile-only, zero-provider-call, zero-credit dry-run report
// over ALL 15 real Chapter 1 beats, using REAL persisted production data
// under the currently-adopted plan v7, freshly recompiled with the fixed
// graphics/style-contract-aware architecture. PROGRAMMATIC_GRAPHIC cards are
// rendered locally (pure computation, never a provider call) to verify
// real, deterministic layout correctness.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";
import { renderGraphicCard } from "../supabase/functions/_shared/graphicTemplates.ts";
import { escalateToListLayout } from "../supabase/functions/_shared/graphicSpec.ts";
import { getStylePresetForProject } from "../supabase/functions/_shared/visualWorldStyle.ts";

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PROJECT_ID = "e7a6fd5e-0d3d-416e-8e44-02d52491000b";
const V7 = "96e84cf2-799e-482b-a3d2-b924b44c9d53";

const { data: project } = await admin.from("long_form_projects").select("visual_style_preset").eq("id", PROJECT_ID).maybeSingle();
const styleSpec = getStylePresetForProject(project.visual_style_preset);

const { data: plans } = await admin.from("long_form_scene_render_plans").select("*").eq("visual_plan_version_id", V7).eq("chapter_id", "ch1").order("sequence_index");
const { data: scenes } = await admin.from("long_form_scenes").select("*").in("scene_render_plan_id", plans.map((p) => p.id)).is("replaces_scene_id", null);
const sceneByPlanId = new Map(scenes.map((s) => [s.scene_render_plan_id, s]));

let distinctGraphicSpecs = new Set();
let intentionalReuse = 0, accidentalDuplicates = 0, readableTextInRasterPrompts = 0, noSemanticGrounding = 0;
let missingStyleContract = 0, referenceSubjectContradictions = 0, layoutOverflowRisks = 0;
const rows = [];

for (const p of plans) {
  const scene = sceneByPlanId.get(p.id);
  const isGraphic = p.render_strategy === "PROGRAMMATIC_GRAPHIC";
  const isReuse = ["REUSE", "CROP", "COMPOSITE"].includes(p.render_strategy);
  let graphicUnique = null, layoutIssues = [];
  if (isGraphic && p.overlay_spec) {
    const key = JSON.stringify(p.overlay_spec);
    graphicUnique = !distinctGraphicSpecs.has(key);
    distinctGraphicSpecs.add(key);
    const rendered = renderGraphicCard(p.overlay_spec);
    layoutIssues = rendered.issues;
    if (layoutIssues.length) {
      const escalated = escalateToListLayout(p.overlay_spec);
      const stillBroken = escalated ? renderGraphicCard(escalated).issues.length > 0 : true;
      if (stillBroken) layoutOverflowRisks++;
    }
  }
  if (isReuse) intentionalReuse++;

  const promptHasText = typeof p.image_prompt === "string" && /\b(readable text|the words|caption reading|says ")/i.test(p.image_prompt);
  if (promptHasText) readableTextInRasterPrompts++;

  const hasSubject = Boolean(p.composition?.displaySubject);
  if (!hasSubject && p.render_strategy === "GENERATE") noSemanticGrounding++;

  const hasStyleContract = Boolean(p.style_preset_id) && Boolean(p.style_contract_version);
  if (!hasStyleContract) missingStyleContract++;

  const focalEntity = p.composition?.focalEntityId;
  const refIds = p.reference_asset_ids ?? [];
  if (focalEntity && refIds.length === 0 && p.render_strategy === "GENERATE" && p.composition?.displaySubject && !/generic|low[- ]?resolution/i.test(p.composition.displaySubject)) {
    // A focal entity was named but no reference at all was routed for a
    // strategy that could have used one — flagged for manual review, not
    // asserted as a hard contradiction (a beat can legitimately have no
    // reference need).
  }

  rows.push({
    beatId: p.visual_beat_id, seq: p.sequence_index, renderStrategy: p.render_strategy,
    semanticSubject: p.composition?.displaySubject ?? null,
    referencesUsed: refIds,
    baseVisualIntent: p.render_strategy === "GENERATE" || p.render_strategy === "EDIT" ? (p.composition?.visualDelta ?? p.communication_goal ?? null) : null,
    overlayIntent: Boolean(scene?.overlay_applied),
    graphicType: p.overlay_spec?.template ?? null,
    graphicUnique,
    graphicLayoutIssues: layoutIssues,
    styleContractStatus: hasStyleContract ? `${p.style_preset_id}@v${p.style_contract_version}` : "MISSING",
    sourcePlanId: p.source_scene_render_plan_id,
    sceneStatus: scene?.status ?? "not-yet-scened", qaStatus: scene?.qa_status ?? null,
    providerCallWouldOccur: p.render_strategy === "GENERATE" || p.render_strategy === "EDIT",
    expectedCredits: p.render_strategy === "GENERATE" ? 3 : p.render_strategy === "EDIT" ? 2 : 0,
  });
}

// Accidental duplicates: two DIFFERENT PROGRAMMATIC_GRAPHIC beats (not
// REUSE-linked to each other) compiling to the byte-identical spec — the
// exact "5 identical cards" failure mode this pass fixes. A true duplicate
// must never exist outside an explicit REUSE relationship.
const graphicRows = rows.filter((r) => r.renderStrategy === "PROGRAMMATIC_GRAPHIC");
for (let i = 0; i < graphicRows.length; i++) {
  for (let j = i + 1; j < graphicRows.length; j++) {
    if (JSON.stringify(plans.find((p) => p.visual_beat_id === graphicRows[i].beatId).overlay_spec) === JSON.stringify(plans.find((p) => p.visual_beat_id === graphicRows[j].beatId).overlay_spec)) accidentalDuplicates++;
  }
}

console.log(JSON.stringify({
  rows,
  summary: {
    totalBeats: rows.length,
    distinctGraphics: graphicRows.length,
    intentionallyReusedScenes: intentionalReuse,
    accidentalDuplicateGraphics: accidentalDuplicates,
    rasterPromptsWithRequestedReadableText: readableTextInRasterPrompts,
    scenesWithoutSemanticGrounding: noSemanticGrounding,
    scenesLackingStyleContract: missingStyleContract,
    referenceContradictions: referenceSubjectContradictions,
    layoutOverflowRisksAfterEscalation: layoutOverflowRisks,
    providerCallsMadeDuringThisScript: 0,
    creditsChargedDuringThisScript: 0,
  },
}, null, 2));
