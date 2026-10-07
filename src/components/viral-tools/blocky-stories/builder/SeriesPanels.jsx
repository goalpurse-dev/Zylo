import { ChevronRight } from "lucide-react";
import { ErrorBanner, FOCUS, OptionChip, SectionLabel, cx } from "../../../ui/zyvo";
import { LIMITS } from "../api/blockyStoriesApi";
import { CONCEPT_SUGGESTIONS, SERIES_QUESTIONS, TONES, openersFor } from "../constants";
import { AvatarStack, CastChip } from "../shared/Avatar";
import { StepHeading } from "./BuilderPanel";
import { CastPicker } from "./StoryStep";

const TEXTAREA =
  "w-full resize-none rounded-2xl border border-white/[0.08] bg-[#111315] px-4 py-3 text-[14px] leading-relaxed text-white outline-none transition placeholder:text-white/20 focus:border-lime-300/35 focus:ring-1 focus:ring-lime-300/30";

/** "Your series" list. */
export function SeriesList({ list, byId, onOpen, onRetry }) {
  return (
    <>
      <StepHeading title="Your series" subtitle="Continue where you left off, or start a new one." />
      {list.status === "error" ? (
        <ErrorBanner action="Try again" onAction={onRetry}>We couldn&apos;t load your series. Check your connection and try again.</ErrorBanner>
      ) : list.status === "loading" ? (
        <div className="flex flex-col gap-1.5" aria-label="Loading series">
          {[0, 1].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035] motion-reduce:animate-none" />)}
        </div>
      ) : list.items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
          <p className="text-[12px] font-bold text-white/70">No series yet</p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/35">Create one and we&apos;ll plan every episode, each ending on a cliffhanger.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.items.map((s) => {
            const finished = s.madeCount >= s.episodeCount;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s.id)}
                className={cx("flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3 text-left transition hover:border-lime-300/25 hover:bg-white/[0.055]", FOCUS)}
              >
                <span className="text-[13px] font-black text-white">{s.title}</span>
                <AvatarStack ids={s.castIds} byId={byId} size="h-6 w-6" />
                <span className="flex items-center justify-between text-[10px] font-semibold text-white/40">
                  <span>{s.madeCount} of {s.episodeCount} episodes made</span>
                  <span className={cx("flex items-center gap-0.5 font-bold", finished ? "text-emerald-400" : "text-lime-300")}>
                    {finished ? "Finished" : "Continue"}
                    <ChevronRight className="h-3 w-3" aria-hidden="true" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/** Create-series wizard: one question per screen. */
export function SeriesWizard({ step, draft, byId, onChange, onOpenLibrary }) {
  const q = SERIES_QUESTIONS[step];
  return (
    <>
      <div>
        <ol className="flex gap-1.5" aria-label={`Question ${step + 1} of ${SERIES_QUESTIONS.length}`}>
          {SERIES_QUESTIONS.map((item, i) => (
            <li key={item.title} className={cx("h-1 w-6 rounded-full transition-colors duration-300 motion-reduce:transition-none", i <= step ? "bg-lime-300" : "bg-white/10")} />
          ))}
        </ol>
      </div>
      <StepHeading title={q.title} subtitle={q.sub} />

      {step === 0 && (
        <div>
          <textarea
            id="fv2-concept"
            aria-label="What the series is about"
            rows={4}
            maxLength={LIMITS.maxPromptChars}
            value={draft.concept}
            onChange={(e) => onChange({ concept: e.target.value })}
            placeholder="e.g. A CEO is having an affair with his intern, and his wife owns most of the company."
            className={cx(TEXTAREA, "min-h-[110px]")}
          />
          <SectionLabel className="mt-4">Or start from one of these</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {CONCEPT_SUGGESTIONS.map((c) => (
              <OptionChip key={c} shape="pill" selected={draft.concept === c} onClick={() => onChange({ concept: c })}>{c}</OptionChip>
            ))}
          </div>
        </div>
      )}

      {step === 1 && (
        <CastPicker
          label="Cast"
          castIds={draft.castIds}
          byId={byId}
          min={LIMITS.minCastSeries}
          max={LIMITS.maxCastSeries}
          onRemove={(id) => onChange({ castIds: draft.castIds.filter((c) => c !== id) })}
          onAdd={onOpenLibrary}
          hint="Roles are assigned automatically from your concept, and they never change between episodes."
        />
      )}

      {step === 2 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Episode 1 opener">
            {openersFor(draft.concept).map((o) => (
              <OptionChip key={o} shape="pill" selected={draft.opener === o} onClick={() => onChange({ opener: o })}>{o}</OptionChip>
            ))}
          </div>
          {draft.opener === "Something else" && (
            <textarea
              aria-label="Describe the opening moment"
              rows={3}
              maxLength={300}
              value={draft.openerCustom}
              onChange={(e) => onChange({ openerCustom: e.target.value })}
              placeholder="Describe the opening moment"
              className={TEXTAREA}
            />
          )}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tone">
          {TONES.map((t) => (
            <OptionChip key={t} shape="pill" selected={draft.tone === t} onClick={() => onChange({ tone: t })}>{t}</OptionChip>
          ))}
        </div>
      )}

      {step === 4 && (
        <div>
          <SectionLabel htmlFor="fv2-episodes" hint={`${draft.episodeCount} episodes`}>Episodes</SectionLabel>
          <input
            id="fv2-episodes"
            type="range"
            min={LIMITS.minEpisodes}
            max={LIMITS.maxEpisodes}
            value={draft.episodeCount}
            onChange={(e) => onChange({ episodeCount: Number(e.target.value) })}
            className="h-1.5 w-full cursor-pointer accent-lime-400"
          />
          <div className="mt-1.5 flex justify-between text-[9px] font-medium text-white/25" aria-hidden="true"><span>3</span><span>10</span></div>
          <p className="mt-2 text-[10px] leading-relaxed text-white/30">You choose length and quality for each episode when you make it. Nothing is charged yet.</p>
        </div>
      )}
    </>
  );
}

/** Left panel on a series page. */
export function SeriesPlanPanel({ series, byId }) {
  const made = series.episodes.filter((e) => e.status === "made").length;
  return (
    <>
      <StepHeading title={series.title} subtitle={`${made} of ${series.episodes.length} episodes made`} />
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3">
        <p className="text-[12px] leading-relaxed text-white/60">{series.logline}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {series.castIds.map((id) => <CastChip key={id} character={byId(id)} role={series.bible?.characters?.find((c) => c.id === id)?.role ?? null} />)}
        </div>
      </div>
      <p className="text-[10px] leading-relaxed text-white/30">The full episode plan is on the right. Episodes unlock in order so every cliffhanger lands.</p>
    </>
  );
}

/** "Episode 3 of 10" card with what happens and the cliffhanger. */
export function EpisodeCard({ episode, total }) {
  return (
    <div className="rounded-xl border border-lime-300/25 bg-lime-300/[0.06] px-3 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">Episode {episode.number} of {total}</p>
      <h2 className="mt-1 text-[15px] font-black tracking-[-0.02em] text-white">{episode.title}</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-white/60">{episode.summary}</p>
      <p className="mt-1.5 text-[11px] font-semibold text-lime-200/80">Ends on: {episode.cliffhanger}</p>
    </div>
  );
}
