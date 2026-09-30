import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/fruitStoryV2Api";
import { errorText } from "../constants";
import { animateAllPrice, clipPrice, estimateLineSec, estimateStory, picturePrice, sceneCountForLength } from "../pricing/fruitV2Estimates";
import useFruitV2Prices from "../pricing/useFruitV2Prices";
import { storyStepBlocker, wizardBlocker } from "../rules";
import { parseScript } from "../script/parseScript";
import useStory from "./useStory";

const NEW_SINGLE = {
  step: "story",
  method: "idea",
  ideaId: null,
  castIds: [],
  prompt: "",
  scriptText: "",
  scriptAssignments: {}, // written name (lowercase) → library character id, chosen by the user
  tierId: "v2",
  lengthSec: 20,
  aspect: "9:16",
  storyId: null,
};

const NEW_DRAFT = { concept: "", castIds: [], opener: "", openerCustom: "", tone: "", episodeCount: 8 };

const NEW_SERIES = {
  view: "list", // list | create | plan | episode
  wizardStep: 0,
  draft: NEW_DRAFT,
  seriesId: null,
  writing: false,
  planError: null,
  episodeNumber: null,
  episode: { tierId: "v2", lengthSec: 20 },
  storyId: null,
};

function scrollPageTop() {
  document.getElementById("workspace-scroll")?.scrollTo({ top: 0, behavior: "instant" });
}

/** Loads an async list into { status, items } with retry. */
function useAsyncList(loader, deps, enabled = true) {
  const [state, setState] = useState({ status: "loading", items: [] });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    setState((s) => ({ status: "loading", items: s.items }));
    loader().then(
      (items) => { if (active) setState({ status: "ready", items }); },
      () => { if (active) setState((s) => ({ status: "error", items: s.items })); },
    );
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt, enabled]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...state, retry };
}

/**
 * All v2 state and actions. The page renders from this; components stay dumb.
 */
export default function useFruitV2Flow(account, characters = []) {
  const [mode, setMode] = useState("single");
  const [tab, setTabState] = useState("build");
  const [recentTab, setRecentTab] = useState("single");
  const [single, setSingle] = useState(NEW_SINGLE);
  const [series, setSeries] = useState(NEW_SERIES);
  const [ideaSeed, setIdeaSeed] = useState(0);
  const [library, setLibrary] = useState(null); // "single" | "series" | null
  const [assigning, setAssigning] = useState(null); // script name being matched to a character
  const [sceneDialog, setSceneDialog] = useState(null); // { kind, sceneId }
  const [upgradeTier, setUpgradeTier] = useState(null);
  const [noCredits, setNoCredits] = useState(null); // { needed }
  const [acting, setActing] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [captionsBusy, setCaptionsBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeStoryId = mode === "single" ? single.storyId : series.view === "episode" ? series.storyId : null;
  const live = useStory(activeStoryId);
  const story = live.story;
  const quotes = useFruitV2Prices(story?.aspect ?? (mode === "single" ? single.aspect : "9:16"));

  const ideas = useAsyncList(() => api.getIdeas({ seed: ideaSeed }), [ideaSeed]);
  const recent = useAsyncList(() => api.listRecent({ type: recentTab }), [recentTab, refreshKey], !activeStoryId);
  const seriesList = useAsyncList(() => api.listSeries(), [refreshKey], mode === "series");
  const activeSeries = useAsyncList(
    () => (series.seriesId ? api.getSeries(series.seriesId).then((s) => [s]) : Promise.resolve([])),
    [series.seriesId, refreshKey],
    Boolean(series.seriesId),
  );
  const seriesData = series.seriesId ? activeSeries.items[0] ?? null : null;

  // When an episode's final video is ready, refresh the series so the next one unlocks.
  const lastStatus = useRef(null);
  useEffect(() => {
    const status = story?.status ?? null;
    if (status === "final_ready" && lastStatus.current && lastStatus.current !== "final_ready") setRefreshKey((k) => k + 1);
    if (status !== "building") setCaptionsBusy(false);
    lastStatus.current = status;
  }, [story?.status]);

  const setTab = useCallback((next) => { setTabState(next); scrollPageTop(); }, []);
  const clearError = () => setActionError(null);

  const guard = () => {
    if (account.needsUpgrade) { account.paywall.show(); return false; }
    return true;
  };

  const run = async (name, fn, fallback) => {
    setActing(name);
    setActionError(null);
    try {
      return await fn();
    } catch (err) {
      setActionError(errorText(err, fallback));
      return null;
    } finally {
      setActing(null);
    }
  };

  // ── Single video ───────────────────────────────────────────────────────
  const updateSingle = (patch) => { clearError(); setSingle((s) => ({ ...s, ...patch })); };
  const scriptParse = useMemo(
    () => parseScript(single.scriptText, characters, single.scriptAssignments),
    [single.scriptText, single.scriptAssignments, characters],
  );
  const scriptLines = scriptParse.script;
  const scriptScenes = single.method === "script"
    ? { count: scriptLines.length, lengthSec: Math.max(15, scriptLines.reduce((sum, r) => sum + estimateLineSec(r.line), 0)) }
    : null;
  const singleEstimate = estimateStory({
    lengthSec: scriptScenes?.lengthSec ?? single.lengthSec,
    tierId: single.tierId,
    prices: quotes.prices,
    sceneCount: scriptScenes?.count,
  });

  const startSingle = async () => {
    if (!guard()) return;
    const pictures = singleEstimate.pictures;
    if (singleEstimate.total != null && singleEstimate.total > account.balance) { setNoCredits({ needed: singleEstimate.total }); return; }
    const created = await run("start", async () => {
      const input = {
        source: single.method,
        quality: single.tierId,
        lengthSec: single.lengthSec,
        aspect: single.aspect,
        // Script mode: the cast is whoever speaks in the script.
        castIds: single.method === "script" ? scriptParse.speakerIds : single.castIds,
        ...(single.method === "idea" ? { ideaId: single.ideaId } : {}),
        ...(single.method === "prompt" ? { prompt: single.prompt.trim() } : {}),
        ...(single.method === "script" ? { script: scriptLines } : {}),
      };
      const draft = await api.createStory(input);
      live.replace(draft);
      setSingle((s) => ({ ...s, storyId: draft.id }));
      const started = await api.generateScenePictures(draft.id);
      account.spend(pictures ?? 0);
      return started;
    }, "We couldn't write the script. Nothing was charged. Try again.");
    if (created) { live.replace(created); setTab("result"); }
  };

  // ── Pipeline (single video or episode) ─────────────────────────────────
  const makePictures = async () => {
    if (!story || !guard()) return;
    const price = picturePrice(quotes.prices);
    const next = await run("pictures", () => api.generateScenePictures(story.id), "We couldn't start the scene pictures. Nothing was charged. Try again.");
    if (next) { account.spend((price ?? 0) * story.scenes.length); live.replace(next); }
  };

  const animate = async () => {
    if (!story || !guard()) return;
    const price = animateAllPrice(story, quotes.prices);
    if (price != null && price > account.balance) { setNoCredits({ needed: price }); return; }
    const next = await run("animate", () => api.animateAll(story.id), "We couldn't start animating. Nothing was charged. Try again.");
    if (next) { account.spend(price ?? 0); live.replace(next); }
  };

  const makeFinal = async () => {
    if (!story) return;
    const next = await run("final", () => api.buildFinal(story.id, { captions: story.final?.captions ?? true }), "We couldn't start the final video. Try again.");
    if (next) live.replace(next);
  };

  const setCaptions = async (captions) => {
    if (!story) return;
    setCaptionsBusy(true);
    const next = await run("captions", () => api.buildFinal(story.id, { captions }), "We couldn't update the captions. Try again.");
    if (next) live.replace(next); else setCaptionsBusy(false);
  };

  const sceneById = (id) => story?.scenes.find((s) => s.id === id) ?? null;
  const dialogScene = sceneDialog ? sceneById(sceneDialog.sceneId) : null;
  const dialogPrice = dialogScene
    ? sceneDialog.kind === "clip" ? clipPrice(story.quality, dialogScene.durationSec, quotes.prices) : picturePrice(quotes.prices)
    : null;

  const submitSceneDialog = async (text) => {
    if (!dialogScene || !guard()) return;
    if (dialogPrice != null && dialogPrice > account.balance) {
      throw new Error(`This costs ${dialogPrice} credits and you have ${account.balance}. Add credits to continue.`);
    }
    const call = sceneDialog.kind === "edit" ? api.editScene(dialogScene.id, text)
      : sceneDialog.kind === "regenerate" ? api.regenerateScene(dialogScene.id, text)
        : api.regenerateClip(dialogScene.id);
    const next = await call;
    account.spend(dialogPrice ?? 0);
    live.replace(next);
  };

  const download = async () => {
    if (!story?.final?.url) return;
    const { saveMediaToDevice } = await import("../../../../lib/downloadMedia");
    const name = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "fruit-story";
    await saveMediaToDevice({ url: story.final.url, filename: `${name}.mp4`, title: story.title }).catch(() => {
      setActionError("We couldn't download the video. Try again.");
    });
  };

  const newStory = () => {
    setSingle((s) => ({ ...NEW_SINGLE, tierId: s.tierId, lengthSec: s.lengthSec, aspect: s.aspect }));
    setActionError(null);
    setRefreshKey((k) => k + 1);
    setTab("build");
  };

  const openSingle = (storyId) => {
    setMode("single");
    setSingle((s) => ({ ...s, storyId }));
    setActionError(null);
    setTab("result");
  };

  // ── Series ─────────────────────────────────────────────────────────────
  const updateDraft = (patch) => setSeries((s) => ({ ...s, draft: { ...s.draft, ...patch } }));
  const openSeries = (seriesId) => {
    setMode("series");
    setSeries((s) => ({ ...s, view: "plan", seriesId, storyId: null, episodeNumber: null, writing: false, planError: null }));
    setActionError(null);
    setTab("result");
  };
  const newSeries = () => setSeries((s) => ({ ...s, view: "create", wizardStep: 0, draft: NEW_DRAFT, planError: null }));
  const wizardNext = () => setSeries((s) => ({ ...s, wizardStep: Math.min(4, s.wizardStep + 1) }));
  const wizardBack = () => setSeries((s) => (s.wizardStep === 0 ? { ...s, view: "list" } : { ...s, wizardStep: s.wizardStep - 1 }));

  const createPlan = async () => {
    if (!guard()) return;
    const d = series.draft;
    setSeries((s) => ({ ...s, writing: true, planError: null }));
    setTab("result");
    try {
      const created = await api.createSeriesPlan({
        concept: d.concept.trim(),
        castIds: d.castIds,
        opener: d.opener === "Something else" ? d.openerCustom.trim() : d.opener,
        tone: d.tone,
        episodeCount: d.episodeCount,
      });
      setRefreshKey((k) => k + 1);
      setSeries((s) => ({ ...s, writing: false, view: "plan", seriesId: created.id, draft: NEW_DRAFT, wizardStep: 0 }));
    } catch (err) {
      setSeries((s) => ({ ...s, writing: false, planError: errorText(err, "We couldn't write the series plan. Nothing was charged. Try again.") }));
    }
  };

  const startEpisode = (number) => {
    const ep = seriesData?.episodes.find((e) => e.number === number);
    const tierId = account.allowedTiers.includes("v3") ? "v3" : "v2";
    setSeries((s) => ({ ...s, view: "episode", episodeNumber: number, storyId: ep?.storyId ?? null, episode: { tierId, lengthSec: 20 } }));
    setActionError(null);
    setTab(ep?.storyId ? "result" : "build");
  };

  const episodeEstimate = estimateStory({ lengthSec: series.episode.lengthSec, tierId: series.episode.tierId, prices: quotes.prices });

  const startEpisodeStory = async () => {
    if (!guard() || !seriesData) return;
    if (episodeEstimate.total != null && episodeEstimate.total > account.balance) { setNoCredits({ needed: episodeEstimate.total }); return; }
    const created = await run("start", async () => {
      const draft = await api.createStory({
        source: "idea",
        seriesId: seriesData.id,
        episodeNumber: series.episodeNumber,
        castIds: seriesData.castIds,
        quality: series.episode.tierId,
        lengthSec: series.episode.lengthSec,
        aspect: "9:16",
      });
      live.replace(draft);
      setSeries((s) => ({ ...s, storyId: draft.id }));
      const started = await api.generateScenePictures(draft.id);
      account.spend(episodeEstimate.pictures ?? 0);
      return started;
    }, "We couldn't write this episode. Nothing was charged. Try again.");
    if (created) { live.replace(created); setTab("result"); }
  };

  const backToSeries = () => {
    setSeries((s) => ({ ...s, view: s.seriesId ? "plan" : "list", storyId: null, episodeNumber: null }));
    setActionError(null);
    setRefreshKey((k) => k + 1);
    setTab(series.seriesId ? "result" : "build");
  };
  const allSeries = () => {
    setSeries((s) => ({ ...s, view: "list", seriesId: null, storyId: null, episodeNumber: null }));
    setRefreshKey((k) => k + 1);
    setTab("build");
  };

  const changeMode = (next) => {
    setMode(next);
    setActionError(null);
    if (next === "series") setRecentTab("series");
    if (next === "single") setRecentTab("single");
    setTab("build");
  };

  // ── Library dialog wiring ──────────────────────────────────────────────
  const libraryIds = library === "series" ? series.draft.castIds : single.castIds;
  const libraryMax = library === "series" ? api.LIMITS.maxCastSeries : api.LIMITS.maxCastSingle;
  const toggleLibrary = (id) => {
    const has = libraryIds.includes(id);
    const next = has ? libraryIds.filter((c) => c !== id) : [...libraryIds, id];
    if (library === "series") updateDraft({ castIds: next });
    else updateSingle({ castIds: next });
  };

  // Script tab: "Who is 'Mia'?" → pick one library character for that name.
  const assignName = (nameKey, characterId) => {
    updateSingle({ scriptAssignments: { ...single.scriptAssignments, [nameKey]: characterId } });
    setAssigning(null);
  };

  const storyBlocker = useMemo(() => storyStepBlocker(single, scriptParse), [single, scriptParse]);

  return {
    mode, changeMode, tab, setTab, recentTab, setRecentTab,
    single, updateSingle, singleEstimate, scriptScenes, scriptParse, storyBlocker, startSingle, newStory, openSingle,
    assigning, startAssigning: setAssigning, cancelAssigning: () => setAssigning(null), assignName,
    ideas: { ...ideas, seed: ideaSeed }, newIdeas: () => { setIdeaSeed((n) => n + 1); updateSingle({ ideaId: null }); },
    series, seriesData, seriesStatus: activeSeries.status, retrySeries: activeSeries.retry, seriesList,
    updateDraft, newSeries, wizardNext, wizardBack, wizardBlocker: wizardBlocker(series.wizardStep, series.draft), createPlan,
    openSeries, startEpisode, startEpisodeStory, backToSeries, allSeries, episodeEstimate,
    updateEpisode: (patch) => setSeries((s) => ({ ...s, episode: { ...s.episode, ...patch } })),
    story, storyStatus: live.status, reloadStory: live.reload, quotes, recent,
    acting, actionError, clearError, captionsBusy,
    pipeline: { onMakePictures: makePictures, onAnimate: animate, onMakeFinal: makeFinal, onDownload: download, onNewStory: newStory, onBackToSeries: backToSeries, onAddCredits: () => setNoCredits({ needed: animateAllPrice(story, quotes.prices) ?? 0 }) },
    setCaptions,
    library, openLibrary: setLibrary, closeLibrary: () => setLibrary(null), libraryIds, libraryMax, toggleLibrary,
    sceneDialog, dialogScene, dialogPrice, openSceneDialog: (kind, scene) => setSceneDialog({ kind, sceneId: scene.id }), closeSceneDialog: () => setSceneDialog(null), submitSceneDialog,
    upgradeTier, setUpgradeTier, noCredits, setNoCredits,
    sceneCountForLength,
  };
}
