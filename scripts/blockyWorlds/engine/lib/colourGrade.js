// Blocky Worlds COLOUR MATCHING (GRADE, 2026-11-10): every shot gets a MOOD (day / interior / sunset / night / neon /
// alarm) and the page grades it with that mood's 3D LUT (page/post.js, the last pass of the chain), fitted offline so
// our renders' colour distribution lands on the reference's (lookgate/colourFit.py: OKLab cast transfer onto the
// reference's neutral axis, lightness + chroma quantile matching, an S contrast curve, vibrance, hue pull toward the
// reference palette, the BEIGE KILLER on desaturated warm mid / light tones; skin tones and the white / black points
// protected). Owner: "build a per-mood colour grade / 3D LUT that maps our render's colour distribution onto the
// reference's ... Apply it to every shot automatically."
//
//   MOODS, RIG_MOOD            the moods and the rig (lib/setThemes.js RIGS) -> mood map
//   moodFor(shot)              a shot's mood: its own .mood when valid, else from its rig, else from its light
//   assignMoods(tl)            sets shot.mood on every shot (lib/worldBible.js themeShots calls it after the rigs)
//   lutRGBA(grade, mood)       { size, data: Uint8Array RGBA } for a THREE.Data3DTexture (r fastest), null when missing
//   lutLookup(lut, r, g, b)    the GPU's trilinear lookup in JS (0..1 in, 0..1 out): tests + offline checks
// Data: lib/data/colourGrade.json (the LUTs + fit parameters), lib/data/refColour.json (the reference's abstract stats).
// Re-fit after material / lighting changes: render stills with --query nolut=1, then
//   python scripts/blockyWorlds/lookgate/colourFit.py fit --runs <runDir>[,...]   (runDir = stills/ + timeline.json)

export const MOODS = Object.freeze(["day", "interior", "sunset", "night", "neon", "alarm"]);
export const RIG_MOOD = Object.freeze({ day: "day", golden: "sunset", night_practicals: "night", neon: "neon", interior_warm: "interior", alarm_red: "alarm" });
const LIGHT_MOOD = { day: "day", warm: "sunset", dusk: "sunset", dawn: "sunset", night: "night" };

/** a shot's mood: its own valid .mood, else its rig's, else its base light's (old timelines without a rig) */
export function moodFor(shot = {}) {
  if (MOODS.includes(shot?.mood)) return shot.mood;
  if (shot?.rig && RIG_MOOD[shot.rig]) return RIG_MOOD[shot.rig];
  return LIGHT_MOOD[shot?.light] ?? "day";
}

/** shot.mood on every shot of a timeline (deterministic, from the rig / light) */
export function assignMoods(tl) {
  for (const s of tl?.shots ?? []) s.mood = moodFor({ rig: s.rig, light: s.light });
  return tl;
}

const b64 = (s) => (typeof atob === "function" ? atob(s) : Buffer.from(s, "base64").toString("binary"));

/** the mood's LUT as RGBA bytes for a Data3DTexture ({ size, data }), null when the grade has no such mood */
export function lutRGBA(grade, mood) {
  const m = grade?.moods?.[mood];
  if (!m?.lut) return null;
  const N = grade.size, bin = b64(m.lut), n = N * N * N;
  if (bin.length !== n * 3) throw new Error(`colourGrade: ${mood} LUT has ${bin.length} bytes, want ${n * 3}`);
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { data[i * 4] = bin.charCodeAt(i * 3); data[i * 4 + 1] = bin.charCodeAt(i * 3 + 1); data[i * 4 + 2] = bin.charCodeAt(i * 3 + 2); data[i * 4 + 3] = 255; }
  return { size: N, data };
}

/** trilinear lookup exactly like the shader (index r + g*N + b*N*N); r, g, b in 0..1 -> [r, g, b] in 0..1 */
export function lutLookup({ size: N, data }, r, g, b) {
  const c = (v) => Math.min(Math.max(v, 0), 1) * (N - 1);
  const x = [c(r), c(g), c(b)], i0 = x.map((v) => Math.min(Math.floor(v), N - 2)), f = x.map((v, k) => v - i0[k]);
  const at = (dr, dg, db, ch) => data[((i0[0] + dr) + (i0[1] + dg) * N + (i0[2] + db) * N * N) * 4 + ch] / 255;
  const out = [0, 0, 0];
  for (let ch = 0; ch < 3; ch++) {
    let v = 0;
    for (let db = 0; db < 2; db++) for (let dg = 0; dg < 2; dg++) for (let dr = 0; dr < 2; dr++)
      v += at(dr, dg, db, ch) * (dr ? f[0] : 1 - f[0]) * (dg ? f[1] : 1 - f[1]) * (db ? f[2] : 1 - f[2]);
    out[ch] = v;
  }
  return out;
}

/** the grade data from the page server (null on any failure: the page then renders without the LUT, with a warning) */
export async function loadGrade(url = "/lib/data/colourGrade.json") {
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn(`colourGrade: no LUTs (${e.message}); shots render without the mood grade`);
    return null;
  }
}
