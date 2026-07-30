import { supabase } from "../../../../lib/supabaseClient";
import { createImageJobSimple, createVideoJobSimple } from "../../../../lib/jobs";
import { uploadForExternalFetch } from "../../../../lib/storage";

// ── Constants ─────────────────────────────────────────────────────────────────
export const IMAGE_TOOL_KEY  = "image:fruit-v2";
export const IMAGE_CREDITS   = 2;
export const SCENE_COUNT     = 10;
export const IMAGE_W         = 720;
export const IMAGE_H         = 1280;

// Video phase — Seedance 1.5 Pro, no sound, 6s clips.
// Retuned to ~50% blended margin (was 15cr, ~55% margin): no-sound cost is
// ~$0.15/clip (estimated — scaled from the measured 720p+sound rate,
// $0.052529/s, by the sound/no-sound credit ratio 2.5/5.25; still unverified
// by a real no-sound invoice). Each clip = 2 images (4cr) + 1 video, so this
// uses the same 2-images/output formula as Clay Rescue:
// videoCredits = round(100 * videoCostUSD - 1.9154) = round(100*0.15 - 1.9154) = 13.
export const VIDEO_TOOL_KEY         = "video:seedance15pro";
export const VIDEO_DURATION         = 6;
export const VIDEO_CREDITS_PER_CLIP = 13;   // ~2.17 cr/s × 6s
export const VIDEO_CLIP_COUNT       = 5;

// Which image pair [A, B] feeds each clip
export const CLIP_PAIRS = [
  [0, 1],   // Dish Preview      → Ingredients Ready
  [2, 3],   // Prep & Slice      → Add to Bowl
  [4, 5],   // Season & Mix      → Start Cooking
  [6, 7],   // Cook Through      → Finish & Plate
  [8, 9],   // Chef Presents     → Matching Close-Up
];

export const VISUAL_CREDITS =
  SCENE_COUNT * IMAGE_CREDITS +          // 20 — images
  VIDEO_CLIP_COUNT * VIDEO_CREDITS_PER_CLIP; // 65 — videos

// ── Vibes ─────────────────────────────────────────────────────────────────────
export const VOICE_CREDITS_PER_TAKE = 3;
// Base service credits — covers the OpenAI GPT-4o(-mini) vision call in
// cooking-script-captions (generates the clip-aligned voiceover script AND
// its on-screen caption timing from the actual rendered frames) plus
// per-request overhead. Bumped 10 -> 12 since that OpenAI/caption cost
// wasn't previously priced in on top of the visual (image+video) credits.
// The ElevenLabs voice *audio* itself is billed separately per take via
// VOICE_CREDITS_PER_TAKE below.
export const COOKING_SERVICE_BASE_CREDITS = 12;
export const COOKING_VOICE_LIMITS = {
  starter: 2,
  affiliate: 2,
  pro: 3,
  generative: 5,
};

export function getCookingVoiceLimit(planCode) {
  return COOKING_VOICE_LIMITS[String(planCode || "starter").toLowerCase()] ?? 2;
}

export function getCookingServiceCredits(planCode) {
  return COOKING_SERVICE_BASE_CREDITS + getCookingVoiceLimit(planCode) * VOICE_CREDITS_PER_TAKE;
}

export function getCookingTotalCredits(planCode) {
  return VISUAL_CREDITS + getCookingServiceCredits(planCode);
}

export const TOTAL_CREDITS = getCookingTotalCredits("starter");

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
const LEGACY_SCENE_LABELS = [
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
const LEGACY_SCENE_TEMPLATES = [
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
export const SCENE_LABELS = [
  "Chef Dish Preview",
  "Ingredients Ready",
  "Prep & Slice",
  "Add to Bowl",
  "Season & Mix",
  "Start Cooking",
  "Cook Through",
  "Finish & Plate",
  "Chef Presents",
  "Matching Dish Close-Up",
];

const chefIdentity =
  `the same recurring adult stylized 3D woman cook: long softly waved black hair, warm expressive face, modest high-neck charcoal long-sleeve chef shirt, warm-tan waist apron tied in one front bow, a small silver necklace, and consistent hands with glossy dark-burgundy nails and one thin silver ring on her left ring finger`;

const workspaceIdentity =
  `the same intimate selected-vibe home kitchen, dark walnut worktop, parchment-lined dark metal tray or recipe-correct cooking vessel, clear glass prep bowl, wooden cutting board, utensils and small ingredient bowls in their established positions`;

const continuityLock = (dish, allowedChange) =>
  `BINDING SERIES CONTINUITY: this is the immediate next beat of one ${dish} tutorial. Content reference 1 is the previous frame and controls the food state and composition. Content reference 2, when supplied, locks the original worktop layout. Content reference 3, when supplied, locks the cook, hands and opening dish identity. Preserve ${chefIdentity}; preserve ${workspaceIdentity}; preserve ingredient identity, quantity, cut size, bowl, tray, vessel, plate, camera side and selected-vibe lighting. The ONLY permitted story change is: ${allowedChange}. Advance the action visibly; do not repeat the previous pose. Do not relayout the counter, swap hands, change nail color, change sleeves, rotate the workspace, replace cookware, invent ingredients, remove unused bowls or jump to a different meal. Polished stylized 3D cooking animation with physically realistic food, vertical 9:16, no text, no logo, no watermark.`;

const dishIdentityLock = (dish) =>
  `DISH IDENTITY LOCK: preserve the opening ${dish} exactly—same serving tray or plate, portion, ingredient pieces, colors, arrangement, sauce, toppings, garnish and steam. Do not reinterpret, restyle, replace or add any part of the dish.`;

export const SCENE_TEMPLATES = [
  (dish, ingredient, vibe) =>
    `TikTok-ready opening hook for a vertical ${dish} tutorial. ${chefIdentity} stands in ${workspaceIdentity} and looks into camera while holding the completely finished ${dish} forward with both hands. Her mouth is naturally poised to say, “Here’s how to make ${dish}.” Make her face, hair, apron, hands and burgundy nails unmistakable. Make the finished serving tray or plate an immutable ending anchor: clearly show its exact shape, portion, ingredient pieces, colors, sauce, toppings, garnish and steam. Energetic warm eye contact, appetizing close perspective, ${vibe}. Polished original stylized 3D cooking-show animation with physically realistic food, vertical 9:16, no on-screen text, no logo, no watermark.`,
  (dish, ingredient, vibe) =>
    `Direct overhead tutorial frame in the same kitchen as content reference 1. At the upper edge, show the same cook’s tan-apron torso and both burgundy-nailed hands resting naturally so her identity carries into every hand shot. Lay out the complete measured ingredients required for the exact previewed ${dish}, including ${ingredient}, around one empty clear prep bowl, one cutting board, the recipe-correct cooking vessel or parchment-lined tray, and the empty serving tray or plate matching the opening dish. Establish this as the immutable worktop map for all later scenes. No finished food is present here. ${vibe}. Polished stylized 3D cooking tutorial with physically realistic food, vertical 9:16, no text, no logo, no watermark.`,
  (dish, ingredient, vibe) =>
    `The same cook actively preps the exact ${ingredient} on the same cutting board. Show a knife halfway through a clean recipe-correct cut: uncut ${ingredient} on one side and the newly cut pieces on the other, with the empty clear bowl waiting beside the board. Her two hands, dark-burgundy nails, thin left-hand ring and tan-apron edge must match the opening cook. ${vibe}. ${continuityLock(dish, `only the ${ingredient} is now partly cut on the established board`)}`,
  (dish, ingredient, vibe) =>
    `A genuine adding shot, not another prep pose: the same burgundy-nailed hands scoop and tip the freshly cut ${ingredient} from the same board into the same clear bowl. Show three readable states at once—some pieces still on the board, several pieces visibly falling through the air, and some already collected in the bowl. Keep every other ingredient bowl, vessel and empty serving plate exactly where it was. ${vibe}. ${continuityLock(dish, `the cut ${ingredient} is visibly moving from the board into the clear bowl`)}`,
  (dish, ingredient, vibe) =>
    `The same cook seasons and mixes the exact cut ingredients already inside the same clear bowl. One hand pours a recipe-correct seasoning or sauce from a small bowl established in the worktop reference while the other turns the mixture with the same utensil. Show the seasoning stream and partially coated pieces so this is clearly later than “Add to Bowl,” but not yet cooked. ${vibe}. ${continuityLock(dish, `the established seasoning is being added and the bowl contents are becoming evenly coated`)}`,
  (dish, ingredient, vibe) =>
    `Start the correct cooking method for ${dish}: the same cook tips the seasoned mixture from the same clear bowl into the exact pan, pot, grill surface or parchment-lined tray established earlier. Show the transfer mid-action with food still in the bowl, food visibly falling, and food already in the cooking vessel. Both burgundy-nailed hands and the same utensil remain visible. ${vibe}. ${continuityLock(dish, `the seasoned mixture is moving from the clear bowl into the established cooking vessel`)}`,
  (dish, ingredient, vibe) =>
    `Immediate later cooking beat in the exact same vessel: the same utensil turns, stirs or repositions the same pieces while they become visibly partway cooked with recipe-correct browning, bubbling or steam. Keep some less-cooked and more-cooked surfaces visible so progress reads instantly; do not plate yet. ${vibe}. ${continuityLock(dish, `the same food is partway cooked in the same vessel and is being turned with the same utensil`)}`,
  (dish, ingredient, vibe) =>
    `Finish and assemble the same ${dish} in one readable tutorial beat. The food has reached its correct finished texture in the same vessel, and the same cook is transferring it onto the exact serving tray or plate established in scene 1. Show some food still in the vessel and some already arranged on the plate. Any sauce, topping or garnish being added must come from a bowl visible in the original worktop map and must reproduce the opening dish exactly. ${vibe}. ${continuityLock(dish, `the cooked food is being transferred and assembled on the established serving plate using only established toppings`)}`,
  (dish, ingredient, vibe) =>
    `Return to the presenter composition. Content reference 1 is the binding opening cook-and-finished-dish anchor; content reference 2 is the just-finished plate. ${chefIdentity} lifts the newly completed ${dish} toward camera in the same warm kitchen with the same face, hair, clothing, hands, nails and ring. Reconcile the cooked food to the opening anchor without redesigning it: the plate and every food component must match the opening exactly. ${dishIdentityLock(dish)} Proud, friendly “you made it” expression, ${vibe}. Polished original stylized 3D cooking-show animation, vertical 9:16, no text, no logo, no watermark.`,
  (dish, ingredient, vibe) =>
    `Food-only payoff macro of the exact completed ${dish}. Content reference 1 is the binding finished plate from the tutorial. Show only a tighter crop of that same physical serving tray or plate resting safely on the established worktop; no cook, person, face, torso or hands anywhere in frame. Preserve the exact food arrangement rather than generating an alternate plate. ${dishIdentityLock(dish)} Only camera distance, shallow depth of field and a gentle wisp of steam may change. ${vibe}. Physically realistic appetizing food cinematography, vertical 9:16, no text, no logo, no watermark.`,
];

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

const cookingReferenceCache = new Map();

async function resolveCookingReferenceUrl(sourceUrl) {
  if (!sourceUrl) return null;
  if (/^https:\/\//i.test(sourceUrl)) return sourceUrl;

  if (!cookingReferenceCache.has(sourceUrl)) {
    const uploadPromise = (async () => {
      const response = await fetch(sourceUrl, { cache: "force-cache" });
      if (!response.ok) throw new Error(`Could not load cooking reference (${response.status})`);

      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("Cooking reference did not resolve to an image");

      const rawName = sourceUrl.split("/").pop() || "cooking-style.png";
      const filename = decodeURIComponent(rawName);
      const file = new File([blob], filename, { type: blob.type || "image/png" });
      const uploaded = await uploadForExternalFetch(file, { prefix: "cooking-matic-style" }, true);
      if (!/^https:\/\//i.test(uploaded.url)) throw new Error("Cooking reference upload did not return an HTTPS URL");
      return uploaded.url;
    })();
    cookingReferenceCache.set(sourceUrl, uploadPromise);
  }

  try {
    return await cookingReferenceCache.get(sourceUrl);
  } catch (error) {
    cookingReferenceCache.delete(sourceUrl);
    console.error("[cooking-matic] failed to publish style reference:", error);
    return null;
  }
}

export async function generateCookingScene({ prompt, referenceUrl = null, referenceUrls = [], styleReferenceUrl = null }) {
  const contentReferences = [
    ...(Array.isArray(referenceUrls) ? referenceUrls : []),
    referenceUrl,
  ].filter(Boolean);
  const uniqueSources = [...new Set([...contentReferences, styleReferenceUrl].filter(Boolean))];
  const refImages = (await Promise.all(
    uniqueSources.map(resolveCookingReferenceUrl),
  )).filter(Boolean);

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
// ── Viral clip video prompts ──────────────────────────────────────────────────
// 5 clips × 6s. Camera stays overhead or tight on hands during cooking —
// only the FINAL clip reveals the full chef for the payoff moment.
const LEGACY_CLIP_VIDEO_PROMPTS = [
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
const motionContinuity = (dish) =>
  `REALISM LOCK: the supplied images are binding start/end frames of one take. Preserve the exact ${dish}, cook, hands, nails, ring, apron, kitchen, cookware, utensils, ingredient amounts and camera side. Use natural anatomy, weight, gravity, utensil contact, liquid flow and steam. Only the instructed action changes the food. Stable 24fps; no morphing, teleporting, hovering, extra fingers, object swaps, new ingredients, jump cuts, text, logos or shake.`;

export const CLIP_VIDEO_PROMPTS = [
  (dish, ingredient, vibe) =>
    `Realistic vertical TikTok cooking tutorial, one controlled shot. 0–2s: the same animated cook holds the finished ${dish} close to lens, makes warm eye contact and naturally mouths “Here’s how to make ${dish},” while the plate stays steady. 2–4s: she lowers that plate with believable arm weight as the camera smoothly tilts toward the worktop. 4–6s: her same hands enter the overhead composition and rest beside the organized ingredients, matching the end frame exactly. Keep the semi-realistic host design stable while food, skin, fabric and lighting behave naturally. ${vibe}. ${motionContinuity(dish)}`,
  (dish, ingredient, vibe) =>
    `Realistic overhead food-tutorial action. 0–2s: the knife completes only the final recipe-correct cuts through the same ${ingredient}; fingers stay safely curled and each cut separates naturally. 2–3s: the knife is set down once. 3–6s: both same hands lift and tip the cut pieces into the clear bowl; show pieces leave the board, fall under gravity and land with natural small impacts. Some pieces remain on the board and some sit in the bowl at the end. No seasoning or cooking yet. End precisely on the supplied Add to Bowl frame. ${vibe}. ${motionContinuity(dish)}`,
  (dish, ingredient, vibe) =>
    `Realistic preparation-to-cooking take. 0–2s: one hand pours the established seasoning or sauce in a continuous controlled stream while the other steadies the same clear bowl. 2–4s: the same utensil folds and coats the ${ingredient} with visible resistance; pieces remain distinct. 4–6s: she tips that exact bowl toward the established cooking vessel and the mixture falls into it naturally, with food visible in the bowl, in mid-air and inside the vessel. Do not make it cooked yet. End precisely on the supplied Start Cooking frame. ${vibe}. ${motionContinuity(dish)}`,
  (dish, ingredient, vibe) =>
    `Energetic but believable cooking-to-plating tutorial. 0–2s: the same utensil turns or stirs the same food in the same vessel; surfaces brown gradually with recipe-correct bubbling and steam. 2–3s: use one subtle speed ramp confined to the cooking reaction—never morph the hands, vessel or pieces. 3–5s: transfer the finished food onto the established plate with natural utensil contact, leaving some food visible in the vessel. 5–6s: add only one already-established finishing topping or sauce in a physically correct motion. End precisely on the supplied Finish & Plate frame. ${vibe}. ${motionContinuity(dish)}`,
  (dish, ingredient, vibe) =>
    `Realistic payoff matching the reference-video rhythm. 0–2s: the same cook presents the exact finished ${dish} with a relaxed proud smile; the plate and toppings do not change. 2–4s: she places that same plate onto the established worktop with believable arm weight and gentle ceramic contact. 4–6s: one smooth appetizing push-in fills the frame with that same food; focus shifts from plate edge to food while only steam moves. End precisely on the supplied food-only macro so it loops into the opening. ${vibe}. ${motionContinuity(dish)}`,
];

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
  const persistedTakes = Array.isArray(row.voice_takes) ? row.voice_takes : [];
  const fallbackTakes = row.voice?.audioUrl ? [row.voice] : [];
  const clipStoredFullVideo = Array.isArray(row.clips)
    ? row.clips.find(clip => clip?.fullVideoUrl)?.fullVideoUrl
    : null;
  return {
    ...row,
    scenes: Array.isArray(row.scenes) ? row.scenes : [],
    voiceTakes: persistedTakes.length ? persistedTakes : fallbackTakes,
    selectedVoiceTakeId: row.selected_voice_take_id ?? row.voice?.id ?? null,
    fullVideoUrl: row.full_video_url ?? clipStoredFullVideo ?? null,
    voiceGenerationLimit: Number(row.voice_generation_limit ?? 2),
    voiceGenerationsUsed: Number(row.voice_generations_used ?? persistedTakes.filter(take => !take?.imported).length),
    serviceCreditsCharged: Number(row.service_credits_charged ?? 0),
  };
}

export async function beginCookingMaticGeneration({ dishName, vibeId }) {
  const { data, error } = await supabase.rpc("begin_cooking_matic_generation", {
    p_dish_name: dishName,
    p_vibe_id: vibeId,
  });
  if (error) throw error;
  return normalize(data);
}

// Uploads the generated voiceover MP3 to permanent storage and saves it on the
// generation row so it survives reloads (previously only lived in component state).
export async function saveVoiceToGeneration({ generationId, takeId: requestedTakeId = null, voiceId, voiceLabel, script, audioBlob, imported = false, fileName = null, durationSec = null, playbackRate = 1, timelineDurationSec = null, captionScript = null }) {
  if (!generationId || !audioBlob) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const takeId = requestedTakeId || globalThis.crypto?.randomUUID?.() || `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sourceExtension = imported && fileName?.includes(".") ? fileName.split(".").pop().replace(/[^a-z0-9]/gi, "").toLowerCase() : null;
  const file = new File([audioBlob], `voice-${generationId}-${takeId}.${sourceExtension || "mp3"}`, { type: audioBlob.type || "audio/mpeg" });
  const { url: audioUrl } = await uploadForExternalFetch(file, { prefix: "cooking-matic-voice" }, true);

  const take = { id: takeId, voiceId, voiceLabel, script, audioUrl, imported, fileName, durationSec, playbackRate, timelineDurationSec, captionScript, createdAt: new Date().toISOString() };
  let { data, error } = await supabase.rpc("append_cooking_voice_take", {
    p_generation_id: generationId,
    p_take: take,
  });
  // Rollout fallback for environments where the migration is not installed yet.
  if (error && (error.code === "42883" || error.code === "PGRST202")) {
    const { data: existing, error: readError } = await supabase
      .from("cooking_matic_generations")
      .select("voice_takes")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError && (readError.code === "42703" || readError.code === "PGRST204")) {
      // Legacy schema: retain the currently selected take in the original
      // voice column until the voice-takes migration reaches this project.
      ({ data, error } = await supabase
        .from("cooking_matic_generations")
        .update({ voice: take })
        .eq("id", generationId)
        .eq("user_id", user.id)
        .select()
        .single());
    } else {
      if (readError) throw readError;
      const currentTakes = Array.isArray(existing?.voice_takes) ? existing.voice_takes : [];
      const voiceTakes = [take, ...currentTakes.filter(item => item?.id !== takeId)];
      ({ data, error } = await supabase
        .from("cooking_matic_generations")
        .update({ voice: take, voice_takes: voiceTakes, selected_voice_take_id: takeId })
        .eq("id", generationId)
        .eq("user_id", user.id)
        .select()
        .single());
    }
  }
  if (error) throw error;
  return normalize(data);
}

export async function updateCookingMaticGenerationProgress({ generationId, status, scenes = [], clips = [] }) {
  if (!generationId) return null;
  const sceneData = scenes.map(scene => ({
    index: scene.index,
    imageUrl: scene.imageUrl ?? null,
    imageJobId: scene.imageJobId ?? null,
    imageStatus: scene.imageStatus ?? "idle",
    error: scene.error ?? null,
  }));
  const clipData = clips.map(clip => ({
    index: clip.index,
    videoUrl: clip.videoUrl ?? null,
    videoJobId: clip.videoJobId ?? null,
    videoStatus: clip.videoStatus ?? "idle",
    error: clip.error ?? null,
    ...(clip.fullVideoUrl ? { fullVideoUrl: clip.fullVideoUrl } : {}),
  }));
  const { data, error } = await supabase
    .from("cooking_matic_generations")
    .update({ status, scenes: sceneData, clips: clipData, updated_at: new Date().toISOString() })
    .eq("id", generationId)
    .select()
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function selectVoiceTakeForGeneration({ generationId, take }) {
  if (!generationId || !take?.audioUrl) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let { data, error } = await supabase
    .from("cooking_matic_generations")
    .update({ voice: take, selected_voice_take_id: take.id ?? null })
    .eq("id", generationId)
    .eq("user_id", user.id)
    .select()
    .single();
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ data, error } = await supabase
      .from("cooking_matic_generations")
      .update({ voice: take })
      .eq("id", generationId)
      .eq("user_id", user.id)
      .select()
      .single());
  }
  if (error) throw error;
  return normalize(data);
}

export async function saveCaptionDraftToVoiceTake({ generationId, take, captionDraft }) {
  if (!generationId || !take?.audioUrl || !captionDraft) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const timingPatch = captionDraft?.captionScript
    ? { script: captionDraft.captionScript.script ?? take.script ?? "", captionScript: captionDraft.captionScript }
    : {};
  const patch = { captionDraft, ...timingPatch };
  let { data, error } = await supabase.rpc("patch_cooking_voice_take", {
    p_generation_id: generationId,
    p_take_id: take.id ?? null,
    p_audio_url: take.audioUrl,
    p_patch: patch,
  });
  if (error && (error.code === "42883" || error.code === "PGRST202")) {
    const { data: existing, error: readError } = await supabase
      .from("cooking_matic_generations")
      .select("voice, voice_takes, selected_voice_take_id")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();
    const matches = (item) => (take.id && item?.id === take.id) || item?.audioUrl === take.audioUrl;
    if (readError && (readError.code === "42703" || readError.code === "PGRST204")) {
      const { data: legacy, error: legacyReadError } = await supabase
        .from("cooking_matic_generations")
        .select("voice")
        .eq("id", generationId)
        .eq("user_id", user.id)
        .single();
      if (legacyReadError) throw legacyReadError;
      const legacyVoice = legacy?.voice;
      if (!matches(legacyVoice)) return normalize(legacy);
      ({ data, error } = await supabase
        .from("cooking_matic_generations")
        .update({ voice: { ...legacyVoice, ...patch } })
        .eq("id", generationId)
        .eq("user_id", user.id)
        .select()
        .single());
    } else {
      if (readError) throw readError;
      const currentTakes = Array.isArray(existing?.voice_takes) ? existing.voice_takes : [];
      const voiceTakes = currentTakes.map(item => matches(item) ? { ...item, ...patch } : item);
      const selectedMatches = matches(existing?.voice);
      ({ data, error } = await supabase
        .from("cooking_matic_generations")
        .update({ voice_takes: voiceTakes, ...(selectedMatches ? { voice: { ...existing.voice, ...patch } } : {}) })
        .eq("id", generationId)
        .eq("user_id", user.id)
        .select()
        .single());
    }
  }
  if (error) throw error;
  return normalize(data);
}

export async function updateCookingMaticFullVideo({ generationId, fullVideoUrl }) {
  if (!generationId || !fullVideoUrl) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let { data, error } = await supabase
    .from("cooking_matic_generations")
    .update({ full_video_url: fullVideoUrl })
    .eq("id", generationId)
    .eq("user_id", user.id)
    .select()
    .single();
  // Rollout fallback: keep the exported URL inside the existing clips JSON
  // when the dedicated full_video_url migration has not reached an env yet.
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    const { data: existing, error: readError } = await supabase
      .from("cooking_matic_generations")
      .select("clips")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .single();
    if (readError) throw readError;
    const clips = Array.isArray(existing?.clips) ? existing.clips : [];
    const nextClips = clips.length
      ? clips.map((clip, index) => index === 0 ? { ...clip, fullVideoUrl } : clip)
      : [{ index: 0, fullVideoUrl }];
    ({ data, error } = await supabase
      .from("cooking_matic_generations")
      .update({ clips: nextClips })
      .eq("id", generationId)
      .eq("user_id", user.id)
      .select()
      .single());
  }
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
