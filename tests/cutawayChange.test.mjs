// The examples' ways of making a change read in one still frame (studied 2026-10-28; built in round 3): the red state
// label, the hold at 70% of travel, the bump and the drive-off, the snap, the gauge, the fast cycle.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stateCards, holdRamps, STATE_WORDS } from "../scripts/cutaway/proto3d/m2/compile.mjs";
import { previewTimes } from "../scripts/cutaway/proto3d/m2/checks.mjs";
import { buildAss, STATE_Y } from "../render-worker/src/cutawayFinalPlan.mjs";
import { RIG_MOVES, rigVerb, rigProblems } from "../scripts/cutaway/proto3d/m2/rig.js";
import { VERBS, verbCues } from "../scripts/cutaway/proto3d/m2/verbs.js";
import { CITY_CHANNELS } from "../scripts/cutaway/proto3d/m2/cityParts.js";

const W = (text, t0) => text.split(" ").map((w, i) => ({ w, s: +(t0 + i * 0.3).toFixed(2), e: +(t0 + i * 0.3 + 0.25).toFixed(2) }));

test("state label: a problem line gets its red label from its problem word to the line's end; the planner's own wins; never on other lines", () => {
  const words = [...W("So you add a lamp.", 0), ...W("But now the cars crash into each other.", 2)];
  const sentences = [{ role: "fix1", t0: 0, t1: 1.6, text: "So you add a lamp." }, { role: "problem2", t0: 2, t1: 4.3, text: "But now the cars crash into each other." }];
  const [c] = stateCards(sentences, words, []);
  assert.deepEqual({ text: c.text, kind: c.kind }, { text: "CRASH!", kind: "state" });
  assert.equal(c.s, words.find((w) => w.w === "crash").s); assert.ok(c.e >= 4.3, "held to the line's end");
  assert.equal(stateCards(sentences, words, [{ s: "problem2", state: { text: "TOO FAST", w: "cars" } }])[0].text, "TOO FAST");
  assert.equal(stateCards([sentences[0]], words, []).length, 0);
  assert.ok(STATE_WORDS.length >= 15);
  // in the final mix: red, its own style, above the number cards
  const ass = buildAss({ words, cards: [c] });
  assert.match(ass, /Style: CardState,Lilita One,108,&H00303BFF/);
  assert.match(ass, new RegExp(`CardState,,0,0,0,,\\{\\\\pos\\(540,${Math.round(1920 * STATE_Y)}\\)`));
});

test("hold: a motion that would finish at the line's end reaches 70% by 75% of the line and holds; the rest is a tail after it", () => {
  const s = { t0: 10, t1: 14 };
  const [a, b] = holdRamps({ t0: 13.4, t1: 15.6, amp: 1, e: "out", s: "fix1" }, s);
  assert.equal(a.amp, 0.7); assert.ok(a.t0 <= 13 && a.t1 <= 13.4 && a.t1 > a.t0, JSON.stringify(a));
  assert.equal(b.tail, true); assert.equal(b.t0, 14); assert.equal(+(a.amp + b.amp).toFixed(4), 1);
  // an early, short or backward motion keeps its timing
  for (const r of [{ t0: 10.2, t1: 11, amp: 1, e: "out" }, { t0: 13, t1: 13.1, amp: 1, e: "lin" }, { t0: 13, t1: 15, amp: -1, e: "inOut" }, { t0: 13, t1: 15, amp: 1, e: "step" }]) assert.deepEqual(holdRamps(r, s), [r]);
});

test("check frames: the middle frame is at the motion's peak, a hold's tail is never waited for, and a state label rides on the frames", () => {
  const tl = { marks: { lengthEnd: 12 }, sentences: [{ role: "problem", t0: 2, t1: 6, text: "But the panel swings out and slams down." }, { role: "fix1", t0: 6.2, t1: 9 }],
    tracks: { "door.flop": { ramps: [{ t0: 3, t1: 4.2, amp: 1, e: "inOut", s: "problem" }, { t0: 4.6, t1: 4.9, amp: -1, e: "inOut", s: "problem" }, { t0: 6, t1: 9.5, amp: 0.3, e: "inOut", s: "problem", tail: true }] } },
    audio: { cards: [{ text: "TOO HEAVY", s: 2.5, e: 6, kind: "state" }] } };
  const L = { parts: [{ id: "door", kind: "rig", params: { nodes: [] } }], beats: [{ s: "problem", shows: { p: "door" }, do: [{ p: "door", v: "flop" }] }] };
  const [p] = previewTimes(tl, L);
  assert.equal(p.ts.length, 3); assert.equal(p.ts[1], 4.25, "at the swing's peak, before the slam");
  assert.ok(p.ts[2] < 6.5, "not after the tail"); assert.deepEqual(p.label, ["TOO HEAVY", "TOO HEAVY", "TOO HEAVY"].map((x, i) => (p.ts[i] >= 2.5 && p.ts[i] <= 6 ? x : null)));
});

test("kit: a spring snaps in two and stays broken until its fix; cars bump and drive off; the signal cycles fast", () => {
  assert.ok(RIG_MOVES.includes("snap"));
  const spring = { name: "door", pos: [0, 0.1, -2], nodes: [{ id: "frame", at: [0, 0, 0], shapes: [{ shape: "box", size: [2, 0.2, 0.3], at: [0, 0.1, 0] }] },
    { id: "coil", parent: "frame", at: [0, 0.4, 0], shapes: [{ shape: "spring", r: 0.12, h: 1.2, axis: "x" }], moves: [{ name: "snap", type: "snap", axis: "x", gap: 0.4 }] }] };
  assert.deepEqual(rigProblems({ id: "door", kind: "rig", params: spring }, { floor: 0.1 }), []);
  assert.ok(rigVerb(spring, "snap")[0].amp > 0 && rigVerb(spring, "snapBack")[0].amp < 0);
  assert.ok(CITY_CHANNELS.traffic.includes("bump") && CITY_CHANNELS.trafficLight.includes("fast"));
  const lane = { id: "q", kind: "traffic", params: {} }, at = { s: "problem2" };
  assert.equal(verbCues(lane, { v: "bump" }, at)[0].c, "bump"); assert.equal(verbCues(lane, { v: "unbump" }, at)[0].amp, -1);
  assert.deepEqual(VERBS.trafficLight.cycleFast.map((r) => r.c), ["cycle", "fast"]);
  assert.deepEqual(VERBS.trafficLight.stopCycle.map((r) => [r.c, r.amp]), [["cycle", -1], ["fast", -1]]);
});

test("a time like 3 a.m. never splits a line in two (the real traffic light run of 2026-10-28 failed its plan on it)", async () => {
  const { speakable, draftSentences } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  assert.equal(speakable("But at 3 a.m. one lone car waits."), "But at 3 AM one lone car waits.");
  assert.equal(speakable("So you wait till 7:30 p.m."), "So you wait till 7:30 PM.");
  const [d] = draftSentences({ beats: [{ s: "problem2", do: [{ p: "car", v: "arrive", w: "lone" }] }] }, { problem2: "at 3 a.m. one lone car waits at a red" });
  assert.equal((d.text.match(/\./g) ?? []).length, 1, d.text);
});

test("a car held at a red light is a visible problem (the second real traffic light run of 2026-10-28 was refused for it)", async () => {
  const { chainProblems, VISIBLE } = await import("../scripts/cutaway/proto3d/m2/chain.js");
  assert.ok(VISIBLE.test("But now at night the timer holds red for one lone car."));
  const P = chainProblems({ sentences: [{ role: "hook", text: "If you hang a red lamp, you have a light." }, { role: "problem", text: "But now at night the timer holds red for one lone car." }], chain: [] }, { strict: false });
  assert.ok(!P.some((p) => /not something you can see/.test(p)), P.join("; "));
});

test("the planner's own state label survives into the layout (it was dropped: only the fallback words ever labelled a line)", async () => {
  const { layoutFromScene } = await import("../scripts/cutaway/proto3d/m2/plan.js");
  const scene = { world: { cut: [-4, 4, -3, 3] }, parts: [], audio: {}, beats: [{ s: "problem", do: [], state: { text: "TOO HOT", w: "heats" } }, { s: "problem2", do: [], state: "STUCK" }] };
  const { layout } = layoutFromScene(scene, { key: "t", title: "t", roles: ["problem", "problem2"] });
  assert.deepEqual(layout.beats.map((b) => b.state), [{ text: "TOO HOT", w: "heats" }, { text: "STUCK" }]);
});

test("a layout round trip (as a picture repair rebuilds it) keeps the beats' state labels", async () => {
  const { layoutFromScene, sceneFromLayout } = await import("../scripts/cutaway/proto3d/m2/plan.js");
  const scene = { world: { cut: [-4, 4, -3, 3] }, parts: [], audio: {}, beats: [{ s: "problem", do: [], state: { text: "CRACKED", w: "cracks" } }] };
  const L1 = layoutFromScene(scene, { key: "t", title: "t", roles: ["problem"] }).layout;
  const L2 = layoutFromScene(sceneFromLayout(L1), { key: "t", title: "t", roles: ["problem"] }).layout;
  assert.deepEqual(L2.beats[0].state, { text: "CRACKED", w: "cracks" });
  assert.match(fs.readFileSync(new URL("../scripts/cutaway/proto3d/m2/planner.mjs", import.meta.url), "utf8"), /why: layout\.why, \.\.\.\(layout\.hold \? \{ hold: true \} : \{\}\)/);
});

test("round 4 rules: meters are readable on a phone, a roof turns see-through over what later lines show, a coat on a wall reads at the face", async () => {
  const { layoutRules } = await import("../scripts/cutaway/proto3d/m2/layoutRules.js");
  const L = { key: "t", world: { cut: { x0: -4, x1: 4, z0: -4, depth: 3 } }, audio: {}, parts: [
    { id: "temp", kind: "counter", params: { pos: [5, 1.5, -2], size: 0.8, bar: true } },
    { id: "shade", kind: "canopy", params: { x0: -3, x1: 3, z0: -4, z1: -0.5, y: 0.12, h: 3 } },
    { id: "tank", kind: "boxPop", params: { pos: [0, 0.6, -2], size: [2, 1, 2] } },
    { id: "walls", kind: "panels", params: { panels: [{ ch: "coatL", mat: "liner", size: [0.1, 3, 4], anchor: [-1, 1, 1], pos: [-4, -3, -4], axis: "y" }, { ch: "floor", mat: "liner", size: [6, 0.08, 4], anchor: [1, 1, 1], pos: [-3, -0.6, -4], axis: "x" }] } }],
    beats: [{ s: "hook", do: [], shots: [] }, { s: "fix2", do: [{ p: "shade", v: "build" }], shots: [] }, { s: "how", shows: { p: "tank" }, do: [{ p: "tank", v: "show" }], shots: [] }, { s: "finish", do: [], shots: [] }] };
  const { layout } = layoutRules(L), by = (id) => layout.parts.find((p) => p.id === id);
  assert.equal(by("temp").params.size, 1.4);
  assert.deepEqual(layout.beats.find((b) => b.s === "how").do[0], { p: "shade", v: "ghost" });
  assert.deepEqual(layout.beats.find((b) => b.s === "finish").do[0], { p: "shade", v: "unghost" });
  assert.deepEqual(by("walls").params.panels.map((q) => q.size[0] === 0.35 || q.size[1]), [true, 0.08], "the upright coat thickens, the liner floor stays");
  assert.equal(L.parts[3].params.panels[0].size[0], 0.1, "the planner's own layout is not changed");
});

test("the multi-frame check is for custom only: premade keeps the one-frame prompt", () => {
  const run = fs.readFileSync(new URL("../scripts/cutaway/proto3d/m2/run.mjs", import.meta.url), "utf8"), checks = fs.readFileSync(new URL("../scripts/cutaway/proto3d/m2/checks.mjs", import.meta.url), "utf8");
  assert.match(run, /const multi = !reuse/); assert.match(checks, /system: multi \? VISION_SYSTEM : VISION_SYSTEM_ONE/);
  assert.match(checks, /const VISION_SYSTEM_ONE = `When a frame's line says/);
  assert.match(run, /if \(ok && still\.length\) await repairRound\(4, still\)/, "the second picture repair runs for whatever still fails");
});

test("round 5: a narration a little over its limit is tolerated, then trimmed for free, before any rewrite is paid for", async () => {
  const { overWords, trimNarration, wordCount, LENGTH } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  assert.equal(overWords(121, 30), false, "121 of 120 is inside the 5% tolerance"); assert.equal(overWords(127, 30), true);
  assert.deepEqual(LENGTH[30].beats, [10, 12]); assert.deepEqual(LENGTH[60].beats, [14, 18]);
  const s = { sentences: [{ role: "fix2", text: "So you add a yellow lamp that just really warns drivers then." }, { role: "how", text: "Inside, the box also reads the loop and turns green." }] };
  const t = trimNarration(s, { max: 19, cues: { how: ["also"] } });
  assert.ok(t.script.sentences.reduce((k, x) => k + wordCount(x.text), 0) <= 19);
  assert.match(t.script.sentences[0].text, /^So you add a yellow lamp/); assert.match(t.script.sentences[1].text, /\balso\b/, "a cue word is kept");
});

test("round 5: the beat plan's story bookkeeping is fixed for free; a planned layout's broken actions, roles and sounds are dropped", async () => {
  const { fixStory } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const scene = { beats: [{ s: "hook", shows: { does: "a lamp hangs" } }, { s: "problem", shows: { does: "cars pile up at the red" }, do: [{ p: "q", v: "pile", w: "pile up" }] }, { s: "fix1" }, { s: "problem2", shows: { does: "a car crashes into another" } }] };
  const st = fixStory({ chain: [{ problem: "problem", causedBy: "fix1", size: 5 }, { problem: "problem2", causedBy: "hook", size: 3 }], surprises: [{ role: "nope", claim: "x" }] }, scene);
  assert.deepEqual(st.chain.map((c) => [c.causedBy, c.size]), [["hook", 5], ["fix1", 6]]);
  assert.equal(st.ideas.find((i) => i.role === "problem2").idea, "a car crashes into another");
  assert.deepEqual(st.surprises, []); assert.equal(scene.beats[1].do[0].w, "pile");
  const { layoutRules } = await import("../scripts/cutaway/proto3d/m2/layoutRules.js");
  const { layout, notes } = layoutRules({ key: "t", roles: ["hook", "fix1"], world: { cut: { x0: -20, x1: 4, z0: -3, depth: 3 } }, audio: { sfx: [{ lib: "dirt", at: { s: "hook" } }, { lib: "nope", at: { s: "hook" } }] },
    parts: [{ id: "tank", kind: "boxPop", params: { pos: [0, 0.5, -2] } }], beats: [{ s: "hook", do: [{ p: "tank", v: "show" }, { p: "tank", v: "explode" }, { p: "ghost", v: "show" }], shots: [] }, { s: "fix9", do: [], shots: [] }] });
  assert.deepEqual(layout.beats.map((b) => [b.s, b.do.length]), [["hook", 1]]);
  assert.deepEqual(layout.audio.sfx.map((s) => s.lib), ["dirt"]); assert.equal(layout.world.cut.x0, -14);
  assert.ok(layout.parts.some((p) => p.kind === "sign"), notes.join("; "));
});

test("round 5: an anchor word that is not said fires at its sentence start instead of crashing the render", async () => {
  const { compile } = await import("../scripts/cutaway/proto3d/m2/compile.mjs");
  const words = [{ w: "If", s: 0.1, e: 0.2 }, { w: "you", s: 0.25, e: 0.35 }, { w: "dig.", s: 0.4, e: 0.6 }, { w: "But", s: 0.9, e: 1.0 }, { w: "rain.", s: 1.05, e: 1.3 }];
  const L = { key: "anchor_t", world: { cut: { x0: -4, x1: 4, z0: -3, depth: 3 } }, camera: { keys: [{ at: { abs: 0 }, pos: [0, 5, 10], tgt: [0, 0, 0] }, { at: { abs: 1 }, pos: [0, 5, 9], tgt: [0, 0, 0] }] }, audio: { ambience: false }, parts: [{ id: "tank", kind: "boxPop", params: { pos: [0, 0.5, -2] } }],
    beats: [{ s: "hook", do: [{ p: "tank", v: "show", w: "pit" }] }, { s: "problem", do: [] }] };
  const tl = compile(L, words, 1.4, { roles: ["hook", "problem"] });
  assert.ok(tl.fixes.some((f) => /"pit" is not said/.test(f))); assert.ok(tl.tracks["tank.pop"].ramps[0].t0 < 0.2);
});

test("the worker reports each cost once: 'planned' then 'done' with the same totals booked a finished video twice", () => {
  const src = fs.readFileSync(new URL("../scripts/cutaway/proto3d/m3/videoJob.mjs", import.meta.url), "utf8");
  assert.match(src, /const fresh = \(costs\) =>/); assert.match(src, /send\(event, data\.costs \? \{ \.\.\.data, costs: fresh\(data\.costs\) \} : data\)/);
  // the same arithmetic: totals sent twice are counted once, a later addition is sent as its difference
  const sent = {}, fresh = (costs) => { const out = {}; for (const [k, v] of Object.entries(costs)) { const d = +((Number(v) || 0) - (sent[k] ?? 0)).toFixed(6); if (d > 0) { out[k] = d; sent[k] = (sent[k] ?? 0) + d; } } return out; };
  const a = fresh({ planUsd: 0.44, voiceUsd: 0.05 }), b = fresh({ planUsd: 0.44, voiceUsd: 0.05, gpuUsd: 0.02 });
  assert.deepEqual(a, { planUsd: 0.44, voiceUsd: 0.05 }); assert.deepEqual(b, { gpuUsd: 0.02 });
});

test("the finish completes the thing itself: topic props in any setting, generic decor refused on a new plan's finish", async () => {
  const { TOPIC_PROPS, GENERIC_DECOR } = await import("../scripts/cutaway/proto3d/m2/catalog.js");
  const { PROP_NAMES } = await import("../scripts/cutaway/proto3d/m2/clarityParts.js");
  for (const t of ["rocks", "lilyPads", "fish", "rinkLines", "goalNets", "floodLight", "crosswalk", "stopLine", "streetSign", "stairs", "ceilingLight"]) { assert.ok(TOPIC_PROPS.includes(t), t); assert.ok(PROP_NAMES.includes(t), t); }
  const { beatPlanProblems } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  const L = (type, title = "How a Pond Works") => ({ title, parts: [{ id: "deco", kind: "prop", params: { type } }], beats: [{ s: "hook" }, { s: "finish", do: [{ p: "deco", v: "show" }] }, { s: "congrats" }] });
  assert.ok(beatPlanProblems(L("trashCan"), {}, 30).some((p) => /finish adds a trash can/.test(p)));
  assert.ok(!beatPlanProblems(L("lilyPads"), {}, 30).some((p) => /finish adds/.test(p)));
  assert.ok(!beatPlanProblems(L("bench", "How a Park Bench Works"), {}, 30).some((p) => /finish adds/.test(p)), "a topic about the thing may add it");
  assert.ok(GENERIC_DECOR.includes("pottedPlant"));
});

test("every production job carries its run's spending limit, and the worker hands it to the pipeline", async () => {
  const { jobFor, runCapFor, RUN_CAP_USD } = await import("../supabase/functions/_shared/cutaway/jobs.js");
  assert.equal(runCapFor({ kind: "custom", length_sec: 30 }), RUN_CAP_USD.custom30); assert.equal(runCapFor({ kind: "custom", length_sec: 60 }), RUN_CAP_USD.custom60); assert.equal(runCapFor({ kind: "premade", length_sec: 30 }), RUN_CAP_USD.premade);
  assert.equal(jobFor({ id: "r", kind: "custom", length_sec: 60, topic: "x" }, { role: "video", mode: "gpu", urls: { planPut: "p", final: "f" }, callback: "c" }).capUsd, 2.2);
  assert.ok(RUN_CAP_USD.custom30 < 2.72 && RUN_CAP_USD.custom60 < 3.9, "an emergency brake well under what customers pay");
  assert.match(fs.readFileSync(new URL("../scripts/cutaway/proto3d/m3/videoJob.mjs", import.meta.url), "utf8"), /maxUsd: Number\(job\.capUsd\) \|\| Infinity/);
});

test("a target never fails a run: word and beat counts guide, far over drops the least important beats for free (the production swimming pool run of 2026-10-29 failed at 132 words)", async () => {
  const { isTarget, dropBeats } = await import("../scripts/cutaway/proto3d/m2/planner.mjs");
  for (const p of ["132 words (want 95-120)", "how: 36 words", "fix1: 30 words where the beat had 12", "the hook is 19 words: keep it to 16 or fewer so the first problem lands within about 4 seconds", 'how: cue word "eight" is missing']) assert.ok(isTarget(p), p);
  for (const p of ["fix2: the number 40 is not in the verified facts", "the first problem (\"But…\") must be the second sentence, right after the hook (it is sentence 3)"]) assert.ok(!isTarget(p), p);
  const roles = ["hook", "problem", "fix1", "problem2", "fix2", "name", "how", "fact", "myth", "mythFact", "finish", "congrats", "problem3"];
  const layout = { roles, beats: roles.map((s) => ({ s, do: [] })) }, script = { sentences: roles.map((role) => ({ role, text: "word ".repeat(15).trim() + "." })), chain: [{ problem: 1, causedBy: -1 }, { problem: 12, causedBy: 4 }] };
  const words = (sc) => sc.sentences.reduce((k, s) => k + s.text.split(/\s+/).length, 0);
  const d = dropBeats({ script, layout, lengthSec: 30, over: (sc) => words(sc) > 156 });
  assert.deepEqual(d.dropped, ["myth", "mythFact", "finish"]); assert.ok(words(d.script) <= 156);
  assert.deepEqual(d.script.chain.map((c) => c.problem), [1, 9], "the chain follows its sentences");
  // over the beat cap alone (13 > 12): one pair out, never a refusal
  assert.deepEqual(dropBeats({ layout, lengthSec: 30 }).dropped, ["myth", "mythFact"]);
});

test("the cap is an emergency brake: the final steps (the voice, the first preview check, the post text) are never refused; repairs and their looks are", async () => {
  const B = await import("../scripts/cutaway/proto3d/m2/budget.mjs");
  B.setRunCap(0.7); B.add(0.69);
  for (const l of ["voice", "vision check", "vision check (re-ask)", "post text"]) assert.doesNotThrow(() => B.allow(l), l);
  for (const l of ["preview repair", "repair look", "beats repair"]) assert.throws(() => B.allow(l), /cap/, l);
  const job = fs.readFileSync(new URL("../scripts/cutaway/proto3d/m3/videoJob.mjs", import.meta.url), "utf8");
  assert.match(job, /whatever the stop, what was made is kept/); assert.match(job, /JSON\.stringify\(\{ \.\.\.script, failed: true, trace, report, vision, spend \}\)/);
});
