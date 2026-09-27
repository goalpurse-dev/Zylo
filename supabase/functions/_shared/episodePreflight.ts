// The same deterministic compiler runs before billing and before scene persistence.
// No provider calls, image fetching, DB writes or fallback to ungrounded graphics.
import { validatePlanContract } from "./visualDirectorReliability.js";
import { compileGraphicSpec } from "./graphicSpec.ts";
import { getStylePresetForProject } from "./visualWorldStyle.ts";
import { deriveRenderStrategy, deriveSceneType, resolveSourceBeatId, requiredReferenceLookups, resolveReferenceCriticality, selectMinimalReferenceSet, compileScenePrompt, compileEditInstruction, canSatisfyCrop, compileSceneNegativePrompt, compileReferenceRules, type ReferenceRole } from "./sceneRenderPlan.ts";
import { assignSpanRequirements } from "./visualShotPlanning.js";
import { applyDuplicateRenderGate, findGeneratePromptDuplicates } from "./scenePromptQuality.ts";
import { supportsExactText, measureStrokeText } from "./sceneCompositor.ts";

// 2026-09-20 "fix isolated character reference availability" pass — real
// Mars finding: deriveRequiredViews (visualWorldStyle.ts) deliberately
// generates ONE canonical multi-pose character_reference_sheet per
// character (the 2026-09-13 simplification) and no single-pose isolated
// view has ever been produced for any real character — so the hard block
// below (throwing ISOLATED_CHARACTER_REFERENCE_REQUIRED whenever no
// single-pose asset exists) failed 54 beats across every real HERO/
// RECURRING character on Mars, blocking the whole episode. True
// deterministic pixel cropping of a specific pose out of the sheet isn't
// safely possible today: the sheet's own layout is composed by the image
// model from a semantic description (visualWorldStyle.ts's
// characterSheetLayout), never a fixed row/column grid, so there are no
// known, reliable pixel coordinates to crop from.
//
// Per the explicit product decision this closes: "preflight must not fail
// simply because an otherwise-valid canonical character lacks the exact
// isolated extraction artifact... If an asset genuinely cannot be isolated
// safely, preflight should clearly name that entity" (a WARNING, not a
// hard block). This now falls back to the canonical sheet itself (still
// the real source of truth) and reports that fallback via
// `isolatedFallback: true` on the returned reference, which
// compileEpisodeBeat below turns into (a) a NAMED, visible warning
// (`ISOLATED_REFERENCE_FALLBACK_TO_SHEET:<entityId>`, collected but never
// thrown) and (b) an explicit single-pose disambiguation instruction on
// the compiled character-identity prompt line, so the image model is
// still told never to reproduce the sheet's multiple panels even though it
// received the whole sheet as its reference image. A real crop/extraction
// pipeline (requiring a fixed-layout sheet contract + a dispatched crop
// job) is the natural fast-follow once sheets are regenerated under a
// deterministic panel order — intentionally not built in this pass.
export function selectIsolatedReference(assets: any[], entityId: string, angle: string, character: boolean) {
  const usable = (a: any) => !a.stale && a.status === "succeeded" && a.result_url
    && (a.qa_status !== "rejected" || a.manual_approval)
    && (!character || a.qa_status === "approved" || a.manual_approval);
  // A pending/failed/rejected regeneration is non-destructive. It only
  // supersedes its parent after the child itself becomes usable.
  const replaced = new Set(assets.filter(a => usable(a) && a.replaces_asset_id).map(a => a.replaces_asset_id));
  const isolatedCandidates = assets.filter(a => a.entity_id === entityId && usable(a) && !replaced.has(a.id)
    && (!character || !/sheet|turnaround/i.test(a.angle_or_view)));
  const preference = character ? [angle, "three_quarter", "three_quarter_neutral", "three_quarter_hero", "front", "front_view", "face_close_up", "face_closeup", "face_front", "profile", "side_profile", "back"] : [angle];
  for (const view of preference) {
    const found = isolatedCandidates.filter(a => a.angle_or_view === view).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (found) return found;
  }
  if (character) {
    const sheet = assets.filter(a => a.entity_id === entityId && usable(a) && !replaced.has(a.id)
      && /sheet/i.test(a.angle_or_view))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
    if (sheet) return { ...sheet, isolatedFallback: true };
  }
  throw new Error(`${character ? "ISOLATED_CHARACTER_REFERENCE_REQUIRED" : "CANONICAL_REFERENCE_NOT_READY"}:${entityId}/${angle}`);
}

export function alignReferenceLookupsToWorld(lookups: any[], world: any) {
  const requiredByEntity = new Map<string, any[]>((world?.reference_plan?.entities ?? [])
    .map((entity: any) => [entity.entityId, entity.requiredViews ?? []]));
  return lookups.flatMap((lookup) => {
    // A lookup for an entity the adopted world never planned at all (not
    // merely one with an empty requiredViews list) is a stale/legacy
    // reference the current world has no slot for — drop it rather than
    // passing it through unresolved, so preflight only ever requests
    // adopted-world required slots.
    if (!requiredByEntity.has(lookup.entityId)) return [];
    const requiredViews = requiredByEntity.get(lookup.entityId) ?? [];
    if (requiredViews.length === 0) return [lookup];
    const exact = requiredViews.find((view: any) => view.angle === lookup.angle);
    return [{ ...lookup, angle: (exact ?? requiredViews[0]).angle }];
  });
}

function narrationSliceForBeat(beat: any, claim: any): string {
  if (beat.shotNarrationText) return beat.shotNarrationText;
  const range = beat.narrationRanges?.[0];
  const text = String(claim?.narrationText ?? "");
  if (range && Number.isInteger(range.startChar) && Number.isInteger(range.endChar) && range.endChar <= text.length) {
    const slice = text.slice(range.startChar, range.endChar).trim();
    if (slice) return slice;
  }
  const authored = String(beat.informationToCommunicate ?? "");
  const separator = authored.indexOf(": ");
  return separator >= 0 ? authored.slice(separator + 2) : authored;
}

export function preparePlanForCompilation(plan: any, contract: any) {
  const prepared = structuredClone(plan);
  const claims = new Map((contract?.claims ?? []).map((claim: any) => [claim.claimId, claim]));
  const entities = new Map<string, any>((prepared.entityRegistry ?? []).map((e: any) => [e.id, e]));
  for (const beat of prepared.visualBeats ?? []) {
    const claim: any = claims.get(beat.narrationClaimId);
    const narration = narrationSliceForBeat(beat, claim);
    const hasPersistedShotIntent = Boolean(beat.shotPurpose && beat.actionOrState && beat.visualDelta);
    beat.shotNarrationText = narration;
    // Legacy v1-v3 plans persisted the macro objective at the front of every
    // child's informationToCommunicate. Reusing that field here recreates the
    // duplicate-prompt incident even though the exact child range is known.
    // New v4 plans already carry authored shot intent; older plans hydrate a
    // deterministic, range-specific intent for explicit regeneration/dry-run.
    beat.shotPurpose = hasPersistedShotIntent
      ? beat.shotPurpose
      : "Illustrate only the idea spoken in this exact narration span.";
    // beat.subject itself must stay whatever it was authored as (including a
    // raw registry id) — compileEpisodeBeat's focalEntityId resolution below
    // depends on being able to look it up via entities.has(beat.subject).
    // Never touch that value here.
    beat.subject = beat.subject || claim?.primarySubject || beat.primaryEntityIds?.[0] || "the narrated subject";
    beat.actionOrState = hasPersistedShotIntent ? beat.actionOrState : narration;
    // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
    // this legacy-hydration fallback built "Establish {subject}." directly
    // from beat.subject, which is frequently a raw registry id (see the note
    // above) — a SEPARATE leak from compileEpisodeBeat's own focalSubject/
    // displaySubject fix, since this text is generated once here and then
    // persisted as an already-final beat.visualDelta string. Resolve through
    // the entity registry for DISPLAY here too, without ever touching
    // beat.subject's own raw value.
    const displaySubjectForDelta = entities.get(beat.subject)?.name ?? beat.subject;
    beat.visualDelta = hasPersistedShotIntent
      ? beat.visualDelta
      : beat.deltaInstruction || (beat.sequenceIndex === 1 ? `Establish ${displaySubjectForDelta}.` : "Change the visual to the new action or state described now.");
    beat.composition = beat.composition || { shotSize: beat.shotSize, cameraFraming: beat.cameraFraming ?? null };
    beat.entities = beat.entities || [...new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])])];
    beat.referenceEntityIds = beat.referenceEntityIds || beat.entities;
    beat.location = beat.location ?? beat.locationId ?? null;
  }
  assignSpanRequirements(prepared.visualBeats ?? [], contract?.claims ?? []);
  applyDuplicateRenderGate(prepared.visualBeats ?? []);
  // Repair legacy dangling derived bases deterministically. Older planners
  // sometimes minted a new baseSetupKey on a REUSE beat even though no paid
  // GENERATE established it. Point that beat at the nearest earlier base in
  // its sequence rather than silently adding another image operation.
  const established = new Map<string, any>();
  for (const beat of prepared.visualBeats ?? []) {
    // A PROGRAMMATIC_GRAPHIC beat only ever has a baseSetupKey when
    // applyDuplicateRenderGate just stamped one (a REUSE-of-graphic link,
    // "graphics are not a quota" pass) — register it here too, or this
    // legacy-repair loop would treat that correct, freshly-made link as a
    // "dangling" one and reroute it to an unrelated GENERATE beat instead.
    if ((beat.renderMethod === "GENERATE" || beat.renderMethod === "PROGRAMMATIC_GRAPHIC") && beat.baseSetupKey) established.set(beat.baseSetupKey, beat);
    if (!["EDIT", "REUSE", "CROP", "COMPOSITE"].includes(beat.renderMethod) || established.has(beat.baseSetupKey)) continue;
    const prior = [...established.values()].reverse();
    const source = prior.find((candidate: any) => candidate.sequenceId === beat.sequenceId)
      ?? prior.find((candidate: any) => candidate.chapterId === beat.chapterId && candidate.subject === beat.subject)
      ?? prior.find((candidate: any) => candidate.chapterId === beat.chapterId);
    if (source) {
      beat.baseSetupKey = source.baseSetupKey;
      beat.sourceBeatId = source.id;
      beat.legacySourceRepair = true;
    }
  }
  return prepared;
}

function roleForReference(entity: any, asset: any): ReferenceRole {
  if (asset?.reference_type === "style_reference" || entity?.category === "STYLE_REFERENCE") return "STYLE_REFERENCE";
  if (entity?.category === "CHARACTER") return "IDENTITY_REFERENCE";
  if (entity?.category === "LOCATION" || asset?.reference_type === "location_reference" || asset?.reference_type === "environment_reference") return "ENVIRONMENT_REFERENCE";
  return "OBJECT_REFERENCE";
}

export function compileEpisodeBeat(beat: any, context: any) {
  const { plan, contract, project, world, assets } = context;
  const entities = new Map<string, any>((plan.entityRegistry ?? []).map((e: any) => [e.id, e]));
  const group = (plan.continuityGroups ?? []).find((g: any) => g.id === beat.continuityGroupId);
  const claim = contract.claims.find((c: any) => c.claimId === beat.narrationClaimId);
  if (!claim) throw new Error(`CLAIM_MISSING:${beat.id}`);
  let renderStrategy = deriveRenderStrategy(beat);
  if (renderStrategy === "CROP" && !canSatisfyCrop(beat)) throw new Error("DETAIL_CROP_REQUIRES_REPLAN");
  const sourceBeatId = resolveSourceBeatId(beat, plan.visualBeats);
  let sceneType = deriveSceneType(beat);
  const styleSpec = getStylePresetForProject(project.visual_style_preset);
  const exactText = beat.textOverlay?.renderInRaster === false ? beat.textOverlay.text : null;
  if (exactText && (!supportsExactText(exactText) || measureStrokeText(exactText.toUpperCase(), 1080 * 0.12 * 0.22).width > 1920 * 0.84 * 0.88)) throw new Error("EXACT_TEXT_TREATMENT_REQUIRES_REPLAN");
  const rawFocalSubject = beat.subject || claim.primarySubject;
  // 2026-09-22 "FINAL stabilization pass" §6 — stable-entity-ID / display-
  // text separation. focalSubject/displaySubject stay free text for UI and
  // prompt use (unchanged); focalEntityId is populated ONLY when the
  // upstream-authored subject value IS ITSELF already a real, resolvable
  // entity registry id (visualShotPlanning.js's buildShotIntent frequently
  // sets beat.subject to an actual entityIds[0] value) — never derived by
  // matching the free-text string against entity names/aliases. That
  // fragile-string-matching alias resolution (e.g. resolving the free-text
  // "Pillars of Heracles" to the distinct entity id Gibraltar_region) is a
  // genuinely separate, larger piece: it needs an explicit alias/synonym
  // field on the entity registry that does not exist in the Visual Plan
  // schema today, and populating the entity registry is Visual Plan's job,
  // not the Scene Render Plan compiler's — out of scope for this pass (see
  // final report). This field exists now so that a future alias-resolution
  // fix only has to populate ONE new authoritative field, never touch every
  // downstream consumer of composition.focalSubject a second time.
  const focalEntityId = entities.has(rawFocalSubject) ? rawFocalSubject : null;
  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // focalSubject was left as the RAW value (often a literal entity id like
  // "ent_timaeus" — see the comment above on buildShotIntent frequently
  // setting beat.subject to an actual entityIds[0] value) and fed straight
  // into the compiled image prompt's [SUBJECT] line and "Focal point:"
  // sentence verbatim. A raw id is meaningless to the image model — for an
  // entity with no reference and no physical description (any DIAGRAM_
  // SUBJECT, or any CHARACTER this shot didn't route a reference for), it
  // was the ONLY thing telling the model what to draw, and the model
  // invented an unrelated figure to fill the gap. focalEntityId (above)
  // remains the one place any actual id-based lookup belongs; focalSubject/
  // displaySubject are documented as "free text for UI and prompt use" (see
  // the comment above) and must therefore always BE resolved, human-
  // readable text, never a raw id — collapsing them to the same value here
  // means every existing consumer of either field now gets the safe one.
  const displaySubject = focalEntityId ? (entities.get(focalEntityId)?.name ?? rawFocalSubject) : rawFocalSubject;
  const director = {
    cameraFraming: beat.cameraFraming || `${beat.shotSize} view of ${claim.primarySubject}`,
    focalSubject: displaySubject,
    focalEntityId,
    displaySubject,
    cameraAnchor: beat.cameraAnchor || group?.cameraAnchors?.[0] || null,
    editInstruction: [beat.visualDelta || beat.deltaInstruction, beat.actionOrState]
      .filter(Boolean).join(" Current shot state: ") || claim.stateAfter,
    cropRegion: "center_detail", continuityNote: "",
  };
  // 2026-09-22 "FINAL stabilization pass" §13 — real Atlantis finding:
  // several Pillars-of-Heracles scenes were rejected for "No characters
  // present as required" even though the Scene Director's chosen focal
  // subject was the landmark, no character reference was routed, and the
  // shot concept never called for a visible character — qa_expectations and
  // the actual render/reference contract disagreed. Root cause: this list
  // fed the QA expectation with EVERY CHARACTER-category entity merely
  // TAGGED on the beat (primaryEntityIds/supportingEntityIds), with no
  // regard for whether requiredReferenceLookups (below, and in
  // sceneRenderPlan.ts) considered that character relevant enough to this
  // specific shot to route a reference for at all. requiredReferenceLookups
  // already applies exactly the right gate — HERO/RECURRING only, "the
  // Visual World's own referenceNeeded gate" — so QA's required-character
  // expectation now uses that SAME gate, never a broader, separately-
  // derived interpretation of the same beat. A LOW-importance/incidental
  // character tag on a beat (e.g. someone merely narratively "in the
  // scene") no longer forces QA to demand they be visibly rendered.
  const characterIds = [...new Set([...(beat.primaryEntityIds ?? []), ...(beat.supportingEntityIds ?? [])])]
    .filter(id => entities.get(id)?.category === "CHARACTER" && (entities.get(id)?.importance === "HERO" || entities.get(id)?.importance === "RECURRING"));
  const characterNames = characterIds.map(id => entities.get(id).name);
  let referenceAssetIds: string[] = [], referenceRoles: any[] = [], imagePrompt: string | null = null, overlaySpec: any = null;
  if (renderStrategy === "PROGRAMMATIC_GRAPHIC") {
    const result = compileGraphicSpec(claim, { theme: "light", backgroundMode: "light", contractVersionId: contract.id, beatFacts: beat.shotRequiredVisualFacts ?? null });
    if (result.ok) {
      overlaySpec = result.spec;
    } else {
      // 2026-09-21 "graphics are not a quota" pass, Section H: "if a useful
      // semantic graphic cannot be built confidently, fall back to a normal
      // illustrated scene" — never a hard finalization failure over one
      // beat whose claim genuinely doesn't fit any of the 11 graphic
      // templates (a real Atlantis incident: a long multi-item checklist
      // claim). Falls through to the GENERATE branch below with the same
      // beat data every beat already carries regardless of render method.
      //
      renderStrategy = "GENERATE";
      beat.renderMethod = "GENERATE";
    }
  }
  // 2026-09-22 "FINAL stabilization pass" Section 7 — real, LIVE Atlantis
  // finding (caught by a real compile-only dry run against the actual
  // project, not a synthetic case): two Chapter 1 beats persisted
  // scene_type=PROGRAMMATIC_GRAPHIC alongside render_strategy=GENERATE.
  // NOT produced by the fallback above -- the beat's own upstream-authored
  // fields already disagreed (renderMethod:"GENERATE",
  // visualType:"PROGRAMMATIC_GRAPHIC" on the same beat, predating this
  // pass). Rebuilding the Visual Plan/Storyboard that authored those
  // fields is out of scope for this pass, so the render-plan compiler
  // enforces the invariant itself, unconditionally, regardless of which
  // cause produced the disagreement: scene_type can never read
  // PROGRAMMATIC_GRAPHIC unless render_strategy agrees, because a
  // PROGRAMMATIC_GRAPHIC must never invoke the image provider.
  if (sceneType === "PROGRAMMATIC_GRAPHIC" && renderStrategy !== "PROGRAMMATIC_GRAPHIC") sceneType = "STORY_SCENE";
  if (renderStrategy === "GENERATE" || renderStrategy === "EDIT") {
    let lookups = requiredReferenceLookups(beat, entities);
    if (renderStrategy === "GENERATE" && entities.get(beat.locationId)?.referenceNeeded && director.cameraAnchor) lookups.push({ entityId: beat.locationId, angle: director.cameraAnchor });
    lookups = alignReferenceLookupsToWorld(lookups, world);
    const withCriticality = resolveReferenceCriticality(lookups, entities, claim).map(l => ({ ...l, criticality: entities.get(l.entityId)?.category === "CHARACTER" ? "HIGH" as const : l.criticality }));
    // Style is carried by the structured StyleBible/styleSpec in the scene
    // prompt. A legacy style-reference image may remain in old history, but
    // it is deliberately never injected into scene generation: literal
    // sample pixels can incorrectly force their subject or palette.
    const selection = renderStrategy === "GENERATE" ? selectMinimalReferenceSet(withCriticality, 4) : { selected: withCriticality, droppedForCapacity: [] };
    if (selection.droppedForCapacity.some(l => entities.get(l.entityId)?.category === "CHARACTER")) throw new Error("MULTI_CHARACTER_IDENTITY_UNSAFE");
    const identityBlocks = [];
    const isolationWarnings: string[] = [];
    for (const lookup of selection.selected) {
      const entity = entities.get(lookup.entityId);
      const asset = (lookup as any).__styleAsset ?? selectIsolatedReference(assets, lookup.entityId, lookup.angle, entity?.category === "CHARACTER");
      referenceAssetIds.push(asset.id);
      const canonical = world.reference_plan?.entities?.find((e: any) => e.entityId === lookup.entityId);
      if (entity?.category === "CHARACTER") {
        const identity = canonical?.characterIdentitySpec;
        const tokens = identity ? [identity.apparentAge, identity.skinTone, identity.hairColor, identity.hairstyle, identity.facialHair, identity.outfitSpec?.colors].filter(Boolean).join(", ") : canonical?.canonicalSpec;
        // 2026-09-20 "fix isolated character reference availability" pass:
        // when selectIsolatedReference had to fall back to the full
        // canonical sheet (no single-pose asset exists yet), the supplied
        // reference image genuinely shows multiple poses — an explicit
        // disambiguation instruction is the deterministic mitigation this
        // beat needs (real product decision: reported clearly, never a
        // silent multi-panel copy). Named per-entity so the caller can
        // surface exactly which character still needs a real isolated view.
        const disambiguation = (asset as any).isolatedFallback
          ? " The supplied reference is a multi-pose canonical sheet — use ONLY ONE consistent single pose from it for this shot; do not depict multiple poses or reproduce the sheet's panel layout."
          : " Match supplied isolated reference; preserve identity, not its pose.";
        if ((asset as any).isolatedFallback) isolationWarnings.push(`ISOLATED_REFERENCE_FALLBACK_TO_SHEET:${lookup.entityId}`);
        // 2026-09-22 "FINAL stabilization pass" §2 — real Atlantis finding:
        // Shot 1 generated TWO instances of the one required character
        // (Plato) in a single frame. An explicit single-instance count
        // constraint is the deterministic, preventative half of the fix
        // (duplicateCharacterInstanceDetected in sceneQA.ts is the
        // detective half, for whenever this still slips through).
        identityBlocks.push(`${entity.name}: ${tokens || "canonical identity"}.${disambiguation} Exactly ONE ${entity.name}, never duplicated.`);
      }
      referenceRoles.push({ assetId: asset.id, role: roleForReference(entity, asset), represents: entity?.name ?? canonical?.entityName ?? asset.entity_id ?? null });
    }
    if (renderStrategy === "GENERATE") imagePrompt = compileScenePrompt(styleSpec, {
      sceneType, shotSize: beat.shotSize, cameraFraming: director.cameraFraming, focalSubject: director.focalSubject,
      informationToCommunicate: beat.shotPurpose || beat.informationToCommunicate,
      // subject (not beat.subject, the raw value — see the note above
      // director.displaySubject) is what actually reaches the compiled
      // prompt's [SUBJECT] line (compileScenePrompt prefers `subject` over
      // `focalSubject`), so it needs the exact same raw-id resolution.
      shotPurpose: beat.shotPurpose, subject: director.displaySubject, actionOrState: beat.actionOrState,
      visualDelta: beat.visualDelta, narrationSlice: beat.shotNarrationText,
      characterIdentityBlocks: identityBlocks,
      locationDescription: beat.location ? (entities.get(beat.location)?.name ?? beat.location) : null,
      worldStateNotes: (group?.inheritedState ?? []).map((v: any) => `${v.key}: ${v.value}`), continuityNote: null,
      // The pinned claim supplies this beat's facts; macro constraints remain on
      // the durable plan but must not swamp this span with unrelated chapter facts.
      factualConstraints: [],
      forbiddenElements: beat.forbiddenElements ?? [], reserveTextSafeArea: Boolean(exactText || beat.overlayRequirement),
      semanticNotes: beat.shotRequiredVisualFacts?.length ? `MUST SHOW IN THIS SHOT: ${beat.shotRequiredVisualFacts.join("; ")}` : null,
      referenceRules: compileReferenceRules(referenceRoles),
    });
    else imagePrompt = compileEditInstruction(director.editInstruction, styleSpec, beat.shotRequiredVisualFacts?.length ? `MUST SHOW IN THIS SHOT: ${beat.shotRequiredVisualFacts.join("; ")}` : null);
    const negativePrompt = compileSceneNegativePrompt(styleSpec);
    director.negativePrompt = negativePrompt;
    director.referenceRoles = referenceRoles;
    return { beatId: beat.id, renderStrategy, sceneType, sourceBeatId, director, characterNames, referenceAssetIds, referenceRoles, imagePrompt, negativePrompt, overlaySpec, exactText, styleSpec, isolationWarnings, plannedBeat: beat };
  }
  return { beatId: beat.id, renderStrategy, sceneType, sourceBeatId, director, characterNames, referenceAssetIds, referenceRoles, imagePrompt, negativePrompt: null, overlaySpec, exactText, styleSpec, isolationWarnings: [], plannedBeat: beat };
}

export function preflightEpisode(context: any) {
  const errors = validatePlanContract(context.plan, context.contract, context.project.current_script_version_id).map((reason: string) => ({ beatId: null, reason }));
  const preparedPlan = preparePlanForCompilation(context.plan, context.contract);
  const compiled: any[] = [];
  const totalBeats = preparedPlan.visualBeats?.length ?? 0;
  if (context.contract?.claims) for (const beat of preparedPlan.visualBeats ?? []) {
    try { compiled.push(compileEpisodeBeat(beat, { ...context, plan: preparedPlan })); }
    catch (e) { errors.push({ beatId: beat.id, reason: e instanceof Error ? e.message : "COMPILE_FAILED" }); }
  }
  for (const duplicate of findGeneratePromptDuplicates(compiled)) errors.push({ beatId: duplicate.laterBeatId, reason: `DUPLICATE_GENERATE_PROMPT:${duplicate.earlierBeatId}:${duplicate.similarity.toFixed(3)}` });
  // 2026-09-20 "verify 128 vs 136" pass (Task 1): totalBeats is reported
  // explicitly here — the acceptance invariant `preflight.totalBeats ===
  // activeVisualPlan.totalBeats` is a property of THIS field always
  // reading context.plan.visualBeats.length directly, with no filter/
  // slice/dedupe anywhere in this module (compiled.length + errors from
  // beats never exceeds/undercounts totalBeats by construction — every
  // beat produces exactly one compiled entry or one error entry).
  const isolationWarnings = compiled.flatMap((c) => c.isolationWarnings ?? []);
  return { ok: errors.length === 0 && compiled.length === totalBeats, totalBeats, compiled, errors, isolationWarnings, preparedPlan };
}

export async function loadEpisodePreflight(admin: any, projectId: string, userId: string, tier: string) {
  const { data: project, error } = await admin.from("long_form_projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !project || project.user_id !== userId) throw new Error("PROJECT_NOT_FOUND");
  const { data: compatibility, error: compatibilityError } = await admin.rpc("long_form_visual_world_compatibility", { p_project_id: projectId });
  if (compatibilityError || !compatibility?.compatible) {
    throw new Error(`GENERATE_PREFLIGHT_FAILED_VISUAL_WORLD:${compatibility?.reason ?? "not_ready"}`);
  }
  const [{ data: planRow }, { data: world }, { data: assets }] = await Promise.all([
    admin.from("long_form_visual_plan_versions").select("*").eq("id", compatibility.visualPlanVersionId).maybeSingle(),
    admin.from("long_form_visual_world_versions").select("*").eq("id", compatibility.visualWorldVersionId).maybeSingle(),
    admin.from("long_form_reference_assets").select("*").eq("visual_world_version_id", compatibility.visualWorldVersionId),
  ]);
  if (planRow?.status !== "ready" || world?.status !== "ready") throw new Error("GENERATE_PREFLIGHT_FAILED_NOT_READY");
  const { data: contract } = await admin.from("long_form_narration_contract_versions").select("*").eq("id", planRow.visual_plan.narrationContractVersionId ?? "00000000-0000-0000-0000-000000000000").eq("project_id", projectId).maybeSingle();
  const context = { project: { ...project, scene_generation_tier: tier }, plan: planRow.visual_plan, world, assets: assets ?? [], contract };
  return { ...preflightEpisode(context), planId: planRow.id, worldId: world.id, contractId: contract?.id, context };
}
