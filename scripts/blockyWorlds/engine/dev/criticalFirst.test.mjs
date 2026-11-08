// Blocky Worlds STORY-CRITICAL FIRST (owner 2026-11-08: "The builder must build every story-critical object BEFORE
// planning, or the plan must be rejected"). The prepare job's order (runpod/worker.mjs prepare): director -> the
// critical items (lib/critical.js) resolved kit -> library -> builder.buildCritical -> planVideo({ built, library,
// criticalMode "reject" }) -> the other needs (buildFor). One still unbuilt: CRITICAL_UNBUILT (no retry, refunded),
// the page names the things (contract.js failReason). Free: the stored director list of run 7b4c0d8b, fake builders.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as plan from "../plan.mjs";
import * as kit from "../page/kit/objects.js";
import { directStory } from "../lib/director/index.js";
import { makeBuilder } from "../lib/builder/index.js";
import { memoryCache, snapshotCache } from "../lib/builder/cache.js";
import { mockProvider } from "../lib/builder/mock.js";
import { prepare, criticalUnbuilt, criticalStrict } from "../runpod/worker.mjs";
import { fakeBuilt, planCriticalFirst } from "./criticalFakes.mjs";
import { failReason } from "../../../../supabase/functions/_shared/blockyWorlds/contract.js";
import { NO_RETRY } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "run7b4c0d8b.json"), "utf8"));
const script = { title: R.title, lines: R.lines };
const words = R.words.map(([word, start, end]) => ({ word, start, end }));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const idea = { opener: R.lines[0].text, title: R.title, topic: R.topic };
const stored = { direct: async () => ({ data: R.production, costUsd: 0 }) };

test("the gate: run 7b4c's watch is story-critical and not in the kit -> the plan is rejected without it, planned with it", async () => {
  const direction = await directStory({ script, idea, exists, provider: stored });
  assert.equal(criticalStrict(direction), true, "a real director's list is strict");
  const early = plan.planVideo({ script, idea, direction, exists, criticalMode: "report" });
  const names = early.critical.unresolved.map((x) => x.name);
  assert.ok(names.includes("watch"), JSON.stringify(names));
  assert.throws(() => plan.planVideo({ script, words, idea, direction, exists, criticalMode: "reject" }), (e) => e.critical?.unresolved?.length === names.length);
  const { tl } = planCriticalFirst(plan, { script, words, idea, lengthSec: R.lengthSec, direction, exists });
  assert.deepEqual(tl.critical.unresolved, []);
  assert.ok(tl.critical.items.some((x) => x.name === "watch" && x.source === "built"));
  // the free mock director's guesses are never strict (report only: no build, no rejection)
  const mock = await directStory({ script, idea, exists, provider: "mock" });
  assert.equal(criticalStrict(mock), false);
  assert.equal(criticalStrict({ ...direction, fellBack: true }), false);
});

test("builder.buildCritical: library first, then a design; never the kit's lookalike; the purse is shared with buildFor (no second design)", async () => {
  const seed = [{ id: "lib-watch", kind: "object", name: "watch", aliases: ["pocket watch"], blueprint: { parts: [] } }];
  const designs = [];
  const prov = mockProvider();
  const provider = { ...prov, designObject: async (a) => { designs.push(a.need.name); return prov.designObject(a); } };
  const b = makeBuilder({ provider, cache: memoryCache(seed), render: async () => ({ file: null, jpeg: null }), budget: { maxUsd: 1 } });
  const r = await b.buildCritical([{ id: "watch", name: "watch", why: ["recurring"] }, { id: "lamp", name: "brass lantern", why: ["planted"] }]);
  assert.equal(r.built.watch?.id, "lib-watch", "the library's watch");
  assert.ok(r.built["brass lantern"] || r.unbuilt.some((u) => u.name === "brass lantern"));
  const before = designs.length;
  await b.buildFor({ shots: [], needs: [{ id: "n1", kind: "object", name: "brass lantern", phrase: "brass lantern", line: 0 }] }, { kit });
  assert.equal(designs.length, before, "the same thing is never designed twice in one video (shared memo)");
  // the builder off: everything unbuilt, with the reason
  const off = await makeBuilder({ provider: null }).buildCritical([{ id: "watch", name: "watch", why: ["recurring"] }]);
  assert.deepEqual(Object.keys(off.built), []);
  assert.match(off.unbuilt[0].reason, /off/);
});

test("snapshotCache.find: the sync library view of the gate (snapshot + built this video)", async () => {
  const c = snapshotCache([{ id: "a1", kind: "object", name: "pocket watch", aliases: ["watch"] }]);
  assert.equal(c.find("object", ["watch"])?.id, "a1");
  assert.equal(c.find("object", ["lantern"]), null);
  await c.save({ kind: "object", name: "lantern", aliases: [], blueprint: { parts: [] } });
  assert.equal(c.find("object", ["lantern"])?.name, "lantern");
});

test("CRITICAL_UNBUILT: no retry, a story failure, the page names the things", () => {
  const e = criticalUnbuilt({ unresolved: [{ id: "watch", name: "watch", why: ["recurring"] }, { id: "pw", name: "grandpa's wind-up pocket watch", why: ["planted"] }] },
    { wanted: [{ name: "watch" }, { name: "grandpa's wind-up pocket watch" }], unbuilt: [{ name: "watch", reason: "money cap ($0.6) reached" }] });
  assert.equal(e.code, "CRITICAL_UNBUILT");
  assert.match(e.message, /money cap/);
  assert.ok(NO_RETRY.has("CRITICAL_UNBUILT"));
  const r = failReason(e.code, e.message);
  assert.equal(r.kind, "story");
  assert.equal(r.text, "We couldn't build watch and grandpa's wind-up pocket watch for your story.");
  assert.equal(failReason("CRITICAL_UNBUILT", `couldn't build the story's critical item: "stone plaque" — x`).text, "We couldn't build stone plaque for your story.");
  assert.equal(failReason("CRITICAL_UNBUILT").text, "We couldn't build something your story needs.");
});

// ---------------------------------------------------------------- the prepare job's order (fake voice + builder)
async function prepareWith(builder) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bw-crit-")), dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw-crit-dir-"));
  const url = (p) => { const f = path.join(root, p); fs.mkdirSync(path.dirname(f), { recursive: true }); return pathToFileURL(f).href; };
  fs.writeFileSync(path.join(root, "direction.json"), JSON.stringify({ v: 1, model: "stored", production: R.production }));
  const job = { role: "prepare", runId: "r", jobId: "j", mode: "local", prepare: { script, idea, lengthSec: R.lengthSec, review: { provider: "off" },
    director: { provider: "anthropic", stored: pathToFileURL(path.join(root, "direction.json")).href }, builder: { provider: "off", library: [], budget: { maxUsd: 0 } },
    voice: { put: { mp3: url("v/voice.mp3"), take: url("v/take.json") } }, out: { timeline: url("timeline.json"), visualCheck: url("visual-check.json"), mix: url("mix.m4a") } } };
  const voiceFn = async ({ outDir }) => { fs.writeFileSync(path.join(outDir, "voice.mp3"), "mp3"); fs.writeFileSync(path.join(outDir, "take.json"), JSON.stringify({ costUsd: 0 })); return { wav: "x.wav", words }; };
  const order = [];
  const planModule = { ...plan, planVideo: (a) => { order.push(`plan:${a.criticalMode ?? "-"}`); return plan.planVideo(a); } };
  const events = [];
  const out = await prepare(job, dir, async (e, d) => events.push([e, d]), { planModule, voiceFn, kitModule: kit, builder: builder(order) }).then((x) => ({ ok: x }), (e) => ({ e }));
  fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(dir, { recursive: true, force: true });
  return { ...out, order, events };
}
const STOP = Object.assign(new Error("stop after buildFor"), { code: "TEST_STOP" });

test("prepare: the critical items are built BEFORE the real plan, which runs in reject mode; the rest after", async () => {
  let critAsked = null;
  const { e, order } = await prepareWith((order) => ({
    spent: 0, async close() {}, prefetch() { order.push("prefetch"); },
    async buildCritical(items) { order.push("buildCritical"); critAsked = items.map((x) => x.name); return { built: fakeBuilt(items), unbuilt: [], report: { built: items.length, cards: 0, costUsd: 0, byNeed: [] } }; },
    async buildFor() { order.push("buildFor"); throw STOP; },
  }));
  assert.equal(e?.code, "TEST_STOP", e?.message);
  assert.ok(critAsked.includes("watch"), JSON.stringify(critAsked));
  assert.deepEqual(order, ["plan:report", "buildCritical", "prefetch", "plan:reject", "buildFor"]);
});

test("prepare: a critical item the builder can't make fails the run with CRITICAL_UNBUILT before anything else is built", async () => {
  const { e, order, events } = await prepareWith((order) => ({
    spent: 0, async close() {}, prefetch() { order.push("prefetch"); },
    async buildCritical(items) { order.push("buildCritical"); return { built: {}, unbuilt: items.map((x) => ({ ...x, reason: "money cap ($0.6) reached" })), report: { built: 0, cards: items.length, costUsd: 0, byNeed: items.map((x) => ({ name: x.name, kind: "object", source: "card", reason: "money cap ($0.6) reached" })) } }; },
    async buildFor() { order.push("buildFor"); throw new Error("must not be reached"); },
  }));
  assert.equal(e?.code, "CRITICAL_UNBUILT", e?.message);
  assert.match(e.message, /"watch"/);
  assert.match(e.message, /money cap/);
  assert.deepEqual(order, ["plan:report", "buildCritical", "plan:reject"], "no prefetch, no buildFor: nothing more is bought");
  assert.ok(e.builder?.needs?.length > 0, "the builder's per-need reasons go back with the failure");
  assert.ok(!events.some(([ev]) => ev === "planned"));
  assert.match(failReason(e.code, e.message).text, /^We couldn't build .*watch.* for your story\.$/);
});
