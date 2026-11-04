// Blocky Worlds director: checkProduction, the PERMANENT RULE read from the story's meaning. For every script line,
// every item the production list says the line needs (perLine[i].required, from match.js) must be on screen in one of
// that line's shots: the cast member acting, the creature / giant, the crowd, the object or its built asset, the world,
// or (last resort) a picture card naming it.
//   checkProduction(tl, match) -> [{ line, text, missing: [{ id, name, route }] }]
// ADVISORY until plan.mjs reads the production list (CONTRACT.md addendum "the story director"): today the planner
// still plans from its own word rules, so a miss here is a report, not a failed run. Once the planner consumes the
// list, the prepare job runs it next to checkVisuals / checkSubjects and a miss stops the run like theirs.
// Timeline fields read (CONTRACT.md + the EPIC and BUILDER addenda): shot.lines | shot.line, set ("world:<id>",
// "creature:..."), worldBase, world (EPIC { creature, view }), actors[].id / hold, focus, objects[].name / asset /
// aliases / state, monsterState, insert { kind, text }, marker(s), giants[], crowds[], fx, beat.

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const shotsOfLine = (tl, i) => (tl.shots ?? []).filter((s) => (s.lines ?? [s.line]).includes(i));

function onScreen(req, s, tl) {
  const name = norm(req.name), id = req.id;
  const cardSays = s.insert && /card|sign|note/.test(s.insert.kind ?? "") && norm(s.insert.text).split(" ").some((w) => w.length > 2 && name.includes(w));
  const badge = [...(s.markers ?? []), ...(s.marker ? [s.marker] : [])].some((m) => norm(m.text).split(" ").some((w) => w.length > 2 && name.includes(w)));
  const objs = s.objects ?? [];
  const objHit = objs.some((o) => o.needId === req.needId || o.name === req.kitName || norm(o.name.replace(/_/g, " ")) === name || (o.aliases ?? []).some((a) => norm(a) === name) || (req.kitName === "item" && o.name === "item"));
  switch (req.kind) {
    case "world":
      if (req.route === "set") return s.set === req.set || String(s.worldBase ?? "") === req.set || String(s.set).startsWith("world:");
      return String(s.set).startsWith("world:") || String(s.set).startsWith("creature") || !!s.world?.creature || s.set === req.set || cardSays;
    case "cast":
      if (req.route === "kit" && req.kitName === "person") return (s.actors ?? []).some((a) => a.id === id) || s.focus === id;
      return objHit || cardSays || badge;
    case "creature":
      if (String(req.kitName ?? "").startsWith("monster:")) return !!s.monsterState || s.focus === "monster";
      if (req.route === "epic") return (s.giants ?? []).length > 0 || !!s.world?.creature || objHit || cardSays;
      return objHit || cardSays || badge;
    case "crowd":
      return (s.crowds ?? []).length > 0 || s.focus === "group" || (s.actors ?? []).length >= 3 || objs.length >= 2 || badge;
    case "prop":
      if (String(req.kitName ?? "").startsWith("held:")) { const h = req.kitName.slice(5); return (s.actors ?? []).some((a) => a.hold === h || norm(a.hold) === name) || objs.some((o) => o.name === "item" && o.state === h) || cardSays; }
      return objHit || cardSays || badge;
    case "effect":
      return (s.fx ?? []).length > 0 || !!s.fx || cardSays || badge;
    case "event":
      return objHit || s.light === String(req.kitName ?? "").replace("light:", "") || cardSays || badge;
    default:
      return objHit || cardSays || badge;
  }
}

export function checkProduction(tl, match) {
  const out = [];
  for (const L of match?.perLine ?? []) {
    const shots = shotsOfLine(tl, L.line);
    const missing = L.required.filter((r) => !shots.some((s) => onScreen(r, s, tl))).map((r) => ({ id: r.id, name: r.name ?? r.id, route: r.route }));
    if (missing.length) out.push({ line: L.line, text: L.text, missing });
  }
  return out;
}
