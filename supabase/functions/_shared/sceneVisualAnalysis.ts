// deno-lint-ignore-file no-explicit-any
// Local, zero-provider-cost visual analysis for Scene QA (Part 12/13 of the
// 2026-09-15 visual-variety/QA-calibration pass): a perceptual hash for
// near-duplicate/insufficient-delta detection, a sharpness metric for blur
// detection, and a deterministic narration-based VisualDelta classifier for
// EDIT beats — all pure pixel/text math, no network calls beyond the two
// image downloads the caller already needs for compositing/QA anyway.
import { type RawImage, resizeImage } from "./sceneCompositor.ts";

function toGrayscale8x8(img: RawImage): number[] {
  const small = resizeImage(img, 8, 8);
  const values: number[] = [];
  for (let i = 0; i < 64; i++) {
    const o = i * 4;
    values.push(0.299 * small.data[o] + 0.587 * small.data[o + 1] + 0.114 * small.data[o + 2]);
  }
  return values;
}

// Average hash (aHash) — a well-known, cheap, dependency-free perceptual
// hash: downsample to 8x8 grayscale, threshold each pixel against the mean.
// Two images of the same real scene (even after a genuine, successful edit)
// still typically differ in >10-15 of the 64 bits; a near-identical "edit
// that changed nothing" typically differs in <5.
export function computePerceptualHash(img: RawImage): string {
  const values = toGrayscale8x8(img);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  let bits = "";
  for (const v of values) bits += v >= mean ? "1" : "0";
  return bits;
}

export function hammingDistance(hashA: string, hashB: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(hashA.length, hashB.length); i++) if (hashA[i] !== hashB[i]) d++;
  return d;
}

// Below this Hamming distance (out of 64 bits), two images are considered
// near-duplicates for the purpose of "did this EDIT actually change
// anything visible". Calibrated against the REAL Mars run (2026-09-15
// audit), not guessed: decoding all 42 real succeeded EDIT scenes and their
// real sources found a continuous spread from distance 5 to 32, with the
// bottom cluster (5, 6, 6, 6, 8, 8) matching EXACTLY the beats whose own
// compiled editInstruction asked only for a contrast/legibility/color-grade
// tweak ("increase screen clarity and contrast", "slightly narrow depth of
// field", "increase contrast on the sensor trace lines" — all explicitly
// "keep composition/characters/lighting identical" otherwise) — i.e. real,
// confirmed instances of the exact "EDIT looks nearly identical to source"
// defect this task was asked to catch. 8 is set just above that cluster: it
// catches those 6/42 confirmed-trivial edits without reaching into the
// distance-9+ range where genuinely material (if visually localized)
// changes start appearing.
export const NEAR_DUPLICATE_HAMMING_THRESHOLD = 8;

// Sharpness proxy: mean absolute gradient between adjacent pixels on a
// downsampled grayscale grid — a cheap stand-in for a Laplacian-variance
// sharpness score that needs no convolution library. Blur reduces local
// contrast between neighboring pixels, so a blurred image scores lower.
// Deliberately coarse (32x32) — this is meant to catch a MAJOR, visually
// obvious softness relative to a source image, never to grade fine
// photographic sharpness (which would flag stylized/flat illustration line
// art as "blurry" for having genuinely low local contrast by design).
export function computeSharpness(img: RawImage): number {
  const small = resizeImage(img, 32, 32);
  const gray: number[] = [];
  for (let i = 0; i < 32 * 32; i++) {
    const o = i * 4;
    gray.push(0.299 * small.data[o] + 0.587 * small.data[o + 1] + 0.114 * small.data[o + 2]);
  }
  let total = 0, count = 0;
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const i = y * 32 + x;
      if (x < 31) { total += Math.abs(gray[i] - gray[i + 1]); count++; }
      if (y < 31) { total += Math.abs(gray[i] - gray[i + 32]); count++; }
    }
  }
  return count ? total / count : 0;
}

// Only a LARGE relative drop counts as major — comparing an edit's own
// sharpness to its OWN source (never an absolute threshold, which would
// misfire on legitimately flat/minimal illustration style) is what Part 13
// explicitly asks for: "for EDIT specifically, compare output sharpness to
// source sharpness. A large degradation relative to its own source is
// meaningful." Ratios are conservative (blur is a visibly obvious defect,
// not graded on fine differences) so ordinary color-grading/lighting
// variance between two real renders never trips this.
export function classifyBlurSeverity(outputSharpness: number, sourceSharpness: number | null): "none" | "minor" | "major" {
  if (sourceSharpness == null || sourceSharpness <= 0) return "none";
  const ratio = outputSharpness / sourceSharpness;
  if (ratio < 0.45) return "major";
  if (ratio < 0.7) return "minor";
  return "none";
}

// Deterministic VisualDelta classifier (Part 9) — categorizes what KIND of
// concrete visual change a shot's narration actually describes, so an EDIT
// beat's instruction can be built from an EXPLICIT delta category instead
// of raw narration text alone (the real root cause found auditing Mars:
// compileEditInstruction previously just forwarded the raw narration
// sentence to Qwen with a generic "preserve everything except the described
// change" wrapper — for narration that isn't concretely visual, that gives
// Qwen nothing concrete to act on, and it tends to make a near-identity
// edit). `lightingOnly` narrations (Part 9: "lighting by itself does not
// count unless the narration is specifically about lighting/time-of-day")
// are deliberately reported separately from the other categories so a
// caller can require at least one NON-lighting category before trusting an
// EDIT to produce a real delta.
export type VisualDeltaCategories = {
  handActionDelta: boolean; headDirectionDelta: boolean; gazeDelta: boolean; facialExpressionDelta: boolean;
  propStateDelta: boolean; screenStateDelta: boolean; environmentStateDelta: boolean; cameraDistanceDelta: boolean;
  lightingDelta: boolean; timeOfDayNarration: boolean;
};
const HAND_ACTION = /\b(reach|grab|point|adjust|turn\w* (?:a |the |it)|move[sd]?\b|feed|press|pull|push|hold|release|touch|lift|set down|pick up|type|tap)\w*\b/i;
const HEAD_GAZE = /\b(looks?|glances?|gazes?|turns? (?:his|her|their|to) head|faces?|stares?|watches?)\b/i;
const EXPRESSION = /\b(smiles?|frowns?|concerned|worried|relief|relieved|surprised?|focused?|grimaces?|winces?)\b/i;
const PROP_STATE = /\b(opens?|closes?|lights? up|ignites?|glows?|blinks?|flashes?|activates?|extinguish\w*|unlock\w*|latch\w*)\b/i;
const SCREEN_STATE = /\b(screen|display|readout|checklist|alert|warning|status|panel)\w*\b.{0,40}\b(changes?|updates?|flags?|shows?|switch\w*|flip\w*)\b/i;
// Deliberately excludes "grows"/"fades" — both overlap almost entirely with
// lighting descriptions ("the light grows dim", "the glow fades"), which is
// exactly the ambiguous case Part 9 wants EXCLUDED unless it's specifically
// a time-of-day narration.
const ENVIRONMENT_STATE = /\b(fills?|drains?|rises?|falls?|thickens?|clears?|spreads?)\b/i;
const LIGHTING = /\b(lighting|glow|bright(?:en|er|ness)?|dim(?:mer|s)?|dark(?:en|er|ness)?|shadow)\w*\b/i;
const TIME_OF_DAY = /\b(sunrise|sunset|dawn|dusk|nightfall|daylight|morning light|evening light|time of day)\b/i;

export function classifyVisualDelta(narrationText: string): VisualDeltaCategories {
  const t = narrationText ?? "";
  return {
    handActionDelta: HAND_ACTION.test(t), headDirectionDelta: HEAD_GAZE.test(t), gazeDelta: HEAD_GAZE.test(t),
    facialExpressionDelta: EXPRESSION.test(t), propStateDelta: PROP_STATE.test(t), screenStateDelta: SCREEN_STATE.test(t),
    environmentStateDelta: ENVIRONMENT_STATE.test(t), cameraDistanceDelta: false, // derived by the caller from shotSize comparison, not text
    lightingDelta: LIGHTING.test(t), timeOfDayNarration: TIME_OF_DAY.test(t),
  };
}

// True once at least one MATERIAL (non-lighting) category is present, or
// lighting is present AND the narration is genuinely about time-of-day
// (Part 9's explicit exception).
export function hasMaterialVisualDelta(categories: VisualDeltaCategories): boolean {
  const { lightingDelta, timeOfDayNarration, ...material } = categories;
  if (Object.values(material).some(Boolean)) return true;
  return lightingDelta && timeOfDayNarration;
}

// Deterministic reference-leakage BACKSTOP (2026-09-16 "production
// invariants" pass, Section 3) — a defense-in-depth check independent of
// the vision QA model's own judgment, closing a REAL false-negative found
// auditing Mars: shot 32 shipped with an unmistakable reference-sheet leak
// (confirmed by directly viewing the file — half the frame is a 5-pose
// character turnaround) yet the vision model scored it
// referenceLeakageDetected:false, severity:AUTO_READY. The vision prompt
// asking "does this look like a collage" is inherently probabilistic; this
// check is not — it directly compares regions of the OUTPUT image against
// the actual source images that were composited into this scene's
// reference bundle (when one was used), using the same cheap perceptual
// hash already proven for near-duplicate detection above. A false NEGATIVE
// here (missing a real leak) is still possible if Kling transformed the
// leaked material significantly; a false POSITIVE is structurally
// impossible to cause harm — it only ever adds a HARD_FAIL that a human
// would have caught anyway from looking at the same evidence this computes.
//
// Mirrors buildReferenceBundleImage's own grid math exactly (cols =
// ceil(sqrt(n)), rows = ceil(n/cols), reading order = sortCanonicalReferences'
// order) so "cell i of the bundle" always means the same source image on
// both the write side (sceneReferenceBundle.ts) and this read side.
export function detectStructuralReferenceLeakage(outputImg: RawImage, bundleSourceImages: RawImage[]): { leaked: boolean; matchedSourceIndex: number | null; distance: number | null } {
  if (!bundleSourceImages.length) return { leaked: false, matchedSourceIndex: null, distance: null };
  const n = bundleSourceImages.length;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellWidth = Math.max(1, Math.floor(outputImg.width / cols));
  const cellHeight = Math.max(1, Math.floor(outputImg.height / rows));
  let best = { leaked: false, matchedSourceIndex: null as number | null, distance: null as number | null };
  for (let i = 0; i < n; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const region: RawImage = { width: cellWidth, height: cellHeight, data: new Uint8Array(cellWidth * cellHeight * 4) };
    for (let y = 0; y < cellHeight; y++) {
      const srcRowStart = ((row * cellHeight + y) * outputImg.width + col * cellWidth) * 4;
      (region.data as Uint8Array).set((outputImg.data as Uint8Array).subarray(srcRowStart, srcRowStart + cellWidth * 4), y * cellWidth * 4);
    }
    const distance = hammingDistance(computePerceptualHash(region), computePerceptualHash(bundleSourceImages[i]));
    // A tighter threshold than NEAR_DUPLICATE_HAMMING_THRESHOLD (8) on
    // purpose — this is comparing a CROPPED GRID CELL of the final output
    // against a full reference image, a noisier comparison than the EDIT-
    // vs-its-own-source case that threshold was calibrated against, so it
    // is set stricter (lower) to keep false positives rare even though it
    // costs some recall.
    if (distance <= 6 && (best.distance == null || distance < best.distance)) best = { leaked: true, matchedSourceIndex: i, distance };
  }
  return best;
}
