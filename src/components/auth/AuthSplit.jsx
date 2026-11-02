// The sign-up and login look, on the pages and in the pop-up: the pitch on the left, the form card on the right. On phones
// only the headline and the creator count come first, so the form stays near the top.
import { useEffect, useState } from "react";
import { Check, Users } from "lucide-react";
import Logo from "../../assets/Logo.png";
import { GoogleLogo } from "../onboarding/brandLogos.jsx";
import { useCreatorCount } from "../../lib/creatorCount";

const BENEFITS = ["Faceless videos for TikTok, Reels and Shorts", "3D explainers, stories and images in one place", "5 free images, no credit card needed"];
// Short loops cut from our own videos (public/library and public/cutaway-explainer).
const CLIPS = ["story", "cutaway", "xray", "skeleton"];
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Desktop only: on phones nothing renders, so nothing downloads and the form stays at the top (owner, 2026-11-02).
function useIsDesktop() {
  const query = "(min-width: 1024px)";
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query), change = () => setOn(mq.matches);
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, []);
  return on;
}

function VideoStrip() {
  const still = reducedMotion();
  if (!useIsDesktop()) return null;
  return (
    <div className="mt-6 grid grid-cols-4 gap-3" aria-hidden="true" data-testid="auth-videos">
      {CLIPS.map((name) => (
        <div key={name} className="relative aspect-[9/16] overflow-hidden rounded-2xl border border-white/10 bg-[#151715]">
          {still
            ? <img src={`/onboarding/auth/${name}.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover" />
            : <video ref={(el) => { if (el) { el.muted = true; el.setAttribute("muted", ""); } }} src={`/onboarding/auth/${name}.mp4`} poster={`/onboarding/auth/${name}.jpg`} autoPlay muted loop playsInline preload="metadata" disablePictureInPicture className="absolute inset-0 h-full w-full object-cover" />}
        </div>
      ))}
    </div>
  );
}

export function AuthPitch({ inModal = false }) {
  const creators = useCreatorCount();
  return (
    <div className="relative min-w-0" data-testid="auth-pitch">
      <div className={`flex items-center gap-2 ${inModal ? "" : "pl-12 lg:pl-0"}`}>
        <img src={Logo} alt="" className="h-7 w-7 object-contain" />
        <span className="text-[18px] font-black tracking-tight text-white">Zyvo</span>
      </div>
      <h1 className={`mt-3 font-black uppercase leading-[0.98] tracking-tight text-white lg:mt-6 ${inModal ? "text-[26px] lg:text-[38px]" : "text-[30px] sm:text-[44px] lg:text-[60px]"}`}>
        Create viral videos <span className="text-lime-300 [text-shadow:0_0_34px_rgba(190,242,100,0.45)]">with AI</span>
      </h1>
      <ul className="mt-5 hidden gap-2.5 lg:grid">
        {BENEFITS.map((b) => (
          <li key={b} className={`flex items-center gap-2.5 font-semibold text-white/80 ${inModal ? "text-[13px]" : "text-[16px]"}`}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span>
            {b}
          </li>
        ))}
      </ul>
      <VideoStrip />
      <p className="mt-2.5 flex items-center gap-2 text-[13.5px] font-bold text-white/85 lg:mt-4 lg:text-[15px]" data-testid="auth-creators">
        <Users className="h-4 w-4 text-lime-300" aria-hidden="true" /> Join {creators.toLocaleString("en-US")}+ creators
      </p>
    </div>
  );
}

export function GoogleButton({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-[50px] w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-bold text-[#11150D] transition hover:bg-white/90">
      <GoogleLogo /> Continue with Google
    </button>
  );
}

export function OrUseEmail() {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="shrink-0 text-xs font-semibold text-white/45">or use email</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export const AUTH_INPUT = "h-[50px] w-full rounded-xl border border-white/10 bg-[#0D0F0D] px-4 text-[15px] text-white placeholder-white/25 outline-none transition focus:border-lime-300/70 focus:ring-2 focus:ring-lime-300/20 [&:-webkit-autofill]:shadow-[0_0_0_1000px_#0D0F0D_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]";
export const AUTH_BUTTON = "mt-1 min-h-[56px] w-full rounded-xl bg-lime-300 text-[17px] font-black text-[#11150D] shadow-[0_0_34px_rgba(190,242,100,0.35)] transition hover:bg-lime-200 disabled:opacity-50";
export const AUTH_CARD = "w-full min-w-0 rounded-3xl border border-white/10 bg-[#161816] p-5 shadow-[0_32px_80px_rgba(0,0,0,0.6)] sm:p-7";

/** The whole page: /signup and /login. */
export function AuthPage({ children }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#090A0A] text-white">
      <div className="pointer-events-none absolute -left-40 top-[-160px] h-[560px] w-[560px] rounded-full bg-lime-300/[0.09] blur-[120px]" />
      <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-[1180px] content-start items-center gap-4 px-4 pb-6 pt-[22px] sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:content-center lg:gap-14 lg:py-8">
        <AuthPitch />
        <div className={AUTH_CARD}>{children}</div>
      </div>
    </div>
  );
}
