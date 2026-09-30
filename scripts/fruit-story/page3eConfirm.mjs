// Results page for the 3e confirmation run: the 3 "Glass Walls Don't Lie"
// clips on V2 = Wan2.6 Flash (no-cut rule), each with its exact prompt, real
// cost/s, credits charged, what the speech-to-text heard, and ratings.
import fs from "fs";
import path from "path";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, assetsDir] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3e-confirm.json`, "utf8"));
const spend = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/spend.json`, "utf8")).entries;
const stage = spend.filter((e) => e.stage === "3e2").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const stars = (n) => `${"●".repeat(n)}${"○".repeat(5 - n)} ${n}/5`;
const rate = (lip, cons, motion, speaker, cuts) => [["Lip sync", stars(lip)], ["Consistency vs picture", stars(cons)], ["Motion (no warping)", stars(motion)], ["Speaker clearly talking", stars(speaker)], ["No cuts", cuts]];

const RATINGS = {
  0: { r: rate(4, 5, 4, 5, "yes, one shot"), tone: "good", note: "Gloria talks in the foreground with her phone up, mouth moving through the line; Rick and Bella stay behind the glass. Bella's mouth opens in shock for a few frames, which reads as a reaction, not speech. Transcript exact." },
  1: { r: rate(4, 5, 4, 5, "yes, one shot"), tone: "good", note: "Big improvement on the Seedance version: Rick faces the camera the whole time (no profile), leans on the desk mid-line, then straightens. Gloria and Bella stay still with mouths closed. Transcript exact, including the cut-off \"it-\"." },
  2: { r: rate(4, 5, 5, 5, "yes, one shot"), tone: "good", note: "Bella faces the camera throughout with a slow push-in; Gloria stays in the background. The full line including \"Gloria\" lands (the Seedance version lost it to a cut). Transcript exact." },
};

const cards = [];
for (const c of r.clips) {
  const key = `wan-scene${c.idx + 1}`;
  cards.push({
    video: `clips/${key}.mp4`,
    stripUri: await dataUri(path.join(assetsDir, `${key}-frames.jpg`)),
    title: `Scene ${c.idx + 1} · ${c.speakerId}: "${c.line}"`,
    tone: RATINGS[c.idx]?.tone,
    meta: [["Model", `${c.model}${c.fellBack ? " (Seedance fallback)" : ""}`], ["Status", c.status], ["Length", `${c.durationSec} s`], ["Real cost", `$${c.cost.toFixed(4)} = $${(c.cost / c.durationSec).toFixed(4)}/s`], ["Credits charged", `${c.credits}`], ["Saved == sent", c.saved ? "yes" : "no"], ["Heard (speech-to-text)", c.transcript ?? "(none)"], ...(RATINGS[c.idx]?.r ?? [])],
    note: RATINGS[c.idx]?.note,
    prompt: c.prompt,
  });
}

const ok = r.clips.filter((c) => c.status === "succeeded").length;
const fellBack = r.clips.filter((c) => c.fellBack).length;
const html = await renderResultsPage({
  title: "Fruit Wan Confirmation",
  intro: `Stage 3e confirmation on "Glass Walls Don't Lie": the 3 final pictures re-animated on V2 = Wan2.6 Flash through the production path (regenerateClip → worker → Runware webhook → Storage), with the new no-cut rule in every prompt. No retries. I judged each clip from 2 frames per second plus a speech-to-text transcript; lip timing needs a watch with sound.`,
  stats: [
    { value: `${ok} / ${r.clips.length}`, label: "clips succeeded on Wan2.6 Flash", tone: ok === r.clips.length ? "good" : "warn" },
    { value: `${fellBack}`, label: "Seedance fallbacks used" },
    { value: "3 / 3", label: "transcripts exact, full line" },
    { value: "0", label: "cuts (was 1 of 3 on Seedance)", tone: "good" },
    { value: `$${stage.toFixed(4)}`, label: "stage spend of $1.00 cap" },
    { value: `$${total.toFixed(4)}`, label: "Phase 3 total of $4.00" },
    { value: `${r.balanceBefore - r.balanceAfter} credits`, label: "charged: 3 × 25, matches the ledger" },
  ],
  sections: [{ heading: "V2 story on Wan2.6 Flash (3 clips, 5 s each, 720p, audio)", cards }],
  decisions: [
    "<b>Prices:</b> the proposal in docs/fruit-v2-phase3-results.md (4 cr pictures/edits, V2 6 cr/s, V3 9 cr/s, V4 16 cr/s) is not applied yet.",
    "<b>Next:</b> 3f final video on Fly.io (≤ $0.10), then 3g series (≤ $0.30), then 3h connect the UI.",
  ],
});

fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
