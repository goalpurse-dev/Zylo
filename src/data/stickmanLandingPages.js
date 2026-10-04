// Long Form SEO landing pages: /ai-stickman-video-generator and its future
// niche pages (/ai-stickman-video-generator/<slug>). ONE ENTRY PER PAGE in
// STICKMAN_LANDING_PAGES: the route (App.jsx), the metadata
// (publicSeoMetadata.js), the JSON-LD (structuredData.js) and the sitemap
// entry (scripts/generateSitemap.js) are all built from this list, and
// src/pages/landing/StickmanVideoLanding.jsx renders it.
//
// A new niche page = a new entry with its own slug, nicheId, title,
// description, h1, copy, FAQ, gallery groups and example videos. Every page
// must have its own copy and examples (tests/stickmanLandingPages.test.mjs
// fails on a reused title, description or H1).
//
// Plain JS (no JSX, no import.meta, no JSON imports): Node build scripts
// import this file too.
//
// Rules for the copy: real numbers only. No ratings, reviews, user counts or
// results that aren't measured. Pictures come from the owner's own Long Form
// projects (scripts/buildStickmanLandingAssets.mjs).

import { PLAN_CREDITS } from "../../supabase/functions/_shared/stripePlanPrices.js";

export const STICKMAN_BASE_PATH = "/ai-stickman-video-generator";
export const STICKMAN_ASSETS = "/lp/stickman";
// The app's viewport tag (index.html) blocks pinch-zoom. These pages allow it.
export const APP_VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";
export const STICKMAN_VIEWPORT = "width=device-width, initial-scale=1, viewport-fit=cover";
export const STICKMAN_FONT_HREF = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&display=swap";

// The owner's own published videos. Titles, upload dates and durations are the
// public YouTube values (read 2026-10-03).
export const STICKMAN_VIDEOS = {
  hunt: {
    id: "-4oDXegn9vw",
    title: "How Did Ancient Humans Actually Hunt?",
    description: "A stickman history video made with Zyvo Long Form: a wooden spear pulled from a German lakebed is older than our own species, and its design says a lot about how early humans hunted.",
    uploadDate: "2026-09-29T10:48:58-07:00",
    duration: "PT9M37S",
    length: "9:37",
    thumb: `${STICKMAN_ASSETS}/video-early-humans-hunt.webp`,
    alt: "Thumbnail of the stickman history video How Did Ancient Humans Actually Hunt?",
  },
  vikings: {
    id: "2DFxSoSB5hY",
    title: "Did Vikings Really Wear Horned Helmets?",
    description: "A stickman history video made with Zyvo Long Form about whether Vikings really wore horned helmets.",
    uploadDate: "2026-09-27T09:22:10-07:00",
    duration: "PT8M44S",
    length: "8:44",
    thumb: `${STICKMAN_ASSETS}/video-vikings-horned-helmets.webp`,
    alt: "Thumbnail of the stickman history video Did Vikings Really Wear Horned Helmets?",
  },
  tutorial: {
    id: "cDVliwgwe_I",
    title: "How To Make Viral 2D History Stickman Videos With AI (Full Tutorial 2026)",
    description: "A full walkthrough of making a 2D history stickman video with Zyvo Long Form, from the idea to the finished render.",
    uploadDate: "2026-10-02T14:42:40-07:00",
    duration: "PT2M49S",
    length: "2:49",
    thumb: `${STICKMAN_ASSETS}/video-tutorial-2d-history-stickman.webp`,
    alt: "Thumbnail of the Zyvo tutorial on making 2D history stickman videos with AI",
  },
};

// Monthly prices: the live plan-prices function on 2026-10-03 (EUR, VAT
// included). Videos per month = plan credits / 250, rounded down; 250 credits
// is a 10-minute video on the Fast tier (tool_prices longform:v2, 25 a minute).
// Plan credits come from PLAN_CREDITS (750 / 1,600 / 3,200), the one table the
// Stripe webhook, the price function and the Pricing page all read.
const TEN_MINUTE_CREDITS = 250;
export const STICKMAN_PRICING = {
  currency: "EUR",
  creditsPerMinute: 25,
  tenMinuteCredits: TEN_MINUTE_CREDITS,
  plans: [
    { id: "starter", name: "Starter", price: 18 },
    { id: "pro", name: "Pro", price: 38 },
    { id: "generative", name: "Generative", price: 78 },
  ].map((plan) => ({ ...plan, credits: PLAN_CREDITS[plan.id], videos: Math.floor(PLAN_CREDITS[plan.id] / TEN_MINUTE_CREDITS) })),
};

const MAIN_PAGE = {
  slug: "",
  nicheId: null,
  path: STICKMAN_BASE_PATH,
  breadcrumb: "AI Stickman Video Generator",
  appName: "Zyvo Long Form",
  title: "AI Stickman Video Generator for YouTube | Zyvo",
  description: "Turn one idea into a full 8–15 minute stickman YouTube video: researched script, voiceover, 150+ scenes, thumbnails and title. Try Zyvo Long Form.",
  keywords: {
    primary: "AI stickman video generator",
    secondary: ["stickman animation maker", "AI history video generator", "faceless YouTube video generator", "AI explainer video maker", "2D stickman YouTube videos", "stickman history videos"],
  },
  ogImage: `${STICKMAN_ASSETS}/og.jpg`,

  h1: "AI Stickman Video Generator for YouTube",
  subhead: "Type one idea and get a full 8–15 minute video: a researched script, a voiceover, 150+ stickman scenes, three thumbnails and a YouTube title.",
  heroNote: "Long Form is included in every paid plan, from Starter up.",
  hero: {
    poster: `${STICKMAN_ASSETS}/hero-poster.webp`,
    posterAlt: "Stickman hunters closing in on an antelope, a scene from a video made with Zyvo Long Form",
    loop: "lf-card",
  },

  showcase: {
    title: "Made with Zyvo",
    lead: "These videos are on YouTube now. Each one started as a single idea typed into Long Form.",
    videos: ["hunt", "vikings"],
  },

  how: {
    title: "How it works",
    intro: [
      "Zyvo Long Form is an AI stickman video generator built for one job: 8 to 15 minute YouTube explainers. You give it a question, such as “How did ancient humans hunt?”, and it does the slow parts. It researches the topic, writes the script, records the narration and draws a new 2D stickman scene for every few seconds of voiceover.",
      "It is not a stickman animation maker in the frame-by-frame sense. There are no rigs or keyframes to learn. Every scene is a finished drawing, and the movement comes from slow zooms, pans and cuts timed to the voice, the same approach many 2D stickman YouTube videos use. You stay in charge of the idea and the final edit.",
    ],
    steps: [
      {
        title: "Pick a niche and an idea",
        text: "Choose one of 25 niches, then take one of the suggested video ideas or type your own topic. Set the length, from 8 to 15 minutes, and pick a drawing style and a narration voice.",
        image: "/home/v2/step-idea.jpg",
        alt: "Zyvo Long Form setup screen showing the niche, visual style, length and voice for a new video",
      },
      {
        title: "Zyvo writes, voices and draws it",
        text: "Zyvo researches your topic on the web, writes the script from what it finds and reviews it before recording the voiceover. Then it draws about 15 scenes for every minute of narration and checks each one. This runs in the background, so you can close the tab and come back.",
        image: "/home/v2/step-scenes.jpg",
        alt: "Zyvo Long Form scenes screen with a grid of finished stickman scenes and the narration line under each one",
      },
      {
        title: "Edit and publish to YouTube",
        text: "Open the editor to redraw a scene, fix a caption or add text, music and motion. Render the video in 1080p, then download it with three thumbnails and a ready title, description and chapters.",
        image: "/home/v2/step-publish.jpg",
        alt: "Zyvo Long Form publish screen with the finished video, thumbnail options and the YouTube title and description",
      },
    ],
  },

  gallery: {
    title: "Stickman scenes made with Zyvo",
    lead: "Every picture here is a real scene or thumbnail from our own Long Form videos, not a mock-up. They come from three videos about prehistoric life, so you can see how one cast of characters carries a whole story.",
    initialPerGroup: 6,
    groups: [
      { id: "hunt", title: "How did ancient humans hunt?" },
      { id: "fire", title: "Surviving the Ice Age" },
      { id: "rain", title: "What did prehistoric humans do when it rained?" },
      { id: "thumbnails", title: "Thumbnails" },
    ],
  },

  niches: {
    title: "Pick your niche",
    lead: "Stickman drawings suit any topic where the idea matters more than the footage. That is why the same tool works as an AI history video generator and as an AI explainer video maker for science, psychology or money. Tap a niche to start a video in it.",
  },

  features: {
    title: "What you get in every project",
    items: [
      { title: "Researched script with fact-checking", text: "Zyvo searches the web for sources on your topic before it writes. The script is drafted from that research and its claims are fact-checked. You get a summary of which facts were verified, with links to the sources." },
      { title: "Voice library", text: "Choose from 33 narration voices and listen to a sample before you pick. The voiceover is recorded for you, so you never need a microphone." },
      { title: "About 15 scenes per minute", text: "A new drawing roughly every four seconds keeps the picture moving with the narration. A 10-minute video has around 150 scenes, each one drawn for the sentence it sits under." },
      { title: "A real editor", text: "Redraw or replace any scene, add on-screen text, correct captions word by word, add music that drops under the voice, and set the motion and transition for each scene." },
      { title: "1080p and 1440p render", text: "Every video renders in 1080p at 16:9. A sharper 1440p version is an optional upgrade for a few extra credits." },
      { title: "Three thumbnails", text: "Each project comes with three thumbnail options built around the video’s main question, with a short headline already on them." },
      { title: "YouTube title, description and chapters", text: "Copy a title, a description and timestamped chapters straight into YouTube when you upload." },
    ],
  },

  guide: {
    title: "How to start a stickman history channel",
    lead: "The tool handles production. These choices are still yours, and they matter more than the drawing style.",
    items: [
      { title: "Stay in one niche for your first ten videos", text: "Someone who enjoyed one video about daily life in the Middle Ages will probably watch another. A channel that jumps between ten subjects gives them no reason to stay. Pick a niche you can find fifty questions in, such as ancient humans, myth vs reality or military logistics, and stay there until you can see which topics hold attention." },
      { title: "Title the video as a question people already ask", text: "Good stickman history videos answer one clear question. Did Vikings really wear horned helmets? How did Rome feed a marching army? If you can’t put the idea in one question, the video will wander. Long Form’s suggested ideas are written this way, and you can always type your own." },
      { title: "Make it 8 to 15 minutes", text: "That is long enough to answer the question properly and short enough to watch in one sitting. It is also where YouTube lets monetized channels place mid-roll ads, which need a video of at least 8 minutes." },
      { title: "Check the facts before you publish", text: "Long Form researches and reviews its own script, but you are the publisher. Read the script, look up the two or three claims the video depends on, and fix anything that sounds too neat. History viewers leave corrections in the comments, and a channel that gets things right earns their trust." },
      { title: "Give the thumbnail one job", text: "One character, one emotion, three or four words. The thumbnail asks the question and the video answers it. Every project comes with three options, so pick the one that makes you curious." },
      { title: "Publish on a schedule you can keep", text: "One video a week for three months tells you more than five videos in one week. A finished video usually takes under an hour to generate, so the limit is how many good questions you can find, not how fast you can draw." },
    ],
  },

  tutorial: {
    title: "Watch the tutorial",
    lead: "A three-minute walkthrough of making a 2D history stickman video with Long Form.",
    video: "tutorial",
  },

  pricing: {
    title: "What a video costs",
    lead: "Long Form uses the credits in your plan. A video costs 25 credits per minute on the Fast tier, so a 10-minute video starts at 250 credits. The price is fixed before you start and covers the script, the voice, the scenes and the 1080p render.",
    note: "Monthly prices in euros, VAT included. Pro adds the High Quality scene tier and Generative adds Ultra; both use more credits per minute.",
  },

  faq: [
    { q: "Can I use it for a faceless YouTube channel?", a: "Yes. Long Form works as a faceless YouTube video generator: the narration is an AI voice and every picture is drawn, so you never appear on camera or record your own voice." },
    { q: "How long does a video take to make?", a: "In our own runs, a 10-minute video took about 30 to 45 minutes from pressing Generate to a finished 1080p render. It runs in the background and can be slower at busy times. Editing afterwards is up to you." },
    { q: "Can I edit the scenes?", a: "Yes. You can redraw any scene, replace it, add on-screen text, correct the captions, add music and change the motion and transitions before you render again." },
    { q: "Which niches can I make videos in?", a: "There are 25 niches in five groups: history, mind and body, animals and nature, science and the universe, and money and modern life. You can also type your own topic inside any niche." },
    { q: "Are the videos original, and can I monetize them?", a: "Each script is written for your topic and each scene is drawn for that script; nothing comes from a stock library. Whether a channel is monetized is YouTube’s decision, not ours. Read YouTube’s current monetization policies, check your facts and add your own judgment before you publish." },
    { q: "Do I need animation or editing skills?", a: "No. You pick the idea and the voice, and Long Form makes the script, the scenes and the video. The editor is there if you want to change something, but you don’t have to use it." },
    { q: "What resolution are the videos?", a: "Videos render in 1080p at 16:9, the standard YouTube format. A 1440p version is available as an optional upgrade." },
    { q: "How much does a video cost?", a: "A video costs 25 credits per minute on the Fast tier, so a 10-minute video is 250 credits. That is about 3 ten-minute videos a month on Starter (€18), 6 on Pro (€38) and 12 on Generative (€78)." },
    { q: "Is Long Form on the free plan?", a: "No. Long Form is included in the Starter, Pro and Generative plans." },
  ],

  related: {
    title: "Related guides",
    links: [
      { to: "/blog/faceless-youtube-channel-ideas", label: "Faceless YouTube Channel Ideas Using AI in 2026" },
      { to: "/blog/ai-script-generator-viral-videos", label: "AI Script Generator for Viral Videos" },
      { to: "/blog/how-to-make-money-ai-content", label: "How to Make Money With AI-Generated Content in 2026" },
    ],
  },

  cta: {
    title: "Make your first stickman video",
    text: "Pick a niche, choose an idea and let Long Form do the research, the voice and the drawing.",
  },
};

// /ai-stickman-video-generator/history: the History & The Past niche group.
// Its own copy, FAQ, pictures (gallery groups history-*) and video ideas.
const HISTORY_PAGE = {
  slug: "history",
  nicheId: null,
  nicheGroupId: "history",
  linkLabel: "AI history video generator",
  path: `${STICKMAN_BASE_PATH}/history`,
  breadcrumb: "History",
  appName: "Zyvo Long Form",
  title: "AI History Video Generator: Stickman History Videos | Zyvo",
  description: "Turn one history question into an 8–15 minute stickman video: sourced, fact-checked script, voiceover, 150+ scenes. Made for faceless history channels.",
  keywords: {
    primary: "AI history video generator",
    secondary: ["stickman history videos", "history YouTube channel ideas", "faceless history channel"],
  },
  ogImage: `${STICKMAN_ASSETS}/og-history.jpg`,

  eyebrow: "Zyvo Long Form · History",
  h1: "AI History Video Generator",
  subhead: "Ask one question about the past and get an 8–15 minute stickman history video, with a sourced script, narration and a new drawing every few seconds.",
  heroNote: "Seven history niches, from prehistory to myth vs reality.",
  hero: {
    poster: `${STICKMAN_ASSETS}/hero-history.webp`,
    posterAlt: "Two groups of stickman hunters facing a wild boar in a cave, from a stickman history video made with Zyvo",
    loop: "made-with-zyvo",
  },

  showcase: {
    title: "History videos made with Zyvo",
    lead: "Both are published on YouTube. One asks how early humans hunted; the other tests a famous Viking myth.",
    videos: ["hunt", "vikings"],
  },

  how: {
    title: "How a history video gets made",
    intro: [
      "A history video stands or falls on its facts. So before Zyvo’s AI history video generator writes a line, it searches the web for sources on your question and builds the script from what they say. Then it checks the script’s claims and shows you which ones it could verify, with links.",
      "Only after that does it record the narration and draw the scenes: hunters, soldiers, doctors and kings as simple stickman characters who stay the same from the first scene to the last. You get the finished video and the material you need to check it.",
    ],
    steps: [
      {
        title: "Start with a question about the past",
        text: "Pick one of the seven history niches and take a suggested question, or type your own. A narrow question (“How did Rome feed an army on the march?”) makes a better video than a broad subject (“The Roman army”).",
        image: "/home/v2/step-idea.jpg",
        alt: "Long Form setup with the Ancient Humans and Prehistory niche chosen for a new history video",
      },
      {
        title: "Research, script, voice, scenes",
        text: "Zyvo gathers sources, writes the script, fact-checks it and records the voiceover. It then draws roughly 150 scenes for a 10-minute video. You can leave the page while it works.",
        image: "/home/v2/step-scenes.jpg",
        alt: "Finished scenes of a Viking history video in Long Form, each with its line of narration",
      },
      {
        title: "Correct it, then publish",
        text: "Read the fact-check summary, redraw any scene that looks wrong for the period, fix names in the captions, and render. The thumbnails, title, description and chapters come with it.",
        image: "/home/v2/step-publish.jpg",
        alt: "Long Form publish screen for a Viking history video with thumbnails and YouTube text ready to copy",
      },
    ],
  },

  gallery: {
    title: "Scenes from our stickman history videos",
    lead: "These drawings come from three of our own videos about prehistoric life. They show the range a single history topic produces: the dig, the evidence, the people and the weather they lived in.",
    initialPerGroup: 8,
    groups: [
      { id: "history-hunt", title: "From the dig to the hunt" },
      { id: "history-fire", title: "An Ice Age winter camp" },
      { id: "history-rain", title: "Keeping a fire alive in the rain" },
    ],
  },

  ideas: {
    title: "14 history video ideas to start with",
    lead: "Good history YouTube channel ideas are questions, not subjects. Each of these fits one video. Tap one to open Long Form in that niche and type it in, or change it to suit your channel.",
    items: [
      { niche: "ancient_humans_prehistory", title: "How did early humans survive winter before they could make fire?" },
      { niche: "ancient_humans_prehistory", title: "What did people eat before farming?" },
      { niche: "dark_brutal_history", title: "What was it like to live through the Black Death?" },
      { niche: "dark_brutal_history", title: "What happened to sailors who were lost at sea for months?" },
      { niche: "daily_life_past_eras", title: "What did an ordinary day look like in a medieval village?" },
      { niche: "daily_life_past_eras", title: "How did people keep clean before running water?" },
      { niche: "military_logistics_history", title: "How did Rome feed an army on the march?" },
      { niche: "military_logistics_history", title: "How did medieval armies cross rivers without bridges?" },
      { niche: "ancient_medicine_science", title: "Did ancient doctors really perform brain surgery?" },
      { niche: "ancient_medicine_science", title: "How did people treat toothache before dentists?" },
      { niche: "timeline_history", title: "How did one assassination lead to the First World War?" },
      { niche: "timeline_history", title: "How did the printing press change Europe in fifty years?" },
      { niche: "myth_vs_reality", title: "Did Vikings really wear horned helmets?" },
      { niche: "myth_vs_reality", title: "Did medieval people really think the Earth was flat?" },
    ],
  },

  niches: {
    title: "Seven history niches",
    lead: "Each niche gives Long Form a different angle on the past and its own set of suggested ideas.",
    groupIds: ["history"],
  },

  features: {
    title: "Built for history",
    items: [
      { title: "A fact-check you can read", text: "Every script comes with a summary: how many of its claims were verified and which sources back them. Open the links and judge for yourself." },
      { title: "Dates and numbers on screen", text: "When the narration gives a year, a distance or a count, it can appear as text on the scene, so viewers don’t have to hold figures in their heads. You can edit or remove any of it." },
      { title: "One cast for the whole video", text: "The characters, clothes and settings are planned once and reused, so the same hunters or soldiers return in every scene instead of changing face each time." },
      { title: "Captions you can correct", text: "Names, places and old words are where automatic captions slip. Fix any word in the editor before you render." },
      { title: "Chapters for long videos", text: "A 12-minute video about a siege or an expedition is easier to follow in parts. Timestamped chapters are written for you to paste into YouTube." },
      { title: "Redraw what looks wrong", text: "If a scene shows the wrong tool or the wrong century, redraw it. The rest of the video stays as it is." },
    ],
  },

  guide: {
    title: "Running a faceless history channel",
    lead: "A faceless history channel lives on trust. Viewers can’t see you, so the care in the video is all they have to go on.",
    items: [
      { title: "Choose a period or a type of question", text: "“Roman history” and “things people get wrong about the past” are both channels. “History” is not. A viewer should be able to guess your next video from your last three." },
      { title: "Open with the evidence", text: "The hunting video above is built around a wooden spear pulled from a German lakebed, not around a date. An object, a letter or a number that seems wrong pulls people in faster than background does." },
      { title: "Say how sure you are", text: "“Historians think”, “the oldest evidence so far” and “we don’t know” are not weaknesses. They are what separates a history channel from a list of fun facts, and they protect you when new research arrives." },
      { title: "List your sources in the description", text: "The fact-check summary gives you the links. Paste the main ones under the video. It takes a minute and it answers the first sceptical comment before it is written." },
      { title: "Turn one topic into a series", text: "One good question usually hides five more. A video on how Rome fed its army leads to how it paid it, moved it and housed it. A series keeps viewers on the channel and makes the next idea easy." },
      { title: "Keep the drawings honest", text: "Stickman scenes are cartoons, not reconstructions, and viewers accept that. What they don’t forgive is a wristwatch in the Middle Ages. Skim the scenes for anything out of its time and redraw it." },
    ],
  },

  tutorial: {
    title: "See it made, start to finish",
    lead: "The tutorial builds a stickman history video in under three minutes.",
    video: "tutorial",
  },

  pricing: {
    title: "What a history video costs",
    lead: "A 10-minute history video costs 250 credits on the Fast tier, and the research, fact-check, voice and scenes are all inside that price.",
    note: "Prices are in euros with VAT included. Longer videos cost more in proportion: 25 credits for each minute.",
  },

  faqTitle: "History video questions",
  faq: [
    { q: "How accurate are the history videos?", a: "Zyvo researches each topic on the web before writing and then fact-checks the script, and you see how many claims were verified and which sources support them. That catches a lot, but it is not a historian’s review. Check the claims your video depends on before you publish." },
    { q: "Where do the facts come from?", a: "From web sources found during the research step for your specific question. The sources are listed with links next to the script, so you can open them." },
    { q: "Can I make a video about any period or country?", a: "Yes. Type any topic inside the closest history niche. Well-documented subjects give the research more to work with; for obscure ones, expect fewer verified claims and check more yourself." },
    { q: "What kinds of history topics work best?", a: "Single questions with a clear answer: how something was done, whether a famous story is true, what daily life was like. Broad subjects such as a whole war or empire are better split into several videos." },
    { q: "Can I run a faceless history channel with it?", a: "Yes. The voice is an AI narrator and the pictures are drawings, so nothing in the video needs your face or your voice." },
    { q: "Are the drawings historically accurate?", a: "They are simplified stickman cartoons that follow the script. They aim for the right kind of tools, clothing and setting, but they are illustrations, not reconstructions. If a scene shows something out of its time, you can redraw it." },
    { q: "Does it use real photos or archive footage?", a: "No. Every scene is drawn for your script. There is no archive footage and there are no photographs of real people." },
    { q: "How long is a video and how many scenes does it have?", a: "You choose a length from 8 to 15 minutes. Expect about 15 scenes per minute, so roughly 120 for 8 minutes and 225 for 15." },
    { q: "How much does a history video cost?", a: "25 credits per minute on the Fast tier, so 250 credits for 10 minutes. That is about 3 ten-minute videos a month on Starter (€18), 6 on Pro (€38) and 12 on Generative (€78)." },
  ],

  related: {
    title: "Keep reading",
    links: [
      { to: STICKMAN_BASE_PATH, label: "AI Stickman Video Generator: all 25 niches" },
      { to: "/blog/faceless-youtube-channel-ideas", label: "Faceless YouTube Channel Ideas Using AI in 2026" },
    ],
  },

  cta: {
    title: "Make your first history video",
    text: "Bring a question about the past. Long Form brings the research, the narrator and the drawings.",
  },
};

export const STICKMAN_LANDING_PAGES = [MAIN_PAGE, HISTORY_PAGE];

const clean = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export function getStickmanLandingPage(pathname) {
  return STICKMAN_LANDING_PAGES.find((page) => page.path === clean(String(pathname ?? ""))) ?? null;
}

// The landing page of a whole niche group ("history"), if one exists: the main
// page links to it from that group's heading.
export function stickmanGroupPage(groupId) {
  return STICKMAN_LANDING_PAGES.find((entry) => entry.nicheGroupId === groupId) ?? null;
}

// Where a niche card goes: that niche's own landing page once it exists in
// the list above, the Long Form setup with the niche preselected until then.
export function stickmanNicheHref(nicheId) {
  const page = STICKMAN_LANDING_PAGES.find((entry) => entry.nicheId === nicheId);
  return page ? page.path : `/long-form/create?niche=${nicheId}`;
}

const youtubeWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
export const stickmanVideoUrl = (key) => youtubeWatch(STICKMAN_VIDEOS[key].id);

// JSON-LD for one page: SoftwareApplication with the real plan prices (no
// rating: there are no ratings to report), the videos shown on the page,
// the FAQ exactly as printed, and the breadcrumb.
export function stickmanStructuredData(page, canonical, siteUrl) {
  const abs = (path) => `${siteUrl}${path}`;
  const main = STICKMAN_LANDING_PAGES[0];
  const videoKeys = [page.tutorial.video, ...page.showcase.videos];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: page.appName ?? main.appName,
        description: page.description,
        url: canonical,
        image: abs(page.ogImage),
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        publisher: { "@type": "Organization", name: "Zyvo", url: siteUrl },
        offers: STICKMAN_PRICING.plans.map((plan) => ({
          "@type": "Offer",
          name: `${plan.name} plan (monthly)`,
          price: plan.price.toFixed(2),
          priceCurrency: STICKMAN_PRICING.currency,
          url: abs("/pricing"),
          availability: "https://schema.org/InStock",
        })),
      },
      ...videoKeys.map((key) => {
        const video = STICKMAN_VIDEOS[key];
        return {
          "@type": "VideoObject",
          name: video.title,
          description: video.description,
          thumbnailUrl: [abs(video.thumb)],
          uploadDate: video.uploadDate,
          duration: video.duration,
          embedUrl: `https://www.youtube.com/embed/${video.id}`,
          url: youtubeWatch(video.id),
        };
      }),
      {
        "@type": "FAQPage",
        mainEntity: page.faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${siteUrl}/` },
          { "@type": "ListItem", position: 2, name: main.breadcrumb, item: abs(main.path) },
          ...(page.slug ? [{ "@type": "ListItem", position: 3, name: page.breadcrumb, item: canonical }] : []),
        ],
      },
    ],
  };
}
