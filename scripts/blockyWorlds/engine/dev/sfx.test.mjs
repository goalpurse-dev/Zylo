// SOUND agent tests: lib/sfx.js cue placement + the music loop's seam.   node --test dev/sfx.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sfxCues, sfxCandidates, speechSpans, SFX_TIMING } from "../lib/sfx.js";
import { SFX } from "../audio/sfx.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** a small synthetic timeline: words every 0.3 s with a few pauses, shots with the actions we react to */
function makeTl({ words, shots, duration }) {
  const captions = []; let t = 0.1;
  for (const w of words) { if (w === "|") { t += 0.6; continue; } captions.push({ word: w, start: +t.toFixed(3), end: +(t + 0.25).toFixed(3) }); t += 0.3; }
  return { duration: duration ?? +(t + 1).toFixed(3), shots, captions };
}
const shot = (start, end, extra = {}) => ({ start, end, part: "tour", actors: [], monsterState: null, ...extra });

test("SFX_TIMING matches the catalog (dur, anchor, gain) and every cue name has a file entry", () => {
  for (const [name, [dur, anchor, gainDb]] of Object.entries(SFX_TIMING)) {
    assert.ok(SFX[name], `catalog lacks ${name}`);
    assert.equal(SFX[name].dur, dur, name); assert.equal(SFX[name].anchor, anchor, name); assert.equal(SFX[name].gainDb, gainDb, name);
  }
  assert.deepEqual(Object.keys(SFX).sort(), Object.keys(SFX_TIMING).sort());
});

test("built sfx files exist with the catalog's duration (if built)", () => {
  const dir = path.join(ENGINE, "audio", "sfx");
  if (!fs.existsSync(dir)) return;
  for (const [name, s] of Object.entries(SFX)) {
    const f = path.join(dir, `${name}.wav`);
    assert.ok(fs.existsSync(f), `missing ${f}`);
    const bytes = fs.statSync(f).size - 44;
    assert.ok(Math.abs(bytes / 2 / 44100 - s.dur) < 0.02, `${name}: ${bytes / 88200} s vs ${s.dur}`);
  }
});

test("deterministic: same timeline, same cues", () => {
  const tl = makeTl({ words: "Mr. Dobbs sneezed | and the door creaked | then a boom".split(" "), shots: [shot(0, 6)] });
  assert.deepEqual(sfxCues(tl), sfxCues(JSON.parse(JSON.stringify(tl))));
});

test("sound words in captions give their sounds; negated ones do not", () => {
  const tl = makeTl({ words: "He sneezed | then the old door creaked | and nobody ever heard a cheer | boom".split(" "), shots: [shot(0, 12)] });
  const names = sfxCues(tl).map((c) => c.name);
  assert.ok(names.includes("sneeze")); assert.ok(names.includes("door_creak")); assert.ok(names.includes("impact"));
  assert.ok(!names.includes("crowd_cheer"), "'nobody ever heard a cheer' must not cheer");
});

test("whistle only when it is blown (word or pose)", () => {
  const kept = makeTl({ words: "Grandpa's old brass whistle | was the loudest thing".split(" "), shots: [shot(0, 5)] });
  assert.ok(!sfxCues(kept).some((c) => c.name === "whistle"));
  const blown = makeTl({ words: "At the top I blew the whistle | lights came on".split(" "), shots: [shot(0, 5)] });
  assert.ok(sfxCues(blown).some((c) => c.name === "whistle"));
  const pose = makeTl({ words: "At the top | I did it".split(" "), shots: [shot(0, 1), shot(1, 3, { actors: [{ id: "me", pose: "blow", hold: "whistle" }] })] });
  assert.ok(sfxCues(pose).some((c) => c.name === "whistle" && /blows the whistle/.test(c.why)));
});

test("a monster reveal gets a riser ending exactly on the shot start + a stinger on it; later reveals stay quiet (sparse, 2026-11-04)", () => {
  const shots = [shot(0, 4), shot(4, 6, { monsterState: { state: "reveal" } }), shot(6, 8, { monsterState: { state: "reveal" } }), shot(8, 20), shot(20, 22, { monsterState: { state: "reveal" } })];
  const tl = makeTl({ words: Array(70).fill("word"), shots, duration: 24 });
  const cues = sfxCues(tl);
  const riser = cues.find((c) => c.name === "riser_short"), sting = cues.find((c) => c.name === "stinger");
  assert.ok(riser && sting);
  assert.equal(sting.at, 4); assert.equal(riser.at, 4);
  assert.ok(Math.abs(riser.t + SFX_TIMING.riser_short[1] - 4) < 1e-6, "riser ends on the reveal");
  assert.equal(cues.filter((c) => c.name === "stinger").length, 1, "only the first reveal stings");
  assert.ok(!cues.some((c) => c.name === "impact"), "no hit on a later reveal");
  assert.ok(sting.gainDb <= -12, "a hit on a word sits at -12 dB or lower");
});

test("sparse: never two moments within 1.2 s (riser/stinger pair excepted), the same sound at most twice", () => {
  const words = []; for (let i = 0; i < 300; i++) words.push(i % 9 === 0 ? "screamed" : i % 13 === 0 ? "boom" : i % 17 === 0 ? "knocked" : "word");
  const shots = []; for (let i = 0; i < 40; i++) shots.push(shot(i * 2.5, (i + 1) * 2.5, { part: ["rule", "tour", "me", "until", "discovery", "climax", "closer"][Math.floor(i / 6)] }));
  const tl = makeTl({ words, shots, duration: 100 });
  const cues = sfxCues(tl);
  assert.ok(cues.length <= 12, `${cues.length} cues for 100 s`);
  const moments = cues.filter((c) => c.name !== "riser_short").map((c) => c.at).sort((a, b) => a - b);
  for (let i = 1; i < moments.length; i++) assert.ok(moments[i] - moments[i - 1] >= 1.2 - 1e-9, `cues at ${moments[i - 1]} and ${moments[i]}`);
  const count = {}; for (const c of cues) count[c.name] = (count[c.name] ?? 0) + 1;
  for (const [n, k] of Object.entries(count)) assert.ok(k <= 2, `${n} x${k}`);
});

test("whooshes only on the first cut into until / discovery / climax", () => {
  const parts = ["rule", "tour", "tour", "me", "until", "until", "discovery", "climax", "climax", "closer"];
  const shots = parts.map((p, i) => shot(i * 6, (i + 1) * 6, { part: p }));
  const tl = makeTl({ words: Array(10).fill("word"), shots, duration: 60 });
  const w = sfxCues(tl).filter((c) => c.name.startsWith("whoosh"));
  assert.deepEqual(w.map((c) => c.at), [24, 36, 42]);
});

test("cues land between words when a gap is close, else they are ducked", () => {
  // "sneezed" is followed by a 0.6 s pause: the sneeze's CHOO should land in it at the base gain
  const tl = makeTl({ words: "Mr. Dobbs sneezed | his own name in the bakery once".split(" "), shots: [shot(0, 5)] });
  const c = sfxCues(tl).find((x) => x.name === "sneeze");
  const spans = speechSpans(tl.captions);
  assert.ok(!spans.some(([s, e]) => s < c.at + 0.28 && e > c.at - 0.03), "moment is in a gap");
  assert.ok(c.gainDb >= SFX_TIMING.sneeze[2] - 3, "not ducked");
  // no pause anywhere: ducked
  const tl2 = makeTl({ words: "Mr. Dobbs sneezed his own name in the bakery once and now the shop is closed".split(" "), shots: [shot(0, 6)] });
  const c2 = sfxCues(tl2).find((x) => x.name === "sneeze");
  assert.ok(c2.gainDb <= SFX_TIMING.sneeze[2] - 4, "ducked under the words");
});

test("running shots give one footsteps loop over the run, capped at 4.5 s", () => {
  const shots = [shot(0, 2), ...[0, 1, 2, 3].map((i) => shot(2 + i * 1.5, 3.5 + i * 1.5, { actors: [{ id: "me", pose: "run" }] })), shot(8, 12)];
  const tl = makeTl({ words: Array(30).fill("word"), shots, duration: 12 });
  const f = sfxCues(tl).filter((c) => c.name === "footsteps_run");
  assert.equal(f.length, 1); assert.equal(f[0].t, 2); assert.equal(f[0].dur, 4.5);
});

test("The Listener (out/paid1) gets 6-14 cues, including the sneeze, the whistle and the reveal", () => {
  const f = path.join(ENGINE, "out", "paid1", "timeline.json");
  if (!fs.existsSync(f)) return;
  const tl = JSON.parse(fs.readFileSync(f, "utf8"));
  const cues = sfxCues(tl);
  assert.ok(cues.length >= 6 && cues.length <= 14, `${cues.length}`);
  for (const n of ["sneeze", "whistle", "stinger", "riser_short"]) assert.ok(cues.some((c) => c.name === n), n);
  assert.ok(sfxCandidates(tl).length >= cues.length);
});

test("music loop: the cycle is exactly bars x bar length and wraps without a click", async () => {
  const { renderLoop, timing } = await import("../audio/backrooms.mjs");
  const { L, loopSec } = renderLoop("A");
  const { bar } = timing("A");
  assert.equal(L.length, Math.round(loopSec * 44100));
  assert.ok(Math.abs(loopSec - bar * 4) < 1e-9);
  let maxStep = 0; for (let k = 1; k < L.length; k++) maxStep = Math.max(maxStep, Math.abs(L[k] - L[k - 1]));
  assert.ok(Math.abs(L[0] - L[L.length - 1]) <= maxStep, "the wrap is no bigger than a normal sample step");
});
