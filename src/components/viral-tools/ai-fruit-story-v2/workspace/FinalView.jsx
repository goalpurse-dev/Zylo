import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { FOCUS, PrimaryButton, Toggle, cx } from "../../../ui/zyvo";
import WorkspaceHeader from "./WorkspaceHeader";
import { CoverImage, SeriesOptions, UploadPackage } from "./FinalExtras";

/** Finished video: player, clip timeline with trimmed silence, captions, download, next episode. */
export default function FinalView({ story, byId, isEpisode, series, onCaptions, onDownload, onNextEpisode, captionsBusy, onFinalOption, onDownloadCover }) {
  const videoRef = useRef(null);
  const [active, setActive] = useState(-1);
  const trims = story.final.trimmedPerClipSec?.length === story.scenes.length ? story.final.trimmedPerClipSec : story.scenes.map(() => 0);
  const kept = story.scenes.map((s, i) => Math.max(0.5, s.durationSec - trims[i]));
  const total = Math.round(kept.reduce((a, b) => a + b, 0));
  const starts = kept.reduce((acc, d, i) => [...acc, (acc[i] ?? 0) + d], [0]);
  const nextEpisode = isEpisode && series ? series.episodes.find((e) => e.status === "next") : null;
  const poster = story.scenes.find((s) => s.imageUrl)?.imageUrl;

  const seek = (i) => {
    setActive(i);
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(starts[i], Math.max(0, (v.duration || starts[i]) - 0.1));
    v.play().catch(() => {});
  };

  const onTime = () => {
    const t = videoRef.current?.currentTime ?? 0;
    const i = starts.findIndex((s, k) => t >= s && t < (starts[k + 1] ?? Infinity));
    if (i !== active && i < story.scenes.length) setActive(i);
  };

  return (
    <div className="flex flex-col gap-5">
      <WorkspaceHeader title={isEpisode ? "Episode ready" : "Your video is ready"} subtitle={story.title} />

      <div className="grid gap-5 xl:grid-cols-[minmax(260px,340px)_1fr]">
        <div className="mx-auto w-full max-w-[340px]">
          <div className={cx("relative overflow-hidden rounded-[26px] border border-white/[0.1] bg-[#0D0F11] shadow-[0_24px_70px_rgba(0,0,0,.55)]", story.aspect === "16:9" ? "aspect-video" : "aspect-[9/16]")}>
            <video
              ref={videoRef}
              src={story.final.url}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={onTime}
              className="absolute inset-0 h-full w-full object-cover"
              aria-label={`${story.title}, ${total} seconds`}
            />
          </div>

          <div className="mt-3 flex gap-1" role="group" aria-label="Clips in the final video">
            {story.scenes.map((scene, i) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => seek(i)}
                style={{ flex: scene.durationSec }}
                aria-label={`Play from scene ${i + 1}: ${byId(scene.speakerId)?.name.split(" ")[0] ?? ""}. ${trims[i].toFixed(1)} seconds of silence trimmed`}
                className={cx(
                  "relative grid h-9 min-w-0 place-items-center overflow-hidden rounded-lg border text-[10px] font-black transition",
                  FOCUS,
                  i === active ? "border-lime-300/60 text-white" : "border-white/[0.08] text-white/45 hover:border-white/20",
                )}
              >
                <span className="relative z-10">{i + 1}</span>
                <i
                  aria-hidden="true"
                  className="absolute inset-y-0 right-0 bg-[repeating-linear-gradient(135deg,rgba(248,113,113,0.35)_0_4px,transparent_4px_8px)]"
                  style={{ width: `${(trims[i] / scene.durationSec) * 100}%` }}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] font-semibold text-white/35">Red stripes show the silent gaps we trimmed. Tap a clip to jump to it.</p>
        </div>

        <div className="flex flex-col gap-3">
          <Box title={`${total} seconds, ${story.scenes.length} scenes`}>
            We joined your clips in order and trimmed {story.final.trimmedSec} seconds of silence between lines, so the story never drags.
            {Number.isFinite(story.spentCredits) && (
              <span className="mt-1.5 block font-bold text-white/75">This video cost {story.spentCredits} credits.</span>
            )}
          </Box>

          <Box
            title="Captions"
            right={<Toggle checked={story.final.captions} onChange={onCaptions} label="Captions" disabled={captionsBusy} />}
          >
            {captionsBusy ? "Updating your video…" : "Shows each line on screen. Most people watch muted."}
          </Box>

          {onFinalOption && <SeriesOptions story={story} busy={captionsBusy} onChange={onFinalOption} />}

          <Box title="Download">
            MP4, {story.aspect === "16:9" ? "1280 × 720" : "720 × 1280"}, ready for TikTok, Reels and Shorts.
            <PrimaryButton className="mt-3" onClick={onDownload}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download video
            </PrimaryButton>
          </Box>

          <CoverImage story={story} onDownload={onDownloadCover} />
          {!story.readOnly && <UploadPackage storyId={story.id} />}

          {isEpisode && series && (
            nextEpisode ? (
              <div className="rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-lime-300">Up next: episode {nextEpisode.number} of {series.episodes.length}</p>
                <h3 className="mt-1 text-[16px] font-black tracking-[-0.02em] text-white">{nextEpisode.title}</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">{nextEpisode.summary}</p>
                <PrimaryButton className="mt-3" chevron onClick={() => onNextEpisode(nextEpisode.number)}>Make episode {nextEpisode.number}</PrimaryButton>
              </div>
            ) : (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">Series finished</p>
                <h3 className="mt-1 text-[16px] font-black text-white">You made all {series.episodes.length} episodes</h3>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">Open any episode from your series page to download it again.</p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Box({ title, right, children }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#111315] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-black text-white">{title}</h3>
          <div className="mt-1 text-[12px] leading-relaxed text-white/50">{children}</div>
        </div>
        {right}
      </div>
    </div>
  );
}
