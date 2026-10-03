// Publish stuck on "open the editor first" (2026-10-03). Two projects had ONE
// scene shorter than 1.5 s in their plan; the first edit built from the scenes
// then failed validateEdit, the editor's first save was refused, no edit was
// ever saved, and Publish kept refusing. Now: the first edit is always valid,
// and the server makes sure of the edit itself (created / re-synced) for the
// editor, the render, the YouTube text and our scripts.
import { assert, assertEquals, assertMatch } from "jsr:@std/assert@1";
import { buildInitialEdit, spacedStarts, validateEdit, withEnds, MIN_CLIP_MS } from "../../src/lib/stickmanEdit.js";

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url));
const scene = (n: number, startMs: number) => ({ sceneId: `s${n}`, imageVersion: 1, number: n, startMs, narration: `line ${n}`, imageUrl: `https://x/${n}.jpg`, overlay: null, camera: null });
const words = Array.from({ length: 400 }, (_, i) => ({ text: `w${i}`, startMs: i * 250, endMs: i * 250 + 200 }));
const audio = { url: "https://x/a.mp3", durationMs: 100_000 };
const build = (starts: number[]) => buildInitialEdit({ scenes: starts.map((s, i) => scene(i + 1, s)), words, audio, narrationId: "n1", seed: "p1" });

Deno.test("a plan with a 1.2 s scene (the two stuck projects) still gives a valid first edit", () => {
  // fe000088: scene 4 came 1,254 ms after scene 3. 596af432: scene 94, 1,196 ms.
  const doc = build([0, 4000, 8000, 9254, 13000, 17000]);
  assertEquals(validateEdit(doc), []);
  assertEquals(doc.clips.length, 6, "every scene keeps its clip");
  const ends = withEnds(doc);
  assert(ends.every((c: any) => c.endMs - c.startMs >= MIN_CLIP_MS), "no clip under 1.5 s");
  // The short scene keeps its start; the one after it starts a little later.
  assertEquals(doc.clips[2].startMs, 8000);
  assert(doc.clips[3].startMs >= 9500 && doc.clips[3].startMs <= 9900, String(doc.clips[3].startMs));
  assertEquals(doc.clips[3].startMs % 250, 0, "the moved cut lands on a word start");
  assertEquals(doc.clips[4].startMs, 13000);
});

Deno.test("a normal plan is unchanged; several short scenes in a row and a too-short ending are handled", () => {
  const normal = build([0, 5000, 10000, 15000]);
  assertEquals(normal.clips.map((c: any) => c.startMs), [0, 5000, 10000, 15000]);
  const run = build([0, 1000, 1200, 1300, 9000]);
  assertEquals(validateEdit(run), []);
  assertEquals(run.clips.length, 5);
  // No 1.5 s left before the voiceover ends: that last scene is left out, the edit is still valid.
  const tail = build([0, 50_000, 99_200]);
  assertEquals(validateEdit(tail), []);
  assertEquals(tail.clips.map((c: any) => c.beatSequence), [1, 2]);
  assertEquals(spacedStarts([300, 5000], 60_000).map((k: any) => k.startMs), [0, 5000], "the first clip always starts at 0");
});

Deno.test("the server makes sure of the edit: created when missing, re-synced to current pictures, saved", () => {
  const lib = read("supabase/functions/_shared/stickman/editDoc.ts");
  assertMatch(lib, /doc = buildInitialEdit\(\{ scenes, words, audio, narrationId: narr\.id, seed: projectId/);
  assertMatch(lib, /created = true;/);
  assertMatch(lib, /if \(s\.image_url !== c\.image\) resynced\+\+; else relinked\+\+;/);
  assertMatch(lib, /if \(c\.uploaded \|\| c\.needsImage \|\| c\.splitFrom\) return c;/, "the user's own pictures are left alone");
  assertMatch(lib, /const save = created \|\| resynced > 0 \|\| retimed \|\| \(opts\.editor === true && \(relinked > 0 \|\| measured > 0\)\);/);
  assertMatch(lib, /\/duplicate\|unique\/i\.test\(saveErr\.message/, "two requests creating it at once end on the same edit");
});

Deno.test("wiring: editor, render, YouTube text and Publish all go through it; no more 'open the editor first'", () => {
  const edit = read("supabase/functions/long-form-edit/index.ts");
  assertMatch(edit, /const e = await ensureEdit\(admin, project, \{ createdBy: user\.id, editor: true, source: "long-form-edit" \}\);/);
  assertMatch(edit, /const internal = trusted && action === "ensure";/, "scripts may call ensure with the service key, nothing else");
  assertMatch(edit, /if \(!project \|\| \(!internal && project\.user_id !== user\.id\)\) return err\(req, "Project not found", 404\);/);
  const render = read("supabase/functions/long-form-render/index.ts");
  assertMatch(render, /const ensured = await ensureEdit\(admin, project, \{ createdBy: user\.id, source: "long-form-render" \}\);/);
  const text = read("supabase/functions/long-form-youtube-text/index.ts");
  assertMatch(text, /const ensured = await ensureEdit\(admin, project, \{ createdBy: user\?\.id \?\? project\.user_id, source: "long-form-youtube-text" \}\);/);
  for (const src of [render, text]) assert(!/Open the editor once/.test(src));
  const start = read("supabase/functions/long-form-publish-start/index.ts");
  assertMatch(start, /const all = call\("long-form-edit", \{ action: "ensure" \}\)\.then\(\(edit\) => Promise\.all\(\[/, "the edit first, then the three steps");
  // The Publish page starts everything itself when nothing was rendered yet (never restarts a failed/outdated render).
  const page = read("src/pages/workspace/long-form/publish.jsx");
  assertMatch(page, /if \(!state \|\| kicked\.current \|\| autopilot \|\| state\.job \|\| state\.lastDone\) return;\s+kicked\.current = true;\s+setStarting\(true\);\s+startPublish\(projectId\)\.then\(load\);/);
  // Our redraw script leaves the edit on the new pictures.
  assertMatch(read("scripts/redrawFailedScenes.mjs"), /await ensureProjectEdit\(P\)/);
});
