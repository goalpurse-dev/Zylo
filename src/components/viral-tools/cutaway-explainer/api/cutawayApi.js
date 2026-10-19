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

export const DEMO_VIDEO = "/cutaway-explainer/demo-landfill.mp4";
export const DEMO_TITLE = "How a landfill works";
export const DEMO_NARRATION = "If you dig a pit and throw your trash in, you have a landfill. But dirty trash juice leaks straight down into the groundwater you drink. So you lay a thick clay base, but it is still not enough. You add a thick black plastic sheet. This is a landfill liner.";

// How long each demo step shows (ms): roughly the order of the real steps, much shorter.
export const DEMO_STEP_MS = { script: 2200, scene: 2200, render: 4200 };

export function newDemoRun(topic, lengthSec, soundEffects) {
  return {
    id: `demo-${Date.now()}`,
    topic,
    title: DEMO_TITLE,
    lengthSec,
    soundEffects,
    step: "script",
    renderPct: 0,
    narration: DEMO_NARRATION,
    finalUrl: null,
    demo: true,
    createdAt: new Date().toISOString(),
  };
}
