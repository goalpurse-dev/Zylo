import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { fetchLongFormProject, fetchCurrentStoryPlan } from "./project";
import { fetchLatestResearchForStoryPlanVersion, fetchRepairResearchVersion } from "./research";
import { fetchLatestScriptForVersions, fetchLastCompletedScript, startScript } from "./script";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";

const POLL_INTERVAL_MS = 2000; // Script runs 2-3 model calls, not Research's multi-minute pipeline — poll faster so the (usually brief) loading state stays responsive.

// Never shown as a step unless the row itself proves it ran (row.stage is
// actually "revision", or meta.revisionKind was persisted once it
// completed) — a skipped revision must never render as a fake completed
// checkmark.
const STAGE_ORDER = ["draft", "critic", "revision", "finalizing"];
const STAGE_LABELS = {
  draft: "Building the first draft",
  critic: "Checking retention and pacing",
  revision: "Refining weak sections",
  finalizing: "Preparing narration",
};
const STAGE_MICRO_COPY = {
  draft: "Turning your research into a full narration.",
  critic: "Checking the hook, pacing, and factual grounding.",
  revision: "Refining the sections that needed work.",
  finalizing: "Preparing your narration for review.",
};

function visibleStages(row) {
  const revisionRan = row.stage === "revision" || Boolean(row.meta?.revisionKind);
  return ["draft", "critic", ...(revisionRan ? ["revision"] : []), "finalizing"];
}

// A targeted Research repair (see advance-long-form-research) folds
// repair_coverage and finalizing into one "Updating your research" step —
// the user doesn't need the same stage-by-stage granularity twice. Once the
// repair itself resolves, the page hands off entirely to the normal Script
// loading state (see pollRepair below) — its own "Writing your narration…"
// header already reads as "rewriting" in context, so there's no separate
// synthetic step to keep in sync here.
const REPAIR_STEPS = ["repair_planning", "repair_search", "repair_extraction", "repair_coverage"];
const REPAIR_STEP_LABELS = {
  repair_planning: "Planning missing evidence",
  repair_search: "Finding targeted sources",
  repair_extraction: "Checking new facts",
  repair_coverage: "Updating your research",
};
const REPAIR_STEP_MICRO_COPY = {
  repair_planning: "Deciding exactly what still needs to be verified.",
  repair_search: "Searching for evidence behind the specific gap.",
  repair_extraction: "Turning new sources into usable evidence.",
  repair_coverage: "Rechecking coverage with the new evidence.",
};
function repairStepKey(repairRow) {
  if (repairRow?.stage === "finalizing") return "repair_coverage";
  return repairRow?.stage ?? "repair_planning";
}

function formatMinutesWords(estimatedDurationSeconds, actualWords) {
  const minutes = Math.round((estimatedDurationSeconds ?? 0) / 60);
  return `${minutes} min • ~${(actualWords ?? 0).toLocaleString()} words`;
}

function formatChapterDuration(seconds) {
  const total = Math.round(seconds ?? 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// researchWarnings entries look like `Chapter "X" could not be fully
// written from the available evidence.` (see advance-long-form-script) —
// pull just the quoted chapter title back out for a clean list, falling
// back to the raw sentence for any warning that isn't chapter-shaped (e.g.
// the overall-coverage note).
function extractWeakChapterTitles(researchWarnings) {
  return (researchWarnings ?? [])
    .map((w) => {
      const match = w.match(/^Chapter "(.+)" could not be fully written/);
      return match ? match[1] : null;
    })
    .filter(Boolean);
}

function ScriptLoadingState({ row, failed, onRetry, startedAt }) {
  const steps = visibleStages(row);
  return (
    <GenerationExperience
      variant="script"
      heading="Writing your narration…"
      microCopy={STAGE_MICRO_COPY[row.stage] ?? STAGE_MICRO_COPY.draft}
      stageOrder={steps}
      stageLabels={STAGE_LABELS}
      currentStageKey={row.stage ?? "draft"}
      startedAt={startedAt}
      failed={failed}
      failedHeading="We couldn't write the script right now."
      failedSubcopy="Please try again shortly."
      onRetry={onRetry}
    />
  );
}

function RepairLoadingState({ repairRow }) {
  return (
    <GenerationExperience
      variant="research"
      heading="Strengthening your research…"
      microCopy={REPAIR_STEP_MICRO_COPY[repairStepKey(repairRow)]}
      stageOrder={REPAIR_STEPS}
      stageLabels={REPAIR_STEP_LABELS}
      currentStageKey={repairStepKey(repairRow)}
      startedAt={repairRow?.research_started_at}
    />
  );
}

function StaleScriptState({ onViewPrevious }) {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <RefreshCw className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">Your Story Plan or Research changed</h1>
      <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-relaxed text-white/45">
        This script was written for an earlier version of your story or research. Update it so the narration matches your latest evidence.
      </p>
      <div className="mt-6">
        <button type="button" onClick={onViewPrevious} className="text-[12.5px] font-semibold text-white/40 hover:text-white/70">
          View Previous Script
        </button>
      </div>
    </div>
  );
}

// needs_research: the automatic repair already fired server-side by the
// time this ever renders (see advance-long-form-script's stageFinalizing) —
// this state is only reached if that repair couldn't even start (paused/
// misconfigured) or genuinely failed, since the normal in-flight case shows
// RepairLoadingState instead. needs_attention: one automatic repair round
// was already spent and real gaps remain — no further automatic action.
function NeedsMoreResearchState({ weakChapterTitles, attentionAlreadyTried, onImproveResearch, onViewDraft }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">More research needed</h1>
      <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/45">
        {attentionAlreadyTried
          ? "Zyvo already tried to strengthen the research automatically, but some parts still need stronger evidence before the video can continue."
          : "Zyvo found a few parts of the story that need stronger evidence before the video can continue."}
      </p>
      {weakChapterTitles.length > 0 && (
        <div className="mx-auto mt-5 max-w-[380px] rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 text-left">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-white/30">
            {weakChapterTitles.length} section{weakChapterTitles.length === 1 ? "" : "s"} need{weakChapterTitles.length === 1 ? "s" : ""} more research
          </p>
          <ul className="space-y-1.5">
            {weakChapterTitles.map((title) => (
              <li key={title} className="text-[13px] text-white/65">
                {title}
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={onImproveResearch}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]"
      >
        Improve Research →
      </button>
      {onViewDraft && (
        <div className="mt-3">
          <button type="button" onClick={onViewDraft} className="text-[12.5px] font-semibold text-white/40 hover:text-white/70">
            View Draft
          </button>
        </div>
      )}
    </div>
  );
}

// The successful-state content — reused for both the current Script Ready
// page and "View Previous Script."
function ScriptContent({ script }) {
  const [expanded, setExpanded] = useState(false);
  const doc = script.script_document ?? {};
  const segments = doc.narrationSegments ?? [];
  const chapters = doc.chapters ?? [];
  const segmentById = new Map(segments.map((s) => [s.id, s]));
  const researchWarnings = doc.researchWarnings ?? [];

  return (
    <>
      <div className="mb-7 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-white">{doc.title || "Untitled"}</p>
          <p className="mt-1 text-[12.5px] font-medium text-white/45">{formatMinutesWords(doc.estimatedDurationSeconds, doc.actualWords)}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-lime-300/25 bg-lime-300/[0.06] px-3 py-1 text-[11px] font-semibold text-lime-300">
          <CheckCircle2 className="h-3 w-3" />
          Research-grounded
        </span>
      </div>

      {researchWarnings.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
          <p className="flex items-start gap-2 text-[12.5px] font-medium text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Some parts of the research have limited evidence. Zyvo kept those sections conservative.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {chapters.map((chapter, i) => {
          const chapterSegments = (chapter.segmentIds ?? []).map((id) => segmentById.get(id)).filter(Boolean);
          const durationSeconds = chapterSegments.reduce((sum, s) => sum + (Number(s.estimatedSeconds) || 0), 0);
          const fullText = chapterSegments.map((s) => s.text).join("\n\n");
          const previewText = expanded ? fullText : `${chapterSegments[0]?.text ?? ""}`;
          return (
            <div key={chapter.chapterId} className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">
                  Chapter {i + 1} • {formatChapterDuration(durationSeconds)}
                </p>
              </div>
              <h3 className="mb-2 text-[15px] font-bold text-white">{chapter.title}</h3>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-white/65">{previewText}</p>
              {!expanded && chapterSegments.length > 1 && <p className="mt-2 text-[11.5px] font-medium text-white/25">+ {chapterSegments.length - 1} more segment{chapterSegments.length - 1 === 1 ? "" : "s"}</p>}
            </div>
          );
        })}
      </div>

      <div className="mt-5 text-center">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-[12.5px] font-semibold text-white/45 hover:text-white">
          {expanded ? "Show Less" : "Show Full Script →"}
        </button>
      </div>
    </>
  );
}

export default function LongFormScript() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [script, setScript] = useState(null);
  const [staleScript, setStaleScript] = useState(null);
  const [row, setRow] = useState({ stage: "draft" });
  const [repairRow, setRepairRow] = useState(null);
  // loading | generating | repairing | ready | needs-research | needs-attention |
  // stale | viewing-stale | viewing-draft | failed | notfound | needs-research-upstream
  const [phase, setPhase] = useState("loading");
  const [regenerating, setRegenerating] = useState(false);
  const startInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    document.title = "Script | Zyvo";
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Watches a targeted Research repair through to completion, then hands
  // off to watching the brand-new ScriptVersion it triggers — the user
  // never has to manually restart anything (see advance-long-form-research's
  // auto-chain). If the repair itself fails outright, falls back to the
  // plain "needs more research, please improve manually" state.
  const pollRepair = async (parentResearchVersionId, storyPlanVersionId) => {
    if (cancelledRef.current) return;
    const repair = await fetchRepairResearchVersion(parentResearchVersionId);
    if (cancelledRef.current) return;
    if (!repair) {
      // A brief race is expected right after the script settles at
      // needs_research (the repair row is inserted moments before) —
      // keep waiting rather than assuming it will never appear.
      setPhase("repairing");
      pollTimerRef.current = setTimeout(() => pollRepair(parentResearchVersionId, storyPlanVersionId), POLL_INTERVAL_MS);
      return;
    }
    setRepairRow(repair);
    if (repair.status === "researching") {
      setPhase("repairing");
      pollTimerRef.current = setTimeout(() => pollRepair(parentResearchVersionId, storyPlanVersionId), POLL_INTERVAL_MS);
      return;
    }
    if (repair.status === "failed") {
      setPhase("needs-research");
      return;
    }
    // Repair resolved (ready or needs_attention) — a new ScriptVersion was
    // auto-started against it server-side. Hand off entirely to the normal
    // Script loading/settle flow, watching THAT new (research, script) pair
    // instead — its own "Writing your narration…" state covers the rest.
    const freshProject = await fetchLongFormProject(projectId);
    if (freshProject) setProject(freshProject);
    pollForCompletion(storyPlanVersionId, repair.id);
  };

  const settleFromVersionRow = (versionRow, storyPlanVersionId) => {
    if (versionRow.status === "ready") {
      setScript(versionRow);
      setPhase("ready");
      return;
    }
    if (versionRow.status === "needs_attention") {
      setScript(versionRow);
      setPhase("needs-attention");
      return;
    }
    if (versionRow.status === "needs_research") {
      // The backend only ever sets needs_research when a targeted repair
      // has actually started (see advance-long-form-script) — watch it.
      setScript(versionRow);
      setPhase("repairing");
      pollRepair(versionRow.research_version_id, storyPlanVersionId);
      return;
    }
    setPhase("failed");
  };

  const pollForCompletion = async (storyPlanVersionId, researchVersionId) => {
    if (cancelledRef.current) return;
    const versionRow = await fetchLatestScriptForVersions(projectId, storyPlanVersionId, researchVersionId);
    if (cancelledRef.current) return;
    if (versionRow?.status === "drafting") {
      setRow(versionRow);
      setPhase("generating");
      pollTimerRef.current = setTimeout(() => pollForCompletion(storyPlanVersionId, researchVersionId), POLL_INTERVAL_MS);
      return;
    }
    if (versionRow) {
      settleFromVersionRow(versionRow, storyPlanVersionId);
    } else {
      setPhase("failed");
    }
  };

  const startAndWatch = async (regenerate = false) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPhase("generating");
    setRewriting(false);
    setRepairRow(null);
    setRow({ stage: "draft" });
    const result = await startScript(projectId, { regenerate });
    startInFlightRef.current = false;
    setRegenerating(false);

    if (!result.ok) {
      setPhase("failed");
      return;
    }

    setProject(result.project);
    setRow(result.script);
    pollForCompletion(result.project.current_story_plan_version_id, result.project.current_research_version_id);
  };

  const bootstrap = async () => {
    const projectRow = await fetchLongFormProject(projectId);
    if (!projectRow) {
      setPhase("notfound");
      return;
    }
    if (!projectRow.current_story_plan_version_id) {
      setPhase("needs-story-plan");
      return;
    }
    setProject(projectRow);

    const researchRow = await fetchLatestResearchForStoryPlanVersion(projectId, projectRow.current_story_plan_version_id);
    if (!researchRow || (researchRow.status !== "ready" && researchRow.status !== "needs_attention")) {
      setPhase("needs-research-upstream");
      return;
    }

    const currentVersionRow = await fetchLatestScriptForVersions(projectId, projectRow.current_story_plan_version_id, researchRow.id);
    if (currentVersionRow) {
      if (currentVersionRow.status === "drafting") {
        setRow(currentVersionRow);
        setPhase("generating");
        pollForCompletion(projectRow.current_story_plan_version_id, researchRow.id);
        return;
      }
      settleFromVersionRow(currentVersionRow, projectRow.current_story_plan_version_id);
      return;
    }

    const lastCompleted = await fetchLastCompletedScript(projectRow);
    if (lastCompleted && (lastCompleted.story_plan_version_id !== projectRow.current_story_plan_version_id || lastCompleted.research_version_id !== researchRow.id) && (lastCompleted.status === "ready" || lastCompleted.status === "needs_research" || lastCompleted.status === "needs_attention")) {
      setStaleScript(lastCompleted);
      setPhase("stale");
      return;
    }

    startAndWatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleRegenerate = () => {
    if (regenerating) return;
    setRegenerating(true);
    startAndWatch(true);
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

  if (phase === "needs-story-plan" || phase === "needs-research-upstream") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <p className="text-[15px] font-semibold text-white">
          {phase === "needs-story-plan" ? "This project needs a Story Plan before Script can begin." : "This project needs completed Research before Script can begin."}
        </p>
        <button
          type="button"
          onClick={() => navigate(`/long-form/project/${projectId}/${phase === "needs-story-plan" ? "story" : "research"}`)}
          className="mt-4 text-[13px] font-semibold text-lime-300"
        >
          {phase === "needs-story-plan" ? "Go to Story Plan" : "Go to Research"}
        </button>
      </div>
    );
  }

  if (phase === "loading") return null;

  if (phase === "generating" || phase === "failed") {
    // Viewport-locked — see research.jsx's identical wrapper.
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="story" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <ScriptLoadingState row={row} failed={phase === "failed"} onRetry={() => startAndWatch(false)} startedAt={row?.created_at} />
        </div>
      </div>
    );
  }

  if (phase === "stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" />
        <StaleScriptState onViewPrevious={() => setPhase("viewing-stale")} />
        <LongFormActionFooter
          secondaryLabel="Back to Research"
          onSecondary={() => navigate(`/long-form/project/${projectId}/research`)}
          primaryLabel="Write New Script"
          primaryLoadingLabel="Writing…"
          onPrimary={handleRegenerate}
          primaryLoading={regenerating}
        />
      </div>
    );
  }

  if (phase === "viewing-stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" />
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This script belongs to an earlier Story Plan or Research version.</p>
        </div>
        <div className="mb-7">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white lg:text-[24px]">Viewing previous script</h1>
          <p className="mt-1.5 text-[13.5px] text-white/45">This is here for reference — it won't be used going forward.</p>
        </div>
        <ScriptContent script={staleScript} />
        <LongFormActionFooter
          secondaryLabel="Back"
          onSecondary={() => setPhase("stale")}
          primaryLabel="Write New Script"
          primaryLoadingLabel="Writing…"
          onPrimary={handleRegenerate}
          primaryLoading={regenerating}
        />
      </div>
    );
  }

  // Provisional/diagnostic scripts (needs_research still repairing, or
  // needs_attention/needs_research after repair budget is used) never show
  // as if finished — this is the deliberate "don't show the ugly
  // provisional narration as if it were finished" behavior. "View Draft" is
  // an explicit secondary opt-in only.
  if (phase === "repairing") {
    // Viewport-locked — see research.jsx's identical wrapper.
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="story" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <RepairLoadingState repairRow={repairRow} />
        </div>
      </div>
    );
  }

  if (phase === "viewing-draft" && script) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" />
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This is a provisional draft — some sections still need stronger evidence.</p>
        </div>
        <ScriptContent script={script} />
        <LongFormActionFooter
          secondaryLabel="Back"
          onSecondary={() => setPhase(script.status === "needs_attention" ? "needs-attention" : "needs-research")}
          primaryLabel="Improve Research →"
          onPrimary={() => navigate(`/long-form/project/${projectId}/research`)}
        />
      </div>
    );
  }

  if (phase === "needs-research" || phase === "needs-attention") {
    const weakChapterTitles = extractWeakChapterTitles(script?.script_document?.researchWarnings);
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" />
        <NeedsMoreResearchState
          weakChapterTitles={weakChapterTitles}
          attentionAlreadyTried={phase === "needs-attention"}
          onImproveResearch={() => navigate(`/long-form/project/${projectId}/research`)}
          onViewDraft={script ? () => setPhase("viewing-draft") : null}
        />
        <LongFormActionFooter secondaryLabel="Back to Research" onSecondary={() => navigate(`/long-form/project/${projectId}/research`)} primaryLabel="Improve Research →" onPrimary={() => navigate(`/long-form/project/${projectId}/research`)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="story" />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Narration Ready</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Your video is written and ready to turn into a visual story.</p>
      </motion.div>

      <ScriptContent script={script} />

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-5">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/45 hover:text-white disabled:opacity-40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate Script"}
        </button>
      </div>

      <LongFormActionFooter
        secondaryLabel="Back to Research"
        onSecondary={() => navigate(`/long-form/project/${projectId}/research`)}
        primaryLabel="Continue to Look"
        onPrimary={() => navigate(`/long-form/project/${projectId}/look`)}
      />
    </div>
  );
}
