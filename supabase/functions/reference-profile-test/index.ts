// Service-only bounded experiment. No planner, world restart, retry or Back route.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compileGeometryEdit } from "../_shared/referenceRendererPolicy.js";
import { referenceJobResult } from "../_shared/visualWorldJobs.ts";
const url = Deno.env.get("SUPABASE_URL")!;
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const secret = Deno.env.get("LONG_FORM_RESEARCH_ADVANCE_SECRET") ?? "";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
Deno.serve(async req => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (req.headers.get("Authorization") !== `Bearer ${key}` && (!secret || req.headers.get("x-recovery-secret") !== secret)) return json({ error: "Unauthorized" }, 401);
  const db = createClient(url, key, { auth: { persistSession: false } });
  try {
    const body = await req.json();
    let id = body.assetId;
    if (body.action === "start") {
      const prompt = compileGeometryEdit({ reference_type: "character_reference", angle_or_view: "profile" });
      const { data, error } = await db.rpc("enqueue_reference_profile_test", { p_anchor_id: body.anchorId, p_prompt: prompt });
      if (error) throw error;
      id = data;
    } else if (body.action !== "reconcile") return json({ error: "Unknown action" }, 400);
    const { data: asset, error: ae } = await db.from("long_form_reference_assets").select("*").eq("id", id).eq("generation_type", "role_edit_experiment").single();
    if (ae) throw ae;
    const { data: job, error: je } = await db.from("jobs").select("*").eq("id", asset.job_id).single();
    if (je) throw je;
    if (job.status === "queued" && job.attempts === 0) {
      const dispatch = fetch(`${url}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }) }).then(async r => { if (!r.ok) console.error("Profile dispatch failed", r.status); });
      const runtime = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(dispatch); else await dispatch;
    }
    const result = referenceJobResult(job);
    if (result) {
      const { error } = await db.from("long_form_reference_assets").update(result).eq("id", asset.id);
      if (error) throw error;
      const { data: costs, error: ce } = await db.from("long_form_reference_assets").select("cost_usd").eq("visual_world_version_id", asset.visual_world_version_id);
      if (ce) throw ce;
      const { data: world, error: we } = await db.from("long_form_visual_world_versions").select("meta").eq("id", asset.visual_world_version_id).single();
      if (we) throw we;
      const cost = costs.reduce((n: number, a: any) => n + Number(a.cost_usd ?? 0), 0);
      const { error: re } = await db.from("long_form_visual_world_versions").update({ meta: { ...world.meta, referenceImageCostUsd: cost, estimatedTotalCostUsd: cost + Number(world.meta?.estimatedModelCostUsd ?? 0) } }).eq("id", asset.visual_world_version_id);
      if (re) throw re;
    }
    return json({ assetId: asset.id, jobId: job.id, status: job.status, ...result });
  } catch (error) { return json({ error: error instanceof Error ? error.message : String(error) }, 400); }
});
