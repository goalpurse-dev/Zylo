// deno-lint-ignore-file no-explicit-any
// elevenlabs-quota-check/index.ts — internal, service-key only.
//
// Free pre-check before any paid narration: is ELEVENLABS_KEY valid, which
// plan, and how many characters are used/left this period (GET
// /v1/user/subscription costs no characters). Also used after a run to
// measure the real character spend as a quota delta — ElevenLabs'
// with-timestamps response carries no cost field. Never returns the key.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { ok, err, cors } from "../shared/cors.ts";
import { synthesizeNarrationAudio, DEFAULT_ELEVENLABS_VOICE_SETTINGS } from "../_shared/stickman/narrationAudio.ts";

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  if (!ELEVENLABS_KEY) return ok(req, { ok: false, keyConfigured: false });
  // Diagnostics (free): the last few generations — was a request ever received, when, how many characters.
  const q = await req.clone().json().catch(() => ({}));
  // Phase 6b (free): which voice endpoints this key may use, and what they return.
  if (q?.probeVoices) {
    const get = async (url: string) => { const r = await fetch(url, { headers: { "xi-api-key": ELEVENLABS_KEY } }); const b: any = await r.json().catch(() => null); return { status: r.status, b }; };
    const v1 = await get("https://api.elevenlabs.io/v1/voices");
    const v2 = await get("https://api.elevenlabs.io/v2/voices?page_size=100&include_total_count=true");
    const shared = await get("https://api.elevenlabs.io/v1/shared-voices?page_size=3&use_cases=narrative_story");
    const pick = (list: any[]) => (list ?? []).map((v: any) => ({ id: v.voice_id, name: v.name, category: v.category, labels: v.labels, preview: !!v.preview_url, free_users_allowed: v.free_users_allowed, sharing: v.sharing?.status ?? null }));
    return ok(req, {
      v1: { status: v1.status, count: v1.b?.voices?.length ?? null, voices: pick(v1.b?.voices), detail: v1.b?.detail ?? null },
      v2: { status: v2.status, total: v2.b?.total_count ?? null, detail: v2.b?.detail ?? null },
      shared: { status: shared.status, sample: (shared.b?.voices ?? []).map((v: any) => ({ id: v.voice_id, name: v.name, owner: v.public_owner_id, category: v.category, rate: v.rate, free_users_allowed: v.free_users_allowed, notice: v.notice_period, liveModeration: v.live_moderation_enabled })), detail: shared.b?.detail ?? null },
    });
  }
  // Phase 6b (PAID, one-off): a voice-library sample — the same with-timestamps
  // call and settings as real narration, so its alignment gives the voice's pace.
  if (q?.sample?.voiceId && q?.sample?.text) {
    try {
      const s = await synthesizeNarrationAudio({ elevenLabsKey: ELEVENLABS_KEY, text: String(q.sample.text).slice(0, 400), voiceId: String(q.sample.voiceId), voiceModel: String(q.sample.voiceModel ?? "eleven_flash_v2_5"), voiceSettings: DEFAULT_ELEVENLABS_VOICE_SETTINGS });
      return ok(req, { ok: true, audioBase64: s.audioBase64, mimeType: s.mimeType, durationSeconds: s.durationSeconds, alignment: s.rawAlignment, characterCost: s.characterCost });
    } catch (e) {
      return ok(req, { ok: false, error: String(e).slice(0, 300) });
    }
  }
  if (q?.history) {
    const h = await fetch(`https://api.elevenlabs.io/v1/history?page_size=${Math.min(Number(q.history) || 5, 20)}`, { headers: { "xi-api-key": ELEVENLABS_KEY } });
    const hb: any = await h.json().catch(() => null);
    return ok(req, { ok: h.ok, status: h.status, items: (hb?.history ?? []).map((i: any) => ({ at: new Date((i.date_unix ?? 0) * 1000).toISOString(), voiceId: i.voice_id, model: i.model_id, characters: (i.character_count_change_to ?? 0) - (i.character_count_change_from ?? 0), textChars: String(i.text ?? "").length, state: i.state ?? null })) });
  }

  const res = await fetch("https://api.elevenlabs.io/v1/user/subscription", { headers: { "xi-api-key": ELEVENLABS_KEY } });
  const body: any = await res.json().catch(() => null);
  if (!res.ok) {
    // A scoped key can be valid for TTS but lack user_read. Probe other free
    // endpoints so "restricted" isn't reported as "invalid".
    const body2 = await req.json().catch(() => ({}));
    const probes: Record<string, number> = {};
    for (const [name, url] of [["user", "https://api.elevenlabs.io/v1/user"], ["models", "https://api.elevenlabs.io/v1/models"], ["voice", body2?.voiceId ? `https://api.elevenlabs.io/v1/voices/${body2.voiceId}` : null]] as const) {
      if (!url) continue;
      probes[name] = (await fetch(url, { headers: { "xi-api-key": ELEVENLABS_KEY } })).status;
    }
    return ok(req, { ok: false, keyConfigured: true, keyValid: Object.values(probes).some((s) => s === 200) ? "restricted" : false, subscriptionStatus: res.status, detail: body?.detail?.status ?? body?.detail?.message ?? null, probes });
  }

  return ok(req, {
    ok: true,
    keyConfigured: true,
    keyValid: true,
    tier: body?.tier ?? null,
    status: body?.status ?? null,
    characterCount: body?.character_count ?? null,
    characterLimit: body?.character_limit ?? null,
    charactersLeft: body?.character_limit != null && body?.character_count != null ? body.character_limit - body.character_count : null,
    nextResetUnix: body?.next_character_count_reset_unix ?? null,
    canExtendCharacterLimit: body?.can_extend_character_limit ?? null,
  });
});
