// Preview sheets: every format × every visual style, rendered with the REAL renderer and templates
// (render-worker/src/cmSlides.mjs), the safe zones drawn on top, and each slide's layout check reported.
// $0: no model, no image generation, no upload. The stand-in pictures are drawn shapes (SVG) with no
// people in them; real runs never use local pictures (the renderer accepts only https images there).
//   FFMPEG=<path to ffmpeg> node scripts/contentMachine/renderSamples.mjs <outDir> <zyvo-home.png> [format ...]
// Writes <outDir>/<format>.png (rows = styles) and <outDir>/layout.json; exits 1 if any slide fails its check.
import { mkdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { renderSlideshow } from "../../render-worker/src/cmSlides.mjs";

const [outDir, zyvoShotFile, ...only] = process.argv.slice(2);
if (!outDir) { console.error("usage: renderSamples.mjs <outDir> <zyvo-home.png> [format ...]"); process.exit(2); }
const zyvoShot = zyvoShotFile ? pathToFileURL(path.resolve(zyvoShotFile)).href : null;
const svg = (body, w = 768, h = 1344) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;

// Stand-in backgrounds per style (the real ones come from Runware with no people and no text).
const BACKGROUNDS = {
  luxury_night: svg(`<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1408"/><stop offset="1" stop-color="#050505"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="18"/></filter></defs><rect width="768" height="1344" fill="url(#g)"/>${Array.from({ length: 26 }, (_, i) => `<circle cx="${(i * 137) % 768}" cy="${200 + ((i * 211) % 700)}" r="${18 + (i % 5) * 9}" fill="${i % 3 ? "#f5c542" : "#ff9d3a"}" opacity=".45" filter="url(#b)"/>`).join("")}<rect x="0" y="980" width="768" height="364" fill="#0b0906"/>`),
  neon_grid: null,
  neon_grid_bg: svg(`<rect width="768" height="1344" fill="#07060d"/><ellipse cx="384" cy="700" rx="420" ry="300" fill="#3b0764" opacity=".6"/>`),
  minimal_clean: svg(`<defs><radialGradient id="g" cx=".3" cy=".2" r="1"><stop offset="0" stop-color="#fffdf8"/><stop offset="1" stop-color="#e9e3d8"/></radialGradient></defs><rect width="768" height="1344" fill="url(#g)"/>`),
  screenshot_collage: svg(`<rect width="768" height="1344" fill="#15171c"/>${Array.from({ length: 9 }, (_, i) => `<rect x="${(i * 173) % 640}" y="${(i * 251) % 1200}" width="220" height="150" rx="10" fill="#${["2a2f3a", "1f2a33", "33303a"][i % 3]}" transform="rotate(${(i % 5) * 4 - 8} ${(i * 173) % 640} ${(i * 251) % 1200})"/>`).join("")}`),
  meme_style: svg(`<rect width="768" height="1344" fill="#bfe3ff"/><rect x="0" y="900" width="768" height="444" fill="#8a6a4a"/><rect x="190" y="620" width="390" height="260" rx="16" fill="#333"/><rect x="210" y="640" width="350" height="210" fill="#7dd3fc"/><circle cx="640" cy="300" r="90" fill="#fde047"/>`),
};
// A drawn illustration (a laptop on a desk, a plant): no people.
// Stand-in hero pictures per style (drawn shapes, no people): the layout is what is being checked here.
const HERO = (style, i) => {
  const c = { luxury_night: ["#2a1b0a", "#f5c542"], neon_grid: ["#0d0718", "#a855f7"], minimal_clean: ["#efe9df", "#2563eb"], screenshot_collage: ["#1a1f29", "#22d3ee"], meme_style: ["#bfe3ff", "#fb923c"] }[style] ?? ["#222", "#888"];
  return svg(`<rect width="1024" height="768" fill="${c[0]}"/><circle cx="${380 + (i * 97) % 300}" cy="${330 + (i * 53) % 150}" r="${150 + (i % 3) * 35}" fill="${c[1]}" opacity=".85"/><rect x="${200 + (i * 71) % 400}" y="500" width="260" height="160" rx="30" fill="#ffffff" opacity=".7"/>`, 1024, 768);
};
const ILLU = svg(`<rect width="768" height="1344" fill="#2b1d4a"/><rect x="0" y="880" width="768" height="464" fill="#4a3426"/><rect x="170" y="560" width="430" height="300" rx="18" fill="#222"/><rect x="190" y="580" width="390" height="250" fill="#a78bfa"/><rect x="120" y="860" width="530" height="26" rx="8" fill="#555"/><rect x="620" y="700" width="70" height="160" rx="10" fill="#7c5a3a"/><circle cx="655" cy="660" r="70" fill="#22c55e"/>`);

const STYLES = {
  luxury_night: { bg: "#0b0b0f", fg: "#ffffff", accent: "#f5c542", highlight: "#f5c542", font: "anton" },
  neon_grid: { bg: "#07060d", fg: "#ffffff", accent: "#a855f7", highlight: "#facc15", font: "anton", grid: true },
  minimal_clean: { bg: "#f6f3ee", fg: "#111111", accent: "#2563eb", highlight: "#fde047", font: "inter" },
  screenshot_collage: { bg: "#111318", fg: "#ffffff", accent: "#22d3ee", highlight: "#facc15", font: "anton", collage: true },
  meme_style: { bg: "#ffffff", fg: "#000000", accent: "#000000", highlight: "#fde047", font: "anton", meme: true },
};

const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], tool: null, image_prompt: null, is_zyvo: false, ...extra });
const T = (name, url, what) => ({ name, url, what_it_does: what });
const ZYVO = T("Zyvo", "https://www.tryzyvo.com", "Turns one idea into an 8–15 min illustrated YouTube video, or a 9:16 Short from a template.");

// One realistic slideshow per format (real tools, honest claims), longest copy the rules allow.
const FORMATS = {
  tool_listicle: [
    S("cover", "5 AI tools that replace a *video editor*", { label: "Faceless creators", body: "Number 3 is the one I use most" }),
    S("item", "Edit video by editing the text", { label: "1", tool: T("Descript", "https://www.descript.com", "Edit audio and video by editing the transcript, like a document.") }),
    S("item", "Turn one idea into a full video", { label: "2", tool: ZYVO, is_zyvo: true }),
    S("item", "Voiceovers without a microphone", { label: "3", tool: T("ElevenLabs", "https://elevenlabs.io", "Realistic AI voices for narration in many languages.") }),
    S("item", "Captions and quick cuts on your phone", { label: "4", tool: T("CapCut", "https://www.capcut.com", "Free editor with auto captions, templates and effects.") }),
    S("cta", "Which one would you *try first*?", { body: "Tell me in the comments 👇" }),
  ],
  numbered_steps: [
    S("cover", "How I'd start YT automation *from scratch*", { label: "Save this" }),
    S("step", "Pick one niche you could make 30 videos about", { label: "01", body: "History, science, money basics: topics with endless questions." }),
    S("step", "Write 10 hooks before you make anything", { label: "02", body: "The first 2 seconds decide if anyone stays." }),
    S("step", "Make the video part *fast*", { label: "03", body: "I built Zyvo for this step: one idea in, a finished video out.", is_zyvo: true }),
    S("step", "Post on a schedule you can keep for 90 days", { label: "04" }),
    S("cta", "Tool's in my bio", { body: "Comment ZYVO and I'll send the link", is_zyvo: true }),
  ],
  pov_text: [
    S("cover", "POV: you finally *automated* your channel", { image_prompt: "x" }),
    S("text", "No more 6-hour editing nights", { body: "The script, the voice and the scenes are done before dinner." }),
    S("text", "You spend the time on ideas instead", { body: "Which is the part that actually grows a channel." }),
    S("cta", "Made with Zyvo", { body: "tryzyvo.com", is_zyvo: true }),
  ],
  wish_i_knew: [
    S("cover", "Things I wish I knew before starting a *faceless channel*", { label: "5 lessons" }),
    S("text", "Your first 20 videos are practice", { body: "Nobody is watching yet. That's freedom, not failure." }),
    S("text", "Hooks matter more than editing", { body: "A perfect edit can't save a boring first line." }),
    S("text", "Consistency beats quality spikes", { body: "One good video a week beats one great video a month." }),
    S("text", "Speed up the boring parts", { body: "I use Zyvo to turn a script into scenes, so I can focus on ideas.", is_zyvo: true }),
    S("cta", "Which one hit hardest?", { body: "Drop the number below" }),
  ],
  mistakes: [
    S("cover", "Stop making these *faceless channel* mistakes", { label: "Warning" }),
    S("step", "Changing niche every week", { label: "01", body: "The algorithm can't learn who to show you to." }),
    S("step", "No hook in the first 2 seconds", { label: "02", body: "Start with the most surprising line, not an intro." }),
    S("step", "Editing everything by hand", { label: "03", body: "Use tools for the repeatable parts: captions, scenes, voice.", is_zyvo: true }),
    S("cta", "Which mistake are you making?", { body: "Be honest in the comments" }),
  ],
  myth_fact: [
    S("cover", "3 myths about *AI video* that aren't true", { label: "Myth vs fact" }),
    S("versus", "Do you need a camera to grow?", { label: "Myth vs Fact", items: ["You need to show your face to grow a channel", "Faceless channels grow on story, hooks and consistency"] }),
    S("versus", "Does AI content all look the same?", { label: "Myth vs Fact", items: ["Every AI video looks identical", "It looks the same when everyone uses the same prompt"] }),
    S("versus", "Is it only for tech people?", { label: "Myth vs Fact", items: ["You need to code to make AI videos", "Tools like Zyvo start from one sentence in the browser"], is_zyvo: true }),
    S("cta", "Which myth did you believe?", {}),
  ],
  tool_vs_tool: [
    S("cover", "CapCut vs Descript: which one *for you*?", { label: "Honest comparison" }),
    S("versus", "For quick social clips", { label: "Descript vs CapCut", items: ["Built around the transcript: great for talking videos", "Fast templates, effects and captions on mobile"] }),
    S("versus", "For podcasts and interviews", { label: "CapCut vs Descript", items: ["Fine for short cuts, not built for long talks", "Edit by deleting words; removes filler words"] }),
    S("text", "Neither makes the video for you", { body: "If you start from an idea, not footage, that's what Zyvo is for.", is_zyvo: true }),
    S("cta", "Team CapCut or team Descript?", {}),
  ],
  tier_list: [
    S("cover", "Faceless niches ranked for *2026*", { label: "Tier list" }),
    S("tier", "My honest ranking", { items: ["S: History explainers", "A: Story animations", "B: Top-10 lists", "C: Celebrity gossip"] }),
    S("text", "Why history is S tier", { body: "Endless questions, evergreen views, and it works great as illustrated video." }),
    S("cta", "What's your niche?", { body: "I'll rank it in the comments" }),
  ],
  guess_ai: [
    S("cover", "Only 1 in 10 people can *spot the AI* image", { label: "Challenge" }),
    S("quiz_question", "Which one is AI?", { items: ["The left image", "The right image"], image_prompt: "x" }),
    S("quiz_answer", "Both were made with AI", { body: "Made with Zyvo's image generator.", is_zyvo: true }),
    S("cta", "Did you get it right?", { body: "Be honest 👀" }),
  ],
  before_after: [
    S("cover", "Making a YouTube video: *before vs after*", { label: "Before / after" }),
    S("versus", "The script", { label: "Before vs After", items: ["A blank page and three hours", "Pick a niche and an idea, edit the draft"] }),
    S("versus", "The visuals", { label: "Before vs After", items: ["Hunting stock footage for every line", "About 150 drawn scenes, each one editable"], is_zyvo: true }),
    S("cta", "Which part takes you longest?", {}),
  ],
  hot_take: [
    S("cover", "Posting every day is *killing* your channel", { label: "Hot take" }),
    S("text", "Volume isn't the problem. Ideas are.", { body: "Three strong videos a week beat seven forgettable ones." }),
    S("text", "Spend the saved time on hooks", { body: "And let tools handle the repetitive production work.", is_zyvo: true }),
    S("cta", "Agree or disagree?", { body: "Fight me in the comments" }),
  ],
  mini_story: [
    S("cover", "She edited for 6 hours. The video got *212 views*.", { label: "A short story" }),
    S("text", "So she changed one thing", { body: "She wrote 10 hooks before making anything." }),
    S("text", "The next video took one afternoon", { body: "The scenes and voice came from Zyvo; she spent her time on the story.", is_zyvo: true }),
    S("text", "It wasn't the edit. It was the first line.", { illustration: true, image_prompt: "x" }),
    S("cta", "What would you change first?", {}),
  ],
  cheat_sheet: [
    S("cover", "Faceless YouTube *cheat sheet*", { label: "Save this" }),
    S("step", "Hooks", { label: "01", items: ["Start with the surprise", "Ask a question in line 1", "Promise a number"] }),
    S("step", "Retention", { label: "02", items: ["Change the visual every 3 s", "Cut every pause", "Tease what's next"] }),
    S("step", "Production", { label: "03", items: ["Script first, visuals second", "Reuse a style", "Zyvo for scenes and voice"], is_zyvo: true }),
    S("cta", "Save it for your next video", {}),
  ],
  checklist: [
    S("cover", "Before you *post* a Short", { label: "Checklist" }),
    S("checklist", "Check these 5", { items: ["Hook in the first 2 seconds", "Captions on", "One idea per video", "Ends on a question", "Made fast, posted on time"] }),
    S("cta", "Save this for your next post", { is_zyvo: true }),
  ],
  quiz: [
    S("cover", "Faceless YouTube *quiz*", { label: "Score yourself" }),
    S("quiz_question", "Which niche needs the least editing?", { items: ["History explainers", "Gaming clips", "Daily vlogs"] }),
    S("quiz_answer", "History explainers", { body: "Script, voice and drawn scenes: the same steps every time." }),
    S("quiz_question", "What matters most in a Short?", { items: ["The first 2 seconds", "The music", "The thumbnail"] }),
    S("quiz_answer", "The first 2 seconds", { body: "That's where viewers decide to stay." }),
    S("cta", "What did you score?", { body: "Tell me below", is_zyvo: true }),
  ],
  meme: [
    S("meme", "Me after editing one 60-second video for 6 hours", { image_prompt: "x" }),
    S("meme", "The video: 212 views", { image_prompt: "x" }),
    S("cta", "Tag a creator who needs this", { body: "made with Zyvo · tryzyvo.com", is_zyvo: true }),
  ],
  zyvo_showcase: [
    S("cover", "Would you *watch this*?", { label: "Made with Zyvo" }),
    S("zyvo", "One idea in, a full video out", { body: "An 8–15 minute illustrated YouTube video from a niche and an idea.", is_zyvo: true }),
    S("text", "Every scene is editable", { body: "Change any of the ~150 scenes before you download.", image_prompt: "x" }),
    S("cta", "Rate it 1–10", { body: "Honest answers only", is_zyvo: true }),
  ],
};

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const report = {};
let failed = 0;
for (const [format, slidesIn] of Object.entries(FORMATS)) {
  if (only.length && !only.includes(format)) continue;
  const rows = [];
  for (const [styleKey, style] of Object.entries(STYLES)) {
    const dir = path.resolve(outDir, format, styleKey);
    await mkdir(dir, { recursive: true });
    const slides = slidesIn.map(({ illustration, ...s }) => s);
    // A stand-in hero picture on every slide but the cta (the real ones are generated per slide).
    // Zyvo slides show the real Zyvo screen (no stand-in); meme pictures are tall.
    const heroes = Object.fromEntries(slidesIn.map((s, i) => [i, s.is_zyvo ? null : (s.kind === "meme" || styleKey === "meme_style") ? ILLU : HERO(styleKey, i)]).filter(([, v]) => v));
    const job = { style, zyvoShot, images: { background: BACKGROUNDS[styleKey] ?? BACKGROUNDS.neon_grid_bg, heroes }, slideshow: { slides } };
    const out = await renderSlideshow(job, dir, { local: true, safeZones: true, keepGoing: true });
    report[`${format} × ${styleKey}`] = out.layoutProblems;
    if (out.layoutProblems.length) { failed += 1; console.log(`FAIL ${format} × ${styleKey}: ${out.layoutProblems.map((l) => `slide ${l.slide}: ${l.problems.join("; ")}`).join(" | ")}`); }
    const row = path.join(outDir, format, `${styleKey}.png`);
    spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(dir, "slide-%02d.png"), "-vf", `scale=216:384,tile=${slides.length}x1:padding=6:color=0x444444`, "-frames:v", "1", row]);
    rows.push(row);
  }
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  for (const r of rows) args.push("-i", r);
  const widest = Math.max(...slidesIn.map(() => 0), slidesIn.length) * 222;
  args.push("-filter_complex", `${rows.map((_, i) => `[${i}]pad=${widest}:390:0:3:0x222222[r${i}]`).join(";")};${rows.map((_, i) => `[r${i}]`).join("")}vstack=${rows.length}`, path.join(outDir, `${format}.png`));
  spawnSync(ffmpeg, args);
  console.log(`${format}: ${rows.length} styles`);
}
await writeFile(path.join(outDir, "layout.json"), JSON.stringify(report, null, 2));
console.log(failed ? `${failed} format × style combinations have layout problems (see layout.json).` : "Every slide passed the layout check (no overlaps, all text inside the safe zone, every image loaded).");
process.exit(failed ? 1 : 0);
