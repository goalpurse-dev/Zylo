// Small wording helpers shared by the picture and clip prompt builders.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * "<subject> <action>" without saying the name twice. The planner sometimes
 * starts the action with the character ("Vex freezes…", "Vex's eyes
 * widen…", "They raise…"); the builder already names them.
 *   withSubject("Vex (a blocky game avatar)", vex, "Vex freezes mid-step")
 *     → "Vex (a blocky game avatar) freezes mid-step"
 */
export function withSubject(subject, character, action) {
  const text = String(action ?? "").trim();
  const first = character.name.split(/\s+/)[0];
  const names = [...new Set([character.name, first])].map(escape).join("|");
  const m = text.match(new RegExp(`^(?:(?:${names})\\b('s)?|(he|she|they)\\b)\\s*`, "i"));
  if (!m) return `${subject} ${text}`;
  const rest = text.slice(m[0].length);
  return m[1] ? `${subject}'s ${rest}` : `${subject} ${rest}`;
}

/** "a smug tone" / "an icy calm tone" */
export function toneOf(emotion) {
  const e = String(emotion ?? "").trim().toLowerCase();
  return `${/^[aeiou]/.test(e) ? "an" : "a"} ${e} tone`;
}
