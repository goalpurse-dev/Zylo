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
export const STICKMAN_PRICING = {
  currency: "EUR",
  creditsPerMinute: 25,
  tenMinuteCredits: 250,
  plans: [
    { id: "starter", name: "Starter", price: 18, videos: 3 },
    { id: "pro", name: "Pro", price: 38, videos: 6 },
    { id: "generative", name: "Generative", price: 78, videos: 12 },
  ],
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

export const STICKMAN_LANDING_PAGES = [MAIN_PAGE];

const clean = (pathname) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export function getStickmanLandingPage(pathname) {
  return STICKMAN_LANDING_PAGES.find((page) => page.path === clean(String(pathname ?? ""))) ?? null;
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
          url: abs("/workspace/pricing"),
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
