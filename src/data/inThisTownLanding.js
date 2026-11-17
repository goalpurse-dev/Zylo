// Content of the public In This Town page (src/pages/landing/InThisTownLanding.jsx) and of its JSON-LD
// (structuredData.js). Plain JS: the Node build scripts (sitemap, SEO HTML) import it, so nothing here reads the
// browser or import.meta.env. Every fact must match the tool as it works today.
//
// THE GENRE'S NAME (owner, 2026-11-17: target "Roblox story video maker" searches, "Roblox-style" wording, a
// "not affiliated" line, never a logo). It is written in ONE place, GENRE below, and only ever as "…-style" or as a
// search phrase people type; the URL and the file names stay without it. Set GENRE = null to remove every mention.
import { BLENDER_FLAT } from "../../supabase/functions/_shared/blockyWorlds/blenderPricing.js";
import { BLOCKY_WORLDS_NAME, BLOCKY_WORLDS_PATH } from "./blockyWorlds.js";

export const GENRE = { style: "Roblox-style", short: "Roblox", owner: "Roblox Corporation" };
const g = (withName, without) => (GENRE ? withName : without);

export const IN_THIS_TOWN_PATH = "/in-this-town-story-video-maker";
export const IN_THIS_TOWN_TOOL_PATH = BLOCKY_WORLDS_PATH;
export const IN_THIS_TOWN_ASSETS = "/in-this-town";
export const IN_THIS_TOWN_PRICE = BLENDER_FLAT; // { credits, keepCredits, expireDays, ... }: the one price the maker charges

export const IN_THIS_TOWN_SEO = {
  title: g("Roblox-Style Story Video Maker: In This Town Shorts | Zyvo", "In This Town Story Video Maker | Zyvo"),
  description: g(
    "Type one strange town rule and get a narrated, Roblox-style \"In this town…\" story Short: voice, captions, 3D scenes and a twist. Faceless and vertical.",
    "Type one strange town rule and get a narrated \"In this town…\" story Short: voice, captions, blocky 3D scenes and a twist. Faceless and vertical.",
  ),
  h1: "Turn one sentence into a viral “In this town…” story video",
  cta: "Make my video",
  appName: `Zyvo ${BLOCKY_WORLDS_NAME}`,
  modified: "2026-11-17",
  keywords: "roblox story video maker, in this town roblox story, ai roblox animation generator, roblox story shorts maker, faceless roblox videos",
};

export const OG_IMAGE = `${IN_THIS_TOWN_ASSETS}/og-in-this-town.jpg`;

/** Our own finished videos (the Blender engine, 2026-11). Each: a 30 s cut with sound, its poster, and its first lines. */
export const TOWN_STORIES = [
  {
    id: "milo", title: "Milo, the most ticklish kid in town", style: "Funny chaos", seconds: 96, uploadDate: "2026-11-15",
    hook: "I just caught the whole bank with one hand.",
    rule: "You see, in this town, every time you laugh, you grow.",
    alt: "A giant blocky boy in a striped yellow shirt stands over a city street full of tiny townspeople",
  },
  {
    id: "tower", title: "The coin tower", style: "Dark twist", seconds: 99, uploadDate: "2026-11-14",
    hook: "Every time a kid rides the lift up, a warm coin falls from the sky.",
    rule: "You see, in this town, the higher you live, the richer you are.",
    alt: "A blocky boy in a red striped shirt stands by a glowing gold coin at the foot of a tall block tower",
  },
  {
    id: "plane", title: "The town inside a plane", style: "Funny chaos", seconds: 72, uploadDate: "2026-11-13",
    hook: "In this town, we live in a plane, and unbuckling early lets the Sky Wind in.",
    rule: "A lamp above every seat shows if you're buckled.",
    alt: "A blocky grandma with round glasses sits under a seat lamp in a long plane cabin",
  },
].map((s) => ({
  ...s,
  video: `${IN_THIS_TOWN_ASSETS}/stories/${s.id}.mp4`,
  poster: `${IN_THIS_TOWN_ASSETS}/stories/${s.id}.webp`,
  loop: `${IN_THIS_TOWN_ASSETS}/clips/${s.id}-a.mp4`,
}));

/** The wall: three 6 s moments from each story, silent. */
export const TOWN_WALL = [
  ["milo", "a", "Milo, giant, looking down from above the bank"],
  ["tower", "a", "A coin falls at the foot of the block tower"],
  ["plane", "a", "A plane flies through the clouds: the whole town lives inside it"],
  ["milo", "b", "Townspeople run out of the bank onto the street"],
  ["plane", "b", "A passenger in a white shirt under the red seat lamps"],
  ["tower", "b", "Grandma sews a gold button on the boy's coat"],
  ["milo", "c", "Milo's cheeks puff as he tries not to laugh"],
  ["tower", "c", "The boy waits by the lift with his grandma"],
  ["plane", "c", "Rows of passengers buckled into their seats"],
].map(([story, part, alt]) => ({
  story, alt, title: TOWN_STORIES.find((s) => s.id === story).title,
  video: `${IN_THIS_TOWN_ASSETS}/clips/${story}-${part}.mp4`,
  poster: `${IN_THIS_TOWN_ASSETS}/clips/${story}-${part}.webp`,
}));

/** Ready ideas: our own rules, never another creator's. Clicking one fills the "Type a rule" box. */
export const TOWN_IDEAS = [
  { rule: "every time you skip a stair, the house builds one more", style: "Funny chaos" },
  { rule: "whatever you doodle on your homework comes alive at midnight", style: "Dark twist" },
  { rule: "every time you burp, it rains on you and only you", style: "Funny chaos" },
  { rule: "if someone says your name wrong, you turn into what they said", style: "Funny chaos" },
  { rule: "the last kid awake has to guard the moon until sunrise", style: "Dark twist" },
  { rule: "every time you forget a birthday, that person shrinks until you remember", style: "Dark twist" },
  { rule: "every time you win a game, your shadow grows and starts giving orders", style: "Dark twist" },
  { rule: "every time you say \"I'm bored\", the town moves one street to the left", style: "Funny chaos" },
];

export const TOWN_STEPS = [
  { n: "1", title: "Topic", text: "Type one strange rule for a town, or pick a ready idea. One sentence is enough." },
  { n: "2", title: "Script", text: "An AI writer turns it into a full story: a result-first hook, the rule, the one kid who breaks it, a crisis and a twist. You read it and change anything before the video is made." },
  { n: "3", title: "Video", text: "We pick the scenes, voice it, direct every shot in 3D, check each one against its line and add captions. Usually about 25 minutes." },
];

export const TOWN_FEATURES = [
  ["Narrated like the real thing", "One storyteller voice, word-by-word captions in each speaker's colour, sound effects and music, mixed for phones."],
  ["Every line is shown", "Each sentence gets its own shot of what it says. A checker looks at every shot and sends the wrong ones back."],
  ["Real 3D, not slideshows", "Blocky characters walk, run, react and crowd the streets of a whole town, school, shop or plane."],
  ["Your own hero", "Upload an avatar or a cartoon character and we build a blocky hero in its colours."],
];

/** Why the page talks about the time: the maker says "about 25 minutes" too (BlenderMaker.jsx). */
export const TOWN_FAQ = [
  { q: "How long does it take to make a video?", a: "Writing the script takes about a minute. After you approve it, the video is usually ready in about 25 minutes: every shot is directed, rendered in 3D and checked. It can take longer when many videos are in the queue. You can close the page: the video waits for you under Recent creations." },
  { q: "How much does it cost?", a: `One price per video: ${BLENDER_FLAT.credits} credits, charged when you press "Write my script". That covers script rewrites, the voice and the full render. If the video fails, every credit comes back. If you never press "Make my video", all but ${BLENDER_FLAT.keepCredits} credits come back after ${BLENDER_FLAT.expireDays} days.` },
  { q: "How long are the videos?", a: "About 60 to 100 seconds, vertical 9:16, made for TikTok, YouTube Shorts and Instagram Reels." },
  { q: "Can I use my own avatar or character?", a: g("Yes. Upload a picture of a Roblox avatar or a cartoon character and the director builds a blocky hero in its colours and style. Avatars and cartoons only: no photos of real people and no logos. The picture is only used to read the look.", "Yes. Upload a picture of a game avatar or a cartoon character and the director builds a blocky hero in its colours and style. Avatars and cartoons only: no photos of real people and no logos. The picture is only used to read the look.") },
  { q: "Can I post the videos on TikTok and YouTube?", a: "Yes. Download the finished MP4 and post it on TikTok, YouTube Shorts, Instagram Reels or anywhere else. The music is our own track, so there is no third-party song to clear." },
  { q: "Do I own the video?", a: "Yes. The story, the voice-over and the finished video you make are yours to post, edit and monetise, under Zyvo's terms." },
  { q: "Do I need Blender, a mic or animation skills?", a: "No. Everything runs in your browser. You type a sentence, read the script and press a button. There is nothing to install and no camera or microphone." },
  ...(GENRE ? [{ q: `Is this made by or affiliated with ${GENRE.short}?`, a: `No. Zyvo is not affiliated with, endorsed by or connected to ${GENRE.owner}. "${GENRE.style}" only describes the blocky look of the characters. We use our own models and no game footage, logos or assets.` }] : []),
];

export const TOWN_NOTICE = GENRE ? `Not affiliated with ${GENRE.owner}.` : null;

/** The four guides, for the page's links and the blog's back links. */
export const TOWN_BLOG = [
  { slug: "how-to-make-in-this-town-story-shorts", title: g("How to make viral “In this town” Roblox story shorts (step by step)", "How to make viral “In this town” story shorts (step by step)") },
  { slug: "in-this-town-story-ideas", title: "50 “In this town” story ideas for TikTok and YouTube Shorts" },
  { slug: "viral-blocky-story-formula", title: g("The story formula behind viral Roblox story videos", "The story formula behind viral blocky story videos") },
  { slug: "faceless-blocky-animations-without-blender", title: g("How to make faceless Roblox-style animations without Blender or animation skills", "How to make faceless blocky animations without Blender or animation skills") },
];

/* ---------------------------------------------------------------------------------------------------------------
 * THE "TYPE A RULE" TOY: free, instant, no AI call. A rule in, a 4-beat mini script and a little scene out, from
 * templates picked by a hash of the text (the same text always gives the same preview; "Shuffle" moves on).
 * ------------------------------------------------------------------------------------------------------------- */
const THEMES = [
  ["grow", /\b(grow|grows|bigger|giant|huge|tall|taller|stretch)/i],
  ["shrink", /\b(shrink|shrinks|smaller|tiny|small|mini)/i],
  ["float", /\b(float|floats|fly|flies|gravity|lift|balloon|jump)/i],
  ["night", /\b(night|dark|sleep|asleep|moon|midnight|bed|dream|yawn)/i],
  ["rain", /\b(rain|storm|snow|wet|cloud|thunder|puddle)/i],
  ["coins", /\b(coin|coins|money|rich|gold|cash|pay|price)/i],
  ["shake", /\b(sneeze|burp|hiccup|laugh|scream|sing|shout|cough|fart|lie|lies|say)/i],
];
const HOOKS = {
  grow: ["I just stepped over my own school. On purpose.", "My mom has to talk to me through the second floor window now."],
  shrink: ["I just lost a fight with a sandwich.", "My best friend carried me to school in her pencil case today."],
  float: ["The whole class is stuck on the ceiling, and it's my fault.", "I haven't touched the ground since Tuesday."],
  night: ["Nobody in this town has seen a sunrise in a hundred years. Until me.", "At 3 a.m. the whole town was standing outside my window."],
  rain: ["It's sunny everywhere in town except right above my head.", "I just flooded the mayor's birthday party. Twice."],
  coins: ["I'm the richest kid in town, and I'm hiding it from everyone.", "A coin fell on my head this morning, and now the whole town wants it."],
  shake: ["I made one tiny noise and the whole town hit the floor.", "I just did the one thing nobody here is allowed to do. In front of the mayor."],
  any: ["Nobody in this town has broken the rule in a hundred years. Until me.", "And that's how the mayor ended up on the roof.", "My whole school is hiding from me right now. Let me explain."],
};
const KIDS = ["Juno", "Ziggy", "Remy", "Tali", "Bodhi", "Wren", "Ozzie", "Pax", "Lumen", "Kit"];
const KID_LINES = [
  (n) => `Everyone plays it safe. Except me, ${n}.`,
  (n) => `Me? I'm ${n}. The only kid who's never once followed the rule.`,
  (n) => `And then there's me, ${n}, who breaks it more than anyone in town.`,
];
const BUT = [
  "But one day, it happened to the one person who never broke it: Grandma.",
  "But one day, the whole school did it at the exact same time.",
  "But one day, the mayor made it twice as strong. Starting with me.",
  "But one day, I found out the rule has a secret way out.",
];
const CLIFF = [
  "And that's when the clock tower started counting down…",
  "Then Grandma whispered, “You weren't supposed to find that.”",
  "And the whole town turned around and looked at me…",
];

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const pick = (list, h, salt) => list[(h + salt * 7919) % list.length];

/** "In this town, every time you burp it rains!" -> "every time you burp it rains" */
export function cleanRule(text) {
  let r = String(text ?? "").replace(/\s+/g, " ").trim();
  r = r.replace(/^(you see,?\s*)?(in (this|my|our) (town|world|city),?\s*)/i, "").replace(/[\s.!?…,;:]+$/u, "").trim();
  if (!r) return "";
  return /^I\b/.test(r) ? r : r[0].toLowerCase() + r.slice(1);
}

export function ruleTheme(rule) {
  return THEMES.find(([, re]) => re.test(rule))?.[0] ?? "any";
}

/** The toy's preview: { rule, theme, hero, beats: [[label, line], ...], words } or null for an empty box. */
export function townPreview(text, shuffle = 0) {
  const rule = cleanRule(text);
  if (rule.length < 3) return null;
  const theme = ruleTheme(rule);
  const h = hash(rule.toLowerCase());
  const hero = pick(KIDS, h, 3 + shuffle);
  const hook = pick([...(HOOKS[theme] ?? []), ...HOOKS.any], h, shuffle);
  const ruleLine = `You see, in this town, ${rule}.`;
  const beats = [
    ["Hook", hook],
    ["The rule", ruleLine],
    ["The one kid", pick(KID_LINES, h, 5 + shuffle)(hero)],
    ["But one day…", pick(BUT, h, 11 + shuffle)],
    ["Cliffhanger", pick(CLIFF, h, 13 + shuffle)],
  ];
  const words = hook.replace(/[^\p{L}\p{N}' ]/gu, "").split(" ").filter(Boolean).slice(0, 10);
  return { rule, theme, hero, beats, words };
}

/* --------------------------------------------------------------------------------------------------------------- */

export function inThisTownVideoObjects(siteUrl) {
  return TOWN_STORIES.map((s) => ({
    "@type": "VideoObject",
    name: `${s.title} (an In This Town story made with Zyvo)`,
    description: `${s.hook} ${s.rule} A ${s.style.toLowerCase()} story video made with Zyvo ${BLOCKY_WORLDS_NAME}; this is its first 30 seconds.`,
    thumbnailUrl: [`${siteUrl}${s.poster}`],
    contentUrl: `${siteUrl}${s.video}`,
    uploadDate: s.uploadDate,
    duration: "PT30S",
  }));
}

export function inThisTownStructuredData(canonical, siteUrl) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: IN_THIS_TOWN_SEO.appName,
        description: IN_THIS_TOWN_SEO.description,
        url: canonical,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        image: `${siteUrl}${OG_IMAGE}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: BLOCKY_WORLDS_NAME, item: canonical },
        ],
      },
      ...inThisTownVideoObjects(siteUrl),
      { "@type": "FAQPage", mainEntity: TOWN_FAQ.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    ],
  };
}
