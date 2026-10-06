// Location plates for Blocky Stories series: one empty background picture
// per series location (no characters), made the first time an episode uses
// that location, then passed to every scene there as an extra reference so the
// place looks the same across episodes. Our cost (≈ $0.035 each), logged.
import { BLOCKY_MODELS } from "./models.js";
import { parseRunware } from "./runware.js";
import { PLATE_STYLE } from "./look.js";

export const PLATE_PURPOSE = "location_plate";

export function platePrompt(description, aspect) {
  return [
    `${aspect === "16:9" ? "Wide 16:9" : "Vertical 9:16"} empty background plate for an animated series: ${String(description).replace(/\.+$/, "")}.`,
    "Nobody in it: no people, no characters, no animals, no text, no logos.",
    `Eye-level view with room in the foreground for characters to stand. ${PLATE_STYLE}`,
  ].join(" ");
}

/** The plate for one location at one aspect, if it has one. */
export const plateOf = (location, aspect) => location?.plates?.[aspect] ?? null;

/**
 * Makes the missing plates for the series locations this episode uses.
 * Returns the bible locations with any new plates added (unchanged ones as they were).
 * A plate that fails is skipped: pictures then work without it.
 * deps: {post(tasks) -> {httpStatus, body}, store({url, path, contentType}) -> url, log(row)}
 */
export async function ensurePlates({ locations, usedIds, aspect, userId, seriesId, deps, uuid = () => crypto.randomUUID() }) {
  const model = BLOCKY_MODELS.image;
  const [width, height] = model.sizes[aspect] ?? model.sizes["9:16"];
  const todo = (locations ?? []).filter((l) => usedIds.includes(l.id) && !plateOf(l, aspect));
  const made = await Promise.all(todo.map(async (l) => {
    const taskUUID = uuid();
    const request = { taskType: "imageInference", taskUUID, model: model.air, positivePrompt: platePrompt(l.description, aspect), width, height, numberResults: 1, outputType: "URL", outputFormat: model.outputFormat ?? "JPG", includeCost: true };
    const t0 = Date.now();
    try {
      const res = await deps.post([request]);
      const parsed = parseRunware(res.body, taskUUID, res.httpStatus);
      if (parsed.state !== "success") throw new Error(`${parsed.code ?? parsed.state}: ${parsed.message ?? ""}`);
      const url = await deps.store({ url: parsed.url, path: `blocky/${userId}/series/${seriesId}/plate-${l.id}-${aspect.replace(":", "x")}.jpg`, contentType: "image/jpeg" });
      await deps.log({ user_id: userId, series_id: seriesId, provider: "runware", model: model.air, purpose: PLATE_PURPOSE, request, response: res.body, http_status: res.httpStatus, ok: true, cost_usd: parsed.cost ?? 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString() });
      return [l.id, url];
    } catch (e) {
      await deps.log({ user_id: userId, series_id: seriesId, provider: "runware", model: model.air, purpose: PLATE_PURPOSE, request, ok: false, error: String(e?.message ?? e).slice(0, 300), cost_usd: 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString() });
      return [l.id, null];
    }
  }));
  const urls = new Map(made.filter(([, u]) => u));
  return (locations ?? []).map((l) => (urls.has(l.id) ? { ...l, plates: { ...(l.plates ?? {}), [aspect]: urls.get(l.id) } } : l));
}

/**
 * Where the previous episode ended. Its planner's endState when there is one;
 * for older episodes, taken from its last scene (who was there, where, feeling).
 */
export function lastEndOf(prevStory, prevScenes) {
  if (prevStory?.end_state?.characters?.length) return prevStory.end_state;
  const last = [...(prevScenes ?? [])].sort((a, b) => b.idx - a.idx)[0];
  if (!last) return null;
  const place = (prevStory?.locations ?? []).find((l) => l.id === last.location_id)?.description ?? "the last place";
  return {
    characters: (last.present_ids ?? []).map((id) => ({ id, where: last.placement || place, feeling: id === last.speaker_id ? last.emotion || "tense" : "watching" })),
    props: [],
  };
}
