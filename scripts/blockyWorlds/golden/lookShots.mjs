// THE LOOK GOLDEN STORIES (owner 2026-11-21, upgrade round 1): three fixed little stories, three shots each, written as
// shot code (no director call, $0 of AI): the same beats rendered with the engine BEFORE and AFTER a look change, so the
// stills compare like for like. Shot 3 of the day and night stories is a two-person shot; the monster story's is the
// monster shot.
//   before = today's tools exactly as the library mode uses them (tested spots, zw_giant_cam, a giant made with zw_grow)
//   after  = the round-1 tools (zw_frame for faces and two-shots, zw_monster + zw_monster_cam for the monster)
// Rendered by lookGolden.mjs; the before/after sheet by lookCompare.py.

const kid = (v, n, x, y, rot, extra = "") => `${v} = chars.kid(${n}${extra})\n${v}.pose(t0, loc=(${x}, ${y}, 0), rot=${rot})`;

// a story: place, dress, the hero + friend marks (in front of the place's tested close spot), and the monster's mark
const DAY = { id: "day", title: "Day: the shadows talk (downtown)", place: "downtown_street", dress: { time: "day" }, hero: [8.6, 39.0, 0], friend: [6.4, 39.6, 10] };
const NIGHT = { id: "night", title: "Night: the lamps follow you (brick city)", place: "brick_street", dress: { time: "night" }, hero: [8.0, 39.5, 0], friend: [5.8, 40.1, 10] };
const MON = { id: "monster", title: "Monster: something under the street (suburb, night)", place: "suburb_street", dress: { time: "night" }, hero: [3.0, 9.0, -56], monster: [16.0, 3.0, -90] };
// round 1b: rooms and the kit's own sets (Standard colour + real light there too)
const ROOMS = { id: "rooms", title: "Rooms + the kit's sets (living room, shop, classroom)" };

const build = (s) => `ZW_INFO = zw_build(${JSON.stringify(s.place)}, t0, t1, ${JSON.stringify(s.dress)})\ncam = Cam()`;
const hero = (s) => kid("h", 3, ...s.hero, ", shirt=\"#ff4f7e\"");
const friend = (s) => kid("f", 6, ...s.friend, ", shirt=\"#22b5a3\"");

// the BEFORE monster: what today's tools make of "a monster" (a kit character grown 3x in dark colours, plain face)
const monBefore = (s) => `m = chars.Char("Monster", skin="#6e6e6e", shirt="#4a4a4a", pants="#3a3a3a", hair="spiky", hair_color="#2a2a2a", face="plain")\nm.pose(t0, loc=(${s.monster[0]}, ${s.monster[1]}, 0), rot=${s.monster[2]})\nzw_grow(m, t0, t1, 3.0, 3.0)`;
// the AFTER monster: a blocky character 3x a kid with a readable face, its own colours and a rim light
const monAfter = (s) => `m = zw_monster("Monster", (${s.monster[0]}, ${s.monster[1]}, 0), rot=${s.monster[2]}, size=3.5, style="horns")`;
// the after shots ACT: each face matches its beat
const emo = (A, v, e, talk = false) => (A ? `\nzw_emote(${v}, t0, t1, ${JSON.stringify(e)}${talk ? ", talk=True" : ""})` : "");
const EMO = { day: { close: "laughing", two: ["happy", "confused"] }, night: { close: "scared", two: ["shocked", "determined"] } };

export const STORIES = [DAY, NIGHT, MON, ROOMS];

/** the shots of a variant: [{ story, kind, desc, body }] */
export function goldenShots(variant) {
  const A = variant === "after";
  const out = [];
  for (const s of [DAY, NIGHT]) {
    out.push({ story: s.id, kind: "wide", desc: `${s.title}: wide`, body: [build(s), `zw_spot(cam, ${JSON.stringify(s.place)}, "wide", t0, t1)`, hero(s), friend(s)].join("\n") });
    out.push({ story: s.id, kind: "close", desc: `${s.title}: close-up`, body: [build(s), hero(s) + emo(A, "h", EMO[s.id].close, true), A ? `zw_frame(cam, [h], t0, t1, kind="close")` : `zw_spot(cam, ${JSON.stringify(s.place)}, "close", t0, t1)`].join("\n") });
    out.push({ story: s.id, kind: "two", desc: `${s.title}: two-person`, body: [build(s), hero(s) + emo(A, "h", EMO[s.id].two[0]), friend(s) + emo(A, "f", EMO[s.id].two[1], true), A ? `zw_frame(cam, [h, f], t0, t1, kind="two")` : `zw_spot(cam, ${JSON.stringify(s.place)}, "close", t0, t1)`].join("\n") });
  }
  const s = MON;
  out.push({ story: s.id, kind: "wide", desc: `${s.title}: wide (the reveal)`, body: [build(s), hero(s), A ? monAfter(s) : monBefore(s), A ? `zw_flee(m, t0, t1, n=3)\nzw_monster_cam(cam, m, t0, t1, view="reveal")` : `zw_spot(cam, ${JSON.stringify(s.place)}, "wide", t0, t1)`].join("\n") });
  out.push({ story: s.id, kind: "close", desc: `${s.title}: close-up (scared kid)`, body: [build(s), hero(s) + emo(A, "h", "terrified", true), A ? monAfter(s) : monBefore(s), A ? `zw_frame(cam, [h], t0, t1, kind="close")` : `zw_spot(cam, ${JSON.stringify(s.place)}, "close", t0, t1)`].join("\n") });
  out.push({ story: s.id, kind: "monster", desc: `${s.title}: the monster`, body: [build(s), hero(s), A ? monAfter(s) : monBefore(s), A ? `zw_monster_cam(cam, m, t0, t1, view="full")` : `zw_giant_cam(cam, m, 3.0, t0, t1, view="face")`].join("\n") });
  // the rooms + the kit's sets: a living-room close-up, the shop wide, the kit's classroom wide
  const room = (place, spot, x, y, z, kind, e) => ({ story: ROOMS.id, kind, desc: `${ROOMS.title}: ${place} ${spot}`, body: [`ZW_INFO = zw_build(${JSON.stringify(place)}, t0, t1, {})\ncam = Cam()`, kid("h", 3, x, y, 0, ", shirt=\"#ff4f7e\"").replace("loc=(" + x + ", " + y + ", 0)", `loc=(${x}, ${y}, ${z})`) + emo(A, "h", e, true), A && spot === "close" ? `zw_frame(cam, [h], t0, t1, kind="close")` : `zw_spot(cam, ${JSON.stringify(place)}, ${JSON.stringify(spot)}, t0, t1)`].join("\n") });
  out.push(room("living_room", "close", -1.0, 0.0, 0, "room", "happy"));
  out.push(room("shop", "wide", 0.0, 2.6, 0, "room", "confused"));
  out.push(room("classroom", "wide", -1.5, 9.6, 0, "set", "smirk"));
  // the director's own way (live run df9b8ec8 crashed on it): the kit's face() with our emotion names + ch.armR
  if (A) out.push({ story: ROOMS.id, kind: "set", desc: `${ROOMS.title}: compat (director-style face + armR)`, body: [build(DAY), hero(DAY), `h.face(t0, "terrified")\nh.face(t0 + 0.5, "surprised")\nh.face(t0 + 0.9, "sad")\nh.armR.rotation_euler[0] = math.radians(-120)\nh.legL.rotation_euler[0] = math.radians(20)`, `zw_frame(cam, [h], t0, t1, kind="close")`].join("\n") });
  return out;
}
