// deno-lint-ignore-file no-explicit-any
// episodeQA.ts — 2026-09-18 "production visual reliability v2" pass,
// Section 22: a zero/low-cost EPISODE-LEVEL pass that runs after per-shot
// QA, looking for patterns no single shot's own QA can see. Real product
// value this targets directly: "far more useful than finding each
// duplicate manually after the user opens the page" — the Generate
// Workspace UI (Section 24) surfaces these as a compact banner rather than
// making the user notice a 28-second stagnant run on their own.
//
// Pure, deterministic, offline — takes whatever compiled scene/beat records
// the caller already has (no DB/provider calls of its own), so it runs
// identically whether called from the real worker after a batch compiles
// or from an offline dry-run script against already-fetched Mars data.

export type EpisodeQaSceneInput = {
  id: string;
  sequenceIndex: number;
  renderStrategy: string;
  baseSetupKey: string | null;
  resultUrl?: string | null;
  status: string;
  startSeconds?: number | null;
  endSeconds?: number | null;
  locationId?: string | null;
  graphicTemplate?: string | null; // for PROGRAMMATIC_GRAPHIC scenes — e.g. "TEXT_EMPHASIS"
  sourceSceneId?: string | null; // for EDIT/CROP/REUSE — what it derives from
  // 2026-09-22 "FINAL stabilization pass" §5 — the compiled scene's own
  // focal subject (composition.focalSubject), independent of baseSetupKey.
  // Real Atlantis finding: 7 consecutive shots each independently
  // GENERATEd under a DIFFERENT baseSetupKey (the freshness engine already
  // forced fresh compositions) still all resolved focalSubject="Pillars of
  // Heracles" despite covering materially different narration moments —
  // seven variations of two towers, invisible to the baseSetupKey-based
  // REPEATED_SETUP_RUN check below since every baseSetupKey WAS distinct.
  focalSubject?: string | null;
  // Analogous to visualPlanFocalSubjectRepair.ts's own beat.visualType —
  // the compiled scene_type (STORY_SCENE/DIAGRAM/ENVIRONMENT_ESTABLISHER/
  // etc, sceneRenderPlan.ts's deriveSceneType). Kept as a SEPARATE field
  // from renderStrategy: two shots can share a render strategy (both
  // GENERATE) while genuinely differing in scene type.
  sceneType?: string | null;
};

export type EpisodeWarning = {
  code: string;
  severity: "INFO" | "WARNING";
  message: string;
  affectedSceneIds: string[];
  affectedSequenceRange: [number, number];
};

const REPEATED_SETUP_THRESHOLD = 5; // shots (matches the sequence-freshness engine's own long-run window)
// §5: deliberately LOWER than REPEATED_SETUP_THRESHOLD — this catches a
// DIFFERENT, subtler pattern (same visual CONCEPT chosen repeatedly even
// though each shot was independently, freshly generated under its own
// distinct baseSetupKey), which the real Atlantis case showed can run
// longer than a literal shared-setup run before anyone notices.
const FOCAL_SUBJECT_REPETITION_THRESHOLD = 4;
const EDIT_CHAIN_THRESHOLD = 3; // consecutive/total EDITs off one base before flagging (freshness engine already forces a break at 2; this is the episode-level double-check, e.g. across a re-compiled plan that skipped it)
const GRAPHIC_CLUSTER_WINDOW = 4;
const GRAPHIC_CLUSTER_THRESHOLD = 3; // 3+ graphics within a 4-shot window

export function runEpisodeQA(scenes: EpisodeQaSceneInput[]): EpisodeWarning[] {
  const ordered = [...scenes].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
  const warnings: EpisodeWarning[] = [];

  // 1) Exact duplicates — two INDEPENDENT scenes (not one REUSE-derived from
  // the other) sharing the identical resultUrl. A real dispatch/
  // reconciliation bug, not a style note.
  const byUrl = new Map<string, EpisodeQaSceneInput[]>();
  for (const s of ordered) {
    if (!s.resultUrl || s.renderStrategy === "REUSE") continue;
    const group = byUrl.get(s.resultUrl) ?? [];
    group.push(s);
    byUrl.set(s.resultUrl, group);
  }
  for (const [, group] of byUrl) {
    if (group.length > 1) {
      warnings.push({
        code: "EXACT_DUPLICATE_OUTPUT", severity: "WARNING",
        message: `Shots ${group.map((s) => s.sequenceIndex).join(", ")} produced byte-identical output despite being independently generated.`,
        affectedSceneIds: group.map((s) => s.id), affectedSequenceRange: [group[0].sequenceIndex, group[group.length - 1].sequenceIndex],
      });
    }
  }

  // 2) Repeated/stagnant setup runs — the same baseSetupKey persisting for
  // REPEATED_SETUP_THRESHOLD+ consecutive shots, reported ONCE per run
  // (not once per overlapping window) with real timing coverage, matching
  // the brief's own example message shape.
  let runStart = 0;
  for (let i = 1; i <= ordered.length; i++) {
    const sameAsRunStart = i < ordered.length && ordered[i].baseSetupKey && ordered[i].baseSetupKey === ordered[runStart].baseSetupKey;
    if (!sameAsRunStart) {
      const runLength = i - runStart;
      if (runLength >= REPEATED_SETUP_THRESHOLD && ordered[runStart].baseSetupKey) {
        const run = ordered.slice(runStart, i);
        const seconds = (run[run.length - 1].endSeconds ?? 0) - (run[0].startSeconds ?? 0);
        warnings.push({
          code: "REPEATED_SETUP_RUN", severity: "WARNING",
          message: `Shots ${run[0].sequenceIndex}–${run[run.length - 1].sequenceIndex} reuse the same visual setup for ${seconds ? Math.round(seconds) + "s" : `${runLength} shots`}.`,
          affectedSceneIds: run.map((s) => s.id), affectedSequenceRange: [run[0].sequenceIndex, run[run.length - 1].sequenceIndex],
        });
      }
      runStart = i;
    }
  }

  // 2b) §5 sequence-level repetition guard — a run of FOCAL_SUBJECT_
  // REPETITION_THRESHOLD+ consecutive shots collapsing to the SAME visual
  // concept (composition.focalSubject), independent of baseSetupKey (each
  // may have been freshly, independently generated). Distinct from #2
  // above: that catches literal shared-setup reuse; this catches "visually
  // different renders that are all still, conceptually, the same shot."
  // Never fires on an empty/unset focalSubject (nothing to compare).
  //
  // 2026-09-22 "targeted Visual Plan repair" pass — deliberately does NOT
  // treat a differing sceneType as proof of real visual variety: a claim
  // authored as a graphic/diagram can still compile down to a plain
  // GENERATE-strategy illustration whenever it doesn't fit any graphic
  // template (the compile-time PROGRAMMATIC_GRAPHIC->GENERATE fallback
  // this same pass fixed at the scene_type/render_strategy-agreement level
  // — see §7's sceneType normalization), at which point the "different
  // sceneType" promise never survives into what actually gets rendered.
  // Stays on the one signal proven to reflect what a viewer will actually
  // see: the resolved subject itself. (sceneType is still accepted on
  // EpisodeQaSceneInput for other future use — just not consulted here.)
  let subjectRunStart = 0;
  for (let i = 1; i <= ordered.length; i++) {
    const sameSubjectAsRunStart = i < ordered.length && ordered[i].focalSubject && ordered[i].focalSubject === ordered[subjectRunStart].focalSubject;
    if (!sameSubjectAsRunStart) {
      const runLength = i - subjectRunStart;
      if (runLength >= FOCAL_SUBJECT_REPETITION_THRESHOLD && ordered[subjectRunStart].focalSubject) {
        const run = ordered.slice(subjectRunStart, i);
        warnings.push({
          code: "FOCAL_SUBJECT_REPETITION", severity: "WARNING",
          message: `Shots ${run[0].sequenceIndex}–${run[run.length - 1].sequenceIndex} (${run.length} shots) all resolve to the same visual subject ("${ordered[subjectRunStart].focalSubject}") despite covering different narration — consider a more varied visual treatment (a diagram, a comparison, a different angle on the information) for at least some of these.`,
          affectedSceneIds: run.map((s) => s.id), affectedSequenceRange: [run[0].sequenceIndex, run[run.length - 1].sequenceIndex],
        });
      }
      subjectRunStart = i;
    }
  }

  // 3) Too many EDITs sharing one base (an edit-lineage star growing too
  // wide, independent of whether they're consecutive).
  const editsByBase = new Map<string, EpisodeQaSceneInput[]>();
  for (const s of ordered) {
    if (s.renderStrategy !== "EDIT" || !s.baseSetupKey) continue;
    const group = editsByBase.get(s.baseSetupKey) ?? [];
    group.push(s);
    editsByBase.set(s.baseSetupKey, group);
  }
  for (const [key, group] of editsByBase) {
    if (group.length >= EDIT_CHAIN_THRESHOLD) {
      warnings.push({
        code: "EXCESSIVE_EDIT_LINEAGE", severity: "WARNING",
        message: `${group.length} EDIT shots (${group.map((s) => s.sequenceIndex).join(", ")}) all derive from the same base setup "${key}".`,
        affectedSceneIds: group.map((s) => s.id), affectedSequenceRange: [group[0].sequenceIndex, group[group.length - 1].sequenceIndex],
      });
    }
  }

  // 4) Graphic clustering — too many PROGRAMMATIC_GRAPHIC shots crowded
  // into a short window (the viewer sees a run of cards, not a video).
  for (let i = 0; i + GRAPHIC_CLUSTER_WINDOW - 1 < ordered.length; i++) {
    const window = ordered.slice(i, i + GRAPHIC_CLUSTER_WINDOW);
    const graphicCount = window.filter((s) => s.renderStrategy === "PROGRAMMATIC_GRAPHIC").length;
    if (graphicCount >= GRAPHIC_CLUSTER_THRESHOLD) {
      warnings.push({
        code: "GRAPHIC_CLUSTERING", severity: "WARNING",
        message: `Shots ${window[0].sequenceIndex}–${window[window.length - 1].sequenceIndex} contain ${graphicCount} programmatic graphics in a row — the video reads as a slideshow here.`,
        affectedSceneIds: window.filter((s) => s.renderStrategy === "PROGRAMMATIC_GRAPHIC").map((s) => s.id), affectedSequenceRange: [window[0].sequenceIndex, window[window.length - 1].sequenceIndex],
      });
      i += GRAPHIC_CLUSTER_WINDOW - 1; // don't re-report overlapping windows of the same cluster
    }
  }

  // 5) Text-emphasis clustering (Section 15's anti-clustering rule: no
  // ADJACENT TEXT_EMPHASIS cards by default).
  for (let i = 0; i + 1 < ordered.length; i++) {
    if (ordered[i].graphicTemplate === "TEXT_EMPHASIS" && ordered[i + 1].graphicTemplate === "TEXT_EMPHASIS") {
      warnings.push({
        code: "ADJACENT_TEXT_EMPHASIS", severity: "WARNING",
        message: `Shots ${ordered[i].sequenceIndex} and ${ordered[i + 1].sequenceIndex} are both plain text-emphasis cards back to back.`,
        affectedSceneIds: [ordered[i].id, ordered[i + 1].id], affectedSequenceRange: [ordered[i].sequenceIndex, ordered[i + 1].sequenceIndex],
      });
    }
  }

  // 6) Missing frames — a failed scene with no successful scene at all for
  // that beat (never resolved by a retry/replacement).
  const missing = ordered.filter((s) => s.status === "failed");
  if (missing.length) {
    warnings.push({
      code: "MISSING_FRAMES", severity: "WARNING",
      message: `${missing.length} shot(s) (${missing.map((s) => s.sequenceIndex).join(", ")}) have no successful output at all.`,
      affectedSceneIds: missing.map((s) => s.id), affectedSequenceRange: [missing[0].sequenceIndex, missing[missing.length - 1].sequenceIndex],
    });
  }

  return warnings;
}
