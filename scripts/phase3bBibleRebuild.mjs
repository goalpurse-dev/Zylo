// Phase 3b — ONE paid bible rebuild (gpt-5-mini, ~$0.02) for the Myth vs
// Reality test project, to verify the new structured prompt-block schema end
// to end. Bible only (no beat plan). Saves the rebuilt bible to
// tests/fixtures/stickman/bibles/myth-vs-reality.rebuilt-v3.json. Never retries.
import { admin, ANON_KEY, SUPABASE_URL, callFn } from "./phase1cLib.mjs";
import { createClient } from "@supabase/supabase-js";
import { writeFile, access } from "node:fs/promises";

const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const OUT = new URL("../tests/fixtures/stickman/bibles/myth-vs-reality.rebuilt-v3.json", import.meta.url);
try { await access(OUT); console.log("rebuilt fixture exists — not rebuilding"); process.exit(1); } catch { /* go */ }

const { data: project } = await admin.from("long_form_projects").select("user_id").eq("id", PROJECT_ID).single();
const { data: owner } = await admin.auth.admin.getUserById(project.user_id);
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.user.email });
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: verified, error } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (error) throw error;

const { data: old } = await admin.from("long_form_production_bibles").update({ status: "superseded", superseded_at: new Date().toISOString() }).eq("project_id", PROJECT_ID).eq("status", "frozen").select("id");
console.log(`superseded ${old?.length ?? 0} frozen bible(s)`);
const t0 = Date.now();
let res;
try {
  res = await callFn("build-stickman-production-bible", verified.session.access_token, { projectId: PROJECT_ID });
} catch (e) {
  console.log("REBUILD FAILED — not retried:", String(e).slice(0, 1500));
  process.exit(1);
}
const b = res.bible;
console.log(`built in ${((Date.now() - t0) / 1000).toFixed(1)}s · cost $${res.stats.estimatedModelCostUsd} · llmCalls ${res.stats.llmCalls} (repairs ${res.stats.repairCalls}) · warnings ${JSON.stringify(res.warnings)}`);
await writeFile(OUT, JSON.stringify({ rebuiltAt: new Date().toISOString(), productionBibleId: res.productionBibleId, stats: res.stats, warnings: res.warnings, bible: b }, null, 2));
console.log(`archetypes: ${b.roleArchetypes.map((a) => `${a.id}${a.outfitVariants?.length ? ` (+${a.outfitVariants.map((v) => v.name).join(", ")})` : ""}`).join(", ")}`);
console.log(`recurring: ${b.recurringCharacters.map((c) => c.id).join(", ") || "none"} · settingBlocks: ${(b.world.settingBlocks ?? []).map((s) => `${s.name} [${s.variants.map((v) => v.name).join("/")}]`).join("; ")}`);
console.log(`objects: ${b.objectLanguage.map((o) => o.id).join(", ")}`);
