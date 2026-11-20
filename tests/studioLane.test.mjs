// node --test tests/studioLane.test.mjs   (free, local: the Studio worker's studio lane with a fake child job)
// A connector finish runs in its own low-priority process: the video loop keeps running while it works (here: a timer
// that must keep ticking while the child blocks its own CPU), the result comes back, a stop kills it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LANE_NICE, startLane } from "../scripts/blockyWorlds/studioWorker/studioLane.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zyvo-lane-"));
const fake = path.join(dir, "fakeLane.mjs");
// the fake child: blocks its own event loop for `ms` (like spawnSync ffmpeg), reports its priority, then a result
fs.writeFileSync(fake, `
import fs from "node:fs"; import os from "node:os";
const job = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
console.log("working on " + job.id + " for " + process.argv[3]);
const until = Date.now() + job.ms; while (Date.now() < until) {}
if (job.crash) process.exit(3);
console.log("ZYVO_LANE_RESULT " + JSON.stringify({ ok: true, usd: 0.05, priority: os.getPriority() }));
`);

test("the lane: a blocking finish runs beside the loop at low priority and reports back", async () => {
  const logs = [];
  const lane = startLane({ id: "job-1", ms: 900 }, { workerId: "w-1", workDir: dir, log: (m) => logs.push(m), entry: fake });
  let ticks = 0;
  const t = setInterval(() => { ticks++; }, 50);
  const r = await lane.promise;
  clearInterval(t);
  assert.equal(r.ok, true);
  assert.equal(r.usd, 0.05);
  assert.ok(ticks >= 10, `the parent loop kept running (${ticks} ticks during a 0.9 s blocking job)`);
  assert.equal(r.priority, LANE_NICE, "the child runs at the lowest priority");
  assert.ok(logs.some((l) => l.includes("working on job-1 for w-1")), "the parent's worker id reaches the child");
  assert.equal(fs.existsSync(path.join(dir, "lane-job-1.json")), false, "the job file is cleaned up");
});

test("the lane: a crash and a stop both come back as a failure (the worker refunds them)", async () => {
  const crashed = await startLane({ id: "job-2", ms: 10, crash: true }, { workerId: "w", workDir: dir, entry: fake }).promise;
  assert.deepEqual([crashed.ok, crashed.code], [false, "LANE_CRASH"]);
  const lane = startLane({ id: "job-3", ms: 5000 }, { workerId: "w", workDir: dir, entry: fake });
  setTimeout(() => lane.kill(), 150);
  const killed = await lane.promise;
  assert.deepEqual([killed.ok, killed.code], [false, "KILLED"]);
});
