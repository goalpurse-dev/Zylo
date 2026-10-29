// Cutaway Explainer, 3D version (research/seamless-niche/BUILD_PLAN.md, option A): a planner writes the script and a
// scene, the 3D world is animated on the words and rendered, then voice, captions and sound are mixed in.
//
// Where a run comes from (useCutawayRun picks one):
//  - "server": the cutaway-api edge function (every preview and production build). The contract, the RunView shape
//    and the error codes live in supabase/functions/_shared/cutaway/contract.js; cutawayCall() below speaks it.
//  - "local":  localhost only (VITE_CUTAWAY_LOCAL=1): the M2 runner on this computer through the /m2api proxy.
//  - "mock":   local dev only (?mock=...): the timed demo below and the mock RunViews of dev/cutawayMock.js.
//    Nothing is charged; a production build never reaches it (import.meta.env.DEV is false there).

export const LENGTHS = [30, 60];
export const DEFAULT_LENGTH = 30;

// ---------- the server (cutaway-api) ----------
import { ERRORS, FAILED_MESSAGE, STATUSES } from "../../../../../supabase/functions/_shared/cutaway/contract.js";
export { ERRORS, FAILED_MESSAGE, STATUSES };

/** A run is still being made (the page polls `status` while this is true). */
/** a video's real length in seconds (the finished file's, else the length asked for): a "30 s" video runs ~36 s */
export const realSeconds = (run) => Math.round(Number(run?.durationSec) || Number(run?.lengthSec) || 0);
/** "0:36" */
export const clockLength = (run) => { const s = realSeconds(run); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

export const isWorking = (run) => Boolean(run) && ["queued", "script", "scene", "render"].includes(run.step);

/** An error from cutaway-api, with the contract's code and the extras some codes carry. */
export class CutawayApiError extends Error {
  constructor(code, message, extra = {}) {
    super(message || ERRORS[code]?.message || ERRORS.SERVER.message);
    this.name = "CutawayApiError";
    this.code = code;
    this.status = extra.status ?? ERRORS[code]?.status ?? 0;
    this.credits = Number.isFinite(extra.credits) ? extra.credits : null; // CREDITS: what the video needs
    this.missing = Array.isArray(extra.missing) ? extra.missing : []; // CANT_BUILD
    this.closest = Array.isArray(extra.closest) ? extra.closest : []; // CANT_BUILD: premade keys or names
    this.retryAfterSec = Number.isFinite(extra.retryAfterSec) ? extra.retryAfterSec : null; // LIMIT
    this.debug = extra.debug && typeof extra.debug === "object" ? extra.debug : null; // the owner only: {step, code, message}
  }
}

// A reply without a code (an older function, a gateway error): the code from the status and the words.
function codeFrom(status, message = "") {
  if (status === 401) return "SIGN_IN";
  if (status === 402) return /paid plan|upgrade/i.test(message) ? "UPGRADE" : "CREDITS";
  if (status === 403) return "OFF";
  if (status === 404) return "NOT_FOUND";
  if (status === 422) return "CANT_BUILD";
  if (status === 429) return "LIMIT";
  if (status === 503) return "BUSY";
  if (status === 400) return "BAD_INPUT";
  return "SERVER";
}

/** Turns a cutaway-api error body (and its HTTP status) into a CutawayApiError. */
export function errorFromReply(body, status = 0) {
  const message = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : "";
  const code = typeof body?.code === "string" && ERRORS[body.code] ? body.code : codeFrom(status, message);
  const credits = Number(body?.credits ?? body?.needed);
  return new CutawayApiError(code, message || ERRORS[code].message, { status, credits, missing: body?.missing ?? body?.quote?.missing, closest: body?.closest ?? body?.quote?.closest, retryAfterSec: Number(body?.retryAfterSec), debug: body?.debug });
}

/**
 * One cutaway-api action through the app's supabase client (it sends the session). Throws CutawayApiError.
 * The client is imported lazily, so this file still loads in Node (tests import the examples from it).
 */
export async function cutawayCall(action, body = {}) {
  const { supabase } = await import("../../../../lib/supabaseClient");
  let data, error;
  try {
    ({ data, error } = await supabase.functions.invoke("cutaway-api", { body: { action, ...body } }));
  } catch {
    throw new CutawayApiError("NETWORK", "We couldn't reach the server. Check your connection and try again.");
  }
  if (error) {
    const res = error.context;
    if (res && typeof res.clone === "function") {
      const parsed = await res.clone().json().catch(() => null);
      throw errorFromReply(parsed ?? {}, res.status ?? 0);
    }
    throw new CutawayApiError("NETWORK", "We couldn't reach the server. Check your connection and try again.");
  }
  // an older reply shape: "can't build" as a 200 with cantBuild (nothing charged)
  if (data?.cantBuild) throw errorFromReply({ code: "CANT_BUILD", error: data.message, quote: data.quote }, 422);
  if (data?.error && data?.code) throw errorFromReply(data, ERRORS[data.code]?.status ?? 0);
  return data;
}

/** A RunView from the server, in the shape the page renders (`step` mirrors `status`; lists never missing). */
export function toRun(view) {
  if (!view || typeof view !== "object") return null;
  const step = STATUSES.includes(view.status) ? view.status : STATUSES.includes(view.step) ? view.step : "queued";
  return {
    ...view,
    step,
    status: step,
    parts: Array.isArray(view.parts) ? view.parts : [],
    frames: Array.isArray(view.frames) ? view.frames : [],
    facts: Array.isArray(view.facts) ? view.facts : [],
    renderPct: Number.isFinite(view.renderPct) ? view.renderPct : step === "done" ? 100 : 0,
    stepAt: Number.isFinite(view.stepAt) ? view.stepAt : Date.parse(view.stepAt ?? "") || null,
    refunded: view.refunded === true || view.creditsRefunded === true,
    server: true,
  };
}

/** The owner's test levers from the address bar (the server honours them only for test users). */
function ownerLevers() {
  if (typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  return { ...(q.get("testfail") === "1" ? { testFail: true } : {}), ...(q.get("dryrun") === "1" ? { dryRun: true } : {}) };
}

export const cutawayServer = {
  access: () => cutawayCall("access"),
  quote: (topic, lengthSec) => cutawayCall("quote", { topic, lengthSec }).then((r) => r?.quote ?? null),
  // ?testfail=1: the owner's forced failure (the server honours it only for test users while the switch is off)
  // ?dryrun=1: every start check (kit check, caps, price) and then a stop before anything is charged or created
  start: ({ topic, lengthSec, removeWatermark }) => cutawayCall("start", { topic, lengthSec, removeWatermark: removeWatermark === true, ...ownerLevers() }).then((data) => {
    if (data?.dryRun) throw new CutawayApiError("DRY_RUN", `Dry run: every check passed. This would cost ${data.credits} credits (${data.quote?.kind}). Nothing was started.`, { debug: { step: "dry run", code: "OK", message: JSON.stringify(data) } });
    return toRun(data);
  }),
  status: (runId) => cutawayCall("status", { runId }).then(toRun),
  list: () => cutawayCall("list").then((r) => (Array.isArray(r?.runs) ? r.runs.map(toRun).filter(Boolean) : [])),
  remove: (runId) => cutawayCall("remove", { runId }),
  approveLayout: (runId, approve) => cutawayCall("approveLayout", { runId, approve: approve === true }),
};

/** The post text the "Copy post text" button puts on the clipboard: title, description, hashtags. */
export function postText(post) {
  if (!post) return "";
  return [post.title, post.description, (post.hashtags ?? []).join(" ")].filter((s) => String(s ?? "").trim()).join("\n\n");
}

/** A file name for a download that has no server name (examples, the local runner). */
export const downloadName = (run) => `${String(run?.title || run?.topic || "cutaway-explainer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cutaway-explainer"}.mp4`;

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
