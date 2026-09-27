import { customerVisualMessage } from "./customerVisualMessage.js";
import { useEffect, useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { ArrowLeft, Car, Check, ChevronDown, Compass, Expand, ImageOff, Leaf, MapPin, Pencil, RotateCw, Sparkles, Sun, X } from "lucide-react";
import LongFormSelect from "./LongFormSelect";
import { LongFormCreationHeader } from "./shared";
import { currentReferenceAssets, selectCurrentVisualWorldAssets, referenceProgress, isVisualWorldReadyForScenes, regeneratingPredecessorFor, resolveDisplayStatus, viewLabel, viewSubtitle, resolveVisualWorldStyleLabel } from "./visualWorldPlanning";

const IDENTITY_ANCHOR_ROLES = new Set(["three_quarter_neutral", "identity_outfit_sheet"]);

// 2026-09-20 "plants aren't characters" / "celestial bodies aren't objects"
// fix — ECOSYSTEM and CELESTIAL are real, persisted entityCategory values
// now (see advance-long-form-visual-world's resolveEffectiveEntityCategory
// reclassification); without their own section here they'd match none of
// these fixed categories and silently vanish from every group in the sidebar.
const CATEGORIES = ["STYLE_REFERENCE", "CHARACTER", "LOCATION", "IMPORTANT_OBJECT", "VEHICLE_MACHINE", "CELESTIAL", "ECOSYSTEM", "DIAGRAM_STYLE_REFERENCE"];
const LABELS = { STYLE_REFERENCE: "Style Anchor", CHARACTER: "Characters", LOCATION: "Locations", IMPORTANT_OBJECT: "Important Objects", VEHICLE_MACHINE: "Vehicles / Machines", CELESTIAL: "Celestial Bodies", ECOSYSTEM: "Environments / Ecosystems", DIAGRAM_STYLE_REFERENCE: "Diagram Style" };
const ROLES = { STYLE_REFERENCE: "Style Anchor", CHARACTER: "Hero Character", LOCATION: "Recurring Location", IMPORTANT_OBJECT: "Important Object", VEHICLE_MACHINE: "Vehicle", CELESTIAL: "Celestial Body", ECOSYSTEM: "Environment", DIAGRAM_STYLE_REFERENCE: "Diagram Style Sheet" };
const entityRole = (entity) => entity.isCoreIdentity ? "Visual Core" : entity.entityCategory === "CHARACTER" && entity.importance !== "HERO" ? "Recurring Character" : ROLES[entity.entityCategory];
const ICONS = { STYLE_REFERENCE: Sparkles, CHARACTER: Sparkles, LOCATION: Compass, IMPORTANT_OBJECT: MapPin, VEHICLE_MACHINE: Car, CELESTIAL: Sun, ECOSYSTEM: Leaf, DIAGRAM_STYLE_REFERENCE: Sparkles };
const displayStatusLabel = (asset, siblingAssets) => {
  const status = resolveDisplayStatus(asset, siblingAssets);
  if (status.key === "failed" && asset.status !== "failed") return "Creating reference...";
  if (["planned", "queued", "waiting_for_identity"].includes(status.key)) return "Queued";
  if (status.key === "starting") return "Starting...";
  if (status.key === "generating") return "Creating reference...";
  if (status.key === "checking") return "Checking consistency...";
  return status.label;
};
// Customer display never uses persisted renderer identifiers, including unknown ones.
const modelLabel = () => "Zyvo visual";

const referenceAspectClass = (format, asset) => {
  const normalized = String(format ?? "").toUpperCase();
  if (normalized.includes("CHARACTER") || normalized.includes("LOCATION") || normalized.includes("STYLE") || normalized.includes("DIAGRAM") || asset?.angle_or_view === "character_reference_sheet" || asset?.angle_or_view === "location_reference_board") return "aspect-[16/9]";
  if (normalized.includes("OBJECT") || asset?.reference_type === "object_reference") return "aspect-[4/3]";
  return "aspect-[16/9]";
};

function ReferenceTile({ asset, name, referenceFormat, siblingAssets = [], regeneratingFrom, onOpen, onRetry, onApproveAnyway, busy }) {
  // 2026-09-19 production incident fix (Task 5 — broken/black preview
  // tiles): result_url being a non-empty STRING never proved the image
  // actually loads — a deleted/corrupt storage object, a bad upload that
  // still recorded a URL, etc. all left the tile rendering a browser-native
  // broken-image icon while every other signal (status, qa_status, the
  // label below) still confidently said "Ready." Tracked per the actual
  // URL (not just mounted once) so a genuinely NEW image at this same tile
  // position — a fresh Regenerate result — always gets its own real chance
  // to load rather than inheriting a stale failure.
  // 2026-09-20 real-incident fix — DB confirmed all assets genuinely
  // succeeded with a real result_url, yet the UI showed "Preview
  // unavailable / Try Again" as if generation had failed. Root cause: the
  // very FIRST <img> load error immediately and permanently flipped this
  // tile to "unavailable" with no retry — a transient network/CDN hiccup on
  // an otherwise-good, already-succeeded asset looked identical to a real
  // generation failure. Now retries a bounded number of times (remounting
  // the <img> via `key`, never mutating the URL itself — safe for signed
  // URLs) before ever declaring the image truly unavailable.
  const MAX_IMAGE_LOAD_RETRIES = 2;
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [failedUrl, setFailedUrl] = useState(null);
  // A queued asset has no URL yet. `null === null` must never turn that
  // normal state into a broken-preview error.
  const imageLoadFailed = Boolean(asset.result_url) && failedUrl === asset.result_url;
  // A genuinely NEW url (a real regenerate result, not a retry of the same
  // one) always gets its own fresh retry budget.
  useEffect(() => { setLoadAttempt(0); }, [asset.result_url]);
  const handleImageError = () => {
    if (loadAttempt < MAX_IMAGE_LOAD_RETRIES) {
      const next = loadAttempt + 1;
      setTimeout(() => setLoadAttempt(next), 500 * next);
    } else {
      setFailedUrl(asset.result_url);
    }
  };
  // Production Ready must mean "provider returned an ACCEPTABLE reference"
  // (Part 7) — a generation that succeeded but failed Character Pack QA is
  // still VIEWABLE (so the user can inspect it and Regenerate/Edit from the
  // modal — Part 13/16: never silently hidden), just never shown as green
  // "Ready" with no distinction from a genuinely approved reference.
  const needsReview = asset.status === "succeeded" && asset.qa_status === "rejected";
  const statusInfo = resolveDisplayStatus(asset, siblingAssets);
  const viewable = Boolean(asset.result_url) && (asset.status === "succeeded" || statusInfo.key === "checking") && !imageLoadFailed;
  const ready = viewable && statusInfo.key === "ready";
  const failed = asset.status === "failed";
  const active = ["pending", "running"].includes(asset.status);
  const intentionallyWaiting = asset.status === "planned" || statusInfo.key === "queued" || statusInfo.key === "waiting_for_identity";
  const stillWorking = active && asset.updated_at && Date.now() - Date.parse(asset.updated_at) > 2 * 60 * 1000;
  // Part 13 (2026-09-13 reliability fix, updated same day for the Kling O3
  // migration): the canonical character sheet is now a landscape 2720x1536
  // (~16:9) image — forcing it into the same aspect-square frame every
  // other role uses meant a lone sheet tile (grid-cols-1 inside an
  // xl:col-span-2 CHARACTER section) stretched to a giant square, with
  // object-contain letterboxing most of it empty. Sizing this tile to match
  // its actual aspect ratio, plus the max-width cap on the container below,
  // is what actually keeps it sane — this alone would still be full-bleed
  // without that container change. object-contain here only affects the
  // small preview tile's CSS box — the <img> still points at the full
  // 2720x1536 result_url, so opening it full-size (onOpen) never loses
  // resolution.
  const regenerating = active && Boolean(regeneratingFrom?.result_url);
  const displayAsset = regenerating ? regeneratingFrom : asset;
  const displayViewable = regenerating || viewable;
  // Part 8 of the 2026-09-14 fix: a specific, human-readable QA reason
  // above the manual-override buttons — never just "Needs review" with no
  // explanation of what to act on.
  const qaReason = customerVisualMessage(asset.qa_result?.reasons?.filter(Boolean).join(" ") || "One required view may be inconsistent.");
  return <div className="min-w-0" id={`reference-tile-${asset.id}`}>
    <button type="button" disabled={!displayViewable} onClick={() => onOpen(displayAsset.id)} aria-label={`Open ${viewLabel(asset.angle_or_view)} reference for ${name}`} className={`group relative flex ${referenceAspectClass(referenceFormat, asset)} w-full items-center justify-center overflow-hidden rounded-xl border ${needsReview ? "border-amber-400/30" : "border-white/[0.08]"} bg-white/[0.035] shadow-[0_1px_0_rgba(255,255,255,0.03)_inset] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0F0D] ${displayViewable ? "cursor-pointer hover:-translate-y-0.5 hover:border-white/25 hover:shadow-lg" : "cursor-default"}`}>
      {displayViewable ? <img key={`${displayAsset.id}-${loadAttempt}`} src={displayAsset.result_url} alt={`${name}, ${viewLabel(asset.angle_or_view)}`} loading="lazy" onError={handleImageError} className={`h-full w-full object-contain transition duration-200 ${regenerating || statusInfo.key === "checking" ? "opacity-70" : "group-hover:scale-[1.02]"}`} /> : <div className={`flex h-full w-full flex-col items-center justify-center gap-3 text-white/25 ${active || intentionallyWaiting ? "bg-[linear-gradient(110deg,transparent_20%,rgba(190,242,100,0.08)_45%,transparent_70%)] bg-[length:220%_100%] motion-safe:animate-pulse" : ""}`}>
        {imageLoadFailed || failed ? <ImageOff className="h-7 w-7 text-amber-600" /> : <Sparkles className={`h-7 w-7 ${active || intentionallyWaiting ? "motion-safe:animate-pulse" : ""}`} strokeWidth={1.2} />}
        <span className="text-xs">{imageLoadFailed ? "Preview unavailable" : displayStatusLabel(asset, siblingAssets)}</span>
        {intentionallyWaiting && <span className="text-[10px] text-white/20">{stillWorking && statusInfo.key === "queued" ? "Waiting for a worker..." : "Waiting to create"}</span>}
        {stillWorking && !intentionallyWaiting && <span className="text-[10px] text-white/20">Still working...</span>}
      </div>}
      {regenerating && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-black/65 py-1.5 text-[11px] font-semibold text-white"><Sparkles className="h-3 w-3 motion-safe:animate-pulse" strokeWidth={1.5} />Generating new version…</span>}
      {displayViewable && !regenerating && <span aria-hidden="true" className="absolute right-2 top-2 rounded-md bg-black/40 p-1.5 text-white/80 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100"><Expand className="h-3.5 w-3.5" /></span>}
    </button>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-1">
      <p className="text-xs font-semibold text-white/75">{viewLabel(asset.angle_or_view)}</p>
      {regenerating ? <span className="flex items-center gap-1 text-[10px] text-lime-300/70"><Sparkles className="h-3 w-3 motion-safe:animate-pulse" />Generating new version…</span>
        : ready ? <span className="flex items-center gap-1 text-[10px] text-lime-300/70"><Check className="h-3 w-3" />Ready</span>
        : needsReview ? <span className="flex items-center gap-1 text-[10px] text-amber-300"><ImageOff className="h-3 w-3" />Needs review</span>
        : statusInfo.key === "checking" ? <span className="flex items-center gap-1 text-[10px] text-sky-200/70"><Sparkles className="h-3 w-3 motion-safe:animate-pulse" />Checking consistency...</span>
        : active ? <span className="flex items-center gap-1 text-[10px] text-white/45"><Sparkles className="h-3 w-3 motion-safe:animate-pulse" />{displayStatusLabel(asset, siblingAssets)}</span>
        : imageLoadFailed ? <span className="flex items-center gap-1 text-[10px] text-amber-300"><ImageOff className="h-3 w-3" />Preview unavailable</span> : null}
      {failed && <button disabled={busy} onClick={() => onRetry(asset.id)} className="rounded px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-300/10 disabled:opacity-40">Try Again</button>}
    </div>
    {/* Part 8A: Approve Anyway / Regenerate directly on the tile — every
        CURRENT needs-review reference must have both, not just inside the
        fullscreen modal. */}
    {needsReview && !regenerating && <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2">
      <p className="text-[10.5px] leading-snug text-amber-200/90">Needs review: {qaReason}</p>
      <div className="mt-2 flex gap-2">
        <button disabled={busy} onClick={() => onApproveAnyway?.(asset.id)} className="flex-1 rounded-lg bg-lime-300 px-2 py-1.5 text-[11px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">Approve Anyway</button>
        <button disabled={busy} onClick={() => onRetry(asset.id)} className="flex-1 rounded-lg border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Regenerate</button>
      </div>
    </div>}
    {asset.reference_type === "character_reference" && viewSubtitle(asset.angle_or_view) && <p className="mt-1 text-[10px] text-white/35">{viewSubtitle(asset.angle_or_view)}</p>}
  </div>;
}

// Part 5/6 of the 2026-09-14 fix: a truthful, compact replacement for the
// old single "Model" dropdown. Static/informational only — there is no live
// per-world model choice anymore (each reference TYPE's renderer is fixed
// by role, see referenceRendererPolicy.js), so this is deliberately not a
// <select>. If a real V2/V3/V4 tier selector is ever built, this component
// is the natural place for it to live.
function GenerationModelsPanel() {
  const [expanded, setExpanded] = useState(false);
  // 2026-09-19 "hide provider/model names" V1 fix: Kling/FLUX/Qwen are
  // Zyvo internal implementation detail (see referenceRendererPolicy.js)
  // and must never reach the user-facing label here — only the internal
  // per-role split this panel was truthfully built to communicate.
  const rows = [
    { label: "Characters", model: "Zyvo Character Renderer" },
    { label: "World references", model: "Zyvo Reference Renderer" },
    { label: "Edits", model: "Zyvo Precision Editor" },
  ];
  return <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex w-full items-center justify-between px-3 py-3 text-left">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/50">Generation Models</span>
      <ChevronDown className={`h-3.5 w-3.5 text-white/35 ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <div className="space-y-1.5 border-t border-white/[0.06] px-3 py-3">
      {rows.map((r) => <div key={r.label} className="flex items-center justify-between gap-3 text-xs"><span className="text-white/45">{r.label}</span><span className="font-medium text-white/75">{r.model}</span></div>)}
    </div>}
  </div>;
}

function EntityControl({ entity, excluded, onToggle, locked }) {
  const [expanded, setExpanded] = useState(false);
  const selected = entity.requiredViews.filter((v) => !excluded.has(`${entity.entityId}:${v.angle}`)).length;
  return <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025]">
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2.5 px-3 py-3 text-left">
      <Check className={`h-3.5 w-3.5 ${selected ? "text-lime-300" : "text-white/20"}`} />
      <span className="min-w-0 flex-1 text-[13px] font-semibold text-white/85">{entity.entityName}</span>
      <span className="text-[11px] text-white/40">{selected} reference{selected === 1 ? "" : "s"}</span>
      <ChevronDown className={`h-3.5 w-3.5 text-white/35 ${expanded ? "rotate-180" : ""}`} />
    </button>
    {expanded && <div className="space-y-2 border-t border-white/[0.06] px-3 py-3">{entity.requiredViews.map((view) => {
      const key = `${entity.entityId}:${view.angle}`;
      return <label key={key} className="flex items-center gap-2 text-xs text-white/60"><input type="checkbox" disabled={locked} checked={!excluded.has(key)} onChange={() => onToggle(key)} className="accent-lime-300" />{viewLabel(view.angle)}</label>;
    })}</div>}
  </div>;
}

// 2026-09-20 "Rebuild Visual World" fix — mirrors GenerateWorkspace's own
// RebuildEpisodeModal shape/pattern (Dialog/DialogBackdrop/DialogPanel,
// same Cancel + primary-action layout), copy per the exact product spec.
function RebuildVisualWorldModal({ open, onClose, onConfirm, busy, error }) {
  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101213] p-5">
          <DialogTitle className="text-lg font-semibold text-white">Rebuild Visual World?</DialogTitle>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">
            Zyvo will create a fresh set of references using your current storyboard and visual style. Your existing Visual World will stay available until the new one is ready.
          </p>
          {error && <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-2.5 text-[11.5px] text-red-200">{customerVisualMessage(error)}</div>}
          <div className="mt-5 flex gap-2">
            <button disabled={busy} onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/5 disabled:opacity-40">Cancel</button>
            <button disabled={busy} onClick={onConfirm} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2.5 text-[13px] font-bold text-[#11150D] disabled:opacity-40">
              {busy ? "Starting rebuild..." : "Rebuild Visual World"}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default function VisualWorldWorkspace({ project, entities = [], assets = [], visualWorld, excludedViews = new Set(), onToggleView, onBuild, onRebuild, onRetry, onEdit, onApproveIdentity, onApproveAnyway, onUseVersion, onContinueToScenes, onBackToStoryboard, onUpdateVisualWorld, rebuilding = false, rebuildStarting = false, reviewingRebuild = false, onAdoptRebuild, onKeepCurrent, resumeState, compatibility = null, reconciling = false, busy = false, error, loading = false, readOnly = false }) {
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [mobileControls, setMobileControls] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");
  const displayedAssets = rebuildStarting ? [] : assets;
  const current = currentReferenceAssets(displayedAssets);
  // Part 14: the exact same requiredViews-scoped set Reference Board's own
  // slots() already implicitly shows — see the "All References" section
  // below, which used to filter raw `current` with no requiredViews check
  // at all and therefore leaked retired-taxonomy rows (old Face/Profile/3-4
  // sheets) that Reference Board correctly hid.
  const currentScoped = selectCurrentVisualWorldAssets(entities, displayedAssets);
  const progress = referenceProgress(displayedAssets, entities);
  const started = Boolean(visualWorld) || rebuildStarting;
  const rebuildInProgress = rebuildStarting || rebuilding;
  const active = busy || rebuildInProgress || ["planning", "generating"].includes(visualWorld?.status) || progress.active > 0;
  const selected = entities.reduce((n, entity) => n + entity.requiredViews.filter((view) => !excludedViews.has(`${entity.entityId}:${view.angle}`)).length, 0);
  // 2026-09-19 forensic fix, Part 2's hard invariant: current VisualPlan +
  // current Visual World + required canonical references must be mutually
  // compatible before Scenes proceeds — a Visual World that is otherwise
  // fully "ready" (every reference it was ORIGINALLY built for exists) must
  // still never let the user continue when it doesn't yet cover a NEWLY
  // replanned VisualPlan's own required references. `compatibility` is
  // only ever non-null when the current world was built for a genuinely
  // different plan version than the one now current (see visualWorld.jsx).
  const planCompatibilityBlocking = compatibility !== null && !compatibility.compatible;
  // 2026-09-19 production incident fix, item 5: a failed reconciliation has
  // its own dedicated "Try Again" action in the banner below (which calls
  // onUpdateVisualWorld, the correct — idempotent, same-version — retry).
  // The sidebar's normal CTA must never ALSO offer "Build Visual World →"
  // here, which would call onBuild instead — a completely different, full
  // FRESH-BUILD action that has nothing to do with retrying a stuck
  // reconciliation and was never what the user actually wants in this state.
  const reconciliationFailed = visualWorld?.status === "failed" && Boolean(visualWorld?.parent_visual_world_version_id);
  const complete = started && !reviewingRebuild && !active && !progress.failed && !planCompatibilityBlocking && !reconciliationFailed && isVisualWorldReadyForScenes(progress);
  // Part 9 of the 2026-09-14 fix: the user must not be able to proceed past
  // Visual World while any CURRENT required reference is still Needs
  // Review — `complete` above already excludes this case (progress.ready
  // never counts a needs-review row), but the CTA used to fall through to
  // the generic "Build Visual World →" label with no explanation and no
  // disabled state, which is actively misleading once a world already
  // exists. needsReviewBlocking names that specific case so the CTA and its
  // helper text can say why, not just silently do the wrong thing.
  const needsReviewBlocking = started && !active && progress.needsReview > 0;
  const styleLabel = resolveVisualWorldStyleLabel(project, visualWorld);
  const openAsset = assets.find((asset) => asset.id === openId);
  const openEntity = entities.find((entity) => entity.entityId === openAsset?.entity_id);
  const currentOpenSlotAsset = current.find((asset) => asset.entity_id === openAsset?.entity_id && asset.angle_or_view === openAsset?.angle_or_view);
  const isHistoricalSelection = Boolean(openAsset && currentOpenSlotAsset && openAsset.id !== currentOpenSlotAsset.id);
  const history = assets.filter((asset) => asset.entity_id === openAsset?.entity_id && asset.angle_or_view === openAsset?.angle_or_view && asset.status === "succeeded" && asset.result_url && (asset.generation_type !== "deterministic_crop" || asset.qa_expectations?.reviewStatus === "approved")).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  const jumpToNeedsReview = () => {
    const first = currentScoped.find((a) => a.status === "succeeded" && a.qa_status === "rejected");
    if (first) document.getElementById(`reference-tile-${first.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  // Part 4 of the 2026-09-14 "FINAL VISUAL WORLD POLISH" fix: the final CTA
  // must always say exactly where it goes, and must actually BE enabled
  // once ready — Part 1's whole complaint was Continue staying disabled
  // even when every current required reference is Ready. Priority: active
  // generation (something's genuinely in flight) > failed (needs a retry,
  // handled per-tile) > needs review (needs an Approve Anyway/Regenerate
  // decision, also per-tile) > ready.
  const failedBlocking = started && !active && progress.failed > 0;
  // Part 5: once Scene Generation has genuinely started (the SAME
  // authoritative resolver every other entry point uses), say so instead of
  // a generic "Continue to Scenes" — navigation behavior (onContinueToScenes)
  // is unchanged either way, this only makes the label truthful.
  const generationStarted = resumeState?.route === "generate";
  const cta = rebuildInProgress
    ? rebuildStarting ? "Starting rebuild..." : "Rebuilding Visual World..."
    : active
    ? "Finish Visual World"
    : reconciliationFailed
    ? "See update status above"
    : failedBlocking
    ? "Fix references first"
    : needsReviewBlocking
    ? "Review references first"
    : planCompatibilityBlocking
    ? "Update Visual World"
    : complete && generationStarted && resumeState.needsReview > 0
    ? "Review Scenes →"
    : complete && generationStarted && resumeState.generating + resumeState.queued > 0
    ? "Scene generation in progress →"
    : complete
    ? "Continue to Scenes →"
    : "Build Visual World →";
  // 2026-09-19 "Visual World incremental reconciliation" pass: unlike every
  // other blocking case above, planCompatibilityBlocking names a state with
  // a REAL enabled action — "Update Visual World" — never a dead end. Only
  // `selected === 0`/`started && progress.total === 0` (nothing planned at
  // all yet) still disable the button outright; those don't apply here
  // since a Visual World that's merely incompatible with a NEW plan is, by
  // definition, already fully built for its OWN (older) plan.
  const disabled = loading || active || failedBlocking || needsReviewBlocking || readOnly || reconciliationFailed || (!planCompatibilityBlocking && (selected === 0 || (started && progress.total === 0)));
  const runAction = () => {
    setMobileControls(false);
    if (planCompatibilityBlocking) { onUpdateVisualWorld?.(); return; }
    // Once every current required reference is Ready, Continue navigates to
    // the Generate/Scenes workspace — it must never re-trigger reference
    // generation (onBuild) at this point, only move the user forward.
    if (complete) { onContinueToScenes?.(); return; }
    onBuild();
  };
  const slots = (entity) => entity.requiredViews.filter((view) => !excludedViews.has(`${entity.entityId}:${view.angle}`)).map((view) => current.find((asset) => asset.entity_id === entity.entityId && asset.angle_or_view === view.angle) ?? { id: `${entity.entityId}:${view.angle}`, entity_id: entity.entityId, angle_or_view: view.angle, status: "planned" });
  const orderedEntities = [...entities].sort((a, b) => Number(b.uiPriority ?? 0) - Number(a.uiPriority ?? 0) || Number(b.importanceScore ?? 0) - Number(a.importanceScore ?? 0) || String(a.entityName).localeCompare(String(b.entityName)));
  const rebuildPlanning = Boolean(rebuildStarting || (rebuilding && visualWorld?.stage === "planning" && !visualWorld?.reference_plan));
  // Part 9: hover/disabled-state affordance — a disabled CTA must never be a
  // silent dead end. The title attribute plus the helper paragraphs below
  // both say the same thing so it's obvious whether the mouse is over it or
  // not.
  const ctaTitle = failedBlocking
    ? `${progress.failed} reference${progress.failed === 1 ? " needs" : "s need"} another try.`
    : needsReviewBlocking
    ? `${progress.needsReview} reference${progress.needsReview === 1 ? "" : "s"} still need${progress.needsReview === 1 ? "s" : ""} your approval.`
    : planCompatibilityBlocking
    ? `${compatibility.missingCount} reference${compatibility.missingCount === 1 ? "" : "s"} will be created; ${compatibility.reusableCount} existing reference${compatibility.reusableCount === 1 ? "" : "s"} will be reused. No episode-generation credits are used.`
    : active && progress.active > 0
    ? `${progress.active} reference${progress.active === 1 ? " is" : "s are"} still generating.`
    : complete
    ? "Your Visual World is ready."
    : undefined;
  // 2026-09-20 "Rebuild Visual World" fix — a clear SECONDARY action next to
  // the primary CTA, only once a Visual World is actually complete (never
  // competing with Build/Continue while the first build is still in
  // progress). Never auto-triggers scene generation or replaces anything —
  // see onRebuild's own wiring (visualWorld.jsx) for the non-destructive
  // regenerate:true path.
  const actionButton = <>
    {reviewingRebuild && (
      <div className="mb-3 rounded-xl border border-lime-300/25 bg-lime-300/[0.06] p-3">
        <p className="text-[12px] font-semibold text-lime-200">✓ New Visual World ready</p>
        <p className="mt-1 text-[11px] text-white/45">Your current Visual World is still active until you approve this one.</p>
        <button type="button" disabled={busy} onClick={() => onAdoptRebuild?.(visualWorld.id)} className="mt-3 w-full rounded-lg bg-lime-300 px-3 py-2 text-[12px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:opacity-40">Use This Visual World</button>
        <button type="button" disabled={busy} onClick={onKeepCurrent} className="mt-2 w-full rounded-lg border border-white/10 px-3 py-2 text-[12px] font-semibold text-white/65 transition hover:bg-white/5 disabled:opacity-40">Keep Current</button>
      </div>
    )}
    {!reviewingRebuild && <>
      {complete && <p className="mb-2 text-center text-[11px] font-medium text-lime-200/80">✓ Your Visual World is ready.</p>}
      <button type="button" onClick={runAction} disabled={disabled} title={ctaTitle} className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-300 px-4 py-3.5 text-[13px] font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-50">{active && <RotateCw className="h-4 w-4 motion-safe:animate-spin" />}{cta}</button>
      {ctaTitle && !complete && <p className={`mt-2 text-center text-[11px] ${failedBlocking || needsReviewBlocking ? "text-amber-300" : "text-white/40"}`}>{ctaTitle}</p>}
      {complete && onRebuild && (
        <button type="button" onClick={() => setRebuildModalOpen(true)} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white/60 transition hover:bg-white/5">
          Rebuild Visual World <RotateCw className="h-3.5 w-3.5" />
        </button>
      )}
    </>}
  </>;

  return <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#090A0A]">
    <div className="shrink-0 px-4 lg:px-6"><LongFormCreationHeader current="look" project={project} /></div>
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[180px] lg:flex-row lg:overflow-hidden lg:pb-0">
      <aside className="shrink-0 border-b border-white/[0.07] bg-[#0C0F0D] lg:flex lg:w-[350px] lg:flex-col lg:border-b-0 lg:border-r">
        {/* Item 1 of the 2026-09-19 "fix backward navigation" pass: this page
            previously had NO way back at all besides the browser's own back
            button (which risks re-submitting/losing in-flight state) — now
            matches StoryboardWorkspace's and GenerateWorkspace's own
            "← Back to X" row exactly. A plain route change to Storyboard;
            never triggers a rebuild of anything here. */}
        {onBackToStoryboard && (
          <button type="button" onClick={onBackToStoryboard} className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-3 text-[12.5px] font-semibold text-white/45 transition hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Storyboard
          </button>
        )}
        <button type="button" onClick={() => setMobileControls(!mobileControls)} aria-expanded={mobileControls} className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-white lg:hidden">Visual World controls<ChevronDown className={`h-4 w-4 ${mobileControls ? "rotate-180" : ""}`} /></button>
        <div className={`${mobileControls ? "block" : "hidden"} min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 lg:block`}>
          <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime-300">Visual World</p><p className="mt-2 text-[13px] leading-relaxed text-white/45">Create consistent references for the people, places and objects in your video.</p></div>
          <div className="space-y-3">
            <LongFormSelect label="Style" value={styleLabel} options={[{ value: styleLabel, label: styleLabel }]} onChange={() => {}} />
            {/* Part 5/6 of the 2026-09-14 fix: the old single "Model" dropdown
                (FLUX Base / FLUX.2 Klein 9B) was a leftover A/B-test control
                from before the current per-role renderer split — changing it
                never actually controlled character sheets (Kling), location/
                object/vehicle references (Klein 9B) or edits (Qwen)
                independently, so it was actively misleading. Replaced with a
                truthful, compact breakdown of what each reference TYPE
                actually uses today — no dropdown, because there is nothing
                real to choose here anymore. */}
            <GenerationModelsPanel />
          </div>
          <div><p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">References to Create <span className="float-right normal-case tracking-normal">{selected} selected</span></p>
            {CATEGORIES.filter((cat) => entities.some((e) => e.entityCategory === cat)).map((cat) => <div key={cat} className="mb-4"><p className="mb-2 text-[11px] font-medium text-white/40">{LABELS[cat]}</p><div className="space-y-2">{entities.filter((e) => e.entityCategory === cat).map((entity) => <EntityControl key={entity.entityId} entity={entity} excluded={excludedViews} onToggle={onToggleView} locked={started || busy || readOnly} />)}</div></div>)}
          </div>
        </div>
        <footer className="hidden shrink-0 border-t border-white/[0.07] p-5 lg:block">{actionButton}</footer>
      </aside>
      <main className="min-w-0 shrink-0 px-5 py-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8">
        <div className="mx-auto max-w-[1100px]">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-[25px] font-bold tracking-[-0.03em] text-white">{rebuildPlanning ? "Planning your Visual World..." : rebuildInProgress ? "Building your Visual World..." : reviewingRebuild ? "New Visual World ready" : reconciling ? "Updating Visual World" : "Your Visual World"}</h1><p className="mt-1.5 text-[13px] text-white/45">{rebuildPlanning ? "Choosing the people, places, and objects that matter most..." : rebuildInProgress ? "Building the newly selected references and reusing compatible history." : reviewingRebuild ? "Inspect the new references below before choosing which Visual World to use." : "Reusable references keep every scene visually consistent."}</p></div>{started && !rebuildPlanning && <div className="flex flex-wrap items-center gap-2">
            {/* Item 13 of the 2026-09-19 pass: this must never mix a
                HISTORICAL asset count (whatever the currently-displayed
                world happens to have accumulated across its own history)
                with CURRENT-PLAN readiness — the exact bug that showed
                "22 of 22 references ready" next to "8 references need to be
                created" for the SAME plan. planCompatibilityBlocking means
                we're looking at an OLD world that hasn't been reconciled
                yet: show the real reusable/missing split instead of a
                misleadingly-complete "ready" count. reused_asset_count/
                new_asset_count (set once reconciliation planning completes)
                give an exact, truthful caption while updating; the plain
                ready/total count is only ever shown once it's scoped to the
                CURRENT plan (a fresh build, or a reconciliation world after
                planning has run). */}
            {planCompatibilityBlocking ? (
              <p role="status" className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{compatibility.reusableCount} reusable · {compatibility.missingCount} to create</p>
            ) : reconciling && visualWorld?.new_asset_count != null ? (
              <p role="status" className="rounded-full border border-white/[0.08] px-3 py-2 text-xs text-white/65">{visualWorld.reused_asset_count} reused · {progress.ready - (visualWorld.reused_asset_count ?? 0)} / {visualWorld.new_asset_count} new references created</p>
            ) : (
              // Item 7: "references" alone is ambiguous between entities,
              // asset rows, and individual view/angle counts — this number
              // is specifically a VIEW count (one location can need several
              // camera-anchor views; one character needs exactly one sheet),
              // named explicitly so it's never confused with the
              // entity-level "6 reusable · 8 to create" count shown above.
              <p role="status" className="rounded-full border border-white/[0.08] px-3 py-2 text-xs text-white/65">{progress.ready} of {progress.total || selected} references ready</p>
            )}
            {/* Part 11 of the 2026-09-14 fix: a top-of-page needs-review
                counter that jumps to the first unresolved reference —
                decreases live as soon as one is approved (Approve Anyway or
                a passing Regenerate), since it's just progress.needsReview.
                Calm "Visual World ready" once zero — no confetti/celebration. */}
            {progress.needsReview > 0
              ? <button type="button" onClick={jumpToNeedsReview} className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20">{progress.needsReview} reference{progress.needsReview === 1 ? "" : "s"} need review</button>
              : complete && <p className="rounded-full border border-lime-300/20 bg-lime-300/5 px-3 py-2 text-xs text-lime-200/80">Visual World ready</p>}
          </div>}</div>
          {rebuildInProgress && <div className="mt-5 rounded-xl border border-lime-300/15 bg-lime-300/[0.04] p-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-lime-300 transition-[width] duration-500" style={{ width: `${Math.round((progress.ready / Math.max(progress.total || selected, 1)) * 100)}%` }} /></div>
            <p className="mt-2 text-xs text-white/45">{rebuildPlanning ? "Choosing the people, places, and objects that matter most..." : progress.active > 0 ? "Creating references..." : "Checking consistency..."}</p>
          </div>}
          {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{customerVisualMessage(error)}</p>}
          {/* Part 2/3/4 of the 2026-09-19 forensic fix — the hard invariant
              enforced visibly: a replanned VisualPlan's Visual World
              compatibility, computed against the CURRENT plan's own entity
              registry (never the world's stale build-time snapshot). Only
              rendered when the current world was built for a genuinely
              different plan version (see visualWorld.jsx). */}
          {compatibility && compatibility.compatible && (
            <div className="mt-4 rounded-xl border border-lime-300/20 bg-lime-300/5 p-3.5">
              <p className="text-sm font-semibold text-lime-100">Visual World ready ✓</p>
              <p className="mt-1 text-[12px] text-lime-200/70">Your replanned storyboard's references are already covered — nothing new needs to be generated.</p>
            </div>
          )}
          {compatibility && !compatibility.compatible && (
            <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4">
              <p className="text-sm font-bold text-amber-100">Update Visual World</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-200/80">
                {compatibility.missingCount} reference{compatibility.missingCount === 1 ? "" : "s"} need{compatibility.missingCount === 1 ? "s" : ""} to be created · {compatibility.reusableCount} existing reference{compatibility.reusableCount === 1 ? "" : "s"} will be reused.
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {compatibility.missing.map((m) => <li key={m.id} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-100">{m.name}</li>)}
              </ul>
              {/* 2026-09-19 "Visual World incremental reconciliation" pass:
                  this is the real action now — reuses the 6 compatible
                  references verbatim (zero cost) and only plans/generates
                  the missing ones. Never charges episode-generation credits;
                  Visual World reference generation itself is free by current
                  product policy (see the codebase-wide absence of any
                  credit-debit call anywhere in advance-long-form-visual-
                  world), so no credit badge is shown here — never invented
                  frontend pricing for something that costs nothing. */}
              <button type="button" disabled={busy} onClick={onUpdateVisualWorld} className="mt-3 flex items-center gap-2 rounded-lg bg-amber-300 px-3.5 py-2 text-[12px] font-bold text-[#1a1200] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">Update Visual World →</button>
              <p className="mt-2 text-[11px] text-amber-200/60">Nothing is charged until you continue to Generate — updating Visual World never charges episode-generation credits.</p>
            </div>
          )}
          {/* Item 5/6 of the 2026-09-19 production incident fix: real Mars
              case — a Visual World update can genuinely get stuck (a
              deterministic row-construction bug, in this incident) and the
              page must never leave the user staring at "Preparing…"
              forever with no explanation. The backend already persists
              last_error_code/last_error_at (and, once truly exhausted,
              status:'failed') — this surfaces that durable state instead of
              a client-side guess or a fake timer. Never shows the raw
              internal error text to the user (Part 13's own established
              rule: logged server-side only). */}
          {visualWorld?.status === "failed" && visualWorld?.parent_visual_world_version_id && (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/[0.08] p-4">
              <p className="text-sm font-bold text-red-100">Visual World update needs another try</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-red-200/80">We couldn't prepare the reference update. Nothing was lost — your existing Visual World and its references are untouched.</p>
              <button type="button" disabled={busy} onClick={onUpdateVisualWorld} className="mt-3 rounded-lg bg-red-300 px-3.5 py-2 text-[12px] font-bold text-[#1a0000] transition hover:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50">Try Again</button>
            </div>
          )}
          {reconciling && !visualWorld?.reference_plan && visualWorld?.last_error_code && (
            <p className="mt-4 text-xs text-amber-300/70">Retrying automatically…</p>
          )}
          {reconciling && !visualWorld?.reference_plan && !visualWorld?.last_error_code && (
            <p className="mt-4 text-xs text-white/40">Preparing your Visual World update — checking which references can be reused…</p>
          )}
          {active && <p className="mt-4 text-xs text-white/40">You can leave this page. Your references will keep generating in the background.</p>}
          {/* Named, per-cause banners (Part 13 of the reliability pass) —
              never a generic "couldn't regenerate" with no indication of
              which reference or what happens next. */}
          {progress.waitingForIdentity > 0 && <p className="mt-4 text-xs text-white/50">{progress.waitingForIdentity} reference{progress.waitingForIdentity === 1 ? " is" : "s are"} waiting for the identity reference to be approved.</p>}
          {progress.needsReview > 0 && <p className="mt-4 text-xs text-amber-200">{progress.needsReview} reference{progress.needsReview === 1 ? " needs" : "s need"} your review.</p>}
          {progress.failed > 0 && <p className="mt-4 text-xs text-amber-200">{progress.failed} reference{progress.failed === 1 ? " needs" : "s need"} another try. Your ready references are still available.</p>}
          {loading && <p role="status" className="mt-8 text-sm text-white/40">Loading your references…</p>}
          {!loading && !started && <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{entities.map((entity) => {
            const Icon = ICONS[entity.entityCategory] ?? Sparkles;
            return <div key={entity.entityId} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]"><div className="relative flex aspect-[4/3] items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(190,242,100,0.07),transparent_70%)]"><div className="absolute inset-5 rounded-xl border border-dashed border-white/[0.07]" /><Icon className="h-12 w-12 text-white/20" strokeWidth={1} /></div><div className="border-t border-white/[0.06] px-4 py-3"><p className="text-sm font-semibold text-white">{entity.entityName}</p><p className="mt-1 text-xs text-white/40">{entityRole(entity)}</p><p className="mt-2 text-[11px] text-lime-300/60">{slots(entity).length} references planned</p></div></div>;
          })}</div>}
          {started && !rebuildPlanning && <>
            {/* Dark Zyvo workspace language, matching the rest of the app —
                not the giant cream/white paper sheet this used to be. That
                cream "production sheet" aesthetic is worth keeping for a
                future separate EXPORT/Reference-Board view (a printable/
                shareable production bible), just not as the interactive
                in-app surface — see this component's own header comment
                if one gets added later; for now this IS the interactive view. */}
            <div className="mt-7 rounded-2xl border border-white/[0.08] bg-[#0C0F0D] p-5 sm:p-7">
              <div className="mb-6 flex items-center justify-between border-b border-white/[0.08] pb-4"><h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Reference Board</h2><span className="text-[10px] text-white/35">{styleLabel}</span></div>
              {/* 2026-09-22: most entities now resolve to exactly ONE
                  consolidated reference sheet (the character-sheet
                  consolidation fix), so a fixed 2-column board left a full
                  empty half-column beside a single-slot entity's card. More
                  columns on wider screens packs single-sheet entities
                  tightly; a multi-slot entity's own inner grid (below) can
                  still use the extra width within its own card. */}
              <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{orderedEntities.filter((entity) => slots(entity).length).map((entity) => <section key={entity.entityId} className={`flex h-full min-w-0 flex-col ${entity.isCoreIdentity ? "sm:col-span-2 lg:col-span-2 xl:col-span-2" : ""}`}>
                <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2"><h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-white/60">{entity.entityName}</h3><span className="text-[10px] text-white/30">{entityRole(entity)}</span></div>
                {/* Keep every one-board entity in the same compact two-column
                    flow. The modal remains the full-resolution inspection
                    surface for character sheets and detailed references. */}
                <div className={`grid flex-1 content-start gap-3 ${slots(entity).length > 2 ? "grid-cols-2 sm:grid-cols-3" : slots(entity).length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>{slots(entity).map((asset) => <ReferenceTile key={asset.id} asset={asset} name={entity.entityName} referenceFormat={entity.referenceFormat} siblingAssets={current} regeneratingFrom={regeneratingPredecessorFor(asset, assets)} onOpen={setOpenId} onRetry={onRetry} onApproveAnyway={onApproveAnyway} busy={busy || readOnly} />)}</div>
              </section>)}</div>
            </div>
            <h2 className="mb-4 mt-8 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">All References</h2>
            {CATEGORIES.map((category) => {
              const group = currentScoped.filter((asset) => entities.some((e) => e.entityId === asset.entity_id && e.entityCategory === category));
              if (!group.length) return null;
              return <section key={category} className="mb-6"><h3 className="mb-3 text-xs text-white/50">{LABELS[category]}</h3><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">{group.map((asset) => {
                const entity = entities.find((e) => e.entityId === asset.entity_id);
                return <div key={asset.id}><ReferenceTile asset={asset} name={entity.entityName} referenceFormat={entity.referenceFormat} siblingAssets={current} regeneratingFrom={regeneratingPredecessorFor(asset, assets)} onOpen={setOpenId} onRetry={onRetry} onApproveAnyway={onApproveAnyway} busy={busy || readOnly} /><p className="mt-2 text-xs font-medium text-white/60">{entity.entityName}</p><p className="mt-1 text-[10px] text-white/30">{entityRole(entity)} · {displayStatusLabel(asset, current)}</p></div>;
              })}</div></section>;
            })}
          </>}
        </div>
      </main>
    </div>
    <footer className="fixed inset-x-0 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 border-t border-white/[0.08] bg-[#0C0F0D]/95 px-5 py-3 backdrop-blur-xl lg:hidden">{actionButton}</footer>
    <Dialog open={Boolean(openAsset)} onClose={() => { setOpenId(null); setEditing(false); setEditInstruction(""); }} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="max-h-[92dvh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101213] p-5">
        <div className="mb-4 flex items-center justify-between"><DialogTitle className="text-lg font-semibold text-white">{openEntity?.entityName ?? "Reference"}</DialogTitle><button onClick={() => { setOpenId(null); setEditing(false); setEditInstruction(""); }} aria-label="Close preview" className="rounded-lg p-2 text-white/60 hover:bg-white/5"><X className="h-5 w-5" /></button></div>
        {openAsset && <>
          <img src={openAsset.result_url} alt={`${openEntity?.entityName ?? "Reference"}, ${viewLabel(openAsset.angle_or_view)}`} className="max-h-[65dvh] w-full rounded-xl bg-white/[0.03] object-contain" />
          {/* Part 8: the QA reason renders ABOVE the manual-override
              buttons below it, so the user reads WHY before deciding
              Approve Anyway vs Regenerate. */}
          {!editing && openAsset.qa_status === "rejected" && (
            <p className="mt-3 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] text-amber-200">Needs review: {customerVisualMessage(openAsset.qa_result?.reasons?.filter(Boolean).join(" ") || "One required view may be inconsistent.")}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-white/60">
              <p>{viewLabel(openAsset.angle_or_view)}</p>
              <p className="mt-1 text-xs text-white/35">{styleLabel} · {modelLabel(openAsset)} · {resolveDisplayStatus(openAsset, current).label}</p>
              <p className="mt-1 text-[11px] text-white/30">{new Date(openAsset.created_at).toLocaleString()} · {openAsset.qa_status === "approved" ? "QA approved" : openAsset.qa_status === "rejected" ? "Needs review" : "No blocking QA"}{currentOpenSlotAsset?.id === openAsset.id ? " · Current version" : ""}</p>
            </div>
            {/* Edit is the stronger useful action (reuses the same
                reference-conditioned mechanism 30 Days' own reference editor
                uses) — Regenerate stays available as a plain outline button
                for "just try again from scratch" instead. A rejected
                identity anchor gets its own escalation path (Part 2):
                Approve overrides QA for a human judgment call, Regenerate
                stays available for a genuine hard failure. */}
            {!editing && <div className="flex flex-wrap items-center gap-2">
              {isHistoricalSelection && onUseVersion && (
                <button disabled={busy || readOnly} onClick={() => onUseVersion(openAsset.id).then((ok) => { if (ok !== false) setOpenId(null); })} className="rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">Use This Version</button>
              )}
              {IDENTITY_ANCHOR_ROLES.has(openAsset.angle_or_view) && openAsset.qa_status === "rejected" && onApproveIdentity && (
                <button disabled={busy || readOnly} onClick={() => onApproveIdentity(openAsset.id)} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#0C0F0D] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">Approve Identity</button>
              )}
              {/* Part 8B of the 2026-09-14 fix: "Approve Anyway" must also
                  live inside the fullscreen modal, not just on the tile —
                  a deliberate manual override, distinct from the legacy
                  Approve Identity path above (identity-anchor roles only). */}
              {!IDENTITY_ANCHOR_ROLES.has(openAsset.angle_or_view) && openAsset.qa_status === "rejected" && onApproveAnyway && (
                <button disabled={busy || readOnly} onClick={() => onApproveAnyway(openAsset.id).then((ok) => { if (ok !== false) setOpenId(null); })} className="rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40">Approve Anyway</button>
              )}
              <button disabled={busy || readOnly || ["pending", "running"].includes(openAsset.status)} onClick={() => onRetry(openAsset.id).then((ok) => { if (ok !== false) setOpenId(null); })} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Regenerate</button>
              <button disabled={busy || readOnly || !onEdit} onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-xl bg-lime-300 px-4 py-2.5 text-xs font-bold text-[#11150D] transition hover:bg-lime-200 disabled:cursor-not-allowed disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />Edit Reference</button>
            </div>}
          </div>
          {!editing && <p className="mt-3 text-[11px] text-white/30">{openAsset.source_master_asset_id ? "Cropped from a character turnaround. Regenerate independently replaces this role only; Edit changes this role. The master and previous references remain in history." : "Regenerates this view only. The previous reference stays in its history."}</p>}
          {editing && <form
            className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const instruction = editInstruction.trim();
              if (!instruction) return;
              onEdit(openAsset.id, instruction).then((ok) => { if (ok !== false) { setEditing(false); setEditInstruction(""); } });
            }}
          >
            <label htmlFor="reference-edit-instruction" className="text-xs font-semibold text-white/70">Describe exactly what to change</label>
            <input
              id="reference-edit-instruction"
              autoFocus
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              maxLength={800}
              placeholder='e.g. "make his jacket darker", "remove the badge", "make this a true side profile"'
              className="mt-2 w-full rounded-lg border border-white/10 bg-[#101213] px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:border-lime-300/40 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => { setEditing(false); setEditInstruction(""); }} className="rounded-lg px-3 py-2 text-xs font-semibold text-white/50 hover:text-white/80">Cancel</button>
              <button type="submit" disabled={busy || !editInstruction.trim()} className="rounded-lg bg-lime-300 px-4 py-2 text-xs font-bold text-[#11150D] disabled:cursor-not-allowed disabled:opacity-40">Apply Edit</button>
            </div>
            <p className="mt-2 text-[11px] text-white/30">The current reference stays in its history — this creates a new revision.</p>
          </form>}
        </>}
        {history.length > 1 && <div className="mt-5 border-t border-white/10 pt-4"><p className="mb-3 text-xs text-white/40">Reference History</p><div className="flex gap-3 overflow-x-auto pb-2">{history.map((asset, index) => <button type="button" key={asset.id} onClick={() => { setOpenId(asset.id); setEditing(false); setEditInstruction(""); }} aria-label={`View saved reference ${index + 1}`} className={`group relative w-24 shrink-0 cursor-pointer overflow-hidden rounded-lg border transition duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${asset.id === openId ? "border-lime-300" : "border-white/10"}`}><img src={asset.result_url} alt={`Saved reference ${index + 1}`} className="aspect-[4/3] w-full object-contain transition duration-200 group-hover:scale-[1.02]" />{currentOpenSlotAsset?.id === asset.id && <span className="absolute bottom-1 right-1 rounded bg-lime-300 px-1.5 py-0.5 text-[9px] font-bold text-[#11150D]">Current</span>}</button>)}</div></div>}
      </DialogPanel></div>
    </Dialog>
    <RebuildVisualWorldModal
      open={rebuildModalOpen}
      onClose={() => setRebuildModalOpen(false)}
      busy={busy}
      error={error}
      onConfirm={() => { onRebuild?.(); setRebuildModalOpen(false); }}
    />
  </div>;
}
