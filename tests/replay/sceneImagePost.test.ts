// Phase 4a — scene image post-render step (offline).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { coverFit, toTarget, postProcessSceneImage, DEFAULT_POSTPROCESS } from "../../supabase/functions/_shared/stickman/sceneImagePost.ts";

Deno.test("cover-fit math: 2x upscales of 1376x768 and Recraft 1344x768 land on exactly 1920x1080 with a tiny center crop", () => {
  assertEquals(coverFit(2752, 1536, 1920, 1080), { scale: 1080 / 1536, resizeW: 1935, resizeH: 1080, cropX: 7, cropY: 0, dstW: 1920, dstH: 1080 });
  assertEquals(coverFit(2688, 1536, 1920, 1080), { scale: 1920 / 2688, resizeW: 1920, resizeH: 1097, cropX: 0, cropY: 8, dstW: 1920, dstH: 1080 });
  assertEquals(coverFit(1920, 1080, 1920, 1080).cropX, 0);
});

Deno.test("every tier upscales by default (config-driven: model, factor, on/off)", () => {
  for (const t of ["V2", "V3", "V4"] as const) assertEquals(DEFAULT_POSTPROCESS.upscale[t], { enabled: true, model: "runware:504@1", factor: 2 });
  assertEquals(DEFAULT_POSTPROCESS.target, { width: 1920, height: 1080 });
});

async function jpeg(w: number, h: number) {
  const img = new Image(w, h);
  img.fill(0xff8800ff);
  return await img.encodeJPEG(90);
}

Deno.test("post-process: upscale (injected) then exact 1920x1080; the original is kept; upscale off still yields 1920x1080", async () => {
  const small = await jpeg(172, 96); // 1376x768 / 8
  const big = await jpeg(344, 192);
  const calls: any[] = [];
  const res = await postProcessSceneImage({
    originalUrl: "https://img/orig.jpg",
    tier: "V2",
    upscale: async (task) => { calls.push(task); return { imageURL: "https://img/up.jpg", cost: 0.0006, latencyMs: 4000 }; },
    fetchBytes: async (url) => (url.endsWith("up.jpg") ? big : small),
  });
  assertEquals(calls, [{ taskType: "upscale", model: "runware:504@1", upscaleFactor: 2, inputs: { image: "https://img/orig.jpg" }, outputType: "URL", outputFormat: "JPG", outputQuality: 95 }]);
  assertEquals([res.original.url, res.upscaled!.url, res.upscaled!.cost], ["https://img/orig.jpg", "https://img/up.jpg", 0.0006]);
  const out = await Image.decode(res.final.bytes);
  assertEquals([out.width, out.height], [1920, 1080]);
  const off = await postProcessSceneImage({ originalUrl: "o", tier: "V3", config: { ...DEFAULT_POSTPROCESS, upscale: { ...DEFAULT_POSTPROCESS.upscale, V3: { enabled: false, model: "runware:504@1", factor: 2 } } }, upscale: async () => { throw new Error("must not upscale"); }, fetchBytes: async () => small });
  assertEquals(off.upscaled, null);
  const o2 = await Image.decode(off.final.bytes);
  assertEquals([o2.width, o2.height], [1920, 1080]);
  const t = await toTarget(await jpeg(168, 96));
  assert(t.fit.cropY >= 0 && t.fit.cropX >= 0);
});
