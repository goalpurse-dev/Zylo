// Regression: the real run 707609b1 ("The Wolf Hunts Our Turtle", 2026-11-05) failed PRODUCTION_CHECK on its prepare
// retry with the builder off: "#29 crumpled scroll with a big paw print, #31 crowd, #32 crowd, #37 crowd". THE
// PERMANENT RULE: a missing item never fails a run (kit -> library -> builder -> picture card). Free: the stored
// director list + the take's word timings (dev/scripts/run707609b1.json), no paid call.
//   node --test dev/run707.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as plan from "../plan.mjs";
import { planCriticalFirst } from "./criticalFakes.mjs";
import * as kit from "../page/kit/objects.js";
import { matchProduction, directStory } from "../lib/director/index.js";
import { nearestCrowdKind } from "../lib/director/match.js";
import { cardLabel, badgeWord } from "../lib/planText.js";
import { keepRanges, remap } from "../voice/eleven.mjs";
import { preRenderChecks, checkFailure } from "../runpod/worker.mjs";
import { makeBuilder } from "../lib/builder/index.js";
import { resolveNeeds } from "../lib/builder/resolve.js";
import { mockProvider } from "../lib/builder/mock.js";

const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ENGINE, "dev", "scripts", "run707609b1.json"), "utf8"));
const script = { title: R.title, lines: R.lines };
const spoken = R.spoken.map(([w, s, e]) => ({ w, s, e }));
const ranges = keepRanges(spoken, spoken.at(-1).e + 0.5);
const words = spoken.map((w) => ({ word: w.w, start: +remap(w.s, ranges).toFixed(3), end: +remap(w.e, ranges).toFixed(3) }));
const exists = (rel) => fs.existsSync(path.join(ENGINE, rel));

/** the prepare job's steps with the builder off (every builder need a picture card), then the pre-render checks */
async function prepareChecks(direction) {
  // STORY-CRITICAL FIRST (worker prepare order 2026-11-08): the critical items built (fake) before the plan, then "reject"
  const { tl } = planCriticalFirst(plan, { script, words, idea: R.card, lengthSec: R.lengthSec, direction, exists });
  const built = await makeBuilder({ provider: null }).buildFor(tl, { plan, kit });
  const c = preRenderChecks(plan, tl, script, kit);
  return { tl, built, c, bad: checkFailure(c) };
}

test("run 707609b1: the stored director list passes every check with the builder off (cards)", async () => {
  const match = matchProduction(R.director.production, { exists, script, mood: R.card.mood, idea: R.card });
  const { tl, built, c, bad } = await prepareChecks({ production: R.director.production, match, provider: "anthropic", model: R.director.model, fellBack: false });
  assert.equal(bad, null, bad?.message);
  assert.deepEqual(c.production, []);
  assert.ok(built.cards.length > 0, "the builder was off: its needs are cards");
  // the robot "soldiers" are the army (EPIC's nearest crowd kind), the gap still says what was asked
  const soldiers = match.calls.find((x) => x.item === "soldiers");
  assert.equal(soldiers.crowdKind, "soldier");
  assert.equal(soldiers.askedKind, "robot");
  assert.ok(match.gaps.some((g) => g.capability === "crowd" && /robot/.test(g.detail)), "the gap is still logged");
  assert.equal(soldiers.name, "soldiers", "an unnamed crowd is called by its id, never \"crowd\"");
  for (const line of [31, 32, 37]) {
    const shots = tl.shots.filter((s) => (s.lines ?? [s.line]).includes(line));
    const named = shots.some((s) => (s.crowds ?? []).some((x) => x.item === "soldiers") || [s.marker, ...(s.markers ?? [])].some((m) => /SOLDIER/.test(m?.text ?? "")) || /SOLDIER/.test(s.insert?.text ?? ""));
    assert.ok(named, `line ${line} shows the soldiers`);
  }
  // NO PICTURE CARDS OR BADGES (owner, PERMANENT 2026-11-07): the scroll on line 29 is held / built, else the line's
  // real shot records it as unshown; never a card or a badge anywhere
  const l29 = tl.shots.filter((s) => (s.lines ?? [s.line]).includes(29));
  assert.ok(l29.length && l29.every((s) => s.camera !== "insert" && !s.insert));
  assert.ok(l29.some((s) => (s.actors ?? []).some((a) => /scroll|paper|letter/.test(a.hold ?? "")) || (s.objects ?? []).some((o) => /scroll/.test(o.name)) || (s.unshown ?? []).some((u) => /scroll/.test(u))), JSON.stringify(l29.map((s) => ({ a: s.actors, o: s.objects, u: s.unshown }))));
  for (const s of tl.shots) assert.ok(![s.marker, ...(s.markers ?? [])].some((m) => m && m.kind !== "ring"), `a badge on shot ${tl.shots.indexOf(s)}`);
});

test("a crowd EPIC has no kind for (a crowd of robots, of ducks) still ends on screen: members or a card", async () => {
  for (const member of ["robot", "duck", "jellybean"]) {
    const prod = JSON.parse(JSON.stringify(R.director.production));
    const swap = (id) => (id === "soldiers" ? "machines" : id);
    prod.crowds = prod.crowds.map((c) => (c.id === "soldiers" ? { ...c, id: "machines", member } : c));
    prod.lines = prod.lines.map((l) => ({ ...l, subject: swap(l.subject), needs: l.needs.map(swap) }));
    const match = matchProduction(prod, { exists, script, mood: R.card.mood, idea: R.card });
    const { bad } = await prepareChecks({ production: prod, match, provider: "anthropic", fellBack: false });
    assert.equal(bad, null, `${member}: ${bad?.message}`);
  }
});

test("run 707609b1: the mock director with the same script passes too", async () => {
  const d = await directStory({ script, idea: R.card, provider: "mock", exists });
  const { bad } = await prepareChecks(d);
  assert.equal(bad, null, bad?.message);
});

test("builder (run 707609b1: $0.23, 0 built): a still that fails never buys a new design; a renderer that can't start costs nothing", async () => {
  const need = (name) => ({ id: `n-${name}`, kind: "object", name, phrase: name, line: 0, lineText: `the ${name}` });
  const noKit = { has: () => null };
  // the renderer breaks: one design is bought, the still is tried twice with that same blueprint, then every need is a card
  const prov = mockProvider({ costUsd: 0.01 });
  let stills = 0;
  const { results, report } = await resolveNeeds([need("ladder"), need("robot dentist"), need("giant heart")], { provider: prov, render: async () => { stills++; throw new Error("Running as root without --no-sandbox is not supported"); }, kit: noKit });
  assert.ok(Object.values(results).every((r) => r.source === "card" && /still renderer failed/.test(r.reason)), JSON.stringify(Object.values(results).map((r) => r.reason)));
  assert.ok(prov.calls.design <= 3, `designs bought: ${prov.calls.design}`); // the needs run in parallel: at most one each, never a retry
  assert.equal(stills, 2 * prov.calls.design, "each bought design: its still twice, then nothing more");
  assert.equal(prov.calls.vision, 0);
  assert.ok(report.costUsd <= 0.03);
  // the real still renderer that can't start (beforeStills throws as Chrome would): no design at all
  const prov2 = mockProvider({ costUsd: 0.01 });
  const b = makeBuilder({ provider: prov2, beforeStills: async () => { throw new Error("Chrome failed to start"); } });
  const r2 = await b.prefetch([need("ladder")], { resolveObject: () => null });
  void r2;
  const tlNeeds = { needs: [need("kazoo")], shots: [] };
  const out = await b.buildFor(tlNeeds, { kit: { resolveObject: () => null } });
  assert.equal(prov2.calls.design, 0, "no paid design without a working still renderer");
  assert.match(out.report.byNeed[0].reason, /still renderer failed: Chrome failed to start/);
  await b.close();
});

test("builder: the time cap runs from the first resolve (not from the job's start), and never past budget.until", async () => {
  const need = { id: "n1", kind: "object", name: "ladder", phrase: "ladder", line: 0 };
  const b = makeBuilder({ provider: mockProvider({ delayMs: 50 }), render: async () => ({ jpeg: Buffer.from("x"), file: null }), budget: { maxMs: 400 } });
  await new Promise((r) => setTimeout(r, 500)); // the director's time: it no longer eats the builder's
  const out = await b.buildFor({ needs: [need], shots: [] }, { kit: { resolveObject: () => null } });
  assert.equal(out.report.byNeed[0].source, "built");
  const late = await resolveNeeds([need], { provider: mockProvider({ delayMs: 50 }), render: async () => ({ jpeg: Buffer.from("x"), file: null }), kit: { has: () => null }, budget: { until: Date.now() - 1 } });
  assert.match(late.results.n1.reason, /time cap/);
});

test("picture-card words never end on a little word; the badge shows the thing's noun", () => {
  assert.equal(cardLabel("crumpled scroll with a big paw print"), "CRUMPLED SCROLL");
  assert.equal(cardLabel("Grandma's silver duct tape roll with a little heart"), "GRANDMA'S SILVER DUCT TAPE");
  assert.equal(cardLabel("bag of gold"), "BAG OF GOLD");
  assert.equal(cardLabel("a ladder"), "A LADDER");
  assert.equal(cardLabel("strip of tape with the"), "STRIP OF TAPE");
  assert.equal(badgeWord("CRUMPLED SCROLL"), "SCROLL");
  assert.equal(badgeWord("CRUMPLED SCROLL WITH A"), "SCROLL");
  assert.equal(badgeWord("LADDER"), "LADDER");
});

test("an unknown crowd kind goes to the nearest EPIC kind, else stays as asked (members / a card)", () => {
  assert.equal(nearestCrowdKind("robot", "soldiers"), "soldier");
  assert.equal(nearestCrowdKind("robot", "robot army"), "soldier");
  assert.equal(nearestCrowdKind("skeleton", "royal guards"), "soldier");
  assert.equal(nearestCrowdKind("robot", "knights"), "knight");
  assert.equal(nearestCrowdKind("villagers", "the folks"), "townsfolk");
  assert.equal(nearestCrowdKind("duck", "ducks"), "duck");
  assert.equal(nearestCrowdKind("townsfolk", "soldiers"), "townsfolk");
});
