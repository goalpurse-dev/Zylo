// Copies the editor/render code the worker shares with the app into
// render-worker/shared/, at the SAME relative paths as in the repo, so
// src/draw-overlays.ts imports it unchanged in the Docker image (COPY shared/ /).
// Run before `fly deploy` (the Docker build context is render-worker/ only).
//   node scripts/sync-shared.mjs
import { cpSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const out = path.resolve(here, "../shared");
rmSync(out, { recursive: true, force: true });
const files = [
  "src/lib/stickmanEdit.js",
  "supabase/functions/_shared/stickman/editRender.ts",
  "supabase/functions/_shared/stickman/textOverlay.ts",
  "supabase/functions/_shared/stickman/faceFinder.ts",
  "supabase/functions/_shared/fonts/LilitaOne-Regular.ttf",
];
for (const f of files) {
  mkdirSync(path.dirname(path.join(out, f)), { recursive: true });
  cpSync(path.join(repo, f), path.join(out, f));
}
console.log(`synced ${files.length} files into render-worker/shared/`);
