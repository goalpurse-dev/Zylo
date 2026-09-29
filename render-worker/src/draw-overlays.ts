// deno-lint-ignore-file no-explicit-any
// Draws every text and caption overlay of an EDL v2 as small PNGs + positions,
// with the SAME drawing code as the editor's Scenes-step text and the local
// renders (supabase/functions/_shared/stickman/editRender.ts). Run by the
// worker (Deno ships in the image; the shared files are synced into it by
// scripts/sync-shared.mjs, at the same relative paths as in the repo).
//   deno run -A src/draw-overlays.ts <edl.json> <outDir>   -> <outDir>/manifest.json
import { drawOverlayPiece } from "../../supabase/functions/_shared/stickman/editRender.ts";

const [edlPath, outDir, keysPath] = Deno.args;
const edl = JSON.parse(await Deno.readTextFile(edlPath));
const font = await Deno.readFile(new URL("../../supabase/functions/_shared/fonts/LilitaOne-Regular.ttf", import.meta.url));
await Deno.mkdir(outDir, { recursive: true });
const manifest: Record<string, { file: string; x: number; y: number }> = {};
// A chunk of a parallel render draws only the overlays its pieces show.
const keys: string[] = keysPath ? JSON.parse(await Deno.readTextFile(keysPath)) : Object.keys(edl.overlays ?? {});
const t0 = Date.now();
for (const key of keys) {
  const file = `${outDir}/ov-${key}.png`;
  const d = await drawOverlayPiece(edl, key, font);
  await Deno.writeFile(file, d.png);
  manifest[key] = { file, x: d.x, y: d.y };
}
await Deno.writeTextFile(`${outDir}/manifest.json`, JSON.stringify(manifest));
console.log(JSON.stringify({ overlays: keys.length, ms: Date.now() - t0 }));
