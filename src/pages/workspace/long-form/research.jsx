import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronDown, ExternalLink, RefreshCw, RotateCw, TriangleAlert } from "lucide-react";
import { fetchLongFormProjectSafe, fetchCurrentStoryPlan } from "./project";
import { fetchLatestResearchForStoryPlanVersionSafe, fetchResearchSources, fetchLastCompletedResearch, fetchResearchVersionById, startResearch, startResearchRepair } from "./research";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";
import { nextBackoffMs, useConnectionStatus } from "./connectionState";

const POLL_INTERVAL_MS = 3000;

// Maps the backend's internal stage column to friendly copy — never expose
// the enum names themselves. gap_search/final_extraction only appear once a
// run has actually reached them (the Coverage Critic decided real gaps
// exist); a run that skips straight from coverage_review to finalizing
// never shows them at all, so the checklist length itself reflects reality.
const STAGE_ORDER = ["planning", "initial_search", "initial_extraction", "coverage_review", "gap_search", "final_extraction", "final_coverage_review", "finalizing"];
const STAGE_LABELS = {
  planning: "Planning research",
  initial_search: "Finding reliable sources",
  initial_extraction: "Organizing key facts",
  coverage_review: "Checking evidence coverage",
  gap_search: "Filling research gaps",
  final_extraction: "Verifying key claims",
  final_coverage_review: "Rechecking evidence coverage",
  finalizing: "Preparing your research",
};

function visibleStages(stage) {
  const idx = STAGE_ORDER.indexOf(stage);
  const core = ["planning", "initial_search", "initial_extraction", "coverage_review"];
  const showGapStages = idx >= STAGE_ORDER.indexOf("gap_search");
  return [...core, ...(showGapStages ? ["gap_search", "final_extraction", "final_coverage_review"] : []), "finalizing"];
}

const TIER_LABEL = { A: "Highest quality", B: "Strong", C: "Reputable", LOWER: "Limited" };
const TIER_CLASS = {
  A: "border-lime-300/30 bg-lime-300/10 text-lime-300",
  B: "border-sky-300/30 bg-sky-300/10 text-sky-300",
  C: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  LOWER: "border-white/15 bg-white/[0.04] text-white/40",
};

const COVERAGE_LABEL = { strong: "Strong coverage", moderate: "Some uncertainty", weak: "Needs more research" };

const STAGE_MICRO_COPY = {
  planning: "Deciding exactly what needs to be verified.",
  initial_search: "Searching for evidence behind the key claims.",
  initial_extraction: "Turning sources into a usable evidence base.",
  coverage_review: "Making sure every important section is supported.",
  gap_search: "Strengthening the parts that still need evidence.",
  final_extraction: "Turning new sources into evidence too.",
  final_coverage_review: "Double-checking the strengthened sections.",
  finalizing: "Finalizing the research package for your narration.",
  repair_planning: "Deciding exactly what still needs to be verified.",
  repair_search: "Searching for evidence behind the specific gap.",
  repair_extraction: "Turning new sources into usable evidence.",
  repair_coverage: "Rechecking coverage with the new evidence.",
};

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Real progress, not a fake rotating list — checkmarks only ever appear for
// stages the DB has actually persisted as complete (stage is strictly
// ahead of that step). See GenerationExperience for the shared visual
// system every Long Form generation screen now uses.
function ResearchLoadingState({ stage, failed, onRetry, startedAt, stageStartedAt, workerLockUntil, connectionStatus, isComplete }) {
  const steps = visibleStages(stage ?? "planning");
  return (
    <GenerationExperience
      variant="research"
      heading="Researching your video…"
      microCopy={STAGE_MICRO_COPY[stage] ?? STAGE_MICRO_COPY.planning}
      stageOrder={steps}
      stageLabels={STAGE_LABELS}
      currentStageKey={stage ?? "planning"}
      startedAt={startedAt}
      stageStartedAt={stageStartedAt}
      workerLockUntil={workerLockUntil}
      failed={failed}
      failedHeading="We couldn't complete the research right now."
      failedSubcopy="Please try again shortly."
      onRetry={onRetry}
      reassuranceNote="You can leave this page. Zyvo will keep working in the background and pick up right where it left off."
      connectionStatus={connectionStatus}
      isComplete={isComplete}
    />
  );
}

// Deliberately "needs updating," not "something broke" — subtle amber/refresh
// treatment rather than the red error styling used for genuine failures.
// "Update Research" itself lives in the persistent action footer (see call
// site) alongside "Back to Story Plan" — this component only renders the
// explanatory message plus the one action that doesn't fit that Back/
// Primary pair.
function StaleResearchState({ onViewPrevious }) {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <RefreshCw className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">Your Story Plan changed</h1>
      <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-relaxed text-white/45">
        This research was created for an earlier version of your story. Update the research so the evidence matches your latest plan.
      </p>
      <div className="mt-6">
        <button type="button" onClick={onViewPrevious} className="text-[12.5px] font-semibold text-white/40 hover:text-white/70">
          View Previous Research
        </button>
      </div>
    </div>
  );
}

// The successful-state content — reused as-is for both the current Research
// Ready page and "View Previous Research," which renders the identical
// content sourced from an older, non-current research version.
function ResearchContent({ research, storyPlan }) {
  const [showSources, setShowSources] = useState(false);
  const facts = research.fact_graph?.facts ?? [];
  const disputedFacts = facts.filter((f) => f.disputed);
  const keyFindings = facts.filter((f) => !f.disputed && f.scriptUsable !== false && f.classification !== "HYPOTHETICAL_ASSUMPTION").slice(0, 8);
  const coverageByChapter = new Map((research.coverage?.chapterCoverage ?? []).map((c) => [c.chapterId, c]));
  const overallCoverageLabel = { strong: "Strong", moderate: "Moderate", weak: "Needs work" }[research.coverage?.overallCoverage] ?? "Moderate";

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Sources", research.sources.length],
          ["Key facts", facts.length],
          ["Coverage", overallCoverageLabel],
          ["Potential disputes", disputedFacts.length],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/[0.09] bg-[#151719] p-4 text-center">
            <p className="text-[20px] font-bold text-white">{value}</p>
            <p className="mt-0.5 text-[11px] font-medium text-white/40">{label}</p>
          </div>
        ))}
      </div>

      {storyPlan && (
        <div className="mt-7">
          <h2 className="mb-3 text-[15px] font-bold text-white">Research Coverage</h2>
          <div className="space-y-2">
            {storyPlan.chapters.map((chapter) => {
              const cov = coverageByChapter.get(chapter.id);
              const status = cov?.status ?? "moderate";
              const strong = status === "strong";
              return (
                <div key={chapter.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                  {strong ? <CheckCircle2 className="h-4 w-4 shrink-0 text-lime-300" /> : <TriangleAlert className="h-4 w-4 shrink-0 text-amber-300" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-white">{chapter.title}</p>
                    <p className="text-[11.5px] text-white/40">{COVERAGE_LABEL[status]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {keyFindings.length > 0 && (
        <div className="mt-7 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
          <h2 className="text-[15px] font-bold text-white">Key Findings</h2>
          <ul className="mt-3 space-y-2.5">
            {keyFindings.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-[13px] leading-relaxed text-white/65">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-lime-300/60" />
                {f.claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {disputedFacts.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
          <h2 className="text-[13.5px] font-bold text-white/80">Things Zyvo will handle carefully</h2>
          <ul className="mt-3 space-y-2.5">
            {disputedFacts.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-white/50">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300/70" />
                {f.disputeSummary || f.claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      {research.sources.length > 0 && (
        <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
          <button type="button" onClick={() => setShowSources((v) => !v)} className="flex w-full items-center justify-between px-5 py-4">
            <span className="text-[13px] font-semibold text-white/70">Sources ({research.sources.length})</span>
            <ChevronDown className={`h-4 w-4 text-white/40 transition ${showSources ? "rotate-180" : ""}`} />
          </button>
          {showSources && (
            <div className="space-y-1 border-t border-white/[0.06] px-3 py-3">
              {research.sources.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition hover:bg-white/[0.04]">
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${TIER_CLASS[s.quality_tier] ?? TIER_CLASS.LOWER}`} title={TIER_LABEL[s.quality_tier]}>
                    {s.quality_tier}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-white/75">{s.title || hostnameOf(s.url)}</span>
                    <span className="block truncate text-[11px] text-white/35">{s.publisher || hostnameOf(s.url)}</span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/25" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default function LongFormResearch() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [storyPlan, setStoryPlan] = useState(null);
  const [research, setResearch] = useState(null);
  const [staleResearch, setStaleResearch] = useState(null);
  const [stage, setStage] = useState("planning");
  const [researchRow, setResearchRow] = useState(null); // the live in-flight row, kept for startedAt/meta while generating
  // loading | generating | ready | stale | viewing-stale | failed | notfound | needs-story-plan
  const [phase, setPhase] = useState("loading");
  // Brief true-only window between the backend actually reporting done and
  // this page switching to the ready reveal — lets the progress rail play
  // its 97->100 payoff (see GenerationProgressRail) instead of jump-cutting
  // straight to the result screen. Purely cosmetic; never gates a real
  // status decision — settleFromVersionRow still does that once this timer
  // elapses.
  const [completing, setCompleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [updating, setUpdating] = useState(false);
  // 2026-09-20 "clarify the completed research screen" fix — true only
  // while the real targeted-repair action (startResearchRepair) is
  // in flight. Separate from `regenerating` (the full-restart path,
  // kept only as an explicit secondary action) so the UI can never
  // conflate the two.
  const [repairError, setRepairError] = useState(null);
  const [repairing, setRepairing] = useState(false);
  // Set only when the LATEST version for the current Story Plan is a
  // targeted-repair attempt (parent_research_version_id set) that ended in
  // status "failed" — e.g. the worker holding its lease disappeared
  // mid-extraction and never came back. Real incident this fixes: without
  // this, settleFromVersionRow took that row's bare "failed" status at face
  // value and showed the full-screen generic failure UI, completely hiding
  // the parent's real, already-completed research (30 sources, 18 facts) as
  // if none of it had ever happened. `research` here always holds that
  // still-valid PARENT row; this field only carries the failed repair row
  // itself, purely to drive the banner + retry action below.
  const [repairFailure, setRepairFailure] = useState(null);
  // True only while a POLL has recorded a transient fetch error (network,
  // auth-refresh-while-offline, timeout) — never set from a real persisted
  // "failed" status. Cleared the instant a poll succeeds again. This (not a
  // frontend guess) is what "the frontend is never authoritative for
  // workflow status" means in practice — see connectionState.js.
  const [connectionIssue, setConnectionIssue] = useState(false);
  // Brief "Reconnected · Syncing progress…" transitional notice — set the
  // instant a browser "online" event triggers a resync poll, cleared the
  // moment that poll (or any later one) actually succeeds. Purely cosmetic;
  // never gates any real state transition.
  const [justReconnected, setJustReconnected] = useState(false);
  const startInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  // Bumped on every real mount, including React StrictMode's dev-only
  // deliberate double-invoke. Every async chain below (bootstrap,
  // pollForCompletion, startAndWatch, settleFromVersionRow) captures the
  // token that was current when IT started and re-checks it after each
  // await, bailing out the instant it no longer matches. This replaces a
  // previous plain `cancelledRef` boolean that was flipped true by the
  // FIRST (pre-remount) mount's cleanup and never reset — since StrictMode's
  // remount reuses the same ref, that made the SECOND bootstrap call (and
  // the tail of the first one, once its pending await resolved) bail out
  // immediately after their very first await, forever. `phase` never left
  // its initial "loading" value, which rendered blank — the exact cause of
  // the Research route going dark, reproducible on both a brand-new project
  // (no Research row was ever created) and an existing "ready" one.
  const mountTokenRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const activePollKeyRef = useRef(null); // the storyPlanVersionId currently being watched, so the "online" handler can trigger an immediate resync without a stale closure
  const { reconnectedAt } = useConnectionStatus();

  useEffect(() => {
    document.title = "Research | Zyvo";
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // On reconnect: cancel whatever backoff timer is pending and re-poll
  // immediately — the user shouldn't wait out a 30s backoff just because
  // connectivity happens to have returned this instant. Never fires more
  // than once per actual browser "online" event (reconnectedAt only changes
  // then), so this can't spam requests.
  useEffect(() => {
    if (!reconnectedAt || !activePollKeyRef.current) return;
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    setJustReconnected(true);
    pollForCompletion(activePollKeyRef.current, mountTokenRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconnectedAt]);

  const settleFromVersionRow = async (row, token) => {
    if (row.status === "ready" || row.status === "needs_attention") {
      const sources = await fetchResearchSources(row.id);
      if (mountTokenRef.current !== token) return;
      setResearch({ ...row, sources });
      setRepairFailure(null);
      setPhase("ready");
      return;
    }
    if (row.status === "failed" && row.parent_research_version_id) {
      // A targeted repair died (see repairFailure's own comment) — recover
      // and show the PARENT's real completed research instead of a blank
      // failure. Only takes this path if the parent itself is genuinely
      // usable; otherwise falls through to the honest full failure screen.
      const parent = await fetchResearchVersionById(row.parent_research_version_id);
      if (mountTokenRef.current !== token) return;
      if (parent && (parent.status === "ready" || parent.status === "needs_attention")) {
        const sources = await fetchResearchSources(parent.id);
        if (mountTokenRef.current !== token) return;
        setResearch({ ...parent, sources });
        setRepairFailure(row);
        setPhase("ready");
        return;
      }
    }
    setPhase("failed");
  };

  // The async worker owns progression entirely — this is a plain read loop,
  // never a trigger. Refresh, browser close/reopen, or "Back to Story then
  // Research again" all land back here and just resume watching whatever
  // the backend has already gotten to; nothing here ever re-starts a run.
  const pollForCompletion = async (storyPlanVersionId, token) => {
    if (mountTokenRef.current !== token) return;
    activePollKeyRef.current = storyPlanVersionId;
    const { ok, data: row } = await fetchLatestResearchForStoryPlanVersionSafe(projectId, storyPlanVersionId);
    if (mountTokenRef.current !== token) return;

    if (!ok) {
      // A transient fetch error (offline, auth refresh failing while
      // offline, a timed-out request) — NOT a real backend signal. Keep
      // whatever generation UI is already showing, surface the connection
      // notice, and retry with backoff. Never touches phase/status.
      const failureCount = consecutiveFailuresRef.current + 1;
      consecutiveFailuresRef.current = failureCount;
      setConnectionIssue(true);
      pollTimerRef.current = setTimeout(() => pollForCompletion(storyPlanVersionId, token), nextBackoffMs(failureCount));
      return;
    }
    consecutiveFailuresRef.current = 0;
    setConnectionIssue(false);
    setJustReconnected(false);

    if (row?.status === "researching") {
      setStage(row.stage ?? "planning");
      setResearchRow(row);
      setPhase("generating");
      pollTimerRef.current = setTimeout(() => pollForCompletion(storyPlanVersionId, token), POLL_INTERVAL_MS);
      return;
    }
    if (row) {
      const { ok: projectOk, data: freshProject } = await fetchLongFormProjectSafe(projectId);
      if (mountTokenRef.current !== token) return;
      if (projectOk && freshProject) setProject(freshProject);
      if (row.status === "ready" || row.status === "needs_attention") {
        // Real completion — hold on the generating screen just long enough
        // for the rail's 97->100 payoff (see rule 17/18) before switching to
        // the ready reveal. Only reachable from an active "generating"
        // render, never from a cold bootstrap landing directly on "ready".
        setCompleting(true);
        pollTimerRef.current = setTimeout(() => {
          if (mountTokenRef.current !== token) return;
          settleFromVersionRow(row, token);
        }, 550);
        return;
      }
      settleFromVersionRow(row, token);
    } else {
      // A genuinely successful query that found NO row at all — this only
      // happens if the research row was somehow deleted server-side (never
      // a network issue, since `ok` is true here). Treat as failed; there
      // is nothing left to resume.
      setPhase("failed");
    }
  };

  // Starts (or resumes watching) research for the CURRENT Story Plan
  // version. start-long-form-research returns almost immediately — it does
  // not wait for the pipeline, so this always transitions into polling
  // rather than assuming the result it gets back is final. `token` defaults
  // to the CURRENT mount token so user-triggered call sites (Try Again,
  // Regenerate, Update Research) don't need to thread one through manually;
  // bootstrap() passes its own captured token explicitly since it may still
  // be resolving from a now-stale mount by the time this runs.
  const startAndWatch = async (regenerate = false, token = mountTokenRef.current) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPhase("generating");
    setStage("planning");
    // Clear any stale row from a previous run/failed attempt so the brief
    // placeholder window before the first poll resolves shows an honest
    // "Elapsed 00:00" rather than a leftover timestamp that doesn't match
    // the "planning" stage now on screen.
    setResearchRow(null);
    const result = await startResearch(projectId, { regenerate });
    startInFlightRef.current = false;
    setRegenerating(false);
    setUpdating(false);

    if (mountTokenRef.current !== token) return;

    if (!result.ok) {
      setPhase("failed");
      return;
    }

    setProject(result.project);
    // Deliberately NOT setting `stage` from result.research here — this is
    // the fix for a real reported bug: start-long-form-research's response
    // is only a thin { id, status, stage } with no research_started_at, and
    // a "Try Again" resume can legitimately jump straight back to a
    // mid-pipeline stage (e.g. initial_extraction) it died on. Setting
    // `stage` from that thin response while `researchRow` (the source of
    // the Elapsed timer) still held its old/empty value was exactly what
    // produced "Phase 3 of 5 · Elapsed 00:00" — a real stage number paired
    // with a stale or missing start time for one render. `stage` and
    // `researchRow` must only ever change TOGETHER, from the same full row
    // — pollForCompletion's very next fetch does exactly that.
    pollForCompletion(result.project.current_story_plan_version_id, token);
  };

  // Every branch below that could otherwise land on a WRONG conclusion
  // (notfound / needs-story-plan / "nothing yet, start one") first checks
  // `ok` from the safe fetchers — a transient error retries bootstrap
  // itself after a short delay instead of ever falling through to
  // "genuinely nothing exists" or triggering startAndWatch() on a project
  // that may already have real work in progress server-side.
  const bootstrap = async (token) => {
    if (mountTokenRef.current !== token) return;
    const { ok: projectOk, data: row } = await fetchLongFormProjectSafe(projectId);
    if (mountTokenRef.current !== token) return;
    if (!projectOk) {
      const failureCount = consecutiveFailuresRef.current + 1;
      consecutiveFailuresRef.current = failureCount;
      setConnectionIssue(true);
      pollTimerRef.current = setTimeout(() => bootstrap(token), nextBackoffMs(failureCount));
      return;
    }
    consecutiveFailuresRef.current = 0;
    setConnectionIssue(false);

    if (!row) {
      setPhase("notfound");
      return;
    }
    if (!row.current_story_plan_version_id) {
      setPhase("needs-story-plan");
      return;
    }
    setProject(row);

    const plan = await fetchCurrentStoryPlan(row);
    if (mountTokenRef.current !== token) return;
    if (plan) setStoryPlan(plan.story_plan);

    // Is there research (any status) already tied to the CURRENT Story Plan
    // version? This is checked independently of current_research_version_id,
    // which only ever points at the last version that finished successfully
    // — it can't by itself tell "nothing started yet" apart from "an update
    // is already running."
    const { ok: researchOk, data: currentVersionRow } = await fetchLatestResearchForStoryPlanVersionSafe(projectId, row.current_story_plan_version_id);
    if (mountTokenRef.current !== token) return;
    if (!researchOk) {
      const failureCount = consecutiveFailuresRef.current + 1;
      consecutiveFailuresRef.current = failureCount;
      setConnectionIssue(true);
      pollTimerRef.current = setTimeout(() => bootstrap(token), nextBackoffMs(failureCount));
      return;
    }
    consecutiveFailuresRef.current = 0;
    setConnectionIssue(false);

    if (currentVersionRow) {
      if (currentVersionRow.status === "researching") {
        setStage(currentVersionRow.stage ?? "planning");
        setResearchRow(currentVersionRow);
        setPhase("generating");
        pollForCompletion(row.current_story_plan_version_id, token);
        return;
      }
      await settleFromVersionRow(currentVersionRow, token);
      return;
    }

    // No research yet for the current plan — is there completed research
    // left over from an earlier plan? Show it as stale; never auto-promote
    // or auto-regenerate it.
    const lastCompleted = await fetchLastCompletedResearch(row);
    if (mountTokenRef.current !== token) return;
    if (lastCompleted && lastCompleted.story_plan_version_id !== row.current_story_plan_version_id && (lastCompleted.status === "ready" || lastCompleted.status === "needs_attention")) {
      const sources = await fetchResearchSources(lastCompleted.id);
      if (mountTokenRef.current !== token) return;
      setStaleResearch({ ...lastCompleted, sources });
      setPhase("stale");
      return;
    }

    // Genuinely nothing yet for this project at all — both fetches above
    // confirmed `ok`, so this is a real, verified conclusion, not a guess
    // made after a failed request.
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

  // 2026-09-20 "clarify the completed research screen" fix — the REAL
  // targeted repair action: narrows to exactly the chapters the current
  // research's own coverage flagged, preserves every existing source/fact
  // (see start-long-form-research-repair's own comment), and never touches
  // current_research_version_id until the repair genuinely finishes. Same
  // shape as startAndWatch/handleRegenerate: fire the request, then switch
  // into the same real polling loop everything else already uses — nothing
  // here assumes success ahead of the backend.
  const handleRepair = async () => {
    if (repairing) return;
    setRepairing(true);
    setRepairError(null);
    const token = mountTokenRef.current;
    const result = await startResearchRepair(projectId);
    if (mountTokenRef.current !== token) return;
    if (!result.ok) {
      setRepairing(false);
      setRepairError(result.message);
      return;
    }
    setProject(result.project);
    setPhase("generating");
    setStage("repair_planning");
    setResearchRow(null);
    setRepairing(false);
    pollForCompletion(result.project.current_story_plan_version_id, token);
  };

  // Never "regenerate" in the backend sense — the new Story Plan version has
  // no research row yet, so a plain (non-regenerate) call naturally creates
  // its first version without touching the old plan's research at all.
  const handleUpdateResearch = () => {
    if (updating) return;
    setUpdating(true);
    startAndWatch(false);
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

  if (phase === "needs-story-plan") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <p className="text-[15px] font-semibold text-white">This project needs a Story Plan before Research can begin.</p>
        <button type="button" onClick={() => navigate(`/long-form/project/${projectId}/story`)} className="mt-4 text-[13px] font-semibold text-lime-300">
          Go to Story Plan
        </button>
      </div>
    );
  }

  if (phase === "loading" || phase === "generating" || phase === "failed") {
    // Viewport-locked: #workspace-scroll (the actual scroll container, see
    // pages/workspace/layout.jsx) already computes its own height correctly
    // via native flexbox (100dvh minus the notice banner, TopRow, and mobile
    // bottom nav) — a direct child at h-full with overflow-hidden fits
    // exactly inside that, so this screen never causes a page scroll. The
    // header stays pinned (shrink-0); the generation/failure card centers in
    // whatever space is left below it.
    const connectionStatus = connectionIssue ? "offline" : justReconnected ? "syncing" : null;
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="story" project={project} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <ResearchLoadingState
            stage={stage}
            failed={phase === "failed"}
            onRetry={() => startAndWatch(false)}
            startedAt={researchRow?.research_started_at}
            stageStartedAt={researchRow?.stage_started_at}
            workerLockUntil={researchRow?.worker_lock_until}
            connectionStatus={phase === "failed" ? null : connectionStatus}
            isComplete={completing}
          />
        </div>
      </div>
    );
  }

  if (phase === "stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" project={project} />
        <StaleResearchState onViewPrevious={() => setPhase("viewing-stale")} />
        <LongFormActionFooter
          secondaryLabel="Back to Story Plan"
          onSecondary={() => navigate(`/long-form/project/${projectId}/story`)}
          primaryLabel="Update Research"
          primaryLoadingLabel="Updating…"
          onPrimary={handleUpdateResearch}
          primaryLoading={updating}
        />
      </div>
    );
  }

  if (phase === "viewing-stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="story" project={project} />

        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This research belongs to an earlier Story Plan.</p>
          <button
            type="button"
            onClick={handleUpdateResearch}
            disabled={updating}
            className="shrink-0 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[12px] font-semibold text-amber-200 transition hover:bg-amber-300/20 disabled:opacity-60"
          >
            {updating ? "Updating…" : "Update Research"}
          </button>
        </div>

        <div className="mb-7">
          <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white lg:text-[24px]">Viewing previous research</h1>
          <p className="mt-1.5 text-[13.5px] text-white/45">This is here for reference — it won't be used to write your script.</p>
        </div>

        <ResearchContent research={staleResearch} storyPlan={storyPlan} />

        <LongFormActionFooter
          secondaryLabel="Back"
          onSecondary={() => setPhase("stale")}
          primaryLabel="Update Research"
          primaryLoadingLabel="Updating…"
          onPrimary={handleUpdateResearch}
          primaryLoading={updating}
        />
      </div>
    );
  }

  // Last-resort safety net — every real state above has its own explicit
  // branch, so reaching here with no research loaded means `phase` somehow
  // landed on "ready" (or an unrecognized value) without the data it needs.
  // Never let that fall through into `research.status` and throw on render
  // (a null-property read there is exactly what a truly blank/black content
  // area looks like) — log it for diagnostics and offer a real way out.
  if (phase !== "ready" || !research) {
    console.error("[LongFormResearch] unexpected render state", { projectId, phase, researchVersionId: research?.id ?? researchRow?.id ?? null, status: research?.status ?? researchRow?.status ?? null, stage });
    return (
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <p className="text-[15px] font-semibold text-white">We couldn't load this research state.</p>
        <div className="mt-4 flex items-center justify-center gap-4">
          <button type="button" onClick={() => window.location.reload()} className="text-[13px] font-semibold text-lime-300">
            Retry Loading
          </button>
          <button type="button" onClick={() => navigate(`/long-form/project/${projectId}/story`)} className="text-[13px] font-semibold text-white/50 hover:text-white">
            Back to Story Plan
          </button>
        </div>
      </div>
    );
  }

  const needsAttention = research.status === "needs_attention";
  // A budget-limited finish is not the same story as "evidence was
  // genuinely thin" — Research stopped gap-filling because another call
  // could have crossed the per-video cost ceiling, using a complete,
  // internally-consistent checkpoint from before that (see
  // stageFinalExtraction's graceful-degrade path). Never show the dollar
  // ceiling itself to the user — this is calmer, honest, non-alarming copy
  // for exactly that case.
  const budgetLimited = research.meta?.completionReason === "budget_ceiling_reached";
  // 2026-09-20 "clarify the completed research screen" fix — real report:
  // a "moderate coverage, 3/7 chapters need more research" run showed an
  // alarming "Try Again" (which fully restarted research) directly next to
  // an unconditionally-enabled "Write Script", a contradictory pairing. The
  // real distinction the backend already computes is coverage.overallCoverage
  // (strong/moderate/weak) plus the per-chapter breakdown — "weak" overall
  // means the Coverage Critic itself judged the evidence base too thin
  // across the topic to write from confidently (blocking); "moderate" with
  // some individual weak chapters is real, honest uncertainty the narration
  // can still responsibly write around (nonblocking) — matching this exact
  // reported scenario (moderate overall, a minority of chapters weak).
  const chapterCoverage = research.coverage?.chapterCoverage ?? [];
  const weakChapters = chapterCoverage.filter((c) => c.status !== "strong");
  const isBlocking = needsAttention && research.coverage?.overallCoverage === "weak";
  const isNonblocking = needsAttention && !isBlocking;
  const affectedChapterTitles = weakChapters.map((c) => storyPlan?.chapters?.find((ch) => ch.id === c.chapterId)?.title ?? c.chapterId);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-[calc(112px+env(safe-area-inset-bottom))] lg:px-8 lg:py-10 lg:pb-24">
      <LongFormCreationHeader current="story" project={project} />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">
          {isBlocking ? "More evidence needed" : isNonblocking ? "Research complete — some uncertainty" : "Research Ready"}
        </h1>
        <p className="mt-1.5 text-[14px] text-white/45">
          {isBlocking
            ? "Zyvo couldn't verify enough reliable information for part of this topic — these sections need real evidence before the script can write them honestly."
            : isNonblocking
            ? "Zyvo found and organized solid evidence for most of your video. A few sections have lighter evidence — the script will handle them carefully rather than overstating what's known."
            : "Zyvo found and organized the evidence needed to write your video."}
        </p>
      </motion.div>

      {repairFailure && (
        // Highest priority, and the ONLY banner shown when present — this
        // research is exactly as it was before the repair attempt, so
        // showing the blocking/nonblocking banner underneath it too would
        // just be a second, confusing CTA competing with the retry action
        // (see script.jsx's own "duplicate Improve Research" fix for why
        // that's worth being deliberate about).
        <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
          <p className="flex items-start gap-2 text-[13px] font-medium text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            An evidence repair attempt was interrupted before it finished. Nothing was lost — this is your research exactly as it was before that attempt.
          </p>
          <button type="button" onClick={() => startAndWatch(false)} disabled={regenerating} className="mt-2.5 text-[12.5px] font-semibold text-amber-200 underline underline-offset-2 disabled:opacity-50">
            {regenerating ? "Retrying…" : "Retry evidence repair"}
          </button>
        </div>
      )}

      {!repairFailure && isBlocking && (
        <div className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
          <p className="flex items-start gap-2 text-[13px] font-medium text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Affected chapters: {affectedChapterTitles.join(", ")}
          </p>
          <button type="button" onClick={handleRepair} disabled={repairing} className="mt-2.5 text-[12.5px] font-semibold text-amber-200 underline underline-offset-2 disabled:opacity-50">
            {repairing ? "Researching missing sections…" : "Research missing sections"}
          </button>
          {repairError && <p className="mt-2 text-[12px] text-red-300">{repairError}</p>}
        </div>
      )}

      {!repairFailure && isNonblocking && (
        <div className="mb-5 rounded-2xl border border-white/[0.09] bg-white/[0.02] p-4">
          <p className="flex items-start gap-2 text-[13px] font-medium text-white/70">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/70" />
            {budgetLimited
              ? "Zyvo found strong evidence for most of your story. A few sections have less evidence, so the narration will handle those carefully."
              : `${weakChapters.length} of ${storyPlan?.chapters?.length ?? weakChapters.length} chapters have lighter evidence: ${affectedChapterTitles.join(", ")}.`}
          </p>
          <button type="button" onClick={handleRepair} disabled={repairing} className="mt-2.5 text-[12.5px] font-semibold text-white/50 underline underline-offset-2 hover:text-white/80 disabled:opacity-50">
            {repairing ? "Researching missing sections…" : "Research missing sections anyway"}
          </button>
          {repairError && <p className="mt-2 text-[12px] text-red-300">{repairError}</p>}
        </div>
      )}

      <ResearchContent research={research} storyPlan={storyPlan} />

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-5">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/45 hover:text-white disabled:opacity-40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Start over with full research"}
        </button>
      </div>

      {repairFailure ? (
        <LongFormActionFooter
          secondaryLabel="Back to Story Plan"
          onSecondary={() => navigate(`/long-form/project/${projectId}/story`)}
          tertiaryLabel="Write Script anyway"
          onTertiary={() => navigate(`/long-form/project/${projectId}/script`)}
          primaryLabel="Retry evidence repair"
          onPrimary={() => startAndWatch(false)}
          primaryLoading={regenerating}
          primaryLoadingLabel="Retrying…"
        />
      ) : isBlocking ? (
        <LongFormActionFooter
          secondaryLabel="Back to Story Plan"
          onSecondary={() => navigate(`/long-form/project/${projectId}/story`)}
          tertiaryLabel="Write Script anyway"
          onTertiary={() => navigate(`/long-form/project/${projectId}/script`)}
          primaryLabel="Research missing sections"
          onPrimary={handleRepair}
          primaryLoading={repairing}
          primaryLoadingLabel="Researching…"
        />
      ) : (
        <LongFormActionFooter
          secondaryLabel="Back to Story Plan"
          onSecondary={() => navigate(`/long-form/project/${projectId}/story`)}
          primaryLabel="Write Script"
          onPrimary={() => navigate(`/long-form/project/${projectId}/script`)}
        />
      )}
    </div>
  );
}
