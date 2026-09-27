import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThirtyDaysBuilder from "../../components/viral-tools/thirty-days/ThirtyDaysBuilder";
import ThirtyDaysDeleteEpisodeModal from "../../components/viral-tools/thirty-days/ThirtyDaysDeleteEpisodeModal";
import ThirtyDaysModeSwitch from "../../components/viral-tools/thirty-days/ThirtyDaysModeSwitch";
import ThirtyDaysResults from "../../components/viral-tools/thirty-days/ThirtyDaysResults";
import ThirtyDaysSeriesHome from "../../components/viral-tools/thirty-days/ThirtyDaysSeriesHome";
import ThirtyDaysSeriesResults from "../../components/viral-tools/thirty-days/ThirtyDaysSeriesResults";
import ThirtyDaysSeriesSetup from "../../components/viral-tools/thirty-days/ThirtyDaysSeriesSetup";
import ThirtyDaysSeriesSidebar from "../../components/viral-tools/thirty-days/ThirtyDaysSeriesSidebar";
import ThirtyDaysVoiceStep from "../../components/viral-tools/thirty-days/ThirtyDaysVoiceStep";
import useThirtyDaysJob from "../../components/viral-tools/thirty-days/hooks/useThirtyDaysJob";
import { SCENE_COUNT, listThirtyDaysGenerations, probeClipDuration, updateThirtyDaysFullVideo } from "../../components/viral-tools/thirty-days/api/thirtyDaysApi";
import { beginSeriesReferenceEdit, beginSeriesReferenceRegeneration, completeSeriesEpisode, completeSeriesSetup, createNextSeriesEpisode, createThirtyDaysSeries, deleteLatestSeriesEpisode, getSeriesGeneration, getThirtyDaysSeries, listThirtyDaysSeries, removeSeriesReference, restoreSeriesReferences, retrySeriesPlanning, selectSeriesReferenceImage } from "../../components/viral-tools/thirty-days/api/thirtyDaysSeriesApi";
import { stitchThirtyDaysVideo } from "../../components/viral-tools/thirty-days/videoEditor/ffmpegStitcher";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { saveFullVideo } from "../../lib/jobs";
import { uploadForExternalFetch } from "../../lib/storage";

const ELIGIBLE = new Set(["starter", "affiliate", "pro", "generative"]);
const ACTIVE_EPISODE_STATUSES = new Set(["planning", "generating", "voiceover", "stitching", "partial"]);

export default function ThirtyDays() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const job = useThirtyDaysJob();
  const [mode, setMode] = useState("single");
  const [planCode, setPlanCode] = useState("free");
  const [voiceTake, setVoiceTake] = useState(null);
  const [exportState, setExportState] = useState({ status: "idle", progress: 0, error: "", url: null });
  const [recent, setRecent] = useState([]);
  const [lastInput, setLastInput] = useState(null);
  const [seriesView, setSeriesView] = useState("home");
  const [seriesItems, setSeriesItems] = useState([]);
  const [activeSeries, setActiveSeries] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [activeEpisode, setActiveEpisode] = useState(null);
  const [seriesBusy, setSeriesBusy] = useState(false);
  const [seriesError, setSeriesError] = useState("");
  const [seriesPlanningSeriesId, setSeriesPlanningSeriesId] = useState(null);
  const [seriesPlanningStage, setSeriesPlanningStage] = useState(null);
  const [mobileTab, setMobileTab] = useState("generate");
  // Gates the voice-step takeover of the left panel: it must only fire right
  // after the user explicitly kicks off a generation (single video, a new
  // episode, or continuing one that was actively mid-flight) — never merely
  // from opening/browsing an already-loaded series or past creation, which
  // was jumping straight into "Tell this episode" instead of the dashboard.
  const [voiceStepArmed, setVoiceStepArmed] = useState(false);
  const [autoDraftEpisodeId, setAutoDraftEpisodeId] = useState(null);
  // Which episode's scenes are pinned open on the results side. Null means
  // the series is showing its base dashboard (Next Episode CTA + a grid of
  // small episode previews) — set only by an explicit click on an episode
  // (or right after kicking off a new one), never by merely opening/browsing
  // the series itself.
  const [focusedEpisodeId, setFocusedEpisodeId] = useState(null);
  // True only for the network round-trip where the episode planner is
  // actually thinking (~15-25s of LLM planning/critic calls before any
  // scene data exists at all) — job.phase/job.generation have nothing to
  // show yet during that window, so the results panel would otherwise sit
  // there looking like nothing happened after clicking Generate.
  const [episodePlanning, setEpisodePlanning] = useState(false);
  const [deletingEpisodeId, setDeletingEpisodeId] = useState(null);
  const [episodePendingDelete, setEpisodePendingDelete] = useState(null);
  const [restoringReferences, setRestoringReferences] = useState(false);
  const [deletingReferenceId, setDeletingReferenceId] = useState(null);
  const [regeneratingReferenceId, setRegeneratingReferenceId] = useState(null);
  const [editingReferenceId, setEditingReferenceId] = useState(null);
  const [selectingReferenceImageId, setSelectingReferenceImageId] = useState(null);
  const setupFinalizingRef = useRef(new Set());
  const episodeFinalizingRef = useRef(new Set());
  const deletedEpisodeIdsRef = useRef(new Set());
  const clips = useMemo(() => [...(job.generation?.scenes || [])].filter((scene) => scene.videoUrl).sort((a, b) => a.index - b.index), [job.generation]);
  const expectedSceneCount = Array.isArray(job.generation?.scenes) ? job.generation.scenes.length : SCENE_COUNT;

  const requireEligibleUser = useCallback(() => {
    if (authLoading) return false;
    if (!user) { navigate("/login?next=/workspace/thirty-days"); return false; }
    if (!ELIGIBLE.has(planCode)) { navigate("/pricing"); return false; }
    return true;
  }, [authLoading, navigate, planCode, user]);

  const loadRecent = useCallback(async () => {
    if (!user) { setRecent([]); return; }
    try { setRecent(await listThirtyDaysGenerations()); }
    catch (caught) { console.error("[ThirtyDays] recent creations failed", caught); }
  }, [user]);
  const loadSeries = useCallback(async () => {
    if (!user) { setSeriesItems([]); return; }
    try { setSeriesItems(await listThirtyDaysSeries()); }
    catch (caught) { console.error("[ThirtyDays] series list failed", caught); setSeriesError(String(caught?.message || caught)); }
  }, [user]);
  const refreshActiveSeries = useCallback(async (seriesId, preferredEpisodeId = null) => {
    const loaded = await getThirtyDaysSeries(seriesId);
    if (!loaded) return null;
    setActiveSeries(loaded.series); setEpisodes(loaded.episodes);
    const preferred = loaded.episodes.find((episode) => episode.id === preferredEpisodeId);
    setActiveEpisode(preferred || loaded.episodes.find((episode) => episode.status === "completed") || null);
    return loaded;
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("plan_code").eq("id", user.id).single().then(({ data }) => setPlanCode(String(data?.plan_code || "free").toLowerCase()));
    void loadRecent(); void loadSeries();
  }, [user, loadRecent, loadSeries]);

  useEffect(() => {
    if (!user || !job.generation?.id || !["references", "voice", "partial", "done", "error"].includes(job.phase)) return;
    if (job.generation.generationMode === "single") void loadRecent();
  }, [job.generation?.id, job.generation?.generationMode, job.phase, user, loadRecent]);

  useEffect(() => {
    const generation = job.generation;
    if (generation?.generationMode !== "series_setup" || job.phase !== "voice" || !generation.seriesId) return;
    if (setupFinalizingRef.current.has(generation.id)) return;
    setupFinalizingRef.current.add(generation.id);
    setSeriesBusy(true); setSeriesError("");
    completeSeriesSetup(generation.seriesId).then(async (series) => {
      setActiveSeries(series); setSeriesView("detail");
      await Promise.all([loadSeries(), refreshActiveSeries(series.id)]);
      job.cancel();
    }).catch((caught) => {
      const message = String(caught?.message || caught);
      // A retried reference can fix this on a later pass — don't permanently
      // lock out completeSeriesSetup for this generation id on failure.
      setupFinalizingRef.current.delete(generation.id);
      setSeriesError(message.includes("SETUP_REFERENCES_INCOMPLETE")
        ? "One of the persistent references didn't finish generating. Retry it below, then reopen this series to try again."
        : message);
    }).finally(() => setSeriesBusy(false));
  // `job` itself is a brand-new object literal every render (the hook returns
  // a fresh object each time), so it must never sit in this array — with it
  // here, this effect re-fires on every render regardless of whether
  // anything relevant changed, which combined with clearing the lock on
  // failure turned into an infinite completeSeriesSetup retry loop (visible
  // as the error banner flickering on/off rapidly). `job.generation` is a
  // real state value that only changes reference on an actual update, so
  // depending on it (not `job`) is what actually gates re-firing correctly.
  }, [job.generation, job.phase, loadSeries, refreshActiveSeries]);

  // Narration is optional, not a gate on completion — the episode is done the
  // moment all 7 scene videos succeed, regardless of whether voiceover was
  // ever generated. This fires as soon as job.phase reaches "voice" with a
  // full set of scene videos, completing with no final_video_url yet (the
  // results panel falls back to showing the raw scene cards for that case).
  // If the user later adds narration, exportVideo's completeSeriesEpisode
  // call attaches the real merged video to this already-completed episode.
  useEffect(() => {
    const generation = job.generation;
    if (generation?.generationMode !== "series_episode" || job.phase !== "voice") return;
    if (!activeEpisode?.id || activeEpisode.status === "completed" || activeEpisode.generationId !== generation.id) return;
    const scenes = generation.scenes || [];
    const videosDone = scenes.filter((scene) => scene.videoStatus === "succeeded" && scene.videoUrl).length;
    if (!scenes.length || videosDone !== scenes.length) return;
    if (episodeFinalizingRef.current.has(activeEpisode.id)) return;
    episodeFinalizingRef.current.add(activeEpisode.id);
    completeSeriesEpisode({
      episodeId: activeEpisode.id,
      generationId: generation.id,
      seriesId: generation.seriesId,
      startDay: activeEpisode.startDay,
      endDay: activeEpisode.endDay,
      episodeSummary: activeEpisode.storyPlan?.episodeSummary || {},
      finalVideoUrl: null,
      thumbnailUrl: scenes[0]?.imageUrl || null,
    }).then(async (completedEpisode) => {
      if (deletedEpisodeIdsRef.current.has(completedEpisode.id)) return;
      setActiveEpisode(completedEpisode);
      await Promise.all([refreshActiveSeries(generation.seriesId, completedEpisode.id), loadSeries()]);
    }).catch((caught) => {
      if (deletedEpisodeIdsRef.current.has(activeEpisode.id)) return;
      episodeFinalizingRef.current.delete(activeEpisode.id);
      setSeriesError(String(caught?.message || caught));
    });
  }, [job.generation, job.phase, activeEpisode, refreshActiveSeries, loadSeries]);

  // Small screens only show one panel at a time — jump to the result tab the
  // moment a generation actually starts so tapping Generate visibly does
  // something instead of appearing to do nothing until manually switched.
  useEffect(() => {
    if (["planning", "references", "scenes", "voice"].includes(job.phase)) setMobileTab("recent");
  }, [job.phase]);

  const generate = (input) => {
    if (!requireEligibleUser()) return;
    setLastInput(input); setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null });
    setVoiceStepArmed(true);
    job.start(input).catch(() => {});
  };
  const openRecent = (row) => {
    setMobileTab("recent");
    setVoiceTake(row.narrationTake || null);
    setExportState(row.fullVideoUrl ? { status: "done", progress: 100, error: "", url: row.fullVideoUrl } : { status: "idle", progress: 0, error: "", url: null });
    setVoiceStepArmed(false);
    job.resume(row);
  };

  const createSeries = async (input) => {
    if (!requireEligibleUser()) return;
    setSeriesBusy(true); setSeriesError(""); setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null });
    setVoiceStepArmed(false); setFocusedEpisodeId(null); setSeriesPlanningSeriesId(null); setSeriesPlanningStage(null);
    try {
      const created = await createThirtyDaysSeries(input, (progress) => {
        setSeriesPlanningSeriesId(progress.id); setSeriesPlanningStage(progress.planningStage);
      });
      setActiveSeries(created.series); setEpisodes([]); setActiveEpisode(null); setSeriesView("detail");
      await job.resume(created.generation);
    } catch (caught) {
      setSeriesError(String(caught?.message || caught));
      if (caught?.retryable && caught?.seriesId) setSeriesPlanningSeriesId(caught.seriesId);
    }
    finally { setSeriesBusy(false); setSeriesPlanningStage(null); }
  };

  const retrySeries = async () => {
    if (!seriesPlanningSeriesId) return;
    setSeriesBusy(true); setSeriesError("");
    try {
      const created = await retrySeriesPlanning(seriesPlanningSeriesId, (progress) => {
        setSeriesPlanningStage(progress.planningStage);
      });
      setSeriesPlanningSeriesId(null);
      setActiveSeries(created.series); setEpisodes([]); setActiveEpisode(null); setSeriesView("detail");
      await job.resume(created.generation);
    } catch (caught) {
      setSeriesError(String(caught?.message || caught));
    }
    finally { setSeriesBusy(false); setSeriesPlanningStage(null); }
  };

  const openSeries = async (item) => {
    setSeriesBusy(true); setSeriesError(""); setMode("series"); setSeriesView("detail"); setMobileTab("generate"); job.cancel();
    setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null });
    setVoiceStepArmed(false); setFocusedEpisodeId(null);
    try {
      const loaded = await getThirtyDaysSeries(item.id);
      setActiveSeries(loaded.series); setEpisodes(loaded.episodes);
      const active = loaded.episodes.find((episode) => ACTIVE_EPISODE_STATUSES.has(episode.status));
      const selected = active || loaded.episodes.find((episode) => episode.status === "completed") || null;
      setActiveEpisode(selected);
      // Reopening the series is just browsing it — it must never silently
      // jump into a *live* scene-by-scene generating view (spinners,
      // progress bars restarting) for a generation that's genuinely still
      // mid-flight; that stays behind the Sidebar's explicit "Continue"
      // click. But once a generation's reservation has settled it is
      // static — resuming it just loads finished state, no live polling
      // restarts — so it's always safe to auto-load, and necessary: a
      // completed-without-narration episode has no finalVideoUrl to fall
      // back on, so its scene cards only render once job.generation is
      // actually loaded.
      const isSetupTarget = loaded.series.status === "references" && Boolean(loaded.series.setupGenerationId);
      const targetGenerationId = isSetupTarget ? loaded.series.setupGenerationId : selected?.generationId || null;
      if (targetGenerationId) {
        const generation = await getSeriesGeneration(targetGenerationId);
        // Setup (the 5 persistent references) is always safe AND necessary to
        // auto-resume even while still "reserved"/mid-flight, unlike an
        // episode: nothing else drives its remaining reference-image jobs
        // forward except job.resume's own polling loop, so gating it the same
        // way episodes intentionally are (behind an explicit "Continue" click
        // that doesn't exist for setup) left references permanently stuck
        // after any page refresh taken before setup finished.
        if (generation && (isSetupTarget || generation.reservationStatus !== "reserved")) await job.resume(generation);
      }
    } catch (caught) { setSeriesError(String(caught?.message || caught)); }
    finally { setSeriesBusy(false); }
  };

  const generateNextEpisode = async () => {
    if (!activeSeries?.id || !requireEligibleUser()) return;
    setSeriesBusy(true); setSeriesError(""); setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null });
    // Arming the voice step here (before the new episode even exists) let a
    // still-armed PREVIOUS episode's stale job.phase === "voice" satisfy
    // showVoice immediately — the left panel would flash straight into the
    // last completed episode's voiceover screen the instant this button was
    // clicked, even before the network request resolved, and stay there if
    // it failed. Clear it and drop the old generation now; only re-arm once
    // the new episode's own generation has actually loaded via resume().
    setVoiceStepArmed(false); setFocusedEpisodeId(null); job.cancel();
    setEpisodePlanning(true);
    try {
      const created = await createNextSeriesEpisode(activeSeries.id);
      setActiveEpisode(created.episode);
      setAutoDraftEpisodeId(created.episode.id);
      setFocusedEpisodeId(created.episode.id);
      setEpisodes((items) => [created.episode, ...items.filter((item) => item.id !== created.episode.id)]);
      await job.resume(created.generation);
      setVoiceStepArmed(true);
    } catch (caught) { setSeriesError(String(caught?.message || caught)); }
    finally { setSeriesBusy(false); setEpisodePlanning(false); }
  };

  const openSeriesEpisode = async (episode) => {
    // Drop the previously selected generation before arming the editor. This
    // prevents even a single render of Episode N's local state under Episode
    // M while the requested generation is loading.
    setVoiceStepArmed(false); setAutoDraftEpisodeId(null); job.cancel();
    setActiveEpisode(episode); setVoiceTake(episode.narrationTake || null);
    setExportState(episode.finalVideoUrl ? { status: "done", progress: 100, error: "", url: episode.finalVideoUrl } : { status: "idle", progress: 0, error: "", url: null });
    setFocusedEpisodeId(episode.id);
    // Clicking an episode always opens its detail view (scenes on the
    // right); the caption step only takes over the left panel when this
    // episode hasn't been narrated/finished yet.
    // A completed-without-narration episode has no finalVideoUrl, so its
    // scene cards only render once job.generation is actually loaded —
    // completion alone is no longer a reason to skip resuming.
    if (!episode.finalVideoUrl && episode.generationId) {
      const generation = await getSeriesGeneration(episode.generationId);
      if (generation) {
        await job.resume(generation);
        setVoiceStepArmed(true);
      }
    }
  };
  // Backing out of the caption editor just un-arms it — the episode stays
  // focused so its scenes remain visible on the results side. Backing out of
  // the results detail view fully clears the focus, returning to the grid.
  const unarmVoiceStep = () => setVoiceStepArmed(false);
  const closeEpisodeDetail = () => { setVoiceStepArmed(false); setFocusedEpisodeId(null); };
  const leaveSeries = () => { job.cancel(); setSeriesView("home"); setActiveSeries(null); setActiveEpisode(null); setFocusedEpisodeId(null); setEpisodePendingDelete(null); void loadSeries(); };

  const deleteSeriesEpisode = async () => {
    const episode = episodePendingDelete;
    if (!activeSeries?.id || !episode?.id || deletingEpisodeId) return;
    const seriesId = activeSeries.id;
    deletedEpisodeIdsRef.current.add(episode.id);
    setDeletingEpisodeId(episode.id); setSeriesBusy(true); setSeriesError("");
    setVoiceStepArmed(false); setFocusedEpisodeId(null); setEpisodePlanning(false);
    setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null });
    job.cancel();
    try {
      await deleteLatestSeriesEpisode(episode.id);
      setActiveEpisode(null);
      const loaded = await refreshActiveSeries(seriesId);
      setActiveEpisode(loaded?.episodes.find((item) => item.status === "completed") || null);
      await loadSeries();
      setSeriesView("detail");
      setMobileTab("generate");
      setEpisodePendingDelete(null);
    } catch (caught) {
      deletedEpisodeIdsRef.current.delete(episode.id);
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("DELETE_ONLY_LATEST_EPISODE")
        ? "Only the most recent episode can be deleted. Refresh the series and try again."
        : message);
      setEpisodePendingDelete(null);
    } finally {
      setDeletingEpisodeId(null); setSeriesBusy(false);
    }
  };

  const restorePersistentReferences = async () => {
    if (!activeSeries?.id || restoringReferences) return;
    setRestoringReferences(true); setSeriesError("");
    try {
      const restored = await restoreSeriesReferences(activeSeries.id);
      setActiveSeries(restored);
      await Promise.all([refreshActiveSeries(restored.id), loadSeries()]);
    } catch (caught) {
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("SETUP_REFERENCES_NOT_FOUND")
        ? "The original setup references could not be found for this series."
        : message);
    } finally {
      setRestoringReferences(false);
    }
  };

  const deletePersistentReference = async (reference) => {
    if (!activeSeries?.id || !reference?.id || deletingReferenceId) return false;
    setDeletingReferenceId(reference.id); setSeriesBusy(true); setSeriesError("");
    try {
      const result = await removeSeriesReference(activeSeries.id, reference.id);
      setActiveSeries(result.series);
      await Promise.all([refreshActiveSeries(activeSeries.id), loadSeries()]);
      return true;
    } catch (caught) {
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("SERIES_REFERENCE_BUSY")
        ? "Wait for the current episode to finish before changing persistent references."
        : message);
      return false;
    } finally {
      setDeletingReferenceId(null); setSeriesBusy(false);
    }
  };

  const regeneratePersistentReference = async (reference) => {
    if (!activeSeries?.id || !reference?.id || regeneratingReferenceId) return;
    const seriesId = activeSeries.id;
    setRegeneratingReferenceId(reference.id); setSeriesBusy(true); setSeriesError("");
    try {
      const generation = await beginSeriesReferenceRegeneration(seriesId, reference.id);
      const updatedSeries = await job.regenerateSeriesReference({ generation, seriesId, referenceId: reference.id });
      setActiveSeries(updatedSeries);
      await Promise.all([refreshActiveSeries(seriesId), loadSeries()]);
    } catch (caught) {
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("INSUFFICIENT_CREDITS")
        ? "Not enough credits to regenerate this reference."
        : message.includes("SERIES_REFERENCE_BUSY")
          ? "Wait for the current episode to finish before regenerating a reference."
          : message);
    } finally {
      setRegeneratingReferenceId(null); setSeriesBusy(false);
    }
  };

  const editPersistentReference = async (reference, editInstruction) => {
    if (!activeSeries?.id || !reference?.id || !String(editInstruction || "").trim() || editingReferenceId) return;
    const seriesId = activeSeries.id;
    setEditingReferenceId(reference.id); setSeriesBusy(true); setSeriesError("");
    try {
      const generation = await beginSeriesReferenceEdit(seriesId, reference.id, String(editInstruction).trim());
      const updatedSeries = await job.editSeriesReference({ generation, seriesId, referenceId: reference.id, editInstruction: String(editInstruction).trim() });
      setActiveSeries(updatedSeries);
      await Promise.all([refreshActiveSeries(seriesId), loadSeries()]);
      return true;
    } catch (caught) {
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("INSUFFICIENT_CREDITS")
        ? "Not enough credits to edit this reference."
        : message.includes("SERIES_REFERENCE_BUSY")
          ? "Wait for the current episode to finish before editing persistent references."
          : message.includes("INVALID_EDIT_INSTRUCTION")
            ? "Describe the edit in a few words, up to 800 characters."
            : message);
      throw caught;
    } finally {
      setEditingReferenceId(null); setSeriesBusy(false);
    }
  };

  const selectPersistentReferenceImage = async (reference, imageVersion) => {
    if (!activeSeries?.id || !reference?.id || !imageVersion?.id || selectingReferenceImageId) return false;
    const seriesId = activeSeries.id;
    setSelectingReferenceImageId(imageVersion.id); setSeriesBusy(true); setSeriesError("");
    try {
      const updatedSeries = await selectSeriesReferenceImage(seriesId, reference.id, imageVersion.id);
      setActiveSeries(updatedSeries);
      await Promise.all([refreshActiveSeries(seriesId), loadSeries()]);
      return updatedSeries;
    } catch (caught) {
      const message = String(caught?.message || caught);
      setSeriesError(message.includes("SERIES_REFERENCE_BUSY")
        ? "Wait for the current episode to finish before switching reference versions."
        : message);
      throw caught;
    } finally {
      setSelectingReferenceImageId(null); setSeriesBusy(false);
    }
  };

  const exportVideo = async (take, savedGeneration) => {
    const activeGeneration = savedGeneration || job.generation;
    setVoiceTake(take);
    if (!take?.audioUrl || clips.length !== expectedSceneCount || !activeGeneration?.id) return;
    setExportState({ status: "rendering", progress: 1, error: "", url: null });
    try {
      const renderedClips = await Promise.all(clips.map(async (clip) => ({
        url: clip.videoUrl,
        duration: await probeClipDuration(clip.videoUrl),
      })));
      const rendered = await stitchThirtyDaysVideo({ clips: renderedClips, watermarkUrl: null, voiceUrl: take.audioUrl, voicePlaybackRate: Number(take.playbackRate) || 1, voiceClipTimings: take.captionScript?.audioClipTimings || [], onProgress: (progress) => setExportState((state) => ({ ...state, progress })) });
      const file = new File([rendered.blob], `thirty-days-${activeGeneration.id}.mp4`, { type: "video/mp4" });
      const uploaded = await uploadForExternalFetch(file, { prefix: activeGeneration.generationMode === "series_episode" ? "thirty-days-series" : "thirty-days-final" }, true);
      if (!uploaded.wasPublic) throw new Error("Final video could not be published to durable storage");
      await saveFullVideo({ resultUrl: uploaded.url, prompt: activeGeneration.title || "30 Days video" });
      const updated = await updateThirtyDaysFullVideo({ generationId: activeGeneration.id, fullVideoUrl: uploaded.url });
      job.setGeneration({ ...job.generation, ...updated, scenes: job.generation.scenes, visualReferences: job.generation.visualReferences });
      if (activeGeneration.generationMode === "series_episode" && activeEpisode?.id) {
        const completedEpisode = await completeSeriesEpisode({ episodeId: activeEpisode.id, generationId: activeGeneration.id, seriesId: activeGeneration.seriesId, startDay: activeEpisode.startDay, endDay: activeEpisode.endDay, episodeSummary: activeEpisode.storyPlan?.episodeSummary || {}, finalVideoUrl: uploaded.url, thumbnailUrl: clips[0]?.imageUrl || null });
        setActiveEpisode(completedEpisode);
        await Promise.all([refreshActiveSeries(activeGeneration.seriesId, completedEpisode.id), loadSeries()]);
      } else await loadRecent();
      setExportState({ status: "done", progress: 100, error: "", url: uploaded.url });
    } catch (caught) { setExportState((state) => ({ ...state, status: "error", error: String(caught?.message || caught) })); }
  };

  const jobBusy = ["planning", "references", "scenes"].includes(job.phase);
  const busy = jobBusy || seriesBusy;
  const showVoice = voiceStepArmed && job.phase === "voice" && clips.length === expectedSceneCount && expectedSceneCount > 0
    && (mode !== "series" || !activeEpisode?.generationId || job.generation?.id === activeEpisode.generationId)
    && !voiceTake?.audioUrl;
  const seriesContext = mode === "series" && activeSeries && activeEpisode ? {
    // The script Edge Function treats these as lookup hints only and reloads
    // the trusted series bible, roadmap, current plan, and previous completed
    // episode from Postgres. Creative continuity must never depend on a stale
    // browser snapshot or on the user supplying billing/story authority.
    mode: "series", seriesId: activeSeries.id, episodeId: activeEpisode.id,
    episodeNumber: activeEpisode.episodeNumber,
    startDay: activeEpisode.startDay, endDay: activeEpisode.endDay,
    previousCliffhanger: episodes.find((episode) => episode.status === "completed" && episode.episodeNumber === activeEpisode.episodeNumber - 1)?.cliffhanger || "",
    nextEpisodeTease: activeEpisode.nextEpisodeTease || "",
    forbiddenFutureBeats: activeSeries.hiddenFutureBeats.filter((beat) => Number(beat.revealDay) > activeEpisode.endDay),
  } : null;
  const changeMode = (nextMode) => {
    if (busy) return;
    setMode(nextMode); setMobileTab("generate"); setVoiceTake(null); setExportState({ status: "idle", progress: 0, error: "", url: null }); job.cancel();
    setVoiceStepArmed(false); setFocusedEpisodeId(null); setEpisodePendingDelete(null);
    if (nextMode === "series") { setSeriesView("home"); setActiveSeries(null); setActiveEpisode(null); void loadSeries(); }
  };
  const draftReady = (saved) => {
    if (!saved) return;
    job.setGeneration({ ...job.generation, ...saved, scenes: job.generation.scenes, visualReferences: job.generation.visualReferences });
    if (mode === "series" && activeEpisode?.generationId === saved.id) {
      const episodePatch = {
        title: saved.title || activeEpisode.title,
        hook: saved.hook || activeEpisode.hook,
        narrationTake: saved.narrationTake || activeEpisode.narrationTake,
      };
      setActiveEpisode((episode) => episode ? { ...episode, ...episodePatch } : episode);
      setEpisodes((items) => items.map((episode) => episode.id === activeEpisode.id ? { ...episode, ...episodePatch } : episode));
    }
  };
  const renderSeriesLeft = () => {
    if (showVoice) return <ThirtyDaysVoiceStep key={activeEpisode?.id || job.generation?.id} generation={job.generation} seriesContext={seriesContext} autoGenerate={autoDraftEpisodeId === activeEpisode?.id} onDraftReady={draftReady} onReady={exportVideo} onBack={seriesContext ? unarmVoiceStep : undefined} />;
    if (seriesView === "setup") return <ThirtyDaysSeriesSetup busy={busy} planCode={planCode} error={seriesError} planningStage={seriesPlanningStage} onRetry={seriesPlanningSeriesId ? retrySeries : null} onCreate={createSeries} onBack={() => { setSeriesError(""); setSeriesView("home"); setSeriesPlanningSeriesId(null); setSeriesPlanningStage(null); }} />;
    if (seriesView === "detail" && activeSeries) {
      const stuckEpisode = episodes.find((episode) => ACTIVE_EPISODE_STATUSES.has(episode.status) && episode.generationId !== job.generation?.id);
      // series_setup (building the 5 persistent references, no scenes yet)
      // and series_episode (an actual 7-scene episode) share the same job
      // hook/phase machinery but must never be labeled the same way — a
      // "Days 1-2" / "0/7 images" progress card during pure reference-
      // building is exactly the confusing mislabel that made setup look
      // like an episode had started generating on its own. "voice" is also
      // excluded here: it means every scene already finished rendering, so
      // nothing is actually "generating" anymore — that phase's job is to
      // drive the caption editor/detail view instead, never this card.
      const genPhaseActive = ["planning", "references", "scenes", "stitching"].includes(job.phase);
      const isEpisodeGen = job.generation?.generationMode === "series_episode";
      const isSetupGen = job.generation?.generationMode === "series_setup";
      return <ThirtyDaysSeriesSidebar series={activeSeries} activeEpisode={activeEpisode} busy={busy}
        episodeActive={(genPhaseActive && isEpisodeGen) || episodePlanning} episodeGeneration={isEpisodeGen ? job.generation : null}
        episodePartial={isEpisodeGen && job.phase === "partial"}
        setupActive={genPhaseActive && isSetupGen} setupGeneration={isSetupGen ? job.generation : null}
        phase={job.phase} progressLabel={job.progressLabel} planCode={planCode} unresumedEpisode={stuckEpisode}
        showOpenEpisode={Boolean(focusedEpisodeId)}
        onContinueEpisode={() => openSeriesEpisode(stuckEpisode)} onGenerateNext={generateNextEpisode} onRetryReference={job.retryReference}
        onDeleteReference={deletePersistentReference} deletingReferenceId={deletingReferenceId}
        onRegenerateReference={regeneratePersistentReference} regeneratingReferenceId={regeneratingReferenceId}
        onEditReference={editPersistentReference} editingReferenceId={editingReferenceId}
        onSelectReferenceImage={selectPersistentReferenceImage} selectingReferenceImageId={selectingReferenceImageId}
        onRestoreReferences={restorePersistentReferences} restoringReferences={restoringReferences}
        onAllSeries={leaveSeries}
        onNewSeries={() => setSeriesView("setup")} />;
    }
    return <ThirtyDaysSeriesHome series={seriesItems} busy={busy} error={seriesError} onCreate={() => setSeriesView("setup")} onOpen={openSeries} onBack={() => changeMode("single")} />;
  };

  return <>
  <main className="flex min-h-full w-full flex-col gap-3 bg-[#0B0D0F] p-3 lg:h-full lg:flex-row lg:overflow-hidden">
    <div className="grid shrink-0 grid-cols-2 rounded-full border border-white/10 bg-white/[0.04] p-1 lg:hidden">
      <button type="button" onClick={() => setMobileTab("generate")} className={`rounded-full px-3 py-2 text-[11px] font-black transition ${mobileTab === "generate" ? "bg-white text-black" : "text-white/45"}`}>Generate</button>
      <button type="button" onClick={() => setMobileTab("recent")} className={`rounded-full px-3 py-2 text-[11px] font-black transition ${mobileTab === "recent" ? "bg-white text-black" : "text-white/45"}`}>Recent</button>
    </div>
    <div className={`w-full shrink-0 flex-col gap-2 lg:flex lg:h-full lg:w-[420px] xl:w-[460px] ${mobileTab === "generate" ? "flex" : "hidden"}`}>
      <div className="shrink-0"><ThirtyDaysModeSwitch mode={mode} onChange={changeMode} disabled={busy} /></div>
      <div className="min-h-0 flex-1">{mode === "series" ? renderSeriesLeft() : showVoice ? <ThirtyDaysVoiceStep key={job.generation?.id} generation={job.generation} onDraftReady={draftReady} onReady={exportVideo} /> : <ThirtyDaysBuilder busy={busy} planCode={planCode} onGenerate={generate} />}</div>
      {exportState.status === "rendering" && <div className="rounded-xl border border-lime-300/15 bg-lime-300/[.06] p-3 text-xs text-lime-100">Finalizing video… {Math.round(exportState.progress)}%</div>}
      {exportState.error && <div className="rounded-xl bg-red-400/10 p-3 text-xs text-red-200">{exportState.error}</div>}
    </div>
    <div className={`min-w-0 lg:block lg:flex-1 lg:h-full lg:overflow-y-auto ${mobileTab === "recent" ? "block" : "hidden"}`}>{mode === "series" ? <ThirtyDaysSeriesResults series={activeSeries} episodes={episodes} activeEpisode={activeEpisode} focusedEpisodeId={focusedEpisodeId} generation={job.generation?.generationMode === "series_episode" ? job.generation : null} phase={job.phase} planning={episodePlanning} progressLabel={job.progressLabel} error={seriesError || job.error} finalVideoUrl={exportState.url || activeEpisode?.finalVideoUrl} onOpenEpisode={openSeriesEpisode} onCloseDetail={closeEpisodeDetail} onDeleteEpisode={setEpisodePendingDelete} deletingEpisodeId={deletingEpisodeId} onRetryVideo={job.retryVideo} onRetryImage={job.retryImage} onBack={leaveSeries} /> : <ThirtyDaysResults generation={job.generation} phase={job.phase} progressLabel={job.progressLabel} error={job.error} finalVideoUrl={exportState.url || job.generation?.fullVideoUrl} exportState={exportState} voiceTake={voiceTake} recentGenerations={recent} onOpenRecent={openRecent} onRetry={lastInput ? () => generate(lastInput) : null} onRetryVideo={job.retryVideo} onBackToSetup={job.cancel} />}</div>
  </main>
  <ThirtyDaysDeleteEpisodeModal episode={episodePendingDelete} deleting={Boolean(deletingEpisodeId)} onConfirm={deleteSeriesEpisode} onCancel={() => setEpisodePendingDelete(null)} />
  </>;
}
