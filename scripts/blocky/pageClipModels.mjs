// Review page for the clip-model test (testClipModels.mjs): the same picture, prompt and line on Grok
// Imagine Video 1.5 Lite (raw, through the upscaler, and plainly resized), P-Video-2 and Veo 3.1 Lite,
// side by side, with what was heard, what each cost and how each scored. Same page builder as the other
// Blocky checkpoints.
//   node scripts/blocky/pageClipModels.mjs <ffmpegPath> <outDir>     writes <outDir>/index.html and <outDir>/clips/
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { renderResultsPage, dataUri } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";

const [ffmpeg, outDir] = process.argv.slice(2);
const dir = path.join(ROOT, "data/blocky-tests/models");
const r = JSON.parse(fs.readFileSync(path.join(dir, "results.json"), "utf8"));
const it = r.items;
fs.mkdirSync(path.join(outDir, "clips"), { recursive: true });
const dots = (n) => "●".repeat(Math.round(n)) + "○".repeat(5 - Math.round(n)) + ` ${n}/5`;
const usd = (n) => `$${Number(n).toFixed(4)}`;
const perSec = (row, extra = 0) => `${usd(row.cost + extra)} = ${usd((row.cost + extra) / 6)} a second`;

// Copies for the page. The upscaler's file is 4K and 17 MB: it is shown scaled down to 720 wide (what a viewer
// would get). The raw Grok clip is also shown plainly resized to 720 wide, which is what our own final
// render does for free.
const copy = (key) => fs.copyFileSync(path.join(dir, `${key}.mp4`), path.join(outDir, "clips", `${key}.mp4`));
const scaled = (from, to) => execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", path.join(dir, `${from}.mp4`), "-vf", "scale=720:-2:flags=lanczos", "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-c:a", "copy", path.join(outDir, "clips", `${to}.mp4`)]);
copy("grok"); copy("pvideo"); copy("veo"); scaled("grokUp", "grok-upscaled-720"); scaled("grok", "grok-resized-720");
const strip = (key) => dataUri(path.join(dir, "frames", `${key}-strip.jpg`));
const heard = (row) => `${row.heard.text} ${row.heard.problem ? `(${row.heard.problem})` : "(the exact line)"}`;
const size = (row) => `${row.video.width} × ${row.video.height}, ${row.video.fps} frames a second, ${row.video.seconds} s, sound: ${row.video.audio ?? "none"}`;

const SCORES = {
  grok: { tone: "good", mouth: 4.5, look: 4, motion: 3.5, sharp: 2.5, text: "none", note: "The mouth decal goes through many shapes with the words and closes when the line ends. The eyes, the hat, the bolt and Noob's smile stay exactly as in the picture. In the first second and a half the mouth shows white bands like teeth. The camera pushes in hard: by the end Noob is out of the frame." },
  pvideo: { tone: "warn", mouth: 3, look: 3, motion: 3, sharp: 4, text: "none", note: "Sharp and calm, and the fastest. The mouth moves less (fewer shapes). From about 1.5 seconds Vex's eyes turn into slanted angry eyes and a small brow bump appears on the head, which the picture does not have. Noob stays as he was." },
  veo: { tone: "warn", mouth: 4.5, look: 2.5, motion: 4, sharp: 4, text: "none", note: "The liveliest acting, and a wide, clear mouth, but with teeth and a tongue. It re-frames the shot after the first frame (the whole hat is suddenly in view), and in the last second Vex's eyes become angry and Noob's smile turns into a frown: both faces end up different from the picture." },
};
const scoreMeta = (s) => [["Mouth decal moves with the words", dots(s.mouth)], ["Keeps the exact look", dots(s.look)], ["Motion", dots(s.motion)], ["Sharpness", dots(s.sharp)], ["Drawn subtitles or text", s.text]];
const card = (key, video, title, extra = {}) => ({
  video: `clips/${video}.mp4`, title, tone: SCORES[key].tone,
  meta: [["Model", it[key].model], ["File", extra.size ?? size(it[key])], ["Time to make", extra.time ?? `${it[key].seconds} s`], ["Real cost", extra.cost ?? perSec(it[key])], ["Heard (speech-to-text)", heard(it[extra.heardKey ?? key])], ...scoreMeta({ ...SCORES[key], ...(extra.scores ?? {}) })],
  note: extra.note ?? SCORES[key].note,
});
const cards = [
  { ...card("grok", "grok", "1a · Grok Imagine Video 1.5 Lite, raw 480p"), stripUri: await strip("grok") },
  { ...card("grok", "grok-upscaled-720", "1b · The same clip through the ByteDance upscaler", { heardKey: "grokUp", size: `the upscaler returned ${it.grokUp.video.width} × ${it.grokUp.video.height} (4K, ${it.grokUp.video.mb} MB); shown here scaled down to 720 wide`, time: `${it.grok.seconds} s + ${it.grokUp.seconds} s for the upscale`, cost: `${usd(it.grok.cost)} + ${usd(it.grokUp.cost)} for the upscale = ${usd((it.grok.cost + it.grokUp.cost) / 6)} a second`, scores: { sharp: 4.5 }, note: "Clearly sharper than the raw clip. But the upscaler has no setting for the size it returns: it made a 4K file, charged about as much as the clip itself and took over two minutes." }), tone: "warn" },
  { ...card("grok", "grok-resized-720", "1c · The same clip, plainly resized to 720 wide (free)", { size: "the raw 400 × 736 clip resized to 720 × 1324 by our own final render: no model, no cost, no wait", scores: { sharp: 3 }, note: "What the final video would show if the raw 480p clip were used as it is. Softer than 1b, a little cleaner than 1a at the same size." }) },
  { ...card("pvideo", "pvideo", "2 · P-Video-2, 720p"), stripUri: await strip("pvideo") },
  { ...card("veo", "veo", "3 · Veo 3.1 Lite, 720p"), stripUri: await strip("veo") },
];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const heads = ["", "Grok 1.5 Lite (480p)", "Grok + upscaler", "P-Video-2 (720p)", "Veo 3.1 Lite (720p)"];
const rows = [
  ["6 seconds and 9:16", "yes (1 to 15 s)", "", "yes (1 to 20 s)", "yes (4, 6 or 8 s)"],
  ["Said the exact line", "yes", "yes", "yes", "yes"],
  ["Mouth decal moves with the words", "4.5 / 5", "4.5 / 5", "3 / 5", "4.5 / 5"],
  ["Keeps the exact look", "4 / 5: teeth-like bands at first", "4 / 5", "3 / 5: angry eyes, brow bump", "2.5 / 5: re-framed; both faces change at the end"],
  ["Drawn subtitles or text", "none", "none", "none", "none"],
  ["Motion", "3.5 / 5: hard push-in", "3.5 / 5", "3 / 5: calm", "4 / 5: liveliest"],
  ["Sharpness", "2.5 / 5 (400 × 736)", "4.5 / 5 (4K file)", "4 / 5 (704 × 1280)", "4 / 5 (720 × 1280)"],
  ["Time to make", `${it.grok.seconds} s`, `${it.grok.seconds + it.grokUp.seconds} s`, `${it.pvideo.seconds} s`, `${it.veo.seconds} s`],
  ["Real cost for 6 s", usd(it.grok.cost), usd(it.grok.cost + it.grokUp.cost), usd(it.pvideo.cost), usd(it.veo.cost)],
  ["Real cost a second", usd(it.grok.cost / 6), usd((it.grok.cost + it.grokUp.cost) / 6), usd(it.pvideo.cost / 6), usd(it.veo.cost / 6)],
];
const table = `<table><thead><tr>${heads.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
const total = Object.values(it).reduce((s, row) => s + Number(row.cost ?? 0), 0);

const html = await renderResultsPage({
  title: "Blocky Clip Models",
  intro: `One 6-second clip on each of the three clip models chosen for the new lineup, from the same real material: scene 2's picture of the first real story (Vex speaking, Noob listening), that scene's own clip prompt, and the line <b>"${esc(r.line)}"</b>. 9:16. No live model was changed. Voice quality is for your ears: play each clip with sound.`,
  stats: [
    { value: "3 of 3", label: "said the exact line", tone: "good" },
    { value: "0", label: "clips with drawn subtitles", tone: "good" },
    { value: usd(it.grok.cost / 6), label: "Grok 480p, a second" },
    { value: usd(it.pvideo.cost / 6), label: "P-Video-2, a second" },
    { value: usd(it.veo.cost / 6), label: "Veo 3.1 Lite, a second" },
    { value: `${it.grokUp.seconds} s`, label: "the upscale alone", tone: "bad" },
    { value: usd(total), label: "spent on this test" },
  ],
  sections: [
    { heading: "The first frame every clip started from", cards: [{ image: r.picture, title: "Scene 2 of the first real story", meta: [["Line", r.line], ["Words", String(r.line.split(" ").length)]], prompt: r.prompt }] },
    { heading: "The clips", text: "Watch them with sound. The small sheet under a clip shows it every half second.", cards },
    { heading: "Side by side", html: table },
    { heading: "Every half second: Grok (top), P-Video-2 (middle), Veo 3.1 Lite (bottom)", layout: "list", cards: [{ image: path.join(dir, "frames", "compare-rows.jpg"), title: "Twelve moments of each clip" }] },
  ],
  decisions: [
    "<b>The upscaler.</b> Through the API it has no setting for the output size: it returned a 4K file, cost $0.128 for 6 seconds (as much as the clip) and took 131 seconds. Three ways forward: Grok at 480p with our own free resize (clip 1c); Grok at 720p natively (list price $0.03 a second, not tested yet: one more clip, about $0.19); or tell me how you set 720p in the playground and I look for that setting.",
    "<b>Grok's camera.</b> It pushes in much harder than the prompt asks. Fixable in the prompt for this model, as was done for Seedance.",
    "<b>P-Video-2 as the V2 fallback.</b> It works and is fast, but it changed Vex's eyes. Fine as a second try; it would not be my first choice.",
    "<b>Veo 3.1 Lite for V3.</b> The most alive, but it re-frames the shot and changes both faces at the end, and draws teeth and a tongue. Worth one prompt pass before it becomes a paid tier.",
    "<b>Go or no go</b> on switching Blocky's V2, V2 fallback and V3 to this lineup. Nothing is switched until you say so.",
  ],
});
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log(`wrote ${path.join(outDir, "index.html")} (${(html.length / 1e6).toFixed(2)} MB) and ${fs.readdirSync(path.join(outDir, "clips")).map((f) => `${f} ${(fs.statSync(path.join(outDir, "clips", f)).size / 1e6).toFixed(2)} MB`).join(", ")}`);
