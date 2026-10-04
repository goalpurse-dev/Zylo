/**
 * /ai-fruit-story-maker — the main AI Fruit Story page.
 *
 * Owns the searches "ai fruit story generator", "ai fruit story maker" and
 * "ai fruit story". The numbers, FAQ, characters and example-video slots live
 * in src/data/fruitStoryPages.js (the JSON-LD reads the same file). The copy
 * must match the tool as it works today; see the rules in that file.
 */

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, Copy, CopyCheck, Play } from "lucide-react";
import Footer from "../../components/workspace/footer.jsx";
import MakeFruitVideoButton from "../../components/seo/MakeFruitVideoButton.jsx";
import { EXAMPLE_VIDEO } from "../../components/viral-tools/ai-fruit-story-v2/constants";
import { optImg } from "../../lib/optImage.js";
import {
  FRUIT_ASSETS,
  FRUIT_CHARACTERS,
  FRUIT_EXAMPLE_SERIES,
  FRUIT_EXAMPLE_VIDEOS,
  FRUIT_FACTS as F,
  FRUIT_FAQ,
  FRUIT_QUALITY,
  FRUIT_STARTER_PROMPTS,
  FRUIT_TOOL_PATH,
  filledVideos,
} from "../../data/fruitStoryPages.js";

const SLUG = "ai-fruit-story-maker";
const PRIMARY = "rounded-[16px] px-8 py-4 text-[16px] font-black text-white shadow-[0_8px_32px_rgba(124,58,237,0.5)] transition hover:opacity-90 active:scale-[0.98]";
const PRIMARY_BG = { background: "linear-gradient(135deg,#7C3AED,#A855F7)" };
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400";

const SERIES_STEPS = [
  { n: "01", title: "Answer five questions", desc: `What the series is about, who is in it (${F.minCastSeries} to ${F.maxCastSeries} characters), how episode 1 opens, how they talk, and how many episodes (${F.minEpisodes} to ${F.maxEpisodes}).` },
  { n: "02", title: "Get the episode plan", desc: "Every episode gets a title, a summary and the cliffhanger it ends on. Writing the plan uses no credits. You pay when you make an episode." },
  { n: "03", title: "A series bible keeps it consistent", desc: "Each character gets a fixed role, a signature prop and a catchphrase. The places the story returns to are saved too, so the office in episode 7 is the office from episode 1." },
  { n: "04", title: "Make episodes in order", desc: "Episodes unlock one at a time, so every cliffhanger lands. You choose the length and the video quality for each episode when you make it." },
  { n: "05", title: "Post it as a series", desc: "Add a \"Part 3\" label at the start and a \"Follow for more\" end card that names the next episode. Cover images use the same layout across the series." },
];

const HOW_STEPS = [
  { n: "01", title: "Start the story", desc: "Pick a ready idea, describe your own story in a sentence or two, or paste a finished script." },
  { n: "02", title: "Choose characters and settings", desc: `Use up to ${F.maxCastSingle} characters from the library. Set the length (${F.minLengthSec} seconds to ${F.maxLengthMin} minutes), tall or wide, and V2, V3 or V4 quality. You see the cost in credits before you start.` },
  { n: "03", title: "Check every scene", desc: "Zyvo writes the script and makes one picture per scene. Edit or regenerate any scene until you are happy. Nothing is animated yet." },
  { n: "04", title: "Animate", desc: "Each picture becomes a short clip of the character saying their line." },
  { n: "05", title: "Download and post", desc: "Turn captions on or off, download the video and the cover image, and copy the title, caption, pinned comment and hashtags written for it." },
];

const FEATURES = [
  { title: `${F.characters} characters`, desc: "Wives, bosses, interns, in-laws, kingpins. Every character has a fixed look that is reused in every scene and every episode." },
  { title: "Three ways to start", desc: "Pick a ready idea, describe your own story, or paste your own script. Every line of a script becomes one scene." },
  { title: `${F.minLengthSec} seconds to ${F.maxLengthMin} minutes`, desc: "About one scene for every 5 seconds. Each scene is one character saying one line." },
  { title: "Check scenes before animating", desc: "You see every scene picture first and can edit or regenerate any of them. You only pay for video once you are happy." },
  { title: "V2, V3 or V4 quality", desc: "V2 is on every paid plan, V3 starts on Pro and V4 is on Generative." },
  { title: `Series of up to ${F.maxEpisodes} episodes`, desc: "One cast, a cliffhanger for every episode, and a series bible that keeps roles, props and places the same." },
  { title: "Captions", desc: "Each line shown on screen, switched on or off for the finished video." },
  { title: "Cover image and post text", desc: "A cover from the most dramatic scene, plus a title, caption, pinned comment and hashtags." },
  { title: "Tall or wide", desc: "9:16 for TikTok, Reels and Shorts, or 16:9. Series episodes are always 9:16." },
];

const STATS = [
  { v: String(F.characters), l: "Characters in the library" },
  { v: `${F.minLengthSec} s – ${F.maxLengthMin} min`, l: "Video length" },
  { v: `Up to ${F.maxEpisodes}`, l: "Episodes per series" },
  { v: "9:16 · 16:9", l: "Video shapes" },
];

const GUIDES = [
  ["AI Fruit Story Prompts", "/blog/best-ai-fruit-story-ideas"],
  ["How to Write a Prompt", "/blog/ai-fruit-story-prompt-formula"],
  ["How to Make Fruit Drama Videos", "/blog/viral-ai-fruit-drama-videos"],
  ["What Is AI Fruit Story?", "/blog/what-is-ai-fruit-story"],
  ["Pricing and Credits", "/blog/ai-fruit-story-pricing"],
  ["Writing Dialogue and Scripts", "/blog/ai-fruit-story-talking-dialogue-tips"],
  ["Character Ideas", "/blog/ai-fruit-story-character-ideas"],
  ["Plan a Series", "/blog/ai-fruit-story-series-universe"],
  ["Cliffhanger Endings", "/blog/ai-fruit-story-cliffhangers"],
  ["Plot Twists", "/blog/ai-fruit-story-plot-twists"],
  ["Going Viral on TikTok", "/blog/how-to-go-viral-tiktok-fruit-drama"],
  ["Posting to Reels and Shorts", "/blog/ai-fruit-story-instagram-youtube-shorts"],
];

function OpenToolButton({ children = "Open AI Fruit Story Tool →", className = "" }) {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(FRUIT_TOOL_PATH)} className={`${PRIMARY} ${FOCUS} ${className}`} style={PRIMARY_BG}>
      {children}
    </button>
  );
}

// The example in the phone: the poster is the page's largest picture, and the
// video file is only fetched after a click.
function HeroExample() {
  const [on, setOn] = useState(false);
  return (
    <div className="relative mx-auto w-[200px] sm:w-[220px]">
      <div className="overflow-hidden rounded-[38px] border-2 border-white/15 bg-black shadow-[0_32px_80px_rgba(0,0,0,0.8)]">
        <div className="relative aspect-[9/16] overflow-hidden">
          {on ? (
            <video src={EXAMPLE_VIDEO.url} poster={EXAMPLE_VIDEO.poster} controls autoPlay playsInline preload="none" className="h-full w-full object-cover" aria-label={`Example video: ${EXAMPLE_VIDEO.title}`} />
          ) : (
            <button type="button" onClick={() => setOn(true)} aria-label={`Play the example video: ${EXAMPLE_VIDEO.title}`} className={`group absolute inset-0 h-full w-full ${FOCUS}`}>
              <img {...optImg(`${FRUIT_ASSETS}/ken-reads-everything.jpg`, "220px", 480)} alt="Scene from an AI fruit story video: a kiwi IT guy with a laptop leans into the office of an apple boss" width="720" height="1280" loading="eager" fetchPriority="high" decoding="async" className="h-full w-full object-cover" />
              <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#3b1a78] shadow-lg transition group-hover:scale-105">
                <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">
        &ldquo;{EXAMPLE_VIDEO.title}&rdquo;, a real video made with the tool. 6 scenes, V2 quality.
      </p>
    </div>
  );
}

// An example video: the poster is a button, and the MP4 is fetched only after the click.
function ExampleVideo({ video }) {
  const [on, setOn] = useState(false);
  const name = video.title || "AI fruit story example video";
  return (
    <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[18px] border border-white/10 bg-black">
      {on ? (
        <video src={video.url} poster={video.posterSrc} controls autoPlay playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={name} />
      ) : (
        <button type="button" onClick={() => setOn(true)} aria-label={`Play the video: ${name}`} className={`group absolute inset-0 h-full w-full ${FOCUS}`}>
          <img {...optImg(video.posterSrc, "(min-width: 640px) 280px, 45vw", 480)} alt={`Poster of ${name}`} width="405" height="720" loading="lazy" decoding="async" className="h-full w-full object-cover" />
          <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/10" />
          <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#3b1a78] shadow-lg transition group-hover:scale-105">
            <Play className="h-6 w-6 translate-x-0.5 fill-current" aria-hidden="true" />
          </span>
          {video.length && <span className="absolute bottom-3 right-3 rounded-md bg-black/75 px-2 py-1 text-[12px] font-bold tabular-nums text-white">{video.length}</span>}
        </button>
      )}
    </div>
  );
}

// Local dev only: shows where an example video will go. Visitors never see it.
function EmptySlot({ label }) {
  return (
    <div className="grid aspect-[9/16] w-full place-items-center rounded-[18px] border border-dashed border-white/20 bg-white/[0.02] p-4 text-center">
      <p className="text-[11px] leading-relaxed text-white/40">
        <span className="block font-bold text-white/60">{label}</span>
        Empty slot. Add the video and poster file names in src/data/fruitStoryPages.js
      </p>
    </div>
  );
}

function VideoSlots({ slots, caption }) {
  const videos = filledVideos(slots);
  const empty = import.meta.env.DEV ? slots.filter((s) => !s.video || !s.poster) : [];
  if (!videos.length && !empty.length) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {videos.map((video, i) => (
        <figure key={video.url}>
          <ExampleVideo video={video} />
          <figcaption className="mt-2 text-[12px] leading-relaxed text-white/50">{caption ? caption(video, i) : video.title}</figcaption>
        </figure>
      ))}
      {empty.map((slot) => <EmptySlot key={slot.slot} label={slot.slot} />)}
    </div>
  );
}

function StarterPrompt({ prompt, castIds }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable — the button simply won't confirm
    }
  };
  return (
    <div className="flex flex-col rounded-[18px] border border-purple-400/15 bg-purple-500/[0.05] p-5">
      <p className="flex-1 text-[13px] leading-relaxed text-white/65">{prompt}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <MakeFruitVideoButton prompt={prompt} castIds={castIds} slug={SLUG}
          className={`rounded-lg bg-purple-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-purple-400 ${FOCUS}`} />
        <button type="button" onClick={copy} className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:border-purple-400/40 hover:text-white ${FOCUS}`}>
          {copied ? <CopyCheck size={12} className="text-purple-300" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function StepCard({ step }) {
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] p-6">
      <div className="mb-3 text-[28px] font-black leading-none text-white/[0.12]">{step.n}</div>
      <h3 className="mb-2 text-[15px] font-bold text-white">{step.title}</h3>
      <p className="text-[13px] leading-relaxed text-white/50">{step.desc}</p>
    </div>
  );
}

export default function AIFruitStoryLanding() {
  const seriesVideos = filledVideos(FRUIT_EXAMPLE_SERIES.episodes);
  const showExamples = filledVideos(FRUIT_EXAMPLE_VIDEOS).length > 0 || import.meta.env.DEV;
  const showSeriesExample = seriesVideos.length > 0 || import.meta.env.DEV;

  return (
    <div className="min-h-screen bg-[#09090b] text-white">

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-20">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-purple-600/10 blur-[150px]" />
          <div className="absolute right-0 top-1/4 h-[400px] w-[400px] rounded-full bg-violet-500/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-16">

            <div className="w-full min-w-0 flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 sm:px-4">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.11em] text-purple-300 sm:text-[11px] sm:tracking-[0.15em]">Single videos and series</span>
              </div>

              <h1 className="mb-5 max-w-full text-[36px] font-black leading-[1.04] tracking-tight sm:text-[52px] lg:text-[60px]">
                AI Fruit Story<br />
                <span className="bg-gradient-to-r from-[#A855F7] via-[#D8B4FE] to-[#7C3AED] bg-clip-text text-transparent">
                  Generator
                </span>
              </h1>

              <p className="mx-auto mb-7 max-w-xl text-[16px] leading-relaxed text-white/60 sm:text-[18px] lg:mx-0">
                Turn one idea into a talking fruit drama video, or a whole series of up to {F.maxEpisodes} episodes with the same cast.
                Pick from {F.characters} characters, check every scene before it is animated, and download a finished video with captions.
              </p>

              <div className="mb-6 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
                <OpenToolButton className="w-full sm:w-auto" />
                <span className="text-[13px] text-white/40">Account and paid plan required</span>
              </div>

              {/* Series, above the fold */}
              <a href="#series" className={`mx-auto mb-7 block max-w-xl rounded-[18px] border border-purple-400/30 bg-purple-500/[0.08] p-4 text-left transition hover:border-purple-400/60 lg:mx-0 ${FOCUS}`}>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-purple-300">New: series</span>
                <span className="mt-1 block text-[16px] font-black text-white">Up to {F.maxEpisodes} episodes, one cast</span>
                <span className="mt-1 block text-[13px] leading-relaxed text-white/55">
                  Zyvo plans every episode with a cliffhanger and keeps a series bible, so the characters and places stay the same from episode 1 to the finale.
                </span>
                <span className="mt-2 block text-[12px] font-bold text-purple-300">See how series work ↓</span>
              </a>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 lg:justify-start">
                {[`${F.characters} characters`, `${F.minLengthSec} sec to ${F.maxLengthMin} min`, "Check scenes before animating", "9:16 or 16:9"].map((t) => (
                  <div key={t} className="flex items-center gap-1.5 text-[13px] text-white/50">
                    <Check size={13} className="text-purple-400" aria-hidden="true" />
                    {t}
                  </div>
                ))}
              </div>
            </div>

            <div className="relative flex-shrink-0">
              <div className="absolute -inset-8 rounded-full bg-purple-500/15 blur-3xl" />
              <HeroExample />
            </div>
          </div>
        </div>
      </section>

      {/* ── SERIES ── */}
      <section id="series" className="scroll-mt-6 border-y border-white/[0.07] bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">
              AI Fruit Story Series: Up to {F.maxEpisodes} Episodes With the Same Characters
            </h2>
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-white/50">
              One video can go viral. A series gives people a reason to follow. Series mode plans the whole story before you make the first episode, and keeps the cast and the places consistent all the way through.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERIES_STEPS.map((s) => <StepCard key={s.n} step={s} />)}
            <div className="flex flex-col justify-center rounded-[20px] border border-purple-400/25 bg-purple-500/[0.07] p-6">
              <p className="text-[15px] font-bold text-white">Start with episode 1</p>
              <p className="mt-2 text-[13px] leading-relaxed text-white/55">Choose &ldquo;Series&rdquo; in the tool, answer the five questions and read the plan before you spend any credits.</p>
              <div className="mt-4"><OpenToolButton className="!px-6 !py-3 !text-[14px]">Start a series →</OpenToolButton></div>
            </div>
          </div>

          {showSeriesExample && (
            <div className="mt-12">
              <h3 className="mb-1 text-[20px] font-black tracking-tight">
                {FRUIT_EXAMPLE_SERIES.title ? `Example series: ${FRUIT_EXAMPLE_SERIES.title}` : "Example series"}
              </h3>
              <p className="mb-5 text-[13px] text-white/45">Every episode, in order, with the cliffhanger it ends on.</p>
              <VideoSlots slots={FRUIT_EXAMPLE_SERIES.episodes} caption={(video, i) => (
                <>
                  <span className="block font-bold text-white/80">Episode {i + 1}{video.title ? `: ${video.title}` : ""}</span>
                  {video.cliffhanger && <span className="block text-purple-200/80">Ends on: {video.cliffhanger}</span>}
                </>
              )} />
            </div>
          )}
        </div>
      </section>

      {/* ── WHAT IT IS ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-center text-[28px] font-black tracking-tight sm:text-[36px]">What Is the Zyvo AI Fruit Story Maker?</h2>
          <p className="mx-auto mt-4 max-w-3xl text-center text-[15px] leading-relaxed text-white/55">
            Zyvo&apos;s AI Fruit Story maker is a tool for short drama videos acted by talking fruit characters: cheating reveals, office gossip, in-law wars, prison beef.
            You bring the idea. Zyvo writes the script, makes a picture for every scene and animates each character saying their line.
            You stay in control the whole way: nothing is animated until you have checked the pictures.
          </p>
        </div>
      </section>

      {/* ── HOW TO ── */}
      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-[28px] font-black tracking-tight sm:text-[36px]">How to Make an AI Fruit Story Video</h2>
            <p className="text-[15px] text-white/45">Five steps, the same ones you see in the tool.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_STEPS.map((s) => <StepCard key={s.n} step={s} />)}
          </div>
          <div className="mt-10 text-center">
            <OpenToolButton>Start Making Your Fruit Story →</OpenToolButton>
          </div>
        </div>
      </section>

      {/* ── EXAMPLES (shown once a video is added) ── */}
      {showExamples && (
        <section className="py-14 md:py-16">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">AI Fruit Story Examples</h2>
            <p className="mx-auto mb-8 mt-3 max-w-2xl text-center text-[14px] text-white/45">Finished videos made with the tool. Press play to watch.</p>
            <VideoSlots slots={FRUIT_EXAMPLE_VIDEOS} />
          </div>
        </section>
      )}

      {/* ── CHARACTERS ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-[26px] font-black tracking-tight sm:text-[34px]">{F.characters} AI Fruit Characters That Stay the Same</h2>
            <p className="mx-auto max-w-2xl text-[14px] leading-relaxed text-white/45">
              Every character in the library has a fixed look, so Mia in scene 1 is Mia in scene 12 and in episode 10. Here are twelve of them.
            </p>
          </div>
          <ul className="mx-auto grid max-w-4xl grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {FRUIT_CHARACTERS.map((c) => (
              <li key={c.id} className="flex flex-col items-center gap-1.5 text-center">
                <div className="aspect-[3/4] w-full overflow-hidden rounded-[16px] border border-white/10 bg-white">
                  <img {...optImg(`${FRUIT_ASSETS}/characters/${c.id}.jpg`, "(min-width: 768px) 140px, 30vw", 240)} alt={`${c.name}, an AI fruit story character`} width="240" height="430" loading="lazy" decoding="async" className="h-full w-full object-cover object-top" />
                </div>
                <span className="text-[12px] font-bold text-white/80">{c.name}</span>
                <span className="text-[10px] text-white/40">{c.tag}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">AI Fruit Story Generator Features</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5">
                <h3 className="mb-1.5 text-[14px] font-bold text-white">{f.title}</h3>
                <p className="text-[13px] leading-relaxed text-white/45">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STARTER PROMPTS ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">Start From a Prompt</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] text-white/45">
            &ldquo;Make this video&rdquo; opens the tool with the story and its characters already filled in.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FRUIT_STARTER_PROMPTS.map((p) => <StarterPrompt key={p.prompt} {...p} />)}
          </div>
          <div className="mt-8 text-center">
            <Link to="/blog/best-ai-fruit-story-ideas" className="text-[13px] font-semibold text-purple-300 hover:underline">
              See 50 AI fruit story prompts →
            </Link>
          </div>
        </div>
      </section>

      {/* ── QUALITY BY PLAN ── */}
      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">Video Quality by Plan</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[14px] leading-relaxed text-white/45">
            AI Fruit Story needs a paid plan and uses credits. The scene pictures are paid first, and the video only when you choose to animate.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {FRUIT_QUALITY.map((q) => (
              <div key={q.id} className="rounded-[18px] border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <div className="text-[30px] font-black text-white">{q.id}</div>
                <div className="mt-1 text-[12px] font-bold text-purple-300">{q.plan} plan{q.id === "V4" ? "" : " and up"}</div>
                <p className="mt-2 text-[13px] leading-relaxed text-white/45">{q.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link to="/pricing" className="text-[13px] font-semibold text-purple-300 hover:underline">See plans and prices →</Link>
          </div>
        </div>
      </section>

      {/* ── NUMBERS ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.l} className="rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5 text-center">
                <div className="text-[24px] font-black text-white sm:text-[26px]">{s.v}</div>
                <div className="mt-1 text-[11px] text-white/40">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-y border-white/[0.07] bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="mb-10 text-center text-[26px] font-black tracking-tight sm:text-[34px]">Frequently Asked Questions</h2>
          <div className="space-y-3">
            {FRUIT_FAQ.map((f) => (
              <details key={f.q} className="group cursor-pointer rounded-[16px] border border-white/[0.07] bg-white/[0.02] p-5">
                <summary className="flex list-none items-center justify-between text-[14px] font-bold text-white">
                  {f.q}
                  <span className="ml-3 flex-shrink-0 text-white/30 transition-transform duration-200 group-open:rotate-180" aria-hidden="true">▾</span>
                </summary>
                <p className="mt-3 text-[13px] leading-relaxed text-white/55">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── GUIDES ── */}
      <section className="py-14 md:py-16">
        <div className="mx-auto max-w-4xl px-4 md:px-6">
          <h2 className="text-center text-[26px] font-black tracking-tight sm:text-[34px]">AI Fruit Story Guides</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {GUIDES.map(([label, to]) => (
              <Link key={to} to={to} className={`rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-5 py-5 text-sm font-bold text-white/75 transition hover:border-purple-400/40 hover:text-white ${FOCUS}`}>
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="border-t border-white/[0.07] bg-[#0c0c0f] py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 text-center md:px-6">
          <h2 className="mb-4 text-[28px] font-black tracking-tight sm:text-[38px]">
            Make Your First AI Fruit Story<br />
            <span className="bg-gradient-to-r from-[#A855F7] to-[#7C3AED] bg-clip-text text-transparent">or Start a Series</span>
          </h2>
          <p className="mb-8 text-[15px] text-white/50">
            Pick an idea, choose your characters, check the scenes and animate when you are happy.
          </p>
          <OpenToolButton className="!px-10" />
          <p className="mt-4 text-[12px] text-white/35">Account and paid plan required. The cost in credits depends on the length and quality you choose.</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
