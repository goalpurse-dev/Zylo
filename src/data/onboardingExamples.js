// THE EXAMPLE VIDEOS OF THE NEW-USER TUTORIAL (/welcome/first-video). Edit this list to swap them: nothing else to change.
//
// The tutorial shows three of these as cards ("Pick an idea"), the best match first, plays the picked one in full with the
// label "Example made with Zyvo", then the plans ("Make your own like this"). Nothing is generated for the user.
//
// Each example:
//   key       a short unique id (letters and _). Used in the funnel numbers, so don't rename one that has been live.
//   title     what the card and the plans screen call it
//   niche     one line under the title on the plans screen
//   video     the full example video: a vertical (9:16) mp4 with sound, under /public (or a full https address)
//   poster    a still of it (jpg/webp), shown while the video loads
//   loop      optional: a short silent clip for the card; without one, the card plays the start of `video`, muted
//   goals     which survey answers it suits ("What do you want to make?"): faceless, longform, business, exploring
//   makeLink  where "make one like this" leads once they have a plan
//   credits   what one video like it costs, for "about N videos like this one" on the plans screen
//
// Videos must be OUR OWN renders: they are labelled "made with Zyvo".
import { CUTAWAY_PATH } from "./cutawayExplainer.js";
import { IN_THIS_TOWN_PATH, IN_THIS_TOWN_PRICE } from "./inThisTownLanding.js";

const CUTAWAY_30S_CREDITS = 25; // a premade 30 s Cutaway (cutawayApi PRICES.video.credits.premade[30])

export const ONBOARDING_EXAMPLES = [
  {
    key: "town_milo",
    title: "Milo, the most ticklish kid in town",
    niche: "In This Town: a narrated 3D story Short",
    video: "/in-this-town/stories/milo.mp4",
    poster: "/in-this-town/stories/milo.webp",
    loop: "/in-this-town/clips/milo-a.mp4",
    goals: ["faceless", "exploring"],
    makeLink: IN_THIS_TOWN_PATH,
    credits: IN_THIS_TOWN_PRICE.credits,
  },
  {
    key: "town_plane",
    title: "The town inside a plane",
    niche: "In This Town: a narrated 3D story Short",
    video: "/in-this-town/stories/plane.mp4",
    poster: "/in-this-town/stories/plane.webp",
    loop: "/in-this-town/clips/plane-a.mp4",
    goals: ["faceless", "longform"],
    makeLink: IN_THIS_TOWN_PATH,
    credits: IN_THIS_TOWN_PRICE.credits,
  },
  {
    key: "town_tower",
    title: "The coin tower",
    niche: "In This Town: a narrated 3D story Short",
    video: "/in-this-town/stories/tower.mp4",
    poster: "/in-this-town/stories/tower.webp",
    loop: "/in-this-town/clips/tower-a.mp4",
    goals: ["faceless"],
    makeLink: IN_THIS_TOWN_PATH,
    credits: IN_THIS_TOWN_PRICE.credits,
  },
  {
    key: "cutaway_landfill",
    title: "How a landfill works",
    niche: "Cutaway Explainer: a 3D how-it-works video",
    video: "/cutaway-explainer/demo-landfill-clean.mp4",
    poster: "/onboarding/demo/landfill.jpg",
    goals: ["longform", "exploring", "faceless"],
    makeLink: `${CUTAWAY_PATH}?topic=Landfill`,
    credits: CUTAWAY_30S_CREDITS,
  },
  {
    key: "cutaway_french_drain",
    title: "How a French drain works",
    niche: "Cutaway Explainer: a 3D how-it-works video",
    video: "/cutaway-explainer/example-french-drain-clean.mp4",
    poster: "/onboarding/demo/french_drain.jpg",
    goals: ["business", "longform"],
    makeLink: `${CUTAWAY_PATH}?topic=French%20drain`,
    credits: CUTAWAY_30S_CREDITS,
  },
];

// When the survey was skipped or nothing matches: these, in this order.
export const DEFAULT_EXAMPLES = ["town_milo", "cutaway_landfill", "cutaway_french_drain"];

// How many cards the tutorial shows.
export const EXAMPLE_CARDS = 3;
