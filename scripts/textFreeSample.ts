// $0: how many scenes per V2 video are drawn text-free from the start
// (needsTextFreeComposition) — a sample of real V2 projects.
//   deno run -A --env-file=.env.local scripts/textFreeSample.ts [limit]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { canonicalSetFromBible } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { needsTextFreeComposition, wordsOnObjects } from "../supabase/functions/_shared/stickman/sceneFallback.ts";

const limit = Number(Deno.args[0] ?? 12);
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const { data: rows } = await admin.from("long_form_scene_images").select("project_id, beat_plan_version_id, created_at").eq("tier", "V2").eq("is_current", true).order("created_at", { ascending: false }).limit(5000);
const plans = new Map<string, string>();
for (const r of rows ?? []) if (!plans.has(r.project_id)) plans.set(r.project_id, r.beat_plan_version_id);
const out: any[] = [];
for (const [projectId, planId] of [...plans].slice(0, limit)) {
  const { data: plan } = await admin.from("long_form_beat_plan_versions").select("production_bible_id").eq("id", planId).single();
  const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan!.production_bible_id).single();
  const { data: beats } = await admin.from("long_form_beats").select("sequence, contract").eq("beat_plan_version_id", planId);
  const set = canonicalSetFromBible(bible!.bible);
  const hit = (beats ?? []).filter((b: any) => needsTextFreeComposition("V2", b.contract, set as any));
  out.push({ projectId: projectId.slice(0, 8), scenes: beats?.length ?? 0, textFree: hit.length, pct: Math.round((100 * hit.length) / Math.max(1, beats?.length ?? 1)), overlayWords: hit.filter((b: any) => wordsOnObjects(b.contract, set as any)).length });
}
const tot = out.reduce((a, o) => ({ s: a.s + o.scenes, t: a.t + o.textFree }), { s: 0, t: 0 });
console.log(JSON.stringify({ projects: out.length, perProject: out, total: { scenes: tot.s, textFree: tot.t, pct: Math.round((100 * tot.t) / Math.max(1, tot.s)) } }, null, 1));
