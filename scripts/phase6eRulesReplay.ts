// deno-lint-ignore-file no-explicit-any
// Phase 6e-fix ($0, read-only): run the new plan rules on a project's saved
// beat plan and report which beats would be re-directed, and the plan's
// people / empty / split shares. Also saves the plan as a replay fixture.
//   npx -y deno@2.9.6 run -A --no-check scripts/phase6eRulesReplay.ts <projectId> [fixtureOut]
import { createClient } from "npm:@supabase/supabase-js@2";
import { planRuleHits, ruleCounts } from "../supabase/functions/_shared/stickman/planRules.ts";

const env: Record<string, string> = {};
for (const line of (await Deno.readTextFile(".env.local")).split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const [projectId, fixtureOut] = Deno.args;
const { data: p } = await admin.from("long_form_projects").select("autopilot, current_script_version_id").eq("id", projectId).single();
const planId = p.autopilot.scenes.planId;
const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", p.current_script_version_id).single();
const { data: beats } = await admin.from("long_form_beats").select("sequence, start_word, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
// Section = the script chapter the beat starts in.
const segs = script.script_document.narrationSegments;
const bounds: { end: number; chapter: string }[] = [];
let w = 0;
for (const s of segs) { w += String(s.text).trim().split(/\s+/).filter(Boolean).length; bounds.push({ end: w, chapter: s.chapterId }); }
const sectionOf = (word: number) => bounds.find((b) => word < b.end)?.chapter ?? bounds[bounds.length - 1].chapter;
const plan = (beats ?? []).map((b: any) => ({ sequence: b.sequence, narrationText: b.narration_text, contract: b.contract, section: sectionOf(b.start_word) }));
const hits = planRuleHits(plan);
const n = plan.length;
const people = plan.filter((b) => (b.contract.subjects ?? []).length).length;
const splits = plan.filter((b) => ["SPLIT", "COMPARISON"].includes(b.contract.treatment)).length;
console.log(JSON.stringify({ beats: n, wouldChange: hits.length, share: Number((hits.length / n).toFixed(3)), byRule: ruleCounts(hits), peopleShare: Number((people / n).toFixed(3)), splitBeats: splits, sample: hits.slice(0, 12).map((h) => `${h.sequence}:${h.code}`) }, null, 1));
if (fixtureOut) await Deno.writeTextFile(fixtureOut, JSON.stringify({ note: "f90160bc 148-beat plan (contracts only) for the 6e-fix plan-rules replay", plan }));
