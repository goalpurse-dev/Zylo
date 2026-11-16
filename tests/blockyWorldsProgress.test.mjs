// LIVE PROGRESS for the Blender engine (owner 2026-11-15: the page sat at 12% for 20+ minutes): the tracker that maps the
// pipeline's lines to the run row, the page's creeping bar, the credit balance at "Write my script", the phone padding.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANDS, makeProgress } from "../scripts/blockyWorlds/blenderKit/progress.mjs";
import { creepPct, elapsedText, progressView, STALE_SEC, STUDIO_STAGES } from "../supabase/functions/_shared/blockyWorlds/studioStages.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the tracker follows a real run's lines: stages in order, the percent only goes up, the detail says what is happening", () => {
  let t = 0;
  const P = makeProgress({ now: () => t });
  const seen = [];
  const at = (sec, ...lines) => { t = sec * 1000; for (const l of lines) P.feed(`[21:10:00] ${l}`); const s = P.snapshot(); seen.push(s); return s; };
  assert.equal(at(1, 'script "Milo": 31 lines, 380 words, voice 96.3 s (words match the lines); spent $0.15').detail, "Planning every shot");
  assert.match(at(100, "plan: 200 end_turn in 95 s, $0.3", "plan: 76 shots in 4 locations (a, b) (0 too short, merged), 2 new builds (x), header 900 chars").detail, /^Directing shot 1 of 76$/);
  assert.equal(at(140, "batch 1-8: 8 of 8 bodies").detail, "Directing shot 9 of 76");
  assert.equal(at(400, "batch 73-76: 4 of 4 bodies", "static check: ok, 76 shots").detail, "Checking the code of 76 shots");
  let s = at(410, "preview r0.0 (26 shots): job abc sent (worst case $0.1)", "preview r0.1 (25 shots): job abd sent", "preview r0.2 (25 shots): job abe sent");
  assert.equal(s.stage, "previews"); assert.match(s.detail, /Test-shooting 76 shots \(0 of 3 batches done\)/);
  s = at(500, "preview r0.0 (26 shots): running on w1 after 60 s", "preview r0.0 (26 shots): done (COMPLETED, 230 s)");
  assert.match(s.detail, /1 of 3 batches done/);
  s = at(700, "preview r0.1 (25 shots): done (COMPLETED, 220 s)", "preview r0.2 (25 shots): done (COMPLETED, 240 s)");
  assert.equal(s.stage, "checking");
  s = at(760, "round 0: 76 shots previewed: 2 crashed, 1 pixel, 9 vision -> 12 failing");
  assert.equal(s.stage, "fixing"); assert.equal(s.detail, "Fixing 12 weak shots");
  s = at(900, "fix_round_1_1: 200 end_turn in 80 s", "preview r1.0 (12 shots): job x sent", "preview r1.0 (12 shots): running on w2 after 5 s");
  assert.equal(s.detail, "Re-shooting 12 fixed shots");
  at(1100, "preview r1.0 (12 shots): done (COMPLETED, 150 s)", "round 1: 12 shots re-previewed: 0 crashed, 0 pixel, 2 vision -> 2 failing");
  s = at(1150, "music: engine bed A x1.25, kit --music-db -20", "final: 76 shots, 2896 frames in 6 chunks (12:480 13:500); worst case $1.2; spent $2");
  assert.equal(s.stage, "rendering");
  s = at(1160, ...[0, 1, 2, 3, 4, 5].flatMap((i) => [`chunk ${i} (shots ${i * 12 + 1}-${i * 12 + 12}, 482 frames): job c${i} sent (worst)`, `chunk ${i} (shots ${i * 12 + 1}-${i * 12 + 12}, 482 frames): running on w after 30 s`]));
  const r1 = at(1160 + 190).detail, r2 = at(1160 + 380).detail;
  assert.match(r1, /^Rendering frame [\d,]+ of 2,896$/);
  const n = (x) => Number(x.match(/frame ([\d,]+)/)[1].replace(/,/g, ""));
  assert.ok(n(r2) > n(r1) && n(r1) > 900, `${r1} -> ${r2}`);
  s = at(1700, ...[0, 1, 2, 3, 4, 5].map((i) => `chunk ${i}: 482 frames in 455 s`), "finish: job f sent (worst)", "finish: running on w after 20 s");
  assert.equal(s.stage, "finishing"); assert.equal(s.detail, "Adding sound and captions");
  assert.equal(at(2200, "final: /tmp/run/blender/final.mp4 (96.3 s; cues 59); render wall 500 s").detail, "Uploading your video");
  // never backwards, never past 99, stages only forward
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i].pct >= seen[i - 1].pct, `${seen[i - 1].pct} -> ${seen[i].pct}`);
  const order = Object.keys(BANDS);
  for (let i = 1; i < seen.length; i++) assert.ok(order.indexOf(seen[i].stage) >= order.indexOf(seen[i - 1].stage));
  assert.ok(seen.at(-1).pct <= 99 && seen.at(-1).pct >= 92);
  // the weights: the director ~1/3, the test shots + fixes ~1/5, the final render ~1/3, the finish the rest
  assert.equal(BANDS.directing[1] - BANDS.directing[0], 32);
  assert.equal(BANDS.rendering[1] - BANDS.rendering[0], 30);
  assert.equal(BANDS.fixing[1] - BANDS.previews[0], 20);
  // every stage is a page stage
  for (const k of order) assert.ok(STUDIO_STAGES.some((x) => x.stage === k), k);
});

test("the page's bar: creeps between updates, never past the ceiling, never back; the stale note; elapsed text", () => {
  const a = creepPct({ pct: 40, ceil: 52, sinceSec: 2 }), b = creepPct({ pct: 40, ceil: 52, sinceSec: 60 }), c = creepPct({ pct: 40, ceil: 52, sinceSec: 99999 });
  assert.ok(a >= 40.1 - 1e-9, `moves in 2 s: ${a}`);
  assert.ok(b > a && c <= 51.7 && c > b);
  assert.equal(creepPct({ pct: 40, ceil: 52, sinceSec: 2, shown: 45 }), 45, "never back");
  assert.ok(STALE_SEC >= 180 && STALE_SEC <= 300);
  assert.equal(elapsedText(245), "4 min 05 s");
  assert.equal(progressView({ stage: "rendering", pct: 140, ceil: 10, detail: "<b>x</b>", at: "2026-11-15T21:00:00Z" }).pct, 99.5);
  assert.equal(progressView({ stage: "nope", pct: 1 }), null);
  assert.equal(progressView({ stage: "rendering", pct: 70, ceil: 92, detail: "<b>x</b>" }).detail, "bx/b");
});

test("the worker writes the progress to the run row; the API and the page read it", () => {
  const steps = read("scripts/blockyWorlds/blenderKit/workerSteps.mjs"), runner = read("scripts/blockyWorlds/studioWorker/runner.mjs");
  assert.match(steps, /tracker\.feed\(l\)/);
  assert.match(steps, /setInterval\(tick, progressEveryMs\)/);
  assert.match(runner, /onProgress: progress/);
  assert.match(runner, /render: \{ progress: \{ stage: p\.stage, pct: p\.pct, ceil: p\.ceil, detail:/);
  assert.match(runner, /if \(st\.progressed && ORDER\.indexOf\(stage\) < ORDER\.indexOf\(st\.stage\)\) return st\.writing;/);
  assert.match(read("scripts/blockyWorlds/blenderKit/rp.mjs"), /log\(`\$\{label\}: done \(\$\{s\.status\}/);
  assert.match(read("supabase/functions/blocky-worlds-api/index.ts"), /progress: progressView\(r\.render\.progress\)/);
  const ui = read("src/components/viral-tools/blocky-worlds/BlenderMaker.jsx");
  assert.match(ui, /creepPct\(\{ pct: base, ceil, sinceSec, shown: shown\.current \}\)/);
  assert.match(ui, /Taking longer than usual: still working/);
  assert.match(ui, /elapsed<\/span>/);
  assert.match(ui, /still working…/);
});

test("credits: the header balance drops at Write my script (and comes back on a failure or a refunded video); phones get room for the nav", () => {
  const ui = read("src/components/viral-tools/blocky-worlds/BlenderMaker.jsx");
  assert.match(ui, /if \(charged\) emitCreditSpend\(flat\.credits, "In This Town video"\);\n\s+const r = await guarded/);
  assert.match(ui, /if \(charged && !r\?\.ok\) emitCreditRefund\(flat\.credits/);
  assert.match(ui, /emitCreditRefund\(run\.credits, "In This Town: refunded"\)/);
  assert.match(ui, /pb-\[calc\(96px\+env\(safe-area-inset-bottom\)\)\]/);
});
