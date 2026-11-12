// deno-lint-ignore-file no-explicit-any
// runware-bakeoff-proxy/index.ts — internal, service-key only (Phase 4a).
//
// Forwards ONE Runware task (imageInference or upscale) for the image-model
// bake-off, so the RUNWARE_API_KEY never leaves the server. Allow-listed
// models only; the caller (scripts/phase4aBakeoff.ts) enforces the spend cap
// and writes the cost ledger from the returned `cost`. Never retries.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;

const ALLOWED_MODELS = new Set(["runware:400@6", "runware:400@3", "alibaba:qwen-image@2512", "google:nano-banana@2-lite", "google:4@3", "google:4@2", "recraft:v4@0", "runware:504@1"]);
const ALLOWED_TASKS = new Set(["imageInference", "upscale", "modelSearch"]);
// Phase 5c: any Runware upscaler (runware:50x@y) may be tested; modelSearch is free and has no model.
const UPSCALER = /^runware:(50\d|113)@\d+$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  if (!RUNWARE_API_KEY) return err(req, "RUNWARE_API_KEY not configured", 500);
  const body = await req.json().catch(() => ({}));
  const task = body?.task;
  const modelOk = task?.taskType === "modelSearch" || ALLOWED_MODELS.has(task?.model) || (task?.taskType === "upscale" && UPSCALER.test(String(task?.model)));
  if (!task || !ALLOWED_TASKS.has(task.taskType) || !modelOk) return err(req, "task/model not allowed", 400);
  if (task.numberResults && task.numberResults !== 1) return err(req, "numberResults must be 1", 400);

  const t0 = Date.now();
  try {
    const res = await fetch(RUNWARE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${RUNWARE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ ...task, taskUUID: task.taskUUID ?? crypto.randomUUID(), includeCost: true }]),
      signal: AbortSignal.timeout(170_000),
    });
    const json: any = await res.json().catch(() => null);
    const latencyMs = Date.now() - t0;
    const result = Array.isArray(json?.data) ? (task.taskType === "modelSearch" ? { results: json.data } : json.data[0]) : null;
    if (!res.ok || !result || json?.errors?.length) {
      return ok(req, { ok: false, latencyMs, status: res.status, error: json?.errors ?? json ?? null });
    }
    return ok(req, { ok: true, latencyMs, result });
  } catch (e) {
    return ok(req, { ok: false, latencyMs: Date.now() - t0, error: e instanceof Error ? e.message : String(e) });
  }
});
