// Results page for Blocky Stories test 1 (lip sync on flat decal faces): the
// 3 first-frame pictures, the 3 Wan2.6 Flash clips, every exact prompt, what
// the speech-to-text heard, and the scores. Same page builder as the Fruit
// checkpoints. Run framesTest1.mjs first.
//   node scripts/blocky/pageTest1.mjs <outDir>     writes <outDir>/index.html and copies the clips to <outDir>/clips/
import fs from "fs";
import path from "path";
import { renderResultsPage, dataUri } from "../fruit-story/resultsPage.mjs";
import { ROOT } from "../fruit-story/lib.mjs";

const [outDir] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/test1");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const spend = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blocky-tests/spend.json"), "utf8")).entries;
const stage = spend.filter((e) => e.stage === "lipsync").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const dots = (n) => `${"●".repeat(n)}${"○".repeat(5 - n)} ${n}/5`;

// Judged from one frame every 0.2 s plus the speech-to-text word times; for clip B
// the open-mouth area per frame was also measured against the loudness of the
// sound. Lip TIMING still needs a watch with sound.
const RATINGS = {
  A: {
    pictureTone: "bad", look: "wrong: a brick-toy minifigure, not a blocky avatar",
    pictureNote: "Round head on a neck stud, clamp hands, studded baseplate: this is the look of a well-known brick toy, which we can't ship. The same style block drew B and C correctly, so the cause is this avatar's description: yellow head, red cap and \"classic simple smile\". The legs also came out blue, not green.",
    clipTone: "bad",
    scores: [["Transcript exact", "no: 10 of 11 words; \"freeze!\" not recognised"], ["Lip sync", 4], ["Face stays a flat decal", 3], ["Body stays as drawn", 5], ["Cuts", "none"], ["Text or logos", "YES: subtitles drawn on screen"], ["Filter block", "none (\"admin\")"]],
    clipNote: "Wan drew its own subtitles at the top of the frame for the whole clip (\"Admin\", \"freeze!\", \"Wait...\", \"why is everyone?\") although the prompt forbids them. The thin line mouth does animate, and closes in the two pauses, but the model turned it into open shapes with a white tooth band and added eyebrows. There is sound where \"freeze!\" belongs (1.3–1.7 s); the speech-to-text didn't recognise the word. The last word ends on the final frame.",
  },
  B: {
    pictureTone: "good", look: "right: cube head, block arms, rectangular torso",
    pictureNote: "The target look. The floor still came out as a studded baseplate (from \"studded bricks\" in the style block).",
    clipTone: "good",
    scores: [["Transcript exact", "yes, all 11 words"], ["Lip sync", 5], ["Face stays a flat decal", 5], ["Body stays blocky", 5], ["Cuts", "none"], ["Text or logos", "none"], ["Filter block", "none (\"banned\")"]],
    clipNote: "The clean one. The mouth stays a flat dark shape that switches between a wide oval, a small \"o\" and a closed line: no teeth, lips or nose. Measured: the mouth is closed in both pauses (2.2–2.6 s and 3.4–3.8 s) and open while there is sound, within about 0.1 s. The arm stays pointed, the head stays a cube.",
  },
  C: {
    pictureTone: "warn", look: "right, but a full-body shot",
    pictureNote: "Both avatars are properly blocky and clearly different. But the picture ignored \"chest up\": it is a full-body two-shot, so the heads are about 14% of the frame height (the target is 25–33%). The picture model also added angry eyebrows, and the listener faces the camera instead of the speaker.",
    clipTone: "warn",
    scores: [["Transcript exact", "yes, all 12 words (heard \"!\" for \"?\")"], ["Lip sync", 3], ["Face stays a flat decal", 3], ["Body stays blocky", 5], ["Right speaker, listener silent", 5], ["Cuts", "none"], ["Text or logos", "none"], ["Filter block", "none (\"hacked\")"]],
    clipNote: "Only the left avatar talks; the listener's mouth stays closed and its smile turns into a frown. But the speaker's mouth gains white teeth and a pink tongue, and it stays open with gritted teeth through the pause at 2.1–2.6 s, so the timing reads less clearly. The face is small because of the full-body picture.",
  },
};

const TABLE = {
  columns: ["Clip", "Transcript", "Lip sync", "Flat decal", "Body blocky", "Speaker / listener", "Cuts", "Text or logos", "Filter"],
  rows: [
    ["A · classic smile (line mouth)", ["10 of 11", 1], "4/5", "3/5: teeth, eyebrows", ["brick-toy figure (picture)", 1], "solo", "none", ["subtitles on screen", 1], "passed"],
    ["B · open-mouth decal", "exact", "5/5", "5/5", "5/5", "solo", "none", "none", "passed"],
    ["C · two avatars, open-mouth decal", "exact", "3/5", "3/5: teeth, tongue", "5/5", "5/5", "none", "none", "passed"],
  ],
};

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pictures = [];
const clips = [];
const faces = [];
fs.mkdirSync(path.join(outDir, "clips"), { recursive: true });
for (const row of Object.values(r.items)) {
  const g = RATINGS[row.key];
  pictures.push({
    image: path.join(dir, row.picture.file),
    title: `Picture ${row.key} · ${row.face}`,
    tone: g.pictureTone,
    meta: [["Model", row.picture.model], ["Real cost", `$${row.picture.cost.toFixed(4)}`], ["Look", g.look]],
    note: g.pictureNote,
    prompt: row.picture.prompt,
  });
  fs.copyFileSync(path.join(dir, row.clip.file), path.join(outDir, "clips", `${row.key}.mp4`));
  clips.push({
    video: `clips/${row.key}.mp4`,
    stripUri: await dataUri(path.join(dir, "frames", `${row.key}-strip.jpg`)),
    title: `Clip ${row.key} · "${row.line}"`,
    tone: g.clipTone,
    meta: [
      ["Model", row.clip.model], ["Status", row.clip.state], ["Length", `${row.clip.durationSec} s`],
      ["Real cost", `$${row.clip.cost.toFixed(4)} = $${(row.clip.cost / row.clip.durationSec).toFixed(4)}/s`],
      ["Line", `${row.words} words; last word ends at ${row.heard.words.at(-1).e.toFixed(2)} s`],
      ["Heard (speech-to-text)", row.heard.text],
      ...g.scores.map(([k, v]) => [k, typeof v === "number" ? dots(v) : v]),
    ],
    note: g.clipNote,
    prompt: row.clip.prompt,
  });
  faces.push({ image: path.join(dir, "frames", `${row.key}-faces.jpg`), title: `Clip ${row.key}: top of the frame, one frame every 0.2 s (left to right, top to bottom)` });
}

const cell = (c) => (Array.isArray(c) ? `<td class="bad">${esc(c[0])}</td>` : `<td>${esc(c)}</td>`);
const table = `<table><thead><tr>${TABLE.columns.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${TABLE.rows.map((cells) => `<tr>${cells.map(cell).join("")}</tr>`).join("")}</tbody></table>`;

const ok = Object.values(r.items).filter((x) => x.clip.state === "success").length;
const html = await renderResultsPage({
  title: "Blocky Lip-Sync Test",
  intro: "Blocky Stories test 1: can V2 (Wan2.6 Flash) lip-sync a flat decal face? Three first-frame pictures, each with a different face, then one 5 s clip per picture. One attempt per item, no retries, nobody charged credits. I judged each clip from one frame every 0.2 s and a speech-to-text transcript with word times; I can't hear the clips, so lip timing needs your watch with sound.",
  stats: [
    { value: `${ok} / 3`, label: "clips made on Wan2.6 Flash", tone: "good" },
    { value: "3 / 3", label: "decal mouths animate with the words", tone: "good" },
    { value: "0", label: "filter blocks (\"admin\", \"banned\", \"hacked\")", tone: "good" },
    { value: "1 / 3", label: "clips with subtitles drawn on screen", tone: "bad" },
    { value: "1 / 3", label: "pictures drawn as a brick-toy figure", tone: "bad" },
    { value: "B", label: "winning face: open-mouth decal on a cube head", tone: "good" },
    { value: `$${stage.toFixed(4)}`, label: "this test, of the $1.00 stage cap" },
    { value: `$${total.toFixed(4)}`, label: "Blocky total, of the $5.00 cap" },
  ],
  sections: [
    { heading: "Scores", text: "1 to 5 where a score fits. Red cells are the problems.", html: table },
    { heading: "The 3 clips (Wan2.6 Flash, 5 s each, 720p, with sound)", cards: clips },
    { heading: "The 3 first-frame pictures (Nano Banana 2 Lite, 9:16)", cards: pictures },
    { heading: "Faces, frame by frame", text: "What I judged the mouths from: the top of each clip, one frame every 0.2 s.", layout: "list", cards: faces },
  ],
  decisions: [
    "<b>Go or no-go on V2.</b> My recommendation is go: the big risk, a decal mouth that won't animate or turns realistic, did not happen in any of the 3 clips, and clip B is clean. The V3/V4 backup clips (test 1b, $1.01) are not needed.",
    "<b>Face type for the library: B.</b> A solid dark open-mouth shape with oval eyes on a cube head, no eyebrows. The thin line mouth (A) gives the model nothing to animate, so it invents shapes and teeth.",
    "<b>Style wording.</b> \"Classic smile\" with a yellow head and red cap drew a brick-toy minifigure, and \"studded bricks\" drew that toy's baseplate under all three. I'd change the style block to smooth plastic blocks with no studs, and give the default \"noob\" avatar the B face and different colours. Test 2 (avatars) can check the new wording at no extra cost.",
    "<b>Subtitles drawn by Wan (1 of 3).</b> The prompt already forbids them. I'd add \"text on screen\" to the automatic clip check that Fruit already runs, so such a clip is remade for free instead of reaching the user.",
    "<b>Teeth (2 of 3).</b> Flat cartoon teeth appeared on the angry and the stunned face, not on the calm one. Acceptable, or a fail to fix in the picture and clip prompts?",
    "<b>11-word lines.</b> They fit in 5 s with almost nothing to spare (the last word ends at 4.8–5.0 s). Fruit's rule would give these lines 6 s. I'd keep Fruit's rule as decided and not push line length.",
    "<b>Two avatars in one shot</b> came out full body with small faces, the same problem Fruit had. Fruit's fix (picture check plus one free redraw) carries over.",
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("written", path.join(outDir, "index.html"), (html.length / 1024).toFixed(0) + " KB");
