// $0: how often a number/date/stat said over a timeline/chart/symbol had NO on-screen text,
// across the latest projects' scenes (the rule now adds it: mandatoryStatIntent).
//   deno run -A --env-file=.env.local scripts/statMissSample.ts [limit]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { mandatoryStatIntent, STAT_DEVICE_TREATMENTS } from "../supabase/functions/_shared/stickman/headlines.ts";
const limit = Number(Deno.args[0] ?? 15);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const { data: rows } = await admin.from("long_form_scene_images").select("project_id, beat_plan_version_id, created_at").eq("is_current", true).order("created_at", { ascending: false }).limit(8000);
const plans = new Map<string, string>();
for (const r of rows ?? []) if (!plans.has(r.project_id)) plans.set(r.project_id, r.beat_plan_version_id);
const out: any[] = [];
for (const [projectId, planId] of [...plans].slice(0, limit)) {
  const { data: beats } = await admin.from("long_form_beats").select("sequence, narration_text, contract").eq("beat_plan_version_id", planId);
  const { data: imgs } = await admin.from("long_form_scene_images").select("beat_sequence, overlay_text").eq("project_id", projectId).eq("is_current", true);
  const text = new Map((imgs ?? []).map((i: any) => [i.beat_sequence, i.overlay_text]));
  const device = (beats ?? []).filter((b: any) => STAT_DEVICE_TREATMENTS.has(b.contract?.treatment));
  const missed = (beats ?? []).filter((b: any) => mandatoryStatIntent(b.contract, b.narration_text) && !text.get(b.sequence));
  out.push({ project: projectId.slice(0, 8), scenes: beats?.length ?? 0, deviceScenes: device.length, missedNumbers: missed.length, examples: missed.slice(0, 3).map((b: any) => `${b.sequence}: ${mandatoryStatIntent(b.contract, b.narration_text).text}`) });
}
const t = out.reduce((a, o) => ({ s: a.s + o.scenes, d: a.d + o.deviceScenes, m: a.m + o.missedNumbers }), { s: 0, d: 0, m: 0 });
console.log(JSON.stringify({ projects: out.length, total: t, perProject: out }, null, 1));
