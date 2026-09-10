// Verified 2026-09-10: https://runware.ai/docs/models/alibaba-qwen-image-edit-plus
export const KLEIN = "image:flux2.klein9bkv";
export const QWEN = "image:qwen.image-edit-plus";
const ordinary = Object.freeze({ toolKey: KLEIN, requiresIdentityAnchor: false });
const geometry = (orientation) => Object.freeze({ toolKey: QWEN, requiresIdentityAnchor: true, orientation });
export const REFERENCE_RENDER_POLICY = Object.freeze({
  CHARACTER_IDENTITY_3Q: ordinary, CHARACTER_FACE: ordinary, CHARACTER_OUTFIT_DETAIL: ordinary,
  CHARACTER_PROFILE: geometry("Rotate the character into a STRICT 90-DEGREE SIDE PROFILE. Head exactly side-on, clear forehead/nose/lips/chin silhouette, ONE eye visible only, one ear visible. Shoulders and body consistently side-on. No frontal or three-quarter face."),
  CHARACTER_BACK: geometry("Rotate the character into a strict BACK VIEW facing completely away. Face and eyes invisible. Show the back of the same hairstyle and outfit; shoulders and body face away."),
  LOCATION: ordinary, OBJECT: ordinary, VEHICLE: ordinary,
});
const characterRoles = { three_quarter_neutral: "CHARACTER_IDENTITY_3Q", face_closeup: "CHARACTER_FACE", outfit_detail: "CHARACTER_OUTFIT_DETAIL", profile: "CHARACTER_PROFILE", back: "CHARACTER_BACK" };
export function referenceRendererPolicy(asset) {
  return REFERENCE_RENDER_POLICY[asset.reference_type === "character_reference" ? characterRoles[asset.angle_or_view] : String(asset.reference_type).replace("_reference", "").toUpperCase()] ?? ordinary;
}
export function canonicalReference(asset) {
  return asset.generation_type !== "turnaround_master" &&
    (!["deterministic_crop", "role_edit_experiment"].includes(asset.generation_type) || asset.qa_expectations?.reviewStatus === "approved") &&
    asset.qa_expectations?.reviewStatus !== "rejected";
}
export function acceptedIdentityAnchor(assets, target) {
  const eligible = assets.filter(canonicalReference);
  const replaced = new Set(eligible.map(a => a.replaces_asset_id).filter(Boolean));
  const candidates = eligible.filter(a => a.visual_world_version_id === target.visual_world_version_id && a.entity_id === target.entity_id && a.reference_type === "character_reference" && a.angle_or_view === "three_quarter_neutral" && a.generation_type === "provider" && a.status === "succeeded" && a.result_url && !replaced.has(a.id) && !["pending", "rejected"].includes(a.qa_expectations?.reviewStatus));
  return candidates.length === 1 ? candidates[0] : null;
}
export function compileGeometryEdit(asset, styleSummary) {
  const policy = referenceRendererPolicy(asset);
  if (!policy.requiresIdentityAnchor) throw new Error("GEOMETRY_ROLE_REQUIRED");
  return [
    "EDIT THE PROVIDED CHARACTER REFERENCE. Preserve the exact same person's facial proportions, age, skin tone, hairstyle, hair color, facial hair, body build, jumpsuit design and colors, watch/accessories, illustration linework, shading and palette.",
    "CHANGE THE CAMERA ORIENTATION.", policy.orientation,
    "This must visibly change the pose/orientation from the source. Do not reproduce the source pose or camera angle. The input defines WHO THE PERSON IS, not the target camera composition.",
    "REFERENCE-SHEET FRAMING: one isolated centered character in a neutral relaxed standing pose, full character or suitable canonical profile framing. Plain muted neutral background. No Mars room, cockpit, environment or furniture.",
    "TEXT: no readable or fake text, letters, numbers, names, logos or readable badges. Every patch/badge must be blank or abstract-symbol-only. No text-like scribbles.",
    `Preserve the source illustration style. ${styleSummary || "Classic 2D Documentary: confident dark outlines, clean expressive cartoon anatomy, restrained flat shading, clear silhouettes, controlled muted colors."}`,
  ].join("\n");
}
export function savedReferenceModelLabel(asset) {
  return ({ "image:flux.base": "FLUX Base", "runware:400@4": "FLUX Base", [KLEIN]: "FLUX.2 Klein 9B KV", "runware:400@6": "FLUX.2 Klein 9B KV", [QWEN]: "Qwen Image Edit Plus", "runware:108@22": "Qwen Image Edit Plus", "deterministic:rgba-crop-v1": "Saved crop" })[asset?.render_model] ?? asset?.render_model ?? "Saved model";
}
