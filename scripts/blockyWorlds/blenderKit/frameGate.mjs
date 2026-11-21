// THE FRAMING GATE (owner 2026-11-21, upgrade round 1): worlds.py's after-build hook MEASURES every shot in Blender
// (zw_gate: head boxes and monster boxes projected on the 9:16 frame at the start, middle and end) and prints one line
// per finding into the kit's render log:
//   ZW_GATE|<shot>|<name>|face_cut|<why>              a face cut by the frame edge
//   ZW_GATE|<shot>|<name>|face_under_captions|<why>   a face inside the caption band
//   ZW_GATE|<shot>|<name>|monster_wall|<why>          a monster filling the frame like a flat wall
//   ZW_GATE|<shot>|<name>|monster_hidden|<why>        a building / prop between the lens and the monster's head
//   ZW_GATE|<shot>|<name>|monster_shown|<why>         a monster fully readable (outline + whole head in frame)
// This module turns those lines into the pipeline's failing shots (kind "framing"), with the fix to write.
// A shot whose desc only HINTS at the creature (director.mjs creatureTease) may show it as a wall / part / shadow, but
// every monster must be shown in full at least once in the video.

const LINE = /^ZW_GATE\|(\d+)\|([^|]+)\|(face_cut|face_under_captions|monster_wall|monster_hidden|monster_shown)\|(.*)$/;

/** the render log's text -> [{ shot, name, kind, why }] */
export function parseGate(text) {
  const out = [];
  for (const l of String(text ?? "").split(/\r?\n/)) {
    const m = l.trim().match(LINE);
    if (m) out.push({ shot: Number(m[1]), name: m[2], kind: m[3], why: m[4] });
  }
  return out;
}

/**
 * the gate's verdict for the shots of a round
 * @param {object} a
 * @param {{shot:number,name:string,kind:string,why:string}[]} a.gate   parsed lines of this round
 * @param {{id:number, desc?:string}[]} a.shots    the round's shots (in order)
 * @param {(desc:string)=>boolean} a.tease          the desc only hints at the creature
 * @param {Record<string,number>} [a.shownBefore]   monster name -> a shot that showed it in an earlier round
 * @returns {{ problems: Record<number,string>, shown: Record<string,number> }}
 */
export function gateProblems({ gate, shots, tease, shownBefore = {} }) {
  const ids = new Set(shots.map((s) => s.id));
  const desc = Object.fromEntries(shots.map((s) => [s.id, s.desc ?? ""]));
  const problems = {};
  const add = (id, t) => { problems[id] = problems[id] ? `${problems[id]}; ${t}` : t; };
  const shown = { ...shownBefore };
  const monsterShots = {};
  for (const g of gate) {
    if (!ids.has(g.shot)) continue;
    if (g.kind === "monster_shown") { shown[g.name] ??= g.shot; continue; }
    if (g.kind === "face_cut") add(g.shot, `FRAMING: ${g.name}'s face is CUT by the frame edge (${g.why}): place the camera with zw_frame(cam, [${g.name} character], t0, t1, kind="close") (or kind="two" with everyone in the shot), never a hand-made close camera`);
    else if (g.kind === "face_under_captions") add(g.shot, `FRAMING: ${g.name}'s face sits UNDER THE CAPTIONS (${g.why}; the captions run at 62-76% of the height): faces stay in the top 64% of the frame; use zw_frame(...) which measures the head`);
    else if (g.kind === "monster_hidden") {
      (monsterShots[g.name] ??= []).push(g.shot);
      if (!tease(desc[g.shot])) add(g.shot, `MONSTER: ${g.name} is HIDDEN behind something (${g.why}): move the camera or the monster into the open (zw_monster_cam tries several sides)`);
    }
    else if (g.kind === "monster_wall") {
      (monsterShots[g.name] ??= []).push(g.shot);
      if (!tease(desc[g.shot])) add(g.shot, `MONSTER: ${g.name} fills the frame like a flat wall (${g.why}): show its whole outline with zw_monster_cam(cam, <monster>, t0, t1, view="full"), or its whole head with view="face"; only a shot whose desc says it is a hint (shadow, silhouette, part of it) may stay close`);
    }
  }
  // every monster in full at least once: a monster the gate only ever saw as a wall gets its first non-hint shot flagged
  for (const [name, list] of Object.entries(monsterShots)) {
    if (shown[name] != null) continue;
    const id = list.find((x) => !tease(desc[x])) ?? list[0];
    if (!problems[id]?.includes(`MONSTER: ${name}`)) add(id, `MONSTER: ${name} is never shown in full in the video: this shot must show the whole monster (zw_monster_cam(cam, <monster>, t0, t1, view="full"))`);
  }
  return { problems, shown };
}
