// In This Town (owner, 2026-11-18): an honest message when the quality checker blocks a video; "Try again" continues and
// charges only when the video is ready; the free view check (camera through someone / behind the subject). No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { failReason } from "../supabase/functions/_shared/blockyWorlds/contract.js";
import { people, reaimBody, shotViewProblems } from "../scripts/blockyWorlds/blenderKit/camFix.mjs";

test("a run the checker blocked says so honestly (never 'something broke')", () => {
  const msg = "the director wrote no cut: stopping: the Blender pipeline failed: [22:15:16] round 2: 35 shots re-previewed: 0 crashed, 0 pixel, 30 vision -> 30 still failing";
  assert.equal(failReason("DIRECTOR_FAILED", msg).kind, "quality");
  assert.match(failReason("DIRECTOR_FAILED", msg).text, /quality bar/);
  assert.equal(failReason("DIRECTOR_FAILED", "the rules block the final: 31 shot(s) still fail after 2 fix round(s)").kind, "quality");
  assert.equal(failReason("DIRECTOR_FAILED", "the model refused").kind, "ours");
});

test("camera fix: behind a head, through a crowd, heads cut at the side -> caught on the plan and re-aimed clean (the run's shots 29, 51, 73)", () => {
  const s29 = `    E = esme(t0, t1, 'worried')
    E.pose(t0, loc=(0, -6, 0), rot=facing((0, -6), (0, -12)))
    for i in range(3):
        k = chars.kid(30 + i)
        k.pose(t0, loc=(-3 + i * 3, -9.5, 0), rot=facing((-3 + i * 3, -9.5), (0, -6)))
    cam = Cam()
    cam.push(t0, t1, (0, -8, 4.4), 8.0, 6.8, yaw=180, pitch=4, lens=26)
    cam.handheld(1.0)`;
  assert.match(shotViewProblems(s29, "kids pointing at Esme").join(), /behind E's head/);
  const s51 = `    G = greer(t0, t1, 'smile')
    G.pose(t0, loc=(0, -9, 0), rot=180)
    for i in range(5):
        k = townie(40 + i, t0, t1, 'worried')
        k.pose(t0, loc=(-5 + i * 2.4, -3.5, 0), rot=facing((-5 + i * 2.4, -3.5), (0, -9)))
    cam = Cam()
    cam.push(t0, t1, (0, -7, 4.4), 11.0, 9.6, yaw=180, pitch=3, lens=26)`;
  assert.equal(people(s51).length, 6, "the loop's five townspeople are read");
  assert.match(shotViewProblems(s51, "Greer with ten people").join(), /through k/);
  const s73 = `    L = grandpa(t0, t1, 'sad')
    L.pose(t0, loc=(2, -6, 0), rot=facing((2, -6), (-2, -6)))
    E = esme(t0, t1, 'neutral')
    E.pose(t0, loc=(-2, -6, 0), rot=facing((-2, -6), (2, -6)))
    cam = Cam()
    cam.push(t0, t1, (0, -6, 4.3), 8.0, 7.0, yaw=0, pitch=2, lens=28)`;
  assert.match(shotViewProblems(s73, "Grandpa Lark admits it first").join(), /cut at the side/);
  for (const [body, desc] of [[s29, "kids pointing at Esme"], [s51, "Greer with ten people"], [s73, "Grandpa Lark admits it first"]]) {
    const r = reaimBody(body, desc);
    assert.equal(r.fixed.length, 1, r.left.join());
    assert.doesNotMatch(r.body, /cam\.push/);
    assert.equal((r.body.match(/cam\.key\(/g) ?? []).length, 2, "two exact keys (a gentle push in)");
    assert.deepEqual(shotViewProblems(r.body, desc), [], "the re-aimed shot passes the same check");
    assert.match(r.body, /cam\.handheld|cam\.key/);
  }
  // a look shot keeps an over-the-shoulder (the face partly seen), never straight behind
  const look = reaimBody(s29.replace("rot=facing((0, -6), (0, -12))", "rot=facing((0, -6), (0, -12))"), "Esme looks at the kids pointing");
  assert.equal(look.fixed.length, 1);
  // a clean shot is left alone
  const clean = s73.replace("8.0, 7.0, yaw=0", "13.0, 12.0, yaw=0");
  assert.deepEqual(shotViewProblems(clean, "two-shot"), []);
  assert.equal(reaimBody(clean, "two-shot").body, clean);
});

test("Try again: the migration creates a free retry run that is charged once, only when done", () => {
  const sql = fs.readFileSync("supabase/migrations/20261218100000_blocky_worlds_retry.sql", "utf8");
  assert.match(sql, /credits_charged, env, engine, card, library_id, studio_builds, resume_of, charge_on_done/);
  assert.match(sql, /NEW\.status = 'done' AND OLD\.status NOT IN \('done', 'failed'\) AND NEW\.charge_on_done > 0 AND NEW\.charged_on_done_at IS NULL/);
  const api = fs.readFileSync("supabase/functions/blocky-worlds-api/index.ts", "utf8");
  assert.match(api, /action === "retry"/);
  assert.match(api, /blocky_worlds_retry_run/);
  const hook = fs.readFileSync("src/components/viral-tools/blocky-worlds/hooks/useBlockyWorlds.js", "utf8");
  assert.match(hook, /worldsCall\("retry", \{ runId: failed\.id \}\)/);
});

test("render gate (calibrated on Milo): unwatchable shots are cut, weak ones kept, a mostly good video renders", async () => {
  const { renderGate, classify, heroLinesMissing } = await import("../scripts/blockyWorlds/blenderKit/renderGate.mjs");
  // Milo: 70 shots kept (ids up to 90 after the plan merges)
  const shots = Array.from({ length: 90 }, (_, i) => ({ id: i + 1 })).filter((s) => s.id % 9 !== 0 || [3, 6, 22, 32, 40, 86, 89].includes(s.id)).slice(0, 80);
  // Milo's last fix round (the checker's real words, shortened): 7 unwatchable, 7 weak -> RENDER
  const milo = {
    3: "A giant bank facade fills the frame", 6: "A townsman's torso fills the frame", 22: "The frame is mostly a wall and a head from behind", 32: "Milo is not visible, only an empty room with a sleeve edge",
    40: "The frame is a flat blue-purple wall", 86: "The frame is a flat purple wall", 89: "Only giant legs fill the frame",
    28: "A striped sleeve blocks the view", 42: "Milo's head and a striped arm in the foreground", 46: "The bank is not tilted", 48: "A big tree blocks most of the view",
    56: "A big tree blocks the view of Milo", 58: "A green arm blocks the view", 61: "The bike is not visible",
  };
  const failing = Object.fromEntries(Object.entries(milo).map(([id, t]) => [id, { kind: "vision", text: `the checker saw: ${t}` }]));
  const g = renderGate({ shots, failing });
  assert.equal(g.ok, true, g.reason);
  assert.deepEqual(g.cut.sort((a, b) => a - b), [3, 6, 22, 32, 40, 86, 89]);
  assert.equal(g.weak.length, 7);
  // the free rule notes the checker did not confirm never count (the Sock run: 29 of its 73)
  assert.equal(classify({ kind: "shotcheck", text: "THE SHOT CHECK: no character in 2 or more of 6 shots" }), "ignore");
  // a truly broken video still stops: too many unwatchable, or too few passing
  const broken = Object.fromEntries(shots.slice(0, 15).map((s) => [s.id, { kind: "vision", text: "the frame is black" }]));
  assert.equal(renderGate({ shots, failing: broken }).ok, false);
  const weakMany = Object.fromEntries(shots.slice(0, 20).map((s) => [s.id, { kind: "vision", text: "the framing is loose" }]));
  assert.equal(renderGate({ shots, failing: weakMany }).ok, false);
  // a line that names the hero must show the hero (as seen by the checker)
  const mentions = (t, h) => String(t).toLowerCase().includes(String(h).toLowerCase());
  assert.equal(heroLinesMissing({ lines: [{ line: 3, text: "Milo laughed", shots: [5, 6] }], seen: { 5: ["Grandpa"], 6: ["crowd"] }, hero: "Milo", mentions }).length, 1);
  assert.equal(heroLinesMissing({ lines: [{ line: 3, text: "Milo laughed", shots: [5, 6] }], seen: { 5: ["Milo"], 6: [] }, hero: "Milo", mentions }).length, 0);
});

test("Try again parts: the music beds and raw takes never go in the bundle (the Sock run's was ~110 MB and was dropped)", async () => {
  const { SKIP_FILE } = await import("../scripts/blockyWorlds/studioWorker/resume.mjs");
  for (const f of ["music.wav", "music.raw.wav", "blender/video/audio/music_bed.wav", "blender/video/audio/music_bed.raw.wav", "voice/voice.orig.wav"]) assert.ok(SKIP_FILE.test(f), f);
  for (const f of ["voice/voice.wav", "blender/video/audio/voice.wav", "blender/state.json", "voice-result.json"]) assert.ok(!SKIP_FILE.test(f), f);
});
