// Fruit character reference prompt (AI Fruit Story v2 library).
// One template for every character; per-fruit details live in FRUITS so a
// fix applies to every character of that fruit.

/**
 * label   how the fruit is named in the prompt
 * skin    default body skin (a character can override)
 * finish  head surface: glossy / waxy / velvety / fuzzy / matte …
 * texture what "realistic … texture" means for this fruit
 * top     "leaves" → leaf crown, "stem" → short stem, other string → used as-is, null → nothing
 * body    brown-bodied fruits only: the texture shown on arms, hands and legs,
 *         so the body reads as fruit, not human skin (review these first)
 */
export const FRUITS = {
  apple:        { label: "red apple",        emoji: "🍎", hue: 0,   skin: "glossy red",                       finish: "glossy",  texture: "red apple skin texture with faint speckles", top: "stem" },
  "green apple":{ label: "green apple",      emoji: "🍏", hue: 95,  skin: "glossy green",                     finish: "glossy",  texture: "green apple skin texture with faint speckles", top: "stem" },
  mango:        { label: "mango",            emoji: "🥭", hue: 38,  skin: "golden-orange mango with a red blush", finish: "glossy", texture: "smooth mango skin texture", top: null },
  peach:        { label: "peach",            emoji: "🍑", hue: 18,  skin: "deep coral-red peach with a golden-orange blush", finish: "velvety", texture: "soft velvety peach texture with a deep coral-red blush", top: null },
  strawberry:   { label: "strawberry",       emoji: "🍓", hue: 350, skin: "strawberry-red",                   finish: "glossy",  texture: "strawberry texture with tiny golden seeds all over the head", top: "leaves" },
  grape:        { label: "purple grape-cluster", emoji: "🍇", hue: 275, skin: "deep purple",                  finish: "glossy",  texture: "cluster of round glossy purple grapes", top: null },
  lemon:        { label: "lemon",            emoji: "🍋", hue: 55,  skin: "bright lemon-yellow",              finish: "waxy",    texture: "dimpled lemon peel texture", top: null },
  lime:         { label: "lime",             emoji: "🍋‍🟩", hue: 90, skin: "bright lime-green",               finish: "waxy",    texture: "dimpled lime peel texture", top: null },
  banana:       { label: "banana",           emoji: "🍌", hue: 48,  skin: "yellow banana",                    finish: "smooth",  texture: "banana peel texture with a few tiny brown freckles", top: "a short real banana stem tip on top of the fruit head" },
  pineapple:    { label: "pineapple",        emoji: "🍍", hue: 42,  skin: "golden-brown pineapple",           finish: "textured", texture: "diamond-patterned pineapple skin texture", top: "leaves", body: "diamond-patterned pineapple skin" },
  coconut:      { label: "green young coconut", emoji: "🥥", hue: 100, skin: "smooth green young-coconut", finish: "smooth", texture: "smooth green young coconut husk texture", top: null, body: "green coconut-husk" },
  orange:       { label: "orange",           emoji: "🍊", hue: 28,  skin: "bright orange peel-textured",      finish: "glossy",  texture: "dimpled orange peel texture", top: null },
  kiwi:         { label: "kiwi",             emoji: "🥝", hue: 88,  skin: "fuzzy olive-brown kiwi",           finish: "fuzzy matte", texture: "kiwi skin covered in fine short olive-brown fuzz, matte, not shiny", top: null, body: "kiwi fuzz" },
  watermelon:   { label: "watermelon",       emoji: "🍉", hue: 140, skin: "green striped watermelon-rind",    finish: "glossy",  texture: "dark and light green striped watermelon rind texture", top: null },
  cherry:       { label: "cherry",           emoji: "🍒", hue: 350, skin: "deep cherry-red",                  finish: "glossy",  texture: "smooth shiny cherry skin texture", top: "stem" },
  pear:         { label: "pear",             emoji: "🍐", hue: 75,  skin: "yellow-green pear",                finish: "smooth",  texture: "pear skin texture with fine freckles", top: "stem" },
  plum:         { label: "plum",             emoji: "🟣", hue: 300, skin: "deep plum-purple",                 finish: "dusty matte", texture: "plum skin texture with a soft powdery bloom", top: null },
  blueberry:    { label: "blueberry",        emoji: "🫐", hue: 235, skin: "dusty indigo-blue",                finish: "dusty matte", texture: "blueberry skin texture with a soft powdery bloom", top: "a small star-shaped blueberry crown on top of the fruit head, part of the fruit, not hair" },
  raspberry:    { label: "raspberry",        emoji: "🔴", hue: 340, skin: "deep pink-red raspberry",          finish: "velvety", texture: "bumpy raspberry texture made of tiny round drupelets", top: null },
  avocado:      { label: "avocado",          emoji: "🥑", hue: 100, skin: "dark green pebbly avocado",        finish: "pebbly matte", texture: "pebbly dark green avocado skin texture", top: null },
  pomegranate:  { label: "pomegranate",      emoji: "🔴", hue: 355, skin: "deep ruby-red pomegranate",        finish: "glossy",  texture: "smooth leathery pomegranate skin texture", top: "a small real pomegranate calyx crown on top of the fruit head, part of the fruit, not hair" },
  fig:          { label: "fig",              emoji: "🟤", hue: 320, skin: "deep purple-brown fig",            finish: "matte",   texture: "soft fig skin texture with faint vertical ribs", top: "stem", body: "fig skin with faint ribs" },
  papaya:       { label: "papaya",           emoji: "🟠", hue: 35,  skin: "green-to-orange papaya",           finish: "smooth",  texture: "smooth papaya skin texture", top: null },
  "dragon fruit":{ label: "dragon fruit",    emoji: "🩷", hue: 330, skin: "hot-pink dragon fruit",            finish: "glossy",  texture: "hot-pink dragon fruit skin with green-tipped scale leaves", top: null },
  grapefruit:   { label: "grapefruit",       emoji: "🍊", hue: 10,  skin: "golden-yellow grapefruit with a pink-red blush", finish: "glossy", texture: "dimpled golden-yellow grapefruit peel texture with a pink-red blush", top: null },
  apricot:      { label: "apricot",          emoji: "🟠", hue: 32,  skin: "golden-orange apricot",            finish: "velvety", texture: "soft velvety apricot skin texture", top: null },
  lychee:       { label: "lychee",           emoji: "🔴", hue: 355, skin: "rose-red lychee",                  finish: "textured", texture: "bumpy rose-red lychee shell texture", top: null },
  blackberry:   { label: "blackberry",       emoji: "🫐", hue: 280, skin: "deep glossy purple blackberry",    finish: "glossy",  texture: "bumpy deep purple blackberry texture made of tiny round drupelets", top: null, body: "tiny glossy purple drupelet bump" },
  honeydew:     { label: "honeydew melon",   emoji: "🍈", hue: 110, skin: "pale green honeydew",              finish: "smooth",  texture: "smooth pale green honeydew rind texture", top: null },
  durian:       { label: "durian",           emoji: "🟢", hue: 70,  skin: "olive-green durian",               finish: "spiky",   texture: "spiky olive-green durian husk texture", top: null },
  tomato:       { label: "tomato",           emoji: "🍅", hue: 5,   skin: "glossy tomato-red",                finish: "glossy",  texture: "smooth shiny tomato skin texture", top: "a small green star-shaped tomato calyx and stem on top of the fruit head, not hair" },
};

export function ageText(age) {
  if (age < 20) return "late teens";
  const decade = { 2: "twenties", 3: "thirties", 4: "forties", 5: "fifties", 6: "sixties", 7: "seventies" }[Math.floor(age / 10)];
  const d = age % 10;
  return `${d <= 3 ? "early" : d <= 6 ? "mid" : "late"} ${decade}`.replace(/^mid (\w+)$/, "mid-$1");
}

/** Legs show (skirt, dress, shorts) and the outfit doesn't cover them itself. */
export function legsVisible(outfit) {
  return (/\b(skirt|miniskirt|shorts|swimsuit)\b/i.test(outfit) || /\b(sun)?dress\b(?! shoes| shirt)/i.test(outfit)) && !/\b(tights|stockings|leggings|pantyhose|knee-high boots)\b/i.test(outfit);
}

function topSentence(fruit) {
  if (!fruit.top) return "";
  if (fruit.top === "leaves") return `It has a crown of real green ${fruit.label} leaves sitting on top of the fruit head, clearly leaves, not hair. `;
  if (fruit.top === "stem") return `It has a short real ${fruit.label} stem on top of the fruit head, not hair. `;
  return `It has ${fruit.top}. `;
}

/** "bare" when the prompt should ask for bare fruit-colored legs. */
export const legsMode = (c) => c.legs ?? (legsVisible(c.outfit) ? "bare" : "covered");

/** @param {object} c  character from characters.json */
export function buildPrompt(c) {
  const f = FRUITS[c.fruit];
  if (!f) throw new Error(`unknown fruit ${c.fruit} for ${c.id}`);
  const skin = c.skin ?? f.skin;
  const finish = c.finish ?? f.finish;
  const sex = c.gender === "female" ? "woman" : "man";
  const legs = legsMode(c) === "bare"
    ? `Bare ${skin} fruit-colored legs, no tights or stockings. `
    : "";
  return `Full-body premium 3D animated character reference of ${c.name}, an anthropomorphic ${f.label} ${sex} ${c.age < 20 ? `aged ${c.age}, a young adult` : `in their ${ageText(c.age)}`}. Centered on a pure white background, entire body visible from head to feet, standing straight facing the camera, arms relaxed at the sides, calm neutral expression with a faint friendly smile. Their head is a large ${finish} ${f.label} that fully replaces a human head, fused smoothly into the shoulders with no neck gap, with realistic ${c.texture ?? f.texture}. ${topSentence(f)}${c.face} carved naturally into the fruit. EVERY visible part of the body, including neck, arms, hands, fingers, legs and feet, has ${f.body ? "" : "smooth "}stylized ${skin} fruit-colored skin. ${f.body ? `Arms, hands and legs show a fine ${f.body} texture, clearly fruit, not human skin. ` : ""}Absolutely no beige, tan or human skin tones anywhere. ${legs}${c.build}, simple rounded hands. They wear ${c.outfit}. Style: premium 3D animated feature-film quality, stylized but detailed, ${finish} fruit materials, realistic fabric, soft even studio lighting, subtle contact shadow under the feet, clean readable silhouette, 9:16 vertical framing. No text, no logos, no background, no props, no human skin, no human hair, no human head, no detached fruit head, no gap between fruit and shoulders, no extra limbs.${c.avoid ? ` ${c.avoid}` : ""}`;
}
