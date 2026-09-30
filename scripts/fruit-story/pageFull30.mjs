// Results page for the full 30-second V2 story: the stitched final video, every
// clip (with frames, exact prompt, model, real cost, credits, what speech-to-text
// heard, ratings), and every scene picture with its prompt.
//   node scripts/fruit-story/pageFull30.mjs <outFile> <assetsDir>
//   assetsDir: final.mp4, clips/scene<N>.mp4, scene<N>-frames.jpg (see the frames step)
//   ratings: data/fruit-phase3/full30-ratings.json {"<idx>": {lip, cons, motion, speaker, cuts, tone, note}}
import fs from "fs";
import path from "path";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, assetsDir] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/full30-results.json`, "utf8"));
const ratingsFile = `${ROOT}/data/fruit-phase3/full30-ratings.json`;
const R = fs.existsSync(ratingsFile) ? JSON.parse(fs.readFileSync(ratingsFile, "utf8")) : {};
const CREDIT_USD = 16 / 750;   // cheapest credit (Starter yearly)
const stars = (n) => `${"●".repeat(n)}${"○".repeat(5 - n)} ${n}/5`;
const clean = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\bnineteen\b/g, "19").replace(/\s+/g, " ").trim();
const exact = (a, b) => clean(a) === clean(b);

const total = Object.values(r.costs).reduce((a, b) => a + b, 0);
const credits = r.balanceBefore - r.balanceAfter;
const revenue = credits * CREDIT_USD;
const margin = revenue ? (revenue - total) / revenue : 0;
const clipSec = r.scenes.reduce((s, x) => s + Number(x.durationSec), 0);
const exactCount = r.scenes.filter((s) => exact(s.heard, s.line)).length;
const fallbacks = r.scenes.filter((s) => s.model !== "alibaba:wan@2.6-flash").length;
const finalSec = r.story.finalResponse?.durationSec ?? null;

const clipCards = [];
for (const s of r.scenes) {
  const n = s.idx + 1;
  const g = R[s.idx] ?? {};
  clipCards.push({
    video: `clips/scene${n}.mp4`,
    stripUri: await dataUri(path.join(assetsDir, `scene${n}-frames.jpg`)),
    title: `Scene ${n} · ${s.speakerId}: "${s.line}"`,
    tone: g.tone,
    meta: [
      ["In frame", s.presentIds.join(", ")], ["Shot", s.shot], ["Model", s.model], ["Length", `${s.durationSec} s`],
      ["Real cost", `$${s.cost.toFixed(4)} = $${(s.cost / s.durationSec).toFixed(4)}/s`], ["Credits charged", `${s.credits}`],
      ["Saved == sent", s.saved ? "yes" : "no"], ["Heard (speech-to-text)", s.heard], ["Transcript exact", exact(s.heard, s.line) ? "yes" : "no"],
      ...(g.lip ? [["Lip sync", stars(g.lip)], ["Consistency vs picture", stars(g.cons)], ["Motion (no warping)", stars(g.motion)], ["Speaker clearly talking", stars(g.speaker)], ["No cuts", g.cuts]] : []),
    ],
    note: g.note,
    prompt: s.clipPrompt,
  });
}
const picCards = [];
for (const s of r.scenes) picCards.push({ image: s.imageUrl, title: `Scene ${s.idx + 1} picture · ${s.shot}`, meta: [["Action", s.action], ["Emotion", s.emotion], ...(s.placement ? [["Placement", s.placement]] : [])], prompt: s.imagePrompt });

const loc = (r.story.locations ?? []).map((l) => `<b>${l.id}</b>: ${l.description} (${l.timeOfDay}; ${l.lighting})`).join("<br>");
const html = await renderResultsPage({
  title: "Fruit 30s Story",
  intro: `One full 30-second AI Fruit Story on V2 (Wan2.6 Flash), made end to end through the real product path as the test account: a random 3-character idea → script (Claude Sonnet 5) → 6 scene pictures → animate all → final video with captions on a Fly machine. No retries. Idea: <b>${r.idea.title}</b>: ${r.idea.summary} I judged each clip from 2 frames per second plus a speech-to-text transcript; lip timing needs a watch with sound.`,
  stats: [
    { value: `$${total.toFixed(2)}`, label: `real cost (script $${r.costs.planner.toFixed(3)} · pictures $${r.costs.pictures.toFixed(3)} · clips $${r.costs.clips.toFixed(3)} · final $${r.costs.final.toFixed(4)})` },
    { value: `${credits} credits`, label: `charged (pictures + clips; script and final are free)` },
    { value: `${Math.round(margin * 100)}%`, label: `margin at the cheapest credit ($${revenue.toFixed(2)} revenue)`, tone: margin >= 0.5 ? "good" : margin >= 0.4 ? "warn" : "bad" },
    { value: `${exactCount} / ${r.scenes.length}`, label: "clips with the exact full line", tone: exactCount === r.scenes.length ? "good" : "warn" },
    { value: `${fallbacks}`, label: "Seedance fallbacks" },
    { value: finalSec ? `${finalSec} s` : "n/a", label: `final video (${clipSec} s of clips, ${r.story.final.trimmedSec} s of silence trimmed)` },
    { value: `${(r.timings.totalSec / 60).toFixed(1)} min`, label: `wall clock (script ${r.timings.scriptSec.toFixed(0)} s · pictures ${r.timings.picturesSec.toFixed(0)} s · clips ${r.timings.clipsSec.toFixed(0)} s · final ${r.timings.finalSec.toFixed(0)} s)` },
  ],
  sections: [
    { heading: `Final video: "${r.story.title}"`, text: `Clips joined in order, leading/trailing silence trimmed (0.25 s kept), captions burned in from the exact lines. 720 × 1280.`, cards: [{ video: "final.mp4", title: r.story.title, meta: [["Length", `${finalSec} s`], ["Trimmed per clip", (r.story.final.trimmedPerClipSec ?? []).map((n) => `${n} s`).join(", ")], ["Machine time", `${r.story.finalResponse?.seconds?.toFixed?.(1) ?? "?"} s of ffmpeg`], ["Machine cost", `$${r.costs.final.toFixed(4)}`]] }] },
    { heading: "Clips (V2 = Wan2.6 Flash, 720p, audio)", cards: clipCards },
    { heading: "Scene pictures (Nano Banana 2 Lite)", text: `Locations:<br>${loc}`, cards: picCards },
  ],
  decisions: R._decisions ?? [],
});
fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
