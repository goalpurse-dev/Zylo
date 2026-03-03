// supabase/functions/check-image-eligibility/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { checkWeeklyFreeEligibility } from "../shared/eligibility.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  try {
    const { supabase, user, authError } = await requireUser(req);
    if (!user) return err(req, authError || "Unauthorized", 401);

    const eligibility = await checkWeeklyFreeEligibility(supabase, user.id);

    return ok(req, {
      ...eligibility,
      user_id: user.id,
    });
  } catch (e) {
    return err(req, (e as Error).message || "Unknown error", 500);
  }
});