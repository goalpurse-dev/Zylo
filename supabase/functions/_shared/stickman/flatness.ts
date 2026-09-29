// deno-lint-ignore-file no-explicit-any
// stickman/flatness.ts — fills clip.centerFlat (how much of the picture's
// centre is near-white / one flat colour) from a tiny 64x36 copy through the
// storage image transform. transitionWindows() turns a Zoom punch into a
// flat centre into a Whip pan (preview and render alike). Cheap: a few KB per
// picture, only for clips that don't have it yet (or whose picture changed).
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { pictureStats } from "../../../../src/lib/stickmanEdit.js";

const tiny = (url: string) => (url.includes("/storage/v1/object/public/") ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=64&height=36&resize=contain&quality=70&format=origin` : url);

export async function fillCenterFlatness(clips: any[], limit = 8): Promise<number> {
  const todo = clips.filter((c) => c.image && (c.frameWhite == null || c.centerFlatFor !== c.image));
  let done = 0;
  for (let i = 0; i < todo.length; i += limit) {
    await Promise.all(todo.slice(i, i + limit).map(async (c) => {
      try {
        const r = await fetch(tiny(c.image));
        if (!r.ok) return;
        let img = await Image.decode(new Uint8Array(await r.arrayBuffer())) as Image;
        if (img.width > 64) img = img.resize(64, 36);
        Object.assign(c, pictureStats(img.bitmap, img.width, img.height));
        c.centerFlatFor = c.image;
        done++;
      } catch { /* optional: an unmeasured clip keeps its transition */ }
    }));
  }
  return done;
}
