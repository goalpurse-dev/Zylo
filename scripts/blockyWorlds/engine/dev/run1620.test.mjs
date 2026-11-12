// Regression: the real run 1620fc3e ("The Turtle Town", real Haiku director, 2026-11-06; strict human review 24%):
//  1. every DAYTIME shot inside the turtle was a flat beige frame, every night one black: the director's 30 m turtle
//     made a 6 x 4 m cavern whose fog ended (41 m) before it began (45 m) -> host size >= 120, the cavern >= 110 m,
//     a fog whose far end is past its near end, and a free pixel guard (lib/frameGuard.js + render.mjs flatGuard)
//  2. picture cards were signposts with an EMPTY circle (no colour emoji font on the RunPod image; "✨" says nothing)
//     -> lib/cards.js (the word big, never an empty disc) + fonts-noto-color-emoji; a built thing replaces EVERY card
//     of its name (the built garden hose left two "GARDEN HOSE" cards)
//  3. line 15 never appeared (its black frames were replaced by line 14's last good frame, caption and all)
//     -> checkTimeline's lineSpanProblems: every line's own shots and caption words in its time
//  4. the ending (hose, mud, slide, splash, sea at sunrise) showed the turtle walking on flat grass -> lib/coast.js
//     (shot.stage) + creatureWorld.js addCoastStage + giant actions slide / float + the hose prop
//  5. "Spears" cast as a person; Mrs. Pell / Mr. Dunk twice; a "Sister" and a "Juno"; the wolf 3x the turtle
// Free: the stored director list + the take's word timings (dev/scripts/run1620fc3e.json); one render test uses the
// local GPU page (no paid call).   node --test dev/run1620.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import { planCriticalFirst } from "./criticalFakes.mjs";
import { directStory } from "../lib/director/index.js";
import { validateEpic } from "../lib/epic.js";
import { applyResolved } from "../lib/builder/apply.js";
import { cardPicture, cardWord, badgeParts } from "../lib/cards.js";
import { flatShare, detailOf, isFlat, isBad } from "../lib/frameGuard.js";
import { coastPlan, coastWords } from "../lib/coast.js";
import { supports } from "../lib/capabilities.js";
import { flatGuard, startServer, launchBrowser, openPage } from "../render.mjs";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "run1620fc3e.json"), "utf8"));
const script = { title: R.title, lines: R.lines };
const words = R.words.map(([word, start, end]) => ({ word, start, end }));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));
const idea = { opener: R.lines[0].text, title: R.title, topic: R.topic, setting: "inside a giant turtle" };
let TL = null;
async function timeline() {
  if (TL) return TL;
  const direction = await directStory({ script, idea, exists, provider: { direct: async () => ({ data: R.production, costUsd: 0 }) } });
  // STORY-CRITICAL FIRST (worker prepare order 2026-11-08): critical items resolved/built before the plan, then "reject"
  TL = planCriticalFirst(plan, { script, words, idea, lengthSec: R.lengthSec, direction, exists }).tl;
  return TL;
}
const shotsOf = (tl, i) => tl.shots.filter((s) => (s.lines ?? [s.line]).includes(i));

// ------------------------------------------------------------------ 1. the beige screens
test("run 1620fc3e: the town's creature is the biggest thing (>= 120 m), the wolf under half of it", async () => {
  const tl = await timeline();
  for (const w of Object.values(tl.worlds)) assert.ok(w.size >= 120, JSON.stringify(w));
  assert.ok(tl.giants.wolf_boss.size <= tl.worlds.turtle_outside.size * 0.5, JSON.stringify(tl.giants));
  assert.deepEqual(plan.checkTimeline(tl), []);
  assert.deepEqual(validateEpic(tl), []);
});

test("frame guard: a one-colour or detail-less frame is flat, a real one is not; flatGuard re-renders it safe", async () => {
  const beige = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => [226, 194, 124, 255][i % 4]);
  assert.equal(flatShare(beige), 1); assert.equal(detailOf(beige), 0);
  assert.ok(isFlat({ mean: 180, flat: flatShare(beige), detail: detailOf(beige) }));
  const grad = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? 255 : 90 + Math.floor(i / 64) * 0.5)); // a smooth green-ish ramp
  assert.ok(detailOf(grad) < 3 && isFlat({ mean: 90, flat: flatShare(grad), detail: detailOf(grad) }));
  const scene = new Uint8ClampedArray(16 * 16 * 4).map((_, i) => (i % 4 === 3 ? 255 : (i * 37) % 255));
  assert.ok(!isBad({ mean: 120, flat: flatShare(scene), detail: detailOf(scene) }));
  // the guard: shot 3 is flat at safe 0, fine at safe 1 (no fog); remembered per shot, logged in the report
  const calls = [];
  const grab = async (t, force, safe = 0) => { calls.push(safe); return { shot: 3, mean: 150, flat: safe ? 0.2 : 1, detail: safe ? 12 : 0, safe, data: "x,y" }; };
  const g = flatGuard(grab);
  const a = await g.frame(1.0), b = await g.frame(1.04);
  assert.equal(a.safe, 1); assert.equal(b.safe, 1);
  assert.deepEqual(g.report(), [{ shot: 3, safe: 1, frames: 2, left: 0 }]);
  // nothing saves it: the frame comes back flat and the report says so (render.mjs then uses the last good frame)
  const g2 = flatGuard(async (t, f, safe = 0) => ({ shot: 5, mean: 150, flat: 1, detail: 0, safe, data: "x,y" }));
  assert.ok(isFlat(await g2.frame(2)));
  assert.equal(g2.report()[0].left, 1);
});

test("run 1620fc3e render (local GPU): the daytime inside of a 30 m turtle is a town, not a beige frame", { timeout: 240000 }, async (t) => {
  if (process.env.SKIP_RENDER_TESTS) return t.skip("SKIP_RENDER_TESTS");
  const tl = JSON.parse(JSON.stringify(await timeline()));
  for (const w of Object.values(tl.worlds)) w.size = 30; // the run's own size: the page must still build a real cavern
  const day = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.set === "creature:turtle_inside" && s.light !== "night" && s.camera !== "insert").slice(0, 3);
  const night = tl.shots.map((s, i) => [s, i]).filter(([s]) => s.set === "creature:turtle_inside" && s.light === "night").slice(0, 1);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bw1620-")), p = path.join(dir, "tl.json");
  fs.writeFileSync(p, JSON.stringify(tl));
  const srv = await startServer(dir), browser = await launchBrowser();
  try {
    const page = await openPage(browser, { port: srv.port, tlName: "tl.json", W: tl.width, H: tl.height });
    for (const [s, i] of [...day, ...night]) {
      const r = await page.evaluate((t) => window.renderAt(t), (s.start + s.end) / 2);
      assert.ok(!isBad(r), `shot ${i} (${s.light}, ${s.camera}): mean ${r.mean}, flat ${r.flat}, detail ${r.detail}`);
    }
  } finally { await browser.close().catch(() => {}); srv.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});

// ------------------------------------------------------------------ 2. the empty cards
test("cards: a picture card never draws an empty circle (generic or undrawable emoji -> the word big)", () => {
  assert.equal(cardPicture("HUNT", "✨"), "title");
  assert.equal(cardPicture("SHELL DOOR", "🚪", () => false), "title"); // the RunPod image without a colour emoji font
  assert.equal(cardPicture("SHELL DOOR", "🚪", () => true), "emoji");
  assert.equal(cardPicture("", "✨"), "word");
  assert.equal(cardPicture("", "OK"), "word"); assert.equal(cardWord("", "ok"), "OK");
  assert.equal(cardWord("GARDEN HOSE", "✨"), "GARDEN");
  assert.deepEqual(badgeParts("🚪 DOOR", () => false), { emoji: null, word: "DOOR" });
  assert.deepEqual(badgeParts("🚪 DOOR", () => true), { emoji: "🚪", word: "DOOR" });
  assert.deepEqual(badgeParts("✨", () => true), { emoji: null, word: "!" });
  assert.match(fs.readFileSync(path.join(ENGINE, "runpod", "Dockerfile"), "utf8"), /fonts-noto-color-emoji/);
});

test("builder: a built thing shows in EVERY shot that could not show it (the garden hose left two cards in run 1620fc3e; NO CARDS since 2026-11-07)", () => {
  const base = { set: "street", light: "day", actors: [{ id: "me", spot: "center", pose: "stand", expr: "neutral", facing: "camera", hold: null }], focus: "me", monsterState: null, marker: null, insert: null };
  const tl = { shots: [
    { ...base, start: 0, end: 3, line: 0, lines: [0], camera: "wide", needs: [{ id: "need1", host: "self" }], unshown: ["garden hose"] },
    { ...base, start: 3, end: 4, line: 1, lines: [1], camera: "closeup", unshown: ["garden hose"] }, // a later line of the same thing
    { ...base, start: 4, end: 7, line: 2, lines: [2], camera: "medium", unshown: ["garden hose"] },
  ] };
  const need = { id: "need1", kind: "object", name: "garden hose", phrase: "garden hose" };
  const [id, a] = Object.entries(R.built)[0];
  const r = applyResolved(tl, [need], { need1: { source: "built", asset: { id, kind: "object", ...a } } });
  assert.deepEqual(r.applied.map((x) => x.need), ["garden hose"]);
  assert.ok(tl.shots.every((s) => s.camera !== "insert" && !s.insert && !s.unshown && !s.needs));
  const showing = tl.shots.filter((s) => (s.objects ?? []).some((o) => o.asset === id));
  assert.equal(showing.length, 3);
  assert.ok(tl.shots.every((s) => s.end > s.start));
});

// ------------------------------------------------------------------ 3. the dropped line
test("run 1620fc3e: every line has its own shots and caption words in its time (line 15 included)", async () => {
  const tl = await timeline();
  assert.deepEqual(plan.lineSpanProblems(tl), []);
  assert.ok(shotsOf(tl, 15).length >= 1);
  // the render's failure, replayed on the plan: line 15's time shown by line 14's shot -> loud
  const bad = JSON.parse(JSON.stringify(tl));
  for (const s of bad.shots) if ((s.lines ?? [s.line]).includes(15)) { s.line = 14; s.lines = [14]; }
  assert.ok(plan.checkTimeline(bad).some((p) => /line 15 has no shot|line 15: its shots/.test(p)), plan.checkTimeline(bad).slice(0, 3).join(" | "));
  const noCaps = { ...JSON.parse(JSON.stringify(tl)), captions: tl.captions.filter((c) => c.start < tl.lines[15].start - 0.05 || c.start > tl.lines[15].end + 0.05) };
  assert.ok(plan.lineSpanProblems(noCaps).some((p) => /^line 15: no caption/.test(p)));
});

// ------------------------------------------------------------------ 4. the ending
test("coast: the story's words become hill -> spray / mud -> tip -> slide -> splash -> sea", () => {
  const st = coastPlan(R.lines.map((l) => l.text));
  assert.equal(st[25], null); // before the coast part: the plain fields
  assert.equal(st[28].ground, "hill");
  assert.deepEqual(st[30].fx, ["spray"]); assert.ok(st[30].mud);
  assert.ok(st[31].mud); assert.equal(st[31].action, null); // "A giant slide." is the mud, not the slide yet
  assert.equal(st[35].action, "fall");
  assert.equal(st[36].action, "slide");
  assert.deepEqual(st[37].fx, ["splash"]);
  assert.equal(st[40].ground, "sea"); assert.equal(st[40].action, "float");
  assert.ok(coastWords("Then it slid. Faster. Faster.").slide && !coastWords("A giant slide.").slide);
});

test("run 1620fc3e: the ending is filmed: spray with the hose, the mud hill, the slide, the splash, the sea at sunrise", async () => {
  const tl = await timeline();
  const outs = (i) => shotsOf(tl, i).filter((s) => s.stage);
  assert.ok(outs(30).some((s) => s.stage.mud && s.stage.fx?.includes("spray") && s.actors?.[0]?.hold === "hose"), "I sprayed the hill");
  assert.ok(outs(31).some((s) => s.stage.ground === "hill" && s.stage.mud), "Mud. Slick.");
  assert.ok(outs(35).some((s) => s.giants?.some((g) => g.id === "world" && g.action === "fall")), "tipped forward");
  assert.ok(outs(36).some((s) => s.giants?.some((g) => g.id === "world" && g.action === "slide")), "Then it slid");
  assert.ok(outs(37).some((s) => s.stage.fx?.includes("splash")), "Splash!");
  assert.ok(outs(40).some((s) => s.stage.ground === "sea" && s.giants?.some((g) => g.id === "world" && g.action === "float") && s.light === "warm"), "float in the sea at sunrise");
  // no "MUDDY HILL SLIDE" card any more: the hill is the set's own
  assert.ok(!tl.shots.some((s) => /MUDDY|HILL/.test(s.insert?.text ?? "")));
  assert.deepEqual(plan.checkTimeline(tl), []);
  assert.deepEqual(validateEpic(tl), []);
  assert.ok(supports("world.coast", { ground: "hill", action: "slide" }).ok);
  assert.ok(supports("fx.water", { kind: "splash" }).ok);
  assert.ok(supports("giant", { behaviour: ["slide", "float"] }).ok);
});

// ------------------------------------------------------------------ 5. the cast
test("run 1620fc3e: Spears is no person, Mrs. Pell / Mr. Dunk / Juno once each, the baker an adult", async () => {
  const tl = await timeline();
  const names = Object.values(tl.cast).map((c) => c.name);
  assert.ok(!names.includes("Spears"), names.join(","));
  assert.equal(names.filter((n) => /pell/i.test(n)).length, 1, names.join(","));
  assert.equal(names.filter((n) => /dunk/i.test(n)).length, 1, names.join(","));
  assert.ok(!tl.cast.sister && tl.cast.juno, names.join(","));
  assert.equal(tl.cast.baker?.role, "adult");
});
