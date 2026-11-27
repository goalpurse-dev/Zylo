import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, ArrowUp, Eye, Gift, Users } from "lucide-react";
import { CREATE_PATH, MAESTRO_PATH, QUICK_GENERATE_PATH, isWide, studioPath } from "../../data/styles";
import { useVisibleStyles, trackCreate } from "../create/useCatalog";
import { LoopVideo } from "../create/StyleCard";
import { useTypewriter, viewsLabel } from "../create/motion";
import { REWARDS_PATH } from "../../lib/rewards";
import { AFFILIATE_PATH } from "../../lib/affiliate";
import { LIVE } from "../../../supabase/functions/_shared/liveFeatures.js";
import { savePendingPrompt } from "../../lib/pendingPrompt";
import { useAuth } from "../../context/AuthContext";

const AuthModal = lazy(() => import("../AuthModal"));
// the same key AuthModal keeps returnTo in (kept here as text so Home does not load the popup up front)
const POST_AUTH_RETURN_KEY = "zyvo:post-auth-return";

// Home's three ways in (owner 2026-11-26): Maestro (the default), Create (a template video), Quick (an image or a short clip).
const TABS = [
  { id: "maestro", label: "Maestro", to: MAESTRO_PATH, hint: "Ask Maestro: tell it your idea and it plans and makes the video", state: (t) => ({ text: t }) },
  { id: "create", label: "Create", to: CREATE_PATH, hint: "Describe your video idea", state: (t) => ({ idea: t }) },
  { id: "quick", label: "Quick", to: QUICK_GENERATE_PATH, hint: "Describe an image or a short clip", state: (t) => ({ prompt: t }) },
];
const STARTS = {
  maestro: ["In this town, every time you laugh you grow taller", "Give me 5 ideas for my next viral video", "Explain how a submarine dives"],
  create: ["A kid who grows taller every time he laughs", "How a submarine dives and comes back up", "Why the Roman Empire fell, in one minute"],
  quick: ["A tiny dragon sleeping in a teacup", "Neon city street in the rain, from above", "A cat astronaut floating past the moon"],
};

/**
 * The prompt box with Maestro / Create / Quick tabs. `typing`: the placeholder types example ideas (the logged-out
 * Home). A guest who sends gets the sign-up popup; the text waits on the device (lib/pendingPrompt.js) and the tool
 * has it in its box after sign-up.
 */
export function PromptTabs({ typing = false, placement = "home" }) {
  const navigate = useNavigate();
  const { user } = useAuth() ?? {};
  const [tab, setTab] = useState("maestro");
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [signUp, setSignUp] = useState(null); // the tool's path to come back to
  const box = useRef(null);
  const cur = TABS.find((t) => t.id === tab);
  const typed = useTypewriter(STARTS[tab], { active: typing && !text && !focused, fallback: cur.hint });
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.max(52, Math.min(el.scrollHeight, 200))}px`; }, [text]);
  const go = (t = text) => {
    const v = String(t).trim();
    trackCreate("home_prompt", { target: tab, placement, guest: !user });
    if (!user) { if (v) savePendingPrompt(tab, v); setSignUp(cur.to); return; }
    navigate(cur.to, v ? { state: cur.state(v) } : undefined);
  };
  return (
    <>
      <div className="rounded-[22px] border border-white/[0.12] bg-[#141618]/95 p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.5)]">
        <div className="flex w-fit items-center gap-0.5 rounded-full bg-white/[0.06] p-0.5" role="tablist" aria-label="Which tool">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); box.current?.focus(); }}
              className={`rounded-full px-3.5 py-1 text-[13px] font-bold transition ${tab === t.id ? "bg-white text-black" : "text-white/80 hover:text-white"}`}>{t.label}</button>
          ))}
        </div>
        <div className="mt-2 flex items-end gap-2">
          <label htmlFor={`${placement}-prompt`} className="sr-only">{cur.hint}</label>
          <textarea id={`${placement}-prompt`} ref={box} rows={2} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)}
            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(); } }}
            placeholder={typing && !focused ? typed || cur.hint : cur.hint}
            className="min-h-[52px] flex-1 resize-none bg-transparent px-1 py-1 text-[16px] leading-6 text-white placeholder:text-white/50 focus:outline-none" />
          <button type="button" onClick={() => go()} aria-label="Go" className="mb-1 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D] shadow-[0_0_20px_rgba(190,242,100,.35)] hover:bg-lime-200" data-testid="home-prompt-go">
            <ArrowUp className="h-5 w-5" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {STARTS[tab].map((s) => <button key={s} type="button" onClick={() => go(s)} className="rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[13px] font-medium text-white/90 hover:border-lime-300/40">{s}</button>)}
      </div>
      {signUp && (
        <Suspense fallback={null}>
          <AuthModal mode="signup" title="Make it with Zyvo" subtitle="A free account is all you need. Your idea will be waiting." returnTo={signUp} onClose={(ok) => { const to = signUp; setSignUp(null); if (ok) { try { localStorage.removeItem(POST_AUTH_RETURN_KEY); } catch { /* none */ } navigate(to); } }} />
        </Suspense>
      )}
    </>
  );
}

/** the signed-in Home's hero: the prompt box under one line */
export function HomeHero() {
  return (
    <section className="mx-auto w-full max-w-[820px] px-4 pt-6 md:pt-10" data-testid="home-hero">
      <h1 className="mb-5 text-center text-[30px] font-black leading-[1.05] tracking-[-0.03em] text-white md:text-[46px]">What do you want to <span className="text-lime-300">make</span> today?</h1>
      <PromptTabs placement="home" />
    </section>
  );
}

/** Trending templates: tall cards, real views only where we have them, "Make one like this" opens the template */
export function TrendingTemplates({ max = 8 }) {
  const styles = useVisibleStyles().filter((s) => !isWide(s) && (s.preview || s.poster));
  const list = [...styles].sort((a, b) => (b.views ?? 0) - (a.views ?? 0) || a.sort - b.sort).slice(0, max);
  if (!list.length) return null;
  return (
    <section className="px-4 md:px-[50px]" data-testid="home-trending">
      <h2 className="text-[20px] font-bold tracking-tight text-white md:text-[28px]">Trending templates</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((s) => {
          const to = `${studioPath(s.studios?.[0] ?? "short-form")}?template=${s.id}`;
          return (
            <div key={s.id}>
              <Link to={to} onClick={() => trackCreate("style_selected", { style: s.id, placement: "home_trending" })} className="group relative block aspect-[9/16] overflow-hidden rounded-[18px] border border-white/[0.08] bg-black hover:border-lime-300/40">
                <LoopVideo src={s.preview} poster={s.poster} hoverOnly className="h-full w-full" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-10">
                  {s.views > 0 && <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10.5px] font-semibold text-white backdrop-blur"><Eye className="h-3 w-3 text-lime-300" />{viewsLabel(s.views)} views</span>}
                  <p className="text-[15px] font-bold leading-tight text-white">{s.name}</p>
                </div>
              </Link>
              <Link to={to} className="mt-1.5 flex items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-[12.5px] font-bold text-white hover:border-lime-300/40">Make one like this <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Free credits and the partner program, one strip */
export function RewardsStrip() {
  // only once those programs are live (_shared/liveFeatures.js)
  if (!LIVE.rewards && !LIVE.affiliate) return null;
  return (
    <section className="grid gap-3 px-4 sm:grid-cols-2 md:px-[50px]" data-testid="home-rewards">
      <Link to={REWARDS_PATH} className="flex items-center gap-3 rounded-2xl border border-lime-300/25 bg-lime-300/[0.06] p-4 hover:border-lime-300/50">
        <Gift className="h-7 w-7 shrink-0 text-lime-300" />
        <span><span className="block text-[15px] font-black text-white">Get free credits</span><span className="text-[13px] text-white/75">Post your videos and invite friends.</span></span>
        <ArrowRight className="ml-auto h-4 w-4 text-white/70" />
      </Link>
      <Link to={AFFILIATE_PATH} className="flex items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.04] p-4 hover:border-white/30">
        <Users className="h-7 w-7 shrink-0 text-white/85" />
        <span><span className="block text-[15px] font-black text-white">Earn money with Zyvo</span><span className="text-[13px] text-white/75">Share your link and earn when people buy a plan.</span></span>
        <ArrowRight className="ml-auto h-4 w-4 text-white/70" />
      </Link>
    </section>
  );
}
