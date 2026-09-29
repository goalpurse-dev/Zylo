// Phase 6c: per-stage times + spend + reservation for the e2e project ($0, read only).
//   node --env-file=.env.local scripts/phase6cE2EStats.mjs <projectId>
import { createClient } from "@supabase/supabase-js";
const id = process.argv[2];
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const one = async (q) => (await q).data;
const p = await one(admin.from("long_form_projects").select("created_at, autopilot, current_story_plan_version_id, current_script_version_id").eq("id", id).single());
const plan = await one(admin.from("long_form_story_plan_versions").select("created_at").eq("id", p.current_story_plan_version_id).single());
const r = await one(admin.from("long_form_research_versions").select("research_started_at, research_completed_at, meta").eq("project_id", id).order("version", { ascending: false }).limit(1).single());
const s = await one(admin.from("long_form_script_versions").select("created_at, stage_started_at, locked_at, meta, script_document").eq("id", p.current_script_version_id).single());
const n = await one(admin.from("long_form_narration_audio_versions").select("created_at, ready_at, audio_duration_seconds, provider_metadata").eq("project_id", id).order("version", { ascending: false }).limit(1).single());
const bibles = await one(admin.from("long_form_production_bibles").select("created_at, estimated_model_cost_usd").eq("project_id", id));
const plans = await one(admin.from("long_form_beat_plan_versions").select("created_at, completed_at, estimated_model_cost_usd, error_code").eq("project_id", id).order("created_at"));
const ledger = await one(admin.from("long_form_cost_ledger").select("stage, provider, usd").eq("project_id", id));
const res = await one(admin.from("long_form_project_reservations").select("status, reserved_credits, committed_credits, released_credits").eq("project_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle());
const sec = (a, b) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 1000) : null);
const sum = (rows, f) => Number(rows.filter(f).reduce((a, x) => a + Number(x.usd), 0).toFixed(4));
console.log(JSON.stringify({
  timesS: {
    storyPlan: sec(p.autopilot.startedAt, plan.created_at), research: sec(r.research_started_at, r.research_completed_at),
    script: sec(s.created_at, s.stage_started_at), lockToNarrationReady: sec(s.locked_at, n.ready_at), narrationTts: sec(n.created_at, n.ready_at),
    beatPlans: plans.map((x) => sec(x.created_at, x.completed_at)),
  },
  words: s.script_document?.actualWords, audioS: Number(n.audio_duration_seconds), elevenLabs: { credits: n.provider_metadata?.providerCharacterCost, characters: n.provider_metadata?.characterCount },
  usd: {
    research: Number(r.meta?.estimatedTotalCostUsd ?? 0), script: Number(s.meta?.estimatedTotalCostUsd ?? 0),
    bible: sum(ledger, (x) => x.stage === "bible"), beatPlans: sum(ledger, (x) => x.stage === "beats"), images: sum(ledger, (x) => x.provider === "runware"),
    bibleBuilds: bibles.length, beatPlanErrors: plans.map((x) => x.error_code),
  },
  reservation: res, scenes: p.autopilot.scenes,
}, null, 1));
