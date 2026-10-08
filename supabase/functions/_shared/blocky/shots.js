// Camera shots for Blocky Stories: the one place for what each shot is, how its picture is framed and staged,
// how the camera moves in its clip, and what the picture check holds it to.
//
// Every scene has a spoken line and the clip model lip-syncs the speaker, so in EVERY shot the speaker faces
// the camera with a readable face, and the whole head (with its hat, hair or accessory) is inside the frame.
// Stories mix the shots like a film does (owner, 2026-10-08); the writer picks them and directShots() below
// makes sure of the mix without a model call. Until then every scene was chest-up or closer, because the
// first 30-second story drew an over-the-shoulder listener as a human and wide shots shrank the mouth:
// the wide shot here keeps the speaker in front and large enough, and the over-the-shoulder wording says
// what the listener's back IS.

/** The shots a writer may pick, in the order the mix is filled from. */
export const SPEAKING_SHOTS = ["wide", "chest-up", "close-up", "over-the-shoulder", "reaction", "medium close-up"];
/** Older rows may still carry this; the builders treat it as chest-up. */
export const LEGACY_SHOTS = ["medium two-shot"];
export const shotOf = (shot) => (SPEAKING_SHOTS.includes(shot) ? shot : "chest-up");

const HEAD_ROOM = "The whole head, with its hat or accessory, is inside the frame.";

/**
 * What each shot is.
 *   picture   the shot line of the scene picture ({speaker}, {listener} are names)
 *   framing   the framing sentence (full wording) and its short form
 *   camera    the camera move for clip models that follow the shot (clips.js)
 *   check     what the picture check holds the speaker to: the smallest cube head as a share of the frame
 *             height, whether a full body is the point (wide), not allowed (the others), and the redraw's fix
 *   alone     only the speaker is in the frame, whoever else is in the scene
 *   needsListener  the shot needs a second character in the scene
 */
export const SHOTS = Object.freeze({
  wide: Object.freeze({
    picture: "Wide establishing shot of the whole place, with {speaker} standing in front, seen from head to feet",
    framing: `Framing: full body. Every character stands whole inside the frame, the place clearly seen around them. The speaker's cube head is about a sixth of the frame height, the face decal sharp, toward the camera. ${HEAD_ROOM}`,
    framingShort: "Full body in the place; the speaker in front, the face decal sharp, toward the camera, the whole head in frame.",
    camera: "a slow, steady push-in from the wide view toward the speaker",
    check: Object.freeze({ minHead: 10, fullBody: "wanted", fix: (s) => `Reframe as a wide shot: ${s} from head to feet in the front of the frame, the cube head about a sixth of the frame height, the face sharp and toward the camera, the place clearly seen around.` }),
  }),
  "chest-up": Object.freeze({
    picture: "Chest-up shot on the speaker in the foreground, never full body",
    framing: `Framing: chest up on the speaker; the cube head is a quarter to a third of the frame height, the face decal sharp. Keep the place as a soft background. ${HEAD_ROOM}`,
    framingShort: "Chest up on the speaker, never full body; the face decal large, sharp, toward the camera, the whole head in frame.",
    camera: "a gentle, slow dolly-in",
    check: Object.freeze({ minHead: 18, fullBody: "never", fix: (s) => `Reframe much closer: a tight chest-up shot of ${s}, the cube head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor.` }),
  }),
  "medium close-up": Object.freeze({
    picture: "Medium close-up, chest up",
    framing: `Framing: chest up or closer on the speaker, never full body; the cube head is a third of the frame height, the face decal sharp. Keep the place as a soft background. ${HEAD_ROOM}`,
    framingShort: "Chest up or closer on the speaker, never full body; the face decal large, sharp, toward the camera, the whole head in frame.",
    camera: "a slow push-in toward the speaker",
    check: Object.freeze({ minHead: 18, fullBody: "never", fix: (s) => `Reframe much closer: a medium close-up of ${s}, the cube head filling a third of the frame height, cropped at the chest. No legs, no feet, no floor.` }),
  }),
  "close-up": Object.freeze({
    picture: "Close-up on the speaker's face and shoulders",
    framing: `Framing: head and shoulders of the speaker; the cube head is about a third of the frame height, the face decal sharp. The place is a soft blur behind. ${HEAD_ROOM}`,
    framingShort: "Head and shoulders of the speaker; the face decal large, sharp, toward the camera, the whole head in frame.",
    camera: "a very slow push-in on the speaker's face",
    // The same smallest head as chest-up: with a hat in frame a head is rarely over a third of the height, and the
    // check measured a clear close-up at 18 (the shot test of 2026-10-08).
    check: Object.freeze({ minHead: 18, fullBody: "never", fix: (s) => `Reframe as a close-up: only the head and shoulders of ${s}, the cube head about a third of the frame height, the whole head with its hat or accessory still inside the frame.` }),
  }),
  reaction: Object.freeze({
    picture: "Reaction shot: {speaker} alone, head and shoulders, caught in the middle of a reaction",
    framing: `Framing: head and shoulders of the speaker, alone in the frame, leaning a little back or forward with the reaction; the cube head is about a third of the frame height, the face decal sharp. The place is a soft blur behind. ${HEAD_ROOM}`,
    framingShort: "Head and shoulders of the speaker, alone, mid-reaction; the face decal large, sharp, toward the camera, the whole head in frame.",
    camera: "almost still, with a slight handheld drift",
    alone: true,
    check: Object.freeze({ minHead: 18, fullBody: "never", fix: (s) => `Reframe as a reaction shot: only the head and shoulders of ${s}, alone, the cube head about a third of the frame height, the whole head with its hat or accessory still inside the frame.` }),
  }),
  "over-the-shoulder": Object.freeze({
    picture: "Over-the-shoulder shot: the camera looks past {listener}, seen from behind at the near edge of the frame, at {speaker}, who faces the camera chest-up beyond",
    framing: `Framing: at the near edge, out of focus, only the BACK of the listener's cube head and one block shoulder (a plain cube and a block, no face on the back). Beyond, the speaker chest-up, the cube head a quarter of the frame height, the face decal sharp, toward the camera. ${HEAD_ROOM}`,
    framingShort: "Past the back of the listener's cube head at the near edge, the speaker chest-up beyond, face sharp, toward the camera, the whole head in frame.",
    camera: "a very slow push-in past the shoulder toward the speaker",
    needsListener: true,
    check: Object.freeze({ minHead: 16, fullBody: "never", fix: (s) => `Reframe as an over-the-shoulder shot: the back of the listener's cube head at the near edge, and ${s} chest-up beyond, facing the camera, the cube head a quarter of the frame height. No legs, no feet, no floor.` }),
  }),
});

/** The spec of a scene's shot (an older or unknown shot is chest-up). */
export const shotSpec = (shot) => SHOTS[shotOf(shot)];

/** Who is in the frame of a scene, speaker first: everyone present, or the speaker alone in a reaction shot. */
export function inFrameIds(scene) {
  const speaker = scene.speakerId ?? scene.speaker_id;
  const present = scene.presentIds ?? scene.present_ids ?? [];
  if (shotSpec(scene.shot).alone) return [speaker];
  return [speaker, ...present.filter((id) => id !== speaker)];
}

/**
 * The mix of shots in a story, made sure of in code (no model call, never a fault):
 *   - scene 1 is the wide shot: it shows the place and who is there (and it is the only wide one, so every
 *     other line is spoken with a large face);
 *   - an over-the-shoulder shot with nobody to look past becomes a close-up;
 *   - never the same shot three scenes in a row;
 *   - at least three different shots in a story of five scenes or more (two in a shorter one).
 * scenes: [{shot, presentIds, …}] → the same scenes with their shots set.
 */
export function directShots(scenes) {
  const out = scenes.map((s) => ({ ...s, shot: shotOf(s.shot) }));
  const fits = (s, shot) => !(SHOTS[shot].needsListener && (s.presentIds ?? []).length < 2);
  out.forEach((s, i) => {
    if (i === 0) s.shot = "wide";
    else if (s.shot === "wide") s.shot = "chest-up";
    if (!fits(s, s.shot)) s.shot = "close-up";
  });
  // What another shot could be, tried in the list's order, skipping the wide one (scene 1 only).
  const other = (s, not) => SPEAKING_SHOTS.find((shot) => shot !== "wide" && !not.includes(shot) && fits(s, shot));
  for (let i = 2; i < out.length; i++) {
    if (out[i].shot === out[i - 1].shot && out[i].shot === out[i - 2].shot) out[i].shot = other(out[i], [out[i].shot, out[i + 1]?.shot]) ?? out[i].shot;
  }
  const need = out.length >= 5 ? 3 : Math.min(2, out.length);
  for (let guard = 0; guard < out.length && new Set(out.map((s) => s.shot)).size < need; guard++) {
    // Change a scene whose shot is used most, as late in the story as possible, to a shot not used yet.
    const count = (shot) => out.filter((s) => s.shot === shot).length;
    const used = [...new Set(out.map((s) => s.shot))];
    const at = out.map((s, i) => i).filter((i) => i > 0).sort((a, b) => count(out[b].shot) - count(out[a].shot) || b - a)[0];
    if (at == null) break;
    const next = other(out[at], used);
    if (!next) break;
    out[at].shot = next;
  }
  return out;
}
