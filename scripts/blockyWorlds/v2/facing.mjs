// IN THIS TOWN v2: FACING AS DATA. Every person in a shot row has `facing`:
//   "camera"              looks into the lens (only when the words are TO the viewer, or a reaction close-up)
//   { to: "<id or thing>" } faces a named person / thing / spot (the default: what they look at)
//   "away"                back to the lens (walking off, looking at the house)
// The default when a row says nothing: the person faces what the line says they look at; else the other person in
// the shot; else the stage's own point of interest (the house from the street, the street from the porch) - never
// the lens by default. The checker fails a row where someone faces the lens while the words say they look elsewhere.

export const LOOK_WORDS = /\b(look(s|ed|ing)?|stare(s|d)?|staring|watch(es|ed|ing)?|peek(s|ed)?|glance(s|d)?|gaze(s|d)?|turn(s|ed)? to|point(s|ed)? at)\b/i;
const TO_VIEWER = /\b(you|your)\b/i;

/** the facing a person gets when the row gives none */
export function defaultFacing(row, who, { lineText = "", named = [] } = {}) {
  const others = (row.people ?? []).map((p) => p.id).filter((id) => id !== who);
  const lookedAt = LOOK_WORDS.test(lineText) ? named.find((n) => n !== who) : null;
  if (lookedAt) return { to: lookedAt };
  if (others.length) return { to: others[0] };
  if (row.creature) return { to: "creature" };
  return { to: row.poi ?? "street" };
}

/** the facing problems of one shot row -> [problem] */
export function facingProblems(row, { lineText = "", named = [] } = {}) {
  const out = [];
  const looksElsewhere = LOOK_WORDS.test(lineText) && named.length > 0 && !TO_VIEWER.test(lineText);
  for (const p of row.people ?? []) {
    const f = p.facing ?? defaultFacing(row, p.id, { lineText, named });
    if (f === "camera" && looksElsewhere) out.push(`${p.id} faces the camera, but the words say they look at ${named.filter((n) => n !== p.id).join(" / ") || "something else"}`);
    if (f && typeof f === "object" && f.to === p.id) out.push(`${p.id} faces themselves`);
    if (f && typeof f === "object" && f.to && !["street", "house", "sky", "creature", "door", "window", "porch_light"].includes(f.to) && !/^(porch_|pave_|road_|step|gate|cr_|seat_|stand_|window)/.test(f.to) && !(row.people ?? []).some((q) => q.id === f.to) && !(row.props ?? {})[f.to] && !named.includes(f.to)) out.push(`${p.id} faces "${f.to}", which is not in this shot`);
  }
  return out;
}

// self-test (node scripts/blockyWorlds/v2/facing.mjs)
if (process.argv[1]?.endsWith("facing.mjs")) {
  const row = { people: [{ id: "me", facing: "camera" }, { id: "grandpa" }] };
  const t = [
    [facingProblems(row, { lineText: "I looked at Grandpa.", named: ["me", "grandpa"] }).length === 1, "faces the lens while looking at Grandpa = fail"],
    [facingProblems(row, { lineText: "You won't believe this.", named: ["me"] }).length === 0, "talking to the viewer = ok"],
    [defaultFacing(row, "grandpa").to === "me", "default: faces the other person"],
    [defaultFacing({ people: [{ id: "me" }] }, "me").to === "street", "default alone: the stage's point of interest, not the lens"],
  ];
  for (const [ok, what] of t) console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  process.exit(t.every(([ok]) => ok) ? 0 : 1);
}
