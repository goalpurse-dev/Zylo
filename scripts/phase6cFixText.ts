// deno-lint-ignore-file no-explicit-any
// Phase 6c-polish: give an already-drawn project its on-screen text WITHOUT
// re-rendering images. Runs the text pass on the saved plan (one small
// gpt-4o-mini call), stores the kinds/headlines on the beats, and places
// each HEADLINE as an editable layer over the existing image (layer placed
// locally with the real overlay code, scaled to 1920x1080).
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6cFixText.ts <projectId> [--dry]
import { createClient } from "npm:@supabase/supabase-js@2";
import { pickHeadlines, acceptHeadlines, applyTextPass, textKindOf, HEADLINE_MODEL } from "../supabase/functions/_shared/stickman/headlines.ts";
import { overlayText, scaleLayer } from "../supabase/functions/_shared/stickman/textOverlay.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const projectId = Deno.args[0];
const dry = Deno.args.includes("--dry");

const { data: p } = await admin.from("long_form_projects").select("autopilot, on_screen_text_density").eq("id", projectId).single();
const planId = p.autopilot?.scenes?.planId;
const { data: rows } = await admin.from("long_form_beats").select("id, sequence, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const beats = (rows ?? []).map((r: any) => ({ id: r.id, sequence: r.sequence, narrationText: r.narration_text, contract: r.contract }));
const before = beats.filter((b: any) => b.contract?.textIntent?.text).map((b: any) => ({ n: b.sequence, mode: b.contract.textIntent.mode, text: b.contract.textIntent.text, kind: textKindOf(b.contract) }));
const picked = await pickHeadlines(env.OPENAI_API_KEY ?? env.VITE_OPENAI_API_KEY, beats, p.on_screen_text_density);
const acc = acceptHeadlines(beats, picked.picks, p.on_screen_text_density);
const next = applyTextPass(beats, acc.accepted);
console.log(JSON.stringify({ beats: beats.length, density: p.on_screen_text_density, directorText: before, target: acc.target, added: acc.accepted, rejected: acc.rejected, costUsd: picked.costUsd }, null, 1));
if (dry) Deno.exit(0);

await admin.from("long_form_cost_ledger").insert({ project_id: projectId, stage: "beats_text", provider: "openai", model: HEADLINE_MODEL, units: { calls: 1, ...picked.usage, purpose: "6c-polish text fix" }, usd: picked.costUsd, estimated: false, source_table: "long_form_beat_plan_versions" });
const font = await Deno.readFile("supabase/functions/_shared/fonts/LilitaOne-Regular.ttf");
let layers = 0;
for (const b of next) {
  const t = b.contract?.textIntent;
  if (!t?.text) continue;
  await admin.from("long_form_beats").update({ contract: b.contract }).eq("id", b.id);
  if (textKindOf(b.contract) !== "HEADLINE") continue;
  const { data: scene } = await admin.from("long_form_scene_images").select("id, image_url").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("beat_sequence", b.sequence).eq("is_current", true).maybeSingle();
  if (!scene?.image_url) continue;
  const bytes = new Uint8Array(await (await fetch(scene.image_url)).arrayBuffer());
  const width = (await Image.decode(bytes)).width;
  const o = await overlayText(bytes, t.text, { font });
  await admin.from("long_form_scene_images").update({ overlay: scaleLayer(o.layer, 1920 / width), overlay_text: String(t.text).toUpperCase() }).eq("id", scene.id);
  layers++;
}
console.log(`layers stored: ${layers}`);
