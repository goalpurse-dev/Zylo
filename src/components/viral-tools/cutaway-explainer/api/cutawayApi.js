// Cutaway Explainer, 3D version (research/seamless-niche/BUILD_PLAN.md, option A): a planner writes the script and a
// scene, the 3D world is animated on the words and rendered, then voice, captions and sound are mixed in.
// Until the planner (M2) and the render service (M3) exist, the page runs a DEMO: it walks through the same steps
// and plays the hand-built landfill video. Nothing is charged in the demo.

export const LENGTHS = [30, 60];
export const DEFAULT_LENGTH = 30;
export const DEMO_MODE = true;

// Provisional credit prices: about 3x the estimated real cost (~$0.45 / ~$0.75 per 30 / 60 s video, BUILD_PLAN M4).
// The real prices will come from public.tool_prices when the 3D pipeline goes live.
export const CREDITS = { 30: 48, 60: 80 };

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
export const DEMO_STEP_MS = { script: 2200, scene: 2200, render: 4200 };

// Our own two finished videos (with the end card), shown in Recent Creations, labelled "Example", until the viewer
// has made a video of their own. They open like a finished run and play on tap.
export const EXAMPLES = Object.freeze([
  { id: "example-french-drain", topic: "French drain", title: "How a French drain works", lengthSec: 40, finalUrl: "/cutaway-explainer/example-french-drain.mp4", poster: "/cutaway-explainer/example-french-drain.jpg", narration: FRENCH_DRAIN_NARRATION },
  { id: "example-landfill", topic: "Landfill", title: DEMO_TITLE, lengthSec: 39, finalUrl: DEMO_VIDEO, poster: "/cutaway-explainer/example-landfill.jpg", narration: DEMO_NARRATION },
].map((e) => Object.freeze({ ...e, step: "done", renderPct: 100, soundEffects: true, endCard: true, example: true })));

/** Recent Creations: the viewer's own videos, or the two examples while they have none. */
export function recentOrExamples(recent = []) {
  return recent.length ? recent : EXAMPLES;
}

export function newDemoRun(topic, lengthSec, soundEffects, endCard = true) {
  return {
    id: `demo-${Date.now()}`,
    topic,
    title: DEMO_TITLE,
    lengthSec,
    soundEffects,
    endCard,
    step: "script",
    renderPct: 0,
    narration: DEMO_NARRATION,
    finalUrl: null,
    demo: true,
    createdAt: new Date().toISOString(),
  };
}
