// Home and navigation settings you can edit without touching the page code.
import { BLOCKY_STORIES_NAME, BLOCKY_STORIES_PATH } from "./blockyStories.js";

// The previous Home (src/pages/workspace/home.jsx) stays available for one
// release: set to true to show it at "/" again. Delete the old
// page (and this flag) after that release.
export const USE_LEGACY_HOME = false;

// "Earn" in the sidebar (desktop + mobile drawer). The /workspace/earn page
// keeps working either way.
export const SHOW_EARN_IN_NAV = false;

// Hidden while their demo videos still show a real person, character or
// brand (the images were replaced): 30 Days (LEGO Ninjago clip), Face ASMR
// (celebrity face clips), Kit Swap (real player + sportswear logo clip).
// Remove a name here to show it again.
export const HIDDEN_TEMPLATES = ["30 Days", "Face ASMR", "Kit Swap"];
// Community: Face ASMR + Lego clips show IP; the Cartoon image looks like a
// famous animated film character.
export const HIDDEN_COMMUNITY_CATEGORIES = ["Face ASMR", "Lego", "Cartoon"];

// Short Form menu (sidebar panel + mobile sheet): tools hidden for now, by label.
export const HIDDEN_SHORT_FORM_TOOLS = ["30 Days"];

// The featured Short Form template under "short form suite" on Home. Change
// `name`/`path` and the examples (muted clips with a poster, or stills) to
// feature another template. Files live in the public "showcase" bucket.
const SHOWCASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/showcase`;
export const FEATURED_TEMPLATE = {
  name: "Cartoon Drive By",
  path: "/workspace/cartoon-drive-by",
  eyebrow: "Most viral templates",
  examples: [
    { video: `${SHOWCASE}/featured/cartoon-drive-by/ship.mp4`, poster: `${SHOWCASE}/featured/cartoon-drive-by/ship.webp` },
    { video: `${SHOWCASE}/featured/cartoon-drive-by/gas-station.mp4`, poster: `${SHOWCASE}/featured/cartoon-drive-by/gas-station.webp` }, // brand-like sign blurred out
    { image: `${SHOWCASE}/featured/cartoon-drive-by/plane-window-v2.webp` },
    { video: `${SHOWCASE}/featured/cartoon-drive-by/seashell-village.mp4`, poster: `${SHOWCASE}/featured/cartoon-drive-by/seashell-village.webp` }, // made with the template itself (V2)
  ],
};

// Blocky Stories on Home: its own section right above the featured template, built by the same component,
// and one card at the front of the "short form suite" row. Both show ONLY while Blocky is switched on for
// everyone (the global blocky_v1 switch; an account's own switch doesn't count on Home), so nothing of it
// is on the live site before launch. The four clips are cut from the owner's own test videos, without
// sound, and none carries a video model's own subtitles (scripts/blocky/publishShowcase.mjs).
const BLOCKY_SHOWCASE = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/generated/blocky/showcase`;
export const BLOCKY_TEMPLATE = {
  name: BLOCKY_STORIES_NAME,
  path: BLOCKY_STORIES_PATH,
  eyebrow: "New template",
  examples: ["home-no-hats-1", "home-fake-admin", "home-no-hats-2", "home-no-hats-3"].map((id) => ({ video: `${BLOCKY_SHOWCASE}/${id}.mp4`, poster: `${BLOCKY_SHOWCASE}/${id}.jpg` })),
  // The card in the "short form suite" row. NEW for 30 days from addedAt, like every card there.
  suite: { desc: "Blocky avatars act out your story, and talk", image: "/templates/BLOCKY/thumbnail-home.webp", addedAt: "2026-10-09" },
};
