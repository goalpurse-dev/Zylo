// Zyvo Studio "Trend radar" (owner, 2026-11-03): the daily scout names AI video formats that may be rising; this checks
// each one on the public pages ($0: YouTube search results and TikTok video pages, read like a browser) and keeps only
// real links with real view counts. Rising = 2+ videos from 2+ different creators with 1M+ views, posted in the last
// 4 weeks. Then: can a Zyvo template make it?
//   YES, and the Studio has a matching real creation (radar/bases.json) -> a "Trend how-to" recipe is written and its
//        script is queued for the owner's approval in the Studio tab (nothing renders or is paid before that)
//   YES, but no matching creation yet -> listed as "needs a creation" (a generation is a separate, owner-approved run)
//   NO  -> the "Template ideas" list in the Studio tab (trend, examples, views, how hard to build)
// Candidates: the latest scout report's ai_video_trends + radar/seeds.json (the owner may add lines there).
//   node trendRadar.mjs [--queue]      writes content/studio-worker/radar/radar.json; --queue also queues the scripts
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, "../../content/studio-worker/radar");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MIN_VIEWS = 1_000_000, MAX_AGE_DAYS = 28;

/** Which Zyvo template makes a format (studio: the Studio can capture its screens and render a how-to from it). */
export const TEMPLATE_FIT = [
  { re: /\bwhat if\b|hypothetical|explainer|how did .* (survive|live)|history (of|explained)|documentary|narrat/i, template: "long_form", studio: true, name: "Long Form" },
  { re: /cutaway|cross[- ]section|inside (a|the|of)|x-?ray of|3d (what if|explainer)/i, template: "cutaway", studio: true, name: "Cutaway Explainer" },
  { re: /fruit|vegetable.*(drama|love|cheat)|food (drama|people)/i, template: "ai_fruit_story", studio: true, name: "AI Fruit Story" },
  { re: /blocky|minecraft|voxel|lego|brick/i, template: "blocky_stories", studio: true, name: "Blocky Stories" },
  { re: /skeleton/i, template: "image_video", studio: false, name: "Image Generator (Viral Skeleton style) + Video Generator" },
  { re: /micro ?camera|tiny camera|camera (on|strapped)/i, template: "micro_camera_animal", studio: false, name: "Micro Camera Animal" },
  { re: /face asmr|asmr face/i, template: "face_asmr", studio: false, name: "Face ASMR" },
  { re: /clay|claymation|stop[- ]motion/i, template: "clay_rescue", studio: false, name: "Clay Rescue" },
  { re: /cooking|recipe|chef/i, template: "ai_cooking", studio: false, name: "AI Cooking-matic" },
  { re: /30 days|thirty days|day \d+ of/i, template: "thirty_days", studio: false, name: "Thirty Days" },
  { re: /lip ?sync|talking (photo|portrait)/i, template: "lip_sync", studio: false, name: "Lip Sync" },
];
export const fitOf = (t) => TEMPLATE_FIT.find((f) => f.re.test(`${t.name} ${t.looks_like ?? ""}`)) ?? null;

const parseViews = (s) => { const m = String(s ?? "").replace(/,/g, "").match(/([\d.]+)\s*([KMB])?/i); if (!m) return 0; return Math.round(Number(m[1]) * ({ K: 1e3, M: 1e6, B: 1e9 }[(m[2] ?? "").toUpperCase()] ?? 1)); };
const ageDays = (s) => { const m = String(s ?? "").match(/(\d+)\s*(second|minute|hour|day|week|month|year|[smhdwy]|mo)/i); if (!m) return null; const u = m[2].toLowerCase(); const n = Number(m[1]); return u.startsWith("mo") ? n * 30 : u.startsWith("y") ? n * 365 : u.startsWith("w") ? n * 7 : u.startsWith("d") ? n : 0; };

/** YouTube search, uploaded this month, sorted by views: [{ url, title, channel, views, age_days }]. */
export async function youtubeSearch(q) {
  const h = await (await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAMSBAgEEAE%3D&hl=en&gl=US`, { headers: { "User-Agent": UA, "Accept-Language": "en-US" } })).text();
  const raw = h.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1]; if (!raw) return [];
  const out = [], text = (x) => x?.simpleText ?? (x?.runs ?? []).map((r) => r.text).join("");
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    if (o.videoRenderer) { const v = o.videoRenderer; out.push({ url: `https://www.youtube.com/watch?v=${v.videoId}`, id: v.videoId, title: text(v.title), channel: text(v.ownerText), views: parseViews(text(v.viewCountText)), age_days: ageDays(text(v.publishedTimeText)), platform: "YouTube" }); }
    Object.values(o).forEach(walk);
  })(JSON.parse(raw));
  return out;
}
/** A public TikTok video's own numbers, from its page. */
export async function tiktokVideo(url) {
  const h = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
  const raw = h.match(/id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s)?.[1]; if (!raw) return null;
  const it = JSON.parse(raw)?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct; if (!it?.id) return null;
  const s = it.statsV2 ?? it.stats;
  return { url: `https://www.tiktok.com/@${it.author.uniqueId}/video/${it.id}`, id: it.id, title: it.desc, channel: `@${it.author.uniqueId}`, views: Number(s.playCount), saves: Number(s.collectCount ?? 0), age_days: Math.floor((Date.now() / 1000 - Number(it.createTime)) / 86400), platform: "TikTok", thumb: it.video?.cover ?? null };
}

const words = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["videos", "video", "the", "and", "how", "make", "with"].includes(w));
/** One candidate checked: its real qualifying examples and whether it is rising. */
export async function checkTrend(t, { search = youtubeSearch, tiktok = tiktokVideo, pause = 1500 } = {}) {
  const key = words(t.name), seen = new Map(), match = t.match ? new RegExp(t.match, "i") : null;
  for (const q of (t.queries?.length ? t.queries : [t.name]).slice(0, 3)) {
    // YouTube sometimes answers a quick run of searches with an empty page: a pause, and one more try
    let found = await search(q).catch(() => []);
    if (!found.length) { await new Promise((r) => setTimeout(r, pause * 3)); found = await search(q).catch(() => []); }
    for (const v of found) {
      // a big but unrelated video never counts: the trend's own title pattern, else every word of its name
      if (match ? !match.test(v.title) : !key.every((k) => v.title.toLowerCase().includes(k))) continue;
      seen.set(v.url, v);
    }
    await new Promise((r) => setTimeout(r, pause));
  }
  for (const u of (t.example_urls ?? []).filter((x) => /tiktok\.com\/@[^/]+\/video\/\d+/.test(x)).slice(0, 6)) { const v = await tiktok(u).catch(() => null); if (v) seen.set(v.url, v); }
  const hits = [...seen.values()].filter((v) => v.views >= MIN_VIEWS && v.age_days != null && v.age_days <= MAX_AGE_DAYS).sort((a, b) => b.views - a.views);
  const creators = new Set(hits.map((v) => v.channel));
  return { ...t, checked: new Date().toISOString().slice(0, 10), rising: hits.length >= 2 && creators.size >= 2, examples: hits.slice(0, 6), hits: hits.length, creators: creators.size };
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
const short = (n) => n >= 1e6 ? `${Math.floor(n / 1e5) / 10}M` : `${Math.floor(n / 1e2) / 10}K`;   // rounded down: never more than the real count
/** A Trend how-to recipe for a rising trend from a matching base (its real creation, clip and step screens). */
export function draftRecipe(t, base) {
  const [a, b] = t.examples;
  const phrase = t.search_phrase ?? `how to make ${t.name} videos`;
  const topic = phrase.replace(/^how to make\s+/i, "");
  return {
    ...base.recipe, key: `th_${slug(t.name)}`, structure: "trend_howto", auto: { from: "trend radar", checked: t.checked },
    trend: t.name, search_phrase: phrase, title: ["HOW TO MAKE", topic.toUpperCase()],
    search_title: `${phrase[0].toUpperCase()}${phrase.slice(1)} with AI (3 steps)`,
    rising: { evidence: `${t.examples.length} videos with 1M+ views from ${t.creators} creators in the last 4 weeks: ${t.examples.slice(0, 4).map((v) => `${v.views.toLocaleString("en-US")} (${v.channel}, ${v.age_days} days)`).join("; ")}`, checked: t.checked },
    urgency: false,
    examples: [a, b].map((v, i) => ({ file: `ex_${slug(t.name)}_${i + 1}.jpg`, views: short(v.views), credit: `${v.channel.replace(/^@/, "@")} · ${v.platform}`, url: v.url, title: v.title, checked: `${t.checked} (${v.views.toLocaleString("en-US")} views)`, thumb: v.platform === "YouTube" ? `https://i.ytimg.com/vi/${v.id}/maxresdefault.jpg` : v.thumb ?? null })),
    hook: { text: `Here's ${phrase} with AI.`, key: topic.split(/\s+/)[0] },
    proof: { text: "Wait, these get millions of views?", key: "millions" },
    caption: `${phrase[0].toUpperCase()}${phrase.slice(1)} with AI, in 3 steps 🤯 These are pulling millions of views right now (examples: ${[a, b].map((v) => `${v.channel} on ${v.platform}`).join(", ")}, not mine). Mine was made with Zyvo. Link in bio.`,
    hashtags: [`#${slug(phrase).replace(/_/g, "")}`, `#${slug(topic).replace(/_/g, "")}`, "#aivideo", "#facelessyoutube", "#youtubeautomation"],
  };
}

async function main() {
  const queue = process.argv.includes("--queue");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const seeds = JSON.parse(fs.readFileSync(path.join(HERE, "radar", "seeds.json"), "utf8"));
  const bases = JSON.parse(fs.readFileSync(path.join(HERE, "radar", "bases.json"), "utf8"));
  const { admin } = await import("file:///C:/Users/Public/Zylo/scripts/blocky/lib.mjs");
  const db = admin();
  const scout = (await db.from("cm_scout_reports").select("created_at, report").order("created_at", { ascending: false }).limit(1)).data?.[0];
  const fromScout = (scout?.report?.ai_video_trends ?? []).map((t) => ({ ...t, from: `scout ${scout.created_at.slice(0, 10)}` }));
  const all = [...fromScout, ...seeds.map((t) => ({ ...t, from: "seeds" }))].filter((t, i, a) => a.findIndex((x) => slug(x.name) === slug(t.name)) === i);
  const prev = fs.existsSync(path.join(OUT_DIR, "radar.json")) ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, "radar.json"), "utf8")) : { template_ideas: [] };
  const trends = [];
  for (const t of all) {
    const r = await checkTrend(t), fit = fitOf(t), base = fit && bases.find((b) => b.template === fit.template && new RegExp(b.fits, "i").test(`${t.name} ${t.looks_like ?? ""}`));
    r.fit = fit ? { template: fit.template, name: fit.name, studio: fit.studio } : null;
    r.status = !r.rising ? "not rising" : !fit ? "template idea" : !fit.studio ? "Zyvo can make it; the Studio has no kit for this template yet" : !base ? "needs a matching creation" : "script";
    console.log(`${r.rising ? "RISING" : "      "} ${t.name}: ${r.hits} with 1M+ (${r.creators} creators) -> ${r.status}`);
    if (r.status === "script") {
      const R = draftRecipe(r, base), file = path.join(HERE, "recipes", `trend_auto_${slug(t.name)}.json`);
      // a trend that already has a recipe (hand-written or from an earlier day) gets no second one
      const have = fs.readdirSync(path.join(HERE, "recipes")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(HERE, "recipes", f), "utf8")))
        .find((x) => x.structure === "trend_howto" && x.search_phrase?.toLowerCase() === R.search_phrase.toLowerCase());
      r.recipe_key = have?.key ?? R.key;
      if (have) console.log(`  already has a recipe: ${have.key}`);
      else if (!fs.existsSync(file)) {
        for (const e of R.examples) if (e.thumb) { const img = await fetch(e.thumb); if (img.ok) fs.writeFileSync(path.join(path.resolve(HERE, "../../content/studio-worker/src_work"), R.screens, e.file), Buffer.from(await img.arrayBuffer())); }
        fs.writeFileSync(file, JSON.stringify(R, null, 1));
        if (queue) {
          const { data: open } = await db.from("cm_studio_jobs").select("id").contains("recipe", { recipe_key: R.key }).limit(1);
          if (!open?.length) {
            await db.from("cm_studio_jobs").insert({ batch_id: crypto.randomUUID(), template: R.template, mode: "prompt", prompt: `Trend how-to: ${R.key} (trend radar)`,
              recipe: { angle: "TH", angle_name: "Trend how-to", preset: "trend_howto", recipe_key: R.key, hook_type: "trend_howto", world: "studio", length_bucket: "20-40", end_trigger: "link_in_bio", famous_name: false, template: R.template },
              source: { kind: base.source_kind, id: R.creation.id, title: R.creation.title }, estimate: { usd: 0.05, why: "Hand-written script ($0); its voice lines once (about $0.04–0.06, at most $0.25); the render is on the laptop ($0)." },
              status: "queued", created_by: "trend radar" });
            console.log(`  queued its script for approval: ${R.key}`);
          }
        }
      }
    }
    trends.push(r);
  }
  // the Template ideas list keeps what it had (the owner decides), refreshed by name
  const ideas = new Map((prev.template_ideas ?? []).map((x) => [slug(x.name), x]));
  for (const r of trends.filter((x) => x.status === "template idea")) ideas.set(slug(r.name), { name: r.name, looks_like: r.looks_like ?? "", examples: r.examples.slice(0, 3).map(({ url, views, channel, platform, age_days }) => ({ url, views, channel, platform, age_days })), first_seen: ideas.get(slug(r.name))?.first_seen ?? r.checked, checked: r.checked, hard: r.hard ?? ideas.get(slug(r.name))?.hard ?? "not judged yet" });
  const report = { day: new Date().toISOString().slice(0, 10), trends, template_ideas: [...ideas.values()] };
  fs.writeFileSync(path.join(OUT_DIR, "radar.json"), JSON.stringify(report, null, 1));
  console.log(`${trends.filter((t) => t.rising).length} rising of ${trends.length}; ${report.template_ideas.length} template ideas`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { await main(); setTimeout(() => process.exit(0), 300); }
