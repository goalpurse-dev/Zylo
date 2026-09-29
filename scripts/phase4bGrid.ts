// Phase 4b — local review grid: rows = beats; columns = Lite before (4a) | V3 after | FLUX before (4a) | V2 after.
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
const root = new URL("../", import.meta.url);
const a = JSON.parse(await Deno.readTextFile(new URL("docs/phase4/bakeoff-state.json", root)));
const v = JSON.parse(await Deno.readTextFile(new URL("docs/phase4/verify-4b-state.json", root)));
const rows = [7, 69, 125, 117, 10, 111];
const cols = [(b: number) => a.renders[`A:nano-banana-2-lite:${b}`]?.file, (b: number) => v.runs[`V3:${b}`]?.file, (b: number) => a.renders[`A:flux2-klein-9b-kv:${b}`]?.file, (b: number) => v.runs[`V2:${b}`]?.file];
const W = 480, H = 270;
const out = new Image(W * cols.length, H * rows.length);
out.fill(0xffffffff);
for (const [ri, r] of rows.entries()) for (const [ci, c] of cols.entries()) {
  const f = c(r);
  if (!f) continue;
  const img = await Image.decode(await Deno.readFile(new URL(f, root)));
  img.resize(W - 4, H - 4);
  out.composite(img, ci * W + 2, ri * H + 2);
}
await Deno.writeFile(new URL("docs/phase4/review-4b.jpg", root), await out.encodeJPEG(80));
console.log("ok");
