// the automatic storyboard director (lib/storyboardDirector.js) with a mocked model: bible, scenes in parallel,
// validation, the repair call, the engine fallback, the clean failure codes. Free.
import test from "node:test";
import assert from "node:assert/strict";
import { directStoryboard, validateStoryboard } from "../lib/storyboardDirector.js";
import { KID_NEVER_BLINKS as K } from "../lib/storyboards/kidNeverBlinks.js";

const cast = Object.fromEntries(["me", "town1", "town2", "town3", "dottie", "hollis", "fenwick", "wim"].map((id) => [id, { name: id, role: "adult" }]));
const script = { lines: K.exampleLines.map((text) => ({ text })) };
const scenes = [{ id: "a", from: 0, to: 11 }, { id: "b", from: 12, to: 24 }, { id: "c", from: 25, to: 35 }];
const reply = (data) => ({ ok: true, status: 200, json: async () => ({ model: "claude-sonnet-5-5", usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(data) }] }) });
function mock({ breakLine = null, repairFixes = true } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const b = JSON.parse(init.body); calls.push(b);
    if (b.max_tokens === 1) return reply([]);
    if (/WORLD BIBLE of a vertical/.test(b.system)) return reply({ homes: K.bible.homes, houses: K.bible.houses, events: K.bible.events, rule: K.bible.rule });
    const ask = b.messages[0].content.at(-1).text, ids = ask.match(/lines ([\d, ]+) only/)[1].split(",").map(Number);
    const repair = /Fix these problems/.test(ask);
    return reply(ids.map((n) => { const e = JSON.parse(JSON.stringify(K.lines.find((l) => l.line === n))); if (n === breakLine && (!repair || !repairFixes)) e.shots = [{ loc: "moon", cam: "rocket", acts: [] }]; return e; }));
  };
  return { fetchFn, calls };
}

test("#2's storyboard uses only the kit vocabulary", () => assert.deepEqual(validateStoryboard(K, { lines: K.exampleLines, cast }), []));

test("bible + one call per scene in parallel (after a cache warm call); a valid board needs no repair", async () => {
  const m = mock();
  const r = await directStoryboard({ apiKey: "x", script, cast, scenes, fetchFn: m.fetchFn });
  assert.equal(m.calls.length, 1 + 1 + scenes.length);
  assert.equal(r.board.lines.length, 36); assert.deepEqual(r.fellBack, []);
});

test("a broken line is repaired once", async () => {
  const m = mock({ breakLine: 5 });
  const r = await directStoryboard({ apiKey: "x", script, cast, scenes, fetchFn: m.fetchFn });
  assert.equal(m.calls.length, 1 + 1 + scenes.length + 1); assert.deepEqual(r.fellBack, []);
  assert.equal(r.board.lines.find((l) => l.line === 5).shots[0].loc, "room:hollis");
});

test("a line the kit still can't show falls back to the planned engine shots", async () => {
  const r = await directStoryboard({ apiKey: "x", script, cast, scenes, fetchFn: mock({ breakLine: 5, repairFixes: false }).fetchFn });
  assert.deepEqual(r.fellBack, [5]); assert.equal(r.board.lines.find((l) => l.line === 5).keep, true);
});

test("an unusable bible is a clean STORYBOARD_FAILED (refunded by the server)", async () => {
  const fetchFn = async () => reply({ nope: true });
  await assert.rejects(directStoryboard({ apiKey: "x", script, cast, scenes, fetchFn }), (e) => e.code === "STORYBOARD_FAILED");
});

test("maxFallback 0 (BOARD_ONLY): one line the kit can't show is a clean KIT_UNSUPPORTED", async () => {
  await assert.rejects(directStoryboard({ apiKey: "x", script, cast, scenes, maxFallback: 0, fetchFn: mock({ breakLine: 5, repairFixes: false }).fetchFn }), (e) => e.code === "KIT_UNSUPPORTED");
});

test("the free replay: the Pigeon Mayor's unfilmable lines are reworded to kit things before the voice; the whistler needs nothing", async () => {
  const { replay } = await import("./simple/replayStoryboard.mjs");
  const fs = await import("node:fs");
  for (const [n, expect] of [["pigeonMayor", 3], ["whistler", 0]]) {
    const R = JSON.parse(fs.readFileSync(new URL(`./replay/${n}/results.json`, import.meta.url), "utf8"));
    const S = JSON.parse(fs.readFileSync(new URL(`./replay/${n}/scenes.json`, import.meta.url), "utf8"));
    const F = JSON.parse(fs.readFileSync(new URL(`./replay/${n}.fixture.json`, import.meta.url), "utf8"));
    const r = await replay({ script: R.results[0].script, scenes: S, fixture: F, maxFallback: 0 });
    assert.equal(r.error, null, n); assert.equal(r.rewrites.length, expect, n); assert.deepEqual(r.fellBack, [], n); assert.ok(r.kitCheck.ok, n);
  }
  // no rewrite on offer: the same lines are a clean KIT_UNSUPPORTED (board only)
  const R = JSON.parse(fs.readFileSync(new URL("./replay/pigeonMayor/results.json", import.meta.url), "utf8"));
  const S = JSON.parse(fs.readFileSync(new URL("./replay/pigeonMayor/scenes.json", import.meta.url), "utf8"));
  const r = await replay({ script: R.results[0].script, scenes: S, fixture: { unfilmable: ["statue", "fountain"], rewrites: {} }, maxFallback: 0 });
  assert.match(String(r.error), /^KIT_UNSUPPORTED/);
});
test("over its cap: the error carries the spend (the worker books it; shakedown 4 lost ~$0.12)", async () => {
  await assert.rejects(directStoryboard({ apiKey: "x", script, cast, scenes, capUsd: 0.0000001, fetchFn: mock({}).fetchFn }), (e) => e.code === "STORYBOARD_FAILED" && e.costUsd > 0 && /spent \$/.test(e.message));
});
test("fixCameras: a street camera on a park shot becomes the place's wide camera before validation (shakedown 4 retry)", async () => {
  const { fixCameras } = await import("../lib/storyboardDirector.js");
  const board = { lines: [{ line: 0, shots: [{ loc: "place:park", cam: "street_wide" }, { loc: "street", cam: "place_wide" }, { loc: "place:park", cam: "face:me" }] }] };
  assert.equal(fixCameras(board), 2);
  assert.deepEqual(board.lines[0].shots.map((s) => s.cam), ["place_wide", "street_wide", "face:me"]);
});
