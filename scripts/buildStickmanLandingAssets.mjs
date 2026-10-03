// Long Form landing page assets ($0): the curated scenes and thumbnails from the
// OWNER's own Long Form projects only, as 640x360 WebP (gallery) in
// public/lp/stickman/, the 1200x630 social image and the hero poster, plus
// src/data/stickmanLandingGallery.json (file, group, alt, size).
//   node --env-file=.env.local scripts/buildStickmanLandingAssets.mjs <ffmpeg>
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const [FF] = process.argv.slice(2);
const OUT = "public/lp/stickman";
const OWNER = "a8ad2f35-6ad4-4071-bdae-4555afd13f51";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const STORAGE = `${process.env.SUPABASE_URL}/storage/v1/object/public`;
// group -> project -> [scene number, alt text]
const SETS = {
  hunt: ["f90160bc-8e3c-4210-890f-91b383b5dd81", [
    [63, "Stickman hunters closing in on an antelope with raised spears"], [36, "Two groups of stickman hunters facing a wild boar in a cave"],
    [101, "Stickman hunter with a torch driving a herd into a stone funnel"], [91, "Stickman hunters sharing meat around a fire at night"],
    [58, "Stickman hunter facing a huge bison on the savanna"], [86, "Stickman runner chasing a tiring antelope across the plain"],
    [41, "Nervous stickman hunter creeping up on a reindeer"], [9, "Stickman hunter standing guard while the group warms up by the fire"],
    [62, "Stickman hunters surrounding an antelope in a wide circle"], [85, "Stickman hunter sprinting after an antelope"],
    [78, "Stickman hunter running with a long spear"], [25, "Stickman hunter throwing a spear across the grassland"],
    [124, "Stickman hunter watching a lion at a kill site"], [55, "Stickman hunter holding a spear inside a cave"],
    [66, "Stickman hunter leading a line of followers across the savanna"], [7, "Stickman hunter warming up by a fire on a snowy night"],
  ]],
  rain: ["3f65a0c7-679c-4ff3-a148-662969031dc5", [
    [10, "Stickman carrying a glowing ember through heavy rain"], [22, "Two stickmen sheltering by a fire while snow falls outside"],
    [61, "Stickman shielding a small fire in the rain"],
    [87, "Stickman sitting sadly beside a hut in the rain"], [47, "Stickman tending a tall fire inside a hide shelter"],
    [78, "Two stickmen cooking fish over a fire"], [68, "Two stickmen sitting by a hearth inside a shelter"],
    [98, "Two worried stickmen holding a dying ember"], [34, "Stickman building a wooden frame in the rain"],
    [72, "Stickman with a spear standing in a flooded marsh"], [84, "Two stickmen waiting out the rain inside a shelter"],
    [11, "Two stickmen arguing over a small fire in a tent"], [63, "Two annoyed stickmen with spears inside a hide tent"],
    [96, "Two stickmen passing an ember in a cave"], [21, "Stickman crowd gathered around a fire in a snowy cave"],
    [29, "Stickman walking through a rainy marsh protecting a flame"],
  ]],
  fire: ["2f1b7e40-2b29-47e8-9711-4e53ab1c717f", [
    [7, "Stickman camp gathered around a hearth at night"], [36, "Smiling stickman hunter by a night camp fire"],
    [38, "Stickman child sitting next to a stone hearth at a camp"], [40, "Stickman sleeping under a hide shelter"],
    [59, "Stickman hunter cooking over glowing embers at night"], [63, "Two stickmen roasting meat over a fire"],
    [73, "Stickman hunter facing a bison in the snow"], [74, "Group of stickman hunters around a bison"],
    [80, "Stickmen sharing meat around a camp fire"], [105, "Two stickmen sharing food beside a hearth"],
    [118, "Stickman in a fur hood by the fire"], [119, "Stickmen in fur hoods standing at a night camp"],
    [127, "Stickmen sleeping around a camp fire"], [44, "Stickman warming hands at a fire in a daytime camp"],
    [79, "Two stickmen butchering meat at a camp"], [129, "Two stickmen working over bones at a shore camp"],
  ]],
};
// The /history page has its own pictures (same three projects, different scenes):
// files h-<group>-NNN.webp, gallery groups history-<group>.
const HISTORY_SETS = {
  hunt: ["f90160bc-8e3c-4210-890f-91b383b5dd81", [
    [16, "Stickman archaeologists excavating wooden spears at a lakeside dig"], [26, "Stickman hunter holding a long spear among animal bones in a cave"],
    [38, "Stickman hunter throwing a spear while another watches on the grassland"], [44, "Stickman hunter standing with a spear on the open savanna"],
    [90, "Stickman hunter stalking an antelope from behind rocks"], [111, "Stickman hunter walking beside a stone wall built to trap animals"],
    [130, "Two stickman hunters with stone tools in a cave littered with bones"], [145, "Stickman hunter standing beside a night fire with spears stuck in the snow"],
  ]],
  fire: ["2f1b7e40-2b29-47e8-9711-4e53ab1c717f", [
    [8, "Stickman hunter with a spear at a night camp beside a hide shelter"], [11, "Stickman sitting by a stone hearth at a night camp working on a tool"],
    [34, "Stickman in fur clothing walking along an icy shore toward a distant camp"], [41, "Stickman child asleep in a cave while snow falls outside"],
    [111, "Stickman archaeologist kneeling in an excavation trench with a trowel"], [67, "Stickman carrying a basket of food at a shore camp with huts"],
    [94, "Two stickman hunters sitting with spears at a camp of hide huts"], [108, "Stickman wrapped in furs walking through a snowstorm"],
  ]],
  rain: ["3f65a0c7-679c-4ff3-a148-662969031dc5", [
    [14, "Stickman carrying a flame past a waterfall at a cave mouth"], [24, "Stickman archaeologist taking notes beside an ancient hearth in a rock shelter"],
    [35, "Stickman archaeologist brushing soil from the remains of a prehistoric fireplace"], [33, "Lone stickman crossing a flooded marsh under a grey sky"],
    [74, "Stickman hunter with a spear standing in a marsh"], [49, "Stickman crouching over a fire inside a shelter while rain drips through the roof"],
    [82, "Two stickmen sitting on a bench in a shelter, one holding a small flame"], [43, "Stickman with a spear standing by a fire inside a hide shelter"],
  ]],
};
const THUMBS = [["f901-b1s0", "f90160bc", 1, 0], ["f901-b1s1", "f90160bc", 1, 1], ["2f1b-b1s1", "2f1b7e40", 1, 1], ["2f1b-b1s0", "2f1b7e40", 1, 0], ["3f65-b2s0", "3f65a0c7", 2, 0], ["3f65-b2s1", "3f65a0c7", 2, 1]];
fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lp-"));
const toWebp = async (url, file, w = 640, h = 360, q = 78) => {
  const src = path.join(tmp, "src");
  fs.writeFileSync(src, Buffer.from(await (await fetch(url)).arrayBuffer()));
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", src, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, "-c:v", "libwebp", "-quality", String(q), `${OUT}/${file}`]);
  return fs.statSync(`${OUT}/${file}`).size;
};
const gallery = [];
const addScenes = async (sets, { filePrefix = "", groupPrefix = "", altSuffix }) => {
  for (const [group, [project, scenes]] of Object.entries(sets)) {
    const { data: p } = await admin.from("long_form_projects").select("user_id").eq("id", project).single();
    if (p.user_id !== OWNER) throw new Error(`${project} is not the owner's project`);
    const { data: rows } = await admin.from("long_form_scene_images").select("beat_sequence, image_url").eq("project_id", project).eq("is_current", true).in("beat_sequence", scenes.map((s) => s[0]));
    const urlOf = new Map(rows.map((r) => [r.beat_sequence, r.image_url]));
    for (const [n, alt] of scenes) {
      const file = `${filePrefix}${group}-${String(n).padStart(3, "0")}.webp`;
      const bytes = await toWebp(urlOf.get(n), file);
      gallery.push({ file, group: `${groupPrefix}${group}`, alt: `${alt}, ${altSuffix}`, bytes });
    }
  }
};
await addScenes(SETS, { altSuffix: "AI-generated history scene" });
for (const [name, prefix, batch, slot] of THUMBS) {
  const { data: ps } = await admin.from("long_form_projects").select("id, user_id").eq("user_id", OWNER);
  const project = (ps ?? []).find((x) => x.id.startsWith(prefix));
  if (!project) throw new Error(`thumbnail project ${prefix} is not the owner's`);
  const { data: t } = await admin.from("long_form_thumbnails").select("headline, full_url, png_url").eq("project_id", project.id).eq("batch", batch).eq("slot", slot).single();
  const file = `thumb-${name}.webp`;
  const bytes = await toWebp(t.full_url ?? t.png_url, file, 640, 360, 80);
  gallery.push({ file, group: "thumbnails", alt: `YouTube thumbnail made by Zyvo with the headline “${t.headline}”`, bytes });
  if (name === "f901-b1s0") {
    const src = path.join(tmp, "og");
    fs.writeFileSync(src, Buffer.from(await (await fetch(t.full_url)).arrayBuffer()));
    execFileSync(FF, ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-q:v", "3", `${OUT}/og.jpg`]);
  }
}
await addScenes(HISTORY_SETS, { filePrefix: "h-", groupPrefix: "history-", altSuffix: "scene from a stickman history video made with AI" });
// /history social image: another real thumbnail of the owner's ("DEAD BY MORNING?"), and its hero poster.
{
  const { data: t } = await admin.from("long_form_thumbnails").select("full_url, project_id").eq("project_id", "2f1b7e40-2b29-47e8-9711-4e53ab1c717f").eq("batch", 1).eq("slot", 2).single();
  const src = path.join(tmp, "og-history");
  fs.writeFileSync(src, Buffer.from(await (await fetch(t.full_url)).arrayBuffer()));
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", src, "-vf", "scale=1200:630:force_original_aspect_ratio=increase,crop=1200:630", "-q:v", "3", `${OUT}/og-history.jpg`]);
  fs.writeFileSync(`${OUT}/hero-history.webp`, Buffer.from(await (await fetch(`${STORAGE}/showcase/loops/made-with-zyvo.webp`)).arrayBuffer()));
}
// The owner's published YouTube videos (showcase thumbnails): two cards + the tutorial's lite embed.
for (const [name, w, h] of [["early-humans-hunt", 640, 360], ["vikings-horned-helmets", 640, 360], ["tutorial-2d-history-stickman", 960, 540]]) {
  await toWebp(`${STORAGE}/showcase/thumbnails/${name}.jpg`, `video-${name}.webp`, w, h, 80);
}
// Hero poster (the baked scene loop's first frame), local so it can be preloaded.
fs.writeFileSync(`${OUT}/hero-poster.webp`, Buffer.from(await (await fetch(`${STORAGE}/showcase/loops/lf-card.webp`)).arrayBuffer()));
fs.writeFileSync("src/data/stickmanLandingGallery.json", JSON.stringify(gallery.map(({ file, group, alt }) => ({ file, group, alt })), null, 1) + "\n");
fs.rmSync(tmp, { recursive: true, force: true });
const total = gallery.reduce((a, g) => a + g.bytes, 0);
console.log(JSON.stringify({ images: gallery.length, totalKB: Math.round(total / 1024), avgKB: Math.round(total / 1024 / gallery.length), og: fs.statSync(`${OUT}/og.jpg`).size, heroPoster: fs.statSync(`${OUT}/hero-poster.webp`).size }));
