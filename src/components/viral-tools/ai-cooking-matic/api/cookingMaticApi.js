import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { uploadForExternalFetch } from "../../../../lib/storage";

// ── Constants ─────────────────────────────────────────────────────────────────
export const IMAGE_TOOL_KEY  = "image:fruit-v2";
export const IMAGE_CREDITS   = 2;
export const SCENE_COUNT     = 10;
export const IMAGE_W         = 720;
export const IMAGE_H         = 1280;

// Video phase — Seedance 1.5 Pro, no sound, 6s clips
export const VIDEO_TOOL_KEY         = "video:seedance15pro";
export const VIDEO_DURATION         = 6;
export const VIDEO_CREDITS_PER_CLIP = 15;   // 2.5 cr/s × 6s
export const VIDEO_CLIP_COUNT       = 5;

// Which image pair [A, B] feeds each clip
export const CLIP_PAIRS = [
  [0, 1],   // Chef Intro        → Raw Ingredient
  [2, 3],   // Prep & Season     → Coating Action
  [4, 5],   // Into the Oil      → Overhead Fry
  [6, 7],   // Wok Toss          → Beauty Plate
  [8, 9],   // Chef Presents     → Hero Shot
];

export const TOTAL_CREDITS =
  SCENE_COUNT * IMAGE_CREDITS +          // 20 — images
  VIDEO_CLIP_COUNT * VIDEO_CREDITS_PER_CLIP; // 75 — videos

// ── Vibes ─────────────────────────────────────────────────────────────────────
export const VIBES = [
  {
    id: "dark-moody",
    label: "Dark & Moody",
    desc: "Dramatic chiaroscuro lighting",
    accent: "#7A3BFF",
    dot: "#5b21b6",
    gradient: "linear-gradient(135deg, #0a0510 0%, #1a0b2e 40%, #2d1057 70%, #0f0820 100%)",
    image: "/templates/AICOOKING/dark.png",
    token: "dark and moody restaurant atmosphere, dramatic chiaroscuro lighting, deep black shadows, rich jewel-tone color grade, moody cinematic feel",
  },
  {
    id: "golden-hour",
    label: "Warm Golden",
    desc: "Rich amber restaurant glow",
    accent: "#F59E0B",
    dot: "#b45309",
    gradient: "linear-gradient(135deg, #2a1500 0%, #5c2e00 30%, #c47a00 70%, #f5a623 100%)",
    image: "/templates/AICOOKING/warmgolden.png",
    token: "warm golden hour lighting, rich amber highlights, honey-toned color grade, warm and inviting restaurant glow",
  },
  {
    id: "minimal-white",
    label: "Clean Minimal",
    desc: "Bright airy Scandinavian",
    accent: "#CBD5E1",
    dot: "#94a3b8",
    gradient: "linear-gradient(135deg, #e8edf2 0%, #f5f7fa 50%, #ffffff 100%)",
    image: "/templates/AICOOKING/clean.png",
    token: "clean minimal white studio background, bright even lighting, crisp soft shadows, airy and fresh Scandinavian color grade",
  },
  {
    id: "bright-studio",
    label: "Bright Studio",
    desc: "Fresh colorful daylight",
    accent: "#22C55E",
    dot: "#16a34a",
    gradient: "linear-gradient(135deg, #f8fafc 0%, #fef3c7 38%, #bbf7d0 72%, #e0f2fe 100%)",
    image: "/templates/AICOOKING/bright.png",
    token: "bright high-key daylight food photography, fresh colorful ingredients, clean vibrant contrast, glossy editorial cooking show look",
  },
  {
    id: "rustic-fire",
    label: "Rustic Fire",
    desc: "Flickering firelight, dark wood",
    accent: "#EA580C",
    dot: "#9a3412",
    gradient: "linear-gradient(135deg, #1a0800 0%, #3d1200 30%, #8b3400 65%, #c84b00 100%)",
    image: "/templates/AICOOKING/rustric%20fire.png",
    token: "rustic wood fire ambiance, warm flickering firelight, aged dark wood surfaces, artisan earthy orange-toned color grade",
  },
  {
    id: "neon-modern",
    label: "Neon Modern",
    desc: "Cyberpunk purple & teal",
    accent: "#06B6D4",
    dot: "#0e7490",
    gradient: "linear-gradient(135deg, #020b12 0%, #041525 30%, #0a2a3d 60%, #082030 80%, #150a25 100%)",
    image: "/templates/AICOOKING/neon%20modern.png",
    token: "ultra-modern kitchen, purple and teal neon accent rim lights, dark polished obsidian surfaces, cyberpunk editorial food photography",
  },
];

// ── Scene labels ──────────────────────────────────────────────────────────────
export const SCENE_LABELS = [
  "Final Dish Reveal",   // 0 — hook shot: show the finished meal FIRST
  "Raw Ingredient",      // 1
  "Prep & Season",       // 2
  "Coating Action",      // 3
  "Into the Oil",        // 4
  "Overhead Fry",        // 5
  "Wok Toss",            // 6
  "Beauty Plate",        // 7
  "Chef Presents",       // 8
  "Hero Close-Up",       // 9
];

// ── Prompt templates (called with (dish, ingredient, vibeToken)) ───────────────
export const SCENE_TEMPLATES = [
  // 0 — HOOK: Final dish reveal (shown FIRST as the scroll-stopping opener)
  (dish, ingredient, vibe) =>
    `Cinematic hero shot of perfectly finished ${dish} on a dark matte ceramic plate, gleaming golden crust, vibrant fresh garnish of spring onions and sesame, delicate steam rising, single dramatic overhead spotlight, completely blurred bokeh background, ${vibe}, ultra-realistic high-end restaurant photography, 8K, no hands no text no watermark`,

  // 1 — Raw ingredient showcase
  (dish, ingredient, vibe) =>
    `Extreme macro close-up of fresh raw ${ingredient} on dark polished marble, the exact same ingredient that will become the dish in this video, fine water droplets glistening, dramatic side rim lighting, ultra-sharp grain and texture, ${vibe}, 8K ultra-detailed, no text`,

  // 2 — Flat-lay prep: same ingredients as scene 1
  (dish, ingredient, vibe) =>
    `Overhead flat-lay of fresh ${ingredient} and supporting ingredients for ${dish} arranged in small white ceramic bowls on dark marble, the exact same ${ingredient} from scene 1 now prepped and seasoned, chef hands adding a pinch of sea salt, ${vibe}, cinematic top-down food photography, 8K`,

  // 3 — Coating action: same ingredient being coated
  (dish, ingredient, vibe) =>
    `Dynamic freeze-frame of hands tossing ${ingredient} — the same pieces from scene 2 — in golden seasoned flour in a dark mixing bowl, flour and paprika dust particles suspended mid-air, ${vibe}, motion blur on particles, cinematic food action, 8K`,

  // 4 — Into the oil: same coated ingredient
  (dish, ingredient, vibe) =>
    `Dramatic macro of a hand releasing battered ${ingredient} into shimmering hot golden oil in a dark cast-iron pan, the same ${ingredient} that was just coated in scene 3, oil erupting upward in a perfect freeze-frame splash, steam rising, ${vibe}, 8K cinematic food macro`,

  // 5 — Overhead fry: same pieces crisping
  (dish, ingredient, vibe) =>
    `Pure overhead bird's-eye view straight down into a dark pan, the same ${ingredient} pieces from scene 4 now actively bubbling and crisping gold in hot oil, perfectly golden texture forming, steam rising, ${vibe} dramatic top-lighting, 8K hero food photography`,

  // 6 — Wok toss: same dish finishing
  (dish, ingredient, vibe) =>
    `Cinematic side angle of a chef's white-sleeved arm tossing the same ${ingredient} — now almost finished ${dish} — high in a carbon steel wok over a roaring blue gas flame, food arcing beautifully through wok hei smoke, ${vibe}, 8K`,

  // 7 — Beauty plating: the finished dish plated
  (dish, ingredient, vibe) =>
    `Close-up of ${dish} being plated on a dark matte ceramic plate — the same dish from scene 6 now complete — garnished precisely with spring onions, chili rings and sesame, wisps of steam, ${vibe} overhead spotlight, shallow depth of field bokeh, 8K`,

  // 8 — Chef presents: 3D chef holding the plated dish
  (dish, ingredient, vibe) =>
    `3D animated cartoon Black male chef in pristine white coat holding a dark plate of ${dish} — the same dish from scene 7 — forward toward camera with both hands, proud warm smile, ${vibe} cinematic kitchen background, Pixar Disney quality 3D render, 8K`,

  // 9 — Hero close-up: final tight shot matching scene 0
  (dish, ingredient, vibe) =>
    `Extreme close-up macro of ${dish} on a dark ceramic plate, matching the exact dish from scene 0 but now revealing every detail — golden crust, vibrant garnish, steam — ${vibe} single dramatic overhead spotlight, completely blurred bokeh, ultra-realistic 8K, no hands no text`,
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

export async function generateCookingScene({ prompt, referenceUrl = null, styleReferenceUrl = null }) {
  const refImages = [styleReferenceUrl, referenceUrl].filter(Boolean);

  return createImageJobSimple({
    subject: prompt,
    toolKey: IMAGE_TOOL_KEY,
    width: IMAGE_W,
    height: IMAGE_H,
    size: `${IMAGE_W}x${IMAGE_H}`,
    refImages,
    expectedRefSlotCount: refImages.length,
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

// ── Viral clip video prompts ──────────────────────────────────────────────────
// 5 clips × 6s. Camera stays overhead or tight on hands during cooking —
// only the FINAL clip reveals the full chef for the payoff moment.
export const CLIP_VIDEO_PROMPTS = [
  // Clip 1 — Chef intro × Raw ingredient reveal
  (dish, ingredient, vibe) =>
    `Cinematic vertical cooking video, smooth single take. Opens on a confident 3D animated chef in white coat making direct eye contact with camera, gesturing proudly to present ${dish}. Camera slowly tilts DOWN to reveal a dark marble surface where glistening raw ${ingredient} sits under a tight dramatic spotlight — water droplets catching the light, texture hyper-real. Camera pushes in slowly to an extreme close-up of the ingredient, filling the frame. ${vibe}. No jump cuts, fluid cinematic motion, hands only when transitioning.`,

  // Clip 2 — Prep overhead × Coating action explosion
  (dish, ingredient, vibe) =>
    `Cinematic vertical cooking video, strict overhead bird's-eye view the entire time, only chef's hands visible — no face. Hands expertly arrange fresh ${ingredient} and spices in small white ceramic bowls on dark marble, adding a pinch of sea salt crystals that scatter in the air. Camera stays overhead as hands move to a large mixing bowl and vigorously toss ${ingredient} in golden seasoned flour — the motion builds until the final frame freezes on paprika dust and flour particles suspended in mid-air like an explosion. ${vibe}. Pure overhead ASMR cooking cinematography.`,

  // Clip 3 — Oil drop × Overhead golden fry
  (dish, ingredient, vibe) =>
    `Cinematic vertical cooking video, ultra close-up macro throughout — only a hand visible at the edge of frame. Hand releases battered ${ingredient} into shimmering hot golden oil in a dark cast-iron pan — oil ERUPTS upward in a dramatic slow-motion splash, droplets and steam suspended perfectly. Camera slowly rises and widens to a pure overhead bird's-eye view directly above the pan: ${ingredient} actively bubbling and crisping in perfect golden oil, the surface alive with tiny bubbles and rising steam. ${vibe}. ASMR-viral food macro, no face.`,

  // Clip 4 — Wok toss flame × Precision plate reveal
  (dish, ingredient, vibe) =>
    `Cinematic vertical cooking video. Opens on a dramatic low side-angle shot: only a chef's white-sleeved arm visible, tossing ${dish} high in a carbon steel wok over a roaring bright blue gas flame — food arcs beautifully through wok hei smoke and steam. Camera transitions to tight overhead push-in on a dark matte ceramic plate as hands (only) use tweezers and squeeze bottles for precision plating: spring onions placed perfectly, chili rings, toasted sesame. Final frame: perfectly plated ${dish} under a single dramatic overhead spotlight, steam curling. ${vibe}. Viral wok-to-plate reveal.`,

  // Clip 5 — Chef full reveal × Hero close-up finale
  (dish, ingredient, vibe) =>
    `Cinematic vertical cooking video, the emotional payoff. The 3D animated chef in pristine white coat steps confidently into frame, holding a dark ceramic plate of finished ${dish} extended forward with both hands, warm proud smile, steam rising. Camera slowly pushes in as the chef steps back — the plate fills more of the frame. Smooth slow-zoom into an extreme close-up hero shot: golden crispy ${dish} fills the entire frame, crust glistening, garnish vibrant and fresh, a single gentle wisp of steam curling from the center, background blurred to smooth bokeh. ${vibe}. Cinema-grade final reveal, ultra-realistic.`,
];

// ── Video generation ───────────────────────────────────────────────────────────
export async function animateCookingClip({ firstImageUrl, secondImageUrl, prompt }) {
  const refs = [firstImageUrl, secondImageUrl].filter(Boolean);
  return createVideoJobSimple({
    subject:           prompt,
    toolKey:           VIDEO_TOOL_KEY,
    width:             720,     // 720x1280 = 9:16 HD — confirmed allowed by Runware
    height:            1280,
    durationSec:       VIDEO_DURATION,
    initImageUrls:     refs,
    calculatedCredits: VIDEO_CREDITS_PER_CLIP,
    withSound:         false,
  });
}

// ── Database ──────────────────────────────────────────────────────────────────
function normalize(row) {
  return { ...row, scenes: Array.isArray(row.scenes) ? row.scenes : [] };
}

export async function createCookingMaticGeneration({ dishName, vibeId, scenes, clips = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const sceneData = scenes
    .filter((s) => s.imageUrl)
    .map((s) => ({ index: s.index, imageUrl: s.imageUrl }));
  const clipData = clips
    .filter((c) => c.videoUrl)
    .map((c) => ({ index: c.index, videoUrl: c.videoUrl }));
  const { data, error } = await supabase
    .from("cooking_matic_generations")
    .insert({ user_id: user.id, dish_name: dishName, vibe_id: vibeId, scenes: sceneData, clips: clipData })
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

// Uploads the generated voiceover MP3 to permanent storage and saves it on the
// generation row so it survives reloads (previously only lived in component state).
export async function saveVoiceToGeneration({ generationId, voiceId, voiceLabel, script, audioBlob }) {
  if (!generationId || !audioBlob) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const file = new File([audioBlob], `voice-${generationId}.mp3`, { type: audioBlob.type || "audio/mpeg" });
  const { url: audioUrl } = await uploadForExternalFetch(file, { prefix: "cooking-matic-voice" }, true);

  const { data, error } = await supabase
    .from("cooking_matic_generations")
    .update({ voice: { voiceId, voiceLabel, script, audioUrl } })
    .eq("id", generationId)
    .eq("user_id", user.id)
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
