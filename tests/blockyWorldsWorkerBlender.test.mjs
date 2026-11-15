// The Studio worker image runs the owner's BLENDER engine (2026-11-15): python3 + PIL, the kit at /kit, the free checks in
// the build (--smoke) and the dry check (--check-blender) that never takes a run. Free: no image build, no call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { KIT_DEFAULT, kitFiles, gitBytes } from "../scripts/blockyWorlds/studioWorker/buildContext.mjs";
import { STILL, KIT_FILES } from "../scripts/blockyWorlds/studioWorker/blenderCheck.mjs";
import { RATE, BOOT_S } from "../scripts/blockyWorlds/blenderKit/rp.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("the Dockerfile: python3 + Pillow as `python`, the kit at /kit, the checks run in the build", () => {
  const d = read("scripts/blockyWorlds/studioWorker/Dockerfile");
  assert.match(d, /apt-get install -y --no-install-recommends ffmpeg ca-certificates python3 python3-pil python-is-python3/);
  assert.match(d, /COPY kit\/ \/kit\//);
  assert.match(d, /BLOCKY_WORLDS_KIT_DIR=\/kit/);
  assert.match(d, /chown -R node:node \/app\/scripts\/blockyWorlds\/blenderKit\/library/);
  assert.ok(d.indexOf("BLOCKY_WORLDS_KIT_DIR=/kit") < d.indexOf("worker.mjs --smoke"), "the kit is in place before the smoke checks");
});

test("--smoke runs the Blender free checks (a miss fails the build); --check-blender never takes a run", () => {
  const w = read("scripts/blockyWorlds/studioWorker/worker.mjs");
  const smoke = w.slice(w.indexOf('if (argv.includes("--smoke"))'), w.indexOf('if (argv.includes("--check-blender"))'));
  assert.match(smoke, /localChecks\(\)/);
  assert.match(smoke, /process\.exit\(1\)/);
  const check = w.slice(w.indexOf('if (argv.includes("--check-blender"))'), w.indexOf('if (argv.includes("--check"))'));
  assert.match(check, /gpuStill\(/);
  assert.match(check, /process\.exit\(ok \? 0 : 1\)/);
  const code = check.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(code, /claim|hello|runStudioRun|loadConfig/);
  assert.ok(w.indexOf('if (argv.includes("--check-blender"))') < w.indexOf("const cfg = loadConfig();"), "exits before the loop starts");
});

test("the paid still: one shot, worst case under $0.05, a library place", () => {
  const worst = (STILL.maxRunSec + BOOT_S) * RATE;
  assert.ok(worst <= STILL.maxUsd && STILL.maxUsd <= 0.05, `worst $${worst.toFixed(4)}`);
  assert.equal(STILL.place, "downtown_street");
  const src = read("scripts/blockyWorlds/studioWorker/blenderCheck.mjs");
  assert.match(src, /if \(worst > maxUsd\) return \{ ok: false, detail: `refused/);
  assert.match(src, /mean > 12 && sd > 6/, "a black or flat frame fails");
});

test("the kit copy: the director's text only, never the setup / voice / ElevenLabs scripts", { skip: !fs.existsSync(KIT_DEFAULT) && "the kit is not on this machine" }, () => {
  const f = kitFiles(KIT_DEFAULT);
  for (const k of KIT_FILES) assert.ok(f.includes(k), k);
  assert.ok(!f.some((x) => /(^|\/)(setup|eleven|voice|voice_run)\.py$/.test(x)), "no setup / voice scripts");
  assert.ok(!f.some((x) => /^engine\/(assets|sfx)\//.test(x)), "no assets or sounds");
});

test("--ref takes the COMMITTED files (deploy only committed code), and the kit is never in git", () => {
  assert.ok(gitBytes("HEAD", "scripts/blockyWorlds/studioWorker/worker.mjs")?.length > 1000);
  assert.equal(gitBytes("HEAD", "no/such/file.mjs"), null);
  const tracked = spawnSync("git", ["-C", ROOT, "ls-files", "reference/blocky-worlds/roblox-story-kit"], { encoding: "utf8" }).stdout.trim();
  assert.equal(tracked, "", "the kit is not tracked");
});
