// deno-lint-ignore-file no-explicit-any
// Phase 6c-polish ($0, read-only): what the Scenes review shows for a project,
// computed with the same functions get-long-form-scenes uses — flags, text
// layers, plain summaries, text beats, model counts and spend.
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6cVerifyProject.ts <projectId>
import { createClient } from "npm:@supabase/supabase-js@2";
import { plainWarnings, plainNames, sceneSummary } from "../supabase/functions/_shared/stickman/scenes.ts";
import { duplicateScenes } from "../supabase/functions/_shared/stickman/imageChecks.ts";
import { textKindOf } from "../supabase/functions/_shared/stickman/headlines.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const projectId = Deno.args[0];
const { data: p } = await admin.from("long_form_projects").select("autopilot").eq("id", projectId).single();
const planId = p.autopilot?.scenes?.planId;
const { data: plan } = await admin.from("long_form_beat_plan_versions").select("production_bible_id").eq("id", planId).single();
const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
const { data: beats } = await admin.from("long_form_beats").select("sequence, contract, warnings").eq("beat_plan_version_id", planId).order("sequence");
const { data: imgs } = await admin.from("long_form_scene_images").select("beat_sequence, status, warnings, overlay, qa").eq("project_id", projectId).eq("beat_plan_version_id", planId).eq("is_current", true);
const { data: ledger } = await admin.from("long_form_cost_ledger").select("stage, provider, model, usd").eq("project_id", projectId);
const img = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i]));
const dups = duplicateScenes((imgs ?? []).filter((i: any) => i.status === "ready").map((i: any) => ({ n: i.beat_sequence, hash: i.qa?.dhash })));
let flagged = 0, oldFlags = 0, leaks = 0;
for (const b of beats ?? []) {
  const i: any = img.get(b.sequence);
  if (plainWarnings([...(b.warnings ?? []), ...(i?.warnings ?? []), ...(i?.status === "failed" ? ["image_failed"] : []), ...(dups.has(b.sequence) ? ["duplicate"] : [])]).length) flagged++;
  if ((b.warnings ?? []).length) oldFlags++;
  if (/viewer|_[a-z]/i.test(plainNames(sceneSummary(b.contract), bible.bible))) leaks++;
}
const text = (beats ?? []).filter((b: any) => b.contract?.textIntent?.text);
const byModel: Record<string, { n: number; usd: number }> = {};
for (const r of ledger ?? []) { const k = `${r.stage}:${r.model}`; byModel[k] = { n: (byModel[k]?.n ?? 0) + 1, usd: Number(((byModel[k]?.usd ?? 0) + Number(r.usd)).toFixed(4)) }; }
console.log(JSON.stringify({
  scenes: beats?.length, flaggedBefore: oldFlags, flaggedNow: flagged, duplicates: dups.size,
  textBeats: text.length, textShare: Number((text.length / (beats?.length || 1)).toFixed(3)), headline: text.filter((b: any) => textKindOf(b.contract) === "HEADLINE").length, inScene: text.filter((b: any) => textKindOf(b.contract) === "IN_SCENE").length,
  textLayers: (imgs ?? []).filter((i: any) => i.overlay).length, summaryLeaks: leaks, byModel,
}, null, 1));
