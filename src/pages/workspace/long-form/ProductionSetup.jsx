import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  Atom, Brain, Check, ChevronDown, ChevronRight, Coins, Landmark, Lock, Mic, PawPrint, PenLine, RefreshCw, RotateCw, Search, Sparkles, X,
} from "lucide-react";
import { createDiscoverySession, fetchDiscoverySession, persistDiscoverySession } from "./discoverySession";
import { createLongFormProject } from "./project";
import { STICKMAN_RECIPE_VERSION, fetchProjectQuote, createProductionSetup } from "./productionProfile";
import VoiceLibraryDialog, { SampleButton, useVoiceSamplePlayer } from "./VoiceLibraryDialog";
import { findVoice, isRecommendedForNiche, VOICE_CATALOG } from "../../../lib/voiceCatalog";
import { NICHE_GROUPS, ALL_NICHES, NICHE_CATEGORY_COLORS, findNiche, recommendedStylesForNiche, exampleTopicForNiche } from "./niches";
import { VISUAL_STYLES, isStyleSelectable, getVisualStyle } from "./visualStyles";
import { LENGTH_OPTIONS, LENGTH_MIN_MINUTES, LENGTH_MAX_MINUTES, DEFAULT_LENGTH_MINUTES, visualsRange, estimateForLength } from "./lengthEstimates";
import { wordsPerMinuteFor, DEFAULT_NARRATION_SPEED } from "../../../lib/voicePace.ts";
import { ON_SCREEN_TEXT_GUIDANCE, DEFAULT_ON_SCREEN_TEXT_DENSITY } from "./onScreenTextGuidance";
import { fetchLongFormIdeas, IDEA_ENGINE_ERROR } from "./ideaEngine";
import { createIdea, PREVIEW_STATUS } from "./discoverIdeas";
import { submitIdeaThumbnailJobs, IDEA_THUMBNAIL_ERROR } from "./ideaThumbnailJobs";
import { LongFormCreationHeader } from "./shared";
import GuestGenerateModal from "../../../components/ImageGenerator/GuestGenerateModal";
import { useProfileCredits } from "../../../hooks/useProfileCredits";
import { watchJob } from "../../../lib/jobs";
import { REGENERATE_IDEAS_COST, REFRESH_THUMBNAILS_COST } from "../../../lib/longFormIdeaThumbnails";
import { STICKMAN_RECIPE } from "./recipe";
import { startAutopilot } from "./autopilot";
import { cleanText } from "./textClean";

// 2026-10-02 "Create New Video" UX rework — Section 7: rendered as three
// primary option cards now (moved out of Advanced Settings). Quality/cost are
// deliberately qualitative dot indicators, never a hardcoded credit number —
// the one real, authoritative number is the live quote in the summary panel
// (fetchProjectQuote), so a duplicated constant here could never drift out
// of sync with it. `quality` (2026-10-02 polish pass — renamed from `speed`,
// values inverted: V2=1/3 lowest, V4=3/3 highest) is separate from `cost`,
// which still increases with tier the same way. No per-tier generation-time
// estimate exists anywhere in this codebase, so — per explicit instruction
// not to invent numbers — the Cost dots stay dots rather than becoming a
// fabricated "~N min" estimate. Phase 7: `perMin` is the fixed price per
// minute (mirrors CREDITS_PER_MINUTE in _shared/longFormProjectQuote.ts; a
// test keeps them equal). The summary quote is still the charged number.
const RENDER_TIER_OPTIONS = [
  { value: "v2", label: "V2 Fast", description: "Quickest and cheapest. Good for drafts.", quality: 1, cost: 1, perMin: 25 },
  { value: "v3", label: "V3 High Quality", description: "Best balance of detail and cost.", quality: 2, cost: 2, perMin: 75, recommended: true },
  { value: "v4", label: "V4 Ultra", description: "Maximum detail. Slowest.", quality: 3, cost: 3, perMin: 90 },
];
const EXPLANATION_DEPTH_OPTIONS = [
  { value: "simple", label: "Brief" },
  { value: "balanced", label: "Balanced" },
  { value: "deep", label: "Deep" },
];
const TEXT_DENSITY_OPTIONS = ["minimal", "balanced", "frequent"];

const NICHE_CATEGORY_ICONS = {
  history: Landmark,
  mind_body: Brain,
  animals_nature: PawPrint,
  science_universe: Atom,
  money_modern_life: Coins,
};

// Phase 0, Section A — fires the real network request for each URL via a
// plain, never-mounted `new Image()`, independent of any component's own
// render/transition timing. See ImageWithFallback's comment for why.
function preloadImages(urls) {
  for (const url of urls) {
    const img = new Image();
    img.src = url;
  }
}

// Shared fallback: a real image at the given src if it loads, otherwise a
// tasteful placeholder tile (category-colored gradient + icon for niches,
// a neutral dark/lime gradient + icon for anything else) — never a broken
// image icon. See the deliverable report for the exact expected file list.
// `dim` (Section 3 of the 2026-10-02 polish pass) grayscales/darkens a real
// image for a not-yet-available option — the image itself communicates
// "unavailable" without touching the badge or text drawn on top of it.
//
// Final-polish round 2, Section 2 — deliberately NOT `loading="lazy"`. Root
// cause of "style images show placeholders on mobile": every use of this
// component lives inside either a Headless UI <Dialog> (the niche/style
// picker modals, both `position: fixed` and mounted via a Transition) or
// this page's own normal flow — never a long/infinite list. Native
// lazy-loading decides whether an image is "near the viewport" using an
// IntersectionObserver-like heuristic evaluated at the image's OWN initial
// layout; WebKit (every browser on iOS, since they all share Apple's engine)
// has a known-flaky implementation of this specifically when the image's
// ancestor is still mid-transition/`position: fixed` at that first check —
// it can permanently decide the image isn't worth loading yet and never
// re-evaluate, even after the transition finishes and the user scrolls to
// it. This reproduced as "fine in Chromium (dev server AND a real
// production build), broken specifically inside the two modals" — exactly
// the shape of that bug, and exactly why the always-visible main-page niche
// thumbnail (never inside a transitioning ancestor) was unaffected. Every
// image this component ever renders is small (10 styles, 25 niches, one
// selected-row thumbnail) and only fetched once the user has already taken
// an action to see it (opened a picker) — there's no real lazy-loading
// benefit here to trade against a real cross-browser correctness bug.
// Final-polish round 4, Section 3 — one shared size/aspect-ratio/radius for
// every "selected row" thumbnail (niche row, Visual Style row) so the two
// can never drift apart again. 16:9, same responsive width steps as the
// Visual Style row always used; the niche row previously used a plain
// square `h-14 w-14` instead.
const SELECTED_ROW_THUMB_CLASS = "aspect-video w-28 shrink-0 rounded-lg object-cover sm:w-36 lg:w-[200px]";

// Phase 0, Section A — the "only the first card shows an image" regression.
// Root cause after exhaustive re-diagnosis (file existence for all 35 slugs
// confirmed 200 OK; a scripted Chromium session — dev server AND a real
// `vite build`+`vite preview` production build, at 1440px and 390px, on
// first open, after a real mouse-wheel scroll, and after a close+reopen
// cycle — loaded all 25/25 niche and all 10/10 style images every single
// time, with zero onError firings) could NOT be reproduced in this
// environment; WebKit itself (the prime remaining suspect, matching
// "desktop and mobile" both being Safari, and the exact shape of the
// lazy-loading bug already fixed one round ago) could not be installed here
// either (network to both Playwright download hosts is blocked in this
// sandbox). Rather than ship an unverified guess, this hardens every layer
// the earlier bug report itself named as a plausible cause, so any one of
// them — a WebKit dialog-transition/paint timing quirk, a slow-connection
// image queued behind the dialog's own mount, or a future regression here —
// stops mattering:
//   - a real loading SKELETON while pending (previously: blank, and if a
//     future change ever made the pending branch render the fallback tile
//     by mistake, a real image could look permanently "broken" the instant
//     it started loading rather than only on a genuine error);
//   - `decoding="async"` so decoding one image can never block another's
//     paint;
//   - every picker modal now preloads all of its real image URLs via a
//     plain, non-DOM `new Image()` the moment it opens (see
//     NichePickerModal/StylePickerModal below) — the fetch is kicked off
//     completely independently of the Dialog's own mount/transition, so a
//     transitioning ancestor can never be "mid-transition" at the moment
//     the browser actually starts the request.
// Deliberately did NOT reintroduce `loading="lazy"` for any subset of cards
// (the original bug report's "first 6 eager, rest lazy" suggestion) — that
// is the exact mechanism last round's fix removed for a proven WebKit
// correctness bug in this same component, and 25 niches/10 styles at
// 44-103KB each (~1.7MB total) is too small a list for lazy-loading to be
// worth reintroducing that risk for.
function ImageWithFallback({ src, alt, groupId, className, dim = false }) {
  const [status, setStatus] = useState(src ? "loading" : "empty"); // "loading" | "loaded" | "failed" | "empty"
  useEffect(() => {
    setStatus(src ? "loading" : "empty");
  }, [src]);

  if (status === "empty" || status === "failed") {
    const colors = NICHE_CATEGORY_COLORS[groupId];
    const Icon = NICHE_CATEGORY_ICONS[groupId] ?? Sparkles;
    return (
      <div
        className={`${className} flex items-center justify-center`}
        style={{ background: colors ? `linear-gradient(135deg, ${colors.from}, ${colors.to})` : "linear-gradient(135deg, #2a2d2f, #17191b)" }}
      >
        <Icon className="h-7 w-7 text-white/80" strokeWidth={1.5} />
      </div>
    );
  }
  return (
    <div className={`${className} relative overflow-hidden bg-white/[0.04]`}>
      {status === "loading" && <div className="absolute inset-0 animate-pulse bg-white/[0.07]" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("failed")}
        className="absolute inset-0 h-full w-full object-cover"
        style={dim ? { filter: "grayscale(70%) brightness(50%)" } : undefined}
      />
    </div>
  );
}

// Final-polish pass, Section 3 — three real niche images (one per category,
// per the exact examples given) fanned like a hand of photos, replacing the
// generic Sparkles icon tile in the empty niche-picker button below. Purely
// decorative (aria-hidden — the label text beside it already names the
// action), and resolved once at module load via the real ALL_NICHES data
// rather than hardcoded labels/groupIds that could drift out of sync with it.
const NICHE_STACK_PREVIEW = ["ancient_humans_prehistory", "space_cosmic_scale", "psychology_human_behavior"].map((id) => findNiche(id));

function FannedNicheStack() {
  const positions = [
    { pos: "translate-x-0 rotate-[-10deg] z-0", hover: "group-hover:-translate-x-1.5 group-hover:rotate-[-14deg]" },
    { pos: "translate-x-[25px] sm:translate-x-[37px] rotate-0 z-20", hover: "" },
    { pos: "translate-x-[50px] sm:translate-x-[74px] rotate-[10deg] z-10", hover: "group-hover:translate-x-[56px] sm:group-hover:translate-x-[84px] group-hover:rotate-[14deg]" },
  ];
  return (
    <span className="relative block h-[38px] w-[102px] shrink-0 sm:h-[58px] sm:w-[150px]" aria-hidden="true">
      {NICHE_STACK_PREVIEW.map((niche, i) => (
        <ImageWithFallback
          key={niche.id}
          src={`/images/niches/${niche.id}.webp`}
          alt=""
          groupId={niche.groupId}
          className={`absolute left-0 top-0 h-[34px] w-[52px] rounded-[8px] border-2 border-[#0c0e0d] object-cover shadow-[0_6px_14px_rgba(0,0,0,0.4)] transition-transform duration-200 ease-out sm:h-[50px] sm:w-[76px] sm:rounded-[10px] ${positions[i].pos} ${positions[i].hover}`}
        />
      ))}
    </span>
  );
}

// 2026-10-03 "fixes round 3" pass, Section 4 — the summary panel's preview:
// once a niche is picked AND its real image actually loads, that (this
// SPECIFIC video's subject) beats the generic style card, with the chosen
// style named in a small overlay. Falls back to the style preview the
// instant the niche image 404s (no niche images exist yet as of this pass —
// see the report), and keeps the full panel width either way. Re-mounted
// per niche (see the `key={niche?.id}` at its call site) so a niche change
// always gets its own fresh load attempt instead of inheriting a stale
// failure flag from the previous one.
// Final-polish round 4, Section 4 — `ideaThumbnailUrl` (the selected idea's
// own ready thumbnail) outranks even the niche image once set: it's this
// SPECIFIC video's actual planned thumbnail, not just its general subject.
function SummaryPreviewImage({ niche, style, ideaThumbnailUrl }) {
  const [nicheFailed, setNicheFailed] = useState(false);
  if (ideaThumbnailUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.08]">
        <img src={ideaThumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      </div>
    );
  }
  if (niche && !nicheFailed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/[0.08]">
        <img src={`/images/niches/${niche.id}.webp`} alt="" onError={() => setNicheFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        {style && (
          <span className="absolute bottom-2 left-2 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
            {style.label}
          </span>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08]">
      <ImageWithFallback src={style?.previewAssetUrl} alt="" className="aspect-video w-full object-cover" />
    </div>
  );
}

// ============================== Niche picker ==============================

function NichePickerModal({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");

  // Phase 0, Section A — preload every real niche image the instant the
  // modal opens, via a plain `new Image()` never attached to the (still
  // mounting/transitioning) Dialog subtree. This kicks off the actual
  // network fetch completely independently of the Dialog's own mount
  // timing, so the real <img> tags rendered inside it resolve from the
  // browser's HTTP cache regardless of how that mount/transition behaves.
  useEffect(() => {
    if (!open) return;
    preloadImages(ALL_NICHES.map((n) => `/images/niches/${n.id}.webp`));
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_NICHES.filter((n) => {
      if (activeGroup !== "all" && n.groupId !== activeGroup) return false;
      if (!q) return true;
      return n.label.toLowerCase().includes(q) || n.description?.toLowerCase().includes(q);
    });
  }, [query, activeGroup]);

  function close() {
    setQuery("");
    setActiveGroup("all");
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} className="relative z-[110]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-5">
        <DialogPanel className="flex h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-[#101414] text-white sm:h-[85vh] sm:rounded-2xl sm:border sm:border-white/15">
          <header className="shrink-0 border-b border-white/10 p-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle className="text-lg font-bold">Choose a niche</DialogTitle>
              <button type="button" aria-label="Close" onClick={close} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search niches…"
                autoFocus
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-3 text-[13.5px] text-white outline-none placeholder:text-white/30 focus:border-lime-300/40"
              />
            </div>
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {[{ id: "all", label: "All" }, ...NICHE_GROUPS.map((g) => ({ id: g.id, label: g.label }))].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setActiveGroup(g.id)}
                  aria-pressed={activeGroup === g.id}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                    activeGroup === g.id ? "border-lime-300/40 bg-lime-300 text-[#11150D]" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-white/40">No niches match "{query}".</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filtered.map((niche) => (
                  <button
                    key={niche.id}
                    type="button"
                    onClick={() => onSelect(niche.id)}
                    className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] text-left transition hover:-translate-y-0.5 hover:border-lime-300/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                  >
                    <ImageWithFallback src={`/images/niches/${niche.id}.webp`} alt="" groupId={niche.groupId} className="aspect-video w-full object-cover" />
                    <div className="p-3">
                      <p className="text-[13px] font-bold text-white">{niche.label}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11.5px] text-white/45">{niche.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// ============================== Style picker ==============================

function StylePickerModal({ open, currentId, onClose, onSelect, recommendedIds }) {
  // Phase 0, Section A — same preload-on-open as NichePickerModal.
  useEffect(() => {
    if (!open) return;
    preloadImages(VISUAL_STYLES.map((s) => s.previewAssetUrl).filter(Boolean));
  }, [open]);

  function close() {
    onClose();
  }
  return (
    <Dialog open={open} onClose={close} className="relative z-[110]">
      <div className="fixed inset-0 bg-black/75 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-5">
        <DialogPanel className="flex h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-[#101414] text-white sm:h-[85vh] sm:rounded-2xl sm:border sm:border-white/15">
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
            <DialogTitle className="text-lg font-bold">Choose a visual style</DialogTitle>
            <button type="button" aria-label="Close" onClick={close} className="rounded-lg p-2 text-white/50 hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300">
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div role="radiogroup" aria-label="Visual style" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {VISUAL_STYLES.map((style) => {
                const selectable = isStyleSelectable(style);
                const selected = style.id === currentId;
                return (
                  <button
                    key={style.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={!selectable}
                    title={!selectable ? "Coming soon" : undefined}
                    onClick={() => selectable && onSelect(style.id)}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                      selectable
                        ? selected
                          ? "border-lime-300/60 ring-2 ring-lime-300/25"
                          : "border-white/[0.08] hover:border-white/20"
                        : "cursor-not-allowed border-white/[0.06]"
                    }`}
                  >
                    <div className="relative">
                      <ImageWithFallback src={style.previewAssetUrl} alt="" className="aspect-video w-full object-cover" dim={!selectable} />
                      {recommendedIds.has(style.id) && selectable && (
                        <span className="absolute right-2 top-2 rounded-full border border-lime-300/30 bg-black/50 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-lime-300 backdrop-blur-sm">
                          Recommended
                        </span>
                      )}
                      {!selectable && (
                        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
                          <Lock className="h-2.5 w-2.5" />
                          Coming soon
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className={`text-[13px] font-bold ${selectable ? "text-white" : "text-white/35"}`}>{style.label}</p>
                      <p className={`mt-0.5 text-[11.5px] leading-snug ${selectable ? "text-white/45" : "text-white/25"}`}>{style.summary}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// ============================== Locked wrapper ==============================

// `inert` (React 19 passes it straight through as the real HTML attribute)
// removes the whole subtree from the tab order and blocks all interaction —
// pointer-events-none/aria-disabled are kept alongside it for older
// engines/AT that don't yet fully honor inert.
function LockedSection({ locked, children }) {
  return (
    <div aria-disabled={locked} inert={locked ? true : undefined} className={`transition-opacity duration-200 ${locked ? "pointer-events-none opacity-40" : "opacity-100"}`}>
      {children}
    </div>
  );
}

// Final-polish pass, Section 4 — the digit was visibly off-center inside the
// circle (grid+place-items-center alone doesn't fix a numeral glyph that
// isn't perfectly centered within its own line box). Fixed equal width/
// height, inline-flex + align/justify center, zero padding, line-height 1,
// and tabular-nums so 1-9 all occupy the identical advance width; the inner
// span's 1px optical nudge corrects the small residual high-sit most
// system-sans digits have at line-height:1.
function SectionLabel({ n, children }) {
  return (
    <p id={`setup-step-${n}`} className="mb-3 flex scroll-mt-6 items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
      <span
        className="inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/10 p-0 text-[10px] font-bold leading-none text-white/60"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <span className="relative top-px">{n}</span>
      </span>
      {children}
    </p>
  );
}

// Final-polish round 4, Section 4 — matches the real idea card's shape
// exactly (16:9 thumbnail slot + two text lines) so the text-ready ->
// image-ready swap never jumps the surrounding layout. Step 1 (idea text)
// renders these immediately; step 2 (thumbnails) fades real images in on
// top of each card's own thumbnail slot as they resolve — see IdeaThumbnail.
function IdeaSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03]">
      <div className="aspect-video w-full animate-pulse bg-white/[0.06]" />
      <div className="flex flex-col gap-2 px-3 py-2.5">
        <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.08]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.06]" />
      </div>
    </div>
  );
}

// Renders an idea's thumbnail slot through its whole lifecycle: a shimmer
// skeleton while the image job is pending/generating, the real image
// (fading in) once ready, or — on failure — a clean fallback (the selected
// niche's own image, dimmed, with a small retry icon) rather than ever
// showing a broken image. `onRetry` re-submits just this one idea's job.
function IdeaThumbnail({ idea, fallbackSrc, fallbackGroupId, onRetry }) {
  const status = idea.thumbnail?.status;
  if (status === PREVIEW_STATUS.READY && idea.thumbnail.imageUrl) {
    return (
      <div className="relative aspect-video w-full overflow-hidden bg-white/[0.03]">
        <img src={idea.thumbnail.imageUrl} alt="" className="zyvo-idea-thumb-fade h-full w-full object-cover" />
        <ThumbnailHeadlineOverlay text={idea.thumbnailConcept?.headline} />
      </div>
    );
  }
  if (status === PREVIEW_STATUS.FAILED) {
    return (
      <div className="relative aspect-video w-full overflow-hidden">
        <ImageWithFallback src={fallbackSrc} alt="" groupId={fallbackGroupId} className="h-full w-full object-cover" dim />
        <span
          role="button"
          tabIndex={0}
          aria-label="Retry thumbnail"
          onClick={(e) => { e.stopPropagation(); onRetry(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onRetry(); }
          }}
          className="absolute bottom-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white/80 outline-none transition hover:text-white focus-visible:ring-2 focus-visible:ring-lime-300"
        >
          <RefreshCw className="h-3 w-3" />
        </span>
      </div>
    );
  }
  return <div className="aspect-video w-full animate-pulse bg-white/[0.06]" />;
}

// OVERLAY mode (the shipped default — see src/lib/longFormIdeaThumbnails.ts):
// Flux draws the scene only, top third left plain; the headline is rendered
// here in code — heavy bold rounded all-caps yellow letters with a thick
// black outline, top third, width-fit via SVG textLength so it always reads
// as ~80% of the frame regardless of how long the headline is.
function ThumbnailHeadlineOverlay({ text }) {
  if (!text) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[34%] items-center justify-center px-[10%]">
      <svg viewBox="0 0 100 28" className="h-auto w-full overflow-visible" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <text
          x="50"
          y="21"
          textAnchor="middle"
          textLength="80"
          lengthAdjust="spacingAndGlyphs"
          fontSize="22"
          fontWeight="900"
          fontFamily="'Arial Black', 'Poppins', system-ui, sans-serif"
          fill="#FFE14D"
          stroke="#000"
          strokeWidth="3.5"
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ letterSpacing: "0.01em" }}
        >
          {text}
        </text>
      </svg>
    </div>
  );
}

// ======================= Sticky Generate bar (final polish) =======================

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Tweens the displayed number (ease-out cubic) whenever `value` changes.
// Two distinct behaviors share this one component:
//   - `play=true` (the one-time Generate-button unlock celebration): counts
//     0 -> value over ~500ms, once, then behaves like an ordinary change.
//   - `play=false` (every other case — moving the Length slider/presets,
//     switching Quality, etc.): tweens from whatever was PREVIOUSLY
//     displayed to the new value over `duration` (default ~200ms), every
//     single time `value` changes, per the length-slider pass's "numbers
//     animating (count up/down ~200ms)" requirement — this replaced an
//     earlier version of this component that just snapped instantly for
//     every non-unlock change.
// `prefers-reduced-motion` skips the animation loop entirely in both cases.
function AnimatedNumber({ value, play = false, duration = 200, reducedMotion }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    if (reducedMotion || value == null) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }
    const from = play ? 0 : prevRef.current;
    if (from === value) { setDisplay(value); return; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        prevRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, play]);
  return <>{(display ?? 0).toLocaleString()}</>;
}

// Final-polish round 3, Section 1 — matches the Short Form generator's own
// Generate button (ImageGenerator/GenerateButton.jsx) in spirit: lime fill,
// dark bold label, the credit icon + amount INSIDE the button, plus a
// trailing chevron (Short Form has no chevron; added here since this button
// now also represents "advance to Story"). `credits` is the live quote total
// — omitted (no price segment rendered) until a real quote exists, so the
// button never shows a stale/fake number.
//
// Disabled state deliberately does NOT reuse Short Form's own dark-grey
// treatment (bg-[#202224], the same one this button used before this pass) —
// same shape/layout, but a muted/desaturated version of the SAME lime fill,
// so a disabled video-project button still visually reads as "the same
// control, just not ready yet" rather than a dead, unrelated grey box.
//
// `justUnlocked` is a short-lived (~700ms) flag the caller sets exactly once
// per disabled->enabled transition (never on ordinary re-renders while
// already enabled), driving the one-shot scale-spring + expanding pulse
// ring; the slow shine sweep loops continuously for as long as the button
// stays enabled. All three animations are dropped under prefers-reduced-
// motion — only the plain color/glow state change remains, and contrast
// stays AA in every state.
function GenerateButton({ enabled, loading, onClick, justUnlocked, reducedMotion, credits, label = "Generate video", loadingLabel = "Starting…" }) {
  const showPrice = typeof credits === "number";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || loading}
      className={`zyvo-generate-btn relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-xl px-6 text-[15px] font-bold transition-all duration-200 ${
        enabled
          ? `cursor-pointer text-[#0D1206] shadow-[0_0_0_1px_rgba(190,242,100,0.4),0_8px_22px_-6px_rgba(190,242,100,0.55)] hover:-translate-y-px hover:shadow-[0_0_0_1px_rgba(190,242,100,0.55),0_12px_28px_-6px_rgba(190,242,100,0.7)] active:translate-y-0 active:scale-[0.97] ${
              justUnlocked && !reducedMotion ? "zyvo-unlock" : ""
            }`
          : "cursor-not-allowed text-[#20241a]/70"
      }`}
      style={{ background: enabled ? "linear-gradient(135deg, #ddfa9a, #a3e635)" : "linear-gradient(135deg, #9aa383, #727a5e)" }}
    >
      {enabled && !reducedMotion && <span className="zyvo-shine pointer-events-none absolute inset-0" aria-hidden="true" />}
      {enabled && justUnlocked && !reducedMotion && <span className="zyvo-pulse-ring pointer-events-none absolute inset-0 rounded-xl" aria-hidden="true" />}
      <span className="relative z-10 flex w-full items-center justify-center gap-2">
        {loading ? (
          <>
            <RotateCw className="h-4 w-4 animate-spin" />
            {loadingLabel}
          </>
        ) : (
          <>
            <span>{label}</span>
            {showPrice && (
              <span className="inline-flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 bg-current opacity-80"
                  style={{
                    WebkitMaskImage: "url('/icons/credits.png')",
                    maskImage: "url('/icons/credits.png')",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                  }}
                />
                <AnimatedNumber value={credits} play={justUnlocked} duration={500} reducedMotion={reducedMotion} />
              </span>
            )}
            <ChevronRight className="h-4 w-4 shrink-0" />
          </>
        )}
      </span>
      <style>{`
        @keyframes zyvoShineSweep {
          0%, 88% { transform: translateX(-130%) skewX(-20deg); }
          100% { transform: translateX(230%) skewX(-20deg); }
        }
        .zyvo-shine {
          background: linear-gradient(75deg, transparent 42%, rgba(255,255,255,0.6) 50%, transparent 58%);
          transform: translateX(-130%) skewX(-20deg);
          animation: zyvoShineSweep 4s ease-in-out infinite;
        }
        @keyframes zyvoUnlockScale {
          0% { transform: scale(0.96); }
          55% { transform: scale(1.04); }
          100% { transform: scale(1); }
        }
        .zyvo-unlock { animation: zyvoUnlockScale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 1; }
        @keyframes zyvoPulseRing {
          0% { box-shadow: 0 0 0 0 rgba(190,242,100,0.55); opacity: 1; }
          100% { box-shadow: 0 0 0 22px rgba(190,242,100,0); opacity: 0; }
        }
        .zyvo-pulse-ring { animation: zyvoPulseRing 0.7s ease-out 1; }
        @media (prefers-reduced-motion: reduce) {
          .zyvo-shine, .zyvo-unlock, .zyvo-pulse-ring { animation: none !important; }
        }
      `}</style>
    </button>
  );
}

// Final-polish round 3, Section 2 — this bar now exists ONLY for the
// tablet/mobile single-column layout (no side panel): once the panel is
// visible, the Generate button lives INSIDE it instead (see the aside JSX
// in the main component) and this bar isn't rendered at all — still exactly
// one Generate action anywhere on the page, never two competing surfaces,
// now decided by the SAME `hasSidePanel` state that drives the two-column
// grid rather than a separate internal breakpoint.
//
// Constrained to the SAME `max-w-[1180px] px-4 lg:px-8` container the form
// itself uses (never wider than the content column), and still offset by
// the real desktop sidebar width (workspace/layout.jsx's `w-[220px]`, lg+
// only) so it's never misaligned with it. `bottom-0` always (not a
// conditional offset) with bottom PADDING reserving MobileBottomNav's 78px +
// the safe-area inset below lg — MobileBottomNav's own z-[100] is already
// higher than this bar's z-40, so the nav correctly paints over the padding
// region and this bar's real content sits visibly above it, never under it.
function GenerateBar({
  barRef, quote, quoteLoading, credits,
  canGenerate, generating, disabledReason, sessionError, generateError,
  onRetrySession, onGenerate, justUnlocked, reducedMotion,
}) {
  const projectedBalance = quote && typeof credits === "number" ? Math.max(0, credits - quote.totalCredits) : null;
  const showReason = !canGenerate && !generating && !sessionError && disabledReason;

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#101213]/90 pb-[calc(78px+env(safe-area-inset-bottom))] backdrop-blur-xl lg:left-[220px] lg:right-0 lg:pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-[1180px] px-4 py-3 lg:px-8">
        {(sessionError || generateError) && (
          <div className="pb-2.5">
            {sessionError && (
              <div className="flex items-center gap-2">
                <p className="flex-1 text-[11.5px] text-red-300/80">
                  {sessionError === "TOO_MANY_SESSIONS" ? "Too many new videos started recently." : "Couldn't set up this session."}
                </p>
                <button type="button" onClick={onRetrySession} className="shrink-0 text-[11.5px] font-semibold text-white/70 underline underline-offset-2 hover:text-white">
                  Try again
                </button>
              </div>
            )}
            {generateError && <p className="text-[12px] font-medium text-red-300/80">{generateError}</p>}
          </div>
        )}

        <GenerateButton
          enabled={canGenerate && !quoteLoading}
          loading={generating}
          onClick={onGenerate}
          justUnlocked={justUnlocked}
          reducedMotion={reducedMotion}
          credits={quote && !quoteLoading ? quote.totalCredits : null}
        />
        {/* Reason (disabled) and balance (enabled/available) are mutually
            exclusive — never both at once — and always rendered in normal
            flow directly below the button, so neither can ever be clipped
            by a fixed-height/overflow-hidden ancestor. */}
        {showReason ? (
          <p className="mt-2 text-center text-[12px] text-white/35">{disabledReason}</p>
        ) : (
          projectedBalance != null && (
            <p className="mt-2 text-center text-[11px] text-white/35">
              Balance {credits.toLocaleString()} → {projectedBalance.toLocaleString()}
            </p>
          )
        )}
      </div>
    </div>
  );
}

// ======================= Length slider (8-15 min, any whole minute) =======================

const LENGTH_TICKS = Array.from({ length: LENGTH_MAX_MINUTES - LENGTH_MIN_MINUTES + 1 }, (_, i) => LENGTH_MIN_MINUTES + i);

// Native <input type="range"> stays the real interactive element (keyboard
// arrows/Home/End, screen readers, touch dragging all come for free) but is
// rendered fully transparent over a tall invisible hit area (>=44px); every
// visible piece — track, fill, ticks, thumb, value bubble — is a separate
// decorative layer driven purely by React state/refs, the same architecture
// GenerateButton already uses, so it never depends on animating a browser
// pseudo-element (::-webkit-slider-thumb) imperatively, which doesn't
// reliably restart across browsers/rapid input.
//
// Positioning is transform-only (translateX in real pixels from a measured
// track width, never `left` as a percentage) so dragging/animating this
// never triggers layout — just compositing, per the perf requirement.
function LengthSlider({ value, onChange, reducedMotion, wordsPerMinute }) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => setTrackWidth(el.getBoundingClientRect().width);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const percentFor = (minutes) => ((minutes - LENGTH_MIN_MINUTES) / (LENGTH_MAX_MINUTES - LENGTH_MIN_MINUTES)) * 100;
  const xFor = (minutes) => (percentFor(minutes) / 100) * trackWidth;
  const percent = percentFor(value);
  const thumbX = xFor(value);
  const showBubble = dragging || hovering || focused;
  const thumbTransform = `translate(${thumbX}px, -50%) translateX(-50%)`;

  const handlePointerDown = () => setDragging(true);
  const handlePointerUp = () => setDragging(false);

  const handleChange = (e) => {
    const next = Number(e.target.value);
    if (next === value) return;
    onChange(next);
    // Web Animations API, not a CSS class toggle: fires a fresh, independent
    // 120ms pulse on every single integer step even during a fast drag,
    // with no "did the class actually change" restart ambiguity. Keyframes
    // bake in the NEW position so the pulse never visually snaps the thumb
    // back to center mid-scale.
    if (dragging && !reducedMotion && thumbRef.current) {
      const newTransform = `translate(${xFor(next)}px, -50%) translateX(-50%)`;
      thumbRef.current.animate(
        [
          { transform: `${newTransform} scale(1.15)` },
          { transform: `${newTransform} scale(1.22)` },
          { transform: `${newTransform} scale(1.15)` },
        ],
        { duration: 120, easing: "ease-out" }
      );
    }
  };

  const wordsForValue = estimateForLength(value, wordsPerMinute).estimatedWords;
  const thumbScaleClass = dragging || focused ? "scale-[1.15]" : "scale-100";
  const thumbTransitionClass = reducedMotion || dragging ? "" : "transition-transform duration-[250ms] ease-out";

  return (
    <div className="relative mt-4 pt-7" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      {/* Value bubble — hidden when idle, shown on drag/hover/focus. */}
      <div
        className={`pointer-events-none absolute top-0 rounded-lg border border-lime-300/30 bg-[#1c211c] px-2 py-1 text-[11.5px] font-bold text-lime-300 shadow-lg ${
          reducedMotion ? "" : "transition-opacity duration-150"
        } ${showBubble ? `opacity-100 ${!reducedMotion ? "zyvo-bubble-in" : ""}` : "opacity-0"}`}
        style={{ transform: `translate(${thumbX}px, 0) translateX(-50%)` }}
      >
        {value} min
      </div>

      {/* Track + fill + thumb */}
      <div ref={trackRef} className="relative h-[6px] w-full rounded-full bg-white/[0.08]">
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${percent}%`, background: "linear-gradient(90deg, #a3e635, #bef264)" }}
        />
        <div
          ref={thumbRef}
          className={`absolute left-0 top-1/2 h-5 w-5 rounded-full bg-lime-300 shadow-[0_0_0_5px_rgba(190,242,100,0.16),0_2px_10px_rgba(0,0,0,0.45)] ${thumbTransitionClass} ${thumbScaleClass}`}
          style={{ transform: thumbTransform }}
        />
      </div>

      {/* Ticks: one per whole minute, lit up to the current value; only the
          current value's label is bold/bright. */}
      <div className="mt-2 flex justify-between">
        {LENGTH_TICKS.map((m) => (
          <div key={m} className="flex flex-col items-center gap-1">
            <span className={`h-1 w-1 rounded-full ${m <= value ? "bg-lime-300" : "bg-white/15"}`} />
            <span className={`text-[10px] tabular-nums ${m === value ? "font-bold text-lime-300" : "font-medium text-white/30"}`}>{m}</span>
          </div>
        ))}
      </div>

      {/* The real range input: invisible, but the actual interactive/
          accessible element — a tall (>=44px) hit area centered on the
          track so touch targets stay comfortable despite the slim 6px
          visible track. */}
      <input
        type="range"
        min={LENGTH_MIN_MINUTES}
        max={LENGTH_MAX_MINUTES}
        step={1}
        value={value}
        onChange={handleChange}
        onMouseDown={handlePointerDown}
        onTouchStart={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchEnd={handlePointerUp}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        aria-label="Video length in minutes"
        aria-valuetext={`${value} minutes, about ${wordsForValue.toLocaleString()} words`}
        className="zyvo-length-range absolute inset-x-0 top-4 h-11 w-full cursor-pointer appearance-none bg-transparent opacity-0 focus:outline-none"
      />
      <style>{`
        @keyframes zyvoBubbleIn {
          from { transform: translate(${thumbX}px, 0) translateX(-50%) scale(0.8); opacity: 0; }
          to { transform: translate(${thumbX}px, 0) translateX(-50%) scale(1); opacity: 1; }
        }
        .zyvo-bubble-in { animation: zyvoBubbleIn 150ms ease-out; }
        .zyvo-length-range::-webkit-slider-thumb { -webkit-appearance: none; height: 44px; width: 24px; opacity: 0; }
        .zyvo-length-range::-moz-range-thumb { height: 44px; width: 24px; opacity: 0; border: none; }
        @media (prefers-reduced-motion: reduce) {
          .zyvo-bubble-in { animation: none; }
        }
      `}</style>
      {/* Visible focus ring around the thumb on keyboard focus (the native
          input itself is transparent, so its own focus outline is invisible —
          this ring is keyed off the same `focused` state instead). */}
      {focused && (
        <div
          className="pointer-events-none absolute left-0 top-1/2 h-7 w-7 rounded-full ring-2 ring-lime-300 ring-offset-2 ring-offset-[#151719]"
          style={{ transform: thumbTransform }}
        />
      )}
    </div>
  );
}

const DEFAULT_STYLE_ID = "classic_flat_stickman";

// 2026-10-03 "fixes round 3" pass, Section 1 — client-side draft (Section 1:
// "Keep the form state client-side... optionally persist the draft locally
// so a refresh doesn't lose input"). Crucially, this ALSO persists
// discoverySessionId, so refresh/back/re-opening this page REUSES the same
// session and its (at most one, still-invisible 'draft' status) project
// instead of minting a new session every visit — that reuse is what
// actually fixes "Couldn't set up this session" (see the investigation
// note in the final report: the root cause was this page creating a brand
// new session on every single mount against the existing 8/hour cap).
const DRAFT_STORAGE_KEY = "zyvo:long-form:production-setup-draft:v1";

function loadPersistedDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
// ?niche=<id> from Home's "Pick a niche" row; null when missing or unknown.
function nicheFromLink() {
  if (typeof window === "undefined") return null;
  const id = new URLSearchParams(window.location.search).get("niche");
  return id && findNiche(id) ? id : null;
}

function savePersistedDraft(patch) {
  try {
    const current = loadPersistedDraft() ?? {};
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Best-effort only — private browsing / storage-full must never break the form.
  }
}
function clearPersistedDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function ProductionSetup() {
  const navigate = useNavigate();
  const [discoverySessionId, setDiscoverySessionId] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const [guestModalOpen, setGuestModalOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);

  const [nicheId, setNicheId] = useState(null);
  const [nicheModalOpen, setNicheModalOpen] = useState(false);

  const [topicMode, setTopicMode] = useState("write"); // "write" | "ideas"
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState(null);
  const [ideaSteer, setIdeaSteer] = useState(""); // Phase 6a: "Steer the ideas (optional)"
  const [selectedIdeaId, setSelectedIdeaId] = useState(null);
  const ideasScrollRef = useRef(null);
  const [ideasScrollState, setIdeasScrollState] = useState({ atTop: true, atBottom: true, hiddenCount: 0 });
  // Final-polish round 4, Section 4 — idea thumbnails. `ideasStyleId` is the
  // visual style the CURRENT ideas/thumbnails were generated against, so a
  // later style change can be detected (drives the "Refresh thumbnails"
  // notice) without re-deriving it from the session row on every render.
  // `ideasBatchId` is the id generate-long-form-ideas just returned — passed
  // straight through to generate-long-form-idea-thumbnails so it can ride
  // that batch's already-resolved free/charged decision instead of charging
  // twice for one "Regenerate" click.
  const [ideasStyleId, setIdeasStyleId] = useState(null);
  const [ideasBatchId, setIdeasBatchId] = useState(null);
  const [thumbnailsRefreshing, setThumbnailsRefreshing] = useState(false);
  const [thumbnailsRefreshError, setThumbnailsRefreshError] = useState(null);
  const [selectedIdeaThumbnailUrl, setSelectedIdeaThumbnailUrl] = useState(null);
  const ideasRef = useRef(ideas);
  useEffect(() => { ideasRef.current = ideas; }, [ideas]);
  const selectedIdeaIdRef = useRef(selectedIdeaId);
  useEffect(() => { selectedIdeaIdRef.current = selectedIdeaId; }, [selectedIdeaId]);
  const ideaThumbnailWatchersRef = useRef(new Map());
  useEffect(() => () => { ideaThumbnailWatchersRef.current.forEach((unsub) => unsub()); }, []);
  const persistIdeasTimerRef = useRef(null);
  const schedulePersistIdeas = () => {
    if (persistIdeasTimerRef.current) clearTimeout(persistIdeasTimerRef.current);
    persistIdeasTimerRef.current = setTimeout(() => {
      persistDiscoverySession(discoverySessionId, { ideas: ideasRef.current });
    }, 800);
  };

  const [visualStyleId, setVisualStyleId] = useState(DEFAULT_STYLE_ID);
  const [styleModalOpen, setStyleModalOpen] = useState(false);
  const [lengthMinutes, setLengthMinutes] = useState(DEFAULT_LENGTH_MINUTES);
  const [renderTier, setRenderTier] = useState("v3");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Phase 6b: the narration voice is chosen here (6 · Voice) — no preselection.
  const [voice, setVoice] = useState(null);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const voicePlayer = useVoiceSamplePlayer();
  const [explanationDepth, setExplanationDepth] = useState("balanced");
  const [onScreenTextDensity, setOnScreenTextDensity] = useState(DEFAULT_ON_SCREEN_TEXT_DENSITY);

  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const createdProjectIdRef = useRef(null);

  // 2026-10-03 "fixes round 3" pass, Section 2 — the two-column layout turns
  // on based on this CONTAINER's own real rendered width, never a raw
  // viewport media query. A viewport-width breakpoint (the previous `xl:`
  // implementation) has no idea the desktop sidebar (workspace/layout.jsx,
  // a real flex sibling that eats 220px) even exists, so a 1280px+ viewport
  // WITH the sidebar open was still being handed the two-column layout on a
  // content area ~220px narrower than the breakpoint assumed — overflowing
  // the summary panel (and its Generate button) off-screen. Measuring the
  // actual box this component renders into is correct regardless of WHY
  // that box is whatever width it is (sidebar, zoom, window size, anything).
  const SIDE_PANEL_MIN_CONTAINER_WIDTH = 1080;
  const layoutRef = useRef(null);
  const [hasSidePanel, setHasSidePanel] = useState(false);
  useEffect(() => {
    const el = layoutRef.current;
    if (!el) return;
    const measure = () => setHasSidePanel(el.getBoundingClientRect().width >= SIDE_PANEL_MIN_CONTAINER_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Final-polish round 3, Section 2 — the sticky bottom Generate bar only
  // exists at all when there's no side panel (hasSidePanel === false); once
  // the panel is showing, the Generate button lives inside IT instead (see
  // the aside JSX below) and nothing fixed overlaps page content, so the
  // page needs no extra bottom padding beyond a plain comfortable margin.
  // When the bar IS present, its space is measured from its own real
  // rendered position (viewport bottom minus its top edge) rather than a
  // guessed pixel value — this already folds in its own content height, the
  // mobile MobileBottomNav offset, and the safe-area inset, so it stays
  // correct as any of those change without re-deriving the arithmetic here.
  const barRef = useRef(null);
  const [barSpace, setBarSpace] = useState(140);
  useEffect(() => {
    if (hasSidePanel) {
      setBarSpace(48);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarSpace(Math.ceil(window.innerHeight - el.getBoundingClientRect().top) + 24);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [hasSidePanel]);

  const credits = useProfileCredits();
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    document.title = "Create New Video | Zyvo";
  }, []);

  // Final-polish round 4, Section 4 — turns one `jobs` row into this idea's
  // `thumbnail` patch. Mirrors the old /long-form/new page's
  // applyJobRowToPreview exactly (same statuses, same shape), just aimed at
  // the new `thumbnail` field instead of `conceptPreview`.
  const applyJobRowToThumbnail = (row) => {
    if (row.status === "succeeded") return { status: PREVIEW_STATUS.READY, imageUrl: row.result_url, jobId: row.id };
    if (row.status === "failed" || row.status === "canceled") return { status: PREVIEW_STATUS.FAILED, imageUrl: null, jobId: row.id };
    return { status: PREVIEW_STATUS.GENERATING, imageUrl: row.result_url ?? null, jobId: row.id };
  };

  const updateIdeaThumbnail = (ideaId, patch) => {
    setIdeas((prev) => prev.map((idea) => (idea.id === ideaId ? { ...idea, thumbnail: { ...idea.thumbnail, ...patch } } : idea)));
    // Keep the summary panel preview in sync if this idea is the one
    // currently selected and its thumbnail just finished (it may well have
    // been selected before its image was ready) — selectedIdeaIdRef, not
    // the plain state var, since this fires from a watchJob callback whose
    // closure can be older than the render that changed the selection.
    if (patch.status === PREVIEW_STATUS.READY && ideaId === selectedIdeaIdRef.current) {
      setSelectedIdeaThumbnailUrl(patch.imageUrl);
    }
    schedulePersistIdeas();
  };

  const watchIdeaThumbnailJob = (ideaId, jobId) => {
    ideaThumbnailWatchersRef.current.get(ideaId)?.();
    const unsub = watchJob(jobId, (row) => {
      const patch = applyJobRowToThumbnail(row);
      updateIdeaThumbnail(ideaId, patch);
      if (patch.status !== PREVIEW_STATUS.GENERATING) ideaThumbnailWatchersRef.current.delete(ideaId);
    });
    ideaThumbnailWatchersRef.current.set(ideaId, unsub);
  };

  // On mount, after hydrating ideas from a saved session (below), resume
  // watching any thumbnail still mid-flight — a submission that never got a
  // jobId (lost mid-request) is marked FAILED rather than left spinning
  // forever, same logic the old page's resumeWatchersFor used.
  const resumeIdeaThumbnailWatchers = (hydratedIdeas) => {
    for (const idea of hydratedIdeas) {
      const status = idea.thumbnail?.status;
      if (status === PREVIEW_STATUS.PENDING || status === PREVIEW_STATUS.GENERATING) {
        if (idea.thumbnail.jobId) watchIdeaThumbnailJob(idea.id, idea.thumbnail.jobId);
        else updateIdeaThumbnail(idea.id, { status: PREVIEW_STATUS.FAILED });
      }
    }
  };

  // Submits one thumbnail image job per idea (Section 4's "step 2, parallel"
  // generation) — a submission-level failure marks every idea in THIS call
  // FAILED (never blocks the idea text itself); each individual job then
  // resolves independently via its own watcher, so one bad image never
  // affects any other card.
  const startThumbnailsFor = async (ideasToGenerate, styleIdForThumbs, batchIdForCharge) => {
    const payloadIdeas = ideasToGenerate.filter((idea) => idea.thumbnailConcept).map((idea) => ({ id: idea.id, thumbnailConcept: idea.thumbnailConcept }));
    if (!payloadIdeas.length) return;
    const result = await submitIdeaThumbnailJobs({ discoverySessionId, styleId: styleIdForThumbs, ideas: payloadIdeas, batchId: batchIdForCharge });
    if (!result.ok) {
      const failedIds = new Set(payloadIdeas.map((p) => p.id));
      setIdeas((prev) => prev.map((idea) => (failedIds.has(idea.id) ? { ...idea, thumbnail: { status: PREVIEW_STATUS.FAILED, imageUrl: null, jobId: null } } : idea)));
      schedulePersistIdeas();
      return;
    }
    for (const { ideaId, jobId } of result.jobs) {
      updateIdeaThumbnail(ideaId, { status: PREVIEW_STATUS.GENERATING, jobId });
      watchIdeaThumbnailJob(ideaId, jobId);
    }
  };

  // Bootstraps the discovery session — reusing a persisted one (Section 1)
  // when it still genuinely belongs to this user, restoring the rest of the
  // saved draft alongside it; only mints a brand new session (the original,
  // rate-limited path) when there's nothing valid to resume.
  const bootstrapSession = async () => {
    setSessionError(null);
    const saved = loadPersistedDraft();
    // Home's "Pick a niche" links here with ?niche=<id>: a valid one wins over
    // the saved draft's niche (and drops an idea picked for another niche).
    const linkedNiche = nicheFromLink();
    const nicheChangedByLink = !!linkedNiche && linkedNiche !== saved?.nicheId;
    if (saved?.discoverySessionId) {
      const existing = await fetchDiscoverySession(saved.discoverySessionId);
      if (existing) {
        setDiscoverySessionId(existing.id);
        if (saved.topic) setTopic(saved.topic);
        if (linkedNiche || saved.nicheId) setNicheId(linkedNiche ?? saved.nicheId);
        if (saved.visualStyleId) setVisualStyleId(saved.visualStyleId);
        if (saved.lengthMinutes) setLengthMinutes(saved.lengthMinutes);
        if (saved.renderTier) setRenderTier(saved.renderTier);
        if (saved.explanationDepth) setExplanationDepth(saved.explanationDepth);
        if (saved.onScreenTextDensity) setOnScreenTextDensity(saved.onScreenTextDensity);
        if (saved.voiceId) {
          const savedVoice = findVoice(saved.voiceId);
          if (savedVoice) setVoice(savedVoice);
        }
        // Final-polish round 4, Section 4 — cached ideas/thumbnails hydrate
        // straight from the session row, so switching tabs or reopening the
        // page never regenerates or re-charges (COST requirement). Nothing
        // here calls the ideas/thumbnails endpoints — only real state restore.
        const hydratedIdeas = Array.isArray(existing.ideas) ? existing.ideas : [];
        if (hydratedIdeas.length > 0) {
          setIdeas(hydratedIdeas);
          setTopicMode((prevMode) => (existing.selected_idea_id && !nicheChangedByLink ? "write" : prevMode));
          if (existing.selected_idea_id && !nicheChangedByLink) {
            setSelectedIdeaId(existing.selected_idea_id);
            const selected = hydratedIdeas.find((idea) => idea.id === existing.selected_idea_id);
            if (selected?.thumbnail?.status === PREVIEW_STATUS.READY) setSelectedIdeaThumbnailUrl(selected.thumbnail.imageUrl);
          }
          if (existing.last_idea_batch_style_id) setIdeasStyleId(existing.last_idea_batch_style_id);
          if (existing.last_idea_batch_id) setIdeasBatchId(existing.last_idea_batch_id);
          resumeIdeaThumbnailWatchers(hydratedIdeas);
        }
        setBootstrapped(true);
        return;
      }
      // Saved session id no longer resolves (expired/deleted/another
      // account) — fall through and mint a fresh one rather than getting
      // stuck retrying a dead id forever.
    }
    const result = await createDiscoverySession();
    if (!result.ok) { setSessionError(result.code); return; }
    setDiscoverySessionId(result.id);
    savePersistedDraft({ discoverySessionId: result.id });
    if (linkedNiche) setNicheId(linkedNiche);
    setBootstrapped(true);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrapSession();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists the rest of the draft (Section 1's "keep the form state
  // client-side") — deliberately AFTER bootstrap resolves, so restoring
  // values from a saved draft on mount never immediately re-saves itself
  // before the user has changed anything.
  useEffect(() => {
    if (!bootstrapped) return;
    savePersistedDraft({ topic, nicheId, visualStyleId, lengthMinutes, renderTier, explanationDepth, onScreenTextDensity, voiceId: voice?.voiceId ?? null });
  }, [bootstrapped, topic, nicheId, visualStyleId, lengthMinutes, renderTier, explanationDepth, onScreenTextDensity, voice]);

  const niche = nicheId ? findNiche(nicheId) : null;
  const nicheLocked = !nicheId;
  const recommendedStyleIds = useMemo(() => new Set(recommendedStylesForNiche(nicheId)), [nicheId]);
  const selectedStyle = getVisualStyle(visualStyleId);
  // "≈ X words" at the selected voice's measured pace (fallback 145 wpm).
  const voicePace = wordsPerMinuteFor(voice ? { voiceId: voice.voiceId, voiceModel: voice.voiceModel, speed: DEFAULT_NARRATION_SPEED } : null);
  const lengthEstimate = estimateForLength(lengthMinutes, voicePace.wordsPerMinute);
  const lengthVisuals = visualsRange(lengthEstimate.typicalScenes);

  const canGenerate = Boolean(discoverySessionId) && Boolean(nicheId) && topic.trim().length > 0 && Boolean(selectedStyle) && Boolean(voice);
  const disabledReason = !nicheId ? "Pick a niche to continue" : topic.trim().length === 0 ? "Add a topic to continue" : !voice ? "Pick a voice to continue" : null;
  // Shared by both Generate surfaces (the side-panel button on desktop, the
  // sticky bottom bar otherwise) — computed once here so the two never drift.
  const projectedBalance = quote && typeof credits === "number" ? Math.max(0, credits - quote.totalCredits) : null;
  const showGenerateReason = !canGenerate && !generating && !sessionError && disabledReason;

  // Final-polish pass, Section 2 — the "unlock moment" celebration fires
  // exactly once per disabled -> enabled transition (never on mount, never
  // again while it stays enabled/re-renders for an unrelated reason). A
  // ref (not state) tracks the previous value specifically so updating it
  // never itself triggers a re-render/extra effect pass.
  const prevCanGenerateRef = useRef(canGenerate);
  const [justUnlocked, setJustUnlocked] = useState(false);
  useEffect(() => {
    if (canGenerate && !prevCanGenerateRef.current) {
      setJustUnlocked(true);
      const timer = setTimeout(() => setJustUnlocked(false), 700);
      prevCanGenerateRef.current = canGenerate;
      return () => clearTimeout(timer);
    }
    prevCanGenerateRef.current = canGenerate;
  }, [canGenerate]);

  // Live quote preview (Section 9: shown as soon as a niche is chosen, since a
  // style is always preselected) — same estimator create-long-form-production-
  // setup itself reserves from, debounced, zero side effects.
  useEffect(() => {
    if (nicheLocked || !selectedStyle) { setQuote(null); return; }
    let cancelled = false;
    setQuoteLoading(true);
    const timer = setTimeout(async () => {
      const result = await fetchProjectQuote({ recipeVersion: STICKMAN_RECIPE_VERSION, renderTier, targetDurationMinutes: lengthMinutes });
      if (!cancelled) { setQuote(result); setQuoteLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [nicheLocked, selectedStyle, renderTier, lengthMinutes]);

  const handleSelectNiche = (id) => {
    setNicheId(id);
    setNicheModalOpen(false);
    setSelectedIdeaThumbnailUrl(null);
    setSelectedIdeaId(null);
  };

  // A ?niche= link (applied in bootstrapSession) lands on the next step to
  // fill: Topic (Visual Style has a recommended default). An unknown id is
  // ignored, so the page opens as usual with no niche from the link.
  const nicheLinkScrolled = useRef(false);
  useEffect(() => {
    if (!bootstrapped || nicheLinkScrolled.current || !nicheFromLink()) return;
    nicheLinkScrolled.current = true;
    setTimeout(() => document.getElementById("setup-step-3")?.scrollIntoView({ block: "start", behavior: "smooth" }), 350);
  }, [bootstrapped]);

  // Final-polish round 4, Section 4 — this is BOTH the free first-batch
  // click and the paid "Regenerate" click (same server call; the price is
  // decided server-side by whether this draft's session has used its one
  // free batch yet — see generate-long-form-ideas). On success it also kicks
  // off step 2 (thumbnails, in parallel, per idea) and persists the new
  // batch immediately so a refresh right after generating never loses it.
  const runGenerateIdeas = async (existing = []) => {
    if (!discoverySessionId || !nicheId) return;
    setIdeasLoading(true);
    setIdeasError(null);
    setSelectedIdeaId(null);
    setThumbnailsRefreshError(null);
    const result = await fetchLongFormIdeas({
      category: "all",
      direction: "high_curiosity",
      count: 10,
      existingIdeas: existing,
      discoverySessionId,
      nicheHint: niche?.label,
      styleId: visualStyleId,
      steer: ideaSteer.trim() || undefined,
    });
    setIdeasLoading(false);
    if (!result.ok) {
      if (result.errorType === IDEA_ENGINE_ERROR.AUTH_REQUIRED) setGuestModalOpen(true);
      else if (result.errorType === IDEA_ENGINE_ERROR.INSUFFICIENT_CREDITS) setIdeasError("Not enough credits to regenerate ideas.");
      else if (result.errorType === IDEA_ENGINE_ERROR.RATE_LIMITED || result.errorType === IDEA_ENGINE_ERROR.COOLDOWN) setIdeasError("Too many requests just now — try again in a minute.");
      else if (result.errorType === IDEA_ENGINE_ERROR.NETWORK) setIdeasError("Connection lost while generating ideas. Try again.");
      else setIdeasError("Couldn't generate ideas right now. Try again — you won't be charged twice.");
      return;
    }
    const newIdeas = result.ideas.map((idea) => createIdea(idea));
    setIdeas(newIdeas);
    setIdeasStyleId(visualStyleId);
    setIdeasBatchId(result.batchId);
    persistDiscoverySession(discoverySessionId, { ideas: newIdeas, selected_idea_id: null });
    startThumbnailsFor(newIdeas, visualStyleId, result.batchId);
  };

  // Style changed after ideas already existed — regenerates ONLY the
  // thumbnails (never the idea text), at the same flat price as Regenerate,
  // charged on its own since no ideas call just collected payment for it.
  const refreshThumbnails = async () => {
    if (!discoverySessionId || ideas.length === 0) return;
    setThumbnailsRefreshing(true);
    setThumbnailsRefreshError(null);
    setIdeas((prev) => prev.map((idea) => (idea.thumbnailConcept ? { ...idea, thumbnail: { status: PREVIEW_STATUS.PENDING, imageUrl: null, jobId: null } } : idea)));
    const payloadIdeas = ideas.filter((idea) => idea.thumbnailConcept).map((idea) => ({ id: idea.id, thumbnailConcept: idea.thumbnailConcept }));
    const result = await submitIdeaThumbnailJobs({ discoverySessionId, styleId: visualStyleId, ideas: payloadIdeas });
    setThumbnailsRefreshing(false);
    if (!result.ok) {
      if (result.errorType === IDEA_THUMBNAIL_ERROR.INSUFFICIENT_CREDITS) setThumbnailsRefreshError("Not enough credits to refresh thumbnails.");
      else setThumbnailsRefreshError("Couldn't refresh thumbnails. Try again.");
      return;
    }
    setIdeasStyleId(visualStyleId);
    for (const { ideaId, jobId } of result.jobs) {
      updateIdeaThumbnail(ideaId, { status: PREVIEW_STATUS.GENERATING, jobId });
      watchIdeaThumbnailJob(ideaId, jobId);
    }
  };

  // Retries ONE failed thumbnail — free (it's completing a batch already
  // paid for or free, not new paid content; see the edge function's own
  // comments for the exact rule and its bounded abuse surface).
  const retryIdeaThumbnail = (idea) => {
    if (!idea.thumbnailConcept) return;
    updateIdeaThumbnail(idea.id, { status: PREVIEW_STATUS.GENERATING, jobId: null });
    submitIdeaThumbnailJobs({
      discoverySessionId,
      styleId: visualStyleId,
      ideas: [{ id: idea.id, thumbnailConcept: idea.thumbnailConcept }],
      batchId: ideasBatchId,
      retry: true,
    }).then((result) => {
      if (!result.ok || result.jobs.length === 0) {
        updateIdeaThumbnail(idea.id, { status: PREVIEW_STATUS.FAILED });
        return;
      }
      const { jobId } = result.jobs[0];
      updateIdeaThumbnail(idea.id, { jobId });
      watchIdeaThumbnailJob(idea.id, jobId);
    });
  };

  const handleUseIdea = (idea) => {
    setTopic(idea.topic);
    setSelectedIdeaId(idea.id);
    setTopicMode("write");
    setSelectedIdeaThumbnailUrl(idea.thumbnail?.status === PREVIEW_STATUS.READY ? idea.thumbnail.imageUrl : null);
    persistDiscoverySession(discoverySessionId, { selected_idea_id: idea.id });
  };

  // Scroll affordances for the ideas grid (Section 4: bottom/top fades + a
  // "Scroll for N more" hint + a themed scrollbar) — a plain scroll listener
  // plus ResizeObserver, recomputed whenever the idea list itself changes.
  // hiddenCount is deliberately a proportional estimate from the scrollable
  // area (never tied to a hardcoded column count), so it stays correct
  // across the 1/2/3-column responsive grid without tracking layout itself.
  const recomputeIdeasScrollState = () => {
    const el = ideasScrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const atTop = scrollTop <= 2;
    const atBottom = scrollHeight - scrollTop - clientHeight <= 2;
    const hiddenRatio = scrollHeight > 0 ? Math.max(0, (scrollHeight - scrollTop - clientHeight) / scrollHeight) : 0;
    const hiddenCount = atBottom ? 0 : Math.max(1, Math.round(hiddenRatio * ideas.length));
    setIdeasScrollState({ atTop, atBottom, hiddenCount });
  };

  useEffect(() => {
    recomputeIdeasScrollState();
    const el = ideasScrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", recomputeIdeasScrollState, { passive: true });
    const resizeObserver = new ResizeObserver(recomputeIdeasScrollState);
    resizeObserver.observe(el);
    window.addEventListener("resize", recomputeIdeasScrollState);
    return () => {
      el.removeEventListener("scroll", recomputeIdeasScrollState);
      resizeObserver.disconnect();
      window.removeEventListener("resize", recomputeIdeasScrollState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ideas]);

  // Final-polish round 4, Section 4 — the idea cards are now thumbnail-topped
  // (taller, and a different height at every breakpoint since a 16:9
  // thumbnail's height tracks the card's own width). The "2 full rows + a
  // ~35% peek of the third" scroll height from the ORIGINAL fixed-h-[100px]
  // design can no longer be a hardcoded constant — it's measured off the
  // first real card's actual rendered height instead, so it stays correct
  // at every column count/width without guessing per-breakpoint numbers.
  const IDEA_GRID_GAP = 12;
  const ideaCardRef = useRef(null);
  const [ideasMaxHeight, setIdeasMaxHeight] = useState(259);
  useEffect(() => {
    const el = ideaCardRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setIdeasMaxHeight(Math.round(2 * h + 2 * IDEA_GRID_GAP + 0.35 * (h + IDEA_GRID_GAP)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [ideas.length, ideasLoading]);

  const handleGenerateVideo = async () => {
    if (!canGenerate || generating) return;
    setGenerating(true);
    setGenerateError(null);

    let projectId = createdProjectIdRef.current;
    if (!projectId) {
      // Phase 1 — a picked Discover-Ideas idea used to be silently dropped
      // here (always `selectedIdea: null`), even though handleUseIdea above
      // records its id in selectedIdeaId. That meant selected_idea_title/
      // selected_idea_angle/narrative_archetype_hint were always null on the
      // project row, so Story Plan/Script had no way to keep the idea's own
      // title/hook instead of re-deriving a different one.
      const selectedIdea = selectedIdeaId ? ideas.find((idea) => idea.id === selectedIdeaId) ?? null : null;
      const project = await createLongFormProject({
        discoverySessionId,
        topic,
        source: selectedIdea ? "discovery" : "custom",
        selectedIdea,
        lengthMode: "custom",
        customLengthMinutes: lengthMinutes,
        depthMode: "custom",
        customExplanationDepth: explanationDepth,
        onScreenTextDensity,
        // Section 1: invisible in "Your Long Form Videos" until the
        // reservation below actually succeeds — create-long-form-production-setup
        // flips this to 'planning' at that exact moment, never before.
        initialStatus: "draft",
      });
      if (!project) {
        setGenerating(false);
        setGenerateError("Couldn't start your project. Try again.");
        return;
      }
      projectId = project.id;
      createdProjectIdRef.current = projectId;
    }

    const setup = await createProductionSetup({
      projectId,
      visualRecipe: selectedStyle.visualRecipe,
      recipeVersion: selectedStyle.recipeVersion,
      renderTier,
      targetDurationMinutes: lengthMinutes,
      explanationDepth,
      voiceProvider: "elevenlabs",
      voiceId: voice.voiceId,
      voiceModel: voice.voiceModel,
      niche: nicheId,
    });
    setGenerating(false);
    if (!setup.ok) {
      setGenerateError(setup.message || "Couldn't reserve credits for this video.");
      return;
    }

    // The project is now real and visible — nothing left here for a refresh
    // to usefully restore, and keeping it around would just resurrect a
    // finished commitment's inputs the next time this page is opened fresh.
    clearPersistedDraft();
    // Phase 6a: Stickman runs ONE continuous pipeline (story plan ->
    // research-lite -> script) server-side — no Story Plan gate, no
    // "Continue to Research", straight to the "Writing your script" screen.
    if (selectedStyle.visualRecipe === STICKMAN_RECIPE) {
      await startAutopilot(projectId);
      navigate(`/long-form/project/${projectId}/generating`); // Phase 6e: one generating screen, no stops
      return;
    }
    navigate(`/long-form/project/${projectId}/story`);
  };

  const summary = (
    <>
      <div className="mb-4">
        <SummaryPreviewImage key={selectedIdeaThumbnailUrl ?? niche?.id ?? "none"} niche={niche} style={selectedStyle} ideaThumbnailUrl={selectedIdeaThumbnailUrl} />
      </div>
      <dl className="space-y-2.5 text-[13px]">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/40">Niche</dt>
          <dd className="text-right font-medium text-white">{niche ? niche.label : "—"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/40">Style</dt>
          <dd className="text-right font-medium text-white">{selectedStyle?.label ?? "—"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-white/40">Topic</dt>
          <dd className="truncate text-right font-medium text-white" title={topic}>{topic || "—"}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/40">Length</dt>
          <dd className="text-right font-medium text-white">{lengthMinutes} min</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/40">Quality</dt>
          <dd className="text-right font-medium text-white">{RENDER_TIER_OPTIONS.find((o) => o.value === renderTier)?.label}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-white/40">Voice</dt>
          <dd data-testid="summary-voice" className="text-right font-medium text-white">{voice ? `${voice.name} · ${voice.tags[0]}` : "—"}</dd>
        </div>
      </dl>
      <div className="mt-4 border-t border-white/[0.08] pt-4">
        {nicheLocked ? (
          <p className="text-[12.5px] text-white/35">Pick a niche to see your estimate.</p>
        ) : quoteLoading || !quote ? (
          <p className="flex items-center gap-2 text-[12.5px] text-white/40">
            <RotateCw className="h-3.5 w-3.5 animate-spin" />
            Calculating…
          </p>
        ) : (
          // Final-polish round 3, Section 2 — the big standalone "N credits"
          // line is gone: that number now lives INSIDE the Generate button
          // itself (below), so this stays a supporting estimate rather than
          // a second, competing price display.
          <>
            <p className="text-[13px] text-white/70">~<AnimatedNumber value={quote.estimatedBeatCount} reducedMotion={reducedMotion} /> visuals</p>
            <p className="mt-1 text-[11px] text-white/35">Fixed price — everything included. Fully refunded if the video can't be made.</p>
            {projectedBalance != null && (
              <p className="mt-2 text-[12px] text-white/50">
                Balance {credits.toLocaleString()} → {projectedBalance.toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </>
  );

  return (
    <div className="mx-auto max-w-[1180px] px-4 lg:px-8" style={{ paddingBottom: barSpace }}>
      <GuestGenerateModal open={guestModalOpen} onClose={() => setGuestModalOpen(false)} onSignup={() => navigate("/signup")} />
      <NichePickerModal open={nicheModalOpen} onClose={() => setNicheModalOpen(false)} onSelect={handleSelectNiche} />
      <VoiceLibraryDialog
        open={voiceModalOpen}
        currentVoiceId={voice?.voiceId ?? null}
        niche={niche}
        onClose={() => setVoiceModalOpen(false)}
        onSelect={(v) => { setVoice(v); setVoiceModalOpen(false); }}
      />
      <StylePickerModal
        open={styleModalOpen}
        currentId={visualStyleId}
        recommendedIds={recommendedStyleIds}
        onClose={() => setStyleModalOpen(false)}
        onSelect={(id) => { setVisualStyleId(id); setStyleModalOpen(false); }}
      />

      <div ref={layoutRef} className={hasSidePanel ? "grid grid-cols-[1fr_340px] items-start gap-8 py-12" : "py-8"}>
        <div className="min-w-0">
          <LongFormCreationHeader current="idea" stickman />

          <div className="mb-8">
            <h1 className="text-[26px] font-bold tracking-[-0.02em] text-white lg:text-[30px]">Create New Video</h1>
            <p className="mt-1.5 text-[14px] text-white/45">Follow the steps below — each one unlocks the next.</p>
          </div>

          {/* ① Niche */}
          <div className="mb-7">
            <SectionLabel n={1}>Niche</SectionLabel>
            {nicheLocked ? (
              <button
                type="button"
                onClick={() => setNicheModalOpen(true)}
                className="zyvo-niche-start group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-lime-300/35 bg-[#151719] p-5 text-left transition hover:border-lime-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
              >
                {/* Faint lime tint over the normal card color — never a glow/shadow. */}
                <span className="pointer-events-none absolute inset-0 bg-lime-300/[0.035]" />
                <span className="relative z-10 flex w-full items-center gap-4">
                  <FannedNicheStack />
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 inline-flex items-center rounded-full bg-lime-300/10 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-lime-300/90">
                      Start here
                    </span>
                    <span className="block text-[16px] font-bold text-white">Choose your niche</span>
                    <span className="block text-[12.5px] text-white/50">What kind of video is this?</span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-lime-300 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
                {/* One-shot light sweep along the border on mount — respects
                    prefers-reduced-motion (see the scoped stylesheet below). */}
                <span className="zyvo-niche-start-sweep pointer-events-none absolute inset-0 rounded-2xl" aria-hidden="true" />
                <style>{`
                  .zyvo-niche-start-sweep {
                    padding: 1px;
                    background: conic-gradient(from 0deg, transparent 0%, rgba(190,242,100,0.9) 6%, transparent 16%);
                    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    animation: zyvoNicheSweep 1.5s ease-out 1;
                  }
                  @keyframes zyvoNicheSweep { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                  @media (prefers-reduced-motion: reduce) {
                    .zyvo-niche-start-sweep { animation: none; display: none; }
                  }
                `}</style>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setNicheModalOpen(true)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#151719] p-4 text-left transition hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
              >
                <ImageWithFallback src={`/images/niches/${niche.id}.webp`} alt="" groupId={niche.groupId} className={SELECTED_ROW_THUMB_CLASS} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold text-white">{niche.label}</span>
                  <span className="block text-[12px] text-white/40">{niche.groupLabel}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold text-lime-300">Change</span>
              </button>
            )}
            {nicheLocked && <p className="mt-2.5 text-[12px] text-white/35">Choose a niche to unlock the rest.</p>}
          </div>

          <LockedSection locked={nicheLocked}>
            {/* ② Visual Style — final-polish round 4, Section 2: moved ahead
                of Topic (was ③) so the visual identity is locked in before
                the user writes/picks a topic. */}
            <div className="mb-7">
              <SectionLabel n={2}>Visual Style</SectionLabel>
              <button
                type="button"
                onClick={() => setStyleModalOpen(true)}
                className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#151719] p-4 text-left transition hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
              >
                <ImageWithFallback src={selectedStyle?.previewAssetUrl} alt="" className={SELECTED_ROW_THUMB_CLASS} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14.5px] font-bold text-white">{selectedStyle?.label}</span>
                    {recommendedStyleIds.has(selectedStyle?.id) && (
                      <span className="shrink-0 rounded-full border border-lime-300/30 bg-lime-300/10 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-lime-300">Recommended</span>
                    )}
                  </span>
                  <span className="mt-1 block truncate text-[12px] text-white/40">{selectedStyle?.summary}</span>
                </span>
                <span className="shrink-0 text-[12.5px] font-semibold text-lime-300">Change</span>
              </button>
            </div>

            {/* ③ Topic */}
            <div className="mb-7">
              <SectionLabel n={3}>Topic</SectionLabel>
              <div className="rounded-2xl border border-white/[0.09] bg-[#151719] p-4">
                <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] p-1.5">
                  <button
                    type="button"
                    onClick={() => setTopicMode("write")}
                    aria-pressed={topicMode === "write"}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${
                      topicMode === "write" ? "bg-lime-300 text-[#11150D]" : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                    }`}
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Write my own
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicMode("ideas")}
                    aria-pressed={topicMode === "ideas"}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition ${
                      topicMode === "ideas" ? "bg-lime-300 text-[#11150D]" : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
                    }`}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Get ideas for me
                  </button>
                </div>

                {topicMode === "write" ? (
                  <>
                    <div className="rounded-xl border border-white/[0.08] bg-[#101213] px-4 py-3 transition focus-within:border-[#BEF264]/50 focus-within:bg-[#111317]">
                      <textarea
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        rows={3}
                        placeholder={nicheId ? exampleTopicForNiche(nicheId) : ""}
                        className="w-full resize-none bg-transparent text-[15px] text-white outline-none placeholder:text-white/30"
                      />
                    </div>
                    <p className="mt-2.5 text-[12px] text-white/30">You don't need a perfect title. Describe the idea in your own words.</p>
                  </>
                ) : (
                  <div>
                    {/* Phase 6a: optional steer, sent with the niche + style; kept across Regenerate. */}
                    <label className="mb-3 block">
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">Steer the ideas (optional)</span>
                      <input
                        type="text"
                        value={ideaSteer}
                        onChange={(e) => setIdeaSteer(e.target.value.slice(0, 120))}
                        placeholder="e.g. pirates, weapons, kid-friendly"
                        disabled={ideasLoading}
                        className="w-full rounded-xl border border-white/[0.08] bg-[#101213] px-4 py-2.5 text-[14px] text-white outline-none transition placeholder:text-white/30 focus:border-[#BEF264]/50"
                      />
                    </label>
                    {!ideasLoading && (() => {
                      const isRegenerate = ideas.length > 0;
                      const cost = isRegenerate ? REGENERATE_IDEAS_COST : null;
                      const shortOnCredits = isRegenerate && typeof credits === "number" && credits < REGENERATE_IDEAS_COST;
                      return (
                        <>
                          <GenerateButton
                            enabled={Boolean(nicheId) && !shortOnCredits}
                            loading={false}
                            onClick={() => runGenerateIdeas(ideas)}
                            justUnlocked={false}
                            reducedMotion={reducedMotion}
                            credits={cost}
                            label={isRegenerate ? "Regenerate" : "Generate 10 ideas"}
                          />
                          {shortOnCredits && <p className="mt-2 text-center text-[12px] text-white/35">Not enough credits</p>}
                        </>
                      );
                    })()}

                    {ideasError && (
                      <div className="mt-3 flex items-center gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.05] px-4 py-3">
                        <p className="text-[12.5px] text-red-300/80">{ideasError}</p>
                        <button type="button" onClick={() => runGenerateIdeas(ideas)} className="shrink-0 text-[12.5px] font-semibold text-white/70 underline underline-offset-2 hover:text-white">
                          Try again
                        </button>
                      </div>
                    )}

                    {/* Style changed since these ideas/thumbnails were generated —
                        never auto-regenerates; just offers a paid, thumbnails-only refresh. */}
                    {!ideasLoading && ideasStyleId && ideasStyleId !== visualStyleId && ideas.length > 0 && (() => {
                      const shortOnCredits = typeof credits === "number" && credits < REFRESH_THUMBNAILS_COST;
                      return (
                        <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-3">
                          <p className="text-[12px] text-amber-200/80">Thumbnails use the previous style.</p>
                          <div className="mt-2 max-w-[220px]">
                            <GenerateButton
                              enabled={!shortOnCredits}
                              loading={thumbnailsRefreshing}
                              onClick={refreshThumbnails}
                              justUnlocked={false}
                              reducedMotion={reducedMotion}
                              credits={REFRESH_THUMBNAILS_COST}
                              label="Refresh thumbnails"
                              loadingLabel="Refreshing…"
                            />
                          </div>
                          {shortOnCredits && <p className="mt-2 text-[12px] text-white/35">Not enough credits</p>}
                          {thumbnailsRefreshError && <p className="mt-2 text-[12px] text-red-300/80">{thumbnailsRefreshError}</p>}
                        </div>
                      );
                    })()}

                    {(ideasLoading || ideas.length > 0) && (
                      <div className="relative mt-4">
                        <div
                          ref={ideasScrollRef}
                          className="zyvo-ideas-scroll grid grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3"
                          style={{ maxHeight: `${ideasMaxHeight}px` }} /* 2 full rows + a ~35% peek of a 3rd — measured off the first real card, see the ResizeObserver above */
                        >
                          {ideasLoading
                            ? Array.from({ length: 6 }).map((_, i) => <IdeaSkeleton key={i} />)
                            : ideas.map((idea, i) => {
                                const selected = idea.id === selectedIdeaId;
                                return (
                                  <div
                                    key={idea.id}
                                    ref={i === 0 ? ideaCardRef : undefined}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleUseIdea(idea)}
                                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleUseIdea(idea); } }}
                                    className={`flex cursor-pointer flex-col overflow-hidden rounded-xl border text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                                      selected ? "border-lime-300/60 bg-lime-300/[0.05]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/25"
                                    }`}
                                  >
                                    <IdeaThumbnail
                                      idea={idea}
                                      fallbackSrc={niche ? `/images/niches/${niche.id}.webp` : undefined}
                                      fallbackGroupId={niche?.groupId}
                                      onRetry={() => retryIdeaThumbnail(idea)}
                                    />
                                    <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="line-clamp-2 text-[13px] font-bold leading-snug text-white">{cleanText(idea.title)}</p>
                                        {selected && <Check className="h-4 w-4 shrink-0 text-lime-300" />}
                                      </div>
                                      <p className="line-clamp-1 text-[11.5px] text-white/45">{cleanText(idea.angle)}</p>
                                    </div>
                                  </div>
                                );
                              })}
                        </div>
                        {!ideasLoading && (
                          <>
                            <div className={`pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-[#151719] to-transparent transition-opacity duration-150 ${ideasScrollState.atTop ? "opacity-0" : "opacity-100"}`} />
                            <div className={`pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#151719] to-transparent transition-opacity duration-150 ${ideasScrollState.atBottom ? "opacity-0" : "opacity-100"}`} />
                          </>
                        )}
                      </div>
                    )}
                    {!ideasLoading && ideas.length > 0 && !ideasScrollState.atBottom && ideasScrollState.hiddenCount > 0 && (
                      <p className="mt-2 flex items-center justify-center gap-1.5 text-[11.5px] text-white/35">
                        Scroll for {ideasScrollState.hiddenCount} more idea{ideasScrollState.hiddenCount === 1 ? "" : "s"}
                        <ChevronDown className="h-3.5 w-3.5" />
                      </p>
                    )}
                    <style>{`
                      .zyvo-ideas-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
                      .zyvo-ideas-scroll::-webkit-scrollbar { width: 6px; }
                      .zyvo-ideas-scroll::-webkit-scrollbar-track { background: transparent; }
                      .zyvo-ideas-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 999px; }
                      .zyvo-ideas-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.28); }
                      .zyvo-idea-thumb-fade { animation: zyvoIdeaThumbFade 300ms ease-out; }
                      @keyframes zyvoIdeaThumbFade { from { opacity: 0; } to { opacity: 1; } }
                      @media (prefers-reduced-motion: reduce) { .zyvo-idea-thumb-fade { animation: none; } }
                    `}</style>
                  </div>
                )}
              </div>
            </div>

            {/* ④ Length */}
            <div className="mb-7">
              <SectionLabel n={4}>Length</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {LENGTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.minutes}
                    type="button"
                    onClick={() => setLengthMinutes(opt.minutes)}
                    aria-pressed={lengthMinutes === opt.minutes}
                    className={`rounded-xl border px-3 py-3 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                      lengthMinutes === opt.minutes ? "border-lime-300/40 bg-lime-300/[0.08]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <span className={`block text-[15px] font-bold ${lengthMinutes === opt.minutes ? "text-lime-300" : "text-white"}`}>{opt.minutes} min</span>
                  </button>
                ))}
              </div>
              <LengthSlider value={lengthMinutes} onChange={setLengthMinutes} reducedMotion={reducedMotion} wordsPerMinute={voicePace.wordsPerMinute} />
              <p className="mt-2.5 text-[12px] text-white/35">
                ≈<AnimatedNumber value={lengthEstimate.estimatedWords} reducedMotion={reducedMotion} /> words · ~
                <AnimatedNumber value={lengthVisuals.low} reducedMotion={reducedMotion} />–<AnimatedNumber value={lengthVisuals.high} reducedMotion={reducedMotion} /> visuals (estimate, not guaranteed)
              </p>
            </div>

            {/* ⑤ Quality */}
            <div className="mb-7">
              <SectionLabel n={5}>Quality</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {RENDER_TIER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRenderTier(opt.value)}
                    aria-pressed={renderTier === opt.value}
                    className={`relative flex flex-col items-start gap-1.5 rounded-2xl border p-4 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                      renderTier === opt.value ? "border-lime-300/50 bg-lime-300/[0.07]" : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    {opt.recommended && (
                      <span className="absolute right-3 top-3 rounded-full border border-lime-300/30 bg-lime-300/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-lime-300">Recommended</span>
                    )}
                    <span className="text-[14px] font-bold text-white">{opt.label}</span>
                    <span className="text-[12px] leading-snug text-white/45">{opt.description}</span>
                    <span data-testid={`tier-price-${opt.value}`} className="text-[12px] font-semibold text-white/75">{opt.perMin} credits / min</span>
                    <span className="mt-1 flex items-center gap-3 text-[10.5px] text-white/30">
                      <span className="flex items-center gap-1">Quality {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= opt.quality ? "bg-lime-300/70" : "bg-white/10"}`} />)}</span>
                      <span className="flex items-center gap-1">Cost {[1, 2, 3].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= opt.cost ? "bg-amber-300/70" : "bg-white/10"}`} />)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* ⑥ Voice — Phase 6b: chosen here, no preselection, so the
                autopilot can run story -> research -> script -> narration
                without stopping. The library modal has a sample per voice. */}
            <div className="mb-7">
              <SectionLabel n={6}>Voice</SectionLabel>
              {!voice ? (
                <button
                  type="button"
                  data-testid="choose-voice"
                  onClick={() => setVoiceModalOpen(true)}
                  className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-lime-300/35 bg-[#151719] p-5 text-left transition hover:border-lime-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                >
                  <span className="pointer-events-none absolute inset-0 bg-lime-300/[0.035]" />
                  <span className="relative z-10 flex w-full items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-lime-300/10 text-lime-300">
                      <Mic className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-bold text-white">Choose a voice</span>
                      <span className="block text-[12.5px] text-white/50">
                        {VOICE_CATALOG.length} narrators — listen to each one{niche ? `, with picks for ${niche.label}` : ""}.
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-lime-300 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </button>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  data-testid="chosen-voice"
                  onClick={() => setVoiceModalOpen(true)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setVoiceModalOpen(true); } }}
                  className="flex w-full cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#151719] p-4 text-left transition hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300"
                >
                  <SampleButton voice={voice} playingId={voicePlayer.playingId} onToggle={voicePlayer.toggle} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block truncate text-[14.5px] font-bold text-white">{voice.name}</span>
                      {isRecommendedForNiche(voice, niche) && <span className="rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-semibold text-lime-200">Recommended for this niche</span>}
                    </span>
                    <span className="block text-[12px] text-white/40">{voice.tags.join(" · ")} · ~{Math.round(voicePace.wordsPerMinute)} words/min</span>
                  </span>
                  <span className="shrink-0 text-[12.5px] font-semibold text-lime-300">Change</span>
                </div>
              )}
            </div>

            <div className="mb-7 rounded-2xl border border-white/[0.08] bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setAdvancedOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-t-2xl px-4 py-3.5 outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-lime-300/50"
              >
                <span className="text-[13px] font-semibold text-white">Advanced Settings</span>
                <ChevronRight className={`h-4 w-4 text-white/40 transition ${advancedOpen ? "rotate-90" : ""}`} />
              </button>
              {advancedOpen && (
                <div className="space-y-5 border-t border-white/[0.06] px-4 py-5">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">Explanation Depth</p>
                    <div className="flex flex-wrap gap-2">
                      {EXPLANATION_DEPTH_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setExplanationDepth(opt.value)}
                          className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                            explanationDepth === opt.value ? "border-lime-300/30 bg-lime-300 text-[#11150D]" : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">On-Screen Text</p>
                    <div className="flex flex-wrap gap-2">
                      {TEXT_DENSITY_OPTIONS.map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setOnScreenTextDensity(key)}
                          className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 ${
                            onScreenTextDensity === key ? "border-lime-300/30 bg-lime-300 text-[#11150D]" : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20"
                          }`}
                        >
                          {ON_SCREEN_TEXT_GUIDANCE[key].label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11.5px] text-white/30">{ON_SCREEN_TEXT_GUIDANCE[onScreenTextDensity].description}</p>
                  </div>
                </div>
              )}
            </div>
          </LockedSection>

          {/* Estimate preview when there's no room for the side panel — the
              sticky bottom Generate bar is the ONLY Generate surface at any
              width now (final-polish pass, Section 1), so this stays purely
              informational and never duplicates its price/error/retry UI. */}
          {!hasSidePanel && (
            <div className="rounded-2xl border border-white/[0.09] bg-[#151719] p-5">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/30">Project Estimate</p>
              {nicheLocked ? (
                <p className="text-[13px] text-white/40">Pick a niche to see your estimate.</p>
              ) : quoteLoading || !quote ? (
                <p className="flex items-center gap-2 text-[13px] text-white/40">
                  <RotateCw className="h-3.5 w-3.5 animate-spin" />
                  Calculating…
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[14px] text-white/80">~<AnimatedNumber value={quote.estimatedBeatCount} reducedMotion={reducedMotion} /> visuals</p>
                  <p className="text-[14px] text-white/80">{RENDER_TIER_OPTIONS.find((o) => o.value === renderTier)?.label}</p>
                  <p className="mt-2 text-[15px] font-bold text-white">Price: <AnimatedNumber value={quote.totalCredits} reducedMotion={reducedMotion} /> credits <span className="text-[12px] font-normal text-white/45">(fixed, everything included)</span></p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky right summary panel — only when the container has real
            room for it (see the ResizeObserver above). `top-6` sticks it
            below the workspace header inside #workspace-scroll, the correct
            (and only) scrolling ancestor between here and the viewport —
            verified no intermediate ancestor sets its own overflow/transform/
            filter that would break the sticky containing block.

            Final-polish round 4, Section 1 — JITTER FIX. The previous
            version bounded max-height with `calc(100dvh - var(--zyvo-
            content-top))`, a value a JS ResizeObserver on #workspace-scroll
            (layout.jsx) recomputes on every resize of that element — a
            *scroll-adjacent* dependency by construction, since #workspace-
            scroll resizes whenever its flex sibling above it (the notice
            banner + TopRow header) changes height. Reacting to that through
            a JS round-trip instead of the same synchronous layout pass is
            exactly the class of bug that makes a sticky panel visibly snap
            independently of the scroll itself. Fixed by making every input
            to this element's position/size a plain, scroll-independent
            constant: `top-6` alone (already correct on its own — sticky's
            `top` resolves against #workspace-scroll, not the true viewport,
            so it never actually needed the JS variable), and a max-height
            built from ONLY values that don't change while scrolling —
            `100dvh` (native, no JS), the promo banner's real height
            (`--zyvo-notice-height`, a pre-existing var that only changes
            when the user dismisses the banner — a deliberate layout change,
            not scroll noise), and TopRow's own height, hardcoded as 56px
            since it's a fixed design constant (`py-3` + one row of fixed-
            size controls, never content-variable) rather than measured, so
            nothing here depends on a ResizeObserver callback's timing
            relative to a scroll frame. `transform: translateZ(0)` promotes
            the panel to its own compositor layer — the standard fix for the
            separate, browser/DPI-scaling-level sub-pixel shimmer some
            Chromium builds show on `position: sticky` without it. No
            transitions on top/transform/margin anywhere in this chain, and
            `items-start` on the grid parent already gives every grid item
            `align-self: start`, so the panel is exactly as tall as its own
            content, never stretched to the (much taller) left column.

            Final-polish round 3, Section 2 — the Generate button lives
            INSIDE this panel (no more full-width bottom bar on desktop).
            The card is a flex column split in two: the top part (preview +
            fields + estimate) scrolls internally if it's ever taller than
            the available space, while the bottom part (button + reason) is
            `shrink-0` — pinned, always fully visible, never clipped. */}
        {hasSidePanel && (
          <aside
            className="sticky top-6 flex flex-col"
            style={{ maxHeight: "calc(100dvh - 56px - var(--zyvo-notice-height, 0px) - 24px - 24px)", transform: "translateZ(0)" }}
          >
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#151719]">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">{summary}</div>
              <div className="shrink-0 border-t border-white/[0.08] p-5 pt-4">
                <GenerateButton
                  enabled={canGenerate && !quoteLoading}
                  loading={generating}
                  onClick={handleGenerateVideo}
                  justUnlocked={justUnlocked}
                  reducedMotion={reducedMotion}
                  credits={quote && !quoteLoading ? quote.totalCredits : null}
                />
                {showGenerateReason && <p className="mt-2 text-center text-[12px] text-white/35">{disabledReason}</p>}
                {sessionError && (
                  <div className="mt-2 flex items-center gap-2">
                    <p className="flex-1 text-[11.5px] text-red-300/80">
                      {sessionError === "TOO_MANY_SESSIONS" ? "Too many new videos started recently." : "Couldn't set up this session."}
                    </p>
                    <button type="button" onClick={bootstrapSession} className="shrink-0 text-[11.5px] font-semibold text-white/70 underline underline-offset-2 hover:text-white">
                      Try again
                    </button>
                  </div>
                )}
                {generateError && <p className="mt-2 text-[12px] font-medium text-red-300/80">{generateError}</p>}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Final-polish round 3, Section 2 — the sticky bottom bar is the
          Generate surface ONLY when there's no side panel; on desktop, once
          the panel is showing, the button above already covers it. */}
      {!hasSidePanel && (
        <GenerateBar
          barRef={barRef}
          quote={quote}
          quoteLoading={quoteLoading}
          credits={credits}
          canGenerate={canGenerate}
          generating={generating}
          disabledReason={disabledReason}
          sessionError={sessionError}
          generateError={generateError}
          onRetrySession={bootstrapSession}
          onGenerate={handleGenerateVideo}
          justUnlocked={justUnlocked}
          reducedMotion={reducedMotion}
        />
      )}
    </div>
  );
}
