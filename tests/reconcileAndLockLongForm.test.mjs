import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 2026-10-02 "real narration audio master timeline" pass — source-pattern
// safety checks for reconcile-long-form-narration-alignment and
// lock-long-form-script.

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");
const RECONCILE = "supabase/functions/reconcile-long-form-narration-alignment/index.ts";
const LOCK = "supabase/functions/lock-long-form-script/index.ts";

test("reconcile never calls any provider — pure re-mapping of already-stored alignment", async () => {
  const text = await source(RECONCILE);
  assert.doesNotMatch(text, /api\.elevenlabs\.io|synthesizeNarrationAudio/);
  assert.match(text, /import \{ mapAlignmentToNarration \}/);
});

test("reconcile only ever acts on a row whose status is alignment_failed", async () => {
  const text = await source(RECONCILE);
  assert.match(text, /row\.status !== "alignment_failed"/);
});

test("reconcile verifies ownership through the joined project row before touching anything", async () => {
  const text = await source(RECONCILE);
  assert.match(text, /ownerId !== user\.id/);
});

test("lock-long-form-script never overwrites an existing lock timestamp — locking is a one-way, idempotent action", async () => {
  const text = await source(LOCK);
  assert.match(text, /\.is\("locked_at", null\)/);
});

test("lock-long-form-script fires the Bible builder and narration audio generation in PARALLEL, not sequentially awaited", async () => {
  const text = await source(LOCK);
  assert.match(text, /const bibleWork = kickDownstream/);
  assert.match(text, /const narrationWork = kickDownstream/);
  assert.match(text, /Promise\.all\(\[bibleWork, narrationWork\]\)/);
});

test("lock-long-form-script requires a finished draft: legacy needs status 'ready'; Stickman (Phase 6a) also accepts needs_attention/needs_research WITH a document", async () => {
  const text = await source(LOCK);
  assert.ok(text.includes(`: scriptVersion.status === "ready";`), "legacy still requires ready");
  assert.ok(text.includes(`["ready", "needs_attention", "needs_research"].includes(scriptVersion.status) && !!scriptVersion.script_document`), "stickman: a finished draft has a document");
  assert.ok(text.includes("if (!finished) return err("));
});

test("lock-long-form-script never calls any image/video provider", async () => {
  const text = await source(LOCK);
  assert.doesNotMatch(text, /functions\/v1\/(runware-image|runware-video|job-worker)/);
});
