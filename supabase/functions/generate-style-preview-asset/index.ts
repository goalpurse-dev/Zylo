// deno-lint-ignore-file no-explicit-any
// generate-style-preview-asset/index.ts — 2026-10-02 "Production Setup
// redesign" pass, Section 8.
//
// Internal PRODUCT ASSET generator — NOT part of the user-facing generation
// surface. Generates ONE permanent 16:9 preview image per Visual Style
// variant, using the real Nano Banana 2 model (Runware airTag "google:4@3",
// see src/lib/providers.ts's "image:twoam1k" tool key for the confirmed 1K
// tier pricing/id) called DIRECTLY against Runware's REST API — deliberately
// bypassing the whole jobs/credits/user-billing pipeline the generic
// runware-image function wraps, because this is a one-time internal asset,
// never a user generation. No `jobs` row is created, no user is charged.
//
// Uploads the result to Supabase Storage under a durable, stable path
// (style-previews/<styleId>.png) and returns its public URL — callers should
// treat a styleId's asset as generated exactly once; re-invoking with the
// same styleId simply re-generates (this function has no idempotency guard
// of its own — the CALLER, a one-off engineering script, is responsible for
// not re-running it once an asset already exists and looks right).
//
// POST { styleId, prompt, width?, height? }
// Returns { ok:true, styleId, publicUrl, width, height, costUSD }
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_KEY = Deno.env.get("RUNWARE_API_KEY")!;
const TASKS_URL = "https://api.runware.ai/v1";

// Nano Banana 2 (google:4@3), 1K 16:9 — the exact approved [1376,768] pair
// from _shared/imageDimensionPolicy.ts's own table for this model (its 2K
// counterpart, [2752,1536], is exactly double — same aspect family already
// used for this model's other 16:9 callers). Real measured cost for this
// engine/tier: $0.04945 (src/lib/providers.ts's "image:twoam1k" entry).
const DEFAULT_WIDTH = 1376;
const DEFAULT_HEIGHT = 768;
const MEASURED_COST_USD_1K = 0.04945;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractImageUrl(obj: any): string | null {
  const candidates: (string | undefined)[] = [
    obj?.data?.[0]?.imageURL, obj?.data?.[0]?.imageUrl, obj?.data?.[0]?.image_url, obj?.data?.[0]?.url,
    obj?.data?.imageURL, obj?.data?.imageUrl, obj?.data?.url,
  ];
  return candidates.find((v) => typeof v === "string" && v.startsWith("http")) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return err(req, "Method not allowed", 405);

  // Internal tool — still requires a real authenticated Zyvo user (no public
  // surface), even though it never touches that user's credits or projects.
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const styleId = String(body?.styleId ?? "").trim();
  const prompt = String(body?.prompt ?? "").trim();
  const width = Number(body?.width ?? DEFAULT_WIDTH);
  const height = Number(body?.height ?? DEFAULT_HEIGHT);
  // Final-polish round 4, Section 4 — optional model/negativePrompt override,
  // defaulting to the original Nano Banana 2 behavior byte-for-byte when
  // omitted. Added so the one-off IN_IMAGE headline-spelling test batch
  // (scripts/testIdeaThumbnailInImageBatch.mjs) could reuse this already-
  // deployed direct-Runware-call plumbing instead of duplicating it, rather
  // than because any current STYLE preview caller needs a different model.
  const model = typeof body?.model === "string" && body.model.trim() ? body.model.trim() : "google:4@3";
  const negativePrompt = typeof body?.negativePrompt === "string" && body.negativePrompt.trim() ? body.negativePrompt.trim() : undefined;
  if (!styleId || !prompt) return err(req, "Missing styleId/prompt", 400);
  if (!RUNWARE_KEY) return err(req, "RUNWARE_API_KEY not configured", 500);

  const taskUUID = crypto.randomUUID();
  const task = {
    taskType: "imageInference",
    taskUUID,
    model,
    positivePrompt: prompt,
    ...(negativePrompt ? { negativePrompt } : {}),
    width, height,
    numberResults: 1,
    includeCost: true,
    deliveryMethod: "async",
    outputType: "URL",
    outputFormat: "PNG",
  };

  const createRes = await fetch(TASKS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify([task]),
  });
  const createJson = await createRes.json().catch(() => null);
  if (!createRes.ok || createJson?.errors?.length) {
    return err(req, "Runware rejected the preview task.", 502, { reason: createJson?.errors?.[0]?.message ?? createRes.status });
  }

  let imageUrl = extractImageUrl(createJson);
  let realCostUSD = createJson?.data?.[0]?.cost ?? null;
  const providerId = createJson?.data?.[0]?.taskUUID ?? taskUUID;

  // Nano Banana 2 is typically synchronous, but poll briefly in case it isn't.
  const deadline = Date.now() + 60_000;
  while (!imageUrl && Date.now() < deadline) {
    await sleep(1500);
    const pollRes = await fetch(TASKS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNWARE_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ taskType: "getResponse", taskUUID: providerId }]),
    });
    const pollJson = await pollRes.json().catch(() => null);
    imageUrl = extractImageUrl(pollJson);
    realCostUSD = realCostUSD ?? pollJson?.data?.[0]?.cost ?? null;
  }
  if (!imageUrl) return err(req, "Timed out waiting for the preview image.", 504);

  const imageRes = await fetch(imageUrl);
  if (!imageRes.ok) return err(req, "Could not download the generated preview image.", 502);
  const imageBytes = new Uint8Array(await imageRes.arrayBuffer());

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const path = `long-form/style-previews/${styleId}.png`;
  const { error: uploadError } = await admin.storage.from("generated").upload(path, imageBytes, { contentType: "image/png", upsert: true });
  if (uploadError) return err(req, "Could not store the preview image.", 500, { reason: uploadError.message });
  const { data: publicUrlData } = admin.storage.from("generated").getPublicUrl(path);

  return ok(req, { ok: true, styleId, publicUrl: publicUrlData.publicUrl, width, height, costUSD: realCostUSD ?? MEASURED_COST_USD_1K });
});
