// Results page for the pre-test fixes: speech-timed captions (re-rendered
// "Ken Reads Everything"), the framing re-check, the Recent panel states, and
// the plan copy computed from live prices.
//   node scripts/fruit-story/pageRound4.mjs <outFile> <assetsDir>
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, dir] = process.argv.slice(2);
const cap = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3f-final-full30.json`, "utf8"));
const j = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3j-results.json`, "utf8"));
const spend = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/spend.json`, "utf8")).entries;
const total = spend.filter((e) => e.stage !== "full30").reduce((s, e) => s + e.usd, 0);
const shot = (f) => path.join(dir, "shots", f);
const sources = cap.call.response.captionSources ?? [];
const NOTE = {
  0: "Was a full-body shot with Ken's head ~15% of the frame. Now chest up, head ~30%, facing the camera.",
  4: "Was over-the-shoulder: the listener in front came out as a human and Linda's face drifted. Over-the-shoulder is gone; now Linda (a proper lemon) is in front, facing the camera, Rick and Ken behind.",
  5: "Was full body, Ken's head ~17%. Now Ken in front, head ~30%, Linda and Rick smaller behind.",
};

const html = await renderResultsPage({
  title: "Fruit Pre-Test Fixes",
  intro: "Everything from your list before your hands-on test. The 30 s story \"Ken Reads Everything\" was re-rendered with the new captions through the real path (buildFinal → word timestamps → Fly machine). Nothing here was pushed.",
  stats: [
    { value: `${sources.filter((s) => s === "speech-to-text").length} / ${sources.length}`, label: "clips with captions timed from speech-to-text words", tone: "good" },
    { value: `$${Number(cap.captionWords.costUsd).toFixed(4)}`, label: "word timestamps (whisper-1, 6 clips, cached for rebuilds)" },
    { value: `$${Number(cap.call.costUsd).toFixed(4)}`, label: "Fly machine for the re-render (10.6 s of ffmpeg, 1 s upload)" },
    { value: "$0.104", label: "framing re-check (3 pictures)" },
    { value: "116 credits", label: "a 20 s V2 story at live prices → 6 / 13 / 27 a month on Starter / Pro / Generative" },
    { value: `$${total.toFixed(2)}`, label: "Phase 3 total of $4.00 (plus the $1.78 story approved outside it)" },
  ],
  sections: [
    {
      heading: "1. Captions: one line, 2–4 words, timed to the speech",
      text: "The caption text is always the exact line; only the timing comes from speech-to-text (whisper-1 word timestamps per clip, aligned to the line, so a heard \"19\" still shows \"Nineteen\"). Each chunk appears at its first spoken word, never before. The word being said turns lime. Lilita One, centered in the lower third. If word timestamps fail, the line is spread over the detected speech. The first Fly attempt made the video but Storage answered HTTP 520 on upload; uploads now retry 3 times, and the second attempt uploaded in 1 s.",
      cards: [
        { video: "final-new.mp4", title: "New captions (26 s)", tone: "good", meta: [["Caption timing per clip", sources.join(", ")], ["Chunks", "2–4 words, max ~18 characters, one line"], ["Highlight", "current word in lime (#BEF264)"]] },
        { video: "final-old.mp4", title: "Before: whole line in up to 3 lines", meta: [["Shown", "the full line for the whole clip"]] },
      ],
    },
    {
      heading: "2. Framing re-check on scenes 1, 5, 6 (today's builder)",
      text: "Shots are now close-up, medium close-up or chest-up only (over-the-shoulder and wide removed from the planner; older rows are drawn chest-up). Redrawn through an admin-only picture test: no user charge, story untouched.",
      cards: j.redo.flatMap((r) => [
        { image: shot(`s${r.idx + 1}-old.jpg`), title: `Scene ${r.idx + 1} before (${r.oldShot})` },
        { image: shot(`s${r.idx + 1}-new.jpg`), title: `Scene ${r.idx + 1} after`, tone: "good", note: NOTE[r.idx], prompt: r.prompt },
      ]),
    },
    {
      heading: "3. Recent creations",
      text: "Your account: only real stories (plus your old v1 ones, read-only) with the first 3 scene pictures as thumbnails; the 3 mock samples are gone (the v2 API now defaults to the real backend, so a reload can't fall back to mock data). The states below are from the dev preview switches (&viewer=guest|noPlan, &recent=empty).",
      cards: [
        { image: shot("real-1-recent.jpg"), title: "Your account (paid, with history)" },
        { image: shot("guest-panel.jpg"), title: "Guest: example + Sign up to make your own" },
        { image: shot("noplan-panel.jpg"), title: "Signed in, no plan: example + Get a plan (opens the paywall)" },
        { image: shot("empty-panel.jpg"), title: "Paid, no stories: Make your first story + example" },
        { image: shot("phones.jpg"), title: "Phone: guest, no plan, no stories" },
      ],
    },
    {
      heading: "4. Plan copy from live prices",
      text: "A 20 s V2 story = 4 pictures × 4 + about 20 s × 5 cr/s = 116 credits. Counts are computed from the live tool_prices rows, never typed in; while prices load, the line is left out.",
      cards: [
        { image: shot("noplan-paywall.jpg"), title: "Paywall (Fruit only)", body: ["Starter: about 6 videos of 20 s / month on V2", "Pro: about 13 on V2, or 8 on V3", "Generative: about 27 on V2, or 16 on V3, or 9 on V4"] },
        { image: shot("pricing-page.jpg"), title: "Pricing page (/workspace/pricing)", body: ["Headline: About 6 / 13 / 27 complete 20 seconds AI Fruit Story videos / month", "Basis: AI Fruit Story V2 at 116 credits per 20-second video", "Comparison table row: AI Fruit Story V2 · 20s videos / mo"] },
      ],
    },
  ],
  decisions: [
    "<b>Ready for your hands-on test</b> on your flagged account at <code>/workspace/ai-fruit-story</code> (local dev server, or after you push). Everything is committed locally; nothing is pushed.",
    "<b>Ship together:</b> the Pricing page now shows v2 numbers for everyone, so push it with the v2 rollout, not before.",
    "<b>Guests</b> only see v2 once the flag is on for them (the flag needs a signed-in user today), so the guest state is ready but not reachable yet.",
    "<b>Not changed:</b> the SEO page /blog/ai-fruit-story-pricing still explains v1 costs (character portraits); no numbers there. Update it at rollout?",
    "<b>Tutorial:</b> set TUTORIAL_URL in the v2 constants and a \"Watch the tutorial\" link appears on the Recent panel.",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
