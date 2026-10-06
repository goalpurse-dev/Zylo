import { Plus, RefreshCw } from "lucide-react";
import { ErrorBanner, FOCUS, SectionLabel, SegmentedControl, cx } from "../../../ui/zyvo";
import { LIMITS } from "../api/blockyStoriesApi";
import { IDEAS_ON, STORY_METHODS } from "../constants";
import { AvatarStack, CastChip } from "../shared/Avatar";
import { StepHeading } from "./BuilderPanel";
import ScriptEditor from "./ScriptEditor";

const INPUT =
  "w-full rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30";

/** Step 1: describe a story or write a script (and, once the idea engine is on, pick an idea). */
export default function StoryStep({ single, ideas, characters, scriptParse, onChange, onNewIdeas, onRetryIdeas, onOpenLibrary, onAssignName }) {
  return (
    <>
      <StepHeading title="What's the story?" subtitle={IDEAS_ON ? "Pick a ready idea, describe your own, or paste a finished script." : "Describe your own, or paste a finished script."} />
      <SegmentedControl
        ariaLabel="How do you want to start?"
        options={STORY_METHODS}
        value={single.method}
        onChange={(method) => onChange({ method })}
      />
      {single.method === "idea" && (
        <IdeaPicker ideas={ideas} selectedId={single.ideaId} byId={characters.byId} onPick={(ideaId) => onChange({ ideaId })} onNewIdeas={onNewIdeas} onRetry={onRetryIdeas} />
      )}
      {single.method === "prompt" && (
        <>
          <CastPicker castIds={single.castIds} byId={characters.byId} max={LIMITS.maxCastSingle} onRemove={(id) => onChange({ castIds: single.castIds.filter((c) => c !== id) })} onAdd={onOpenLibrary} />
          <div>
            <SectionLabel htmlFor="fv2-prompt" hint={`${single.prompt.length} / ${LIMITS.maxPromptChars}`}>2. Describe the story</SectionLabel>
            <textarea
              id="fv2-prompt"
              rows={5}
              maxLength={LIMITS.maxPromptChars}
              value={single.prompt}
              onChange={(e) => onChange({ prompt: e.target.value })}
              placeholder="e.g. Noob trades a starter pet for Lux's rarest item, and the pet turns out to be the server's owner."
              className={cx(INPUT, "min-h-[120px] resize-none")}
            />
            <p className="mt-2 text-[10px] leading-relaxed text-white/30">We write the full script from this. You can check every scene before animating.</p>
          </div>
        </>
      )}
      {single.method === "script" && (
        <ScriptEditor
          text={single.scriptText}
          parse={scriptParse}
          byId={characters.byId}
          onChange={(scriptText) => onChange({ scriptText })}
          onAssign={onAssignName}
        />
      )}
    </>
  );
}

function IdeaPicker({ ideas, selectedId, byId, onPick, onNewIdeas, onRetry }) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3 lg:mb-1.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Ideas for you</p>
        <button
          type="button"
          onClick={onNewIdeas}
          disabled={ideas.status === "loading"}
          className={cx("flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-white/45 transition hover:text-lime-300 disabled:opacity-40", FOCUS)}
        >
          <RefreshCw className={cx("h-3 w-3", ideas.status === "loading" && "animate-spin motion-reduce:animate-none")} aria-hidden="true" />
          New ideas
        </button>
      </div>
      {ideas.status === "error" ? (
        <ErrorBanner action="Try again" onAction={onRetry}>We couldn&apos;t load ideas. Check your connection and try again.</ErrorBanner>
      ) : ideas.status === "loading" && !ideas.items.length ? (
        <div className="flex flex-col gap-1.5" aria-label="Loading ideas">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035] motion-reduce:animate-none" />
          ))}
        </div>
      ) : (
        <div className={cx("flex flex-col gap-1.5 transition-opacity", ideas.status === "loading" && "opacity-50")}>
          {ideas.items.map((idea) => {
            const selected = idea.id === selectedId;
            return (
              <button
                key={idea.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onPick(idea.id)}
                className={cx(
                  "grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 text-left transition",
                  FOCUS,
                  selected ? "border-lime-300/45 bg-lime-300/[0.09]" : "border-white/[0.07] bg-white/[0.035] hover:border-lime-300/25 hover:bg-white/[0.055]",
                )}
              >
                <span className={cx("text-[13px] font-black", selected ? "text-lime-300" : "text-white")}>{idea.title}</span>
                <AvatarStack ids={idea.castIds} byId={byId} size="h-6 w-6" />
                <span className="col-span-2 text-[11px] font-medium leading-relaxed text-white/50">{idea.summary}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[10px] leading-relaxed text-white/30">Every idea uses characters from the library, so they always look the same.</p>
    </div>
  );
}

export function CastPicker({ castIds, byId, max, min = 1, onRemove, onAdd, label = "1. Choose your characters", hint }) {
  return (
    <div>
      <SectionLabel hint={`${castIds.length} of ${max}`}>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5">
        {castIds.map((id) => <CastChip key={id} character={byId(id)} onRemove={() => onRemove(id)} />)}
        {castIds.length < max && (
          <button
            type="button"
            onClick={onAdd}
            className={cx("inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-3 py-1.5 text-[11px] font-bold text-white/55 transition hover:border-lime-300/40 hover:text-white", FOCUS)}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add character
          </button>
        )}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-white/30">
        {hint ?? `Pick ${min === max ? max : `${min} to ${max}`}. Roles are set automatically. You can also write them in your story, like "Vex is the fake admin".`}
      </p>
    </div>
  );
}
