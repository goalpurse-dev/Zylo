// deno-lint-ignore-file no-explicit-any
// elevenlabs-pace-sample/index.ts — internal, service-key only.
//
// Voice pace calibration: synthesizes ONE short sample (hard cap 800
// characters) with a given voice/model/speed through the same
// with-timestamps call as the narration pipeline, and returns the audio,
// raw alignment, ElevenLabs' character-cost header and the measured
// words-per-minute. Used to seed src/lib/voicePace.ts — never by users.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { synthesizeNarrationAudio, DEFAULT_ELEVENLABS_VOICE_SETTINGS } from "../_shared/stickman/narrationAudio.ts";
import { alignmentToWords } from "../_shared/ttsAlignment.ts";
import { measuredWpm } from "../../../src/lib/voicePace.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";
const MAX_SAMPLE_CHARS = 800;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "");
  const speed = Number(body?.speed);
  if (!text || text.length > MAX_SAMPLE_CHARS) return err(req, `text must be 1-${MAX_SAMPLE_CHARS} characters`, 400);
  if (!body?.voiceId || !body?.voiceModel || !Number.isFinite(speed)) return err(req, "voiceId, voiceModel and speed are required", 400);

  try {
    const voiceSettings = { ...DEFAULT_ELEVENLABS_VOICE_SETTINGS, speed };
    const s = await synthesizeNarrationAudio({ elevenLabsKey: ELEVENLABS_KEY, text, voiceId: body.voiceId, voiceModel: body.voiceModel, voiceSettings });
    const words = alignmentToWords(s.rawAlignment);
    return ok(req, { ok: true, characters: text.length, voiceSettings, characterCost: s.characterCost, requestId: s.requestId, durationSeconds: s.durationSeconds, wordCount: words.length, wpm: measuredWpm(words), audioBase64: s.audioBase64, rawAlignment: s.rawAlignment });
  } catch (e) {
    // Reported, never retried here.
    return ok(req, { ok: false, error: e instanceof Error ? e.message.slice(0, 400) : String(e) });
  }
});
