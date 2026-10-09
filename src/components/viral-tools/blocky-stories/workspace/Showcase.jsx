import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { FOCUS, PrimaryButton, cx } from "../../../ui/zyvo";
import { SHOWCASE } from "../constants";

/**
 * Real Blocky Stories videos, playing, with one call to action under them. Shown on the result side to a
 * signed-out visitor ("Sign up to create your own"), to the free plan ("Upgrade your plan to make videos
 * like these") and to a paid user with no story yet ("Make your first story").
 *
 * The videos play without sound, looping, while they are on screen; a tap turns one's sound on (and the
 * other's off). With "reduce motion" set nothing plays by itself: each video has its own controls.
 *   secondary / onSecondary: a quiet second action for phones, where the builder is on the other tab.
 */
export default function Showcase({ message, sub, action, onAction, secondary, onSecondary }) {
  const [soundId, setSoundId] = useState(null);
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true);
  return (
    <section aria-label="Videos made with Blocky Stories" className="flex flex-col gap-4">
      <div className="grid w-full max-w-[470px] grid-cols-2 gap-3 self-center sm:gap-4 lg:self-start">
        {SHOWCASE.map((item) => (
          <ShowcaseVideo key={item.id} item={item} still={still} sound={soundId === item.id} onSound={() => setSoundId((id) => (id === item.id ? null : item.id))} />
        ))}
      </div>
      <div className="flex flex-col gap-3 rounded-2xl border border-lime-300/[0.16] bg-lime-300/[0.05] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="min-w-0">
          <h3 className="text-[17px] font-black leading-snug tracking-[-0.02em] text-white [text-wrap:balance]">{message}</h3>
          {sub && <p className="mt-1 text-[12px] font-semibold leading-relaxed text-white/50">{sub}</p>}
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:w-[190px]">
          <PrimaryButton onClick={onAction}>{action}</PrimaryButton>
          {secondary && (
            <button type="button" onClick={onSecondary} className={cx("rounded-lg py-1 text-center text-[12px] font-bold text-white/50 transition hover:text-white lg:hidden", FOCUS)}>
              {secondary}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function ShowcaseVideo({ item, still, sound, onSound }) {
  const ref = useRef(null);
  // Plays only while it is on screen (a hidden tab or a scrolled-away video costs nothing).
  useEffect(() => {
    const video = ref.current;
    if (!video || still || typeof IntersectionObserver === "undefined") return undefined;
    const seen = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) video.play().catch(() => {});   // a browser that refuses autoplay shows the poster
      else video.pause();
    }, { threshold: 0.35 });
    seen.observe(video);
    return () => seen.disconnect();
  }, [still]);
  return (
    <figure className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[0_8px_32px_rgba(0,0,0,.45)]">
      <video
        ref={ref}
        src={item.url}
        poster={item.poster}
        muted={!sound}
        loop
        playsInline
        controls={still}
        preload={still ? "none" : "metadata"}
        onClick={still ? undefined : onSound}
        className={cx("block aspect-[9/16] w-full object-cover", !still && "cursor-pointer")}
        aria-label={`Example video: ${item.title}, ${item.length}`}
      />
      <figcaption className="pointer-events-none absolute left-2 top-2 max-w-[calc(100%-56px)] truncate rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur-sm">
        {item.title} <span className="hidden font-semibold text-white/60 sm:inline">· {item.length}</span>
      </figcaption>
      {!still && (
        <button
          type="button"
          onClick={onSound}
          aria-pressed={sound}
          aria-label={sound ? `Turn the sound off for ${item.title}` : `Turn the sound on for ${item.title}`}
          className={cx("absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full backdrop-blur-sm transition", FOCUS, sound ? "bg-lime-300 text-[#071006]" : "bg-black/55 text-white hover:bg-black/75")}
        >
          {sound ? <Volume2 className="h-4 w-4" aria-hidden="true" /> : <VolumeX className="h-4 w-4" aria-hidden="true" />}
        </button>
      )}
    </figure>
  );
}
