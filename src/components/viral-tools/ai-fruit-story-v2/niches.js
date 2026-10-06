// The templates this story builder serves. One UI and one engine; a niche is
// everything a user would tell apart: the name, the library, the ideas, the
// series and recent creations, the price rows, the example video.
//
// AI Fruit Story is the default wherever no niche is passed. Blocky Stories
// is its own template (own route, own menu entries, own library): a user never
// sees one template's characters, ideas, series or recent creations inside
// the other. The server filters every list by niche
// (supabase/functions/_shared/fruit/niches/).
import { createContext, useContext } from "react";
import { EXAMPLE_VIDEO } from "./constants";
import { BLOCKY_STORIES_FLAG, BLOCKY_STORIES_NAME, BLOCKY_STORIES_PATH } from "../../../data/blockyStories";

export const FRUIT_NICHE = Object.freeze({
  id: "fruit",
  name: "AI Fruit Story",
  tagline: "Messy fruit drama, made in minutes",
  hero: ["Messy fruit drama.", "Made in minutes."],
  path: "/workspace/ai-fruit-story",
  flag: "fruit_v2",
  /** The price rows: image:<priceKey> and video:<priceKey>-v2/v3/v4. */
  priceKey: "fruit-story",
  aspects: ["9:16", "16:9"],
  example: EXAMPLE_VIDEO,
  /** "Make this video" on the public pages hands a prompt over (src/lib/promptHandoff.js). */
  promptHandoff: true,
  /** Recent also lists stories from the first AI Fruit Story, read-only. */
  legacyRecent: true,
  fileName: "fruit-story",
});

export const BLOCKY_NICHE = Object.freeze({
  id: "blocky",
  name: BLOCKY_STORIES_NAME,
  tagline: "Blocky avatar stories, made in minutes",
  hero: ["Blocky stories that talk.", "Made in minutes."],
  path: BLOCKY_STORIES_PATH,
  /** Hidden until launch: the route, the menus and the API all need this flag. */
  flag: BLOCKY_STORIES_FLAG,
  priceKey: "blocky-story",
  aspects: ["9:16"],
  example: null,
  promptHandoff: false,
  legacyRecent: false,
  fileName: "blocky-story",
});

/**
 * What a request tells the server: nothing for Fruit (its requests are the
 * same as before there were templates), the niche id for any other template.
 */
export const apiNiche = (niche) => (niche && niche.id !== FRUIT_NICHE.id ? niche.id : undefined);

export const NicheContext = createContext(FRUIT_NICHE);
/** The template the page is showing. */
export const useNiche = () => useContext(NicheContext);
