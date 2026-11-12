// the launch's automatic pieces, free: the shot prompts of every scene in parallel (one warm cache call first), the
// still gate's board re-plan ladder (faces to the lens, safer board cameras), the progress stages, the refund codes
import test from "node:test";
import assert from "node:assert/strict";
import { writePromptsByScene } from "../lib/shotPrompts.js";
import { alternatives } from "../lib/vision/gatePass.js";
import { STAGES, NO_RETRY } from "../../../../supabase/functions/_shared/blockyWorlds/render.js";
import { failReason } from "../../../../supabase/functions/_shared/blockyWorlds/contract.js";

const shot = (i, scene, board) => ({ start: i, end: i + 1, line: i, lines: [i], scene, text: "w", light: "night", camera: "medium", ...(board ? { board } : {}) });
const tl = { title: "t", cast: {}, lines: [0, 1, 2].map(() => ({ text: "w" })), captions: [], scenes: [{ id: "a", from: 0, to: 1, location: "street", time: "night" }, { id: "b", from: 2, to: 2, location: "street", time: "night" }],
  shots: [shot(0, "a"), shot(1, "a"), shot(2, "b")] };
const board = { bible: { homes: {}, houses: {}, events: [], rule: {} }, lines: [] };

test("shot prompts: a warm call, then every scene at once", async () => {
  const calls = []; let inFlight = 0, most = 0;
  const fetchFn = async (url, init) => {
    const b = JSON.parse(init.body); calls.push(b); inFlight++; most = Math.max(most, inFlight);
    await new Promise((r) => setTimeout(r, 20)); inFlight--;
    const ids = b.max_tokens === 1 ? [] : b.messages[0].content.at(-1).text.match(/shot ids ([\d, ]+) only/)[1].split(",").map(Number);
    return { ok: true, json: async () => ({ model: "claude-sonnet-5-5", usage: { input_tokens: 5, output_tokens: 5 }, stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(ids.map((id) => ({ id, image: "x", video: [] }))) }] }) };
  };
  const r = await writePromptsByScene({ apiKey: "x", tl, board, fetchFn });
  assert.equal(calls[0].max_tokens, 1); assert.equal(calls.length, 3); assert.equal(most, 2); assert.equal(r.data.length, 3);
});

test("shot prompts: the worst case over the cap sends nothing", async () => {
  let n = 0; await assert.rejects(writePromptsByScene({ apiKey: "x", tl, board, capUsd: 0.001, fetchFn: async () => { n++; } }), (e) => e.code === "PROMPTS_CAP"); assert.equal(n, 0);
});

test("still gate re-plan of a storyboard shot: faces to the lens, then the safer board cameras", () => {
  const s = shot(0, "a", { loc: "house:hollis", cam: "window:hollis:0", people: [{ id: "hollis", where: "window:hollis:0" }], acts: [] });
  const alt = alternatives(s);
  assert.equal(alt[0].how, "faces"); assert.ok(alt[0].patch.board.people[0].faceLens);
  assert.deepEqual(alt.slice(1).map((a) => a.patch.board.cam), ["front:hollis", "house:hollis", "street_wide"]);
});

test("progress stages + the storyboard failures refund as story failures", () => {
  assert.deepEqual(STAGES.map((x) => x.stage), ["queued", "voice", "storyboard", "plan", "prompts", "checks", "stills", "mix", "render", "finish"]);
  for (const c of ["STORYBOARD_FAILED", "STORYBOARD_CHECKS", "KIT_UNSUPPORTED"]) { assert.ok(NO_RETRY.has(c)); assert.equal(failReason(c).kind, "story"); }
});

test("the kit manifest (boardKit.js) lists exactly the engine's animated actions, and its animals exist in the animal kit", async () => {
  const { BOARD_KIT } = await import("../../../../supabase/functions/_shared/blockyWorlds/boardKit.js");
  const { BOARD_ACTIONS } = await import("../lib/boardActions.js");
  assert.deepEqual([...BOARD_KIT.actions].sort(), Object.keys(BOARD_ACTIONS).sort());
  const { resolveAnimal } = await import("../page/kit/animals/species.js");
  for (const a of BOARD_KIT.animals) assert.ok(resolveAnimal(a), a);
});

test("a storyboard line in the park with a crowd cheering, a dog and rain passes validation", async () => {
  const { validateStoryboard } = await import("../lib/storyboardDirector.js");
  const board = { bible: { homes: { me: 0 } }, lines: [{ line: 0, place: "place:park", shots: [{ loc: "place:park", light: "day", cam: "place_wide", weather: "rain", people: [{ id: "me", where: "place:center", pose: "cheer" }], animals: [{ species: "dog", where: "place:left", action: "run" }], acts: [{ k: "cheer" }, { k: "rain:falls" }, { k: "animal:move" }] }] }] };
  assert.deepEqual(validateStoryboard(board, { lines: ["We cheered in the rain as the dog ran."], cast: { me: {} } }), []);
});

test("monster variants + the creature check: the script's words pick the drawn variant; unshowable words fail", async () => {
  const { creatureCheck } = await import("../lib/storyboard.js");
  assert.equal(creatureCheck([{ text: "Its giant grin flickered in the dark." }], "peeker").variant, "grin");
  assert.equal(creatureCheck([{ text: "Its eye pressed the glass." }], null).variant, "peeker");
  assert.equal(creatureCheck([{ text: "Something waited." }], null).variant, "shadow");
  assert.ok(creatureCheck([{ text: "Its tentacles curled round the house." }], "peeker").problems.length);
  const { BOARD_KIT } = await import("../../../../supabase/functions/_shared/blockyWorlds/boardKit.js");
  assert.deepEqual(BOARD_KIT.creatures.map((c) => c.id), ["peeker", "shadow", "grin", "hat", "many_eyes"]);
});

test("the voice-failure metric and its switch", async () => {
  const { voiceFailureStats, productionSettings, prepareProduction } = await import("../../../../supabase/functions/_shared/blockyWorlds/render.js");
  const runs = [...Array(18).fill({ status: "done", voice_ready: true }), { status: "failed", voice_ready: true, error_code: "STILL_GATE" }, { status: "failed", voice_ready: false, error_code: "NO_GPU" }];
  const s = voiceFailureStats(runs); assert.equal(s.failedAfterVoice, 1); assert.equal(s.pct, 5); assert.deepEqual(s.byCode, { STILL_GATE: 1 });
  const env = { BLOCKY_WORLDS_STORYBOARD: "auto", BLOCKY_WORLDS_VOICE_AFTER_STORYBOARD: "on" };
  assert.equal(prepareProduction(productionSettings((k) => env[k])).storyboard.voiceAfter, true);
  assert.equal(prepareProduction(productionSettings((k) => ({ BLOCKY_WORLDS_STORYBOARD: "auto" })[k])).storyboard.voiceAfter, undefined);
});

test("the props kit: the manifest's props are exactly the engine's, the early kit check passes kit stories and stops the rest", async () => {
  const { BOARD_KIT } = await import("../../../../supabase/functions/_shared/blockyWorlds/boardKit.js");
  const { PROPS } = await import("../page/simple/boardProps.js").catch(() => ({ PROPS: null }));
  if (PROPS) assert.deepEqual(BOARD_KIT.props.map((p) => p.id).sort(), Object.keys(PROPS).sort());
  const { kitCheck, kitHas } = await import("../../../../supabase/functions/_shared/blockyWorlds/kitCheck.js");
  assert.equal(kitHas("saucer of milk"), "saucer"); assert.equal(kitHas("plastic kazoo"), "kazoo"); assert.equal(kitHas("a dragon"), null);
  assert.equal(kitCheck(["Nobody whistles after sunset.", "We leave a saucer of milk.", "Mr. Plunk blew his kazoo."]).ok, true);
  const bad = kitCheck(["In our town a dragon lives on the hill.", "Nobody goes near the dragon.", "One day I did."]);
  assert.equal(bad.ok, false); assert.equal(bad.missing[0].word, "dragon");
});

test("render chunks never outnumber the endpoint's workers", async () => {
  const { chunkPlan, RENDER } = await import("../../../../supabase/functions/_shared/blockyWorlds/render.js");
  const tl = { fps: 24, duration: 93.4, width: 1080, height: 1920, shots: [{ start: 0, end: 93.4 }] };
  const plan = chunkPlan(tl); assert.ok(Array.isArray(plan) && plan.length > 1 && plan.length <= RENDER.workers, `${plan.length} chunks`);
});
