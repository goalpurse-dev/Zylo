// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =================== ENV =================== */
const RW_KEY = Deno.env.get("RUNWARE_API_KEY") || "";
const USER_BASE = (Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "");
const BASE_V1 = `${USER_BASE}/v1`;
const TASKS_URL = `${BASE_V1}/air/tasks`;
const TASK_GET = (id: string) => `${BASE_V1}/air/tasks/${encodeURIComponent(id)}`;
const JOB_GET  = (id: string) => `${BASE_V1}/air/jobs/${encodeURIComponent(id)}`;

const SUPABASE_URL =
  Deno.env.get("SUPABASE_URL") ?? Deno.env.get("PROJECT_URL") ?? "";
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  Deno.env.get("SERVICE_ROLE_KEY") ??
  "";
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("ANON_KEY") ?? "";

/* =================== CORS/HTTP =================== */
function corsHeaders(req: Request): Headers {
  const origin =
    req.headers.get("Origin") ||
    req.headers.get("origin") ||
    "*";
  const reqHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    req.headers.get("access-control-request-headers") ||
    "authorization, x-client-info, apikey, content-type";

  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": reqHeaders,
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json",
  });
}
const ok = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
const err = (req: Request, msg: string, status = 500, extra?: unknown) =>
  ok(req, { ok: false, error: msg, ...(extra ? { extra } : {}) }, status);

/* =================== UTILS =================== */
async function postJson(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RW_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text || "{}"); }
  catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json, text };
}
async function getJson(url: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${RW_KEY}` },
  });
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text || "{}"); }
  catch { json = { raw: text }; }
  return { ok: r.ok, status: r.status, json, text };
}
function pick<T = any>(...vals: Array<T | undefined | null>) {
  for (const v of vals) if (v != null) return v as T;
  return undefined as any;
}
function extractUrl(obj: any): string | undefined {
  const direct =
    pick<string>(
      obj?.url,
      obj?.image?.url,
      obj?.output?.image?.url,
      obj?.images?.[0]?.url,
      obj?.output?.images?.[0]?.url,
      obj?.result?.url,
      obj?.result?.image?.url,
      obj?.result?.images?.[0]?.url,
      obj?.data?.[0]?.url,
      obj?.data?.[0]?.image?.url,
      obj?.data?.[0]?.images?.[0]?.url,
      obj?.artifacts?.[0]?.url,
    ) || undefined;
  if (direct) return direct;
  try {
    const deep = JSON.stringify(obj);
    const m = deep.match(/https?:\/\/[^\s"']+\.(?:png|jpe?g|webp|gif|mp4|webm)/i);
    return m ? m[0] : undefined;
  } catch {
    return undefined;
  }
}
function extractProgress(obj: any): number | null {
  const cands = [
    obj?.progress,
    obj?.percent,
    obj?.percentage,
    obj?.completion,
    obj?.completion_percentage,
    obj?.result?.progress,
    obj?.result?.percent,
    obj?.data?.[0]?.progress,
  ];
  for (const v of cands) {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  }
  return null;
}

/* =================== SIZE HELPERS =================== */

type AspectKey = "1:1" | "9:16" | "16:9";

function clamp64InRange(n: number, def = 1024): number {
  const raw = Number.isFinite(n) ? Number(n) : def;
  const snapped = Math.round(raw / 64) * 64;
  // Runware docs: 128–2048 inclusive, multiples of 64
  return Math.max(128, Math.min(2048, snapped));
}
function inferAspectFromDims(w: number, h: number): AspectKey {
  const r = w / h;
  if (Math.abs(r - 1) < 0.15) return "1:1";
  if (r < 1) return "9:16";
  return "16:9";
}
function aspectFromString(s?: string | null): AspectKey | null {
  if (!s) return null;
  const v = s.trim().toLowerCase();
  if (v === "1:1") return "1:1";
  if (v === "9:16" || v === "vertical") return "9:16";
  if (v === "16:9" || v === "horizontal" || v === "landscape") return "16:9";
  return null;
}

/* v3: ByteDance strict size combos */
const BYTE_DANCE_ALLOWED = [
  { w: 1024, h: 1024 },
  { w: 864,  h: 1152 },
  { w: 1152, h: 864 },
  { w: 1280, h: 720 },
  { w: 720,  h: 1280 },
  { w: 832,  h: 1248 },
  { w: 1248, h: 832 },
  { w: 1512, h: 648 },
];

function pickClosestByteDanceSize(aspect: AspectKey): { width: number; height: number } {
  const candidates = BYTE_DANCE_ALLOWED.filter((s) => inferAspectFromDims(s.w, s.h) === aspect);
  const list = candidates.length ? candidates : BYTE_DANCE_ALLOWED;
  const best = list.reduce(
    (b, s) => (!b || s.w * s.h > b.w * b.h ? s : b),
    list[0],
  );
  return { width: best.w, height: best.h };
}

/* =================== MODEL FAMILIES =================== */

function isByteDanceModel(airTag: string): boolean {
  return /bytedance/i.test(airTag);
}
function isFluxLikeModel(airTag: string): boolean {
  return (
    /flux/i.test(airTag) ||
    /schnell/i.test(airTag) ||
    /runware:10[0-9]@1/i.test(airTag)
  );
}
function isImagen4Model(airTag: string): boolean {
  // IMPORTANT: treat your v4 AIR tag here (adjust if needed)
  return (
    airTag === "runware:100@1" || // <-- your Imagen 4 / v4 tag
    /imagen4?/i.test(airTag) ||
    /google[-:_]?imagen/i.test(airTag)
  );
}

/**
 * Normalize requested dimensions into values Runware will accept,
 * based on model family.
 *
 * v2 (Flux-like): still flexible, but we clamp to safe presets.
 * v3 (ByteDance): snap to documented BYTE_DANCE_ALLOWED.
 * v4 (Imagen4):  ONLY use 1:1, 9:16, 16:9 presets we know are valid.
 */
function normalizeDims(
  airTag: string,
  requestedW?: number,
  requestedH?: number,
  aspectHint?: AspectKey | null,
): { width: number; height: number } {
  let w = clamp64InRange(requestedW ?? 1024);
  let h = clamp64InRange(requestedH ?? 1024);
  const inferred = inferAspectFromDims(w, h);
  const aspect: AspectKey = aspectHint || inferred;

  // v3
  if (isByteDanceModel(airTag)) {
    return pickClosestByteDanceSize(aspect);
  }

  // v4 — HARD LIMITS (no more random combos)
  if (isImagen4Model(airTag)) {
    if (aspect === "1:1") return { width: 1024, height: 1024 };
    if (aspect === "9:16") return { width: 896, height: 1280 };
    return { width: 1280, height: 896 }; // 16:9
  }

  // v2 (Flux-like) and others — keep it simple & legal
  if (isFluxLikeModel(airTag)) {
    if (aspect === "1:1") return { width: 1024, height: 1024 };
    if (aspect === "9:16") return { width: 896, height: 1280 };
    return { width: 1280, height: 896 };
  }

  // Fallback: same presets
  if (aspect === "1:1") return { width: 1024, height: 1024 };
  if (aspect === "9:16") return { width: 896, height: 1280 };
  return { width: 1280, height: 896 };
}

/* =================== SELF-SCHEDULER =================== */
async function scheduleSelf(body: Record<string, any>, delayMs = 1200) {
  setTimeout(() => {
    fetch(`${SUPABASE_URL}/functions/v1/runware-image`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, delayMs);
}

/* =================== MAIN =================== */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "POST") {
    return err(req, "Method not allowed", 405);
  }

  try {
    type Body = {
      airTag?: string;
      mode?: "t2i" | "upscale" | "product";
      prompt?: string;
      imageUrl?: string | null;
      settings?: Record<string, any>;
      jobId?: string;
      userId?: string;
      providerId?: string;
      startedAt?: number;
      lastProgress?: number;
      price?: number;
      aspect?: string;
    };

    const body = (await req.json().catch(() => ({}))) as Body;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    /* ---------- POLL MODE ---------- */
    if (body.providerId && body.jobId) {
      if (!RW_KEY) return err(req, "RUNWARE_API_KEY not set", 500);

      const startedAt = body.startedAt || Date.now();
      const lastP = Number.isFinite(body.lastProgress)
        ? (body.lastProgress as number)
        : 12;

      const t = await getJson(TASK_GET(body.providerId));
      const j = t.ok ? t : await getJson(JOB_GET(body.providerId));
      if (!j.ok) {
        await scheduleSelf({ ...body, startedAt, lastProgress: lastP }, 1200);
        return ok(req, { ok: true, stage: "repoll" });
      }

      const real = extractProgress(j.json);
      let target = lastP;
      if (real != null) {
        target = Math.max(target, Math.min(95, real));
      } else {
        const elapsed = Math.floor((Date.now() - startedAt) / 1000);
        target = Math.max(target, Math.min(90, 12 + elapsed * 2));
      }

      if (target > lastP) {
        const r = await sb.rpc("bump_job_progress", {
          p_id: body.jobId!,
          p_progress: target,
        });
        if (r.error) {
          await sb.from("jobs").update({ progress: target }).eq("id", body.jobId!);
        }
      }

      const stateRaw =
        j.json?.status ||
        j.json?.state ||
        j.json?.taskStatus ||
        j.json?.jobStatus ||
        (j.json?.done ? "succeeded" : "running") ||
        "";
      const state = String(stateRaw).toLowerCase();
      const errMsg =
        j.json?.errors?.[0]?.message ||
        j.json?.error?.message ||
        j.json?.message ||
        j.json?.result?.error;
      const urlCandidate =
        extractUrl(j.json) ||
        extractUrl(j.json?.result) ||
        extractUrl(j.json?.output);

      if (state.includes("fail") || state === "error" || errMsg) {
        const fin = await sb.rpc("finish_job_fail", {
          p_id: body.jobId!,
          p_error: errMsg || state,
        });
        if (fin.error) {
          await sb
            .from("jobs")
            .update({
              status: "failed",
              progress: 0,
              error: errMsg || state,
            })
            .eq("id", body.jobId!);
        }
        return ok(req, { ok: false, done: true, error: errMsg || state });
      }

      if (
        state.includes("success") ||
        state === "succeeded" ||
        state === "completed" ||
        j.json?.done === true ||
        urlCandidate
      ) {
        if (!urlCandidate) {
          const fin = await sb.rpc("finish_job_fail", {
            p_id: body.jobId!,
            p_error: "Completed but no media URL",
          });
          if (fin.error) {
            await sb
              .from("jobs")
              .update({
                status: "failed",
                progress: 0,
                error: "Completed but no media URL",
              })
              .eq("id", body.jobId!);
          }
        } else {
          const out = {
            provider: "runware",
            model: body.airTag || "runware",
            raw: j.json,
          } as any;
          const fin = await sb.rpc("finish_job_success", {
            p_id: body.jobId!,
            p_url: urlCandidate,
            p_output: out,
          });
          if (fin.error) {
            await sb
              .from("jobs")
              .update({
                status: "succeeded",
                progress: 100,
                result_url: urlCandidate,
                output: out,
              })
              .eq("id", body.jobId!);
          }
          return ok(req, { ok: true, done: true, url: urlCandidate });
        }
      }

      await scheduleSelf(
        { ...body, startedAt, lastProgress: target },
        1200,
      );
      return ok(req, { ok: true, stage: "polling", progress: target });
    }

    /* ---------- START MODE ---------- */
    const airTag = body.airTag || "";
    const mode   = body.mode || "t2i";
    const rawPrompt = (body.prompt || "").trim();

    if (!airTag) return err(req, "Missing airTag", 400);
    if (mode === "t2i" && !rawPrompt) return err(req, "Missing prompt", 400);
    if (!RW_KEY) return err(req, "RUNWARE_API_KEY not set", 500);

    const settings = body.settings || {};

    const aspectHint =
      aspectFromString(body.aspect) ||
      aspectFromString(settings.aspect);

    const requestedW = Number(settings.width);
    const requestedH = Number(settings.height);

    const { width, height } = normalizeDims(
      airTag,
      requestedW,
      requestedH,
      aspectHint,
    );

    const isFlux = isFluxLikeModel(airTag);
    const isBD   = isByteDanceModel(airTag);
    const isI4   = isImagen4Model(airTag);

    const allowSteps = isFlux; // steps/CFG ONLY for v2

    const steps =
      typeof settings.steps === "number" ? settings.steps : 6;
    const cfgScale =
      typeof settings.guidance === "number"
        ? settings.guidance
        : typeof settings.CFGScale === "number"
        ? settings.CFGScale
        : 3.5;

    const safeSettings: Record<string, any> = {};
    if (!isBD && !isI4) {
      for (const k of Object.keys(settings)) {
        if (["seed", "scheduler", "tiling", "safetyLevel"].includes(k)) {
          safeSettings[k] = settings[k];
        }
      }
    }

    // v3 watermark killer
    let prompt = rawPrompt;
    if (isBD && !/no watermark/i.test(prompt)) {
      prompt += ", no watermark, no logo, no text overlay";
    }

    const taskUUID = crypto.randomUUID();

    const baseTask: any = {
      taskType: "imageInference",
      taskUUID,
      model: airTag,
      positivePrompt: prompt,
      width,
      height,
      numberResults: 1,
      outputType: "URL",
      outputFormat: "PNG",
      ...(allowSteps ? { steps, CFGScale: cfgScale } : {}),
      ...safeSettings,
    };

    if (body.imageUrl) {
      baseTask.referenceImages = [body.imageUrl];
      baseTask.inputImages = [body.imageUrl];
    }

    if (body.jobId) {
      const bump = await sb.rpc("bump_job_progress", {
        p_id: body.jobId,
        p_progress: 12,
      });
      if (bump.error) {
        await sb
          .from("jobs")
          .update({ status: "running", progress: 12 })
          .eq("id", body.jobId);
      }
    }

    const created = await postJson(TASKS_URL, [baseTask]);
    if (!created.ok) {
      const rwMsg =
        created.json?.errors?.[0]?.message ||
        created.json?.error?.message ||
        created.json?.message ||
        `Runware image create failed: ${created.status}`;
      if (body.jobId) {
        const fin = await sb.rpc("finish_job_fail", {
          p_id: body.jobId,
          p_error: rwMsg,
        });
        if (fin.error) {
          await sb
            .from("jobs")
            .update({
              status: "failed",
              progress: 0,
              error: rwMsg,
            })
            .eq("id", body.jobId);
        }
      }
      return err(req, rwMsg, 502, created.json);
    }

    const payload = Array.isArray(created.json)
      ? created.json[0]
      : Array.isArray(created.json?.data)
      ? created.json.data[0]
      : created.json;

    const providerId =
      pick<string>(
        payload?.id,
        payload?.task_id,
        payload?.request_id,
        payload?.job_id,
        payload?.requestId,
      ) || taskUUID;

    const instantUrl =
      extractUrl(payload) || extractUrl(created.json);

    if (instantUrl && body.jobId) {
      const out = {
        provider: "runware",
        model: airTag,
        raw: created.json,
      } as any;
      const fin = await sb.rpc("finish_job_success", {
        p_id: body.jobId,
        p_url: instantUrl,
        p_output: out,
      });
      if (fin.error) {
        await sb
          .from("jobs")
          .update({
            status: "succeeded",
            progress: 100,
            result_url: instantUrl,
            output: out,
          })
          .eq("id", body.jobId);
      }
      return ok(req, { ok: true, done: true, url: instantUrl });
    }

    await scheduleSelf(
      {
        providerId,
        jobId: body.jobId,
        userId: body.userId,
        airTag,
        startedAt: Date.now(),
        lastProgress: 12,
      },
      600,
    );

    return ok(req, {
      ok: true,
      stage: "scheduled",
      providerId,
      width,
      height,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(req, "unhandled: " + msg, 500);
  }
});
