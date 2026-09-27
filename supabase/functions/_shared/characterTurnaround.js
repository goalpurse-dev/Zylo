import { canonicalReference } from "./referenceRendererPolicy.js";
export const TURNAROUND = Object.freeze({ width: 1536, height: 1024, columns: 3, rows: 2, toolKey: "image:flux2.klein9bkv", model: "runware:400@6" });
export const TURNAROUND_ROLES = ["three_quarter_neutral", "profile", "back", "face_closeup", "outfit_detail"];
export const CHARACTER_REFERENCE_STRATEGIES = ["MULTIVIEW_MASTER", "INDEPENDENT", "REFERENCE_CONDITIONED"];
export function isCanonicalReference(asset) {
  return canonicalReference(asset);
}

// Rollout is explicit and off until a real master passes visual review.
export function characterReferenceStrategy(entity, model, policy = {}) {
  if (entity.importance === "INCIDENTAL") return null;
  if (policy.strategy && !CHARACTER_REFERENCE_STRATEGIES.includes(policy.strategy)) throw new Error("Unknown character strategy");
  if (entity.importance === "HERO" && model === TURNAROUND.toolKey && policy.multiviewApproved) return policy.strategy ?? "MULTIVIEW_MASTER";
  if (policy.strategy === "MULTIVIEW_MASTER") throw new Error("Turnaround rollout requires an approved HERO policy");
  return policy.strategy ?? "REFERENCE_CONDITIONED";
}

export function turnaroundCells(includePose = false) {
  return [...TURNAROUND_ROLES, ...(includePose ? ["action_pose"] : [])].map((key, index) => ({
    key, rect: { x: (index % 3) * 512, y: Math.floor(index / 3) * 512, width: 512, height: 512 },
  }));
}

export function turnaroundQA(role) {
  return { profileExpected: role === "profile", rearExpected: role === "back", faceCropExpected: role === "face_closeup", neutralBackgroundExpected: true, generatedTextForbidden: true, generatedTextIsFailure: true, reviewStatus: "pending", automatedVisionPerformed: false };
}

export function compileTurnaroundMaster({ styleSpec, canonicalSpec, appearanceLock, forbiddenElements = [], includePose = false }) {
  if (!appearanceLock?.trim()) throw new Error("A concrete character appearance lock is required");
  const prompt = [
    "CREATE A CLEAN PROFESSIONAL ANIMATION PRODUCTION CHARACTER TURNAROUND REFERENCE SHEET.",
    "ONE image, exactly THREE equal columns by TWO equal rows. Six equal square cells, separated by clean empty gutters. Keep every subject inside its own cell with generous margins. No drawn panel borders or dividing lines.",
    "Show the EXACT SAME CHARACTER in every occupied cell. Preserve facial structure, hairstyle, hair color, facial hair, skin tone, age, body proportions, outfit colors and construction, footwear, accessories, illustration style, line thickness and shading language.",
    `CANONICAL APPEARANCE: ${appearanceLock}`,
    `Supporting costume specification (appearance only; any text, setting or action is overridden by the layout and no-text rules): ${canonicalSpec}`,
    `STYLE: ${styleSpec.summary} Linework: ${styleSpec.linework} Shading: ${styleSpec.shading} Palette: ${styleSpec.palette}`,
    "TOP LEFT: true three-quarter neutral full-body character, head to footwear inside this cell.",
    "TOP CENTER: STRICT 90-DEGREE SIDE PROFILE, body AND head side-on, clear nose and chin silhouette, only one eye visible. NOT frontal, NOT three-quarter. Full body inside cell.",
    "TOP RIGHT: BACK VIEW facing completely away, face invisible, back of hairstyle and outfit readable. Full body inside cell.",
    "BOTTOM LEFT: HEAD AND SHOULDERS FACE REFERENCE, large readable face, neutral expression, same facial identity.",
    "BOTTOM CENTER: OUTFIT / EQUIPMENT REFERENCE, clothing silhouette, same jacket, trousers, footwear and recurring wrist equipment. No invented accessories or lettering.",
    includePose ? "BOTTOM RIGHT: neutral alternate standing pose of the same character." : "BOTTOM RIGHT: leave completely empty neutral background. No sixth pose was requested.",
    "Plain neutral studio background in every cell. NO ROOM. NO MARS HABITAT. NO ENVIRONMENT. NO FURNITURE. NO CINEMATIC SCENERY. This is a production turnaround, not six cinematic screenshots.",
    "NO readable OR fake text. NO letters, numbers, names, name tags, readable badges, logos, signage, watermarks, captions, labels, panel names, arrows, UI. Never render the layout instructions. Every patch must be blank or abstract-symbol-only. Text-like scribbles are also forbidden.",
    ...forbiddenElements.map(value => `Forbidden: ${value}`),
  ].join("\n");
  if (prompt.length > 10000) throw new Error("Turnaround prompt exceeds provider contract");
  return prompt;
}

// RGBA copy: no resampling, model call or model-provided coordinates.
export function cropRgba(source, rect) {
  if (source.width !== TURNAROUND.width || source.height !== TURNAROUND.height) throw new Error("Unexpected master dimensions");
  if (![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > source.width || rect.y + rect.height > source.height) throw new Error("Invalid crop geometry");
  const data = new Uint8Array(rect.width * rect.height * 4);
  for (let y = 0; y < rect.height; y++) {
    const start = ((rect.y + y) * source.width + rect.x) * 4;
    data.set(source.data.subarray(start, start + rect.width * 4), y * rect.width * 4);
  }
  return { width: rect.width, height: rect.height, data };
}
