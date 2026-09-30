// Old AI Fruit Story (v1) generations shown read-only in v2's Recent list.
// They live in fruit_story_generations (owner-readable) and are never sent
// to the v2 backend: their ids carry a "v1:" prefix so the adapter can tell.

export const LEGACY_PREFIX = "v1:";
export const isLegacyId = (id) => typeof id === "string" && id.startsWith(LEGACY_PREFIX);
export const legacyRowId = (id) => id.slice(LEGACY_PREFIX.length);

const scenesOf = (row) => (Array.isArray(row?.scenes) ? row.scenes : []);
// v1 sometimes saved the provider's temporary URL, which has since expired.
export const isLasting = (url) => typeof url === "string" && url.startsWith("https://") && !url.includes(".runware.ai/");
const lasting = (url) => (isLasting(url) ? url : null);

/** Worth showing: at least one picture that still loads. */
export const isShowable = (row) => scenesOf(row).some((s) => isLasting(s?.imageUrl));
const QUALITY = { "fruit-v3": "v3", "fruit-v4": "v4", fruitveo31lite: "v4" };

/** RecentSingle card for a v1 generation. */
export function legacyRecent(row) {
  const scenes = scenesOf(row);
  return {
    type: "single",
    id: `${LEGACY_PREFIX}${row.id}`,
    title: row.title || "Untitled story",
    castIds: [],
    lengthSec: (row.scene_count ?? scenes.length ?? 5) * 5,
    thumbUrls: scenes.map((s) => lasting(s?.imageUrl)).filter(Boolean).slice(0, 3),
    status: scenes.some((s) => lasting(s?.videoUrl)) ? "clips_ready" : "pictures_ready",
    createdAt: row.created_at,
    legacy: true,
  };
}

/** v1 dialogue is [{speaker, line}] (or a string, or a voiceover): "Speaker: line / Speaker: line". */
export function legacyLine(scene) {
  const d = scene?.videoDialogue;
  if (Array.isArray(d)) return d.map((x) => (x && typeof x === "object" ? [x.speaker, x.line].filter(Boolean).join(": ") : String(x ?? ""))).filter(Boolean).join(" / ");
  return String((typeof d === "string" && d) || scene?.videoVoiceover || "").trim();
}

/** A read-only Story for a v1 generation: its pictures and clips, no actions. */
export function legacyStory(row) {
  const scenes = scenesOf(row);
  const hasClips = scenes.some((s) => lasting(s?.videoUrl));
  return {
    id: `${LEGACY_PREFIX}${row.id}`,
    title: row.title || "Untitled story",
    castIds: [],
    quality: QUALITY[row.animation_model] ?? "v2",
    lengthSec: (row.scene_count ?? scenes.length ?? 5) * 5,
    aspect: row.scene_aspect === "16:9" ? "16:9" : "9:16",
    status: hasClips ? "clips_ready" : "pictures_ready",
    readOnly: true,
    scenes: scenes.map((s, i) => ({
      id: `${LEGACY_PREFIX}${row.id}:${i}`,
      index: i,
      title: s?.title ?? `Scene ${i + 1}`,
      speakerId: "",
      line: legacyLine(s),
      presentIds: [],
      durationSec: 5,
      imageStatus: lasting(s?.imageUrl) ? "ready" : "failed",
      imageUrl: lasting(s?.imageUrl),
      imagePrompt: s?.imagePrompt ?? "",
      clipStatus: lasting(s?.videoUrl) ? "ready" : "none",
      clipUrl: lasting(s?.videoUrl),
      error: null,
    })),
    final: { status: "none", url: null, trimmedSec: 0, captions: false, trimmedPerClipSec: [], error: null },
    createdAt: row.created_at,
  };
}
