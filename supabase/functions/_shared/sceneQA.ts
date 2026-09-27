// deno-lint-ignore-file no-explicit-any
// Scene QA — mirrors referenceQA.ts's runCharacterReferenceSheetQA pattern
// exactly (one cheap gpt-4o-mini vision call, deterministic recompute on
// top so the model's own "approved" is never trusted blindly). Only
// GENERATE/EDIT scenes get a real vision pass — REUSE/CROP/COMPOSITE/
// PROGRAMMATIC_GRAPHIC scenes are deterministic transformations of an
// already-approved source and are auto-approved with no new provider call
// (Part 28: "minor variation should not block, major contract failure
// should" — there is no new variation at all in those paths).
//
// QA CALIBRATION (Part 14, 2026-09-15 visual-variety pass): audited against
// the real Mars 136-shot run, 96/136 scenes landed in Needs Review, and 50
// of those 96 (52%) were rejected for a text-artifact issue ALONE — mostly
// tiny device/tablet UI copy the image model was never going to render
// correctly in the first place (see Part 4/5 architecture: that text is
// meant to be replaced by a deterministic overlay, not judged against the
// provider's attempt at it). Hard-blocking on `textArtifactSeverity ===
// "major"` unconditionally was the single largest cause of the "cannot
// believably review 100 scenes an episode" complaint. The fix: a scene
// whose render plan already carries a programmatic text/device overlay
// (`hasProgrammaticTextOverlay`, threaded in by the caller from
// plan.overlay_spec / plan.device_overlay_spec) gets major text treated as
// a SOFT warning — the provider's raw text will be covered/replaced before
// the viewer ever sees it, so its content is irrelevant to final quality.
// Scenes with no such overlay planned still hard-block on major text,
// exactly as before, since in that case the gibberish is what ships.
//
// blurSeverity/duplicateSimilarity/visualDeltaSatisfied are NOT asked of
// the vision model — they're cheap deterministic pixel measurements (see
// sceneVisualAnalysis.ts) computed by the caller and merged in before
// recomputeSceneApproval runs, so they're included here as optional
// pass-through fields rather than schema properties.

import { GPT4O_MINI_INPUT_PER_M, GPT4O_MINI_OUTPUT_PER_M, QA_CALL_ESTIMATED_COST_USD } from "../../../src/lib/longFormPipelineConstants.ts";

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

export type SceneQAResult = {
  requiredCharactersPresent: boolean;
  characterIdentityConsistent: boolean;
  locationIdentityConsistent: boolean;
  actionMatchesDescription: boolean;
  framingMatchesShotSize: boolean;
  isCharacterSheetLayout: boolean;
  // Section 17 (2026-09-15 "Visual Director rebuild"): a DISTINCT, always-
  // hard-fail signal from isCharacterSheetLayout. isCharacterSheetLayout
  // catches "this whole image IS a reference sheet"; referenceLeakageDetected
  // catches the narrower, sneakier real incident this section names —
  // reference-sheet/collage material bleeding INTO an otherwise normal
  // scene (a corner of the board visible, a miniature repeated thumbnail, a
  // stray white rectangle/grid line, a second small copy of the character).
  referenceLeakageDetected: boolean;
  // 2026-09-18 "production visual reliability v2" pass, Section 9 — a
  // GENERAL one-scene-only invariant, distinct from isCharacterSheetLayout
  // (whole image IS a sheet) and referenceLeakageDetected (reference
  // material specifically bled in). This catches ANY unauthorized split
  // composition/collage/multi-panel result regardless of cause — the model
  // deciding on its own to show two vignettes, a before/after split nobody
  // asked for, storyboard panels, etc. Only ever a real defect when the
  // beat's own contract did NOT explicitly authorize it (ctx.allowMultiPanel)
  // — a genuine COMPARISON/BEFORE_AFTER beat is supposed to look like this.
  multiPanelViolation: boolean;
  // 2026-09-19 "close the character-clone root cause" pass: a DISTINCT
  // signal from characterIdentityConsistent (which only asks "is the ONE
  // referenced person still recognizable"). This asks the inverse question
  // that generic identity-consistency structurally cannot: when a beat
  // required 2+ DIFFERENT named/recurring people but the renderer could
  // only carry a real reference image for one of them (ctx.
  // multiCharacterReferenceConstrained), did the model cope with the
  // unreferenced second person by duplicating the referenced person's face
  // onto them instead of drawing a distinct individual? Only ever asked
  // (and only ever meaningful) when that context flag is set; false/unused
  // otherwise.
  castCloningDetected: boolean;
  // 2026-09-22 "FINAL stabilization pass" §2/§14 — a DISTINCT signal from
  // castCloningDetected (which asks "did the SAME face get used to fill
  // TWO DIFFERENT required roles"). Real Atlantis finding: Shot 1 required
  // exactly ONE character (Plato) but the image showed TWO physical
  // instances of him — castCloningDetected structurally cannot catch this
  // (it only ever asks about MULTIPLE distinct roles), so it correctly
  // reported false while the real defect went unclassified. Maps to
  // failureType CHARACTER_DUPLICATION, distinct from CHARACTER_CLONE.
  duplicateCharacterInstanceDetected: boolean;
  // Section 20: the semantic contract's own polarity (negative/positive
  // claims) can be visually contradicted even when everything else about
  // the scene looks fine — narration says something is UNAVAILABLE/OFF/
  // FAILS and the image shows it working. Only asked when semanticPolarity
  // context is supplied; false/unused otherwise.
  semanticPolarityViolated: boolean;
  forbiddenEntityPresent: boolean;
  textArtifactSeverity: "none" | "minor" | "major";
  styleMismatchSeverity: "none" | "minor" | "major";
  corruptionArtifacts: boolean;
  environmentIrrelevant: boolean;
  approved: boolean;
  reasons: string[];
  // Merged in post-hoc from deterministic local analysis — optional because
  // older stored qa_result rows (and REUSE/graphic auto-approvals) never
  // set them.
  blurSeverity?: "none" | "minor" | "major";
  visualDeltaSatisfied?: boolean | null;
  duplicateSimilarity?: number | null;
  // Section 4/6 (2026-09-16 "production invariants" pass): a deterministic,
  // zero-LLM-call check — is the scene's actual final rendered canvas ~16:9
  // (isValidFinalAspectRatio, sceneRenderPlan.ts)? Real Mars incident this
  // catches: shot 19 shipped as a literal 907x1536 portrait PNG. Optional
  // because it's computed by the caller from real decoded pixel dimensions,
  // never asked of (or trusted from) the vision model — undefined for any
  // stored qa_result that predates this check.
  finalFrameGeometryValid?: boolean;
  // 2026-09-17 "long-form quality pass" (Part 5) — a real policy rewrite,
  // not a relabeling: SEVERITY now has exactly three values, and REQUIRES-
  // REVIEW is tracked SEPARATELY rather than being severity's third value.
  // AUTO_READY/SOFT_WARNING are both "Ready" (approved:true) — a cosmetic
  // SOFT_WARNING never blocks delivery on its own. HARD_FAIL is the only
  // severity that blocks. requiresReview is reserved for genuine semantic
  // uncertainty the system cannot confidently resolve either way (e.g. an
  // action/framing mismatch, or QA itself being unavailable) — it is the
  // ONLY thing that routes a scene to a human, independent of severity.
  // The OLD three-value severity (AUTO_READY/NEEDS_REVIEW/HARD_FAIL, no
  // separate requiresReview) is preserved on every historical stored row —
  // this type only describes what classifySceneQA emits GOING FORWARD.
  severity?: "AUTO_READY" | "SOFT_WARNING" | "HARD_FAIL";
  requiresReview?: boolean;
  failureType?: string | null;
  repairStrategy?: string | null;
  // Phase 0, Section C.5 — real per-call cost, computed from the actual
  // OpenAI usage.prompt_tokens/completion_tokens this specific call
  // reported (falls back to a flat estimate only if the API response is
  // missing usage for some reason). Every other LLM call in this pipeline
  // already records internal_cost_usd; QA vision calls previously didn't.
  internalCostUsd?: number;
};

// Context the vision result alone can't know, always supplied by the
// caller from the compiled render plan / Narration Visual Contract, never
// invented by the model itself.
export type SceneQAContext = {
  hasProgrammaticTextOverlay?: boolean;
  // Part 4/6 of the 2026-09-17 pass: does this beat carry a
  // CRITICAL_EXACT_TEXT requirement (graphicSpec.ts's classifyTextImportance)
  // — i.e. is there a specific fact (a value/unit/date/negation label) the
  // viewer actually needs from on-screen text? Generated AI text is only
  // ever a HARD_FAIL for CARRYING (or contradicting) a fact — readable-but-
  // irrelevant text on a beat with NO critical-text requirement is real
  // (Part 4: INCIDENTAL_AI_TEXT) but a SOFT_WARNING at most, never a block.
  criticalTextRequired?: boolean;
  // Part 6: was a deterministic overlay ACTUALLY composited onto this exact
  // delivered image (long_form_scenes.overlay_applied), never merely
  // "was one planned" (plan.overlay_spec existing is not proof it shipped)
  // — a planned overlay must never excuse a real defect it didn't actually
  // fix.
  hasVerifiedOverlay?: boolean;
  // Part 11 of the 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass: this shot's
  // own shotSize, used ONLY for the "a DETAIL shot must not fail because
  // the entire character body is absent unless the shot actually requires
  // it" rule below — a tight detail insert (a cracked seal, a gauge, a
  // switch) legitimately isolates an OBJECT with no person in frame at all,
  // which is not the same defect as a STORY_SCENE that was supposed to show
  // a character and doesn't.
  shotSize?: string | null;
  // Section 21: the criticality of the MOST important required entity in
  // this scene (EXACT/HIGH/MEDIUM/LOW/NONE) — identity strictness in the
  // prompt below is calibrated to this, so a background extra at LOW
  // criticality is never held to the same bar as a hero close-up at EXACT.
  primaryEntityCriticality?: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "EXACT";
  // Section 20: plain-language polarity claims from the beat's own
  // Narration Visual Contract claim, if one exists — negativeClaims/
  // positiveClaims/forbiddenEntities, asked about explicitly so a reversed
  // polarity ("no signal" narration + a working-phone image) is a concrete,
  // checkable question rather than folded silently into "does it match the
  // description."
  negativeClaims?: string[];
  positiveClaims?: string[];
  forbiddenEntities?: string[];
  // Section 9: does THIS beat's contract explicitly authorize a multi-panel
  // result (a real COMPARISON/BEFORE_AFTER/intentional split composition)?
  // Defaults to false/unset — the one-scene invariant is the default,
  // multi-panel is the opt-in exception, never the other way around.
  allowMultiPanel?: boolean;
  // 2026-09-19 clone-root-cause pass: true when start-long-form-scene-
  // generation had to drop a second required CHARACTER's reference image
  // for renderer-slot-capacity reasons (see deriveSceneQAExpectations /
  // the droppedForCapacity handling). Triggers the targeted
  // castCloningDetected question instead of the generic one; also names
  // WHICH character(s) had no reference image, for a sharper question.
  multiCharacterReferenceConstrained?: boolean;
  unreferencedCharacterNames?: string[];
  // 2026-09-22 "FINAL stabilization pass" §14 — real Atlantis finding: a
  // scene with reference_asset_ids=[] (no reference image ever supplied to
  // the model) was still classified failureType=REFERENCE_LEAKAGE. Leakage
  // is structurally impossible when nothing was ever given to leak FROM.
  // true/undefined preserves prior behavior (every existing caller that
  // hasn't been updated to pass this); only an explicit `false` suppresses
  // the hard-fail — "REFERENCE_LEAKAGE impossible when no reference was
  // used."
  referencesSupplied?: boolean;
};

const SCENE_QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: [
    "requiredCharactersPresent", "characterIdentityConsistent", "locationIdentityConsistent", "actionMatchesDescription",
    "framingMatchesShotSize", "isCharacterSheetLayout", "referenceLeakageDetected", "multiPanelViolation", "castCloningDetected", "duplicateCharacterInstanceDetected", "semanticPolarityViolated", "forbiddenEntityPresent",
    "textArtifactSeverity", "styleMismatchSeverity", "corruptionArtifacts", "environmentIrrelevant", "approved", "reasons",
  ],
  properties: {
    requiredCharactersPresent: { type: "boolean" }, characterIdentityConsistent: { type: "boolean" }, locationIdentityConsistent: { type: "boolean" },
    actionMatchesDescription: { type: "boolean" }, framingMatchesShotSize: { type: "boolean" }, isCharacterSheetLayout: { type: "boolean" },
    referenceLeakageDetected: { type: "boolean" }, multiPanelViolation: { type: "boolean" }, castCloningDetected: { type: "boolean" }, duplicateCharacterInstanceDetected: { type: "boolean" }, semanticPolarityViolated: { type: "boolean" }, forbiddenEntityPresent: { type: "boolean" },
    textArtifactSeverity: { type: "string", enum: ["none", "minor", "major"] },
    styleMismatchSeverity: { type: "string", enum: ["none", "minor", "major"] },
    corruptionArtifacts: { type: "boolean" }, environmentIrrelevant: { type: "boolean" },
    approved: { type: "boolean" }, reasons: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};

export type SceneQAClassification = { approved: boolean; severity: "AUTO_READY" | "SOFT_WARNING" | "HARD_FAIL"; requiresReview: boolean; failureType: string | null; repairStrategy: string | null };

// 2026-09-17 "long-form quality pass" (Part 5) — a real policy REWRITE, not
// a threshold tweak on the prior 3-tier model. Two problems drove this:
// (1) "too many genuinely usable scenes become Needs Review" — the OLD
// model made NEEDS_REVIEW do double duty as both "cosmetic issue" AND
// "genuinely uncertain", so any two minor signals (or a lone framing/action
// mismatch) forced a human look even when the scene was perfectly usable.
// (2) generated AI text was hard-blocked whenever major AND no overlay was
// PLANNED — with no concept of whether that text actually carried a fact
// the viewer needed (Part 4's exact-text policy fixes this at the source).
//
// The fix: severity now has exactly three values (AUTO_READY/SOFT_WARNING/
// HARD_FAIL), and `requiresReview` is a SEPARATE boolean reserved for true
// semantic uncertainty the system cannot confidently resolve either way.
// SOFT_WARNING never blocks delivery on its own (`approved` stays true) —
// it is real information (surfaced in `reasons`/`failureType`), not review
// gatekeeping. `requiresReview` is the only thing that gates a scene behind
// a human, independent of severity, and is applied narrowly.
export function classifySceneQA(r: Omit<SceneQAResult, "approved" | "severity" | "requiresReview" | "failureType" | "repairStrategy">, ctx: SceneQAContext = {}): SceneQAClassification {
  // Part 4/6: generated text is a HARD_FAIL only when it's carrying (or
  // failing to correctly carry) a fact the viewer actually needs, AND no
  // VERIFIED (actually-composited, not merely planned) overlay covers it.
  // A beat with no critical-text requirement at all is real INCIDENTAL_AI_
  // TEXT territory — readable-but-irrelevant text there is a SOFT_WARNING
  // at most, never a block. This single change is the direct fix for the
  // real Mars finding that incidental text alone drove the majority of
  // Needs Review cases.
  const textBlocks = r.textArtifactSeverity === "major" && Boolean(ctx.criticalTextRequired) && !ctx.hasVerifiedOverlay && !ctx.hasProgrammaticTextOverlay;
  const textIncidentalMajor = r.textArtifactSeverity === "major" && !ctx.criticalTextRequired;

  const hardFail = (failureType: string, repairStrategy: string): SceneQAClassification => ({ approved: false, severity: "HARD_FAIL", requiresReview: false, failureType, repairStrategy });

  // HARD_FAIL — genuinely unusable or contract-violating results only.
  // Checked in the order a human would find most diagnostic; each is
  // independently sufficient.
  if (r.finalFrameGeometryValid === false) return hardFail("INVALID_FINAL_FRAME_GEOMETRY", "re-render/re-crop to a true 16:9 final frame");
  // §14: leakage FROM a reference cannot occur when no reference was ever
  // supplied — ctx.referencesSupplied === false is the only value that
  // suppresses this (undefined/true preserve existing behavior).
  if (r.referenceLeakageDetected && ctx.referencesSupplied !== false) return hardFail("REFERENCE_LEAKAGE", "regenerate using safer (minimal, non-collage) reference routing");
  // Section 9 of the 2026-09-18 "production visual reliability v2" pass —
  // the one-scene-only HARD invariant, general-purpose: any unauthorized
  // split/collage/multi-panel result, whether or not reference material
  // caused it. Never fires when the beat's own contract explicitly
  // authorized a multi-panel treatment (a real COMPARISON/BEFORE_AFTER).
  if (r.multiPanelViolation && !ctx.allowMultiPanel) return hardFail("UNAUTHORIZED_MULTI_PANEL", "fresh composition using safer references — a single coherent scene, not a collage");
  if (r.forbiddenEntityPresent) return hardFail("FORBIDDEN_ENTITY_PRESENT", "fresh composition using the corrected Visual Contract");
  if (r.semanticPolarityViolated) return hardFail("SEMANTIC_CONTRADICTION", "fresh composition using the corrected Visual Contract");
  // Part 11: "a DETAIL shot must not fail because the entire character body
  // is absent unless the shot actually requires it." A DETAIL insert whose
  // most important required entity isn't itself HIGH/EXACT criticality (a
  // real person the viewer must specifically recognize) is legitimately
  // allowed to isolate an object with no character in frame — that's a
  // SOFT_WARNING (worth noting, never blocking), not a hard failure. Every
  // other shotSize, and any DETAIL shot with a genuinely critical required
  // person, keeps the original strict gate.
  const detailShotExemptsMissingSubject = ctx.shotSize === "DETAIL" && ctx.primaryEntityCriticality !== "HIGH" && ctx.primaryEntityCriticality !== "EXACT";
  if (!r.requiredCharactersPresent && !detailShotExemptsMissingSubject) return hardFail("REQUIRED_SUBJECT_MISSING", "fresh composition using the corrected Visual Contract");
  if (!r.characterIdentityConsistent || !r.locationIdentityConsistent) return hardFail("IDENTITY_DRIFT", "regenerate with a stronger/higher-criticality identity reference");
  // 2026-09-19 clone-root-cause pass: checked right alongside IDENTITY_DRIFT
  // (same family of defect — the delivered pixels don't show the cast the
  // contract requires) but kept a separate failureType so the repair ladder
  // and reporting can tell "wrong/drifted face" apart from "two required
  // roles rendered as one duplicated face." Maps to repairLadder.ts's own
  // CHARACTER_CLONE entry.
  if (r.castCloningDetected) return hardFail("CHARACTER_CLONE", "regenerate with a renderer able to condition multiple distinct identities, or hold for a second canonical reference route");
  // §2/§14: the inverse defect from CHARACTER_CLONE — ONE required
  // character rendered as MULTIPLE physical instances in the same frame
  // (real Atlantis finding: "two Platos" when exactly one was required).
  if (r.duplicateCharacterInstanceDetected) return hardFail("CHARACTER_DUPLICATION", "regenerate with an explicit single-instance identity anchor and an explicit count constraint");
  if (r.isCharacterSheetLayout) return hardFail("REFERENCE_LEAKAGE", "regenerate using safer (minimal, non-collage) reference routing");
  if (r.corruptionArtifacts) return hardFail("SEVERE_CORRUPTION", "fresh composition using the corrected Visual Contract");
  if (r.styleMismatchSeverity === "major") return hardFail("STYLE_ABANDONED", "fresh composition using the corrected Visual Contract");
  if (r.blurSeverity === "major") return hardFail("SEVERE_BLUR", "regenerate — a soft/degraded EDIT should re-anchor to its canonical root");
  if (r.visualDeltaSatisfied === false) return hardFail("LOW_DIVERSITY", "fresh GENERATE using an alternate visual form");
  if (textBlocks) return hardFail("CRITICAL_TEXT", "verify/apply a deterministic overlay carrying the exact required text");
  // Part 5's own HARD_FAIL example list names this explicitly ("missing
  // essential action/object") — the vision prompt already tolerates
  // "at least approximately," so a firm false here means the model judged
  // the described action to be MEANINGFULLY absent, a real defect, not a
  // nuance to leave for a human to eyeball.
  if (!r.actionMatchesDescription) return hardFail("ACTION_OR_OBJECT_MISSING", "fresh composition using the corrected Visual Contract");

  // SOFT_WARNING — cosmetic/non-critical only. The scene remains Ready
  // (approved:true) regardless of how many of these stack — Part 5 is
  // explicit that this must never become a quota-driven second gate.
  // Framing sits here on purpose: Part 5's own SOFT_WARNING example list
  // names "slight framing difference" directly, and (unlike a missing
  // action/object) a framing miss alone never makes a scene unusable.
  const softSignals: string[] = [];
  if (!r.requiredCharactersPresent && detailShotExemptsMissingSubject) softSignals.push("DETAIL_SHOT_SUBJECT_NOT_REQUIRED");
  if (!r.framingMatchesShotSize) softSignals.push("FRAMING_VARIANCE");
  if (r.textArtifactSeverity === "minor" || textIncidentalMajor) softSignals.push(textIncidentalMajor ? "INCIDENTAL_TEXT" : "MINOR_TEXT_ARTIFACT");
  if (r.styleMismatchSeverity === "minor") softSignals.push("MINOR_STYLE_VARIANCE");
  if (r.blurSeverity === "minor") softSignals.push("MINOR_BLUR");
  if (r.environmentIrrelevant) softSignals.push("BACKGROUND_ODDITY");
  if (softSignals.length) return { approved: true, severity: "SOFT_WARNING", requiresReview: false, failureType: softSignals[0], repairStrategy: null };

  return { approved: true, severity: "AUTO_READY", requiresReview: false, failureType: null, repairStrategy: null };
}

// Thin boolean wrapper kept for every EXISTING call site (advance-long-form-
// scene-generation's EDIT-signal merge, and any caller that only ever
// needed the yes/no) — approved is always classifySceneQA(...).approved,
// so there is exactly one place the hard/soft policy actually lives.
export function recomputeSceneApproval(r: Omit<SceneQAResult, "approved">, ctx: SceneQAContext = {}): boolean {
  return classifySceneQA(r, ctx).approved;
}

export type SceneQAReferenceImage = { url: string; label: string; kind: "character_reference" | "location_reference" | "object_reference" | string };

// 2026-09-22 "FINAL stabilization pass" §1 — structured Style Bible
// dimensions the vision model is asked to compare against directly,
// instead of a single vague "how well does this match the style" question.
// Real Atlantis finding: shots that materially changed linework/shading
// model/rendering realism (a MONOCHROME ENGRAVED/CROSS-HATCHED shot among
// flat-color-cartoon siblings) were still scored styleMismatchSeverity:
// "none" — the old prompt gave the model no concrete axis to compare
// against, so a wholesale technique change had nothing to trip on. Passed
// straight from visualWorldStyle.ts's StylePreset (already the live,
// authoritative Style Bible — no new data model needed).
export type SceneQAStyleDimensions = { linework?: string; shading?: string; texture?: string; palette?: string; negativeConstraints?: string[] };

export function buildSceneQAPrompt(args: { requiredCharacterNames: string[]; locationName: string | null; shotSize: string; expectedAction: string; styleName?: string | null; styleDimensions?: SceneQAStyleDimensions | null; referenceImages?: SceneQAReferenceImage[]; hasProgrammaticTextOverlay?: boolean; qaContext?: SceneQAContext }): string {
  const refs = args.referenceImages ?? [];
  // §1: a style_reference (an already-approved episode frame supplied
  // purely as style-continuity evidence) is NOT identity/location evidence
  // — it must never be folded into the "canonical references the scene
  // MUST visually match" identity language, only referenced explicitly by
  // the styleMismatchSeverity question below.
  const identityRefs = refs.filter((r) => r.kind !== "style_reference");
  const styleRefs = refs.filter((r) => r.kind === "style_reference");
  const ctx = args.qaContext ?? {};
  const criticality = ctx.primaryEntityCriticality;
  const dims = args.styleDimensions;
  return [
    `You are a fast quality gate for a generated documentary VIDEO SCENE (not a character reference sheet). Be strict about identity/location consistency and about this NOT accidentally looking like a reference sheet, but lenient about minor artistic variance.`,
    `IMAGE 1 below is the generated scene under review.`,
    identityRefs.length
      ? `The following images are this scene's CANONICAL Visual World references — the scene MUST visually match these, not just the text description. Each is labeled with what it maps to:\n${identityRefs.map((r, i) => `IMAGE ${i + 2}: ${r.label} (${r.kind})`).join("\n")}\nActually compare IMAGE 1 against each of these — do not just check the text description.`
      : `No canonical reference images were supplied for this scene (none were required) — judge purely against the text description below.`,
    styleRefs.length
      ? `IMAGE ${identityRefs.length + 2} is an already-approved frame from elsewhere in this SAME episode, supplied ONLY as visual-STYLE continuity evidence — never compare it for character/location identity, only for whether IMAGE 1 renders in the same art style (linework, shading, palette, rendering technique) as this episode is actually shipping.`
      : "",
    args.requiredCharacterNames.length ? `This scene should show: ${args.requiredCharacterNames.join(", ")}.` : "This scene has no specific named characters required.",
    args.locationName ? `This scene should be set in: ${args.locationName}.` : "",
    `Shot size should read as: ${args.shotSize}.`,
    `The scene should depict: ${args.expectedAction}`,
    args.styleName ? `The selected project visual style is "${args.styleName}" — this scene should visibly match that style.` : "",
    "requiredCharactersPresent: are all the required characters/main subjects actually visible in the scene?",
    // Section 21: identity strictness is calibrated to how critical this
    // scene's most important entity actually is — a HERO close-up demands
    // real recognizability; a LOW-criticality background presence should
    // never be held to that same bar (a tiny irrelevant accessory/seam
    // difference on a background extra must never fail this).
    criticality === "EXACT" || criticality === "HIGH"
      ? `characterIdentityConsistent: this scene's identity criticality is ${criticality} — the viewer must clearly recognize this as the SAME specific individual as the canonical reference (face, build, outfit). Minor variance is NOT acceptable at this criticality.`
      : criticality === "LOW" || criticality === "NONE"
      ? `characterIdentityConsistent: this scene's identity criticality is ${criticality ?? "unspecified"} — a generically-similar, recognizably-the-same-kind-of-person presence is ENOUGH; do not fail this over a minor accessory/clothing-seam/background-detail difference that doesn't matter at this importance level.`
      : refs.some((r) => r.kind === "character_reference")
      ? "characterIdentityConsistent: comparing IMAGE 1 against the supplied character reference image(s) — is this VISIBLY the same recognizable person (face, build, outfit), not just a person of the same general description?"
      : "characterIdentityConsistent: do the visible characters match the described canonical identity (not a visibly different-looking person)?",
    refs.some((r) => r.kind === "location_reference")
      ? "locationIdentityConsistent: comparing IMAGE 1 against the supplied location reference image(s) — does the set/geometry/design actually match (not just a generic similar-sounding environment)?"
      : "locationIdentityConsistent: does the setting match the described location (not a generic or different-looking environment)?",
    refs.some((r) => r.kind === "object_reference") ? "Also verify any supplied object/machine reference's design is preserved (fold this into characterIdentityConsistent/locationIdentityConsistent as appropriate; there is no separate field for it)." : "",
    "actionMatchesDescription: does the scene depict the described action/content, at least approximately?",
    "framingMatchesShotSize: does the framing roughly match the requested shot size?",
    "isCharacterSheetLayout: does the ENTIRE image accidentally look like a character reference sheet / model sheet / multi-panel turnaround / reference-board grid instead of a single cinematic scene?",
    // Section 17: a DISTINCT, narrower check from isCharacterSheetLayout —
    // reference/collage material LEAKING INTO an otherwise normal scene,
    // not the whole image being a sheet. Real incident this exists for: "a
    // real final scene literally showed the character reference sheet."
    // §14: when no reference image was supplied at all, leakage FROM a
    // reference is structurally impossible — the question is skipped rather
    // than inviting the model to speculate about material it never saw.
    refs.length
      ? "referenceLeakageDetected: even if the scene otherwise looks like a normal single shot, is there any visible trace of reference-sheet/collage material — multiple small turnaround views of the same person, a miniature repeated thumbnail of the character, a stray white reference-board rectangle or grid line, a visible contact-sheet/board framing, or a second small duplicate copy of the character/object anywhere in the frame? Answer true even for a SMALL/partial trace — this is a hard failure, not a style note."
      : "referenceLeakageDetected: no reference image was supplied for this scene at all, so leakage from a reference is impossible — answer false.",
    ctx.allowMultiPanel
      ? "multiPanelViolation: this beat was explicitly authorized to show more than one panel/frame (a real comparison or before/after) — answer false unless the split is confusing/broken (e.g. more than the two authorized panels, or panels that don't relate to each other)."
      : "multiPanelViolation: regardless of cause, does this image show MORE THAN ONE distinct scene/vignette/panel — e.g. a visible dividing line splitting two different moments, storyboard-style panels, a collage of separate shots, or two unrelated compositions sharing the frame? This beat was NOT authorized to be multi-panel, so ANY such split — even one that has nothing to do with reference sheets — is a hard failure.",
    ctx.multiCharacterReferenceConstrained
      ? `castCloningDetected: this scene requires ${args.requiredCharacterNames.length >= 2 ? args.requiredCharacterNames.join(" AND ") : "more than one distinct named person"} as SEPARATE, DIFFERENT-LOOKING individuals, but the renderer could only be given a reference photo for one of them${ctx.unreferencedCharacterNames?.length ? ` (no reference photo existed for: ${ctx.unreferencedCharacterNames.join(", ")})` : ""}. Look carefully: does the image actually show DISTINCT people, or has it rendered the SAME face/person twice (or more) to fill both roles — e.g. two "different" characters who are clearly the same person, just repositioned or in different clothing? Answer true if they look like the same person duplicated into multiple roles.`
      : "castCloningDetected: this scene did not require multiple distinct referenced characters — answer false unless the image bizarrely shows the same individual duplicated into what should be different people.",
    // §2/§14: distinct from castCloningDetected (two DIFFERENT roles sharing
    // one face) — this asks whether a SINGLE required character was
    // rendered as more than one physical instance in the frame.
    args.requiredCharacterNames.length
      ? `duplicateCharacterInstanceDetected: this scene requires exactly ONE instance of each of: ${args.requiredCharacterNames.join(", ")} (unless the scene description explicitly calls for a crowd/group/multiple copies). Does the image show MORE THAN ONE physical instance of the SAME required character in the frame (e.g. two copies of the same person standing together, a duplicated figure)? Answer true even if the duplicate is partially cropped/in the background.`
      : "duplicateCharacterInstanceDetected: no specific named characters were required for this scene — answer false.",
    ctx.forbiddenEntities?.length
      ? `forbiddenEntityPresent: this scene must NOT show any of: ${ctx.forbiddenEntities.join(", ")}. Is any of them visibly present/working/succeeding in the image?`
      : "forbiddenEntityPresent: no specific forbidden entities were declared for this scene — answer false unless something in the image directly contradicts the scene description below.",
    ctx.negativeClaims?.length || ctx.positiveClaims?.length
      ? `semanticPolarityViolated: the narration for this scene asserts: ${[...(ctx.negativeClaims ?? []).map((c) => `NOT true: ${c}`), ...(ctx.positiveClaims ?? []).map((c) => `IS true: ${c}`)].join("; ")}. Does the image visually contradict any of these — e.g. showing something working/available/present when the narration says it is NOT, or vice versa?`
      : "semanticPolarityViolated: no specific polarity claims were declared for this scene — answer false unless the image obviously contradicts the described action/content below (e.g. showing the opposite of what's described).",
    args.hasProgrammaticTextOverlay
      ? "textArtifactSeverity: this scene's text/device screen will be REPLACED by a clean programmatic overlay before it ships — still rate what the image model actually rendered honestly (major if you can read real words, minor for illegible squiggles, none for no text-like marking), but do not worry about it being wrong or gibberish; that content is being discarded regardless."
      : "textArtifactSeverity: this scene must have NO generated readable text at all — any text/labels are always added programmatically afterward, never by the image model. Rate \"major\" for ANY word, letter grouping, or status readout you can actually read (e.g. a console showing \"O2\", \"POWER\", a sign, a screen with legible words) — this is stricter than a character sheet's tolerance for a tiny prop mark. Use \"minor\" ONLY for genuinely illegible pseudo-text squiggles that don't resolve into real words. \"none\" if there is no text-like marking at all.",
    args.styleName
      ? [
          `styleMismatchSeverity: this project's Style Bible is "${args.styleName}". Compare IMAGE 1 against these SPECIFIC required attributes, not a vague overall impression:`,
          styleRefs.length ? `- Also compare directly against IMAGE ${identityRefs.length + 2} (the approved same-episode style-continuity frame) — IMAGE 1 must render in the same style as that frame.` : null,
          dims?.linework ? `- Linework: ${dims.linework}` : null,
          dims?.shading ? `- Shading model: ${dims.shading}` : null,
          dims?.texture ? `- Texture: ${dims.texture}` : null,
          dims?.palette ? `- Palette: ${dims.palette}` : null,
          dims?.negativeConstraints?.length ? `- Explicitly forbidden for this style: ${dims.negativeConstraints.join("; ")}.` : null,
          `A MAJOR mismatch is any wholesale change to the RENDERING TECHNIQUE or MEDIUM itself — e.g. monochrome engraving/etching/cross-hatching instead of flat color, photorealistic or painterly rendering instead of simplified cartoon linework, a 3D-render look, or a materially different level of texture/detail density than the rest of the episode. Score "major" for a technique/medium change like that even if the SUBJECT MATTER is otherwise correct. Reserve "none"/"minor" for genuine close matches — a slightly different color choice or a marginally more/less detailed background, never a different art medium.`,
        ].filter(Boolean).join("\n")
      : `styleMismatchSeverity: no style was specified — answer "none".`,
    "corruptionArtifacts: severe generation corruption (duplicate/melted limbs or faces, broken anatomy)?",
    "environmentIrrelevant: is the background/environment jarringly unrelated to the described location (minor unrelated background clutter is fine — only flag a genuinely wrong setting)?",
    "approved: your own overall verdict.",
    "reasons: short specific reasons for any concerning field. Empty array if clean.",
  ].filter(Boolean).join("\n");
}

export async function runSceneQA(args: { imageUrl: string; sceneType: string; requiredCharacterNames: string[]; locationName: string | null; shotSize: string; expectedAction: string; styleName?: string | null; styleDimensions?: SceneQAStyleDimensions | null; referenceImages?: SceneQAReferenceImage[]; hasProgrammaticTextOverlay?: boolean; qaContext?: SceneQAContext }): Promise<SceneQAResult> {
  const refs = args.referenceImages ?? [];
  const ctx = args.qaContext ?? {};
  const prompt = buildSceneQAPrompt(args);
  // IMAGE 1 is always the generated scene; any canonical references follow
  // in the SAME order they were labeled above, so the model's own "IMAGE N"
  // references in the prompt line up exactly with what it's actually shown
  // (Part 4: "prefer the ORIGINAL canonical references, not only the
  // combined bundle" — these are always the individual source images, even
  // when dispatch itself used a composited SceneReferenceBundle).
  const content: any[] = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: args.imageUrl, detail: "high" } },
    ...refs.map((r) => ({ type: "image_url", image_url: { url: r.url, detail: "high" } })),
  ];
  // QA itself failing is the textbook case requiresReview exists for
  // (Part 5): the system has no basis to call this AUTO_READY, SOFT_WARNING
  // or HARD_FAIL — it simply doesn't know, so it asks a human rather than
  // guessing in either direction.
  const fallback = (reason: string): SceneQAResult => ({ requiredCharactersPresent: false, characterIdentityConsistent: false, locationIdentityConsistent: false, actionMatchesDescription: false, framingMatchesShotSize: false, isCharacterSheetLayout: false, referenceLeakageDetected: false, multiPanelViolation: false, castCloningDetected: false, duplicateCharacterInstanceDetected: false, semanticPolarityViolated: false, forbiddenEntityPresent: false, textArtifactSeverity: "major", styleMismatchSeverity: "none", corruptionArtifacts: false, environmentIrrelevant: false, approved: false, severity: "AUTO_READY", requiresReview: true, failureType: "QA_UNAVAILABLE", repairStrategy: null, reasons: [reason] });
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "scene_qa", strict: true, schema: SCENE_QA_SCHEMA } },
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return fallback("qa_unavailable");
    const payload = await res.json();
    const parsed = JSON.parse(String(payload.choices?.[0]?.message?.content ?? "{}"));
    const { approved: _modelApproved, ...rest } = parsed as SceneQAResult;
    // §14: derived straight from the ACTUAL supplied reference list, never
    // left to a caller to remember — defense in depth alongside the
    // caller-supplied ctx.referencesSupplied.
    const classification = classifySceneQA(rest, { hasProgrammaticTextOverlay: args.hasProgrammaticTextOverlay, referencesSupplied: refs.length > 0, ...ctx });
    // Phase 0, Section C.5 — real cost from this call's own reported usage;
    // only falls back to the flat estimate if OpenAI didn't return usage.
    const usage = payload.usage;
    const internalCostUsd = usage
      ? Number(((usage.prompt_tokens / 1_000_000) * GPT4O_MINI_INPUT_PER_M + (usage.completion_tokens / 1_000_000) * GPT4O_MINI_OUTPUT_PER_M).toFixed(6))
      : QA_CALL_ESTIMATED_COST_USD;
    return { ...rest, ...classification, internalCostUsd };
  } catch (error) {
    console.error("[sceneQA] scene QA failed:", String(error));
    return fallback("qa_unavailable");
  }
}
