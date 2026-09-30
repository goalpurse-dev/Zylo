// Results page for the stage 3e checkpoint: every clip side by side with its
// exact prompt, real cost/s, credits charged, what the speech-to-text heard,
// and ratings (lip sync, character consistency, motion, speaker clarity).
import fs from "fs";
import path from "path";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outFile, assetsDir] = process.argv.slice(2);
const r = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3e-results.json`, "utf8"));
const spend = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/spend.json`, "utf8")).entries;
const stage = spend.filter((e) => e.stage === "3e").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const wan = r.bakeoff.find((b) => b.label === "Wan2.6 Flash");
const frames = (key) => path.join(assetsDir, `${key}-frames.jpg`);
const stars = (n) => `${"●".repeat(n)}${"○".repeat(5 - n)} ${n}/5`;
const rate = (lip, cons, motion, speaker) => [["Lip sync", stars(lip)], ["Consistency vs picture", stars(cons)], ["Motion (no warping)", stars(motion)], ["Speaker clearly talking", stars(speaker)]];

const RATINGS = {
  "v2-scene1": { r: rate(4, 5, 5, 5), note: "Gloria talks in the foreground, mouth moving through the line; Rick and Bella stay put behind the glass. Smooth push-in, no warping. Transcript exact." },
  "v2-scene2": { r: rate(3, 5, 4, 3), note: "All words present (a stammer on the cut-off \"it\"). Rick turns to profile for most of the clip, so his mouth is hard to read, and Gloria's mouth drops open at the end, which can read as her talking." },
  "v2-scene3": { r: rate(3, 4, 2, 4), tone: "bad", note: "Seedance cut to a second shot in the last second: the camera swings off Bella onto Gloria walking, and the last word \"Gloria\" is lost (transcript stops at \"knock\"). Seedance 2.0 makes multi-shot clips unless told not to." },
  "v4-scene3": { r: rate(4, 5, 4, 5), note: "Full line in 4 s including \"Gloria\". Face to camera while talking; in the last second Bella turns and walks away." },
  "bakeoff-wan2-6-flash": { r: rate(4, 5, 5, 5), tone: "good", note: "Full line in 4 s including \"Gloria\". Face to camera the whole time, no cut, Gloria stays in the background. Its docs only promise ambient audio, but it spoke the dialogue cleanly." },
};

const card = (key, c, title, extra = []) => ({
  video: `clips/${key}.mp4`,
  image: frames(key),
  title,
  tone: RATINGS[key]?.tone,
  meta: [["Model", c.model], ["Length", `${c.durationSec} s`], ["Real cost", `$${c.cost.toFixed(4)} = $${(c.cost / c.durationSec).toFixed(4)}/s`], ...extra, ["Heard (speech-to-text)", c.transcript ?? "(none)"], ...(RATINGS[key]?.r ?? [])],
  note: RATINGS[key]?.note,
  prompt: c.prompt,
});

// Two media per card: the playable clip and the 2 fps frame strip underneath.
async function withStrip(c) {
  const strip = await dataUri(c.image);
  return { ...c, image: undefined, stripUri: strip };
}

const v2Cards = [];
for (const c of r.v2) v2Cards.push(await withStrip(card(`v2-scene${c.idx + 1}`, c, `V2 · scene ${c.idx + 1} · ${c.speakerId}: "${c.line}"`, [["Credits charged", `${c.credits}`], ["Saved == sent", c.saved ? "yes" : "no"]])));
const v4Card = await withStrip(card("v4-scene3", r.v4, `V4 · scene 3 · ${r.v4.speakerId}: "${r.v4.line}"`, [["Credits charged", `${r.v4.credits} (via one-job test override)`]]));
const wanCard = wan?.clipUrl ? await withStrip(card("bakeoff-wan2-6-flash", { ...wan, model: wan.model }, `Bake-off · Wan2.6 Flash · scene 3 (same prompt)`, [["Size", wan.size]])) : null;

const f3d = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-final.json`, "utf8"));
const r3d = JSON.parse(fs.readFileSync(`${ROOT}/data/fruit-phase3/3d-redo.json`, "utf8"));
const pic = (x, n) => ({ image: x.newUrl, title: `Scene ${n}`, meta: [["Real cost", `$${x.job.cost.toFixed(4)}`], ["Prompt chars", `${x.prompt.length}`]], prompt: x.prompt });
const pics = [pic(f3d.redo.find((x) => x.idx === 0), 1), pic(f3d.redo.find((x) => x.idx === 1), 2), pic(r3d.redo.find((x) => x.idx === 2), 3)];

const ltx = r.bakeoff.find((b) => b.label === "LTX-2.3");
const mini480 = r.bakeoff.find((b) => b.label.includes("480p"));

const html = await renderResultsPage({
  title: "Fruit Clips Bake-off",
  intro: `Stage 3e on "Glass Walls Don't Lie". The V2 story was animated through the real API (animate all → worker → Runware webhook → Storage), one V4 clip went through the normal charging path with a single-use admin override, and scene 3 was also rendered on Wan2.6 Flash with the same prompt. I judged each clip from 2 frames per second plus a speech-to-text transcript; please watch them with sound for lip timing, which frames can't show.`,
  stats: [
    { value: `$${stage.toFixed(4)}`, label: "stage 3e spend of $2.20 ($1.80 + buffer)" },
    { value: `$${total.toFixed(4)}`, label: "Phase 3 total of $4.00" },
    { value: `$${r.v2PerSec.toFixed(4)}/s`, label: "Seedance 2.0 Mini, 720p, i2v, audio (measured)", tone: "warn" },
    { value: `$${(r.v4.cost / r.v4.durationSec).toFixed(4)}/s`, label: "Veo 3.1 Fast, 720p, audio (measured)" },
    { value: wan ? `$${(wan.cost / 4).toFixed(4)}/s` : "n/a", label: "Wan2.6 Flash, 720p, audio (measured)", tone: "good" },
    { value: "4 / 5", label: "clips with the exact full line (V2 scene 3 lost its last word)" },
    { value: `${r.balanceBefore.credit_balance - r.balanceAfter.credit_balance} credits`, label: "charged: 3 × 25 (V2) + 40 (V4), matches the ledger" },
  ],
  sections: [
    {
      heading: "The 3 pictures these clips start from (3d final)",
      text: "Late-afternoon golden light in all three. Scene 1: Gloria in the foreground outside the glass, head about 30% of the frame height (passes the quarter rule); Rick and Bella behind the glass. Scene 2 is still fairly wide (Rick's head about 18% of the height).",
      cards: pics,
    },
    { heading: "V2 story: Seedance 2.0 Mini (3 clips, 5 s each)", cards: v2Cards },
    { heading: "Scene 3 three ways: Seedance Mini 5 s vs Veo 3.1 Fast 4 s vs Wan2.6 Flash 4 s", cards: [v2Cards[2], v4Card, wanCard].filter(Boolean) },
    {
      heading: "What didn't run",
      layout: "list",
      cards: [{
        title: "Two bake-off entries",
        body: [
          `<b>LTX-2.3:</b> refused by Runware before rendering ($0): "${ltx?.refused ?? "n/a"}". The Runware account's available balance was too low at that moment (some of it reserved by other requests in progress). I did not retry.`,
          `<b>Seedance 2.0 Mini at 480p:</b> skipped by the budget guard (its worst-case reservation would have passed the $2.20 stage cap). So the \"$0.036/s at 480p\" price is still unverified; at 720p, which is what Mini's docs list for image-to-video, the measured price is $${r.v2PerSec.toFixed(4)}/s, not $0.036/s.`,
        ],
      }],
    },
  ],
  decisions: [
    `<b>Pick V2:</b> Seedance 2.0 Mini ($${r.v2PerSec.toFixed(3)}/s) or Wan2.6 Flash ($${wan ? (wan.cost / 4).toFixed(3) : "?"}/s)? On this one scene Wan was cleaner (no cut, face to camera the whole time) and about 40% cheaper; Mini was solid on scenes 1–2. One scene is a small sample.`,
    "<b>No-cut rule ($0, recommended either way):</b> add \"one continuous shot, no cuts; the speaker keeps facing the camera until the line ends\" to every clip prompt, which fixes the scene 3 cut on Seedance.",
    "<b>Final prices (≈40% margin at plan credit value $0.0266; pack credits $0.02 give less):</b> Wan V2 → <b>4 cr/s</b> (53% plan / 37% pack) or Mini V2 → <b>6 cr/s</b> (49% / 32%); V4 Veo 3.1 Fast → <b>10 cr/s</b> (44% / 25%, as today); V3 Seedance Fast is unmeasured (list $0.13/s → 9 cr/s). Pictures stay 3 cr (58% / 42%).",
    "<b>Runware balance:</b> LTX-2.3 was refused for low available balance. Top up before 3f/3g? (3f needs no Runware; 3g needs about 5 pictures.) If you want LTX-2.3 tested too, it's about $0.16 for the same 4 s scene.",
  ],
});

fs.writeFileSync(outFile, html);
console.log("written", outFile, (html.length / 1024).toFixed(0) + " KB");
