// "Building your plan": after the survey's last step. While it runs, the videos on offer are really fetched in the order
// their answers ask for, and their posters loaded, so "Pick your first video" opens ready. No videos on offer: no screen.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check } from "lucide-react";
import { cutawayServer } from "../viral-tools/cutaway-explainer/api/cutawayApi";
import { adminPreviewMode } from "../../lib/onboarding";
import { demoStateFor } from "../../lib/onboardingDemo";
import "./onboarding.css";

// The owner's dial: how long the screen stays, in seconds. The lines share it evenly.
export const PLAN_SCREEN_SECONDS = 10;

const LINES = ["Building your plan...", "Matching templates to your goals...", "Finding the most viral topic for you...", "Getting your first video ready...", "Done! ✓"];
const RING = 2 * Math.PI * 92;
const SPARKS = Array.from({ length: 22 }, (_, i) => ({ a: `${(i * 360) / 22}deg`, d: `${110 + ((i * 37) % 90)}px`, size: 5 + (i % 4) * 2, delay: `${(i % 5) * 25}ms` }));
const ORBITS = [{ r: 112, s: 7, n: 5 }, { r: 134, s: 11, n: 7 }];

export default function BuildingPlan({ goals, goalLabels, onDone }) {
  const [line, setLine] = useState(0);
  const [progress, setProgress] = useState(0);
  const [topTopic, setTopTopic] = useState(null);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    let live = true;
    const adminMode = adminPreviewMode();
    const ask = adminMode === "demo" ? Promise.resolve(demoStateFor(goals)) : cutawayServer.freePreviewState({ force: adminMode === "real" });
    ask.then((s) => {
      if (!live) return;
      if (!s?.topics?.length) { done.current(); return; }
      setTopTopic(s.topics[0].topic);
      s.topics.forEach((t) => { if (t.poster) new Image().src = t.poster; });
    }).catch(() => { if (live) done.current(); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const ms = PLAN_SCREEN_SECONDS * 1000, start = performance.now();
    let frame;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      setProgress(t);
      setLine(Math.min(LINES.length - 1, Math.floor(t * LINES.length)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const end = setTimeout(() => done.current(), ms);
    return () => { cancelAnimationFrame(frame); clearTimeout(end); };
  }, []);

  const finished = line === LINES.length - 1;
  // the ring fills by the time "Done!" comes up
  const ring = Math.min(1, progress / ((LINES.length - 1) / LINES.length));
  const detail = line === 1 ? goalLabels.join(" · ") : line === 2 || line === 3 ? (topTopic ? `Top pick for you: ${topTopic}` : "") : "";

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center overflow-hidden bg-[#090A0A] px-5 text-center" data-testid="building-plan" role="status" aria-live="polite">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-[58%] rounded-full bg-lime-300/[0.07] blur-[90px]" />
      <div className="relative h-[300px] w-[300px]">
        {ORBITS.map((o) => (
          <div key={o.r} className="ob-orbit absolute inset-0" style={{ "--ob-orbit": `${o.s}s` }}>
            {Array.from({ length: o.n }, (_, i) => (
              <span key={i} className="absolute left-1/2 top-1/2 rounded-full bg-lime-200 shadow-[0_0_10px_rgba(190,242,100,0.9)]"
                style={{ width: 3 + (i % 3) * 2, height: 3 + (i % 3) * 2, opacity: 0.35 + (i % 3) * 0.25, transform: `rotate(${(i * 360) / o.n}deg) translateY(-${o.r}px)` }} />
            ))}
          </div>
        ))}
        <svg viewBox="0 0 200 200" className="absolute inset-[50px] -rotate-90" aria-hidden="true">
          <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle cx="100" cy="100" r="92" fill="none" stroke="#BEF264" strokeWidth="7" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - ring)} style={{ filter: "drop-shadow(0 0 8px rgba(190,242,100,0.8))" }} />
        </svg>
        <div className={`absolute inset-[92px] grid place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#F4FFD6,#BEF264_45%,#65A30D)] shadow-[0_0_60px_18px_rgba(190,242,100,0.4)] ${finished ? "ob-done" : "ob-orb"}`}>
          {finished && <Check className="h-14 w-14 text-[#11150D]" strokeWidth={3.5} aria-hidden="true" />}
        </div>
        {finished && SPARKS.map((s, i) => (
          <span key={i} className="ob-burst absolute left-1/2 top-1/2 rounded-full bg-lime-200" style={{ "--a": s.a, "--d": s.d, width: s.size, height: s.size, animationDelay: s.delay }} />
        ))}
      </div>
      <p key={line} className="ob-enter relative mt-4 text-[24px] font-black leading-tight tracking-tight text-white sm:text-[30px]" data-testid="building-plan-line">
        {LINES[line]}
      </p>
      <p key={detail} className="ob-enter relative mt-2 min-h-[22px] max-w-[440px] text-[14.5px] font-semibold text-lime-200" data-testid="building-plan-detail">{detail}</p>
    </div>,
    document.body,
  );
}
