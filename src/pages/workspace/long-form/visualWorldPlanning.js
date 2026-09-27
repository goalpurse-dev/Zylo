import { canonicalReference } from "../../../../supabase/functions/_shared/referenceRendererPolicy.js";
// Client-side mirror of supabase/functions/_shared/visualWorldStyle.ts's
// deriveRequiredViews — deliberately duplicated (not imported across the
// Deno/browser boundary, same convention already used for stage
// labels/copy elsewhere in this codebase) so the Visual World page can show
// the REAL planned reference list (Part 8/9) immediately from the Visual
// Plan's own entityRegistry/continuityGroups, without waiting for — or
// spending anything on — the Reference Planner's own LLM call. Keep this
// logic byte-for-byte equivalent to the server copy; if one changes, the
// other must too.

export function deriveRequiredViews(entity, continuityGroups) {
  if (!entity.referenceNeeded) return [];

  if (entity.category === "CHARACTER") {
    // One canonical character sheet (2026-09-13, major simplification):
    // every earlier taxonomy (component pack, 3-role sheet pack, the even
    // older three_quarter_neutral/face_closeup pair) is retired for CURRENT
    // generation — this mirror must stay byte-for-byte equivalent to the
    // server copy (visualWorldStyle.ts), per this file's own header
    // comment. `importance` rides on the view itself so the prompt
    // compiler/UI know HERO (6-panel) vs RECURRING (4-panel) without a
    // second lookup.
    if (entity.importance === "HERO" || entity.importance === "RECURRING") {
      return [{ referenceType: "character_reference", angle: "character_reference_sheet", purpose: "Canonical character reference sheet", importance: entity.importance }];
    }
    return [];
  }

  if (entity.category === "LOCATION") {
    const anchors = new Set();
    for (const group of continuityGroups ?? []) {
      if (group.locationId !== entity.id) continue;
      for (const anchor of group.cameraAnchors ?? []) anchors.add(anchor);
    }
    if (anchors.size === 0) return [{ referenceType: "location_reference", angle: "wide_establishing", purpose: "Primary establishing anchor" }];
    return Array.from(anchors).map((anchor) => ({ referenceType: "location_reference", angle: anchor, purpose: `Storyboard camera anchor: ${anchor}` }));
  }

  if (entity.category === "IMPORTANT_OBJECT" || entity.category === "VEHICLE_MACHINE") {
    return [{ referenceType: "object_reference", angle: "three_quarter_hero", purpose: "Primary canonical identity anchor" }];
  }

  return [];
}

// Builds the same {entityId, requiredViews}[] shape the backend will
// eventually persist into reference_plan.entities, purely for the planned-
// state UI — canonicalSpec/factualConstraints are intentionally absent
// here (that part genuinely needs the LLM), only the deterministic view
// list is shown before generation starts.
export function planReferenceViews(entityRegistry, continuityGroups) {
  return (entityRegistry ?? [])
    .filter((e) => e.referenceNeeded)
    .map((entity) => ({ entityId: entity.id, entityName: entity.name, entityCategory: entity.category, importance: entity.importance, requiredViews: deriveRequiredViews(entity, continuityGroups) }))
    .filter((e) => e.requiredViews.length > 0);
}

import { getStylePreset, parseVersionedId } from "./stylePresets.js";

// V1 shipped with exactly one hardcoded style ("Zyvo Illustrated
// Documentary") — a separate concept from the real Style Picker
// (stylePresets.js) that was never reconciled when the Picker replaced it
// conceptually on the backend (advance-long-form-visual-world's own
// reference-plan/style_spec already renders with the project's real
// preset — see getStylePresetForProject there). This resolver replaces the
// old VISUAL_WORLD_STYLES lookup so the label shown here always matches
// Look/Storyboard/Generate: prefer the version row's own pinned
// style_preset_id (set going forward by the backend at plan time) and fall
// back to the project's live visual_style_preset for a version that
// predates that column being populated — never the dead style_key/
// "Zyvo Illustrated Documentary" pair. Pure display resolution — never
// triggers or implies a regeneration.
export function resolveVisualWorldStyleLabel(project, visualWorld) {
  // style_preset_id (set going forward by the backend at plan time) is
  // stored as the bare preset id already, unlike visual_style_preset on the
  // project row, which is versioned ("bold_cartoon_documentary:v1").
  const baseId = visualWorld?.style_preset_id ?? parseVersionedId(project?.visual_style_preset).id;
  return getStylePreset(baseId).name;
}

// Never expose the raw Runware tool_key/AIR tag to the user — these labels
// are what render in the UI; `toolKey` stays internal (sent to the start
// endpoint, which re-validates it server-side against its own allowlist
// regardless of what the client sends).
export const VISUAL_WORLD_MODELS = {
  fast: { key: "fast", toolKey: "image:flux.base", label: "Fast", helper: "Fastest · Lowest cost", available: true },
  // Verified against Runware's own docs before adding (see providers.ts) —
  // both real, both selectable for this dev A/B pass. Kling/Seedream/Qwen/
  // Recraft are deliberately not here yet.
  klein9b: { key: "klein9b", toolKey: "image:flux2.klein9bkv", label: "High Quality", helper: "Higher consistency · Still low cost", available: true },
};

// Component labels — programmatic cell captions for the composed reference
// sheet (Part 4/7 of the component-pack redesign): "3/4", "Side", "Back",
// "Front" are added by the app UI, never by the image model.
export function viewLabel(angle = "") {
  return ({
    three_quarter_neutral: "3/4 view", three_quarter_hero: "3/4 view", profile: "Profile", back: "Back view", face_closeup: "Face", outfit_detail: "Outfit detail", action_pose: "Action pose",
    identity_outfit_sheet: "Identity / Outfit", face_sheet: "Face", profile_silhouette_sheet: "Profile / Silhouette",
    character_reference_sheet: "Character Reference Sheet",
    canonical_style_frame: "Style Anchor",
    canonical_diagram_style: "Diagram Style Sheet",
    identity_outfit_three_quarter: "3/4", identity_outfit_side: "Side", identity_outfit_back: "Back",
    face_front: "Front", face_side: "Side", face_back: "Back",
    silhouette_front: "Front", silhouette_side: "Side", silhouette_back: "Back",
    wide_toward_hearth: "Hearth-facing wide", reverse_from_hearth: "Reverse wide",
  })[angle] ?? angle.replace(/_/g, " ");
}
// Which logical sheet/group a component belongs to, and its cell order
// within that sheet — drives the composed 3-panel Reference Board tile.
export const COMPONENT_GROUPS = {
  identity_outfit_three_quarter: { group: "identity_outfit", order: 0 },
  identity_outfit_side: { group: "identity_outfit", order: 1 },
  identity_outfit_back: { group: "identity_outfit", order: 2 },
  face_front: { group: "face", order: 0 },
  face_side: { group: "face", order: 1 },
  face_back: { group: "face", order: 2 },
  silhouette_front: { group: "silhouette", order: 0 },
  silhouette_side: { group: "silhouette", order: 1 },
  silhouette_back: { group: "silhouette", order: 2 },
};
export const GROUP_LABELS = { identity_outfit: "Identity / Outfit", face: "Face", silhouette: "Profile / Silhouette" };
// Programmatic subtitle for each sheet role — never generated inside the
// image itself (Part 7): "Canonical identity", "Face construction",
// "Body proportions" are added by the app, outside the pixels.
export function viewSubtitle(angle = "") {
  return ({
    three_quarter_neutral: "Identity anchor", profile: "Side reference", back: "Rear reference", face_closeup: "Identity detail", outfit_detail: "Clothing/equipment", action_pose: "Alternate pose",
    identity_outfit_sheet: "Canonical identity", face_sheet: "Face construction", profile_silhouette_sheet: "Body proportions",
    character_reference_sheet: "Canonical identity, outfit, face & pose reference",
  })[angle] ?? null;
}

// Truthful status labels (Part 8 of the manual-regeneration-dispatch fix,
// extended by the qa-aware dependency fix below). The DB's own `status`
// column only has pending|running|succeeded|failed — `running` is set the
// INSTANT the claim RPC claims a row, before any Runware job is created for
// it. `job_id` (already present on every fetched asset row) is the one
// field that actually distinguishes "claimed, not yet dispatched" from "a
// real provider job exists" — never inferred from elapsed time or anything
// else. Internal engineering terms like "claim" or "lease" are never
// exposed here.
//
// Real incident this hardens against: Profile/Face read as bare "Queued"
// for 4+ minutes while their Identity Master had actually finished
// generating but failed Character Pack QA (qa_status:'rejected') — the OLD
// dependency check here only asked "has the anchor's GENERATION finished",
// never "was it actually approved", so a rejected-but-succeeded anchor
// looked exactly like "not waiting" and fell through to a generic label
// that hid the real, actionable cause. STRICT roles (profile/back/
// face_closeup) structurally require an ACCEPTED (qa-approved) master —
// mirrors the server's own accepted_reference_identity/claim-RPC gate
// (20260928120000) exactly, so the label and the real claim behavior never
// diverge again. OPTIONAL roles (outfit_detail/action_pose) only need the
// anchor's generation to be terminal (they tolerate a missing/failed/
// unapproved anchor via stageGenerating's own independent-generation
// fallback), so they keep the older, looser check.
// Component-based HERO pack (replaces the multi-view SHEET pack — Klein
// could not compose a 3-panel layout across 4 separate live attempts).
// identity_outfit_side/back, face_front/side/back all structurally require
// the Identity/Outfit anchor to already be qa-approved before dispatch
// (mirrors claim_long_form_reference_asset_for_version's own STRICT split
// exactly) — same strictness the old profile/back/face_closeup/sheet roles
// had. silhouette_front/side/back are handled separately below: they ADOPT
// a DIFFERENT specific sibling component (not necessarily the top-level
// identity), never the renderer.
const STRICT_ANCHOR_DEPENDENTS = new Set(["profile", "back", "face_closeup", "face_sheet", "profile_silhouette_sheet", "identity_outfit_side", "identity_outfit_back", "face_front", "face_side", "face_back"]);
const OPTIONAL_ANCHOR_DEPENDENTS = new Set(["outfit_detail", "action_pose"]);
// silhouette_* never dispatch to a renderer — they ADOPT (zero-cost alias)
// the already-accepted identity_outfit_* component for the SAME
// orientation. Mirrors visualWorldStyle.ts's ADOPT_SOURCE_ANGLE exactly
// (deliberate frontend/backend mirror, same convention as everything else
// in this file).
const ADOPT_SOURCE_ANGLE = { silhouette_front: "identity_outfit_three_quarter", silhouette_side: "identity_outfit_side", silhouette_back: "identity_outfit_back" };
// Mirrors the backend's QA_ELIGIBLE_ROLES/SHEET_QA_ROLES exactly — the
// brief "succeeded, qa_status still null" window these roles pass through
// before their synchronous QA checkpoint records a verdict.
const QA_ELIGIBLE_ANGLES = new Set(["three_quarter_neutral", "profile", "back", "identity_outfit_sheet", "face_sheet", "profile_silhouette_sheet", "identity_outfit_three_quarter", "identity_outfit_side", "identity_outfit_back", "face_side", "face_back", "character_reference_sheet"]);
// The old single-view 3Q anchor, the multi-view sheet, and the new
// component-based three-quarter all occupy the SAME conceptual "identity
// anchor" slot for their entity — exactly one exists per entity, depending
// on which pack taxonomy it uses.
const IDENTITY_ANCHOR_ANGLES = new Set(["three_quarter_neutral", "identity_outfit_sheet", "identity_outfit_three_quarter"]);

function currentSibling(siblingAssets, entityId, angle) {
  const rows = siblingAssets.filter((s) => s.entity_id === entityId && s.angle_or_view === angle);
  const replacedIds = new Set(rows.map((s) => s.replaces_asset_id).filter(Boolean));
  return rows.find((s) => !replacedIds.has(s.id)) ?? null;
}

// Mirrors accepted_component's SQL exactly (20260930120000): a
// qa_status:'approved' row is ALWAYS accepted regardless of a newer
// non-approved candidate sitting "current" — regenerating an accepted
// component must never blind its own dependents while the new candidate is
// still being reviewed (Part 4). A null-qa_status row is only trusted as
// "legacy approved" when NOTHING for this entity+angle has ever recorded a
// real qa_status yet. Generalizes acceptedIdentityForEntity (one fixed
// angle-set) to an arbitrary single angle, for silhouette_*'s ADOPT source.
function acceptedComponentForEntity(siblingAssets, entityId, angles) {
  const angleSet = angles instanceof Set ? angles : new Set(Array.isArray(angles) ? angles : [angles]);
  const rows = siblingAssets.filter((s) => s.entity_id === entityId && angleSet.has(s.angle_or_view) && s.status === "succeeded" && s.result_url);
  const anyQaTracked = rows.some((s) => s.qa_status != null);
  const replacedIds = new Set(siblingAssets.map((s) => s.replaces_asset_id).filter(Boolean));
  const candidates = rows.filter((s) => s.qa_status === "approved" || (s.qa_status == null && !anyQaTracked && !replacedIds.has(s.id)));
  if (!candidates.length) return null;
  return candidates.reduce((latest, s) => (!latest || s.created_at > latest.created_at ? s : latest), null);
}
function acceptedIdentityForEntity(siblingAssets, entityId) {
  return acceptedComponentForEntity(siblingAssets, entityId, IDENTITY_ANCHOR_ANGLES);
}

// Named lifecycle states (Part 2 of the reliability pass) — the frontend
// DERIVES a display label from backend-authoritative columns
// (status/qa_status/job_id/dependency state) rather than inventing its own
// interpretation; this is the ONE function every tile/modal/banner reads.
// "Planned" is a real, rare case now: self-heal in stageGenerating inserts
// a real row for every selected required view the instant the world is
// building, so an asset staying a synthesized {status:"planned"} object
// (no DB row at all) should only ever appear in the brief window before
// the very first tick after Build.
export function resolveDisplayStatus(asset, siblingAssets = []) {
  if (asset.status === "planned") return { key: "planned", label: "Planned" };
  // Character sheet pack v4 (2026-09-11): whenever the accepted Identity/
  // Outfit anchor changes, mark_derived_sheets_stale_and_requeue marks any
  // current Face/Profile-Silhouette row not derived from the NEW identity
  // as stale and queues a fresh replacement — real incident this fixes:
  // Face/Profile kept reading "Ready" while visibly showing the PREVIOUS
  // character, because nothing ever told the user their content no longer
  // matched the current identity. A stale row is truthfully never "Ready",
  // regardless of its own generation/QA status.
  if (asset.stale) return { key: "needs_update", label: "Needs update" };
  // Production Ready must mean "provider returned an ACCEPTABLE reference",
  // not merely "provider returned an image" — a generation that succeeded
  // but failed Character Pack QA (qa_status:'rejected') is never shown as
  // green "Ready"; qa_status:null covers both legacy pre-QA rows and any
  // role the QA gate doesn't cover, and is treated as approved.
  if (asset.status === "succeeded" && asset.qa_status === "rejected") return { key: "needs_review", label: "Needs review" };
  // 2026-09-19 production incident fix (Task 5 — broken/black preview tiles
  // reading "Ready"): a row can reach status:'succeeded' with no usable
  // result_url at all (an upload that silently failed after the provider
  // job itself reported success, a row hand-edited/backfilled without one,
  // etc.) — this function used to fall straight through to the generic
  // "Ready" branch below with no result_url check anywhere, so the UI
  // truthfully had nothing wrong to report even though there was nothing to
  // show. Never "Ready" without something to actually display.
  if (asset.status === "succeeded" && !asset.result_url) return { key: "broken", label: "Preview unavailable" };
  // "Checking…" only within a short window of the generation finishing —
  // QA runs synchronously in the same backend tick, so qa_status:null past
  // that window is a LEGACY row (created before the QA gate existed, and
  // will never retroactively get one) rather than something genuinely still
  // being reviewed; those must keep reading as "Ready", not stuck forever.
  if (asset.status === "succeeded" && asset.qa_status == null && QA_ELIGIBLE_ANGLES.has(asset.angle_or_view)) {
    return { key: "checking", label: "Checking…" };
  }
  if (asset.status === "succeeded") return { key: "ready", label: "Ready" };
  if (asset.status === "failed") return { key: "failed", label: "Needs another try" };
  if (["pending", "running"].includes(asset.status) && asset.job_id) {
    if (asset.provider_status === "succeeded") return { key: "checking", label: "Checking…" };
    if (["failed", "canceled"].includes(asset.provider_status)) return { key: "failed", label: "Needs another try" };
    if (asset.provider_status === "queued") return { key: "queued", label: "Queued" };
  }
  if (asset.status === "running" && asset.job_id) return { key: "generating", label: "Generating…" };
  if (asset.status === "running" && !asset.job_id) return { key: "starting", label: "Starting…" };
  // pending — never claimed yet. Real incident this hardens against:
  // Profile/Face read as bare "Queued" for 4+ minutes while their Identity
  // Master had actually finished generating but failed Character Pack QA —
  // the OLD dependency check here only asked "has the anchor's GENERATION
  // finished", never "was it actually approved", so a rejected-but-
  // succeeded anchor looked exactly like "not waiting". STRICT roles
  // structurally require an ACCEPTED (qa-approved) master — mirrors the
  // server's own accepted_reference_identity/claim-RPC gate exactly, so the
  // label and the real claim behavior never diverge again. OPTIONAL roles
  // only need the anchor's generation to be terminal (they tolerate a
  // missing/failed/unapproved anchor via stageGenerating's own independent-
  // generation fallback).
  if (asset.reference_type === "character_reference" && STRICT_ANCHOR_DEPENDENTS.has(asset.angle_or_view)) {
    if (!acceptedIdentityForEntity(siblingAssets, asset.entity_id)) return { key: "waiting_for_identity", label: "Waiting for identity" };
  }
  if (asset.reference_type === "character_reference" && ADOPT_SOURCE_ANGLE[asset.angle_or_view]) {
    if (!acceptedComponentForEntity(siblingAssets, asset.entity_id, ADOPT_SOURCE_ANGLE[asset.angle_or_view])) return { key: "waiting_for_identity", label: "Waiting for identity" };
  }
  if (asset.reference_type === "character_reference" && OPTIONAL_ANCHOR_DEPENDENTS.has(asset.angle_or_view)) {
    const anchor = [...IDENTITY_ANCHOR_ANGLES].map((a) => currentSibling(siblingAssets, asset.entity_id, a)).find(Boolean);
    if (anchor && anchor.status !== "succeeded" && anchor.status !== "failed") return { key: "waiting_for_identity", label: "Waiting for identity" };
  }
  return { key: "queued", label: "Queued" };
}

// A replacement is a separate row. History remains queryable but contributes
// neither duplicate slots nor duplicate ready counts to the current board.
export function currentReferenceAssets(assets) {
  const eligible = assets.filter(canonicalReference);
  const replaced = new Set(eligible.map((asset) => asset.replaces_asset_id).filter(Boolean));
  const groups = new Map();
  for (const asset of eligible) {
    const key = asset.angle_or_view && asset.entity_id ? `${asset.visual_world_version_id ?? ""}:${asset.entity_id}:${asset.angle_or_view}` : asset.id;
    const rows = groups.get(key) ?? [];
    rows.push(asset); groups.set(key, rows);
  }
  const newest = rows => rows.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || String(b.id).localeCompare(String(a.id)))[0];
  return [...groups.values()].map(rows => {
    const current = rows.filter(a => !replaced.has(a.id) && !a.stale);
    return newest(current.filter(a => ["pending", "running"].includes(a.status)))
      ?? newest(current)
      ?? newest(rows.filter(a => !a.stale && a.qa_status === "approved"))
      ?? newest(rows.filter(a => !replaced.has(a.id)));
  }).filter(Boolean);
}

// Part 14 of the 2026-09-13 routing/reliability fix: the ONE selector both
// "Reference Board" and "All References" must call for "which current
// canonical assets actually belong on screen" — real incident this closes:
// Reference Board already scoped itself to entity.requiredViews (via its
// own per-entity `slots()` derivation), but "All References" only filtered
// currentReferenceAssets(assets) by category/entity, with no requiredViews
// check at all — so a taxonomy change (old 3/4+Profile+Face angles, or the
// even older 9-role component pack -> the single character_reference_sheet)
// left every un-superseded old-role row still "canonical" at the DB level
// (nothing ever set replaces_asset_id on them — they're not a replacement
// chain, they're a retired role) and therefore still visible under All
// References, while Reference Board correctly hid them. Both views must
// show the SAME set: currentReferenceAssets(assets), further scoped to only
// the angle/view combinations the CURRENT reference plan actually asks for.
export function selectCurrentVisualWorldAssets(entities, assets) {
  const current = currentReferenceAssets(assets);
  if (!entities) return current;
  const requiredKeys = new Set(entities.flatMap((e) => e.requiredViews.map((v) => `${e.entityId}:${v.angle}`)));
  return current.filter((a) => requiredKeys.has(`${a.entity_id}:${a.angle_or_view}`));
}

// entities (optional, same {entityId, requiredViews:[{angle}]}[] shape
// referenceEntities/slots already use) scopes the denominator to roles that
// are ACTUALLY currently required — never omit it when it's available. Real
// incident this fixes: a taxonomy change (old 3/4+Profile+Face angles ->
// new Identity/Outfit+Face+Profile sheets) left old-taxonomy rows sitting
// "current" (canonical, nothing ever superseded them — they're just a
// different angle now) forever inflating the denominator (28 shown instead
// of the real 27 selected roles) even though no user ever selected them
// under the new pack. Without `entities`, falls back to the old
// row-only count (used by tests/older callers with no plan context).
export function referenceProgress(assets, entities = null) {
  const current = currentReferenceAssets(assets);
  const scoped = selectCurrentVisualWorldAssets(entities, assets);
  const qaOk = (a) => resolveDisplayStatus(a, current).key === "ready";
  // stale (Part 8 of the v4 identity-dependency fix): a row whose content no
  // longer matches the current accepted identity is never "ready", even if
  // its own status/qa_status still say succeeded/approved from before the
  // identity changed. In normal operation a stale row is also immediately
  // superseded (mark_derived_sheets_stale_and_requeue queues a replacement
  // in the same transaction), so `current` already excludes it via the
  // replaces_asset_id chain — this check is a defensive second layer, not
  // the primary mechanism.
  return {
    total: scoped.length,
    ready: scoped.filter((a) => a.status === "succeeded" && a.result_url && qaOk(a) && !a.stale).length,
    needsReview: scoped.filter((a) => a.status === "succeeded" && a.qa_status === "rejected" && !a.stale).length,
    failed: scoped.filter((a) => a.status === "failed").length,
    active: scoped.filter((a) => ["pending", "running"].includes(a.status)).length,
    waitingForIdentity: scoped.filter((a) => a.status === "pending" && resolveDisplayStatus(a, scoped).key === "waiting_for_identity").length,
    stale: scoped.filter((a) => a.stale).length,
  };
}

// Part 9/10 of the 2026-09-14 fix: the ONE readiness check Scene Generation
// (once built) must use — every CURRENT required reference is READY
// (auto-approved or manually approved; `progress.ready` already treats both
// identically since manual approval just sets qa_status:'approved'). A
// world with zero required references is never "ready" (nothing to gate on
// yet, not an empty win). Pulled out as its own function rather than left
// as an inline boolean in the workspace component so the gate logic has
// exactly one place to be correct and testable independent of world-status/
// busy-flag wrapping conditions (which are about ACTIVITY, not reference
// readiness).
export function isVisualWorldReadyForScenes(progress) {
  return progress.total > 0 && progress.ready === progress.total;
}

// Part 12 of the 2026-09-14 fix ("Do not destroy a good canonical while
// regenerating"): a Regenerate candidate is in flight the moment its row
// exists (pending/running) — but it must never blank out an already-
// approved reference the user is still relying on. Only the SPECIFIC
// predecessor this candidate replaces counts, and only if that predecessor
// actually succeeded — a rejected/never-finished predecessor has nothing
// worth keeping visible. Lives here (not in the workspace component) so it
// can be unit tested without importing JSX.
export function regeneratingPredecessorFor(asset, allAssets) {
  if (!["pending", "running"].includes(asset.status) || !asset.replaces_asset_id) return null;
  const predecessor = allAssets.find((a) => a.id === asset.replaces_asset_id);
  return predecessor && predecessor.status === "succeeded" && predecessor.result_url ? predecessor : null;
}

export function referenceEntities(visualPlan, visualWorld) {
  const plan = visualWorld?.reference_plan?.entities ?? planReferenceViews(visualPlan?.entity_registry, visualPlan?.continuity_groups);
  const excluded = new Set(visualWorld?.excluded_views ?? []);
  return plan.map((entity) => ({ ...entity, importance: entity.importance ?? visualPlan?.entity_registry?.find((e) => e.id === entity.entityId)?.importance, requiredViews: entity.requiredViews.filter((view) => !excluded.has(`${entity.entityId}:${view.angle}`)) })).filter((entity) => entity.requiredViews.length);
}
