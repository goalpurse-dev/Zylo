// supabase/functions/tiktok-publish-status/index.ts
// Returns the current status of a TikTok publish job.
//
// For terminal states (published / draft_created / failed / canceled) this is
// a fast DB read. For non-terminal states with a stored tiktok_publish_id,
// this re-checks TikTok's status/fetch endpoint directly — this covers the
// case where the background poller in tiktok-publish-video timed out before
// TikTok finished processing.

// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { cors, ok, err } from "../shared/cors.ts";
import { requireUser, supabaseForUser } from "../shared/auth.ts";
import { decryptToken } from "../shared/social-token.ts";

/* ── ENV ──────────────────────────────────────────────────────────────────── */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ENC_KEY_HEX  = Deno.env.get("SOCIAL_TOKEN_ENCRYPTION_KEY")!;

const TT_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const TERMINAL = ["published", "draft_created", "failed", "canceled"];

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

function userMessage(errorCode: string | null, fallback: string): string {
  const map: Record<string, string> = {
    TIKTOK_PROCESSING_FAILED: "TikTok couldn't process this video. Please try again.",
    NO_PUBLISH_ID:            "TikTok didn't return a publish ID. Please try again.",
    INIT_FAILED:              "TikTok rejected this upload. Please try again.",
    INIT_EXCEPTION:           "Could not reach TikTok. Please try again.",
    access_token_invalid:     "TikTok connection has expired. Please reconnect.",
  };
  return (errorCode && map[errorCode]) ? map[errorCode] : fallback;
}

function shape(job: any, overrides: Record<string, unknown> = {}) {
  return {
    job_id:           job.id,
    status:           job.status,
    publish_mode:     job.publish_mode,
    tiktok_post_id:   job.tiktok_post_id  ?? null,
    tiktok_share_url: job.tiktok_share_url ?? null,
    error:            job.error_message
      ? userMessage(job.error_code, job.error_message)
      : null,
    created_at:   job.created_at,
    published_at: job.published_at ?? null,
    ...overrides,
  };
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
    .from("tiktok_publish_jobs")
    .select(
      "id, status, publish_mode, social_account_id, tiktok_publish_id, tiktok_post_id, " +
      "tiktok_share_url, error_code, error_message, created_at, published_at",
    )
    .eq("id", job_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobErr || !job) {
    return err(req, "Publish job not found", 404);
  }

  if (TERMINAL.includes(job.status)) {
    return ok(req, shape(job));
  }

  // ── Non-terminal + we have a publish_id: re-check TikTok directly ────────
  if (job.tiktok_publish_id) {
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: account } = await sb
      .from("social_accounts")
      .select("access_token_encrypted")
      .eq("id", job.social_account_id)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (account?.access_token_encrypted) {
      try {
        const token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);

        const res = await fetch(TT_STATUS_URL, {
          method:  "POST",
          headers: {
            Authorization:  `Bearer ${token}`,
            "Content-Type": "application/json; charset=UTF-8",
          },
          body: JSON.stringify({ publish_id: job.tiktok_publish_id }),
        });

        if (res.ok) {
          const json = await res.json().catch(() => ({}));
          const ttStatus   = String(json?.data?.status ?? "").toUpperCase();
          const failReason = json?.data?.fail_reason ?? null;

          if (ttStatus.includes("FAIL")) {
            await sb.from("tiktok_publish_jobs").update({
              status:        "failed",
              error_code:    "TIKTOK_PROCESSING_FAILED",
              error_message: "TikTok couldn't process this video.",
              updated_at:    new Date().toISOString(),
            }).eq("id", job.id);

            if (failReason) console.error("[tt-publish-status] TikTok fail_reason:", failReason);

            return ok(req, shape(job, { status: "failed" }));
          }

          if (ttStatus.includes("COMPLETE") || ttStatus.includes("SUCCESS")) {
            const isDraft = job.publish_mode === "draft";
            const postId  = json?.data?.publicaly_available_post_id?.[0] ?? null;
            const now     = new Date().toISOString();

            await sb.from("tiktok_publish_jobs").update({
              status:         isDraft ? "draft_created" : "published",
              tiktok_post_id: postId,
              published_at:   now,
              updated_at:     now,
            }).eq("id", job.id);

            return ok(req, shape(job, {
              status:         isDraft ? "draft_created" : "published",
              tiktok_post_id: postId,
              published_at:   now,
            }));
          }
        }
      } catch (e) {
        // Non-fatal: return current DB status if live check fails
        console.warn("[tt-publish-status] Live check exception:", (e as Error).message);
      }
    }
  }

  return ok(req, shape(job));
});
