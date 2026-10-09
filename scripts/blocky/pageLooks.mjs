// Review sheet for the Blocky Stories look: the re-test of the avatar reference
// prompt (old picture, fix A, fix B, side by side), Nano Banana Pro on the
// corrected prompt next to Lite, then the earlier checkpoint: test 2's first
// six references, test 3's location and scenes, the thumbnails and the menus.
// Every prompt and real cost. Same page builder as the Fruit checkpoints.
//   node scripts/blocky/pageLooks.mjs <outDir>     writes <outDir>/index.html
import fs from "fs";
import path from "path";
import { renderResultsPage } from "./resultsPage.mjs";
import { ROOT } from "./lib.mjs";
import { ROSTER } from "./roster.mjs";

const [outDir] = process.argv.slice(2);
const data = (p) => path.join(ROOT, "data/blocky-tests", p);
const json = (p) => JSON.parse(fs.readFileSync(data(p), "utf8"));
const looks = json("test2/results.json").items;
const thumbs = json("thumb/results.json").items;
const spend = json("spend.json").entries;
const sum = (stage) => spend.filter((e) => !stage || e.stage === stage).reduce((s, e) => s + e.usd, 0);
const png = (p) => `data:image/png;base64,${fs.readFileSync(data(p)).toString("base64")}`;
const usd = (n) => `$${Number(n).toFixed(4)}`;
const nameOf = (id) => ROSTER.find((x) => x.id === id).name;

/** One avatar picture as a card. label: what this picture is; tone and note: what I see in it. */
function avatar(key, label, tone, note) {
  const r = looks[key];
  const a = ROSTER.find((x) => x.id === r.id);
  return { image: data(`test2/${r.file}`), title: `${a.name} · ${label}`, tone, meta: [["Model", r.model], ["Real cost", usd(r.cost)], ["Reference pictures sent", String(r.references ?? 0)], ["Look asked for", a.look]], note, prompt: r.prompt };
}

// ── The re-test: old picture, fix A (text only), fix B (text + Noob body template) ──
const retest = [
  avatar("vex-roblox-lite", "before (test 2)", "bad", "A rounded cylinder head, claw hands, a hip piece and feet."),
  avatar("retest-vex-A", "fix A: text only", "warn", "Construction is clean: a cube head straight on the torso, straight arms with flat square ends, two separate straight legs, no hip piece, no neck, no feet. But the colours are wrong: the arms should be white and the legs black, and everything came out crimson."),
  avatar("retest-vex-B", "fix B: text + Noob body template", "warn", "Colours are right, but the body copies the Noob template's flaws: a rounded head, small hand blocks at the arm ends, and the notch between the legs."),
  avatar("pixi-roblox-lite", "before (test 2)", "bad", "A neck peg, curved arms with claw hands, a hip piece."),
  avatar("retest-pixi-A", "fix A: text only, minifigure parts NOT named in the leave-out list", "warn", "A cube head on the torso, straight arms with flat square ends, right colours. The legs still have the notch between them, and the pigtails came out as rounded hair rather than blocks."),
  avatar("retest-pixi-B", "fix B: text + Noob body template", "warn", "Again the Noob's flaws: a rounded head, hand blocks at the arm ends, the notch between the legs. The pigtails are fully hair-like."),
];
const retestTable = `<table><thead><tr><th>Picture</th><th>Hands</th><th>Legs</th><th>Neck</th><th>Head</th><th>Colours</th></tr></thead><tbody>
<tr><td>Vex · fix A (minifigure parts named)</td><td>clean</td><td>clean</td><td>clean</td><td>cube</td><td class="bad">arms and legs wrong</td></tr>
<tr><td>Pixi · fix A (minifigure parts NOT named)</td><td>clean</td><td class="bad">notch</td><td>clean</td><td>cube</td><td>right</td></tr>
<tr><td>Vex · fix B (Noob template)</td><td class="bad">hand blocks</td><td class="bad">notch</td><td>clean</td><td class="bad">rounded</td><td>right</td></tr>
<tr><td>Pixi · fix B (Noob template)</td><td class="bad">hand blocks</td><td class="bad">notch</td><td>clean</td><td class="bad">rounded</td><td>right</td></tr>
<tr class="group"><td colspan="6">Nano Banana Pro, fix A</td></tr>
<tr><td>Noob · Pro</td><td>clean</td><td>clean</td><td>clean</td><td>cube</td><td>right</td></tr>
<tr><td>Vex · Pro</td><td>clean</td><td>clean</td><td>clean</td><td class="bad">rounded cylinder</td><td>right</td></tr>
<tr><td>Lux · Pro</td><td>clean</td><td>clean</td><td>clean</td><td>cube</td><td>right</td></tr>
</tbody></table>`;

// ── Pro on the corrected prompt (fix A), under the Lite picture of the same avatar ──
const pro = [
  avatar("noob-roblox-lite", "Lite, the earlier prompt", "warn", "The best of test 2, but it has small hand blocks and the notch between the legs."),
  avatar("retest-vex-A", "Lite, the corrected prompt (the same prompt as Pro)", "warn", "Clean construction, wrong colours on the arms and legs."),
  avatar("lux-toy-lite", "Lite, the earlier \"toy figure\" prompt", "bad", "A brick-toy minifigure body with claw hands."),
  avatar("pro-noob", "Pro, the corrected prompt", "good", "Exactly the body asked for: a cube head straight on a box torso, straight arms with flat ends, two separate straight legs. Classic colours, face B."),
  avatar("pro-vex", "Pro, the corrected prompt", "warn", "Body and colours are right (white arms, black legs), unlike Lite. But the head is a rounded cylinder, not a cube, and the mouth gained a pink tongue."),
  avatar("pro-lux", "Pro, the corrected prompt", "good", "Cube head, crown, right colours, clean body. Drawn at a slight three-quarter angle rather than straight on; a small pink tongue in the mouth."),
];

// ── The earlier checkpoint ──
const AVATAR_NOTES = {
  "noob-roblox-lite": ["warn", "The best of the six: block arms and legs, the classic colours, face B. It still has small hand blocks and the notch between the legs."],
  "vex-roblox-lite": ["bad", "A rounded cylinder head, claw hands, a hip piece and feet."],
  "pixi-roblox-lite": ["bad", "A neck peg, curved arms with claw hands, a hip piece."],
  "noob-toy-lite": ["bad", "A brick-toy minifigure: sloped torso, curved arms, claw hands, a round head."],
  "lux-toy-lite": ["bad", "Cube head, but a brick-toy minifigure body with claw hands."],
  "tank-toy-lite": ["bad", "A brick-toy minifigure with a round head inside the helmet and claw hands."],
};
const first = Object.keys(AVATAR_NOTES).map((key) => avatar(key, looks[key].style === "roblox" ? "\"Roblox-style\" wording" : "\"blocky toy figure\" wording", ...AVATAR_NOTES[key]));
const SCENE_NOTES = {
  plate: ["good", "The empty place: blocky stalls, crates and a fountain on a flat paved floor. No studs, no text."],
  "scene-s1": ["warn", "The place matches the plate. Vex keeps the look of its (old) reference, claw hand included. Shown to the thighs with a small head: the picture check now fails this on head size and redraws it once."],
  "scene-s2": ["good", "The place matches. Noob is chest-up and large; flat eyebrow lines show the panic; Vex stands behind, smaller."],
  "scene-s3": ["warn", "The place matches. Lux is chest-up with Noob and Pixi behind. Lux's raised arm ends in a claw hand, copied from its old reference."],
  "scene-s4": ["bad", "A full-body shot with small faces, from another angle of the plaza. The picture check fails this and redraws it once."],
};
const sceneCards = ["plate", "scene-s1", "scene-s2", "scene-s3", "scene-s4"].map((key) => {
  const r = looks[key];
  const [tone, note] = SCENE_NOTES[key];
  return { image: data(`test2/${r.file}`), title: key === "plate" ? "The location plate (made once per place)" : `${r.name}: ${r.presentIds.map(nameOf).join(", ")} · ${r.emotion}`, tone, meta: [["Real cost", usd(r.cost)], ["Reference pictures sent", String(r.references)], ...(r.shot ? [["Shot asked for", r.shot]] : [])], note, prompt: r.prompt };
});
const thumbCards = Object.values(thumbs).map((t) => ({
  image: data(`thumb/${t.file}`), title: `Option ${t.key}: ${t.name}${t.key === "2" ? " (wired in, kept)" : ""}`, tone: t.key === "2" ? "good" : "warn", meta: [["Real cost", usd(t.cost)]],
  note: t.key === "2" ? "Picked and kept: true cube heads, the whole frame is used, bright and readable at menu size. Cropped to 880×1168 PNG, the size of AI Cooking Matic's thumbnail." : "Not picked: letterboxed with blurred bands above and below, and the heads are rounded rather than cubes.",
  prompt: t.prompt,
}));
const menuCards = [
  ["menu-1440-flag-on.png", "Desktop 1440, flag ON: Short Form panel", "Blocky Stories sits right after AI Fruit Story, with its thumbnail."],
  ["menu-390-flag-on.png", "Phone 390, flag ON: Short Form menu", "Same place in the grid."],
  ["page-1440-flag-on.png", "Desktop 1440, flag ON: the Blocky Stories page", "Its own name, tagline and hero. The lists show \"couldn't load\" on purpose until the new API is deployed: the page refuses to show Fruit's data in its place."],
  ["menu-1440-flag-off.png", "Desktop 1440, flag OFF", "No entry. The route lands on Home."],
  ["menu-390-flag-off.png", "Phone 390, flag OFF", "No entry."],
].map(([file, title, note]) => ({ image: png(`qa-menus/${file}`), title, note }));

const html = await renderResultsPage({
  title: "Blocky Look Review",
  intro: "Blocky Stories, second look checkpoint. The reference prompt now says \"blocky game avatar\" (never \"toy\") and describes the body by what it is. The re-test redrew Vex and Pixi on Nano Banana 2 Lite with that text fix alone (A) and with the Lite Noob added as a body template (B); one of the four leaves the minifigure parts out of the leave-out list. Then Noob, Vex and Lux ran on Nano Banana Pro with the winning prompt. One attempt per picture, nobody charged credits. The first checkpoint's pictures are further down, unchanged.",
  stats: [
    { value: "A", label: "winning fix: the text alone, no body template", tone: "good" },
    { value: "2 / 2", label: "fix A pictures with clean hands and neck (Lite)", tone: "good" },
    { value: "0 / 2", label: "fix B pictures with clean hands or legs (the template copies the Noob's flaws)", tone: "bad" },
    { value: "3 / 3", label: "Pro pictures with clean hands, legs and neck, and right colours", tone: "good" },
    { value: "1 / 3", label: "Pro pictures with a rounded head instead of a cube", tone: "warn" },
    { value: "$0.0337 / $0.1380", label: "real cost per picture, Lite / Pro" },
    { value: usd(sum("looks")), label: "tests 2 and 3, re-test and Pro, of the $1.00 cap" },
    { value: usd(sum()), label: "Blocky total, of the $5.00 cap" },
  ],
  sections: [
    { heading: "The re-test: before, fix A, fix B", text: "Each row is one avatar: the test 2 picture, then fix A (text only), then fix B (text + the Noob as a body template). Red cells are what is still wrong.", html: retestTable, cards: retest },
    { heading: "Nano Banana Pro on the corrected prompt", text: "Top row: the Lite picture of the same avatar. Bottom row: Pro with fix A. Only Vex has a Lite picture made from the very same prompt; the Lite Noob and Lux are from the earlier prompts.", cards: pro },
    { heading: "First checkpoint · test 2: the first six references (earlier wording)", text: "Three with the \"Roblox-style\" wording, three with \"blocky toy figure\". Made with \"blocky toy avatar\" and without the body-construction text.", cards: first },
    { heading: "First checkpoint · test 3: one location, four scenes", text: "The plate is made once and sent with every scene set there, after the avatar references. These scenes used the test 2 references, so they show the old hands.", cards: sceneCards },
    { heading: "Thumbnail options", cards: thumbCards },
    { heading: "Menu entries", layout: "list", cards: menuCards },
  ],
  decisions: [
    "<b>Which fix won: A, the text alone.</b> Describing the body by what it is fixed the hands and the neck in both Lite pictures and all three Pro pictures. The Noob body template (B) made things worse: both B pictures copied its rounded head, hand blocks and leg notch. I've left the template out.",
    "<b>The leave-out list: keep naming the minifigure parts.</b> The one picture that left them out (Pixi, fix A) is the only fix-A picture that kept the notch between the legs. It is one picture on a different avatar, so this is a hint, not proof; but nothing suggests that naming them primes them.",
    "<b>Lite or Pro for the 24 references.</b> Pro held the whole look in all three: clean body and right colours. Lite with the same prompt got the body right on Vex but painted the arms and legs the wrong colour, and kept a leg notch on Pixi. Pro costs $0.1380 a picture against $0.0337: about $3.31 for the library instead of $0.81, once. I'd choose Pro for the references and keep Lite for scene pictures.",
    "<b>Not yet clean on Pro:</b> Vex's head came out as a rounded cylinder (1 of 3), two mouths gained a small pink tongue, and Lux stands at a slight angle. If you choose Pro I'd add \"the head is a cube with flat faces and straight edges\" and \"seen straight from the front\" to the reference prompt, and treat a rounded head as a redo when the library sheet is reviewed.",
    "<b>Scene pictures:</b> the scene style block now carries the same body-construction text. It has not been tested in a scene yet: test 3's scenes were made before it and from the old references. The first real check is the next scene test with approved references.",
    "<b>Veo clip (test 1b):</b> still waiting. It runs on blocky-worker (Blocky's own worker, with Veo on its test list), once that runs locally.",
  ],
});
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("written", path.join(outDir, "index.html"), (html.length / 1024).toFixed(0) + " KB");
