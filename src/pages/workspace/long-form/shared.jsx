import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowRight, Check, Clapperboard, ImageOff, RotateCw, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { IDEA_CATEGORY_OPTIONS, PREVIEW_STATUS } from "./discoverIdeas";
import { LONG_FORM_STAGES } from "./state";
import { deriveProjectStageInfo, formatElapsedMinutes, formatProjectDuration } from "./projectStage";

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
export function LongFormCreationHeader({ current }) {
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
        <LongFormProgress current={current} />
      </div>
    </div>
  );
}

export function LongFormProgress({ current = "idea" }) {
  const currentIndex = LONG_FORM_STAGES.findIndex((stage) => stage.key === current);

  return (
    <div className="flex min-w-0 items-center gap-2 overflow-x-auto">
      {LONG_FORM_STAGES.map((stage, i) => {
        const active = i === currentIndex;
        const done = i < currentIndex;
        return (
          <div key={stage.key} className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-lime-300" : done ? "bg-lime-300/50" : "bg-white/15"}`} />
              <span className={`text-[11.5px] font-semibold ${active ? "text-white" : "text-white/30"}`}>{stage.label}</span>
            </div>
            {i < LONG_FORM_STAGES.length - 1 && <span className="h-px w-5 bg-white/10" />}
          </div>
        );
      })}
    </div>
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
        <h3 className="text-[14.5px] font-bold leading-snug text-white">{idea.title}</h3>
        <p className="flex-1 text-[12.5px] leading-relaxed text-white/45">{idea.angle}</p>

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
export function ProjectCard({ project }) {
  const navigate = useNavigate();
  const stage = deriveProjectStageInfo(project);
  const duration = formatProjectDuration(project);
  const elapsed = stage.active ? formatElapsedMinutes(stage.startedAt) : null;
  const title = project.selected_title || project.selected_idea_title || project.topic;
  const tint = tintForIdea(project.id);

  return (
    <button
      type="button"
      onClick={() => navigate(`/long-form/project/${project.id}/${stage.route}`)}
      className="group flex flex-col overflow-hidden rounded-[16px] border border-white/[0.08] bg-white/[0.03] text-left transition hover:border-white/[0.16]"
    >
      <div className="relative aspect-video w-full overflow-hidden">
        {project._conceptPreviewUrl ? (
          // Cover priority (final thumbnail / representative scene / Visual
          // World board / storyboard preview) doesn't exist yet at this
          // stage of the product — this is the cheapest real cover above
          // that: the concept preview the user already saw and picked in
          // Discover Ideas, never a newly-generated image.
          <img src={project._conceptPreviewUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
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
        <h3 className="line-clamp-2 text-[14px] font-bold leading-snug text-white">{title}</h3>
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${
              stage.active ? "border-lime-300/30 bg-lime-300/10 text-lime-300" : STAGE_BADGE_CLASS[stage.topLevel] ?? "border-white/15 bg-white/[0.04] text-white/50"
            }`}
          >
            {stage.active && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-lime-300" />}
            {stage.active ? stage.statusLabel : `${stage.topLevel} · ${stage.statusLabel}`}
            {stage.active && "…"}
          </span>
          {elapsed ? <span className="text-[11px] font-medium text-white/35">{elapsed}</span> : duration && <span className="text-[11px] font-medium text-white/35">{duration}</span>}
        </div>
        {project.created_at && <p className="text-[10.5px] text-white/25">Created {formatProjectDate(project.created_at)}</p>}
      </div>
    </button>
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
// drive the right-hand CTA. Generic on purpose — every current Idea/Story/
// Research usage is just different label/handler values, nothing more.
export function LongFormActionFooter({
  secondaryLabel,
  onSecondary,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  primaryLoadingLabel,
  maxWidthClassName = "max-w-[760px]",
}) {
  return (
    <div className="fixed inset-x-0 z-40 border-t border-white/[0.08] bg-[#101213]/97 px-4 py-3 backdrop-blur-xl bottom-[calc(78px+env(safe-area-inset-bottom))] lg:bottom-0">
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
        <button
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
        </button>
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
