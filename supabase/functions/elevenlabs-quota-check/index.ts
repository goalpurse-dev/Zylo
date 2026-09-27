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

const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ELEVENLABS_KEY = Deno.env.get("ELEVENLABS_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.headers.get("Authorization") !== `Bearer ${SERVICE_KEY}`) return err(req, "Unauthorized", 401);
  if (!ELEVENLABS_KEY) return ok(req, { ok: false, keyConfigured: false });

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
