// deno-lint-ignore-file no-explicit-any
// fruit-worker — AI Fruit Story v2 job runner (service only; never called by
// the browser).
//
//   POST ?action=webhook&t=<hmac>   Runware task result (auth: HMAC of taskUUID)
//   POST {action:"kick", storyId?}  start queued jobs    (auth: x-fruit-worker-secret)
//   POST {action:"reconcile"}       cron, every minute   (auth: x-fruit-worker-secret)
//
// All logic lives in _shared/fruit/engine.js (tested offline); this file only
// wires Supabase, Runware and Storage.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createEngine } from "../_shared/fruit/engine.js";
import { createSupabaseMedia, createSupabaseStore } from "../_shared/fruit/supabaseStore.js";
import { getResponseTask, sameToken, webhookToken } from "../_shared/fruit/runware.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RUNWARE_API_KEY = Deno.env.get("RUNWARE_API_KEY") ?? "";
const RUNWARE_URL = `${(Deno.env.get("RUNWARE_BASE_URL") || "https://api.runware.ai").replace(/\/+$/, "")}/v1`;
const WORKER_SECRET = Deno.env.get("FRUIT_WORKER_SECRET") ?? "";
const PAID_CALLS = Deno.env.get("FRUIT_PAID_CALLS") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function runwarePost(tasks: unknown[]) {
  const res = await fetch(RUNWARE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${RUNWARE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(tasks),
    signal: AbortSignal.timeout(30_000),
  });
  return { httpStatus: res.status, body: await res.json().catch(() => null) };
}

const engine = createEngine({
  store: createSupabaseStore(admin),
  media: createSupabaseMedia(admin),
  runware: {
    submit: (envelope: unknown) => runwarePost([envelope]),
    poll: (taskUUID: string) => runwarePost([getResponseTask(taskUUID)]),
  },
  env: { FRUIT_PAID_CALLS: PAID_CALLS, webhookBase: `${SUPABASE_URL}/functions/v1/fruit-worker`, webhookSecret: WORKER_SECRET },
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function background(p: Promise<unknown>) {
  const rt = (globalThis as any).EdgeRuntime;
  const guarded = p.catch((e) => console.error("[fruit-worker] background failed:", e?.message ?? e));
  if (rt?.waitUntil) rt.waitUntil(guarded);
}

function taskUUIDOf(body: any): string | null {
  const first = Array.isArray(body?.data) ? body.data[0] : Array.isArray(body?.errors) ? body.errors[0] : body;
  return typeof first?.taskUUID === "string" ? first.taskUUID : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  if (!WORKER_SECRET) return json({ ok: false, error: "FRUIT_WORKER_SECRET not configured" }, 500);
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const action = url.searchParams.get("action") ?? body?.action;

  if (action === "webhook") {
    const taskUUID = taskUUIDOf(body);
    const token = url.searchParams.get("t") ?? "";
    if (!taskUUID || !sameToken(token, await webhookToken(WORKER_SECRET, taskUUID))) return json({ ok: false }, 401);
    // Runware wants a reply within ~5 s: record in the background.
    background(engine.onResult(taskUUID, body));
    return json({ ok: true });
  }

  if (!sameToken(req.headers.get("x-fruit-worker-secret") ?? "", WORKER_SECRET)) return json({ ok: false }, 401);
  try {
    if (action === "kick") return json({ ok: true, ...(await engine.kick({ storyId: typeof body?.storyId === "string" ? body.storyId : null })) });
    if (action === "reconcile") return json({ ok: true, ...(await engine.reconcile()) });
    return json({ ok: false, error: "unknown action" }, 400);
  } catch (e) {
    console.error(`[fruit-worker] ${action} failed:`, (e as Error)?.message ?? e);
    return json({ ok: false, error: "worker failed" }, 500);
  }
});
