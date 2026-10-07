// Transcripts of the clips, with word timestamps. One speech-to-text call per
// clip (OpenAI whisper-1, the cheapest option that returns word times: $0.006
// per audio minute, ≈ $0.0005 per 5 s clip). Every call is logged to
// blocky_ai_calls with its cost and reused for the same clip URL, so the clip
// check, toggling captions and rebuilding never pay twice.
// Used for: the clip check (did the voice say the line: clipCheck.js) and the
// final video (where each clip is trimmed, when each caption word shows, and
// what the caption says when the voice changed the line).
// Any failure returns null for that clip; the final then times the line over
// the detected speech instead.

export const WHISPER_MODEL = "whisper-1";
export const WHISPER_USD_PER_MIN = 0.006;
export const CAPTION_PURPOSE = "caption_words";

/** [{word,start,end}] from a verbose_json transcription, or null. */
export function wordsFrom(json) {
  const words = Array.isArray(json?.words) ? json.words : null;
  if (!words?.length) return null;
  return words
    .filter((w) => typeof w?.word === "string" && Number.isFinite(w.start) && Number.isFinite(w.end))
    .map((w) => ({ word: w.word.trim(), start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 }));
}

/**
 * @param {object} o
 * @param {object} o.admin      service-role client
 * @param {string} o.apiKey     OpenAI key ("" → no calls)
 * @param {boolean} o.paidOff   BLOCKY_PAID_CALLS=off → no calls
 * @param {string} o.userId
 * @param {string} o.storyId
 * @param {{sceneId:string, url:string, durationSec:number}[]} o.clips
 * @returns {Promise<({words:object[], text:string}|null)[]>} transcript per clip, same order
 *   (heard: false marks a call that worked but found no words: the clip is silent)
 */
export async function transcriptsForClips({ admin, apiKey, paidOff, userId, storyId, clips, fetchImpl = fetch }) {
  const { data: cached } = await admin.from("blocky_ai_calls").select("request, response").eq("story_id", storyId).eq("purpose", CAPTION_PURPOSE).eq("ok", true);
  const byUrl = new Map((cached ?? []).map((c) => [c.request?.clipUrl, c.response ?? null]));
  return Promise.all(clips.map(async (clip) => {
    const hit = byUrl.get(clip.url);
    if (hit?.words?.length) return { words: hit.words, text: String(hit.text ?? hit.words.map((w) => w.word).join(" ")) };
    if (paidOff || !apiKey) return null;
    const t0 = Date.now();
    const request = { model: WHISPER_MODEL, clipUrl: clip.url, response_format: "verbose_json", timestamp_granularities: ["word"], language: "en" };
    try {
      const media = await fetchImpl(clip.url, { signal: AbortSignal.timeout(30_000) });
      if (!media.ok) throw new Error(`clip download ${media.status}`);
      const form = new FormData();
      form.append("file", new Blob([await media.arrayBuffer()], { type: "video/mp4" }), "clip.mp4");
      form.append("model", WHISPER_MODEL);
      form.append("response_format", "verbose_json");
      form.append("timestamp_granularities[]", "word");
      form.append("language", "en");
      const res = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: form, signal: AbortSignal.timeout(45_000) });
      const json = await res.json().catch(() => null);
      const words = res.ok ? wordsFrom(json) : null;
      const seconds = Number(json?.duration) || clip.durationSec || 0;
      await admin.from("blocky_ai_calls").insert({
        user_id: userId, story_id: storyId, scene_id: clip.sceneId, provider: "openai", model: WHISPER_MODEL, purpose: CAPTION_PURPOSE,
        request, response: { text: json?.text ?? null, duration: json?.duration ?? null, words }, http_status: res.status, ok: Boolean(words),
        error: words ? null : String(json?.error?.message ?? "no words").slice(0, 300),
        cost_usd: res.ok ? (seconds / 60) * WHISPER_USD_PER_MIN : 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString(),
      });
      if (words) return { words, text: String(json?.text ?? words.map((w) => w.word).join(" ")) };
      // The call worked and heard nothing: the clip has no speech (the clip check remakes it).
      return res.ok ? { words: [], text: "", heard: false } : null;
    } catch (e) {
      await admin.from("blocky_ai_calls").insert({
        user_id: userId, story_id: storyId, scene_id: clip.sceneId, provider: "openai", model: WHISPER_MODEL, purpose: CAPTION_PURPOSE,
        request, ok: false, error: String(e?.message ?? e).slice(0, 300), cost_usd: 0, latency_ms: Date.now() - t0, completed_at: new Date().toISOString(),
      });
      return null;
    }
  }));
}

/** Word timestamps only (the shape the final video job has always carried). */
export async function captionWordsForClips(o) {
  return (await transcriptsForClips(o)).map((t) => (t?.words?.length ? t.words : null));
}
