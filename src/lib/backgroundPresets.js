const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BG_BASE = `${SUPABASE_URL}/storage/v1/object/public/public-assets`;

function makeCategory(category, count, labelPrefix) {
  return Array.from({ length: count }, (_, i) => {
    const index = i + 1;
    const padded = String(index).padStart(2, "0"); // 01, 02, 03

    return {
      id: `${category}-${padded}`,
      label: `${labelPrefix} ${index}`,
      category,
      index_in_category: index, // 🔑 PER-ROW CONTROL
      src: `${BG_BASE}/products/${category}/${category}-${padded}.png`,
    };
  });
}

export const BACKGROUND_PRESETS = [
  ...makeCategory("indoor", 21, "Indoor"),
  ...makeCategory("nature", 21, "Nature"),
  ...makeCategory("outdoor", 21, "Outdoor"),
  ...makeCategory("plain", 21, "Plain"),
  ...makeCategory("soft", 21, "Soft"),
  ...makeCategory("stone", 21, "Stone"),
  ...makeCategory("studio", 21, "Studio"),
  ...makeCategory("wood", 21, "Wood"),
  ...makeCategory("workspace", 21, "Workspace"),
  ...makeCategory("toppicks", 21, "Toppicks"),
];
