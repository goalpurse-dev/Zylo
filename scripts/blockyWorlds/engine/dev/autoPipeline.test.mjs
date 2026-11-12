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
