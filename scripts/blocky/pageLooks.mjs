// Review sheet for the Blocky Stories look: the menu entries (flag on and off),
// the two thumbnail options, test 2 (avatar references on Lite, Pro when it has
// run) and test 3 (one location plate + four scene pictures), with every prompt
// and real cost. Same page builder as the Fruit checkpoints.
//   node scripts/blocky/pageLooks.mjs <outDir>     writes <outDir>/index.html
import fs from "fs";
import path from "path";
import { renderResultsPage } from "../fruit-story/resultsPage.mjs";
import { ROOT } from "../fruit-story/lib.mjs";
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

// What I see in each picture.
const AVATAR_NOTES = {
  "noob-roblox-lite": ["good", "Right: a rounded cube head, plain block arms with square ends, block legs, the classic colours, face B. This is the look to copy."],
  "vex-roblox-lite": ["warn", "Hat, colours, bolt and face are right, but the head is a rounded cylinder and the arms end in C-shaped claw hands."],
  "pixi-roblox-lite": ["warn", "Cube head, pigtails, sun and face are right, but the arms are curved and end in claw hands."],
  "noob-toy-lite": ["bad", "A brick-toy minifigure: sloped torso, curved arms, claw hands, a round head. The mouth also came out as a frown."],
  "lux-toy-lite": ["bad", "Cube head, crown and diamond are right, but the body is a brick-toy minifigure with claw hands."],
  "tank-toy-lite": ["bad", "A brick-toy minifigure with a round head inside the helmet and claw hands."],
};
const SCENE_NOTES = {
  plate: ["good", "The empty place: blocky stalls, crates and a fountain on a flat paved floor. No studs, no text."],
  "scene-s1": ["warn", "The place matches the plate. Vex keeps the look of its reference, claw hand included. Shown to the thighs rather than chest-up."],
  "scene-s2": ["good", "The place matches. Noob is chest-up and large with plain block hands; flat eyebrow lines show the panic; Vex stands behind, smaller."],
  "scene-s3": ["warn", "The place matches. Lux is chest-up with Noob and Pixi behind; the eyebrow lines read as smug. Lux's raised arm ends in a claw hand."],
  "scene-s4": ["bad", "A full-body shot with small faces, from a different angle of the plaza, and Pixi's claw hands are the clearest brick-toy tell. The automatic picture check is written to redraw this kind of shot once, free."],
};

const avatarCards = Object.values(looks).filter((r) => r.kind === "avatar").map((r) => {
  const a = ROSTER.find((x) => x.id === r.id);
  const [tone, note] = AVATAR_NOTES[r.key] ?? [undefined, undefined];
  return { image: data(`test2/${r.file}`), title: `${a.name} · ${r.style === "roblox" ? "\"Roblox-style\" wording" : "\"blocky toy figure\" wording"} · ${r.engine === "pro" ? "Pro" : "Lite"}`, tone, meta: [["Model", r.model], ["Real cost", usd(r.cost)], ["Look asked for", a.look], ["Face", a.face]], note, prompt: r.prompt };
});
const proDone = Object.values(looks).some((r) => r.engine === "pro");
const waiting = proDone ? [] : ["Noob", "Vex", "Lux"].map((name) => ({ title: `${name} · Nano Banana Pro`, tone: "warn", meta: [["Status", "waiting"]], note: "Not run: the picture proxy has to accept Nano Banana Pro first (one added line, committed; it needs a deploy of runware-bakeoff-proxy). Nothing was sent or spent. The prompt is the same as this avatar's Lite prompt, so only the model differs." }));
const sceneCards = ["plate", "scene-s1", "scene-s2", "scene-s3", "scene-s4"].map((key) => {
  const r = looks[key];
  const [tone, note] = SCENE_NOTES[key];
  return { image: data(`test2/${r.file}`), title: key === "plate" ? "The location plate (made once per place)" : `${r.name}: ${r.presentIds.join(", ")} · ${r.emotion}`, tone, meta: [["Real cost", usd(r.cost)], ["Reference pictures sent", String(r.references)], ...(r.shot ? [["Shot asked for", r.shot]] : [])], note, prompt: r.prompt };
});
const thumbCards = Object.values(thumbs).map((t) => ({
  image: data(`thumb/${t.file}`), title: `Option ${t.key}: ${t.name}${t.key === "2" ? " (wired in)" : ""}`, tone: t.key === "2" ? "good" : "warn", meta: [["Real cost", usd(t.cost)]],
  note: t.key === "2" ? "Picked: true cube heads, the whole frame is used, bright and readable at menu size. Cropped to 880×1168 PNG, the size of AI Cooking Matic's thumbnail." : "Not picked: the picture came out letterboxed with blurred bands above and below, and the heads are rounded rather than cubes.",
  prompt: t.prompt,
}));
const menuCards = [
  ["menu-1440-flag-on.png", "Desktop 1440, flag ON: Short Form panel", "Blocky Stories sits right after AI Fruit Story, with its thumbnail."],
  ["menu-390-flag-on.png", "Phone 390, flag ON: Short Form menu", "Same place in the grid."],
  ["page-1440-flag-on.png", "Desktop 1440, flag ON: the Blocky Stories page", "Its own name, tagline and hero. The lists show \"couldn't load\" on purpose: the live API doesn't know templates yet, and the page refuses to show Fruit's data in its place."],
  ["menu-1440-flag-off.png", "Desktop 1440, flag OFF", "No entry. The route lands on Home."],
  ["menu-390-flag-off.png", "Phone 390, flag OFF", "No entry."],
].map(([file, title, note]) => ({ image: png(`qa-menus/${file}`), title, note }));

const html = await renderResultsPage({
  title: "Blocky Look Review",
  intro: "Blocky Stories, Phase 3 checkpoint: the menu entries and thumbnail, then the look. Test 2 drew six avatar reference pictures on Nano Banana 2 Lite, three with the \"Roblox-style\" wording and three with \"blocky toy figure\". Test 3 made one location plate and four scene pictures in it through the real picture builder, with the Lite avatars and the plate as reference pictures. One attempt per picture, nobody charged credits.",
  stats: [
    { value: "1 / 6", label: "avatar references fully right (the noob, \"Roblox-style\")", tone: "warn" },
    { value: "3 / 3", label: "\"blocky toy figure\" avatars drawn as brick-toy minifigures", tone: "bad" },
    { value: "5 / 6", label: "avatars with claw hands", tone: "bad" },
    { value: "0", label: "studs, text or logos in any picture", tone: "good" },
    { value: "3 / 4", label: "scenes that match the location plate", tone: "good" },
    { value: proDone ? "run" : "waiting", label: "the 3 Nano Banana Pro avatars", tone: proDone ? "good" : "warn" },
    { value: usd(sum("thumb")), label: "thumbnails, of the $0.15 cap" },
    { value: usd(sum("looks")), label: "tests 2 and 3, of the $0.80 cap" },
    { value: usd(sum()), label: "Blocky total, of the $5.00 cap" },
  ],
  sections: [
    { heading: "Test 2: avatar reference pictures", text: "Top three: the \"Roblox-style\" wording. Next three: \"blocky toy figure\". Everything else in the prompt is identical.", cards: [...avatarCards, ...waiting] },
    { heading: "Test 3: one location, four scenes", text: "The plate is made once and sent with every scene set there, after the avatar references.", cards: sceneCards },
    { heading: "Thumbnail options", cards: thumbCards },
    { heading: "Menu entries", layout: "list", cards: menuCards },
  ],
  decisions: [
    "<b>Wording: \"Roblox-style\", not \"blocky toy figure\".</b> The toy-figure wording drew a brick-toy minifigure every time. The noob in its classic colours came out right with the \"Roblox-style\" wording, so decision 13's fallback (changing its colours) is not needed.",
    "<b>The look is not ready to approve: claw hands.</b> Five of six references have C-shaped claw hands, and the scenes copy them from the references. \"No claw hands\" in the leave-out list was not enough. I'd change the reference prompt to say what the arms ARE (\"each arm is one plain rectangular block with a flat square end: no hands, no fingers\"), and the same for legs and the head, then redraw three references to check. That is a new test of about $0.10; say go and I run it.",
    "<b>Lite or Pro.</b> The three Pro pictures have not run: the picture proxy needs one deploy first (command in my message). At the recorded $0.1457 each, three Pro pictures bring this stage to $0.81, one cent over the $0.80 cap, so the guard would stop the third: either lift the cap to $0.85 or I run two. Worth deciding after the hands are fixed, so Pro is compared on the corrected prompt.",
    "<b>Location lock works.</b> Three of four scenes show the same plaza as the plate, on a flat floor with no studs. I'd keep it as built.",
    "<b>Full-body two-avatar shots still happen</b> (scene 4). The picture check written for Blocky fails such a shot and redraws it once, free (decision 15); it goes live with the engine deploy at the end of Phase 3.",
    "<b>Thumbnail:</b> option 2 is wired in. Say if you prefer option 1 or want another pair.",
  ],
});
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("written", path.join(outDir, "index.html"), (html.length / 1024).toFixed(0) + " KB");
