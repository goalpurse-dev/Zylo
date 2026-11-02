// The sign-up and login look, on the pages and in the pop-up: the pitch on the left, the form card on the right. On phones
// the pitch comes first, smaller, then the form.
import { Check } from "lucide-react";
import Logo from "../../assets/Logo.png";
import { GoogleLogo } from "../onboarding/brandLogos.jsx";

const BENEFITS = ["Faceless videos for TikTok, Reels and Shorts", "3D explainers, stories and images in one place", "5 free images, no credit card needed"];

export function AuthPitch({ inModal = false }) {
  return (
    <div className="relative" data-testid="auth-pitch">
      <div className="flex items-center gap-2">
        <img src={Logo} alt="" className="h-7 w-7 object-contain" />
        <span className="text-[18px] font-black tracking-tight text-white">Zyvo</span>
      </div>
      <h1 className={`mt-4 font-black uppercase leading-[0.98] tracking-tight text-white lg:mt-7 ${inModal ? "text-[28px] lg:text-[42px]" : "text-[34px] sm:text-[46px] lg:text-[66px]"}`}>
        Create viral videos <span className="text-lime-300 [text-shadow:0_0_34px_rgba(190,242,100,0.45)]">with AI</span>
      </h1>
      <ul className={`mt-4 grid gap-2 lg:mt-7 lg:gap-3 ${inModal ? "" : "lg:max-w-[520px]"}`}>
        {BENEFITS.map((b) => (
          <li key={b} className={`flex items-center gap-2.5 font-semibold text-white/80 ${inModal ? "text-[13px] lg:text-[14px]" : "text-[14px] lg:text-[17px]"}`}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-3.5 w-3.5" strokeWidth={3.5} aria-hidden="true" /></span>
            {b}
          </li>
        ))}
      </ul>
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
export const AUTH_CARD = "w-full rounded-3xl border border-white/10 bg-[#161816] p-5 shadow-[0_32px_80px_rgba(0,0,0,0.6)] sm:p-7";

/** The whole page: /signup and /login. */
export function AuthPage({ children }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#090A0A] text-white">
      <div className="pointer-events-none absolute -left-40 top-[-160px] h-[560px] w-[560px] rounded-full bg-lime-300/[0.09] blur-[120px]" />
      <div className="relative mx-auto grid min-h-[100dvh] w-full max-w-[1180px] items-center gap-6 px-4 pb-8 pt-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16 lg:py-10">
        <AuthPitch />
        <div className={AUTH_CARD}>{children}</div>
      </div>
    </div>
  );
}
