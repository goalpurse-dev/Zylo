// generate-long-form-preview/index.ts
//
// Submits ONE real, FREE-TO-USER concept-preview image job for a Long Form
// idea. This is Task section 12's "Option B": a dedicated authenticated
// endpoint that creates the normal Runware job (same jobs table, same
// job-worker/runware-image pipeline every other Zyvo image tool uses) but
// marks the billing owner as platform/internal — charge_credits is always
// 0, decided entirely server-side. The frontend sends only
// { visualDirection, discoverySessionId, styleContext? } — it never sends
// anything billing-related, so there is no client-controllable "free" flag
// to spoof. Arbitrary normal Flux generations (createImageJobSimple, the
// public client path) are completely untouched and remain paid as before.
//
// POST { visualDirection, discoverySessionId, styleContext? }
// Returns { jobId }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { getPlanPriority } from "../../../src/lib/queuePriority.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOURCE = "generate-long-form-preview";
const TOOL_KEY = "image:flux.base";
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 720;

// Defensive cap even though preview volume is already implicitly bounded by
// generate-long-form-ideas' batch cooldown (2 free batches x 10 = 20 per
// session before a 3h wait) — guards this endpoint on its own in case it's
// ever called out of step with that gate.
const MAX_PREVIEWS_PER_SESSION = 40;

// This is the single source of truth for the Style Lock + negative rules —
// prompt construction now lives entirely server-side (the old frontend
// conceptPreviewPrompt.js was removed once submission moved here).
const DEFAULT_STYLE_LOCK = [
  "premium 2D illustrated explainer/documentary artwork",
  "clean expressive silhouettes",
  "strong controlled outlines",
  "flat/semi-flat colors",
  "limited clean shading",
  "high visual readability",
  "professionally composed 16:9 scene",
  "detailed enough to feel premium",
  "clear focal subject",
  "educational documentary visual language",
  "consistent Zyvo 2D illustrated style",
].join(", ");
const NEGATIVE_PROMPT = [
  "text", "lettering", "words", "letters", "captions", "titles", "logos",
  "watermark", "UI", "numbers", "labels", "typography", "bad anatomy", "low-quality artifacts",
].join(", ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const visualDirection = String(body?.visualDirection ?? "").trim().slice(0, 600);
  const discoverySessionId = String(body?.discoverySessionId ?? "").trim();
  const styleLock =
    body?.styleContext && typeof body.styleContext.styleLock === "string" ? body.styleContext.styleLock.slice(0, 2000) : DEFAULT_STYLE_LOCK;

  if (visualDirection.length < 4) return err(req, "Missing visualDirection", 400);
  if (!discoverySessionId) return err(req, "Missing discoverySessionId", 400);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data: session, error: sessionError } = await admin
    .from("long_form_discovery_sessions")
    .select("id, user_id, preview_images_generated")
    .eq("id", discoverySessionId)
    .maybeSingle();

  if (sessionError || !session) return err(req, "Discovery session not found", 404);
  if (session.user_id !== user.id) return err(req, "Forbidden", 403);
  if (session.preview_images_generated >= MAX_PREVIEWS_PER_SESSION) {
    return err(req, "Preview limit reached for this session", 429, { code: "PREVIEW_LIMIT_REACHED" });
  }

  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
  const planCode = (profile?.plan_code ?? "free").toLowerCase().trim();

  const jobId = crypto.randomUUID();
  const prompt = `${visualDirection}. Visual style: ${styleLock}.`;

  const insertPayload = {
    id: jobId,
    user_id: user.id,
    type: "image",
    tool_key: TOOL_KEY,
    project_id: null,
    prompt,
    settings: { tool_key: TOOL_KEY, credits: 0, priceUSD: 0, creation_type: "photo" },
    input: {
      tool: "image",
      subject: prompt,
      style: null,
      creation_type: "photo",
      negative: NEGATIVE_PROMPT,
      brand: { id: null, use_palette: false },
      init_image_url: null,
      width: PREVIEW_WIDTH,
      height: PREVIEW_HEIGHT,
    },
    status: "queued",
    progress: 0,
    // The whole point of this endpoint: charge_credits is hardcoded to 0
    // here, server-side, never derived from anything the client sent.
    charge_credits: 0,
    charged: false,
    priority: getPlanPriority(planCode),
    plan_code: planCode,
    provider: "runware",
    attempts: 0,
    max_attempts: 5,
    retry_after: new Date().toISOString(),
  };

  const { error: insertError } = await admin.from("jobs").insert(insertPayload);
  if (insertError) {
    await logEvent(SOURCE, "error", "job_insert_failed", { userId: user.id, discoverySessionId, message: insertError.message });
    return err(req, "Could not create preview job", 500);
  }

  // Fire-and-forget, same as the client's own runWorkerForJob — the caller
  // tracks completion via the jobs row itself (Realtime + poll), not this response.
  fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ jobId }),
  }).catch((e) => logEvent(SOURCE, "warn", "worker_dispatch_failed", { userId: user.id, jobId, message: String(e) }));

  await admin
    .from("long_form_discovery_sessions")
    .update({ preview_images_generated: session.preview_images_generated + 1, updated_at: new Date().toISOString() })
    .eq("id", discoverySessionId);

  await logEvent(SOURCE, "info", "preview_job_submitted", { userId: user.id, jobId, discoverySessionId, toolKey: TOOL_KEY });

  return ok(req, { jobId });
});
