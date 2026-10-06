// Results page for Blocky Stories test 1 (lip sync on flat decal faces): the
// 3 first-frame pictures, the 3 Wan2.6 Flash clips, every exact prompt, what
// the speech-to-text heard, and the scores. Same page builder as the Fruit
// checkpoints. Also test 1b: the same clip C on V3 and V4, side by side with
// the V2 clip. Run framesTest1.mjs first.
//   node scripts/blocky/pageTest1.mjs <outDir>     writes <outDir>/index.html and copies the clips to <outDir>/clips/
import fs from "fs";
import path from "path";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [outDir] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/test1");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const spend = JSON.parse(fs.readFileSync(path.join(ROOT, "data/blocky-tests/spend.json"), "utf8")).entries;
const stage = spend.filter((e) => e.stage === "lipsync").reduce((s, e) => s + e.usd, 0);
const total = spend.reduce((s, e) => s + e.usd, 0);
const dirB = path.join(ROOT, "data/blocky-tests/test1b");
const tiers = fs.existsSync(path.join(dirB, "results.json")) ? JSON.parse(fs.readFileSync(path.join(dirB, "results.json"), "utf8")).items : {};
const tiersSpend = spend.filter((e) => e.stage === "tiers").reduce((s, e) => s + e.usd, 0);
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

// Test 1b: clip C again, same picture, line and prompt, on the other two tiers.
const TIER_RATINGS = {
  v3: {
    tone: "warn",
    scores: [["Transcript exact", "yes, all 12 words"], ["Lip sync", 3], ["Face stays a flat decal", 3], ["Body stays blocky", 4], ["Right speaker, listener silent", 5], ["Cuts", "none"], ["Text or logos", "none"], ["Filter block", "none"]],
    note: "About the same as V2, not clearly better. The mouth shapes are a little richer (a clear \"o\" on \"whole\"), but the same flat teeth appear and the mouth again stays gritted through the pause. Seedance pushes the camera in harder: by the end the speaker's head touches the left edge. One small glitch: the arm that jabs toward the listener shows a hollow end for a few frames. Production gives Seedance an almost-still camera; this test kept the V2 camera sentence so that only the model differs.",
  },
};
const TIER_ROWS = {
  v2: ["V2 · Wan2.6 Flash, 5 s", "exact", "3/5", "3/5: teeth, tongue", "5/5", "5/5", "none", "none", "$0.2504"],
  v3: ["V3 · Seedance 2.0 Mini, 5 s", "exact", "3/5", "3/5: teeth", "4/5: hollow arm end", "5/5", "none", "none", "$0.4084"],
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

// Clip C on each tier, side by side.
const c = r.items.C;
const tierCards = [{
  video: "clips/C.mp4", stripUri: await dataUri(path.join(dir, "frames", "C-strip.jpg")), title: "V2 · Wan2.6 Flash, 5 s", tone: "warn",
  meta: [["Real cost", `${c.clip.cost.toFixed(4)} = ${(c.clip.cost / 5).toFixed(4)}/s`], ["Heard", c.heard.text], ["Lip sync", dots(3)], ["Face stays a flat decal", dots(3)], ["Body stays blocky", dots(5)]],
  note: "The clip from test 1, for comparison.",
}];
const tierFaces = [];
for (const [key, label] of [["v3", "V3 · Seedance 2.0 Mini, 5 s"], ["v4", "V4 · Veo 3.1 Fast, 6 s"]]) {
  const row = tiers[key];
  const g = TIER_RATINGS[key];
  if (!row?.file) {
    tierCards.push({ title: label, tone: "warn", meta: [["Status", row ? `${row.state}${row.error ? `: ${row.error}` : ""}` : "not run yet"]], note: key === "v4" ? "Waiting: the worker's no-charge test action has to accept Veo first, which needs a deploy of fruit-worker (one line, already committed). Nothing was sent or spent for V4." : undefined });
    continue;
  }
  fs.copyFileSync(path.join(dirB, row.file), path.join(outDir, "clips", `C-${key}.mp4`));
  tierCards.push({
    video: `clips/C-${key}.mp4`, stripUri: await dataUri(path.join(dirB, "frames", `C-${key}-strip.jpg`)), title: label, tone: g?.tone,
    meta: [["Real cost", `${row.cost.toFixed(4)} = ${(row.cost / row.durationSec).toFixed(4)}/s`], ["Heard", row.heard?.text ?? "(none)"], ...(g?.scores ?? []).map(([k, v]) => [k, typeof v === "number" ? dots(v) : v])],
    note: g?.note,
  });
  tierFaces.push({ image: path.join(dirB, "frames", `C-${key}-faces.jpg`), title: `Clip C on ${label}: top of the frame, one frame every 0.2 s` });
}
const tierHeads = ["Tier", "Transcript", "Lip sync", "Flat decal", "Body blocky", "Speaker / listener", "Cuts", "Text or logos", "Real cost"];
const tierRows = ["v2", ...Object.keys(tiers).filter((k) => tiers[k].file)].map((k) => TIER_ROWS[k]).filter(Boolean);
const esc2 = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const tierTable = `<table><thead><tr>${tierHeads.map((h) => `<th>${esc2(h)}</th>`).join("")}</tr></thead><tbody>${tierRows.map((cells) => `<tr>${cells.map((x) => `<td>${esc2(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

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
    { value: `${stage.toFixed(4)}`, label: "test 1, of the $1.00 stage cap" },
    { value: `${tiersSpend.toFixed(4)}`, label: "test 1b (V3, V4), of the $1.40 stage cap" },
    { value: `$${total.toFixed(4)}`, label: "Blocky total, of the $5.00 cap" },
  ],
  sections: [
    { heading: "Scores", text: "1 to 5 where a score fits. Red cells are the problems.", html: table },
    { heading: "Test 1b: clip C on V2, V3 and V4", text: "The same picture, the same line and the same clip prompt on each tier, so the only difference is the model. The prompt is the one under clip C below.", html: tierTable, cards: tierCards },
    { heading: "The 3 clips of test 1 (Wan2.6 Flash, 5 s each, 720p, with sound)", cards: clips },
    { heading: "The 3 first-frame pictures (Nano Banana 2 Lite, 9:16)", cards: pictures },
    { heading: "Faces, frame by frame", text: "What I judged the mouths from: the top of each clip, one frame every 0.2 s.", layout: "list", cards: [...faces, ...tierFaces] },
  ],
  decisions: [
    "<b>Decided after test 1:</b> go on V2; face B is the library face; flat cartoon teeth are fine; the style block loses \"studded bricks\" and gains a no-studs, no-minifigure list; text on screen fails the clip check; two-avatar shots get Fruit's picture check and one free redraw (decisions 9 to 15 in docs/roblox-scope.md).",
    "<b>V3 vs V2 on blocky faces: about the same.</b> Seedance costs 1.6 times as much per second and did not animate the decal mouth more cleanly. Nothing here argues for steering Blocky users to V3 for lip sync.",
    "<b>V4 (Veo 3.1 Fast, 6 s, about $0.90) has not run.</b> It runs on blocky-worker (Blocky's own worker, with Veo on its test list), once that runs locally. Once it is deployed I run the one clip and add it here.",
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("written", path.join(outDir, "index.html"), (html.length / 1024).toFixed(0) + " KB");
