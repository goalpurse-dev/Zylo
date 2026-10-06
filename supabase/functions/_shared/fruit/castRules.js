// Cast rules for AI Fruit Story v2: who can share a story without looking alike.
//
// Two characters of the same fruit have the same head. In a chest-up shot the
// only things left to tell them apart are the outfit and the body, so the same
// fruit is allowed only for relatives who are dressed differently (Mia and
// Marco Mango). "The Kingpin of Cellblock C" had two pineapples in the same
// orange jumpsuit: nobody could tell who the kingpin was.
// Pure: used by validation.js (server), the idea library build and the UI.

const COLORS = ["black", "white", "grey", "gray", "navy", "blue", "red", "pink", "green", "yellow", "orange", "purple", "brown", "cream", "beige", "tan", "khaki", "olive", "gold", "silver", "lilac", "lavender", "mint", "teal", "coral", "burgundy", "maroon", "plum", "peach", "mustard", "charcoal", "emerald", "lime", "sage", "tangerine"];
/** Shades that read as the same colour on screen. */
const SAME_SHADE = { gray: "grey", charcoal: "grey", silver: "grey", navy: "blue", teal: "blue", maroon: "red", burgundy: "red", coral: "pink", lilac: "purple", lavender: "purple", plum: "purple", beige: "cream", tan: "cream", khaki: "cream", olive: "green", emerald: "green", lime: "green", sage: "green", mint: "green", mustard: "yellow", gold: "yellow", tangerine: "orange", peach: "orange" };

/** The first colour named in an outfit ("a hot-pink velvet suit, a black shirt" → "pink"), or null. */
export function mainColor(outfit) {
  const text = String(outfit ?? "").toLowerCase();
  let best = null;
  for (const c of COLORS) {
    const at = text.search(new RegExp(`\\b${c}\\b`));
    if (at >= 0 && (best === null || at < best.at)) best = { at, color: SAME_SHADE[c] ?? c };
  }
  return best?.color ?? null;
}

const FAMILY_TAG = /\b(wife|husband|mom|mum|dad|son|daughter|brother|sister|grandpa|grandma|aunt|stepmom|bride|groom|mother|father)\b|in-law/i;
const tagOf = (c) => String(c?.tag ?? "");

/** Relatives: both carry a family tag (Husband, Mom, Grandpa, Mother-in-law...). */
export const areFamily = (a, b) => FAMILY_TAG.test(tagOf(a)) && FAMILY_TAG.test(tagOf(b));

/** Told apart at a glance: a man and a woman, or outfits in different main colours. */
export function dressedDifferently(a, b) {
  if (a.gender !== b.gender) return true;
  const x = mainColor(a.outfit), y = mainColor(b.outfit);
  return Boolean(x && y && x !== y);
}

/**
 * Pairs in a cast that would look alike: the same fruit, unless they are
 * relatives who are dressed differently.
 * @param {{id:string,name:string,fruit:string,gender:string,tag:string,outfit:string}[]} cast
 * @returns {[object, object][]}
 */
export function lookAlikePairs(cast) {
  const pairs = [];
  for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) {
    const a = cast[i], b = cast[j];
    if (!a || !b || a.fruit !== b.fruit) continue;
    if (areFamily(a, b) && dressedDifferently(a, b)) continue;
    pairs.push([a, b]);
  }
  return pairs;
}

/** Plain-language reason a cast can't be used, or null. */
export function lookAlikeMessage(cast) {
  const [pair] = lookAlikePairs(cast);
  if (!pair) return null;
  const [a, b] = pair;
  const plural = /y$/.test(a.fruit) ? `${a.fruit.slice(0, -1)}ies` : /(ch|sh|s|x|o)$/.test(a.fruit) ? `${a.fruit}es` : `${a.fruit}s`;
  return `${a.name} and ${b.name} are both ${plural} and would look the same on screen. Swap one of them for a different fruit.`;
}
