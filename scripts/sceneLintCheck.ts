// $0 check: compiles a project's scene prompts locally with the REAL compiler
// (same bible, beats and tier options the scene worker uses) and lists every
// beat whose prompt check fails. No image is drawn.
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... deno run -A scripts/sceneLintCheck.ts <projectId> [beat,beat,...]
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { compileBeatPrompt, canonicalSetFromBible, plantFrameFor } from "../supabase/functions/_shared/stickman/promptCompiler.ts";
import { compileOptionsFor } from "../supabase/functions/_shared/stickman/renderTiers.ts";

const [projectId, only] = Deno.args;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const { data: scenes } = await admin.from("long_form_scene_images").select("beat_sequence, beat_plan_version_id, tier, status, description_override").eq("project_id", projectId).eq("is_current", true).order("beat_sequence");
const planId = scenes![0].beat_plan_version_id;
const { data: plan } = await admin.from("long_form_beat_plan_versions").select("production_bible_id").eq("id", planId).single();
const { data: bible } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan!.production_bible_id).single();
const { data: beats } = await admin.from("long_form_beats").select("sequence, start_word, end_word, start_ms, end_ms, narration_text, contract").eq("beat_plan_version_id", planId).order("sequence");
const all = beats!.map((b: any) => ({ sequence: b.sequence, startWord: b.start_word, endWord: b.end_word, startMs: b.start_ms, endMs: b.end_ms, narrationText: b.narration_text, contract: b.contract }));
const set = canonicalSetFromBible(bible!.bible);
const plantFrame = plantFrameFor(all, set);
const want = only ? new Set(only.split(",").map(Number)) : null;
const out: any[] = [];
for (const s of scenes!) {
  if (want && !want.has(s.beat_sequence)) continue;
  const beat = all.find((b: any) => b.sequence === s.beat_sequence)!;
  if (s.description_override) beat.contract = { ...beat.contract, visualConcept: s.description_override, userSummary: s.description_override };
  const p = compileBeatPrompt({ ...beat, contract: beat.contract }, set, { plantFrame, ...compileOptionsFor(s.tier, beat.contract) });
  out.push({ beat: s.beat_sequence, tier: s.tier, status: s.status, lint: p.lintErrors, prompt: p.prompt });
}
const failing = out.filter((o) => o.lint.length);
console.log(JSON.stringify({ projectId, compiled: out.length, failing: failing.map((f) => ({ beat: f.beat, lint: f.lint })) }, null, 1));
if (Deno.env.get("SHOW_PROMPTS")) for (const o of out) console.log(`\n--- beat ${o.beat} (${o.tier}) ---\n${o.prompt}`);
