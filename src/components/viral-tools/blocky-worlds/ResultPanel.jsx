import { Check, Copy, Download, ThumbsDown, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { FOCUS, ProgressBar, cx } from "../../ui/zyvo";
import { RUN_STEPS, STATUS_LABELS, clock, isWorking } from "./api/blockyWorldsApi";

/** The right side: the video being made (its steps), the finished video with the upload text and thumbs, or the hero. */
export default function ResultPanel({ run, recent, onOpen, onEvent }) {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-2xl border border-white/[0.06] bg-[#0E1012] p-4">
      {run ? <RunView run={run} onEvent={onEvent} /> : <Hero />}
      {recent.length > 0 && (
        <div>
          <p className="mb-1.5 mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40">Your videos</p>
          <ul className="flex flex-col gap-1">
            {recent.slice(0, 8).map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onOpen(r)} className={cx("flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-[12px] transition", FOCUS, r.id === run?.id ? "border-lime-300/35 bg-lime-300/[0.06]" : "border-white/[0.06] bg-white/[0.03] hover:border-white/15")}>
                  <span className="truncate font-semibold text-white/85">{r.title || "Untitled"}</span>
                  <span className="shrink-0 text-[10.5px] text-white/45">{r.status === "done" ? clock(r.lengthSec) : STATUS_LABELS[r.status]}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Hero() {
  return (
    <div className="mx-auto flex w-full max-w-[340px] flex-col gap-3">
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/[0.07]">
        <img src="/blocky-worlds/hero.jpg" alt="A sunny blocky street: townsfolk waiting at a bus stop as a yellow bus pulls in" className="h-full w-full object-cover" />
        <span className="absolute inset-x-0 top-[66%] text-center text-[34px] font-black text-white [-webkit-text-stroke:2px_#0b0a12] [paint-order:stroke]">everyone</span>
      </div>
      <p className="text-center text-[10px] font-black uppercase tracking-[0.18em] text-lime-300">Pick a world · get a story video</p>
      <h2 className="text-center text-[20px] font-black leading-tight tracking-[-0.03em] text-white">&ldquo;In this town&hellip;&rdquo; stories, narrated and built in blocks.</h2>
    </div>
  );
}

function RunView({ run, onEvent }) {
  const [thumb, setThumb] = useState(null);
  const [copied, setCopied] = useState(false);
  if (isWorking(run)) {
    const at = RUN_STEPS.indexOf(run.status);
    return (
      <div className="mx-auto flex w-full max-w-[380px] flex-col gap-3 pt-6" aria-live="polite">
        <h2 className="text-[17px] font-black text-white">Making &ldquo;{run.title}&rdquo;</h2>
        <ol className="flex flex-col gap-1.5">
          {RUN_STEPS.map((s, i) => (
            <li key={s} className={cx("flex items-center gap-2 text-[12.5px]", i < at ? "text-white/45" : i === at ? "font-bold text-white" : "text-white/25")}>
              <span className={cx("grid h-4 w-4 place-items-center rounded-full border text-[9px]", i < at ? "border-lime-300/50 text-lime-300" : i === at ? "border-white/60" : "border-white/15")}>{i < at ? <Check className="h-2.5 w-2.5" /> : i + 1}</span>
              {STATUS_LABELS[s]}
            </li>
          ))}
        </ol>
        {run.status === "render" && <ProgressBar value={run.pct ?? 0} label="Building the world" />}
        <p className="text-[11px] text-white/40">About 3 to 4 minutes. You can leave this page; it keeps going.</p>
      </div>
    );
  }
  if (run.status === "failed") {
    return <div className="mx-auto max-w-[380px] pt-6 text-[13px] leading-relaxed text-white/75" role="alert">{run.error}{run.refunded && <span className="mt-1 block text-[11.5px] text-lime-300">Your {run.credits} credits are back.</span>}</div>;
  }
  const post = run.post ?? {};
  const postText = [post.title, post.description, (post.hashtags ?? []).join(" ")].filter(Boolean).join("\n\n");
  const vote = (kind) => { if (thumb) return; setThumb(kind); onEvent(kind); };
  return (
    <div className="mx-auto flex w-full max-w-[360px] flex-col gap-3">
      <div className="aspect-[9/16] overflow-hidden rounded-2xl border border-white/[0.07] bg-black">
        {run.finalUrl ? <video src={run.finalUrl} poster={run.poster ?? undefined} controls playsInline className="h-full w-full object-contain" /> : <img src={run.poster ?? "/blocky-worlds/hero.jpg"} alt="" className="h-full w-full object-cover opacity-80" />}
      </div>
      <div className="flex gap-2">
        {run.downloadUrl && <a href={run.downloadUrl} onClick={() => onEvent("downloaded")} className={cx("flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-lime-300 px-3 py-2.5 text-[13px] font-black text-black", FOCUS)}><Download className="h-4 w-4" aria-hidden="true" />Download</a>}
        <button type="button" aria-pressed={thumb === "thumb_up"} onClick={() => vote("thumb_up")} disabled={Boolean(thumb)} className={cx("grid w-11 place-items-center rounded-xl border border-white/10", FOCUS, thumb === "thumb_up" && "border-lime-300/50 text-lime-300")} aria-label="I like this story"><ThumbsUp className="h-4 w-4" /></button>
        <button type="button" aria-pressed={thumb === "thumb_down"} onClick={() => vote("thumb_down")} disabled={Boolean(thumb)} className={cx("grid w-11 place-items-center rounded-xl border border-white/10", FOCUS, thumb === "thumb_down" && "border-rose-300/50 text-rose-300")} aria-label="I don't like this story"><ThumbsDown className="h-4 w-4" /></button>
      </div>
      {thumb && <p className="text-[11px] text-white/45">Thanks. This helps pick better ideas.</p>}
      {postText && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="mb-1 flex items-center justify-between"><p className="text-[10.5px] font-black uppercase tracking-[0.12em] text-white/40">Upload text</p>
            <button type="button" onClick={() => { navigator.clipboard?.writeText(postText); setCopied(true); }} className={cx("flex items-center gap-1 text-[10.5px] font-bold text-white/55 hover:text-lime-300", FOCUS)}>{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="whitespace-pre-line text-[12px] leading-relaxed text-white/75">{postText}</p>
        </div>
      )}
    </div>
  );
}
