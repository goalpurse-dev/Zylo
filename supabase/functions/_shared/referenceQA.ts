// deno-lint-ignore-file no-explicit-any
// Character Pack QA (Part 8) — one cheap automated vision pass per
// CHARACTER PACK (Identity Master + Face + Profile [+ Back]), not one call
// per image. Model choice follows this codebase's own existing precedent
// for cheap pre-spend/pre-promotion vision gates — thirty-days-reference-qa
// and thirty-days-scene-qa both already use "gpt-4o-mini" with
// detail:"low" via the chat/completions endpoint (gpt-4o itself is only
// used elsewhere for deep analysis, e.g. image-to-prompt/analyze-viral-
// score — a more expensive tier this cheap gate doesn't need). No other
// vision-capable model is wired anywhere in this codebase's provider
// registry (src/lib/providers.ts is Runware image/video generation only),
// so this is the cheapest ALREADY-CONNECTED option, not a new integration.
//
// Deliberate divergence from the 30 Days pattern: thirty-days-reference-qa/
// scene-qa fail OPEN (usable:true) on any QA-infra error, because that gate
// protects a disposable per-scene image already mid-pipeline. This gate
// protects a CANONICAL, reused-everywhere identity — "Production Ready must
// mean the provider returned an ACCEPTABLE reference" (Part 7), and an
// unavailable QA pass does not make an image acceptable. On infra failure
// this returns approved:false, reason:"qa_unavailable" — fails CLOSED. The
// caller is expected to treat that the same as a real rejection for
// promotion purposes (Part 9's bounded fallback), never as a silent pass.

const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

export type CharacterPackQAInput = {
  masterUrl: string;
  faceUrl?: string | null;
  profileUrl?: string | null;
  backUrl?: string | null;
};

export type CharacterPackQAResult = {
  sameIdentity: boolean; sameHair: boolean; sameFacialHair: boolean; sameApparentAge: boolean; sameOutfit: boolean;
  profileIsStrictSide: boolean; profileOneEyeVisible: boolean; profileMateriallyDifferentAngle: boolean;
  faceIsValidIdentityCrop: boolean;
  masterIsFullBodyThreeQuarter: boolean;
  textArtifacts: boolean; environmentContamination: boolean;
  styleConsistent: boolean;
  approved: boolean; reasons: string[];
};

const QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["sameIdentity", "sameHair", "sameFacialHair", "sameApparentAge", "sameOutfit", "profileIsStrictSide", "profileOneEyeVisible", "profileMateriallyDifferentAngle", "faceIsValidIdentityCrop", "masterIsFullBodyThreeQuarter", "textArtifacts", "environmentContamination", "styleConsistent", "approved", "reasons"],
  properties: {
    sameIdentity: { type: "boolean" }, sameHair: { type: "boolean" }, sameFacialHair: { type: "boolean" }, sameApparentAge: { type: "boolean" }, sameOutfit: { type: "boolean" },
    profileIsStrictSide: { type: "boolean" }, profileOneEyeVisible: { type: "boolean" }, profileMateriallyDifferentAngle: { type: "boolean" },
    faceIsValidIdentityCrop: { type: "boolean" },
    masterIsFullBodyThreeQuarter: { type: "boolean" },
    textArtifacts: { type: "boolean" }, environmentContamination: { type: "boolean" },
    styleConsistent: { type: "boolean" },
    approved: { type: "boolean" }, reasons: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};

// Critical fields cannot be ignored (Part 8) — the model's own `approved`
// is advisory; this function recomputes the real gate deterministically so
// a judge that says approved:true while profileOneEyeVisible:false (or
// similar) can never sneak through. Fields only asserted when the
// corresponding image was actually supplied (e.g. no profileUrl -> profile
// fields aren't required to be true).
function recomputeApproval(input: CharacterPackQAInput, r: Omit<CharacterPackQAResult, "approved">): boolean {
  if (r.textArtifacts || r.environmentContamination) return false;
  if (!r.sameIdentity || !r.sameOutfit || !r.styleConsistent) return false;
  if (!r.masterIsFullBodyThreeQuarter) return false;
  if (input.faceUrl && !r.faceIsValidIdentityCrop) return false;
  if (input.profileUrl && (!r.profileIsStrictSide || !r.profileOneEyeVisible || !r.profileMateriallyDifferentAngle)) return false;
  return true;
}

// Multi-view SHEET QA (Part 11, HERO pack redesign) — evaluates ONE sheet
// image (which bakes in 3 views itself) as a whole, plus optionally
// compares it against the already-approved Identity/Outfit sheet for
// cross-sheet identity consistency (Face/Profile sheets only — the
// Identity/Outfit sheet itself has no anchor to compare against, it IS the
// anchor). Same fail-closed contract as runCharacterPackQA: any QA-infra
// error returns approved:false, never a silent pass.
export type SheetRole = "identity_outfit_sheet" | "face_sheet" | "profile_silhouette_sheet";
export type SheetQAResult = {
  viewCount3: boolean; sameIdentityAcrossViews: boolean;
  frontViewPresent: boolean; sideViewPresent: boolean; backViewPresent: boolean;
  sideViewIsStrict: boolean; backViewFaceHidden: boolean; correctFraming: boolean;
  textArtifacts: boolean; environmentContamination: boolean; styleConsistent: boolean;
  sameIdentityAsAnchor: boolean;
  approved: boolean; reasons: string[];
};
const SHEET_QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["viewCount3", "sameIdentityAcrossViews", "frontViewPresent", "sideViewPresent", "backViewPresent", "sideViewIsStrict", "backViewFaceHidden", "correctFraming", "textArtifacts", "environmentContamination", "styleConsistent", "sameIdentityAsAnchor", "approved", "reasons"],
  properties: {
    viewCount3: { type: "boolean" }, sameIdentityAcrossViews: { type: "boolean" },
    frontViewPresent: { type: "boolean" }, sideViewPresent: { type: "boolean" }, backViewPresent: { type: "boolean" },
    sideViewIsStrict: { type: "boolean" }, backViewFaceHidden: { type: "boolean" }, correctFraming: { type: "boolean" },
    textArtifacts: { type: "boolean" }, environmentContamination: { type: "boolean" }, styleConsistent: { type: "boolean" },
    sameIdentityAsAnchor: { type: "boolean" },
    approved: { type: "boolean" }, reasons: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};
function recomputeSheetApproval(hasAnchor: boolean, r: Omit<SheetQAResult, "approved">): boolean {
  if (r.textArtifacts || r.environmentContamination) return false;
  if (!r.viewCount3 || !r.sameIdentityAcrossViews || !r.styleConsistent) return false;
  if (!r.frontViewPresent || !r.sideViewPresent || !r.backViewPresent) return false;
  if (!r.sideViewIsStrict || !r.backViewFaceHidden || !r.correctFraming) return false;
  if (hasAnchor && !r.sameIdentityAsAnchor) return false;
  return true;
}
const SHEET_FRAMING_PROMPT: Record<SheetRole, string> = {
  identity_outfit_sheet: "This sheet should show THREE FULL-BODY views (front/3Q, strict side, back) of the same character, head to shoes visible in every view, no cropping.",
  face_sheet: "This sheet should show THREE HEAD-AND-SHOULDERS views ONLY (front face, strict side profile with one eye visible, back-of-head with face hidden) — it must NOT show legs or a full body anywhere.",
  profile_silhouette_sheet: "This sheet should show THREE FULL-BODY views (front, strict side, back) of the same character, head to shoes visible in every view, no cropping — stricter proportion/silhouette consistency than the identity sheet.",
};
export async function runSheetQA(role: SheetRole, imageUrl: string, anchorUrl?: string | null): Promise<SheetQAResult> {
  if (!SHEET_FRAMING_PROMPT[role]) throw new Error("INVALID_SHEET_QA_ROLE");
  if (role !== "identity_outfit_sheet" && !anchorUrl) throw new Error("SHEET_QA_ANCHOR_REQUIRED");
  const images = [{ label: `The ${role} sheet being reviewed`, url: imageUrl }, anchorUrl ? { label: "The already-approved Identity/Outfit sheet (for identity comparison only)", url: anchorUrl } : null].filter(Boolean) as { label: string; url: string }[];
  const prompt = [
    `You are a fast, strict quality gate for a character MODEL SHEET about to be locked in as a canonical reference. You are shown ${images.length} image(s): ${images.map((i) => i.label).join(" | ")}.`,
    `${SHEET_FRAMING_PROMPT[role]}`,
    "Judge framing, view count and orientation ONLY in IMAGE 1 (candidate). IMAGE 2 is the identity anchor ONLY; never apply the candidate's framing requirements to it. A full-body anchor is correct when reviewing a head-only candidate.",
    "Identity is exact, not approximate: reject changed beard density/color, hairstyle, face shape, skin tone, clothing color, collar/pocket design or body proportions. If the anchor itself has inconsistent facial hair or identity across its views, sameIdentityAcrossViews must be false for an identity-sheet review. Do not approve a merely similar cartoon person.",
    "viewCount3: does the sheet image actually contain exactly 3 distinct character views side by side (not 1, not 2, not more)?",
    "sameIdentityAcrossViews: do all 3 views within the sheet show the exact same individual (same face/build/outfit, not different people)?",
    "frontViewPresent / sideViewPresent / backViewPresent: is a genuine front-or-three-quarter view, a genuine side view, and a genuine rear/back view each actually present among the 3?",
    "sideViewIsStrict: is the side view a GENUINE strict side-on rotation (not just a mild turn, not a near-copy of the front view)? For a face sheet specifically, exactly one eye must be visible.",
    "backViewFaceHidden: in the back/rear view, is the face genuinely not visible (facing away)?",
    "correctFraming: does the sheet respect its OWN required framing (full body head-to-shoes for identity/profile sheets; head-and-shoulders ONLY, no legs, no full body, for a face sheet)?",
    "textArtifacts: does the sheet contain ANY readable text, letters, numbers, names, logos, or legible labels (including the words FRONT/SIDE/BACK/PROFILE) anywhere?",
    "environmentContamination: does the sheet show any room/habitat/scenery instead of a plain white/light-neutral background?",
    "styleConsistent: do all 3 views share the same illustration style?",
    anchorUrl ? "sameIdentityAsAnchor: does this sheet show the SAME individual as the Identity/Outfit sheet (same face, hair, build, outfit)?" : "sameIdentityAsAnchor: no anchor was supplied — answer true.",
    "approved: your own overall verdict — the caller applies its own stricter deterministic rule on top, so answer each field honestly.",
    "reasons: short specific reasons for any failing field.",
  ].join("\n");
  const content: any[] = [{ type: "text", text: prompt }];
  for (const [index, img] of images.entries()) content.push({ type: "text", text: `IMAGE ${index + 1}: ${img.label}` }, { type: "image_url", image_url: { url: img.url, detail: "high" } });
  const fallback = (reason: string): SheetQAResult => ({ viewCount3: false, sameIdentityAcrossViews: false, frontViewPresent: false, sideViewPresent: false, backViewPresent: false, sideViewIsStrict: false, backViewFaceHidden: false, correctFraming: false, textArtifacts: false, environmentContamination: false, styleConsistent: false, sameIdentityAsAnchor: false, approved: false, reasons: [reason] });
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "sheet_qa", strict: true, schema: SHEET_QA_SCHEMA } },
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return fallback("qa_unavailable");
    const payload = await res.json();
    const parsed = JSON.parse(String(payload.choices?.[0]?.message?.content ?? "{}"));
    const { approved: _modelApproved, ...rest } = parsed as SheetQAResult;
    return { ...rest, approved: recomputeSheetApproval(Boolean(anchorUrl), rest) };
  } catch (error) {
    console.error("[referenceQA] sheet QA failed:", String(error));
    return fallback("qa_unavailable");
  }
}

// One canonical character sheet (2026-09-13, major simplification): QA's
// the SINGLE sheet image directly — no cross-sheet anchor comparison needed
// since there is now only one sheet per character. Deliberately lightweight
// (your own words: "not a gigantic brittle CV system") — one vision call,
// one flat checklist, deterministic recompute on top exactly like every
// other QA function here.
export type CharacterReferenceSheetQAResult = {
  panelCountCorrect: boolean; sameIdentityAcrossPanels: boolean;
  frontPresent: boolean; sidePresent: boolean; backPresent: boolean; facePresent: boolean;
  outfitDetailPresent: boolean; actionPosePresent: boolean; outfitConsistent: boolean;
  fullBodyNotCropped: boolean; environmentContamination: boolean;
  // 2026-09-19 "richer expression coverage" pass (item 4/6): the new
  // canonical-sheet-v4-expression-panel template asks for a 5-expression
  // strip (neutral/happy/concerned/focused/surprised-or-stressed) on every
  // sheet. Tracked the SAME way actionPosePresent already was — informational
  // only, never a hard gate (see recomputeCharacterSheetApproval's own
  // comment on why a genuinely new prompt request isn't blindly hard-
  // required from day one) — expressionPanelPresent is whether SOME
  // multi-expression panel exists at all, expressionCount is how many of
  // the 5 target expressions are actually distinguishable, so a partial/
  // degenerate strip is visible in QA data even while still approved.
  expressionPanelPresent: boolean; expressionCount: number;
  textArtifactSeverity: "none" | "minor" | "major";
  styleMismatchSeverity: "none" | "minor" | "major";
  corruptionArtifacts: boolean;
  approved: boolean; reasons: string[];
};
const CHARACTER_SHEET_QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["panelCountCorrect", "sameIdentityAcrossPanels", "frontPresent", "sidePresent", "backPresent", "facePresent", "outfitDetailPresent", "actionPosePresent", "expressionPanelPresent", "expressionCount", "outfitConsistent", "fullBodyNotCropped", "environmentContamination", "textArtifactSeverity", "styleMismatchSeverity", "corruptionArtifacts", "approved", "reasons"],
  properties: {
    panelCountCorrect: { type: "boolean" }, sameIdentityAcrossPanels: { type: "boolean" },
    frontPresent: { type: "boolean" }, sidePresent: { type: "boolean" }, backPresent: { type: "boolean" }, facePresent: { type: "boolean" },
    outfitDetailPresent: { type: "boolean" }, actionPosePresent: { type: "boolean" }, outfitConsistent: { type: "boolean" },
    expressionPanelPresent: { type: "boolean" }, expressionCount: { type: "integer", minimum: 0, maximum: 5 },
    fullBodyNotCropped: { type: "boolean" }, environmentContamination: { type: "boolean" },
    textArtifactSeverity: { type: "string", enum: ["none", "minor", "major"] },
    styleMismatchSeverity: { type: "string", enum: ["none", "minor", "major"] },
    corruptionArtifacts: { type: "boolean" },
    approved: { type: "boolean" }, reasons: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};
// Part 7 of the 2026-09-14 "FINAL CHARACTER REFERENCE POLISH" fix: rewrote
// the hard/soft split again, tighter than the 2026-09-13 pass. Real
// incidents this closes: (1) a HERO sheet missing only the action-pose
// panel was rejected even though front/side/back/face/outfit-detail were
// all present and consistent — action pose is no longer a required view at
// all (removed from the prompt contract too), so it NEVER gates approval
// now, HERO or RECURRING. (2) small readable-looking marks on a handheld
// prop (a power officer's equipment) failed the WHOLE sheet under the old
// boolean textArtifacts — text severity is now a 3-way judgment
// (none/minor/major) and only "major" (large, prominent, caption/signage-
// like, or materially interfering with the reference) hard-fails; a tiny
// badge/insignia/prop-control mark is `minor` and never rejects on its own.
// (3) NEW hard gate: outfitConsistent — a real Mars-protagonist sheet had
// the main turnaround in one outfit and the outfit-detail panel depicting a
// materially different suit; that is a genuine defect a downstream scene
// generator would inherit, so it hard-fails now.
// HARD (unconditionally reject): different person across views, a required
// view (front/side/back/face, and outfit-detail for HERO) missing entirely,
// a body crop, materially inconsistent outfit, severe corruption/duplicate-
// body artifacts, environment/story-scene contamination, or MAJOR text/
// caption/watermark artifacts.
// SOFT (never auto-fails on its own): panel count/grid layout, no action
// pose, a duplicate optional face/detail panel, minor/prop-level text or
// insignia marks, minor accessory variance.
export function recomputeCharacterSheetApproval(importance: string | undefined, r: Omit<CharacterReferenceSheetQAResult, "approved">): boolean {
  // Part 8 of the 2026-09-14 fix: style-match is a HARD gate only when the
  // generation clearly abandons the selected style entirely (photorealistic,
  // 3D, painterly, anime, semi-real cinematic vs. a flat 2D cartoon preset,
  // etc.) — "major". Small shading/detail variance ("minor") is a soft
  // warning and never rejects on its own, same severity pattern as
  // textArtifactSeverity above.
  if (r.textArtifactSeverity === "major" || r.styleMismatchSeverity === "major" || r.environmentContamination || r.corruptionArtifacts) return false;
  if (!r.sameIdentityAcrossPanels) return false;
  if (!r.frontPresent || !r.sidePresent || !r.backPresent || !r.facePresent) return false;
  if (!r.fullBodyNotCropped) return false;
  if (!r.outfitConsistent) return false;
  // A distinct outfit-detail box is useful for identity-sensitive designs,
  // but never a universal template requirement. The hard question is
  // whether the visible views preserve enough consistent identity/outfit
  // information for downstream scenes.
  return true;
}
export async function runCharacterReferenceSheetQA(imageUrl: string, importance: string | undefined, styleName?: string | null): Promise<CharacterReferenceSheetQAResult> {
  const isHero = importance === "HERO";
  const prompt = [
    `You are a fast quality gate for a canonical CHARACTER REFERENCE SHEET about to be locked in as the single source of truth for this character. Be strict about IDENTITY and OUTFIT CONSISTENCY, but lenient about composition/layout — this is a professional model sheet, not a pixel-perfect grid.`,
    styleName ? `The selected project visual style is "${styleName}". This sheet should visibly match that style's overall rendering approach (e.g. a flat 2D illustrated/cartoon style should not look photorealistic, 3D-rendered, painterly, anime, or semi-real cinematic).` : "",
    isHero
      ? "This sheet should show the SAME character in: full-body front, strict 90-degree side, full-body back, an action pose, a small 5-panel expression strip (neutral/happy/concerned/focused/surprised-or-stressed), and an outfit/costume detail view."
      : "This sheet should show the SAME character in: full-body front, strict 90-degree side, full-body back, an action pose, and a small 5-panel expression strip (neutral/happy/concerned/focused/surprised-or-stressed).",
    "panelCountCorrect: does the image contain roughly the expected views (extra useful views, e.g. an unrequested duplicate close-up, are FINE and should not make this false in a way that matters — just answer honestly, this field is informational only).",
    "sameIdentityAcrossPanels: do all views show the exact same individual (same face, hair, build — not different people)?",
    "frontPresent / sidePresent / backPresent: is a genuine full-body front view, a genuine strict-side view, and a genuine full-body back view each actually present?",
    "facePresent: is a genuine face close-up or neutral head-and-shoulders portrait present, EITHER as its own panel OR as the neutral pose within the expression strip?",
    `outfitDetailPresent: is a distinct outfit/costume detail view present? This is informational for every character. Its absence is acceptable when the existing views already establish the outfit reliably.`,
    "actionPosePresent: is a genuine action/dynamic pose view present (arms/legs/body doing something other than a plain standing turnaround)? This is now requested on every sheet but still informational only — never required, its absence is fine.",
    "expressionPanelPresent: is there a small multi-headshot expression strip (several small, same-size head-and-shoulders portraits of the same character showing different facial expressions, placed together as one row)?",
    "expressionCount: of the 5 target expressions (neutral, happy, concerned, focused, surprised-or-stressed), how many are actually present and clearly distinguishable from each other in the strip? Answer 0 if there is no expression strip at all.",
    "outfitConsistent: do ALL views — including any outfit-detail view — depict the SAME outfit construction, palette and major accessories? Answer false if the outfit-detail view (or any other view) shows a materially different garment/suit than the main turnaround, not just a closer crop of the same outfit.",
    "fullBodyNotCropped: are the full-body views (front/side/back) actually showing the ENTIRE body head to feet, not cropped at the waist/chest/knees?",
    "environmentContamination: does the sheet show a story environment/room/habitat/scenery replacing the plain studio background, dominating the composition?",
    "textArtifactSeverity: rate any readable text/letters/numbers/logos/badges: \"none\" if there is none; \"minor\" if it's small/incidental (e.g. tiny pseudo-text or controls on a handheld prop, a small insignia-like mark) and does not interfere with using this as a character reference; \"major\" only if it is large, prominent, caption/signage-like, or materially interferes with the reference.",
    "corruptionArtifacts: does the sheet show severe generation corruption — an accidental duplicate head or body, a malformed/melted limb or face, or two views visibly merged into one broken figure?",
    styleName ? `styleMismatchSeverity: rate how well this sheet matches the "${styleName}" style: "none"/"minor" for a good match or only small shading/detail variance (never fails on its own); "major" ONLY if the overall rendering approach clearly abandons the selected style (e.g. photorealistic, 3D-rendered, painterly, anime, or semi-real cinematic instead of the requested flat 2D illustrated look).` : `styleMismatchSeverity: no specific style was supplied for this check — answer "none".`,
    "approved: your own overall verdict — the caller applies its own stricter deterministic rule on top, so answer each field honestly.",
    "reasons: short specific reasons for any concerning field, hard or soft. Empty array if everything is clean.",
  ].filter(Boolean).join("\n");
  const content: any[] = [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: "high" } }];
  const fallback = (reason: string): CharacterReferenceSheetQAResult => ({ panelCountCorrect: false, sameIdentityAcrossPanels: false, frontPresent: false, sidePresent: false, backPresent: false, facePresent: false, outfitDetailPresent: false, actionPosePresent: false, expressionPanelPresent: false, expressionCount: 0, outfitConsistent: false, fullBodyNotCropped: false, environmentContamination: false, textArtifactSeverity: "major", styleMismatchSeverity: "none", corruptionArtifacts: false, approved: false, reasons: [reason] });
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "character_reference_sheet_qa", strict: true, schema: CHARACTER_SHEET_QA_SCHEMA } },
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return fallback("qa_unavailable");
    const payload = await res.json();
    const parsed = JSON.parse(String(payload.choices?.[0]?.message?.content ?? "{}"));
    const { approved: _modelApproved, ...rest } = parsed as CharacterReferenceSheetQAResult;
    return { ...rest, approved: recomputeCharacterSheetApproval(importance, rest) };
  } catch (error) {
    console.error("[referenceQA] character reference sheet QA failed:", String(error));
    return fallback("qa_unavailable");
  }
}

export async function runCharacterPackQA(input: CharacterPackQAInput): Promise<CharacterPackQAResult> {
  const images = [
    { label: "Identity Master (canonical anchor)", url: input.masterUrl },
    input.faceUrl ? { label: "Face Detail (should be a tight crop of the SAME person as the master)", url: input.faceUrl } : null,
    input.profileUrl ? { label: "Profile (should be a STRICT side view, one eye visible, of the SAME person as the master)", url: input.profileUrl } : null,
    input.backUrl ? { label: "Back (should be a rear view of the SAME person as the master)", url: input.backUrl } : null,
  ].filter(Boolean) as { label: string; url: string }[];

  const prompt = [
    "You are a fast, strict quality gate for a character reference PACK about to be locked in as the canonical identity for an animated documentary character. You are shown 1-4 images from the same pack, in this order: " + images.map((i) => i.label).join(" | ") + ".",
    "Judge ONLY what is asked below — do not deeply critique art quality.",
    "sameIdentity: do ALL supplied images show the exact same individual (same face, not a different-looking person)?",
    "sameHair / sameFacialHair / sameApparentAge / sameOutfit: do all images agree on these specific traits?",
    "profileIsStrictSide (only meaningful if a Profile image was supplied): is it a genuine ~90-degree side view, NOT frontal, NOT three-quarter?",
    "profileOneEyeVisible (only meaningful if a Profile image was supplied): is exactly one eye visible, with the far cheek/eye hidden?",
    "profileMateriallyDifferentAngle (only meaningful if a Profile image was supplied): is its camera angle GENUINELY different from the Identity Master's three-quarter angle (not just a near-copy of it)?",
    "faceIsValidIdentityCrop (only meaningful if a Face image was supplied): does it show a usable head/shoulders view of the same identity (even if tightly cropped)?",
    "masterIsFullBodyThreeQuarter: is the Identity Master SPECIFICALLY a full-body (head to feet/boots visible) three-quarter-angle standing reference — NOT a head-and-shoulders portrait, NOT a frontal shot, NOT cropped at the chest/waist?",
    "textArtifacts: does ANY supplied image contain readable text, letters, numbers, names, logos, or legible badge/signage lettering anywhere in the frame?",
    "environmentContamination: does the Identity Master (or any other supplied image) show a story environment/room/habitat/cockpit/vehicle interior instead of a plain neutral background?",
    "styleConsistent: do all images share the same illustration style (same linework/shading/palette language)?",
    "approved: your own overall verdict — but the caller applies its own stricter deterministic rule on top of your individual answers, so answer each field honestly rather than only tuning `approved`.",
    "reasons: short, specific reasons for any false/failing field. Empty array if everything passes.",
  ].join("\n");

  const content: any[] = [{ type: "text", text: prompt }];
  for (const img of images) content.push({ type: "image_url", image_url: { url: img.url, detail: "low" } });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        response_format: { type: "json_schema", json_schema: { name: "character_pack_qa", strict: true, schema: QA_SCHEMA } },
        max_tokens: 400,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { sameIdentity: false, sameHair: false, sameFacialHair: false, sameApparentAge: false, sameOutfit: false, profileIsStrictSide: false, profileOneEyeVisible: false, profileMateriallyDifferentAngle: false, faceIsValidIdentityCrop: false, masterIsFullBodyThreeQuarter: false, textArtifacts: false, environmentContamination: false, styleConsistent: false, approved: false, reasons: ["qa_unavailable"] };
    }
    const payload = await res.json();
    const parsed = JSON.parse(String(payload.choices?.[0]?.message?.content ?? "{}"));
    const { approved: _modelApproved, ...rest } = parsed as CharacterPackQAResult;
    const approved = recomputeApproval(input, rest);
    return { ...rest, approved };
  } catch (error) {
    console.error("[referenceQA] character pack QA failed:", String(error));
    return { sameIdentity: false, sameHair: false, sameFacialHair: false, sameApparentAge: false, sameOutfit: false, profileIsStrictSide: false, profileOneEyeVisible: false, profileMateriallyDifferentAngle: false, faceIsValidIdentityCrop: false, masterIsFullBodyThreeQuarter: false, textArtifacts: false, environmentContamination: false, styleConsistent: false, approved: false, reasons: ["qa_unavailable"] };
  }
}

export type CanonicalReferenceQAResult = {
  subjectCountCorrect: boolean;
  collageFree: boolean;
  infographicFree: boolean;
  readableTextFree: boolean;
  reusableCanonical: boolean;
  categoryMatch: boolean;
  majorStyleMismatch: boolean;
  severeArtifacts: boolean;
  approved: boolean;
  reasons: string[];
};

const CANONICAL_REFERENCE_QA_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["subjectCountCorrect", "collageFree", "infographicFree", "readableTextFree", "reusableCanonical", "categoryMatch", "majorStyleMismatch", "severeArtifacts", "approved", "reasons"],
  properties: {
    subjectCountCorrect: { type: "boolean" }, collageFree: { type: "boolean" }, infographicFree: { type: "boolean" },
    readableTextFree: { type: "boolean" }, reusableCanonical: { type: "boolean" }, categoryMatch: { type: "boolean" },
    majorStyleMismatch: { type: "boolean" }, severeArtifacts: { type: "boolean" }, approved: { type: "boolean" },
    reasons: { type: "array", items: { type: "string" }, maxItems: 6 },
  },
};

export async function runCanonicalReferenceQA(imageUrl: string, expectations: Record<string, unknown>, styleName?: string | null): Promise<CanonicalReferenceQAResult> {
  const fallback = (reason: string): CanonicalReferenceQAResult => ({ subjectCountCorrect: false, collageFree: false, infographicFree: false, readableTextFree: false, reusableCanonical: false, categoryMatch: false, majorStyleMismatch: false, severeArtifacts: false, approved: false, reasons: [reason] });
  const subjectCountRule = expectations.coherentSystemAllowed === true
    ? "subjectCountCorrect: one coherent object/equipment system. Two or three essential functionally connected components, such as sensor plus console or towfish plus display, count as one system. Reject unrelated extras, duplicate alternatives, and comparison layouts."
    : expectations.coherentLocationBoardAllowed === true
    ? "subjectCountCorrect: one coherent location shown across coordinated views. Multiple panels and a detail inset are allowed only when every view is recognizably the same place with consistent geography, landmarks, materials and palette. Reject unrelated locations."
    : "subjectCountCorrect: exactly one canonical subject or one coherent location/environment, with no duplicate copies or unrelated major subjects.";
  const collageRule = expectations.coherentLocationBoardAllowed === true
    ? "collageFree: a coordinated multi-view location board is allowed. Reject unrelated-image collages, comparison boards, or mixed locations."
    : "collageFree: no collage, contact sheet, split screen, panels or multiple alternate views in this image.";
  const prompt = [
    "You are a focused QA gate for one reusable canonical visual reference. Judge only material reuse failures; do not reject harmless composition or minor style variance.",
    `Expected facts: ${JSON.stringify(expectations)}.`,
    styleName ? `Selected style: ${styleName}. majorStyleMismatch is true only when the overall rendering approach clearly abandons this style; small shading/detail variation is acceptable.` : "No named style was supplied; majorStyleMismatch must be false.",
    subjectCountRule,
    collageRule,
    "infographicFree: no explainer board, presentation layout, arrows, callouts, diagrams or educational-poster composition.",
    "readableTextFree: no readable words, labels, captions, logos, UI copy or numbers. Tiny meaningless texture marks are acceptable.",
    "reusableCanonical: this is a clean identity/set/specimen reference, not a narrative action, process sequence or finished story scene.",
    "categoryMatch: the image depicts the requested category/view described by Expected facts; plants are environmental specimens, celestial bodies contain no unrelated planets, and objects remain objects.",
    "severeArtifacts: only obvious corruption that makes the reference unusable. Minor drawing imperfections are acceptable.",
    "approved is advisory; the caller recomputes it from the hard fields. Give short, specific reasons only for failures.",
  ].join("\n");
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: imageUrl, detail: "low" } }] }], response_format: { type: "json_schema", json_schema: { name: "canonical_reference_qa", strict: true, schema: CANONICAL_REFERENCE_QA_SCHEMA } }, max_tokens: 350, temperature: 0 }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return fallback("qa_unavailable");
    const payload = await res.json();
    const parsed = JSON.parse(String(payload.choices?.[0]?.message?.content ?? "{}")) as CanonicalReferenceQAResult;
    const approved = parsed.subjectCountCorrect && parsed.collageFree && parsed.infographicFree && parsed.readableTextFree && parsed.reusableCanonical && parsed.categoryMatch && !parsed.majorStyleMismatch && !parsed.severeArtifacts;
    return { ...parsed, approved };
  } catch (error) {
    console.error("[referenceQA] canonical reference QA failed:", String(error));
    return fallback("qa_unavailable");
  }
}
