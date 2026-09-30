// Approved IP art swap: copies art-review/ip-replacements/ into public/,
// repoints every reference, applies the renames, and removes the replaced
// IP files from public/ (all originals stay in art-backup/ip-originals/).
//   node scripts/ipArtSwap.mjs
import fs from "node:fs";
import path from "node:path";

const REVIEW = "art-review/ip-replacements";
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

// 1. New art into public/ (skip rejected drafts and the report).
for (const f of walk(REVIEW)) {
  if (f.endsWith("report.json") || f.includes(".rejected.")) continue;
  const dest = path.join("public", path.relative(REVIEW, f));
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(f, dest);
}

// 2. References: [file, [[from, to], ...]] — every "from" must exist.
const FACES = [["ronaldo", "face-01"], ["messi", "face-02"], ["neymar", "face-03"], ["mbappe", "face-04"], ["haaland", "face-05"], ["billie", "face-06"], ["ariana", "face-07"], ["taylor", "face-08"], ["the rock", "face-09"], ["neypreview", "face-preview"]];
const global = [
  ["ninjago (", "mountain-ninja-city ("], ["ninjago%20(", "mountain-ninja-city%20("],
  ["pokemon (", "seaside-creature-town ("], ["pokemon%20(", "seaside-creature-town%20("],
  ["/template/nationality-swap/preview.png", "/template/kit-swap/preview.png"],
  ...FACES.map(([a, b]) => [`/face/${a}.png`, `/face/${b}.png`]),
];
const edits = {
  "src/components/viral-tools/two-am/TwoAmDemoCarousel.jsx": [['id: "ninjago",\n    label: "Ninjago",', 'id: "mountain-ninja-city",\n    label: "Mountain Ninja City",'], ['id: "pokemon",\n    label: "Pokémon",', 'id: "seaside-creature-town",\n    label: "Seaside Creature Town",']],
  "src/components/viral-tools/two-am/TwoAmGenerator.jsx": [['const PLACEHOLDERS = ["Pokémon Alola", "Kai from Ninjago", "Naruto Shippuden", "Hogwarts", "SpongeBob Bikini Bottom", "GTA Vice City"];', 'const PLACEHOLDERS = ["A seaside creature town", "A mountain ninja city", "A wizard school at midnight", "An underwater cartoon town", "A neon beach city", "A snowy mountain village"];']],
  "src/pages/landing/ThirtyDaysLanding.jsx": [
    ['text: "LEGO Ninjago, Pokémon, Hogwarts, Naruto, One Piece, Minecraft — or type in any fictional world you want to visit.",', 'text: "A brick-built ninja world, a creature-catching island, a wizard castle, a pirate sea, a blocky survival world — or type in any world you want to visit.",'],
    ['const UNIVERSES = ["LEGO Ninjago", "Pokémon", "Hogwarts", "Naruto", "One Piece", "Minecraft", "Or type your own"];', 'const UNIVERSES = ["A brick-built ninja world", "A creature-catching island", "A wizard castle", "A pirate sea", "A blocky survival world", "Or type your own"];'],
    ['a: "The examples — LEGO Ninjago, Pokémon, Hogwarts, Naruto, One Piece, Minecraft — are just starting points. You can type in any world you want to visit.",', 'a: "The examples are just starting points. You can type in any world you want to visit.",'],
  ],
  "src/components/viral-tools/face-asmr/FaceAsmrBuilder.jsx": [['const CELEBRITIES = ["Ronaldo", "Messi", "Taylor Swift", "Drake", "Elon Musk",\n  "Billie Eilish", "LeBron James", "Rihanna", "Kanye West"];', 'const CELEBRITIES = ["Face 1", "Face 2", "Face 3", "Face 4", "Face 5", "Face 6", "Face 7", "Face 8", "Face 9"];']],
  "src/pages/landing/FaceAsmrLanding.jsx": [['name: "Messi"', 'name: "Face 2"'], ['name: "Ronaldo"', 'name: "Face 1"'], ['name: "Neymar"', 'name: "Face 3"'], ['name: "Mbappé"', 'name: "Face 4"'], ['name: "Ariana"', 'name: "Face 7"'], ['name: "Billie"', 'name: "Face 6"'], ['name: "Taylor"', 'name: "Face 8"'], ['name: "Haaland"', 'name: "Face 5"']],
  "src/components/viral-tools/cartoon-drive-by/CartoonDriveByBuilder.jsx": [[`  "A pineapple home and stone tiki house beneath the sea",
  "A cheerful yellow family's suburban cartoon neighborhood",
  "A blocky fantasy kingdom with a distant mountain castle",
  "A colorful racing-game highway approaching a mushroom castle",`, `  "A candy-coloured seaside village",
  "A sleepy cartoon suburb at dusk",
  "A floating kingdom above the clouds",
  "A neon racetrack city",`]],
  "src/components/workspace/popularstyles.jsx": [
    ['{ title: "Lego",           description: "Blocky cinematic scenes with toy-like charm and clarity.",    image: "/styles/lego2.webp"', '{ title: "Toy Diorama",    description: "Tiny handmade toy worlds with soft vinyl and clay figures.",   image: "/styles/toy-diorama.webp"'],
    ['{ title: "Minecraft",      description: "Blocky stylized scenes inspired by voxel worlds.",            image: "/styles/minecraft2.webp"', '{ title: "Voxel World",    description: "Blocky stylized scenes built from little cubes.",             image: "/styles/voxel-world.webp"'],
    ['{ title: "Disney",         description: "Family-friendly cinematic charm with polished characters.",   image: "/styles/disney2.webp"', '{ title: "Classic 3D Animation", description: "Family-friendly cinematic charm with polished characters.", image: "/styles/classic-3d-animation.webp"'],
    ['{ title: "Ghibli",         description: "Soft storybook worlds with warm, dreamy composition.",        image: "/styles/ghibli2.webp"', '{ title: "Hand-Painted Anime", description: "Soft storybook worlds with warm, dreamy composition.",   image: "/styles/hand-painted-anime.webp"'],
  ],
  "src/lib/image-generator/styles.ts": [
    ['  disney: "/images/thumbs/disney.webp",', '  disney: "/images/thumbs/classic-3d-animation.webp",'],
    ['  lego: "/images/thumbs/lego.webp",', '  lego: "/images/thumbs/toy-diorama.webp",'],
    ['  minecraft: "/images/thumbs/minecraft.webp",', '  minecraft: "/images/thumbs/voxel-world.webp",'],
    ['  ghibli: "/images/thumbs/ghibli.webp",', '  ghibli: "/images/thumbs/hand-painted-anime.webp",'],
    ['    label: "Minecraft",\n    promptHint: "Minecraft-style blocky, pixelated, low-poly aesthetic",', '    label: "Voxel World",\n    promptHint: "blocky voxel world built from small cubes, pixelated low-poly aesthetic",'],
    ['    label: "Disney",\n    promptHint: "Disney-inspired animation style, soft shading, friendly proportions",', '    label: "Classic 3D Animation",\n    promptHint: "classic 3D animated feature film look, soft shading, friendly rounded proportions",'],
    ['    label: "Ghibli",\n    promptHint: "Studio Ghibli-style animation, soft shading, whimsical aesthetic",', '    label: "Hand-Painted Anime",\n    promptHint: "hand-painted anime background art, soft watercolor shading, whimsical aesthetic",'],
    ['    label: "Lego",\n    promptHint: "LEGO-style build, plastic bricks, toy-like proportions",', '    label: "Toy Diorama",\n    promptHint: "miniature toy diorama, soft vinyl and clay toy figures, tilt-shift macro look",'],
  ],
  "src/components/workspace/CreateMenu.jsx": [['label: "Nationality Swap"', 'label: "Kit Swap"']],
  "src/components/workspace/ZyvoSuiteCarousel.jsx": [['{ name: "Nationality Swap", desc: "Reimagine football stars around the world"', '{ name: "Kit Swap", desc: "Swap a player\'s kit for any country"']],
  "src/components/home-v2/HomeV2Sections.jsx": [
    ['{ name: "Nationality Swap", desc: "Reimagine football stars around the world"', '{ name: "Kit Swap", desc: "Swap a player\'s kit for any country"'],
    ['{ name: "30 Days", desc: "Thirty days inside any world", image: "/template/2am-world/preview.png"', '{ name: "30 Days", desc: "Thirty days inside any world", image: "/template/thirty-days/preview.png"'],
  ],
};
// 30 Days' own preview in the Short Form menu (it borrowed the 2AM image).
edits["src/components/workspace/CreateMenu.jsx"].push(["    // Temporary launch art; replace with a dedicated 30 Days preview asset.\n    preview: \"/template/2am-world/preview.png\",", "    preview: \"/template/thirty-days/preview.png\","]);

let changed = 0;
for (const f of walk("src").filter((x) => /\.(jsx?|tsx?)$/.test(x))) {
  let s = fs.readFileSync(f, "utf8"); const crlf = s.includes("\r\n"); s = s.replace(/\r\n/g, "\n");
  const before = s;
  for (const [a, b] of edits[f.replace(/\\/g, "/")] ?? []) { if (!s.includes(a)) throw new Error(`miss in ${f}: ${a.slice(0, 70)}`); s = s.replace(a, b); }
  for (const [a, b] of global) s = s.split(a).join(b);
  if (s !== before) { fs.writeFileSync(f, crlf ? s.replace(/\n/g, "\r\n") : s); changed++; }
}
console.log("files changed:", changed);

// 3. Remove the replaced IP files from public/ (backed up already).
const gone = [
  ...Array.from({ length: 7 }, (_, i) => `public/template/2am-world/ninjago (${i + 1}).png`),
  ...Array.from({ length: 6 }, (_, i) => `public/template/2am-world/pokemon (${i + 2}).png`),
  ...FACES.map(([a]) => `public/face/${a}.png`),
  "public/template/nationality-swap/preview.png",
  "public/styles/lego2.webp", "public/styles/minecraft2.webp", "public/styles/disney2.webp", "public/styles/ghibli2.webp",
  "public/images/thumbs/lego.webp", "public/images/thumbs/minecraft.webp", "public/images/thumbs/disney.webp", "public/images/thumbs/ghibli.webp",
];
for (const f of gone) {
  const backup = path.join("art-backup/ip-originals", f.replace(/^public\//, ""));
  if (!fs.existsSync(backup)) throw new Error(`no backup for ${f}; not deleting`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
console.log("removed:", gone.length);
