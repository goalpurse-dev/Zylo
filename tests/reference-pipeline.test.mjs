import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeReferencePayloadWith } from "../src/lib/referencePayload.ts";
import {
  ProviderReferenceError,
  assertProviderAccessibleImageUrl,
  materializeReferencePayload,
  validateReferencePayload,
} from "../supabase/functions/_shared/referenceImages.ts";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("blob reference is replaced before submission", async () => {
  const result = await normalizeReferencePayloadWith(
    { referenceImage: "blob:https://www.tryzyvo.com/local-id" },
    async () => ({ url: "https://cdn.example/ref.jpg", storagePath: "generation-references/u/j/r.jpg" }),
  );
  assert.equal(result.value.referenceImage, "https://cdn.example/ref.jpg");
});

test("normalized database payload contains no blob URL", async () => {
  const result = await normalizeReferencePayloadWith(
    { input: { ref_images: ["blob:https://app/a"] } },
    async () => ({ url: "https://cdn.example/a.jpg" }),
  );
  assert.doesNotMatch(JSON.stringify(result.value), /blob:/);
  const sql = await source("supabase/migrations/20260802000000_reference_image_pipeline.sql");
  assert.match(sql, /reject_local_reference_urls/);
  assert.match(sql, /REFERENCE_IMAGE_NOT_ACCESSIBLE/);
});

test("backend rejects blob before provider construction", () => {
  assert.throws(
    () => validateReferencePayload({ referenceImages: ["blob:https://app/a"] }),
    (error) => error instanceof ProviderReferenceError && error.code === "REFERENCE_IMAGE_NOT_ACCESSIBLE",
  );
});

test("multiple references preserve order", async () => {
  const values = ["blob:https://app/first", "blob:https://app/second", "blob:https://app/third"];
  const result = await normalizeReferencePayloadWith({ referenceImages: values }, async (value, index) => {
    await new Promise((resolve) => setTimeout(resolve, (2 - index) * 3));
    return { url: `https://cdn.example/${String(value).split("/").pop()}.jpg` };
  });
  assert.deepEqual(result.value.referenceImages, [
    "https://cdn.example/first.jpg", "https://cdn.example/second.jpg", "https://cdn.example/third.jpg",
  ]);
});

test("start and end frame positions are retained", async () => {
  const result = await normalizeReferencePayloadWith(
    { firstFrame: "blob:https://app/start", lastFrame: "blob:https://app/end" },
    async (value) => ({ url: String(value).replace("blob:https://app", "https://cdn.example") + ".jpg" }),
  );
  assert.equal(result.value.firstFrame, "https://cdn.example/start.jpg");
  assert.equal(result.value.lastFrame, "https://cdn.example/end.jpg");
});

test("upload failure prevents job creation and deduction", async () => {
  let created = false;
  let deducted = false;
  await assert.rejects(async () => {
    await normalizeReferencePayloadWith({ refs: ["blob:https://app/a"] }, async () => { throw new Error("upload failed"); });
    created = true;
    deducted = true;
  });
  assert.equal(created, false);
  assert.equal(deducted, false);
});

test("invalid backend reference fails before provider call", () => {
  let providerCalled = false;
  assert.throws(() => {
    validateReferencePayload({ frameImages: [{ inputImage: "http://example.com/a.png" }] });
    providerCalled = true;
  });
  assert.equal(providerCalled, false);
});

test("Nano cannot silently continue after losing a required reference", async () => {
  const text = await source("supabase/functions/runware-image/index.ts");
  assert.match(text, /referenceImages\.length !== runwareRefs\.length/);
  assert.match(text, /REFERENCE_IMAGE_NOT_ACCESSIBLE/);
});

test("failed reference refund is exactly-once", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  assert.match(sql, /generation_credit_ledger/);
  assert.match(sql, /UNIQUE\(job_id, operation\)/);
  assert.match(sql, /FOR UPDATE/);
});

test("retry cannot create a second charge or refund", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  assert.match(sql, /credits_charged_at IS NOT NULL/);
  assert.match(sql, /credits_refunded_at\s*=\s*now\(\)/);
});

test("safety rejection has stable friendly status and refund", async () => {
  const text = await source("supabase/functions/runware-video/index.ts");
  assert.match(text, /PROVIDER_SAFETY_REJECTION/);
  assert.match(text, /fail_and_refund_generation_job/);
});

test("valid HTTPS references are returned without storage upload", async () => {
  const text = await source("src/lib/referenceImages.ts");
  const earlyReturn = text.indexOf('return { url: assertLongLivedHttpsReference(input) }');
  const storageUpload = text.indexOf('.upload(path, blob');
  assert.ok(earlyReturn > 0 && earlyReturn < storageUpload);
  assert.equal(assertProviderAccessibleImageUrl("https://cdn.example/a.png"), "https://cdn.example/a.png");
});

test("expired signed reference returns stable code", () => {
  assert.throws(
    () => assertProviderAccessibleImageUrl("https://cdn.example/a.png?expires=1"),
    (error) => error instanceof ProviderReferenceError && error.code === "REFERENCE_IMAGE_EXPIRED",
  );
  const payload = Buffer.from(JSON.stringify({ exp: 1 })).toString("base64url");
  assert.throws(
    () => assertProviderAccessibleImageUrl(`https://project.supabase.co/storage/v1/object/sign/a.png?token=x.${payload}.x`),
    (error) => error instanceof ProviderReferenceError && error.code === "REFERENCE_IMAGE_EXPIRED",
  );
});

test("stale running jobs are recovered and excluded from queued concurrency", async () => {
  const text = await source("supabase/functions/queue-worker/index.ts");
  assert.match(text, /recoverStaleJobs/);
  assert.match(text, /stale_queue_job_recovered/);
  assert.doesNotMatch(text.match(/async function getRunwareProcessingCounts[\s\S]*?function canStartJob/)?.[0] ?? "", /"queued"/);
});

test("job worker concurrency only counts live leased jobs", async () => {
  const text = await source("supabase/functions/job-worker/index.ts");
  const liveCounter = text.match(/const countLiveJobs[\s\S]*?heartbeatMustBeNewerThan\);/)?.[0] ?? "";
  assert.match(liveCounter, /lease_expires_at/);
  assert.match(liveCounter, /heartbeat_at/);
  assert.doesNotMatch(liveCounter, /"queued"/);
  assert.match(text, /countLiveJobs\("image"\)/);
  assert.match(text, /countLiveJobs\("video"\)/);
});

test("generation safety migration only uses valid job_status enum values", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  assert.doesNotMatch(sql, /'cancelled'/);
  assert.match(sql, /status IN \('failed', 'canceled'\)/);
});

test("generation safety migration locks queue before jobs", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  const queueLock = sql.indexOf("LOCK TABLE public.generation_queue IN ACCESS EXCLUSIVE MODE");
  const jobsLock = sql.indexOf("LOCK TABLE public.jobs IN ACCESS EXCLUSIVE MODE");
  const firstAlter = sql.indexOf("ALTER TABLE public.jobs");
  assert.ok(queueLock > 0 && jobsLock > queueLock && firstAlter > jobsLock);
});

test("explicit job handoffs are not blocked by client clock skew", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  const claim = sql.match(/CREATE OR REPLACE FUNCTION public\.claim_generation_job[\s\S]*?\$\$;/)?.[0] ?? "";
  assert.match(claim, /p_job_id IS NOT NULL OR retry_after <= now\(\)/);
  assert.match(claim, /p_job_id IS NULL OR id = p_job_id/);
});

test("zero UUID payload is rejected before claim or queue insertion", async () => {
  const text = await source("supabase/functions/job-worker/index.ts");
  const guard = text.indexOf('body.jobId === "00000000-0000-0000-0000-000000000000"');
  const claim = text.indexOf('claim_generation_job');
  assert.ok(guard > 0 && guard < claim);
});

test("temporary uploads use a separate private bucket and persist a storage reference", async () => {
  const client = await source("src/lib/referenceImages.ts");
  const sql = await source("supabase/migrations/20260802000000_reference_image_pipeline.sql");
  assert.match(client, /REFERENCE_IMAGE_BUCKET = "generation-references"/);
  assert.match(client, /`storage:\/\/\$\{REFERENCE_IMAGE_BUCKET\}/);
  assert.match(sql, /'generation-references', 'generation-references', false/);
  assert.doesNotMatch(sql, /'reference-images', 'reference-images', true/);
});

test("private storage references are signed only for provider dispatch", async () => {
  const calls = [];
  const signer = { storage: { from(bucket) { return { async createSignedUrl(path, ttl) {
    calls.push({ bucket, path, ttl });
    return { data: { signedUrl: "https://project.supabase.co/storage/v1/object/sign/ref?token=x.eyJleHAiOjQxMDI0NDQ4MDB9.x" }, error: null };
  } }; } } };
  const result = await materializeReferencePayload(signer, {
    referenceImages: ["storage://generation-references/user-1/job-1/a.png"],
  }, "user-1");
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { bucket: "generation-references", path: "user-1/job-1/a.png", ttl: 7200 });
  assert.match(result.value.referenceImages[0], /^https:/);
});

test("private reference ownership is enforced before signing", async () => {
  let signed = false;
  const signer = { storage: { from() { return { async createSignedUrl() { signed = true; return { data: null, error: null }; } }; } } };
  await assert.rejects(
    materializeReferencePayload(signer, { firstFrame: "storage://generation-references/other-user/j/a.png" }, "user-1"),
    (error) => error instanceof ProviderReferenceError && error.code === "REFERENCE_IMAGE_FORBIDDEN",
  );
  assert.equal(signed, false);
});

test("mixed rollout keeps legacy HTTPS references provider-compatible", async () => {
  const signer = { storage: { from() { throw new Error("storage must not be called"); } } };
  const result = await materializeReferencePayload(signer, {
    referenceImages: ["https://legacy-cdn.example/ref.png"],
  }, "user-1");
  assert.deepEqual(result.references, ["https://legacy-cdn.example/ref.png"]);
});

test("signed reference URL is never persisted back to job input", async () => {
  const worker = await source("supabase/functions/job-worker/index.ts");
  const materializeAt = worker.indexOf("materializeReferencePayload");
  const handoffAt = worker.indexOf("JSON.stringify(payload)");
  assert.ok(materializeAt > 0 && materializeAt < handoffAt);
  assert.doesNotMatch(worker, /update\(\{\s*input:\s*providerInput/);
});

test("stale recovery requires both lease expiry and heartbeat staleness", async () => {
  const worker = await source("supabase/functions/queue-worker/index.ts");
  assert.match(worker, /\.lt\("lease_expires_at", now\)/);
  assert.match(worker, /\.lt\("heartbeat_at", heartbeatBefore\)/);
  assert.match(worker, /safe_requeue_before_submission/);
});

test("uncertain submissions are quarantined and never auto-refunded", async () => {
  const worker = await source("supabase/functions/queue-worker/index.ts");
  const recovery = worker.match(/async function recoverStaleJobs[\s\S]*?async function recoverExpiredQueueClaims/)?.[0] ?? "";
  assert.match(recovery, /mark_generation_reconciliation_required/);
  assert.doesNotMatch(recovery, /refund_job_credits|finish_job_failed/);
});

test("Runware task IDs are stable across transport retries", async () => {
  const image = await source("supabase/functions/runware-image/index.ts");
  const video = await source("supabase/functions/runware-video/runware.ts");
  assert.match(image, /providerTaskId = String\(settings\?\.provider_job_id \|\| jobId\)/);
  assert.match(video, /args\.providerTaskId \|\| args\.jobId/);
});

test("provider polling refreshes job heartbeats", async () => {
  const [image, video, atlas] = await Promise.all([
    source("supabase/functions/runware-image/index.ts"),
    source("supabase/functions/runware-video/index.ts"),
    source("supabase/functions/runware-video-atlascloud/index.ts"),
  ]);
  for (const text of [image, video, atlas]) assert.match(text, /heartbeat_generation_job/);
});

test("completion and failure are atomic terminal operations", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  assert.match(sql, /complete_generation_job/);
  assert.match(sql, /fail_and_refund_generation_job/);
  assert.match(sql, /completion_rejected/);
  assert.match(sql, /REFUNDED_JOB_CANNOT_SUCCEED/);
});

test("queue-to-job creation has a deterministic identity", async () => {
  const worker = await source("supabase/functions/queue-worker/index.ts");
  assert.match(worker, /id:\s+qJob\.id/);
  assert.match(worker, /recoverExpiredQueueClaims/);
});

test("cleanup uses a managed secret and private bucket", async () => {
  const fn = await source("supabase/functions/cleanup-generation-references/index.ts");
  const cron = await source("supabase/migrations/20260802020000_generation_reference_cleanup_cron.sql");
  assert.match(fn, /CLEANUP_CRON_SECRET/);
  assert.match(fn, /x-cleanup-secret/);
  assert.match(fn, /BUCKET = "generation-references"/);
  assert.match(cron, /vault\.decrypted_secrets/);
  assert.doesNotMatch(cron, /SUPABASE_SERVICE_ROLE_KEY|Bearer ey/);
});

test("provider polling timeouts enter reconciliation instead of refunding", async () => {
  const [image, video, atlas] = await Promise.all([
    source("supabase/functions/runware-image/index.ts"),
    source("supabase/functions/runware-video/index.ts"),
    source("supabase/functions/runware-video-atlascloud/index.ts"),
  ]);
  assert.match(image, /image polling window expired; provider task must be reconciled/);
  assert.match(video, /video polling window expired; provider task must be reconciled/);
  assert.match(atlas, /Atlas polling window expired; provider task must be reconciled/);
});

test("every provider handoff endpoint authenticates the worker", async () => {
  const files = ["runware-image", "runware-video", "runware-video-atlascloud"];
  for (const file of files) {
    const text = await source(`supabase/functions/${file}/index.ts`);
    assert.match(text, /x-job-worker-key/);
  }
});

test("provider logs do not serialize signed reference payloads", async () => {
  const image = await source("supabase/functions/runware-image/index.ts");
  const video = await source("supabase/functions/runware-video/index.ts");
  const atlas = await source("supabase/functions/runware-video-atlascloud/index.ts");
  assert.match(image, /\[redacted-url\]/);
  assert.match(video, /\[redacted-url\]/);
  assert.doesNotMatch(atlas, /LAUNCH PAYLOAD/);
  assert.doesNotMatch(atlas, /POLL:/);
});

test("legacy credit markers are backfilled into the immutable ledger", async () => {
  const sql = await source("supabase/migrations/20260802010000_generation_job_safety.sql");
  assert.match(sql, /FROM public\.jobs WHERE credits_charged_at IS NOT NULL/);
  assert.match(sql, /FROM public\.jobs WHERE credits_refunded_at IS NOT NULL/);
  assert.match(sql, /id::text \|\| ':charge'/);
  assert.match(sql, /id::text \|\| ':refund'/);
});
