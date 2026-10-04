// AI Fruit Story public pages: the numbers, FAQs, characters and example-video
// slots for /ai-fruit-story-maker (src/pages/landing/AIFruitStoryLanding.jsx)
// and the pricing and "what is" blog posts. The pages and their JSON-LD
// (structuredData.js) both read this file, so the two can't drift apart.
//
// Plain JS (no JSX, no import.meta, no JSON imports): Node build scripts
// import this file too.
//
// Rules for the copy: it must match the tool as it works today (limits.js,
// pricing/fruitV2Estimates.js). No "free" claims: the tool needs a paid plan.
// A series is "up to 10 episodes", never "10+".

import { LIMITS } from "../components/viral-tools/ai-fruit-story-v2/api/limits.js";

export const FRUIT_LANDING_PATH = "/ai-fruit-story-maker";
export const FRUIT_TOOL_PATH = "/workspace/ai-fruit-story";
export const FRUIT_ASSETS = "/lp/fruit";

export const FRUIT_FACTS = {
  characters: 150, // the core character library (scripts/fruit-characters/roster.mjs)
  maxCastSingle: LIMITS.maxCastSingle,
  minCastSeries: LIMITS.minCastSeries,
  maxCastSeries: LIMITS.maxCastSeries,
  minLengthSec: LIMITS.minLengthSec,
  maxLengthMin: LIMITS.maxLengthSec / 60,
  minEpisodes: LIMITS.minEpisodes,
  maxEpisodes: LIMITS.maxEpisodes,
};

// Video quality by plan (pricing/fruitV2Estimates.js: TIERS[*].minPlan).
export const FRUIT_QUALITY = [
  { id: "V2", plan: "Starter", note: "Fast and cheap. On every paid plan." },
  { id: "V3", plan: "Pro", note: "Sharper, steadier motion. From the Pro plan." },
  { id: "V4", plan: "Generative", note: "The most natural motion and voices. On the Generative plan." },
];

// Twelve of the library's characters (pictures: public/lp/fruit/characters/<id>.jpg).
export const FRUIT_CHARACTERS = [
  { id: "mia", name: "Mia Mango", tag: "Wife" },
  { id: "marco", name: "Marco Mango", tag: "Husband" },
  { id: "pia", name: "Pia Peach", tag: "Rival" },
  { id: "rick", name: "Rick Crisp", tag: "Boss" },
  { id: "bella", name: "Bella Berry", tag: "Intern" },
  { id: "marg", name: "Margaret Crisp", tag: "Co-founder" },
  { id: "gloria", name: "Gloria Grape", tag: "Receptionist" },
  { id: "linda", name: "Linda Lemon", tag: "HR" },
  { id: "benny", name: "Benny Banana", tag: "Boyfriend" },
  { id: "pina", name: "Big Pina", tag: "Kingpin" },
  { id: "olive", name: "Olivia Orange", tag: "Mom" },
  { id: "sally", name: "Sally Strawberry", tag: "Mother-in-law" },
];

// "Make this video" starters on the main page. Each names its characters by
// first name and lists their library ids, so the tool opens with the cast set.
// Different from the prompts on /blog/best-ai-fruit-story-ideas on purpose.
export const FRUIT_STARTER_PROMPTS = [
  { prompt: "Gloria walks in on Rick and Bella in the glass-walled office, and the whole floor knows before lunch.", castIds: ["gloria", "rick", "bella"] },
  { prompt: "Mia finds a hotel receipt in Marco's jacket and invites Pia to their anniversary dinner.", castIds: ["mia", "marco", "pia"] },
  { prompt: "Sally moves in for one week. Three months later she is still rearranging Olivia's kitchen.", castIds: ["sally", "olive"] },
  { prompt: "Linda reads Rick's private messages out loud at the all-hands meeting. Margaret is in the front row.", castIds: ["linda", "rick", "marg"] },
];

// ── Example videos (YouTube Shorts) ─────────────────────────────────────────
// To add one, fill in a slot:
//   youtube     the Shorts link or the video id (the part after /shorts/)
//   title       the video's title on YouTube
//   description one sentence about the story (optional)
//   uploadDate  the upload date, e.g. "2026-10-12"
//   duration    the length as ISO 8601, e.g. "PT45S" or "PT1M20S"
// A slot with an empty `youtube` is not shown to visitors and is left out of
// the schema. In local dev (npm run dev) it shows as a dashed "empty slot" box.
export const FRUIT_EXAMPLE_VIDEOS = [
  { slot: "Example video 1", youtube: "", title: "", description: "", uploadDate: "", duration: "" },
  { slot: "Example video 2", youtube: "", title: "", description: "", uploadDate: "", duration: "" },
  { slot: "Example video 3", youtube: "", title: "", description: "", uploadDate: "", duration: "" },
];

// One example series: its name and its episodes in order (up to 10). Same
// fields as above, plus `cliffhanger`: the line the episode ends on.
export const FRUIT_EXAMPLE_SERIES = {
  title: "",
  episodes: [
    { slot: "Series episode 1", youtube: "", title: "", cliffhanger: "", description: "", uploadDate: "", duration: "" },
    { slot: "Series episode 2", youtube: "", title: "", cliffhanger: "", description: "", uploadDate: "", duration: "" },
    { slot: "Series episode 3", youtube: "", title: "", cliffhanger: "", description: "", uploadDate: "", duration: "" },
  ],
};

/** The YouTube id from a Shorts/watch/youtu.be link or a bare id; "" when there is none. */
export function youtubeId(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const fromUrl = text.match(/(?:shorts\/|watch\?v=|youtu\.be\/|embed\/)([\w-]{11})/)?.[1];
  if (fromUrl) return fromUrl;
  return /^[\w-]{11}$/.test(text) ? text : "";
}

/** "PT1M20S" → "1:20" ("" when the duration is missing or malformed). */
export function videoLength(duration) {
  const m = String(duration ?? "").match(/^PT(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m || (!m[1] && !m[2])) return "";
  return `${Number(m[1] ?? 0)}:${String(Number(m[2] ?? 0)).padStart(2, "0")}`;
}

/** Slots that have a video, with the id, thumbnail and display length worked out. */
export function filledVideos(slots) {
  return slots
    .map((slot) => ({ ...slot, id: youtubeId(slot.youtube) }))
    .filter((video) => video.id)
    .map((video) => ({
      ...video,
      // Shorts have a vertical thumbnail at oar2.jpg; hqdefault.jpg always exists (the page falls back to it).
      thumb: `https://i.ytimg.com/vi/${video.id}/oar2.jpg`,
      thumbFallback: `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`,
      length: videoLength(video.duration),
    }));
}

/** VideoObject entries for the slots that have a video, a title and an upload date (Google requires all three). */
export function fruitVideoObjects() {
  return filledVideos([...FRUIT_EXAMPLE_VIDEOS, ...FRUIT_EXAMPLE_SERIES.episodes])
    .filter((video) => video.title && video.uploadDate)
    .map((video) => ({
      "@type": "VideoObject",
      name: video.title,
      description: video.description || `${video.title}: a fruit drama video made with Zyvo AI Fruit Story.`,
      thumbnailUrl: [video.thumbFallback],
      uploadDate: video.uploadDate,
      ...(video.duration ? { duration: video.duration } : {}),
      embedUrl: `https://www.youtube.com/embed/${video.id}`,
      url: `https://www.youtube.com/shorts/${video.id}`,
    }));
}

const F = FRUIT_FACTS;

export const FRUIT_FAQ = [
  {
    q: "What is an AI fruit story?",
    a: "An AI fruit story is a short drama video where 3D fruit characters talk their way through a fight, a secret or a reveal. Each scene is one character saying one line. Zyvo writes the script, makes a picture for every scene and animates the characters speaking.",
  },
  {
    q: "How does the AI fruit story generator work?",
    a: `Pick a ready idea, describe your own story, or paste your own script. Choose up to ${F.maxCastSingle} characters, a length and a video quality. Zyvo writes the script and makes one picture per scene. You check the pictures, edit or regenerate any you don't like, then animate them into a finished video with captions.`,
  },
  {
    q: "Can I make a series with the same characters?",
    a: `Yes. A series has ${F.minEpisodes} to ${F.maxEpisodes} episodes and ${F.minCastSeries} to ${F.maxCastSeries} characters. You answer five short questions and Zyvo writes the plan: a title, a summary and a cliffhanger for every episode. A series bible fixes each character's role, prop and catchphrase and the places the story returns to, so every episode matches the last one.`,
  },
  {
    q: "Do the characters look the same in every scene?",
    a: `Yes. The library has ${F.characters} fruit characters, and each one has a fixed look that is reused in every scene and every episode.`,
  },
  {
    q: "How long can a fruit story video be?",
    a: `From ${F.minLengthSec} seconds to ${F.maxLengthMin} minutes, with about one scene for every 5 seconds. Single videos can be tall (9:16) or wide (16:9). Series episodes are always 9:16.`,
  },
  {
    q: "Is the AI fruit story generator free?",
    a: "No. Making videos needs a paid Zyvo plan and uses credits. V2 quality is on every paid plan, V3 starts on Pro and V4 is on Generative. You see the cost in credits before you start. The scene pictures are paid first and the video only when you choose to animate.",
  },
  {
    q: "Can I use my own script?",
    a: "Yes. Paste lines in the form \"Mia: Tonight has to be perfect.\" and match each name to a library character. Every line becomes one scene.",
  },
  {
    q: "Does it work for TikTok, Instagram Reels and YouTube Shorts?",
    a: "Yes. Videos come out in 9:16 with optional captions. With the finished video you also get a cover image and ready post text: a title, a caption, a comment to pin and hashtags.",
  },
];

// FAQ on /blog/ai-fruit-story-pricing (the post and its JSON-LD).
export const FRUIT_PRICING_FAQ = [
  {
    q: "Is AI Fruit Story free?",
    a: "No. Making a video needs a paid Zyvo plan (Starter, Pro or Generative) and uses the credits that come with it. Without a plan you can open the tool and watch an example, but you can't make a video.",
  },
  {
    q: "How is the cost worked out?",
    a: "In two parts. Each scene picture has a fixed price in credits, and video is priced per second at the quality you pick (V2, V3 or V4). A video has about one scene for every 5 seconds, so a longer video costs more.",
  },
  {
    q: "When are credits taken?",
    a: "The scene pictures are paid when the story is made. The video is paid only when you choose to animate, after you have checked the pictures. Editing or regenerating a scene picture costs one more picture.",
  },
  {
    q: "What happens if I don't have enough credits?",
    a: "The tool shows the cost before you start and tells you how many more credits you need. You can pick a shorter length, switch to V2 or add credits.",
  },
  {
    q: "Does a series cost more than single videos?",
    a: "Writing the series plan uses no credits. Each episode is priced like a single video: you choose its length and quality when you make it.",
  },
  {
    q: "Which plan do I need for V3 or V4?",
    a: "V2 is on every paid plan. V3 starts on the Pro plan. V4 is on the Generative plan.",
  },
];

// FAQ on /blog/what-is-ai-fruit-story (the post and its JSON-LD).
export const FRUIT_WHAT_IS_FAQ = [
  {
    q: "What is an AI Fruit Story?",
    a: "An AI Fruit Story is a short fictional drama video made with AI, where 3D fruit characters talk their way through a conflict, a secret or a plot twist, one line per scene.",
  },
  {
    q: "Why is this format going viral right now?",
    a: "It combines the visual novelty of fruit characters delivering soap-opera drama with story structures viewers already know from short-form drama: the reveal, the betrayal, the comeback.",
  },
  {
    q: "How is an AI Fruit Story actually made?",
    a: "You pick a ready idea, describe a story or paste a script. The generator writes the script, makes a picture for every scene and animates each character saying their line. You check the pictures before anything is animated.",
  },
  {
    q: "Do the fruit characters actually talk?",
    a: "Yes. Every scene is one character saying one line, and captions can show each line on screen.",
  },
  {
    q: "Can I make a series?",
    a: `Yes. Series mode plans ${F.minEpisodes} to ${F.maxEpisodes} episodes with the same cast, gives every episode a cliffhanger and keeps a series bible so characters and places stay consistent.`,
  },
  {
    q: "Is AI Fruit Story free?",
    a: "No. Zyvo's AI Fruit Story maker needs a paid plan and uses credits. V2 quality is on every paid plan, V3 starts on Pro and V4 is on Generative.",
  },
  {
    q: "What platforms is this content made for?",
    a: "The vertical 9:16 format is built for TikTok, Instagram Reels and YouTube Shorts. Single videos can also be made wide, in 16:9.",
  },
];
