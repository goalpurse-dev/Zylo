// deno-lint-ignore-file no-explicit-any
// castIdentityPolicy.ts — 2026-09-18 "production visual reliability v2"
// pass, Section 11: "do not use one protagonist reference as a substitute
// for every human." Real Mars finding this targets: 14 clear character-
// cloning cases in the forensic audit — multiple DISTINCT required roles
// (protagonist, engineer, agricultural specialist, ...) ending up rendered
// as the same face because they were never given separate canonical
// identity assets, so every scene needing "a second person" silently reused
// the protagonist's own reference.
//
// A pure, deterministic function — no DB/provider calls — so it can run
// both as a real compile-time gate (before a scene needing 2+ distinct
// HERO/RECURRING characters is allowed to dispatch) and as a read-only
// audit against a project's already-resolved reference assets (the Mars
// dry-run).

export type CastEntity = { entityId: string; name: string; category: string; importance?: string | null; referenceNeeded?: boolean };

export type SharedIdentityViolation = {
  sharedAssetId: string;
  entities: { entityId: string; name: string }[];
};

// Groups entities that INCORRECTLY share one canonical reference asset —
// two or more DISTINCT CHARACTER entities, both HERO/RECURRING importance
// (i.e., both are real, referenceNeeded roles the script actually
// distinguishes), whose canonical reference resolved to the SAME asset id.
// A LOW/background/non-referenceNeeded character sharing a generic asset
// is not a violation — Section 11 is about roles the script actually
// treats as distinct people, not every walk-on extra.
export function detectSharedIdentityAcrossDistinctRoles(
  entities: CastEntity[],
  referenceAssetIdByEntityId: Map<string, string>,
): SharedIdentityViolation[] {
  const distinctRoles = entities.filter(
    (e) => e.category === "CHARACTER" && e.referenceNeeded !== false && (e.importance === "HERO" || e.importance === "RECURRING"),
  );
  const byAsset = new Map<string, CastEntity[]>();
  for (const entity of distinctRoles) {
    const assetId = referenceAssetIdByEntityId.get(entity.entityId);
    if (!assetId) continue;
    const group = byAsset.get(assetId) ?? [];
    group.push(entity);
    byAsset.set(assetId, group);
  }
  const violations: SharedIdentityViolation[] = [];
  for (const [assetId, group] of byAsset) {
    if (group.length > 1) violations.push({ sharedAssetId: assetId, entities: group.map((e) => ({ entityId: e.entityId, name: e.name })) });
  }
  return violations;
}

// A scene-level guard: given the SPECIFIC entities a beat requires visible
// together, does resolving them produce fewer DISTINCT reference assets
// than distinct required roles? (e.g. 3 required roles resolving to only 1
// real asset — "five clones of the protagonist around a table.") This is
// the check a compile-time dispatcher runs PER BEAT, using whatever
// resolution the reference resolver already did — it never re-resolves
// anything itself.
export function sceneHasIdentityCollision(requiredEntityIds: string[], referenceAssetIdByEntityId: Map<string, string>): boolean {
  const resolvedAssetIds = requiredEntityIds.map((id) => referenceAssetIdByEntityId.get(id)).filter(Boolean) as string[];
  const uniqueAssets = new Set(resolvedAssetIds);
  // Only a collision when we actually have >=2 DIFFERENT required entities
  // that both resolved to a real asset but landed on the SAME one.
  return resolvedAssetIds.length >= 2 && uniqueAssets.size < resolvedAssetIds.length;
}
