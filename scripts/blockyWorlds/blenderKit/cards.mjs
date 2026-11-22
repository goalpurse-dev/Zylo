import { THINGS } from "../../../supabase/functions/_shared/blockyWorlds/engineKit.js";
import { dressOf } from "../../../supabase/functions/_shared/blockyWorlds/worldState.js";
// THE CARD COMPILER (owner 2026-11-21, round 2): the director's shot cards (director2.mjs, data) -> the engine's shot code
// (Python bodies for worlds.py + worlds/acts.py). The model never writes code: every card field maps to one helper, so a
// card can only ask for what the engine has. Pure (no I/O).
const py = (v) => JSON.stringify(v ?? null).replace(/\bnull\b/g, "None").replace(/\btrue\b/g, "True").replace(/\bfalse\b/g, "False");
const ident = (s, i) => `${String(s).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "x"}_${i}`;
const GESTURES = { wave: "wave", cheer: "cheer", shrug: "shrug", facepalm: "facepalm", think: "think", hands_head: "hands_head" };

/** the look of a cast name from the plan (case-insensitive), or null */
const lookOf = (plan, who) => (plan.cast ?? []).find((c) => String(c.name).toLowerCase() === String(who).toLowerCase()) ?? null;

/**
 * one card -> the shot body (Python lines, not indented). ctx: { plan, speaker, speech }
 * t0 / t1 are the shot's own times inside the body (the @S decorator passes them).
 */
export function compileCard(card, { plan, speaker = null, speech = false } = {}) {
  const L = [];
  const place = card.place;
  L.push(`ZW_INFO = zw_build(${py(place)}, t0, t1, ${py({ time: card.time ?? "day" })})`);
  L.push("cam = Cam()");
  L.push(`st_c, st_d, st_r, st_rot = zw_stage(${py(place)})`);
  L.push("dur = max(0.4, t1 - t0)");
  const people = (card.cast ?? []).filter((p) => !/^monster$/i.test(p.who));
  const hasMon = (card.cast ?? []).some((p) => /^monster$/i.test(p.who)) && plan.monster?.present;
  const vars = {}, things = {};
  // the cast on stage marks, left to right
  people.forEach((p, k) => {
    const v = ident(p.who, k); vars[String(p.who).toLowerCase()] = v;
    L.push(`${v} = zw_person(${py(p.who)}, ${py(lookOf(plan, p.who) ?? {})}, zw_spotpos(${py(place)}, ${k}, ${people.length}), st_rot, t0)`);
  });
  if (hasMon) {
    const size = Math.min(4, Math.max(3, Number(plan.monster.size) || 3.5));
    vars.monster = "mon";
    L.push(`mon = zw_monster("Monster", zw_spotpos(${py(place)}, 0, 1, depth=${people.length ? 9 : 4}), rot=st_rot, size=${size}, style=${py(plan.monster.style && plan.monster.style !== "none" ? plan.monster.style : "horns")})`);
  }
  // the props: next to the first person who uses them, else in front of the stage
  (card.props ?? []).forEach((p, k) => {
    const v = ident(p.kind, k); things[p.kind] = v;
    const user = (card.cast ?? []).find((c) => String(c.target ?? "").toLowerCase() === p.kind) ?? people[0];
    const near = user && vars[String(user.who).toLowerCase()] && vars[String(user.who).toLowerCase()] !== "mon" ? `${vars[String(user.who).toLowerCase()]}.root.location` : "st_c";
    const size = (plan.props ?? []).find((x) => x.kind === p.kind)?.size ?? 1.2;
    if (p.effect === "rain") { L.push(`${v} = None`); L.push(`zw_rain(${py(p.kind)}, t0, t1, area=((st_c.x - 8, st_c.x + 8), (st_c.y - 6, st_c.y + 10)), n=${Math.min(60, Math.max(12, p.count || 30))})`); return; }
    const n = Math.min(6, Math.max(1, p.count || 1));
    L.push(`${v} = zw_thing(${py(p.kind)}, (${near}.x + st_r.x * ${1.5 + k * 0.6} - st_d.x * 0.8, ${near}.y + st_r.y * ${1.5 + k * 0.6} - st_d.y * 0.8, 0.0), size=${size})`);
    for (let j = 1; j < n; j++) L.push(`zw_thing(${py(p.kind)}, (${near}.x + st_r.x * ${(1.5 + k * 0.6 + j * 1.1).toFixed(2)} - st_d.x * ${(0.8 + (j % 2) * 1.2).toFixed(2)}, ${near}.y + st_r.y * ${(1.5 + k * 0.6 + j * 1.1).toFixed(2)} - st_d.y * ${(0.8 + (j % 2) * 1.2).toFixed(2)}, 0.0), size=${size})`);
    if (p.effect === "pop") L.push(`zw_pop(${v}, t0 + 0.3 * dur)`);
    else if (p.effect === "grow") L.push(`zw_grow_obj(${v}, t0 + 0.1 * dur, t1, 0.4, 1.6)`);
    else if (p.effect === "shrink") L.push(`zw_grow_obj(${v}, t0 + 0.1 * dur, t1, 1.4, 0.3)`);
  });
  const target = (t) => {
    const k = String(t ?? "").toLowerCase();
    if (!k) return null;
    if (vars[k]) return vars[k];
    if (things[k]) return things[k];
    if (/monster/.test(k) && vars.monster) return vars.monster;
    return null;
  };
  // the actions, start to end
  for (const p of card.cast ?? []) {
    const v = vars[String(p.who).toLowerCase()]; if (!v) continue;
    const tg = target(p.target);
    const at = tg ? tg : "(st_c.x - st_d.x * 6, st_c.y - st_d.y * 6, 0.0)";
    switch (p.action) {
      case "walk": L.push(tg ? `zw_walk_to(${v}, t0, t1, ${tg})` : `${v}.pose(t0, loc=(${v}.root.location.x - st_r.x * 4, ${v}.root.location.y - st_r.y * 4, 0), rot=st_rot)\nzw_walk_to(${v}, t0, t1, zw_spotpos(${py(place)}, 0, 1))`); break;
      case "run_away": L.push(`zw_run_away(${v}, t0, t1, ${tg ?? (vars.monster ?? "st_c")}, dist=8.0)`); break;
      case "fall": L.push(`zw_fall(${v}, t0 + 0.3 * dur)`); break;
      case "sit": L.push(`zw_sit(${v}, t0 + 0.2 * dur, seat=${tg && things[String(p.target).toLowerCase()] ? tg : "None"})`); break;
      case "point": L.push(`zw_point(${v}, t0 + 0.1 * dur, ${at})`); break;
      case "stomp": L.push(`zw_stomp(${v}, t0 + 0.2 * dur)`); break;
      case "grab": if (tg) L.push(`zw_grab(${v}, t0 + 0.3 * dur, ${tg})`); break;
      case "throw": if (tg && things[String(p.target).toLowerCase()]) L.push(`zw_throw(${v}, t0 + 0.2 * dur, t1, ${tg}, (st_c.x + st_d.x * 4, st_c.y + st_d.y * 4, 0.0))`); break;
      case "hug": if (tg && tg !== v) L.push(`zw_hug(${v}, ${tg}, t0, t1)`); break;
      case "reach": L.push(`zw_reach(${v}, t0 + 0.3 * dur, ${at})`); break;
      case "jump": L.push(`${v}.jump(t0 + 0.3 * dur)`); break;
      case "follow": if (tg && tg !== v) L.push(`zw_follow(${v}, ${tg}, t0, t1)`); break;
      case "hide": L.push(tg ? `zw_walk_to(${v}, t0, t1, ${tg})` : `zw_walk_to(${v}, t0, t1, (st_c.x + st_d.x * 3, st_c.y + st_d.y * 3, 0.0))`); break;
      // the hole is the drain / box / thing it climbs out of when the card has it (one drain on screen, not two)
      case "climb_out": if (v === "mon") L.push(tg && tg !== "mon" && Object.values(things).includes(tg) ? `zw_climb_out(mon, t0, t0 + 0.8 * dur, hole=(${tg}.location.x, ${tg}.location.y))` : `zw_climb_out(mon, t0, t0 + 0.8 * dur, hole=(mon.root.location.x, mon.root.location.y))`); break;
      case "roar": L.push(`${v}.act(t0 + 0.2 * dur, "fists")`); break;
      case "scream": L.push(`${v}.act(t0 + 0.1 * dur, "hands_head")`); break;
      case "laugh": L.push(`${v}.act(t0 + 0.1 * dur, "cheer")`); break;
      default: if (GESTURES[p.action]) L.push(`${v}.act(t0 + 0.1 * dur, ${py(GESTURES[p.action])})`);
    }
    // the face (the speaker's lips move on a spoken line)
    if (v !== "mon") {
      const face = p.face || (p.action === "laugh" ? "laughing" : p.action === "cry" ? "crying" : p.action === "scream" ? "terrified" : "neutral");
      const talk = speech && speaker && String(p.who).toLowerCase() === String(speaker).toLowerCase();
      L.push(`zw_emote(${v}, t0, t1, ${py(face)}${talk ? ", talk=True" : ""})`);
    }
  }
  if (hasMon && card.camera === "monster_reveal") L.push("zw_flee(mon, t0, t1, n=3)");
  // the camera, measured on what the card must show
  const pv = [...people.map((p) => vars[String(p.who).toLowerCase()]), ...(hasMon ? ["mon"] : [])];
  const tv = Object.values(things).filter((x) => x);
  if (!pv.length && !tv.length) L.push(`zw_spot(cam, ${py(place)}, "wide", t0, t1)`);
  else L.push(`zw_shot(cam, ${py(card.camera === "close" ? "close" : card.camera)}, t0, t1, people=[${(card.camera === "close" && speaker && vars[String(speaker).toLowerCase()] ? [vars[String(speaker).toLowerCase()]] : pv).join(", ")}], things=[${card.camera === "close" ? "" : tv.join(", ")}], move=${py(card.move ?? "push")})`);
  return L.join("\n");
}

// ================================================================ ROUND 2 REWORK: SCENE CARDS (start frame -> end frame)
const MOVE_ACTIONS = new Set(["walk", "run_away", "follow", "hide", "hug"]);
/**
 * a scene card (sceneCards.mjs) -> the shot body. ctx: { plan, scene, speaker }. Everyone starts on their START mark /
 * pose / face, goes to the END mark on their move step (else over the whole scene), takes the END pose and face; things
 * appear / grow / shrink / get grabbed / thrown / fall from the sky on their words; the camera goes from the start
 * framing to the end framing (zw_scene_cam).
 */
export function compileScene(card, { plan, scene, speaker = null, world = null, indoor = false, establish = null, cut = false } = {}) {
  const L = [];
  const S = card.start, E = card.end, place = S.place;
  const sdur = Math.max(0.4, scene.end - scene.start);
  const u = (i) => Math.max(0, Math.min(0.95, ((scene.wordList[i]?.start ?? scene.start) - scene.start) / sdur)).toFixed(3);
  // round 3: the line's WORLD STATE is the dress (worldState.js dressOf: busy / walkers / extras / cars / windows / curtains / threat)
  const dress = world ? dressOf({ ...world, time: S.time ?? world.time }, { indoor }) : { time: S.time ?? "day" };
  L.push(`ZW_INFO = zw_build(${py(place)}, t0, t1, ${py(dress)})`);
  L.push("cam = Cam()", "dur = max(0.4, t1 - t0)", `st_c, st_d, st_r, st_rot = zw_stage(${py(place)})`);
  // the people: everyone in either frame
  // a lamp bulb prop on a street is the world's own street lamp (the first storyboards: a glare blob on the ground)
  const keepProp = (p) => !(["lamp_bulb", "light_bulb"].includes(p.kind) && !/\bbulbs?\b/i.test(scene.words));
  S.props = (S.props ?? []).filter(keepProp); E.props = (E.props ?? []).filter(keepProp);
  // everyone in either frame OR named by a motion step (the director sometimes puts the monster only in the motion)
  // (round 6: the monster is made LAST, so its spot can be cleared of everyone already standing there)
  const names = [...new Set([...(S.people ?? []), ...(E.people ?? []), ...(card.motion ?? [])].map((p) => String(p.who)).filter(Boolean))]
    .sort((a, b) => (/^monster$/i.test(a) ? 1 : 0) - (/^monster$/i.test(b) ? 1 : 0));
  const at0 = (f, who) => (f.people ?? []).find((p) => String(p.who).toLowerCase() === who.toLowerCase()) ?? null;
  // a monster that only climbs out in the motion: hidden at the start, standing at the thing it climbs out of at the end
  const climb = (card.motion ?? []).find((m) => /^monster$/i.test(m.who) && m.action === "climb_out");
  const thingMark = (kind) => [...(S.props ?? []), ...(E.props ?? [])].find((p) => p.kind === String(kind ?? "").toLowerCase())?.mark;
  const at = (f, who) => {
    const p = at0(f, who);
    if (p || !/^monster$/i.test(who)) return p;
    const mk = thingMark(climb?.target) ?? "back";
    if (climb) return f === S ? { who, mark: mk, pose: "climb", face: "angry", looks_at: "camera" } : { who, mark: mk, pose: "stand", face: "angry", looks_at: "camera" };
    return f === E || (card.motion ?? []).some((m) => /^monster$/i.test(m.who)) ? { who, mark: "back", pose: "stand", face: "angry", looks_at: "camera" } : null;
  };
  // the frames as the camera sees them (the monster added where the motion puts it)
  for (const f of [S, E]) if (names.some((n) => /^monster$/i.test(n)) && !at0(f, "monster") && at(f, "monster")) f.people = [...(f.people ?? []), at(f, "monster")];
  const v = {};
  const markUse = {};
  const markPos = (mark) => { const k = markUse[mark] = (markUse[mark] ?? -1) + 1; return `zw_mark(${py(place)}, ${py(mark)}, ${k})`; };
  const hasMon = names.some((n) => /^monster$/i.test(n)) && plan.monster?.present;
  names.forEach((who, k) => {
    const a = at(S, who), b = at(E, who);
    const startMark = a && a.pose !== "hidden" ? a.mark : (b ? (/^monster$/i.test(who) ? b.mark : (b.mark.includes("right") ? "offscreen_right" : "offscreen_left")) : "center");
    if (/^monster$/i.test(who)) {
      if (!hasMon) return;
      v[who.toLowerCase()] = "mon";
      L.push(`mon = zw_monster("Monster", ${markPos(startMark === "center" ? "back" : startMark)}, rot=st_rot, size=${Math.min(4, Math.max(3, Number(plan.monster.size) || 3.5))}, style=${py(plan.monster.style && plan.monster.style !== "none" ? plan.monster.style : "horns")})`);
      return;
    }
    const id = ident(who, k); v[who.toLowerCase()] = id;
    const look = (plan.cast ?? []).find((c) => String(c.name).toLowerCase() === who.toLowerCase()) ?? {};
    L.push(`${id} = zw_person(${py(who)}, ${py(look)}, ${markPos(startMark)}, st_rot, t0)`);
  });
  // round 5 (rule 4: what a line names is seen): a THING the words name that neither frame has comes in, at the first
  // person's mark, held when the words say so ("I grab my ball": the ball was never there)
  {
    const have = new Set([...(S.props ?? []), ...(E.props ?? [])].map((p) => p.kind));
    const first = (S.people ?? []).find((p) => p.pose !== "hidden" && !/^offscreen/.test(p.mark) && !/^monster$/i.test(p.who)) ?? (E.people ?? [])[0];
    const holdW = /\b(grab|grabs|hold|holds|holding|carry|carries|take|takes|pick|picks|throw|throws)\b/i.test(scene.words ?? "");
    for (const k of THINGS) {
      if (have.has(k) || !new RegExp(`\\b${k.replace("_", " ")}s?\\b`, "i").test(scene.words ?? "")) continue;
      const held = holdW && first ? { state: "held", held_by: first.who } : { state: "normal", held_by: "" };
      S.props = [...(S.props ?? []), { kind: k, mark: first?.mark ?? "center", count: 1, ...(/^monster$/i.test(first?.who ?? "") ? { state: "normal", held_by: "" } : held) }];
      E.props = [...(E.props ?? []), { kind: k, mark: first?.mark ?? "center", count: 1, state: "normal", held_by: "" }];
    }
  }
  // the things: everything in either frame (by kind)
  const kinds = [...new Set([...(S.props ?? []), ...(E.props ?? [])].map((p) => p.kind))];
  const pa = (f, kind) => (f.props ?? []).find((p) => p.kind === kind) ?? null;
  const tv = {};
  kinds.forEach((kind, k) => {
    const a = pa(S, kind), b = pa(E, kind);
    const size = (plan.props ?? []).find((x) => x.kind === kind)?.size ?? 1.2;
    const named = new RegExp(`\\b${kind.replace("_", " ")}s?\\b`, "i").test(scene.words ?? "");
    // real sizes (crowds.py ZW_THING_SIZE: next to a 5.2-unit kid); a named thing bigger to read on a phone, less when held
    const heldK = [...(S.props ?? []), ...(E.props ?? [])].some((p) => p.kind === kind && p.state === "held");
    // next to the MONSTER (3-4x a person) a named thing scales with it (round 5: "it plays with my shoe": a speck)
    const monScene = names.some((n) => /^monster$/i.test(n)) && plan.monster?.present;
    // (round 6: zw_tsize = the real size at this shot's people's scale, town.py)
    const sz = `zw_tsize(${py(kind)}, ${size})${named ? (monScene ? " * 3.2" : heldK ? " * 1.3" : " * 1.7") : ""}`;
    if ((a?.state ?? b?.state) === "falling") { L.push(`zw_rain(${py(kind)}, t0, t1, area=((st_c.x - 8, st_c.x + 8), (st_c.y - 4, st_c.y + 10)), n=${Math.min(50, Math.max(12, (a ?? b).count || 30))})`); return; }
    const id = ident(kind, 100 + k); tv[kind] = id;
    const mark = (a && a.state !== "hidden" ? a.mark : b?.mark) ?? "center";
    // a BIG thing that appears (pops in) gets room: nobody stands on it (round 6)
    const pops = (!a || a.state === "hidden") && b && b.state !== "hidden";
    const big = Number(size) >= 3 || ["ice_cream_cart", "tree_small", "fridge", "door", "wall_boards", "crate", "sign"].includes(kind);
    const at3 = `(zw_mark(${py(place)}, ${py(mark)})[0] - st_d.x * 1.2 + st_r.x * 1.2, zw_mark(${py(place)}, ${py(mark)})[1] - st_d.y * 1.2 + st_r.y * 1.2, 0.0)`;
    L.push(`${id} = zw_thing(${py(kind)}, ${pops && big ? `zw_clear_spot(${at3}, 3.5 * zw_ps())` : at3}, size=${sz})`);
    const n = Math.min(6, Math.max(1, (b ?? a)?.count || 1));
    for (let j = 1; j < n; j++) L.push(`zw_thing(${py(kind)}, (${id}.location.x + st_r.x * ${(j * 1.4).toFixed(1)}, ${id}.location.y + st_r.y * ${(j * 1.4).toFixed(1)} + st_d.y * ${((j % 2) * 1.1).toFixed(1)}, 0.0), size=${sz})`);
  });
  const tgt = (t) => { const k = String(t ?? "").toLowerCase(); if (!k) return null; if (v[k]) return v[k]; if (tv[k]) return tv[k]; if (/monster/.test(k) && v.monster) return v.monster; if (k === "camera") return "(st_c.x - st_d.x * 12, st_c.y - st_d.y * 12, 0.0)"; return null; };
  // start poses + faces (reached by t0: set a little before)
  for (const who of names) {
    const id = v[who.toLowerCase()]; if (!id) continue;
    const a = at(S, who); if (!a) continue;
    if (a.looks_at && tgt(a.looks_at) && id !== "mon") L.push(`${id}.pose(t0 - 0.3, rot=za_yaw(za_here(${id}, t0), za_pos(${tgt(a.looks_at)})))`);
    if (a.pose === "climb" && id === "mon") continue;
    L.push(`zw_posed(${id}, t0 - 0.3, ${py(a.pose)}, ${tgt(a.looks_at) ?? "None"})`);
    if (id !== "mon") L.push(`zw_emote(${id}, t0, t1, ${py(a.face || "neutral")}${speaker && who.toLowerCase() === String(speaker).toLowerCase() ? ", talk=True" : ""})`);
  }
  // held things in the start frame
  for (const kind of kinds) { const a = pa(S, kind); if (a?.state === "held" && tv[kind] && tgt(a.held_by)) L.push(`zw_grab(${tgt(a.held_by)}, t0 - 0.05, ${tv[kind]})`); }
  // the motion steps, on their words
  const moved = new Set();
  for (const m of card.motion ?? []) {
    const id = v[String(m.who).toLowerCase()] ?? (/^monster$/i.test(m.who) ? v.monster : null); if (!id) continue;
    const ta = `(t0 + ${u(m.on_word)} * dur)`;
    const T = tgt(m.target);
    const b = at(E, m.who);
    const endPos = b ? `zw_mark(${py(place)}, ${py(b.mark)})` : null;
    switch (m.action) {
      case "walk": case "hide": moved.add(id); L.push(`zw_walk_to(${id}, ${ta}, t1, ${endPos ?? T ?? "st_c"})`); break;
      // (round 6: the kit's own run was the "running on the spot": always the motion library's run, the body moves)
      case "run_away": moved.add(id); L.push(endPos ? `zm_walk(${id}, ${ta}, t1, ${endPos}, run=True)` : `zw_run_away(${id}, ${ta}, t1, ${T ?? (v.monster ?? "st_c")}, dist=9.0 * zw_ps())`); break;
      // round 6: full actions: kids PLAY (tag round a circle with whoever the target is, or a ball kicked between two);
      // GIVE / SELL a thing from hand to hand (the taker walks up, takes it, walks off happy)
      case "play": { moved.add(id); const other = T && !Object.values(tv).includes(T) && T !== id ? T : null; if (other) moved.add(other);
        L.push(tv.ball && other ? `zm_pass_ball(${id}, ${other}, ${ta}, t1, ${tv.ball})` : `zm_tag([${[id, other].filter(Boolean).join(", ")}], ${ta}, t1, za_here(${id}, ${ta}))`); break; }
      case "give": case "sell": { const taker = T && !Object.values(tv).includes(T) && T !== id ? T : null; const thing = Object.entries(tv).find(([k]) => !/cart/.test(k))?.[1] ?? null;
        if (taker) { moved.add(taker); L.push(`zm_give(${id}, ${taker}, ${thing ?? "None"}, ${ta}, t1)`); } break; }
      // a THING to follow (round 3 test: "the monster follows the shoe" crashed: zw_follow takes a character) = walk to it
      case "follow": moved.add(id); if (T && T !== id) L.push(Object.values(tv).includes(T) ? `zw_walk_to(${id}, ${ta}, t1, (${T}.location.x, ${T}.location.y, 0.0))` : `zw_follow(${id}, ${T}, ${ta}, t1)`); break;
      case "hug": moved.add(id); if (T && T !== id) L.push(`zm_hug(${id}, ${T}, ${ta}, t1)`); break;
      case "fall": L.push(`zm_fall(${id}, ${ta})`); break;
      case "sit": L.push(`zw_sit(${id}, ${ta}, seat=${T && tv[String(m.target).toLowerCase()] ? T : "None"})`); break;
      case "point": L.push(`zw_point(${id}, ${ta}, ${T ?? "None"})`); break;
      case "reach": L.push(`zw_reach(${id}, ${ta}, ${T ?? "None"})`); break;
      case "stomp": L.push(`zw_stomp(${id}, ${ta})`); break;
      case "grab": if (T && tv[String(m.target).toLowerCase()]) L.push(`zw_grab(${id}, ${ta}, ${T})`); break;
      case "throw": { const k = String(m.target).toLowerCase(); const thing = tv[k] ?? Object.values(tv)[0]; const land = pa(E, k) ? `zw_mark(${py(place)}, ${py(pa(E, k).mark)})` : "(st_c.x + st_d.x * 4, st_c.y + st_d.y * 4, 0.0)"; if (thing) L.push(`zw_throw(${id}, ${ta}, t1, ${thing}, ${land})`); break; }
      case "jump": L.push(`zm_jump(${id}, ${ta})`); break;
      case "turn": L.push(`zm_turn(${id}, ${ta}, ${T ? `za_yaw(za_here(${id}, ${ta}), za_pos(${T}))` : "zm_yaw_at(" + id + ", " + ta + ") + 180.0"})`); break;
      case "look_around": L.push(`zm_look_around(${id}, ${ta}, t1)`); break;
      case "stand_up": L.push(`zm_stand_up(${id}, ${ta})`); break;
      case "lie_down": L.push(`zm_lie(${id}, ${ta})`); break;
      case "read": L.push(`zm_read(${id}, ${ta}, t1${tv.book ? `, ${tv.book}` : ""})`); break;
      case "phone": L.push(`zm_phone(${id}, ${ta}, t1${tv.phone ? `, ${tv.phone}` : ""})`); break;
      case "kick": L.push(`zm_kick(${id}, ${ta}, ${tv.ball ?? T ?? "zm_ball()"}, ${b ? `zw_mark(${py(place)}, ${py(b.mark)})` : "(st_c.x + st_d.x * 6, st_c.y + st_d.y * 6, 0.45)"})`); break;
      case "catch": L.push(`zm_catch(${id}, ${ta})`); break;
      case "talk": L.push(`zm_talk(${id}, ${ta}, t1)`); break;
      case "nod": L.push(`zm_nod(${id}, ${ta})`); break;
      case "shake_head": L.push(`zm_shake_head(${id}, ${ta})`); break;
      case "pick_up": if (T && tv[String(m.target).toLowerCase()]) L.push(`zm_pick_up(${id}, ${ta}, ${T})`); break;
      case "carry": moved.add(id); if (T && tv[String(m.target).toLowerCase()]) L.push(`zm_carry(${id}, ${ta}, t1, ${endPos ?? "st_c"}, ${T})`); break;
      case "open_door": case "close_door": L.push(`zm_door(${id}, ${ta}, None)`); break;
      case "peek": moved.add(id); L.push(`zm_hide_peek(${id}, ${ta}, t1, ${T ?? "(st_c.x + st_r.x * 3, st_c.y + st_r.y * 3, 0.0)"})`); break;
      case "shiver": L.push(`zm_shiver(${id}, ${ta}, t1)`); break;
      case "cry": L.push(`zm_cry(${id}, ${ta}, t1)`); break;
      case "cheer": L.push(`zm_cheer(${id}, ${ta})`); break;
      case "wave": L.push(`zm_wave(${id}, ${ta}, t1)`); break;
      // (round 6: the hole is where the monster was made: a spot already cleared of every person)
      case "climb_out": if (id === "mon") { moved.add(id); L.push(`zw_climb_out(mon, ${ta} - 0.9 * dur, min(t1, ${ta} + 0.35 * dur), hole=(mon.root.location.x, mon.root.location.y))`); } break;
      case "roar": L.push(`${id}.act(${ta}, "fists")`); break;
      case "scream": L.push(`${id}.act(${ta}, "hands_head")`); break;
      case "laugh": L.push(`${id}.act(${ta}, "cheer")`); break;
      default: if (GESTURES[m.action]) L.push(`${id}.act(${ta}, ${py(GESTURES[m.action])})`);
    }
  }
  // everyone not moved by a step but on another mark at the end: over the whole scene
  for (const who of names) {
    const id = v[who.toLowerCase()]; if (!id || moved.has(id)) continue;
    const a = at(S, who), b = at(E, who);
    if (b && (!a || a.mark !== b.mark || a.pose === "hidden")) {
      if (id === "mon" && a?.pose === "climb") L.push(`zw_climb_out(mon, t0, t0 + 0.85 * dur, hole=(mon.root.location.x, mon.root.location.y))`);
      else { moved.add(id); L.push(`zm_walk(${id}, t0, t1 - 0.05, zw_mark(${py(place)}, ${py(b.mark)}), run=${(a?.pose ?? b.pose) === "run" ? "True" : "False"})`); }
    }
  }
  // NO RUNNING ON THE SPOT (round 6): a person posed walking / running who no step moves goes forward
  for (const who of names) {
    const id = v[who.toLowerCase()]; if (!id || id === "mon" || moved.has(id)) continue;
    const a = at(S, who), b = at(E, who);
    const pose = [a?.pose, b?.pose].find((p) => p === "run" || p === "walk");
    if (pose) L.push(`zm_walk(${id}, t0, t1, zw_ahead(${id}, t0, ${pose === "run" ? 7 : 3.5} * zw_ps() * (t1 - t0)), run=${pose === "run" ? "True" : "False"}, turn=False)`);
  }
  // end poses + faces (reached by t1)
  for (const who of names) {
    const id = v[who.toLowerCase()]; if (!id) continue;
    const a = at(S, who), b = at(E, who); if (!b) continue;
    if (b.pose !== (a?.pose ?? "") && b.pose !== "walk" && b.pose !== "run") L.push(`zw_posed(${id}, max(t0 + 0.3 * dur, t1 - 0.3), ${py(b.pose)}, ${tgt(b.looks_at) ?? "None"})`);
    if (id !== "mon" && b.face && b.face !== a?.face) L.push(`zw_face_at(${id}, max(t0 + 0.3 * dur, t1 - 0.3), ${py(b.face)})`);
  }
  // the things' changes (appear / grow / shrink / grabbed)
  for (const kind of kinds) {
    const a = pa(S, kind), b = pa(E, kind), id = tv[kind]; if (!id) continue;
    const step = (card.motion ?? []).find((m) => String(m.target).toLowerCase() === kind);
    const ta = step ? `(t0 + ${u(step.on_word)} * dur)` : "(t0 + 0.35 * dur)";
    if ((!a || a.state === "hidden") && b && b.state !== "hidden") L.push(`zw_pop(${id}, ${ta})`);
    else if (a && a.state !== "big" && b?.state === "big") L.push(`zw_grow_obj(${id}, ${ta}, t1, 1.0, 1.8)`);
    else if (a && a.state !== "small" && b?.state === "small") L.push(`zw_grow_obj(${id}, ${ta}, t1, 1.0, 0.4)`);
    else if (a && a.state !== "hidden" && b?.state === "hidden") L.push(`zw_grow_obj(${id}, ${ta}, ${ta} + 0.2, 1.0, 0.001)`);
    if (b?.state === "held" && a?.state !== "held" && tgt(b.held_by) && !(card.motion ?? []).some((m) => m.action === "grab" && String(m.target).toLowerCase() === kind)) L.push(`zw_grab(${tgt(b.held_by)}, ${ta}, ${id})`);
  }
  // the fleeing extras only where the world state has people (round 4: "strangers" on the empty night street)
  if (hasMon && (S.camera.type === "monster_reveal" || E.camera.type === "monster_reveal") && !(world && (world.busy === "empty" || indoor))) L.push("zw_flee(mon, t0, t1, n=3)");
  // the camera: start framing -> end framing, each on what that frame shows
  const vis = (f) => ({
    // round 5: a monster climbing out IS framed (it is already half out when the words begin: card 10 showed only spikes)
    p: (f.people ?? []).filter((p) => p.pose !== "hidden" && !/^offscreen/.test(p.mark)).map((p) => v[String(p.who).toLowerCase()]).filter(Boolean),
    t: (f.props ?? []).filter((p) => p.state !== "hidden" && p.state !== "falling").map((p) => tv[p.kind]).filter(Boolean),
  });
  const camSpec = (f) => {
    let x = vis(f);
    // an end frame everyone has left (walked off / gone inside) keeps the start's people (round 5: a flat empty wall)
    if (f === E && !x.p.length && !x.t.length) x = vis(S);
    let people = x.p;
    if (f.camera.type === "close") { const sp = speaker && v[String(speaker).toLowerCase()]; people = sp && people.includes(sp) ? [sp] : people.filter((p) => p !== "mon").slice(0, 1); }
    // a cut between two equal framings would be a jump: the second half from another side
    const same = cut && f === E && S.camera.type === E.camera.type && (S.camera.side ?? "front") === (E.camera.side ?? "front");
    const side = same ? ((S.camera.side ?? "front") === "front" ? "left" : "front") : (f.camera.side ?? "front");
    return `(${py(f.camera.type)}, [${people.join(", ")}], [${f.camera.type === "close" ? "" : x.t.join(", ")}], ${py(side)})`;
  };
  const any = vis(S).p.length + vis(S).t.length + vis(E).p.length + vis(E).t.length;
  const walker = (card.motion ?? []).find((m) => ["walk", "run_away", "carry"].includes(m.action) && v[String(m.who).toLowerCase()] && v[String(m.who).toLowerCase()] !== "mon");
  if (establish) L.push(`zw_establish(cam, t0, t1, ${py(place)}, ${py(establish)}, follow=${establish === "follow" && walker ? v[String(walker.who).toLowerCase()] : "None"}${any ? `, end=${camSpec(E)}` : ""})`);
  else L.push(any ? `zw_scene_cam(cam, t0, t1, ${camSpec(S)}, ${camSpec(E)}${cut ? ", cut=True" : ""})` : `zw_spot(cam, ${py(place)}, "wide", t0, t1)`);
  return L.join("\n");
}

/** the line's words -> global word indices; cards -> shots [{ id, line, i, card, w0, w1 }] in order */
export function shotsOf(script, cards) {
  const offs = []; let n = 0;
  for (const l of script.lines) { offs.push(n); n += String(l.text).split(/\s+/).filter(Boolean).length; }
  const ordered = [...cards].sort((a, b) => a.line - b.line || a.i - b.i);
  const shots = ordered.map((x, k) => ({ id: k + 1, line: x.line, i: x.i, card: x.card, w0: offs[x.line - 1] + Math.max(0, Number(x.card.cut_word) || 0) }));
  for (let k = 0; k < shots.length; k++) shots[k].w1 = k + 1 < shots.length ? shots[k + 1].w0 : null;
  // a card whose start is not after the one before (a bad cut_word) starts one word later
  for (let k = 1; k < shots.length; k++) if (shots[k].w0 <= shots[k - 1].w0) { shots[k].w0 = shots[k - 1].w0 + 1; shots[k - 1].w1 = shots[k].w0; }
  return { shots, words: n };
}
