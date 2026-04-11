// supabase/functions/generate-image-v2/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { checkWeeklyFreeEligibility, assertFreeGeneratorAllowed } from "../shared/eligibility.ts";

type GenerateBody = {
  prompt: string;
  generator?: string; // "basic" for free
  model?: string;
  // add any other fields you need (negative_prompt, size, etc.)
};

async function runImageProvider(_body: GenerateBody) {
  /**
   * 🔌 PLUG YOUR PROVIDER HERE
   *
   * You already have an image generation backend working.
   * Replace this with your current provider call (Runware/Replicate/etc.)
   *
   * Must return at least:
   * - result_url (string) OR any payload your frontend expects
   */
  throw new Error("Image provider not connected. Implement runImageProvider() in generate-image-v2.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  try {
    const { supabase, user, authError } = await requireUser(req);
    if (!user) return err(req, authError || "Unauthorized", 401);

    const body = (await req.json().catch(() => null)) as GenerateBody | null;
    if (!body?.prompt || typeof body.prompt !== "string") {
      return err(req, "Missing prompt", 400);
    }

    // 1) Weekly eligibility
    const eligibility = await checkWeeklyFreeEligibility(supabase, user.id);
    if (!eligibility.allowed) {
      return err(req, "Monthly free limit reached", 403, {
        code: "monthly_limit",
        ...eligibility,
      });
    }

    // 2) Generator lock (free -> only basic)
    const generator = assertFreeGeneratorAllowed(eligibility.plan_code, body.generator);

    // 3) Generate image (provider call)
    let providerResult: any;
    try {
      providerResult = await runImageProvider({ ...body, generator });
    } catch (providerErr) {
      return err(req, (providerErr as Error).message || "Generation failed", 500, {
        code: "provider_error",
      });
    }

    // 4) Log usage only AFTER success (free plan tracking)
    // If you want to also log paid usage, remove the plan_code check.
    if (eligibility.plan_code === "free") {
      const { error: insertErr } = await supabase
        .from("image_generations")
        .insert({ user_id: user.id });

      if (insertErr) {
        // Don’t fail the generation response if logging fails; but DO return a signal
        return ok(req, {
          ...providerResult,
          warning: "Generated successfully but failed to log usage",
          log_error: insertErr.message,
        });
      }
    }

    // 5) Return
    return ok(req, {
      ...providerResult,
      plan_code: eligibility.plan_code,
      generator,
    });
  } catch (e: any) {
    // Locked generator error payload
    if (e?.status === 403 && e?.payload) {
      return err(req, e.message || "Forbidden", 403, {
        code: "locked_generator",
        ...e.payload,
      });
    }
    return err(req, e?.message || "Unknown error", 500);
  }
});