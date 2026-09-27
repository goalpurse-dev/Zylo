// deno-lint-ignore-file no-explicit-any
// SceneReferenceBundle — solves a real production blocker found auditing
// Mars (2026-09-15): Kling IMAGE O3 accepts at most ONE reference image
// (imageDimensionPolicy.ts's maxReferenceImages=1), but a real GENERATE
// beat routinely needs 2-5 canonical references (a character sheet, a
// location camera anchor, an object reference, sometimes more) — of the 32
// GENERATE SceneRenderPlans compiled so far for Mars's real V3 episode,
// every single one needs >=2 references and several need 4-5. Truncating
// the reference list to satisfy the provider's own limit would silently
// break the entire reason Visual World exists (Part 1: "a scene containing
// a canonical entity MUST visually inherit from the approved references").
//
// The fix is NOT an AI generation and costs $0: when a renderer's own
// verified reference-image limit is lower than what a scene genuinely
// needs, this module deterministically composites every one of that
// scene's canonical references into ONE reference-board image (a grid,
// most important reference first) and passes THAT single image as the
// renderer's one reference slot — the actual scene image still comes from
// exactly one real Kling call, conditioned on all the canonical material at
// once, with an explicit prompt instruction telling the model the supplied
// image is source material only, never a layout to reproduce.
import { fetchAndDecodeImage, decodeImage, encodePng, resizeImage, blitImage, drawRect, type RawImage } from "./sceneCompositor.ts";

export const BUNDLE_CONTRACT_VERSION = "reference-bundle-v1";
const CELL_SIZE = 768; // each reference gets a 768x768 cell — plenty of detail for a vision model, small enough to keep the composited board a reasonable upload size.
const BOARD_BACKGROUND: [number, number, number] = [16, 16, 18];

// Deterministic ordering: character identity first (most visually critical
// to get right), then location/camera-anchor, then object/machine, then
// anything else — ties broken by entity_id then asset id for full
// stability (Part 2: "use deterministic region ordering").
const TYPE_PRIORITY: Record<string, number> = { character_reference: 0, location_reference: 1, object_reference: 2 };
function priorityOf(referenceType: string | null | undefined): number {
  return TYPE_PRIORITY[referenceType ?? ""] ?? 3;
}

export type CanonicalReferenceAsset = { id: string; result_url: string; reference_type?: string | null; entity_id?: string | null; entity_name?: string | null };

export function sortCanonicalReferences(assets: CanonicalReferenceAsset[]): CanonicalReferenceAsset[] {
  return [...assets].sort((a, b) =>
    priorityOf(a.reference_type) - priorityOf(b.reference_type) ||
    String(a.entity_id ?? "").localeCompare(String(b.entity_id ?? "")) ||
    a.id.localeCompare(b.id)
  );
}

// Stable across identical inputs regardless of DB query row order — the
// caller must pass ALREADY-sorted asset ids (sortCanonicalReferences then
// map to id) so the same real set of references always hashes the same,
// making the bundle genuinely cacheable/reusable (Part 2).
export async function computeBundleHash(visualWorldVersionId: string, sortedAssetIds: string[], contractVersion = BUNDLE_CONTRACT_VERSION): Promise<string> {
  const input = `${visualWorldVersionId}:${sortedAssetIds.join(",")}:${contractVersion}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Pure grid compositor — no network calls, no randomness, same input always
// produces the same pixels. Cols/rows grow to fit any count (never caps or
// drops a reference): cols = ceil(sqrt(n)), rows = ceil(n/cols).
export function buildReferenceBundleImage(sourceImages: RawImage[]): RawImage {
  const n = sourceImages.length;
  if (n === 0) throw new Error("REFERENCE_BUNDLE_EMPTY");
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const board: RawImage = { width: cols * CELL_SIZE, height: rows * CELL_SIZE, data: new Uint8Array(cols * CELL_SIZE * rows * CELL_SIZE * 4) };
  drawRect(board, 0, 0, board.width, board.height, BOARD_BACKGROUND, 255);
  sourceImages.forEach((img, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    // Fit the source into its cell preserving aspect ratio (letterboxed on
    // the shorter axis) rather than stretching — a squashed character
    // reference would itself corrupt the very identity this exists to
    // preserve.
    const scale = Math.min(CELL_SIZE / img.width, CELL_SIZE / img.height);
    const fitted = resizeImage(img, Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)));
    const offsetX = col * CELL_SIZE + Math.round((CELL_SIZE - fitted.width) / 2);
    const offsetY = row * CELL_SIZE + Math.round((CELL_SIZE - fitted.height) / 2);
    blitImage(board, fitted, offsetX, offsetY);
  });
  return board;
}

// Explicit reference-board framing (Part 2's exact requirement) — tells the
// model the supplied image is conditioning material, not a layout to
// reproduce, and maps each grid position to what it must preserve.
export function bundlePromptInstruction(assets: CanonicalReferenceAsset[]): string {
  const lines = [
    "REFERENCE BOARD: The supplied image contains canonical reference material for this scene, arranged as a grid. It is source material ONLY.",
    "Do NOT reproduce the board/collage/grid layout. Output ONE finished cinematic 16:9 scene.",
    "Preserve, from each reference panel in the board:",
  ];
  assets.forEach((a, i) => {
    const kind = a.reference_type === "character_reference" ? "character identity/outfit" : a.reference_type === "location_reference" ? "location geometry/design" : a.reference_type === "object_reference" ? "object/machine design" : "visual identity";
    lines.push(`- Panel ${i + 1} (${a.entity_name ?? a.entity_id ?? a.id}): ${kind}, exactly as shown.`);
  });
  lines.push("Integrate all of the above naturally into the requested scene composition.");
  return lines.join("\n");
}

// Structural (text-only) description of a reference this beat needs but
// isn't sending a pixel for — Section 2's option (B/C): "reduce reference
// criticality and describe lower-priority assets structurally" rather than
// flattening everything that doesn't fit into a visible collage. Mirrors
// bundlePromptInstruction's own per-panel phrasing so a caller merging this
// into a prompt gets the same voice regardless of which path was taken.
export function describeReferenceStructurally(asset: CanonicalReferenceAsset): string {
  const kind = asset.reference_type === "character_reference" ? "character identity/outfit" : asset.reference_type === "location_reference" ? "location geometry/design" : asset.reference_type === "object_reference" ? "object/machine design" : "visual identity";
  return `${asset.entity_name ?? asset.entity_id ?? asset.id}: present in this scene (${kind} described in text only — no dedicated reference image was sent for it).`;
}

// The ONE authoritative helper every dispatch path must call to get a
// renderer-safe reference payload (Part 3) — never hand-rolled per call
// site, and NEVER a silent truncation. Returns the URLs to actually send to
// the provider (always length <= the renderer's own verified max) plus
// whether a bundle was used (so the caller can append bundlePromptInstruction
// to the prompt only when it's actually true).
//
// 2026-09-16 "production invariants" pass (Section 1/2) — real Mars
// incident: shots 1/18/32 all shipped with a visible character reference
// sheet leaked into the final frame, traced to THIS function's old default
// behavior — whenever more canonical references existed than the renderer's
// slot limit, EVERY one got composited into a visible grid board and handed
// to Kling as its one reference image, which Kling sometimes reproduced
// literally instead of treating as conditioning material (the "architecture
// review already warned a composite reference board is ambiguous to Kling"
// concern this task opens with). The compile-time Reference Resolver
// (sceneRenderPlan.ts's selectMinimalReferenceSet, now correctly including
// the location — see start-long-form-scene-generation) should mean
// `canonicalReferenceAssets` essentially never exceeds maxReferenceImages
// in practice any more, but this function must still fail SAFE on its own
// if that invariant is ever violated by a future caller — so the default
// when it IS exceeded is no longer "flatten into a visible collage," it's
// "send the single highest-priority reference as the real image, describe
// every other one structurally in text." The visible-collage grid path
// (buildReferenceBundleImage) is kept for the rare case a caller explicitly
// opts in (`allowVisualCollage: true` — e.g. a future capability-aware
// route to a true multi-reference renderer like Seedream 5 Lite that can
// actually use a real multi-image grid safely), never as the silent default.
export async function resolveSceneReferencePayload(args: {
  admin: any; renderModel: string; maxReferenceImages: number | undefined;
  visualWorldVersionId: string; canonicalReferenceAssets: CanonicalReferenceAsset[];
  allowVisualCollage?: boolean;
}): Promise<{ referenceUrls: string[]; usedBundle: boolean; sortedAssets: CanonicalReferenceAsset[]; promptInstruction: string | null; structuralOnlyAssets: CanonicalReferenceAsset[] }> {
  const { admin, maxReferenceImages, visualWorldVersionId, canonicalReferenceAssets, allowVisualCollage } = args;
  const sorted = sortCanonicalReferences(canonicalReferenceAssets);
  if (sorted.length === 0) return { referenceUrls: [], usedBundle: false, sortedAssets: sorted, promptInstruction: null, structuralOnlyAssets: [] };
  if (typeof maxReferenceImages !== "number" || sorted.length <= maxReferenceImages) {
    return { referenceUrls: sorted.map((a) => a.result_url), usedBundle: false, sortedAssets: sorted, promptInstruction: null, structuralOnlyAssets: [] };
  }

  if (!allowVisualCollage) {
    const [head, ...rest] = sorted;
    return {
      referenceUrls: [head.result_url], usedBundle: false, sortedAssets: sorted,
      promptInstruction: rest.length ? `Additional context (no reference image sent — described here only):\n${rest.map((a) => `- ${describeReferenceStructurally(a)}`).join("\n")}` : null,
      structuralOnlyAssets: rest,
    };
  }

  const sortedIds = sorted.map((a) => a.id);
  const bundleHash = await computeBundleHash(visualWorldVersionId, sortedIds);

  const { data: existing } = await admin.from("long_form_scene_reference_bundles").select("storage_url").eq("bundle_hash", bundleHash).maybeSingle();
  if (existing?.storage_url) {
    return { referenceUrls: [existing.storage_url], usedBundle: true, sortedAssets: sorted, promptInstruction: bundlePromptInstruction(sorted), structuralOnlyAssets: [] };
  }

  const sourceImages: RawImage[] = [];
  for (const asset of sorted) {
    const response = await fetch(asset.result_url);
    if (!response.ok) throw new Error(`REFERENCE_BUNDLE_SOURCE_DOWNLOAD_FAILED: ${asset.id}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    sourceImages.push(decodeImage(bytes, response.headers.get("content-type") ?? "image/jpeg"));
  }
  const board = buildReferenceBundleImage(sourceImages);
  const png = encodePng(board);
  const path = `long-form/reference-bundles/${bundleHash}.png`;
  const { error: uploadError } = await admin.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
  if (uploadError) throw uploadError;
  const { data: publicUrl } = admin.storage.from("generated").getPublicUrl(path);

  const { error: insertError } = await admin.from("long_form_scene_reference_bundles").insert({
    bundle_hash: bundleHash, visual_world_version_id: visualWorldVersionId, source_reference_asset_ids: sortedIds,
    layout_version: BUNDLE_CONTRACT_VERSION, storage_url: publicUrl.publicUrl,
  }).select("id").maybeSingle();
  // A concurrent dispatch could have inserted the identical bundle between
  // our lookup and this insert (bundle_hash is unique) — that's fine, the
  // URL we just computed and uploaded is byte-identical either way since
  // this whole function is deterministic; only log, never fail dispatch
  // over a harmless race on a cache table.
  if (insertError && insertError.code !== "23505") throw insertError;

  return { referenceUrls: [publicUrl.publicUrl], usedBundle: true, sortedAssets: sorted, promptInstruction: bundlePromptInstruction(sorted), structuralOnlyAssets: [] };
}
