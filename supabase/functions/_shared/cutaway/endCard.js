// Cutaway Explainer end card ("watermark"): after "Congratulations, you have built a ___" a sign pops into the 3D
// diorama for ~1.8 s: "Make videos like this with Zyvo" + "tryzyvo.com", with the chime, no voice.
//
// It is ON for every plan below Pro (free, starter, affiliate, unknown). Pro and above may switch it off.
// The server decides, from profiles.plan_code read when the render job is built (engine.stepRender ->
// deps.planCode), so editing the page can't remove it. The page only shows the toggle (src lib: canRemoveEndCard).
//
// Same tier order as supabase/functions/job-worker (PLAN_TIER_ORDER) and src/lib/planGating.js: keep in sync.
export const PLAN_TIER_ORDER = ["free", "starter", "pro", "generative"];
export const END_CARD_FREE_FROM = "pro";
export const END_CARD = Object.freeze({ line1: "Make videos like this with Zyvo", line2: "tryzyvo.com", seconds: 1.8 });

const norm = (code) => String(code ?? "").toLowerCase().trim();

/** True when this plan may remove the end card (Pro and above). Affiliates get entry-level features only. */
export function canRemoveEndCard(planCode) {
  const code = norm(planCode);
  if (code === "affiliate") return false;
  const idx = PLAN_TIER_ORDER.indexOf(code);
  return idx >= PLAN_TIER_ORDER.indexOf(END_CARD_FREE_FROM);
}

/** Whether the rendered video gets the end card: always, unless the plan allows removing it AND the user asked to. */
export function endCardFor(planCode, removeRequested) {
  return !(removeRequested === true && canRemoveEndCard(planCode));
}
