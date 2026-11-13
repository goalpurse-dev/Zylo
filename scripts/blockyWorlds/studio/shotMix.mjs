// STUDIO MODE: the SHOT MIX rules (owner 2026-11-13), checked free before any render, from the stub run of each cut's
// code (studio/shotCheck.mjs) and the cut's declarations:
//   1. at least 3 of every 4 cuts show a character or the named thing DOING something (an act, an action pose, an
//      animal action, the creature acting, or something moving over 0.25 m during the cut)
//   2. empty wide / establishing cuts (a wide or low cut with no person, animal, pet or creature) at most 1 in 6, and
//      never the same building twice in a row (two cuts without a character aimed at the same house)
//   3. every named creature or animal is BUILT as a real character with a body and a face: a creature asset needs a body
//      (at least 6 solid parts) AND a face that reads at night (at least 2 glowing parts); never just lights
// -> { problems: [{ id?, line?, rule, problem }], stats: { doingShare, emptyWides, emptyWideShare } }
import { W, ownersOf } from "./world.js";
import { assetInfo } from "./shotCheck.mjs";

export const MIX = Object.freeze({ doing: 0.75, emptyWide: 1 / 6, creatureBody: 6, creatureFace: 2 });

/** the house a camera aims at (its look point within a house front's footprint), or null */
function houseAimed(look, homes) {
  if (!look || Math.abs(look[2] - W.HZ) > 6) return null;
  const owners = ownersOf(homes);
  for (const [i, o] of owners.entries()) { const x = W.HX0 + i * W.HDX; if (Math.abs(look[0] - x) <= W.HW / 2 + 1) return o; }
  return null;
}
const hasCharacter = (s) => (s.people ?? []).length > 0 || (s.codePeople ?? []).length > 0 || (s.pets ?? []).length > 0 || (s.animals ?? []).length > 0 || !!s.monster || !!s.creature || !!s.codeMonster || !!s.animalsDrawn;

/** a creature asset's own body + face check -> [string] */
export function creatureProblems(name, code, ctx = {}) {
  const i = assetInfo(code, ctx);
  if (!i.ok) return [`creature ${name}: ${i.errors[0]}`];
  const body = i.prims - i.glow, out = [];
  if (body < MIX.creatureBody) out.push(`creature ${name} has no real body (${body} solid parts; build a body with at least ${MIX.creatureBody}: torso, head, legs or paws...)`);
  if (i.glow < MIX.creatureFace) out.push(`creature ${name} has no face that reads at night (needs at least ${MIX.creatureFace} glowing parts: eyes, glow 1.5-3, plus a mouth / grin)`);
  return out;
}

export function shotMix(plan, tl, shotRes) {
  const problems = [], order = tl.shots.map((s) => plan.shots.find((p) => p.id === s.studio)).filter(Boolean);
  const n = order.length || 1;
  // 1. doing something
  const doing = order.filter((s) => shotRes[s.id]?.doing && hasCharacter({ ...s, animalsDrawn: shotRes[s.id]?.animalsDrawn }) || (shotRes[s.id]?.doing && (s.shows ?? []).length));
  const doingShare = doing.length / n;
  if (doingShare < MIX.doing) {
    const idle = order.filter((s) => !doing.includes(s)).map((s) => s.id);
    problems.push({ rule: "doing", problem: `only ${Math.round(doingShare * 100)}% of the cuts show someone or the named thing DOING something (needs ${Math.round(MIX.doing * 100)}%): give these cuts an action (an act, an action pose, the thing moving): ${idle.slice(0, 30).join(", ")}` });
  }
  // 2. empty wides + the same building twice in a row
  const empty = order.filter((s) => ["wide", "low"].includes(s.camType) && !hasCharacter({ ...s, animalsDrawn: shotRes[s.id]?.animalsDrawn }));
  const maxEmpty = Math.floor(n * MIX.emptyWide);
  if (empty.length > maxEmpty) problems.push({ rule: "emptyWide", problem: `${empty.length} empty wide / establishing cuts (no person, animal or creature; at most ${maxEmpty} for ${n} cuts): put the story's people / creature in some of them: ${empty.map((s) => s.id).join(", ")}` });
  for (let i = 1; i < order.length; i++) {
    const a = order[i - 1], b = order[i];
    if (hasCharacter(a) || hasCharacter(b)) continue;
    const ha = houseAimed(shotRes[a.id]?.look, plan.bible?.homes ?? {}), hb = houseAimed(shotRes[b.id]?.look, plan.bible?.homes ?? {});
    if (ha && ha === hb) problems.push({ id: b.id, line: b.line, rule: "sameBuilding", problem: `${a.id} and ${b.id} both show ${ha}'s house with nobody in it: never the same building twice in a row` });
  }
  // 3. creatures built as characters
  for (const name of plan.creatures ?? []) for (const p of creatureProblems(name, plan.assets[name] ?? "", { homes: plan.bible?.homes ?? {}, cast: tl.cast ?? {} })) problems.push({ rule: "creature", problem: p });
  if (tl.monster && !order.some((s) => s.creature || s.codeMonster || s.monster)) problems.push({ rule: "creature", problem: `the story's creature "${tl.monster.name}" is never on screen as a character` });
  return { problems, stats: { cuts: n, doingShare: +doingShare.toFixed(2), emptyWides: empty.length, emptyWideShare: +(empty.length / n).toFixed(3) } };
}
