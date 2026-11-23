// THE BUILDER (owner 2026-11-23, Part B): things the library lacks are made ON THE SPOT inside the customer pipeline,
// from DATA an AI call writes (a list of simple shapes, a character's choices, key poses, a room's layout). The engine
// turns the data into objects (scripts/blockyWorlds/blenderKit/worlds/builder.py). NO AI-WRITTEN CODE EVER RUNS: every
// spec is checked and clamped here, then passed to the engine as a plain data literal.
// Every new piece is tested alone next to a kid on one cheap still + a vision check ("is this clearly a <thing>, at the
// right size?"), one retry, then saved to the library (reused free) or logged as a miss; every build is logged
// (builder_log.jsonl: one record per build, written for a later nightly job that makes proper versions).

export const KID_CM = 120;
export const SHAPES = Object.freeze(["box", "ball", "cylinder", "cone", "disc", "wedge"]);
export const HOLDS = Object.freeze(["one_hand", "two_hands", "worn_head", "worn_face", "worn_body", "worn_back", "on_ground", "on_table", "on_wall", "in_sky", "ridden", "hanging"]);
export const MAX_SHAPES = 40;
export const SPEC_MODEL = "claude-sonnet-5-5";
export const VISION_MODEL = "claude-sonnet-5-5";

const hex = { type: "string", description: "a colour #rrggbb" };
const v3 = { type: "array", items: { type: "number" }, description: "3 numbers" };
const v2 = { type: "array", items: { type: "number" }, description: "2 numbers" };

// ---------------------------------------------------------------- PROPS
export const PROP_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "real_size_cm", "hold", "grip", "shapes"],
  properties: {
    name: { type: "string" },
    real_size_cm: { type: "number", description: "the thing's LARGEST dimension in real life, in cm (chalk 8, pizza box 35, bell 15, car 450)" },
    hold: { type: "string", enum: HOLDS },
    grip: { ...v3, description: "where a hand holds it, in the same units as the shapes (for worn / on_ground: its anchor)" },
    shapes: {
      type: "array", 
      items: {
        type: "object", additionalProperties: false, required: ["type", "size", "pos", "rot", "color"],
        properties: { type: { type: "string", enum: SHAPES }, size: v3, pos: v3, rot: v3, color: hex, glow: { type: "boolean" } },
      },
    },
  },
};
export const PROP_SYSTEM = `You design a PROP for a blocky Roblox-style 3D video, as DATA: a list of at most ${MAX_SHAPES} simple shapes.
Shapes: box (size = width, depth, height), ball (size = the 3 diameters), cylinder (size = diameter x, diameter y, height; upright),
cone (size = base diameter x, base diameter y, height; point up), disc (a flat cylinder: size = diameter, diameter, thickness),
wedge (a ramp: size = width, depth, height; high side at +y). pos = the shape's centre, rot = degrees about x, y, z.
Units: any, but consistent; +z is up, the thing's FRONT faces -y, its base sits at z = 0 unless it hangs or flies.
Make it READ at phone size: bold distinct colours for its parts, the parts that make it recognisable big enough (a pizza's
red print, a cat's ears and tail, a lantern's glass), chunky, no tiny details. glow only for light sources (a lantern
flame, a screen, a lamp bulb).
real_size_cm = its largest dimension in real life. hold = how it is used (one_hand: held in one fist; two_hands; worn_head
/ worn_face / worn_body / worn_back; on_ground; on_table; on_wall; in_sky (far away, big: a planet); ridden (someone sits
on it); hanging). grip = the point a hand holds (or the anchor point for worn / placed things).`;

// ---------------------------------------------------------------- CHARACTERS
export const AGES = Object.freeze(["kid", "teen", "adult", "old"]);
export const CLOTHES = Object.freeze(["tshirt", "coat", "dress", "suit", "uniform", "overalls", "robot_body", "spacesuit"]);
export const HAIRS_B = Object.freeze(["spiky", "slick", "short", "messy", "cap", "bob", "buzz", "bun", "bald", "none"]);
export const FACES_B = Object.freeze(["kid", "girl", "hero", "plain", "mustache"]);
export const CHAR_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["name", "age", "height_cm", "skin", "shirt", "pants", "clothes", "hair", "hair_color", "face", "accessories"],
  properties: {
    name: { type: "string" }, age: { type: "string", enum: AGES }, height_cm: { type: "number" },
    skin: hex, shirt: hex, pants: hex, clothes: { type: "string", enum: CLOTHES },
    hair: { type: "string", enum: HAIRS_B }, hair_color: hex, face: { type: "string", enum: FACES_B },
    accessories: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "worn", "description", "real_size_cm"], properties: { name: { type: "string" }, worn: { type: "string", enum: ["worn_head", "worn_face", "worn_body", "worn_back", "one_hand"] }, description: { type: "string" }, real_size_cm: { type: "number" } } } },
  },
};
export const CHAR_SYSTEM = `You design a CHARACTER for a blocky Roblox-style video as CHOICES (no shapes): age, real height in cm (a kid is about
120, an adult 175, a grandma 160), skin, shirt and trousers colours, the clothes type, hair, hair colour, face, and at most
4 accessories that make the role readable at phone size (a firefighter's helmet, a dentist's mask, a chef's hat, glasses,
a moustache, an apron, a badge). Each accessory is built later as a prop: give it a short description and its real size.
Bold, readable colours; one strong colour per character.`;

// ---------------------------------------------------------------- MOVES (key poses for our joints)
export const JOINTS = Object.freeze({
  armL: [[-80, 180], [-40, 130]], armR: [[-80, 180], [-40, 130]], legL: [[-70, 100], [-15, 50]], legR: [[-70, 100], [-15, 50]],
  head: [[-80, 80], [-40, 45], [-30, 30]], torso: [[-45, 45], [-25, 70], [-25, 25]],
});
const POSE = { type: "object", additionalProperties: false, properties: {
  armL: v2, armR: v2, legL: v2, legR: v2, head: v3, torso: v3, hipz: { type: "number" } } };
export const MOVE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "duration_s", "loop", "keys", "travel_m", "hands"],
  properties: {
    name: { type: "string" }, duration_s: { type: "number" }, loop: { type: "boolean" },
    keys: { type: "array", items: { type: "object", additionalProperties: false, required: ["t", "pose"], properties: { t: { type: "number" }, pose: POSE } } },
    travel_m: { type: "number", description: "how far the body moves forward over the move, metres (0 = on the spot)" },
    hands: { type: "string", enum: ["none", "right", "left", "both"] },
  },
};
export const MOVE_SYSTEM = `You design a MOVE for a blocky Roblox-style character as KEY POSES over time (t from 0 to 1), for these joints
(angles in degrees): armL / armR = [forward swing (0 = hanging, 90 = straight forward, 180 = straight up), out to the side];
legL / legR = [forward swing (positive = forward), out]; head = [yaw (turn), pitch down, roll]; torso = [yaw, lean forward,
roll]; hipz = crouch (0 = standing, -0.4 = knees bent, -0.9 = sitting low). Limits: arms forward -80..180, out -40..130;
legs forward -70..100, out -15..50; head yaw +-80, pitch -40..45; torso lean -25..70. Make the move READ: clear strong poses,
2-6 keys per action beat, repeated beats for a repeated action (knitting needles, a hard pull). travel_m = how far the body
moves forward. hands = which hands hold the prop.`;

// ---------------------------------------------------------------- PLACES (a shell + furniture + zones)
export const PLACE_SCHEMA = {
  type: "object", additionalProperties: false, required: ["name", "kind", "size_m", "floor", "walls", "light", "furniture", "zones"],
  properties: {
    name: { type: "string" }, kind: { type: "string", enum: ["room", "underground", "outdoor", "water"] },
    size_m: v3, floor: hex, walls: hex, ceiling: { type: "boolean" },
    light: { type: "string", enum: ["warm", "cool", "dim", "bright", "daylight", "night"] },
    door: { type: "object", additionalProperties: false, properties: { wall: { type: "string", enum: ["back", "left", "right"] }, x: { type: "number" } } },
    windows: { type: "array", items: { type: "object", additionalProperties: false, required: ["wall", "x"], properties: { wall: { type: "string", enum: ["back", "left", "right"] }, x: { type: "number" } } } },
    furniture: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "description", "real_size_cm", "pos", "rot"], properties: { name: { type: "string" }, description: { type: "string" }, real_size_cm: { type: "number" }, pos: v2, rot: { type: "number" }, library: { type: "string" } } } },
    zones: { type: "array", items: { type: "object", additionalProperties: false, required: ["name", "rect"], properties: { name: { type: "string" }, rect: { type: "array", items: { type: "number" }, description: "x0, y0, x1, y1" } } } },
  },
};
export const PLACE_SYSTEM = `You design a SIMPLE PLACE for a blocky Roblox-style video: a shell (floor, walls on the back, left and right
sides, the front side open toward the camera, an optional ceiling), a door and windows on those walls, the light, and the
furniture / set pieces (each built later as a prop: a short description and its real size; or a library thing by name).
size_m = width (x), depth (y, away from the camera), height. The floor's centre is (0, 0); x from -w/2 to w/2, y from
0 (the open front) to depth. Named zones are rectangles [x0, y0, x1, y1] on the floor (e.g. "at_counter", "by_ladder").
kind water = an outdoor lake / sea (the floor is water). Keep it readable: 4-10 pieces.`;

// ---------------------------------------------------------------- one call -> one checked spec
async function specCall({ callJson, apiKey, system, schema, user, meter }) {
  const r = await callJson({ apiKey, model: SPEC_MODEL, system: [system], user, schema, effort: "low", maxTokens: 6000, meter, cache: false });
  return { data: r.data, costUsd: Number(r.costUsd ?? 0) };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const num3 = (a, d = 0) => [0, 1, 2].map((k) => Number(a?.[k] ?? d) || d);

export function checkProp(s) {
  const problems = [];
  if (!s || !Array.isArray(s.shapes) || !s.shapes.length) return { ok: false, problems: ["no shapes"], spec: s };
  const shapes = s.shapes.slice(0, MAX_SHAPES).filter((x) => SHAPES.includes(x.type)).map((x) => ({
    type: x.type, size: num3(x.size, 0.1).map((v) => clamp(Math.abs(v), 0.001, 1e4)), pos: num3(x.pos), rot: num3(x.rot).map((v) => clamp(v, -360, 360)),
    color: /^#[0-9a-f]{6}$/i.test(x.color ?? "") ? x.color : "#888888", glow: Boolean(x.glow) }));
  if (shapes.length < s.shapes.length) problems.push(`${s.shapes.length - shapes.length} shape(s) dropped (unknown type / over ${MAX_SHAPES})`);
  const cm = clamp(s.real_size_cm, 1, 5000);
  return { ok: shapes.length > 0, problems, spec: { name: String(s.name || "thing").toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, 40), real_size_cm: cm, hold: HOLDS.includes(s.hold) ? s.hold : "on_ground", grip: num3(s.grip), shapes } };
}
export function checkCharacter(c) {
  const ok = c && AGES.includes(c.age);
  return { ok: Boolean(ok), problems: ok ? [] : ["bad age"], spec: ok ? { ...c, height_cm: clamp(c.height_cm, 60, 260), clothes: CLOTHES.includes(c.clothes) ? c.clothes : "tshirt", hair: HAIRS_B.includes(c.hair) ? c.hair : "short", face: FACES_B.includes(c.face) ? c.face : "kid", accessories: (c.accessories ?? []).slice(0, 4) } : c };
}
/** joint limits enforced, keys in time order, the crouch limited, real travel */
export function checkMove(m) {
  if (!m || !Array.isArray(m.keys) || m.keys.length < 2) return { ok: false, problems: ["fewer than 2 keys"], spec: m };
  const keys = m.keys.map((k) => {
    const pose = {};
    for (const [j, lim] of Object.entries(JOINTS)) if (Array.isArray(k.pose?.[j])) pose[j] = lim.map((r, i) => clamp(k.pose[j][i], r[0], r[1])).concat(j === "head" || j === "torso" ? [] : []);
    if (k.pose?.hipz != null) pose.hipz = clamp(k.pose.hipz, -1.0, 0.15);
    return { t: clamp(k.t, 0, 1), pose };
  }).sort((a, b) => a.t - b.t);
  return { ok: true, problems: [], spec: { name: String(m.name || "move").toLowerCase().replace(/[^a-z0-9_]+/g, "_"), duration_s: clamp(m.duration_s, 0.4, 8), loop: Boolean(m.loop), keys, travel_m: clamp(m.travel_m, 0, 6), hands: m.hands ?? "none" } };
}
export function checkPlace(p) {
  if (!p || !Array.isArray(p.size_m)) return { ok: false, problems: ["no size"], spec: p };
  const size = p.size_m.map((v) => clamp(v, 2, 80));
  return { ok: true, problems: [], spec: { ...p, size_m: size, furniture: (p.furniture ?? []).slice(0, 12), zones: (p.zones ?? []).slice(0, 10) } };
}

export async function buildProp({ callJson, apiKey, name, description, sizeHint = null, hold = null, feedback = "", meter = null }) {
  const user = `The prop: "${name}": ${description}.${sizeHint ? ` Real size about ${sizeHint} cm.` : ""}${hold ? ` It is ${hold}.` : ""}${feedback ? `\nTHE LAST VERSION FAILED THE CHECK: ${feedback}. Fix exactly that.` : ""}`;
  const r = await specCall({ callJson, apiKey, system: PROP_SYSTEM, schema: PROP_SCHEMA, user, meter });
  return { ...checkProp(r.data), costUsd: r.costUsd };
}
export async function buildCharacter({ callJson, apiKey, name, description, feedback = "", meter = null }) {
  const r = await specCall({ callJson, apiKey, system: CHAR_SYSTEM, schema: CHAR_SCHEMA, user: `The character: "${name}": ${description}.${feedback ? `\nTHE LAST VERSION FAILED: ${feedback}` : ""}`, meter });
  return { ...checkCharacter(r.data), costUsd: r.costUsd };
}
export async function buildMove({ callJson, apiKey, name, description, feedback = "", meter = null }) {
  const r = await specCall({ callJson, apiKey, system: MOVE_SYSTEM, schema: MOVE_SCHEMA, user: `The move: "${name}": ${description}.${feedback ? `\nTHE LAST VERSION FAILED: ${feedback}` : ""}`, meter });
  return { ...checkMove(r.data), costUsd: r.costUsd };
}
export async function buildPlace({ callJson, apiKey, name, description, feedback = "", meter = null }) {
  const r = await specCall({ callJson, apiKey, system: PLACE_SYSTEM, schema: PLACE_SCHEMA, user: `The place: "${name}": ${description}.${feedback ? `\nTHE LAST VERSION FAILED: ${feedback}` : ""}`, meter });
  return { ...checkPlace(r.data), costUsd: r.costUsd };
}

// ---------------------------------------------------------------- THE TEST: a vision check of the piece's still
export const VISION_SCHEMA = { type: "object", additionalProperties: false, required: ["is_it", "right_size", "reason"], properties: { is_it: { type: "boolean" }, right_size: { type: "boolean" }, reason: { type: "string" } } };
export async function visionCheck({ callJson, apiKey, imageB64, mediaType = "image/jpeg", thing, sizeCm, meter = null }) {
  const user = [{ type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
    { type: "text", text: `This is a still from a blocky Roblox-style video. A kid about ${KID_CM} cm tall stands next to the test piece. Is the piece clearly a ${thing} (would a viewer name it at phone size)? Is it about ${sizeCm} cm next to the kid (within half / double)? Answer strictly; reason in one sentence (what is wrong if not).` }];
  const r = await callJson({ apiKey, model: VISION_MODEL, system: ["You check test renders for a video engine. Strict, short."], user, schema: VISION_SCHEMA, effort: "low", maxTokens: 800, meter, cache: false });
  return { ...r.data, ok: Boolean(r.data?.is_it && r.data?.right_size), costUsd: Number(r.costUsd ?? 0) };
}

/** a spec as a Python literal (data only: dicts, lists, numbers, strings, booleans) */
export function pyData(v) {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return Number.isFinite(v) ? String(+v.toFixed(5)) : "0";
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(pyData).join(", ")}]`;
  return `{${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${pyData(x)}`).join(", ")}}`;
}
/** one log record (one per build attempt): what was asked, the spec, the still, pass / fail, the cost, the outcome */
export function logRecord({ kind, name, asked, story = null, spec, still = null, verdict = null, retry = 0, costUsd = 0, outcome, library = null }) {
  return { ts: new Date().toISOString(), kind, name, asked, story, spec, still, verdict, retry, cost_usd: +Number(costUsd).toFixed(5), outcome, library, nightly: outcome === "saved" ? "may improve" : "needs a proper version" };
}
