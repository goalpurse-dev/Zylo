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
    if (entity.importance === "HERO") {
      return [
        { referenceType: "character_reference", angle: "three_quarter_neutral", purpose: "Primary canonical identity anchor" },
        { referenceType: "character_reference", angle: "profile", purpose: "Side-view consistency anchor" },
        { referenceType: "character_reference", angle: "face_closeup", purpose: "Facial identity anchor for close shots" },
      ];
    }
    if (entity.importance === "RECURRING") {
      return [
        { referenceType: "character_reference", angle: "three_quarter_neutral", purpose: "Primary canonical identity anchor" },
        { referenceType: "character_reference", angle: "face_closeup", purpose: "Facial identity anchor for close shots" },
      ];
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

export const VISUAL_WORLD_STYLES = {
  zyvo_illustrated_documentary: { key: "zyvo_illustrated_documentary", label: "Zyvo Illustrated Documentary", available: true },
};

// Never expose the raw Runware tool_key/AIR tag to the user — these labels
// are what render in the UI; `toolKey` stays internal (sent to the start
// endpoint, which re-validates it server-side against its own allowlist
// regardless of what the client sends).
export const VISUAL_WORLD_MODELS = {
  fast: { key: "fast", toolKey: "image:flux.base", label: "FLUX Base", helper: "Fastest · Lowest cost", available: true },
  // Verified against Runware's own docs before adding (see providers.ts) —
  // both real, both selectable for this dev A/B pass. Kling/Seedream/Qwen/
  // Recraft are deliberately not here yet.
  klein9b: { key: "klein9b", toolKey: "image:flux2.klein9bkv", label: "FLUX.2 Klein 9B", helper: "Higher consistency · Still low cost", available: true },
};

export function viewLabel(angle = "") {
  return ({ three_quarter_neutral: "3/4 view", three_quarter_hero: "3/4 view", profile: "Profile", face_closeup: "Face", wide_toward_hearth: "Hearth-facing wide", reverse_from_hearth: "Reverse wide" })[angle] ?? angle.replace(/_/g, " ");
}

// A replacement is a separate row. History remains queryable but contributes
// neither duplicate slots nor duplicate ready counts to the current board.
export function currentReferenceAssets(assets) {
  const replaced = new Set(assets.map((asset) => asset.replaces_asset_id).filter(Boolean));
  return assets.filter((asset) => !replaced.has(asset.id));
}

export function referenceProgress(assets) {
  const current = currentReferenceAssets(assets);
  return { total: current.length, ready: current.filter((a) => a.status === "succeeded" && a.result_url).length, failed: current.filter((a) => a.status === "failed").length, active: current.filter((a) => ["pending", "running"].includes(a.status)).length };
}

export function referenceEntities(visualPlan, visualWorld) {
  const plan = visualWorld?.reference_plan?.entities ?? planReferenceViews(visualPlan?.entity_registry, visualPlan?.continuity_groups);
  const excluded = new Set(visualWorld?.excluded_views ?? []);
  return plan.map((entity) => ({ ...entity, requiredViews: entity.requiredViews.filter((view) => !excluded.has(`${entity.entityId}:${view.angle}`)) })).filter((entity) => entity.requiredViews.length);
}
