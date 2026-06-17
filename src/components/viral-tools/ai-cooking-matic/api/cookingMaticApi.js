import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple } from "../../../../lib/jobs";

// ── Constants ─────────────────────────────────────────────────────────────────
export const IMAGE_TOOL_KEY  = "image:fruit-v2";
export const IMAGE_CREDITS   = 2;
export const SCENE_COUNT     = 10;
export const TOTAL_CREDITS   = SCENE_COUNT * IMAGE_CREDITS; // 20
export const IMAGE_W         = 896;
export const IMAGE_H         = 1152;

// ── Vibes ─────────────────────────────────────────────────────────────────────
export const VIBES = [
  {
    id: "dark-moody",
    label: "Dark & Moody",
    desc: "Dramatic restaurant lighting",
    accent: "#7A3BFF",
    dot: "#5b21b6",
    token: "dark and moody restaurant atmosphere, dramatic chiaroscuro lighting, deep black shadows, rich jewel-tone color grade, moody cinematic feel",
  },
  {
    id: "golden-hour",
    label: "Warm Golden",
    desc: "Rich amber tones",
    accent: "#F59E0B",
    dot: "#b45309",
    token: "warm golden hour lighting, rich amber highlights, honey-toned color grade, warm and inviting restaurant glow",
  },
  {
    id: "minimal-white",
    label: "Clean Minimal",
    desc: "Bright studio white",
    accent: "#CBD5E1",
    dot: "#94a3b8",
    token: "clean minimal white studio background, bright even lighting, crisp soft shadows, airy and fresh Scandinavian color grade",
  },
  {
    id: "rustic-fire",
    label: "Rustic Fire",
    desc: "Firelight & dark wood",
    accent: "#EA580C",
    dot: "#9a3412",
    token: "rustic wood fire ambiance, warm flickering firelight, aged dark wood surfaces, artisan earthy orange-toned color grade",
  },
  {
    id: "neon-modern",
    label: "Neon Modern",
    desc: "Purple & teal accents",
    accent: "#06B6D4",
    dot: "#0e7490",
    token: "ultra-modern kitchen, purple and teal neon accent rim lights, dark polished obsidian surfaces, cyberpunk editorial food photography",
  },
];

// ── Scene labels ──────────────────────────────────────────────────────────────
export const SCENE_LABELS = [
  "Chef Intro",
  "Raw Ingredient",
  "Prep & Season",
  "Coating Action",
  "Into the Oil",
  "Overhead Fry",
  "Wok Toss",
  "Beauty Plate",
  "Chef Presents",
  "Hero Shot",
];

// ── Prompt templates (called with (dish, ingredient, vibeToken)) ───────────────
export const SCENE_TEMPLATES = [
  // 0 — Chef Introduction
  (dish, ingredient, vibe) =>
    `3D animated cartoon Black male chef character standing confidently in a cinematic modern professional kitchen, direct warm smile at camera, pristine white chef coat and tall white toque hat, dramatic overhead spotlight, ${vibe}, Pixar Disney quality 3D render, full body wide shot, ultra-detailed, 8K, no text no watermark`,

  // 1 — Raw Ingredient Macro
  (dish, ingredient, vibe) =>
    `Extreme macro close-up of raw fresh ${ingredient} on a dark polished marble surface, hyper-realistic food photography, fine water droplets glistening, dramatic side rim lighting, ultra-sharp texture and grain detail, ${vibe}, 8K ultra-detailed, no hands no text`,

  // 2 — Flat Lay Prep
  (dish, ingredient, vibe) =>
    `Overhead flat lay of all fresh ingredients for ${dish} arranged in small white ceramic prep bowls on dark marble counter, chef's hands visible carefully seasoning with sea salt and ground pepper over a central glass mixing bowl, ${vibe}, dramatic top-down studio food photography, 8K`,

  // 3 — Coating Action
  (dish, ingredient, vibe) =>
    `Dynamic freeze-frame action shot of hands vigorously tossing ${ingredient} in golden seasoned flour inside a large dark mixing bowl, flour and paprika dust particles suspended mid-air, dramatic ${vibe}, motion blur on flying particles, cinematic food action photography, 8K`,

  // 4 — Into the Oil
  (dish, ingredient, vibe) =>
    `Dramatic macro shot of hand releasing battered ${ingredient} into shimmering hot golden oil in a dark cast-iron pan, oil droplets splashing upward in perfect freeze-frame, steam rising from the impact, very dark background, ${vibe}, cinematic food macro, 8K`,

  // 5 — Overhead Frying
  (dish, ingredient, vibe) =>
    `Overhead bird's-eye view straight down into a dark pan filled with ${ingredient} actively bubbling and crisping in hot golden oil, steam rising, perfectly golden surface texture, ${vibe} dramatic top-lighting, hero food photography, 8K`,

  // 6 — Wok Toss
  (dish, ingredient, vibe) =>
    `Dynamic cinematic action shot of a chef's arm in white uniform tossing finished ${dish} in a carbon steel wok over a roaring bright blue gas flame, food flying in a beautiful upward arc, dark professional kitchen background, wok hei steam and smoke, ${vibe}, 8K`,

  // 7 — Beauty Plating
  (dish, ingredient, vibe) =>
    `Cinematic close-up of ${dish} plated with precision on a dark matte ceramic plate, garnished with thinly sliced spring onions, red chili rings and toasted white sesame seeds, delicate wisps of steam curling upward, ${vibe} dramatic overhead spotlight, shallow depth of field bokeh, 8K food photography`,

  // 8 — Chef Presents (back-references Scene 1 chef)
  (dish, ingredient, vibe) =>
    `Same 3D animated cartoon Black male chef from Scene 1, now holding a dark ceramic plate of beautifully plated ${dish} forward toward camera with both hands, proud warm smile, pristine white chef coat, same ${vibe} dark cinematic kitchen background, Pixar Disney 3D render style, dramatic overhead lighting, 8K`,

  // 9 — Final Hero Shot (back-references Scene 7 beauty plate)
  (dish, ingredient, vibe) =>
    `Full frame cinematic hero shot of ${dish} on a dark ceramic plate, extreme detail on golden crispy crust and vibrant garnish, gentle wisps of steam, background completely blurred smooth bokeh, ${vibe} single dramatic spotlight from directly above, ultra-realistic high-end restaurant menu photography, 8K, no hands no text`,
];

// ── Dishes (110+) ─────────────────────────────────────────────────────────────
export const DISH_CATEGORIES = [
  {
    label: "Asian",
    dishes: [
      "Crispy Shrimp", "General Tso's Chicken", "Kung Pao Chicken",
      "Sesame Chicken", "Orange Chicken", "Sweet and Sour Pork",
      "Beef Stir Fry", "Pad Thai", "Chicken Fried Rice", "Teriyaki Salmon",
      "Miso Ramen", "Tonkotsu Ramen", "Chicken Katsu", "Wagyu Beef Donburi",
      "Yakitori Skewers", "Tempura Shrimp", "Gyoza Dumplings", "Takoyaki",
      "Beef Bulgogi", "Korean Fried Chicken", "Tteokbokki", "Bibimbap",
      "Chicken Tikka Masala", "Butter Chicken", "Lamb Biryani", "Palak Paneer",
      "Dan Dan Noodles", "Mapo Tofu", "Char Siu Pork", "Peking Duck",
    ],
  },
  {
    label: "American & BBQ",
    dishes: [
      "Beef Steak", "Smash Burger", "BBQ Baby Back Ribs", "Mac and Cheese",
      "Buffalo Wings", "Lobster Roll", "Philly Cheesesteak", "Southern Fried Chicken",
      "Pulled Pork Sandwich", "Beef Brisket", "Loaded Nachos",
      "Cajun Shrimp", "Nashville Hot Chicken", "Biscuits and Gravy",
    ],
  },
  {
    label: "Italian",
    dishes: [
      "Pasta Carbonara", "Spaghetti Bolognese", "Chicken Alfredo",
      "Margherita Pizza", "Lasagna", "Risotto Milanese", "Osso Buco",
      "Penne Arrabbiata", "Gnocchi with Pesto", "Tagliatelle with Truffles",
      "Cacio e Pepe", "Amatriciana Pasta",
    ],
  },
  {
    label: "Mexican",
    dishes: [
      "Beef Birria Tacos", "Carnitas", "Fish Tacos", "Chicken Enchiladas",
      "Carne Asada", "Street Corn Elotes", "Tamales",
      "Mole Chicken", "Chicken Quesadilla", "Pozole",
    ],
  },
  {
    label: "Seafood",
    dishes: [
      "Garlic Butter Shrimp", "Crispy Calamari", "Lobster Thermidor",
      "Pan-Seared Salmon", "Grilled Sea Bass", "Shrimp Scampi",
      "Crab Cakes", "Seared Scallops", "Crispy Fish and Chips",
      "Miso Black Cod", "Coconut Curry Shrimp",
    ],
  },
  {
    label: "Mediterranean",
    dishes: [
      "Lamb Shawarma", "Chicken Souvlaki", "Greek Moussaka", "Beef Kofta",
      "Falafel Bowl", "Grilled Octopus", "Paella Valenciana",
      "Moroccan Lamb Tagine", "Turkish Kebab", "Harissa Chicken",
    ],
  },
  {
    label: "French",
    dishes: [
      "Beef Bourguignon", "Coq au Vin", "Duck Confit",
      "Sole Meunière", "French Onion Soup", "Beef Tartare",
    ],
  },
  {
    label: "Fusion & Modern",
    dishes: [
      "Black Truffle Risotto", "Wagyu Beef Sliders", "Honey Garlic Salmon",
      "Kimchi Fried Rice", "Jerk Chicken", "Saffron Lobster Bisque",
      "Crispy Duck Confit", "Miso Glazed Eggplant", "Uni Pasta",
      "Smoked Salmon Eggs Benedict",
    ],
  },
];

export const ALL_DISHES = DISH_CATEGORIES.flatMap((c) => c.dishes);

// ── Ingredient extraction ──────────────────────────────────────────────────────
const INGREDIENT_MAP = {
  "crispy shrimp": "shrimp", "garlic butter shrimp": "shrimp",
  "shrimp scampi": "shrimp", "coconut curry shrimp": "shrimp",
  "cajun shrimp": "shrimp", "tempura shrimp": "shrimp",
  "general tso's chicken": "chicken", "kung pao chicken": "chicken",
  "sesame chicken": "chicken", "orange chicken": "chicken",
  "chicken fried rice": "chicken", "southern fried chicken": "chicken",
  "nashville hot chicken": "chicken", "buffalo wings": "chicken wings",
  "chicken tikka masala": "chicken thighs", "butter chicken": "chicken",
  "chicken katsu": "chicken breast", "yakitori skewers": "chicken",
  "chicken souvlaki": "chicken", "chicken enchiladas": "chicken",
  "mole chicken": "chicken", "chicken quesadilla": "chicken",
  "jerk chicken": "chicken", "harissa chicken": "chicken",
  "coq au vin": "chicken", "beef birria tacos": "beef chuck",
  "carne asada": "skirt steak", "beef steak": "ribeye steak",
  "smash burger": "beef patty", "beef bulgogi": "beef",
  "beef stir fry": "beef sirloin", "beef brisket": "brisket",
  "wagyu beef donburi": "wagyu beef", "wagyu beef sliders": "wagyu beef",
  "beef bourguignon": "beef chuck", "beef tartare": "beef tenderloin",
  "beef kofta": "ground beef", "bbq baby back ribs": "pork ribs",
  "pulled pork sandwich": "pork shoulder", "carnitas": "pork shoulder",
  "char siu pork": "pork belly", "sweet and sour pork": "pork",
  "gyoza dumplings": "pork", "biscuits and gravy": "sausage",
  "teriyaki salmon": "salmon", "pan-seared salmon": "salmon",
  "honey garlic salmon": "salmon", "miso black cod": "black cod",
  "sole meunière": "sole fillet", "crispy fish and chips": "cod fillet",
  "grilled sea bass": "sea bass", "crispy calamari": "squid",
  "lobster thermidor": "lobster", "lobster roll": "lobster",
  "saffron lobster bisque": "lobster", "crab cakes": "crab",
  "seared scallops": "scallops", "grilled octopus": "octopus",
  "takoyaki": "octopus", "lamb shawarma": "lamb shoulder",
  "moroccan lamb tagine": "lamb", "lamb biryani": "lamb",
  "osso buco": "veal shank", "duck confit": "duck leg",
  "crispy duck confit": "duck leg", "peking duck": "duck",
  "pasta carbonara": "pasta", "spaghetti bolognese": "pasta",
  "chicken alfredo": "pasta", "penne arrabbiata": "pasta",
  "tagliatelle with truffles": "pasta", "cacio e pepe": "pasta",
  "amatriciana pasta": "pasta", "dan dan noodles": "noodles",
  "pad thai": "rice noodles", "miso ramen": "ramen noodles",
  "tonkotsu ramen": "ramen noodles", "uni pasta": "sea urchin",
  "black truffle risotto": "arborio rice", "risotto milanese": "arborio rice",
  "gnocchi with pesto": "gnocchi", "kimchi fried rice": "rice",
  "paella valenciana": "rice", "bibimbap": "mixed vegetables and beef",
  "tteokbokki": "rice cakes", "mapo tofu": "tofu",
  "palak paneer": "paneer", "falafel bowl": "chickpeas",
  "miso glazed eggplant": "eggplant", "tamales": "masa",
  "loaded nachos": "tortilla chips", "mac and cheese": "macaroni",
  "french onion soup": "onions", "greek moussaka": "lamb",
  "philly cheesesteak": "ribeye beef", "pozole": "pork",
  "smoked salmon eggs benedict": "salmon",
};

export function extractIngredient(dishName) {
  const key = dishName.toLowerCase().trim();
  if (INGREDIENT_MAP[key]) return INGREDIENT_MAP[key];
  const proteins = ["wagyu", "beef", "chicken", "pork", "lamb", "shrimp", "salmon", "fish", "duck", "lobster", "crab", "tuna", "tofu", "scallop", "prawn"];
  for (const p of proteins) {
    if (key.includes(p)) return p;
  }
  return key.split(" ").filter((w) => w.length > 3)[0] || key;
}

// ── Image generation ──────────────────────────────────────────────────────────
export const FALLBACK_TOOL_KEY = "image:nano.2"; // Nano Banana 2 — faster, same cost to user
export const FALLBACK_CREDITS  = IMAGE_CREDITS;  // keep user cost identical (2 credits)

export async function generateCookingScene({ prompt, referenceUrl = null }) {
  return createImageJobSimple({
    subject: prompt,
    toolKey: IMAGE_TOOL_KEY,
    width: IMAGE_W,
    height: IMAGE_H,
    size: `${IMAGE_W}x${IMAGE_H}`,
    refImages: referenceUrl ? [referenceUrl] : [],
    expectedRefSlotCount: referenceUrl ? 1 : 0,
    chargeCreditsOverride: IMAGE_CREDITS,
  });
}

// Nano Banana 2 fallback — no reference images, same credit cost
export async function generateCookingSceneFallback({ prompt }) {
  return createImageJobSimple({
    subject: prompt,
    toolKey: FALLBACK_TOOL_KEY,
    width: IMAGE_W,
    height: IMAGE_H,
    size: `${IMAGE_W}x${IMAGE_H}`,
    refImages: [],
    expectedRefSlotCount: 0,
    chargeCreditsOverride: FALLBACK_CREDITS,
  });
}

// ── Database ──────────────────────────────────────────────────────────────────
function normalize(row) {
  return { ...row, scenes: Array.isArray(row.scenes) ? row.scenes : [] };
}

export async function createCookingMaticGeneration({ dishName, vibeId, scenes }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const sceneData = scenes
    .filter((s) => s.imageUrl)
    .map((s) => ({ index: s.index, imageUrl: s.imageUrl }));
  const { data, error } = await supabase
    .from("cooking_matic_generations")
    .insert({ user_id: user.id, dish_name: dishName, vibe_id: vibeId, scenes: sceneData })
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function listCookingMaticGenerations(limit = 8) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from("cooking_matic_generations")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(normalize);
}
