// supabase/functions/instagram-publish-status/index.ts
// Returns the current status of an Instagram Reel publish job.
//
// For terminal states (published / failed / canceled) this is a fast DB read.
// For the "processing" state it re-checks the Meta container status and
// advances the job if it has finished — this covers the case where the
// background poller in instagram-publish-reel timed out before Meta finished.

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

const IG_GRAPH_BASE = "https://graph.instagram.com";
const IG_GRAPH_VER  = "v21.0";

/* ── HELPERS ──────────────────────────────────────────────────────────────── */

/** Safe user-facing error map. Raw Meta errors never reach the client. */
function userMessage(errorCode: string | null, fallback: string): string {
  const map: Record<string, string> = {
    PUBLISH_FAILED:
      "Failed to publish to Instagram. Please try again.",
    NO_MEDIA_ID:
      "Instagram returned an unexpected response. Please try again.",
    TIMEOUT:
      "Publishing timed out. Please check your Instagram profile and try again.",
    CONTAINER_FAILED:
      "Instagram could not accept this video. Please check the format.",
    ERROR:
      "Instagram could not process this video. Please check the format and try again.",
    EXPIRED:
      "The upload session expired. Please try publishing again.",
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

  // ── Read job via user-scoped client (RLS enforces ownership) ─────────────
  const userSb = supabaseForUser(req);
  const { data: job, error: jobErr } = await userSb
    .from("instagram_publish_jobs")
    .select(
      "id, status, container_id, social_account_id, media_id, permalink, " +
      "error_code, error_message, created_at, published_at",
    )
    .eq("id", job_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (jobErr || !job) {
    return err(req, "Publish job not found", 404);
  }

  // Terminal states — just return what's in the DB
  if (["published", "failed", "canceled"].includes(job.status)) {
    return ok(req, {
      job_id:       job.id,
      status:       job.status,
      permalink:    job.permalink ?? null,
      media_id:     job.media_id  ?? null,
      error:        job.error_message
        ? userMessage(job.error_code, job.error_message)
        : null,
      created_at:   job.created_at,
      published_at: job.published_at ?? null,
    });
  }

  // ── For "processing" / "publishing": re-check Meta directly ──────────────
  if (
    (job.status === "processing" || job.status === "publishing") &&
    job.container_id
  ) {
    // Need service role to read social_accounts (token column)
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: account } = await sb
      .from("social_accounts")
      .select("platform_user_id, access_token_encrypted")
      .eq("id", job.social_account_id)
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .maybeSingle();

    if (account?.access_token_encrypted) {
      try {
        const token = await decryptToken(account.access_token_encrypted, ENC_KEY_HEX);

        // Check container status
        const statusRes = await fetch(
          `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${job.container_id}` +
          `?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
        );

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          const metaStatus = String(statusData.status_code ?? "");

          if (metaStatus === "FINISHED") {
            // Attempt to publish now
            const publishBody = new URLSearchParams({
              creation_id:  job.container_id,
              access_token: token,
            });
            const publishRes = await fetch(
              `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${account.platform_user_id}/media_publish`,
              {
                method:  "POST",
                headers: { "content-type": "application/x-www-form-urlencoded" },
                body:    publishBody.toString(),
              },
            );

            if (publishRes.ok) {
              const publishData = await publishRes.json();
              const mediaId     = String(publishData.id ?? "");

              let permalink: string | null = null;
              try {
                const plRes = await fetch(
                  `${IG_GRAPH_BASE}/${IG_GRAPH_VER}/${mediaId}` +
                  `?fields=id,permalink&access_token=${encodeURIComponent(token)}`,
                );
                if (plRes.ok) {
                  const plData = await plRes.json();
                  permalink = plData.permalink ?? null;
                }
              } catch { /* permalink optional */ }

              await sb
                .from("instagram_publish_jobs")
                .update({
                  status:       "published",
                  media_id:     mediaId,
                  permalink,
                  published_at: new Date().toISOString(),
                  updated_at:   new Date().toISOString(),
                })
                .eq("id", job.id);

              return ok(req, {
                job_id:       job.id,
                status:       "published",
                permalink,
                media_id:     mediaId,
                error:        null,
                created_at:   job.created_at,
                published_at: new Date().toISOString(),
              });
            }
          } else if (metaStatus === "ERROR" || metaStatus === "EXPIRED") {
            await sb
              .from("instagram_publish_jobs")
              .update({
                status:        "failed",
                error_code:    metaStatus,
                error_message: "Instagram could not process this video.",
                updated_at:    new Date().toISOString(),
              })
              .eq("id", job.id);

            return ok(req, {
              job_id:       job.id,
              status:       "failed",
              permalink:    null,
              media_id:     null,
              error:        userMessage(metaStatus, "Instagram could not process this video."),
              created_at:   job.created_at,
              published_at: null,
            });
          }
        }
      } catch (e) {
        // Non-fatal: return current DB status if live check fails
        console.warn("[ig-publish-status] Live check exception:", (e as Error).message);
      }
    }
  }

  // Return current DB status (processing / queued / creating_container)
  return ok(req, {
    job_id:       job.id,
    status:       job.status,
    permalink:    job.permalink    ?? null,
    media_id:     job.media_id     ?? null,
    error:        job.error_message
      ? userMessage(job.error_code, job.error_message)
      : null,
    created_at:   job.created_at,
    published_at: job.published_at ?? null,
  });
});
