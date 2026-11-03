import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contentWords, duplicateOf, openerKey, similarity, scoreVerdict, RUBRIC, ACCEPT, rankOf, mixWeights, planSlots, pickForUser, batchCost, judgeSchema } from "../supabase/functions/_shared/blockyWorlds/library.js";
import { cardProblems, beatProblems, propProblems, callbackProblem, shotProblems, SHOTS, USES, beatsSchema, shotsSchema } from "../supabase/functions/_shared/blockyWorlds/protocol.js";
import { EXAMPLE_IDEAS, EXAMPLE_SCRIPT } from "../supabase/functions/_shared/blockyWorlds/examples.js";
import { normalizeScript, PART_IDS } from "../supabase/functions/_shared/blockyWorlds/script.js";
import { normalizeIdea } from "../supabase/functions/_shared/blockyWorlds/ideas.js";
import { cardFromScript, judgeIdeas, scriptProtocolCheck, writeBeats, writeLibraryIdeas, writeShots, PRICE } from "../supabase/functions/_shared/blockyWorlds/llm.js";
import { memoryStore, rerank, tick } from "../supabase/functions/_shared/blockyWorlds/libraryJob.js";
import { FORMULA_IDS, MOOD_IDS, MOOD_TWISTS } from "../supabase/functions/_shared/blockyWorlds/formulas.js";

const noNetwork = async (fn) => { const real = globalThis.fetch; globalThis.fetch = () => { throw new Error("no network"); }; try { return await fn(); } finally { globalThis.fetch = real; } };
const listener = normalizeIdea(EXAMPLE_IDEAS[0]);

// ---------- dedup ----------
test("dedup: the same rule in other words is a duplicate; a different rule is not", () => {
  assert.equal(openerKey("In this town, the floor is lava every Tuesday."), openerKey("In this town, every Tuesday the floor is lava!"));
  assert.ok(contentWords("Sneezes and sneezing").includes("sneez"));
  const lava = normalizeIdea(EXAMPLE_IDEAS[1]);
  const lava2 = { ...lava, opener: "In this town, every Tuesday the floor turns into lava.", price: "Step on the floor on a Tuesday and you're toast." };
  assert.ok(similarity(lava, lava2) >= 0.42, `similarity ${similarity(lava, lava2)}`);
  assert.equal(duplicateOf(lava2, [{ ...lava, key: openerKey(lava.opener) }])?.title, lava.title);
  assert.equal(duplicateOf(listener, [{ ...lava, key: openerKey(lava.opener) }]), null);
});

// ---------- the judge ----------
test("judge: the score is the weighted rubric; weak core criteria, low scores or unsafe ideas never pass", () => {
  assert.equal(RUBRIC.reduce((a, c) => a + c.weight, 0), 100);
  const all = (n) => Object.fromEntries(RUBRIC.map((c) => [c.id, n]));
  assert.deepEqual([scoreVerdict({ scores: all(5), safe: true }).score, scoreVerdict({ scores: all(1), safe: true }).score], [100, 0]);
  assert.equal(scoreVerdict({ scores: all(4), safe: true }).accepted, true);
  assert.equal(scoreVerdict({ scores: { ...all(5), twist: 2 }, safe: true }).accepted, false, "weak twist");
  assert.equal(scoreVerdict({ scores: all(5), safe: false }).accepted, false, "unsafe");
  assert.equal(scoreVerdict({ scores: all(3), safe: true }).accepted, false, `3s score ${scoreVerdict({ scores: all(3), safe: true }).score} < ${ACCEPT.minScore}`);
  assert.equal(scoreVerdict({ scores: { ...all(9), hook: -2 }, safe: true }).scores.hook, 1, "clamped");
  assert.ok(!JSON.stringify(judgeSchema()).includes("maxItems"));
});

// ---------- learning ----------
test("rank: the judge score is the prior; picks, generations, downloads and likes move it; real likes count most", () => {
  const base = { score: 80, shown: 0 };
  const fresh = rankOf(base), shownNoPick = rankOf({ ...base, shown: 200, picked: 2 }), loved = rankOf({ ...base, shown: 200, picked: 80, generated: 50, downloaded: 40, thumbs_up: 30 });
  const viral = rankOf({ ...base, shown: 200, picked: 2, likes_total: 300000 });
  assert.ok(loved > fresh && fresh > shownNoPick, `${loved} > ${fresh} > ${shownNoPick}`);
  assert.ok(viral > shownNoPick + 0.12, "300k real likes lift an idea a lot");
  assert.ok(rankOf({ score: 95 }) > rankOf({ score: 70 }));
});

test("mix: formulas/twists/moods that get generated more are made more; nothing drops below half", () => {
  const rows = [];
  for (const f of FORMULA_IDS) for (let i = 0; i < 4; i++) rows.push({ formula: f, twist: "T1", mood: "horror", shown: 100, generated: f === "F2" ? 30 : 3 });
  const w = mixWeights(rows);
  assert.ok(w.formula.F2 > 1.5 && w.formula.F1 >= 0.5 && w.formula.F1 < 1);
  for (const v of Object.values(w.mood)) assert.ok(v >= 0.5 && v <= 2);
  const slots = Array.from({ length: 100 }, (_, k) => planSlots(w, 6, k + 3)).flat(), f2 = slots.filter((s) => s.formula === "F2").length;
  assert.ok(f2 > slots.length / 6, `F2 is made more (${f2} of ${slots.length})`);
  for (const s of slots) assert.ok(MOOD_TWISTS[s.mood].includes(s.twist) && s.setting);
});

test("serving: only the candidates given (the unseen ones), mixed across formulas and moods, best first", () => {
  const cands = [];
  for (const f of FORMULA_IDS) for (const m of MOOD_IDS) cands.push({ id: `${f}${m}`, formula: f, mood: m, rank: (f === "F1" ? 0.9 : 0.5) + (m === "funny" ? 0.05 : 0) });
  const six = pickForUser(cands, 6);
  assert.equal(six.length, 6);
  assert.equal(new Set(six.map((c) => c.formula)).size, 6, "six formulas");
  assert.equal(six[0].id, "F1funny", "best first");
  assert.ok(pickForUser(cands, 6, "horror").every((c) => c.mood === "horror"));
  assert.equal(pickForUser([], 6).length, 0);
});

// ---------- the protocol checks ----------
test("protocol: the example card is complete; a card missing pieces is caught", () => {
  assert.deepEqual(cardProblems(listener), []);
  assert.match(cardProblems({ ...listener, prop: "", examples: ["a"] }).join(), /missing examples.*missing prop|missing prop|missing examples/);
  assert.match(cardProblems({ ...listener, opener: "Once upon a time" }).join(), /opener/);
  assert.match(cardProblems({ ...listener, twist: "Like in Free Guy." }).join(), /famous story/);
});

test("protocol: the example script plants its prop, pays it off and calls back line 1", () => {
  const script = normalizeScript(EXAMPLE_SCRIPT);
  assert.deepEqual(propProblems(listener, script), []);
  assert.equal(callbackProblem(listener, script), null);
  const noPayoff = { ...script, lines: script.lines.map((l) => (l.part === "climax" ? { ...l, text: "Then it was over." } : l)) };
  assert.match(propProblems(listener, noPayoff).join(), /never pays off/);
  const noCallback = { ...script, lines: [...script.lines.slice(0, -2), { part: "closer", text: "The end." }, { part: "closer", text: "Goodbye." }] };
  assert.match(callbackProblem({ ...listener, closer: "x" }, noCallback), /call back/);
  assert.deepEqual(scriptProtocolCheck(script, 90, listener).problems, []);
});

test("protocol: beat sheets and shot plans are checked against the 7 parts and the fixed vocabulary", async () => {
  await noNetwork(async () => {
    const b = await writeBeats({ provider: "mock", card: listener, lengthSec: 90 });
    assert.deepEqual(b.problems, []);
    assert.deepEqual(b.beats.map((x) => x.part), PART_IDS);
    assert.match(beatProblems(b.beats.filter((x) => x.part !== "me")).join(), /7 parts|me must use/);
    assert.match(beatProblems(b.beats.map((x) => (x.part === "climax" ? { ...x, uses: ["twist"] } : x))).join(), /climax must use prop_payoff/);
    const script = normalizeScript(EXAMPLE_SCRIPT);
    const sp = await writeShots({ provider: "mock", script });
    assert.deepEqual(sp.problems, []);
    assert.match(shotProblems(sp.shots.slice(1), script).join(), /line 0 has no shot/);
    assert.match(shotProblems([{ ...sp.shots[0], camera: "drone" }, ...sp.shots.slice(1)], script).join(), /unknown camera drone/);
    assert.ok(!JSON.stringify(beatsSchema()).includes("maxItems") && !JSON.stringify(shotsSchema()).includes("maxItems"));
    assert.ok(USES.includes("prop_payoff") && SHOTS.camera.includes("low_angle_threat"));
    const c = await cardFromScript({ provider: "mock", lines: script.lines });
    assert.deepEqual(c.problems, []);
    assert.equal(c.card.opener, script.lines[0].text);
  });
});

// ---------- the library job (mock: free, no network) ----------
test("library job: ticks generate, check, dedup, judge and store until the target; only accepted ideas go live", async () => {
  await noNetwork(async () => {
    const store = memoryStore();
    // the mock writer's word lists allow only a few dozen truly different rules, so the target is small; the dedup
    // blocking the rest is part of what this test shows
    let batch = { id: "b1", requested: 8, status: "running", accepted: 0 };
    for (let i = 0; i < 40 && batch.status === "running"; i++) ({ batch } = await tick({ store, batch, provider: "mock", maxUsd: Infinity, callsPerTick: 3, seed: 11 + i * 7 }));
    const live = store.rows.filter((r) => r.status === "live"), rejected = store.rows.filter((r) => r.status === "rejected");
    assert.equal(batch.status, "done");
    assert.ok(live.length >= 8, `live ${live.length}`);
    assert.ok(rejected.length > 0, "the judge rejects some");
    assert.ok(batch.duplicates > 0, "dedup catches repeats");
    // a revision may keep its rejected original's opener; among live ideas a key is unique (the database's rule too)
    assert.equal(new Set(live.map((r) => r.opener_key)).size, live.length, "no two live ideas share a key");
    for (const r of live) { assert.deepEqual(cardProblems(r.idea), []); assert.ok(r.score >= ACCEPT.minScore); }
    assert.equal(batch.cost_usd, 0);
    const rr = await rerank({ store });
    assert.equal(rr.ranked, live.length);
  });
});

test("library job: a pending user idea is judged first; the money cap stops a batch before the next call", async () => {
  await noNetwork(async () => {
    const store = memoryStore([{ id: "u1", status: "pending", idea: listener, opener: listener.opener, opener_key: openerKey(listener.opener) }]);
    const { batch, log } = await tick({ store, batch: { id: "b2", requested: 6, status: "running" }, provider: "mock", maxUsd: Infinity, callsPerTick: 1, seed: 5 });
    assert.notEqual(store.rows.find((r) => r.id === "u1").status, "pending");
    assert.ok(log[0].startsWith("user idea"));
    const capped = await tick({ store, batch: { id: "b3", requested: 600, status: "running", cost_usd: 9.99 }, provider: "mock", maxUsd: 10, callsPerTick: 3, seed: 9 });
    assert.equal(capped.batch.status, "stopped");
    assert.match(capped.log.join(), /cap/);
    void batch;
  });
});

test("cost: a 500-idea batch on Sonnet 5.5 (write + judge) is estimated before anything runs", () => {
  const price = { gen: PRICE["claude-sonnet-5-5"], judge: PRICE["claude-sonnet-5-5"] };
  const half = batchCost({ accepted: 500, acceptRate: 0.5, price }), third = batchCost({ accepted: 500, acceptRate: 0.35, price });
  assert.equal(half.generated, 1000);
  assert.ok(half.totalUsd > 5 && half.totalUsd < 12, `$${half.totalUsd}`);
  assert.ok(third.totalUsd > half.totalUsd);
});

test("migration: the library tables, the RPCs and the event kinds the code uses exist", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261201110000_blocky_worlds_idea_library.sql", import.meta.url), "utf8");
  for (const t of ["blocky_worlds_library", "blocky_worlds_seen", "blocky_worlds_events", "blocky_worlds_idea_batches", "blocky_worlds_posts", "blocky_worlds_library_candidates", "blocky_worlds_mark_seen", "blocky_worlds_bump"]) assert.ok(sql.includes(t), t);
  for (const k of ["shown", "picked", "rewritten", "generated", "downloaded", "thumb_up", "thumb_down"]) assert.ok(sql.includes(`'${k}'`), k);
  assert.ok(sql.includes("NOT APPLIED"));
});

test("mock writer: library slots give ideas that pass the checks", async () => {
  await noNetwork(async () => {
    const w = await writeLibraryIdeas({ provider: "mock", slots: planSlots(mixWeights([]), 6, 2), seed: 4 });
    assert.equal(w.ideas.length, 6);
    const j = await judgeIdeas({ provider: "mock", ideas: w.ideas });
    assert.equal(j.verdicts.length, 6);
  });
});
