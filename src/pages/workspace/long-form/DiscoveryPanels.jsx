import { ArrowRight, Clock, RotateCw } from "lucide-react";
import { IDEA_CATEGORY_OPTIONS, IDEA_DIRECTION_OPTIONS } from "./discoverIdeas";
import { IdeaCard } from "./shared";
import LongFormSelect from "./LongFormSelect";
import { LengthDepthControls } from "./LengthDepthControls";
import { TextDensityControl } from "./TextDensityControl";

function formatCountdown(ms) {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Left panel for the DISCOVERY_RESULTS split view: a viewport-height flex
// column — scrollable body (controls + selected idea) on top, a persistent
// footer holding the single primary CTA at the bottom. The CTA's physical
// position never moves whether or not an idea is selected — only its
// enabled/lime vs disabled/neutral state changes — so the action stays in
// the same learnable spot for tutorials and repeat use.
export function DiscoveryLeftPanel({
  draft,
  onCategoryChange,
  onDirectionChange,
  onGenerateMore,
  isGeneratingMore,
  generateMoreFailed,
  cooldownRemainingMs,
  selectedIdea,
  onSettingsChange,
  onCreateStoryPlan,
  canCreateStoryPlan,
  creatingStoryPlan,
  createStoryPlanFailed,
}) {
  const inCooldown = cooldownRemainingMs > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-0.5">
        <div className="rounded-2xl border border-white/[0.09] bg-[#151719] p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Discover Ideas</h2>

          <div className="mt-3 space-y-3">
            <LongFormSelect label="Category" options={IDEA_CATEGORY_OPTIONS} value={draft.ideaCategory} onChange={onCategoryChange} />
            <LongFormSelect label="Direction" options={IDEA_DIRECTION_OPTIONS} value={draft.ideaDirection} onChange={onDirectionChange} />
          </div>

          <button
            type="button"
            onClick={onGenerateMore}
            disabled={isGeneratingMore || inCooldown}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13.5px] font-semibold transition ${
              inCooldown
                ? "cursor-default border border-white/[0.07] bg-white/[0.02] text-white/35"
                : isGeneratingMore
                  ? "cursor-wait border border-white/[0.08] bg-[#202224] text-white/45"
                  : "bg-lime-300 text-[#11150D] hover:bg-lime-200 active:scale-[0.99]"
            }`}
          >
            {inCooldown ? (
              <>
                <Clock className="h-3.5 w-3.5" />
                More ideas available in {formatCountdown(cooldownRemainingMs)}
              </>
            ) : isGeneratingMore ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate 10 More"
            )}
          </button>
          {generateMoreFailed && !inCooldown && (
            <p className="mt-2 text-[11.5px] font-medium text-red-300/80">Couldn't generate more ideas. Try again.</p>
          )}
        </div>

        <div className="rounded-2xl border border-white/[0.09] bg-[#151719] p-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Selected Idea</h2>

          {selectedIdea ? (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-[14px] font-bold leading-snug text-white">{selectedIdea.title}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-white/45">{selectedIdea.angle}</p>
              </div>
              <LengthDepthControls draft={draft} onChange={onSettingsChange} />
              <TextDensityControl value={draft.onScreenTextDensity} onChange={(onScreenTextDensity) => onSettingsChange({ onScreenTextDensity })} />
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-white/40">Choose an idea from the results to continue.</p>
          )}
        </div>
      </div>

      {/* Desktop only — mobile has its own fixed sticky CTA (see new.jsx) above MobileBottomNav. */}
      <div className="mt-4 hidden shrink-0 border-t border-white/[0.07] pt-4 lg:block">
        <button
          type="button"
          onClick={onCreateStoryPlan}
          disabled={!canCreateStoryPlan || creatingStoryPlan}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition ${
            canCreateStoryPlan && !creatingStoryPlan
              ? "bg-lime-300 text-[#11150D] hover:bg-lime-200 active:scale-[0.99]"
              : "cursor-not-allowed border border-white/[0.08] bg-[#202224] text-white/35"
          }`}
        >
          {creatingStoryPlan ? (
            <>
              <RotateCw className="h-4 w-4 animate-spin" />
              Creating Story Plan…
            </>
          ) : (
            <>
              Create Story Plan
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
        {createStoryPlanFailed && <p className="mt-2 text-[11.5px] font-medium text-red-300/80">Couldn't start your project. Try again.</p>}
      </div>
    </div>
  );
}

// Right panel: the results grid itself. 2 columns is the default and the
// ceiling on ordinary desktops — cards stay premium and readable rather
// than shrinking to fit more per row; only very wide screens step up to 3.
export function DiscoveryResultsPanel({ ideas, selectedIdeaId, readyCount, pendingCount, failedCount, highDemandCount = 0, onUse, onDismiss }) {
  let statusText = null;
  if (pendingCount > 0 && highDemandCount > 0) {
    // The image model is busy: the server is waiting and carries on by itself.
    statusText = `High demand, continuing in a moment · ${readyCount + failedCount}/${ideas.length}`;
  } else if (pendingCount > 0) {
    statusText = `Rendering previews · ${readyCount + failedCount}/${ideas.length}`;
  } else if (failedCount > 0) {
    statusText = `${readyCount} ready · ${failedCount} unavailable`;
  } else if (ideas.length > 0) {
    statusText = `${ideas.length} preview${ideas.length === 1 ? "" : "s"} ready`;
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-[16px] font-bold text-white">Generated Ideas</h2>
        <p className="mt-0.5 text-[12.5px] text-white/40">Choose the one you want to turn into a video.</p>
      </div>

      {statusText && (
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-medium text-white/30">
          {pendingCount > 0 && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300/70" />}
          {statusText}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {ideas.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} selected={idea.id === selectedIdeaId} onUse={onUse} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}
