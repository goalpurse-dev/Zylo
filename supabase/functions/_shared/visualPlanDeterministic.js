// A first occurrence cannot reuse a nonexistent image. This is a structural
// normalization, not a rewrite of the director's narrative or factual content.
//
// renderMethod is always forced to GENERATE here (never left as whatever the
// beat originally had) — not a blind rewrite, but the only semantically
// correct choice: EDIT/REUSE/CROP/COMPOSITE all presuppose a prior asset to
// build from, and the entire reason this beat is being converted is that no
// such prior asset actually exists yet (the shotStrategy/renderMethod the
// director originally chose were both premised on a base setup that turns
// out not to exist — see the VISUAL_DIRECTOR_INSTRUCTIONS note that the two
// axes are independent in general, which is true, but doesn't change that a
// beat establishing a setup for the first time has nothing to EDIT/CROP/
// REUSE/COMPOSITE from). Verified against this exact plan's own prior
// correction (beat vb7: COMPOSITE -> GENERATE) succeeding validation.
export function establishFirstSetups(source) {
  const plan = structuredClone(source);
  const established = new Set();
  const changes = [];
  for (const beat of plan.visualBeats ?? []) {
    if (beat.baseSetupKey && beat.shotStrategy === "REUSE_WITH_DELTA" && !established.has(beat.baseSetupKey)) {
      changes.push({ beatId: beat.id, from: beat.shotStrategy, to: "NEW_SETUP", reason: "first_occurrence_establishes_setup", originalRenderMethod: beat.renderMethod, originalDeltaInstruction: beat.deltaInstruction });
      beat.shotStrategy = "NEW_SETUP";
      beat.renderMethod = "GENERATE";
      // The original deltaInstruction described composition/action intent
      // relative to a base setup that doesn't exist yet — this beat IS that
      // base setup now, so the intent becomes part of establishing it rather
      // than being discarded. Folded into informationToCommunicate (the one
      // field every beat has regardless of shotStrategy, and what actually
      // drives generation) rather than a new schema field.
      if (beat.deltaInstruction) beat.informationToCommunicate = `${beat.informationToCommunicate} ${beat.deltaInstruction}`.trim();
      beat.deltaInstruction = null;
    }
    if (beat.baseSetupKey) established.add(beat.baseSetupKey);
  }
  return { plan, changes };
}

// 2026-09-22 "narration coverage normalizer" (item 8 of the storyboard-
// repair architecture) — a defensive, generic safety net. Real Atlantis
// finding: one shot-level defect (a leftover/duplicate beat — id suffix
// "_r2" — claiming the EXACT SAME narration span as its neighbor) blocked
// the whole repair from ever reaching a clean state, even though it has
// nothing to do with the duplicate-visual-resolution issue this repair
// exists to fix. Rather than chase every possible cause of a coverage
// defect (this one, or a future one from a different edge case), this pass
// runs as the FINAL step before a repaired plan is validated: it detects
// any exact-duplicate or partially-overlapping narrationRange within the
// same segment and deterministically resolves it (drop an exact duplicate,
// trim a partial overlap to the earlier beat's boundary — never invent new
// narration, never touch a segment with no defect) so legacy corruption can
// never permanently block an otherwise-valid repair.
export function normalizeNarrationCoverage(source) {
  const plan = structuredClone(source);
  const beats = plan.visualBeats ?? [];
  const removedBeatIds = [];
  const trimmedBeatIds = [];
  // Only beats with EXACTLY one narrationRange participate in ordering here
  // — every beat produced by refineVisualSequences/retimeVisualBeats has
  // exactly one, and this pass only ever runs on that same shot-level shape.
  const bySegment = new Map();
  for (const beat of beats) {
    const range = beat.narrationRanges?.[0];
    if (!range) continue;
    if (!bySegment.has(range.segmentId)) bySegment.set(range.segmentId, []);
    bySegment.get(range.segmentId).push(beat);
  }
  const dropped = new Set();
  for (const [, segmentBeats] of bySegment) {
    segmentBeats.sort((a, b) => a.narrationRanges[0].startChar - b.narrationRanges[0].startChar || (a.sequenceIndex ?? 0) - (b.sequenceIndex ?? 0));
    let lastKept = null;
    for (const beat of segmentBeats) {
      const range = beat.narrationRanges[0];
      if (!lastKept) { lastKept = beat; continue; }
      const lastRange = lastKept.narrationRanges[0];
      if (range.startChar >= lastRange.endChar) { lastKept = beat; continue; }
      // Overlap with the last KEPT beat (not necessarily the previous one in
      // the sorted list, since an already-dropped beat must never anchor a
      // comparison).
      if (range.startChar === lastRange.startChar && range.endChar === lastRange.endChar) {
        // Exact duplicate span — keep the earlier-sequenced beat (the
        // canonical one), drop the later leftover/orphaned duplicate.
        dropped.add(beat.id);
        removedBeatIds.push(beat.id);
        continue;
      }
      // Partial overlap — trim this beat's start to where the kept one ends.
      const trimmedStart = lastRange.endChar;
      if (trimmedStart >= range.endChar) {
        // Trimming would leave nothing real — this beat's entire span is
        // already covered by the earlier one; drop it rather than persist a
        // zero/negative-width narration slice.
        dropped.add(beat.id);
        removedBeatIds.push(beat.id);
        continue;
      }
      range.startChar = trimmedStart;
      trimmedBeatIds.push(beat.id);
      lastKept = beat;
    }
  }
  plan.visualBeats = beats.filter((b) => !dropped.has(b.id));
  return { plan, removedBeatIds, trimmedBeatIds, changed: removedBeatIds.length > 0 || trimmedBeatIds.length > 0 };
}

// Structural coverage check used both by normalizeNarrationCoverage's own
// callers (to confirm the normalizer actually closed every defect) and by
// repair validation generally: every real narration character belongs to
// EXACTLY one beat's range, with no gaps and no overlaps.
export function narrationCoverageIssues(visualBeats, narrationSegments) {
  const issues = [];
  for (const segment of narrationSegments ?? []) {
    const spans = visualBeats.flatMap((b) => b.narrationRanges ?? []).filter((r) => r.segmentId === segment.id).sort((a, b) => a.startChar - b.startChar);
    for (let i = 0; i < segment.text.length; i += 1) {
      if (/\s/.test(segment.text[i])) continue;
      if (!spans.some((r) => r.startChar <= i && r.endChar > i)) { issues.push({ segmentId: segment.id, type: "gap", charIndex: i }); break; }
    }
    for (let i = 1; i < spans.length; i += 1) {
      if (spans[i].startChar < spans[i - 1].endChar) { issues.push({ segmentId: segment.id, type: "overlap", a: spans[i - 1], b: spans[i] }); break; }
    }
  }
  return issues;
}
