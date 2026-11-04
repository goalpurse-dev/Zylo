// Content Machine: a Studio script as the owner reviews it (owner, 2026-11-02). What each line puts on screen, and the
// owner's edits applied before it renders. Pure, so the page, the API and the tests share it.
const TEXT_FIELD = { sign: "text", tag: "text", clock: "text", timeline: "text", bubble: "text", trophy: "text", roll: "label", idea: "title" };
const NAMES = { sign: "A sign", tag: "A tag", clock: "A clock", timeline: "A messy timeline", bubble: "A speech bubble", trophy: "A trophy", roll: "A number rolling up", idea: "An idea card", tiles: "The video's real pictures", typed_result: "What I typed next to what came out", conveyor: "An idea becoming a video" };

/** What a line shows: {what, text, editable}. */
export function onScreen(line) {
  // s_scene* files are real frames of the finished video (Blocky step 3, 2026-11-04), not app screens
  if (line.screen) return { what: /^s_scene/.test(line.screen.file ?? "") ? "Real frames of the finished video" : `The real app screen ${String(line.screen.file ?? "").replace(/\.jpg$/, "")}`, text: line.screen.sticker?.text ?? "", editable: Boolean(line.screen.sticker) };
  const v = line.visual;
  if (!v) return { what: line.keep ? "Stays on the line before" : "The two characters", text: "", editable: false };
  const field = TEXT_FIELD[v.kind];
  return { what: NAMES[v.kind] ?? v.kind, text: field ? v[field] ?? "" : v.kind === "typed_result" ? v.text ?? "" : "", editable: Boolean(field) };
}

const clean = (x, max, what) => {
  const t = String(x ?? "").trim();
  if (!t) throw new Error(`${what} can't be empty.`);
  if (t.length > max) throw new Error(`${what} is over ${max} characters.`);
  return t;
};

/** A new script with the owner's edits: {title, headline, caption, lines: [{text, on}]}. Lines stay in their order. */
export function applyScriptEdits(script, edits = {}) {
  const s = structuredClone(script);
  if (edits.title != null) s.title = clean(edits.title, 150, "The title");
  // a hidden headline (rage / pain hooks: line 1 is the hook) is never checked; it follows line 1 (owner, 2026-11-04)
  if (edits.headline != null && !s.headline?.hidden) s.headline = { ...s.headline, text: clean(edits.headline, 80, "The headline") };
  if (edits.caption != null) s.caption = clean(edits.caption, 2000, "The caption");
  (edits.lines ?? []).forEach((e, i) => {
    const l = s.lines[i];
    if (!l) throw new Error("That script has fewer lines.");
    if (e.text != null) {
      const text = clean(e.text, 300, `Line ${i + 1}`);
      if (text !== l.text) {
        l.text = text; delete l.say;
        l.key = (l.key ?? []).filter((k) => text.includes(k));
      }
    }
    if (e.on != null && onScreen(l).editable) {
      const on = clean(e.on, 80, `The on-screen text of line ${i + 1}`);
      if (l.screen) l.screen.sticker.text = on; else l.visual[TEXT_FIELD[l.visual.kind]] = on;
    }
  });
  if (s.headline?.hidden && s.lines[0]) s.headline.text = s.lines[0].text;
  return s;
}
