export const SHEET_ROLES = new Set(["identity_outfit_sheet", "face_sheet", "profile_silhouette_sheet"]);
export const DERIVED_SHEET_ROLES = new Set(["face_sheet", "profile_silhouette_sheet"]);
export const SHEET_CONTRACT_VERSION = "sheet-isolation-v5";

export function assertSheetAnchor(asset, anchor) {
  if (!DERIVED_SHEET_ROLES.has(asset.angle_or_view)) return;
  if (!anchor || anchor.angle_or_view !== "identity_outfit_sheet" || anchor.reference_type !== "character_reference" || anchor.qa_status !== "approved" || anchor.stale || anchor.status !== "succeeded" || !anchor.result_url || anchor.entity_id !== asset.entity_id || anchor.visual_world_version_id !== asset.visual_world_version_id) throw new Error("CURRENT_APPROVED_IDENTITY_SHEET_REQUIRED");
}

export function assertReferenceCompletion(asset, job) {
  if (!job || job.id !== asset.job_id || job.settings?.long_form_reference_asset_id !== asset.id) throw new Error("REFERENCE_JOB_ASSET_MISMATCH");
  const role = job.settings?.long_form_reference_role;
  if (role && role !== asset.angle_or_view) throw new Error("REFERENCE_JOB_ROLE_MISMATCH");
  if (job.prompt !== asset.prompt_snapshot) throw new Error("REFERENCE_JOB_PROMPT_MISMATCH");
  const task = job.settings?.provider_job_id;
  const results = job.output?.data ?? [];
  if (job.status === "succeeded" && (!task || results.length !== 1 || results[0].taskUUID !== task)) throw new Error("REFERENCE_PROVIDER_TASK_MISMATCH");
  if (DERIVED_SHEET_ROLES.has(asset.angle_or_view) && (asset.input_reference_asset_ids?.length !== 1 || job.input?.ref_images?.length !== 1)) throw new Error("SHEET_REFERENCE_COUNT_MISMATCH");
}

export function compileIsolatedSheetEdit(role, styleSummary = "") {
  const layout = {
    face_sheet: "EXACTLY THREE HEAD-AND-SHOULDERS VIEWS OF THE SAME EXACT CHARACTER. LEFT: front face looking directly ahead. CENTER: strict 90-degree side profile of the face, exactly one eye visible, clear nose/lips/chin silhouette. RIGHT: back-of-head view, face completely hidden, rear hair and collar visible. Three portrait busts only, aligned at the eyes, equally sized. Head and shoulders only: frame each view from above the hair to the shoulders. No full body, legs or hands.",
    profile_silhouette_sheet: "EXACTLY THREE FULL-BODY VIEWS OF THE SAME EXACT CHARACTER. LEFT: straight front view (not three-quarter). CENTER: strict 90-degree side profile. RIGHT: straight rear view with face hidden. All three complete figures from head to shoes, nothing cropped, equally sized and spaced, feet on one baseline. Arms relaxed at sides. Preserve the exact source body proportions and clothing construction.",
  }[role];
  if (!layout) throw new Error("DERIVED_SHEET_ROLE_REQUIRED");
  return [
    `ROLE CONTRACT: ${role}. EDIT THE SINGLE PROVIDED IDENTITY/OUTFIT SHEET.`,
    "The supplied reference image defines the exact character identity. Do not copy its panel composition, pose or camera framing.",
    "The reference is the sole identity source. Preserve the exact person, face shape, age, skin tone, hair shape/color, beard shape/color, clothing colors, accessories, linework and shading. Do not redesign, darken the beard, recolor clothing, or change body proportions.",
    "Make ONE landscape image with three views arranged left to right on a plain warm off-white background.",
    layout,
    "Change framing/orientation only as specified. No room, scenery, furniture, props, text, letters, numbers, logos or labels. Any patch stays blank.",
    `Preserve the reference's illustration style. ${String(styleSummary).slice(0, 250)}`,
  ].join("\n");
}
