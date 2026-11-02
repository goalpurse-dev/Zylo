// Zyvo Studio v2: the Queue spec of a video (for publishToQueue.mjs): captions, a search title, tracked links (added by the
// publisher), the AI label (always on) and its recipe (angle, hook type, world, length bucket, famous name, end trigger,
// the creation shown) for the learning loop.
//   node storyPublish.mjs <script.json> <video.mp4> <out spec.json> [spend usd]
import fs from "node:fs";
const [scriptPath, mp4, outPath, usd] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const plain = (t) => t.replace(/[|*]/g, " ").replace(/\s+/g, " ").trim();
const hook = plain(S.headline.text), trigger = S.lines.at(-1).text;
const tags = S.hashtags?.length ? S.hashtags : ["#aivideo", "#zyvo"];
const search = S.search_title ?? S.title;
const caption = S.caption ?? `${S.title}. ${trigger} tryzyvo.com`;
const day = new Date().toISOString().slice(0, 10);
const spec = {
  mp4, coverAt: 0.3, title: S.title, account: "zyvo", template: S.template, route: { ai_fruit_story: "/workspace/ai-fruit-story", blocky_stories: "/workspace/blocky-stories", cutaway: "/workspace/cutaway-explainer", long_form: "/long-form" }[S.template] ?? "/", cta: S.cta.id, hook,
  concept: `Studio v2 ${S.recipe.angle}: ${S.title}. World: ${S.world}. Shows the real creation ${S.source_story?.slice(0, 8)}.`,
  script: { source: "studio v2", lines: S.lines.map((l) => `${l.who}: ${l.text}`), ...(S.claude_log ? { claude_log: S.claude_log } : {}) },
  recipe: { ...S.recipe, studio_variant: S.variant, experiment: S.energy ? "studio_friend_v3" : "studio_v2" },
  claims: S.lines.filter((l) => l.stamp).map((l) => l.stamp),
  measured: {},
  packages: {
    tiktok: { title: search, caption: `${caption} ${trigger === caption ? "" : ""}`.trim(), hashtags: tags },
    instagram: { caption: `${caption} Link in bio: tryzyvo.com`, hashtags: tags },
    youtube: { title: `${search} (made with Zyvo)`.slice(0, 95), caption: `${search}. ${caption} Try it: tryzyvo.com`, hashtags: ["#shorts", ...tags.slice(0, 3)] },
  },
  spend: Number(usd) ? [{ operation: "studio.script_and_voices", usd: Number(usd), day }] : [],
  spend_in_ledger: process.env.IN_LEDGER === "1",   // the worker's calls went through the Budget Guard: already on the ledger
};
fs.writeFileSync(outPath, JSON.stringify(spec, null, 1));
console.log(`${outPath}: ${S.variant}`);
