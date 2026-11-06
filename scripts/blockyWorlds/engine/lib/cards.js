// Blocky Worlds: what a picture card / badge draws as its picture (pure; page/kit/props.js draws it).
// Turtle run 1620fc3e: cards were signposts with an EMPTY circle (HUNT, GARDEN HOSE, SHELL DOOR, MUDDY HILL SLIDE):
// the RunPod image has no colour emoji font (fonts-dejavu-core only), so the emoji drew nothing, and the planner's
// generic "✨" said nothing anyway. A card never shows an empty circle: a real colour emoji, else the word itself.

/** the generic "something" icons the planner uses when it has no picture: they say nothing, the word says more */
export const GENERIC_ICONS = new Set(["✨", "★", "⭐", "❓", "❔", "!", "?"]);
const PICTO = /\p{Extended_Pictographic}/u;

/**
 * cardPicture(text, icon, draws) -> "emoji" | "word" | "title"
 *   emoji: a real emoji the browser draws in colour (draws(icon) === true) on the disc
 *   word:  a short word on the disc (an icon that is a word, or the text's first word when there is no text line)
 *   title: no disc: the card's text big over the whole board
 */
export function cardPicture(text, icon, draws = () => true) {
  const ic = String(icon ?? "").trim(), hasText = !!String(text ?? "").trim();
  if (ic && PICTO.test(ic)) return !GENERIC_ICONS.has(ic) && draws(ic) ? "emoji" : hasText ? "title" : "word";
  if (ic && !GENERIC_ICONS.has(ic)) return "word";
  return hasText ? "title" : "word";
}

/** the word drawn on the disc for "word" (an icon word, else the text's first word, else "?") */
export function cardWord(text, icon) {
  const ic = String(icon ?? "").trim();
  if (ic && !PICTO.test(ic) && !GENERIC_ICONS.has(ic)) return ic.toUpperCase();
  return (String(text ?? "").trim().split(/\s+/)[0] || "?").toUpperCase();
}

/** a badge ("🚪 DOOR"): the emoji only when it draws, else the word alone (never a blank badge) */
export function badgeParts(text, draws = () => true) {
  const m = String(text ?? "").match(/(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic})*)/u);
  const em = m?.[0] ?? null, rest = em ? String(text).replace(em, "").trim() : String(text ?? "").trim();
  const ok = !!em && !GENERIC_ICONS.has(em) && draws(em);
  return { emoji: ok ? em : null, word: rest || (ok ? "" : "!") };
}
