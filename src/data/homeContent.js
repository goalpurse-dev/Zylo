// Home and navigation settings you can edit without touching the page code.

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
