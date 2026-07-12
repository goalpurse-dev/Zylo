// supabase/functions/youtube-publish-status/index.ts
// Returns the current status of a YouTube publish job.
// Terminal states are served directly from the DB.
// "processing" state re-checks the YouTube API for upload status.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser, supabaseForUser } from "../shared/auth.ts";

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

function userMessage(errorCode: string | null, fallback: string): string {
  const map: Record<string, string> = {
    UPLOAD_INIT_FAILED: "YouTube rejected this upload. Please try again.",
    UPLOAD_FAILED:      "Video upload to YouTube failed. Please try again.",
    NO_VIDEO_ID:        "YouTube returned an unexpected response. Please try again.",
    VIDEO_FETCH_FAILED: "Could not read your video. Please try again.",
    TOKEN_REFRESH:      "YouTube connection has expired. Please reconnect.",
  };
  return (errorCode && map[errorCode]) ? map[errorCode] : fallback;
}

/* ── HANDLER ──────────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors(req) });
  }
  if (req.method !== "POST") {
    return err(req, "Method not allowed", 405);
  }

  const { user, authError } = await requireUser(req);
  if (authError || !user) {
    return err(req, "Unauthorized", 401);
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const { job_id } = body ?? {};
  if (!job_id || typeof job_id !== "string") {
    return err(req, "job_id required", 400);
  }

  // Read via user-scoped client (RLS enforces ownership)
  const userSb = supabaseForUser(req);
  const { data: job, error: jobErr } = await userSb
    .from("youtube_publish_jobs")
    .select(
      "id, status, youtube_video_id, youtube_url, error_code, error_message, created_at, published_at",
    )
    .eq("id", job_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobErr || !job) {
    return err(req, "Publish job not found", 404);
  }

  return ok(req, {
    job_id:           job.id,
    status:           job.status,
    youtube_video_id: job.youtube_video_id ?? null,
    youtube_url:      job.youtube_url      ?? null,
    error:            job.error_message
      ? userMessage(job.error_code, job.error_message)
      : null,
    created_at:   job.created_at,
    published_at: job.published_at ?? null,
  });
});
