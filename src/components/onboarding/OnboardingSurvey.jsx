// The new-user survey: full screen, one question at a time, a progress bar, Back and a small Skip.
// (The step layout and answer cards grew out of the old EmailConsentModal.)
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Briefcase, Check, Clapperboard, Compass, Film, Megaphone, MoreHorizontal, Rocket, Smartphone, Sprout, Users } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { EMAIL_CONSENT_TEXT, rememberSurveyGoals, requestWelcomeEmail, trackFunnel } from "../../lib/onboarding";
import { BrandLogo } from "./brandLogos.jsx";
import BuildingPlan from "./BuildingPlan.jsx";
import "./onboarding.css";

const GOALS = [
  { id: "faceless", icon: Smartphone, label: "Faceless TikTok, Reels or Shorts" },
  { id: "longform", icon: Clapperboard, label: "Long-form YouTube videos" },
  { id: "business", icon: Briefcase, label: "Content for my business or brand" },
  { id: "exploring", icon: Compass, label: "Just exploring" },
];
const EXPERIENCE = [
  { id: "never", icon: Sprout, label: "Never" },
  { id: "few", icon: Film, label: "A few" },
  { id: "regular", icon: Rocket, label: "I post regularly" },
];
const HEARD = [
  { id: "tiktok_creator", brand: "tiktok", label: "TikTok creator" },
  { id: "tiktok_ad", icon: Megaphone, label: "TikTok ad" },
  { id: "instagram", brand: "instagram", label: "Instagram" },
  { id: "youtube", brand: "youtube", label: "YouTube" },
  { id: "google", brand: "google", label: "Google" },
  { id: "friend", icon: Users, label: "Friend" },
  { id: "other", icon: MoreHorizontal, label: "Other" },
];
const TOTAL = 4;

// One tile for every answer: our icons and the real logos look like one set.
function IconTile({ icon: Icon, brand, picked }) {
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border bg-gradient-to-b from-lime-300/25 to-lime-300/[0.06] text-lime-200 transition ${picked ? "border-lime-300/70" : "border-lime-300/25"}`}>
      {brand ? <BrandLogo brand={brand} /> : <Icon className="h-[22px] w-[22px]" strokeWidth={2.2} aria-hidden="true" />}
    </span>
  );
}

function AnswerCard({ icon, brand, label, picked, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={picked} data-testid={testId}
      className={`flex min-h-[68px] w-full items-center gap-3.5 rounded-2xl border-2 px-3.5 py-3 text-left text-[15.5px] font-bold transition ${picked ? "ob-pick border-lime-300 bg-lime-300/[0.1] text-white shadow-[0_0_26px_rgba(190,242,100,0.28)]" : "border-white/10 bg-white/[0.04] text-white/85 hover:border-white/25 hover:bg-white/[0.06]"}`}>
      <IconTile icon={icon} brand={brand} picked={picked} />
      <span className="flex-1">{label}</span>
      {picked && <span className="ob-check grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime-300 text-[#11150D]"><Check className="h-4 w-4" strokeWidth={3.5} aria-hidden="true" /></span>}
    </button>
  );
}

// withPlan: the "Building your plan" screen comes after the last step (not on the way to Long Form, or after a Skip: nothing to build on).
export default function OnboardingSurvey({ onDone, preview = false, withPlan = true }) {
  const [building, setBuilding] = useState(false);
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState([]);
  const [experience, setExperience] = useState(null);
  const [heardFrom, setHeardFrom] = useState(null);
  const [creator, setCreator] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { trackFunnel("survey_started"); }, []);
  const answered = (question, answer) => trackFunnel("survey_answer", { question, answer });
  // the end of the survey, however it ends: the welcome email goes now (the server decides whether it may)
  const leave = (skipped) => { requestWelcomeEmail(); onDone({ goals, skipped }); };
  const finish = async (skipped) => {
    if (saving) return;
    rememberSurveyGoals(skipped ? [] : goals);
    const next = () => { if (!skipped && withPlan) setBuilding(true); else leave(skipped); };
    if (preview) { next(); return; } // the owner's look: no answers saved
    setSaving(true);
    trackFunnel(skipped ? "survey_skipped" : "survey_completed", skipped ? { atStep: step } : {});
    const { error } = await supabase.rpc("save_onboarding_survey", {
      p_goals: goals, p_experience: experience, p_heard_from: heardFrom, p_heard_creator: heardFrom === "tiktok_creator" ? creator.trim() || null : null,
      p_email_consent: consent, p_consent_text: consent ? EMAIL_CONSENT_TEXT : null, p_skipped: skipped,
    });
    if (error) console.error("survey not saved:", error.message); // the flow goes on: a lost answer must not stop anyone
    next();
  };

  if (building) return <BuildingPlan goals={goals} goalLabels={GOALS.filter((g) => goals.includes(g.id)).map((g) => g.label)} onDone={() => leave(false)} />;

  const body = {
    1: (
      <>
        <h1 className="text-[27px] font-black leading-tight tracking-tight text-white sm:text-[32px]">What do you want to create?</h1>
        <p className="mt-1.5 text-[14px] text-white/55">Pick as many as you like.</p>
        <div className="mt-5 grid gap-2.5">
          {GOALS.map((g) => (
            <AnswerCard key={g.id} {...g} testId={`goal-${g.id}`} picked={goals.includes(g.id)} onClick={() => setGoals((cur) => (cur.includes(g.id) ? cur.filter((x) => x !== g.id) : [...cur, g.id]))} />
          ))}
        </div>
        <button type="button" disabled={!goals.length} data-testid="survey-next" onClick={() => { answered("goals", goals); setStep(2); }}
          className="mt-5 min-h-[54px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:opacity-40">Next</button>
      </>
    ),
    2: (
      <>
        <h1 className="text-[27px] font-black leading-tight tracking-tight text-white sm:text-[32px]">Have you made videos before?</h1>
        <div className="mt-5 grid gap-2.5">
          {EXPERIENCE.map((x) => <AnswerCard key={x.id} {...x} testId={`exp-${x.id}`} picked={experience === x.id} onClick={() => { setExperience(x.id); answered("experience", x.id); setStep(3); }} />)}
        </div>
      </>
    ),
    3: (
      <>
        <h1 className="text-[27px] font-black leading-tight tracking-tight text-white sm:text-[32px]">How did you hear about Zyvo?</h1>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {HEARD.map((h) => <AnswerCard key={h.id} {...h} testId={`heard-${h.id}`} picked={heardFrom === h.id} onClick={() => { setHeardFrom(h.id); answered("heard_from", h.id); if (h.id !== "tiktok_creator") setStep(4); }} />)}
        </div>
        {heardFrom === "tiktok_creator" && (
          <div className="mt-4">
            <label htmlFor="survey-creator" className="text-[13px] font-semibold text-white/60">Which creator? (optional)</label>
            <input id="survey-creator" value={creator} maxLength={120} onChange={(e) => setCreator(e.target.value)} data-testid="survey-creator"
              className="mt-1.5 h-12 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 text-[15px] text-white outline-none focus:border-lime-300/60" />
            <button type="button" data-testid="survey-next" onClick={() => { if (creator.trim()) answered("heard_creator", creator.trim()); setStep(4); }} className="mt-3 min-h-[54px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200">Next</button>
          </div>
        )}
      </>
    ),
    4: (
      <>
        <h1 className="text-[27px] font-black leading-tight tracking-tight text-white sm:text-[32px]">Get tips, templates and offers by email?</h1>
        <p className="mt-1.5 text-[14px] text-white/55">Only if you want them. You can change this any time in Settings.</p>
        <label className={`mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 transition ${consent ? "ob-pick border-lime-300 bg-lime-300/[0.1] shadow-[0_0_26px_rgba(190,242,100,0.28)]" : "border-white/10 bg-white/[0.04]"}`}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="survey-consent" className="h-5 w-5 accent-lime-300" />
          <span className="text-[15px] font-semibold text-white/85">Yes, email me tips, templates and offers</span>
        </label>
        <button type="button" disabled={saving} data-testid="survey-finish" onClick={() => finish(false)}
          className="mt-5 min-h-[54px] w-full rounded-2xl bg-lime-300 text-[16px] font-black text-[#11150D] transition hover:bg-lime-200 disabled:opacity-60">Make my first video</button>
      </>
    ),
  }[step];

  return createPortal(
    <div className="fixed inset-0 z-[9998] overflow-y-auto bg-[#090A0A]" data-zyvo-modal="survey" data-testid="onboarding-survey">
      <div className="mx-auto flex min-h-full w-full max-w-[520px] flex-col px-4 pb-8 pt-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Back" disabled={step === 1} onClick={() => setStep((s) => Math.max(1, s - 1))} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 disabled:opacity-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL} aria-valuenow={step}>
            <div className="h-full rounded-full bg-lime-300 transition-all duration-300" style={{ width: `${(step / TOTAL) * 100}%` }} />
          </div>
          <button type="button" data-testid="survey-skip" onClick={() => finish(true)} className="shrink-0 px-1 text-[13px] font-semibold text-white/40 transition hover:text-white/70">Skip</button>
        </div>
        <div key={step} className="my-auto py-6">{body}</div>
      </div>
    </div>,
    document.body,
  );
}
