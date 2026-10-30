// Zyvo Studio: the Queue spec for a short video (for publishToQueue.mjs), from its script and its Retention scorecard.
// Copy is honest: only the measured time (3:50, the live run) and the fact sheet (150 fruit characters); one trigger.
//   [KIT=<kit.json>] node shortPublish.mjs <script.json> <video.mp4> <out spec.json> [<spend usd> <spend what>]
// With KIT (a reused creation of the owner's, studioKit.mjs): no time claim (nothing was measured), its own title.
import fs from "node:fs";
const [scriptPath, mp4, outPath, usd, what] = process.argv.slice(2);
const S = JSON.parse(fs.readFileSync(scriptPath, "utf8"));
const card = JSON.parse(fs.readFileSync(mp4.replace(/\.mp4$/, "_scorecard.json"), "utf8"));
const TRIGGER = { comment: "Comment FRUIT if you're actually gonna try it.", save: "Save this for later.", repost: "Send this to that friend." };
const t = TRIGGER[S.recipe.end_trigger];
const KIT = process.env.KIT ? JSON.parse(fs.readFileSync(process.env.KIT, "utf8")) : null;
const timed = !KIT || KIT.measured;   // the first experiments' creation was measured live (3:50)
const hookText = S.clips[0].hook.replace(/[|*]/g, " ").replace(/\s+/g, " ").trim();
const caption = !timed ? {
  tiktok: `${hookText[0]}${hookText.slice(1).toLowerCase()} 🍒 Made with Zyvo's AI Fruit Story: pick an idea, check the scene pictures, animate, done. ${t} tryzyvo.com`,
  instagram: `${hookText[0]}${hookText.slice(1).toLowerCase()}: an AI Fruit Story made on Zyvo, start to finish. ${t} Link in bio: tryzyvo.com`,
  youtube: "The real flow: Short Form → AI Fruit Story, pick an idea, check the scene pictures, animate, make the final video. Try it: tryzyvo.com",
} : {
  tiktok: `${hookText[0]}${hookText.slice(1).toLowerCase()} 🍒 3 minutes 50 seconds from the first click to this video, with Zyvo's AI Fruit Story. ${t} tryzyvo.com`,
  instagram: `${hookText[0]}${hookText.slice(1).toLowerCase()}: AI Fruit Story on Zyvo, 3:50 from the first click to the final video. ${t} Link in bio: tryzyvo.com`,
  youtube: "The real flow: Short Form → AI Fruit Story, pick an idea and a length, check the scene pictures, animate, make the final video. 3 minutes 50 seconds from the first click. Try it: tryzyvo.com",
};
const day = new Date().toISOString().slice(0, 10);
const spec = {
  mp4, coverAt: 0.05, title: S.title, account: "zyvo", template: S.template, route: "/workspace/ai-fruit-story", cta: S.cta.id,
  hook: hookText, concept: KIT ? `Studio video ${S.recipe.variant}: ${S.recipe.hook_type}, ${card.seconds} s, ends on ONE trigger (${S.recipe.end_trigger}). Reuses the owner's own finished story "${KIT.story.title}" (${KIT.story.id.slice(0, 8)}): no generation cost.`
    : `Retention Engine experiment ${S.recipe.variant}: ${S.recipe.hook_type}, ${card.seconds} s, ends on ONE trigger (${S.recipe.end_trigger}). The same real story as the v3 video (Ten Years Out of Date, 96d3191f).`,
  script: KIT ? { source: "studio worker", story: `${KIT.story.title} (${KIT.story.id.slice(0, 8)})`, reused: true } : { source: `scripts/studio/scripts/short/${S.variant}.json`, story: "Ten Years Out of Date (96d3191f)" },
  recipe: { ...S.recipe, ...(KIT ? { source_story: KIT.story.id } : {}), hook_type: S.recipe.hook_type, length_s: card.seconds, length_target: S.length_target, end_trigger: S.recipe.end_trigger, loop: !!S.loop_end, cta: S.cta.id, studio_variant: S.variant, experiment: KIT ? "studio_worker" : "retention_round_1" },
  retention: { rows: card.rows, seconds: card.seconds },
  claims: ["fruit_characters: 150 fruit characters to cast from (fact sheet)", ...(timed ? ["3:50 from the first click to the finished video (measured live, 2026-10-29)"] : [])],
  measured: timed ? { first_click_to_final_s: 230.2, recorded: "2026-10-29T20:55:49Z" } : {},
  packages: {
    tiktok: { title: S.title.replace(/^Studio V\d · /, ""), caption: caption.tiktok, hashtags: ["#aifruitstory", "#zyvo", "#aivideo", "#fruitdrama"] },
    instagram: { caption: caption.instagram, hashtags: ["#aifruitstory", "#zyvo", "#aivideo", "#reels"] },
    youtube: { title: timed ? "AI Fruit Story in 3:50 (Zyvo)" : `${KIT.story.title}: an AI Fruit Story (Zyvo)`, caption: caption.youtube, hashtags: ["#shorts", "#aifruitstory", "#zyvo"] },
  },
  // the story's AI cost is on the v3 item already (the same creation, reused: $0 here)
  spend: usd ? [{ operation: what, usd: Number(usd), day }] : [],
};
fs.writeFileSync(outPath, JSON.stringify(spec, null, 1));
console.log(`${outPath}: ${S.variant}, ${card.seconds} s, ${card.rows.filter((r) => r.result === "PASS").length}/${card.rows.length} rows pass`);
