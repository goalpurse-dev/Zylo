import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Car, Check, ChevronDown, Compass, ImageOff, MapPin, RotateCw, Sparkles, TriangleAlert, X } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { fetchLongFormProject } from "./project";
import { fetchLatestVisualWorldForVisualPlan, fetchReferenceAssets, regenerateReferenceAsset, startVisualWorld } from "./visualWorld";
import { planReferenceViews, VISUAL_WORLD_MODELS, VISUAL_WORLD_STYLES } from "./visualWorldPlanning";
import { LongFormCreationHeader } from "./shared";

const POLL_INTERVAL_MS = 3000;
const CATEGORY_ORDER = ["CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE"];
const CATEGORY_SECTION_LABEL = { CHARACTER: "Characters", LOCATION: "Locations", IMPORTANT_OBJECT: "Important Objects", VEHICLE_MACHINE: "Vehicles / Machines" };
const CATEGORY_ICON = { CHARACTER: Sparkles, LOCATION: Compass, IMPORTANT_OBJECT: MapPin, VEHICLE_MACHINE: Car };
const IMPORTANCE_LABEL = { HERO: "Hero Character", RECURRING: "Recurring", INCIDENTAL: "Incidental" };

function viewKey(entityId, angle) {
  return `${entityId}:${angle}`;
}

/* ============================ Left panel — controls ============================ */

function SectionLabel({ children }) {
  return <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/30">{children}</p>;
}

function StyleSelector({ styleKey }) {
  const [open, setOpen] = useState(false);
  const style = VISUAL_WORLD_STYLES[styleKey];
  return (
    <div className="relative mb-5">
      <SectionLabel>Style</SectionLabel>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/[0.15]"
      >
        <span className="text-[13px] font-semibold text-white">{style.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/35 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#17191a] shadow-xl">
          <div className="flex items-center justify-between px-3.5 py-2.5">
            <span className="text-[13px] font-semibold text-white">{style.label}</span>
            <Check className="h-3.5 w-3.5 text-lime-300" />
          </div>
          <div className="border-t border-white/[0.06] px-3.5 py-2.5 text-[11.5px] text-white/30">More styles coming soon</div>
        </div>
      )}
    </div>
  );
}

function ModelSelector({ modelKey, onChange }) {
  const [open, setOpen] = useState(false);
  const model = VISUAL_WORLD_MODELS[modelKey];
  return (
    <div className="relative mb-5">
      <SectionLabel>Model</SectionLabel>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/[0.15]"
      >
        <span>
          <span className="block text-[13px] font-semibold text-white">{model.label}</span>
          <span className="block text-[11px] text-white/35">{model.helper}</span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/35 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-xl border border-white/[0.09] bg-[#17191a] shadow-xl">
          {Object.values(VISUAL_WORLD_MODELS).map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!m.available}
              onClick={() => {
                onChange(m.key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3.5 py-2.5 text-left transition ${m.available ? "hover:bg-white/[0.05]" : "cursor-not-allowed opacity-40"} ${m.key !== "director" ? "border-b border-white/[0.06]" : ""}`}
            >
              <span>
                <span className="block text-[13px] font-semibold text-white">{m.label}</span>
                <span className="block text-[11px] text-white/35">{m.helper}</span>
              </span>
              {m.key === modelKey && <Check className="h-3.5 w-3.5 shrink-0 text-lime-300" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EntityChecklistRow({ entity, excludedViews, onToggleView }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = CATEGORY_ICON[entity.entityCategory] ?? Sparkles;
  const selectedCount = entity.requiredViews.filter((v) => !excludedViews.has(viewKey(entity.entityId, v.angle))).length;

  return (
    <div className="mb-2 rounded-xl border border-white/[0.07] bg-white/[0.02]">
      <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <Icon className="h-3.5 w-3.5 shrink-0 text-white/40" strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-white">{entity.entityName}</span>
        <span className="shrink-0 text-[11px] font-medium text-white/35">
          {selectedCount} of {entity.requiredViews.length}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-white/30 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && (
        <div className="space-y-1 border-t border-white/[0.06] px-3 py-2">
          {entity.requiredViews.map((v) => {
            const key = viewKey(entity.entityId, v.angle);
            const checked = !excludedViews.has(key);
            return (
              <label key={key} className="flex cursor-pointer items-center gap-2 py-0.5 text-[12px] text-white/60">
                <input type="checkbox" checked={checked} onChange={() => onToggleView(key)} className="h-3.5 w-3.5 rounded border-white/20 bg-transparent accent-lime-300" />
                {v.angle.replace(/_/g, " ")}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ControlsPanel({ styleKey, modelKey, onModelChange, plannedEntities, excludedViews, onToggleView, ctaLabel, ctaDisabled, ctaLoading, onGenerate }) {
  const byCategory = new Map();
  for (const e of plannedEntities) {
    if (!byCategory.has(e.entityCategory)) byCategory.set(e.entityCategory, []);
    byCategory.get(e.entityCategory).push(e);
  }
  const totalSelected = plannedEntities.reduce((sum, e) => sum + e.requiredViews.filter((v) => !excludedViews.has(viewKey(e.entityId, v.angle))).length, 0);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden lg:w-[340px] lg:shrink-0 lg:border-r lg:border-white/[0.06]">
      <div className="flex-1 overflow-y-auto px-4 py-4 lg:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lime-300/70">Visual World</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-white/45">Create consistent references for the people, places and objects in your video.</p>

        <div className="mt-5">
          <StyleSelector styleKey={styleKey} />
          <ModelSelector modelKey={modelKey} onChange={onModelChange} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel>References to Create</SectionLabel>
            <span className="text-[11px] font-medium text-white/30">{totalSelected} selected</span>
          </div>
          {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
            <div key={cat} className="mb-3">
              <p className="mb-1.5 px-0.5 text-[11px] font-semibold text-white/40">{CATEGORY_SECTION_LABEL[cat]}</p>
              {byCategory.get(cat).map((entity) => (
                <EntityChecklistRow key={entity.entityId} entity={entity} excludedViews={excludedViews} onToggleView={onToggleView} />
              ))}
            </div>
          ))}
          {plannedEntities.length === 0 && <p className="text-[12.5px] text-white/30">No recurring people, places, or objects need a canonical reference for this video.</p>}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] p-4">
        <button
          type="button"
          onClick={onGenerate}
          disabled={ctaDisabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3 text-[13.5px] font-semibold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ctaLoading && <RotateCw className="h-4 w-4 animate-spin" />}
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

/* ============================ Right panel — results ============================ */

function ReferenceImage({ url, angle, status, onClick }) {
  if (status === "running" || status === "pending") {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-white/[0.08] bg-white/[0.04]">
        <div className="h-4 w-4 animate-pulse rounded-full bg-white/15" />
        <span className="text-[9.5px] font-medium text-white/30">{status === "running" ? "Creating…" : "Queued"}</span>
      </div>
    );
  }
  if (status === "failed" || !url) {
    return (
      <div className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] text-amber-300/70">
        <ImageOff className="h-5 w-5" strokeWidth={1.6} />
        <span className="text-[9.5px] font-medium">Couldn't generate</span>
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} className="group relative aspect-square w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] text-left">
      <img src={url} alt={angle} className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[9.5px] font-medium text-white/80">{angle.replace(/_/g, " ")}</span>
    </button>
  );
}

// The programmatic reference board (Part 12/16) — composed entirely from
// real stored images via HTML/CSS. Never a separate generated image.
function ReferenceBoard({ boardMeta, onOpenAsset }) {
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
                    <div key={v.assetId} className="cursor-pointer" onClick={() => onOpenAsset?.(v.assetId)}>
                      <ReferenceImage url={v.url} angle={v.angle} status="succeeded" />
                    </div>
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

function AssetModal({ asset, entityName, styleLabel, modelLabel, onClose, onRegenerate, regenerating }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101213]" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
          <h2 className="text-[14.5px] font-bold text-white">{entityName}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:bg-white/[0.06] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">
          <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]">
            {asset.result_url ? <img src={asset.result_url} alt={asset.angle_or_view} className="w-full" /> : <div className="flex aspect-square items-center justify-center text-white/25">No image</div>}
          </div>
          <dl className="mt-4 space-y-1.5 text-[12.5px]">
            <div className="flex justify-between"><dt className="text-white/35">View</dt><dd className="font-medium text-white/75">{asset.angle_or_view.replace(/_/g, " ")}</dd></div>
            <div className="flex justify-between"><dt className="text-white/35">Style</dt><dd className="font-medium text-white/75">{styleLabel}</dd></div>
            <div className="flex justify-between"><dt className="text-white/35">Model</dt><dd className="font-medium text-white/75">{modelLabel}</dd></div>
          </dl>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-[12.5px] font-semibold text-white transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${regenerating ? "animate-spin" : ""}`} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PlannedStatePreview({ plannedEntities }) {
  const byCategory = new Map();
  for (const e of plannedEntities) {
    if (!byCategory.has(e.entityCategory)) byCategory.set(e.entityCategory, []);
    byCategory.get(e.entityCategory).push(e);
  }
  return (
    <>
      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
        <div key={cat} className="mb-5">
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">{CATEGORY_SECTION_LABEL[cat]}</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {byCategory.get(cat).map((e) => {
              const Icon = CATEGORY_ICON[e.entityCategory] ?? Sparkles;
              return (
                <div key={e.entityId} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-center">
                  <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/45">
                    <Icon className="h-4.5 w-4.5" strokeWidth={1.6} />
                  </div>
                  <p className="truncate text-[12.5px] font-semibold text-white">{e.entityName}</p>
                  <p className="text-[10.5px] text-white/35">{IMPORTANCE_LABEL[e.importance] ?? e.importance}</p>
                  <p className="mt-1 text-[10px] text-white/25">{e.requiredViews.length} reference{e.requiredViews.length === 1 ? "" : "s"} planned</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

function AllReferencesGrid({ assets, entityNames, onOpenAsset }) {
  const byCategory = new Map();
  for (const a of assets) {
    const cat = a.reference_type === "character_reference" ? "CHARACTER" : a.reference_type === "location_reference" ? "LOCATION" : "IMPORTANT_OBJECT";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(a);
  }
  return (
    <div className="mt-7">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">All References</p>
      {CATEGORY_ORDER.filter((cat) => byCategory.has(cat)).map((cat) => (
        <div key={cat} className="mb-5">
          <p className="mb-2.5 text-[11px] font-semibold text-white/40">{CATEGORY_SECTION_LABEL[cat]}</p>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {byCategory.get(cat).map((a) => (
              <div key={a.id}>
                <ReferenceImage url={a.result_url} angle={a.angle_or_view} status={a.status} onClick={() => onOpenAsset(a)} />
                <p className="mt-1 truncate text-[10.5px] font-medium text-white/50">{entityNames.get(a.entity_id) ?? a.entity_id}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ Page ============================ */

export default function LongFormVisualWorld() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [visualPlan, setVisualPlan] = useState(null);
  const [visualWorld, setVisualWorld] = useState(null);
  const [assets, setAssets] = useState([]);
  const [phase, setPhase] = useState("loading"); // loading | needs-plan | idle | generating | ready | failed
  const [mobileTab, setMobileTab] = useState("controls");
  const [modelKey, setModelKey] = useState("fast");
  const [excludedViews, setExcludedViews] = useState(() => new Set());
  const [openAssetId, setOpenAssetId] = useState(null);
  const [regeneratingAssetId, setRegeneratingAssetId] = useState(null);
  const [starting, setStarting] = useState(false);
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
      setMobileTab("results");
      pollTimerRef.current = setTimeout(() => pollForCompletion(visualWorldId), POLL_INTERVAL_MS);
      return;
    }
    if (row.status === "failed") {
      setVisualWorld(row);
      setPhase("failed");
      return;
    }
    setVisualWorld(row);
    setAssets(await fetchReferenceAssets(visualWorldId));
    setPhase("ready");
  };

  const startAndWatch = async (regenerate = false) => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    setStarting(true);
    setPhase("generating");
    setMobileTab("results");
    const model = VISUAL_WORLD_MODELS[modelKey];
    const result = await startVisualWorld(projectId, { regenerate, rendererToolKey: model.toolKey, styleKey: "zyvo_illustrated_documentary", excludedViews: Array.from(excludedViews) });
    startInFlightRef.current = false;
    setStarting(false);
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
      const { data: visualPlanRow } = await supabase.from("long_form_visual_plan_versions").select("*").eq("id", row.current_visual_plan_version_id).maybeSingle();
      if (!visualPlanRow || visualPlanRow.status !== "ready") {
        setPhase("needs-plan");
        return;
      }
      setVisualPlan(visualPlanRow);

      const existing = await fetchLatestVisualWorldForVisualPlan(projectId, visualPlanRow.id);
      if (existing) {
        if (existing.status === "planning" || existing.status === "generating") {
          setVisualWorld(existing);
          if (existing.stage === "generating") setAssets(await fetchReferenceAssets(existing.id));
          setPhase("generating");
          setMobileTab("results");
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
      // Nothing started yet — land on the planned-state review, never
      // auto-start (Part 9/29: the user reviews the real deterministic
      // plan and explicitly clicks Generate).
      setPhase("idle");
    };
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (phase === "loading") return null;

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

  const plannedEntities = visualPlan ? planReferenceViews(visualPlan.entity_registry, visualPlan.continuity_groups) : [];
  const entityNames = new Map(plannedEntities.map((e) => [e.entityId, e.entityName]));
  const toggleView = (key) => {
    setExcludedViews((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalPlanned = plannedEntities.reduce((sum, e) => sum + e.requiredViews.length, 0);
  const totalReady = assets.filter((a) => a.status === "succeeded" || a.status === "failed").length;

  let ctaLabel = "Build Visual World →";
  let ctaDisabled = totalPlanned === 0 || starting;
  if (phase === "generating") {
    ctaLabel = "Creating References…";
    ctaDisabled = true;
  } else if (phase === "ready" && visualWorld?.status === "needs_attention") {
    ctaLabel = "Generate Remaining →";
  } else if (phase === "ready") {
    ctaLabel = "Continue →";
    ctaDisabled = true; // scene generation is a later milestone — see the disabled footer note below
  } else if (phase === "failed") {
    ctaLabel = "Try Again";
  }

  const openAsset = assets.find((a) => a.id === openAssetId) ?? null;

  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 lg:px-8">
        <LongFormCreationHeader current="look" />
      </div>

      {/* Mobile tab switcher */}
      <div className="flex shrink-0 gap-1 border-b border-white/[0.06] px-4 pt-3 lg:hidden">
        {["controls", "results"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`rounded-t-lg px-3.5 py-2 text-[12.5px] font-semibold ${mobileTab === tab ? "bg-white/[0.06] text-white" : "text-white/40"}`}
          >
            {tab === "controls" ? "Controls" : "Results"}
          </button>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className={`${mobileTab === "controls" ? "flex" : "hidden"} min-h-0 w-full lg:flex`}>
          <ControlsPanel
            styleKey="zyvo_illustrated_documentary"
            modelKey={modelKey}
            onModelChange={setModelKey}
            plannedEntities={plannedEntities}
            excludedViews={excludedViews}
            onToggleView={toggleView}
            ctaLabel={ctaLabel}
            ctaDisabled={ctaDisabled}
            ctaLoading={starting || phase === "generating"}
            onGenerate={() => startAndWatch(phase === "ready" || phase === "failed")}
          />
        </div>

        <div className={`${mobileTab === "results" ? "flex" : "hidden"} min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-5 lg:flex lg:px-8`}>
          {phase === "idle" && (
            <>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white lg:text-[24px]">Your Visual World</h1>
              <p className="mt-1.5 text-[13.5px] text-white/45">Reusable references keep every scene visually consistent.</p>
              <div className="mt-6">
                <PlannedStatePreview plannedEntities={plannedEntities} />
              </div>
            </>
          )}

          {(phase === "generating" || phase === "failed") && (
            <>
              <div className="mb-5 flex items-center justify-between">
                <h1 className="text-[20px] font-bold text-white">{phase === "failed" ? "We couldn't finish your Visual World" : "Building your Visual World…"}</h1>
                {phase === "generating" && assets.length > 0 && <span className="shrink-0 text-[12px] font-medium text-white/40">{totalReady} of {assets.length} references ready</span>}
              </div>
              {phase === "failed" && (
                <p className="mb-4 flex items-center gap-2 text-[13px] text-amber-200">
                  <TriangleAlert className="h-4 w-4 shrink-0" />
                  {visualWorld?.last_error_code ? "Please try again." : "Something went wrong."}
                </p>
              )}
              <p className="mb-5 text-[12.5px] text-white/35">You can leave this page. Zyvo will keep building your visual world in the background.</p>
              {CATEGORY_ORDER.map((cat) => {
                const catEntities = plannedEntities.filter((e) => e.entityCategory === cat);
                if (!catEntities.length) return null;
                return (
                  <div key={cat} className="mb-6">
                    <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">{CATEGORY_SECTION_LABEL[cat]}</p>
                    {catEntities.map((e) => {
                      const entityAssets = assets.filter((a) => a.entity_id === e.entityId);
                      if (!entityAssets.length) return null;
                      return (
                        <div key={e.entityId} className="mb-3">
                          <p className="mb-1.5 text-[12px] font-semibold text-white/70">{e.entityName}</p>
                          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                            {entityAssets.map((a) => (
                              <ReferenceImage key={a.id} url={a.result_url} angle={a.angle_or_view} status={a.status} onClick={() => setOpenAssetId(a.id)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}

          {phase === "ready" && (
            <>
              <h1 className="text-[22px] font-bold tracking-[-0.02em] text-white lg:text-[24px]">Your Visual World</h1>
              <p className="mt-1.5 text-[13.5px] text-white/45">Zyvo built reusable references for the people, places and objects that appear throughout your video.</p>

              {visualWorld?.status === "needs_attention" && (
                <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" />
                  <p className="text-[13px] font-medium text-amber-200">A few references couldn't be generated. Click any of them below to regenerate just that one.</p>
                </div>
              )}

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Reference Board</p>
                <ReferenceBoard boardMeta={visualWorld?.reference_board_meta} onOpenAsset={setOpenAssetId} />
              </div>

              <AllReferencesGrid assets={assets} entityNames={entityNames} onOpenAsset={(a) => setOpenAssetId(a.id)} />
            </>
          )}
        </div>
      </div>

      {openAsset && (
        <AssetModal
          asset={openAsset}
          entityName={entityNames.get(openAsset.entity_id) ?? openAsset.entity_id}
          styleLabel={VISUAL_WORLD_STYLES.zyvo_illustrated_documentary.label}
          modelLabel={VISUAL_WORLD_MODELS[modelKey]?.label ?? "FLUX Base"}
          regenerating={regeneratingAssetId === openAsset.id}
          onClose={() => setOpenAssetId(null)}
          onRegenerate={async () => {
            setRegeneratingAssetId(openAsset.id);
            await regenerateReferenceAsset(openAsset.id);
            setOpenAssetId(null);
            setRegeneratingAssetId(null);
            setPhase("generating");
            setMobileTab("results");
            pollForCompletion(visualWorld.id);
          }}
        />
      )}
    </div>
  );
}
