import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Lightbulb, RotateCw } from "lucide-react";
import { loadIdeaDraft, saveIdeaDraft } from "./state";
import { GENERATE_STATUS, IDEA_CATEGORY_OPTIONS, IDEA_DIRECTION_OPTIONS, MAX_VISIBLE_IDEAS, PREVIEW_STATUS, createIdea } from "./discoverIdeas";
import { fetchLongFormIdeas, IDEA_ENGINE_ERROR } from "./ideaEngine";
import { submitConceptPreviewJob } from "./previewJobs";
import { applySessionRowToDraft, createDiscoverySession, fetchDiscoverySession, persistDiscoverySession } from "./discoverySession";
import { createLongFormProject } from "./project";
import { watchJob } from "../../../lib/jobs";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import { LengthDepthControls } from "./LengthDepthControls";
import { TextDensityControl } from "./TextDensityControl";
import { DiscoveryLeftPanel, DiscoveryResultsPanel } from "./DiscoveryPanels";
import LongFormSelect from "./LongFormSelect";
import GuestGenerateModal from "../../../components/ImageGenerator/GuestGenerateModal";

const TOPIC_EXAMPLES = [
  "How does GPS know where you are?",
  "What happens after 72 hours without sleep?",
  "Why did Blockbuster collapse?",
];

// Drops the oldest ideas first once the visible batch exceeds the cap,
// never dropping whichever idea is currently selected.
function capIdeas(ideas, selectedId, max) {
  if (ideas.length <= max) return ideas;
  const overflow = ideas.length - max;
  let dropped = 0;
  return ideas.filter((idea) => {
    if (dropped < overflow && idea.id !== selectedId) {
      dropped += 1;
      return false;
    }
    return true;
  });
}

// Adapts a real `jobs` row (the same shape every Zyvo image tool already
// reads) into a conceptPreview patch.
function applyJobRowToPreview(row) {
  if (row.status === "succeeded") return { status: PREVIEW_STATUS.READY, imageUrl: row.result_url, highDemand: false };
  if (row.status === "failed" || row.status === "canceled") return { status: PREVIEW_STATUS.FAILED, imageUrl: null, highDemand: false };
  // The image model is overloaded: the server waits and tries again by itself (never an error).
  return { status: PREVIEW_STATUS.GENERATING, imageUrl: null, highDemand: row.status === "queued" && row.settings?.waiting === "high_demand" };
}

export default function LongFormNew() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(() => loadIdeaDraft());
  const [exampleIndex, setExampleIndex] = useState(0);
  const [generateMoreFailed, setGenerateMoreFailed] = useState(false);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectFailed, setCreateProjectFailed] = useState(false);
  const [sessionError, setSessionError] = useState(null); // null | { code }
  const watcherCleanupsRef = useRef([]);
  const sessionRequestedRef = useRef(false);
  const draftRef = useRef(draft);
  const persistIdeasTimerRef = useRef(null);

  useEffect(() => {
    document.title = "New Long Form Video | Zyvo";
  }, []);

  useEffect(() => {
    saveIdeaDraft(draft);
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (draft.topic.trim()) return;
    const id = setInterval(() => {
      setExampleIndex((i) => (i + 1) % TOPIC_EXAMPLES.length);
    }, 3200);
    return () => clearInterval(id);
  }, [draft.topic]);

  const updateIdeaPreview = (ideaId, patch) => {
    setDraft((d) => ({
      ...d,
      discovery: {
        ...d.discovery,
        ideas: d.discovery.ideas.map((idea) => (idea.id === ideaId ? { ...idea, conceptPreview: { ...idea.conceptPreview, ...patch } } : idea)),
      },
    }));
    schedulePersistIdeas();
  };

  // Coalesces rapid-fire preview-status updates (several jobs can settle
  // within the same second) into one write, reading whatever the LATEST
  // committed draft is at fire time — draftRef is kept in sync above on
  // every render, so this is always current by the time the timer lands.
  const schedulePersistIdeas = () => {
    if (persistIdeasTimerRef.current) clearTimeout(persistIdeasTimerRef.current);
    persistIdeasTimerRef.current = setTimeout(() => {
      const current = draftRef.current;
      if (current.discoverySessionId) persistDiscoverySession(current.discoverySessionId, { ideas: current.discovery.ideas });
    }, 800);
  };

  const resumeWatchersFor = (ideas) => {
    for (const idea of ideas) {
      const notFinal = idea.conceptPreview.status === PREVIEW_STATUS.PENDING || idea.conceptPreview.status === PREVIEW_STATUS.GENERATING;
      if (!notFinal) continue;
      if (idea.conceptPreview.jobId) {
        const cleanup = watchJob(idea.conceptPreview.jobId, (row) => updateIdeaPreview(idea.id, applyJobRowToPreview(row)));
        watcherCleanupsRef.current.push(cleanup);
      } else {
        updateIdeaPreview(idea.id, { status: PREVIEW_STATUS.FAILED });
      }
    }
  };

  // Single mount-time bootstrap: an existing discoverySessionId means the
  // backend (not sessionStorage) is the source of truth — fetch it FIRST
  // and hydrate the exact saved board before resuming any preview watchers,
  // so refresh/back never regenerates anything. Only a session-less mount
  // (a genuinely new creation) creates a fresh session.
  const startNewSession = async () => {
    if (sessionRequestedRef.current) return;
    sessionRequestedRef.current = true;
    setSessionError(null);
    const result = await createDiscoverySession();
    if (!result.ok) {
      // Leave sessionRequestedRef false so the explicit "Try Again" button
      // below can genuinely retry — this is the first successful session
      // attempt, not a second one, since none exists yet.
      sessionRequestedRef.current = false;
      setSessionError({ code: result.code });
      return;
    }
    setDraft((d) => (d.discoverySessionId ? d : { ...d, discoverySessionId: result.id }));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const initialSessionId = draft.discoverySessionId;
      if (initialSessionId) {
        const row = await fetchDiscoverySession(initialSessionId);
        if (cancelled) return;
        if (row && Array.isArray(row.ideas) && row.ideas.length > 0) {
          const hydrated = applySessionRowToDraft(draft, row);
          setDraft(hydrated);
          resumeWatchersFor(hydrated.discovery.ideas);
        } else {
          // No saved board yet (fresh session) or the row vanished — fall
          // back to whatever sessionStorage had, which may itself be empty.
          resumeWatchersFor(draft.discovery.ideas);
        }
        return;
      }

      await startNewSession();
    })();

    return () => {
      cancelled = true;
      watcherCleanupsRef.current.forEach((fn) => fn());
    };
    // Intentionally mount-only — this reads the hydrated-from-storage
    // `draft` value from the initial render closure, exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ticks the cooldown countdown display. The target time itself always
  // comes from the server (draft.discovery.nextGenerationAllowedAt) — this
  // interval only re-renders so the "Xh Ym" text counts down and the button
  // flips back automatically once the deadline passes.
  useEffect(() => {
    if (!draft.discovery.nextGenerationAllowedAt) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [draft.discovery.nextGenerationAllowedAt]);

  const mode = draft.source === "discovery" ? "discovery" : "custom";
  const sessionReady = Boolean(draft.discoverySessionId);
  const canContinue = draft.topic.trim().length > 0 && sessionReady;
  const hasResults = draft.discovery.ideas.length > 0;
  const showSplitView = mode === "discovery" && hasResults;
  const isGeneratingIdeas = draft.discovery.generationStatus === GENERATE_STATUS.GENERATING_IDEAS;
  const cooldownRemainingMs = draft.discovery.nextGenerationAllowedAt
    ? Math.max(0, new Date(draft.discovery.nextGenerationAllowedAt).getTime() - nowTick)
    : 0;

  const setMode = (nextMode) => {
    setDraft((d) => ({ ...d, source: nextMode }));
  };

  // The commitment point: nothing in long_form_projects exists until this
  // click. Idempotent server-side on draft.discoverySessionId, so a
  // double-click or a retry after a failed attempt never creates a second
  // project — see create-long-form-project. Navigates the moment the
  // project id exists rather than waiting for Story Plan generation, which
  // happens on the destination page itself.
  const handleContinue = async () => {
    if (!canContinue || creatingProject) return;
    setCreatingProject(true);
    setCreateProjectFailed(false);

    const project = await createLongFormProject({
      discoverySessionId: draft.discoverySessionId,
      topic: draft.topic,
      source: draft.source,
      selectedIdea: draft.selectedIdea,
      lengthMode: draft.lengthMode,
      customLengthMinutes: draft.customLengthMinutes,
      depthMode: draft.depthMode,
      customExplanationDepth: draft.customExplanationDepth,
      onScreenTextDensity: draft.onScreenTextDensity,
    });

    if (!project) {
      setCreatingProject(false);
      setCreateProjectFailed(true);
      return;
    }

    navigate(`/long-form/project/${project.id}/story`);
  };

  // Length/Depth customization — same handler for both "Start with a topic"
  // and a selected discovered idea (state.js keeps one settings semantic
  // for both). Persisted immediately: infrequent, deliberate changes, not
  // worth debouncing.
  const handleSettingsChange = (patch) => {
    setDraft((d) => ({ ...d, ...patch }));
    const serverPatch = {};
    if ("lengthMode" in patch) serverPatch.length_mode = patch.lengthMode;
    if ("customLengthMinutes" in patch) serverPatch.custom_length_minutes = patch.customLengthMinutes;
    if ("depthMode" in patch) serverPatch.depth_mode = patch.depthMode;
    if ("customExplanationDepth" in patch) serverPatch.custom_explanation_depth = patch.customExplanationDepth;
    if (Object.keys(serverPatch).length) persistDiscoverySession(draft.discoverySessionId, serverPatch);
  };

  // Submits real, FREE-to-user concept-preview jobs for a freshly generated
  // batch and starts watching each one independently. Never blocks on
  // images — ideas are already visible before this resolves.
  const startPreviewJobsFor = async (newIdeas, discoverySessionId) => {
    for (const idea of newIdeas) {
      const jobId = await submitConceptPreviewJob({ visualDirection: idea.visualDirection, discoverySessionId });
      if (jobId) {
        updateIdeaPreview(idea.id, { status: PREVIEW_STATUS.GENERATING, jobId });
        const cleanup = watchJob(jobId, (row) => updateIdeaPreview(idea.id, applyJobRowToPreview(row)));
        watcherCleanupsRef.current.push(cleanup);
      } else {
        updateIdeaPreview(idea.id, { status: PREVIEW_STATUS.FAILED });
      }
    }
  };

  const handleGenerateIdeas = async () => {
    if (!sessionReady) return;
    setDraft((d) => ({ ...d, discovery: { ...d.discovery, generationStatus: GENERATE_STATUS.GENERATING_IDEAS } }));

    const result = await fetchLongFormIdeas({
      category: draft.ideaCategory,
      direction: draft.ideaDirection,
      count: 10,
      existingIdeas: [],
      discoverySessionId: draft.discoverySessionId,
    });

    if (!result.ok) {
      if (result.errorType === IDEA_ENGINE_ERROR.AUTH_REQUIRED) setGuestModalOpen(true);
      setDraft((d) => ({
        ...d,
        discovery: { ...d.discovery, generationStatus: result.errorType === IDEA_ENGINE_ERROR.AUTH_REQUIRED ? GENERATE_STATUS.IDLE : GENERATE_STATUS.ERROR },
      }));
      return;
    }

    const newIdeas = result.ideas.map((idea) => createIdea(idea));
    const newBatch = { batchId: `discovery-${Date.now()}`, createdAt: new Date().toISOString(), ideas: newIdeas };
    const ideaBatches = [...draft.discovery.ideaBatches, newBatch];
    setDraft((d) => ({
      ...d,
      discovery: {
        batchId: newBatch.batchId,
        generationStatus: GENERATE_STATUS.IDEAS_READY,
        ideas: newIdeas,
        ideaBatches,
        selectedIdeaId: null,
        createdAt: Date.now(),
        ideaBatchesGenerated: result.discovery?.ideaBatchesGenerated ?? d.discovery.ideaBatchesGenerated,
        nextGenerationAllowedAt: result.discovery?.nextGenerationAllowedAt ?? null,
      },
    }));
    // Persisted immediately (not debounced) — text ideas must survive even
    // if the browser closes before a single preview image starts.
    // idea_category/idea_direction are already saved server-side by
    // generate-long-form-ideas itself in the same request. idea_batches is
    // the uncapped append-only history (see discoverIdeas.js) — `ideas`
    // alone can silently drop an early batch once MAX_VISIBLE_IDEAS is
    // exceeded by later "Generate 10 More" clicks, idea_batches never does.
    persistDiscoverySession(draft.discoverySessionId, { ideas: newIdeas, idea_batches: ideaBatches });
    startPreviewJobsFor(newIdeas, draft.discoverySessionId);
  };

  const handleGenerateMore = async () => {
    if (!sessionReady) return;
    setGenerateMoreFailed(false);
    setDraft((d) => ({ ...d, discovery: { ...d.discovery, generationStatus: GENERATE_STATUS.GENERATING_IDEAS } }));

    const result = await fetchLongFormIdeas({
      category: draft.ideaCategory,
      direction: draft.ideaDirection,
      count: 10,
      existingIdeas: draft.discovery.ideas,
      discoverySessionId: draft.discoverySessionId,
    });

    if (!result.ok) {
      if (result.errorType === IDEA_ENGINE_ERROR.AUTH_REQUIRED) setGuestModalOpen(true);
      // Never reset discovery.ideas on failure — previous results stay visible.
      setGenerateMoreFailed(true);
      setDraft((d) => ({
        ...d,
        discovery: {
          ...d.discovery,
          generationStatus: GENERATE_STATUS.IDEAS_READY,
          // A cooldown response still carries the authoritative nextAllowedAt.
          nextGenerationAllowedAt: result.errorType === IDEA_ENGINE_ERROR.COOLDOWN ? result.nextAllowedAt : d.discovery.nextGenerationAllowedAt,
        },
      }));
      return;
    }

    const newIdeas = result.ideas.map((idea) => createIdea(idea));
    const mergedIdeas = capIdeas([...draft.discovery.ideas, ...newIdeas], draft.discovery.selectedIdeaId, MAX_VISIBLE_IDEAS);
    // capIdeas can silently drop the oldest visible ideas once the running
    // total passes MAX_VISIBLE_IDEAS — ideaBatches is the uncapped record
    // that survives that trim, so an earlier "Generate 10 More" batch is
    // always reconstructable even after it scrolls out of the working list.
    const newBatch = { batchId: `discovery-${Date.now()}`, createdAt: new Date().toISOString(), ideas: newIdeas };
    const ideaBatches = [...draft.discovery.ideaBatches, newBatch];
    setDraft((d) => ({
      ...d,
      discovery: {
        ...d.discovery,
        generationStatus: GENERATE_STATUS.IDEAS_READY,
        ideas: mergedIdeas,
        ideaBatches,
        ideaBatchesGenerated: result.discovery?.ideaBatchesGenerated ?? d.discovery.ideaBatchesGenerated,
        nextGenerationAllowedAt: result.discovery?.nextGenerationAllowedAt ?? null,
      },
    }));
    persistDiscoverySession(draft.discoverySessionId, { ideas: mergedIdeas, idea_batches: ideaBatches });
    startPreviewJobsFor(newIdeas, draft.discoverySessionId);
  };

  const handleDismissIdea = (id) => {
    setDraft((d) => ({ ...d, discovery: { ...d.discovery, ideas: d.discovery.ideas.filter((idea) => idea.id !== id) } }));
    schedulePersistIdeas();
  };

  const handleUseIdea = (idea) => {
    setDraft((d) => ({
      ...d,
      source: "discovery",
      selectedIdea: idea,
      topic: idea.topic,
      discovery: { ...d.discovery, selectedIdeaId: idea.id },
    }));
    persistDiscoverySession(draft.discoverySessionId, { selected_idea_id: idea.id, source: "discovery", topic: idea.topic });
  };

  const previewCounts = draft.discovery.ideas.reduce(
    (acc, idea) => {
      const status = idea.conceptPreview.status;
      if (status === PREVIEW_STATUS.READY) acc.ready += 1;
      else if (status === PREVIEW_STATUS.FAILED) acc.failed += 1;
      else { acc.pending += 1; if (idea.conceptPreview.highDemand) acc.highDemand += 1; }
      return acc;
    },
    { ready: 0, failed: 0, pending: 0, highDemand: 0 }
  );

  return (
    <div
      className={
        showSplitView
          ? "mx-auto max-w-[1400px] px-4 py-6 lg:px-6"
          : `mx-auto max-w-[760px] px-4 py-8 lg:px-8 lg:py-10 ${mode === "custom" ? "pb-28" : ""}`
      }
    >
      <GuestGenerateModal open={guestModalOpen} onClose={() => setGuestModalOpen(false)} onSignup={() => navigate("/signup")} />

      <LongFormCreationHeader current="idea" />

      {!showSplitView && (
        <>
          <div className="mb-7">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">What should your video be about?</h1>
            <p className="mt-1.5 text-[14px] text-white/45">Start with your own topic or let Zyvo discover ideas for you.</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5">
            <button
              type="button"
              onClick={() => setMode("custom")}
              aria-pressed={mode === "custom"}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${
                mode === "custom" ? "bg-lime-300 text-[#11150D]" : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
              }`}
            >
              <Lightbulb className="h-4 w-4" />
              Start with a topic
            </button>
            <button
              type="button"
              onClick={() => setMode("discovery")}
              aria-pressed={mode === "discovery"}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition ${
                mode === "discovery" ? "bg-lime-300 text-[#11150D]" : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
              }`}
            >
              <Compass className="h-4 w-4" />
              Discover ideas
            </button>
          </div>
        </>
      )}

      {mode === "custom" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.09] bg-[#151719] px-4 py-4">
            <span className="mb-3 block text-[13px] font-semibold text-white">Video topic</span>

            <div className="rounded-xl border border-white/[0.08] bg-[#101213] px-4 py-3 transition focus-within:border-[#BEF264]/50 focus-within:bg-[#111317]">
              <textarea
                value={draft.topic}
                onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                rows={4}
                placeholder={TOPIC_EXAMPLES[exampleIndex]}
                className="max-h-[220px] w-full resize-none overflow-y-auto bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
              />
            </div>

            <p className="mt-2.5 text-[12px] text-white/30">You don't need a perfect title. Describe the idea in your own words.</p>
          </div>

          <div className="max-w-[520px]">
            <LengthDepthControls draft={draft} onChange={handleSettingsChange} layout="row" />
          </div>

          <div className="max-w-[360px]">
            <TextDensityControl value={draft.onScreenTextDensity} onChange={(onScreenTextDensity) => handleSettingsChange({ onScreenTextDensity })} />
          </div>

          {(createProjectFailed || sessionError) && (
            <div className="border-t border-white/[0.06] pt-4">
              {createProjectFailed && <p className="text-[12.5px] font-medium text-red-300/80">Couldn't start your project. Try again.</p>}
              {sessionError && (
                <p className="flex items-center gap-2 text-[12.5px] font-medium text-red-300/80">
                  {sessionError.code === "TOO_MANY_SESSIONS" ? "You've started a lot of new videos recently — please wait a bit." : "Couldn't set up this session."}
                  <button type="button" onClick={startNewSession} className="font-semibold text-white/70 underline underline-offset-2 hover:text-white">
                    Try again
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {mode === "custom" && (
        <LongFormActionFooter
          primaryLabel="Create Story Plan"
          primaryLoadingLabel="Creating Story Plan…"
          onPrimary={handleContinue}
          primaryDisabled={!canContinue}
          primaryLoading={creatingProject}
        />
      )}

      {mode === "discovery" && !showSplitView && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-white/[0.09] bg-[#151719] px-4 py-5">
            <h2 className="text-[16px] font-bold text-white">Discover video ideas</h2>
            <p className="mt-1 text-[13px] text-white/45">Explore fresh long-form concepts across virtually any topic.</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <LongFormSelect
                label="Category"
                options={IDEA_CATEGORY_OPTIONS}
                value={draft.ideaCategory}
                onChange={(value) => setDraft((d) => ({ ...d, ideaCategory: value }))}
              />
              <LongFormSelect
                label="Direction"
                options={IDEA_DIRECTION_OPTIONS}
                value={draft.ideaDirection}
                onChange={(value) => setDraft((d) => ({ ...d, ideaDirection: value }))}
              />
            </div>

            <button
              type="button"
              onClick={handleGenerateIdeas}
              disabled={isGeneratingIdeas || !sessionReady}
              className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition sm:w-auto ${
                isGeneratingIdeas || !sessionReady
                  ? "cursor-wait border border-white/[0.08] bg-[#202224] text-white/45"
                  : "bg-lime-300 text-[#11150D] hover:bg-lime-200 active:scale-[0.99]"
              }`}
            >
              {isGeneratingIdeas ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Generating ideas…
                </>
              ) : !sessionReady && !sessionError ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  Setting up…
                </>
              ) : (
                "Generate Ideas"
              )}
            </button>
          </div>

          {sessionError ? (
            <div className="rounded-[15px] border border-red-400/20 bg-red-400/[0.04] px-6 py-10 text-center">
              <p className="text-[13.5px] font-medium text-white/70">
                {sessionError.code === "TOO_MANY_SESSIONS"
                  ? "You've started a lot of new videos recently — please wait a bit before starting another."
                  : "Couldn't start a new session."}
              </p>
              <p className="mt-1 text-[12.5px] text-white/40">Try again in a moment.</p>
              <button
                type="button"
                onClick={startNewSession}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : draft.discovery.generationStatus === GENERATE_STATUS.ERROR ? (
            <div className="rounded-[15px] border border-red-400/20 bg-red-400/[0.04] px-6 py-10 text-center">
              <p className="text-[13.5px] font-medium text-white/70">Couldn't generate ideas right now.</p>
              <p className="mt-1 text-[12.5px] text-white/40">Try again in a moment.</p>
              <button
                type="button"
                onClick={handleGenerateIdeas}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/[0.08]"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : (
            <div className="rounded-[15px] border border-dashed border-white/[0.09] px-6 py-12 text-center">
              <p className="text-[13.5px] font-medium text-white/50">Your generated ideas will appear here.</p>
            </div>
          )}
        </div>
      )}

      {showSplitView && (
        <div
          className="grid grid-cols-1 gap-5 pb-24 lg:grid-cols-[380px_minmax(0,1fr)] lg:pb-0 xl:grid-cols-[400px_minmax(0,1fr)]"
          style={{ animation: "lfDiscoveryIn 200ms ease-out" }}
        >
          {/*
            Deliberately NOT `self-start`. With a CSS Grid row, `self-start`
            shrinks this item's box down to its own content height, which
            leaves sticky almost nothing to stick WITHIN once the (much
            taller) results column stretches the row — that's exactly what
            produced the reported bug (CTA correct at one scroll depth, a
            growing gap above it at another): the aside's containing block
            ended long before the page did, so sticky gave up and let it
            scroll away like a normal element for the rest of the page.
            Default grid stretch + an explicit `h-[...]` (not max-h) +
            `overflow-hidden` here — exactly ToolGenerationLayout's proven
            pattern (src/pages/viral/shared/ToolGenerationLayout.jsx) — keeps
            the grid cell tall enough to stick through the whole scroll
            range while capping this element's own rendered size, so the
            inner flex column (DiscoveryLeftPanel) can scroll its own body
            and pin its own footer. --lf-header-h is the sticky Long Form
            header's real measured height (see shared.jsx) — not a guess.
          */}
          <aside
            className="min-w-0 lg:sticky lg:overflow-hidden"
            style={{
              top: "var(--lf-header-h, 56px)",
              height: "calc(100dvh - var(--zyvo-content-top, 0px) - var(--lf-header-h, 56px) - 32px)",
            }}
          >
            <DiscoveryLeftPanel
              draft={draft}
              onCategoryChange={(value) => setDraft((d) => ({ ...d, ideaCategory: value }))}
              onDirectionChange={(value) => setDraft((d) => ({ ...d, ideaDirection: value }))}
              onGenerateMore={handleGenerateMore}
              isGeneratingMore={isGeneratingIdeas}
              generateMoreFailed={generateMoreFailed}
              cooldownRemainingMs={cooldownRemainingMs}
              selectedIdea={draft.selectedIdea}
              onSettingsChange={handleSettingsChange}
              onCreateStoryPlan={handleContinue}
              canCreateStoryPlan={canContinue}
              creatingStoryPlan={creatingProject}
              createStoryPlanFailed={createProjectFailed}
            />
          </aside>

          <main
            className="min-w-0 lg:overflow-y-auto lg:overscroll-contain lg:pb-4"
            style={{ maxHeight: "calc(100dvh - var(--zyvo-content-top, 0px) - var(--lf-header-h, 56px) - 32px)" }}
          >
            <DiscoveryResultsPanel
              ideas={draft.discovery.ideas}
              selectedIdeaId={draft.discovery.selectedIdeaId}
              readyCount={previewCounts.ready}
              pendingCount={previewCounts.pending}
              failedCount={previewCounts.failed}
              highDemandCount={previewCounts.highDemand}
              onUse={handleUseIdea}
              onDismiss={handleDismissIdea}
            />
          </main>

          {/* Mobile-only — desktop uses the left panel's own persistent
              footer instead (see DiscoveryLeftPanel). Same shared component/
              visual language as every other Long Form action footer. */}
          <div className="lg:hidden">
            <LongFormActionFooter
              primaryLabel="Create Story Plan"
              primaryLoadingLabel="Creating Story Plan…"
              onPrimary={handleContinue}
              primaryDisabled={!canContinue}
              primaryLoading={creatingProject}
            />
          </div>

          <style>{`
            @keyframes lfDiscoveryIn {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
