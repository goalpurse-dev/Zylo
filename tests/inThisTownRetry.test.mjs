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
