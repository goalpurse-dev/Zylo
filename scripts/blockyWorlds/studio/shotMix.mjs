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
import { ANIMALS } from "./shotApi.js";

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

/** the climax: from the "But" pivot (a discovery / climax line starting with But), else the first climax line */
export function climaxStart(tl) {
  const lines = tl.lines ?? [];
  let pivot = lines.findIndex((l) => ["discovery", "climax"].includes(l.part) && /^\s*but\b/i.test(String(l.text)));
  if (pivot < 0) pivot = lines.findIndex((l) => l.part === "climax");
  return pivot < 0 ? Math.floor(lines.length * 0.7) : pivot;
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
    const wides = ["wide", "low"].includes(a.camType) && ["wide", "low"].includes(b.camType); // (owner 2026-11-13: no same house in back-to-back wides, people or not)
    if (!wides && (hasCharacter(a) || hasCharacter(b))) continue;
    const ha = houseAimed(shotRes[a.id]?.look, plan.bible?.homes ?? {}), hb = houseAimed(shotRes[b.id]?.look, plan.bible?.homes ?? {});
    if (ha && ha === hb) problems.push({ id: b.id, line: b.line, rule: "sameBuilding", problem: wides ? `${a.id} and ${b.id} are back-to-back wides of ${ha}'s house: never the same house in two wides in a row (another house, another angle, or a closer cut)` : `${a.id} and ${b.id} both show ${ha}'s house with nobody in it: never the same building twice in a row` });
  }
  // 3. creatures built as characters
  for (const name of plan.creatures ?? []) for (const p of creatureProblems(name, plan.assets[name] ?? "", { homes: plan.bible?.homes ?? {}, cast: tl.cast ?? {} })) problems.push({ rule: "creature", problem: p });
  // the script NAMES a creature (owner 2026-11-13): it is BUILT for this story from the script's own description (a
  // creature asset with a body and a glowing face), never the engine's stock monster
  // (a creature that IS an animal, "The Penthouse Pigeon", may be the kit animal scaled up, marked creature: true)
  const species = ANIMALS.find((a) => String(tl.monster?.name ?? "").toLowerCase().split(/[^a-z]+/).includes(a));
  const kitCreature = species && order.some((s) => s.creature && (shotRes[s.id]?.animalsDrawn || (s.animals ?? []).some((a) => a.species === species)));
  if (tl.monster) {
    if (!(plan.creatures ?? []).length && !kitCreature) problems.push({ rule: "creature", problem: `the script names "${tl.monster.name}": BUILD it as a creature asset from the script's own description (define_assets with creature: true: a body of 6+ parts and a glowing face) and draw it with api.asset` });
    const stock = order.filter((s) => s.monster || s.codeMonster);
    if (stock.length) problems.push({ rule: "creature", problem: `these cuts use the engine's stock monster (api.monster / monster staging), not the story's own "${tl.monster.name}": draw your built creature asset instead: ${stock.map((s) => s.id).join(", ")}` });
    if (!order.some((s) => s.creature)) problems.push({ rule: "creature", problem: `"${tl.monster.name}" is never on screen: show your built creature (and mark those cuts creature: true)` });
  }
  // 4. PROP SCALE (owner 2026-11-13): a small built thing (its own size up to 1.2 m: a bowl, toast, a toaster, a mailbox)
  //    is never drawn over 1.5 m, and a kit prop never over 2.5x, unless its line says giant / huge
  const BIG = /\b(giant|huge|enormous|massive|gigantic|towering|big)\b/i;
  for (const s of order) {
    const r = shotRes[s.id] ?? {}, bigLine = BIG.test(String(tl.lines?.[s.line]?.text ?? ""));
    if (bigLine) continue;
    const giant = (r.sizes ?? []).filter((z) => !(plan.creatures ?? []).includes(z.name) && z.natural <= 1.2 && z.world > 1.5);
    const kit = (r.propScales ?? []).filter((p) => p.scale > 2.5);
    if (giant.length || kit.length) problems.push({ id: s.id, line: s.line, rule: "propScale", problem: `${s.id}: ${[...giant.map((z) => `${z.name} drawn ${z.world} m big (its own size ${z.natural} m)`), ...kit.map((p) => `${p.name} at ${p.scale}x`)].join(", ")}: props must be a believable size next to a person (scale it down; nothing giant unless the line says so)` });
  }
  // 5. NO EMPTY FRAMES: a cut with no character, no animal / creature and nothing named (no "shows", no built thing,
  //    no prop) shows only walls / roofs / background
  const blank = order.filter((s) => !hasCharacter({ ...s, animalsDrawn: shotRes[s.id]?.animalsDrawn }) && !(s.shows ?? []).length && !(shotRes[s.id]?.assets ?? []).length && !(shotRes[s.id]?.props ?? []).length && !(s.props ?? []).length);
  if (blank.length) problems.push({ rule: "emptyFrame", problem: `${blank.length} cut(s) show only walls / roofs / background (no character, nothing named): ${blank.map((s) => s.id).join(", ")}` });
  // 6. CLIMAX CARE: from the "But" pivot (else the climax) to the end: the hero ("me") AND the creature (or the named
  //    thing) together in at least 60% of the cuts, close-ups for the reactions, no plain building wides (the hero's size
  //    on screen is measured on the rendered frames)
  const pivot = climaxStart(tl);
  const climax = order.filter((s) => s.line >= pivot);
  let climaxStats = null;
  if (climax.length) {
    const hero = (s) => (s.people ?? []).some((p) => p.id === "me") || (s.codePeople ?? []).includes("me");
    const thing = (s) => (tl.monster ? !!s.creature : (s.shows ?? []).length > 0 || (shotRes[s.id]?.assets ?? []).length > 0);
    const both = climax.filter((s) => hero(s) && thing(s)).length / climax.length;
    const close = climax.filter((s) => s.camType === "closeup").length;
    const wides = climax.filter((s) => ["wide", "low"].includes(s.camType) && !hasCharacter({ ...s, animalsDrawn: shotRes[s.id]?.animalsDrawn }));
    climaxStats = { fromLine: pivot, cuts: climax.length, heroWithThing: +both.toFixed(2), closeups: close };
    if (both < 0.6) problems.push({ rule: "climax", problem: `the climax (line ${pivot} on): the hero and ${tl.monster ? `"${tl.monster.name}"` : "the named thing"} are together in only ${Math.round(both * 100)}% of its ${climax.length} cuts (needs 60%): ${climax.filter((s) => !(hero(s) && thing(s))).map((s) => s.id).join(", ")}` });
    if (close < Math.max(2, Math.round(climax.length * 0.2))) problems.push({ rule: "climax", problem: `the climax has ${close} close-up(s): give its reactions close-ups (at least ${Math.max(2, Math.round(climax.length * 0.2))})` });
    if (wides.length) problems.push({ rule: "climax", problem: `plain building wides in the climax (no character): ${wides.map((s) => s.id).join(", ")}` });
  }
  return { problems, stats: { cuts: n, doingShare: +doingShare.toFixed(2), emptyWides: empty.length, emptyWideShare: +(empty.length / n).toFixed(3), emptyFrames: blank.length, climax: climaxStats } };
}
