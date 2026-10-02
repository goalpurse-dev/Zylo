// deno-lint-ignore-file no-explicit-any
// sceneFallback.ts — never leave a hole in a video. When a scene fails to draw
// twice, render-long-form-scene makes ONE last draw from this simplified, safe
// contract: the same idea shown through people, poses and plain objects, with
// nothing that carries writing (screens, cards, labels, signs, papers...), a
// generic single-frame composition, and any words moved into the code overlay
// (the HEADLINE text layer) instead of the picture.
// 596af432: 8 scenes built around a "NON-REFUND" phone screen / deadline card.

// Objects that tend to carry writing (or are mostly writing).
export const TEXT_BEARING = /\b(screens?|displays?|monitors?|smartphones?|phones?|laptops?|tablets?|cards?|labels?|signs?|signboards?|posters?|banners?|receipts?|tickets?|documents?|papers?|pages?|letters?|forms?|contracts?|stamps?|notes?|notebooks?|books?|newspapers?|menus?|charts?|graphs?|headlines?|captions?|invoices?|bills?|certificates?|scoreboards?|whiteboards?|blackboards?|calendars?|text|words?|writing|written|reads|reading|says)\b/i;
const COMPOSITE = new Set(["SPLIT", "COMPARISON", "TIMELINE_BAR", "CALLBACK", "MAP", "STAT_CARD", "ICON_ROW", "SCALE"]);

type SetLike = { props?: Record<string, { block?: string }>; settings?: Record<string, { name?: string; block?: string }> };
const propsOf = (c: any) => [...(c?.propIds ?? []), ...(c?.subjects ?? []).flatMap((s: any) => [...(s.holding ?? []), ...(s.wearing ?? [])])];
const textyProp = (set: SetLike, id: string) => TEXT_BEARING.test(set.props?.[id]?.block ?? id);
const textySetting = (set: SetLike, id?: string) => !!id && TEXT_BEARING.test(`${set.settings?.[id]?.name ?? ""} ${set.settings?.[id]?.block ?? ""}`);

// The short words written on the scene's text-bearing objects ("NON-REFUND"), for the overlay.
export function wordsOnObjects(c: any, set: SetLike): string | null {
  for (const id of propsOf(c).filter((p) => textyProp(set, p))) {
    const b = String(set.props?.[id]?.block ?? "");
    const quoted = b.match(/['‘“"]([^'’”"]{2,40})['’”"]/)?.[1];
    const caps = b.match(/\b[A-Z]{2,}(?:[- ][A-Z]{2,}){0,3}\b/)?.[0];
    const w = String(quoted ?? caps ?? "").split("/")[0].trim();
    if (w && w.split(/\s+/).length <= 4 && w.length <= 28) return w.toUpperCase();
  }
  return null;
}

// V2 (no OCR check, and its model writes garbled words on screens and cards): a scene built
// around a text-bearing object is drawn text-free FROM THE START, its words as the code overlay.
export function needsTextFreeComposition(tier: string, c: any, set: SetLike): boolean {
  if (tier !== "V2") return false;
  return propsOf(c).some((p) => textyProp(set, p)) || textySetting(set, c?.settingId);
}

// The idea text, cleaned so the safe draw always passes the prompt check (2f1b7e40 beat 32:
// "again" is a relative reference to another image; quotes and internal ids are refused too).
const RELATIVE_WORDS = /\b(?:same as before|same as|as before|again|the character|(?:shown|seen|drawn|pictured) (?:earlier|before|previously)|the (?:earlier|previous) (?:beat|scene|image|shot|frame|panel|picture)|previous (?:beat|scene|image|shot|frame|panel))\b/gi;
export function cleanIdea(text: string): string {
  return String(text ?? "").replace(RELATIVE_WORDS, "").replace(/["“”]/g, "").replace(/\b(?:cast|set|prop|motif|viewer)_\w+/gi, "").replace(/\s{2,}/g, " ").replace(/\s+([,.;])/g, "$1").replace(/([,.;])(?:\s*[,;])+/g, "$1").trim();
}

export function safeFallbackContract(c: any, set: SetLike): any {
  const keep = (ids?: string[]) => (ids ?? []).filter((id) => !textyProp(set, id));
  const idea = cleanIdea(String(c?.userSummary || c?.visualConcept || "")).replace(/[….\s]+$/, "").trim();
  const words = String(c?.textIntent?.text ?? "").trim() || wordsOnObjects(c, set) || "";
  const camera = c?.composition?.camera;
  return {
    ...c,
    treatment: COMPOSITE.has(c?.treatment) ? "STORY_SCENE" : c?.treatment,
    splitSettings: undefined,
    propIds: keep(c?.propIds),
    // A place that is itself a screen/sign becomes the scene's own plain place.
    settingId: textySetting(set, c?.settingId) ? undefined : c?.settingId,
    subjects: (c?.subjects ?? []).map((s: any) => ({ ...s, holding: keep(s.holding), wearing: keep(s.wearing) })),
    visualConcept: `${idea} — shown simply: the people, their poses and faces and plain objects tell the idea; no screens, papers, cards, signs or anything with writing`,
    composition: { ...(c?.composition ?? {}), camera: camera === "EXTREME_CLOSE_UP" || camera === "FLAT_GRAPHIC" || !camera ? "MEDIUM" : camera, framing: "simple and uncluttered" },
    // Words never go in the picture here: they become the code overlay.
    textIntent: words ? { mode: "PROGRAMMATIC", text: words, zone: "top", kind: "HEADLINE" } : { mode: "NO_TEXT", text: null },
    safeFallback: true,
  };
}

// The draw plan for one scene: the normal prompt twice, then the safe one once.
export const DRAW_ATTEMPTS: { fallback: boolean }[] = [{ fallback: false }, { fallback: false }, { fallback: true }];
