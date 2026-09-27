import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveReferenceReuse } from "../supabase/functions/_shared/visualWorldReconciliation.ts";
import { stagePlanning } from "../supabase/functions/advance-long-form-visual-world/index.ts";
import { KLING_SHEET_RENDERER_POLICY_VERSION } from "../supabase/functions/_shared/referenceRendererPolicy.js";
import { CHARACTER_SHEET_CONTRACT_VERSION, STYLE_LOCK_CONTRACT_VERSION } from "../supabase/functions/_shared/visualWorldStyle.ts";

// 2026-09-19 "style consistency lock" pass: a reusable candidate is only
// genuinely current (safe to copy verbatim) when its own qa_expectations
// provenance stamps match the CURRENT renderer/prompt/style contract — see
// isStaleCharacterSheetAsset in advance-long-form-visual-world/index.ts.
// Fixtures below stamp this explicitly so "reusable" tests exercise a truly
// current asset, distinct from the dedicated staleness test further down.
const CURRENT_SHEET_PROVENANCE = {
  rendererPolicyVersion: KLING_SHEET_RENDERER_POLICY_VERSION,
  promptContractVersion: CHARACTER_SHEET_CONTRACT_VERSION,
  styleContractVersion: STYLE_LOCK_CONTRACT_VERSION,
};

// 2026-09-19 "Visual World incremental reconciliation" pass — builds the
// execution engine explicitly named as missing in the prior forensic
// report: "generate only the missing 8, reuse the other 6." All tests here
// run fully offline — the fully-reusable case makes ZERO OpenAI calls (the
// code path is structurally skipped, not merely mocked-to-succeed), and the
// partial case intercepts global fetch to prove exactly what would have
// been sent, without ever making a real network call.

/* ---- resolveReferenceReuse: the server-side matcher (Deno twin of visualWorldCompatibility.js) ---- */
test("resolveReferenceReuse matches by preserved entity id first, even when the description text was completely reworded (real Mars v5 shape)", () => {
  const newEntities = [{ id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER" }];
  const parentEntities = [{ entityId: "e_protagonist", entityName: "on‑shift crew member / protagonist", entityCategory: "CHARACTER" }];
  const matches = resolveReferenceReuse(newEntities, parentEntities);
  assert.deepEqual(matches, [{ newEntityId: "e_protagonist", parentEntityId: "e_protagonist" }]);
});
test("resolveReferenceReuse falls back to name+category match when the id changed (real Mars shape: agricultural specialist e_ag_spec -> e_agri_specialist)", () => {
  const newEntities = [{ id: "e_agri_specialist", name: "agricultural specialist", category: "CHARACTER" }];
  const parentEntities = [{ entityId: "e_ag_spec", entityName: "agricultural specialist", entityCategory: "CHARACTER" }];
  const matches = resolveReferenceReuse(newEntities, parentEntities);
  assert.deepEqual(matches, [{ newEntityId: "e_agri_specialist", parentEntityId: "e_ag_spec" }]);
});
test("resolveReferenceReuse reports no match for a genuinely new entity", () => {
  const matches = resolveReferenceReuse([{ id: "e_operations_officer", name: "operations officer", category: "CHARACTER" }], [{ entityId: "e_protagonist", entityName: "Protagonist", entityCategory: "CHARACTER" }]);
  assert.deepEqual(matches, []);
});
test("resolveReferenceReuse reproduces the exact real Mars v4->v5 split: 6 of 14 reusable", () => {
  const newEntities = [
    { id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER" },
    { id: "e_operations_officer", name: "operations officer (habitual planner)", category: "CHARACTER" },
    { id: "e_power_officer", name: "power officer / controller", category: "CHARACTER" },
    { id: "e_agri_specialist", name: "agricultural specialist", category: "CHARACTER" },
    { id: "e_technician", name: "maintenance technician (suit & life support)", category: "CHARACTER" },
    { id: "l_habitat_common", name: "Habitat — common module / bunks / tablet wall", category: "LOCATION" },
    { id: "l_greenhouse", name: "Greenhouse / growth chamber", category: "LOCATION" },
    { id: "l_suit_lab", name: "Suit locker / maintenance bench", category: "LOCATION" },
    { id: "l_airlock_surface", name: "Airlock / exterior / rover", category: "LOCATION" },
    { id: "l_power_isru", name: "Power room / solar array / ISRU plant", category: "LOCATION" },
    { id: "o_tablet_checklist", name: "wall tablet — morning checklist UI", category: "IMPORTANT_OBJECT" },
    { id: "o_faulty_suit", name: "suit with pressure-regulation valve fault", category: "IMPORTANT_OBJECT" },
    { id: "o_greenhouse_chamber", name: "flagged greenhouse chamber / growth rack", category: "IMPORTANT_OBJECT" },
    { id: "o_battery_rack", name: "battery bank / power controller console", category: "VEHICLE_MACHINE" },
  ];
  const parentEntities = [
    { entityId: "e_protagonist", entityName: "on‑shift crew member / protagonist", entityCategory: "CHARACTER" },
    { entityId: "e_ag_spec", entityName: "agricultural specialist", entityCategory: "CHARACTER" },
    { entityId: "e_power_officer", entityName: "power officer / controller", entityCategory: "CHARACTER" },
    { entityId: "e_technician", entityName: "suit/maintenance technician", entityCategory: "CHARACTER" },
    { entityId: "l_habitat_module", entityName: "habitat living module (with porthole and tablet UI)", entityCategory: "LOCATION" },
    { entityId: "l_greenhouse", entityName: "greenhouse / growth chamber (rack + chamber)", entityCategory: "LOCATION" },
    { entityId: "l_airlock_lockers", entityName: "airlock / suit locker bay", entityCategory: "LOCATION" },
    { entityId: "l_ops_center", entityName: "operations/power control console", entityCategory: "LOCATION" },
    { entityId: "l_isru_plant", entityName: "ISRU / MOXIE-style plant and solar array field", entityCategory: "LOCATION" },
    { entityId: "o_tablet", entityName: "wall tablet checklist UI (icons: O2/H2O/power)", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_suit", entityName: "extravehicular suit (locker)", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_greenhouse_chamber", entityName: "flagged greenhouse chamber / tray block", entityCategory: "IMPORTANT_OBJECT" },
    { entityId: "o_battery_array", entityName: "battery bank / solar array field", entityCategory: "VEHICLE_MACHINE" },
    { entityId: "o_isru_unit", entityName: "ISRU unit (startup/standby visible panel)", entityCategory: "VEHICLE_MACHINE" },
  ];
  const matches = resolveReferenceReuse(newEntities, parentEntities);
  assert.equal(matches.length, 6, "protagonist, technician, power officer, agricultural specialist, greenhouse, greenhouse chamber");
});

/* ---- stagePlanning: fully-reusable reconciliation makes ZERO provider calls ---- */
function fakeAdmin({ selects = {}, onInsert, onUpdate } = {}) {
  let fetchCallCount = 0;
  const builder = (table, verb, extra) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      insert: (rows) => { onInsert?.(table, rows); return Promise.resolve({ error: null }); },
      update: (patch) => { onUpdate?.(table, patch); return chain; },
      maybeSingle: async () => ({ data: selects[table] ?? null, error: null }),
      then: (resolve) => resolve({ data: Array.isArray(selects[table]) ? selects[table] : selects[table] ? [selects[table]] : [], error: null }),
    };
    return chain;
  };
  return { from: (table) => builder(table) };
}

test("stagePlanning makes ZERO OpenAI calls when every required entity is reusable (real fetch is never invoked, not merely mocked to succeed)", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async (...args) => { fetchCalled = true; return originalFetch(...args); };
  try {
    const inserts = [];
    const updates = [];
    const parentReferencePlan = {
      visualStyleNotes: "cold blues",
      entities: [{ entityId: "e_protagonist", entityName: "Protagonist", entityCategory: "CHARACTER", canonicalSpec: "A tall...", characterIdentitySpec: { x: 1 }, factualConstraints: [], forbiddenElements: [], requiredViews: [{ referenceType: "character_reference", angle: "character_reference_sheet" }] }],
    };
    const parentAsset = { id: "asset-1", entity_id: "e_protagonist", angle_or_view: "character_reference_sheet", reference_type: "character_reference", status: "succeeded", result_url: "https://x/protagonist.png", render_model: "kling-o3", prompt_snapshot: "...", qa_expectations: CURRENT_SHEET_PROVENANCE, qa_status: "approved", qa_result: { approved: true }, generation_latency_ms: 4200, generation_type: "provider" };
    const admin = fakeAdmin({
      selects: {
        long_form_visual_world_versions: { reference_plan: parentReferencePlan },
        long_form_reference_assets: parentAsset,
        long_form_script_versions: { research_version_id: null },
      },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: (table, patch) => updates.push({ table, patch }),
    });
    const row = { id: "new-world-id", parent_visual_world_version_id: "parent-world-id", meta: {}, excluded_views: [], script_version_id: "script-1" };
    const project = { topic: "Protagonist", visual_style_preset: null };
    const visualPlan = {
      entity_registry: [{ id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true }],
      continuity_groups: [],
      storyboard_summary: {},
    };
    await stagePlanning(admin, row, project, visualPlan);
    assert.equal(fetchCalled, false, "no OpenAI call may happen when 0 entities need planning");
    const assetInsert = inserts.find((i) => i.table === "long_form_reference_assets");
    assert.ok(assetInsert, "reused asset rows must still be inserted (copied)");
    assert.equal(assetInsert.rows.length, 1);
    const protagonistRow = assetInsert.rows.find((r) => r.entity_id === "e_protagonist");
    assert.equal(protagonistRow.status, "succeeded");
    // 2026-09-19 production incident fix: generation_type must be PRESERVED
    // from the source asset (what kind of pixel source actually produced
    // it — "provider" here), never overwritten with an invented "reuse"
    // label — see the real Mars incident this closes below.
    assert.equal(protagonistRow.generation_type, "provider");
    assert.equal(protagonistRow.source_reference_asset_id, "asset-1");
    assert.equal(protagonistRow.cost_usd, 0);
    const worldUpdate = updates.find((u) => u.table === "long_form_visual_world_versions");
    assert.equal(worldUpdate.patch.reused_asset_count, 1);
    assert.equal(worldUpdate.patch.new_asset_count, 0);
    assert.equal(worldUpdate.patch.stage, "finalizing", "a fully reusable world needs no provider work");
    assert.equal(worldUpdate.patch.reference_plan.styleAnchorPolicy, "structured_style_bible_only");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stagePlanning scopes the OpenAI call to ONLY the missing entities and includes the reused cast as read-only differentiation context", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    capturedBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ visualStyleNotes: "cold blues", entities: [{ entityId: "e_new_officer", canonicalSpec: "A stern figure...", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }] }) }) };
  };
  try {
    const inserts = [];
    const updates = [];
    const parentReferencePlan = {
      entities: [{ entityId: "e_protagonist", entityName: "Protagonist", entityCategory: "CHARACTER", canonicalSpec: "A tall figure...", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }],
    };
    const admin = fakeAdmin({
      selects: {
        long_form_visual_world_versions: { reference_plan: parentReferencePlan },
        long_form_reference_assets: { id: "asset-1", entity_id: "e_protagonist", angle_or_view: "character_reference_sheet", reference_type: "character_reference", status: "succeeded", result_url: "https://x/protagonist.png", qa_expectations: CURRENT_SHEET_PROVENANCE },
        long_form_script_versions: { research_version_id: null },
      },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: (table, patch) => updates.push({ table, patch }),
    });
    const row = { id: "new-world-id", parent_visual_world_version_id: "parent-world-id", meta: {}, excluded_views: [], script_version_id: "script-1" };
    const project = { topic: "Protagonist and operations officer", visual_style_preset: null };
    const visualPlan = {
      entity_registry: [
        { id: "e_protagonist", name: "Protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true },
        { id: "e_new_officer", name: "operations officer", category: "CHARACTER", importance: "RECURRING", referenceNeeded: true },
      ],
      continuity_groups: [],
      storyboard_summary: {},
    };
    await stagePlanning(admin, row, project, visualPlan);

    // The schema's own entity id enum must be scoped to ONLY the missing entity.
    const schema = capturedBody.text.format.schema;
    assert.deepEqual(schema.properties.entities.items.properties.entityId.enum, ["e_new_officer"]);
    // The input prompt must list the missing entity as needing a reference...
    assert.match(capturedBody.input, /operations officer/);
    // ...and must ALSO surface the reused protagonist as read-only cast context, never asked to redescribe it.
    assert.match(capturedBody.input, /ALREADY-ESTABLISHED CAST/);
    assert.match(capturedBody.input, /Protagonist/);
    assert.match(capturedBody.input, /A tall figure/);

    const assetInsert = inserts.find((i) => i.table === "long_form_reference_assets").rows;
    const reused = assetInsert.filter((r) => r.status === "succeeded");
    const pending = assetInsert.filter((r) => r.status === "pending");
    assert.equal(reused.length, 1);
    assert.equal(reused[0].entity_id, "e_protagonist");
    assert.equal(pending.length, 1);
    assert.ok(pending.some((r) => r.entity_id === "e_new_officer"));
    const worldUpdate = updates.find((u) => u.table === "long_form_visual_world_versions");
    assert.equal(worldUpdate.patch.reused_asset_count, 1);
    assert.equal(worldUpdate.patch.new_asset_count, 1);
    assert.equal(worldUpdate.patch.stage, "generating");
    // The reused entity's own plan entry must be COPIED from the parent, never re-derived.
    const reusedPlanEntity = worldUpdate.patch.reference_plan.entities.find((e) => e.entityId === "e_protagonist");
    assert.equal(reusedPlanEntity.canonicalSpec, "A tall figure...");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// 2026-09-19 "canonical asset selection / stale-reference" pass — real Mars
// incident: reusing a matched parent character-sheet row VERBATIM (including
// its render_model/prompt_snapshot) silently reintroduced a pre-migration,
// wrong-renderer/wrong-style sheet whenever the parent world predated the
// current renderer/prompt/style contract. isStaleCharacterSheetAsset closes
// this by refusing to treat a character-sheet ASSET match as reusable unless
// its OWN qa_expectations provenance stamps match the CURRENT contract
// versions. Note this is an asset-level (per-view) decision, independent of
// the entity-level identity match: the character's IDENTITY (canonicalSpec/
// characterIdentitySpec) is still safely copied from the parent plan with
// zero OpenAI calls — a stale sheet only means the IMAGE must be
// regenerated under the current renderer/contract, not that the LLM must
// re-derive who this character is.
test("stagePlanning treats a character reference sheet with NO/legacy qa_expectations provenance as stale and regenerates the IMAGE, while still reusing the entity's identity with zero OpenAI calls", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async (...args) => { fetchCalled = true; return originalFetch(...args); };
  try {
    const inserts = [];
    const updates = [];
    const parentReferencePlan = {
      entities: [{ entityId: "e_technician", entityName: "Maintenance technician", entityCategory: "CHARACTER", canonicalSpec: "A wiry figure...", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }],
    };
    const admin = fakeAdmin({
      selects: {
        long_form_visual_world_versions: { reference_plan: parentReferencePlan },
        // Legacy/pre-contract asset row: no qa_expectations provenance at
        // all (exactly the real Mars technician sheet's shape — an old
        // QA-schema-era row with no rendererPolicyVersion/promptContract
        // Version/styleContractVersion fields whatsoever).
        long_form_reference_assets: { id: "asset-tech-1", entity_id: "e_technician", angle_or_view: "character_reference_sheet", reference_type: "character_reference", status: "succeeded", result_url: "https://x/technician.png", render_model: "runware:400@4", qa_expectations: {} },
        long_form_script_versions: { research_version_id: null },
      },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: (table, patch) => updates.push({ table, patch }),
    });
    const row = { id: "new-world-id", parent_visual_world_version_id: "parent-world-id", meta: {}, excluded_views: [], script_version_id: "script-1" };
    const project = { topic: "Maintenance technician", visual_style_preset: null };
    const visualPlan = {
      entity_registry: [{ id: "e_technician", name: "maintenance technician", category: "CHARACTER", importance: "RECURRING", referenceNeeded: true }],
      continuity_groups: [],
      storyboard_summary: {},
    };
    await stagePlanning(admin, row, project, visualPlan);

    assert.equal(fetchCalled, false, "identity is safely copied from the parent plan — no OpenAI call needed just because one asset image is stale");
    const assetInsert = inserts.find((i) => i.table === "long_form_reference_assets").rows;
    assert.equal(assetInsert.length, 1);
    const techRow = assetInsert.find((r) => r.entity_id === "e_technician");
    assert.equal(techRow.status, "pending", "the stale legacy sheet's IMAGE must be regenerated, never copied verbatim");
    assert.notEqual(techRow.source_reference_asset_id, "asset-tech-1");
    const worldUpdate = updates.find((u) => u.table === "long_form_visual_world_versions");
    assert.equal(worldUpdate.patch.reused_asset_count, 0, "the ASSET was not reused, even though the entity's identity was");
    assert.equal(worldUpdate.patch.new_asset_count, 1);
    // The entity's identity itself still came from the parent plan, not a fresh LLM guess.
    const techPlanEntity = worldUpdate.patch.reference_plan.entities.find((e) => e.entityId === "e_technician");
    assert.equal(techPlanEntity.canonicalSpec, "A wiry figure...");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a fresh build / plain regenerate (no parent_visual_world_version_id) is completely unaffected — plans every entity exactly as before", async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody = null;
  globalThis.fetch = async (url, init) => {
    capturedBody = JSON.parse(init.body);
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ visualStyleNotes: "", entities: [{ entityId: "e_protagonist", canonicalSpec: "spec", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }] }) }) };
  };
  try {
    const inserts = [];
    const updates = [];
    const admin = fakeAdmin({
      selects: { long_form_script_versions: { research_version_id: null } },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: (table, patch) => updates.push({ table, patch }),
    });
    const row = { id: "new-world-id", parent_visual_world_version_id: null, meta: {}, excluded_views: [], script_version_id: "script-1" };
    const project = { topic: "Protagonist", visual_style_preset: null };
    const visualPlan = { entity_registry: [{ id: "e_protagonist", name: "Protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true }], continuity_groups: [], storyboard_summary: {} };
    await stagePlanning(admin, row, project, visualPlan);
    assert.deepEqual(capturedBody.text.format.schema.properties.entities.items.properties.entityId.enum, ["e_protagonist"]);
    assert.doesNotMatch(capturedBody.input, /ALREADY-ESTABLISHED CAST/);
    const assetInsert = inserts.find((i) => i.table === "long_form_reference_assets").rows;
    assert.equal(assetInsert.every((r) => r.status === "pending"), true);
    const worldUpdate = updates.find((u) => u.table === "long_form_visual_world_versions");
    assert.equal(worldUpdate.patch.reused_asset_count, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ---- 2026-09-19 PRODUCTION INCIDENT regression — real Mars world d64cce75 ----
 * Exact failure: "Could not create reference asset rows: null value in
 * column \"generation_type\" of relation \"long_form_reference_assets\"
 * violates not-null constraint" — 0 asset rows persisted, world stuck at
 * status=planning/stage=planning forever (see items 1/2/9 of the incident
 * report). Root cause: copiedAssetRows explicitly set generation_type
 * (originally to an invented "world_reused" value) while pendingAssetRows
 * never set it at all; combining both shapes into ONE bulk .insert(assetRows)
 * call makes PostgREST build a single INSERT whose column list is the union
 * of every row's own keys — any row missing a key a SIBLING row supplies
 * gets an explicit SQL NULL for it, bypassing generation_type's own
 * `default 'provider'` and failing the whole batch atomically. Fixed by
 * making EVERY row in both shapes set generation_type explicitly.
 */
test("PRODUCTION INCIDENT: reused rows AND newly-planned rows in the SAME batch both carry a non-null generation_type — the exact mixed-array-null-default class that took Mars's real reconciliation to 0 asset rows", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    return { ok: true, json: async () => ({ output_text: JSON.stringify({ visualStyleNotes: "", entities: body.text.format.schema.properties.entities.items.properties.entityId.enum.map((id) => ({ entityId: id, canonicalSpec: "spec", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] })) }) }) };
  };
  try {
    const inserts = [];
    const parentReferencePlan = { entities: [{ entityId: "e_protagonist", entityName: "Protagonist", entityCategory: "CHARACTER", canonicalSpec: "spec", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }] };
    const admin = fakeAdmin({
      selects: {
        long_form_visual_world_versions: { reference_plan: parentReferencePlan },
        long_form_reference_assets: { id: "asset-1", entity_id: "e_protagonist", angle_or_view: "character_reference_sheet", reference_type: "character_reference", status: "succeeded", result_url: "https://x/p.png", generation_type: "provider" },
        long_form_script_versions: { research_version_id: null },
      },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: () => {},
    });
    const row = { id: "d64cce75", parent_visual_world_version_id: "973ec40c", meta: {}, excluded_views: [], script_version_id: "script-1" };
    const project = { topic: "Mars", visual_style_preset: null };
    const visualPlan = {
      entity_registry: [
        { id: "e_protagonist", name: "habitat crew member / protagonist", category: "CHARACTER", importance: "HERO", referenceNeeded: true },
        { id: "e_operations_officer", name: "operations officer", category: "CHARACTER", importance: "RECURRING", referenceNeeded: true },
        { id: "l_habitat_common", name: "Habitat common module", category: "LOCATION", importance: "HERO", referenceNeeded: true },
      ],
      continuity_groups: [],
      storyboard_summary: {},
    };
    await stagePlanning(admin, row, project, visualPlan);
    const rows = inserts.find((i) => i.table === "long_form_reference_assets").rows;
    assert.equal(rows.length, 3, "1 reused + 2 newly-planned");
    for (const r of rows) {
      assert.notEqual(r.generation_type, null, `row for entity ${r.entity_id} must never have a null generation_type`);
      assert.notEqual(r.generation_type, undefined, `row for entity ${r.entity_id} must explicitly set generation_type, never rely on an omitted-key default inside a mixed-shape batch`);
    }
    // Every NOT NULL column without a table default that this constructor
    // touches must be present on every row it produces (item 2's full audit).
    for (const r of rows) {
      for (const col of ["visual_world_version_id", "entity_id", "reference_type", "angle_or_view", "status", "generation_type"]) {
        assert.notEqual(r[col], undefined, `row is missing required column ${col}`);
        assert.notEqual(r[col], null, `row has an explicit null for required column ${col}`);
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PRODUCTION INCIDENT: a reused row preserves a NON-default source generation_type (deterministic_crop) rather than overwriting it — canonicalReference()'s own generation_type-sensitive gating depends on the real value surviving reuse", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("must not be called — fully reusable case"); };
  try {
    const inserts = [];
    const parentReferencePlan = { entities: [{ entityId: "o_suit", entityName: "Suit", entityCategory: "IMPORTANT_OBJECT", canonicalSpec: "spec", characterIdentitySpec: null, factualConstraints: [], forbiddenElements: [] }] };
    const admin = fakeAdmin({
      selects: {
        long_form_visual_world_versions: { reference_plan: parentReferencePlan },
        long_form_reference_assets: { id: "asset-crop-1", entity_id: "o_suit", angle_or_view: "three_quarter_hero", reference_type: "object_reference", status: "succeeded", result_url: "https://x/suit.png", generation_type: "deterministic_crop", qa_expectations: { reviewStatus: "approved" } },
        long_form_script_versions: { research_version_id: null },
      },
      onInsert: (table, rows) => inserts.push({ table, rows }),
      onUpdate: () => {},
    });
    const row = { id: "new-world", parent_visual_world_version_id: "parent-world", meta: {}, excluded_views: [], script_version_id: "script-1" };
    const visualPlan = { entity_registry: [{ id: "o_suit", name: "Suit", category: "IMPORTANT_OBJECT", importance: "RECURRING", referenceNeeded: true }], continuity_groups: [], storyboard_summary: {} };
    await stagePlanning(admin, row, { topic: "Suit", visual_style_preset: null }, visualPlan);
    const rows = inserts.find((i) => i.table === "long_form_reference_assets").rows;
    assert.equal(rows[0].generation_type, "deterministic_crop");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PRODUCTION INCIDENT: same reconciliation_idempotency_key returns the SAME version, never a v3, even after a planning-stage failure (source-pattern check on the fix)", () => {
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930360000_long_form_visual_world_planning_recovery.sql", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("create or replace function public.start_visual_world_reconciliation"));
  assert.match(fn, /select \* into v from public\.long_form_visual_world_versions where reconciliation_idempotency_key = idem_key for update;/);
  assert.match(fn, /if found then/);
  // A failed row is RESET in place (same id), never superseded by a new insert.
  const resetBlock = fn.slice(fn.indexOf("if v.status = 'failed' then"), fn.indexOf("return v;\n  end if;"));
  assert.match(resetBlock, /where id = v\.id/);
  assert.doesNotMatch(fn.slice(0, fn.indexOf("insert into public.long_form_visual_world_versions")), /insert into/);
});

test("PRODUCTION INCIDENT: the recovery cron now reaches the 'planning' stage — this is what let d64cce75 sit stuck at stage_attempt=1 for over a day with an expired lock, since it was never once reclaimed", () => {
  const src = fs.readFileSync(new URL("../supabase/migrations/20260930360000_long_form_visual_world_planning_recovery.sql", import.meta.url), "utf8");
  assert.match(src, /stage in \('planning','generating','finalizing'\)/);
});

test("PRODUCTION INCIDENT: the edge function's own recovery-only STAGE gate also accepts the 'planning' stage (a second, independent gate that had the identical exclusion)", () => {
  const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-world/index.ts", import.meta.url), "utf8");
  assert.match(src, /!\["planning", "generating", "finalizing"\]\.includes\(target\.stage\)/);
});
test("PRODUCTION INCIDENT: a THIRD, independent gate — the planning-stage switch case itself — no longer refuses to run stagePlanning for a recovery-secret call; confirmed live against Mars (d64cce75's stage_attempt advanced 1 -> 2 only after this exact throw's error, 'Reference planning is not configured', was hit and fixed)", () => {
  const src = fs.readFileSync(new URL("../supabase/functions/advance-long-form-visual-world/index.ts", import.meta.url), "utf8");
  const planningCase = src.slice(src.indexOf('case "planning":'), src.indexOf('case "generating":'));
  assert.doesNotMatch(planningCase, /recoveryOnly \|\|/, "recoveryOnly must no longer block stagePlanning — only a genuinely unconfigured OPENAI_KEY should");
  assert.match(planningCase, /if \(!OPENAI_KEY\) throw new Error\("Reference planning is not configured"\);/);
});

/* ---- SQL migration source-pattern tests (matches this codebase's own convention) ---- */
const migrationSrc = fs.readFileSync(new URL("../supabase/migrations/20260930350000_long_form_visual_world_reconciliation.sql", import.meta.url), "utf8");

test("start_visual_world_reconciliation is idempotent via a unique reconciliation_idempotency_key scoped to (project, current plan, parent world)", () => {
  assert.match(migrationSrc, /idem_key := p_project_id::text \|\| ':vw_reconcile:' \|\| plan\.id::text \|\| ':' \|\| parent_world\.id::text/);
  assert.match(migrationSrc, /create unique index if not exists long_form_visual_world_versions_reconciliation_idem_key/);
});
test("start_visual_world_reconciliation never touches current_visual_world_version_id — the old world stays current until the new one is genuinely ready", () => {
  const fn = migrationSrc.slice(migrationSrc.indexOf("create or replace function public.start_visual_world_reconciliation"));
  assert.doesNotMatch(fn, /update public\.long_form_projects/);
});
test("the ACTIVE definition (20260930360000's create-or-replace, which wins over the original) also never touches current_visual_world_version_id or current_visual_plan_version_id, including in its own failed-row reset branch", () => {
  const recoverySrc = fs.readFileSync(new URL("../supabase/migrations/20260930360000_long_form_visual_world_planning_recovery.sql", import.meta.url), "utf8");
  const fn = recoverySrc.slice(recoverySrc.indexOf("create or replace function public.start_visual_world_reconciliation"));
  assert.doesNotMatch(fn, /update public\.long_form_projects/);
});
test("start_visual_world_reconciliation is granted to service_role only (it must dispatch the async worker with service credentials, never callable directly from the browser)", () => {
  assert.match(migrationSrc, /grant execute on function public\.start_visual_world_reconciliation\(uuid, uuid\) to service_role/);
});
test("provenance columns exist for a reused reference asset: source_visual_world_version_id, source_reference_asset_id, reuse_reason", () => {
  assert.match(migrationSrc, /add column if not exists source_visual_world_version_id/);
  assert.match(migrationSrc, /add column if not exists source_reference_asset_id/);
  assert.match(migrationSrc, /add column if not exists reuse_reason/);
});
