// Phase 4a — review grids (local only): rows = beats, columns = models.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
const root = new URL("../", import.meta.url);
const s = JSON.parse(await Deno.readTextFile(new URL("docs/phase4/bakeoff-state.json", root)));
const models = ["flux2-klein-9b-kv", "qwen-image-2512", "nano-banana-2-lite", "nano-banana-2", "recraft-v4"];
const W = 384, H = 216;
async function grid(name: string, rows: number[], cols: string[], keyOf: (r: number, c: string) => string) {
  const out = new Image(W * cols.length, H * rows.length);
  out.fill(0xffffffff);
  for (const [ri, r] of rows.entries()) for (const [ci, c] of cols.entries()) {
    const rec = s.renders[keyOf(r, c)];
    if (!rec?.file) continue;
    const img = await Image.decode(await Deno.readFile(new URL(rec.file, root)));
    img.resize(W - 4, H - 4);
    out.composite(img, ci * W + 2, ri * H + 2);
  }
  await Deno.writeFile(new URL(`docs/phase4/review-${name}.jpg`, root), await out.encodeJPEG(80));
}
await grid("A1", [117, 69, 7, 18, 12], models, (r, c) => `A:${c}:${r}`);
await grid("A2", [21, 57, 10, 111, 125], models, (r, c) => `A:${c}:${r}`);
await grid("B", [117, 57, 10, 111], ["A:nano-banana-2-lite", "B:nano-banana-2-lite", "A:nano-banana-2"], (r, c) => `${c}:${r}`);
console.log("ok");
