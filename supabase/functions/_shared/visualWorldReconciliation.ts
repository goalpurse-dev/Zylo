// deno-lint-ignore-file no-explicit-any
// visualWorldReconciliation.ts — 2026-09-19 "Visual World incremental
// reconciliation" pass.
//
// The server-side twin of src/pages/workspace/long-form/
// visualWorldCompatibility.js's assessVisualWorldCompatibility — same
// deliberate cross-runtime duplication convention this codebase already
// uses for deriveRequiredViews (visualWorldStyle.ts / visualWorldPlanning.js)
// and stage labels, documented in THOSE files' own header comments. Kept
// byte-for-byte equivalent in matching LOGIC (id-first, then name+category
// fallback); if one changes, the other must too.
//
// This module answers a narrower, server-only question the frontend
// checker never needed: for each of the CURRENT plan's required entities
// that IS reusable, which EXACT entity id in the PARENT world's own
// reference_plan does it match? That id is what stagePlanning needs to look
// up the parent's already-planned canonicalSpec/characterIdentitySpec and
// its succeeded reference_asset rows to copy.

function identityKey(name: string | null | undefined, category: string | null | undefined): string {
  return `${(name ?? "").trim().toLowerCase()}::${category ?? ""}`;
}

export type ReuseMatch = { newEntityId: string; parentEntityId: string };

// `parentEntities` is the PARENT world's own reference_plan.entities
// ({entityId, entityName, entityCategory, ...}[]) — never the plan's own
// entity_registry, since a world can lag behind several plan versions and
// its reference_plan is the actual ground truth for "what does this world
// already have a plan/asset for."
export function resolveReferenceReuse(newEntities: { id: string; name: string; category: string }[], parentEntities: any[]): ReuseMatch[] {
  const parentById = new Map((parentEntities ?? []).map((e) => [e.entityId, e]));
  const parentByKey = new Map((parentEntities ?? []).map((e) => [identityKey(e.entityName, e.entityCategory), e]));
  const matches: ReuseMatch[] = [];
  for (const entity of newEntities) {
    const direct = parentById.get(entity.id);
    if (direct) { matches.push({ newEntityId: entity.id, parentEntityId: direct.entityId }); continue; }
    const byName = parentByKey.get(identityKey(entity.name, entity.category));
    if (byName) matches.push({ newEntityId: entity.id, parentEntityId: byName.entityId });
  }
  return matches;
}
