// The production failure audit of 2026-10-28: one free test per failure (or failure class) seen in production or in a
// paid test, each one that would have caught it before money was spent. The whole-pipeline cases run in the free
// harness (m3/harness.mjs); these are the fast ones.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schemaProblems } from "../scripts/cutaway/proto3d/m2/providers.mjs";
import { KIT_SCHEMA } from "../supabase/functions/_shared/cutaway/kitCheck.js";
import { SCRIPT_SCHEMA, FACTS_SCHEMA, SCENE_REPLY_SCHEMA, layoutFromScene } from "../scripts/cutaway/proto3d/m2/plan.js";
import { exampleFor, approvedScript, anchorWords, sentenceProblems, oneSentence, beatPlanProblems } from "../scripts/cutaway/proto3d/m2/planner.mjs";
import { chainProblems } from "../scripts/cutaway/proto3d/m2/chain.js";
import { compareWords } from "../scripts/cutaway/proto3d/m2/voiceCheck.mjs";
import { onEvent } from "../supabase/functions/_shared/cutaway/orchestrate.js";
import { decide, DEFAULT_SETTINGS } from "../supabase/functions/_shared/cutaway/guard.js";

const here = path.dirname(fileURLToPath(import.meta.url)), P3 = path.join(here, "../scripts/cutaway/proto3d");
const read = (f) => fs.readFileSync(path.join(P3, f), "utf8");

test("audit: the kit check's schema (2026-10-25, a 400 on every start) and every exported schema pass the API's rules", () => {
  assert.deepEqual(schemaProblems({ type: "object", additionalProperties: false, required: ["a"], properties: { a: { type: "array", maxItems: 3, items: { type: "string" } } } }).length, 1, "the old kit check schema is caught");
  for (const [name, s] of Object.entries({ KIT_SCHEMA, SCRIPT_SCHEMA, FACTS_SCHEMA, SCENE_REPLY_SCHEMA })) assert.deepEqual(schemaProblems(s), [], name);
  // the schemas kept inside the modules: no size limits in their source
  for (const f of ["m2/planner.mjs", "m2/checks.mjs", "m3/videoJob.mjs"]) assert.doesNotMatch(read(f), /"?(maxItems|maxLength|minLength)"?\s*:/, f);
});

test("audit: the worker image carries every file the planner reads (2026-10-24 import crash; 2026-10-27 custom street, car wash and machine topics would have crashed)", () => {
  const ctx = read("m3/buildContext.mjs");
  assert.match(ctx, /\.template\.json/); assert.match(ctx, /approved_scripts\.json/);
  for (const t of ["traffic light", "car wash bay", "vending machine", "water well", "ATM", "French drain", "landfill gas", "rain barrel"]) assert.ok(fs.existsSync(path.join(P3, "m2/layouts", `${exampleFor(t)}.template.json`)), t);
  for (const k of ["landfill", "french_drain", "car_wash"]) assert.ok(approvedScript(k)?.sentences?.length, k);
});

test("audit: the worker never uses this laptop's Chrome on the server (2026-10-25 first production test)", () => {
  assert.match(read("m3/Dockerfile.gpu"), /CHROME_PATH=\/usr\/bin\/google-chrome/);
  for (const f of ["m2/stills.mjs", "render.mjs"]) assert.match(read(f), /process\.env\.CHROME_PATH \?\?/, f);
});

test("audit: the voice check's false alarms (Landfill x2, Pond, garage door) pass; the Flash garble still fails", () => {
  assert.equal(compareWords("so water can not seep out", "so water cannot seep out").ok, true);
  assert.equal(compareWords("about 490 US landfills feed it", "about 490 U. S. landfills feed it").ok, true);
  assert.equal(compareWords("holds about 1,500 gallons", "holds about 1 500 gallons").ok, true);
  assert.equal(compareWords("for about 10,000 cycles", "for about 10 ,000 cycles").ok, true);
  assert.equal(compareWords("Add a pay kiosk, a vacuum station, and a canopy.", "Add a pakiosk, a vacuum station, and a canopy.").ok, true, "two words run together");
  assert.equal(compareWords("Sand sinks, oil rises, and clean water goes to a pump.", "Sand sinks, oil rises, and in mind, clean water goes to a pump.").ok, false);
});

test("audit: a voice failure's Details say Voice, not Scene plan (2026-10-27)", () => {
  const r = onEvent({ id: "r", status: "scene", stage: "scene", attempt: 1 }, { event: "failed", code: "VOICE_FAILED", retryable: false, stage: "voice" });
  assert.equal(r.patch.stage, "voice");
  assert.match(read("m3/videoJob.mjs"), /queue = queue\.then/, "callback events are sent in order");
});

test("audit: no per-user money cap (2026-10-25 the owner's own custom start was blocked); the emergency cap stays", () => {
  assert.equal(decide(DEFAULT_SETTINGS, { spent_24h: 0, user_running: 0, user_starts_1h: 0 }, 5).ok, true);
  assert.equal(decide(DEFAULT_SETTINGS, { spent_24h: 19.9, user_running: 0, user_starts_1h: 0 }, 1).reason, "the emergency cap");
});

test("audit: the story chain check's false refusals (car's vs car, 'runs straight into') pass", () => {
  const S = (texts) => ({ sentences: texts.map((text, i) => ({ role: ["hook", "problem", "fix1", "problem2", "fix2", "name"][i], text })), chain: [] });
  const p = chainProblems(S(["If you hang a lamp, you have a light.", "But the soapy water runs straight into the creek.", "So you add a wire loop that feels a car's metal.", "But now the car waits.", "So you add a box.", "This is a signal."]), { strict: false });
  assert.ok(!p.some((x) => /not something you can see/.test(x) && /soapy/.test(x)), p.join("; "));
});

test("audit: the premade writer may only say what the approved beat shows (Landfill 2026-10-27 GATE_FAILED): cue words kept, numbers kept, else the approved sentence", () => {
  const T = JSON.parse(read("m2/layouts/landfill.template.json")), cues = anchorWords(T);
  const ok = oneSentence("A 1952 newspaper dug out decades later was still readable.");
  assert.deepEqual(sentenceProblems(ok, { cues: cues.factProof, allowed: ["1952"], must: ["1952"] }), []);
  assert.ok(sentenceProblems("A newspaper dug out decades later was still readable.", { cues: cues.factProof, allowed: ["1952"], must: ["1952"] }).some((p) => /1952 is missing/.test(p)));
  assert.ok(sentenceProblems("But now the plastic traps gas, and the pile bulges and cracks.", { cues: cues.problem2 }).some((p) => /cue word "(pipe|carries)"/.test(p)), "the 2026-10-27 problem2 is caught: no pipe carries it");
});

test("audit: a custom beat plan that promises what the street cannot show is refused before any words (traffic light, 2026-10-25/26)", () => {
  const L = { beats: ["hook", "problem", "fix1", "problem2", "fix2", "name", "finish", "congrats", "how", "fact"].map((s) => ({ s, do: [] })) };
  const story = { ideas: L.beats.map((b) => ({ role: b.s, idea: b.s === "problem" ? "cars pile up down both roads" : "something visible happens" })), chain: [{ problem: "problem", causedBy: "hook", shows: "cars queue at the red", size: 2 }, { problem: "problem2", causedBy: "fix1", shows: "a car waits at the red", size: 3 }], surprises: [] };
  assert.ok(beatPlanProblems(L, story, 30).some((p) => /ONE road/.test(p)));
});

test("audit: the planner's slips the kit can fix for free: a prop named in words, an area in the documented array form", () => {
  const scene = { world: { cut: [-2, 2, -3, 2], house: false }, parts: [{ id: "plant", kind: "prop", params: { type: "potted plant", pos: [1, 0, -2] } }], beats: [{ s: "hook", do: [] }], audio: { cards: [], sfx: [], chimes: [], rain: [] } };
  assert.equal(layoutFromScene(scene, { key: "t", title: "t", roles: ["hook"] }).layout.parts.find((p) => p.id === "plant").params.type, "pottedPlant");
  assert.match(read("m2/solver.js"), /Array\.isArray\(P\.area\)/);
});

test("audit: the end card is checked from the camera the video ends on (a tree hid half the Landfill's sign, 2026-10-28)", async () => {
  const { placeSign } = await import("../scripts/cutaway/proto3d/m2/framing.js");
  const { projectBox } = await import("../scripts/cutaway/proto3d/m2/director.js");
  const T = JSON.parse(read("m2/layouts/landfill.template.json"));
  const L = { ...T, parts: T.parts.map((p) => (p.kind === "sign" ? { ...p, params: { ...p.params, at: [13.655, 0.25, -8.2], scale: 1.5 } } : p)) };
  const ps = placeSign(L, { pos: [33.4, 20.6, 96.9], tgt: [2.4, 0, -6.1] }, projectBox);
  assert.equal(ps.moved, true, "the hidden spot is left");
  assert.match(read("m2/make.mjs"), /cameraAt\(tl\.camera\.end, tl\.marks\.signPop/, "the render checks the real end view");
});

test("audit: a fix beat that opens with \"But now\" is still a fix (storm drain narration, free harness 2026-10-28)", () => {
  const S = { sentences: [["hook", "If you pave a street, you have a road."], ["problem", "But rain floods the street."], ["fix1", "So you add a drain."], ["fix2", "But now leaves fall on it, so you add a grate."], ["problem2", "But now the grate clogs and the street floods."], ["name", "This is a storm drain."]].map(([role, text]) => ({ role, text })), chain: [{ problem: 1, causedBy: -1, shows: "water floods the street", stakes: "the street", size: 2 }, { problem: 4, causedBy: 3, shows: "the grate clogs and water rises", stakes: "the street", size: 4 }] };
  assert.ok(!chainProblems(S, { strict: false }).some((p) => /no entry for problem sentence 3/.test(p)));
});

test("audit: a beat that shows a thing and takes it away is judged while it is there (toilet myth, free harness 2026-10-28)", async () => {
  const { previewTimes } = await import("../scripts/cutaway/proto3d/m2/checks.mjs");
  const tl = { sentences: [{ role: "myth", t0: 10, t1: 12.5, text: "And pushing is not what empties it." }, { role: "mythFact", t0: 12.8, t1: 15, text: "It is a siphon." }], marks: { lengthEnd: 16 }, director: { frames: [] },
    tracks: { "pushArrows.on": { base: 0, ramps: [{ t0: 10.4, t1: 10.7, amp: 1, s: "myth" }, { t0: 11.6, t1: 11.9, amp: -1, s: "myth" }] } } };
  const L = { beats: [{ s: "myth", shows: { p: "pushArrows", does: "arrows push down" }, do: [{ p: "pushArrows", v: "show", w: "pushing" }, { p: "pushArrows", v: "hide", w: "not" }] }], parts: [{ id: "pushArrows", kind: "arrows", params: {} }] };
  const t = previewTimes(tl, L).find((p) => p.role === "myth").t;
  assert.ok(t >= 10.7 && t < 11.6, `judged at ${t}, while the arrows are on`);
});
