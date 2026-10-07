// generate-long-form-idea-thumbnails/index.ts
//
// Final-polish round 4, Section 4 — submits one real Runware image job per
// idea's thumbnail for ProductionSetup.jsx's ideas grid. Reuses the exact
// same low-level plumbing every Zyvo image tool (and the older
// generate-long-form-preview) already uses: a row in the standard `jobs`
// table, picked up by the standard job-worker -> runware-image -> Runware
// pipeline. What's NEW here vs. generate-long-form-preview is the model
// (Flux 9B, not flux.base), the prompt (deterministic: a fixed per-style
// header + the idea's own LLM-written thumbnailConcept + fixed text rules —
// see buildThumbnailPrompt in src/lib/longFormIdeaThumbnails.ts, the one
// place style/concept are ever combined), and billing (this is NOT always
// free — see "why billing is here" below).
//
// POST { discoverySessionId, styleId, ideas: [{ id, thumbnailConcept }], batchId?, mode? }
// Returns { jobs: [{ ideaId, jobId }], charged }
//
// WHY BILLING IS HERE, NOT ALWAYS FREE (unlike generate-long-form-preview):
// the product spec prices "regenerate ideas" (text + thumbnails together) and
// "refresh thumbnails" (thumbnails only, after a style change) at the SAME
// flat 2 credits — never per-image. generate-long-form-ideas already charges
// that 2 credits (or determines the batch is this draft's free first one)
// and, on success, stamps `last_idea_batch_id` on the session. A caller here
// that passes the SAME batchId right after a real ideas call rides that
// charge for free (claimed exactly once — see last_idea_batch_thumbnails_claimed,
// which blocks replay); any other call (no batchId, or an already-claimed
// one — the "Refresh thumbnails" button, which doesn't touch ideas at all)
// is charged REFRESH_THUMBNAILS_COST directly, via the same deduct_credits
// RPC every credit charge in this codebase uses, keyed off the caller's own
// verified user id — never a client-trusted "is this free" flag.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { getPlanPriority } from "../../../src/lib/queuePriority.ts";
import {
  buildThumbnailPrompt,
  REFRESH_THUMBNAILS_COST,
  THUMBNAIL_IMAGE_TOOL_KEY,
  THUMBNAIL_WIDTH,
  THUMBNAIL_HEIGHT,
  THUMBNAIL_HEADLINE_MODE,
} from "../../../src/lib/longFormIdeaThumbnails.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SOURCE = "generate-long-form-idea-thumbnails";

const MAX_IDEAS_PER_REQUEST = 12; // one batch is 10; a little slack, never unbounded

const NEGATIVE_PROMPT_IN_IMAGE = [
  "misspelled text", "garbled text", "extra letters", "watermark", "logo", "UI", "low-quality artifacts", "bad anatomy",
].join(", ");
const NEGATIVE_PROMPT_OVERLAY = [
  "text", "lettering", "words", "letters", "captions", "titles", "logos", "watermark", "UI", "numbers", "labels",
  "typography", "bad anatomy", "low-quality artifacts",
].join(", ");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const body = await req.json().catch(() => ({}));
  const discoverySessionId = String(body?.discoverySessionId ?? "").trim();
  const styleId = String(body?.styleId ?? "").trim();
  const requestedBatchId = typeof body?.batchId === "string" ? body.batchId.trim() : null;
  const isRetry = Boolean(body?.retry) && Array.isArray(body?.ideas) && body.ideas.length === 1;
  const mode = body?.mode === "IN_IMAGE" ? "IN_IMAGE" : THUMBNAIL_HEADLINE_MODE;
  const rawIdeas = Array.isArray(body?.ideas) ? body.ideas.slice(0, MAX_IDEAS_PER_REQUEST) : [];

  if (!discoverySessionId) return err(req, "Missing discoverySessionId", 400);
  if (!styleId) return err(req, "Missing styleId", 400);
  if (rawIdeas.length === 0) return err(req, "Missing ideas", 400);

  const { data: session, error: sessionError } = await admin
    .from("long_form_discovery_sessions")
    .select("id, user_id, last_idea_batch_id, last_idea_batch_thumbnails_claimed")
    .eq("id", discoverySessionId)
    .maybeSingle();
  if (sessionError || !session) return err(req, "Discovery session not found", 404);
  if (session.user_id !== user.id) return err(req, "Forbidden", 403);

  // Free exactly once per real idea batch (piggybacking on the charge/free
  // decision generate-long-form-ideas already made); every other call pays —
  // EXCEPT a single-idea retry of a card that failed within a batch the user
  // already paid (or was free) for, which stays free regardless of whether
  // the batch's one free ride was already claimed (fixing a failed
  // generation isn't new paid content). Bounded abuse surface: at most
  // re-generates one already-real image per call, never a fresh 10-pack.
  const belongsToRealBatch = Boolean(requestedBatchId) && requestedBatchId === session.last_idea_batch_id;
  const ridesFreeIdeaBatch = belongsToRealBatch && !session.last_idea_batch_thumbnails_claimed;
  const isFreeRetry = isRetry && belongsToRealBatch;
  const charge = ridesFreeIdeaBatch || isFreeRetry ? 0 : REFRESH_THUMBNAILS_COST;
  // 2026-10-08: a paid refresh is one purchase of up to ten pictures. Its jobs carry this id, so
  // generation-sweeper can give the credits back by itself when EVERY picture of it failed
  // (it used to keep the 2 credits whatever happened). Free batches and free retries carry none.
  const refreshId = charge > 0 ? crypto.randomUUID() : null;

  if (charge > 0) {
    const { error: chargeError } = await admin.rpc("deduct_credits", { uid: user.id, amount: charge });
    if (chargeError) return err(req, "Not enough credits to refresh thumbnails.", 402, { code: "INSUFFICIENT_CREDITS" });
  }
  async function refundIfCharged(reason: string) {
    if (charge <= 0) return;
    const { error: refundError } = await admin.rpc("deduct_credits", { uid: user.id, amount: -charge });
    if (refundError) {
      await logEvent(SOURCE, "error", "refund_failed", { userId: user.id, discoverySessionId, reason, message: refundError.message });
    }
  }

  const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
  const planCode = (profile?.plan_code ?? "free").toLowerCase().trim();
  const negativePrompt = mode === "IN_IMAGE" ? NEGATIVE_PROMPT_IN_IMAGE : NEGATIVE_PROMPT_OVERLAY;

  const jobs: { ideaId: string; jobId: string }[] = [];
  const insertRows: Record<string, unknown>[] = [];

  for (const raw of rawIdeas) {
    const ideaId = String(raw?.id ?? "").trim();
    const concept = raw?.thumbnailConcept;
    if (!ideaId || !concept || typeof concept.headline !== "string" || typeof concept.scene !== "string") continue;
    const prompt = buildThumbnailPrompt(styleId, { headline: concept.headline, scene: concept.scene }, mode);
    // A style with no thumbnail header yet (not production-ready) can't
    // generate any thumbnail — skip it, never silently borrow another
    // style's look (matches visualStyles.js's own "coming soon" contract).
    if (!prompt) continue;
    const jobId = crypto.randomUUID();
    jobs.push({ ideaId, jobId });
    insertRows.push({
      id: jobId,
      user_id: user.id,
      type: "image",
      tool_key: THUMBNAIL_IMAGE_TOOL_KEY,
      project_id: null,
      prompt,
      settings: { tool_key: THUMBNAIL_IMAGE_TOOL_KEY, credits: 0, priceUSD: 0, creation_type: "photo", ...(refreshId ? { thumb_refresh_id: refreshId, thumb_refresh_credits: charge } : {}) },
      input: {
        tool: "image",
        subject: prompt,
        style: null,
        creation_type: "photo",
        negative: negativePrompt,
        brand: { id: null, use_palette: false },
        init_image_url: null,
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      },
      status: "queued",
      progress: 0,
      // The real charge (if any) already happened above, once, for the
      // whole batch — every individual job here is booked as free so the
      // normal post-success job billing path never double-charges.
      charge_credits: 0,
      charged: false,
      priority: getPlanPriority(planCode),
      plan_code: planCode,
      provider: "runware",
      attempts: 0,
      max_attempts: 5,
      retry_after: new Date().toISOString(),
    });
  }

  if (insertRows.length === 0) {
    await refundIfCharged("no_valid_ideas");
    return err(req, "No valid ideas to generate thumbnails for", 400);
  }

  const { error: insertError } = await admin.from("jobs").insert(insertRows);
  if (insertError) {
    await logEvent(SOURCE, "error", "job_insert_failed", { userId: user.id, discoverySessionId, message: insertError.message });
    await refundIfCharged("job_insert_failed");
    return err(req, "Could not create thumbnail jobs", 500);
  }

  // The refresh's own charge, on the credit ledger (against its first job), so the refund that
  // may follow has a charge to stand against. The key makes it once.
  if (refreshId) {
    const { error: ledgerError } = await admin.from("generation_credit_ledger").insert({ job_id: jobs[0].jobId, user_id: user.id, operation: "charge", amount: charge, idempotency_key: `thumb_refresh:${refreshId}:charge` });
    if (ledgerError) await logEvent(SOURCE, "warn", "refresh_ledger_failed", { userId: user.id, discoverySessionId, message: ledgerError.message });
  }

  // Account-level ledger row (no project yet): the jobs pipeline does not
  // return a Runware cost, so this is the list price per image (estimated).
  await recordCost(admin, { userId: user.id, stage: "other", provider: "runware", model: THUMBNAIL_IMAGE_TOOL_KEY, units: { calls: jobs.length, images: jobs.length, purpose: "idea_thumbnails" } as any, usd: jobs.length * 0.00169, sourceTable: "long_form_discovery_sessions", sourceId: discoverySessionId || null });

  // Fire-and-forget per job, same pattern as generate-long-form-preview —
  // the caller tracks completion via each jobs row itself (Realtime + poll).
  for (const { jobId } of jobs) {
    fetch(`${SUPABASE_URL}/functions/v1/job-worker`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    }).catch((e) => logEvent(SOURCE, "warn", "worker_dispatch_failed", { userId: user.id, jobId, message: String(e) }));
  }

  const nowIso = new Date().toISOString();
  if (ridesFreeIdeaBatch) {
    await admin
      .from("long_form_discovery_sessions")
      .update({ last_idea_batch_thumbnails_claimed: true, updated_at: nowIso })
      .eq("id", discoverySessionId);
  }
  await admin.from("long_form_discovery_sessions").update({ last_idea_batch_style_id: styleId, updated_at: nowIso }).eq("id", discoverySessionId);

  await logEvent(SOURCE, "info", "thumbnail_jobs_submitted", {
    userId: user.id,
    discoverySessionId,
    count: jobs.length,
    charged: charge,
    mode,
    toolKey: THUMBNAIL_IMAGE_TOOL_KEY,
  });

  return ok(req, { jobs, charged: charge });
});
