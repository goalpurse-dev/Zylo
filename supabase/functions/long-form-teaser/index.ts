// deno-lint-ignore-file no-explicit-any
// long-form-teaser/index.ts — the free Long Form teaser (free accounts only).
// A title, a one-line hook and 3 V2 scenes, never more than $0.02 of provider
// cost (_shared/stickman/teaser.ts). It is a preview of what the video WOULD
// be: nothing is researched, voiced or rendered, and the result says so.
//   start  { topic, niche, nicheLabel?, setup }  -> { teaserId }; the work runs
//          server-side (it keeps going if the page is closed).
//          Refused for paid plans (they make the real video), an unverified
//          email, more than 3 teasers per account per day, and too many from
//          one IP address.
//   get    { teaserId }                          -> the teaser as it is now
//   event  { teaserId, event, projectId? }       -> funnel timestamps:
//          upgrade_clicked | paid | full_started
// POST, the user's own token.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err, cors } from "../shared/cors.ts";
import { requireUser } from "../shared/auth.ts";
import { logEvent } from "../_shared/systemLog.ts";
import { recordCost } from "../_shared/costLedger.ts";
import { checkRunwareGuard } from "../_shared/runwareBalance.ts";
import { runTeaser, teaserBudget, teaserGate, teaserSceneTask, writeTeaserPlan, TEASER_CAP_USD, TEASER_SCENES, TEASER_SCENE_MODEL, TEASER_STALE_MS, TEASER_DAILY_LIMIT } from "../_shared/stickman/teaser.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const DAY_MS = 86_400_000;

const runware = async (task: any) => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/runware-bakeoff-proxy`, { method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ task }) });
  const j: any = await r.json().catch(() => null);
  if (!j?.ok) throw new Error(`runware ${r.status}`);
  return j as { result: { imageURL: string; cost: number | null } };
};
// The caller's IP, hashed (the address itself is never stored).
async function ipHash(req: Request): Promise<string | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || "";
  if (!ip) return null;
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`zyvo-teaser:${ip}`)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const view = (t: any) => ({
  id: t.id, status: t.status, topic: t.topic, niche: t.niche, setup: t.setup ?? {}, title: t.title, hook: t.hook,
  scenes: (t.scenes ?? []).map((s: any) => ({ n: s.n, status: s.status, imageUrl: s.imageUrl ?? null })),
  sceneCount: TEASER_SCENES, error: t.status === "failed" ? "We couldn't make this preview. It didn't count towards today's limit." : null,
  upgradeClicked: !!t.upgrade_clicked_at, paid: !!t.paid_at, fullStarted: !!t.full_started_at, projectId: t.project_id, createdAt: t.created_at,
});
const patch = (id: string, values: Record<string, unknown>) => admin.from("long_form_teasers").update({ ...values, updated_at: new Date().toISOString() }).eq("id", id);

// The whole teaser, in the background. Every real cost is written to the ledger as it happens.
async function work(teaser: any) {
  const id = teaser.id, userId = teaser.user_id;
  let scenes: any[] = [];
  try {
    const result = await runTeaser({ topic: teaser.topic, nicheId: teaser.niche, nicheLabel: teaser.setup?.nicheLabel ?? null }, {
      writePlan: (input) => writeTeaserPlan(OPENAI_KEY, input),
      drawScene: async (description, index) => {
        const res = await runware(teaserSceneTask(description));
        // Kept in our own storage (the provider's link expires). No upscale, no AI check.
        const bytes = new Uint8Array(await (await fetch(res.result.imageURL)).arrayBuffer());
        const path = `long-form/teasers/${id}/${index + 1}.jpg`;
        const { error } = await admin.storage.from("generated").upload(path, bytes, { contentType: "image/jpeg", upsert: true });
        if (error) throw new Error(`upload: ${error.message}`);
        return { imageUrl: admin.storage.from("generated").getPublicUrl(path).data.publicUrl, usd: Number(res.result.cost ?? 0), costKnown: res.result.cost != null };
      },
      onPlan: async (plan, spent) => {
        scenes = plan.scenes.map((description, i) => ({ n: i + 1, description, status: "queued", imageUrl: null }));
        await patch(id, { status: "drawing", title: plan.title, hook: plan.hook || null, scenes, cost_usd: spent });
      },
      onScene: async (index, scene, spent) => {
        scenes = scenes.map((s, i) => (i === index ? { ...s, status: scene.status, imageUrl: scene.imageUrl ?? null } : s));
        await patch(id, { scenes, cost_usd: spent });
      },
      cost: (c) => recordCost(admin, {
        userId, stage: "other", provider: c.step === "plan" ? "openai" : "runware", model: c.model,
        units: { calls: c.calls ?? 1, ...(c.step === "scene" ? { images: 1 } : { inputTokens: c.inputTokens, outputTokens: c.outputTokens }), purpose: "teaser", step: c.step } as any,
        usd: c.usd, estimated: c.estimated, sourceTable: "long_form_teasers", sourceId: id,
      }),
    });
    await patch(id, { status: result.ok ? "done" : "failed", cost_usd: result.spentUsd, finished_at: new Date().toISOString(), error: result.ok ? null : (result as any).reason ?? "no scene could be drawn" });
    await logEvent("long-form-teaser", result.ok ? "info" : "warn", result.ok ? "teaser_finished" : "teaser_failed", { teaserId: id, userId, costUsd: result.spentUsd, capUsd: TEASER_CAP_USD, underCap: (result as any).underCap ?? true, scenes: (result as any).scenes?.map((s: any) => s.status) });
  } catch (e) {
    await patch(id, { status: "failed", finished_at: new Date().toISOString(), error: String((e as Error)?.message ?? e).slice(0, 200) });
    await logEvent("long-form-teaser", "error", "teaser_failed", { teaserId: id, userId, message: String((e as Error)?.message ?? e).slice(0, 200) });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const { user, authError } = await requireUser(req);
  if (!user) return err(req, authError || "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "start") {
    const topic = String(body?.topic ?? "").replace(/\s+/g, " ").trim();
    if (topic.length < 6 || topic.length > 400) return err(req, "Add a topic for your video first.", 422);
    const niche = String(body?.niche ?? "").trim().slice(0, 60) || null;
    const setup = body?.setup && typeof body.setup === "object" && JSON.stringify(body.setup).length < 4000 ? body.setup : {};
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const ip = await ipHash(req);
    const [{ data: profile }, { count: userToday }, ipCount, guard] = await Promise.all([
      admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle(),
      admin.from("long_form_teasers").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "failed").gte("created_at", since),
      ip ? admin.from("long_form_teasers").select("id", { count: "exact", head: true }).eq("ip_hash", ip).neq("status", "failed").gte("created_at", since) : Promise.resolve({ count: 0 }),
      checkRunwareGuard(admin),
    ]);
    const gate = teaserGate({ plan: profile?.plan_code ?? "free", emailVerified: !!(user as any).email_confirmed_at, userToday: userToday ?? 0, ipToday: (ipCount as any)?.count ?? 0, drawingPaused: guard.paused });
    if (!gate.ok) return err(req, gate.message, gate.status, { code: gate.code });
    // The cost is worked out before anything is called.
    const budget = teaserBudget({ topic, nicheId: niche, nicheLabel: setup?.nicheLabel ?? null });
    if (!budget.fits || !OPENAI_KEY) return err(req, "Previews are unavailable right now. Please try again later.", 503, { code: "UNAVAILABLE" });
    const { data: row, error } = await admin.from("long_form_teasers").insert({ user_id: user.id, status: "writing", niche, topic, setup, cap_usd: TEASER_CAP_USD, ip_hash: ip }).select("*").single();
    if (error || !row) return err(req, "Couldn't start your preview. Try again.", 500);
    // Several starts sent at the same moment all pass the count above: counted again with this row in.
    const { count: nowToday } = await admin.from("long_form_teasers").select("id", { count: "exact", head: true }).eq("user_id", user.id).neq("status", "failed").gte("created_at", since);
    if ((nowToday ?? 0) > TEASER_DAILY_LIMIT) {
      await patch(row.id, { status: "failed", error: "over the daily limit (concurrent start)", finished_at: new Date().toISOString() });
      return err(req, (teaserGate({ plan: "free", emailVerified: true, userToday: TEASER_DAILY_LIMIT, ipToday: 0, drawingPaused: false }) as any).message, 429, { code: "DAILY_LIMIT" });
    }
    await logEvent("long-form-teaser", "info", "teaser_started", { teaserId: row.id, userId: user.id, niche, estimateUsd: budget.estimate, capUsd: TEASER_CAP_USD });
    // @ts-ignore EdgeRuntime exists on Supabase
    EdgeRuntime.waitUntil(work(row));
    return ok(req, { ok: true, teaserId: row.id, teaser: view(row) });
  }

  const teaserId = String(body?.teaserId ?? "").trim();
  if (!teaserId) return err(req, "Bad request", 400);
  const { data: teaser } = await admin.from("long_form_teasers").select("*").eq("id", teaserId).maybeSingle();
  if (!teaser || teaser.user_id !== user.id) return err(req, "Preview not found", 404);

  if (action === "get") {
    // A teaser that stopped moving (the worker died) is closed; it doesn't count towards the daily limit.
    if ((teaser.status === "writing" || teaser.status === "drawing") && Date.now() - Date.parse(teaser.updated_at) > TEASER_STALE_MS) {
      await patch(teaser.id, { status: "failed", finished_at: new Date().toISOString(), error: "stalled" });
      teaser.status = "failed";
    }
    return ok(req, { ok: true, teaser: view(teaser) });
  }

  if (action === "event") {
    const event = String(body?.event ?? "");
    const column = ({ upgrade_clicked: "upgrade_clicked_at", paid: "paid_at", full_started: "full_started_at" } as Record<string, string>)[event];
    if (!column) return err(req, "Bad request", 400);
    if (event === "paid") {
      const { data: profile } = await admin.from("profiles").select("plan_code").eq("id", user.id).maybeSingle();
      if (String(profile?.plan_code ?? "free").toLowerCase() === "free") return ok(req, { ok: true, ignored: true });
    }
    const values: Record<string, unknown> = teaser[column] ? {} : { [column]: new Date().toISOString() };
    if (event === "full_started" && body?.projectId) {
      const { data: project } = await admin.from("long_form_projects").select("id, user_id").eq("id", String(body.projectId)).maybeSingle();
      if (project?.user_id === user.id) values.project_id = project.id;
    }
    if (Object.keys(values).length) await patch(teaser.id, values);
    await logEvent("long-form-teaser", "info", `teaser_${event}`, { teaserId: teaser.id, userId: user.id });
    return ok(req, { ok: true });
  }
  return err(req, "Bad request", 400);
});

export const _model = TEASER_SCENE_MODEL;
