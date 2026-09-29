// Phase 4c — local review: grid (rows = beats, cols = variants a-d) + 1:1 crops of beat 10 per variant.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
const root = new URL("../", import.meta.url);
const s = JSON.parse(await Deno.readTextFile(new URL("docs/phase4/flux-tune-state.json", root)));
const rows = [7, 10, 111, 117], cols = ["a", "b", "c", "d"];
const W = 480, H = 270;
const grid = new Image(W * 4, H * 4);
grid.fill(0xffffffff);
for (const [ri, r] of rows.entries()) for (const [ci, c] of cols.entries()) {
  const img = await Image.decode(await Deno.readFile(new URL(s.runs[`${c}:${r}`].file, root)));
  img.resize(W - 4, H - 4);
  grid.composite(img, ci * W + 2, ri * H + 2);
}
await Deno.writeFile(new URL("docs/phase4/review-4c.jpg", root), await grid.encodeJPEG(82));
// 1:1 crops (final 1920x1080) around the viewer in beat 10, for line sharpness.
const crops = new Image(4 * 484, 300);
crops.fill(0xffffffff);
for (const [ci, c] of cols.entries()) {
  const img = await Image.decode(await Deno.readFile(new URL(s.runs[`${c}:10`].file, root)));
  img.crop(720, 380, 480, 300);
  crops.composite(img, ci * 484, 0);
}
await Deno.writeFile(new URL("docs/phase4/review-4c-crops.jpg", root), await crops.encodeJPEG(90));
console.log("ok");
