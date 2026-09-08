import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { compileReferencePrompt, deriveRequiredViews, ZYVO_STYLE_SPEC } from "../supabase/functions/_shared/visualWorldStyle.ts";
import { ensureReferenceJob, referenceJobPayload, referenceJobResult } from "../supabase/functions/_shared/visualWorldJobs.ts";
import { currentReferenceAssets, referenceEntities, referenceProgress } from "../src/pages/workspace/long-form/visualWorldPlanning.js";
import { fixtureEntities, fixturePlan, fixtureWorld, smokeSlots } from "./fixtures/visualWorldFixture.js";

test("fixture exercises every category and storyboard camera anchors", () => {
  assert.equal(fixtureEntities.length, 4);
  assert.equal(fixtureEntities.flatMap((e) => e.requiredViews).length, 7);
  for (const entity of fixturePlan.entity_registry) {
    assert.deepEqual(deriveRequiredViews(entity, fixturePlan.continuity_groups), fixtureEntities.find((e) => e.entityId === entity.id).requiredViews);
  }
  const selected = referenceEntities(fixturePlan, fixtureWorld);
  assert.equal(selected.flatMap((e) => e.requiredViews).length, 4);
  assert.deepEqual(selected.find((e) => e.entityId === "longhouse").requiredViews.map((v) => v.angle), ["wide_toward_hearth"]);
});

test("only usable successes count as ready; replacements do not double-count", () => {
  const assets = [{ id: "old", status: "succeeded", result_url: "old.png" }, { id: "new", replaces_asset_id: "old", status: "pending" }, { id: "failed", status: "failed" }, { id: "ready", status: "succeeded", result_url: "ready.png" }, { id: "missing", status: "succeeded", result_url: null }];
  assert.equal(currentReferenceAssets(assets).length, 4);
  assert.deepEqual(referenceProgress(assets), { total: 4, ready: 1, failed: 1, active: 1 });
});

test("four deterministic prompts: identity, full body/profile, reusable set, no labels", async () => {
  const prompts = smokeSlots.map((key) => {
    const [entityId, angle] = key.split(":");
    const entity = fixtureEntities.find((e) => e.entityId === entityId);
    const args = { styleSpec: ZYVO_STYLE_SPEC, visualStyleNotes: fixtureWorld.reference_plan.visualStyleNotes, ...entity, view: entity.requiredViews.find((v) => v.angle === angle) };
    const prompt = compileReferencePrompt(args);
    assert.equal(prompt, compileReferencePrompt(args));
    assert.ok(prompt.includes(entity.canonicalSpec));
    assert.match(prompt, /labels/);
    assert.match(prompt, /logos/);
    return { slot: key, prompt };
  });
  assert.match(prompts[0].prompt, /Full body head to toe/);
  assert.match(prompts[1].prompt, /Strict side profile/);
  assert.match(prompts[2].prompt, /reusable empty animation set/);
  assert.doesNotMatch(prompts[2].prompt, /Plain warm off-white background/);
  await writeFile(new URL("../artifacts/visual-world/compiled-prompts.json", import.meta.url), JSON.stringify(prompts, null, 2));
});

test("reference job stays free, uses FLUX Base, and keeps stable durable identity", () => {
  const job = referenceJobPayload({ id: "asset" }, fixtureWorld, { user_id: "owner" }, "prompt", "free");
  assert.equal(job.id, "asset");
  assert.equal(job.charge_credits, 0);
  assert.equal(job.settings.credits, 0);
  assert.equal(job.settings.long_form_reference_asset_id, "asset");
  assert.equal(job.settings.long_form_internal, true);
  assert.equal(job.tool_key, "image:flux.base");
  assert.equal(job.max_attempts, 3);
  assert.throws(() => referenceJobPayload({ id: "asset" }, { renderer_tool_key: "premium" }, {}, "prompt", "free"));
});

test("uncertain enqueue response retries same asset/job through one atomic RPC", async () => {
  const jobs = new Map();
  const links = new Map();
  let calls = 0;
  const admin = { rpc: async (name, args) => {
    assert.equal(name, "enqueue_long_form_reference_job");
    const id = args.p_asset_id;
    if (!links.has(id)) { jobs.set(id, args.p_job); links.set(id, id); }
    calls++;
    return calls === 1 ? { error: new Error("response lost after commit") } : { data: links.get(id) };
  } };
  const run = () => ensureReferenceJob(admin, { id: "a", claim_attempts: 1 }, fixtureWorld, { user_id: "u" }, "prompt", "free");
  await assert.rejects(run, /response lost/);
  assert.equal(await run(), "a");
  assert.equal(jobs.size, 1);
  assert.equal(links.size, 1);
});

test("reconciliation observes terminal jobs without creating or claiming paid work", () => {
  assert.equal(referenceJobResult({ status: "processing" }), null);
  assert.equal(referenceJobResult({ status: "canceled" }).status, "failed");
  assert.equal(referenceJobResult({ status: "succeeded" }).status, "failed");
  const result = referenceJobResult({ status: "succeeded", result_url: "a.png", output: { data: [{ cost: 0.0006 }] }, created_at: "2026-09-08T12:00:00Z", updated_at: "2026-09-08T12:00:06Z" });
  assert.equal(result.cost_usd, 0.0006);
  assert.equal(result.generation_latency_ms, 6000);
  assert.equal(referenceJobResult({ status: "failed" }).cost_usd, null);
});

test("saved smoke audit is exactly four successful zero-credit results, no claimed asset-link proof", async () => {
  const jobs = JSON.parse(await readFile(new URL("../artifacts/visual-world/smoke-results.json", import.meta.url)));
  assert.equal(jobs.length, 4);
  assert.equal(new Set(jobs.map((job) => job.id)).size, 4);
  assert.ok(jobs.every((job) => job.charge_credits === 0 && job.result_url && job.linked_assets === 0));
  assert.equal(jobs.reduce((sum, job) => sum + job.output.data[0].cost, 0), 0.0024);
});
