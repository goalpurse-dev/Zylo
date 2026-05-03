// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ═══════════════ ENV ═══════════════ */
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const FAL_KEY      = Deno.env.get("FAL_KEY")!;

const FAL_QUEUE    = "https://queue.fal.run/fal-ai/musetalk";
const FAL_STATUS   = (id: string) => `https://queue.fal.run/fal-ai/musetalk/requests/${id}/status`;
const FAL_RESULT   = (id: string) => `https://queue.fal.run/fal-ai/musetalk/requests/${id}`;

/* ═══════════════ CORS ═══════════════ */
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ═══════════════ HELPERS ═══════════════ */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function extractResultUrl(data: any): Promise<string | null> {
  // fal.ai MuseTalk returns video under different keys depending on version
  return (
    data?.video?.url         ??
    data?.video_url          ??
    data?.output?.url        ??
    data?.output?.video?.url ??
    data?.result?.url        ??
    null
  );
}

/* ═══════════════ MAIN ═══════════════ */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  /* ── Auth ── */
  const authHeader = req.headers.get("Authorization") ?? "";
  const { data: { user }, error: authErr } = await sb.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  /* ── Parse body ── */
  let videoUrl: string, audioUrl: string;
  try {
    const body = await req.json();
    videoUrl = body.videoUrl;
    audioUrl = body.audioUrl;
    if (!videoUrl || !audioUrl) throw new Error("missing fields");
  } catch {
    return json({ error: "videoUrl and audioUrl are required" }, 400);
  }

  /* ── Create job row (processing) ── */
  const { data: job, error: insertErr } = await sb
    .from("lipsync_jobs")
    .insert({ user_id: user.id, video_url: videoUrl, audio_url: audioUrl, status: "processing" })
    .select()
    .single();

  if (insertErr || !job) return json({ error: "Failed to create job" }, 500);

  const markFailed = async (msg: string) => {
    await sb.from("lipsync_jobs")
      .update({ status: "failed", error: msg, updated_at: new Date().toISOString() })
      .eq("id", job.id);
  };

  /* ── Submit to fal.ai queue ── */
  let requestId: string;
  try {
    const submitRes = await fetch(FAL_QUEUE, {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type":  "application/json",
      },
      body: JSON.stringify({
        source_video_url: videoUrl,
        audio_url:        audioUrl,
      }),
    });

    if (!submitRes.ok) {
      const err = await submitRes.text();
      throw new Error(`fal.ai submit failed (${submitRes.status}): ${err.slice(0, 200)}`);
    }

    const submitData = await submitRes.json();
    requestId = submitData.request_id;
    if (!requestId) throw new Error("No request_id returned from fal.ai");
  } catch (e: any) {
    await markFailed(e.message);
    return json({ error: e.message }, 502);
  }

  /* ── Poll for result (max 5 minutes) ── */
  const MAX_WAIT_MS  = 5 * 60 * 1000;
  const POLL_MS      = 4000;
  const start        = Date.now();

  while (Date.now() - start < MAX_WAIT_MS) {
    await sleep(POLL_MS);

    let statusData: any;
    try {
      const statusRes = await fetch(FAL_STATUS(requestId), {
        headers: { "Authorization": `Key ${FAL_KEY}` },
      });
      statusData = await statusRes.json();
    } catch {
      continue; // network hiccup, retry
    }

    if (statusData?.status === "COMPLETED" || statusData?.status === "completed") {
      /* ── Fetch final result ── */
      try {
        const resultRes = await fetch(FAL_RESULT(requestId), {
          headers: { "Authorization": `Key ${FAL_KEY}` },
        });
        const resultData = await resultRes.json();
        const resultUrl  = await extractResultUrl(resultData);

        if (!resultUrl) throw new Error("No video URL in fal.ai response");

        await sb.from("lipsync_jobs").update({
          status:     "completed",
          result_url: resultUrl,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        return json({ resultUrl, jobId: job.id });
      } catch (e: any) {
        await markFailed(e.message);
        return json({ error: e.message }, 500);
      }
    }

    if (statusData?.status === "FAILED" || statusData?.status === "failed") {
      const msg = statusData?.error ?? "fal.ai processing failed";
      await markFailed(msg);
      return json({ error: msg }, 500);
    }

    // IN_QUEUE | IN_PROGRESS → keep polling
  }

  await markFailed("Timed out after 5 minutes");
  return json({ error: "Processing timed out. Please try again." }, 504);
});
