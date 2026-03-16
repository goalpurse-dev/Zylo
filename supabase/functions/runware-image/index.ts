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

/* ===================== HELPERS ===================== */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractImageUrl(obj: any): string | null {
  const d0 = obj?.data?.[0] ?? obj?.data ?? obj ?? {};
  return d0?.imageURL || d0?.outputs?.[0]?.imageURL || null;
}

/* ---------- Upload image to Runware ---------- */


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

  return json.data[0].imageURL; // im.runware.ai URL
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

  try {
    const body = await req.json();
    const {
      jobId,
      airTag,
      prompt,
      referenceImages = [],
      settings = {},
    } = body;

    if (!jobId || !airTag || !prompt) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing required fields" }),
        { status: 400 }
      );
    }

    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    await sb.rpc("bump_job_progress", {
      p_id: jobId,
      p_progress: 10,
    });

    /* ---------- Convert refs → Runware ---------- */
    const runwareRefs: string[] = [];
    for (const url of referenceImages) {
      if (typeof url === "string" && url.startsWith("https://")) {
        const rwUrl = await uploadImageToRunware(url);
        runwareRefs.push(rwUrl);
      }
    }

    /* ---------- Build inference task ---------- */
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


console.log("runware-image body", JSON.stringify(body));
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
  console.error("Runware provider error:", createJson);

  const message =
    createJson?.errors?.[0]?.message ||
    "Image provider rejected the prompt.";

  // 🔥 mark job as failed
  await sb.rpc("finish_job_failed", {
    p_id: jobId,
    p_error: message,
  });

  return new Response(
    JSON.stringify({
      ok: false,
      error: message,
    }),
    { status: 200 }
  );
}

if (!createJson?.data || createJson.data.length === 0) {
  console.error("Runware returned empty response:", createJson);

  await sb.rpc("finish_job_failed", {
    p_id: jobId,
    p_error: "Provider returned empty result",
  });

  return new Response(
    JSON.stringify({
      ok: false,
      error: "Image provider temporarily unavailable. Please try again later.",
    }),
    { status: 200 }
  );
}


    const providerId =
      createJson?.data?.[0]?.taskUUID ?? task.taskUUID;

    const immediate = extractImageUrl(createJson);
    if (immediate) {
      await sb.rpc("finish_job_success", {
        p_id: jobId,
        p_url: immediate,
        p_output: createJson,
      });
      return new Response(JSON.stringify({ ok: true, url: immediate }));
    }

    /* ---------- Poll ---------- */
    for (let i = 0; i < 120; i++) {
      await sleep(1200);
      const pollRes = await fetch(TASK_GET(providerId), {
        headers: { Authorization: `Bearer ${RUNWARE_KEY}` },
      });
      const pollJson = await pollRes.json();

if (!pollJson) {
  console.error("Runware poll returned invalid response");
  break;
}

const url = extractImageUrl(pollJson);

      if (url) {
        await sb.rpc("finish_job_success", {
          p_id: jobId,
          p_url: url,
          p_output: pollJson,
        });
        return new Response(JSON.stringify({ ok: true, url }));
      }
    }

    



// ---------- Timeout ----------
await sb.rpc("finish_job_failed", {
  p_id: jobId,
  p_error: "Image provider timeout",
});

return new Response(
  JSON.stringify({
    ok: false,
    error: "Image provider took too long to respond. Please try another model.",
  }),
  { status: 200 }
);

} catch (e) {
  console.error("runware-image failure:", e);

  await sb.rpc("finish_job_failed", {
    p_id: jobId,
    p_error: "Image provider temporarily unavailable",
  });

  return new Response(
    JSON.stringify({
      ok: false,
      error: "Image provider temporarily unavailable. Please try another model.",
    }),
    { status: 200 }
  );
}
});
