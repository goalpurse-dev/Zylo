// Deterministic, zero-cost reconciliation between an OLD (already-rendered)
// VisualPlan's scenes and a freshly re-planned NEW VisualPlan's beats — the
// exact logic used to migrate Mars from the v1 planner to the v3 density/
// freshness engine without losing its 6 real paid (GENERATE/EDIT) renders,
// extracted here so it's reusable for any future replan and independently
// testable (rather than living only in a one-off migration script).
//
// Only GENERATE/EDIT scenes are worth reconciling — REUSE/CROP/
// PROGRAMMATIC_GRAPHIC cost nothing to redo under the new plan, so an
// unmatched zero-cost scene simply becomes history with no real loss.
//
// Matching signal: exact narrationSegmentIds membership + real time-range
// overlap (IoU against the shorter of the two ranges) — never a bare id
// string match, since a full replan can freely renumber shots within a
// macro. A match below MIN_CONFIDENCE is rejected outright ("never force a
// bad mapping simply to preserve an image").
export const MIN_RECONCILE_CONFIDENCE = 0.5;

function overlapSeconds(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

// oldScenes: [{ oldBeatId, segmentId, start, end, method }] — method must be
// "GENERATE" or "EDIT" (the only categories worth reconciling).
// newBeats: the new plan's visualBeats array (read-only — never mutated).
// Returns [{ oldBeatId, matchedNewBeatId, confidence }] — matchedNewBeatId
// is null when no candidate cleared MIN_RECONCILE_CONFIDENCE.
export function matchOldScenesToNewBeats(oldScenes, newBeats) {
  const results = [];
  for (const old of oldScenes) {
    const candidates = newBeats.filter((b) =>
      (b.narrationSegmentIds ?? []).includes(old.segmentId) && ["GENERATE", "EDIT"].includes(b.renderMethod)
    );
    let best = null, bestScore = 0;
    for (const c of candidates) {
      const ov = overlapSeconds(old.start, old.end, c.estimatedStartSeconds, c.estimatedEndSeconds);
      const shorter = Math.min(old.end - old.start, c.estimatedEndSeconds - c.estimatedStartSeconds);
      const score = shorter > 0 ? ov / shorter : 0;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    const confidence = Math.round(bestScore * 100) / 100;
    results.push({ oldBeatId: old.oldBeatId, matchedNewBeatId: confidence >= MIN_RECONCILE_CONFIDENCE ? best?.id ?? null : null, confidence });
  }
  return results;
}

// Mutates `newPlan` in place: renames each matched new beat to its old
// scene's beat id (so the EXISTING SceneRenderPlan/Scene rows naturally
// re-attach on next compile — no scene-table writes needed at all), while
// guaranteeing no two beats ever end up sharing an id. Two distinct
// collision sources are handled: (1) a reconciliation target coincides with
// some OTHER beat's own natural id (that unrelated beat is shifted to a
// synthetic id first — real incident on Mars: this happened for real and
// would have silently produced a duplicate-id plan without this guard);
// (2) an old scene's beat id was NOT part of the reconciliation set at all
// but still coincidentally matches a new beat's natural id (also shifted
// away, via `otherOldBeatIdsToProtect` — real incident: 7 of Mars's 13 old
// scenes coincidentally collided with new natural ids and would otherwise
// have silently misattached an unrelated old image to a new beat with
// different content).
export function applyReconciliation(newPlan, reconciliation, otherOldBeatIdsToProtect = []) {
  const allNaturalIds = new Set(newPlan.visualBeats.map((b) => b.id));
  const renameMap = new Map();
  const shiftMap = new Map();
  for (const r of reconciliation) {
    if (!r.matchedNewBeatId) continue;
    if (r.matchedNewBeatId === r.oldBeatId) { renameMap.set(r.matchedNewBeatId, r.oldBeatId); continue; }
    if (allNaturalIds.has(r.oldBeatId)) shiftMap.set(r.oldBeatId, `${r.oldBeatId}_shifted`);
    renameMap.set(r.matchedNewBeatId, r.oldBeatId);
  }
  const reconciledTargets = new Set(reconciliation.map((r) => r.oldBeatId));
  for (const protectedId of otherOldBeatIdsToProtect) {
    if (reconciledTargets.has(protectedId)) continue; // already handled above
    if (allNaturalIds.has(protectedId) && !shiftMap.has(protectedId)) shiftMap.set(protectedId, `${protectedId}_shifted`);
  }

  for (const b of newPlan.visualBeats) if (shiftMap.has(b.id)) b.id = shiftMap.get(b.id);
  for (const b of newPlan.visualBeats) if (renameMap.has(b.id)) b.id = renameMap.get(b.id);

  const idCounts = new Map();
  for (const b of newPlan.visualBeats) idCounts.set(b.id, (idCounts.get(b.id) ?? 0) + 1);
  const duplicates = [...idCounts.entries()].filter(([, c]) => c > 1).map(([id]) => id);
  if (duplicates.length) throw new Error(`RECONCILIATION_PRODUCED_DUPLICATE_IDS: ${duplicates.join(", ")}`);

  const idRewrite = new Map([...shiftMap, ...renameMap]);
  for (const seq of newPlan.visualSequences ?? []) seq.shotIds = (seq.shotIds ?? []).map((id) => idRewrite.get(id) ?? id);
  for (const p of newPlan.visualPayoffs ?? []) {
    if (idRewrite.has(p.setupBeatId)) p.setupBeatId = idRewrite.get(p.setupBeatId);
    if (p.payoffBeatId && idRewrite.has(p.payoffBeatId)) p.payoffBeatId = idRewrite.get(p.payoffBeatId);
  }
  for (const a of newPlan.productionAssets ?? []) if (idRewrite.has(a.establishingShotId)) a.establishingShotId = idRewrite.get(a.establishingShotId);
  return { renamed: [...renameMap.entries()], shifted: [...shiftMap.entries()] };
}
