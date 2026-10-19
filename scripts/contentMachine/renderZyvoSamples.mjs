// Zyvo-account samples (owner, 2026-10-19): two slideshows in different Zyvo formats, written here by hand from
// the fact sheet (no model call: $0), with REAL library assets, the real templates, the Zyvo brand style and logo.
// Every slide passes the program's own Zyvo-account checks (cited facts, real assets, no other tools) before it is
// rendered locally (Chromium + ffmpeg), once with the TikTok safe zones drawn and once clean.
//   FFMPEG=<ffmpeg> node scripts/contentMachine/renderZyvoSamples.mjs <outDir> [--env <.env.local>]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderSlideshow } from "../../render-worker/src/cmSlides.mjs";
import { zyvoProblems, citable } from "../../supabase/functions/_shared/contentMachine/zyvoLane.js";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(path.join(ROOT, "package.json"));
const arg = (name, def = null) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : def; };
const outDir = process.argv[2];
if (!outDir) { console.error("usage: renderZyvoSamples.mjs <outDir> [--env <.env.local>]"); process.exit(2); }
require("dotenv").config({ path: arg("--env", path.join(ROOT, ".env.local")), quiet: true });
const db = require("@supabase/supabase-js").createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], items_right: [], tool: null, image_prompt: null, asset_id: null, assets: [], prompt: null, callout: null, fact_ids: [], is_zyvo: true, ...extra });
const A = (asset_id, label) => ({ asset_id, label });

export const SAMPLES = [
  {
    key: "feature_hero", title: "One idea in. A finished video out.",
    slides: [
      S("feature_hero", "One idea in. A *finished video* out.", { assets: [A("cd029a72", "Long Form"), A("b98611f0", "AI Fruit Story"), A("cfbdb166", "Clay Rescue")], callout: "Full 8–15 minute YouTube videos, not just Shorts", fact_ids: ["lf_length", "short_templates"] }),
      S("spotlight", "A whole *series*, same cast", { body: "Up to 10 episodes with the same characters, cast from 150 fruit characters.", assets: [A("440627bc", "AI Fruit Story"), A("9e7a5ad3", "AI Fruit Story")], fact_ids: ["fruit_series", "fruit_characters"] }),
      S("style_grid", "Pick a *look*", { body: "9 short-form templates and 6 Long Form styles.", assets: [A("8b3f14dd", "Long Form"), A("7e6a2c68", "AI Fruit Story"), A("7497468b", "Clay Rescue"), A("5c31f2a6", "Micro Camera"), A("c9aa4be1", "2AM Worlds"), A("ca99eb24", "Image generator")], fact_ids: ["short_templates", "lf_styles"] }),
      S("spotlight", "Change any *scene*", { body: "Edit, reword or regenerate any scene before you download in 1080p.", assets: [A("0745798a", "Long Form")], fact_ids: ["lf_edit_scenes", "lf_download"] }),
      S("cta_button", "Your first video is *one idea* away", { body: "Make your first video →", assets: [A("1c7b7ebf", "Long Form"), A("70670962", "AI Fruit Story"), A("87120f07", "Clay Rescue")] }),
    ],
  },
  {
    key: "how_it_works", title: "How Zyvo makes a YouTube video",
    slides: [
      S("feature_hero", "From one idea to a *YouTube video*", { assets: [A("8b3f14dd", "Long Form"), A("f6f26278", "Long Form thumbnail"), A("1c7b7ebf", "Long Form")], callout: "About 150 scenes in a 10-minute video", fact_ids: ["lf_scenes", "lf_pipeline"] }),
      S("ui_prompt", "Type *one idea*", { label: "1", prompt: "Why did the Romans build roads that still exist?", body: "Or get 10 ideas for your niche.", fact_ids: ["lf_ideas"] }),
      S("ui_checklist", "Zyvo does the *rest*", { label: "2", items: ["Researches the topic", "Writes the script", "Voice-over: 33 English voices", "Draws about 150 scenes", "Writes your YouTube title"], fact_ids: ["lf_pipeline", "lf_voices", "lf_scenes", "lf_youtube_text"] }),
      S("ui_result", "Your *finished video*", { label: "3", body: "Download in 1080p, with 3 thumbnails drawn from your video.", assets: [A("cd029a72", "Long Form")], fact_ids: ["lf_download", "lf_thumbnails"] }),
      S("cta_button", "Try it with *your* idea", { body: "Make your first video →", assets: [A("0745798a", "Long Form"), A("45abd39f", "Long Form thumbnail")] }),
    ],
  },
];

const { data: facts } = await db.from("cm_facts").select("key,category").eq("status", "active");
const { data: assets } = await db.from("cm_assets").select("ref,path,status,subtitles,prompt").eq("status", "active");
const { data: lib } = await db.from("cm_library").select("spec").eq("kind", "style").eq("key", "zyvo_brand").single();
const { data: logoRow } = await db.from("cm_logos").select("logo_path").eq("domain", "tryzyvo.com").single();
const byRef = new Map(assets.filter((a) => a.subtitles !== "cut").map((a) => [a.ref, a]));
const opts = { assetRefs: new Set(byRef.keys()), assetPrompts: new Map(), factKeys: new Set(citable(facts).map((f) => f.key)) };
const local = async (p, name) => {
  const { data, error } = await db.storage.from("content-machine").download(p);
  if (error) throw new Error(`${p}: ${error.message}`);
  const f = path.join(outDir, "pics", name);
  writeFileSync(f, Buffer.from(await data.arrayBuffer()));
  return pathToFileURL(f).href;
};
mkdirSync(path.join(outDir, "pics"), { recursive: true });
const logo = await local(logoRow.logo_path, "zyvo-logo.png");
const report = {};
for (const sample of SAMPLES) {
  const slideshow = { title: sample.title, slides: sample.slides, virality_score: 6, tools_checked: [] };
  const problems = zyvoProblems(slideshow, { account: "zyvo", format: sample.key }, opts);
  if (problems.length) { console.log(`${sample.key}: the checks refuse it: ${problems.join(" | ")}`); report[sample.key] = { problems }; continue; }
  const galleries = {};
  for (const [i, sl] of sample.slides.entries()) {
    if (!sl.assets.length) continue;
    galleries[i] = [];
    for (const a of sl.assets) galleries[i].push({ url: await local(byRef.get(a.asset_id).path, `${a.asset_id}.${byRef.get(a.asset_id).path.split(".").pop()}`), label: a.label });
  }
  const job = { style: lib.spec, logos: { "tryzyvo.com": logo }, zyvoShot: null, images: { background: null, heroes: {}, galleries }, slideshow: { slides: sample.slides }, secondsPerSlide: 2.5 };
  report[sample.key] = {};
  for (const [name, zones] of [["zones", true], ["clean", false]]) {
    const out = await renderSlideshow(job, path.join(outDir, sample.key, name), { local: true, safeZones: zones, keepGoing: true });
    report[sample.key][name] = { problems: out.layoutProblems, warnings: out.layoutWarnings, slides: out.pngs.length };
    console.log(sample.key, name, JSON.stringify(report[sample.key][name]));
  }
}
writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
await new Promise((r) => setTimeout(r, 300));
