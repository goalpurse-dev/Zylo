// node --test scripts/blockyWorlds/blenderKit/plan.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { shotFrames, splitShots } from "./plan.mjs";

const words = Array.from({ length: 10 }, (_, i) => ({ word: `w${i}`, start: i * 0.5, end: i * 0.5 + 0.4 }));
const src = `@S(1, 0, 3, "a")\ndef s01(t0, t1): pass\n@S(2, 3, 7, "b")\ndef s02(t0, t1): pass\n@S(3, 7, None, "c")\ndef s03(t0, t1): pass\n`;

test("shot frames follow the kit's word timing and F(t) = round(t * 30) + 1", () => {
  const s = shotFrames(src, words);
  // shot 1: 0 .. 1.5 s -> frames 1..45; shot 2: 1.5 .. 3.5 s -> 46..105; shot 3: 3.5 .. 4.9 + 0.25 = 5.15 s -> 106..154
  // (5.15 * 30 = 154.5: Python rounds half to even -> 154)
  assert.deepEqual(s, [{ id: 1, f0: 1, f1: 45, n: 45 }, { id: 2, f0: 46, f1: 105, n: 60 }, { id: 3, f0: 106, f1: 154, n: 49 }]);
});

test("pyRound rounds half to even like Python", async () => {
  const { pyRound } = await import("./plan.mjs");
  assert.deepEqual([0.5, 1.5, 2.5, 2.4, 2.6, 154.5].map(pyRound), [0, 2, 2, 2, 3, 154]);
});

test("a gap between shots is refused", () => {
  assert.throws(() => shotFrames(`@S(1, 0, 3, "a")\n@S(2, 4, None, "b")\n`, words), /starts at frame/);
});

test("split: contiguous whole shots, every frame once, balanced", () => {
  const shots = Array.from({ length: 66 }, (_, i) => ({ id: i + 1, n: 20 + ((i * 7) % 40) }));
  let f = 1;
  for (const s of shots) { s.f0 = f; s.f1 = f + s.n - 1; f = s.f1 + 1; }
  for (const k of [1, 3, 6, 9]) {
    const g = splitShots(shots, k);
    assert.equal(g.length, k);
    assert.deepEqual(g.flatMap((x) => x.ids), shots.map((s) => s.id));
    assert.equal(g.reduce((a, x) => a + x.n, 0), f - 1);
    for (let i = 1; i < g.length; i++) assert.equal(g[i].f0, g[i - 1].f1 + 1);
    const avg = (f - 1) / k;
    for (const x of g) assert.ok(Math.abs(x.n - avg) <= 60, `k=${k}: group ${x.shots} has ${x.n} frames, avg ${avg}`);
  }
});

test("split never makes more groups than shots", () => {
  const g = splitShots([{ id: 1, f0: 1, f1: 10, n: 10 }, { id: 2, f0: 11, f1: 20, n: 10 }], 5);
  assert.equal(g.length, 2);
  assert.equal(g[0].shots, "1");
});
