import { useRef, useState } from "react";
import { Download } from "lucide-react";
import { FOCUS, PrimaryButton, Toggle, cx } from "../../../ui/zyvo";
import WorkspaceHeader from "./WorkspaceHeader";
import { SeriesOptions, UploadPackage } from "./FinalExtras";

/**
 * The finished video. The video is the hero and always whole on the screen; Download, Captions and the cover
 * sit next to it (under it on a phone); the post text is a compact list with copy buttons after them.
 */
export default function FinalView({ story, byId, isEpisode, series, onCaptions, onDownload, onNextEpisode, captionsBusy, onFinalOption, onDownloadCover }) {
  const videoRef = useRef(null);
  const [active, setActive] = useState(-1);
  const trims = story.final.trimmedPerClipSec?.length === story.scenes.length ? story.final.trimmedPerClipSec : story.scenes.map(() => 0);
  const kept = story.scenes.map((s, i) => Math.max(0.5, s.durationSec - trims[i]));
  const total = Math.round(kept.reduce((a, b) => a + b, 0));
  const starts = kept.reduce((acc, d, i) => [...acc, (acc[i] ?? 0) + d], [0]);
  const nextEpisode = isEpisode && series ? series.episodes.find((e) => e.status === "next") : null;
  const poster = story.scenes.find((s) => s.imageUrl)?.imageUrl;
  const wide = story.aspect === "16:9";

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
    <div className="flex flex-col gap-4">
      <WorkspaceHeader title={isEpisode ? "Episode ready" : "Your video is ready"} subtitle={story.title} />

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        {/* 1. The video: as tall as the screen allows, never taller, so it is always whole. On a phone the bars above
            and below it (the page's top, the tabs, the heading; the footer and the navigation) take about 440 px. */}
        <div className={cx("mx-auto flex max-w-full flex-col lg:mx-0", wide && "w-full lg:w-[min(100%,640px)]")}>
          <div className={cx("relative max-w-full overflow-hidden rounded-[22px] border border-white/[0.1] bg-black shadow-[0_24px_70px_rgba(0,0,0,.55)]", wide ? "aspect-video w-full" : "aspect-[9/16] h-[min(calc(100svh-440px),540px)] min-h-[260px] lg:h-[min(70vh,640px)] lg:min-h-0")}>
            <video
              ref={videoRef}
              src={story.final.url}
              poster={poster}
              controls
              playsInline
              preload="metadata"
              onTimeUpdate={onTime}
              className="absolute inset-0 h-full w-full object-contain"
              aria-label={`${story.title}, ${total} seconds`}
            />
          </div>

          <div className="mt-2 flex gap-1" role="group" aria-label="Scenes in the video">
            {story.scenes.map((scene, i) => (
              <button
                key={scene.id}
                type="button"
                onClick={() => seek(i)}
                style={{ flex: scene.durationSec }}
                aria-label={`Play from scene ${i + 1}: ${byId(scene.speakerId)?.name.split(" ")[0] ?? ""}`}
                className={cx(
                  "grid h-7 min-w-0 place-items-center rounded-md border text-[10px] font-black transition",
                  FOCUS,
                  i === active ? "border-lime-300/60 bg-lime-300/[0.08] text-white" : "border-white/[0.08] text-white/45 hover:border-white/20",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {/* 2. The actions: download, captions, cover. */}
          <section aria-label="Your video" className="rounded-2xl border border-white/[0.07] bg-[#111315] p-3.5">
            <PrimaryButton onClick={onDownload}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download video
            </PrimaryButton>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-white/40">
              MP4, {wide ? "1280 × 720" : "720 × 1280"}, {total} seconds, {story.scenes.length} scenes
              {story.final.trimmedSec > 0 && <>, {story.final.trimmedSec} s of silence trimmed</>}.
              {Number.isFinite(story.spentCredits) && <> It cost {story.spentCredits} credits.</>}
            </p>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
              <div className="min-w-0">
                <h3 className="text-[13px] font-black text-white">Captions</h3>
                <p className="text-[11px] leading-relaxed text-white/45">{captionsBusy ? "Updating your video…" : "Each line on screen. Most people watch muted."}</p>
              </div>
              <Toggle checked={story.final.captions} onChange={onCaptions} label="Captions" disabled={captionsBusy} />
            </div>

            {story.final.coverUrl && (
              <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] pt-3">
                <img src={story.final.coverUrl} alt={`Cover: ${story.title}`} className={cx("shrink-0 rounded-lg object-cover", wide ? "aspect-video w-[84px]" : "aspect-[9/16] w-[44px]")} loading="lazy" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-black text-white">Cover</h3>
                  <p className="text-[11px] leading-relaxed text-white/45">The strongest scene with the title, for the thumbnail.</p>
                </div>
                <PrimaryButton variant="secondary" size="sm" fullWidth={false} className="shrink-0 px-3" onClick={onDownloadCover}>
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Cover
                </PrimaryButton>
              </div>
            )}
          </section>

          {onFinalOption && <SeriesOptions story={story} busy={captionsBusy} onChange={onFinalOption} />}

          {/* 3. The post text. */}
          <UploadPackage storyId={story.id} />

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
