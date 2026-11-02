// "Your video is coming to life": our own 3D videos drifting softly behind the progress steps. The blur and the dimming are
// baked into very small files (public/onboarding/float), and only a transform moves, so a phone has almost nothing to do.
// The stills show first and the clips start a moment later; asked for less motion: the stills, standing still.
import { useEffect, useState } from "react";
import "./onboarding.css";

const CLIPS = [
  // phones: above and below the text and the steps, never behind them
  { key: "landfill", box: "left-[-18px] top-[6%] w-[100px] md:left-[7%] md:top-[9%] md:w-[190px]", dur: "38s", delay: "-4s" },
  { key: "carwash", box: "right-[-14px] top-[8%] w-[96px] md:right-[8%] md:top-[12%] md:w-[170px]", dur: "46s", delay: "-18s" },
  { key: "drain", box: "left-[-14px] bottom-[-3%] w-[96px] md:left-[14%] md:bottom-[7%] md:w-[160px]", dur: "42s", delay: "-11s" },
  { key: "pool", box: "right-[-26px] bottom-[12%] hidden w-[120px] md:right-[13%] md:block md:w-[180px]", dur: "50s", delay: "-27s" },
];
const START_AFTER_MS = 400;

export default function FloatingClips() {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    if (still) return undefined;
    const t = setTimeout(() => setPlay(true), START_AFTER_MS);
    return () => clearTimeout(t);
  }, [still]);
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true" data-testid="floating-clips">
      {CLIPS.map((c) => (
        <div key={c.key} className={`ob-drift absolute aspect-[9/16] overflow-hidden rounded-2xl opacity-50 ${c.box}`} style={{ "--ob-drift": c.dur, animationDelay: c.delay }}>
          <img src={`/onboarding/float/${c.key}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
          {play && <video ref={(el) => { if (el) { el.muted = true; el.setAttribute("muted", ""); } }} src={`/onboarding/float/${c.key}.mp4`} muted loop autoPlay playsInline disablePictureInPicture className="absolute inset-0 h-full w-full object-cover" />}
        </div>
      ))}
    </div>
  );
}
