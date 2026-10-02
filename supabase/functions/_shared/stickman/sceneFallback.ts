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

export function safeFallbackContract(c: any, set: { props?: Record<string, { block?: string }> }): any {
  const texty = (id: string) => TEXT_BEARING.test(set.props?.[id]?.block ?? id);
  const keep = (ids?: string[]) => (ids ?? []).filter((id) => !texty(id));
  const idea = String(c?.userSummary || c?.visualConcept || "").replace(/[….\s]+$/, "").trim();
  const words = String(c?.textIntent?.text ?? "").trim();
  const camera = c?.composition?.camera;
  return {
    ...c,
    treatment: COMPOSITE.has(c?.treatment) ? "STORY_SCENE" : c?.treatment,
    splitSettings: undefined,
    propIds: keep(c?.propIds),
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
