const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BG_BASE = `${SUPABASE_URL}/storage/v1/object/public/public-assets`;

/*
  Categories that actually have WEBP versions.
  If category is not listed here → it uses PNG only.
*/
const WEBP_CATEGORIES = [
  "indoor",

  // ❌ nature NOT included
];

function makeCategory(category, count, labelPrefix) {
  const hasWebp = WEBP_CATEGORIES.includes(category);

  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const padded = String(index).padStart(2, "0");

    const basePath = `${BG_BASE}/products/${category}/${category}-${padded}`;

    return {
      id: `${category}-${padded}`,
      label: `${labelPrefix} ${index}`,
      category,
      index_in_category: index,

      // If webp exists → use it
      webp: hasWebp ? `${basePath}.webp` : null,

      // Always have png
      png: `${basePath}.png`,
    };
  });
}

export const BACKGROUND_PRESETS = [
  ...makeCategory("indoor", 21, "Indoor"),
  ...makeCategory("nature", 21, "Nature"), // PNG only
  ...makeCategory("outdoor", 21, "Outdoor"),
  ...makeCategory("plain", 21, "Plain"),
  ...makeCategory("soft", 21, "Soft"),
  ...makeCategory("stone", 21, "Stone"),
  ...makeCategory("studio", 21, "Studio"),
  ...makeCategory("wood", 21, "Wood"),
  ...makeCategory("workspace", 21, "Workspace"),
  ...makeCategory("toppicks", 21, "Toppicks"),
];
