import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../api/blockyStoriesApi";
import { DEFAULT_LENGTH_SEC, IDEAS_ON, errorText } from "../constants";
import { animateAllPrice, clipPrice, clipSecondsFor, estimateStory, picturePrice, picturesStepPrice, sceneCountForLength } from "../pricing/blockyEstimates";
import useBlockyPrices from "../pricing/useBlockyPrices";
import { storyStepBlocker, wizardBlocker } from "../rules";
import { parseScript } from "../script/parseScript";
import useStory from "./useStory";

const NEW_SINGLE = {
  step: "story",
  method: IDEAS_ON ? "idea" : "prompt",
  ideaId: null,
  castIds: [],
  prompt: "",
  scriptText: "",
  scriptAssignments: {}, // written name (lowercase) → library character id, chosen by the user
  tierId: "v2",
  lengthSec: DEFAULT_LENGTH_SEC,
  aspect: "9:16",
  storyId: null,
  draft: null,   // the three versions being written or waiting for a pick: {status: "planning"} then the server's draft
};

const DRAFT_KEY = "blocky:draft";
const remember = (id) => { try { if (id) localStorage.setItem(DRAFT_KEY, id); else localStorage.removeItem(DRAFT_KEY); } catch { /* private window: the versions are simply not kept over a reload */ } };
const remembered = () => { try { return localStorage.getItem(DRAFT_KEY); } catch { return null; } };
/** Three answers can arrive in any order: a version that is done never goes back to "writing". */
const mergeDraft = (prev, next) => (!prev?.versions || prev.id !== next.id ? next : {
  ...next,
  versions: next.versions.map((v) => { const old = prev.versions.find((x) => x.n === v.n); return old && old.status !== "writing" && v.status === "writing" ? old : v; }),
  left: next.left ?? prev.left,
});

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
      (err) => { if (active) setState((s) => ({ status: "error", items: s.items, error: errorText(err, null) })); },
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
export default function useBlockyFlow(account, characters = []) {
  const [mode, setMode] = useState("single");
  const [tab, setTabState] = useState("build");
  const [recentTab, setRecentTab] = useState("single");
  const [single, setSingle] = useState(NEW_SINGLE);
  const [series, setSeries] = useState(NEW_SERIES);
  // Ideas are written by a model, so a batch is only made when the user asks for one. The first batch starts
  // somewhere new on every visit.
  const [ideaSeed, setIdeaSeed] = useState(() => Math.floor(Math.random() * 1000));
  const [ideasAsked, setIdeasAsked] = useState(false);
  const [library, setLibrary] = useState(null); // "single" | "series" | null
  const [assigning, setAssigning] = useState(null); // script name being matched to a character
  const [sceneDialog, setSceneDialog] = useState(null); // { kind, sceneId }
  const [upgradeTier, setUpgradeTier] = useState(null);
  const [noCredits, setNoCredits] = useState(null); // { needed }
  const [gate, setGate] = useState(null); // "signup" (a guest pressed a button) | "plan" (the free plan did) | null
  const [acting, setActing] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [captionsBusy, setCaptionsBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeStoryId = mode === "single" ? single.storyId : series.view === "episode" ? series.storyId : null;
  const live = useStory(activeStoryId);
  const story = live.story;
  const quotes = useBlockyPrices(story?.aspect ?? (mode === "single" ? single.aspect : "9:16"));

  const ideas = useAsyncList(() => api.getIdeas({ seed: ideaSeed }), [ideaSeed], IDEAS_ON && ideasAsked);
  // Only real, signed-in history: guests see the example video instead.
  const recent = useAsyncList(() => api.listRecent({ type: recentTab }), [recentTab, refreshKey], !activeStoryId && (Boolean(account.user) || account.isPreview));
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

  // Who may press what (the server refuses the same things): a signed-out visitor looks around, and any
  // button that makes or continues something opens the sign-up popup; the free plan may ask for ideas, and
  // everything after that asks for a plan.
  const guard = (what = "make") => {
    if (account.viewer === "guest") { setGate("signup"); return false; }
    if (account.viewer === "noPlan" && what !== "ideas") { setGate("plan"); return false; }
    return true;
  };
  // A signed-out visitor on a phone lands on the videos, not on a form.
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || account.viewer !== "guest") return;
    landed.current = true;
    setTabState("result");
  }, [account.viewer]);

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
    // The same clip lengths the server will charge for these exact lines.
    ? { count: scriptLines.length, lengthSec: scriptLines.reduce((sum, r) => sum + clipSecondsFor(r.line, single.tierId), 0) }
    : null;
  const singleEstimate = estimateStory({
    lengthSec: scriptScenes?.lengthSec ?? single.lengthSec,
    tierId: single.tierId,
    prices: quotes.prices,
    sceneCount: scriptScenes?.count,
    scripted: single.method !== "script",   // our writing is paid with the pictures; the user's own script isn't
  });

  // ── Three versions (an idea or a description; the user's own script is staged as it is) ──
  const [picking, setPicking] = useState(null);
  const setDraft = (fn) => setSingle((s) => ({ ...s, draft: typeof fn === "function" ? fn(s.draft) : fn }));
  // Every version that is not written yet is asked for now, all at once; each card fills in as its answer lands.
  const asking = useRef(new Set());   // "draftId:n" of the versions this page is waiting for
  const writeMissing = (draft) => {
    for (const v of draft.versions.filter((x) => x.status === "writing")) {
      const key = `${draft.id}:${v.n}`;
      if (asking.current.has(key)) continue;
      asking.current.add(key);
      const failed = (d) => (d?.id === draft.id ? { ...d, versions: d.versions.map((x) => (x.n === v.n && x.status === "writing" ? { ...x, status: "failed", error: "We couldn't write this version. Pick another one, or write three new ones." } : x)) } : d);
      api.writeVersion(draft.id, v.n).then(
        (next) => setDraft((d) => (d?.id === next.id ? mergeDraft(d, next) : d)),
        // The answer got lost: the server may still have finished it. What it says now counts.
        () => api.getDraft(draft.id).then((next) => setDraft((d) => (d?.id === next.id ? failed(mergeDraft(d, next)) : d)), () => setDraft(failed)),
      ).finally(() => asking.current.delete(key));
    }
  };
  // A version another tab (or the page before a reload) asked for is not ours to wait on: look again every few
  // seconds while any card is still being written. The server decides whether a stuck one is started again.
  const draftId = single.draft?.id ?? null;
  const stillWriting = single.draft?.versions?.some((v) => v.status === "writing") ?? false;
  useEffect(() => {
    if (!draftId || !stillWriting) return undefined;
    const t = setInterval(() => {
      api.getDraft(draftId).then((next) => { setDraft((d) => (d?.id === next.id ? mergeDraft(d, next) : d)); writeMissing(next); }, () => {});
    }, 8000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, stillWriting]);
  const startVersions = async () => {
    if (!guard()) return;
    const idea = single.method === "idea" ? ideas.items.find((i) => i.id === single.ideaId) : null;
    const before = single.draft?.id ? single.draft : null;   // "three new ones": the old three stay if the new plan fails
    setTab("result");   // phones: jump to the cards while the twist is planned
    setDraft({ status: "planning", versions: [] });
    const draft = await run("versions", () => api.startDraft({
      source: single.method, quality: single.tierId, lengthSec: single.lengthSec, aspect: single.aspect, castIds: single.castIds,
      ...(idea ? { ideaId: idea.id, idea: { title: idea.title, hook: idea.hook, summary: idea.summary } } : { prompt: single.prompt.trim() }),
    }), "We couldn't plan this story. Nothing was charged. Try again.");
    if (!draft) { setDraft(before); if (!before) setTab("build"); return; }   // failed: the error is on the Build tab (or above the old three)
    remember(draft.id);
    setDraft(draft);
    writeMissing(draft);
  };
  const pickVersion = async (n) => {
    if (!single.draft?.id || picking) return;
    setPicking(n);
    const made = await run("pick", () => api.pickVersion(single.draft.id, n), "We couldn't finish this version. Nothing was charged. Try again.");
    setPicking(null);
    if (!made) return;
    remember(null);
    live.replace(made);
    setSingle((s) => ({ ...s, storyId: made.id, draft: null }));
  };
  const leaveVersions = () => { remember(null); clearError(); setSingle((s) => ({ ...s, draft: null, step: "story" })); setTab("build"); };
  // A reload in the middle: the versions are still on the server.
  useEffect(() => {
    const id = account.user ? remembered() : null;
    if (!id) return;
    api.getDraft(id).then(
      (draft) => {
        if (draft.status === "picked" || draft.status === "failed") { remember(null); return; }
        setSingle((s) => (s.storyId || s.draft ? s : { ...s, draft, step: "settings" }));
        writeMissing(draft);
      },
      () => remember(null),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(account.user)]);

  const startSingle = async () => {
    if (!guard()) return;
    if (single.method !== "script") return startVersions();
    const pictures = singleEstimate.pictures;
    if (singleEstimate.total != null && singleEstimate.total > account.balance) { setNoCredits({ needed: singleEstimate.total }); return; }
    setTab("result");   // phones: jump to the storyboard while the script is written
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
    if (created) { live.replace(created); setTab("result"); } else setTab("build");   // failed: the error is on the Build tab
  };

  // ── Pipeline (single video or episode) ─────────────────────────────────
  const makePictures = async () => {
    if (!story || !guard()) return;
    const price = picturesStepPrice(story, quotes.prices);
    const next = await run("pictures", () => api.generateScenePictures(story.id), "We couldn't start the scene pictures. Nothing was charged. Try again.");
    if (next) { account.spend(price ?? 0); live.replace(next); }
  };

  const animate = async () => {
    if (!story || !guard()) return;
    const price = animateAllPrice(story, quotes.prices);
    if (price != null && price > account.balance) { setNoCredits({ needed: price }); return; }
    const next = await run("animate", () => api.animateAll(story.id), "We couldn't start animating. Nothing was charged. Try again.");
    if (next) { account.spend(price ?? 0); live.replace(next); }
  };

  // The final video's options: captions, "Part N" at the start, the end card.
  const finalOptions = (patch = {}) => ({
    captions: story.final?.captions ?? true,
    partLabel: story.final?.partLabel ?? Boolean(story.seriesId),
    endCard: story.final?.endCard ?? Boolean(story.seriesId),
    ...patch,
  });

  const makeFinal = async () => {
    if (!story) return;
    const next = await run("final", () => api.buildFinal(story.id, finalOptions()), "We couldn't start the final video. Try again.");
    if (next) live.replace(next);
  };

  // Any option change re-renders the final (free).
  const setFinalOption = async (patch) => {
    if (!story) return;
    setCaptionsBusy(true);
    const next = await run("captions", () => api.buildFinal(story.id, finalOptions(patch)), "We couldn't update the video. Try again.");
    if (next) live.replace(next); else setCaptionsBusy(false);
  };
  const setCaptions = (captions) => setFinalOption({ captions });

  const downloadCover = async () => {
    if (!story?.final?.coverUrl) return;
    const { saveMediaToDevice } = await import("../../../../lib/downloadMedia");
    const name = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blocky-story";
    await saveMediaToDevice({ url: story.final.coverUrl, filename: `${name}-cover.jpg`, title: story.title }).catch(() => setActionError("We couldn't download the cover. Try again."));
  };

  const sceneById = (id) => story?.scenes.find((s) => s.id === id) ?? null;
  const dialogScene = sceneDialog ? sceneById(sceneDialog.sceneId) : null;
  const dialogPrice = dialogScene
    ? sceneDialog.kind === "clip" ? clipPrice(story.quality, dialogScene.durationSec, quotes.prices) : picturePrice(quotes.prices)
    : null;

  // A picture our automatic check flagged: redraw it free, once.
  const regenerateFree = async (scene) => {
    const next = await run(`free-${scene.id}`, () => api.regenerateSceneFree(scene.id), "We couldn't redraw this picture. Nothing was charged. Try again.");
    if (next) live.replace(next);
  };

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
    const name = story.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "blocky-story";
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
    setTab("result");   // phones: jump to the storyboard while the episode is written
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
    if (created) { live.replace(created); setTab("result"); } else setTab("build");   // failed: the error is on the Build tab
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

  // Script tab: "Who is 'Vex'?" → pick one library character for that name.
  const assignName = (nameKey, characterId) => {
    updateSingle({ scriptAssignments: { ...single.scriptAssignments, [nameKey]: characterId } });
    setAssigning(null);
  };

  const storyBlocker = useMemo(() => storyStepBlocker(single, scriptParse), [single, scriptParse]);

  return {
    mode, changeMode, tab, setTab, recentTab, setRecentTab,
    single, updateSingle, singleEstimate, scriptScenes, scriptParse, storyBlocker, startSingle, newStory, openSingle,
    assigning, startAssigning: setAssigning, cancelAssigning: () => setAssigning(null), assignName,
    ideas: { ...ideas, seed: ideaSeed, asked: ideasAsked },
    askIdeas: () => { if (guard("ideas")) setIdeasAsked(true); },
    continueToSettings: () => { if (guard()) updateSingle({ step: "settings" }); },
    gate, setGate,
    newIdeas: () => { setIdeaSeed((n) => n + 1); updateSingle({ ideaId: null }); },
    // An idea brings its own characters.
    pickIdea: (idea) => updateSingle({ ideaId: idea.id, castIds: idea.castIds }),
    draft: single.draft, picking, pickVersion, newVersions: startVersions, leaveVersions,
    series, seriesData, seriesStatus: activeSeries.status, retrySeries: activeSeries.retry, seriesList,
    updateDraft, newSeries, wizardNext, wizardBack, wizardBlocker: wizardBlocker(series.wizardStep, series.draft), createPlan,
    openSeries, startEpisode, startEpisodeStory, backToSeries, allSeries, episodeEstimate,
    updateEpisode: (patch) => setSeries((s) => ({ ...s, episode: { ...s.episode, ...patch } })),
    story, storyStatus: live.status, reloadStory: live.reload, quotes, recent,
    // No video of their own yet: the settings step suggests a short first one.
    firstVideo: recentTab === "single" && recent.status === "ready" && recent.items.length === 0,
    acting, actionError, clearError, captionsBusy,
    pipeline: { onMakePictures: makePictures, onAnimate: animate, onMakeFinal: makeFinal, onDownload: download, onNewStory: newStory, onBackToSeries: backToSeries, onAddCredits: () => setNoCredits({ needed: animateAllPrice(story, quotes.prices) ?? 0 }) },
    setCaptions, setFinalOption, downloadCover,
    library, openLibrary: setLibrary, closeLibrary: () => setLibrary(null), libraryIds, libraryMax, toggleLibrary,
    regenerateFree, sceneDialog, dialogScene, dialogPrice, openSceneDialog: (kind, scene) => setSceneDialog({ kind, sceneId: scene.id }), closeSceneDialog: () => setSceneDialog(null), submitSceneDialog,
    upgradeTier, setUpgradeTier, noCredits, setNoCredits,
    sceneCountForLength,
  };
}
