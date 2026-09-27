// Deterministic semantic-prompt quality checks. These intentionally ignore
// camera/style/render boilerplate: changing WIDE to MEDIUM is not a new idea.
const BOILERPLATE_SECTIONS = new Set([
  "SCENE", "SCENE TASK", "STYLE", "STYLE LOCK", "COMPOSITION", "REFERENCE RULES",
  "RENDER RULES", "FORBIDDEN ELEMENTS", "DO NOT", "TEXT-SAFE COMPOSITION",
]);

export function semanticPromptCore(prompt: string | null | undefined): string {
  const kept: string[] = [];
  let include = true;
  for (const raw of String(prompt ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^\[([^\]]+)\]$/.exec(line)?.[1]?.toUpperCase();
    if (heading) {
      include = !BOILERPLATE_SECTIONS.has(heading);
      continue;
    }
    if (include && line) kept.push(line);
  }
  return kept.join(" ");
}

export function normalizeSemanticPrompt(value: string | null | undefined): string {
  return semanticPromptCore(value)
    .toLowerCase()
    .replace(/\b(?:wide|medium|close|detail|close-up|eye-level|three-quarter|oblique|reverse)\b/g, " ")
    .replace(/\b(?:shot|scene|beat)\s*#?\d+\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeSemanticPrompt(value).split(" ").filter((word) => word.length > 2));
}

export function semanticPromptSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = tokenSet(String(a ?? ""));
  const right = tokenSet(String(b ?? ""));
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection += 1;
  return intersection / (left.size + right.size - intersection || 1);
}

export function shotSemanticIntent(beat: any): string {
  const shotFields = [
    beat.shotPurpose,
    beat.subject,
    beat.actionOrState,
    beat.visualDelta,
    beat.shotNarrationText,
  ].filter(Boolean);
  return (shotFields.length ? shotFields : [beat.informationToCommunicate]).filter(Boolean).join(" | ");
}

const MATERIAL_DELTA = /\b(add|remove|appear|disappear|begin|end|open|close|dark|light|warm|cool|freeze|melt|move|arrive|leave|change|transition|before|after|fail|restore|increase|decrease|reach)\w*\b/i;

// Final planning guard. New plans persist these corrections; preflight also
// runs it on a clone so a legacy plan cannot blindly submit semantic clones.
export function applyDuplicateRenderGate(beats: any[]): any[] {
  const priorGenerates: any[] = [];
  const priorGraphics: any[] = [];
  for (const beat of beats) {
    if (beat.renderMethod === "PROGRAMMATIC_GRAPHIC") {
      // 2026-09-21 "graphics are not a quota" pass: a long graphic-worthy
      // narration range can still be split into several timed sub-shots
      // (Section: progressive reveal), but compileGraphicSpec is a pure
      // function of the CLAIM alone — every sub-shot sharing one claim
      // compiles to the byte-identical card. The real Sun incident: one
      // claim (thermal-reservoir explanation) spanned 15 sub-shots, all
      // rendering the same TEXT_EMPHASIS card 15 times. Same claim id is a
      // PRECISE signal here (no fuzzy threshold needed) since it exactly
      // predicts what compileGraphicSpec will produce; the semantic-
      // similarity fallback below also catches two DIFFERENT claims that
      // happen to compile to a near-identical card. REUSE is the only
      // target — a graphic has no camera to crop and no in-place delta to
      // EDIT; if an existing card already communicates it, reuse its pixels.
      const intent = shotSemanticIntent(beat);
      // 2026-09-23 "systemic production stabilization" pass, Item B — "same
      // claim id" stopped being a precise byte-identical predictor the
      // moment compileGraphicSpec became beat-aware (graphicSpec.ts's
      // `beatFacts` parameter): several sibling beats sharing one claim now
      // legitimately compile to DIFFERENT cards when
      // assignSpanRequirements gave each its own distinct
      // shotRequiredVisualFacts (the whole point of that fix — a real
      // Atlantis finding was 5 sibling beats silently forced onto one
      // identical 3-circle diagram). Same claim id is only still a safe,
      // precise duplicate signal when both beats' assigned fact sets also
      // match (the common case — most beats sharing a claim are assigned no
      // distinct fact at all, so both sides are empty and this is
      // unchanged); a real difference must fall through to the semantic-
      // similarity check below instead of short-circuiting to REUSE.
      const duplicate = [...priorGraphics].reverse().find((candidate) => {
        if (beat.intentionalRepeatedVisual || candidate.intentionalRepeatedVisual) return false;
        if (beat.narrationClaimId && candidate.narrationClaimId && beat.narrationClaimId === candidate.narrationClaimId
          && JSON.stringify([...(beat.shotRequiredVisualFacts ?? [])].sort()) === JSON.stringify([...(candidate.shotRequiredVisualFacts ?? [])].sort())) return true;
        const sameSequence = candidate.sequenceId === beat.sequenceId;
        const nearby = Math.abs((candidate.sequenceIndex ?? 0) - (beat.sequenceIndex ?? 0)) <= 8;
        return (sameSequence || nearby) && semanticPromptSimilarity(shotSemanticIntent(candidate), intent) >= 0.9;
      });
      if (!duplicate) {
        priorGraphics.push(beat);
        continue;
      }
      // A graphic beat has no baseSetupKey by default (nothing to crop/edit
      // in place) — stamp a synthetic one shared with the original so
      // resolveSourceBeatId (sceneRenderPlan.ts) can find it as this REUSE's
      // source, exactly mirroring how a GENERATE-origin REUSE chain works.
      const sharedGraphicBase = duplicate.baseSetupKey || `graphic_${duplicate.id}`;
      duplicate.baseSetupKey = sharedGraphicBase;
      beat.baseSetupKey = sharedGraphicBase;
      beat.renderMethod = "REUSE";
      beat.shotStrategy = "REUSE_WITH_DELTA";
      beat.duplicateGate = {
        sourceBeatId: duplicate.id,
        similarity: semanticPromptSimilarity(shotSemanticIntent(duplicate), intent),
        reason: duplicate.narrationClaimId === beat.narrationClaimId ? "same underlying claim as an earlier graphic — would compile to an identical card" : "semantic intent duplicates an earlier graphic",
      };
      continue;
    }
    if (beat.renderMethod !== "GENERATE") continue;
    const intent = shotSemanticIntent(beat);
    const duplicate = [...priorGenerates].reverse().find((candidate) => {
      if (beat.intentionalRepeatedVisual || candidate.intentionalRepeatedVisual) return false;
      const exact = normalizeSemanticPrompt(shotSemanticIntent(candidate)) === normalizeSemanticPrompt(intent);
      const sameSequence = candidate.sequenceId === beat.sequenceId;
      const sameChapter = candidate.chapterId === beat.chapterId;
      const nearby = Math.abs((candidate.sequenceIndex ?? 0) - (beat.sequenceIndex ?? 0)) <= 8;
      return (exact && sameChapter) || ((sameSequence || nearby) && semanticPromptSimilarity(shotSemanticIntent(candidate), intent) >= 0.9);
    });
    if (!duplicate) {
      priorGenerates.push(beat);
      continue;
    }

    const sharedBase = duplicate.baseSetupKey || beat.baseSetupKey || `semantic_base_${duplicate.id}`;
    duplicate.baseSetupKey = sharedBase;
    beat.baseSetupKey = sharedBase;
    const delta = String(beat.deltaInstruction || beat.actionOrState || "");
    if (MATERIAL_DELTA.test(delta)) {
      beat.renderMethod = "EDIT";
      beat.shotStrategy = "REUSE_WITH_DELTA";
      beat.deltaInstruction = delta;
    } else if (beat.shotSize !== "DETAIL" && beat.shotSize !== duplicate.shotSize) {
      beat.renderMethod = "CROP";
      beat.shotStrategy = "DETAIL";
    } else {
      beat.renderMethod = "REUSE";
      beat.shotStrategy = "REUSE_WITH_DELTA";
    }
    beat.duplicateGate = {
      sourceBeatId: duplicate.id,
      similarity: semanticPromptSimilarity(shotSemanticIntent(duplicate), intent),
      reason: "semantic intent duplicates an earlier paid generation",
    };
  }
  return beats;
}

export function findGeneratePromptDuplicates(compiled: any[], threshold = 0.9) {
  const raster = compiled.filter((item) => item.renderStrategy === "GENERATE" && item.imagePrompt);
  const duplicates: { earlierBeatId: string; laterBeatId: string; similarity: number }[] = [];
  for (let i = 0; i < raster.length; i += 1) {
    for (let j = i + 1; j < raster.length; j += 1) {
      const a = raster[i], b = raster[j];
      if (a.plannedBeat?.intentionalRepeatedVisual || b.plannedBeat?.intentionalRepeatedVisual) continue;
      // Two shots from the SAME originally-planned macro beat (e.g. two
      // steps of one progressive-reveal graphic/diagram) are, by
      // construction, sequential facets of ONE already-distinct visual idea
      // — not two independent beats competing for the same narration. That
      // cross-macro collision is exactly what the macro-level "sibling"
      // fix in visualShotPlanning.js (focusFromClaim/buildShotIntent) now
      // prevents at the source; this check's job is catching genuinely
      // independent macros colliding, never second-guessing one macro's own
      // considered multi-shot treatment of itself (item 13: same setup with
      // a real progression is good continuity, not a duplicate).
      if (a.plannedBeat?.sourceMacroBeatId && a.plannedBeat.sourceMacroBeatId === b.plannedBeat?.sourceMacroBeatId) continue;
      const sameSequence = (a.plannedBeat?.sequenceId ?? null) === (b.plannedBeat?.sequenceId ?? null);
      const nearby = Math.abs((a.plannedBeat?.sequenceIndex ?? i) - (b.plannedBeat?.sequenceIndex ?? j)) <= 8;
      if (!sameSequence && !nearby) continue;
      const similarity = semanticPromptSimilarity(a.imagePrompt, b.imagePrompt);
      if (similarity >= threshold) duplicates.push({ earlierBeatId: a.beatId, laterBeatId: b.beatId, similarity });
    }
  }
  return duplicates;
}
