// deno-lint-ignore-file no-explicit-any
// Shared between advance-long-form-visual-world and (later) scene
// generation — the ONE locked Zyvo style (no marketplace, no presets for
// V1; see the Visual World milestone spec, Part 6), the deterministic
// reference-view rules that don't need an LLM to decide, and the
// deterministic prompt compiler. None of this calls OpenAI — the Reference
// Planner's own LLM call (in advance-long-form-visual-world) supplies only
// the two things code genuinely cannot derive: canonical appearance
// identity and factual/forbidden constraints per entity.

export const ZYVO_STYLE_SPEC = {
  name: "Zyvo Illustrated Documentary",
  version: 1,
  summary: "Clean 2D illustrated documentary style — hand-drawn editorial character charm with controlled linework and a muted but readable palette. Not hyper-realistic, not childish preschool cartoon, not generic corporate flat vector art.",
  linework: "Confident, slightly variable-weight ink linework — thicker silhouette edges, thinner interior detail lines. No sketchy cross-hatching, no photorealistic edge rendering.",
  shading: "Soft flat cel-shading, 2-3 tonal steps per surface (base, shadow, occasional highlight) — no painterly gradients, no hard outline on the shadow shapes themselves.",
  texture: "A light, uniform paper/canvas grain overlay across the whole image — subtle enough to never read as noise or damage, present enough to avoid a flat vector-art look.",
  palette: "Muted, desaturated but readable hues — avoid neon/oversaturated color. Favor 2-4 dominant hues plus neutrals per scene so the image reads instantly, even at thumbnail size.",
  faceConstruction: "Simple, expressive faces — economical linework for eyes/brows/mouth, clearly readable expression. Avoid hyper-detailed photographic facial rendering and avoid oversized preschool-cartoon eyes.",
  bodyProportions: "Naturalistic, slightly simplified proportions (not chibi, not hyper-stylized anime) — believable adult proportions with clean, confident, instantly-readable silhouettes.",
  environmentDetail: "Cinematic composition with clear foreground/midground/background separation and atmospheric depth (subtle desaturation/blur toward the distance). Purposeful, uncluttered set-dressing — every visible object should feel intentional.",
  lighting: "Directional, motivated lighting with a clear implied light source and soft shadow shapes — never flat/shadowless, never harsh studio-flash lighting.",
  perspective: "Consistent one-to-two-point perspective per scene, eye-level or slightly low-angle by default for a grounded, cinematic feel — avoid extreme fisheye/dutch angles unless a beat specifically calls for drama.",
  diagramGrammar: "Diagrams use the same illustrated linework/palette as narrative scenes, never a generic flat corporate-infographic look. Labels and callouts are added programmatically in the video layer — never baked into the image.",
  mapGrammar: "Maps use a hand-illustrated cartographic style, not literally aged/parchment unless the topic calls for it. Place names and route lines are added programmatically — never baked into the image.",
  negativeConstraints: ["not hyper-realistic / photographic", "not childish preschool cartoon", "not generic corporate flat vector art", "no 3D-render look", "no anime/manga stylization"],
};

/* ============================ Deterministic view rules (Part 5) ============================ */
// No LLM call needed for any of this — see the milestone spec's "try
// zero-LLM derivation first" principle. HERO/RECURRING/INCIDENTAL and
// LOCATION/OBJECT/VEHICLE rules are simple, fixed policy; camera anchors
// for a LOCATION are read directly from the Visual Plan's own
// continuityGroups (already decided by the Visual Director LLM call when
// it built the storyboard) rather than re-asked of a second model.

export type RequiredView = { referenceType: string; angle: string; purpose: string };

export function deriveRequiredViews(entity: { id: string; category: string; importance: string; referenceNeeded: boolean }, continuityGroups: any[]): RequiredView[] {
  if (!entity.referenceNeeded) return [];

  if (entity.category === "CHARACTER") {
    if (entity.importance === "HERO") {
      return [
        { referenceType: "character_reference", angle: "three_quarter_neutral", purpose: "Primary canonical identity anchor" },
        { referenceType: "character_reference", angle: "profile", purpose: "Side-view consistency anchor" },
        { referenceType: "character_reference", angle: "face_closeup", purpose: "Facial identity anchor for close shots" },
      ];
    }
    if (entity.importance === "RECURRING") {
      return [
        { referenceType: "character_reference", angle: "three_quarter_neutral", purpose: "Primary canonical identity anchor" },
        { referenceType: "character_reference", angle: "face_closeup", purpose: "Facial identity anchor for close shots" },
      ];
    }
    return []; // INCIDENTAL — no canonical reference by default
  }

  if (entity.category === "LOCATION") {
    // Treat like an animation set: only the camera anchors the storyboard
    // actually uses, read straight from continuityGroups — never an
    // automatic fixed number of angles.
    const anchors = new Set<string>();
    for (const group of continuityGroups ?? []) {
      if (group.locationId !== entity.id) continue;
      for (const anchor of group.cameraAnchors ?? []) anchors.add(anchor);
    }
    if (anchors.size === 0) {
      return [{ referenceType: "location_reference", angle: "wide_establishing", purpose: "Primary establishing anchor (no specific camera anchors found in the storyboard)" }];
    }
    return Array.from(anchors).map((anchor) => ({ referenceType: "location_reference", angle: anchor, purpose: `Storyboard camera anchor: ${anchor}` }));
  }

  if (entity.category === "IMPORTANT_OBJECT" || entity.category === "VEHICLE_MACHINE") {
    // referenceNeeded on this entity already encodes the Visual Director's
    // own "is this repeated/identity-sensitive/important enough" judgment
    // (Part 5 item 15) — by the time we're here that gate has already
    // passed, so one hero angle is the V1 default.
    return [{ referenceType: "object_reference", angle: "three_quarter_hero", purpose: "Primary canonical identity anchor" }];
  }

  return [];
}

/* ============================ Deterministic prompt compiler (Part 9) ============================ */
// The LLM authors the canonical spec ONCE per entity; code turns it into
// every actual image prompt. No per-image OpenAI call, ever.

/* ============================ Economics projection (Part 16) ============================ */
// Pure, deterministic — runs once the Reference Planner's asset count is
// known, BEFORE any actual rendering. Uses the REAL configured per-image
// cost for the model this codebase already has wired up for V2
// (image:flux.base / runware:400@4, see src/lib/providers.ts). V3/V4 use
// the closest already-configured real Runware entries in this codebase
// (image:flux.max) as a stand-in — the exact models named in the milestone
// spec (Kling IMAGE O3, Seedream 5.0 Pro, Recraft V4.1, Qwen Image Edit
// Plus) are NOT yet in this codebase's provider registry, so their real
// per-image cost is unknown rather than guessed; `isPlaceholder` marks
// which figures that applies to.
export const REFERENCE_COST_MODEL_USD = {
  v2: { costUsd: 0.0006, sourceToolKey: "image:flux.base", isPlaceholder: false },
  v3: { costUsd: 0.07, sourceToolKey: "image:flux.max", isPlaceholder: true }, // real V3 model (Kling IMAGE O3) not yet configured — using the closest real premium entry as a stand-in ceiling estimate
  v4: { costUsd: 0.07, sourceToolKey: "image:flux.max", isPlaceholder: true }, // real V4 model (Seedream 5.0 Pro) not yet configured — same stand-in
};

export function estimateReferenceCosts(referenceCount: number) {
  const round = (n: number) => Number(n.toFixed(4));
  return {
    referenceCount,
    v2: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v2.costUsd), ...REFERENCE_COST_MODEL_USD.v2 },
    v3: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v3.costUsd), ...REFERENCE_COST_MODEL_USD.v3 },
    v4: { totalUsd: round(referenceCount * REFERENCE_COST_MODEL_USD.v4.costUsd), ...REFERENCE_COST_MODEL_USD.v4 },
  };
}

export function compileReferencePrompt(args: {
  styleSpec: typeof ZYVO_STYLE_SPEC;
  visualStyleNotes?: string;
  entityName: string;
  canonicalSpec: string;
  view: RequiredView;
  factualConstraints?: string[];
  forbiddenElements?: string[];
}): string {
  const { styleSpec, visualStyleNotes, entityName, canonicalSpec, view, factualConstraints, forbiddenElements } = args;
  const lines: string[] = [];

  lines.push("[STYLE LOCK]", styleSpec.summary, `Linework: ${styleSpec.linework}`, `Shading: ${styleSpec.shading}`, `Texture: ${styleSpec.texture}`, `Palette: ${styleSpec.palette}`, `Lighting: ${styleSpec.lighting}`, `Perspective: ${styleSpec.perspective}`);
  if (visualStyleNotes) lines.push(`Project-specific mood: ${visualStyleNotes}`);

  lines.push("", "[ENTITY IDENTITY]", `${entityName}: ${canonicalSpec}`);
  // OUTFIT/MATERIAL is intentionally folded into ENTITY IDENTITY for V1 —
  // canonicalSpec already describes typical attire as part of appearance.
  // CharacterIdentity/OutfitState/PhysicalState stay conceptually separate
  // in the data model (Part 5 item 16) even though V1's single reference
  // image visually bakes in the primary outfit.

  lines.push("", "[REQUESTED VIEW]", `${view.angle.replace(/_/g, " ")} — ${view.purpose}`);

  lines.push("", "[PROPORTION / SHAPE RULES]", styleSpec.bodyProportions, styleSpec.faceConstruction);

  if (factualConstraints?.length) lines.push("", "[HISTORICAL OR FACTUAL CONSTRAINTS]", ...factualConstraints.map((c) => `- ${c}`));

  lines.push(
    "",
    "[BACKGROUND / REFERENCE-SHEET PRESENTATION]",
    "Neutral, uncluttered background appropriate for a canonical reference image — the subject must read clearly with nothing competing for attention."
  );

  const forbidden = [...styleSpec.negativeConstraints, ...(forbiddenElements ?? []), "text", "labels", "watermarks", "UI elements", "unrelated objects"];
  lines.push("", "[FORBIDDEN ELEMENTS]", ...forbidden.map((f) => `- ${f}`));

  return lines.join("\n");
}
