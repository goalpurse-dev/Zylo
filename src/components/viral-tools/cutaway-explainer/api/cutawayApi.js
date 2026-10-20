// Cutaway Explainer, 3D version (research/seamless-niche/BUILD_PLAN.md, option A): a planner writes the script and a
// scene, the 3D world is animated on the words and rendered, then voice, captions and sound are mixed in.
// Until the planner (M2) and the render service (M3) exist, the page runs a DEMO: it walks through the same steps
// and plays the hand-built landfill video. Nothing is charged in the demo.

export const LENGTHS = [30, 60];
export const DEFAULT_LENGTH = 30;
export const DEMO_MODE = true;

// Two prices per length, premade or custom topic (pricing.js PRICES.video, ~2.8x our cost). The page shows them live
// from the same rule the server charges by (quote.js): the server recomputes the quote from the topic text before
// charging, so nothing the page shows or sends can change the price.
export { quoteTopic, closestNames } from "../../../../../supabase/functions/_shared/cutaway/quote.js";
import { classifyTopic } from "../../../../../supabase/functions/_shared/cutaway/topics.js";
export { PRICES } from "../../../../../supabase/functions/_shared/cutaway/pricing.js";

export const STEPS = [
  ["script", "Script"],
  ["scene", "Scene"],
  ["render", "Render"],
  ["done", "Done"],
];

// The landfill demo in two versions: with the Zyvo end card (every plan below Pro) and without it.
export const DEMO_VIDEO = "/cutaway-explainer/demo-landfill.mp4";
export const DEMO_VIDEO_CLEAN = "/cutaway-explainer/demo-landfill-clean.mp4";
export const FRENCH_DRAIN_NARRATION = "If you dig a ditch along your house, you have a drain. But one inch of rain on a small roof dumps over 600 gallons right by your walls. The ditch floods. Five feet down, that water pushes over 300 pounds on each square foot, and the wall cracks. So you fill the ditch with gravel, but the water still sits at the bottom. So you lay a pipe full of holes under the gravel. This is a French drain. Water seeps in through the holes, and the pipe slopes downhill to carry it away. Wrap the gravel in fabric so mud can't clog it. And the French in French drain is not France. It is Henry French, a New England farmer and judge who wrote the book on drains in 1859. Add the grass back on top. Congratulations, you have built a French drain.";
// Loading backdrops: heavily blurred frames from OUR OWN demo renders (never other users' videos).
export const LOADING_FRAMES = [1, 2, 3, 4, 5, 6].map((n) => `/cutaway-explainer/loading/${n}.jpg`);

// The end card rule itself lives with the server (it decides at render time from profiles.plan_code);
// the page only uses it to show the "Remove watermark" toggle as locked or unlocked.
export { canRemoveEndCard, endCardFor } from "../../../../../supabase/functions/_shared/cutaway/endCard.js";
// Who may generate: the same rule the server enforces on every action.
export { accessFor, canGenerate } from "../../../../../supabase/functions/_shared/cutaway/access.js";
export const DEMO_TITLE = "How a landfill works";
export const DEMO_NARRATION = "If you dig a pit and throw your trash in, you have a landfill. But dirty trash juice leaks straight down into the groundwater you drink. So you lay a thick clay base, but it is still not enough. You add a thick black plastic sheet. This is a landfill liner. A pipe drains the collected juice into a tank beside the pit. Sealed this tight, trash barely rots at all once it is buried. A 1952 newspaper dug up decades later was still readable word for word. But trapped trash still makes gas, so a pipe carries it out. That flame is not waste burning, it is gas making electricity nearby. Add a grass cap, a fence, and a few young trees. Congratulations, you have built a landfill.";

// How long each demo step shows (ms): roughly the order of the real steps, much shorter.
export const DEMO_STEP_MS = { script: 3600, scene: 2800, render: 6000 };

// What a finished video carries besides the file (the real pipeline fills these from its plan and fact-check):
//  post: a ready title, description and hashtags for TikTok / Shorts / Reels;
//  facts: the surprises it states, each with its sources (shown as "Fact-checked");
//  parts: the kit parts the scene used (they pop in as chips while the scene is built);
//  frames: low-res frames of the render (shown as they come in while it renders).
const frames = (name) => [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `/cutaway-explainer/frames/${name}/${n}.jpg`);
const META = {
  french_drain: {
    post: {
      title: "How a French drain actually works 🌧️",
      description: "One inch of rain on a small roof is over 600 gallons, and it all ends up by your walls. Here's how a ditch, gravel and a pipe full of holes keep a basement dry, in one continuous 3D shot. And no, it's not from France.",
      hashtags: ["#frenchdrain", "#howitworks", "#diy", "#homeimprovement", "#drainage", "#3danimation", "#explained", "#shorts"],
    },
    facts: [
      { claim: "One inch of rain on a 1,000 sq ft roof is about 623 gallons", sources: [{ label: "Texas A&M AgriLife", url: "https://agrilifetoday.tamu.edu/?p=313689" }, { label: "USGS", url: "https://pubs.usgs.gov/circ/2004/circ1268/htdocs/text-conversion.html" }] },
      { claim: "Five feet down, still water pushes about 312 lb on each square foot of wall (62.4 lb/cu ft × 5 ft)", sources: [{ label: "USGS", url: "https://pubs.usgs.gov/circ/2004/circ1268/htdocs/text-conversion.html" }] },
      { claim: "It's named after Judge Henry Flagg French and his 1859 book Farm Drainage, not after France", sources: [{ label: "Landscape Architect", url: "https://landscapearchitect.com/landscape-articles/french-drains-and-their-modern-successors" }, { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Henry_Flagg_French" }, { label: "Project Gutenberg", url: "https://gutenberg.org/files/23435/23435-h/23435-h.htm" }] },
    ],
    parts: ["Trench", "Rain", "Foundation", "Gravel", "Perforated pipe", "Outlet pipe", "Soak pit", "Filter fabric", "Grass cap"],
    frames: frames("french-drain"),
  },
  landfill: {
    post: {
      title: "What's really inside a landfill 🗑️",
      description: "Trash barely rots once it's sealed in: a 1952 newspaper came out still readable decades later. Watch a landfill get built layer by layer, from the clay base to the gas flare, in one continuous 3D shot.",
      hashtags: ["#landfill", "#howitworks", "#trash", "#recycling", "#engineering", "#3danimation", "#explained", "#shorts"],
    },
    facts: [
      { claim: "Sealed landfills barely rot: a 1952 newspaper dug up in 1989 was still readable", sources: [{ label: "Christian Science Monitor", url: "https://www.csmonitor.com/1992/1208/08131.html" }, { label: "Alaska Science Forum", url: "https://www.gi.alaska.edu/alaska-science-forum/trash-triumphant" }] },
      { claim: "About 490 US landfills feed their gas to energy projects (EPA LMOP, 2024)", sources: [{ label: "EPA LMOP database", url: "https://dss.princeton.edu/catalog/resource8447" }] },
    ],
    parts: ["Pit", "Dump truck", "Clay base", "Liner", "Drain pipe", "Tank", "Trash layers", "Gas pipe", "Flare", "Generator", "Grass cap"],
    frames: frames("landfill"),
  },
};

// Our own two finished videos (with the end card), shown in Recent Creations, labelled "Example", until the viewer
// has made a video of their own. They open like a finished run and play on tap.
export const EXAMPLES = Object.freeze([
  { id: "example-french-drain", key: "french_drain", topic: "French drain", title: "How a French drain works", lengthSec: 40, finalUrl: "/cutaway-explainer/example-french-drain.mp4", poster: "/cutaway-explainer/example-french-drain.jpg", narration: FRENCH_DRAIN_NARRATION },
  { id: "example-landfill", key: "landfill", topic: "Landfill", title: DEMO_TITLE, lengthSec: 39, finalUrl: DEMO_VIDEO, poster: "/cutaway-explainer/example-landfill.jpg", narration: DEMO_NARRATION },
].map((e) => Object.freeze({ ...e, ...META[e.key], step: "done", renderPct: 100, soundEffects: true, endCard: true, example: true })));

/** Recent Creations: the viewer's own videos, or the two examples while they have none. */
export function recentOrExamples(recent = []) {
  return recent.length ? recent : EXAMPLES;
}

// The demo plays the example closest to the typed topic: the French drain for a drain topic, else the landfill.
const DEMO_VIDEOS = {
  french_drain: { withCard: "/cutaway-explainer/example-french-drain.mp4", clean: "/cutaway-explainer/example-french-drain-clean.mp4" },
  landfill: { withCard: DEMO_VIDEO, clean: DEMO_VIDEO_CLEAN },
};
export function demoSourceFor(topic) {
  const key = classifyTopic(topic).premade === "french_drain" || /\bdrain/i.test(String(topic)) ? "french_drain" : "landfill";
  return EXAMPLES.find((e) => e.key === key);
}
export const demoVideoFor = (run) => (run.endCard === false ? DEMO_VIDEOS[run.demoKey].clean : DEMO_VIDEOS[run.demoKey].withCard);

export function newDemoRun(topic, lengthSec, soundEffects, endCard = true) {
  const src = demoSourceFor(topic);
  return {
    id: `demo-${Date.now()}`,
    topic,
    title: src.title,
    demoKey: src.key,
    lengthSec,
    soundEffects,
    endCard,
    step: "script",
    renderPct: 0,
    narration: src.narration,
    post: src.post,
    facts: src.facts,
    parts: src.parts,
    frames: src.frames,
    poster: src.poster,
    finalUrl: null,
    demo: true,
    createdAt: new Date().toISOString(),
  };
}
