// Verified 2026-09-10: https://runware.ai/docs/models/alibaba-qwen-image-edit-plus
// Verified 2026-09-11 (character-reference architecture redesign): the same
// doc page's referenceImages parameter is documented "min items: 1, max
// items: 3" — Qwen Image Edit Plus genuinely supports up to THREE reference
// images per call, so a geometry edit (Profile/Back) is allowed to condition
// on both the accepted Identity Master AND its Face Detail crop (Part 6's
// REFERENCE 1/REFERENCE 2 structure) rather than the master alone. No
// strength/weight parameter exists for reference conditioning on either
// Qwen or Klein (checked runware-image's actual task payload construction
// directly) — never invent one; prompt text plus which images are supplied
// remain the only two verified levers.
export const KLEIN = "image:flux2.klein9bkv";
export const QWEN = "image:qwen.image-edit-plus";
// Verified directly against Runware's own docs (runware.ai/docs/models/
// bfl-flux-2-klein-4b, fetched 2026-09-11): AIR tag runware:400@4 —
// already registered in this codebase's provider registry as
// "image:flux.base" (src/lib/providers.ts), just under a stale display
// label ("Flux Base by RunDiffusion") left over from an earlier phase. The
// AIR tag is the real dispatch identifier Runware resolves against, not
// the local label, so no new registry entry is needed — this const just
// names what that tool_key actually is for the character-sheet renderer
// comparison (Part 4: "do NOT assume 9B is automatically better" —
// composition-following, not maximum detail, is what these 3-view sheets
// need, and 4B is also ~3x cheaper per Runware's own pricing).
export const KLEIN_4B = "image:flux.base";
// V3 canonical character-sheet renderer (2026-09-13): direct Runware
// evidence showed Kling IMAGE O3 substantially better suited to "one image,
// many correct views of the same character" than FLUX Klein ever was —
// Klein needed the layout spelled out as a near-pixel grid and still
// frequently ignored it; Kling's own documented examples show exactly the
// kind of professional model sheet this role needs. This ONLY changes the
// renderer for the CURRENT canonical character_reference_sheet role — the
// retired identity_outfit_sheet/face_sheet/profile_silhouette_sheet roles
// (Phase C/D architecture, history-only, never produced again) keep using
// KLEIN_4B via their own existing policy entries below, untouched.
export const KLING_O3 = "image:kling.o3";
// Canonical Visual World Reference Quality V1. Seedream 5.0 Pro is the
// single provider renderer for every newly planned canonical reference.
// Historical rows keep their persisted renderer and the legacy policies
// below remain readable for compatibility.
export const SEEDREAM_5_PRO = "image:seedream5pro";
export const SEEDREAM_5_PRO_AIR = "bytedance:seedream@5.0-pro";
const seedreamIndependent = Object.freeze({ toolKey: SEEDREAM_5_PRO, requiresIdentityAnchor: false, width: 1536, height: 1024 });
const seedreamDerived = (orientation, framing) => Object.freeze({ toolKey: SEEDREAM_5_PRO, requiresIdentityAnchor: true, width: 1536, height: 1024, orientation, framing });
// Visual World V1 references are intentionally cheap schematic inputs.
// FLUX Klein 4B is the verified low-cost renderer for isolated style,
// location, object, environment and diagram specimens. The one canonical
// multi-view character sheet keeps Kling O3 because that role needs its
// proven sheet-composition ability.
const cheapIndependent = Object.freeze({ toolKey: KLEIN_4B, requiresIdentityAnchor: false, width: 1536, height: 1024 });
const ordinary = cheapIndependent;
// Character sheet pack v3 renderer (legacy/history-only): Klein 4B,
// landscape 1536x1024 (3:2, both multiples of 16 per Runware's documented
// 128-2048/step-16 range) so three horizontally arranged full-body/
// head-and-shoulders figures have real width to exist in — every sheet
// generated under the prior square 1024x1024 canvas either collapsed to one
// figure or crammed three into a square. Still backs the retired
// identity_outfit_sheet role (never produced again, kept renderable for
// inspection only) — CHARACTER_REFERENCE_SHEET now uses klingSheetPolicy
// below instead.
export const CHARACTER_SHEET_RENDERER_POLICY_VERSION = "character-sheet-v4-kling";
const sheetPolicy = Object.freeze({ toolKey: KLEIN_4B, requiresIdentityAnchor: false, width: 1536, height: 1024 });
// V3 canonical sheet policy (2026-09-13): Kling IMAGE O3, 2720x1536 —
// verified live against Runware that 1360x768 and 2720x1536 currently sit
// in the SAME billing tier ($0.028 each), so defaulting to the smaller size
// would only waste image quality for no cost savings (Part 2). 4K
// (5440x3072, $0.056) is a real, working option but deliberately NOT the
// default — reserved as a possible future premium tier. requiresIdentityAnchor
// stays false: this is a pure independent generation, never conditioned on
// any reference image. (2026-09-14 correction: an earlier revision of this
// comment described Regenerate optionally sending the approved predecessor
// as an identity/style reference — real evidence showed Kling over-copying
// that reference instead of generating fresh, so that allowance was
// RETRACTED. Regenerate always sends zero reference images now, same as
// every other independent-generation role — see the strict zero-image
// invariant in resolveReferenceOperationRenderer above.)
export const KLING_SHEET_RENDERER_POLICY_VERSION = "kling-sheet-v1";
const klingSheetPolicy = Object.freeze({ toolKey: KLING_O3, requiresIdentityAnchor: false, width: 2720, height: 1536 });
// 2026-09-20 "V3 Kling routing" fix — single-subject Kling policy (location/
// object/vehicle/celestial/environment references), reusing the SAME
// verified Kling dimensions as the character sheet (2720x1536 landscape)
// rather than guessing an untested resolution under time pressure. A single
// subject on a landscape canvas is a safe, already-proven Runware
// combination; revisit only if a real square-composition need surfaces.
const klingSinglePolicy = Object.freeze({ toolKey: KLING_O3, requiresIdentityAnchor: false, width: 2720, height: 1536 });
// CHARACTER_FACE is no longer an independent generation (real incident:
// Face rendered as basically the same composition as the 3/4 master instead
// of a distinct reference). It is now a DETERMINISTIC PIXEL CROP of the
// accepted Identity Master — method:"CROP" tells the worker to crop inline
// instead of building a Runware job; toolKey stays null since no provider
// is ever called (zero cost, 100% identity continuity because it is
// literally the same source image). requiresIdentityAnchor is still true —
// the crop cannot run until an approved master exists.
const crop = Object.freeze({ toolKey: null, requiresIdentityAnchor: true, method: "CROP" });
// ADOPT (component-pack architecture): zero-cost alias of an already-
// accepted sibling component — never dispatches to any renderer at all.
// silhouette_front/side/back adopt the identity_outfit_* component for the
// SAME orientation, since "full-body front/side/back" is the same shot
// whether it's framed as identity or silhouette — duplicating an identical
// image under a second label would be pure waste (Part 10/11's own cost
// discipline: "Do not explode cost unnecessarily").
const adopt = Object.freeze({ toolKey: null, requiresIdentityAnchor: false, method: "ADOPT" });
const geometry = (orientation, framing) => seedreamDerived(orientation, framing);
const FULL_BODY_FRAMING = "one isolated centered character, full body head to shoes, neutral relaxed standing pose. Plain warm-white/off-white studio background. No room, habitat, cockpit, vehicle interior or any environment/furniture.";
const HEAD_SHOULDERS_FRAMING = "one isolated centered character, head-and-shoulders framing only — no torso below shoulders, no hands, no full body. Plain warm-white/off-white studio background. No room, habitat or environment of any kind.";
// 2026-09-22 explicit user request (live QA on the Atlantis project): make
// Kling IMAGE O3 the default renderer for reference sheets again — Seedream
// output for these two independent, non-anchor-conditioned views was
// judged too simple/inconsistent for this project's actual episode. Only
// the two INDEPENDENT character views are swapped here (same shape as
// klingSheetPolicy/klingSinglePolicy, safe to swap directly); the DERIVED
// (identity-anchor-conditioned) roles below are left on Seedream for now —
// Kling's own reference-conditioning behavior for that exact use case is
// unverified in this codebase, and these legacy per-view roles are already
// being retired by the single-sheet CHARACTER_REFERENCE_SHEET architecture
// (see visualWorldStyle.ts's deriveRequiredViews), which was ALREADY on
// Kling O3 before this change.
const klingCharacterIndependent = Object.freeze({ toolKey: KLING_O3, requiresIdentityAnchor: false, width: 2720, height: 1536 });
export const REFERENCE_RENDER_POLICY = Object.freeze({
  CHARACTER_IDENTITY_3Q: klingCharacterIndependent,
  CHARACTER_FRONT_FULL: klingCharacterIndependent,
  CHARACTER_FACE: seedreamDerived("Straight-on FACE CLOSE-UP. Both eyes visible, neutral expression, exact same facial construction and hairstyle.", HEAD_SHOULDERS_FRAMING),
  CHARACTER_OUTFIT_DETAIL: seedreamDerived("Three-quarter clothing and equipment detail of the exact canonical outfit.", FULL_BODY_FRAMING),
  CHARACTER_PROFILE: geometry("Rotate the character into a STRICT 90-DEGREE SIDE PROFILE. Head exactly side-on, clear forehead/nose/lips/chin silhouette, ONE eye visible only, one ear visible. Shoulders and body consistently side-on. No frontal or three-quarter face.", FULL_BODY_FRAMING),
  CHARACTER_BACK: geometry("Rotate the character into a strict BACK VIEW facing completely away. Face and eyes invisible. Show the back of the same hairstyle and outfit; shoulders and body face away.", FULL_BODY_FRAMING),
  CHARACTER_EXPRESSION_NEUTRAL: seedreamIndependent,
  CHARACTER_EXPRESSION_HAPPY: seedreamIndependent,
  CHARACTER_EXPRESSION_WORRIED: seedreamIndependent,
  CHARACTER_EXPRESSION_SHOCKED: seedreamIndependent,
  CHARACTER_EXPRESSION_FOCUSED: seedreamIndependent,
  // Character sheet pack v4 (2026-09-11, second revision — authoritative
  // for CURRENT generation, see visualWorldStyle.ts's deriveRequiredViews).
  // Identity/Outfit stays an independent Klein 4B generation (proven to
  // nail the 3-view layout on its own). Face and Profile/Silhouette are now
  // DERIVED from the accepted Identity/Outfit sheet via Qwen Image Edit
  // Plus (single reference image, requiresIdentityAnchor:true) — v3's
  // independent-generation choice for these two caused a real incident
  // (visibly different-looking character across the three sheets, since
  // text-only identity description isn't enough to keep 3 separate
  // generations consistent). No orientation/framing fields here since
  // compileDerivedSheetEdit (visualWorldStyle.ts) compiles from
  // SHEET_ROLE_SPECS directly, not from this policy object.
  CHARACTER_IDENTITY_OUTFIT_SHEET: sheetPolicy,
  CHARACTER_FACE_SHEET: Object.freeze({ toolKey: QWEN, requiresIdentityAnchor: true, width: 1536, height: 1024 }),
  CHARACTER_PROFILE_SILHOUETTE_SHEET: Object.freeze({ toolKey: QWEN, requiresIdentityAnchor: true, width: 1536, height: 1024 }),
  // Component-based HERO pack (superseded 2026-09-11 by the sheet pack v3
  // above — kept only so any historical/legacy component-taxonomy row
  // remains renderable/inspectable; deriveRequiredViews no longer produces
  // these angles for current generation). Real evidence this reversal is
  // based on: a manually-proven prompt showed FLUX CAN compose a correct
  // 3-view sheet in one image, meaning the earlier "the model can't do
  // this" diagnosis was wrong — the actual problem was prompt structure
  // (layout contract buried under boilerplate) and canvas aspect ratio
  // (square, not landscape), both fixed above instead.
  IDENTITY_OUTFIT_THREE_QUARTER: ordinary,
  IDENTITY_OUTFIT_SIDE: geometry("Rotate the character into a strict 90-degree side profile, viewed from the side. The character's shoulders, torso, hips, legs and feet must all read clearly from the side. Only one eye may be visible. The nose must create a clear side silhouette. Full body visible from head to shoes. Neutral standing pose. Centered.", FULL_BODY_FRAMING),
  IDENTITY_OUTFIT_BACK: geometry("Rotate the character to be viewed from directly behind. Back of head fully visible. Face must not be visible. Both shoulders visible symmetrically. Full back of jacket/shirt/pants/shoes visible. Full body head to shoes. Neutral standing pose.", FULL_BODY_FRAMING),
  FACE_FRONT: crop,
  FACE_SIDE: geometry("Rotate to a head-and-shoulders strict 90-degree side profile. Only one eye visible. Clear nose, lips, chin and jaw silhouette. Preserve exact hairstyle and facial proportions.", HEAD_SHOULDERS_FRAMING),
  FACE_BACK: geometry("Rotate to a head-and-shoulders view directly from behind. Face completely hidden. Show rear hair shape, ears if naturally visible, neck and collar.", HEAD_SHOULDERS_FRAMING),
  SILHOUETTE_FRONT: adopt, SILHOUETTE_SIDE: adopt, SILHOUETTE_BACK: adopt,
  // One canonical character sheet (2026-09-13, major simplification;
  // renderer moved to Kling IMAGE O3 later the same day — see
  // klingSheetPolicy above) — authoritative for CURRENT generation.
  // Independent generation, no REQUIRED identity anchor, no derived
  // sub-assets — but MAY optionally take the current approved sheet as a
  // pure identity/style reference on Regenerate (Part 3B).
  CHARACTER_REFERENCE_SHEET: klingSheetPolicy,
  // 2026-09-20 "V3 Kling routing" fix — real incident: 16 of 17 Visual World
  // references (everything except the one character sheet) rendered on the
  // cheap Klein9B route regardless of the project's actual selected
  // High-Quality tier. There is no real per-project tier toggle wired to
  // Visual World generation today (confirmed: long_form_visual_world_
  // versions.render_tier exists but is never read or set anywhere in the
  // worker; renderer_tool_key is a separate, legacy FLUX-vs-Klein A/B
  // control restricted to non-Kling options) — rather than build a new,
  // untested tier-threading mechanism under time pressure, every
  // provider-generated Visual World reference now uses the SAME Kling IMAGE
  // O3 renderer the character sheet already (correctly) used, matching what
  // "V3 High Quality" already meant for that one role. Explicit image edits
  // remain on the separate precision-edit path.
  STYLE: klingSinglePolicy, DIAGRAM_STYLE: klingSinglePolicy,
  LOCATION: klingSinglePolicy, OBJECT: klingSinglePolicy, VEHICLE: klingSinglePolicy,
  // New reference roles (2026-09-20 "plants aren't characters" + "celestial
  // bodies aren't generic objects" fixes — see visualWorldStyle.ts's
  // resolveEffectiveEntityCategory/deriveRequiredViews).
  CELESTIAL: klingSinglePolicy, ENVIRONMENT: klingSinglePolicy,
});
const characterRoles = {
  three_quarter_neutral: "CHARACTER_IDENTITY_3Q", face_closeup: "CHARACTER_FACE", outfit_detail: "CHARACTER_OUTFIT_DETAIL", profile: "CHARACTER_PROFILE", back: "CHARACTER_BACK",
  front_full_body: "CHARACTER_FRONT_FULL",
  expression_neutral: "CHARACTER_EXPRESSION_NEUTRAL", expression_happy: "CHARACTER_EXPRESSION_HAPPY", expression_worried: "CHARACTER_EXPRESSION_WORRIED", expression_shocked: "CHARACTER_EXPRESSION_SHOCKED", expression_angry_focused: "CHARACTER_EXPRESSION_FOCUSED",
  identity_outfit_sheet: "CHARACTER_IDENTITY_OUTFIT_SHEET", face_sheet: "CHARACTER_FACE_SHEET", profile_silhouette_sheet: "CHARACTER_PROFILE_SILHOUETTE_SHEET",
  character_reference_sheet: "CHARACTER_REFERENCE_SHEET",
  identity_outfit_three_quarter: "IDENTITY_OUTFIT_THREE_QUARTER", identity_outfit_side: "IDENTITY_OUTFIT_SIDE", identity_outfit_back: "IDENTITY_OUTFIT_BACK",
  face_front: "FACE_FRONT", face_side: "FACE_SIDE", face_back: "FACE_BACK",
  silhouette_front: "SILHOUETTE_FRONT", silhouette_side: "SILHOUETTE_SIDE", silhouette_back: "SILHOUETTE_BACK",
};
export function resolveAssetRoleKey(asset) {
  return asset.reference_type === "character_reference" ? characterRoles[asset.angle_or_view] : String(asset.reference_type).replace("_reference", "").toUpperCase();
}
export function referenceRendererPolicy(asset) {
  return REFERENCE_RENDER_POLICY[resolveAssetRoleKey(asset)] ?? ordinary;
}
// Part 3 of the 2026-09-13 Generate/Edit routing-contract fix. Real incident
// this exists to make structurally impossible: character_reference_sheet's
// own "generate" policy is an INDEPENDENT Klein 4B generation (sheetPolicy,
// requiresIdentityAnchor:false) — but the actual dispatch code
// (advance-long-form-visual-world's stageGenerating) picked the tool_key
// purely from angle_or_view via referenceRendererPolicy(asset), with NO
// awareness of whether this asset row was an EDIT (asset.edit_instruction
// set by edit_long_form_reference_asset) or a fresh GENERATE/REGENERATE
// (retry_long_form_reference_asset never sets edit_instruction). Since
// character_reference_sheet's base policy is Klein 4B either way, clicking
// "Edit Reference" on a character sheet silently dispatched to Klein 4B
// instead of Qwen Image Edit Plus — the exact inverse of the user-reported
// "Regenerate wrongly uses Qwen" concern, but the same root cause class:
// the renderer was being inferred from asset role/history instead of from
// the OPERATION. This function is the one place that decides renderer from
// operation + role, and it fails loudly rather than silently picking the
// wrong model:
//   operation "generate"|"regenerate" -> this role's own generation policy,
//     UNLESS that policy has no identity-anchor requirement AND resolves to
//     Qwen (impossible for a bare/independent generation — Qwen is an
//     edit/anchor-conditioned renderer only) or a source image is present
//     (regenerate must never silently become image-to-image).
//   operation "edit" -> ALWAYS Qwen Image Edit Plus, and a source image is
//     REQUIRED (there is nothing to "edit" without one).
// Legacy anchor-required roles (Profile/Back/Face-derived-from-anchor) keep
// using Qwen for "generate" exactly as before — those are genuinely
// anchor-conditioned generations, not the button-level Edit Reference
// feature, and requiresIdentityAnchor:true is what licenses Qwen there.
export function resolveReferenceOperationRenderer({ operation, assetRole, referenceImageCount = 0 }) {
  if (operation === "edit") {
    if (referenceImageCount < 1) throw new Error(`RENDERER_POLICY_VIOLATION: EDIT REFERENCE requires a source image, got ${referenceImageCount}.`);
    return Object.freeze({ toolKey: SEEDREAM_5_PRO, requiresSourceImage: true });
  }
  if (operation === "generate" || operation === "regenerate") {
    // An unrecognized/unset role falls back to the plain independent
    // renderer (`ordinary`) — the same leniency referenceRendererPolicy(asset)
    // itself already had (`?? ordinary`) for a generic/unclassified
    // reference. This guardrail's job is to catch a REAL contract violation
    // (Qwen leaking into generate, an image leaking into a bare generation),
    // not to newly demand every caller pre-classify every asset — that would
    // just be a second, stricter routing system living next to the first.
    const policy = REFERENCE_RENDER_POLICY[assetRole] ?? ordinary;
    if (!policy.requiresIdentityAnchor && policy.toolKey === QWEN) {
      throw new Error(`RENDERER_POLICY_VIOLATION: ${operation} for role ${assetRole} resolved to Qwen Image Edit Plus with no identity-anchor requirement — Qwen is edit/anchor-conditioned only, never a bare generation renderer. Regenerate must never silently route through the edit model.`);
    }
    // Real incident (2026-09-14, "FINAL CHARACTER REFERENCE POLISH" fix):
    // Part 3B of the previous Kling migration briefly allowed Regenerate on
    // the canonical Kling character sheet to optionally send the approved
    // predecessor as a single identity/style reference. Live evidence (a
    // real maintenance-tech sheet) showed Kling over-copying that reference
    // — reproducing essentially the same prior composition instead of a
    // genuinely fresh generation, exactly the "silent image-to-image" this
    // guardrail exists to prevent. That exception is RETRACTED: Regenerate
    // must always send ZERO reference images, no exceptions, for every
    // independent-generation role including the Kling sheet. Only EDIT
    // REFERENCE (Qwen, above) may ever carry a source image.
    if (!policy.requiresIdentityAnchor && referenceImageCount !== 0) {
      throw new Error(`RENDERER_POLICY_VIOLATION: ${operation} for role ${assetRole} must send ZERO source images (this role is an independent generation), got ${referenceImageCount}. Regenerate must never silently become image-to-image.`);
    }
    return Object.freeze({ toolKey: policy.toolKey, requiresSourceImage: Boolean(policy.requiresIdentityAnchor) });
  }
  throw new Error(`RENDERER_POLICY_VIOLATION: unknown operation "${operation}".`);
}
// canonicalReference decides BOARD MEMBERSHIP ("is this a real row worth
// showing/counting at all", excluding discarded turnaround-sheet artifacts
// and rejected deterministic-crop experiments) — deliberately NOT where
// qa_status is enforced. A QA-rejected Profile must still be VISIBLE (Part
// 16: "Needs review" is a real, shown status, never a silently vanished
// row) — only USABILITY AS A DEPENDENCY (acceptedIdentityAnchor below, and
// its DB mirror accepted_reference_identity) checks qa_status, the same
// split this function already drew for the legacy qa_expectations.reviewStatus
// field on turnaround/crop experiment rows.
export function canonicalReference(asset) {
  return asset.generation_type !== "turnaround_master" &&
    (!["deterministic_crop", "role_edit_experiment"].includes(asset.generation_type) || asset.qa_expectations?.reviewStatus === "approved") &&
    asset.qa_expectations?.reviewStatus !== "rejected";
}
// Production Ready must mean "provider returned an ACCEPTABLE reference",
// not merely "provider returned an image" (Part 7) — qa_status is null for
// every row that predates the QA gate (Part 13 compatibility) and for any
// role the QA gate doesn't cover, so only an explicit 'pending'/'rejected'
// value ever excludes a row from being an accepted identity anchor.
// The old single-view 3Q anchor and the new Identity/Outfit sheet occupy
// the SAME "identity anchor" slot for their entity — exactly one exists per
// entity depending on which pack taxonomy it uses (mirrors the SQL
// accepted_reference_identity's own angle_or_view IN (...) exactly).
export const IDENTITY_ANCHOR_ANGLES = new Set(["three_quarter_neutral", "identity_outfit_sheet", "identity_outfit_three_quarter"]);
// Mirrors accepted_reference_identity's SQL exactly (20260929120000):
// regenerating an accepted identity must never blind dependents while the
// new candidate is still under review — a qa_status:'approved' row is
// ALWAYS eligible regardless of a newer non-approved candidate; a
// qa_status:null row is only trusted as "legacy approved" when nothing for
// this entity's identity-anchor angle has ever recorded a real qa_status.
export function acceptedIdentityAnchor(assets, target) {
  const eligible = assets.filter(canonicalReference);
  const replaced = new Set(eligible.map(a => a.replaces_asset_id).filter(Boolean));
  const scoped = eligible.filter(a => a.visual_world_version_id === target.visual_world_version_id && a.entity_id === target.entity_id && a.reference_type === "character_reference" && IDENTITY_ANCHOR_ANGLES.has(a.angle_or_view) && a.generation_type === "provider" && a.status === "succeeded" && a.result_url && !["pending", "rejected"].includes(a.qa_expectations?.reviewStatus));
  const anyQaTracked = scoped.some(a => a.qa_status != null);
  const candidates = scoped.filter(a => a.qa_status === "approved" || (a.qa_status == null && !anyQaTracked && !replaced.has(a.id)));
  if (!candidates.length) return null;
  return candidates.reduce((latest, a) => (!latest || a.created_at > latest.created_at ? a : latest), null);
}
// identitySpec (CharacterIdentitySpec, when the entity has one) drives the
// KEEP list explicitly — real incident this replaces: the previous version
// of this prompt hardcoded "jumpsuit design and colors, watch/accessories"
// regardless of the actual character, which is wrong for any character not
// wearing a jumpsuit/watch. referenceImageCount (1-3, Qwen's verified
// range) only changes the wording that describes how many reference images
// were supplied — the caller decides how many to actually pass.
// Runware rejects task creation outright when positivePrompt exceeds 1900
// chars (real incident: the original wording plus a verbose
// CharacterIdentitySpec — e.g. a multi-clause outfit description — pushed
// the compiled prompt to 2080 chars for the Mars protagonist, and the
// request never reached generation at all, HTTP 400 at task-creation time).
// Boilerplate below is trimmed for headroom; policy.orientation (the Part 6
// verbatim role instruction) and identitySpec content are never truncated,
// since those carry the actual identity/orientation requirements — only the
// surrounding wording is compacted. A hard slice is kept as a last-resort
// safety net so a still-oversized identitySpec fails loudly in QA rather
// than silently 400ing at the provider.
export const RUNWARE_POSITIVE_PROMPT_MAX = 1900;
// Real incident (2026-09-11, second occurrence): the truncation below only
// covers compileGeometryEdit's own output — the caller (advance-long-form-
// visual-world) appends a RETRY suffix on fallback attempts and an
// edit_instruction suffix on edits AFTER calling this function, silently
// pushing an already-compliant prompt back over 1900 chars and bypassing
// this safety net entirely (exactly what happened to a fallback_of_asset_id
// retry). Exported so the caller can apply the SAME cap once more as the
// true final step, after every append, immediately before dispatch.
export function clampPositivePrompt(prompt) {
  return prompt.length > RUNWARE_POSITIVE_PROMPT_MAX ? prompt.slice(0, RUNWARE_POSITIVE_PROMPT_MAX) : prompt;
}
export function compileGeometryEdit(asset, styleSummary, identitySpec, referenceImageCount = 1) {
  const policy = referenceRendererPolicy(asset);
  if (!policy.requiresIdentityAnchor || !policy.orientation) throw new Error("GEOMETRY_ROLE_REQUIRED");
  const keepList = identitySpec
    ? [
        `EXACT SAME PERSON as the reference(s) — never a different individual.`,
        `Age ${identitySpec.apparentAge}, ${identitySpec.sexPresentation} presentation, ${identitySpec.skinTone} skin.`,
        `Face: ${identitySpec.faceShape} shape, ${identitySpec.faceWidth} width, ${identitySpec.jawShape} jaw, ${identitySpec.chinShape} chin, ${identitySpec.noseShape} nose, ${identitySpec.eyeShape} eyes, ${identitySpec.eyebrowShape} brows.`,
        `Hair: ${identitySpec.hairstyle}, ${identitySpec.hairColor}. Facial hair: ${identitySpec.facialHair}.`,
        `Build: ${identitySpec.heightImpression}, ${identitySpec.shoulderWidth} shoulders, ${identitySpec.torsoBuild} torso.`,
        `Outfit: ${identitySpec.outfitSpec?.baseGarment} in ${identitySpec.outfitSpec?.colors}, same construction and accessories.`,
      ]
    : ["Preserve the exact same person's facial proportions, age, skin tone, hairstyle, hair color, facial hair, body build, outfit design and colors, accessories, illustration linework, shading and palette."];
  const compiled = [
    "[STYLE LOCK]",
    `EDIT THE PROVIDED CHARACTER REFERENCE${referenceImageCount > 1 ? "S" : ""}.`,
    ...keepList,
    referenceImageCount > 1 ? "REFERENCE 1: full outfit, body, proportions. REFERENCE 2: facial-identity crop of the SAME person — match its exact facial construction." : null,
    "CHANGE THE CAMERA ORIENTATION.", policy.orientation,
    "Visibly change the pose/orientation — do not reproduce the source pose or angle. References define WHO the person is, not the composition.",
    `FRAMING: ${policy.framing || "one isolated centered character, full character or canonical profile framing. Plain muted neutral background. No room, habitat, cockpit, vehicle interior or any environment/furniture."}`,
    "[CANONICAL REFERENCE NEGATIVE CONTRACT]",
    "NO infographic layout, explainer board, presentation board, educational poster, diagram, arrows, callouts or annotations.",
    "NO collage, split screen, contact sheet, multi-panel layout, duplicate subject, repeated copies or alternate views in one image.",
    "NO readable text, labels, captions, legends, logos, UI, numbers, symbols posing as text or watermarks.",
    "NO narrative action, before/after comparison, process sequence or finished story scene.",
    `Preserve the source illustration style. ${styleSummary || "Classic 2D Documentary: confident outlines, expressive cartoon anatomy, restrained flat shading, clear silhouettes, muted colors."}`,
  ].filter(Boolean).join("\n");
  return clampPositivePrompt(compiled);
}
// Forward-looking primitive for Scene Generation (not built yet — Part 9's
// "scene-reference resolution must only select qa_status='approved'"):
// resolves the CURRENT, usable asset for one entity/angle, the same
// "canonical + not superseded + not qa-rejected/pending" rule
// acceptedIdentityAnchor applies to the 3/4 master, generalized to any
// angle so a future scene-reference selector has one real function to call
// instead of re-deriving this filter logic per caller.
export function currentApprovedAsset(assets, entityId, angle) {
  const eligible = assets.filter(canonicalReference);
  const replaced = new Set(eligible.map(a => a.replaces_asset_id).filter(Boolean));
  const scoped = eligible.filter(a => a.entity_id === entityId && a.angle_or_view === angle && a.status === "succeeded" && a.result_url);
  const anyQaTracked = scoped.some(a => a.qa_status != null);
  const candidates = scoped.filter(a => a.qa_status === "approved" || (a.qa_status == null && !anyQaTracked && !replaced.has(a.id)));
  if (!candidates.length) return null;
  return candidates.reduce((latest, a) => (!latest || a.created_at > latest.created_at ? a : latest), null);
}
// Part 13 of the 2026-09-14 fix: "image:flux.base"/"runware:400@4" is
// labeled "FLUX Base" in the generic image-generator registry (src/lib/
// providers.ts) — a stale display name left over from an earlier phase.
// Verified directly against Runware's own docs (bfl-flux-2-klein-4b) that
// this AIR tag is actually Klein 4B, the legacy canonical-sheet renderer
// (superseded by Kling IMAGE O3) — this Long-Form-specific label override
// says so, rather than repeating the generic registry's misleading name.
// Always keyed by the asset's OWN persisted render_model, never by "what
// the current renderer policy would pick" — a historical Klein/Qwen asset
// must keep showing its real generation model even after the canonical
// renderer moves on.
export function savedReferenceModelLabel(asset) {
  return ({ "image:flux.base": "FLUX.2 Klein 4B", "runware:400@4": "FLUX.2 Klein 4B", [KLEIN]: "FLUX.2 Klein 9B KV", "runware:400@6": "FLUX.2 Klein 9B KV", [QWEN]: "Qwen Image Edit Plus", "runware:108@22": "Qwen Image Edit Plus", [KLING_O3]: "Kling IMAGE O3", "klingai:kling-image@o3": "Kling IMAGE O3", [SEEDREAM_5_PRO]: "Seedream 5.0 Pro", [SEEDREAM_5_PRO_AIR]: "Seedream 5.0 Pro", "deterministic:rgba-crop-v1": "Saved crop" })[asset?.render_model] ?? asset?.render_model ?? "Saved model";
}
