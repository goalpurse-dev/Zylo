// Controlled, service-only character experiment. Never starts a world/planner.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PNG } from "npm:pngjs@7.0.0";
import { Buffer } from "node:buffer";
import { compileTurnaroundMaster, turnaroundCells, turnaroundQA, cropRgba } from "../_shared/characterTurnaround.js";
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
    if (body.action === "start") {
      const { data: anchor, error: ae } = await db.from("long_form_reference_assets").select("*").eq("id", body.anchorId).single();
      if (ae) throw ae;
      const { data: world, error: we } = await db.from("long_form_visual_world_versions").select("*").eq("id", anchor.visual_world_version_id).single();
      if (we) throw we;
      const entity = world.reference_plan.entities.find((e: any) => e.entityId === anchor.entity_id);
      if (!entity) throw new Error("Entity missing");
      const prompt = compileTurnaroundMaster({ styleSpec: world.style_spec, canonicalSpec: entity.canonicalSpec, appearanceLock: body.appearanceLock, forbiddenElements: entity.forbiddenElements, includePose: body.includePose === true });
      const { data, error } = await db.rpc("enqueue_character_turnaround", { p_anchor_id: anchor.id, p_prompt: prompt, p_appearance_lock: body.appearanceLock, p_include_pose: body.includePose === true });
      if (error) throw error;
      return json({ masterAssetId: data, jobId: data });
    }
    if (body.action !== "reconcile") return json({ error: "Unknown action" }, 400);
    const { data: master, error: me } = await db.from("long_form_reference_assets").select("*").eq("id", body.masterAssetId).eq("generation_type", "turnaround_master").single();
    if (me) throw me;
    const { data: job, error: je } = await db.from("jobs").select("*").eq("id", master.job_id).single();
    if (je) throw je;
    if (job.status === "queued" && job.attempts === 0) {
      const dispatch = fetch(`${url}/functions/v1/job-worker`, { method: "POST", headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ jobId: job.id }) }).then(async response => { if (!response.ok) console.error("Turnaround job dispatch failed", response.status, await response.text()); });
      const runtime = (globalThis as any).EdgeRuntime;
      if (runtime?.waitUntil) runtime.waitUntil(dispatch); else await dispatch;
    }
    const result = referenceJobResult(job);
    if (!result) return json({ status: job.status, masterAssetId: master.id });
    const { error: re } = await db.from("long_form_reference_assets").update(result).eq("id", master.id);
    if (re) throw re;
    // Cost belongs only to provider assets, including rejected experiments/history.
    const { data: costs, error: ce } = await db.from("long_form_reference_assets").select("cost_usd").eq("visual_world_version_id", master.visual_world_version_id);
    if (ce) throw ce;
    const { data: world, error: we } = await db.from("long_form_visual_world_versions").select("meta").eq("id", master.visual_world_version_id).single();
    if (we) throw we;
    const imageCost = (costs ?? []).reduce((n: number, r: any) => n + Number(r.cost_usd ?? 0), 0);
    const { error: costError } = await db.from("long_form_visual_world_versions").update({ meta: { ...world.meta, referenceImageCostUsd: imageCost, estimatedTotalCostUsd: imageCost + Number(world.meta?.estimatedModelCostUsd ?? 0) } }).eq("id", master.visual_world_version_id);
    if (costError) throw costError;
    if (result.status !== "succeeded") return json({ status: "failed", masterAssetId: master.id });
    const cells = turnaroundCells(master.qa_expectations.includePose === true);
    const { data: existing, error: ee } = await db.from("long_form_reference_assets").select("id,source_crop_key,result_url").eq("source_master_asset_id", master.id);
    if (ee) throw ee;
    if (existing?.length === cells.length) return json({ status: "review_required", masterAssetId: master.id, crops: existing, ...result });
    // Only the pipeline's own persisted generated PNG can be fetched.
    const prefix = `${url}/storage/v1/object/public/generated/runware/images/`;
    if (!result.result_url?.startsWith(prefix)) throw new Error("Unexpected master storage URL");
    const response = await fetch(result.result_url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Master download failed");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 20000000) throw new Error("Master exceeds crop memory limit");
    const source = PNG.sync.read(Buffer.from(bytes));
    for (const cell of cells) {
      if (existing?.some((a: any) => a.source_crop_key === cell.key)) continue;
      const cropped = cropRgba(source, cell.rect);
      const png = PNG.sync.write({ ...cropped, data: Buffer.from(cropped.data) });
      const path = `long-form/turnarounds/${master.id}/${cell.key}.png`;
      const { error: uploadError } = await db.storage.from("generated").upload(path, png, { contentType: "image/png", upsert: true });
      if (uploadError) throw uploadError;
      const { data: publicUrl } = db.storage.from("generated").getPublicUrl(path);
      const { error: insertError } = await db.from("long_form_reference_assets").upsert({
        visual_world_version_id: master.visual_world_version_id, entity_id: master.entity_id, reference_type: "character_reference", angle_or_view: cell.key,
        status: "succeeded", result_url: publicUrl.publicUrl, generation_type: "deterministic_crop", source_master_asset_id: master.id,
        source_crop_key: cell.key, source_crop_rect: cell.rect, cost_usd: 0, render_model: "deterministic:rgba-crop-v1", input_reference_asset_ids: [master.id],
        qa_expectations: turnaroundQA(cell.key),
      }, { onConflict: "source_master_asset_id,source_crop_key", ignoreDuplicates: true });
      if (insertError) throw insertError;
    }
    return json({ status: "review_required", masterAssetId: master.id, costUsd: result.cost_usd, latencyMs: result.generation_latency_ms });
  } catch (error) {
    console.error("character-turnaround", error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 400);
  }
});
