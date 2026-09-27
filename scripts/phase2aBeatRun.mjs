// Phase 2a — the ONE paid Beat Director run: the Myth vs Reality fixture
// script, synthetic timings. Builds the Production Bible first if missing
// (gpt-5-mini), then the beat plan (Claude Sonnet 5), then freezes the run
// (inputs + recorded cassette + result) as an offline replay fixture.
import { admin, ANON_KEY, SUPABASE_URL, callFn } from "./phase1cLib.mjs";
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";

const PROJECT_ID = "f6ee3eb2-726b-4faa-9d25-1ed957eb46ae";
const SCRIPT_ID = "b3669868-54a6-4814-bd61-323efed108b0";
const t0 = Date.now();

const { data: project } = await admin.from("long_form_projects").select("*").eq("id", PROJECT_ID).single();
const { data: profile } = await admin.from("long_form_generation_profiles").select("id").eq("project_id", PROJECT_ID).eq("status", "active").single();

// Test-project prep: make the fixture script the project's current, locked script.
await admin.from("long_form_projects").update({ current_script_version_id: SCRIPT_ID }).eq("id", PROJECT_ID);
await admin.from("long_form_script_versions").update({ locked_at: new Date().toISOString(), locked_generation_profile_id: profile.id }).eq("id", SCRIPT_ID).is("locked_at", null);

// Owner session (test user) via a magic-link token — no password needed.
const { data: owner } = await admin.auth.admin.getUserById(project.user_id);
const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.user.email });
if (linkError) throw linkError;
const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
const { data: verified, error: otpError } = await anon.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
if (otpError) throw otpError;
const token = verified.session.access_token;

// --rebuild-bible: supersede the frozen bible (test project) so the fixed
// builder runs again (the first one had zero cast).
if (process.argv.includes("--rebuild-bible")) {
  const { data: old } = await admin.from("long_form_production_bibles").update({ status: "superseded", superseded_at: new Date().toISOString() }).eq("project_id", PROJECT_ID).eq("status", "frozen").select("id");
  console.log(`superseded ${old?.length ?? 0} old bible(s)`);
}
const tBible = Date.now();
const bibleRes = await callFn("build-stickman-production-bible", token, { projectId: PROJECT_ID });
const bibleMs = Date.now() - tBible;
console.log(`bible: ${bibleRes.alreadyBuilt ? "already built" : "built"} (v${bibleRes.bibleVersion}, ${bibleRes.stats.estimatedModelCostUsd}, ${(bibleMs / 1000).toFixed(1)}s) — continuityMode ${bibleRes.bible.continuityMode}, hero ${bibleRes.bible.hero?.exists}, recurring [${(bibleRes.bible.recurringCharacters ?? []).map((c) => c.id)}], archetypes [${(bibleRes.bible.roleArchetypes ?? []).map((a) => a.id)}]`);

// Check run: --max-windows N [--max-cost X] directs only the first N windows
// (test projects only) and freezes to its own fixture (--out name).
const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : null; };
const maxWindows = arg("--max-windows");
// --total-cap X: bible + director together; the director gets what the bible left.
const totalCap = arg("--total-cap");
const maxCost = totalCap ? (Number(totalCap) - Number(bibleRes.stats.estimatedModelCostUsd ?? 0)).toFixed(4) : arg("--max-cost");
if (maxCost) console.log(`director cap $${maxCost}`);
const outName = arg("--out") ?? "myth-vs-reality.recorded";
const tBeats = Date.now();
const start = await callFn("build-stickman-beat-plan", token, { projectId: PROJECT_ID, ...(maxWindows ? { maxWindows: Number(maxWindows) } : {}), ...(maxCost ? { maxCostUsd: Number(maxCost) } : {}) });
console.log(`beat plan v${start.version} started (${start.timingSource} timings) — polling`);
let plan;
for (;;) {
  const { data } = await admin.from("long_form_beat_plan_versions").select("*").eq("id", start.beatPlanVersionId).single();
  plan = data;
  if (plan.status !== "building") break;
  if (Date.now() - tBeats > 10 * 60_000) throw new Error("beat plan timed out");
  await new Promise((r) => setTimeout(r, 5000));
}
const beatsMs = Date.now() - tBeats;
const { data: beats } = await admin.from("long_form_beats").select("*").eq("beat_plan_version_id", plan.id).order("sequence");

const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;
console.log(`\nstatus: ${plan.status}${plan.error_code ? ` (${plan.error_code})` : ""}`);
if (plan.error_detail) console.log("error:", JSON.stringify(plan.error_detail).slice(0, 2000));
const s = plan.stats ?? {};
console.log(`beats: ${s.beatCount} | words/beat median ${s.wordsPerBeat?.median} max ${s.wordsPerBeat?.max} | duration median ${(s.durationMs?.median / 1000).toFixed(2)}s, min ${(s.durationMs?.min / 1000).toFixed(2)}s, max ${(s.durationMs?.max / 1000).toFixed(2)}s | total ${fmt(s.totalMs ?? 0)} | HOLD ${s.holdCount} | chunks ${s.chunks}, auto-splits ${s.autoSplits}, auto-merges ${s.autoMerges}`);
console.log(`cast used: ${JSON.stringify(s.castUsed)} | beats with cast ${s.castPct}% | viewer era swaps ${s.viewerSwaps ?? 0}`);
console.log(`treatments: ${JSON.stringify(s.treatmentMix)} | SHORT_TEXT ${s.shortTextPct}% | windows ${s.windows}, repairs ${s.repairs}, timing ${plan.timing_source}`);
console.log(`validation: hard ${plan.validation?.hard?.length ?? "-"} | warn ${JSON.stringify(plan.validation?.warn ?? [])}`);
console.log(`cost: bible $${Number(bibleRes.stats.estimatedModelCostUsd).toFixed(4)} (gpt-5-mini) + director $${Number(plan.estimated_model_cost_usd).toFixed(4)} (Sonnet 5, ${JSON.stringify(s.usage)})`);
console.log(`time: bible ${(bibleMs / 1000).toFixed(1)}s + beats ${(beatsMs / 1000).toFixed(1)}s = ${((Date.now() - t0) / 1000).toFixed(1)}s`);
const castByTreatment = {};
for (const b of beats ?? []) {
  const t = (castByTreatment[b.contract.treatment] ??= {});
  const ids = (b.contract.subjects ?? []).map((x) => x.castId);
  for (const id of ids.length ? ids : ["(none)"]) t[id] = (t[id] ?? 0) + 1;
}
console.log(`cast per beat type: ${JSON.stringify(castByTreatment)}`);
console.log(`rewrites via fill: ${s.rewrites ?? "-"} | soft warnings by type: ${JSON.stringify(s.softWarnings ?? {})} on ${s.beatsWithWarnings ?? 0} beats | output tokens/beat ${s.usage && s.beatCount ? (s.usage.outputTokens / s.beatCount).toFixed(0) : "-"}`);
const show = (b) => {
  const c = b.contract;
  const text = c.textIntent?.mode && c.textIntent.mode !== "NO_TEXT" ? ` [${c.textIntent.mode === "SHORT_TEXT" ? `"${c.textIntent.text}"` : "PROGRAMMATIC"}]` : "";
  const warn = (b.warnings ?? []).length ? ` ⚠${b.warnings.map((w) => w.code).join(",")}` : "";
  console.log(`Beat ${b.sequence} · ${fmt(b.start_ms)} (${((b.end_ms - b.start_ms) / 1000).toFixed(1)}s) · '${b.narration_text}' → ${c.visualConcept} [${(c.subjects ?? []).map((x) => x.castId).join(",")}]${text} · ${c.treatment}${warn}`);
};
const all = beats ?? [];
const mid = Math.floor(all.length / 2) - 2;
if (maxWindows) {
  console.log("\nALL BEATS:");
  all.forEach(show);
} else {
  console.log("\nFIRST 15 BEATS:");
  all.slice(0, 15).forEach(show);
  console.log("\nMIDDLE 5:");
  all.slice(mid, mid + 5).forEach(show);
  console.log("\nLAST 5:");
  all.slice(-5).forEach(show);
}

// Freeze for offline replay.
const { data: script } = await admin.from("long_form_script_versions").select("script_document").eq("id", SCRIPT_ID).single();
const { data: bibleRow } = await admin.from("long_form_production_bibles").select("bible").eq("id", plan.production_bible_id).single();
// One recording per invocation (the director yields/resumes between windows).
// The plan row turns terminal before the background upload finishes — wait for it.
let files = [];
for (let i = 0; i < 15 && !files.length; i++) {
  files = (await admin.storage.from("script-cassettes").list(`beatplan/${plan.id}`, { limit: 100, sortBy: { column: "name", order: "asc" } })).data ?? [];
  if (!files.length) await new Promise((r) => setTimeout(r, 2000));
}
const entries = [];
for (const f of files ?? []) {
  const { data: blob } = await admin.storage.from("script-cassettes").download(`beatplan/${plan.id}/${f.name}`);
  if (blob) entries.push(...JSON.parse(await blob.text()).entries);
}
const doc = script.script_document;
const fixture = {
  recordedAt: new Date().toISOString(), beatPlanVersionId: plan.id,
  segments: doc.narrationSegments.map((x) => ({ id: x.id, text: x.text })),
  bible: bibleRow.bible,
  callback: {
    key: doc.callbackKey ?? null,
    plantSegmentId: doc.plantSegmentIndex != null ? doc.narrationSegments[doc.plantSegmentIndex]?.id ?? null : null,
    payoffSegmentId: doc.payoffSegmentIndex != null ? doc.narrationSegments[doc.payoffSegmentIndex]?.id ?? null : null,
  },
  cassette: { entries: entries.map((e, seq) => ({ ...e, seq })) },
  result: { ok: plan.status === "ready" || plan.status === "ready_with_warnings" || plan.status === "check_only", status: plan.status, beatCount: beats?.length ?? 0, ranges: (beats ?? []).map((b) => [b.start_word, b.end_word]) },
  stats: plan.stats, validation: plan.validation, costUsd: Number(plan.estimated_model_cost_usd),
  beats: (beats ?? []).map((b) => ({ warnings: b.warnings, sequence: b.sequence, startWord: b.start_word, endWord: b.end_word, narrationText: b.narration_text, startMs: b.start_ms, endMs: b.end_ms, contract: b.contract })),
};
await mkdir(new URL("../tests/fixtures/stickman/beats/", import.meta.url), { recursive: true });
await writeFile(new URL(`../tests/fixtures/stickman/beats/${outName}.json`, import.meta.url), JSON.stringify(fixture, null, 2));
console.log(`\nfroze tests/fixtures/stickman/beats/${outName}.json (cassette entries: ${fixture.cassette?.entries?.length ?? 0})`);
