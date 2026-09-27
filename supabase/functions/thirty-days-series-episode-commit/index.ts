// Authenticated entrypoint that derives canon from persisted media/QA state.
// The browser never supplies completion counts, story truth, or state.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyEpisodeFromRenderedScenes } from "../_shared/thirtyDaysSeriesEngine.js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return reply({ ok: false, error: "Method not allowed" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return reply({ ok: false, error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const episodeId = String(body.episodeId || "");
  const generationId = String(body.generationId || "");
  const seriesId = String(body.seriesId || "");
  const startDay = Number(body.startDay || 0);
  const endDay = Number(body.endDay || 0);
  let { data: episode } = await admin.from("thirty_days_series_episodes")
    .select("*, thirty_days_generations!thirty_days_series_episode_generation_fkey(*)").eq("id", episodeId).eq("user_id", user.id).maybeSingle();
  // The browser can still hold the prior selected episode while the background
  // generation has already advanced. The generation row is the authoritative
  // link, so recover from that harmless UI race instead of stranding a fully
  // rendered episode behind an "Episode not found" banner.
  if (!episode && generationId) {
    const lookup = await admin.from("thirty_days_series_episodes")
      .select("*, thirty_days_generations!thirty_days_series_episode_generation_fkey(*)").eq("generation_id", generationId).eq("user_id", user.id).maybeSingle();
    episode = lookup.data;
  }
  // A partially applied/legacy reservation can be missing the episode's
  // backwards `generation_id` even though the generation was created with
  // its immutable `series_episode_id`. Follow that authoritative forward
  // link as a second recovery route, so rendered clips never strand a user.
  if (!episode && generationId) {
    const { data: generationLink } = await admin.from("thirty_days_generations")
      .select("series_episode_id").eq("id", generationId).eq("user_id", user.id).maybeSingle();
    if (generationLink?.series_episode_id) {
      const lookup = await admin.from("thirty_days_series_episodes")
        .select("*, thirty_days_generations!thirty_days_series_episode_generation_fkey(*)").eq("id", generationLink.series_episode_id).eq("user_id", user.id).maybeSingle();
      episode = lookup.data;
    }
  }
  if (!episode && seriesId && startDay > 0 && endDay >= startDay) {
    const lookup = await admin.from("thirty_days_series_episodes")
      .select("*, thirty_days_generations!thirty_days_series_episode_generation_fkey(*)")
      .eq("series_id", seriesId).eq("start_day", startDay).eq("end_day", endDay)
      .eq("user_id", user.id).maybeSingle();
    episode = lookup.data;
  }
  if (!episode) return reply({ ok: false, error: "Episode not found" }, 404);
  if (episode.status === "completed") return reply({ ok: true, episode });
  let generation = Array.isArray(episode.thirty_days_generations) ? episode.thirty_days_generations[0] : episode.thirty_days_generations;
  if (!generation && generationId) {
    const { data } = await admin.from("thirty_days_generations").select("*").eq("id", generationId).eq("user_id", user.id).maybeSingle();
    generation = data;
  }
  if (!generation) return reply({ ok: false, error: "Episode generation missing" }, 409);
  if (generation.reservation_status === "reserved") {
    const { error: settleError } = await admin.rpc("service_settle_thirty_days_generation", { p_generation_id: generation.id });
    if (settleError) return reply({ ok: false, error: settleError.message }, 409);
  }
  try {
    const verified = verifyEpisodeFromRenderedScenes({ episodeId: episode.id, plan: episode.story_plan || {}, scenes: generation.scenes || [] });
    const { data, error } = await admin.rpc("service_commit_thirty_days_series_episode", {
      p_episode_id: episode.id,
      p_verified_episode: { ...verified, nextEpisodeSetup: episode.story_plan?.nextEpisodeTease || null },
      p_state_delta: episode.state_delta || episode.story_plan?.stateDelta || {},
      p_thumbnail_url: generation.scenes?.[0]?.imageUrl || null,
    });
    if (error) throw error;
    return reply({ ok: true, episode: data });
  } catch (error) {
    return reply({ ok: false, error: String((error as Error)?.message || error) }, 409);
  }
});
