// THE STYLES REGISTRY + THE STUDIOS (docs/studio-v2-plan.md A). ONE ROW = ONE STYLE. The Create hub, every studio page,
// the prompt bar, the Director, the credit estimate and the Zyvo connector's list_styles / get_style read ONLY this
// file, so adding a niche = adding a row here (no code). Plain JS, no imports: the site, the edge functions and the
// Node tests share it.
//
// A style row:
//   id            short unique id (letters, digits, -). Used in drafts and analytics: never rename a live one
//   name          what the card says
//   category      the filter chip it sits under (CATEGORIES)
//   studios       which studios list it (one or more of STUDIOS[].id)
//   poster        a still (9:16 or 16:9), under /public, WEB-SIZED (480 px wide webp in /styles/posters: some originals were 2-10 MB)
//   preview       a short silent looping clip for the card (null = the poster only)
//   examples      2-3 more example videos for the preview popup [{ src, poster? }]
//   referenceImage  4 frames of a good example in one image (null until we make one; the poster stands in)
//   direction     one sentence: the look and the voice of the style (the Director plans to it)
//   hook          the hook formula ("In this town, everybody ___. Except me."); the prompt bar's placeholder
//   ideas         3 tappable example ideas for the prompt bar
//   examplePrompt the one example prompt the popup shows
//   sceneRules    short rules the Director (and Claude) follow for every scene
//   voice         the default voice (a plain label; each engine maps it to its own voice)
//   engine        which existing template renders it: { path, handoff } (handoff: how "Make it on Zyvo" passes the plan;
//                 see the plan doc: "cutaway-topic" | "fruit-stash" | "town-stash" | "prompt-stash"; direct: "town" |
//                 "cutaway" = Maestro can start it right in the chat, else Maestro opens the template's page)
//   inputKind     what that engine takes today: "topic" | "script" | "scenes" (the plan doc lists who needs per-scene later)
//   formats       the formats it can render; lengths: the lengths (seconds) it can render
//   price         credit estimate points [[seconds, credits], ...] at the cheapest quality (interpolated). An ESTIMATE:
//                 the template page always shows the exact price before anything is charged
//   included      what the video comes with: { voice, captions, music }
//   tier          "free" (a free account can make it) | "paid" (needs a paid plan)
//   worksInClaude true = "Make it with your Claude" is offered (the user's Claude builds the animation)
//   claude        the Claude build's notes (honest line, sample look, kit) when worksInClaude
//   gate          optional: the template id whose visibility switch hides it (CreateMenu's flagged tools)
//   sort          lower first; badge: "NEW" | "POPULAR" | null
//   variants      optional: versions of the style shown in its popup ("Pick a version"): [{ id, name, poster, preview?,
//                 direction (one extra sentence for the Director), ideas? (3) }]. The user's pick rides on the plan.
//   wall          optional: false keeps the style's clips off the decorative clip walls (e.g. real-looking faces)
//   views         optional: REAL public views of our best video in this style (a number), shown as "2.5M views" on the
//                 card. Leave it out until there is a real number: never an estimate. examples[].views works the same.

// the only import: In This Town's one flat price, so every page shows what the template really charges
import { BLENDER_FLAT } from "../blockyWorlds/blenderPricing.js";

export const STUDIOS = Object.freeze([
  {
    id: "short-form", name: "Short Form Studio", line: "Vertical shorts for TikTok, Reels and Shorts.",
    format: "9:16", lengths: [15, 30, 45, 60], defaultLength: 30,
    preview: "/in-this-town/clips/milo-a.mp4", poster: "/in-this-town/stories/milo.webp", sort: 1,
    // the hub card: three tall clips side by side (In This Town, Blocky Stories, AI Fruit Story)
    covers: [{ src: "/in-this-town/clips/milo-a.mp4", poster: "/in-this-town/stories/milo.webp" }, { src: null, poster: "/styles/posters/blocky-stories.webp" }, { src: "/viral-builder/ai-fruit/result.mp4", poster: "/styles/posters/ai-fruit-story.webp" }],
  },
  {
    id: "long-form", name: "Long Form Studio", line: "Wide YouTube videos, 8 to 15 minutes.",
    format: "16:9", lengths: [480, 600, 720, 900], defaultLength: 600,
    preview: "/styles/long-form-preview.mp4", poster: "/styles/long-form-preview.jpg", sort: 2,
    covers: [{ src: "/styles/long-form-preview.mp4", poster: "/styles/long-form-preview.jpg" }],
  },
  {
    id: "3d", name: "3D Studio", line: "Real 3D worlds we build and film for you.",
    format: "9:16", lengths: [30, 45, 60], defaultLength: 30,
    preview: "/in-this-town/clips/plane-a.mp4", poster: "/in-this-town/stories/plane.webp", sort: 3,
    covers: [{ src: "/in-this-town/clips/plane-a.mp4", poster: "/in-this-town/stories/plane.webp" }, { src: "/cutaway-explainer/demo-landfill-clean.mp4", poster: "/onboarding/demo/landfill.jpg" }, { src: "/in-this-town/clips/tower-a.mp4", poster: "/in-this-town/stories/tower.webp" }],
  },
  {
    id: "explainer", name: "Explainer Studio", line: "Show how things work, step by step.",
    format: "9:16", lengths: [30, 45, 60], defaultLength: 30,
    preview: "/cutaway-explainer/demo-landfill-clean.mp4", poster: "/onboarding/demo/landfill.jpg", sort: 4,
    covers: [{ src: "/cutaway-explainer/demo-landfill-clean.mp4", poster: "/onboarding/demo/landfill.jpg" }, { src: "/cutaway-explainer/example-french-drain-clean.mp4", poster: "/onboarding/demo/french_drain.jpg" }],
  },
]);

export const CATEGORIES = Object.freeze([
  { id: "stories", label: "Stories" },
  { id: "explainers", label: "Explainers" },
  { id: "satisfying", label: "Satisfying" },
  { id: "trends", label: "Trends" },
]);

const NARRATOR = "Story narrator";
const ALL_VOICE = { voice: true, captions: true, music: true };

export const STYLES = Object.freeze([
  {
    id: "in-this-town", name: "In This Town", category: "stories", studios: ["short-form", "3d"],
    poster: "/in-this-town/stories/milo.webp", preview: "/in-this-town/clips/milo-a.mp4",
    examples: [{ src: "/in-this-town/stories/milo.mp4", poster: "/in-this-town/stories/milo.webp" }, { src: "/in-this-town/stories/plane.mp4", poster: "/in-this-town/stories/plane.webp" }, { src: "/in-this-town/stories/tower.mp4", poster: "/in-this-town/stories/tower.webp" }],
    referenceImage: null,
    direction: "A narrated story set in a blocky 3D town with one strange rule everybody follows, told by one kid who is the exception.",
    hook: "In this town, everybody ___. Except me.",
    ideas: ["In this town, everybody's shadow tells the truth. Except mine.", "In this town, you get one wish on your 13th birthday. Except me.", "In this town, everybody sleeps at 8pm sharp. Except me."],
    examplePrompt: "In this town, everybody laughs when it rains. Except me.",
    sceneRules: ["Open on the town's rule in the first line.", "One kid tells it in first person.", "Show every thing the line names on screen.", "End with a twist about the rule."],
    voice: NARRATOR, engine: { path: "/workspace/in-this-town", handoff: "town-stash", direct: "town" }, inputKind: "script",
    formats: ["9:16"], lengths: [30, 45, 60], price: [[30, BLENDER_FLAT.credits]], included: ALL_VOICE, // one flat price per video (what the In This Town page charges)
    tier: "free", worksInClaude: true,
    claude: { kit: "zyvo-roblox-story", honest: "With your Claude it's built in your own Roblox Studio: you play it and record it, so it takes longer but costs far less.", sample: "/media/studio-kit/bedtime-free.mp4" },
    variants: [
      { id: "funny", name: "Funny", poster: "/in-this-town/stories/milo.webp", preview: "/in-this-town/clips/milo-a.mp4", direction: "Keep it light and silly: the rule causes funny chaos, the twist is a joke.",
        ideas: ["In this town, everybody sneezes glitter. Except me.", "In this town, dogs run the school. Except mine.", "In this town, everyone talks in rhymes. Except me."] },
      { id: "spooky", name: "Spooky", poster: "/in-this-town/stories/tower.webp", preview: "/in-this-town/clips/tower-a.mp4", direction: "Make it eerie, not gory: night, empty streets, something is wrong with the rule, a creepy last line.",
        ideas: ["In this town, nobody goes outside after 9. Except me.", "In this town, mirrors show tomorrow. Except mine.", "In this town, the streetlights follow you. Except me."] },
      { id: "wholesome", name: "Wholesome", poster: "/in-this-town/stories/plane.webp", preview: "/in-this-town/clips/plane-a.mp4", direction: "Warm and kind: the rule is sweet, the exception learns something, a feel-good ending.",
        ideas: ["In this town, everyone gets a hug at noon. Except me.", "In this town, birthdays last a week. Except mine.", "In this town, every kid has a pet cloud. Except me."] },
    ],
    gate: "blocky-worlds", sort: 1, badge: "POPULAR",
  },
  {
    id: "cutaway-explainer", name: "Cutaway Explainer", category: "explainers", studios: ["short-form", "3d", "explainer"],
    poster: "/onboarding/demo/landfill.jpg", preview: "/cutaway-explainer/demo-landfill-clean.mp4",
    examples: [{ src: "/cutaway-explainer/demo-landfill-clean.mp4", poster: "/onboarding/demo/landfill.jpg" }, { src: "/cutaway-explainer/example-french-drain-clean.mp4", poster: "/onboarding/demo/french_drain.jpg" }],
    referenceImage: null,
    direction: "A calm 3D cutaway that slices through a real thing (a house, a pipe, the ground) to show how it works inside, one step per scene.",
    hook: "Ever wondered what happens inside ___?",
    ideas: ["How a landfill works", "What's inside a water tower", "How a French drain keeps a basement dry"],
    examplePrompt: "How a septic tank works",
    sceneRules: ["One step of the process per scene.", "Cut away the outside to show the inside.", "Name the part on screen as the voice says it."],
    voice: "Calm explainer", engine: { path: "/workspace/cutaway-explainer", handoff: "cutaway-topic", direct: "cutaway" }, inputKind: "topic",
    formats: ["9:16"], lengths: [30, 60], price: [[30, 136], [60, 195]], included: ALL_VOICE,
    tier: "paid", worksInClaude: true,
    claude: { honest: "Your Claude makes a simpler 3D diagram version, not our full 3D render.", sample: null },
    gate: "cutaway-explainer", sort: 2, badge: "NEW",
  },
  {
    id: "blocky-stories", name: "Blocky Stories", category: "stories", studios: ["short-form", "3d"],
    poster: "/styles/posters/blocky-stories.webp", preview: null, examples: [], referenceImage: null,
    direction: "A funny narrated story with blocky game-style characters, quick cuts and big reactions.",
    hook: "My friend thought ___ was a good idea.",
    ideas: ["My friend built a house out of TNT", "The day the sun forgot to set", "I found a secret room under my bed"],
    examplePrompt: "My friend tried to tame a dragon with cookies",
    sceneRules: ["One action per scene.", "Big, clear reactions.", "Short lines, fast pace."],
    voice: NARRATOR, engine: { path: "/workspace/blocky-stories", handoff: "prompt-stash" }, inputKind: "script",
    formats: ["9:16", "16:9"], lengths: [15, 30, 45, 60], price: [[15, 85], [30, 166], [60, 330]], included: ALL_VOICE,
    tier: "paid", worksInClaude: true,
    claude: { honest: "Your Claude builds simple block characters in a browser animation, simpler than ours.", sample: null },
    gate: "blocky-stories", sort: 3, badge: null,
  },
  {
    id: "ai-fruit-story", name: "AI Fruit Story", category: "stories", studios: ["short-form"],
    poster: "/styles/posters/ai-fruit-story.webp", preview: "/viral-builder/ai-fruit/result.mp4", examples: [{ src: "/viral-builder/ai-fruit/result.mp4" }], referenceImage: null,
    direction: "A dramatic soap-opera story acted by talking fruit characters, with cliffhanger energy.",
    hook: "___ had no idea what was about to happen.",
    ideas: ["The banana finds out the apple lied", "The mango wins the lottery", "Two lemons fight over the last slice of cake"],
    examplePrompt: "The strawberry catches her boyfriend cheating with a kiwi",
    sceneRules: ["Each scene is one dramatic moment.", "Characters are fruit with faces.", "End on a twist or cliffhanger."],
    voice: NARRATOR, engine: { path: "/workspace/ai-fruit-story", handoff: "fruit-stash" }, inputKind: "script",
    formats: ["9:16", "16:9"], lengths: [15, 30, 45, 60], price: [[15, 85], [30, 166], [60, 330]], included: ALL_VOICE,
    tier: "paid", worksInClaude: false, sort: 4, badge: "POPULAR",
  },
  {
    id: "two-am", name: "2AM Worlds", category: "trends", studios: ["short-form"],
    poster: "/styles/posters/two-am.webp", preview: null, examples: [], referenceImage: null,
    direction: "Dreamy, nostalgic pictures of an empty world at 2AM, soft lights and a quiet mood.",
    hook: "POV: it's 2AM in ___.",
    ideas: ["A mountain ninja city", "A seaside creature town", "An abandoned mall in the rain"],
    examplePrompt: "A floating night market above the clouds",
    sceneRules: ["One place per scene.", "Night, soft glow, no people."],
    voice: "No voice (music only)", engine: { path: "/workspace/two-am", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [15, 30], price: [[15, 40], [30, 40]], included: { voice: false, captions: false, music: true },
    tier: "paid", worksInClaude: false, sort: 5, badge: null,
  },
  {
    id: "thirty-days", name: "30 Days", category: "stories", studios: ["short-form"],
    poster: "/styles/posters/thirty-days.webp", preview: null, examples: [], referenceImage: null,
    direction: "Someone survives 30 days in a strange world, told as a day-by-day journey.",
    hook: "I spent 30 days in ___.",
    ideas: ["30 days inside a video game", "30 days on a planet made of candy", "30 days as a ghost"],
    examplePrompt: "I spent 30 days in a world where gravity flips every night",
    sceneRules: ["Each scene jumps forward in days.", "Show the day number on screen."],
    voice: NARRATOR, engine: { path: "/workspace/thirty-days", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [45, 60], price: [[45, 250], [60, 250]], included: ALL_VOICE,
    tier: "paid", worksInClaude: false, sort: 6, badge: null,
  },
  {
    id: "face-asmr", name: "Face ASMR", category: "satisfying", studios: ["short-form"],
    poster: "/styles/posters/face-asmr.webp", preview: "/face/1.mp4", examples: [], referenceImage: null, // /face/preview.mp4 and 2.mp4 look like real famous people: not used
    direction: "Close-up, satisfying clips of faces made of surprising materials being tapped and touched.",
    hook: "This face is made of ___.",
    ideas: ["A face made of glass", "A face made of jelly", "A face made of marble"],
    examplePrompt: "A face made of honey",
    sceneRules: ["One material per scene.", "Very close camera."],
    voice: "No voice (sounds only)", engine: { path: "/workspace/face-asmr", handoff: "prompt-stash" }, inputKind: "scenes",
    formats: ["9:16"], lengths: [15, 30], price: [[15, 57], [30, 114]], included: { voice: false, captions: false, music: false },
    tier: "paid", worksInClaude: false, sort: 7, badge: null,
  },
  {
    id: "clay-rescue", name: "Clay Rescue", category: "satisfying", studios: ["short-form"],
    poster: "/styles/posters/clay-rescue.webp", preview: "/clayrescue/homevideo.mp4", examples: [{ src: "/clayrescue/homevideo.mp4" }, { src: "/clayrescue/homevideo2.mp4" }], referenceImage: null,
    direction: "Cute clay scenes where something goes wrong and then gets fixed, problem then rescue.",
    hook: "This little ___ needed help.",
    ideas: ["A puppy stuck in a hole", "A broken bridge for a tiny train", "A turtle flipped on its back"],
    examplePrompt: "A kitten stuck up a clay tree",
    sceneRules: ["Each scene: the problem, then the fix.", "Soft clay look, warm light."],
    voice: "No voice (sounds only)", engine: { path: "/workspace/clay-rescue", handoff: "prompt-stash" }, inputKind: "scenes",
    formats: ["9:16"], lengths: [15, 30], price: [[15, 60], [30, 120]], included: { voice: false, captions: false, music: true },
    tier: "paid", worksInClaude: false, sort: 8, badge: null,
  },
  {
    id: "micro-camera-animal", name: "Micro Camera", category: "satisfying", studios: ["short-form"],
    poster: "/styles/posters/micro-camera-animal.webp", preview: "/viral-builder/micro-camera/video.mp4", examples: [{ src: "/viral-builder/micro-camera/video.mp4" }, { src: "/viral-builder/micro-camera/video2.mp4" }], referenceImage: null,
    direction: "A tiny camera rides on an animal and shows its world up close.",
    hook: "We put a tiny camera on a ___.",
    ideas: ["A bee", "A cat", "A shark"],
    examplePrompt: "An eagle",
    sceneRules: ["Point of view from the animal.", "One moment of its day per scene."],
    voice: "No voice (sounds only)", engine: { path: "/workspace/micro-camera-animal", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [15, 30], price: [[15, 60], [30, 100]], included: { voice: false, captions: false, music: true },
    tier: "paid", worksInClaude: false, sort: 9, badge: null,
  },
  {
    id: "ai-cooking-matic", name: "AI Cooking Matic", category: "satisfying", studios: ["short-form"],
    poster: "/styles/posters/ai-cooking-matic.webp", preview: null, examples: [], referenceImage: null,
    direction: "A dish cooked step by step in slick, satisfying close-ups with a short voice-over.",
    hook: "How to make ___ in 30 seconds.",
    ideas: ["Crispy smash burgers", "Ramen from scratch", "A giant chocolate cookie"],
    examplePrompt: "Lasagna",
    sceneRules: ["One cooking step per scene.", "Close-up, steam and sizzle."],
    voice: "Friendly chef", engine: { path: "/workspace/ai-cooking-matic", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [30], price: [[30, 120]], included: ALL_VOICE,
    tier: "paid", worksInClaude: false, sort: 10, badge: null,
  },
  {
    id: "kit-swap", name: "Kit Swap", category: "trends", studios: ["short-form"],
    poster: "/styles/posters/kit-swap.webp", preview: null, examples: [], referenceImage: null,
    direction: "Famous-style footballers shown in another country's kit, one swap per scene.",
    hook: "What if ___ played for ___?",
    ideas: ["A striker in Brazil's kit", "A goalkeeper for Japan", "A captain for Italy"],
    examplePrompt: "A winger playing for Argentina",
    sceneRules: ["One player and one kit per scene."],
    voice: "No voice (music only)", engine: { path: "/workspace/kit-swap", handoff: "prompt-stash" }, inputKind: "scenes",
    formats: ["9:16"], lengths: [15, 30], price: [[15, 78], [30, 130]], included: { voice: false, captions: true, music: true },
    tier: "paid", worksInClaude: false, sort: 11, badge: null,
  },
  {
    id: "cartoon-drive-by", name: "Cartoon Drive By", category: "trends", studios: ["short-form"],
    poster: "/styles/cartoon-drive-by.webp", preview: "/styles/cartoon-drive-by.mp4", examples: [{ src: "/styles/cartoon-drive-by.mp4" }], referenceImage: null,
    direction: "One 10-second cartoon clip: a car drives through a colourful world.",
    hook: "Driving through ___.",
    ideas: ["A candy city", "A jungle full of dinosaurs", "A neon city at night"],
    examplePrompt: "A town made of pizza",
    sceneRules: ["One continuous drive."],
    voice: "No voice (music only)", engine: { path: "/workspace/cartoon-drive-by", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [15], price: [[15, 167]], included: { voice: false, captions: false, music: true },
    tier: "paid", worksInClaude: false, sort: 12, badge: null,
  },
  {
    id: "behind-the-scenes", name: "Behind the Scenes", category: "trends", studios: ["short-form"],
    poster: "/styles/posters/behind-the-scenes.webp", preview: "/behind-the-scenes/example-1.mp4", examples: [{ src: "/behind-the-scenes/example-1.mp4" }, { src: "/behind-the-scenes/example-2.mp4" }], referenceImage: null,
    direction: "One 8-second 'behind the scenes' clip of a famous kind of disaster being filmed on a set.",
    hook: "Behind the scenes of ___.",
    ideas: ["A volcano erupting in a city", "A giant wave hitting a beach", "A spaceship crash"],
    examplePrompt: "A tornado in a cornfield",
    sceneRules: ["One continuous shot, crew and cameras visible."],
    voice: "No voice (sounds only)", engine: { path: "/workspace/behind-the-scenes", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["9:16"], lengths: [15], price: [[15, 135]], included: { voice: false, captions: false, music: false },
    tier: "paid", worksInClaude: false, sort: 13, badge: null,
  },
  {
    id: "long-form", name: "Long Form Explainer", category: "explainers", studios: ["long-form", "explainer"],
    poster: "/styles/long-form-preview.jpg", preview: "/styles/long-form-preview.mp4", examples: [{ src: "/styles/long-form-preview.mp4", poster: "/styles/long-form-preview.jpg" }], referenceImage: null,
    direction: "A wide YouTube video that explains one topic in chapters, with simple drawn scenes and a clear narrator.",
    hook: "Here's what nobody tells you about ___.",
    ideas: ["Why the Roman Empire fell", "How credit cards really make money", "The history of the internet in 5 minutes"],
    examplePrompt: "How the pyramids were built",
    sceneRules: ["Group scenes into short chapters.", "One idea per scene.", "Recap at the end."],
    voice: NARRATOR, engine: { path: "/long-form", handoff: "prompt-stash" }, inputKind: "topic",
    formats: ["16:9"], lengths: [480, 600, 720, 900], price: [[480, 200], [900, 375]], included: ALL_VOICE, // 8-15 min (the Long Form page), ~25 credits a minute
    tier: "paid", worksInClaude: false, sort: 1, badge: null,
  },
].map((s) => Object.freeze(s)));

// ---------------------------------------------------------------- helpers (the only logic over the rows)
/** the card shape follows the template: 16:9 for wide (Long Form) templates, 9:16 for everything else */
export const isWide = (style) => style?.formats?.[0] === "16:9";
export const styleById = (id) => STYLES.find((s) => s.id === id) ?? null;
export const studioById = (id) => STUDIOS.find((s) => s.id === id) ?? null;
/** one version of a style (null when the style has none or the id isn't one of them) */
export const variantOf = (style, id) => (style?.variants ?? []).find((v) => v.id === id) ?? null;
/** every video of a style for the card + popup: the preview first, then the examples (no repeats) */
export const videosOf = (style) => [style?.preview ? { src: style.preview, poster: style.poster } : null, ...(style?.examples ?? [])]
  .filter(Boolean).filter((v, i, a) => a.findIndex((x) => x.src === v.src) === i);
export const stylesInStudio = (studioId) => STYLES.filter((s) => s.studios.includes(studioId)).sort((a, b) => a.sort - b.sort);
/** visible to this viewer: `visibleGates` = the set of gated template ids that are on for them */
export const visibleStyles = (styles, visibleGates) => styles.filter((s) => !s.gate || visibleGates.has(s.gate));

/** credits for `seconds` from the style's price points (linear between points, flat outside them; rounded up) */
export function creditsFor(style, seconds) {
  const pts = [...(style?.price ?? [])].sort((a, b) => a[0] - b[0]);
  if (!pts.length) return null;
  const s = Number(seconds) || pts[0][0];
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [s0, c0] = pts[i - 1], [s1, c1] = pts[i];
    if (s <= s1) return Math.ceil(c0 + ((c1 - c0) * (s - s0)) / (s1 - s0));
  }
  // past the last point: grow at the last segment's rate (or stay flat with one point)
  if (pts.length === 1) return pts[0][1];
  const [s0, c0] = pts.at(-2), [s1, c1] = pts.at(-1);
  return Math.ceil(c1 + ((c1 - c0) * (s - s1)) / (s1 - s0));
}

/** the nearest length the style can render (the prompt bar snaps to it) */
export function snapLength(style, seconds) {
  const ls = style?.lengths?.length ? style.lengths : [30];
  return ls.reduce((best, l) => (Math.abs(l - seconds) < Math.abs(best - seconds) ? l : best), ls[0]);
}

/** what the connector's list_styles / get_style show (no paths into our site internals) */
export function publicStyle(s) {
  return { style_id: s.id, name: s.name, category: s.category, studios: s.studios, direction: s.direction, hook_formula: s.hook, example_ideas: s.ideas, tier: s.tier, works_in_claude: s.worksInClaude, formats: s.formats, lengths_sec: s.lengths, default_voice: s.voice };
}

// every row is checked once at load (a typo in a new row fails the tests, never the page)
export function registryProblems() {
  const out = [], ids = new Set(), studioIds = new Set(STUDIOS.map((s) => s.id)), cats = new Set(CATEGORIES.map((c) => c.id));
  for (const s of STYLES) {
    if (!/^[a-z0-9-]{2,40}$/.test(s.id)) out.push(`${s.id}: bad id`);
    if (ids.has(s.id)) out.push(`${s.id}: duplicate id`); ids.add(s.id);
    if (!cats.has(s.category)) out.push(`${s.id}: unknown category ${s.category}`);
    if (!s.studios?.length || s.studios.some((x) => !studioIds.has(x))) out.push(`${s.id}: unknown studio`);
    if (!s.name || !s.direction || !s.hook || s.ideas?.length !== 3 || !s.examplePrompt) out.push(`${s.id}: missing words`);
    if (!s.engine?.path || !["cutaway-topic", "fruit-stash", "town-stash", "prompt-stash"].includes(s.engine.handoff)) out.push(`${s.id}: bad engine`);
    if (!["topic", "script", "scenes"].includes(s.inputKind)) out.push(`${s.id}: bad inputKind`);
    if (!s.formats?.length || !s.lengths?.length || !s.price?.length) out.push(`${s.id}: formats/lengths/price`);
    if (!["free", "paid"].includes(s.tier)) out.push(`${s.id}: bad tier`);
    if (s.worksInClaude && !s.claude?.honest) out.push(`${s.id}: works in Claude without the honest line`);
    const vids = new Set();
    for (const v of s.variants ?? []) {
      if (!/^[a-z0-9-]{2,30}$/.test(v.id) || vids.has(v.id)) out.push(`${s.id}: bad or duplicate variant ${v.id}`);
      vids.add(v.id);
      if (!v.name || !v.poster || !v.direction || (v.ideas && v.ideas.length !== 3)) out.push(`${s.id}/${v.id}: variant missing name, poster, direction or 3 ideas`);
    }
  }
  return out;
}
