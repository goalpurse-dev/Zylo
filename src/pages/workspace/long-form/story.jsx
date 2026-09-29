import { useEffect, useRef, useState } from "react";
import { autopilotRedirectRoute } from "./autopilot";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronDown, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";
import { loadIdeaDraft, saveIdeaDraft, CUSTOM_DEPTH_OPTIONS } from "./state";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";
import {
  fetchCurrentStoryPlan,
  fetchLongFormProject,
  generateStoryPlan,
  saveStoryChapters,
  selectStoryTitle,
} from "./project";

// This backend runs as two sequential AI passes inside ONE request/response
// cycle (Topic Understanding, then Narrative Strategy + Story Plan), so
// there is no real phase signal from the server — GenerationExperience's
// rotateStages mode reflects that honestly (rotating "current" highlight,
// never a fake checkmark) rather than pretending to track real sub-steps.
const STAGE_ORDER = ["understanding_topic", "narrative_strategy", "structuring"];
const STAGE_LABELS = { understanding_topic: "Understanding the topic", narrative_strategy: "Choosing the strongest narrative", structuring: "Structuring the video" };
const STAGE_MICRO_COPY = {
  understanding_topic: "Finding the strongest angle for your video.",
  narrative_strategy: "Shaping the idea into a story worth watching.",
  structuring: "Turning the story into a clear chapter flow.",
};

const NARRATIVE_LABEL_FALLBACK = "Explainer";

function depthLabel(depth) {
  return CUSTOM_DEPTH_OPTIONS.find((o) => o.value === depth)?.label ?? "Balanced";
}

function newChapterId() {
  return `ch-${Math.random().toString(36).slice(2, 10)}`;
}

function StoryLoadingState({ failed, onRetry, startedAt }) {
  return (
    <GenerationExperience
      variant="story"
      heading="Building your story…"
      stageMicroCopy={STAGE_MICRO_COPY}
      stageOrder={STAGE_ORDER}
      stageLabels={STAGE_LABELS}
      rotateStages
      startedAt={startedAt}
      failed={failed}
      failedHeading="We couldn't create the Story Plan."
      failedSubcopy="Your project is still here — you can try generating it again."
      onRetry={onRetry}
    />
  );
}

function ChapterCard({ chapter, index, editing, onStartEdit, onChange, onDelete, onDone }) {
  return (
    <div className="group rounded-2xl border border-white/[0.08] bg-[#151719] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0 text-[12px] font-bold tabular-nums text-white/25">{String(index + 1).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              value={chapter.title}
              onChange={(e) => onChange({ title: e.target.value })}
              className="w-full rounded-lg border border-white/10 bg-[#101213] px-2.5 py-1.5 text-[14.5px] font-bold text-white outline-none focus:border-lime-300/40"
              placeholder="Chapter title"
            />
          ) : (
            <h3 className="text-[14.5px] font-bold leading-snug text-white">{chapter.title}</h3>
          )}
          <p className="mt-0.5 text-[11.5px] font-medium text-white/30">~{chapter.estimatedMinutes} min</p>

          {editing ? (
            <textarea
              value={chapter.summary}
              onChange={(e) => onChange({ summary: e.target.value })}
              rows={3}
              className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-[#101213] px-2.5 py-2 text-[13px] leading-relaxed text-white/80 outline-none focus:border-lime-300/40"
            />
          ) : (
            <p className="mt-2 text-[13px] leading-relaxed text-white/55">{chapter.summary}</p>
          )}

          {chapter.purpose && !editing && <p className="mt-1.5 text-[11.5px] italic leading-relaxed text-white/30">{chapter.purpose}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
          {editing ? (
            <button type="button" onClick={onDone} className="rounded-lg border border-lime-300/30 bg-lime-300/10 px-2.5 py-1 text-[11.5px] font-semibold text-lime-300">
              Done
            </button>
          ) : (
            <button type="button" onClick={onStartEdit} aria-label="Edit chapter" className="grid h-7 w-7 place-items-center rounded-lg text-white/35 hover:bg-white/[0.06] hover:text-white">
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button type="button" onClick={onDelete} aria-label="Delete chapter" className="grid h-7 w-7 place-items-center rounded-lg text-white/35 hover:bg-red-400/10 hover:text-red-300">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LongFormStory() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  // Phase 6a: a Stickman autopilot project never shows this legacy step.
  useEffect(() => { const r = autopilotRedirectRoute(project); if (r) navigate(`/long-form/project/${project.id}/${r}`, { replace: true }); }, [project]); // eslint-disable-line react-hooks/exhaustive-deps
  const [storyPlan, setStoryPlan] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | generating | ready | failed | notfound
  const [regenerating, setRegenerating] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [storyStartedAt, setStoryStartedAt] = useState(null);
  const generationInFlightRef = useRef(false);
  const chaptersSaveTimerRef = useRef(null);

  useEffect(() => {
    document.title = "Your Story Plan | Zyvo";
  }, []);

  const runGeneration = async (regenerate) => {
    if (generationInFlightRef.current) return;
    generationInFlightRef.current = true;
    // Only ever picks Date.now() the FIRST time (prev is null) — a
    // GENERATION_IN_PROGRESS retry-poll (see below) calls this same
    // function again every 2.5s and must never reset the elapsed clock a
    // second time. A deliberate new attempt (regenerate/Try Again) clears
    // storyStartedAt to null just before calling this, so the guard picks a
    // genuinely fresh timestamp for those cases specifically.
    setStoryStartedAt((prev) => prev ?? Date.now());
    setPhase("generating");
    const result = await generateStoryPlan(projectId, { regenerate });
    generationInFlightRef.current = false;
    setRegenerating(false);

    if (!result.ok) {
      // A 409 (someone else already generating, e.g. a second mount from a
      // fast back/forward) isn't a real failure — fall back to polling the
      // row instead of showing an error.
      if (result.code === "GENERATION_IN_PROGRESS") {
        setTimeout(() => bootstrap(), 2500);
        return;
      }
      setPhase("failed");
      return;
    }

    setProject(result.project);
    setStoryPlan(result.storyPlan);
    setChapters(result.storyPlan.chapters);
    setPhase("ready");
  };

  const bootstrap = async () => {
    const row = await fetchLongFormProject(projectId);
    if (!row) {
      setPhase("notfound");
      return;
    }
    setProject(row);
    // Seeds the elapsed clock from the real server-persisted claim
    // timestamp when one exists (e.g. a refresh mid-generation, or another
    // tab already generating) — the functional guard in runGeneration
    // above then keeps THIS real value instead of overwriting it with a
    // later Date.now().
    if (row.generation_started_at) setStoryStartedAt(row.generation_started_at);

    if (row.current_story_plan_version_id) {
      const version = await fetchCurrentStoryPlan(row);
      if (version) {
        setStoryPlan(version.story_plan);
        setChapters(version.story_plan.chapters);
        setPhase("ready");
        return;
      }
    }

    if (row.status === "planning_failed") {
      setPhase("failed");
      return;
    }

    runGeneration(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleRegenerate = () => {
    if (regenerating) return;
    setRegenerating(true);
    setStoryStartedAt(null);
    runGeneration(true);
  };

  const handleBackToIdea = () => {
    if (project?.discovery_session_id) {
      const draft = loadIdeaDraft();
      if (draft.discoverySessionId !== project.discovery_session_id) {
        saveIdeaDraft({ ...draft, discoverySessionId: project.discovery_session_id });
      }
    }
    navigate("/long-form/new");
  };

  const handleSelectTitle = (title) => {
    setProject((p) => ({ ...p, selected_title: title }));
    selectStoryTitle(projectId, title);
  };

  const commitChapters = (nextChapters) => {
    setChapters(nextChapters);
    if (chaptersSaveTimerRef.current) clearTimeout(chaptersSaveTimerRef.current);
    chaptersSaveTimerRef.current = setTimeout(() => saveStoryChapters(projectId, nextChapters), 900);
  };

  const handleChapterChange = (chapterId, patch) => {
    commitChapters(chapters.map((c) => (c.id === chapterId ? { ...c, ...patch } : c)));
  };

  const handleDeleteChapter = (chapterId) => {
    if (chapters.length <= 1) return;
    commitChapters(chapters.filter((c) => c.id !== chapterId));
  };

  const handleAddChapter = () => {
    commitChapters([
      ...chapters,
      { id: newChapterId(), title: "New chapter", estimatedMinutes: 1, purpose: "", summary: "", keyQuestions: [] },
    ]);
  };

  if (phase === "notfound") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <p className="text-[15px] font-semibold text-white">Project not found.</p>
        <button type="button" onClick={() => navigate("/long-form")} className="mt-4 text-[13px] font-semibold text-lime-300">
          Back to Long Form
        </button>
      </div>
    );
  }

  if (phase === "loading") return null;

  if (phase === "generating" || phase === "failed") {
    // Viewport-locked — see research.jsx's identical wrapper for why a
    // direct h-full/overflow-hidden child of #workspace-scroll is enough to
    // fit this screen without ever causing a page scroll.
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="story" project={project} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <StoryLoadingState failed={phase === "failed"} onRetry={() => { setStoryStartedAt(null); runGeneration(false); }} startedAt={storyStartedAt} />
        </div>
      </div>
    );
  }

  const totalMinutes = chapters.reduce((sum, c) => sum + (Number(c.estimatedMinutes) || 0), 0);
  const displayTitle = project?.selected_title || storyPlan.recommendedTitle;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="story" project={project} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Your Story Plan</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Zyvo mapped out the strongest way to turn your topic into a complete video.</p>
      </motion.div>

      {/* Story Overview */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }} className="rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Working Title</p>
        <h2 className="mt-1.5 text-[19px] font-bold leading-snug text-white">{displayTitle}</h2>

        {!showAlternatives ? (
          <button type="button" onClick={() => setShowAlternatives(true)} className="mt-2 text-[12.5px] font-semibold text-lime-300 hover:text-lime-200">
            View alternatives
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            {[storyPlan.recommendedTitle, ...storyPlan.alternativeTitles].map((title) => (
              <button
                key={title}
                type="button"
                onClick={() => handleSelectTitle(title)}
                className={`block w-full rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition ${
                  title === displayTitle ? "border-lime-300/40 bg-lime-300/[0.06] text-white" : "border-white/[0.08] bg-white/[0.02] text-white/60 hover:border-white/20"
                }`}
              >
                {title}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Viewer Promise</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/70">{storyPlan.viewerPromise}</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/45">
            {project.resolved_length_minutes ?? Math.round(totalMinutes)} min
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/45">
            {depthLabel(project.resolved_explanation_depth)}
          </span>
          {project.target_words && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-white/45">
              ~{project.target_words.toLocaleString()} words
            </span>
          )}
          <span className="rounded-full border border-lime-300/20 bg-lime-300/[0.06] px-2.5 py-1 text-[11px] font-semibold text-lime-300">
            {storyPlan.narrativeLabel || NARRATIVE_LABEL_FALLBACK}
          </span>
        </div>
      </motion.div>

      {/* Hook */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.14, ease: "easeOut" }} className="mt-4 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Opening Hook</p>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/70">{storyPlan.hookConcept}</p>
      </motion.div>

      {/* Chapters */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-white">Story Structure</h2>
          <span className="text-[11.5px] font-medium text-white/30">{chapters.length} chapters · ~{Math.round(totalMinutes)} min</span>
        </div>
        <div className="space-y-3">
          {chapters.map((chapter, i) => (
            <motion.div key={chapter.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.18 + i * 0.05, ease: "easeOut" }}>
              <ChapterCard
                chapter={chapter}
                index={i}
                editing={editingChapterId === chapter.id}
                onStartEdit={() => setEditingChapterId(chapter.id)}
                onDone={() => setEditingChapterId(null)}
                onChange={(patch) => handleChapterChange(chapter.id, patch)}
                onDelete={() => handleDeleteChapter(chapter.id)}
              />
            </motion.div>
          ))}
        </div>
        <button
          type="button"
          onClick={handleAddChapter}
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-white/[0.12] px-4 py-2.5 text-[12.5px] font-semibold text-white/45 transition hover:border-white/25 hover:text-white/75"
        >
          <Plus className="h-3.5 w-3.5" />
          Add chapter
        </button>
      </div>

      {/* Research preview */}
      {(storyPlan.researchQuestions?.length > 0 || storyPlan.researchRiskFlags?.length > 0) && (
        <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <button type="button" onClick={() => setShowResearch((v) => !v)} className="flex w-full items-center justify-between px-5 py-4">
            <span className="text-[13px] font-semibold text-white/70">What Zyvo needs to research</span>
            <ChevronDown className={`h-4 w-4 text-white/40 transition ${showResearch ? "rotate-180" : ""}`} />
          </button>
          {showResearch && (
            <div className="space-y-3 border-t border-white/[0.06] px-5 py-4">
              {storyPlan.researchQuestions?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Open Questions</p>
                  <ul className="mt-1.5 space-y-1">
                    {storyPlan.researchQuestions.map((q, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed text-white/55">· {q}</li>
                    ))}
                  </ul>
                </div>
              )}
              {storyPlan.researchRiskFlags?.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/25">Risk Flags</p>
                  <ul className="mt-1.5 space-y-1">
                    {storyPlan.researchRiskFlags.map((q, i) => (
                      <li key={i} className="text-[12.5px] leading-relaxed text-white/55">· {q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tertiary action — occasional, not part of the primary Back/Continue
          pair, so it stays in normal flow rather than in the pinned footer. */}
      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-5">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/45 hover:text-white disabled:opacity-40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate Plan"}
        </button>
      </div>

      <LongFormActionFooter
        secondaryLabel="Back to Idea"
        onSecondary={handleBackToIdea}
        primaryLabel="Continue to Research"
        onPrimary={() => navigate(`/long-form/project/${projectId}/research`)}
      />
    </div>
  );
}
