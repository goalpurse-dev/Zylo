import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Car, Compass, ImageOff, MapPin, RotateCw, Sparkles, TriangleAlert, X } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject } from "./project";
import { fetchLatestVisualWorldForVisualPlan, fetchReferenceAssets, startVisualWorld } from "./visualWorld";
import { LongFormActionFooter, LongFormCreationHeader } from "./shared";
import GenerationExperience from "./GenerationExperience";

const POLL_INTERVAL_MS = 3000;

const STAGE_ORDER = ["planning", "generating", "finalizing"];
const STAGE_LABELS = { planning: "Planning references", generating: "Creating your references", finalizing: "Preparing your Visual Bible" };
const STAGE_MICRO_COPY = {
  planning: "Deciding exactly which people, places, and objects need a canonical reference.",
  generating: "Rendering each canonical reference in Zyvo's illustrated style.",
  finalizing: "Assembling your Visual World board.",
};

const CATEGORY_ORDER = ["CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE"];
const CATEGORY_SECTION_LABEL = { CHARACTER: "Characters", LOCATION: "Locations", IMPORTANT_OBJECT: "Important Objects", VEHICLE_MACHINE: "Vehicles / Machines" };
const CATEGORY_ICON = { CHARACTER: Sparkles, LOCATION: Compass, IMPORTANT_OBJECT: MapPin, VEHICLE_MACHINE: Car };

function ReferenceImage({ url, angle }) {
  if (!url) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.03] text-white/25">
        <ImageOff className="h-5 w-5" strokeWidth={1.6} />
        <span className="text-[9.5px] font-medium">Not ready</span>
      </div>
    );
  }
  return (
    <div className="group relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
      <img src={url} alt={angle} className="h-full w-full object-cover" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[9.5px] font-medium text-white/80">{angle.replace(/_/g, " ")}</span>
    </div>
  );
}

// The programmatic reference board (Part 12) — composed entirely from real
// stored images via HTML/CSS. Never a separate generated image; the light
// reference-sheet canvas + view labels are rendered here, not baked into
// any image.
function ReferenceBoard({ boardMeta }) {
  const sections = boardMeta?.sections ?? [];
  if (!sections.length) return null;

  const byCategory = new Map();
  for (const section of sections) {
    if (!byCategory.has(section.category)) byCategory.set(section.category, []);
    byCategory.get(section.category).push(section);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#f6f4ef] p-4 sm:p-6">
      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat, catIdx) => (
        <div key={cat} className={catIdx > 0 ? "mt-5 border-t border-black/[0.08] pt-5" : ""}>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-black/40">{CATEGORY_SECTION_LABEL[cat]}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {byCategory.get(cat).map((entity) => (
              <div key={entity.entityId}>
                <p className="mb-1.5 truncate text-[12px] font-bold text-black/75">{entity.entityName}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {entity.views.map((v) => (
                    <ReferenceImage key={v.assetId} url={v.url} angle={v.angle} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReferencesModal({ referencePlan, assets, onClose }) {
  const assetsByEntity = new Map();
  for (const a of assets) {
    if (!assetsByEntity.has(a.entity_id)) assetsByEntity.set(a.entity_id, []);
    assetsByEntity.get(a.entity_id).push(a);
  }

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-[#101213] sm:h-[85vh] sm:max-w-[820px] sm:rounded-2xl sm:border sm:border-white/[0.09]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-[16px] font-bold text-white">All References</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {(referencePlan?.entities ?? []).map((entity) => {
            const entityAssets = assetsByEntity.get(entity.entityId) ?? [];
            if (!entityAssets.length) return null;
            return (
              <div key={entity.entityId} className="mb-6">
                <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">{entity.entityName}</p>
                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                  {entityAssets.map((a) => (
                    <div key={a.id}>
                      <ReferenceImage url={a.result_url} angle={a.angle_or_view} />
                      {a.status === "failed" && <p className="mt-1 text-[10px] font-medium text-amber-300">Couldn't generate</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VisualWorldLoadingState({ stage, assets, failed, onRetry, startedAt }) {
  if (stage === "generating" && assets.length > 0) {
    const done = assets.filter((a) => a.status === "succeeded" || a.status === "failed").length;
    const current = assets.find((a) => a.status === "running" || a.status === "pending");
    return (
      <GenerationExperience
        variant="visualPlan"
        heading="Building your visual world…"
        microCopy={current ? `Creating ${current.entity_id.replace(/^e_/, "").replace(/_/g, " ")}…` : STAGE_MICRO_COPY.generating}
        stageOrder={STAGE_ORDER}
        stageLabels={{ ...STAGE_LABELS, generating: `${STAGE_LABELS.generating} (${done} of ${assets.length} ready)` }}
        currentStageKey="generating"
        startedAt={startedAt}
        failed={failed}
        failedHeading="We couldn't finish your Visual World right now."
        onRetry={onRetry}
        reassuranceNote="You can leave this page. Zyvo will keep building your visual world in the background."
      />
    );
  }
  return (
    <GenerationExperience
      variant="visualPlan"
      heading="Building your visual world…"
      microCopy={STAGE_MICRO_COPY[stage] ?? STAGE_MICRO_COPY.planning}
      stageOrder={STAGE_ORDER}
      stageLabels={STAGE_LABELS}
      currentStageKey={stage ?? "planning"}
      startedAt={startedAt}
      failed={failed}
      failedHeading="We couldn't finish your Visual World right now."
      onRetry={onRetry}
      reassuranceNote="You can leave this page. Zyvo will keep building your visual world in the background."
    />
  );
}

export default function LongFormVisualWorld() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [visualWorld, setVisualWorld] = useState(null);
  const [assets, setAssets] = useState([]);
  const [phase, setPhase] = useState("loading"); // loading | generating | ready | failed | needs-plan
  const [showModal, setShowModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const startInFlightRef = useRef(false);
  const pollTimerRef = useRef(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    document.title = "Visual World | Zyvo";
    return () => {
      cancelledRef.current = true;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  const pollForCompletion = async (visualWorldId) => {
    if (cancelledRef.current) return;
    const { data: row } = await supabase.from("long_form_visual_world_versions").select("*").eq("id", visualWorldId).maybeSingle();
    if (cancelledRef.current || !row) return;

    if (row.status === "planning" || row.status === "generating") {
      setVisualWorld(row);
      if (row.stage === "generating") setAssets(await fetchReferenceAssets(visualWorldId));
      setPhase("generating");
      pollTimerRef.current = setTimeout(() => pollForCompletion(visualWorldId), POLL_INTERVAL_MS);
      return;
    }
    if (row.status === "failed") {
      setVisualWorld(row);
      setPhase("failed");
      return;
    }
    // ready | needs_attention
    setVisualWorld(row);
    setAssets(await fetchReferenceAssets(visualWorldId));
    setPhase("ready");
  };

  const startAndWatch = async (regenerate = false) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setPhase("generating");
    const result = await startVisualWorld(projectId, { regenerate });
    startInFlightRef.current = false;
    setRegenerating(false);
    if (!result.ok) {
      setPhase("failed");
      return;
    }
    setProject(result.project);
    pollForCompletion(result.visualWorld.id);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const row = await fetchLongFormProject(projectId);
      if (!row) return;
      setProject(row);
      if (!row.current_visual_plan_version_id) {
        setPhase("needs-plan");
        return;
      }
      const { data: visualPlanRow } = await supabase.from("long_form_visual_plan_versions").select("id, status").eq("id", row.current_visual_plan_version_id).maybeSingle();
      if (!visualPlanRow || visualPlanRow.status !== "ready") {
        setPhase("needs-plan");
        return;
      }

      const existing = await fetchLatestVisualWorldForVisualPlan(projectId, visualPlanRow.id);
      if (existing) {
        if (existing.status === "planning" || existing.status === "generating") {
          setVisualWorld(existing);
          if (existing.stage === "generating") setAssets(await fetchReferenceAssets(existing.id));
          setPhase("generating");
          pollForCompletion(existing.id);
          return;
        }
        if (existing.status === "failed") {
          setVisualWorld(existing);
          setPhase("failed");
          return;
        }
        setVisualWorld(existing);
        setAssets(await fetchReferenceAssets(existing.id));
        setPhase("ready");
        return;
      }
      startAndWatch(false);
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (phase === "needs-plan") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <p className="text-[15px] font-semibold text-white">This project needs a finished storyboard before Visual World can begin.</p>
        <button type="button" onClick={() => navigate(`/long-form/project/${projectId}/look`)} className="mt-4 text-[13px] font-semibold text-lime-300">
          Go to Look
        </button>
      </div>
    );
  }

  if (phase === "loading") return null;

  if (phase === "generating" || phase === "failed") {
    return (
      <div className="mx-auto flex h-full w-full max-w-[760px] flex-col overflow-hidden px-4 lg:px-8">
        <div className="shrink-0">
          <LongFormCreationHeader current="look" />
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden">
          <VisualWorldLoadingState stage={visualWorld?.stage} assets={assets} failed={phase === "failed"} onRetry={() => startAndWatch(false)} startedAt={visualWorld?.created_at} />
        </div>
      </div>
    );
  }

  const needsAttention = visualWorld?.status === "needs_attention";

  return (
    <div className="mx-auto max-w-[820px] px-4 py-8 pb-28 lg:px-8 lg:py-10">
      <LongFormCreationHeader current="look" />

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="mb-7">
        <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[28px]">Your Visual World</h1>
        <p className="mt-1.5 text-[14px] text-white/45">Zyvo built reusable references for the people, places and objects that appear throughout your video.</p>
      </motion.div>

      {needsAttention && (
        <div className="mb-5 flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
          <p className="text-[13px] font-medium text-amber-200">A few references couldn't be generated. The ones that matter most are ready — you can regenerate the rest, or continue as-is.</p>
        </div>
      )}

      <ReferenceBoard boardMeta={visualWorld?.reference_board_meta} />

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setShowModal(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lime-300 hover:text-lime-200">
          View References →
        </button>
        <button
          type="button"
          onClick={() => {
            setRegenerating(true);
            startAndWatch(true);
          }}
          disabled={regenerating}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-white/45 hover:text-white disabled:opacity-40"
        >
          <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
          {regenerating ? "Regenerating…" : "Regenerate Visual World"}
        </button>
      </div>

      {showModal && <ReferencesModal referencePlan={visualWorld?.reference_plan} assets={assets} onClose={() => setShowModal(false)} />}

      {/* Scene generation is a later milestone — the primary action here is
          intentionally disabled rather than a dead-end "Continue" click. */}
      <LongFormActionFooter
        secondaryLabel="Back to Look"
        onSecondary={() => navigate(`/long-form/project/${projectId}/look`)}
        primaryLabel="Scene Generation (Coming Soon)"
        onPrimary={() => {}}
        primaryDisabled
      />
    </div>
  );
}
