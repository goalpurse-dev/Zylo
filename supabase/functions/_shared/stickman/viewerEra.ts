// Era/context of "you" lines, shared by the Production Bible check (one
// viewer avatar per context) and the Beat Director (pick the matching one).
// Run 5: the bible made only viewer_viking, so present-day lines ("next time
// you see those horns on a lunchbox") showed a Viking.

// Present-day context: things that only exist now, or explicit "now" phrasing.
export const MODERN_CONTEXT = /\b(today|nowadays|these days|next time|modern|lunchbox(es)?|mascots?|halloween|costumes?|movies?|posters?|films?|tv|television|football|beer|labels?|logos?|stores?|shops?|phones?|screens?|internet|online|museums?|cartoons?|comics?|merch\w*|brands?|ads?|advertis\w*|sports?|stadiums?|video games?)\b/i;
// Past (period) context: the scene itself is in another era.
export const PAST_CONTEXT = /\b(shield(wall)?s?|swords?|spears?|axes?|longships?|raid(s|ing|ers?)?|battles?|charg(e|es|ing)|hillsides?|warriors?|chieftains?|villages?|fjords?|burial|mound|tribe|bronze age|iron age|centur(y|ies) ago|medieval)\b/i;

const SENTENCE_END = /[.!?]["'”’)]*$/;
const SECOND_PERSON = /\byou(?:'re|'ve|'d|'ll)?\b|\byour\b/i;

export type Era = "modern" | "past";

export function sentencesOf(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+["'”’)]*|[^.!?]+$/g) ?? []).map((s) => s.trim()).filter(Boolean);
}

// Context of one sentence, or null when it has no era markers either way.
export function eraOf(sentence: string): Era | null {
  if (MODERN_CONTEXT.test(sentence)) return "modern";
  if (PAST_CONTEXT.test(sentence)) return "past";
  return null;
}

// The eras the script's "you" lines happen in, with one example each.
export function youContexts(scriptText: string): Map<Era, string> {
  const out = new Map<Era, string>();
  for (const s of sentencesOf(scriptText)) {
    if (!SECOND_PERSON.test(s)) continue;
    const era = eraOf(s);
    if (era && !out.has(era)) out.set(era, s);
  }
  return out;
}

// A viewer avatar's era, from its id and role.
export function viewerEra(id: string, role = ""): Era | null {
  if (!/^viewer(_|$)/.test(id)) return null;
  return /modern|present|today|contemporary|current/i.test(`${id} ${role}`) ? "modern" : "past";
}

export { SENTENCE_END };
