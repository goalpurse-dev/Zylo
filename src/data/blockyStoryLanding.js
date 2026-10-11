// Content of /blocky-story-video-maker (src/pages/landing/BlockyStoriesLanding.jsx) and of its JSON-LD
// (structuredData.js). Plain JS: the Node build scripts import it, so nothing here reads the browser or
// import.meta.env. The copy must match the tool as it works today.
//
// TRADEMARK RULES (owner, 2026-10-11). The genre's best-known name never appears in the URL, the title
// tag, the H1, the product name, a file name or an alt text, and there is no logo, font, screenshot or
// game UI of it anywhere. It appears only through the ONE constant below.
import { BLOCKY_STORIES_NAME, BLOCKY_STORIES_PATH } from "./blockyStories.js";
import { STICKMAN_PRICING } from "./stickmanLandingPages.js";
import { PICTURE, SCRIPT, TIERS as PRICED_TIERS, TIER_IDS } from "../../supabase/functions/_shared/blocky/pricing.js";
import { TIERS, estimateStory } from "../components/viral-tools/blocky-stories/pricing/blockyEstimates.js";

/**
 * The ONE place the genre's name is written. Every mention on the page reads it: two descriptive mentions
 * (always as "…-style", describing the kind of video, never a connection), the "is this affiliated" question
 * and the notice above the footer. Set `GENRE = null` and all of them are gone: every sentence that uses it
 * is written to read correctly without it, and the question and the notice are simply left out.
 */
export const GENRE = { style: "Roblox-style", short: "Roblox", owner: "Roblox Corporation" };
/** The noun with the genre's style word in front of it, or the noun alone when the name is switched off. */
const styled = (noun, genre) => (genre ? `${genre.style} ${noun}` : noun);

export const BLOCKY_LANDING_PATH = "/blocky-story-video-maker";
export const BLOCKY_TOOL_PATH = BLOCKY_STORIES_PATH;
export const BLOCKY_LANDING_ASSETS = "/lp/blocky-stories";
/** The clips are the owner's own test videos, in Blocky's public storage folder (scripts/blocky/publishShowcase.mjs). */
export const BLOCKY_VIDEO_BASE = "https://ilpiwoxubnevmxxikyvx.supabase.co/storage/v1/object/public/generated/blocky/showcase";
/** YouTube id of the tutorial. null hides the tutorial section and its VideoObject; set it and both appear. */
export const BLOCKY_TUTORIAL = null; // e.g. { id: "dQw4w9WgXcQ", title: "How to make a Blocky Story", uploadDate: "2026-10-20", duration: "PT4M" }

export const BLOCKY_LANDING_SEO = {
  title: "AI Story Video Maker – Animated Talking Shorts | Zyvo",
  description: "Turn one idea into an animated story Short. Blocky characters talk with real lip sync and captions, ready for YouTube Shorts, TikTok and Reels.",
  h1: "Make animated story Shorts with AI",
  cta: "Make your first story",
  appName: `Zyvo ${BLOCKY_STORIES_NAME}`,
  modified: "2026-10-11",
};

export const posterSrc = (file, width) => `${BLOCKY_LANDING_ASSETS}/${file}.w${width}.webp`;
const video = (id) => `${BLOCKY_VIDEO_BASE}/${id}.mp4`;

/** The hero: one whole story, playing without sound until the visitor turns it on. */
export const BLOCKY_HERO_VIDEO = {
  id: "no-hats-allowed",
  title: "No Hats Allowed",
  url: video("no-hats-allowed"),
  poster: "story-no-hats-allowed",
  posterWidths: [360, 540],
  size: [540, 960],
  duration: "PT20S",
  seconds: 20,
  uploadDate: "2026-10-09",
  alt: "A blocky game avatar in a top hat points at another avatar on a snowy spawn platform, with the caption \"No hats at spawn\"",
  description: "A 20-second animated story made with Zyvo Blocky Stories: an admin enforces a no-hats rule at spawn, and the server's owner turns it on him.",
};

/** Four short clips cut from the owner's test stories. Each has one caption track and no sound. */
export const BLOCKY_EXAMPLES = [
  {
    id: "home-no-hats-1", poster: "clip-the-rule", title: "The rule", story: "No Hats Allowed", duration: "PT7S", uploadDate: "2026-10-09",
    lines: ["No hats at spawn. That's the rule.", "Please, my base and my pet are right there."],
    alt: "A yellow blocky game avatar pleads with crossed arms while another avatar in a chef hat watches, captioned \"Please, my base\"",
  },
  {
    id: "home-fake-admin", poster: "clip-the-fake-admin", title: "The fake admin", story: "The Fake Admin", duration: "PT8S", uploadDate: "2026-10-09",
    lines: ["That command doesn't even exist, Noob.", "Try me, I control this whole server now."],
    alt: "A white blocky game avatar in a top hat speaks to a worried yellow avatar in a town square, captioned \"That command\"",
  },
  {
    id: "home-no-hats-2", poster: "clip-the-ban", title: "The ban", story: "No Hats Allowed", duration: "PT6S", uploadDate: "2026-10-09",
    lines: ["Freeze. The ban starts now.", "I didn't even know that was a rule."],
    alt: "Over the shoulder of a yellow blocky game avatar, an avatar in a top hat grins, captioned \"Freeze. The ban\"",
  },
  {
    id: "home-no-hats-3", poster: "clip-the-twist", title: "The twist", story: "No Hats Allowed", duration: "PT6S", uploadDate: "2026-10-09",
    lines: ["That hat breaks your own rule, Vex.", "Enjoy the ban, Vex."],
    alt: "A red blocky game avatar in a white chef hat points angrily at an avatar in a top hat, captioned \"That hat breaks\"",
  },
].map((clip) => ({ ...clip, url: video(clip.id), posterWidths: [270, 540], size: [540, 960] }));

/** genre: GENRE, or null to see the text without the name (a test reads both). */
export const blockyIntro = (genre = GENRE) => ({
  title: "An AI cartoon story generator for vertical video",
  paragraphs: [
    `${BLOCKY_STORIES_NAME} makes the ${styled("story videos", genre)} that fill Shorts feeds: blocky game avatars argue, trade, get banned and get even, in a handful of short scenes with a twist at the end. You bring one idea. The tool writes the script, draws every scene, animates the characters so they say their lines, and joins it all into one 9:16 video.`,
    "It is built for talking character videos, not for slideshows. Every scene is one character speaking one line, with the mouth moving in time with the words, the listener in the frame when the shot calls for it, and a caption under it. A 30-second story is about six scenes.",
  ],
});
export const BLOCKY_INTRO = blockyIntro();

export const BLOCKY_STEPS = [
  { title: "Pick an idea or describe your own", text: "Press \"Give me ideas\" for five story ideas with characters already chosen, describe a story in a sentence or two, or paste a finished script and say who speaks each line." },
  { title: "Choose quality and length", text: "Three quality tiers (V2, V3, V4) and four lengths from 20 seconds to 1 minute. The full cost in credits is shown before anything is written." },
  { title: "Pick one of three versions", text: "The story comes back as three versions, each with a different twist. Read them and keep the one you would watch. Writing is free." },
  { title: "Check the scene pictures", text: "Every scene is drawn first. Open any picture large, redraw it or change it with a short instruction. You pay for video only after you have seen the pictures." },
  { title: "Animate and download", text: "The characters speak their lines, the clips are joined, captions are added, and the finished video is ready to download with its title, description and tags." },
];

export const BLOCKY_FEATURES = [
  { title: "50+ characters with their own look and voice", text: "A library of original blocky game avatars: the new player, the admin, the trader, the collector, the prankster and many more. Each one has a fixed look and a described voice." },
  { title: "The same character in every scene", text: "A character keeps its face, colours, hat and outfit from the first scene to the last, because every picture is drawn from that character's own reference." },
  { title: "Real lip sync", text: "The video model animates the speaker saying the line, so the mouth moves with the words. Voices come with the clip: there is no separate voice-over to record or line up." },
  { title: "Mixed camera shots", text: "Stories open on a wide shot of the place and then cut between chest-up shots, close-ups, reaction shots and over-the-shoulder shots, the way an edited video does." },
  { title: "Captions added for you", text: "Word-by-word captions are drawn onto the final video in one clean track. You can switch them off and get the video without them." },
  { title: "Three versions of every story", text: "You never get a single take-it-or-leave-it script. Three versions with different twists are written, and you choose." },
  { title: "Post text, ready to paste", text: "Each finished video comes with a YouTube title, a description, tags, a TikTok and Reels caption, hashtags and a comment to pin, each with a copy button." },
];

export const BLOCKY_AUDIENCES = [
  { title: "Faceless YouTube channels", text: "Run a Shorts channel without a camera, a microphone or a voice actor. The characters carry the story and the captions carry the lines, so nothing of you is on screen." },
  { title: "TikTok and Reels creators", text: "Make an animated story between your other posts. The video is 9:16 with captions inside the safe area, and the caption and hashtags are written for you." },
  { title: "People starting a Shorts channel", text: "Start with story ideas instead of a blank page, see every picture before you pay for video, and learn what works with 20-second stories before you make longer ones." },
];

/* ─── Prices: computed, never typed ───────────────────────────────────── */

/**
 * The price rows as the repo states them (pricing.js: the file the live rows are written from, and a
 * check compares the two). The build's HTML uses these; in the browser the page asks the server for the
 * live quotes and shows those (BlockyStoriesLanding.jsx).
 */
export function blockyListPrices() {
  return {
    image: PICTURE.credits,
    script: SCRIPT.credits,
    ...Object.fromEntries(TIER_IDS.map((id) => [`clip:${id}`, PRICED_TIERS[id].creditsPerSec * TIERS[id].quoteSec])),
  };
}

export const BLOCKY_STORY_SECONDS = 30;
const PLAN_RANK = { starter: 1, pro: 2, generative: 3 };

/** Per plan: its price and credits, the tiers it may use, and about how many 30-second stories a month of credits makes on each. */
export function blockyPlanRows(prices = blockyListPrices(), lengthSec = BLOCKY_STORY_SECONDS) {
  return STICKMAN_PRICING.plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price,
    currency: STICKMAN_PRICING.currency,
    credits: plan.credits,
    tiers: TIER_IDS.filter((id) => PLAN_RANK[PRICED_TIERS[id].minPlan] <= PLAN_RANK[plan.id]).map((id) => {
      const { total } = estimateStory({ lengthSec, tierId: id, prices });
      return { id, label: TIERS[id].label, tag: TIERS[id].tag, storyCredits: total, stories: total ? Math.floor(plan.credits / total) : null };
    }),
  }));
}

const plansSentence = () => blockyPlanRows().map((plan) => `${plan.name} (${plan.credits.toLocaleString("en-US")} credits a month) makes about ${plan.tiers.map((t) => `${t.stories} on ${t.label}`).join(", or ")}`).join("; ");
const storyCost = (tierId) => blockyPlanRows().at(-1).tiers.find((t) => t.id === tierId).storyCredits;

export const blockyFaq = (genre = GENRE) => [
  {
    q: "How long does it take to make a video?",
    a: "Usually under ten minutes from idea to download for a 30-second story. Writing the three versions takes about a minute, the scene pictures a minute or two, and most of the rest is the video model animating each scene. A 20-second story is quicker.",
  },
  {
    q: "Do I need animation or editing skills?",
    a: "No. You pick an idea or describe a story, choose characters from the library and press a few buttons. The script, the pictures, the animation, the voices, the captions and the final cut are made for you. You can still step in: redraw a picture, change a scene with a short instruction, or animate one clip again.",
  },
  {
    q: "Can I post the videos on YouTube and TikTok?",
    a: "Yes. The videos are vertical 9:16, sized for YouTube Shorts, TikTok and Instagram Reels, and they download without a watermark. The characters are original, so there is no third-party footage in them. Whether a platform monetises your channel is that platform's decision.",
  },
  {
    q: "How many videos can I make on my plan?",
    a: `It depends on the quality tier. For ${BLOCKY_STORY_SECONDS}-second stories: ${plansSentence()}. A ${BLOCKY_STORY_SECONDS}-second story costs about ${storyCost("v2")} credits on V2, ${storyCost("v3")} on V3 and ${storyCost("v4")} on V4, and shorter stories cost less.`,
  },
  {
    q: "What is the difference between V2, V3 and V4?",
    a: "They are three video models. V2 is the fast, low-cost tier and comes with every paid plan. V3 is sharper with steadier motion and starts on the Pro plan. V4 has the most natural motion and voices and is part of the Generative plan. The script, the scene pictures, the captions and the post text are the same on all three.",
  },
  {
    q: "Can I make my own story?",
    a: "Yes, in two ways. Describe your story in a sentence or two and pick up to three characters, and you get three versions of it. Or paste your own finished script, say which character speaks each line, and it is staged exactly as you wrote it.",
  },
  {
    q: "Can I try it before paying?",
    a: "A free account can look around the tool and ask for story ideas. Writing a story, making its scene pictures and animating the video need a paid plan, starting with Starter.",
  },
  ...(genre ? [{
    q: `Is this affiliated with ${genre.short}?`,
    a: `No. ${BLOCKY_STORIES_NAME} is an independent Zyvo tool. It is not affiliated with, endorsed by or sponsored by ${genre.owner}. It makes ${styled("story videos", genre)} with its own original characters and places, and uses no game footage, logos or game assets.`,
  }] : []),
];
export const BLOCKY_FAQ = blockyFaq();

/** The notice above the footer. null when the genre's name is switched off. */
export const blockyNotice = (genre = GENRE) => (genre ? `${BLOCKY_STORIES_NAME} is an independent Zyvo tool and is not affiliated with, endorsed by or sponsored by ${genre.owner}.` : null);
export const BLOCKY_NOTICE = blockyNotice();

/** Other pages a reader of this one may want (real, indexable pages). */
export const BLOCKY_RELATED = [
  { to: "/ai-fruit-story-maker", title: "AI Fruit Story", text: "Talking-fruit drama videos and series of up to 10 episodes with the same cast." },
  { to: "/cartoon-drive-by-video-maker", title: "Cartoon Drive-By", text: "A 10-second vertical drive past a fictional cartoon-style place." },
  { to: "/ai-stickman-video-generator", title: "Long Form", text: "Turn one idea into an 8 to 15 minute YouTube video with script, voice and scenes." },
];

/* ─── Structured data ─────────────────────────────────────────────────── */

const absolute = (siteUrl, src) => (src.startsWith("/") ? `${siteUrl}${src}` : src);

export function blockyVideoObjects(siteUrl) {
  const hero = BLOCKY_HERO_VIDEO;
  const objects = [
    { "@type": "VideoObject", name: `${hero.title}: an animated story made with ${BLOCKY_STORIES_NAME}`, description: hero.description, thumbnailUrl: [absolute(siteUrl, posterSrc(hero.poster, 540))], uploadDate: hero.uploadDate, duration: hero.duration, contentUrl: hero.url },
    ...BLOCKY_EXAMPLES.map((clip) => ({
      "@type": "VideoObject",
      name: `${clip.story}, "${clip.title}": a scene made with ${BLOCKY_STORIES_NAME}`,
      description: `Two blocky game avatars speak their lines with lip sync and captions: "${clip.lines[0]}" "${clip.lines[1]}"`,
      thumbnailUrl: [absolute(siteUrl, posterSrc(clip.poster, 540))],
      uploadDate: clip.uploadDate,
      duration: clip.duration,
      contentUrl: clip.url,
    })),
  ];
  if (BLOCKY_TUTORIAL?.id) {
    objects.push({
      "@type": "VideoObject", name: BLOCKY_TUTORIAL.title, description: `A walk through ${BLOCKY_STORIES_NAME}: from one idea to a finished animated story Short.`,
      thumbnailUrl: [`https://i.ytimg.com/vi/${BLOCKY_TUTORIAL.id}/hqdefault.jpg`], uploadDate: BLOCKY_TUTORIAL.uploadDate,
      ...(BLOCKY_TUTORIAL.duration ? { duration: BLOCKY_TUTORIAL.duration } : {}), embedUrl: `https://www.youtube.com/embed/${BLOCKY_TUTORIAL.id}`,
    });
  }
  return objects;
}

export function blockyStructuredData(canonical, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: BLOCKY_LANDING_SEO.appName,
        description: BLOCKY_LANDING_SEO.description,
        url: canonical,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        image: `${siteUrl}${BLOCKY_LANDING_ASSETS}/og-blocky-stories.jpg`,
        offers: blockyPlanRows().map((plan) => ({
          "@type": "Offer", name: `${plan.name} plan, monthly`, price: String(plan.price), priceCurrency: plan.currency,
          description: `${plan.credits} credits a month: about ${plan.tiers[0].stories} ${BLOCKY_STORY_SECONDS}-second stories on ${plan.tiers[0].label}`, url: `${siteUrl}/pricing`,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: BLOCKY_STORIES_NAME, item: canonical },
        ],
      },
      ...blockyVideoObjects(siteUrl),
      { "@type": "FAQPage", mainEntity: BLOCKY_FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
}
