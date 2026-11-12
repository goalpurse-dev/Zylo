// Blocky Worlds board-only launch mode, step 5: the page. The progress screen uses the server's STAGES (render.js), the
// result screen has one Copy per upload field, "What we can film" comes from the kit list, "Move it to our town" shows for a
// whole-premise miss. Free: pure functions + source checks (no browser, no network).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STAGES, stageOf } from "../supabase/functions/_shared/blockyWorlds/render.js";
import { PREMISE_PREFIX } from "../supabase/functions/_shared/blockyWorlds/boardFit.js";
import { problemSpots } from "../supabase/functions/_shared/blockyWorlds/protocol.js";

const src = (p) => readFileSync(new URL(`../src/components/viral-tools/blocky-worlds/${p}`, import.meta.url), "utf8");

test("stageOf: every stage the prepare job reports comes back from the run row's status + % (what reconcile stores)", () => {
  assert.deepEqual(STAGES.map((s) => s.stage), ["queued", "voice", "storyboard", "plan", "prompts", "checks", "stills", "mix", "render", "finish"]);
  assert.equal(stageOf("queued", 0), "queued");
  assert.equal(stageOf("voice", 3), "voice");
  for (const s of ["storyboard", "plan", "prompts", "checks", "stills", "mix"]) assert.equal(stageOf("plan", s === "storyboard" ? 5 : STAGES.find((x) => x.stage === s).pct), s, s);
  assert.equal(stageOf("plan", 12), "checks", "reconcile's default plan % (12) sits on the checks");
  assert.equal(stageOf("plan", 0), "storyboard");
  assert.equal(stageOf("render", 15), "render");
  assert.equal(stageOf("render", 60), "render");
  assert.equal(stageOf("render", 97), "finish");
  assert.equal(stageOf("done", 100), null);
  assert.equal(stageOf("failed", 40), null);
});

test("the progress screen walks the server's STAGES (not the 4 statuses); the endpoint sends run.stage", () => {
  const api = src("api/blockyWorldsApi.js"), panel = src("ResultPanel.jsx");
  assert.match(api, /import \{ STAGES, stageOf \} from "..\/..\/..\/..\/..\/supabase\/functions\/_shared\/blockyWorlds\/render\.js"/);
  assert.match(api, /export const runStage = \(run\) => \(run \? run\.stage \?\? stageOf\(run\.status, run\.pct \?\? 0\) : null\);/);
  assert.match(panel, /STAGES\.map\(\(s, i\) =>/);
  assert.ok(!/RUN_STEPS/.test(panel), "the old 4-step list is gone from the progress screen");
  assert.match(panel, /const stage = runStage\(run\);/);
  const index = readFileSync(new URL("../supabase/functions/blocky-worlds-api/index.ts", import.meta.url), "utf8");
  assert.match(index, /stage: stageOf\(r\.status, r\.pct \?\? 0\),/);
});

test("the result screen: separate Copy buttons for the title, the description and the hashtags", () => {
  const panel = src("ResultPanel.jsx");
  assert.match(panel, /\["title", "Title", post\.title\], \["description", "Description", post\.description\], \["hashtags", "Hashtags", \(post\.hashtags \?\? \[\]\)\.join\(" "\)\]/);
  assert.match(panel, /function CopyRow\(\{ id, label, text \}\)/);
  assert.match(panel, /navigator\.clipboard\?\.writeText\(text\)/);
  assert.ok(!/postText/.test(panel), "no single combined Copy any more");
});

test("'What we can film' is the server's kit list; 'Move it to our town' shows only for a whole-premise miss", () => {
  const story = src("StoryStep.jsx"), script = src("ScriptStep.jsx"), hook = src("hooks/useBlockyWorlds.js");
  assert.match(story, /flow\.access\?\.film\?\.length > 0 && <CanFilm items=\{flow\.access\.film\} \/>/);
  assert.ok(!/"5 monster looks"|"18 animals"/.test(story), "never hand-written");
  assert.match(script, /loose\.some\(\(x\) => x\.fix === "move"\)/);
  assert.match(script, /onClick=\{flow\.moveToTown\}/);
  assert.match(hook, /worldsCall\("rewrite", \{ draftId: draft\.id, move: true, lengthSec \}\)/);
  const lines = [{ part: "rule", text: "In this town, we all live in a cave." }, { part: "tour", text: "x" }];
  const [spot] = problemSpots({ lines }, [`${PREMISE_PREFIX} ("cave"). "Move it to our town" keeps your rule.`]);
  assert.equal(spot.fix, "move");
});
