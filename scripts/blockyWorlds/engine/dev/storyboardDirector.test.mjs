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
