// The new-user survey: full screen, one question at a time, a progress bar, Back and a small Skip.
// (The step layout and answer cards grew out of the old EmailConsentModal.)
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { EMAIL_CONSENT_TEXT, trackFunnel } from "../../lib/onboarding";

const GOALS = [
  { id: "faceless", emoji: "📱", label: "Faceless TikTok, Reels or Shorts" },
  { id: "longform", emoji: "🎬", label: "Long-form YouTube videos" },
  { id: "business", emoji: "💼", label: "Content for my business or brand" },
  { id: "exploring", emoji: "👀", label: "Just exploring" },
];
const EXPERIENCE = [
  { id: "never", emoji: "🌱", label: "Never" },
  { id: "few", emoji: "🎞️", label: "A few" },
  { id: "regular", emoji: "🚀", label: "I post regularly" },
];
const HEARD = [
  { id: "tiktok_creator", emoji: "🌟", label: "TikTok creator" },
  { id: "tiktok_ad", emoji: "📣", label: "TikTok ad" },
  { id: "instagram", emoji: "📸", label: "Instagram" },
  { id: "youtube", emoji: "▶️", label: "YouTube" },
  { id: "google", emoji: "🔎", label: "Google" },
  { id: "friend", emoji: "🤝", label: "Friend" },
  { id: "other", emoji: "✨", label: "Other" },
];
const TOTAL = 4;

function AnswerCard({ emoji, label, picked, onClick, testId }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={picked} data-testid={testId}
      className={`flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl border px-4 py-3 text-left text-[15.5px] font-bold transition active:scale-[.98] ${picked ? "border-lime-300 bg-lime-300/[0.1] text-white" : "border-white/10 bg-white/[0.04] text-white/85 hover:border-white/25"}`}>
      <span className="text-[22px]" aria-hidden="true">{emoji}</span>
      <span className="flex-1">{label}</span>
      {picked && <Check className="h-5 w-5 shrink-0 text-lime-300" strokeWidth={3} aria-hidden="true" />}
    </button>
  );
}

export default function OnboardingSurvey({ onDone }) {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState([]);
  const [experience, setExperience] = useState(null);
  const [heardFrom, setHeardFrom] = useState(null);
  const [creator, setCreator] = useState("");
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const answered = (question, answer) => trackFunnel("survey_answer", { question, answer });
  const finish = async (skipped) => {
    if (saving) return;
    setSaving(true);
    trackFunnel(skipped ? "survey_skipped" : "survey_completed", skipped ? { atStep: step } : {});
    const { error } = await supabase.rpc("save_onboarding_survey", {
      p_goals: goals, p_experience: experience, p_heard_from: heardFrom, p_heard_creator: heardFrom === "tiktok_creator" ? creator.trim() || null : null,
      p_email_consent: consent, p_consent_text: consent ? EMAIL_CONSENT_TEXT : null, p_skipped: skipped,
    });
    if (error) console.error("survey not saved:", error.message); // the flow goes on: a lost answer must not stop anyone
    onDone({ goals, skipped });
  };

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
        <label className="mt-5 flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
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
