import QuotedCredits from "../../../pricing/QuotedCredits";
import { CreditIcon, QualityCards, SectionLabel, SegmentedControl } from "../../../ui/zyvo";
import { LIMITS } from "../api/blockyStoriesApi";
import { ASPECTS, LENGTH_NOTES, QUICK_LENGTHS, formatLength } from "../constants";
import { TIERS, TIER_IDS, estimateStory } from "../pricing/blockyEstimates";

const TIER_LIST = TIER_IDS.map((id) => TIERS[id]);

/**
 * Quality, length, shape and the cost card. Shared by single videos and
 * series episodes. Everything is tall 9:16 at first, so showAspect is off everywhere.
 *   scriptScenes: when set (script mode), length comes from the script.
 *   firstVideo: the user hasn't made a video yet, so the short lengths are suggested.
 */
export default function SettingsFields({ value, onChange, allowedTiers, onLockedTier, quotes, balance, showAspect = true, scriptScenes = null, firstVideo = false }) {
  const est = scriptScenes
    ? estimateStory({ lengthSec: scriptScenes.lengthSec, tierId: value.tierId, prices: quotes.prices, sceneCount: scriptScenes.count })
    : estimateStory({ lengthSec: value.lengthSec, tierId: value.tierId, prices: quotes.prices });
  const lengthSec = scriptScenes ? scriptScenes.lengthSec : value.lengthSec;
  const short = est.total != null && est.total > balance;

  return (
    <>
      <QualityCards
        label="Video quality"
        hint="Changes the video model"
        tiers={TIER_LIST}
        value={value.tierId}
        allowedIds={allowedTiers}
        onChange={(tierId) => onChange({ tierId })}
        onLockedClick={(tier) => onLockedTier(tier.id)}
      />

      <div>
        <SectionLabel htmlFor="fv2-length" hint={formatLength(lengthSec)}>Length</SectionLabel>
        <input
          id="fv2-length"
          type="range"
          min={LIMITS.minLengthSec}
          max={LIMITS.maxLengthSec}
          step={LIMITS.lengthStepSec}
          value={lengthSec}
          disabled={Boolean(scriptScenes)}
          onChange={(e) => onChange({ lengthSec: Number(e.target.value) })}
          aria-valuetext={formatLength(lengthSec)}
          className="h-1.5 w-full cursor-pointer accent-lime-400 disabled:cursor-not-allowed disabled:opacity-40"
        />
        <div className="mt-1.5 flex justify-between text-[9px] font-medium text-white/25" aria-hidden="true">
          <span>15 sec</span><span>1 min</span><span>2 min</span>
        </div>
        {!scriptScenes && (
          <div className="mt-3 grid grid-cols-4 gap-1.5" role="group" aria-label="Common lengths and what each costs">
            {QUICK_LENGTHS.map((sec) => {
              const price = estimateStory({ lengthSec: sec, tierId: value.tierId, prices: quotes.prices }).total;
              const selected = lengthSec === sec;
              return (
                <button
                  key={sec}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange({ lengthSec: sec })}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2 transition ${selected ? "border-lime-300/50 bg-lime-300/10 text-lime-200" : "border-white/[0.07] bg-white/[0.035] text-white/70 hover:border-white/20"}`}
                >
                  <span className="text-[11px] font-black">{formatLength(sec)}</span>
                  <span className="flex items-center gap-0.5 text-[10px] font-bold tabular-nums opacity-80">
                    <CreditIcon className="h-3 w-3" />{price == null ? "…" : `about ${price}`}
                  </span>
                  {LENGTH_NOTES[sec] && <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">{LENGTH_NOTES[sec]}</span>}
                </button>
              );
            })}
          </div>
        )}
        {firstVideo && !scriptScenes && (
          <p className="mt-2 rounded-lg border border-lime-300/15 bg-lime-300/[0.06] px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-lime-100/80">
            30 seconds gives the story room for a real twist. 20 seconds is the cheaper choice: it's finished in about 3 minutes.
          </p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-white/30">
          {scriptScenes
            ? `Set by your script: ${scriptScenes.count} lines, about ${formatLength(lengthSec)}.`
            : `About ${est.sceneCount} scenes. Each scene is one character saying one line. The video is never longer than this and can be a second or two shorter: you pay only for the seconds made.`}
        </p>
      </div>

      {showAspect && (
        <div>
          <SectionLabel>Shape</SectionLabel>
          <SegmentedControl ariaLabel="Video shape" options={ASPECTS} value={value.aspect} onChange={(aspect) => onChange({ aspect })} />
        </div>
      )}

      <CostCard est={est} lengthSec={lengthSec} tierId={value.tierId} quotes={quotes} balance={balance} short={short} exact={Boolean(scriptScenes)} />
    </>
  );
}

/**
 * The whole video's price first, then how it splits: pictures now, video when
 * animating. An upper bound: the planner never makes more seconds of clips than
 * the chosen length, and a script's clips are sized by the server's own rule.
 */
function CostCard({ est, lengthSec, tierId, quotes, balance, short, exact = false }) {
  const status = quotes.status === "error" ? "error" : est.total == null ? "loading" : "ready";
  const about = exact ? "" : "about ";
  return (
    <div>
      <SectionLabel>Cost</SectionLabel>
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-black text-white">Full video</span>
          <span className="flex items-center gap-1 text-[16px] font-black tabular-nums text-lime-300">
            {!exact && <span className="text-[12px] font-bold text-lime-300/70">about</span>}
            <CreditIcon className="h-4 w-4" />
            <QuotedCredits status={status} value={est.total} onRetry={quotes.retry} />
          </span>
        </div>
        {status === "ready" && (
          <p className="mt-1 text-[11px] font-semibold leading-relaxed text-white/55">
            {est.pictures} now for the {est.sceneCount} scene pictures, {about}{est.video} when you animate {formatLength(lengthSec)} of {TIERS[tierId].label} video.
          </p>
        )}
        <p className="mt-2 text-[10px] leading-relaxed text-white/35">
          {exact ? "Your lines set each clip's length, so this is the price." : "Never more than this: the script is written to fit the length you pick."}
          {" "}You have {balance.toLocaleString()} credits.
          {est.total != null && !short && ` After this: about ${(balance - est.total).toLocaleString()}.`}
        </p>
        {short && (
          <p role="alert" className="mt-2 rounded-lg border border-orange-300/25 bg-orange-300/10 px-2.5 py-2 text-[11px] font-semibold leading-relaxed text-orange-200">
            You need {(est.total - balance).toLocaleString()} more credits. Pick a shorter length or V2, or add credits.
          </p>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[11px] font-semibold text-white/55">
      <span>{label}</span>
      <span className="font-bold tabular-nums text-white/85">{children}</span>
    </div>
  );
}
