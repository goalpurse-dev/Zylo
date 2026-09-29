// deno-lint-ignore-file no-explicit-any
// Promote reviewed proof renders to the CURRENT picture of their scenes
// (asked for f90160bc: 7, 35, 139, 106, 108, 4, 76). Free: no model calls.
// Each becomes a new version (the old one stays in history, so the Scenes
// page's Undo can bring it back); a scene's on-screen text is re-placed on
// the new picture (face-aware, same code as the worker). The Edit step picks
// the new pictures up on its next open (clips resolve to the current image).
//   npx -y deno@2.9.6 run -A --no-check scripts/promoteProofRenders.ts <projectId> <proofStateJson> 7,35,...
import { createClient } from "npm:@supabase/supabase-js@2";
import { placeTextLayer } from "../supabase/functions/_shared/stickman/textPlacement.ts";
import { loadOverlayFont } from "../supabase/functions/_shared/stickman/textOverlay.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [PROJECT, statePath, list] = Deno.args;
const seqs = list.split(",").map(Number);
const st = JSON.parse(await Deno.readTextFile(statePath));
const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", PROJECT).single();
const planId = p.autopilot.scenes.planId;
const font = await loadOverlayFont();
const out: any[] = [];
for (const n of seqs) {
  const proof = st.scenes[n];
  if (!proof?.url || proof.failed) { out.push({ n, skipped: "no proof render" }); continue; }
  const { data: cur } = await admin.from("long_form_scene_images").select("*").eq("project_id", PROJECT).eq("beat_plan_version_id", planId).eq("beat_sequence", n).eq("is_current", true).single();
  const { data: last } = await admin.from("long_form_scene_images").select("version").eq("project_id", PROJECT).eq("beat_plan_version_id", planId).eq("beat_sequence", n).order("version", { ascending: false }).limit(1).single();
  const version = last.version + 1;
  const bytes = new Uint8Array(await (await fetch(proof.url)).arrayBuffer());
  const path = `long-form/scenes/${PROJECT}/${String(n).padStart(3, "0")}-v${version}.jpg`;
  const { error: upErr } = await admin.storage.from("generated").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (upErr) throw new Error(`upload ${n}: ${upErr.message}`);
  const imageUrl = admin.storage.from("generated").getPublicUrl(path).data.publicUrl;
  // The scene's text, re-placed on the new picture (no paid look: faces from the free finder).
  let overlay = null, blocked = false;
  if (cur.overlay_text) { const r = await placeTextLayer({ bytes, imageUrl, text: cur.overlay_text, intent: { text: cur.overlay_text, style: cur.overlay?.style }, font }); overlay = r.layer; blocked = r.blocked; }
  await admin.from("long_form_scene_images").update({ is_current: false }).eq("id", cur.id);
  const { error } = await admin.from("long_form_scene_images").insert({
    project_id: PROJECT, beat_plan_version_id: planId, beat_sequence: n, version, tier: cur.tier, status: "ready", source: "proof", is_current: true,
    image_url: imageUrl, master_url: null, original_url: null, overlay, overlay_text: overlay ? cur.overlay_text : null, warnings: [], cost_usd: 0, credits_charged: 0,
    qa: { promotedFrom: proof.url, steps: proof.steps, note: "phase 6e-fix proof render, promoted on request" }, ready_at: new Date().toISOString(),
  });
  if (error) { await admin.from("long_form_scene_images").update({ is_current: true }).eq("id", cur.id); throw new Error(`insert ${n}: ${error.message}`); }
  out.push({ n, version, image: path.split("/").pop(), text: cur.overlay_text ?? null, textBlocked: blocked });
}
console.log(JSON.stringify(out, null, 1));
