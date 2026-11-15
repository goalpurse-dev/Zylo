// STUDIO MODE: the shot-code API. The ONLY names shot code may use: `api.<member>` from API below, `Math.<fn>` from MATH,
// and its own local variables. One list serves the validator (studio/validate.mjs), the page runtime
// (studio/page/studioBoard.js), the free Node pre-check (studio/shotCheck.mjs) and the agent's prompt (studio/prompt.mjs).
// Points are [x, y, z] arrays in metres (y up). Every call is per frame: the code runs again for every frame of the shot.

export const API = Object.freeze({
  // ---- the clock (numbers, read-only)
  t: "seconds since this cut started",
  dur: "this cut's length in seconds",
  k: "t / dur, 0..1",
  night: "true when the shot's light is night or dusk",
  p: "(asset code only) the params object given to api.asset(name, params)",
  // ---- helpers (pure)
  ease: "ease(x) smoothstep of x clamped to 0..1",
  lerp: "lerp(a, b, k) numbers",
  mix: "mix(p, q, k) -> point between two points",
  add: "add(p, [dx, dy, dz]) -> point",
  clamp: "clamp(x, lo, hi)",
  wave: "wave(freq, amp, phase = 0) -> amp * sin(2*pi*freq*t + phase)",
  orbit: "orbit(center, radius, angleRad, height) -> point on a circle round center (angle 0 = +z, toward the street cameras)",
  // ---- the world map (points)
  house: "house(owner) -> { x, z, door, front, curb, win: [w0, w1, w2, w3] } (w0/w1 ground-floor window centres, w2/w3 upstairs; the front faces +z)",
  room: "room(owner, lx, ly, lz) -> a point inside that owner's room (lx -3.5..3.5, lz -3 = the window wall .. 3, ly 0 floor .. 3.2 ceiling)",
  place: "place(name, mark = 'center') -> a point at school | woods | park | shop (marks center left right back far door)",
  street: "street(n) -> a point on the road side of the house-side curb, slot n 0..9 left to right",
  pos: "pos(id) -> where that person stands now (after the staging and your person() calls this frame)",
  head: "head(id) -> that person's head centre now",
  // ---- staging (call every frame you want the thing on screen)
  person: "person(id, { at, yaw, pose, phase, face, blink, hold, headTurn, headTilt, armR, armL }) shows a cast member: at = feet point; yaw radians (0 = facing +z, toward the street cameras); pose one of POSES; phase = the pose clock (default the shot clock); face one of FACES; hold a PROPS name in the right hand; headTurn/headTilt radians; armR/armL = [x, y, z] shoulder rotations in radians (x negative = arm forward/up)",
  hide: "hide(id) hides a person the staging put on screen",
  monster: "monster({ at, yaw, state, eye, eyeAt, scale }) the story's creature (the engine's monster): state lurk | reach | reveal | flee; eye stare | squint | twitch | blink | press",
  asset: "asset(name, params) draws an asset you defined with define_asset (params.at, params.yaw, params.scale are applied for you; the rest reach the asset's code as api.p)",
  prop: "prop(name, { at, yaw, scale, rot }) a kit prop (PROPS) set down at a point",
  animal: "animal(species, { at, yaw, action, scale }) a kit animal (ANIMALS), action one of ANIMAL_ACTIONS",
  block: "block([w, h, d], at, color, { rot, glow }) a box centred at `at` (rot = [rx, ry, rz] radians, glow 0..3 = it shines); up to 150 primitives a frame",
  ball: "ball(r, at, color, { scale, glow }) a sphere (scale = [sx, sy, sz] squash)",
  cyl: "cyl(rTop, rBottom, h, at, color, { rot, glow }) a cylinder centred at `at`",
  // ---- the camera (call it EVERY frame; it must move)
  camera: "camera({ pos, look, fov = 50, roll = 0 }) the lens at pos looking at look (fov degrees, vertical)",
  shake: "shake(amount) a hand-held shake this frame (0.02 subtle .. 0.15 an impact)",
});
export const API_NAMES = Object.freeze(Object.keys(API));
export const API_VALUES = Object.freeze(["t", "dur", "k", "night", "p"]);
export const MATH = Object.freeze(["sin", "cos", "tan", "atan2", "abs", "min", "max", "floor", "ceil", "round", "sqrt", "pow", "PI", "sign", "hypot", "exp", "log"]);
/** shot-code limits */
export const LIMITS = Object.freeze({ codeChars: 3500, loopMax: 64, primitives: 150, assetsPerShot: 8 });

export const POSES = Object.freeze(["stand", "walk", "run", "point", "scared", "sit", "carry", "wave", "look_up", "talk", "sleep", "cheer", "yell", "sneeze", "blow", "cover_mouth", "hug", "climb", "push", "eat", "fall", "jump", "ride", "hide", "throw", "fly", "swim", "build", "dig", "dance", "kick", "fight", "drive"]);
export const FACES = Object.freeze(["neutral", "happy", "grin", "laugh", "sad", "crying", "angry", "surprised", "shocked", "scared", "smirk", "wink", "thinking", "sleepy", "worried", "determined", "teary"]);
export const ANIMALS = Object.freeze(["dog", "mouse", "cat", "pigeon", "frog", "yeti", "goat", "whale", "duck", "fish", "ant", "bear", "turtle", "dragon", "octopus", "deer", "chicken", "parrot", "shark", "pig", "mole", "seagull", "snail", "snake", "seal", "cow", "rabbit", "wolf", "elephant", "eagle"]);
export const ANIMAL_ACTIONS = Object.freeze(["idle", "walk", "run", "fly", "swim", "hop", "eat", "sleep", "sit", "sniff", "bark", "head_turn", "lurk", "reveal", "roar"]);
export const PROPS = Object.freeze(["cup", "mug", "saucer", "bowl", "plate", "spoon", "bottle", "jar", "book", "letter", "note", "map", "phone", "ball", "kazoo", "whistle", "bell", "bag", "backpack", "box", "present", "key", "lantern", "flashlight", "umbrella", "pencil", "crayon", "coin", "candy", "cake", "cookie", "sandwich", "apple", "egg", "pumpkin", "teddy", "doll", "toy", "balloon", "kite", "bucket", "broom", "shovel", "stick", "rock", "flower", "clock", "camera", "wand", "crown", "mask", "trophy", "drum", "hat", "statue", "fountain", "basket", "gate", "leash"]);
export const LOCS = "street | house:<owner> (outside, at that owner's house) | room:<owner> (inside that owner's room) | place:school | place:woods | place:park | place:shop";
