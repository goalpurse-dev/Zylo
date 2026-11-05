// The docker build context (runpod/buildContext.mjs) and its smoke test (runpod/contextSmoke.mjs). Free, local.
// 2026-11-05: the image shipped audio/mix.mjs without audio/sfxEpic.mjs (a hand list) and a paid prepare job died on
// ERR_MODULE_NOT_FOUND after the voice, the director and the builder were paid for (run 707609b1).
//   node --test dev/buildContext.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildContext } from "../runpod/buildContext.mjs";
import { codeGraph, smoke } from "../runpod/contextSmoke.mjs";

test("the code graph reaches every module the worker loads (the dynamic ones too)", () => {
  const g = codeGraph();
  assert.deepEqual(g.missing, []);
  assert.deepEqual(g.outside, []);
  for (const f of ["audio/mix.mjs", "audio/sfx.mjs", "audio/sfxEpic.mjs", "audio/backrooms.mjs", "lib/sfx.js", "plan.mjs", "render.mjs", "voice/eleven.mjs",
    "lib/director/index.js", "lib/builder/index.js", "lib/builder/cache.js", "lib/builder/apply.js", "lib/builder/still.mjs", "lib/builder/design.js", "lib/builder/vision.js", "page/kit/objects.js"]) assert.ok(g.engine.includes(f), f);
  assert.ok(!g.engine.some((f) => /Build\.mjs$|^dev\//.test(f)), "no build scripts / dev tools");
  assert.deepEqual(g.shared, ["config.js", "voice.js"]);
});

test("buildContext: every module loads from the context in the image's layout; a missing one stops it", () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "bw-ctx-test-"));
  try {
    const r = buildContext(out, { assets: "none" });
    assert.equal(r.smoke.ok, true, r.smoke.problems.join("\n"));
    assert.ok(fs.existsSync(path.join(out, "Dockerfile")) && fs.existsSync(path.join(out, "engine", "audio", "sfxEpic.mjs")));
    assert.ok(r.smoke.modules >= 40);
    // the 2026-11-05 image: mix.mjs without sfxEpic.mjs
    fs.rmSync(path.join(out, "engine", "audio", "sfxEpic.mjs"));
    const s = smoke(out);
    assert.equal(s.ok, false);
    assert.ok(s.problems.some((p) => /context has no engine\/audio\/sfxEpic\.mjs/.test(p)), s.problems.join("\n"));
    assert.ok(s.problems.some((p) => /engine\/audio\/mix\.mjs does not load|sfxEpic/.test(p)));
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
