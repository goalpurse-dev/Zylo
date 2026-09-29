// Phase 6c-polish — notifications once per event (never for a step already passed),
// the Edit placeholder route, one page scroll, the player and the premium card actions.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { autopilotEvent, alreadyThere } from "../src/pages/workspace/long-form/notifyEvents.js";
import { resolveStickmanPage } from "../src/pages/workspace/long-form/projectStage.js";

const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("notifications: one event per state, keyed by the server's own time; nothing while a step is still running", () => {
  assert.equal(autopilotEvent({ status: "running" }), null);
  // 6e: no stop at the voice -> no "voice ready" announcement (the run goes on to the scenes).
  assert.equal(autopilotEvent({ status: "done", phase: "narration", narration: { status: "ready" }, doneAt: "t1" }), null);
  assert.equal(autopilotEvent({ status: "failed", phase: "narration" }).page, "generating");
  assert.equal(autopilotEvent({ status: "running", phase: "scenes", scenes: { status: "running" } }), null);
  assert.equal(autopilotEvent({ status: "done", phase: "scenes", scenes: { status: "done", doneAt: "t2" } }).id, "scenes_ready");
  // A redraw finishing is not a new "scenes ready" announcement while it runs.
  assert.equal(autopilotEvent({ status: "running", phase: "scenes", scenes: { status: "running", regenerating: true } }), null);
  // The old "Your script is ready" is gone: after the script the chain goes on by itself.
  assert.equal(autopilotEvent({ status: "done" }), null);
});

test("notifications: never shown for a step the user is already on or has passed", () => {
  const pid = "p1";
  assert.equal(alreadyThere(`/long-form/project/${pid}/edit`, pid, "scenes"), true);
  assert.equal(alreadyThere(`/long-form/project/${pid}/scenes`, pid, "scenes"), true);
  assert.equal(alreadyThere(`/long-form/project/${pid}/idea`, pid, "scenes"), false);
  assert.equal(alreadyThere(`/long-form/project/other/scenes`, pid, "scenes"), false);
  const notifier = read("src/components/LongFormScriptReadyNotifier.jsx");
  assert.match(notifier, /if \(seen\(\)\.has\(key\)\) continue;/);
  assert.match(notifier, /toast\.error : toast\.success\)\(ev\.title, \{ id: key/); // sonner dedupes by id too
  assert.doesNotMatch(read("src/pages/workspace/long-form/writing.jsx"), /unwatchProject\(/);
});

test("Edit: a placeholder page (never a dead button); reachable once scenes are drawn", () => {
  const done = { autopilot: { status: "done", phase: "scenes", scenes: { status: "done" } }, _scriptLocked: true, _narrationReady: true, _hasScenes: true };
  const drawing = { autopilot: { status: "running", phase: "scenes", scenes: { status: "running" } }, _scriptLocked: true, _narrationReady: true };
  assert.equal(resolveStickmanPage("edit", done), "edit");
  assert.equal(resolveStickmanPage("edit", drawing), "generating");
  assert.match(read("src/App.jsx"), /path="\/long-form\/project\/:id\/edit"\s+element=\{<StickmanRouteGuard page="edit"><LongFormEditPage \/>/);
  assert.match(read("src/pages/workspace/long-form/scenes.jsx"), /primaryLabel="Continue to Edit" onPrimary=\{\(\) => navigate\(`\/long-form\/project\/\$\{projectId\}\/edit`\)\}/);
});

test("Scenes page: one page scroll (no inner scroll box), sticky header, 1/2/3/4-column grid, player + text layers everywhere", () => {
  const page = read("src/pages/workspace/long-form/scenes.jsx");
  assert.doesNotMatch(page, /overflow-y-auto/, "no inner scroll box");
  assert.match(page, /sticky top-\[var\(--lf-header-h,64px\)\]/);
  assert.match(page, /grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-\[1800px\]:grid-cols-4/);
  assert.match(page, /<StickmanPlayer ref=\{playerRef\}/);
  assert.match(page, /Your video is ready to watch/);
  const visuals = read("src/pages/workspace/long-form/sceneVisuals.jsx");
  assert.match(visuals, /loaded && <OverlayLayer layer=\{scene\.overlay\} \/>/, "cards draw the text layer");
  assert.match(visuals, /loading=\{eager \? "eager" : "lazy"\}/);
  assert.match(visuals, /blur-md/, "blur-up");
  const player = read("src/pages/workspace/long-form/StickmanPlayer.jsx");
  assert.match(player, /<OverlayLayer layer=\{scene\?\.overlay\} \/>/, "the player draws the text layer");
  assert.match(player, /transform: `scale\(\$\{cam\.scale\}\)`/, "camera motion");
});

test("Regenerate: lime primary with the credits inside + shimmer; blur while redrawing; Undo for 10 s", () => {
  const page = read("src/pages/workspace/long-form/scenes.jsx");
  assert.match(page, /zyvo-btn-shimmer inline-flex items-center gap-1\.5 rounded-lg bg-lime-300/);
  assert.match(page, /<SceneThumb scene=\{scene\} busy=\{pending\} \/>/);
  assert.match(page, /const UNDO_MS = 10_000;/);
  assert.match(read("supabase/functions/update-long-form-scene/index.ts"), /action === "undo"/);
});

test("6c-polish 2: never crop (16:9 + contain, thumbnails with width AND height), player fits above the bottom bar, scene viewer", () => {
  const visuals = read("src/pages/workspace/long-form/sceneVisuals.jsx");
  assert.doesNotMatch(visuals, /object-cover/);
  assert.match(visuals, /aspect-video overflow-hidden rounded-xl bg-black/);
  assert.match(read("supabase/functions/get-long-form-scenes/index.ts"), /\?width=\$\{w\}&height=\$\{Math\.round\(\(w \* 9\) \/ 16\)\}&resize=contain/);
  const player = read("src/pages/workspace/long-form/StickmanPlayer.jsx");
  assert.match(player, /document\.querySelector\("\[data-long-form-footer\]"\)/);
  assert.match(player, /data-testid="player-scrub"/);
  assert.match(player, /scenes\.slice\(1\)\.map\(\(s\) => \(\s*<span key=\{s\.key\}/, "scene markers");
  assert.match(player, /min\(100vw, calc\(\(100vh - \$\{CONTROLS_H\}px\) \* 16 \/ 9\)\)/, "letterboxed fullscreen");
  const viewer = read("src/pages/workspace/long-form/SceneViewer.jsx");
  for (const s of ["ArrowRight", "ArrowLeft", "Escape", "Play this scene", "Edit description", "Edit text", "Undo", "object-contain"]) assert.ok(viewer.includes(s), s);
  const page = read("src/pages/workspace/long-form/scenes.jsx");
  assert.match(page, /<IconAction label="Edit description"/);
  assert.match(page, /<IconAction label="Edit text"/);
  const worker = read("supabase/functions/render-long-form-scene/index.ts");
  assert.match(worker, /qaCopyUrl\(bytes/);
  assert.match(worker, /catch\(\(\) => aiQa\(url, contract, castNames\)\)/, "falls back to the original render URL");
});