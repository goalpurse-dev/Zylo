// Results page for hands-on test #1 follow-ups: credit check, caption gap fix
// (re-rendered "The Surprise Wedding Switch"), length cap, full-price display.
//   node scripts/fruit-story/pageRound5.mjs <outFile> <assetsDir>
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, dir] = process.argv.slice(2);
const shot = (f) => path.join(dir, "shots", f);
const len = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/length-cap.json`, "utf8"));

const html = await renderResultsPage({
  title: "Fruit Test 1 Fixes",
  intro: "Follow-ups from your first hands-on test (\"The Surprise Wedding Switch\"). Everything is committed locally; nothing is pushed. FRUIT_PAID_CALLS is still on for your testing.",
  stats: [
    { value: "189 = 24 + 165 + 0", label: "credits charged, exactly as the ledger says (pictures + 33 s of clips × 5 + free final)", tone: "good" },
    { value: "0 s", label: "caption gaps while someone talks (was ~1 s at the end of Benny's clip)", tone: "good" },
    { value: "≤ chosen length", label: `the planner may never make more clip seconds than you pick (live: 30 s → ${len[0].total} s, 20 s → ${len[1].total} s)`, tone: "good" },
    { value: "$0.0009", label: "Fly re-render of your video (word timestamps were cached)" },
  ],
  sections: [
    {
      heading: "1. Credit check (fruit_credit_ledger, story 3628cf86)",
      layout: "list",
      cards: [{
        title: "Charged exactly as priced; no mismatch, no refunds",
        body: [
          "<b>Pictures</b>: ledger rows 34–39, 6 × 4 = <b>24</b> (reason: pictures).",
          "<b>Clips</b>: rows 40–45, 30 + 30 + 25 + 25 + 25 + 30 = <b>165</b> = (6 + 6 + 5 + 5 + 6 + 5) s × 5 cr/s (reason: animate).",
          "<b>Final video</b>: no ledger rows: <b>0</b>.",
          "Total <b>189</b>. The video had 33 s of clips for a 30 s choice, hence 189 vs the 174 estimate (see 2).",
        ],
      }],
    },
    {
      heading: "2. Captions: the gap at 0:08 (fixed and re-rendered)",
      text: "The final was rendered with captions on and speech-to-text timing for all 6 clips. The cause: Whisper's word times start at 0.00 and end early (Benny spoke until 4.57 s in his clip, Whisper said 3.72 s), and each chunk was hidden 0.6 s after its last word, so the screen went blank while he was still talking. Now the words are stretched onto the speech span measured from the audio, each chunk stays until the next one, and the last stays until the clip ends. Frames below are 5–11 s at 4 per second.",
      cards: [
        { image: shot("before.jpg"), title: "Before: blank from ~8.5 s to the end of Benny's clip", tone: "bad" },
        { image: shot("after.jpg"), title: "After: a caption the whole time he talks", tone: "good" },
        { video: "wedding-fixed.mp4", title: "The Surprise Wedding Switch, re-rendered (your story, updated in place)", meta: [["Caption timing", "speech-to-text × 6, fitted to the audio"], ["Fly", "10.6 s of ffmpeg, $0.0009"]] },
      ],
    },
    {
      heading: "3. Never longer than the length you pick",
      text: "The planner now gets a hard cap (the clips must add up to AT MOST the chosen seconds, every line at most 9 words with one comma per 5 s scene) and one repair if it goes over. The first version still failed a 20 s prompt at 21 s after its repair, so the word budget was tightened. The trade-off: stories come out a little shorter than chosen, never longer or more expensive.",
      layout: "list",
      cards: len.map((r) => ({ title: `${r.label}: ${r.total} s of clips [${r.secs.join(", ")}] in ${r.attempts} attempt(s)`, body: r.lines.map((l) => `“${l}”`), meta: [["Planner cost", `$${r.cost.toFixed(4)}`]] })),
    },
    {
      heading: "4. The full video price, from the start",
      text: "Settings shows the whole video first, then the split. The button says how much of the total it spends. After the script exists the total is exact (every clip's length is known). Episodes use the same screens.",
      cards: [
        { image: shot("desktop-settings.jpg"), title: "Settings: Full video about 116 · 16 now, about 100 when you animate · button 16 of ~116" },
        { image: shot("desktop-writing.jpg"), title: "Right after the click: the storyboard with empty scenes while the script is written" },
        { image: shot("real-episode.jpg"), title: "Scenes step (series episode 1): Spent so far 20 · Animating 75 · Total 95" },
        { image: shot("real-final.jpg"), title: "Final: This video cost 189 credits" },
        { image: shot("phone-settings.jpg"), title: "Phone: settings" },
        { image: shot("phone-writing.jpg"), title: "Phone: the storyboard while writing" },
      ],
    },
  ],
  decisions: [
    "<b>Ready for hands-on test #2</b> on the local dev server (it has every change above).",
    "<b>Soft launch:</b> the plan is in <code>docs/fruit-v2-soft-launch.md</code>: tester flags (SQL), push laptop-transfer → preview check → main (needs your go), VITE_FRUIT_V2=true on Vercel, FRUIT_PAID_CALLS, daily monitoring queries, and five ways to switch it off, fastest first (10 s).",
    "<b>Stories now run a little short</b> (about 80–100% of the chosen length) instead of ever running long. If you'd rather aim closer to the full length, I can raise the lower bound and accept an extra repair call now and then.",
  ],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
