import { useEffect, useRef, useState } from "react";
import { motion as Motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ChevronDown, Film, Pencil, RefreshCw } from "lucide-react";
import { CreditIcon, FOCUS, ProgressBar, cx } from "../../../ui/zyvo";
import { clipPrice, picturePrice } from "../pricing/blockyEstimates";
import { AvatarStack } from "../shared/Avatar";
import WorkspaceHeader from "./WorkspaceHeader";

const COPY = {
  pictures: ["Painting your scenes", "You can keep using the page while this runs."],
  pictures_ready: ["Check your scenes", "Happy with them? Animate all. Not happy? Edit or regenerate any scene first."],
  animating: ["Animating your scenes", "Each character is speaking their line. You can keep using the page."],
  clips_ready: ["Your clips are ready", "Play any clip to check it, then make the final video."],
  building: ["Making your video", "Joining the clips in order and trimming the silence."],
  draft: ["Your script is ready", "Make the scene pictures to see every scene before anything is animated."],
};

/** Scenes / clips grid for a story that isn't final yet. */
export default function StoryBoard({ story, byId, prices, onEdit, onRegenerate, onRegenerateClip, onRegenerateFree, acting = null }) {
  const inClips = ["animating", "clips_ready", "building"].includes(story.status);
  const n = story.scenes.length;
  const done = story.scenes.filter((s) => (inClips ? s.clipStatus : s.imageStatus) === "ready").length;
  const pct = Math.round((done / n) * 100);
  const [title, subtitle] = COPY[story.status] ?? COPY.pictures;
  const failedPictures = story.scenes.filter((s) => s.imageStatus === "failed").length;
  const failedClips = story.scenes.filter((s) => s.clipStatus === "failed").length;

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceHeader title={title} subtitle={subtitle} />

      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-3">
        <span className="shrink-0 text-[12px] font-black tabular-nums text-white">{inClips ? "Clips" : "Pictures"} {done}/{n}</span>
        <ProgressBar value={pct} label={`${inClips ? "Clips" : "Pictures"}: ${done} of ${n} ready`} className="flex-1" />
        <span className="shrink-0 text-[12px] font-black tabular-nums text-lime-300">{pct}%</span>
      </div>

      <SlowNotice busy={["pictures", "animating"].includes(story.status)} done={done} total={n} what={inClips ? "clip" : "picture"} />

      {(failedPictures > 0 || failedClips > 0) && (
        <p role="status" className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[12px] font-semibold leading-relaxed text-red-300">
          {failedPictures > 0
            ? `${failedPictures === 1 ? "One scene" : `${failedPictures} scenes`} couldn't be made. Regenerate or edit ${failedPictures === 1 ? "it" : "them"} below. Nothing else is affected.`
            : `${failedClips === 1 ? "One clip" : `${failedClips} clips`} couldn't be animated. Regenerate ${failedClips === 1 ? "it" : "them"} below.`}
        </p>
      )}

      {story.castIds.length > 0 && <CharacterRefs castIds={story.castIds} byId={byId} roles={story.castRoles} />}

      <div className={cx("grid gap-3", story.aspect === "16:9" ? "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3" : "grid-cols-2 md:grid-cols-3 2xl:grid-cols-4")}>
        {story.scenes.map((scene) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            story={story}
            byId={byId}
            prices={prices}
            inClips={inClips}
            onEdit={() => onEdit(scene)}
            onRegenerate={() => onRegenerate(scene)}
            onRegenerateClip={() => onRegenerateClip(scene)}
            onRegenerateFree={onRegenerateFree ? () => onRegenerateFree(scene) : null}
            freeBusy={acting === `free-${scene.id}`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Never look frozen: a running timer while work is in flight, and after 2 min
 * a calm "taking longer" note (the video service can be slow; each result
 * appears as soon as it's ready).
 */
function SlowNotice({ busy, done, total, what }) {
  const since = useRef(null);
  const [now, setNow] = useState(() => Date.now());
  if (busy && since.current == null) since.current = Date.now();
  if (!busy) since.current = null;
  useEffect(() => {
    if (!busy) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busy]);
  if (!busy || since.current == null) return null;
  const sec = Math.max(0, Math.floor((now - since.current) / 1000));
  const clock = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const slow = sec >= 120;
  return (
    <p role="status" aria-live="polite" className={cx("flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[12px] font-semibold leading-relaxed", slow ? "border-amber-300/25 bg-amber-300/[0.07] text-amber-100" : "border-white/[0.07] bg-white/[0.03] text-white/55")}>
      <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-lime-300/20 border-t-lime-300/70 motion-reduce:animate-none" />
      <span className="min-w-0">
        {slow
          ? <>Taking a bit longer than usual, hang tight. {done} of {total} {what}s done; each one appears here as soon as it&apos;s ready.</>
          : <>{done} of {total} {what}s done. Each one appears here as soon as it&apos;s ready.</>}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-white/40">{clock}</span>
    </p>
  );
}

function CharacterRefs({ castIds, byId, roles = {} }) {
  return (
    <details className="group rounded-2xl border border-white/[0.07] bg-[#111315] px-4">
      <summary className={cx("flex cursor-pointer list-none items-center gap-3 py-3 text-[12px] font-bold text-white/80 [&::-webkit-details-marker]:hidden", FOCUS)}>
        <AvatarStack ids={castIds} byId={byId} size="h-6 w-6" />
        Characters in this story
        <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-lime-300">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
          <ChevronDown className="h-3.5 w-3.5 transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <ul className="flex flex-wrap gap-2 pb-4">
        {castIds.map((id) => {
          const c = byId(id);
          if (!c) return null;
          return (
            <li key={id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.035] p-2 pr-3">
              <img src={c.refImageUrl} alt={`${c.name} reference`} className="h-[58px] w-[44px] rounded-lg object-cover object-top" />
              <span>
                <span className="block text-[12px] font-black text-white">{c.name}</span>
                <span className="block max-w-[220px] text-[10px] font-semibold leading-relaxed text-white/40">{roles?.[id] ? `${roles[id][0].toUpperCase()}${roles[id].slice(1)} in this story.` : `${c.tag}.`} Same look in every scene.</span>
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function SceneCard({ scene, story, byId, prices, inClips, onEdit, onRegenerate, onRegenerateClip, onRegenerateFree, freeBusy }) {
  const reduce = useReducedMotion();
  // Remember whether this picture was being painted while we watched, so the
  // "developing" reveal only plays for pictures that just arrived.
  const sawGenerating = useRef(false);
  if (scene.imageStatus === "generating") sawGenerating.current = true;
  const develop = scene.imageStatus === "ready" && sawGenerating.current;
  // A clip that finishes while we watch gets a short "Just finished" badge.
  const lastClip = useRef(scene.clipStatus);
  const [justDone, setJustDone] = useState(false);
  useEffect(() => {
    if (lastClip.current !== "ready" && lastClip.current !== "none" && scene.clipStatus === "ready") {
      setJustDone(true);
      const id = setTimeout(() => setJustDone(false), 5000);
      lastClip.current = scene.clipStatus;
      return () => clearTimeout(id);
    }
    lastClip.current = scene.clipStatus;
    return undefined;
  }, [scene.clipStatus]);

  const number = scene.index + 1;
  const speaker = byId(scene.speakerId);
  const speakerName = speaker?.name.split(" ")[0] ?? "Someone";
  const picture = picturePrice(prices);
  const clip = clipPrice(story.quality, scene.durationSec, prices);
  const canTouchPicture = !inClips && (scene.imageStatus === "ready" || scene.imageStatus === "failed") && ["pictures", "pictures_ready"].includes(story.status);
  const canRegenClip = inClips && (scene.clipStatus === "ready" || scene.clipStatus === "failed") && story.status !== "building";

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111315]" aria-label={`Scene ${number}`}>
      <div className="flex items-center justify-between gap-2 px-3 pb-2 pt-2.5 text-[11px]">
        <span className="shrink-0 whitespace-nowrap font-black text-white">Scene {number}</span>
        <span className="min-w-0 truncate font-semibold text-white/35">{scene.title}</span>
      </div>

      <div className={cx("relative mx-2 overflow-hidden rounded-xl bg-[#0D0F11]", story.aspect === "16:9" ? "aspect-video" : "aspect-[9/16]")}>
        {scene.imageStatus === "ready" && scene.imageUrl && (
          scene.clipStatus === "ready" && scene.clipUrl ? (
            <video src={scene.clipUrl} poster={scene.imageUrl} controls playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={`Clip ${number}: ${speakerName} says ${scene.line}`} />
          ) : (
            <Motion.img
              key={scene.imageUrl}
              src={scene.imageUrl}
              alt={`Scene ${number}: ${scene.imagePrompt}`}
              className="absolute inset-0 h-full w-full object-cover"
              initial={develop ? (reduce ? { opacity: 0 } : { opacity: 1, filter: "blur(16px) saturate(0) brightness(1.6)", scale: 1.04 }) : false}
              animate={{ opacity: 1, filter: "blur(0px) saturate(1) brightness(1)", scale: 1 }}
              transition={{ duration: reduce ? 0.2 : 1, ease: "easeOut" }}
            />
          )
        )}

        {(scene.imageStatus === "queued" || scene.imageStatus === "generating") && (
          <div className="absolute inset-0 grid place-items-center">
            {scene.imageStatus === "generating" && !reduce && (
              <Motion.div
                aria-hidden="true"
                className="absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(190,242,100,0.08)_50%,transparent_70%)] bg-[length:250%_100%]"
                animate={{ backgroundPosition: ["150% 0%", "-100% 0%"] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
              />
            )}
            <span className="relative text-[11px] font-bold text-white/40">{scene.imageStatus === "generating" ? "Painting scene…" : "Waiting…"}</span>
          </div>
        )}

        {scene.imageStatus === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-500/[0.06] p-3 text-center">
            <AlertTriangle className="h-5 w-5 text-red-300" aria-hidden="true" />
            <p className="text-[11px] font-bold leading-relaxed text-red-200">
              Scene {number} couldn&apos;t be made.
              {picture != null && <> Regenerate it for {picture} credits, or edit it.</>}
            </p>
          </div>
        )}

        {(scene.clipStatus === "generating" || scene.clipStatus === "queued") && (
          <div className="absolute inset-x-2 top-2 z-10 flex items-center gap-2 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md">
            <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <Motion.span
                className="block h-full rounded-full bg-lime-300"
                initial={{ width: "8%" }}
                animate={reduce || scene.clipStatus === "queued" ? { width: "8%" } : { width: ["8%", "92%"] }}
                transition={reduce ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
            </span>
            <span className="text-[9px] font-bold text-white/70">{scene.clipStatus === "queued" ? "Waiting" : "Animating"}</span>
          </div>
        )}

        {justDone && (
          <span role="status" className="absolute left-2 top-2 z-10 rounded-full bg-lime-300 px-2.5 py-1 text-[10px] font-black text-[#11150D] shadow-lg">Just finished</span>
        )}

        {scene.clipStatus === "failed" && (
          <div className="absolute inset-x-2 top-2 z-10 rounded-xl bg-black/75 px-2.5 py-2 text-[10px] font-bold leading-relaxed text-red-200 backdrop-blur-md">
            Clip {number} couldn&apos;t be animated.{clip != null && ` Regenerate it for ${clip} credits.`}
          </div>
        )}

      </div>

      {scene.imageCheck?.status === "failed" && scene.imageStatus === "ready" && (
        <div role="alert" className="mx-2 mt-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-2.5 py-2 text-[10px] font-semibold leading-relaxed text-amber-100">
          <span className="font-black">Our check found a problem:</span> {scene.imageCheck.notes || "something looks off"}.
          {scene.imageCheck.freeRegenerate && !inClips && onRegenerateFree && (
            <button type="button" onClick={onRegenerateFree} disabled={freeBusy} className={cx("mt-1.5 block w-full rounded-lg bg-amber-300 px-2 py-1.5 text-[11px] font-black text-[#1b1406] transition enabled:hover:bg-amber-200 disabled:opacity-50", FOCUS)}>
              {freeBusy ? "Starting…" : "Regenerate free (once)"}
            </button>
          )}
        </div>
      )}

      <p className="px-3 pt-2.5 text-[11px] leading-relaxed text-white/55">
        <span className="font-black text-lime-300">{speakerName}:</span> &ldquo;{scene.line}&rdquo;
        <span className="ml-1 text-white/25">{scene.durationSec}s</span>
      </p>

      <div className="mt-auto flex gap-1.5 px-2 pb-2 pt-2.5">
        {inClips ? (
          <ActionButton onClick={onRegenerateClip} disabled={!canRegenClip} price={clip} label={`Regenerate clip ${number}`}>
            <Film className="h-3.5 w-3.5" aria-hidden="true" />
            Regenerate clip
          </ActionButton>
        ) : (
          <>
            <ActionButton onClick={onEdit} disabled={!canTouchPicture} price={picture} label={`Edit scene ${number}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              Edit
            </ActionButton>
            <ActionButton onClick={onRegenerate} disabled={!canTouchPicture} price={picture} label={`Regenerate scene ${number}`}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Regenerate
            </ActionButton>
          </>
        )}
      </div>
    </article>
  );
}

function ActionButton({ children, onClick, disabled, price, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={price != null ? `${label}, ${price} credits` : label}
      className={cx(
        "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-1.5 py-1.5 text-[11px] font-bold text-white/75 transition",
        "enabled:hover:border-lime-300/25 enabled:hover:text-white enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35",
        FOCUS,
      )}
    >
      {children}
      {price != null && (
        <span className="ml-0.5 flex items-center gap-0.5 text-lime-300">
          <CreditIcon className="h-3 w-3" />
          {price}
        </span>
      )}
    </button>
  );
}

/**
 * Shown the moment "Make scene pictures" is pressed, while the script is being
 * written: the storyboard with empty scene cards, so the user sees where their
 * video will appear (instead of Recent creations).
 */
export function WritingBoard({ sceneCount, aspect = "9:16", label = "Writing your script…" }) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <WorkspaceHeader title={label} subtitle="Every scene gets a line and a picture. The pictures start as soon as the script is ready." />
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111315] px-4 py-3">
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-lime-300/20 border-t-lime-300/70 motion-reduce:animate-none" />
        <span className="text-[12px] font-black text-white">{label}</span>
        <span className="ml-auto text-[11px] font-semibold text-white/35">{sceneCount} scenes</span>
      </div>
      <div className={cx("grid gap-3", aspect === "16:9" ? "grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3" : "grid-cols-2 md:grid-cols-3 2xl:grid-cols-4")}>
        {Array.from({ length: sceneCount }, (_, i) => (
          <article key={i} className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-[#111315]" aria-label={`Scene ${i + 1}, being written`}>
            <div className="px-3 pb-2 pt-2.5 text-[11px] font-black text-white">Scene {i + 1}</div>
            <div className={cx("relative mx-2 overflow-hidden rounded-xl bg-[#0D0F11]", aspect === "16:9" ? "aspect-video" : "aspect-[9/16]")}>
              {!reduce && (
                <Motion.div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[linear-gradient(100deg,transparent_30%,rgba(190,242,100,0.06)_50%,transparent_70%)] bg-[length:250%_100%]"
                  animate={{ backgroundPosition: ["150% 0%", "-100% 0%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: i * 0.12 }}
                />
              )}
              <span className="absolute inset-0 grid place-items-center text-[11px] font-bold text-white/35">Writing…</span>
            </div>
            <div className="mx-3 mb-3 mt-2.5 flex flex-col gap-1.5" aria-hidden="true">
              <span className="h-2 w-5/6 rounded-full bg-white/[0.06]" />
              <span className="h-2 w-3/5 rounded-full bg-white/[0.06]" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
