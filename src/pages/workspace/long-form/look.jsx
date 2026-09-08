import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Compass, Film, Map as MapIcon, RefreshCw, RotateCw, Sparkles, TriangleAlert, X } from "lucide-react";
import { fetchLongFormProject } from "./project";
import { fetchLatestVisualPlanForScript, fetchLastCompletedVisualPlan, startVisualPlan } from "./visualPlan";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";

const POLL_INTERVAL_MS = 2000;

const STAGE_ORDER = ["planning", "finalizing"];
const STAGE_LABELS = { planning: "Interpreting your narration into visual beats", finalizing: "Building your storyboard" };
const STAGE_MICRO_COPY = { planning: "Deciding what the viewer needs to see, and when.", finalizing: "Organizing your rough storyboard." };

const VISUAL_MODE_LABEL = { STORY: "Story", EXPLAINER: "Explainer", HYBRID: "Hybrid" };
const SHOT_STRATEGY_BADGE = {
  NEW_SETUP: "New setup",
  REUSE_WITH_DELTA: "Reuse",
  INSERT: "Insert",
  DETAIL: "Detail",
  DIAGRAM: "Diagram",
  MAP: "Map",
  COMPARISON: "Comparison",
  TEXT_INFOGRAPHIC: "Text/Graphic",
};
const SHOT_STRATEGY_BADGE_CLASS = {
  NEW_SETUP: "border-lime-300/30 bg-lime-300/10 text-lime-300",
  REUSE_WITH_DELTA: "border-sky-300/30 bg-sky-300/10 text-sky-300",
  INSERT: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  DETAIL: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  DIAGRAM: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-300",
  MAP: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-300",
  COMPARISON: "border-white/20 bg-white/[0.06] text-white/60",
  TEXT_INFOGRAPHIC: "border-white/20 bg-white/[0.06] text-white/60",
};
const SHOT_SIZE_LABEL = { WIDE: "Wide shot", MEDIUM: "Medium shot", CLOSE: "Close shot", DETAIL: "Detail shot", INSERT: "Insert" };
const ENTITY_CATEGORY_ICON = { CHARACTER: Sparkles, LOCATION: Compass, IMPORTANT_OBJECT: Film, VEHICLE_MACHINE: Film, DIAGRAM_SUBJECT: MapIcon };
const ENTITY_CATEGORY_LABEL = { CHARACTER: "Character", LOCATION: "Location", IMPORTANT_OBJECT: "Object", VEHICLE_MACHINE: "Vehicle", DIAGRAM_SUBJECT: "Diagram subject" };

function formatTimeRange(startSeconds, endSeconds) {
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  return `${fmt(startSeconds)}–${fmt(endSeconds)}`;
}

function VisualPlanLoadingState({ row, failed, onRetry }) {
  return (
    <GenerationExperience
      variant="visualPlan"
      heading="Directing your visuals…"
      microCopy={STAGE_MICRO_COPY[row.stage] ?? STAGE_MICRO_COPY.planning}
      stageOrder={STAGE_ORDER}
      stageLabels={STAGE_LABELS}
      currentStageKey={row.stage ?? "planning"}
      startedAt={row?.created_at}
      failed={failed}
      failedHeading="We couldn't build the storyboard right now."
      failedSubcopy="Please try again shortly."
      onRetry={onRetry}
    />
  );
}

function StaleVisualPlanState({ onViewPrevious }) {
  return (
    <div className="mx-auto max-w-[520px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <RefreshCw className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">Your narration changed</h1>
      <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-relaxed text-white/45">This storyboard was created for an earlier script. Update it so the visuals match your latest narration.</p>
      <div className="mt-6">
        <button type="button" onClick={onViewPrevious} className="text-[12.5px] font-semibold text-white/40 hover:text-white/70">
          View Previous Storyboard
        </button>
      </div>
    </div>
  );
}

function NeedsScriptState({ onGoToScript }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
      <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] text-amber-300">
        <TriangleAlert className="h-6 w-6" strokeWidth={1.8} />
      </div>
      <h1 className="text-[20px] font-bold text-white">Your narration isn't ready yet</h1>
      <p className="mx-auto mt-2 max-w-[400px] text-[13.5px] leading-relaxed text-white/45">Zyvo can only plan the visual story once your script is finished and free of unresolved research gaps.</p>
      <button type="button" onClick={onGoToScript} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-lime-300 px-5 py-3 text-[14px] font-semibold text-[#11150D] transition hover:bg-lime-200 active:scale-[0.99]">
        Go to Script →
      </button>
    </div>
  );
}

// The one large 16:9 representative area. No generated images exist yet
// this milestone — a designed placeholder built from real plan metadata
// (never claiming to be an exact generated frame).
function StoryboardHero({ plan }) {
  const beats = plan.visual_plan?.visualBeats ?? [];
  const representative = beats.find((b) => b.shotStrategy === "NEW_SETUP") ?? beats[0];
  const summary = plan.storyboard_summary ?? {};

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.09] bg-[#151719]">
      <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-lime-300/[0.08] via-white/[0.02] to-sky-300/[0.06]">
        <div className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "radial-gradient(circle at 30% 30%, rgba(190,242,100,0.25), transparent 55%)" }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="rounded-full border border-white/15 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/60 backdrop-blur-sm">Rough storyboard planned</span>
          {representative && (
            <>
              <Film className="h-8 w-8 text-white/30" strokeWidth={1.5} />
              <p className="max-w-[440px] text-[13px] leading-relaxed text-white/55">{representative.informationToCommunicate}</p>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-4">
        {[
          ["Visual beats", summary.totalVisualBeats],
          ["Base setups", summary.estimatedBaseSetups],
          ["Inserts", summary.estimatedInserts],
          ["Diagrams", summary.estimatedDiagrams],
        ].map(([label, value]) => (
          <div key={label} className="bg-[#151719] px-4 py-3 text-center">
            <p className="text-[18px] font-bold text-white">{value ?? 0}</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-white/40">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualDirectionCard({ plan }) {
  const mix = plan.visual_plan?.visualMix;
  const summary = plan.storyboard_summary ?? {};
  return (
    <div className="mb-5 rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Visual Direction</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-white">Zyvo Illustrated Documentary</p>
          <p className="mt-1 text-[12.5px] font-medium text-white/45">Visual Mode: {VISUAL_MODE_LABEL[plan.visual_mode] ?? "Hybrid"}</p>
        </div>
        <div className="flex items-center gap-3 text-[12px] font-medium text-white/40">
          <span>{summary.totalVisualBeats ?? 0} visual beats</span>
          <span className="h-1 w-1 rounded-full bg-white/20" />
          <span>{summary.estimatedBaseSetups ?? 0} base setups</span>
        </div>
      </div>
      {mix && (
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div className="bg-lime-300" style={{ width: `${mix.storyIllustrationPct ?? 0}%` }} title={`Story Illustration ${mix.storyIllustrationPct}%`} />
          <div className="bg-sky-300" style={{ width: `${mix.explainerGraphicsPct ?? 0}%` }} title={`Explainer Graphics ${mix.explainerGraphicsPct}%`} />
          <div className="bg-fuchsia-300" style={{ width: `${mix.mapDataPct ?? 0}%` }} title={`Maps & Data ${mix.mapDataPct}%`} />
        </div>
      )}
      {mix && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-white/35">
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-lime-300" />{Math.round(mix.storyIllustrationPct ?? 0)}% Story Illustration</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-sky-300" />{Math.round(mix.explainerGraphicsPct ?? 0)}% Explainer Graphics</span>
          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-fuchsia-300" />{Math.round(mix.mapDataPct ?? 0)}% Maps & Data</span>
        </div>
      )}
    </div>
  );
}

function VisualWorldSection({ plan, onBuildVisualWorld }) {
  const entities = plan.entity_registry ?? [];
  const counts = new Map();
  for (const e of entities) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
  const preview = entities.filter((e) => e.importance !== "INCIDENTAL").slice(0, 4);

  return (
    <div className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Your Visual World</p>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-medium text-white/60">
        {["CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE"].map((cat) => (counts.get(cat) ? <span key={cat}>{counts.get(cat)} {ENTITY_CATEGORY_LABEL[cat]}{counts.get(cat) === 1 ? "" : "s"}</span> : null))}
      </div>

      {preview.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {preview.map((e) => {
            const Icon = ENTITY_CATEGORY_ICON[e.category] ?? Sparkles;
            return (
              <div key={e.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center">
                <div className="mx-auto mb-2 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/50">
                  <Icon className="h-4 w-4" strokeWidth={1.6} />
                </div>
                <p className="truncate text-[12px] font-semibold text-white">{e.name}</p>
                <p className="text-[10.5px] text-white/35">{e.importance === "HERO" ? "Hero" : "Recurring"} {ENTITY_CATEGORY_LABEL[e.category]}</p>
              </div>
            );
          })}
        </div>
      )}

      <p className="mb-4 text-[12px] leading-relaxed text-white/40">Zyvo will create reusable references for recurring people, places, and objects so the video stays visually consistent.</p>

      <button type="button" onClick={onBuildVisualWorld} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lime-300 hover:text-lime-200">
        Build Visual World →
      </button>
    </div>
  );
}

function StoryboardModal({ plan, scriptDocument, onClose }) {
  const beats = plan.visual_plan?.visualBeats ?? [];
  const segmentById = new Map((scriptDocument?.narrationSegments ?? []).map((s) => [s.id, s]));
  const chapters = scriptDocument?.chapters ?? [];
  const beatsByChapter = new Map(chapters.map((c) => [c.chapterId, beats.filter((b) => b.chapterId === c.chapterId)]));

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-[#101213] sm:h-[85vh] sm:max-w-[720px] sm:rounded-2xl sm:border sm:border-white/[0.09]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[16px] font-bold text-white">Full Storyboard</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {chapters.map((chapter, chapterIndex) => {
            const chapterBeats = beatsByChapter.get(chapter.chapterId) ?? [];
            if (!chapterBeats.length) return null;
            return (
              <div key={chapter.chapterId} className="mb-6">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Chapter {chapterIndex + 1} · {chapter.title}</p>
                <div className="space-y-2">
                  {chapterBeats.map((beat, i) => {
                    const excerpt = (beat.narrationSegmentIds ?? [])
                      .map((id) => segmentById.get(id)?.text)
                      .filter(Boolean)
                      .join(" ")
                      .slice(0, 140);
                    return (
                      <div key={beat.id} className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                        <div className="grid h-14 w-24 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-[10px] font-semibold text-white/25">16:9</div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <span className="text-[10.5px] font-semibold text-white/30">{String(i + 1).padStart(2, "0")}</span>
                            <span className="text-[10.5px] font-medium text-white/30">{formatTimeRange(beat.estimatedStartSeconds, beat.estimatedEndSeconds)}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-bold ${SHOT_STRATEGY_BADGE_CLASS[beat.shotStrategy] ?? "border-white/15 bg-white/[0.04] text-white/40"}`}>
                              {SHOT_STRATEGY_BADGE[beat.shotStrategy] ?? beat.shotStrategy}
                            </span>
                          </div>
                          <p className="text-[12.5px] leading-snug text-white/75">{beat.informationToCommunicate}</p>
                          {excerpt && <p className="mt-1 truncate text-[11px] italic text-white/30">"{excerpt}{excerpt.length >= 140 ? "…" : ""}"</p>}
                          <p className="mt-1 text-[10.5px] text-white/25">{SHOT_SIZE_LABEL[beat.shotSize] ?? beat.shotSize}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LongFormLook() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [scriptDocument, setScriptDocument] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stalePlan, setStalePlan] = useState(null);
  const [row, setRow] = useState({ stage: "planning" });
  const [phase, setPhase] = useState("loading");
  const [regenerating, setRegenerating] = useState(false);
  const [showStoryboard, setShowStoryboard] = useState(false);
  const startInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    document.title = "Look | Zyvo";
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const fetchScriptDocument = async (scriptVersionId) => {
    const { supabase } = await import("../../../lib/supabaseClient");
    const { data } = await supabase.from("long_form_script_versions").select("script_document").eq("id", scriptVersionId).maybeSingle();
    return data?.script_document ?? null;
  };

  const settleFromVersionRow = async (versionRow) => {
    if (versionRow.status === "ready") {
      const doc = await fetchScriptDocument(versionRow.script_version_id);
      setScriptDocument(doc);
      setPlan(versionRow);
      setPhase("ready");
      return;
    }
    setPhase("failed");
  };

  const pollForCompletion = async (scriptVersionId) => {
    if (cancelledRef.current) return;
    const versionRow = await fetchLatestVisualPlanForScript(projectId, scriptVersionId);
    if (cancelledRef.current) return;
    if (versionRow?.status === "planning") {
      setRow(versionRow);
      setPhase("generating");
      pollTimerRef.current = setTimeout(() => pollForCompletion(scriptVersionId), POLL_INTERVAL_MS);
      return;
    }
    if (versionRow) {
      settleFromVersionRow(versionRow);
    } else {
      setPhase("failed");
    }
  };

  const startAndWatch = async (regenerate = false) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPhase("generating");
    setRow({ stage: "planning" });
    const result = await startVisualPlan(projectId, { regenerate });
    startInFlightRef.current = false;
    setRegenerating(false);

    if (!result.ok) {
      setPhase(result.code === "SCRIPT_NOT_READY" ? "needs-script" : "failed");
      return;
    }

    setProject(result.project);
    setRow(result.visualPlan);
    pollForCompletion(result.project.current_script_version_id);
  };

  const bootstrap = async () => {
    const projectRow = await fetchLongFormProject(projectId);
    if (!projectRow) {
      setPhase("notfound");
      return;
    }
    if (!projectRow.current_script_version_id) {
      setPhase("needs-script");
      return;
    }
    setProject(projectRow);

    const { supabase } = await import("../../../lib/supabaseClient");
    const { data: scriptRow } = await supabase.from("long_form_script_versions").select("id, status").eq("id", projectRow.current_script_version_id).maybeSingle();
    if (!scriptRow || scriptRow.status !== "ready") {
      setPhase("needs-script");
      return;
    }

    const currentVersionRow = await fetchLatestVisualPlanForScript(projectId, scriptRow.id);
    if (currentVersionRow) {
      if (currentVersionRow.status === "planning") {
        setRow(currentVersionRow);
        setPhase("generating");
        pollForCompletion(scriptRow.id);
        return;
      }
      await settleFromVersionRow(currentVersionRow);
      return;
    }

    const lastCompleted = await fetchLastCompletedVisualPlan(projectRow);
    if (lastCompleted && lastCompleted.script_version_id !== scriptRow.id && lastCompleted.status === "ready") {
      setStalePlan(lastCompleted);
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
        <button type="button" onClick={() => navigate("/long-form")} className="mt-4 text-[13px] font-semibold text-lime-300">Back to Long Form</button>
      </div>
    );
  }

  if (phase === "loading") return null;

  if (phase === "needs-script") {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-8 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="look" />
        <NeedsScriptState onGoToScript={() => navigate(`/long-form/project/${projectId}/script`)} />
      </div>
    );
  }

  if (phase === "generating" || phase === "failed") {
    // Viewport-locked — see research.jsx's identical wrapper.
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="look" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <VisualPlanLoadingState row={row} failed={phase === "failed"} onRetry={() => startAndWatch(false)} />
        </div>
      </div>
    );
  }

  if (phase === "stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="look" />
        <StaleVisualPlanState onViewPrevious={async () => { setScriptDocument(await fetchScriptDocument(stalePlan.script_version_id)); setPlan(stalePlan); setPhase("viewing-stale"); }} />
        <LongFormActionFooter secondaryLabel="Back to Script" onSecondary={() => navigate(`/long-form/project/${projectId}/script`)} primaryLabel="Update Storyboard" primaryLoadingLabel="Updating…" onPrimary={handleRegenerate} primaryLoading={regenerating} />
      </div>
    );
  }

  if (phase === "viewing-stale") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
        <LongFormCreationHeader current="look" />
        <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3">
          <p className="text-[12.5px] font-medium text-amber-200">This storyboard belongs to an earlier script.</p>
        </div>
        <VisualDirectionCard plan={plan} />
        <StoryboardHero plan={plan} />
        <LongFormActionFooter secondaryLabel="Back" onSecondary={() => setPhase("stale")} primaryLabel="Update Storyboard" primaryLoadingLabel="Updating…" onPrimary={handleRegenerate} primaryLoading={regenerating} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="look" />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Your Visual Plan</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Zyvo mapped your narration into a complete visual story.</p>
      </motion.div>

      <VisualDirectionCard plan={plan} />

      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">Storyboard</p>
      <StoryboardHero plan={plan} />
      <div className="mt-3 text-center">
        <button type="button" onClick={() => setShowStoryboard(true)} className="text-[12.5px] font-semibold text-white/60 hover:text-white">
          Show Full Storyboard →
        </button>
      </div>

      <VisualWorldSection plan={plan} onBuildVisualWorld={() => navigate(`/long-form/project/${projectId}/visual-world`)} />

      <div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-5">
        <button type="button" onClick={handleRegenerate} disabled={regenerating} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/45 hover:text-white disabled:opacity-40">
          <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate Storyboard"}
        </button>
      </div>

      <LongFormActionFooter secondaryLabel="Back to Script" onSecondary={() => navigate(`/long-form/project/${projectId}/script`)} primaryLabel="Build Visual World →" onPrimary={() => navigate(`/long-form/project/${projectId}/visual-world`)} />

      {showStoryboard && <StoryboardModal plan={plan} scriptDocument={scriptDocument} onClose={() => setShowStoryboard(false)} />}
    </div>
  );
}
