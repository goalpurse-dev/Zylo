import { Check, Download } from "lucide-react";
import { PrimaryButton, cx } from "../../../ui/zyvo";
import { formatLength } from "../constants";
import { TIERS, animateAllPrice, picturesStepPrice, scriptShare, storyTotals } from "../pricing/blockyEstimates";
import { quoteFor } from "../pricing/useBlockyPrices";
import { AvatarStack } from "../shared/Avatar";
import { FootNote } from "./BuilderPanel";

const ORDER = ["draft", "pictures", "pictures_ready", "animating", "clips_ready", "building", "final_ready"];

/** Story summary + the 3-item progress list shown on the left once a story exists. */
export function PipelineSummary({ story, byId, header = null }) {
  const at = ORDER.indexOf(story.status);
  const pictures = story.scenes.filter((s) => s.imageStatus === "ready").length;
  const clips = story.scenes.filter((s) => s.clipStatus === "ready").length;
  const n = story.scenes.length;
  const items = [
    { key: "pictures", title: "Scene pictures", detail: `${pictures} of ${n} ready. Check them before animating.`, state: at >= 2 && pictures === n ? "done" : "now" },
    { key: "clips", title: "Animated clips", detail: `${clips} of ${n} ready. Each character speaks their line.`, state: at >= 4 && clips === n ? "done" : at >= 2 ? "now" : "todo" },
    { key: "final", title: "Final video", detail: "Clips joined, silent gaps trimmed.", state: at >= 6 ? "done" : at >= 4 ? "now" : "todo" },
  ];
  // Only one "now": the first unfinished step.
  const firstOpen = items.findIndex((i) => i.state !== "done");
  items.forEach((item, i) => { if (item.state === "now" && i !== firstOpen) item.state = "todo"; });

  return (
    <>
      {header}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-3">
        <h2 className="text-[15px] font-black leading-snug tracking-[-0.02em] text-white">{story.title}</h2>
        <div className="mt-2.5"><AvatarStack ids={story.castIds} byId={byId} /></div>
        {Object.keys(story.castRoles ?? {}).length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Roles in this story">
            {story.castIds.filter((id) => story.castRoles[id]).map((id) => (
              <li key={id} className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/60">
                <span className="font-black text-white/85">{byId(id)?.name.split(" ")[0] ?? id}</span> · {story.castRoles[id]}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Pill lime>{TIERS[story.quality]?.label ?? story.quality}</Pill>
          <Pill>{formatLength(story.lengthSec)}</Pill>
          <Pill>{n} scenes</Pill>
          <Pill>{story.aspect}</Pill>
        </div>
      </div>
      <ol className="flex flex-col gap-1.5" aria-label="Progress">
        {items.map((item, i) => (
          <li
            key={item.key}
            aria-current={item.state === "now" ? "step" : undefined}
            className={cx(
              "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300",
              item.state === "now" ? "border-lime-300/45 bg-lime-300/[0.06]" : "border-white/[0.07] bg-white/[0.035]",
              item.state === "todo" && "opacity-60",
            )}
          >
            <span
              className={cx(
                "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-black",
                item.state === "done" ? "bg-emerald-400/15 text-emerald-400" : item.state === "now" ? "bg-lime-300 text-[#11150D]" : "bg-white/[0.06] text-white/40",
              )}
            >
              {item.state === "done" ? <Check className="h-3.5 w-3.5" aria-label="Done" /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-[12px] font-black text-white">{item.title}</span>
              <span className="block text-[10px] font-semibold leading-relaxed text-white/40">{item.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function Pill({ children, lime = false }) {
  return (
    <span className={cx(
      "rounded-full border px-2.5 py-1 text-[10px] font-bold",
      lime ? "border-lime-300/25 bg-lime-300/[0.08] text-lime-300" : "border-white/[0.08] bg-white/[0.04] text-white/55",
    )}>
      {children}
    </span>
  );
}

/**
 * The one action for the story's current stage, with its price. Used in the
 * builder footer and in the "Your video" footer on mobile.
 */
export function PipelineActions({ story, quotes, balance, acting, isEpisode, handlers }) {
  const n = story.scenes.length;
  const done = (key) => story.scenes.filter((s) => s[key] === "ready").length;
  const totals = storyTotals(story, quotes.prices);
  // What this video has cost so far (server ledger: charges minus refunds).
  const spent = Number.isFinite(story.spentCredits) ? story.spentCredits : null;

  if (story.status === "draft") {
    // One charge: every scene picture and, for a story we wrote, the script.
    const share = scriptShare(quotes.prices, story.source !== "script");
    return (
      <>
        <PrimaryButton price={quoteFor(quotes, picturesStepPrice(story, quotes.prices))} priceOf={{ value: totals.total, approx: false }} busy={acting === "pictures" ? "Starting…" : null} onClick={handlers.onMakePictures}>
          Make scene pictures
        </PrimaryButton>
        <FootNote>
          {totals.total != null ? `Full video: ${totals.total} credits. ${totals.pictures} now for the pictures${share ? " and the script" : ""}, ${totals.video} when you animate, after you approve them.` : "You only pay for video after you approve the pictures."}
        </FootNote>
      </>
    );
  }
  if (story.status === "pictures") {
    return <PrimaryButton busy={`Painting scenes · ${done("imageStatus")} of ${n}`} />;
  }
  if (story.status === "pictures_ready") {
    const failed = story.scenes.filter((s) => s.imageStatus !== "ready");
    const price = animateAllPrice(story, quotes.prices);
    if (failed.length) {
      return (
        <>
          <PrimaryButton disabled price={quoteFor(quotes, price)}>Animate all scenes</PrimaryButton>
          <FootNote tone="warn">
            {failed.length === 1 ? `Scene ${failed[0].index + 1} needs a picture` : `Scenes ${failed.map((s) => s.index + 1).join(", ")} need pictures`} before animating. Regenerate or edit {failed.length === 1 ? "it" : "them"} first.
          </FootNote>
        </>
      );
    }
    if (price != null && price > balance) {
      return (
        <>
          <PrimaryButton onClick={handlers.onAddCredits}>Add credits</PrimaryButton>
          <FootNote tone="warn">Animating costs {price} credits{spent != null ? ` (total for the video: ${spent + price})` : ""}. You have {balance.toLocaleString()}.</FootNote>
        </>
      );
    }
    return (
      <>
        <PrimaryButton price={quoteFor(quotes, price)} busy={acting === "animate" ? "Starting…" : null} onClick={handlers.onAnimate}>Animate all scenes</PrimaryButton>
        <FootNote>
          {spent != null && price != null
            ? <>Spent so far: <b className="text-white/80">{spent}</b> · Animating: <b className="text-white/80">{price}</b> · Total: <b className="text-lime-300">{spent + price}</b> credits</>
            : "Happy with every scene? Animate them all at once."}
        </FootNote>
      </>
    );
  }
  if (story.status === "animating") {
    return <PrimaryButton busy={`Animating · ${done("clipStatus")} of ${n}`} />;
  }
  if (story.status === "clips_ready") {
    const failed = story.scenes.filter((s) => s.clipStatus !== "ready");
    if (failed.length) {
      return (
        <>
          <PrimaryButton disabled>Make final video</PrimaryButton>
          <FootNote tone="warn">
            {failed.length === 1 ? `Clip ${failed[0].index + 1} needs` : `Clips ${failed.map((s) => s.index + 1).join(", ")} need`} to be regenerated before the final video.
          </FootNote>
        </>
      );
    }
    return (
      <>
        <PrimaryButton busy={acting === "final" ? "Starting…" : null} onClick={handlers.onMakeFinal}>Make final video</PrimaryButton>
        <FootNote tone={story.final?.status === "failed" ? "warn" : "muted"}>
          {story.final?.status === "failed" ? "We couldn't join your clips. Nothing was charged. Try again." : "Free. Joins your clips in order and trims the silence."}
        </FootNote>
      </>
    );
  }
  if (story.status === "building") {
    return <PrimaryButton busy="Making your video…" />;
  }
  if (story.status === "final_ready") {
    return (
      <>
      <div className="flex gap-2">
        <PrimaryButton variant="secondary" className="flex-1" onClick={isEpisode ? handlers.onBackToSeries : handlers.onNewStory}>
          {isEpisode ? "Back to series" : "New story"}
        </PrimaryButton>
        <PrimaryButton className="flex-1" onClick={handlers.onDownload}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Download video
        </PrimaryButton>
      </div>
      </>
    );
  }
  return (
    <>
      <PrimaryButton onClick={isEpisode ? handlers.onBackToSeries : handlers.onNewStory}>Start over</PrimaryButton>
      <FootNote tone="warn">We couldn&apos;t write this story. Nothing was charged.</FootNote>
    </>
  );
}
