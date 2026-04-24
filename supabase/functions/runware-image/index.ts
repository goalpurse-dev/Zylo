// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ===================== ENV ===================== */
const RUNWARE_KEY = Deno.env.get("RUNWARE_API_KEY")!;
const RUNWARE_BASE = "https://api.runware.ai/v1/air";
const TASKS_URL = `${RUNWARE_BASE}/tasks`;
const TASK_GET = (id: string) =>
  `${RUNWARE_BASE}/tasks/${id}?include=outputs`;

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY")!;

/* ===================== CONFIG ===================== */

// 🔥 HARD WALL 8 MINUTES
const MAX_RUNTIME_MS = 8 * 60 * 1000;
const POLL_INTERVAL_MS = 1500;
const MAX_POLLS = Math.floor(MAX_RUNTIME_MS / POLL_INTERVAL_MS);

/* ===================== HELPERS ===================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function chargeJobCredits(
  sb: ReturnType<typeof createClient>,
  jobId: string,
) {
  const { data: job } = await sb
    .from("jobs")
    .select("user_id, settings")
    .eq("id", jobId)
    .single();

  if (!job?.user_id) return;

  // Determine plan — check profile, not credits (flux.base has credits:1 but free users still use it)
  const { data: profile } = await sb
    .from("profiles")
    .select("plan_code")
    .eq("id", job.user_id)
    .single();

  const isFree = (profile?.plan_code || "free").toLowerCase() === "free";

  if (isFree) {
    // Free user — log quota usage so cross-device remaining count stays accurate
    const { error } = await sb
      .from("image_generations")
      .insert({ user_id: job.user_id });
    if (error) console.error("Free usage log failed after success:", error);
  } else {
    // Paid user — deduct credits
    const credits = Number(job.settings?.credits ?? 0);
    if (credits > 0) {
      const { error } = await sb.rpc("deduct_credits", {
        uid: job.user_id,
        amount: credits,
      });
      if (error) console.error("Credit deduction failed after success:", error);
    }
  }
}

function extractImageUrl(obj: any): string | null {
  const d0 = obj?.data?.[0] ?? obj?.data ?? obj ?? {};
  return d0?.imageURL || d0?.outputs?.[0]?.imageURL || null;
}

async function uploadImageToRunware(publicUrl: string): Promise<string> {
  const uploadTask = {
    taskType: "imageUpload",
    taskUUID: crypto.randomUUID(),
    image: publicUrl,
  };

  const res = await fetch(TASKS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RUNWARE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([uploadTask]),
  });

  const json = await res.json();

  if (!res.ok || !json?.data?.[0]?.imageURL) {
    throw new Error("Runware imageUpload failed");
  }

  return json.data[0].imageURL;
}

/* ===================== MAIN ===================== */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, apikey",
      },
    });
  }

  let jobId: string | null = null;
  let sb: ReturnType<typeof createClient> | null = null;

  try {
    const body = await req.json();
    const {
      jobId: parsedJobId,
      airTag,
      prompt,
      referenceImages = [],
      settings = {},
    } = body;

    jobId = parsedJobId ?? null;

    if (!jobId || !airTag || !prompt) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400 }
      );
    }

    sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    await sb.rpc("bump_job_progress", {
      p_id: jobId,
      p_progress: 10,
    });

    /* ---------- Upload refs ---------- */
    const runwareRefs: string[] = [];
    for (const url of referenceImages) {
      if (typeof url === "string" && url.startsWith("https://")) {
        const rwUrl = await uploadImageToRunware(url);
        runwareRefs.push(rwUrl);
      }
    }

    /* ---------- Build task ---------- */
    const task: any = {
      taskType: "imageInference",
      taskUUID: crypto.randomUUID(),
      model: airTag,
      positivePrompt: prompt,
      width: settings?.width ?? 1024,
      height: settings?.height ?? 1024,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "PNG",
    };

    if (runwareRefs.length > 0) {
      task.inputs = { referenceImages: runwareRefs };
    }

    if (airTag.startsWith("openai:")) {
      task.providerSettings = {
        ...(task.providerSettings ?? {}),
        openai: {
          quality:
            settings?.provider_hint?.settings?.quality ?? "high",
        },
      };
    }

    console.log("runware payload", JSON.stringify(task));

    /* ---------- Create ---------- */
    const createRes = await fetch(TASKS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWARE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
    });

    const createJson = await createRes.json();

    if (!createRes.ok || createJson?.errors?.length) {
      const message =
        createJson?.errors?.[0]?.message ||
        "Image provider rejected the prompt.";

      await sb.rpc("finish_job_failed", {
        p_id: jobId,
        p_error: message,
      });

      return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
    }

    const providerId =
      createJson?.data?.[0]?.taskUUID ?? task.taskUUID;

    /* ---------- Instant success ---------- */
    const immediate = extractImageUrl(createJson);
    if (immediate) {
      await sb.rpc("finish_job_success", {
        p_id: jobId,
        p_url: immediate,
        p_output: createJson,
      });
      await chargeJobCredits(sb, jobId);
      return new Response(JSON.stringify({ ok: true, url: immediate }));
    }

    /* ================= POLLING (FIXED) ================= */

    const start = Date.now();

    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);

      if (Date.now() - start > MAX_RUNTIME_MS) break;

      let pollJson: any;

      try {
        const pollRes = await fetch(TASK_GET(providerId), {
          headers: { Authorization: `Bearer ${RUNWARE_KEY}` },
        });

        pollJson = await pollRes.json();
      } catch (e) {
        console.log("Poll error — continuing...");
        continue;
      }

      if (!pollJson) continue;

      const url = extractImageUrl(pollJson);

      // ✅ ONLY REAL SUCCESS
      if (url) {
        await sb.rpc("finish_job_success", {
          p_id: jobId,
          p_url: url,
          p_output: pollJson,
        });
        await chargeJobCredits(sb, jobId);
        return new Response(JSON.stringify({ ok: true, url }));
      }

      const status = String(pollJson?.status || "").toLowerCase();

      // Runware's timeout error — task is still processing on their end, keep polling
      const errorCode = pollJson?.errorCode ?? pollJson?.data?.[0]?.errorCode;
      if (errorCode === "failedTaskTimeout") {
        console.log("Runware failedTaskTimeout — task still processing, continuing poll");
        continue;
      }

      // 🔥 IGNORE THESE (Runware lies about failed status)
      if (status === "failed") {
        console.log("Ignoring transient failed status");
        continue;
      }

      if (["completed", "done", "succeeded"].includes(status)) {
        if (!url) {
          console.log("Done but no URL yet — waiting");
          continue;
        }
      }
    }

    /* ================= FINAL FAIL ================= */

    await sb.rpc("finish_job_failed", {
      p_id: jobId,
      p_error: "Final timeout after 8 minutes",
    });

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Image generation took too long. Please try again.",
      }),
      { status: 504 }
    );

  } catch (e) {
    console.error("runware-image failure:", e);

    if (jobId && sb) {
      await sb.rpc("finish_job_failed", {
        p_id: jobId,
        p_error: `Unhandled error: ${e instanceof Error ? e.message : String(e)}`,
      }).catch((rpcErr) => console.error("finish_job_failed also failed:", rpcErr));
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Image provider temporarily unavailable.",
      }),
      { status: 500 }
    );
  }
});