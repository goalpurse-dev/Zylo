import { customerVisualMessage } from "./customerVisualMessage.js";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { AlertTriangle, ArrowLeft, Check, ChevronDown, ChevronRight, Clock, Crop, Film, Layers, Lock, Maximize2, Orbit, Pause as PauseIcon, Pencil, Play as PlayIcon, RefreshCcw, RotateCw, ShieldCheck, Sparkles, Wand2, X } from "lucide-react";
import { runEpisodeQA } from "../../../../supabase/functions/_shared/episodeQA.ts";
import { READINESS_ACTION_LABEL, READINESS_ACTION_ROUTE } from "../../../../supabase/functions/_shared/generationReadiness.ts";
import { LongFormCreationHeader } from "./shared";
import { currentReferenceAssets, selectCurrentVisualWorldAssets, referenceProgress } from "./visualWorldPlanning";
import {
  buildSceneCards, summarizeSceneProgress, groupScenesForBoard, deriveChapterLabel, filterSceneCards, SCENE_FILTERS,
  deriveEpisodeProgressPhase, EPISODE_PROGRESS_HEADING, buildSceneHistory, isEpisodeGenerationCommitted, canManuallyApproveScene,
  deriveEpisodeGenerationProgress, EPISODE_GENERATION_PHASE_COPY, resolveSceneDisplayUrl,
} from "./sceneCardModel";
import { SCENE_GENERATION_TIERS, DEFAULT_SCENE_GENERATION_TIER, estimateLongFormSceneCredits, estimateSceneOperationCredits, quoteLongFormGeneration } from "./scenePricing";
import { quoteTestSample } from "./generateWorkspaceApi";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { emitCreditSpend } from "../../../lib/creditPopEvents";
import NoCreditsModal from "../../../components/viral-tools/shared/NoCreditsModal";

const CREDIT_ICON = "/icons/credits.png";
function CreditIcon({ className = "h-4 w-4" }) {
  return <span aria-hidden="true" className={`${className} shrink-0 bg-current`} style={{ WebkitMaskImage: `url(${CREDIT_ICON})`, maskImage: `url(${CREDIT_ICON})`, WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain" }} />;
}

// 2026-09-19 "hide provider/model names" V1 fix: Kling/Qwen/Seedream/FLUX
// are Zyvo internal implementation detail — the user sees only the Zyvo
// tier name/quality/tagline (SCENE_GENERATION_TIERS) and a plain-language
// description of what that tier is FOR, never which provider renders it.
const TIER_BLURB = {
  v2: "Fastest and cheapest — a good pick for drafting a full episode.",
  v3: "Best balance of quality and cost for final YouTube videos.",
  v4: "Maximum fidelity for a premium episode.",
};

/* ============================ Image Quality selector ============================ */
// Name + quality only — no credit amounts in these cells (Part 5). Pricing
// belongs solely in the Generation Summary and the primary CTA below, both
// reading the SAME server estimate this selector no longer duplicates.
function CompactTierSelector({ tier, locked, onSelect }) {
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5">
        {SCENE_GENERATION_TIERS.map((t) => {
          const selected = tier === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              disabled={locked}
              title={locked ? "Locked for this generation" : undefined}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-lg border px-1.5 py-2.5 text-center transition ${
                selected
                  ? "border-lime-300/50 bg-lime-300/[0.08]"
                  : locked
                  ? "cursor-not-allowed border-white/[0.06] bg-white/[0.015] opacity-40"
                  : "border-white/[0.08] bg-white/[0.02] hover:border-white/[0.16]"
              }`}
            >
              {selected && <span className="absolute right-1 top-1 flex h-3 w-3 items-center justify-center rounded-full bg-lime-300"><Check className="h-2 w-2 text-[#11150D]" strokeWidth={3.5} /></span>}
              {t.tagline === "Recommended" && <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full border border-lime-300/25 bg-[#0C0F0D] px-1.5 py-0 text-[7px] font-bold uppercase tracking-wide text-lime-300">Best</span>}
              <span className="flex items-baseline gap-1">
                <span className={`text-[10px] font-black tracking-wide ${selected ? "text-lime-300" : "text-white/50"}`}>{t.name}</span>
                <span className="text-[9px] font-semibold leading-tight text-white/70">{t.quality}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 truncate text-[11px] text-white/35">{TIER_BLURB[tier]}</p>
      {locked && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-white/30">
          <Lock className="h-3 w-3" /> Locked for this generation
        </p>
      )}
    </div>
  );
}

/* ============================ Reference Sheets preview module ============================ */
function ReferenceSheetsPreview({ sheets, onOpen }) {
  if (!sheets.length) {
    return <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center text-[11px] text-white/30">No approved character sheets yet.</div>;
  }
  const [main, ...rest] = sheets;
  const overflow = Math.max(0, sheets.length - 4);
  return (
    <button type="button" onClick={onOpen} className="group relative block w-full overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] text-left transition hover:border-lime-300/25">
      <div className="relative flex h-[130px] w-full items-stretch">
        <img src={main.result_url} alt={main.name} className="h-full w-3/5 shrink-0 object-cover" />
        <div className="grid h-full w-2/5 grid-cols-2 grid-rows-2 gap-px bg-white/[0.06]">
          {rest.slice(0, 3).map((sheet, i) => (
            <div key={sheet.id} className="relative overflow-hidden bg-[#0C0F0D]">
              <img src={sheet.result_url} alt={sheet.name} className="h-full w-full object-cover" />
              {i === 2 && overflow > 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-bold text-white">+{overflow}</div>
              )}
            </div>
          ))}
          {Array.from({ length: Math.max(0, 3 - rest.length) }).map((_, i) => <div key={`empty-${i}`} className="bg-[#0C0F0D]" />)}
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
        <span className="text-[12px] font-semibold text-white">View Reference Sheets</span>
      </div>
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-white drop-shadow">Characters are locked for consistency.</span>
      </div>
    </button>
  );
}

function ReferenceSheetsGalleryModal({ open, sheets, onClose, onOpenSheet }) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101213] p-5">
          <div className="mb-4 flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-white">Reference Sheets</DialogTitle>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/60 hover:bg-white/5"><X className="h-5 w-5" /></button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sheets.map((sheet) => (
              <button key={sheet.id} type="button" onClick={() => onOpenSheet(sheet)} className="group overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02] text-left">
                <div className="aspect-[16/9] w-full overflow-hidden"><img src={sheet.result_url} alt={sheet.name} className="h-full w-full object-cover transition group-hover:scale-[1.03]" /></div>
                <p className="truncate px-2 py-1.5 text-[11px] font-medium text-white/60">{sheet.name}</p>
              </button>
            ))}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/* ============================ Scene cards ============================ */
const STRATEGY_BADGE_CLASS = {
  "New scene": "border-lime-300/25 bg-lime-300/[0.08] text-lime-300",
  Edit: "border-sky-400/25 bg-sky-400/[0.08] text-sky-300",
  Reuse: "border-white/15 bg-white/[0.04] text-white/50",
  Crop: "border-white/15 bg-white/[0.04] text-white/50",
  Graphic: "border-fuchsia-400/25 bg-fuchsia-400/[0.08] text-fuchsia-300",
};
const STRATEGY_ICON = { "New scene": Sparkles, Edit: Wand2, Reuse: RefreshCcw, Crop: Crop, Graphic: Layers };
const STATUS_COLOR = {
  ready: "text-lime-300", needs_review: "text-amber-300", failed: "text-red-300",
  generating: "text-lime-300", compositing: "text-lime-300", checking: "text-sky-300", starting: "text-white/40", queued: "text-white/35", planned: "text-white/25",
};
// 2026-09-19 "premium active-generation UI" pass (item 4): a purely
// presentational override of the tile's own bottom-line copy for the two
// states the task calls out by exact wording — never changes
// deriveSceneCardStatus's own canonical `status.label` (still used verbatim
// by the scene modal, filters, and the activity feed's activityLabelForCard,
// and asserted by existing tests), only what this specific tile displays.
const CARD_STATUS_TEXT_OVERRIDE = { generating: "Creating visual…", checking: "Checking quality…" };

function PlannedCardBody({ card, pulse = false }) {
  const Icon = STRATEGY_ICON[card.strategyLabel] ?? Sparkles;
  const label = card.status.key === "planned"
    ? (card.strategyLabel === "Graphic" ? "Graphic planned" : "Waiting to render")
    : card.status.key === "queued" ? "Queued"
    : (CARD_STATUS_TEXT_OVERRIDE[card.status.key] ?? card.status.label);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 text-white/25">
      {card.status.key === "queued" ? <Clock className="h-5 w-5" /> : <Icon className={`h-5 w-5 ${pulse ? "lf-gen-core text-lime-300" : ""}`} />}
      <span className={`text-[10px] font-medium ${pulse ? "text-lime-300/90" : ""}`}>{label}</span>
    </div>
  );
}

function SceneCard({ card, onOpen, attention = false }) {
  const badgeColor = STRATEGY_BADGE_CLASS[card.strategyLabel] ?? "border-white/15 bg-white/[0.04] text-white/50";
  const statusColor = STATUS_COLOR[card.status.key] ?? "text-white/40";
  const needsReview = card.status.key === "needs_review";
  const failed = card.status.key === "failed";
  // "Actively being worked on right now" — a soft breathing lime border, per
  // item 4's "the currently generating card can have a slightly brighter
  // border so the eye can see production moving through the episode."
  const isGenerating = ["generating", "starting", "compositing"].includes(card.status.key);
  const isChecking = card.status.key === "checking";
  const statusText = CARD_STATUS_TEXT_OVERRIDE[card.status.key] ?? card.status.label;
  // Part 13: a planned scene can still be clicked (the modal explains what
  // it will become) — it just never pretends a picture exists yet.
  return (
    <button
      type="button"
      id={`scene-card-${card.beatId}`}
      onClick={() => onOpen(card)}
      className={`flex h-[240px] cursor-pointer flex-col overflow-hidden rounded-xl border bg-white/[0.02] text-left transition hover:brightness-110 ${
        // Item 7 of the 2026-09-19 pass: a scene the episode-QA banner just
        // flagged gets a visible ring after the user clicks the banner to
        // jump here — purely a presentation highlight, no QA state of its
        // own changes.
        attention ? "border-sky-400/50 ring-1 ring-sky-400/40"
          : isGenerating ? "lf-gen-card-generating border-lime-300/30"
          : needsReview ? "border-amber-400/30 hover:border-amber-400/50"
          : failed ? "border-red-400/35 hover:border-red-400/55"
          : "border-white/[0.07] hover:border-white/[0.16]"
      }`}
    >
      <div className={`relative aspect-video w-full shrink-0 overflow-hidden bg-white/[0.03] ${isChecking ? "lf-gen-card-checking" : ""}`}>
        {card.thumbnailUrl ? <img src={card.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : <PlannedCardBody card={card} pulse={isGenerating} />}
        {isChecking && card.thumbnailUrl && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-1 rounded-full border border-sky-300/30 bg-black/50 px-1.5 py-0.5 text-[8px] font-bold text-sky-300 backdrop-blur-sm">
            <ShieldCheck className="h-2.5 w-2.5" /> Checking
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-white/70">Shot {String(card.displayIndex).padStart(2, "0")}</span>
          <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ${badgeColor}`}>{card.strategyLabel}</span>
        </div>
        <p className="line-clamp-2 text-[11px] leading-snug text-white/45">{card.description}</p>
        {(card.characterNames.length > 0 || card.locationName) && (
          <p className="truncate text-[9px] text-white/30">{[...card.characterNames, card.locationName].filter(Boolean).join(" · ")}</p>
        )}
        <div className="mt-auto flex items-center justify-between gap-1">
          <span className={`text-[10px] font-semibold ${statusColor}`}>{statusText}</span>
          {failed && <span className="text-[9px] font-bold text-red-300">Try again →</span>}
        </div>
      </div>
    </button>
  );
}

/* ============================ Sequence group header ============================ */
function formatTimestamp(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SequenceGroupHeader({ group }) {
  const range = group.startSeconds != null && group.endSeconds != null ? `${formatTimestamp(group.startSeconds)}–${formatTimestamp(group.endSeconds)}` : null;
  if (group.isHook) {
    return (
      <div className="sticky top-0 z-10 mb-3 rounded-xl border border-lime-300/25 bg-gradient-to-r from-lime-300/[0.08] to-transparent px-4 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-lime-300/40 bg-lime-300/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-lime-300">Hook</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-white/70">First sequence</span>
          {range && <span className="text-[10px] text-white/30">{range}</span>}
        </div>
        <p className="mt-1 text-[11px] text-white/40">The opening viewers see first.</p>
      </div>
    );
  }
  return (
    <div className="sticky top-0 z-10 mb-3 border-b border-white/[0.06] bg-[#090A0A]/95 px-1 py-2 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-white/55">{deriveChapterLabel(group.chapterId)}</span>
        {range && <span className="text-[10px] text-white/25">{range}</span>}
      </div>
      {group.narrativeFunction && <p className="mt-0.5 truncate text-[10px] text-white/25">{group.narrativeFunction}</p>}
    </div>
  );
}

/* ============================ Filters ============================ */
const FILTER_LABEL = { all: "All", needs_review: "Needs review", ready: "Ready", generating: "Generating", planned: "Planned" };
function SceneFilterBar({ progress, filter, onChange }) {
  const counts = { all: progress.total, needs_review: progress.needsReview, ready: progress.ready, generating: progress.active, planned: progress.planned };
  const visible = SCENE_FILTERS.filter((f) => f === "all" || counts[f] > 0);
  if (visible.length <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {visible.map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
            filter === f ? "border-lime-300/40 bg-lime-300/10 text-lime-300" : "border-white/[0.08] bg-white/[0.02] text-white/45 hover:border-white/[0.16]"
          }`}
        >
          {FILTER_LABEL[f]} {counts[f]}
        </button>
      ))}
    </div>
  );
}

/* ============================ Active-generation hero ============================ */
// 2026-09-19 "premium active-generation UI" pass. Replaces the previously
// understated status box with a much larger production panel WHILE a real
// generation run is active (episodeGenerationCommitted) — everything here
// reads from `genProgress` (deriveEpisodeGenerationProgress), the SAME
// selector the sidebar mini-status and scene filters use, so numbers can
// never drift between panels. Nothing here is timer/elapsed-time simulated;
// `longRunning` is the one exception, and it only ever gates a calm
// reassurance sentence, never the percentage/counts themselves.
const LIVE_COUNT_ITEMS = [
  { key: "generating", label: "Generating", dot: "bg-lime-300" },
  { key: "queued", label: "Queued", dot: "bg-white/30" },
  { key: "checking", label: "Checking", dot: "bg-sky-300" },
  { key: "ready", label: "Ready", dot: "bg-lime-300" },
  { key: "needsReview", label: "Needs review", dot: "bg-amber-300" },
  { key: "failed", label: "Retrying", dot: "bg-red-300" },
];
const ACTIVE_HERO_PHASES = new Set(["compiling", "rendering", "checking"]);

function EpisodeGenerationHero({ genProgress, chargedAt, onPauseGeneration, onContinueGeneration, busy, chapterLabel = null }) {
  const { phase, total, ready, processed, remaining, currentActivities, nextQueuedShotLabel } = genProgress;
  // 2026-09-22 "progress must not lie" fix — real incident: this line read
  // "4 / 126 visuals complete" while those 4 cards were actually FAILED
  // (Needs another try), because `processed` (ready+needsReview+failed) is
  // a phase-transition concept ("nothing left actively rendering"), not a
  // "usable output exists" one. The headline number and its bar must only
  // ever count scenes with a real, usable result — `processed`/its % stay
  // available below for the phase machine, which legitimately does care
  // about "attempted" regardless of outcome.
  const readyPct = total ? Math.floor((ready / total) * 100) : 0;
  const basePhaseCopy = EPISODE_GENERATION_PHASE_COPY[phase] ?? EPISODE_GENERATION_PHASE_COPY.idle;
  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // "Creating your episode / 0 of 126 visuals ready" while only Chapter 1's
  // 15 visuals were ever authorized. genProgress itself is already scoped
  // (see chapterGateActive above), so only the TITLE text needs a chapter-
  // aware override here — subcopy already reads the correct (now-scoped)
  // `total` via copy.subcopy(total), so it naturally says "15 visuals," not
  // "126," with no separate fix needed.
  const copy = chapterLabel ? { ...basePhaseCopy, title: basePhaseCopy.title.replace(/your episode|Episode/, chapterLabel) } : basePhaseCopy;
  const isActive = ACTIVE_HERO_PHASES.has(phase);
  const isDone = phase === "ready";
  const isPausedPhase = phase === "paused";
  // Pause is offered for any non-final phase — there's real unfinished work
  // to stop dispatching for. Never shown once paused (Continue replaces it)
  // or once everything is already ready (nothing left to pause).
  const canPause = !isPausedPhase && !isDone && Boolean(onPauseGeneration);
  // Real elapsed wall-clock time since the REAL persisted charge timestamp —
  // never a countdown/progress simulation, only gates whether a calm "taking
  // a little longer" sentence appears. 25 minutes is generous for a 100+
  // scene episode's normal compile+render+QA time.
  const longRunning = isActive && chargedAt ? Date.now() - new Date(chargedAt).getTime() > 25 * 60 * 1000 : false;

  return (
    <div className={`relative mt-4 overflow-hidden rounded-2xl border p-5 sm:p-7 ${isDone ? "border-lime-300/25 bg-lime-300/[0.05]" : "border-white/[0.09] bg-[#0C0F0D]"}`}>
      {/* 2026-09-21 emergency pause feature: a deliberate pause is never
          styled as an error/failure — same neutral panel chrome as the
          normal active state, no red/amber alarm treatment, no glow/pulse
          animation (those are reserved for genuinely active production). */}
      {isActive && (
        <>
          <div className="lf-gen-hero-glow" aria-hidden="true" />
          <div className="absolute right-5 top-5 hidden h-9 w-9 items-center justify-center rounded-full border border-lime-300/30 bg-lime-300/10 text-lime-300 sm:flex">
            <Orbit className="lf-gen-core h-4.5 w-4.5" aria-hidden="true" />
          </div>
        </>
      )}
      <div className="relative">
        <p className="text-lg font-black text-white sm:text-xl">{copy.title}</p>
        <p className="mt-1 text-[13px] text-white/50">{copy.subcopy(total)}</p>

        <div className="mt-5 flex items-end justify-between gap-2">
          <p className="text-sm font-bold text-white">{ready} / {total} visuals ready</p>
          <p className="text-sm font-black text-lime-300">{readyPct}%</p>
        </div>
        <div className="relative mt-2 h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-lime-400 to-lime-300 transition-all duration-700" style={{ width: `${readyPct}%` }}>
            {isActive && <div className="lf-gen-bar-travel" aria-hidden="true" />}
          </div>
        </div>
        {isPausedPhase && remaining > 0 && <p className="mt-2 text-[12.5px] font-semibold text-white/50">{remaining} remaining</p>}

        {(LIVE_COUNT_ITEMS.some((it) => genProgress[it.key] > 0)) && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {LIVE_COUNT_ITEMS.filter((it) => genProgress[it.key] > 0).map((it) => (
              <span key={it.key} className="flex items-center gap-1.5 text-[12px] font-semibold text-white/60">
                <span className={`h-1.5 w-1.5 rounded-full ${it.dot}`} />
                {it.label} {genProgress[it.key]}
              </span>
            ))}
          </div>
        )}

        {currentActivities.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-white/[0.06] pt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">What Zyvo is doing now</p>
            {currentActivities.map((a) => (
              <div key={a.beatId} className="flex items-center gap-2.5">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="lf-gen-core absolute inline-flex h-full w-full rounded-full bg-lime-300" />
                </span>
                <p className="truncate text-[12.5px] text-white/75">
                  <span className="font-bold text-white">{a.shotLabel}</span>
                  <span className="text-white/40"> · </span>
                  {a.activity}
                </p>
              </div>
            ))}
            {nextQueuedShotLabel && <p className="pl-4 text-[11px] text-white/30">{nextQueuedShotLabel} queued next</p>}
          </div>
        )}

        {isActive && (
          <p className="mt-4 text-[11.5px] text-white/35">You can leave this page — generation will continue.</p>
        )}
        {longRunning && (
          <p className="mt-1.5 text-[11.5px] text-amber-200/70">This episode is taking a little longer than usual, but generation is still active.</p>
        )}

        {/* 2026-09-21 emergency pause feature: Pause is the primary/visible
            control while generation is active; Continue replaces it once
            paused. Both call the backend-authoritative RPC (durable
            is_paused on the episode charge) — there is no frontend-only
            pause flag anywhere in this path. */}
        {canPause && (
          <button type="button" onClick={onPauseGeneration} disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[13px] font-bold text-white/80 transition hover:bg-white/[0.08] disabled:opacity-50 sm:w-auto">
            <PauseIcon className="h-4 w-4" /> Pause Generation
          </button>
        )}
        {isPausedPhase && (
          <button type="button" onClick={onContinueGeneration} disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3 text-[13px] font-bold text-lime-300 transition hover:bg-lime-300/[0.18] disabled:opacity-50 sm:w-auto">
            <PlayIcon className="h-4 w-4" /> Continue Generation
          </button>
        )}
        {isDone && (
          <p className="mt-4 flex items-center gap-1.5 text-[11.5px] font-semibold text-lime-300"><Check className="h-3.5 w-3.5" /> All visuals processed.</p>
        )}
      </div>
    </div>
  );
}

/* ============================ Scene review modal ============================ */
// Cost badge helper — a tiny "credit-icon N" pill reused on Regenerate,
// Edit Scene, and Apply Edit. `credits` is always the server-derived
// estimate (sceneOpEstimates prop, fetched via estimate_scene_operation_
// credits) — never a hardcoded number (Part 6/7).
function OpCostBadge({ credits }) {
  return (
    <span className="flex items-center gap-1 text-[12px] font-bold">
      <CreditIcon className="h-3 w-3 text-lime-300" />
      {credits == null ? "…" : credits}
    </span>
  );
}

// Part 11-13: fits within ~90dvh with no vertical scroll on desktop. The
// image is explicitly CAPPED (min(52vh, 520px)) rather than left free to
// fill available space — this modal is for preview + decision + action,
// not an image-only viewer (Part 12); a separate fullscreen icon opens a
// dedicated image-focused lightbox for that.
function SceneReviewModal({ card, scenes, sceneOpEstimates, onClose, onRetry, onEdit, onEscalate, onApproveAnyway, onDisableOverlay, busy }) {
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [previewSceneId, setPreviewSceneId] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  useEffect(() => { setEditing(false); setInstruction(""); setPreviewSceneId(null); setLightboxOpen(false); }, [card?.beatId]);
  if (!card) return null;

  const history = buildSceneHistory(scenes, card.sceneId);
  const currentScene = history[history.length - 1] ?? null;
  const previewScene = previewSceneId ? history.find((s) => s.id === previewSceneId) : currentScene;
  const viewingHistory = previewScene && previewScene.id !== currentScene?.id;
  // §11: the SAME resolver the card uses — never a second, independent
  // reading of result_url that can show a different (pre-overlay) frame
  // than what the card already displayed for this exact scene.
  const previewUrl = resolveSceneDisplayUrl(previewScene);
  const canAct = Boolean(currentScene?.result_url) && !viewingHistory;
  // Part 6: a scene that failed — whether before the provider was ever
  // called (job_id null) or after a genuine provider-side failure — must
  // always offer a way to try again, even with no result image at all. This
  // is deliberately independent of `canAct` (which gates the FULL action
  // set that needs a real result to act on, e.g. Edit Scene/Approve).
  const canRetryFailed = card.status.key === "failed" && !viewingHistory;
  const range = card.startSeconds != null && card.endSeconds != null ? `${formatTimestamp(card.startSeconds)}–${formatTimestamp(card.endSeconds)}` : null;
  // 2026-09-17 "fix PROGRAMMATIC_GRAPHIC" pass (Part 13): a deterministic
  // graphic has zero provider cost and produces a new visual TREATMENT, not
  // a re-render of the same photo — different enough action that it earns
  // its own copy ("Try Another Layout"), reusing the exact same free-action
  // pattern the failed-scene "Try Again" button already established
  // (freeRetry -> no cost badge shown at all) rather than inventing a new
  // one. Never surfaces engineering vocabulary (GraphicSpec/treatment/
  // contract) — the user just sees a layout refresh.
  const isGraphic = card.strategyLabel === "Graphic";
  const regenerateCredits = sceneOpEstimates?.regenerate?.credits;
  const regenerateIsFree = Boolean(sceneOpEstimates?.regenerate?.freeRetry) || isGraphic || regenerateCredits === 0;
  const editCredits = sceneOpEstimates?.edit?.credits;
  const escalateCredits = sceneOpEstimates?.escalate?.credits;

  return (
    <>
      <Dialog open={Boolean(card)} onClose={onClose} className="relative z-[100]">
        <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="flex max-h-[90dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101213] p-5">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-white">Shot {String(card.displayIndex).padStart(2, "0")}</DialogTitle>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-white/60 hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>

            {previewUrl ? (
              <div className="relative mb-3 flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <img src={previewUrl} alt="" className="max-h-[min(52vh,520px)] w-full object-contain" />
                {viewingHistory && <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">Previous version</span>}
                <button type="button" onClick={() => setLightboxOpen(true)} aria-label="View fullscreen" className="absolute right-2 top-2 rounded-lg bg-black/60 p-1.5 text-white/80 hover:bg-black/80 hover:text-white">
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="mb-3 flex aspect-video w-full shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] text-white/30">
                <Film className="h-6 w-6" />
                <span className="text-[12px] font-medium">{card.status.key === "failed" ? "This scene failed to render." : (card.strategyLabel === "Graphic" ? "Graphic planned" : "Waiting to render")}</span>
              </div>
            )}

            <div className="shrink-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/40">
                <span className="font-semibold text-white/60">{deriveChapterLabel(card.chapterId)}</span>
                {range && <span>{range}</span>}
                <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${STRATEGY_BADGE_CLASS[card.strategyLabel] ?? "border-white/15 text-white/50"}`}>{card.strategyLabel}</span>
              </div>
              <p className="line-clamp-2 text-sm text-white/60">{card.description}</p>

              {history.length > 1 && (
                <div>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">Scene history</p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {history.map((s, i) => {
                      const isCurrent = i === history.length - 1;
                      const isSelected = previewScene?.id === s.id;
                      return (
                        <button key={s.id} type="button" onClick={() => setPreviewSceneId(isCurrent ? null : s.id)} className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-md border ${isSelected ? "border-lime-300/60" : "border-white/10"}`}>
                          {resolveSceneDisplayUrl(s) ? <img src={resolveSceneDisplayUrl(s)} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-white/[0.03] text-[8px] text-white/30">Failed</div>}
                          {isCurrent && <span className="absolute bottom-0 left-0 right-0 bg-lime-300/90 py-[1px] text-center text-[7px] font-bold text-[#11150D]">Current</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {canManuallyApproveScene(card.status.key) && card.qaReasons?.length > 0 && !viewingHistory && (
                <div className="line-clamp-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] p-2 text-[11px] text-amber-200">{card.qaReasons.join(" ")}</div>
              )}
              {card.weakEditDelta && !viewingHistory && (
                <div className="rounded-lg border border-sky-400/20 bg-sky-400/[0.06] p-2 text-[11px] text-sky-200">
                  This edit came back nearly identical to its source image. Regenerating would likely repeat the same result — try it as a brand new scene instead.
                </div>
              )}
            </div>

            <div className="mt-3 shrink-0">
              {(canAct || canRetryFailed) && (editing ? (
                <div className="space-y-2">
                  <p className="text-[12px] font-medium text-white/60">What would you like to change?</p>
                  <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="e.g. Make the room darker and move the character closer to the window." rows={2} className="w-full rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-sm text-white placeholder:text-white/25" />
                  <div className="flex gap-2">
                    <button disabled={busy || instruction.trim().length < 3} onClick={() => { onEdit(currentScene.id, instruction.trim()); setEditing(false); setInstruction(""); }} className="flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[12px] font-bold text-[#11150D] disabled:opacity-40">
                      Apply Edit <OpCostBadge credits={editCredits} />
                    </button>
                    <button onClick={() => setEditing(false)} className="rounded-lg border border-white/10 px-3 py-2 text-[12px] text-white/60">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {canManuallyApproveScene(card.status.key) && <button disabled={busy} onClick={() => onApproveAnyway(currentScene.id)} className="rounded-lg border border-lime-300/25 bg-lime-300/[0.08] px-3 py-2 text-[12px] font-semibold text-lime-300 disabled:opacity-40">Approve</button>}
                  {canRetryFailed && (
                    <button disabled={busy} onClick={() => onRetry(currentScene.id)} className="flex items-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2 text-[12px] font-bold text-[#11150D] disabled:opacity-40">
                      <RotateCw className="h-3.5 w-3.5" />Try Again {!regenerateIsFree && <OpCostBadge credits={regenerateCredits} />}
                    </button>
                  )}
                  {canAct && (
                    <button disabled={busy} onClick={() => onRetry(currentScene.id)} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-bold disabled:opacity-40 ${isGraphic && canManuallyApproveScene(card.status.key) ? "bg-lime-300 text-[#11150D]" : "border border-white/10 font-semibold text-white hover:bg-white/5"}`}>
                      <RotateCw className="h-3.5 w-3.5" />{isGraphic ? "Try Another Layout" : "Regenerate"} {!regenerateIsFree && <OpCostBadge credits={regenerateCredits} />}
                    </button>
                  )}
                  {canAct && !isGraphic && (
                    <button disabled={busy} onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-semibold text-white hover:bg-white/5 disabled:opacity-40">
                      <Pencil className="h-3.5 w-3.5" />Edit Scene <OpCostBadge credits={editCredits} />
                    </button>
                  )}
                  {canAct && card.weakEditDelta && (
                    <button disabled={busy} onClick={() => onEscalate(currentScene.id)} className="flex items-center gap-1.5 rounded-lg border border-sky-400/30 bg-sky-400/[0.08] px-3 py-2 text-[12px] font-semibold text-sky-200 hover:bg-sky-400/[0.14] disabled:opacity-40">
                      <Sparkles className="h-3.5 w-3.5" />Try as New Scene <OpCostBadge credits={escalateCredits} />
                    </button>
                  )}
                  {/* 2026-09-22 "FINAL stabilization pass" §0/§10 — overlays
                      are a separate, zero-cost, user-controllable layer:
                      removing one never regenerates the base image. Shown
                      only for a currently-ready scene that actually has an
                      overlay applied right now. */}
                  {card.status.key === "ready" && currentScene?.overlay_applied && !viewingHistory && (
                    <button disabled={busy} onClick={() => onDisableOverlay(currentScene.id)} className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[12px] font-semibold text-white hover:bg-white/5 disabled:opacity-40">
                      <Layers className="h-3.5 w-3.5" />Remove Overlay
                    </button>
                  )}
                </div>
              ))}
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Fullscreen image lightbox (Part 13) — a separate, image-focused
          view; the modal above never grows to fill this role itself. */}
      <Dialog open={lightboxOpen} onClose={() => setLightboxOpen(false)} className="relative z-[110]">
        <DialogBackdrop className="fixed inset-0 bg-black/90" />
        <div className="fixed inset-0 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          {previewUrl && <img src={previewUrl} alt="" className="max-h-full max-w-full object-contain" />}
          <button onClick={() => setLightboxOpen(false)} aria-label="Close fullscreen" className="absolute right-4 top-4 rounded-lg bg-black/60 p-2 text-white/80 hover:bg-black/80 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
      </Dialog>
    </>
  );
}

/* ============================ Rebuild Episode Visuals modal ============================ */
// Part 1-3/11 (2026-09-15 "safe full-episode rebuild" pass). A SEPARATE,
// explicit tier choice from the main sidebar's `tier` state — Part 11 is
// explicit that the previous run's tier is only a convenience DEFAULT, not
// an inherited/locked value; changing it here never touches the main
// sidebar's own (locked, already-generated) tier selection. `estimates` is
// the SAME server-derived map (estimate_long_form_episode_credits, per
// tier) the main Generate Episode flow already fetches — no independent
// pricing math, exactly Part 3's requirement.
function RebuildEpisodeModal({ open, onClose, estimates, progress, previousTier, previousCredits, onConfirm, busy, error }) {
  const [rebuildTier, setRebuildTier] = useState(previousTier);
  useEffect(() => { if (open) setRebuildTier(previousTier); }, [open, previousTier]);
  const estimate = estimates[rebuildTier];
  const totalCredits = estimate?.totalCredits ?? null;

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} className="relative z-[100]">
      <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101213] p-5">
          <DialogTitle className="text-lg font-semibold text-white">Rebuild all episode visuals?</DialogTitle>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">
            Zyvo will create a new set of scene visuals using the latest storyboard, Visual Plan, semantic contracts and generation logic.
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">Your current visuals will stay in history.</p>
          <p className="mt-2 text-[12px] font-medium text-amber-200/80">Previously spent credits are not refunded.</p>

          <div className="mt-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/50">Image Quality</h3>
            <div className="mt-2.5"><CompactTierSelector tier={rebuildTier} locked={false} onSelect={setRebuildTier} /></div>
          </div>

          <div className="mt-4 border-t border-white/[0.06] pt-3">
            <dl className="space-y-1 text-[12px]">
              <div className="flex justify-between"><dt className="text-white/40">Scenes</dt><dd className="font-semibold text-white/80">{progress.total}</dd></div>
              {estimate?.breakdown && (
                <>
                  <div className="flex justify-between"><dt className="text-white/40">New AI renders</dt><dd className="text-white/60">{estimate.breakdown.freshGenerations}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/40">AI edits</dt><dd className="text-white/60">{estimate.breakdown.edits}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/40">Derived visuals</dt><dd className="text-white/60">{estimate.breakdown.reused + estimate.breakdown.crops}</dd></div>
                  <div className="flex justify-between"><dt className="text-white/40">Graphics</dt><dd className="text-white/60">{estimate.breakdown.graphics}</dd></div>
                </>
              )}
            </dl>
            <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-2">
              <span className="text-[12px] font-semibold text-white/60">New generation cost</span>
              <OpCostBadge credits={totalCredits} />
            </div>
            <p className="mt-1.5 text-[10px] text-white/30">Your previous generation ({previousCredits} credits) will remain in history.</p>
          </div>

          {error && <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-2.5 text-[11.5px] text-red-200">{customerVisualMessage(error)}</div>}

          <div className="mt-5 flex gap-2">
            <button disabled={busy} onClick={onClose} className="flex-1 rounded-lg border border-white/10 px-3 py-2.5 text-[13px] font-semibold text-white/60 hover:bg-white/5 disabled:opacity-40">Cancel</button>
            <button disabled={busy || totalCredits == null} onClick={() => onConfirm(rebuildTier)} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-lime-300 px-3 py-2.5 text-[13px] font-bold text-[#11150D] disabled:opacity-40">
              Rebuild Episode <OpCostBadge credits={totalCredits} />
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/* ============================ Main workspace ============================ */
const FIX_STORYBOARD_PROGRESS_MESSAGES = [
  "Improving repetitive scenes…",
  "Combining overly short visual moments…",
  "Creating clearer visual progression…",
  "Checking the repaired storyboard…",
];

export default function GenerateWorkspace({
  project, visualPlanRow, visualWorld, entities = [], assets = [], plans = [], scenes = [], episodeCharge,
  loading = false, busy = false, error, onTierChange, onGenerateEpisode, onRebuildEpisode, onGenerateTestSample, onRetryScene, onEditScene, onEscalateScene, onApproveSceneAnyway, onDisableSceneOverlay, onBackToVisualWorld, onGoToStoryboard, onFixStoryboard,
  onPauseGeneration, onContinueGeneration, onAdvanceChapterGate,
  resumeState = null,
}) {
  const isPaused = Boolean(episodeCharge?.is_paused);
  const [mobileControls, setMobileControls] = useState(true);
  const [tier, setTier] = useState(project?.scene_generation_tier || DEFAULT_SCENE_GENERATION_TIER);
  // 2026-09-22 chapter-by-chapter testing gate — opt-in checkbox shown only
  // before the paid Generate action commits. Never changes what's charged
  // (still the full episode, exactly once); only paces provider dispatch so
  // a systemic problem surfaces after one chapter instead of the whole run.
  const [chapterGate, setChapterGate] = useState(false);
  const [estimates, setEstimates] = useState({});
  const [generationQuotes, setGenerationQuotes] = useState({ episode: {}, chapter: {} });
  const [openSheet, setOpenSheet] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [openSceneBeatId, setOpenSceneBeatId] = useState(null);
  const [noCreditsOpen, setNoCreditsOpen] = useState(false);
  const [noCreditsNeeded, setNoCreditsNeeded] = useState(0);
  const [filter, setFilter] = useState("all");
  const [sceneOpEstimates, setSceneOpEstimates] = useState({});
  const [justCommitted, setJustCommitted] = useState(false);
  const [rebuildModalOpen, setRebuildModalOpen] = useState(false);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [rebuildError, setRebuildError] = useState(null);
  // 2026-09-22 "Fix Storyboard" one-click targeted repair state.
  const [fixingStoryboard, setFixingStoryboard] = useState(false);
  const [fixProgressIndex, setFixProgressIndex] = useState(0);
  const [fixResult, setFixResult] = useState(null);
  // 2026-09-23 "systemic production stabilization" pass, Item E — "Generate
  // Test Sample" state. sampleQuote is read-only (never a charge); sampleRun
  // tracks the real dispatch outcome once the user actually clicks it. Real
  // rationale for this whole feature: "This exact Chapter 1 generation would
  // have revealed our remaining style/graphics bugs for a few credits
  // instead of us generating the chapter."
  const [sampleQuote, setSampleQuote] = useState(null);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleRun, setSampleRun] = useState(null);
  const [sampleError, setSampleError] = useState(null);
  const creditBalance = useProfileCredits();

  useEffect(() => { if (project?.scene_generation_tier) setTier(project.scene_generation_tier); }, [project?.scene_generation_tier]);
  useEffect(() => {
    if (!fixingStoryboard) return;
    const id = setInterval(() => setFixProgressIndex((i) => (i + 1) % FIX_STORYBOARD_PROGRESS_MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, [fixingStoryboard]);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    Promise.all(SCENE_GENERATION_TIERS.map((t) => estimateLongFormSceneCredits(project.id, t.id).then((e) => [t.id, e]).catch(() => [t.id, null])))
      .then((pairs) => { if (!cancelled) setEstimates(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [project?.id, plans.length]);

  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;
    Promise.all(SCENE_GENERATION_TIERS.flatMap((t) => [
      quoteLongFormGeneration(project.id, t.id, false).then((q) => ["episode", t.id, q]).catch((e) => ["episode", t.id, { ready: false, message: e.message }]),
      quoteLongFormGeneration(project.id, t.id, true).then((q) => ["chapter", t.id, q]).catch((e) => ["chapter", t.id, { ready: false, message: e.message }]),
    ])).then((rows) => {
      if (cancelled) return;
      const next = { episode: {}, chapter: {} };
      for (const [scope, id, quote] of rows) next[scope][id] = quote;
      setGenerationQuotes(next);
    });
    return () => { cancelled = true; };
  }, [project?.id, plans.length, scenes.length, scenes.map((s) => `${s.id}:${s.status}:${s.qa_status ?? ""}`).join("|")]);

  // 2026-09-23 "systemic production stabilization" pass, Item E — read-only
  // quote for "Generate Test Sample," refetched whenever the compiled plan
  // or tier changes. Never fetched once a real chapter/episode charge is
  // already active (isEpisodeGenerationCommitted below already hides the
  // button in that case; skipping the fetch too avoids a pointless call).
  useEffect(() => {
    if (!project?.id || episodeCharge) { setSampleQuote(null); return; }
    let cancelled = false;
    quoteTestSample(project.id, tier).then((q) => { if (!cancelled) setSampleQuote(q); }).catch(() => { if (!cancelled) setSampleQuote(null); });
    return () => { cancelled = true; };
  }, [project?.id, tier, episodeCharge, plans.length]);

  // 2026-09-19 forensic fix (real Mars incident, Part 5): the SAME
  // authoritative resolver every other Long Form entry point already uses.
  // route !== "generate" means the CURRENT plan+world pairing genuinely has
  // no compiled scenes to show yet (a replan was adopted, or Visual World
  // needs new references) — the real Mars bug this fixes shipped "136
  // Planned / 0% processed / Waiting to render" with zero explanation, next
  // to an old, unrelated charge that made the page LOOK like a generation
  // run existed. `resumeState` is null while it's still loading — never
  // treated as blocked in that gap.
  const authoritativeReadiness = generationQuotes.episode[tier];
  const planNeedsVisualWorldSetup = authoritativeReadiness && !authoritativeReadiness.ready;
  // 2026-09-22 "structured readiness issues" fix — real Atlantis incident:
  // every blocker (storyboard duplicate-visual collisions, scene-plan
  // compile failures, a genuinely unready Visual World) used to collapse
  // into one hardcoded "Visual World needs attention" / "Update Visual
  // World" card, sending the user to a page that was already fully ready
  // and fixing nothing. `issues` is the backend's own subsystem-classified
  // list (generationReadiness.ts) — each renders its own title/message/CTA,
  // and the CTA's destination is derived from recommendedAction, never
  // hardcoded to Visual World. The single-issue fallback only covers a
  // stale cached response from before this field existed.
  const readinessIssues = authoritativeReadiness?.issues?.length
    ? authoritativeReadiness.issues
    : planNeedsVisualWorldSetup
      ? [{ code: "UNKNOWN", subsystem: "visual_world", title: "Visual World needs attention", message: authoritativeReadiness?.message || "The current episode is not ready to generate.", affectedBeatIds: [], recommendedAction: "UPDATE_VISUAL_WORLD" }]
      : [];
  const currentScoped = useMemo(() => selectCurrentVisualWorldAssets(entities, assets), [entities, assets]);
  const referenceProgressInfo = useMemo(() => referenceProgress(assets, entities), [assets, entities]);
  const worldReady = authoritativeReadiness?.ready === true;

  const characterSheets = useMemo(() => {
    const byEntity = new Map(entities.map((e) => [e.entityId, e]));
    return currentScoped
      .filter((a) => a.reference_type === "character_reference" && a.angle_or_view === "character_reference_sheet" && a.result_url)
      .map((a) => ({ id: a.id, result_url: a.result_url, name: byEntity.get(a.entity_id)?.entityName ?? "Character" }));
  }, [currentScoped, entities]);

  const entityRegistryById = useMemo(() => new Map((visualPlanRow?.entity_registry ?? []).map((e) => [e.id, e])), [visualPlanRow]);
  const scenesByBeatId = useMemo(() => {
    const replaced = new Set(scenes.map((s) => s.replaces_scene_id).filter(Boolean));
    const map = new Map();
    for (const s of scenes) { if (!replaced.has(s.id)) map.set(s.visual_beat_id, s); }
    return map;
  }, [scenes]);
  const plansByBeatId = useMemo(() => new Map(plans.map((p) => [p.visual_beat_id, p])), [plans]);
  const visualBeats = visualPlanRow?.visual_plan?.visualBeats ?? [];
  const sceneCards = useMemo(() => buildSceneCards(visualBeats, entityRegistryById, scenesByBeatId, plansByBeatId, isPaused), [visualBeats, entityRegistryById, scenesByBeatId, plansByBeatId, isPaused]);
  const progress = useMemo(() => summarizeSceneProgress(sceneCards), [sceneCards]);
  // Part 9: real processed % (never estimated from elapsed time) — a scene
  // is "processed" once it has reached ANY terminal-for-the-user state
  // (ready, needs review, or failed), regardless of whether the user still
  // has to act on it.
  const processedPct = progress.total ? Math.floor(((progress.ready + progress.needsReview + progress.failed) / progress.total) * 100) : 0;
  const pct = (n) => (progress.total ? Math.round((n / progress.total) * 100) : 0);
  const queuedCount = useMemo(() => sceneCards.filter((c) => ["queued", "starting"].includes(c.status.key)).length, [sceneCards]);
  const generatingCount = useMemo(() => sceneCards.filter((c) => ["generating", "compositing", "checking"].includes(c.status.key)).length, [sceneCards]);
  const progressPhase = useMemo(() => deriveEpisodeProgressPhase(progress), [progress]);
  const filteredCards = useMemo(() => filterSceneCards(sceneCards, filter), [sceneCards, filter]);
  const groups = useMemo(() => groupScenesForBoard(filteredCards), [filteredCards]);

  // Item 7 of the 2026-09-19 "fix the production workflow" pass: episodeQA.ts
  // (built in an earlier pass) has always found real, previously-invisible
  // patterns in Mars's own data — but nothing surfaced it to the user. This
  // reuses the exact same pure, deterministic, zero-provider-cost function
  // the backend already has, keyed by beat id (not scene id) so a click can
  // scroll straight to the matching SceneCard's own DOM id below with no
  // extra id-mapping step.
  const episodeQaInputs = useMemo(() => {
    const inputs = [];
    for (const beat of visualBeats) {
      const scene = scenesByBeatId.get(beat.id);
      const plan = plansByBeatId.get(beat.id);
      if (!scene || !plan) continue; // nothing compiled/dispatched yet for this beat — no output to check
      inputs.push({
        id: beat.id,
        sequenceIndex: beat.sequenceIndex,
        renderStrategy: plan.render_strategy,
        baseSetupKey: plan.base_setup_key,
        resultUrl: resolveSceneDisplayUrl(scene),
        status: scene.status,
        startSeconds: plan.start_seconds,
        endSeconds: plan.end_seconds,
        graphicTemplate: plan.overlay_spec?.template ?? null,
        // §5: the compiled focal subject — used to detect a run of
        // consecutive shots that collapse to the same visual concept
        // despite covering materially different narration moments.
        focalSubject: plan.composition?.focalSubject ?? null,
        sceneType: plan.scene_type ?? null,
      });
    }
    return inputs;
  }, [visualBeats, scenesByBeatId, plansByBeatId]);
  // 2026-09-22 "quality warning must not lie" fix — real incident: "Visual
  // variety needs attention · 1 shot with no output detected" appeared
  // while that shot was still queued/generating, not actually broken —
  // MISSING_FRAMES only checks status==='failed', which is momentarily true
  // for a scene about to be retried, not just a permanently stuck one.
  // "No output yet" during active rendering is operational state, never a
  // quality finding — only run these diagnostics once nothing in this run
  // is still actively being produced (matches this same file's own
  // ACTIVE_STATUS_KEYS + queued/planned vocabulary).
  const stillActivelyProducing = sceneCards.some((c) => ["queued", "starting", "generating", "compositing", "checking", "planned"].includes(c.status.key));
  const episodeWarnings = useMemo(() => (stillActivelyProducing ? [] : runEpisodeQA(episodeQaInputs)), [episodeQaInputs, stillActivelyProducing]);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const attentionBeatIds = useMemo(() => new Set(episodeWarnings.flatMap((w) => w.affectedSceneIds)), [episodeWarnings]);
  // Plain-language buckets — the user never sees a failureType/warning code,
  // only counts of the kind of problem it represents (Part 7: "do not dump
  // engineering jargon on the user").
  const attentionSummary = useMemo(() => {
    const bucketOf = (code) => (code === "REPEATED_SETUP_RUN" || code === "EXCESSIVE_EDIT_LINEAGE") ? "repeated sequence" : (code === "GRAPHIC_CLUSTERING" || code === "ADJACENT_TEXT_EMPHASIS") ? "graphic cluster" : code === "EXACT_DUPLICATE_OUTPUT" ? "duplicate scene" : code === "MISSING_FRAMES" ? "shot with no output" : null;
    const counts = new Map();
    for (const w of episodeWarnings) {
      const bucket = bucketOf(w.code);
      if (!bucket) continue;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, n]) => `${n} ${label}${n === 1 ? "" : "s"} detected`);
  }, [episodeWarnings]);
  const jumpToAttention = () => {
    setAttentionOpen(true);
    const firstId = episodeWarnings[0]?.affectedSceneIds?.[0];
    if (firstId) document.getElementById(`scene-card-${firstId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const openCard = sceneCards.find((c) => c.beatId === openSceneBeatId) ?? null;

  // Part 6/7: the exact server-derived per-operation price for whichever
  // scene's modal is currently open — the SAME source retry_long_form_scene/
  // edit_long_form_scene consult before actually charging, so these badges
  // can never show a number different from what gets debited. openCard.
  // sceneId is already the CURRENT (non-replaced) scene for this beat (see
  // scenesByBeatId above), matching exactly what the modal itself resolves
  // as currentScene via buildSceneHistory.
  useEffect(() => {
    const sceneId = openCard?.sceneId;
    if (!sceneId) { setSceneOpEstimates({}); return; }
    let cancelled = false;
    Promise.all([
      estimateSceneOperationCredits(sceneId, "regenerate").catch(() => null),
      estimateSceneOperationCredits(sceneId, "edit").catch(() => null),
      // Part 5: only priced when it's actually offered (an EDIT whose own
      // perceptual-hash QA came back near-identical to its source) — a
      // wasted RPC call for the common case otherwise.
      openCard?.weakEditDelta ? estimateSceneOperationCredits(sceneId, "escalate_generate").catch(() => null) : Promise.resolve(null),
    ]).then(([regenerate, edit, escalate]) => { if (!cancelled) setSceneOpEstimates({ regenerate, edit, escalate }); });
    return () => { cancelled = true; };
  }, [openCard?.sceneId, openCard?.weakEditDelta]);

  const effectiveChapterMode = Boolean(episodeCharge?.chapter_gate_enabled || chapterGate);
  const activeGenerationQuote = generationQuotes[effectiveChapterMode ? "chapter" : "episode"][tier];
  const estimate = estimates[tier];
  const totalCredits = activeGenerationQuote?.totalCredits ?? null;
  // THE authoritative "has the user actually pressed the paid Generate
  // Episode action" signal — a real, charged long_form_episode_generation_
  // charges row. Never derived from scene rows existing: a handful of
  // controlled-test scenes (created directly against the backend, never
  // through this paid action) must NOT lock the tier picker or hide the
  // real Generate CTA — see sceneCardModel.js's summarizeSceneProgress
  // comment on why `progress.started` is deliberately excluded here.
  const episodeGenerationCommitted = isEpisodeGenerationCommitted(episodeCharge);
  // 2026-09-22 chapter-by-chapter testing gate — purely derived from data
  // already on the page (episodeCharge's boundary + each card's own
  // sequenceIndex), no new shared status machine. "Done" means every card
  // AT OR BEFORE the boundary reached ready/needs_review/failed; scenes
  // past the boundary already exist as compiled-but-unclaimed rows, so they
  // still show up as queued/planned cards until the next chapter is opened.
  const chapterGateBoundary = episodeCharge?.chapter_gate_enabled ? episodeCharge?.chapter_gate_boundary_sequence_index ?? null : null;
  const chapterGateActive = chapterGateBoundary != null;
  const chapterGateWithin = useMemo(() => (chapterGateActive ? sceneCards.filter((c) => c.sequenceIndex <= chapterGateBoundary) : []), [sceneCards, chapterGateActive, chapterGateBoundary]);
  const chapterGateBeyond = useMemo(() => (chapterGateActive ? sceneCards.filter((c) => c.sequenceIndex > chapterGateBoundary) : []), [sceneCards, chapterGateActive, chapterGateBoundary]);
  // 2026-09-19 "premium active-generation UI" pass: THE one selector every
  // production-state UI on this page reads from (hero, sidebar mini-status,
  // scene card production states all derive from this same object) — see
  // item 10's explicit "do not invent a parallel frontend state machine".
  //
  // 2026-09-23 "root-contract stabilization" pass — real Atlantis finding:
  // this always scored the FULL 126-card episode even while a chapter-gated
  // run had only authorized/opened one chapter's boundary (15 cards) — the
  // hero showed "Creating your episode / 0 of 126 visuals ready" for a run
  // that could only ever produce 15. When a chapter gate is active, scope
  // progress to exactly the cards within its own boundary — the same set
  // chapterGateWithin already computes for the "chapter done" check above —
  // so the count, percentage, and phase all describe the ACTUAL authorized
  // work, never the whole plan's eventual total.
  const genProgress = useMemo(
    () => deriveEpisodeGenerationProgress(chapterGateActive ? chapterGateWithin : sceneCards, { hasActiveRun: episodeGenerationCommitted, isPaused }),
    [sceneCards, chapterGateActive, chapterGateWithin, episodeGenerationCommitted, isPaused],
  );
  const chapterGateCurrentDone = chapterGateActive && chapterGateWithin.length > 0 && chapterGateWithin.every((c) => ["ready", "needs_review", "failed"].includes(c.status.key));
  const chapterGateHasNext = chapterGateBeyond.length > 0;
  const chapterGateWaitingForNext = chapterGateActive && chapterGateCurrentDone && chapterGateHasNext && !isPaused;
  const needsReviewBlocking = false;
  const chapterScopeAvailable = effectiveChapterMode && activeGenerationQuote?.ready && !activeGenerationQuote?.inProgress && !activeGenerationQuote?.complete;
  const generateDisabled = loading || busy || !worldReady || totalCredits == null || (episodeGenerationCommitted && !chapterScopeAvailable);

  const handleSelectTier = (id) => {
    if (episodeGenerationCommitted) return;
    setTier(id);
    onTierChange?.(id);
  };

  const handleGenerate = async () => {
    setMobileControls(false);
    if (generateDisabled) return;
    if (creditBalance < totalCredits) { setNoCreditsNeeded(totalCredits); setNoCreditsOpen(true); return; }
    const result = await onGenerateEpisode?.(tier, effectiveChapterMode);
    // 2026-09-19 billing-incident fix (real Mars report: displayed balance
    // dropped by 242 credits even though the server call failed and the
    // real DB balance never moved). emitCreditSpend used to fire BEFORE
    // this await, unconditionally, with no rollback on failure — the
    // optimistic pending-spend in useProfileCredits then had nothing to
    // reconcile against (no real balance decrease ever landed) and stayed
    // wrong until a full reload. Fire it only on a confirmed success, from
    // the server's own creditsCharged (0 on an idempotent already-charged
    // replay), exactly like every scene-op handler below already does.
    if (result?.ok) {
      if (result.creditsCharged && !result.alreadyCharged) emitCreditSpend(result.creditsCharged, "Long Form episode");
      // Part 5: the moment the charge succeeds, show an immediate, unambiguous
      // confirmation that real production has begun — never a silent
      // transition straight to the (much slower to visibly change) scene
      // grid, which reads as "did anything actually happen?".
      setJustCommitted(true); setTimeout(() => setJustCommitted(false), 4000);
    }
  };

  // Part 1-3/10/12 (safe full-episode rebuild): identical shape to
  // handleGenerate — server-authoritative price precheck, emitCreditSpend on
  // confirm, close the modal + switch views only on a real success. The
  // active-run pointer this rebuild expects to supersede is captured HERE
  // (episodeCharge?.id, read at the moment the user actually clicks
  // confirm) and sent to the server, which rejects with a clear error if the
  // active run has changed since the modal opened rather than rebuilding
  // the wrong thing (Part 13).
  const handleRebuild = async (rebuildTier) => {
    const rebuildEstimate = estimates[rebuildTier];
    const need = rebuildEstimate?.totalCredits;
    if (need == null) return;
    if (creditBalance < need) { setNoCreditsNeeded(need); setNoCreditsOpen(true); return; }
    setRebuildBusy(true);
    setRebuildError(null);
    try {
      const result = await onRebuildEpisode?.(rebuildTier, episodeCharge?.id);
      if (result?.ok) {
        if (result.creditsCharged && !result.alreadyCharged) emitCreditSpend(result.creditsCharged, "Episode rebuild");
        setRebuildModalOpen(false);
        setJustCommitted(true);
        setTimeout(() => setJustCommitted(false), 4000);
      } else {
        setRebuildError(result?.message || "Couldn't start the rebuild. Please try again.");
      }
    } finally { setRebuildBusy(false); }
  };

  // Part 8/9: same balance-precheck + emitCreditSpend pattern as episode
  // generation, applied to individual scene operations. The actual charge
  // still happens server-side inside retry_long_form_scene/edit_long_form_
  // scene — this pre-check only avoids dispatching a call the user can't
  // afford; emitCreditSpend fires from the REAL creditsCharged the server
  // returned (0 if a pre-dispatch failure was resumed for free, or a
  // double-click hit the idempotent early return), never the estimate.
  const handleRetryScene = async (sceneId) => {
    const need = sceneOpEstimates.regenerate?.credits;
    if (need != null && creditBalance < need) { setNoCreditsNeeded(need); setNoCreditsOpen(true); return; }
    const result = await onRetryScene?.(sceneId);
    if (result?.creditsCharged) emitCreditSpend(result.creditsCharged, "Scene regenerate");
  };

  const handleEditScene = async (sceneId, instruction) => {
    const need = sceneOpEstimates.edit?.credits;
    if (need != null && creditBalance < need) { setNoCreditsNeeded(need); setNoCreditsOpen(true); return; }
    const result = await onEditScene?.(sceneId, instruction);
    if (result?.creditsCharged) emitCreditSpend(result.creditsCharged, "Scene edit");
  };

  const handleEscalateScene = async (sceneId) => {
    const need = sceneOpEstimates.escalate?.credits;
    if (need != null && creditBalance < need) { setNoCreditsNeeded(need); setNoCreditsOpen(true); return; }
    const result = await onEscalateScene?.(sceneId);
    if (result?.creditsCharged) emitCreditSpend(result.creditsCharged, "Scene → new scene");
  };

  const jumpToNeedsReview = () => {
    setFilter("needs_review");
    requestAnimationFrame(() => document.getElementById("scene-groups-top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  // 2026-09-22 "Fix Storyboard" one-click targeted repair. Runs in place —
  // no navigation, no provider calls, no credits. `perform` (the caller in
  // generate.jsx) already bumps `revision` on any result, so a genuinely
  // applied repair's new adopted VisualPlan version is picked up by the next
  // poll on its own; this only needs to track its OWN busy/result state for
  // the progress messages and the outcome banner.
  const handleFixStoryboard = async () => {
    setFixingStoryboard(true);
    setFixProgressIndex(0);
    setFixResult(null);
    try {
      const result = await onFixStoryboard?.();
      setFixResult(result?.ok ? result : { ok: false, message: result?.message || "Couldn't repair the storyboard." });
    } finally {
      setFixingStoryboard(false);
    }
  };

  // 2026-09-23 "systemic production stabilization" pass, Item E — charges
  // ONLY the server-selected sample beats (Chapter 1 / the full episode stay
  // completely unauthorized). Same balance-precheck + emitCreditSpend
  // pattern as every other paid scene-level action in this component.
  const handleGenerateTestSample = async () => {
    const need = sampleQuote?.estimatedSampleCredits ?? 0;
    if (need > 0 && creditBalance < need) { setNoCreditsNeeded(need); setNoCreditsOpen(true); return; }
    setSampleBusy(true);
    setSampleError(null);
    try {
      const result = await onGenerateTestSample?.();
      if (!result?.ok) { setSampleError(result?.message || "Couldn't start the test sample."); return; }
      if (result.creditsCharged && !result.alreadyCharged) emitCreditSpend(result.creditsCharged, "Test sample");
      setSampleRun(result);
    } finally {
      setSampleBusy(false);
    }
  };

  const chapterNumber = Number(activeGenerationQuote?.chapterIndex ?? 0) + 1;
  const cta = !worldReady ? "Visuals not ready" : effectiveChapterMode ? `Generate Chapter ${chapterNumber}` : "Generate Episode";
  // 2026-09-23 Item E — a secondary action ABOVE the main Generate CTA,
  // never competing with it visually (outlined, not the lime/black primary
  // treatment). Hidden once a real chapter/episode charge exists — a sample
  // only ever makes sense BEFORE that commitment, and
  // charge_long_form_sample_generation would refuse it anyway
  // (GENERATION_ALREADY_ACTIVE) at that point.
  const sampleButton = worldReady && !needsReviewBlocking && !episodeCharge && (
    <div className="mb-2.5 w-full">
      {sampleRun ? (
        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/25 bg-lime-300/[0.06] px-3.5 py-2.5 text-center text-[12px] font-bold text-lime-300">
          <Check className="h-3.5 w-3.5" /> Test Sample Ready — inspect it below, then generate {effectiveChapterMode ? `Chapter ${chapterNumber}` : "the episode"} when ready.
        </div>
      ) : (
        <>
          <button type="button" onClick={handleGenerateTestSample} disabled={sampleBusy || busy || !sampleQuote?.sampleScenes?.length}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-3.5 py-2.5 text-[12px] font-bold text-white/80 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40">
            {sampleBusy ? "Starting test sample…" : "Generate Test Sample"}
            {!sampleBusy && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-white/60">
                <CreditIcon /> {sampleQuote ? sampleQuote.estimatedSampleCredits : "…"}
              </span>
            )}
          </button>
          <p className="mt-1 text-center text-[10px] text-white/35">Create a few representative visuals before generating the {effectiveChapterMode ? "chapter" : "episode"}.</p>
          {sampleError && <p className="mt-1 text-center text-[10px] text-amber-300">{sampleError}</p>}
        </>
      )}
    </div>
  );
  const generateButton = (
    <div className="w-full">
      {worldReady && !needsReviewBlocking && (
        <label className="mb-2 flex cursor-pointer items-start gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left">
          <input type="checkbox" checked={chapterGate} onChange={(e) => setChapterGate(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-lime-300" />
          <span className="text-[11px] leading-snug text-white/50">
            <span className="font-semibold text-white/70">Generate one chapter at a time</span> — generates Chapter {chapterNumber} only. You'll review it before continuing.
          </span>
        </label>
      )}
      <button type="button" onClick={handleGenerate} disabled={generateDisabled} className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-[13px] font-black transition ${generateDisabled ? "cursor-not-allowed bg-lime-300/15 text-lime-300/40" : "bg-lime-300 text-[#11150D] hover:bg-lime-200"}`}>
        {cta}
        {worldReady && !needsReviewBlocking && (
          <span className="flex items-center gap-1 text-[13px] font-semibold">
            <CreditIcon />
            {totalCredits == null ? "…" : totalCredits}
          </span>
        )}
        <ChevronRight className="h-4 w-4" />
      </button>
      {/* Part 4: removes any ambiguity about what the charge buys — this is
          never "pay N credits for a timeline", it is the full episode.
          Normal mode keeps this EXACT sentence unchanged (generateEpisodeExecution.test.mjs
          Q) — chapter mode gets its own, separate, chapter-scoped sentence. */}
      {worldReady && !needsReviewBlocking && effectiveChapterMode && (
        <p className="mt-1.5 text-center text-[10px] text-white/30">Generates Chapter {chapterNumber} only — {activeGenerationQuote?.outstandingVisuals ?? 0} outstanding visuals. You'll review it before continuing.</p>
      )}
      {worldReady && !needsReviewBlocking && !effectiveChapterMode && (
        <p className="mt-1.5 text-center text-[10px] text-white/30">Creates all {progress.total} episode visuals.</p>
      )}
    </div>
  );

  // Part 1 (safe full-episode rebuild): a secondary, outlined action — never
  // competing visually with productionStatus's own lime/amber primary
  // treatment above it — offered only once a real generation run exists.
  const rebuildTrigger = episodeGenerationCommitted && (
    <button type="button" onClick={() => setRebuildModalOpen(true)} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-[12px] font-semibold text-white/60 transition hover:bg-white/5">
      Rebuild Episode Visuals <RotateCw className="h-3.5 w-3.5" />
    </button>
  );

  // Once the episode is genuinely committed, the sticky action stops being
  // a button — it becomes a compact live-status readout that always tells
  // the user their next action (Part 3), never a dead "Generation started"
  // block and never a second Generate control. Part 5: the instant after a
  // successful charge, this briefly shows an unambiguous confirmation
  // ("Generation started ✓") before settling into the live per-scene
  // readout — the charge and the start of real production are the same
  // moment, and the UI says so immediately rather than leaving a silent gap.
  // 2026-09-19 "premium active-generation UI" pass (item 9): the sidebar's
  // mini-status now reads from the EXACT SAME genProgress object as the main
  // hero panel below — same phase, same processedPct, same counts — so the
  // two can never disagree about what's happening.
  const SIDEBAR_PHASE_LABEL = { compiling: "Preparing…", rendering: "Generating…", checking: "Checking visuals…", needs_review: "Needs review", ready: "Generation complete", paused: "Paused" };
  const productionStatus = (() => {
    if (justCommitted) {
      return (
        <div className="w-full rounded-xl border border-lime-300/25 bg-lime-300/[0.08] px-4 py-3 text-center text-[13px] font-bold text-lime-300">Generation started ✓</div>
      );
    }
    // 2026-09-22 chapter-by-chapter testing gate: the current chapter's
    // visuals are all done (ready/needs review/failed) and there's more of
    // the episode still waiting behind the boundary — surface this as its
    // own explicit next-step CTA rather than letting it look like the run
    // silently stalled.
    if (episodeCharge?.chapter_gate_enabled && activeGenerationQuote?.complete) {
      return <div className="w-full rounded-xl border border-lime-300/25 bg-lime-300/[0.08] px-4 py-3 text-center text-[13px] font-bold text-lime-300">All visuals complete ✓</div>;
    }
    if (episodeCharge?.chapter_gate_enabled && activeGenerationQuote?.inProgress) {
      return (
        <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between gap-2"><span className="text-[12px] font-bold text-white">Testing mode · Creating Chapter {chapterNumber}</span><span className="text-[11px] text-white/50">{activeGenerationQuote.processedVisuals ?? 0} / {activeGenerationQuote.totalVisuals ?? 0}</span></div>
          <p className="mt-1 text-[10px] text-white/35">One chapter at a time</p>
        </div>
      );
    }
    if (episodeCharge?.chapter_gate_enabled && chapterScopeAvailable) {
      return (
        <button type="button" onClick={handleGenerate} disabled={generateDisabled} className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/10 px-4 py-3.5 text-[13px] font-bold text-lime-300 transition hover:bg-lime-300/[0.18] disabled:opacity-50">
          Generate Chapter {chapterNumber} <CreditIcon /> {totalCredits ?? "…"} <ChevronRight className="h-4 w-4" />
        </button>
      );
    }
    // 2026-09-21 emergency pause feature: calm/neutral, never the amber
    // "needs review" alarm treatment — a deliberate pause is not a problem.
    if (genProgress.phase === "paused") {
      return (
        <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-white"><PauseIcon className="h-3.5 w-3.5 text-white/60" />Generation paused</span>
            <span className="text-[11px] font-semibold text-white/50">{genProgress.ready} / {genProgress.total} ready</span>
          </div>
          <button type="button" onClick={onContinueGeneration} disabled={busy}
            className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-lime-300/30 bg-lime-300/10 px-3 py-2 text-[12px] font-bold text-lime-300 transition hover:bg-lime-300/[0.18] disabled:opacity-50">
            <PlayIcon className="h-3.5 w-3.5" /> Continue Generation
          </button>
        </div>
      );
    }
    if (genProgress.phase === "needs_review" && genProgress.needsReview > 0) {
      return <button type="button" onClick={jumpToNeedsReview} className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3.5 text-[13px] font-bold text-amber-200 transition hover:bg-amber-400/[0.14]">Review {genProgress.needsReview} scene{genProgress.needsReview === 1 ? "" : "s"} <ChevronRight className="h-4 w-4" /></button>;
    }
    if (genProgress.phase === "ready") {
      // ready — every required scene approved. The Edit stage isn't built yet
      // (deliberately out of scope here), so this stays an informational
      // next-step indicator rather than a link to a page that doesn't exist.
      return (
        <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime-300/25 bg-lime-300/[0.08] px-4 py-3.5 text-[13px] font-bold text-lime-300">
          Continue to Edit <ChevronRight className="h-4 w-4" />
        </div>
      );
    }
    // compiling / rendering / checking — active production. A compact mini
    // progress bar + real phase label, same source of truth as the hero.
    return (
      <div className="w-full rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-bold text-white"><Orbit className="lf-gen-core h-3.5 w-3.5 text-lime-300" />Episode generation</span>
          <span className="text-[11px] font-semibold text-white/50">{SIDEBAR_PHASE_LABEL[genProgress.phase]}</span>
        </div>
        <p className="mt-1.5 text-[11px] text-white/45">{genProgress.ready} / {genProgress.total} ready{genProgress.failed > 0 ? ` · ${genProgress.failed} retrying` : ""}</p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-lime-300 transition-all duration-700" style={{ width: `${genProgress.total ? Math.floor((genProgress.ready / genProgress.total) * 100) : 0}%` }} />
        </div>
      </div>
    );
  })();

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#090A0A]">
      <div className="shrink-0 px-4 lg:px-6"><LongFormCreationHeader current="generate" project={project} /></div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[200px] lg:flex-row lg:overflow-hidden lg:pb-0">
        <aside className="shrink-0 border-b border-white/[0.07] bg-[#0C0F0D] lg:flex lg:w-[350px] lg:flex-col lg:border-b-0 lg:border-r">
          {/* Item 1 of the 2026-09-19 "fix backward navigation" pass: a
              clearly visible secondary action, not a small muted link easy
              to miss on a busy page — matches StoryboardWorkspace's own
              "← Back to Narration" row exactly (same position, icon, weight)
              so the back-navigation pattern reads the same at every step.
              Never triggers a rebuild: this is a plain route change, no
              action is dispatched. */}
          {onBackToVisualWorld && (
            <button type="button" onClick={onBackToVisualWorld} className="flex shrink-0 items-center gap-1.5 border-b border-white/10 px-4 py-3 text-[12.5px] font-semibold text-white/45 transition hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Visual World
            </button>
          )}
          <button type="button" onClick={() => setMobileControls(!mobileControls)} aria-expanded={mobileControls} className="flex w-full items-center justify-between px-5 py-4 text-sm font-semibold text-white lg:hidden">
            Scene controls<ChevronDown className={`h-4 w-4 transition ${mobileControls ? "rotate-180" : ""}`} />
          </button>
          <div className={`${mobileControls ? "block" : "hidden"} min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 lg:block`}>
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-white/50">Image Quality</h2>
              <div className="mt-2.5"><CompactTierSelector tier={tier} locked={episodeGenerationCommitted} onSelect={handleSelectTier} /></div>
            </div>
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-white/50">Reference Sheets</h2>
              <p className="mt-1 text-[11px] text-white/35">These guide character consistency while your scenes are generated.</p>
              <div className="mt-2.5"><ReferenceSheetsPreview sheets={characterSheets} onOpen={() => setGalleryOpen(true)} /></div>
            </div>
            <div className="border-t border-white/[0.06] pt-4">
              <h2 className="text-[11px] font-bold uppercase tracking-wide text-white/50">Generation Summary</h2>
              {/* Part 10/4: shows what the price actually buys — every row
                  here is a real count from the SAME server estimate the
                  total is computed from, never an invented illustrative
                  number. Compact rows, not a wall of the sidebar. */}
              <dl className="mt-2 space-y-1 text-[12px]">
                <div className="flex justify-between"><dt className="text-white/40">Scenes</dt><dd className="font-semibold text-white/80">{progress.total}</dd></div>
                {estimate?.breakdown && (
                  <>
                    <div className="flex justify-between"><dt className="text-white/40">New AI renders</dt><dd className="text-white/60">{estimate.breakdown.freshGenerations}</dd></div>
                    <div className="flex justify-between"><dt className="text-white/40">AI edits</dt><dd className="text-white/60">{estimate.breakdown.edits}</dd></div>
                    <div className="flex justify-between"><dt className="text-white/40">Derived shots</dt><dd className="text-white/60">{estimate.breakdown.reused + estimate.breakdown.crops}</dd></div>
                    <div className="flex justify-between"><dt className="text-white/40">Graphics</dt><dd className="text-white/60">{estimate.breakdown.graphics}</dd></div>
                  </>
                )}
                <div className="flex justify-between"><dt className="text-white/40">Quality</dt><dd className="font-semibold text-white/80">{SCENE_GENERATION_TIERS.find((t) => t.id === tier)?.name} · {SCENE_GENERATION_TIERS.find((t) => t.id === tier)?.quality}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-white/40">{episodeGenerationCommitted ? "Credits charged" : "Estimated total"}</dt>
                  <dd className="flex items-center gap-1 font-semibold text-white/80"><CreditIcon className="h-3 w-3 text-lime-300" />{episodeCharge?.credits_charged ?? totalCredits ?? "…"}</dd>
                </div>
              </dl>
            </div>
          </div>
          <footer className="hidden shrink-0 border-t border-white/[0.07] p-5 lg:block">{!episodeGenerationCommitted && sampleButton}{episodeGenerationCommitted ? productionStatus : generateButton}{rebuildTrigger}</footer>
        </aside>
        <main className="min-w-0 shrink-0 px-5 py-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-8">
          <div className="mx-auto max-w-[1200px]" id="scene-groups-top">
            <h1 className="text-xl font-bold text-white">Your Scenes</h1>
            <p className="mt-1 text-sm text-white/40">Review how your episode will be rendered, then generate the visuals.</p>
            {error && <div className="mt-4 rounded-lg border border-red-400/20 bg-red-400/[0.06] p-3 text-[12px] text-red-200">{customerVisualMessage(error)}</div>}
            {/* Part 2/3/5 of the 2026-09-19 forensic fix: never show 0%/136
                Planned as though the renderer is merely slow when the real
                reason is that the current plan hasn't been set up for
                generation yet — a replanned VisualPlan whose Visual World
                needs new references, or one that simply hasn't been
                compiled/charged at all. This is the hard invariant: current
                VisualPlan + current Visual World + required references must
                be mutually compatible before scene generation proceeds. */}
            {readinessIssues.map((issue, i) => {
              const route = READINESS_ACTION_ROUTE[issue.recommendedAction] ?? (issue.subsystem === "storyboard" || issue.subsystem === "scene_plan" ? "storyboard" : "visual_world");
              const ctaLabel = READINESS_ACTION_LABEL[issue.recommendedAction] ?? (route === "storyboard" ? "Fix Storyboard" : "Update Visual World");
              // Only the duplicate-visual-resolution issue has a real one-
              // click targeted repair behind it today (repair-long-form-
              // storyboard) — every other storyboard/scene-plan reason still
              // routes to the storyboard for a manual look, same as before.
              const oneClickFixable = issue.code === "DUPLICATE_VISUAL_RESOLUTION";
              const handleFix = () => (route === "storyboard" ? onGoToStoryboard?.(issue.affectedBeatIds ?? []) : onBackToVisualWorld?.());
              return (
                <div key={issue.code ? `${issue.code}-${i}` : i} className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] p-4">
                  <p className="text-sm font-bold text-amber-100">{issue.title || "Attention needed"}</p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-200/80">{issue.message}</p>
                  {issue.affectedBeatIds?.length > 0 && (
                    <p className="mt-1 text-[11px] text-amber-200/55">
                      Affected: {issue.chapterId ? `${issue.chapterId} · ` : ""}{issue.affectedBeatIds.length} shot{issue.affectedBeatIds.length === 1 ? "" : "s"}
                    </p>
                  )}
                  {fixingStoryboard ? (
                    <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-amber-200">
                      <Orbit className="lf-gen-core h-3.5 w-3.5" />
                      {FIX_STORYBOARD_PROGRESS_MESSAGES[fixProgressIndex]}
                    </div>
                  ) : fixResult && oneClickFixable ? (
                    <div className="mt-3">
                      {fixResult.ready ? (
                        <p className="text-[12.5px] font-bold text-lime-300">
                          Storyboard fixed — {fixResult.beforeBeatCount - fixResult.afterBeatCount > 0 ? `${fixResult.beforeBeatCount - fixResult.afterBeatCount} fewer` : "0 fewer"} shots ({fixResult.beforeBeatCount} → {fixResult.afterBeatCount}).
                        </p>
                      ) : (
                        <div>
                          <p className="text-[12.5px] font-semibold text-amber-200">
                            Reduced from {fixResult.beforeDuplicateErrorCount ?? "?"} to {fixResult.afterDuplicateErrorCount ?? "?"} conflicting pairs ({fixResult.beforeBeatCount} → {fixResult.afterBeatCount} shots), but this needs a manual look to finish.
                          </p>
                          <button type="button" onClick={() => onGoToStoryboard?.(fixResult.remainingDuplicateBeatIds ?? issue.affectedBeatIds ?? [])} className="mt-2 rounded-lg border border-amber-300/40 px-3.5 py-2 text-[12px] font-bold text-amber-200 transition hover:bg-amber-400/10">Review Shots</button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={oneClickFixable ? handleFixStoryboard : handleFix} className="rounded-lg bg-amber-300 px-3.5 py-2 text-[12px] font-bold text-[#1a1200] transition hover:bg-amber-200">{oneClickFixable ? "Fix Storyboard" : ctaLabel}</button>
                      {oneClickFixable && <button type="button" onClick={() => onGoToStoryboard?.(issue.affectedBeatIds ?? [])} className="rounded-lg border border-amber-300/40 px-3.5 py-2 text-[12px] font-bold text-amber-200 transition hover:bg-amber-400/10">Review Shots</button>}
                    </div>
                  )}
                </div>
              );
            })}
            {episodeGenerationCommitted ? (
              // Item 1 of the 2026-09-19 "premium active-generation UI" pass:
              // a real generation run is active — this replaces the small
              // understated status box with a full production panel, reading
              // exclusively from genProgress (the same object the sidebar and
              // scene filters use).
              <EpisodeGenerationHero
                genProgress={genProgress}
                chargedAt={episodeCharge?.created_at ?? null}
                onPauseGeneration={onPauseGeneration}
                onContinueGeneration={onContinueGeneration}
                busy={busy}
                // 2026-09-23 "root-contract stabilization" pass — real
                // Atlantis finding: paired with genProgress now being scoped
                // to chapterGateWithin above, the hero's own title/subcopy
                // must say "Chapter 1" too — "Creating your episode" while
                // only one chapter's 15 visuals were ever authorized was
                // the exact misleading copy reported.
                chapterLabel={chapterGateActive ? deriveChapterLabel(chapterGateWithin[0]?.chapterId) : null}
              />
            ) : (
              <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-white/50">{EPISODE_PROGRESS_HEADING[progressPhase]}</p>
                  {/* Part 9: a REAL percentage — processed (ready+needsReview+
                      failed) / total, never estimated from elapsed time. */}
                  <p className="text-[11px] font-bold text-white/60">{processedPct}% processed</p>
                </div>
                <p className="mt-1 text-sm font-semibold text-white">{progress.ready} of {progress.total} scenes ready</p>
                {/* Segmented bar: lime=Ready, amber=Needs Review, red=Failed,
                    gray=remaining (queued/generating/planned) — updates from
                    the same live DB-polled progress counts as everything
                    else on this page. */}
                <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div className="h-full bg-lime-300 transition-all" style={{ width: `${pct(progress.ready)}%` }} />
                  <div className="h-full bg-amber-400 transition-all" style={{ width: `${pct(progress.needsReview)}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${pct(progress.failed)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                  {progress.needsReview > 0 && <button type="button" onClick={jumpToNeedsReview} className="font-semibold text-amber-300 hover:text-amber-200">{progress.needsReview} need review →</button>}
                  {progress.failed > 0 && <span className="font-semibold text-red-300">{progress.failed} need another try</span>}
                  {queuedCount > 0 && <span>Queued {queuedCount}</span>}
                  {generatingCount > 0 && <span>Generating {generatingCount}</span>}
                  {progress.planned > 0 && <span>{progress.planned} remaining</span>}
                </div>
              </div>
            )}
            {/* Item 7 of the 2026-09-19 "fix the production workflow" pass:
                episodeQA.ts already finds these patterns for free (pure,
                deterministic, zero provider cost) — this is the first time
                the user can actually see them, in plain language, with a
                click-through to the affected shots. */}
            {attentionSummary.length > 0 && (
              <button
                type="button"
                onClick={jumpToAttention}
                className="mt-4 flex w-full items-start gap-3 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] p-3.5 text-left transition hover:bg-sky-400/[0.1]"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-sky-100">Visual variety needs attention</p>
                  <p className="mt-0.5 text-[11.5px] text-sky-200/70">{attentionSummary.join(" · ")}</p>
                </div>
              </button>
            )}
            <SceneFilterBar progress={progress} filter={filter} onChange={setFilter} />
            {sceneCards.length === 0 ? (
              <div className="mt-10 rounded-2xl border border-white/[0.07] bg-[#0C0F0D] p-10 text-center">
                <Film className="mx-auto h-6 w-6 text-white/20" />
                <p className="mt-3 text-sm font-semibold text-white/60">Your scenes will appear here.</p>
                <p className="mt-1 text-[12px] text-white/35">Zyvo has planned the visuals. Choose your quality and generate the episode when you're ready.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-7">
                {groups.map((group) => (
                  <section key={group.key}>
                    <SequenceGroupHeader group={group} />
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {group.cards.map((card) => <SceneCard key={card.beatId} card={card} onOpen={(c) => setOpenSceneBeatId(c.beatId)} attention={attentionOpen && attentionBeatIds.has(card.beatId)} />)}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
      <footer className="fixed inset-x-0 bottom-[calc(78px+env(safe-area-inset-bottom))] z-40 border-t border-white/[0.08] bg-[#0C0F0D]/95 px-5 py-3 backdrop-blur-xl lg:hidden">{!episodeGenerationCommitted && sampleButton}{episodeGenerationCommitted ? productionStatus : generateButton}{rebuildTrigger}</footer>

      <ReferenceSheetsGalleryModal open={galleryOpen} sheets={characterSheets} onClose={() => setGalleryOpen(false)} onOpenSheet={(sheet) => { setGalleryOpen(false); setOpenSheet(sheet); }} />

      <Dialog open={Boolean(openSheet)} onClose={() => setOpenSheet(null)} className="relative z-[100]">
        <DialogBackdrop className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101213] p-5">
            <div className="mb-4 flex items-center justify-between">
              <DialogTitle className="text-lg font-semibold text-white">{openSheet?.name}</DialogTitle>
              <button onClick={() => setOpenSheet(null)} aria-label="Close" className="rounded-lg p-2 text-white/60 hover:bg-white/5"><X className="h-5 w-5" /></button>
            </div>
            {openSheet && <img src={openSheet.result_url} alt={openSheet.name} className="w-full rounded-xl border border-white/10 object-contain" />}
          </DialogPanel>
        </div>
      </Dialog>

      <SceneReviewModal card={openCard} scenes={scenes} sceneOpEstimates={sceneOpEstimates} onClose={() => setOpenSceneBeatId(null)} onRetry={handleRetryScene} onEdit={handleEditScene} onEscalate={handleEscalateScene} onApproveAnyway={onApproveSceneAnyway} onDisableOverlay={onDisableSceneOverlay} busy={busy} />
      <NoCreditsModal open={noCreditsOpen} onClose={() => setNoCreditsOpen(false)} creditsNeeded={noCreditsNeeded} creditBalance={creditBalance} />
      <RebuildEpisodeModal
        open={rebuildModalOpen}
        onClose={() => { setRebuildModalOpen(false); setRebuildError(null); }}
        estimates={estimates}
        progress={progress}
        previousTier={episodeCharge?.tier ?? tier}
        previousCredits={episodeCharge?.credits_charged ?? "…"}
        onConfirm={handleRebuild}
        busy={rebuildBusy}
        error={rebuildError}
      />
    </div>
  );
}
