// In This Town's live feed in the chat (docs/in-this-town-live-feed.md): the merge rules the grid depends on.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { THUMB_KEEP_MS, mergeLive, stepLine } from "../src/lib/townLive.js";
import { mockTownStatus } from "../src/lib/maestroMock.js";

const feedOf = (shots, extra = {}) => ({ v: 1, runId: "r", engine: "threejs", step: { stage: "previews", words: "Test-shooting every shot", detail: "2 of 3 shots" }, count: { done: 2, total: 3, pass: 1, fail: 1 }, shots, video: { ready: false }, ...extra });
const shot = (n, v, state, url) => ({ n, line: n, text: `line ${n}`, state, v, thumbUrl: url });

test("no feed (a customer run, the old engine, before planning): nothing to show, the step line falls back", () => {
  assert.equal(mergeLive(null, undefined), null);
  assert.equal(mergeLive(null, { v: 2, shots: [] }), null, "an unknown feed version is ignored");
  assert.deepEqual(stepLine({ status: "plan", progress: { stage: "previews", detail: "17 of 38 shots" } }, null), { words: "Test-shooting every shot", detail: "17 of 38 shots" });
  assert.deepEqual(stepLine({ status: "voice" }, null), { words: "Recording the voice", detail: "" });
});

test("the grid fills in, the count is the engine's, the step in its words", () => {
  const f = mergeLive(null, feedOf([shot(3, 0, "pending", null), shot(1, 1, "pass", "a1"), shot(2, 1, "fail", "b1")]), 1000);
  assert.deepEqual(f.shots.map((s) => s.n), [1, 2, 3], "in video order");
  assert.equal(f.detail, "2 of 3 shots");
  assert.equal(f.words, "Test-shooting every shot");
  assert.equal(f.shots[2].thumbUrl, null);
});

test("a repaired shot replaces its old still; an older answer never brings the old still back", () => {
  const a = mergeLive(null, feedOf([shot(1, 1, "pass", "a1"), shot(2, 1, "fail", "b1")]), 1000);
  const b = mergeLive(a, feedOf([shot(1, 1, "pass", "a1-resigned"), shot(2, 2, "repaired", "b2")]), 9000);
  assert.equal(b.shots[1].thumbUrl, "b2");
  assert.equal(b.shots[1].state, "repaired");
  assert.equal(b.shots[1].replacedAt, 9000, "flashes once");
  assert.equal(b.shots[0].thumbUrl, "a1", "the same still keeps its link (no reload every 8 s)");
  const c = mergeLive(b, feedOf([shot(1, 1, "pass", "a1"), shot(2, 1, "fail", "b1")]), 17000);
  assert.equal(c.shots[1].thumbUrl, "b2", "version 2 stays");
  const d = mergeLive(b, feedOf([shot(1, 1, "pass", "a1-fresh"), shot(2, 2, "repaired", "b2")]), 1000 + THUMB_KEEP_MS + 1);
  assert.equal(d.shots[0].thumbUrl, "a1-fresh", "an old link is swapped for the new signature before it expires");
});

test("the chat wires it: the status answer's live feed, the grid only for In This Town; the dev mock never ships", () => {
  const card = readFileSync(new URL("../src/components/maestro/MaestroCards.jsx", import.meta.url), "utf8");
  assert.match(card, /setFeed\(\(prev\) => mergeLive\(prev, v\?\.live\)\)/);
  assert.match(card, /card\.how === "town" \? <TownLiveFeed feed=\{feed\} line=\{stepLine\(lastStatus, feed\)\} pct=\{run\.pct\} \/>/);
  assert.match(card, /import\.meta\.env\.DEV && MAESTRO_MOCK && run\.kind === "town" \? \(await import\("\.\.\/\.\.\/lib\/maestroMock\.js"\)\)\.mockTownStatus/);
  // the mock walks every state the display handles
  const at = (s) => mockTownStatus(0, s * 1000);
  assert.equal(at(1).live.shots.every((x) => x.state === "pending"), true);
  assert.equal(at(10).live.shots[3].state, "fail");
  assert.equal(at(20).live.shots[3].state, "repaired");
  assert.equal(at(20).live.shots[3].v, 2);
  assert.equal(at(30).status, "done");
});
