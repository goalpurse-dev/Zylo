import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { BLOCKY_WORLDS_PATH } from "../../data/blockyWorlds";
import useBlockyWorldsAccess from "../viral-tools/blocky-worlds/api/blockyWorldsAccess";
import { useFirstInteraction } from "../../lib/firstInteraction.js";
import { trackLaunch } from "../launch/launch";
import "./realThreeD.css";

// Home: "Not AI slop. Real 3D worlds." The how-its-built loop (public/media/how-its-built, our own Blender render of
// one In This Town shot being built: layout -> final render), 16:9 on desktop, 9:16 on phones. The chips light up in
// step with the loop (the times are where each stage starts in the clip). Honest copy: the writer, the director and
// the checker are AI; the sets, characters and render are real 3D. Shown only to visitors who may see In This Town.

const MEDIA = "/media/how-its-built/how-its-built";
const STEPS = [
  ["Layout", 0.9], ["Buildings", 1.9], ["Materials", 2.9], ["Lighting", 4.0], ["Characters", 5.0], ["Final render", 6.65],
];
const stepAt = (t) => STEPS.reduce((at, [, s], i) => (t >= s ? i : at), -1);

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => { setR(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true); }, []);
  return r;
}

function BuildLoop({ onStep }) {
  const box = useRef(null);
  const reduced = useReducedMotion();
  const interacted = useFirstInteraction();
  const [inView, setInView] = useState(false);
  const [phone, setPhone] = useState(null); // null until known: the video waits for it
  const [ready, setReady] = useState(false);

  useEffect(() => { setPhone(window.matchMedia("(max-width: 767px)").matches); }, []);
  useEffect(() => {
    if (reduced || !box.current || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(box.current);
    return () => io.disconnect();
  }, [reduced]);

  const load = !reduced && interacted && phone !== null && (inView || ready);
  useEffect(() => {
    const v = box.current?.querySelector("video");
    if (!v) return undefined;
    if (!inView) { v.pause(); return undefined; }
    v.play().catch(() => {});
    let raf = 0, last = -2;
    const tick = () => {
      const i = stepAt(v.currentTime);
      if (i !== last) { last = i; onStep(i); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, load, ready, onStep]);
  // no video (not loaded yet, reduced motion): the poster is the final render, so every chip is lit
  useEffect(() => { if (!ready) onStep(STEPS.length - 1); }, [ready, onStep]);

  const shape = phone ? "9x16" : "16x9";
  return (
    <div ref={box} className="r3d-media">
      <picture>
        <source media="(max-width: 767px)" srcSet={`${MEDIA}-9x16-poster.webp`} type="image/webp" />
        <source srcSet={`${MEDIA}-16x9-poster.webp`} type="image/webp" />
        <img src={`${MEDIA}-16x9-poster.jpg`} alt="A blocky 3D street with shops, cars and townspeople: the final render of an In This Town scene" width={1280} height={720} loading="lazy" decoding="async" />
      </picture>
      {load && (
        <video key={shape} muted loop playsInline autoPlay preload="none" aria-hidden="true" poster={`${MEDIA}-${shape}-poster.webp`}
          onCanPlay={() => setReady(true)} className={ready ? "is-ready" : ""}>
          <source src={`${MEDIA}-${shape}.webm`} type='video/webm; codecs="vp9"' />
          <source src={`${MEDIA}-${shape}.mp4`} type="video/mp4" />
        </video>
      )}
    </div>
  );
}

export default function RealThreeD() {
  const access = useBlockyWorldsAccess();
  const [step, setStep] = useState(STEPS.length - 1);
  if (access !== "allowed") return null;
  return (
    <section className="r3d" aria-labelledby="r3d-title" data-testid="home-real-3d">
      <div className="r3d-copy">
        <p className="r3d-kicker"><span aria-hidden="true" /> How In This Town is made</p>
        <h2 id="r3d-title">Not AI slop. <em>Real 3D worlds.</em></h2>
        <p className="r3d-sub">Every In This Town video is built like an animation studio would: real 3D sets in Blender, our own characters, an AI director that plans every shot and checks every frame, rendered on GPUs.</p>
        <ol className="r3d-steps" aria-label="How one shot is built">
          {STEPS.map(([label], i) => (
            <li key={label} className={i < step ? "is-done" : i === step ? "is-now" : ""}>{label}</li>
          ))}
        </ol>
        <div className="r3d-compare">
          <div className="r3d-old">
            <p>The old way</p>
            <strong>Model, rig, animate, voice, edit</strong>
            <span>Days of work for one video</span>
          </div>
          <div className="r3d-new">
            <p>With Zyvo</p>
            <strong>Type one sentence</strong>
            <span>About 30–45 minutes</span>
          </div>
        </div>
        <Link className="r3d-cta" to={BLOCKY_WORLDS_PATH} onClick={() => trackLaunch("real_3d_cta", { placement: "home_real_3d" })}>
          Make my town video <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
      <BuildLoop onStep={setStep} />
    </section>
  );
}
