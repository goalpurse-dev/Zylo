// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ===================== ENV ===================== */
const RUNWARE_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_BASE = "https://api.runware.ai/v1/air";
const TASKS_URL = `${RUNWARE_BASE}/tasks`;
const TASK_GET = (id: string) => `${RUNWARE_BASE}/tasks/${id}?include=outputs`;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY") ?? "";

/* ===================== HELPERS ===================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pickProviderId(createJson: any, fallback: string) {
  const first = createJson?.data?.[0] ?? createJson?.data ?? createJson ?? {};
  return (
    first?.taskUUID ||
    first?.taskId ||
    first?.id ||
    createJson?.taskUUID ||
    createJson?.taskId ||
    createJson?.id ||
    fallback
  );
}

function extractImageUrl(obj: any): string | null {
  // Your known success shape:
  // { data: [ { imageURL, taskUUID, ... } ] }
  const d0 = obj?.data?.[0] ?? obj?.data ?? obj ?? {};

  return (
    // ✅ the one you showed
    d0?.imageURL ||

    // outputs variants
    d0?.outputs?.[0]?.imageURL ||
    d0?.outputs?.[0]?.url ||

    // other common variants
    d0?.output?.[0]?.imageURL ||
    d0?.output?.[0]?.url ||
    d0?.url ||

    // sometimes nested at root
    obj?.data?.[0]?.imageURL ||
    obj?.outputs?.[0]?.imageURL ||
    obj?.outputs?.[0]?.url ||
    obj?.imageURL ||
    obj?.url ||

    null
  );
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

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    if (!RUNWARE_KEY) throw new Error("Missing RUNWARE_API_KEY");
    if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("Missing SUPABASE_URL / SERVICE_KEY");

    const body = await req.json().catch(() => ({}));
    const { jobId, airTag, prompt, imageUrl, settings } = body;

    if (!jobId || !airTag || !prompt) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // mark running a bit (optional)
    await sb.rpc("bump_job_progress", { p_id: jobId, p_progress: 12 });

    /* ---------- create runware task ---------- */
    const taskUUID = crypto.randomUUID();

    const task = {
      taskType: "imageInference",
      taskUUID,
      model: airTag,
      positivePrompt: prompt,
      width: settings?.width ?? 1024,
      height: settings?.height ?? 1024,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "PNG",
      ...(imageUrl ? { inputImages: [imageUrl] } : {}),
    };

    const createRes = await fetch(TASKS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RUNWARE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
    });

    const createText = await createRes.text();
    let createJson: any = {};
    try {
      createJson = JSON.parse(createText);
    } catch {
      // if runware returns non-json
      throw new Error(`Runware create returned non-JSON (${createRes.status}): ${createText.slice(0, 500)}`);
    }

    if (!createRes.ok) {
      throw new Error(`Runware create failed (${createRes.status}): ${JSON.stringify(createJson).slice(0, 800)}`);
    }

    const providerId = pickProviderId(createJson, taskUUID);

    // Sometimes Runware returns imageURL immediately in create response.
    const immediateUrl = extractImageUrl(createJson);
    if (immediateUrl) {
      await sb.rpc("finish_job_success", {
        p_id: jobId,
        p_url: immediateUrl,
        p_output: { provider: "runware", model: airTag, raw: createJson },
      });

      return new Response(JSON.stringify({ ok: true, url: immediateUrl }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    /* ---------- poll ---------- */
    let progress = 12;
    const MAX_POLLS = 180; // ~3.6 minutes
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(1200);

      const pollRes = await fetch(TASK_GET(providerId), {
        headers: { Authorization: `Bearer ${RUNWARE_KEY}` },
      });

      const pollText = await pollRes.text();
      let pollJson: any = {};
      try {
        pollJson = JSON.parse(pollText);
      } catch {
        // ignore parse error; keep polling
        pollJson = { _raw: pollText };
      }

      const url = extractImageUrl(pollJson);

      progress = Math.min(95, progress + 2);
      await sb.rpc("bump_job_progress", { p_id: jobId, p_progress: progress });

      if (url) {
        await sb.rpc("finish_job_success", {
          p_id: jobId,
          p_url: url,
          p_output: { provider: "runware", model: airTag, raw: pollJson },
        });

        return new Response(JSON.stringify({ ok: true, url }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (pollJson?.status === "failed") {
        throw new Error(`Runware task failed: ${JSON.stringify(pollJson).slice(0, 800)}`);
      }
    }

    // Log helpful debug into the job row so you can see it in Supabase table
    await sb.rpc("finish_job_fail", {
      p_id: jobId,
      p_error: `Runware timeout. providerId=${providerId}`,
    });

    return new Response(JSON.stringify({ ok: false, error: "Runware timeout" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
