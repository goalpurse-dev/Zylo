// supabase/functions/runware-video/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { launchRunwareVideo, pollRunware } from "./runware.ts";

/* ================= CORS ================= */

function cors(req: Request): Headers {
  const origin = req.headers.get("Origin") || "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": reqHeaders,
    "access-control-max-age": "86400",
    "content-type": "application/json",
    vary: "Origin",
  });
}

const ok = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors(req) });

const err = (req: Request, msg: string, status = 400) =>
  ok(req, { ok: false, error: msg }, status);

/* ================= ENV ================= */

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";

const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";

/* ================= HANDLER ================= */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }

  try {
    if (req.method !== "POST") {
      return err(req, "Method not allowed", 405);
    }

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return err(req, "Missing Supabase env", 500);
    }

    const body = await req.json().catch(() => ({}));

 const {
  jobId,
  prompt,
  width,
  height,
  durationSec,
  referenceImages,
  airTag,
} = body ?? {};

    if (!jobId) return err(req, "Missing jobId");
    if (!prompt) return err(req, "Missing prompt");
if (!width || !height) return err(req, "Missing dimensions");
if (!durationSec) return err(req, "Missing durationSec");
if (!airTag) return err(req, "Missing airTag");

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // mark job running
    await sb
      .from("jobs")
      .update({ status: "running", progress: 20 })
      .eq("id", jobId);

    // 🔥 Launch Runware
const { jobId: providerJobId } = await launchRunwareVideo({
  subject: prompt,
  width: Number(width),
  height: Number(height),
  durationSec: Number(durationSec ?? 5),
  referenceImages: Array.isArray(referenceImages) ? referenceImages : [],
  airTag,
});

    // store provider job id
 const existingSettings = (await sb.from("jobs").select("settings").eq("id", jobId).single()).data?.settings ?? {};

await sb.from("jobs").update({
  settings: { ...existingSettings, provider_job_id: providerJobId },
}).eq("id", jobId);

    // 🔥 Poll loop (simple, clean)
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 3000));

      const poll = await pollRunware(providerJobId);

    if (poll.status === "succeeded") {

  // Load job to get billing info
  const { data: job } = await sb
    .from("jobs")
    .select("user_id, charge_credits, charged")
    .eq("id", jobId)
    .single();

  if (!job) {
    await sb.from("jobs").update({
      status: "failed",
      error: "Billing error: job not found",
    }).eq("id", jobId);

    return ok(req, { ok: false });
  }

  // If already charged (retry case), just mark succeeded
  if (job.charged) {
    await sb.from("jobs").update({
      status: "succeeded",
      progress: 100,
      result_url: poll.url,
    }).eq("id", jobId);

    return ok(req, { ok: true });
  }

  // 🔥 Try to deduct credits FIRST
  if (job.charge_credits) {
    const { error: creditErr } = await sb.rpc("deduct_credits", {
      uid: job.user_id,
      amount: job.charge_credits,
    });

    if (creditErr) {
      console.error("Credit deduction failed:", creditErr.message);

      // Billing failed → mark job failed
      await sb.from("jobs").update({
        status: "failed",
        error: "Billing failed",
      }).eq("id", jobId);

      return ok(req, { ok: false });
    }
  }

  // ✅ Deduction successful → mark job succeeded + charged
  await sb.from("jobs").update({
    status: "succeeded",
    progress: 100,
    result_url: poll.url,
    charged: true,
  }).eq("id", jobId);

  return ok(req, { ok: true });
}

      if (poll.status === "failed") {
        await sb
          .from("jobs")
          .update({
            status: "failed",
            error: poll.error ?? "Video failed",
          })
          .eq("id", jobId);

        return ok(req, { ok: false });
      }

      // update progress gradually
      await sb.rpc("bump_job_progress", {
        p_id: jobId,
        p_progress: 20 + i,
      });
    }

    // timeout
    await sb
      .from("jobs")
      .update({
        status: "failed",
        error: "Timeout",
      })
      .eq("id", jobId);

    return ok(req, { ok: false, error: "Timeout" });
  } catch (e) {
  console.error("[runware-video] FULL ERROR:", e);
  return err(
    req,
    e instanceof Error ? e.message : String(e),
    500,
  );
}
});