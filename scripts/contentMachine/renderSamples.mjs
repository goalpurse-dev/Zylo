// Renders sample slideshows in every visual style on this machine, with the real renderer
// (render-worker/src/cmSlides.mjs): PNGs, ZIP, MP4 and a contact sheet per style. $0: no model, no
// image generation (local pictures stand in for the backgrounds), no upload.
//   FFMPEG=<path to ffmpeg> node scripts/contentMachine/renderSamples.mjs <outDir> <zyvo-home.png>
import { mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderSlideshow } from "../../render-worker/src/cmSlides.mjs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const [outDir, zyvoShotFile] = process.argv.slice(2);
if (!outDir) { console.error("usage: renderSamples.mjs <outDir> <zyvo-home.png>"); process.exit(2); }
const pic = (f) => pathToFileURL(path.join(ROOT, "public/community-posters", f)).href;
const zyvoShot = zyvoShotFile ? pathToFileURL(path.resolve(zyvoShotFile)).href : null;
const S = (kind, headline, extra = {}) => ({ kind, headline, body: null, label: null, items: [], tool: null, image_prompt: null, is_zyvo: false, ...extra });

const STYLES = {
  luxury_night: { bg: "#0b0b0f", fg: "#ffffff", accent: "#f5c542", highlight: "#f5c542", font: "anton" },
  neon_grid: { bg: "#07060d", fg: "#ffffff", accent: "#a855f7", highlight: "#facc15", font: "anton", grid: true },
  minimal_clean: { bg: "#f6f3ee", fg: "#111111", accent: "#2563eb", highlight: "#fde047", font: "inter" },
  screenshot_collage: { bg: "#111318", fg: "#ffffff", accent: "#22d3ee", highlight: "#facc15", font: "anton", collage: true },
  meme_style: { bg: "#ffffff", fg: "#000000", accent: "#000000", highlight: "#ffffff", font: "anton", meme: true },
};

const SAMPLES = [
  { name: "neon_tool_listicle", style: "neon_grid", images: {}, slides: [
    S("cover", "5 AI tools that replace a *video editor*", { body: "Number 3 surprised me", label: "Faceless creators" }),
    S("item", "Cut talking videos like a doc", { label: "1", tool: { name: "Descript", url: "https://www.descript.com", what_it_does: "Edit video by editing the transcript text." } }),
    S("item", "Turn one idea into a full video", { label: "2", tool: { name: "Zyvo", url: "https://www.tryzyvo.com", what_it_does: "Makes 8–15 min illustrated YouTube videos and 9:16 Shorts from one idea." }, is_zyvo: true }),
    S("item", "Voiceovers without a mic", { label: "3", tool: { name: "ElevenLabs", url: "https://elevenlabs.io", what_it_does: "Realistic AI voices for narration in many languages." } }),
    S("cta", "Which one would you *try first*?", { body: "Tell me in the comments 👇" }),
  ] },
  { name: "luxury_steps", style: "luxury_night", images: { background: pic("cr-1.jpg") }, slides: [
    S("cover", "How I'd start YT automation *from scratch*", { label: "Save this" }),
    S("step", "Pick one niche you can make 30 videos about", { label: "01" }),
    S("step", "Write 10 hooks before you make anything", { label: "02", body: "The first 2 seconds decide everything." }),
    S("zyvo", "Make the video part *fast*", { body: "I built Zyvo for this step: one idea in, a finished video out.", is_zyvo: true }),
    S("cta", "Tool's in my bio", { body: "Comment ZYVO and I'll send the link", is_zyvo: true }),
  ] },
  { name: "minimal_tier_quiz", style: "minimal_clean", images: {}, slides: [
    S("cover", "Faceless niches ranked for *2026*", { label: "Tier list" }),
    S("tier", "My honest ranking", { items: ["S: History explainers", "A: Story animations", "B: Top-10 lists", "C: Celebrity gossip"] }),
    S("quiz_question", "Which niche needs the least editing?", { items: ["History explainers", "Gaming clips", "Vlogs"] }),
    S("quiz_answer", "History explainers", { body: "Script, voice and drawn scenes: the same steps every time." }),
    S("cta", "What's your niche?", { body: "Drop it below and I'll rank it." }),
  ] },
  { name: "collage_myth", style: "screenshot_collage", images: { background: pic("fa-2.jpg"), illustrations: { 1: pic("fa-1.jpg") } }, slides: [
    S("cover", "3 myths about *AI video*", { label: "Myth vs fact" }),
    S("text", "AI videos all look the same", { body: "Only when everyone uses the same prompt." }),
    S("versus", "Do you need a camera?", { label: "Myth vs Fact", items: ["You need to show your face to grow", "Faceless channels grow on story and hooks"] }),
    S("cta", "Which myth did you believe?", {}),
  ] },
  { name: "meme_creator_life", style: "meme_style", images: { illustrations: { 0: pic("fa-3.jpg"), 1: pic("cr-2.jpg") } }, slides: [
    S("meme", "Me after editing one 60-second video for 6 hours", { image_prompt: "x" }),
    S("meme", "The video: 212 views", { image_prompt: "x" }),
    S("cta", "Tag a creator who needs this", { body: "made with Zyvo · tryzyvo.com", is_zyvo: true }),
  ] },
];

const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
for (const s of SAMPLES) {
  const dir = path.resolve(outDir, s.name);
  await mkdir(dir, { recursive: true });
  const job = { style: STYLES[s.style], zyvoShot, images: s.images, slideshow: { slides: s.slides } };
  const t = Date.now();
  const out = await renderSlideshow(job, dir);
  spawnSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", path.join(dir, "slide-%02d.png"), "-vf", "scale=300:533,tile=5x1:padding=6:color=gray", "-frames:v", "1", path.join(outDir, `${s.name}.png`)]);
  console.log(`${s.name}: ${out.pngs.length} slides, ${out.durationSec}s video, ${((Date.now() - t) / 1000).toFixed(1)}s`);
}
