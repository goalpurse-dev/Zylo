import { useEffect, useRef, useState } from "react";
import { autopilotRedirectRoute } from "./autopilot";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, RefreshCw, TriangleAlert } from "lucide-react";
import { fetchLongFormProject, fetchCurrentStoryPlan } from "./project";
import { fetchLatestResearchForStoryPlanVersion, fetchRepairResearchVersion } from "./research";
import { fetchLatestScriptForVersions, fetchLastCompletedScript, startScript } from "./script";
import { fetchActiveGenerationProfile, isStickmanRecipeProfile } from "./productionProfile";
import { lockStory } from "./narration";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";
import { WORDS_PER_MINUTE } from "../../../lib/longFormPipelineConstants.ts";

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

// Only a fallback for a chapter that predates attachChapterMetrics (older
// documents lack chapter.estimatedSeconds): the document's own voice pace
// (narrationWpm, Phase 2c), else the shared WORDS_PER_MINUTE — the same rule
// advance-long-form-script uses. Not a second timing system.
const narrationWordsPerMinute = (doc) => (Number(doc?.narrationWpm) > 0 ? Number(doc.narrationWpm) : WORDS_PER_MINUTE);
function countWords(text) {
  const trimmed = (text ?? "").trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

// Always the ACTUAL finished narration's length — never the Story Plan's
// target. targetMinutes (when given and it diverges meaningfully from the
// actual result) is appended as its own honest, separate figure — "15 min
// target, ~14 min actual" — never silently substituted for it. See
// advance-long-form-script's WORDS_PER_MINUTE comment for the real bug this
// guards against: a script's displayed length must always come from what
// was actually written, not what was originally planned.
function formatMinutesWords(estimatedDurationSeconds, actualWords, targetMinutes) {
  const minutes = Math.round((estimatedDurationSeconds ?? 0) / 60);
  const base = `~${minutes} min • ~${(actualWords ?? 0).toLocaleString()} words`;
  if (targetMinutes && Math.abs(minutes - targetMinutes) >= 1) {
    return `${base} (target: ${targetMinutes} min)`;
  }
  return base;
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

function ScriptLoadingState({ row, failed, pending, onRetry, startedAt }) {
  const steps = visibleStages(row);
  return (
    <GenerationExperience
      variant="script"
      heading="Writing your narration…"
      microCopy={pending ? "Starting the narration engine…" : STAGE_MICRO_COPY[row.stage] ?? STAGE_MICRO_COPY.draft}
      stageOrder={steps}
      stageLabels={STAGE_LABELS}
      currentStageKey={row.stage ?? "draft"}
      startedAt={startedAt}
      stageStartedAt={row.stage_started_at}
      workerLockUntil={row.worker_lock_until}
      failed={failed}
      pending={pending}
      failedHeading="We couldn't write the script right now."
      failedSubcopy="Please try again shortly."
      onRetry={onRetry}
    />
  );
}

// 2026-09-20 real-incident fix: this used to pass neither stageStartedAt nor
// workerLockUntil, so a real ~11-minute "Strengthening your research" wait
// (the actual reported repro) had no way to show a "last update" checkpoint
// distinct from polling, and the dead-worker/recovery detection that
// GenerationExperience already has was never actually active here — the
// exact same gap research.jsx's own loading state had before its fix.
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
      stageStartedAt={repairRow?.stage_started_at}
      workerLockUntil={repairRow?.worker_lock_until}
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
// RepairLoadingState instead. "Improve Research" is a legitimate forward
// action here — the one automatic repair round hasn't been spent yet.
//
// needs_attention: the one automatic repair round is already spent AND the
// automatic bounded conservative-rewrite pass (stageFinalizing, same file)
// already ran and either had nothing to target or failed its own
// validation. Real incident this fixes: this screen used to show the exact
// same "Improve Research →" button in both cases, which — since research.jsx
// has no user-facing way to start a SECOND targeted repair at all — just
// silently routed the user back through Write Script again, paying for a
// new draft/critic/expansion pass that could only ever land right back on
// needs_attention (the underlying evidence gap was never going to change).
// No further automatic action exists past this point, so no forward CTA
// that spends money is offered — see MAX_AUTOMATIC_REPAIR_ROUNDS's own
// invariant: never route back to research from here.
// 2026-09-20 real-incident fix: this used to also render its own "Improve
// Research →" button here, in addition to the SAME action already offered
// as the page's primary footer CTA (see the "needs-research"/"needs-attention"
// render below) — two buttons, identical label, identical action, visible on
// screen simultaneously (screenshot evidence from a real repro), plus the
// footer's own auto-rendered arrow icon stacking with the "→" already baked
// into that label text, producing a literal double arrow. One primary CTA
// per screen now lives in the footer only; this component just explains why.
function NeedsMoreResearchState({ weakChapterTitles, attentionAlreadyTried, onViewDraft }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">{attentionAlreadyTried ? "Some details need manual review" : "More research needed"}</h1>
      <p className="mx-auto mt-2 max-w-[420px] text-[13.5px] leading-relaxed text-white/45">
        {attentionAlreadyTried
          ? "Zyvo already strengthened the research once and tried to conservatively rewrite the affected parts, but couldn't fully resolve this automatically. Take a look at the draft — the rest of the video is unaffected."
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
      {onViewDraft && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onViewDraft}
            className={attentionAlreadyTried ? "mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]" : "text-[12.5px] font-semibold text-white/40 hover:text-white/70"}
          >
            View Draft
          </button>
        </div>
      )}
    </div>
  );
}

// The successful-state content — reused for both the current Script Ready
// page and "View Previous Script."
function ScriptContent({ script, targetMinutes }) {
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
          <p className="mt-1 text-[12.5px] font-medium text-white/45">{formatMinutesWords(doc.estimatedDurationSeconds, doc.actualWords, targetMinutes)}</p>
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
          // Prefer the backend's own persisted, actual-word-count-derived
          // duration (attachChapterMetrics) — fall back to computing it
          // here only for a chapter that predates that fix. Never derived
          // from a segment's own `estimatedSeconds` (a model self-report,
          // not a measurement — see advance-long-form-script's comment on
          // the real incident this replaces: a 56%-of-budget script whose
          // segments still summed to a full 15 minutes).
          const durationSeconds = chapter.estimatedSeconds ?? Math.round((chapterSegments.reduce((sum, s) => sum + countWords(s.text), 0) / narrationWordsPerMinute(doc)) * 60);
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
  // Phase 6a: a Stickman autopilot project never shows this legacy step.
  useEffect(() => { const r = autopilotRedirectRoute(project); if (r) navigate(`/long-form/project/${project.id}/${r}`, { replace: true }); }, [project]); // eslint-disable-line react-hooks/exhaustive-deps
  const [script, setScript] = useState(null);
  const [staleScript, setStaleScript] = useState(null);
  const [row, setRow] = useState({ stage: "draft" });
  const [repairRow, setRepairRow] = useState(null);
  // loading | starting | generating | repairing | ready | needs-research |
  // needs-attention | stale | viewing-stale | viewing-draft | failed |
  // notfound | needs-research-upstream
  //
  // "starting" vs "generating": a real bug once let this page set
  // "generating" (Phase 1 of 3, a running Elapsed timer) the instant the
  // user clicked Write Script, BEFORE start-long-form-script had even been
  // called — an unrelated crash a few lines later (a stray reference to a
  // setter that was never declared) then threw synchronously and stopped
  // execution before the actual start request ever went out, leaving a
  // permanent "Phase 1 of 3 / Elapsed 00:00" screen over a project with
  // zero ScriptVersion rows. "starting" now covers that whole window (click
  // -> request in flight -> row confirmed) with honest "starting the
  // engine" copy and no fake stage/timer; only pollForCompletion, once it
  // has fetched a REAL persisted row, ever sets "generating".
  const [phase, setPhase] = useState("loading");
  const [regenerating, setRegenerating] = useState(false);
  const [profile, setProfile] = useState(null);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState(null);
  const startInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  // Bumped on every real mount, including React StrictMode's dev-only
  // deliberate double-invoke — see research.jsx's identical fix (and its
  // comment) for the full explanation of why a plain boolean here is unsafe.
  const mountTokenRef = useRef(0);

  useEffect(() => {
    document.title = "Script | Zyvo";
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Watches a targeted Research repair through to completion, then hands
  // off to watching the brand-new ScriptVersion it triggers — the user
  // never has to manually restart anything (see advance-long-form-research's
  // auto-chain). If the repair itself fails outright, falls back to the
  // plain "needs more research, please improve manually" state.
  const pollRepair = async (parentResearchVersionId, storyPlanVersionId, token) => {
    if (mountTokenRef.current !== token) return;
    const repair = await fetchRepairResearchVersion(parentResearchVersionId);
    if (mountTokenRef.current !== token) return;
    if (!repair) {
      // A brief race is expected right after the script settles at
      // needs_research (the repair row is inserted moments before) —
      // keep waiting rather than assuming it will never appear.
      setPhase("repairing");
      pollTimerRef.current = setTimeout(() => pollRepair(parentResearchVersionId, storyPlanVersionId, token), POLL_INTERVAL_MS);
      return;
    }
    setRepairRow(repair);
    if (repair.status === "researching") {
      setPhase("repairing");
      pollTimerRef.current = setTimeout(() => pollRepair(parentResearchVersionId, storyPlanVersionId, token), POLL_INTERVAL_MS);
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
    if (mountTokenRef.current !== token) return;
    if (freshProject) setProject(freshProject);
    pollForCompletion(storyPlanVersionId, repair.id, token);
  };

  const settleFromVersionRow = (versionRow, storyPlanVersionId, token) => {
    if (versionRow.status === "ready") {
      // Resume case: this exact script was already locked for the active
      // Stickman profile in an earlier visit (Lock Story navigates here
      // directly on success, but a refresh/back-button re-enters through
      // bootstrap) — Narration, not this "ready to lock" screen, is the
      // truthful place to land; the lobby's own resume routing (projectStage.js)
      // doesn't know about the lock at all, so this page is what has to catch it.
      if (isStickmanRecipeProfile(profile) && versionRow.locked_at && versionRow.locked_generation_profile_id === profile.id) {
        navigate(`/long-form/project/${projectId}/narration`, { replace: true });
        return;
      }
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
      pollRepair(versionRow.research_version_id, storyPlanVersionId, token);
      return;
    }
    setPhase("failed");
  };

  // The async worker owns progression entirely — this is a plain read loop,
  // never a trigger (same contract as research.jsx's pollForCompletion).
  // This is also the ONLY place that ever sets phase to "generating" — see
  // the `phase` state comment above for why startAndWatch deliberately does
  // not do this itself.
  const pollForCompletion = async (storyPlanVersionId, researchVersionId, token) => {
    if (mountTokenRef.current !== token) return;
    const versionRow = await fetchLatestScriptForVersions(projectId, storyPlanVersionId, researchVersionId);
    if (mountTokenRef.current !== token) return;
    if (versionRow?.status === "drafting") {
      setRow(versionRow);
      setPhase("generating");
      pollTimerRef.current = setTimeout(() => pollForCompletion(storyPlanVersionId, researchVersionId, token), POLL_INTERVAL_MS);
      return;
    }
    if (versionRow) {
      settleFromVersionRow(versionRow, storyPlanVersionId, token);
    } else {
      setPhase("failed");
    }
  };

  // Deliberately does NOT set phase to "generating" — that would claim a
  // real, running ScriptVersion exists before start-long-form-script has
  // even been called, let alone succeeded. "starting" covers the whole
  // request window with honest copy; pollForCompletion is the only thing
  // that ever promotes the page to "generating", and only once it has
  // fetched back a real persisted row.
  const startAndWatch = async (regenerate = false, token = mountTokenRef.current) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPhase("starting");
    setRepairRow(null);
    setRow({ stage: "draft" });
    const result = await startScript(projectId, { regenerate });
    startInFlightRef.current = false;
    setRegenerating(false);

    if (mountTokenRef.current !== token) return;

    if (!result.ok) {
      setPhase("failed");
      return;
    }

    setProject(result.project);
    pollForCompletion(result.project.current_story_plan_version_id, result.project.current_research_version_id, token);
  };

  const bootstrap = async (token) => {
    if (mountTokenRef.current !== token) return;
    const projectRow = await fetchLongFormProject(projectId);
    if (mountTokenRef.current !== token) return;
    if (!projectRow) {
      setPhase("notfound");
      return;
    }
    if (!projectRow.current_story_plan_version_id) {
      setPhase("needs-story-plan");
      return;
    }
    setProject(projectRow);

    const activeProfile = await fetchActiveGenerationProfile(projectId);
    if (mountTokenRef.current !== token) return;
    setProfile(activeProfile);

    const researchRow = await fetchLatestResearchForStoryPlanVersion(projectId, projectRow.current_story_plan_version_id);
    if (mountTokenRef.current !== token) return;
    if (!researchRow || (researchRow.status !== "ready" && researchRow.status !== "needs_attention")) {
      setPhase("needs-research-upstream");
      return;
    }

    const currentVersionRow = await fetchLatestScriptForVersions(projectId, projectRow.current_story_plan_version_id, researchRow.id);
    if (mountTokenRef.current !== token) return;
    if (currentVersionRow) {
      if (currentVersionRow.status === "drafting") {
        setRow(currentVersionRow);
        setPhase("generating");
        pollForCompletion(projectRow.current_story_plan_version_id, researchRow.id, token);
        return;
      }
      settleFromVersionRow(currentVersionRow, projectRow.current_story_plan_version_id, token);
      return;
    }

    const lastCompleted = await fetchLastCompletedScript(projectRow);
    if (mountTokenRef.current !== token) return;
    if (lastCompleted && (lastCompleted.story_plan_version_id !== projectRow.current_story_plan_version_id || lastCompleted.research_version_id !== researchRow.id) && (lastCompleted.status === "ready" || lastCompleted.status === "needs_research" || lastCompleted.status === "needs_attention")) {
      setStaleScript(lastCompleted);
      setPhase("stale");
      return;
    }

    startAndWatch(false, token);
  };

  useEffect(() => {
    const token = ++mountTokenRef.current;
    bootstrap(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const handleRegenerate = () => {
    if (regenerating) return;
    setRegenerating(true);
    startAndWatch(true);
  };

  // Section 5/6 — the new flow's one-way commitment: locking fires Production
  // Bible + narration generation together server-side (lock-long-form-script)
  // and hands off to the Narration page, which is what actually shows their
  // progress. Legacy (non-Stickman) projects never see this path at all —
  // they keep "Continue to Look" exactly as before.
  const handleLockStory = async () => {
    if (locking) return;
    setLocking(true);
    setLockError(null);
    const result = await lockStory(projectId);
    setLocking(false);
    if (!result.ok) {
      setLockError(result.message);
      return;
    }
    navigate(`/long-form/project/${projectId}/narration`);
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

  if (phase === "loading" || phase === "starting" || phase === "generating" || phase === "failed") {
    // Viewport-locked — see research.jsx's identical wrapper. "loading"
    // (initial bootstrap) and "starting" (start request in flight, no
    // persisted row yet) both render the same honest starting-state UI as
    // "generating" here — pending=true is what actually suppresses the fake
    // Phase 1/Elapsed row until a real ScriptVersion exists (see the
    // `phase` state comment above).
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <ScriptLoadingState
            row={row}
            failed={phase === "failed"}
            pending={phase === "loading" || phase === "starting"}
            onRetry={() => startAndWatch(false)}
            startedAt={row?.created_at}
          />
        </div>
      </div>
    );
  }

  if (phase === "stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
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
        <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This script belongs to an earlier Story Plan or Research version.</p>
        </div>
        <div className="mb-7">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white lg:text-[24px]">Viewing previous script</h1>
          <p className="mt-1.5 text-[13.5px] text-white/45">This is here for reference — it won't be used going forward.</p>
        </div>
        <ScriptContent script={staleScript} targetMinutes={project?.resolved_length_minutes} />
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
          <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
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
        <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This is a provisional draft — some sections still need stronger evidence.</p>
        </div>
        <ScriptContent script={script} targetMinutes={project?.resolved_length_minutes} />
        <LongFormActionFooter
          secondaryLabel="Back"
          onSecondary={() => setPhase(script.status === "needs_attention" ? "needs-attention" : "needs-research")}
          primaryLabel={script.status === "needs_attention" ? "Back to Story" : "Improve Research"}
          onPrimary={script.status === "needs_attention" ? () => navigate(`/long-form/project/${projectId}/story`) : () => navigate(`/long-form/project/${projectId}/research`)}
        />
      </div>
    );
  }

  if (phase === "needs-research" || phase === "needs-attention") {
    const weakChapterTitles = extractWeakChapterTitles(script?.script_document?.researchWarnings);
    const attentionAlreadyTried = phase === "needs-attention";
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />
        <NeedsMoreResearchState
          weakChapterTitles={weakChapterTitles}
          attentionAlreadyTried={attentionAlreadyTried}
          onViewDraft={script ? () => setPhase("viewing-draft") : null}
        />
        {/* Repair-round cap already spent (see NeedsMoreResearchState's own
            comment) — the footer's primary action must not re-offer the same
            dead-end "Improve Research" navigation. Falls back to viewing the
            existing draft, or plain Back to Story if there's nothing to view.
            This is the single primary CTA for this screen (see
            NeedsMoreResearchState's real-incident comment on why it no
            longer renders its own duplicate). */}
        <LongFormActionFooter
          secondaryLabel="Back to Story"
          onSecondary={() => navigate(`/long-form/project/${projectId}/story`)}
          primaryLabel={attentionAlreadyTried ? (script ? "View Draft" : "Back to Story") : "Improve Research"}
          onPrimary={attentionAlreadyTried ? (script ? () => setPhase("viewing-draft") : () => navigate(`/long-form/project/${projectId}/story`)) : () => navigate(`/long-form/project/${projectId}/research`)}
        />
      </div>
    );
  }

  return (
    // pb-56 (not the usual pb-28) — this is the one Long Form page whose
    // footer can stack into 3 full-width rows on mobile (Back to Research /
    // Regenerate Script / Continue to Look), which is meaningfully taller
    // than the standard single-row footer every other pb-28 page clears.
    // lg:pb-28 keeps desktop identical to before (that footer stays one row).
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-56 lg:px-8 lg:py-10 lg:pb-28">
      <LongFormCreationHeader current="story" project={project} stickman={isStickmanRecipeProfile(profile)} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Narration Ready</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Your video is written and ready to turn into a visual story.</p>
      </motion.div>

      <ScriptContent script={script} targetMinutes={project?.resolved_length_minutes} />

      {isStickmanRecipeProfile(profile) && lockError && <p className="mb-3 text-[12.5px] text-red-300/80">{lockError}</p>}

      <LongFormActionFooter
        secondaryLabel="Back to Research"
        onSecondary={() => navigate(`/long-form/project/${projectId}/research`)}
        tertiaryLabel="Regenerate Script"
        onTertiary={handleRegenerate}
        tertiaryLoading={regenerating}
        tertiaryLoadingLabel="Regenerating…"
        primaryLabel={isStickmanRecipeProfile(profile) ? "Lock Story" : "Continue to Look"}
        primaryLoadingLabel="Locking…"
        primaryLoading={locking}
        onPrimary={isStickmanRecipeProfile(profile) ? handleLockStory : () => navigate(`/long-form/project/${projectId}/look`)}
      />
    </div>
  );
}
