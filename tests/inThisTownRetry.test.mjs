// In This Town (owner, 2026-11-18): an honest message when the quality checker blocks a video; "Try again" continues and
// charges only when the video is ready; the free view check (camera through someone / behind the subject). No network.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { failReason } from "../supabase/functions/_shared/blockyWorlds/contract.js";
import { viewProblems, standing } from "../scripts/blockyWorlds/blenderKit/camClear.mjs";

test("a run the checker blocked says so honestly (never 'something broke')", () => {
  const msg = "the director wrote no cut: stopping: the Blender pipeline failed: [22:15:16] round 2: 35 shots re-previewed: 0 crashed, 0 pixel, 30 vision -> 30 still failing";
  assert.equal(failReason("DIRECTOR_FAILED", msg).kind, "quality");
  assert.match(failReason("DIRECTOR_FAILED", msg).text, /quality bar/);
  assert.equal(failReason("DIRECTOR_FAILED", "the rules block the final: 31 shot(s) still fail after 2 fix round(s)").kind, "quality");
  assert.equal(failReason("DIRECTOR_FAILED", "the model refused").kind, "ours");
});

test("view check: the camera behind the subject, and a crowd between the camera and the subject (the run's shots 29 and 51)", () => {
  const s29 = `    E = esme(t0, t1, 'worried')
    E.pose(t0, loc=(0, -6, 0), rot=facing((0, -6), (0, -12)))
    for i in range(3):
        k = chars.kid(30 + i)
        k.pose(t0, loc=(-3 + i * 3, -9.5, 0), rot=facing((-3 + i * 3, -9.5), (0, -6)))
    cam = Cam()
    cam.push(t0, t1, (0, -8, 4.4), 8.0, 6.8, yaw=180, pitch=4, lens=26)`;
  assert.match(viewProblems(s29, "kids pointing at Esme").join(), /BEHIND E/);
  const s51 = `    G = greer(t0, t1, 'smile')
    G.pose(t0, loc=(0, -9, 0), rot=180)
    for i in range(5):
        k = townie(40 + i, t0, t1, 'worried')
        k.pose(t0, loc=(-5 + i * 2.4, -3.5, 0), rot=facing((-5 + i * 2.4, -3.5), (0, -9)))
    cam = Cam()
    cam.push(t0, t1, (0, -7, 4.4), 11.0, 9.6, yaw=180, pitch=3, lens=26)`;
  assert.equal(standing(s51).length, 6, "the loop's five townspeople are read");
  assert.match(viewProblems(s51, "Greer with ten people").join(), /THROUGH k/);
  // from the other side (yaw 0: the camera on the -y side) nobody is in the way, but Greer (rot 180, facing +y) shows her back
  const other = viewProblems(s51.replace("yaw=180", "yaw=0"), "Greer with ten people");
  assert.ok(!other.some((p) => /THROUGH/.test(p)) && other.some((p) => /BEHIND G/.test(p)));
  // an over-the-shoulder shot asked for in the desc is not flagged for the back of a head
  assert.ok(!viewProblems(s29, "over the shoulder of Esme").some((p) => /BEHIND/.test(p)));
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
