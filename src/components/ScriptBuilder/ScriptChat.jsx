import { useState, useEffect, useRef } from "react";
import { generateScript, SCRIPT_CREDIT_COST } from "../../lib/generateScript";
import GenerateButton from "../ImageGenerator/GenerateButton";
import DurationSlider from "./DurationSlider";

const TONES = [
  { label: "🔥 High Energy & Hype", value: "High Energy & Hype" },
  { label: "😎 Casual & Chill", value: "Casual & Chill" },
  { label: "🧠 Smart & Educational", value: "Smart & Educational" },
  { label: "😂 Funny & Sarcastic", value: "Funny & Sarcastic" },
  { label: "💪 Motivational", value: "Motivational" },
  { label: "🎯 Direct & Punchy", value: "Direct & Punchy" },
];

const AUDIENCES = [
  "Gen Z (13–25)",
  "Millennials (26–40)",
  "Adults (35–55)",
  "General Audience",
  "Business / Professionals",
  "Niche / Enthusiasts",
];

const CTA_OPTIONS = [
  { label: "🤖 Auto — AI picks the best", value: "🤖 Auto-generate best CTA" },
  { label: "Follow / Subscribe", value: "Follow / Subscribe" },
  { label: "Comment with an emoji", value: "Comment with an emoji" },
  { label: "Check link in bio", value: "Check link in bio" },
  { label: "Save for later", value: "Save for later" },
  { label: "✍️ I'll write my own", value: "✍️ I'll type my own" },
];

const SCENE_OPTIONS = [
  { label: "3 scenes", sub: "Tight & punchy — great for short-form", value: 3 },
  { label: "5 scenes", sub: "Best balance — works for any length", value: 5 },
  { label: "7 scenes", sub: "Detailed — ideal for 2–5 min videos", value: 7 },
  { label: "10 scenes", sub: "Full breakdown — 5–10 min content", value: 10 },
  { label: "15 scenes", sub: "Deep dive — long-form YouTube", value: 15 },
  { label: "20 scenes", sub: "Complete guide — 15–20 min videos", value: 20 },
  { label: "🤖 AI decides", sub: "Auto-optimised for your duration", value: "auto" },
];

const LOADING_PHASES = [
  "Analyzing your brief…",
  "Engineering the hook…",
  "Writing your scenes…",
  "Polishing the CTA…",
  "Final touches…",
];

// ─── Card / surface shared styles ────────────────────────────────────────────
const CARD = "bg-white/[0.04] border border-white/[0.07] rounded-2xl";
const INPUT = "w-full bg-white/[0.04] border border-white/[0.07] focus:border-[#7A3BFF]/50 outline-none transition-colors rounded-xl text-white placeholder:text-white/20";

// ─── Sub-components (module-level to avoid re-mount on typing) ───────────────

function Bot({ children }) {
  return (
    <div className="flex items-start gap-3 animate-fadeIn">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7A3BFF] to-[#5A2BD4] flex items-center justify-center text-sm shrink-0 shadow-lg shadow-purple-900/30 border border-white/[0.06]">
        🤖
      </div>
      <div className={`${CARD} px-4 py-3 text-white text-sm max-w-[88%] leading-relaxed`}>
        {children}
      </div>
    </div>
  );
}

function Me({ children }) {
  return (
    <div className="flex justify-end animate-fadeIn">
      <div className="bg-[#1E1245]/80 border border-[#7A3BFF]/25 px-4 py-2.5 rounded-2xl rounded-tr-sm text-white/80 text-sm max-w-[78%] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Opt({ label, sub, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3.5 py-3 rounded-xl text-sm transition-all duration-150 border border-white/[0.07] bg-white/[0.03] hover:border-[#7A3BFF]/40 hover:bg-[#7A3BFF]/[0.07] text-white/70 hover:text-white flex items-center justify-between gap-3 group"
    >
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="leading-snug font-medium">{label}</span>
        {sub && <span className="text-[11px] text-white/25 font-normal">{sub}</span>}
      </span>
      <span className="text-white/15 group-hover:text-[#9B6DFF] text-xs transition-colors shrink-0">→</span>
    </button>
  );
}

function BackBtn({ stepHistory, onBack }) {
  if (stepHistory.length === 0) return null;
  return (
    <button onClick={onBack} className="self-start flex items-center gap-1.5 text-white/20 hover:text-white/50 text-xs transition-colors">
      ← back
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function ScriptChat({ stylePreset, onGenerate }) {
  const isCustom = stylePreset?.id === "custom";
  const d = stylePreset?.defaults || {};

  const [step, setStep] = useState(0);
  const [stepHistory, setStepHistory] = useState([]);
  const [form, setForm] = useState({
    type: d.type || "",
    platform: d.platform || "",
    style: d.style || "",
    tone: d.tone || "",
    audience: d.audience || "",
    length: "",
    sceneCount: "",
    idea: "",
    niche: "",
    cta: "",
    customCta: "",
    customPlatform: "",
    customTone: "",
  });
  const [durationSecs, setDurationSecs] = useState(60);
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [error, setError] = useState(null);
  const [customToneActive, setCustomToneActive] = useState(false);
  const [customCtaActive, setCustomCtaActive] = useState(false);
  const chatRef = useRef(null);
  const loadingInterval = useRef(null);

  useEffect(() => {
    const el = chatRef.current?.parentElement;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [step, loading]);

  useEffect(() => {
    if (loading) {
      setLoadingPhase(0);
      loadingInterval.current = setInterval(() => {
        setLoadingPhase((p) => Math.min(p + 1, LOADING_PHASES.length - 1));
      }, 2200);
    } else {
      clearInterval(loadingInterval.current);
    }
    return () => clearInterval(loadingInterval.current);
  }, [loading]);

  const next = () => { setStepHistory((h) => [...h, step]); setStep((s) => s + 1); };
  const goBack = () => {
    const prev = stepHistory[stepHistory.length - 1];
    if (prev === undefined) return;
    setStep(prev);
    setStepHistory((h) => h.slice(0, -1));
  };
  const pick = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setTimeout(next, 200);
  };

  const handleGenerate = async () => {
    if (!form.idea.trim()) return;
    setError(null);
    const finalForm = {
      ...form,
      tone: customToneActive ? form.customTone : form.tone,
      cta: form.cta === "🤖 Auto-generate best CTA" ? "" : customCtaActive ? form.customCta : form.cta,
    };
    setLoading(true);
    try {
      const script = await generateScript(finalForm, stylePreset);
      onGenerate(finalForm, script);
    } catch (err) {
      const msg = err.message || "";
      if (msg === "INSUFFICIENT_CREDITS") {
        setError("Not enough credits. Top up in Settings → Billing.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step map:
  //   Custom:  0=type 1=platform 2=duration 3=scenes 4=style 5=tone 6=audience 7=idea 8=cta 9=generate
  //   Presets: 0=summary 1=duration 2=scenes 3=tone 4=audience 5=idea 6=cta 7=generate
  const C = isCustom; // shorthand
  const s = {
    // custom steps
    c_type: 0, c_platform: 1, c_duration: 2, c_scenes: 3, c_style: 4,
    c_tone: 5, c_audience: 6, c_idea: 7, c_cta: 8, c_generate: 9,
    // preset steps
    p_summary: 0, p_duration: 1, p_scenes: 2, p_tone: 3,
    p_audience: 4, p_idea: 5, p_cta: 6, p_generate: 7,
  };
  const STEP_COUNT = C ? 10 : 8;
  const progressPct = Math.round((step / (STEP_COUNT - 1)) * 100);

  const durStep  = C ? s.c_duration  : s.p_duration;
  const scnStep  = C ? s.c_scenes    : s.p_scenes;
  const tonStep  = C ? s.c_tone      : s.p_tone;
  const audStep  = C ? s.c_audience  : s.p_audience;
  const ideaStep = C ? s.c_idea      : s.p_idea;
  const ctaStep  = C ? s.c_cta       : s.p_cta;
  const genStep  = C ? s.c_generate  : s.p_generate;

  const effectivePlatform = form.platform || d.platform || "";
  const effectiveTone     = (customToneActive ? form.customTone : form.tone) || d.tone || "";
  const effectiveAudience = form.audience || d.audience || "";
  const effectiveStyle    = form.style || d.style || "";
  const sceneLabel        = form.sceneCount === "auto" ? "AI decides" : form.sceneCount ? `${form.sceneCount} scenes` : "";

  return (
    <div ref={chatRef} className="flex flex-col gap-4">

      {/* ── Progress ──────────────────────────────────────────────────────────── */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-white/20">
          <span>Step {step + 1} of {STEP_COUNT}</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-[2px] w-full rounded-full bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%`, background: "linear-gradient(90deg,#7A3BFF,#A855F7)" }}
          />
        </div>
      </div>

      {/* ── PRESET: Summary card ─────────────────────────────────────────────── */}
      {!C && step >= 0 && (
        <div className={`${CARD} p-4 space-y-3 animate-fadeIn`}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center text-xl border border-white/[0.06]"
              style={{ background: `${stylePreset.accentColor}12` }}>
              {stylePreset.icon}
            </div>
            <div>
              <div className="text-white font-bold text-sm">{stylePreset.name}</div>
              <div className="text-white/30 text-xs mt-0.5">{stylePreset.tagline}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-2.5 border-t border-white/[0.06]">
            {[d.platform, d.type, d.style, d.tone].filter(Boolean).map((tag, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.05] text-white/35 border border-white/[0.06]">{tag}</span>
            ))}
          </div>
        </div>
      )}
      {!C && step === 0 && (
        <button onClick={next}
          className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm hover:opacity-90 active:scale-[0.99] transition-all animate-pulse-glow"
          style={{ background: "linear-gradient(135deg,#7A3BFF,#5A2BD4)" }}>
          Start Building →
        </button>
      )}

      {/* ── CUSTOM: Type ─────────────────────────────────────────────────────── */}
      {C && step >= 0 && (
        <Bot>
          <span className="font-medium">Let's build something people can't scroll past.</span>
          <span className="block text-white/35 text-xs mt-1">What are we creating?</span>
        </Bot>
      )}
      {C && step === 0 && (
        <div className="space-y-2 animate-fadeIn">
          <Opt label="🔥 Viral Hook" sub="Just the opening — max attention grab" onClick={() => pick("type", "Viral Hook")} />
          <Opt label="🎬 Full Script" sub="Complete video from hook to CTA" onClick={() => pick("type", "Full Script")} />
          <Opt label="🧠 Hook + Script Combo" sub="Hook variants + full script" onClick={() => pick("type", "Hook + Script Combo")} />
        </div>
      )}
      {C && form.type && step > 0 && <Me>{form.type}</Me>}

      {/* ── CUSTOM: Platform ─────────────────────────────────────────────────── */}
      {C && step >= 1 && (
        <>
          {step === 1 && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>Where will this be posted?</Bot>
        </>
      )}
      {C && step === 1 && (
        <div className="space-y-2 animate-fadeIn">
          {["TikTok", "Instagram Reels", "YouTube Shorts", "YouTube Long"].map((p) => (
            <Opt key={p} label={p} onClick={() => pick("platform", p)} />
          ))}
          <Opt label="Other" onClick={() => setForm((f) => ({ ...f, platform: "other" }))} />
          {form.platform === "other" && (
            <div className="flex gap-2 mt-1">
              <input autoFocus type="text" placeholder="Platform name…" value={form.customPlatform}
                className={`${INPUT} px-3 py-2.5 text-sm flex-1`}
                onChange={(e) => setForm((f) => ({ ...f, customPlatform: e.target.value }))} />
              <button onClick={() => { if (!form.customPlatform.trim()) return; pick("platform", form.customPlatform.trim()); }}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ background: "#7A3BFF" }}>→</button>
            </div>
          )}
        </div>
      )}
      {C && form.platform && form.platform !== "other" && step > 1 && <Me>{form.platform}</Me>}
      {C && form.platform === "other" && form.customPlatform && step > 1 && <Me>{form.customPlatform}</Me>}

      {/* ── Duration ─────────────────────────────────────────────────────────── */}
      {step >= durStep && (
        <>
          {step === durStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            How long is the video?
            <span className="block text-white/30 text-xs mt-0.5">Drag to set the duration.</span>
          </Bot>
        </>
      )}
      {step === durStep && (
        <div className={`animate-fadeIn ${CARD} p-5 space-y-5`}>
          <DurationSlider value={durationSecs} onChange={setDurationSecs} sceneCount={form.sceneCount} />
          <button
            onClick={() => {
              const label = durationSecs < 60 ? `${durationSecs} seconds`
                : durationSecs % 60 === 0 ? `${durationSecs / 60} minutes`
                : `${Math.floor(durationSecs / 60)} min ${durationSecs % 60}s`;
              pick("length", label);
            }}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm hover:opacity-90 transition-opacity"
            style={{ background: "linear-gradient(135deg,#7A3BFF,#5A2BD4)" }}>
            Confirm →
          </button>
        </div>
      )}
      {form.length && step > durStep && <Me>{form.length}</Me>}

      {/* ── Scene count ──────────────────────────────────────────────────────── */}
      {step >= scnStep && (
        <>
          {step === scnStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            How many scenes?
            <span className="block text-white/30 text-xs mt-0.5">Each scene is a distinct beat — hook and CTA are always added.</span>
          </Bot>
        </>
      )}
      {step === scnStep && (
        <div className="space-y-2 animate-fadeIn">
          {SCENE_OPTIONS.map((o) => (
            <Opt key={o.value} label={o.label} sub={o.sub} onClick={() => pick("sceneCount", o.value)} />
          ))}
        </div>
      )}
      {form.sceneCount && step > scnStep && <Me>{sceneLabel}</Me>}

      {/* ── CUSTOM: Style ────────────────────────────────────────────────────── */}
      {C && step >= s.c_style && (
        <>
          {step === s.c_style && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>What viral blueprint should we follow?</Bot>
        </>
      )}
      {C && step === s.c_style && (
        <div className="space-y-2 animate-fadeIn">
          {[
            ["⚡ Curiosity Gap", "Curiosity Gap", "Create a question they need answered"],
            ["💀 Shock & Awe", "Shock", "Hit hard, hit fast, escalate stakes"],
            ["🎭 Storytelling", "Storytelling", "3-act arc with emotional peaks"],
            ["📊 Authority", "Authority", "Data-driven, builds trust"],
            ["🎲 AI Picks Best", "AI Choice", "Let the model choose"],
          ].map(([label, val, sub]) => (
            <Opt key={val} label={label} sub={sub} onClick={() => pick("style", val)} />
          ))}
        </div>
      )}
      {C && form.style && step > s.c_style && <Me>{form.style}</Me>}

      {/* ── Tone ─────────────────────────────────────────────────────────────── */}
      {step >= tonStep && (
        <>
          {step === tonStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            What's the tone of voice?
            {!C && d.tone && <span className="block text-white/25 text-xs mt-0.5">Preset default: <span className="text-white/45">{d.tone}</span></span>}
          </Bot>
        </>
      )}
      {step === tonStep && (
        <div className="space-y-2 animate-fadeIn">
          {!C && d.tone && <Opt label="✅ Keep preset default" sub={d.tone} onClick={() => pick("tone", d.tone)} />}
          {TONES.map((t) => <Opt key={t.value} label={t.label} onClick={() => pick("tone", t.value)} />)}
          <Opt label="✍️ Write my own tone" onClick={() => { setCustomToneActive(true); setForm((f) => ({ ...f, tone: "custom" })); }} />
          {customToneActive && (
            <div className="flex gap-2">
              <input autoFocus type="text" placeholder="e.g. Cynical, dry, no-BS…" value={form.customTone}
                className={`${INPUT} px-3 py-2.5 text-sm flex-1`}
                onChange={(e) => setForm((f) => ({ ...f, customTone: e.target.value }))}
                onKeyDown={(e) => { if (e.key === "Enter" && form.customTone.trim()) { pick("tone", form.customTone.trim()); setCustomToneActive(false); } }} />
              <button onClick={() => { if (!form.customTone.trim()) return; pick("tone", form.customTone.trim()); setCustomToneActive(false); }}
                className="px-4 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-80 transition-opacity"
                style={{ background: "#7A3BFF" }}>→</button>
            </div>
          )}
        </div>
      )}
      {form.tone && form.tone !== "custom" && step > tonStep && <Me>{form.tone}</Me>}

      {/* ── Audience ─────────────────────────────────────────────────────────── */}
      {step >= audStep && (
        <>
          {step === audStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            Who's watching this?
            {!C && d.audience && <span className="block text-white/25 text-xs mt-0.5">Preset default: <span className="text-white/45">{d.audience}</span></span>}
          </Bot>
        </>
      )}
      {step === audStep && (
        <div className="space-y-2 animate-fadeIn">
          {!C && d.audience && <Opt label="✅ Keep preset default" sub={d.audience} onClick={() => pick("audience", d.audience)} />}
          {AUDIENCES.map((a) => <Opt key={a} label={a} onClick={() => pick("audience", a)} />)}
        </div>
      )}
      {form.audience && step > audStep && <Me>{form.audience}</Me>}

      {/* ── Idea ─────────────────────────────────────────────────────────────── */}
      {step >= ideaStep && (
        <>
          {step === ideaStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            <span className="font-medium">What's this video about?</span>
            <span className="block text-white/30 text-xs mt-0.5">More detail = sharper script. Don't hold back.</span>
          </Bot>
        </>
      )}
      {step === ideaStep && (
        <div className="space-y-3 animate-fadeIn">
          <textarea autoFocus rows={4} value={form.idea}
            onFocus={(e) => e.target.scrollIntoView({ block: "nearest" })}
            placeholder="e.g. Why 90% of people fail at saving money — the psychology behind it and 3 habits that actually work…"
            className={`${INPUT} px-4 py-3.5 text-sm resize-none leading-relaxed`}
            onChange={(e) => setForm((f) => ({ ...f, idea: e.target.value }))} />
          {/* Niche — optional */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-white/20 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              Your Niche <span className="text-white/15 font-normal normal-case tracking-normal">— optional</span>
            </label>
            <input type="text" value={form.niche} placeholder="e.g. Finance, Gaming, Fitness, Tech…"
              className={`${INPUT} px-3.5 py-2.5 text-sm`}
              onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))} />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[10px] text-white/15">{form.idea.length} chars</span>
            <button disabled={!form.idea.trim()} onClick={next}
              className="px-5 py-2.5 rounded-xl text-white font-semibold text-sm hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              style={{ background: "linear-gradient(135deg,#7A3BFF,#5A2BD4)" }}>
              Next →
            </button>
          </div>
        </div>
      )}
      {form.idea && step > ideaStep && (
        <Me>{form.idea.length > 120 ? form.idea.slice(0, 120) + "…" : form.idea}</Me>
      )}

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      {step >= ctaStep && (
        <>
          {step === ctaStep && <BackBtn stepHistory={stepHistory} onBack={goBack} />}
          <Bot>
            How should it end?
            <span className="block text-white/30 text-xs mt-0.5">The call to action.</span>
          </Bot>
        </>
      )}
      {step === ctaStep && (
        <div className="space-y-2 animate-fadeIn">
          {CTA_OPTIONS.map((c) => (
            <Opt key={c.value} label={c.label} onClick={() => {
              if (c.value === "✍️ I'll type my own") { setCustomCtaActive(true); setForm((f) => ({ ...f, cta: "custom" })); }
              else { setCustomCtaActive(false); pick("cta", c.value); }
            }} />
          ))}
          {customCtaActive && (
            <div className="space-y-2">
              <textarea autoFocus rows={2} value={form.customCta} placeholder="Type your CTA line…"
                className={`${INPUT} px-3 py-3 text-sm resize-none`}
                onChange={(e) => setForm((f) => ({ ...f, customCta: e.target.value }))} />
              <button onClick={() => { if (!form.customCta.trim()) return; pick("cta", form.customCta.trim()); setCustomCtaActive(false); }}
                className="w-full py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                style={{ background: "linear-gradient(135deg,#7A3BFF,#5A2BD4)" }}>
                Use This CTA →
              </button>
            </div>
          )}
        </div>
      )}
      {form.cta && form.cta !== "custom" && step > ctaStep && <Me>{form.cta}</Me>}

      {/* ── Generate ─────────────────────────────────────────────────────────── */}
      {step >= genStep && (
        <div className="space-y-4 pb-6 animate-fadeIn">

          {/* Brief summary */}
          {!loading && (
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-[10px] font-bold tracking-[0.12em] text-white/25 uppercase">Your Brief</span>
              </div>
              <div className="px-4 py-3 space-y-2">
                {[
                  ["Platform", effectivePlatform],
                  ["Duration", form.length],
                  ["Scenes", sceneLabel],
                  ["Style", effectiveStyle || d.style],
                  ["Tone", effectiveTone],
                  ["Audience", effectiveAudience],
                  ["Niche", form.niche],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-white/20 text-xs w-16 shrink-0">{k}</span>
                    <span className="text-white/55 text-xs font-medium">{v}</span>
                  </div>
                ))}
                {form.idea && (
                  <div className="pt-2 mt-1 border-t border-white/[0.05]">
                    <span className="text-white/20 text-xs block mb-1">Idea</span>
                    <span className="text-white/45 text-xs leading-relaxed line-clamp-3">{form.idea}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-red-500/[0.07] border border-red-500/20 animate-fadeIn">
              <span className="text-red-400/80 text-sm shrink-0 mt-0.5">⚠</span>
              <div className="flex-1 min-w-0">
                <p className="text-red-400/90 text-xs font-semibold">Generation failed</p>
                <p className="text-red-400/60 text-xs mt-0.5 leading-relaxed">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-red-400/30 hover:text-red-400/70 text-xs transition-colors shrink-0">✕</button>
            </div>
          )}

          {/* CTA / Loading */}
          {!loading ? (
            <GenerateButton
              onClick={handleGenerate}
              disabled={!form.idea.trim()}
              isGenerating={false}
              estimatedCredits={SCRIPT_CREDIT_COST}
            />
          ) : (
            <div className={`${CARD} py-6 flex flex-col items-center gap-4`}>
              <div className="relative w-9 h-9">
                <svg className="animate-spin w-9 h-9" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="15" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  <path d="M 18 3 A 15 15 0 0 1 33 18" stroke="#7A3BFF" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <p key={loadingPhase} className="text-white/65 text-sm font-medium animate-fadeIn">
                  {LOADING_PHASES[loadingPhase]}
                </p>
                <p className="text-white/20 text-xs">gpt-4o-mini · Usually 4–6 seconds</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="h-1" />
    </div>
  );
}
