import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WandSparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient";
import AuthModal from "../AuthModal.jsx";
import { saveSeoDraft } from "../../lib/seoDraft.js";
import { trackSeoEvent } from "../../lib/seoAnalytics.js";

const WORKSPACE_ROUTE_BY_TEMPLATE = { "two-am": "/workspace/two-am" };

/**
 * The interactive prompt bar + guest/logged-in generation flow. Never calls
 * the real generation backend — it only captures a prompt, persists a draft,
 * and hands the visitor into the real, existing /workspace/two-am generator
 * (via AuthModal, reused unmodified, for guests).
 */
export default function SeoGeneratorHero({ config, prompt, onPromptChange, variant = "hero", id }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [phase, setPhase] = useState("idle"); // idle | preparing | gate
  const [authModalMode, setAuthModalMode] = useState(null);
  const [validationError, setValidationError] = useState("");
  const interactedRef = useRef(false);
  const timerRef = useRef(null);

  const targetRoute = WORKSPACE_ROUTE_BY_TEMPLATE[config.templateId] || "/workspace/home";

  useEffect(() => () => clearTimeout(timerRef.current), []);

  // AuthModal calls onClose() both on a real successful sign-in/sign-up AND
  // when the visitor just dismisses it (same callback either way) — and it
  // fires synchronously right after supabase.auth resolves, before this
  // component's own `user` (from AuthContext) is guaranteed to have updated
  // yet. So we check the live Supabase session directly here rather than
  // reacting to `user`, to avoid a race that would silently drop the
  // hand-off into the real generator.
  const handleAuthModalClose = async () => {
    setAuthModalMode(null);
    const { data } = await supabase.auth.getSession();
    if (data?.session) {
      trackSeoEvent("seo_generator_opened", {
        originalLandingPage: config.slug,
        templateId: config.templateId,
        authenticated: true,
      });
      navigate(targetRoute);
    }
  };

  const handleChange = (event) => {
    if (!interactedRef.current) {
      interactedRef.current = true;
      trackSeoEvent("seo_prompt_interaction", { slug: config.slug, templateId: config.templateId });
    }
    onPromptChange(event.target.value);
  };

  const submit = () => {
    if (!prompt.trim()) {
      setValidationError("Enter a world, character, series or idea.");
      return;
    }
    setValidationError("");
    trackSeoEvent("seo_generate_clicked", { slug: config.slug, templateId: config.templateId, authenticated: !!user });
    saveSeoDraft({ templateId: config.templateId, prompt: prompt.trim(), source: config.slug });

    if (user) {
      navigate(targetRoute);
      return;
    }

    setPhase("preparing");
    timerRef.current = setTimeout(() => {
      setPhase("gate");
      trackSeoEvent("seo_auth_gate_viewed", { slug: config.slug, templateId: config.templateId });
    }, 1400);
  };

  const isCompact = variant === "compact";

  return (
    <section
      id={id}
      className={`relative overflow-hidden rounded-2xl border border-lime-300/[0.13] bg-[#0C0F0D] shadow-[inset_0_1px_0_rgba(190,242,100,.05)] ${
        isCompact ? "p-5 sm:p-6" : "p-5 sm:p-8"
      }`}
    >
      <div className="pointer-events-none absolute -left-24 top-12 h-56 w-56 rounded-full bg-lime-300/[0.055] blur-[70px]" />
      <div className="pointer-events-none absolute -right-24 bottom-16 h-52 w-52 rounded-full bg-lime-500/[0.045] blur-[72px]" />

      {phase !== "gate" ? (
        <div className="relative">
          {!isCompact && config.hero?.eyebrow && (
            <span className="mb-3 inline-flex rounded-full border border-lime-300/25 bg-lime-300/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-lime-300">
              {config.hero.eyebrow}
            </span>
          )}
          {!isCompact && (
            <>
              <h1 className="text-[32px] font-black leading-[1.05] tracking-[-0.03em] text-white sm:text-[44px]">
                {config.hero.heading}
              </h1>
              <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-white/50 sm:text-[16px]">
                {config.hero.description}
              </p>
            </>
          )}
          {isCompact && (
            <h2 className="text-[24px] font-black tracking-[-0.02em] text-white">Ready to Enter Your 2AM World?</h2>
          )}

          <div className={isCompact ? "mt-5" : "mt-8"}>
            <label htmlFor={`${id || "seo"}-prompt`} className="sr-only">
              Describe your 2AM world
            </label>
            <div className="relative">
              <input
                id={`${id || "seo"}-prompt`}
                value={prompt}
                maxLength={240}
                disabled={phase === "preparing"}
                onChange={handleChange}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submit();
                }}
                placeholder={config.hero?.promptPlaceholder || "Enter a world, character or idea..."}
                className="w-full rounded-2xl border border-lime-300/[0.14] bg-[#080B09]/90 px-4 py-4 pr-12 text-[15px] font-medium text-white outline-none transition placeholder:text-white/25 focus:border-lime-300/55 focus:ring-2 focus:ring-lime-300/10 disabled:opacity-60"
              />
              <WandSparkles className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-lime-300" />
            </div>
            {validationError && <p className="mt-2 text-[12px] font-semibold text-red-400">{validationError}</p>}

            <button
              type="button"
              disabled={phase === "preparing"}
              onClick={submit}
              className="group relative mt-3 flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl border border-lime-400/20 bg-gradient-to-r from-lime-300/[0.10] to-lime-500/[0.07] py-3.5 text-[14px] font-black text-white transition hover:border-lime-400/35 hover:from-lime-300/[0.14] hover:to-lime-500/[0.10] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-8"
            >
              {phase === "preparing" ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-lime-300" />
                  Preparing your 2AM world...
                </>
              ) : (
                <>{isCompact ? "Create My 2AM World" : "Generate My 2AM World"}</>
              )}
            </button>
          </div>

          {phase === "preparing" && (
            <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-[9/16] animate-pulse rounded-xl border border-white/[0.06] bg-white/[0.04]"
                  style={{ animationDelay: `${index * 90}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-4 text-center">
          <div className="grid w-full max-w-[420px] grid-cols-3 gap-2 opacity-60">
            {(config.assets?.previews || []).slice(0, 3).map((src) => (
              <img key={src} src={src} alt="" className="aspect-[9/16] w-full rounded-lg object-cover" loading="lazy" />
            ))}
          </div>
          <h2 className="text-[20px] font-black text-white">Your 2AM world is ready to create</h2>
          <p className="max-w-[320px] text-[13px] leading-relaxed text-white/50">
            Sign up to generate the full set of 6 cinematic images.
          </p>
          <button
            type="button"
            onClick={() => setAuthModalMode("signup")}
            className="w-full max-w-[300px] rounded-xl bg-gradient-to-r from-[#7A3BFF] to-[#9F5CFF] py-3 text-[14px] font-bold text-white transition hover:opacity-90"
          >
            Create free account
          </button>
          <button
            type="button"
            onClick={() => setAuthModalMode("login")}
            className="text-[12px] font-medium text-white/40 transition hover:text-white/70"
          >
            Already have an account? Log in
          </button>
          <p className="text-[11px] text-white/25">Your prompt will be waiting for you.</p>
        </div>
      )}

      {authModalMode && <AuthModal mode={authModalMode} onClose={handleAuthModalClose} />}
    </section>
  );
}
