import { useContext, useEffect, useRef, useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, ImageOff, MoreVertical, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IDEA_CATEGORY_OPTIONS, PREVIEW_STATUS } from "./discoverIdeas";
import { LONG_FORM_STAGES, LONG_FORM_STICKMAN_STAGES, STICKMAN_STEP_FOR_PAGE } from "./state";
import { deriveProjectStageInfo, deriveStickmanStep, formatElapsedMinutes, formatProjectDuration, humanizeProjectStatus, resolveStoryStepRoute, resolveLookStepRoute, reachableStickmanSteps } from "./projectStage";
import { deleteLongFormProject, selectStoryTitle } from "./project";
import { cleanText } from "./textClean";
import { StickmanProjectContext } from "./stickmanContext";

// Top row for /long-form/new and every future Long Form creation-step page:
// an explicit route back to the lobby (never navigate(-1) — these steps may
// be entered via deep link, from Creations, or after a refresh) plus the
// stage stepper, so the workspace always shows where you are and how to leave.
//
// Sticky on purpose: #workspace-scroll (see pages/workspace/layout.jsx) is
// the ONLY scrolling ancestor here — TopRow and the promo banner both live
// outside it as fixed flex siblings, never scrolling themselves — so
// `sticky top-0` pins this exactly below them with no offset math, and
// never overlaps either. Horizontal inset is inherited from each page's own
// container padding (sticky only pins vertically), so this works unchanged
// across the centered and split-view layouts without duplicating that
// padding here.
export function LongFormCreationHeader({ current, project, stickman = false }) {
  const navigate = useNavigate();
  const headerRef = useRef(null);

  // Measures its own real rendered height rather than guessing a pixel
  // value — same technique WorkspaceLayout already uses for
  // --zyvo-notice-height. Anything below (the discovery split view's sticky
  // left rail) reads --lf-header-h to know exactly how much room this
  // header actually takes, so it never has to hardcode/duplicate that number.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sync = () => document.documentElement.style.setProperty("--lf-header-h", `${el.getBoundingClientRect().height}px`);
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--lf-header-h");
    };
  }, []);

  return (
    <div ref={headerRef} className="sticky top-0 z-30 mb-6 border-b border-white/[0.06] bg-[#090A0A]/92 py-3 backdrop-blur-md">
      <div className="flex flex-nowrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate("/long-form")}
          className="group -ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-1 py-1 text-[13px] font-semibold text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 transition group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Back to Long Form</span>
          <span className="sm:hidden">Long Form</span>
        </button>
        <LongFormProgress current={current} project={project} stickman={stickman} />
      </div>
    </div>
  );
}

// `project` is optional (some pages — Idea's own /long-form/new, or a page
// that hasn't loaded its project yet — render this before a project row
// exists at all): every completed step just renders as a plain label in
// that case, identical to the previous non-interactive behavior.
//
// `stickman` is an explicit boolean the CALLER decides (from the project's
// own active generation_profile.visual_recipe, or — on /long-form/new,
// before any project/profile exists yet — the locally-selected recipe draft
// value) rather than something derived here. This component has no way to
// safely fetch a profile itself (see productionProfile.js's own comment on
// why long_form_generation_profiles has no direct table grant), and
// guessing from `project` alone would misclassify a Stickman project before
// its profile row loads. Defaults to false — the legacy 5-stage flow is the
// only stage list rendered unless a caller explicitly opts in.
export function LongFormProgress({ current = "idea", project = null, stickman = false }) {
  const navigate = useNavigate();
  const stages = stickman ? LONG_FORM_STICKMAN_STAGES : LONG_FORM_STAGES;
  // Phase 6c: for Stickman the highlighted step is the PAGE's own step (so the
  // stepper always matches the page); how far the project has got comes from
  // the route guard's live facts (script locked / voice ready / scenes drawn).
  const guarded = useContext(StickmanProjectContext);
  const stickmanProject = stickman ? (guarded && (!project || guarded.id === project.id) ? { ...project, ...guarded } : project) : null;
  const furthestKey = stickman ? (stickmanProject ? deriveStickmanStep(stickmanProject).key : "idea") : null;
  const stickmanKey = stickman ? STICKMAN_STEP_FOR_PAGE[current] ?? furthestKey : null;
  const furthestIndex = stickman ? stages.findIndex((stage) => stage.key === furthestKey) : -1;
  const currentIndex = stages.findIndex((stage) => stage.key === (stickman ? stickmanKey : current));
  const storyRoute = project ? resolveStoryStepRoute(project) : null;
  const lookRoute = project ? resolveLookStepRoute(project) : null;
  const currentStage = stages[currentIndex] ?? stages[0];

  return (
    <>
      {/* Final-polish round 2, Section 4 — below 768px the full stepper's
          labels get visually cut off right next to the back link (there
          just isn't room for both), so it's swapped for one compact line
          instead of trying to force the full row to somehow still fit. */}
      <p className="truncate text-[12px] font-semibold text-white/50 md:hidden">
        Step {currentIndex + 1} of {stages.length} · {currentStage.label}
      </p>
      <div className="hidden min-w-0 items-center gap-2 overflow-x-auto md:flex">
        {stages.map((stage, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex || (stickman && i <= furthestIndex && !active);
        // "story" and "look" have a real, safe destination once completed —
        // the furthest completed Story-family artifact (Story Plan /
        // Research / Narration; see resolveStoryStepRoute) and the
        // completed VisualPlan (resolveLookStepRoute) respectively. Both are
        // plain view/edit navigations, never a rebuild trigger. "idea" is
        // deliberately left non-clickable: reopening it for an already-
        // committed project isn't safely reconstructable with the current
        // /long-form/new architecture (that route is keyed to a disposable
        // discovery-session draft, not an existing project id) — faking a
        // "back to idea" navigation risks confusing draft state, so it stays
        // a plain completed-step label rather than a navigation this
        // codebase doesn't actually support yet. "generate"/"edit" are never
        // clickable from the stepper itself (they're not yet reached, or
        // they're the current step already).
        // Stickman: every reached step opens its own page (the guard keeps it honest).
        // Stickman (6e): every reached step opens its saved page instantly (never re-runs anything).
        const reach = stickman && stickmanProject ? reachableStickmanSteps(stickmanProject) : {};
        const route = stickman
          ? (project ? reach[stage.key] ?? null : null)
          : stage.key === "story" ? storyRoute : stage.key === "look" ? lookRoute : null;
        const clickable = !active && Boolean(route) && (done || stickman);
        const label = (
          <>
            <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-lime-300" : done ? "bg-lime-300/50" : "bg-white/15"}`} />
            <span className={`text-[11.5px] font-semibold ${active ? "text-white" : done ? "text-white/55" : "text-white/30"}`}>{stage.label}</span>
          </>
        );
        return (
          <div key={stage.key} className="flex shrink-0 items-center gap-2">
            {clickable ? (
              <button
                type="button"
                onClick={() => navigate(`/long-form/project/${project.id}/${route}`)}
                className="flex items-center gap-1.5 rounded px-0.5 py-0.5 transition hover:opacity-75 focus:outline-none focus-visible:ring-1 focus-visible:ring-lime-300"
                aria-label={`Back to ${stage.label}`}
              >
                {label}
              </button>
            ) : (
              <div className="flex items-center gap-1.5">{label}</div>
            )}
            {i < stages.length - 1 && <span className="h-px w-5 bg-white/10" />}
          </div>
        );
      })}
      </div>
    </>
  );
}

// Deterministic, non-lime tint for a mock concept-preview placeholder tile.
// Lime is reserved for selection/primary-action/progress/success — a real
// generated preview image will replace this entirely once the cheap
// image-generation path is wired up.
const PREVIEW_TINTS = ["#60a5fa", "#a78bfa", "#f472b6", "#38bdf8", "#fb923c", "#34d399"];
function tintForIdea(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return PREVIEW_TINTS[hash % PREVIEW_TINTS.length];
}

function ConceptPreview({ idea }) {
  const { status, imageUrl } = idea.conceptPreview;

  if (status === PREVIEW_STATUS.READY && imageUrl) {
    return <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />;
  }

  if (status === PREVIEW_STATUS.READY) {
    // READY with no URL shouldn't happen from the real pipeline, but stay
    // graceful rather than showing a broken image.
    const tint = tintForIdea(idea.id);
    return (
      <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${tint}33, ${tint}0d)` }}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-9 w-9 rounded-full border" style={{ borderColor: `${tint}55`, background: `${tint}22` }} />
        </div>
      </div>
    );
  }

  if (status === PREVIEW_STATUS.FAILED) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-white/[0.02] text-white/25">
        <ImageOff className="h-4.5 w-4.5" />
        <span className="text-[10.5px] font-medium">Preview unavailable</span>
      </div>
    );
  }

  // PENDING or GENERATING — skeleton shimmer, never a page-blocking spinner.
  return (
    <div className="absolute inset-0 animate-pulse bg-white/[0.04]">
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10.5px] font-medium text-white/25">
          {status === PREVIEW_STATUS.GENERATING ? "Rendering concept…" : "Queued"}
        </span>
      </div>
    </div>
  );
}

export function IdeaCard({ idea, selected, onUse, onDismiss }) {
  const categoryLabel = IDEA_CATEGORY_OPTIONS.find((o) => o.value === idea.category)?.label ?? idea.category;

  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[16px] border transition ${
        selected ? "border-lime-300/50 bg-lime-300/[0.05]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.16]"
      }`}
    >
      <div className="relative aspect-video w-full overflow-hidden">
        <ConceptPreview idea={idea} />
        <span className="absolute left-2.5 top-2.5 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/55 backdrop-blur-sm">
          Concept preview
        </span>
        {selected ? (
          <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-lime-300 text-[#11150D]">
            <Check className="h-3.5 w-3.5" strokeWidth={3} />
          </span>
        ) : (
          onDismiss && (
            <button
              type="button"
              onClick={() => onDismiss(idea.id)}
              aria-label="Dismiss idea"
              className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-white/50 opacity-0 backdrop-blur-sm transition group-hover:opacity-100 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-white/40">
          {categoryLabel}
        </span>
        <h3 className="text-[14.5px] font-bold leading-snug text-white">{cleanText(idea.title)}</h3>
        <p className="flex-1 text-[12.5px] leading-relaxed text-white/45">{cleanText(idea.angle)}</p>

        <button
          type="button"
          onClick={() => onUse(idea)}
          className={`mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition active:scale-[0.98] ${
            selected
              ? "border border-lime-300/40 bg-lime-300/10 text-lime-300"
              : "bg-lime-300 text-[#11150D] hover:bg-lime-200"
          }`}
        >
          {selected ? (
            <>
              Selected
              <Check className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Use Idea
              <ArrowRight className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

const STAGE_BADGE_CLASS = {
  Video: "border-emerald-300/30 bg-emerald-300/10 text-emerald-300",
  Look: "border-lime-300/30 bg-lime-300/10 text-lime-300",
  Story: "border-sky-300/30 bg-sky-300/10 text-sky-300",
};

function formatProjectDate(dateStr) {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

// One card per long_form_projects row in "Your Long Form Videos" — a
// project exists here the instant "Create Story Plan" is clicked (see
// create-long-form-project), long before any video is rendered, so this is
// the user's workspace/history, not a finished-videos gallery. Deliberately
// simple (no dashboard): a placeholder tile (no generated preview exists
// yet at most stages), title, a "{topLevel} · {status}" badge, duration or
// live elapsed time, and a created date. Clicking resumes the project at
// whatever stage deriveProjectStageInfo (projectStage.js) determines it
// actually reached — including genuinely active work (researching/
// drafting/planning), not just the last completed pointer.
// 2026-10-03 "fixes round 3" pass, Section 3 — the card's status badge now
// shows exactly one of humanizeProjectStatus's 7 human buckets (never the
// raw topLevel/statusLabel pair, e.g. never "Story · Script Ready" or
// "Scenes · 111 need review" again), with the real "Xm ago"/live-elapsed
// treatment kept only for genuinely active work.
export function ProjectCard({ project, onChanged }) {
  const navigate = useNavigate();
  const stage = deriveProjectStageInfo(project);
  const humanStatus = humanizeProjectStatus(stage);
  const duration = formatProjectDuration(project);
  const elapsed = stage.active ? formatElapsedMinutes(stage.startedAt) : null;
  const title = project.selected_title || project.selected_idea_title || project.topic;
  const tint = tintForIdea(project.id);
  const createdLabel = formatProjectDate(project.created_at);
  const metaLine = [duration, createdLabel].filter(Boolean).join(" · ");
  const [busy, setBusy] = useState(false);

  const open = () => navigate(`/long-form/project/${project.id}/${stage.route}`);

  const handleRename = async () => {
    const next = window.prompt("Rename this video", title);
    if (!next || !next.trim() || next.trim() === title) return;
    setBusy(true);
    const ok = await selectStoryTitle(project.id, next.trim());
    setBusy(false);
    if (ok) onChanged?.();
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${title}"? This can't be undone from here.`)) return;
    setBusy(true);
    const ok = await deleteLongFormProject(project.id);
    setBusy(false);
    if (ok) onChanged?.();
  };

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.03] text-left transition hover:border-white/[0.16]">
      <div className="relative aspect-video w-full shrink-0 overflow-hidden">
        {project._thumbnailUrl ? (
          <img src={project._thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${tint}33, ${tint}0d)` }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clapperboard className="h-8 w-8 opacity-40" style={{ color: tint }} strokeWidth={1.5} />
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 min-h-[2.6em] text-[14px] font-bold leading-snug text-white">{title}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              stage.active ? "border-lime-300/30 bg-lime-300/10 text-lime-300" : STAGE_BADGE_CLASS[stage.topLevel] ?? "border-white/15 bg-white/[0.04] text-white/50"
            }`}
          >
            {stage.active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-lime-300" />}
            {humanStatus}
            {stage.active && "…"}
          </span>
          {elapsed && <span className="text-[11px] font-medium text-white/35">{elapsed}</span>}
        </div>
        {metaLine && <p className="text-[10.5px] text-white/25">{metaLine}</p>}
      </div>

      {/* Full-card click target — positioned so the "⋯" menu (z-10, its own
          absolute corner box) always wins the topmost hit-test over this. */}
      <button type="button" onClick={open} aria-label={`Open ${title}`} disabled={busy} className="absolute inset-0 z-0" />

      <div className="absolute right-2 top-2 z-10">
        <Menu>
          <MenuButton
            onClick={(e) => e.stopPropagation()}
            disabled={busy}
            aria-label="Video options"
            className="grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition hover:bg-black/70 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-300 group-hover:opacity-100 data-[open]:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </MenuButton>
          <MenuItems anchor="bottom end" className="z-20 mt-1 w-40 rounded-xl border border-white/10 bg-[#181b1d] p-1 shadow-xl focus:outline-none">
            <MenuItem>
              <button type="button" onClick={open} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-white/80 data-[focus]:bg-white/10">
                <ArrowRight className="h-3.5 w-3.5" /> Open
              </button>
            </MenuItem>
            <MenuItem>
              <button type="button" onClick={handleRename} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-white/80 data-[focus]:bg-white/10">
                <Pencil className="h-3.5 w-3.5" /> Rename
              </button>
            </MenuItem>
            <MenuItem>
              <button type="button" onClick={handleDelete} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-medium text-red-300/90 data-[focus]:bg-red-400/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </MenuItem>
          </MenuItems>
        </Menu>
      </div>
    </div>
  );
}

// The one sticky action footer for every Long Form stage (Idea/Story/Look/
// Generate/Edit) — no page builds its own. The primary CTA must be visible
// the instant a page loads, never something the user scrolls to discover;
// this owns that guarantee in one place instead of six near-duplicate
// fixed-footer blocks drifting out of sync with each other over time.
//
// Positioning mirrors the proven Short Form pattern (e.g. ImageGenerator's
// Generate.jsx): fixed above MobileBottomNav + its safe-area on small
// screens, flush to the viewport bottom from lg up, where MobileBottomNav
// is hidden. `bottom-0` at lg is correct here (not `lg:sticky`) because
// every Long Form page's own scroll container is the workspace's shared
// #workspace-scroll, not a locally-scrolling box this footer lives inside —
// same reasoning already proven in story.jsx/research.jsx before this
// became a shared component.
//
// API: secondaryLabel/onSecondary render "← Back"-style text on the left
// (omitted entirely if no secondaryLabel is passed, and the primary CTA
// takes the full row); primaryLabel/onPrimary/primaryDisabled/primaryLoading
// drive the right-hand CTA (omitted when there's no primaryLabel: Publish
// keeps its primary actions in its cards). Generic on purpose — every current Idea/Story/
// Research usage is just different label/handler values, nothing more.
//
// tertiaryLabel/onTertiary/tertiaryLoading is an OPTIONAL middle action (an
// outlined secondary button, between the quiet back-link and the primary
// CTA) — added for Script's "Regenerate Script", which previously lived
// inline in the page body and got silently hidden behind this same fixed
// footer once the narration was long enough (see the real reported bug:
// visible "Show Less," a sticky footer starting right below it, and
// "Regenerate Script" rendered underneath that footer, unreachable).
// Omitted entirely by every other caller, which keeps their exact original
// two-button layout byte-identical — only stacks into 3 full-width rows on
// mobile when a tertiary action is actually present.
export function LongFormActionFooter({
  secondaryLabel,
  onSecondary,
  tertiaryLabel,
  onTertiary,
  tertiaryLoading = false,
  tertiaryLoadingLabel,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel,
  maxWidthClassName = "max-w-[760px]",
}) {
  if (tertiaryLabel) {
    return (
      <div data-long-form-footer className="fixed inset-x-0 z-40 border-t border-white/[0.08] bg-[#101213]/97 px-4 py-3 backdrop-blur-xl bottom-[calc(78px+env(safe-area-inset-bottom))] lg:bottom-0">
        <div className={`mx-auto flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 lg:px-4 ${maxWidthClassName}`}>
          {secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex shrink-0 items-center gap-1.5 self-start text-[12.5px] font-semibold text-white/45 transition hover:text-white sm:self-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {secondaryLabel}
            </button>
          )}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={onTertiary}
              disabled={tertiaryLoading}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-[13.5px] font-semibold text-white/75 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {tertiaryLoading && <RotateCw className="h-3.5 w-3.5 animate-spin" />}
              {tertiaryLoading ? tertiaryLoadingLabel || tertiaryLabel : tertiaryLabel}
            </button>
            <button
              type="button"
              onClick={onPrimary}
              disabled={primaryDisabled || primaryLoading}
              className={`inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14.5px] font-semibold transition sm:w-auto ${
                primaryDisabled || primaryLoading
                  ? "cursor-not-allowed border border-white/[0.08] bg-[#202224] text-white/35"
                  : "bg-lime-300 text-[#11150D] hover:bg-lime-200 active:scale-[0.99]"
              }`}
            >
              {primaryLoading ? (
                <>
                  <RotateCw className="h-4 w-4 animate-spin" />
                  {primaryLoadingLabel || primaryLabel}
                </>
              ) : (
                <>
                  {primaryLabel}
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div data-long-form-footer className="fixed inset-x-0 z-40 border-t border-white/[0.08] bg-[#101213]/97 px-4 py-3 backdrop-blur-xl bottom-[calc(78px+env(safe-area-inset-bottom))] lg:bottom-0">
      <div className={`mx-auto flex items-center gap-3 lg:px-4 ${maxWidthClassName} ${secondaryLabel ? "justify-between" : "justify-end"}`}>
        {secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-white/45 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {secondaryLabel}
          </button>
        )}
        {primaryLabel && <button
          type="button"
          onClick={onPrimary}
          disabled={primaryDisabled || primaryLoading}
          className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14.5px] font-semibold transition ${
            secondaryLabel ? "" : "w-full sm:w-auto"
          } ${
            primaryDisabled || primaryLoading
              ? "cursor-not-allowed border border-white/[0.08] bg-[#202224] text-white/35"
              : "bg-lime-300 text-[#11150D] hover:bg-lime-200 active:scale-[0.99]"
          }`}
        >
          {primaryLoading ? (
            <>
              <RotateCw className="h-4 w-4 animate-spin" />
              {primaryLoadingLabel || primaryLabel}
            </>
          ) : (
            <>
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>}
      </div>
    </div>
  );
}

export function ChipRow({ label, options, value, onChange }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                active
                  ? "border-lime-300/30 bg-lime-300 text-[#11150D]"
                  : "border-white/10 bg-white/[0.03] text-white/50 hover:border-white/20 hover:text-white/80"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Phase 7: an error line; "Not enough credits — Add credits" gets a real Add credits link.
export function CreditsError({ message, className = "text-[12px] text-red-200" }) {
  if (!message) return null;
  const short = /^Not enough credits/i.test(message);
  return (
    <p className={className} data-testid={short ? "not-enough-credits" : undefined}>
      {short ? <>Not enough credits — <a href="/workspace/pricing" className="font-semibold text-lime-200 underline underline-offset-2">Add credits</a></> : message}
    </p>
  );
}
