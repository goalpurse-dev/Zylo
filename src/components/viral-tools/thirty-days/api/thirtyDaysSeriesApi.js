import { supabase } from "../../../../lib/supabaseClient";
import {
  DEFAULT_QUALITY_TIER,
  DEFAULT_VISUAL_STYLE,
  getServiceCredits,
  getThirtyDaysTier,
  normalizeThirtyDaysGeneration,
} from "./thirtyDaysApi";

export const SERIES_SCENE_COUNT = 7;
export const SERIES_TOTAL_DAYS = 30;
export const SERIES_REFERENCE_LIMIT = 40;
export const DAYS_PER_VIDEO_OPTIONS = [
  { value: 1, label: "1 Day", episodes: 30, description: "Daily story series with maximum continuity." },
  { value: 2, label: "2 Days", episodes: 15, description: "Faster story progression." },
  { value: 3, label: "3 Days", episodes: 10, description: "More action per episode." },
  { value: 5, label: "5 Days", episodes: 6, description: "Shorter series with bigger jumps." },
];

export function normalizeSeries(row) {
  if (!row) return row;
  return {
    ...row,
    visualStyle: row.visual_style || DEFAULT_VISUAL_STYLE,
    qualityTier: row.quality_tier || DEFAULT_QUALITY_TIER,
    daysPerEpisode: Number(row.days_per_episode || 1),
    totalDays: Number(row.total_days || SERIES_TOTAL_DAYS),
    currentDay: Number(row.current_day || 0),
    currentEpisode: Number(row.current_episode || 0),
    masterStoryBible: row.master_story_bible || {},
    hiddenFutureBeats: Array.isArray(row.hidden_future_beats) ? row.hidden_future_beats : [],
    referenceLibrary: Array.isArray(row.reference_library) ? row.reference_library : [],
    currentStoryState: row.current_story_state || {},
    verifiedStoryState: row.verified_story_state || row.current_story_state || {},
    franchiseResolution: row.franchise_resolution || null,
    entityRegistry: Array.isArray(row.entity_registry) ? row.entity_registry : [],
    roadmapBeats: Array.isArray(row.roadmap_beats) ? row.roadmap_beats : [],
    pacingState: row.pacing_state || {},
    seriesSchemaVersion: Number(row.series_schema_version || 1),
    planningStage: row.planning_stage || null,
    planningError: row.planning_error || null,
    nextEpisodeTease: row.next_episode_tease || "",
    coverUrl: row.cover_url || null,
    setupGenerationId: row.setup_generation_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    lastActiveAt: row.last_active_at || row.updated_at || null,
  };
}

export function normalizeSeriesEpisode(row) {
  if (!row) return row;
  return {
    ...row,
    seriesId: row.series_id,
    generationId: row.generation_id,
    episodeNumber: Number(row.episode_number || 0),
    startDay: Number(row.start_day || 0),
    endDay: Number(row.end_day || 0),
    storyPlan: row.story_plan || {},
    episodeSummary: row.episode_summary || {},
    stateDelta: row.state_delta || {},
    verifiedEpisode: row.verified_episode || {},
    renderObservations: Array.isArray(row.render_observations) ? row.render_observations : [],
    verificationStatus: row.verification_status || "pending",
    episodePlanVersion: Number(row.episode_plan_version || 1),
    ttsVersion: Number(row.tts_version || 1),
    nextEpisodeTease: row.next_episode_tease || "",
    cliffhangerThread: row.cliffhanger_thread || row.cliffhanger || "",
    daySplitAfterScene: Number(row.day_split_after_scene || 0) || null,
    narrationTake: row.narration_take || null,
    thumbnailUrl: row.thumbnail_url || null,
    finalVideoUrl: row.final_video_url || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    completedAt: row.completed_at || null,
  };
}

export function formatEpisodeRange(startDay, endDay = startDay) {
  return Number(startDay) === Number(endDay) ? `Day ${startDay}` : `Days ${startDay}–${endDay}`;
}

export function nextSeriesRange(series) {
  const startDay = Number(series?.currentDay || 0) + 1;
  const endDay = Math.min(Number(series?.totalDays || SERIES_TOTAL_DAYS), startDay + Number(series?.daysPerEpisode || 1) - 1);
  return { startDay, endDay, label: formatEpisodeRange(startDay, endDay) };
}

export function estimateSeriesSetupCredits(qualityId = DEFAULT_QUALITY_TIER, referenceCount = 5) {
  const tier = getThirtyDaysTier(qualityId);
  return referenceCount * Number(tier.referenceCredits || 5) + 12;
}

export function estimateSeriesEpisodeCredits(qualityId = DEFAULT_QUALITY_TIER, planCode = "starter", newReferenceCount = 0) {
  const tier = getThirtyDaysTier(qualityId);
  const references = Math.max(0, Math.min(3, Number(newReferenceCount || 0))) * Number(tier.referenceCredits || 5);
  const sceneImages = SERIES_SCENE_COUNT * Number(tier.imageCredits || 5);
  const videos = SERIES_SCENE_COUNT * Number(tier.videoCredits || 6);
  const service = getServiceCredits(planCode);
  return { references, sceneImages, videos, service, total: references + sceneImages + videos + service };
}

async function functionMessage(error, fallback) {
  try {
    const body = await error?.context?.json?.();
    return body?.error || body?.message || error?.message || fallback;
  } catch { return error?.message || fallback; }
}

// Series creation runs in the background (see thirty-days-series-planner):
// the edge function returns a draft row the instant it exists, then
// research/planning/critic/reservation happen off the request, persisting
// planning_stage/planning_error as they go. This polls that row until it
// leaves "planning" — either "references" (ready) or "failed" (with a
// resumable planning_payload a retry can pick up from).
const PLANNING_POLL_INTERVAL_MS = 1800;
// Safety ceiling only — the background pipeline has no request-lifetime
// limit of its own, so a run that's still "planning" past this has likely
// stalled (e.g. the isolate was recycled mid-run) rather than merely being
// slow; the caller can always check back or retry.
const PLANNING_POLL_TIMEOUT_MS = 6 * 60 * 1000;

async function pollSeriesPlanning(seriesId, onProgress) {
  const startedAt = Date.now();
  for (;;) {
    const { data, error } = await supabase.from("thirty_days_series").select("*").eq("id", seriesId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Series not found");
    const series = normalizeSeries(data);
    onProgress?.(series);
    if (data.status === "failed") {
      const failure = new Error(series.planningError || "Series planning failed");
      failure.seriesId = seriesId;
      failure.retryable = true;
      throw failure;
    }
    if (data.status !== "planning") return series;
    if (Date.now() - startedAt > PLANNING_POLL_TIMEOUT_MS) {
      const stalled = new Error("Series planning is taking longer than expected. Try again, or check back shortly — it may still finish.");
      stalled.seriesId = seriesId;
      stalled.retryable = true;
      throw stalled;
    }
    await new Promise((resolve) => setTimeout(resolve, PLANNING_POLL_INTERVAL_MS));
  }
}

// onProgress (optional) is called with the normalized series after every
// poll tick — read series.planningStage ("resolving" | "researching" |
// "planning" | "validating" | "reserving") to drive a staged progress UI.
export async function createThirtyDaysSeries({ universe, premise, visualStyle, quality, daysPerEpisode }, onProgress) {
  const { data, error } = await supabase.functions.invoke("thirty-days-series-planner", {
    body: { universe, premise, visualStyle, quality, daysPerEpisode },
  });
  if (error) throw new Error(await functionMessage(error, "Series planning failed to start"));
  if (!data?.ok) throw new Error(data?.error || "Series planning failed to start");
  onProgress?.(normalizeSeries(data.series));
  const series = await pollSeriesPlanning(data.series.id, onProgress);
  const generation = await getSeriesGeneration(series.setupGenerationId);
  return { series, generation };
}

// Resumes a failed/stalled planning attempt from wherever planning_payload
// left off (already-resolved franchise, already-fetched research, an
// already-generated draft plan) instead of restarting the whole pipeline.
export async function retrySeriesPlanning(seriesId, onProgress) {
  const { data, error } = await supabase.functions.invoke("thirty-days-series-planner", { body: { seriesId } });
  if (error) throw new Error(await functionMessage(error, "Retry failed to start"));
  if (!data?.ok) throw new Error(data?.error || "Retry failed to start");
  if (data.alreadyDone) {
    const series = normalizeSeries(data.series);
    const generation = await getSeriesGeneration(series.setupGenerationId);
    return { series, generation };
  }
  onProgress?.(normalizeSeries(data.series));
  const series = await pollSeriesPlanning(seriesId, onProgress);
  const generation = await getSeriesGeneration(series.setupGenerationId);
  return { series, generation };
}

export async function createNextSeriesEpisode(seriesId) {
  const { data, error } = await supabase.functions.invoke("thirty-days-series-episode-planner", { body: { seriesId } });
  if (error) throw new Error(await functionMessage(error, "Episode planning failed"));
  if (!data?.ok) throw new Error(data?.error || "Episode planning failed");
  return { episode: normalizeSeriesEpisode(data.episode), generation: normalizeThirtyDaysGeneration(data.generation), critic: data.critic };
}

export async function completeSeriesSetup(seriesId) {
  const { data, error } = await supabase.rpc("complete_thirty_days_series_setup", { p_series_id: seriesId });
  if (error) throw error;
  return normalizeSeries(data);
}

export async function completeSeriesEpisode({ episodeId, generationId, seriesId, startDay, endDay, episodeSummary, finalVideoUrl, thumbnailUrl }) {
  // episodeSummary is intentionally ignored: planner-authored prose is not
  // canon. The server derives verified events and applies the state delta.
  void episodeSummary;
  const { data: committed, error: commitError } = await supabase.functions.invoke("thirty-days-series-episode-commit", { body: { episodeId, generationId, seriesId, startDay, endDay } });
  if (commitError) throw new Error(await functionMessage(commitError, "Episode verification failed"));
  if (!committed?.ok) throw new Error(committed?.error || "Episode verification failed");
  let episode = committed.episode;
  if (finalVideoUrl) {
    const { data: attached, error: attachError } = await supabase.rpc("attach_thirty_days_series_episode_export", {
      p_episode_id: episode.id, p_final_video_url: finalVideoUrl, p_thumbnail_url: thumbnailUrl || null,
    });
    if (attachError) throw attachError;
    episode = attached;
  }
  return normalizeSeriesEpisode(episode);
}

export async function reopenSeriesVideoRetry(generationId, sceneIndex) {
  const { data, error } = await supabase.rpc("reopen_thirty_days_series_video_retry", {
    p_generation_id: generationId,
    p_scene_index: Number(sceneIndex),
  });
  if (error) throw error;
  return data;
}

export async function reopenSeriesImageRetry(generationId, sceneIndex) {
  const { data, error } = await supabase.rpc("reopen_thirty_days_series_image_retry", {
    p_generation_id: generationId,
    p_scene_index: Number(sceneIndex),
  });
  if (error) throw error;
  return data;
}

export async function reopenReferenceRetry(generationId, referenceId) {
  const { data, error } = await supabase.rpc("reopen_thirty_days_reference_retry", {
    p_generation_id: generationId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return data;
}

export async function deleteLatestSeriesEpisode(episodeId) {
  const { data, error } = await supabase.rpc("delete_latest_thirty_days_series_episode_v2", {
    p_episode_id: episodeId,
  });
  if (error) throw error;
  return normalizeSeries(data);
}

export async function restoreSeriesReferences(seriesId) {
  const { data, error } = await supabase.rpc("restore_thirty_days_series_references", {
    p_series_id: seriesId,
  });
  if (error) throw error;
  return normalizeSeries(data);
}

// Text continuity (startState/continuityFromPrevious, already fed to the
// planner) only tells the model what SHOULD be true at the start of episode
// N+1 — nothing ever showed the image generator the actual last rendered
// frame of episode N to match against, so a mid-action ending (e.g. a fight)
// visually "reset" into a fresh setup instead of picking up the same beat.
// Returns the previous completed episode's final scene image, or null for
// episode 1 / if it isn't available yet. Takes the CURRENT episode's own row
// id (already on every normalized generation as seriesEpisodeId) rather than
// an episode number, since callers only ever have the former on hand.
export async function getPreviousEpisodeEndingImage(seriesId, currentSeriesEpisodeId) {
  if (!seriesId || !currentSeriesEpisodeId) return null;
  const { data: current } = await supabase.from("thirty_days_series_episodes")
    .select("episode_number").eq("id", currentSeriesEpisodeId).maybeSingle();
  const episodeNumber = Number(current?.episode_number || 0);
  if (episodeNumber <= 1) return null;
  const { data: previousEpisode } = await supabase.from("thirty_days_series_episodes")
    .select("generation_id").eq("series_id", seriesId).eq("episode_number", episodeNumber - 1)
    .eq("status", "completed").maybeSingle();
  if (!previousEpisode?.generation_id) return null;
  const { data: previousGeneration } = await supabase.from("thirty_days_generations")
    .select("scenes").eq("id", previousEpisode.generation_id).maybeSingle();
  const scenes = Array.isArray(previousGeneration?.scenes) ? previousGeneration.scenes : [];
  return scenes.at(-1)?.imageUrl || null;
}

export async function removeSeriesReference(seriesId, referenceId) {
  const { data, error } = await supabase.rpc("remove_thirty_days_series_reference", {
    p_series_id: seriesId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return {
    mode: data?.mode || "placeholder_created",
    survivorReferenceId: data?.survivorReferenceId || null,
    series: normalizeSeries(data?.series),
  };
}

export async function beginSeriesReferenceRegeneration(seriesId, referenceId) {
  const { data, error } = await supabase.rpc("begin_thirty_days_series_reference_regeneration", {
    p_series_id: seriesId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function beginSeriesReferenceEdit(seriesId, referenceId, editInstruction) {
  const { data, error } = await supabase.rpc("begin_thirty_days_series_reference_edit", {
    p_series_id: seriesId,
    p_reference_id: referenceId,
    p_edit_instruction: editInstruction,
  });
  if (error) throw error;
  return normalizeThirtyDaysGeneration(data);
}

export async function commitSeriesReferenceRegeneration(seriesId, generationId, referenceId) {
  const { data, error } = await supabase.rpc("commit_thirty_days_series_reference_regeneration", {
    p_series_id: seriesId,
    p_generation_id: generationId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return normalizeSeries(data);
}

export async function commitSeriesReferenceEdit(seriesId, generationId, referenceId) {
  const { data, error } = await supabase.rpc("commit_thirty_days_series_reference_edit", {
    p_series_id: seriesId,
    p_generation_id: generationId,
    p_reference_id: referenceId,
  });
  if (error) throw error;
  return normalizeSeries(data);
}

export async function selectSeriesReferenceImage(seriesId, referenceId, imageId) {
  const { data, error } = await supabase.rpc("select_thirty_days_series_reference_image", {
    p_series_id: seriesId,
    p_reference_id: referenceId,
    p_image_id: imageId,
  });
  if (error) throw error;
  return normalizeSeries(data);
}

export async function listThirtyDaysSeries(limit = 12) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase.from("thirty_days_series").select("*").eq("user_id", user.id).order("last_active_at", { ascending: false }).limit(limit);
  if (error) throw error;
  const seriesRows = (data || []).map(normalizeSeries);
  if (!seriesRows.length) return [];
  const ids = seriesRows.map((series) => series.id);
  const { data: episodes } = await supabase.from("thirty_days_series_episodes")
    .select("series_id,episode_number,thumbnail_url,final_video_url,status,updated_at")
    .in("series_id", ids).order("episode_number", { ascending: false });
  const latest = new Map();
  const counts = new Map();
  for (const row of episodes || []) {
    counts.set(row.series_id, (counts.get(row.series_id) || 0) + (row.status === "completed" ? 1 : 0));
    if (!latest.has(row.series_id)) latest.set(row.series_id, row);
  }
  return seriesRows.map((series) => ({ ...series, latestEpisode: latest.get(series.id) ? normalizeSeriesEpisode(latest.get(series.id)) : null, episodeCount: counts.get(series.id) || 0 }));
}

export async function getThirtyDaysSeries(seriesId) {
  const { data: series, error } = await supabase.from("thirty_days_series").select("*").eq("id", seriesId).maybeSingle();
  if (error) throw error;
  if (!series) return null;
  const { data: episodes, error: episodeError } = await supabase.from("thirty_days_series_episodes").select("*").eq("series_id", seriesId).order("episode_number", { ascending: false });
  if (episodeError) throw episodeError;
  const positionedEpisodes = [...(episodes || [])]
    .sort((a, b) => Number(a.start_day) - Number(b.start_day))
    .map((episode, index) => normalizeSeriesEpisode({ ...episode, episode_number: index + 1 }))
    .reverse();
  return { series: normalizeSeries(series), episodes: positionedEpisodes };
}

export async function getSeriesGeneration(generationId) {
  if (!generationId) return null;
  const { data, error } = await supabase.from("thirty_days_generations").select("*").eq("id", generationId).maybeSingle();
  if (error) throw error;
  return data ? normalizeThirtyDaysGeneration(data) : null;
}
