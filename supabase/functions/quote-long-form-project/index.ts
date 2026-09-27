// quote-long-form-project/index.ts — 2026-10-02 "make the new flow real in
// the product" pass, Section 2.
//
// Read-only, side-effect-free preview of the SAME deterministic upper-bound
// estimate create-long-form-production-setup actually reserves
// (estimateLongFormProjectQuote — one estimator, never a second copy of the
// math). Lets the Setup page show a live "CREATE VIDEO · N credits" label as
// the user adjusts duration/tier, without creating a project, a Production
// Profile, or a reservation. No projectId, no DB write, no provider call.
//
// POST { recipeVersion, renderTier, targetDurationMinutes }
// Returns the ProjectQuote object directly (see longFormProjectQuote.ts).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { estimateLongFormProjectQuote, type RenderTier } from "../_shared/longFormProjectQuote.ts";

// Kept in sync with create-long-form-production-setup's own copy — see that
// file's header comment. Both will move together the moment a second recipe
// registers a pacing density; duplicating a 1-line lookup table is cheaper
// and safer here than importing across function boundaries for one constant.
const RECIPE_BEATS_PER_MINUTE: Record<string, number> = {
  STICKMAN_DOODLE_EXPLAINER_V1: 15,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const recipeVersion = String(body?.recipeVersion ?? "").trim();
  const renderTier = String(body?.renderTier ?? "").trim() as RenderTier;
  const targetDurationMinutes = Number(body?.targetDurationMinutes);

  const beatsPerMinute = RECIPE_BEATS_PER_MINUTE[recipeVersion];
  if (!beatsPerMinute) return err(req, `Unknown recipe version: ${recipeVersion}`, 400);
  if (!["v2", "v3", "v4"].includes(renderTier)) return err(req, "Invalid renderTier", 400);
  if (!(targetDurationMinutes > 0)) return err(req, "Invalid targetDurationMinutes", 400);

  try {
    const quote = estimateLongFormProjectQuote({ targetDurationMinutes, renderTier, beatsPerMinute });
    return ok(req, quote);
  } catch (e) {
    return err(req, "Could not compute quote", 400, { reason: e instanceof Error ? e.message : String(e) });
  }
});
