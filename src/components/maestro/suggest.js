// Which templates to suggest above Maestro's box while the user types ("roblox story" -> In This Town, Blocky Stories).
// Words from the registry (name, category, hook, direction) plus the words people actually use.
const ALIASES = {
  "in-this-town": ["roblox", "town", "blocky", "in this town", "rule", "everybody", "except me", "story", "stories"],
  "blocky-stories": ["roblox", "blocky", "minecraft", "block", "funny story"],
  "cutaway-explainer": ["explain", "explainer", "how", "works", "inside", "3d", "cutaway"],
  "long-form": ["youtube", "long", "documentary", "history", "explain", "minutes"],
  "ai-fruit-story": ["fruit", "drama", "soap", "cheating"],
  "two-am": ["2am", "2 am", "night", "nostalgia", "liminal", "dreamcore"],
  "thirty-days": ["30 days", "thirty", "survive", "days"],
  "face-asmr": ["asmr", "face", "satisfying"],
  "clay-rescue": ["clay", "rescue", "satisfying"],
  "micro-camera-animal": ["animal", "camera", "pov animal", "bee", "cat"],
  "ai-cooking-matic": ["cook", "cooking", "recipe", "food"],
  "kit-swap": ["football", "soccer", "kit", "jersey"],
  "cartoon-drive-by": ["car", "drive", "cartoon"],
  "behind-the-scenes": ["behind the scenes", "disaster", "set", "movie"],
};

/** up to `max` templates for what's typed; "/" or "/word" lists by name */
export function suggestTemplates(text, styles, max = 3) {
  const t = String(text ?? "").toLowerCase().trim();
  if (!t) return [];
  const slash = t.startsWith("/");
  const q = slash ? t.slice(1) : t;
  const scored = styles.map((s) => {
    let score = 0;
    const words = [s.name.toLowerCase(), s.id, ...(ALIASES[s.id] ?? [])];
    for (const w of words) if (w && q.includes(w)) score += w.length > 4 ? 3 : 2;
    if (slash && (q === "" || s.name.toLowerCase().startsWith(q) || s.id.startsWith(q))) score += 5;
    return { s, score };
  }).filter((x) => x.score > 0 || (slash && q === ""));
  return scored.sort((a, b) => b.score - a.score || a.s.sort - b.s.sort).slice(0, slash && q === "" ? 8 : max).map((x) => x.s);
}
