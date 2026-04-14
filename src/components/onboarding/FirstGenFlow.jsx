import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/* ─── Prompt builder ──────────────────────────────────────────────── */
function buildPrompt({ content_type, goal } = {}) {
  if (content_type === "product")
    return "luxury product photography, glass perfume bottle on dark marble surface, dramatic side lighting, ultra sharp focus, commercial grade quality, no text";
  if (content_type === "tiktok" || content_type === "shorts") {
    if (goal === "viral")
      return "cinematic portrait of a confident creator, dramatic studio lighting, dark moody background, ultra-realistic, 8K, scroll-stopping";
    if (goal === "money")
      return "luxury lifestyle aesthetic, MacBook and coffee on premium workspace, moody cinematic lighting, ultra-sharp detail";
    return "vibrant social media creator portrait, professional ring light, clean dark background, hyper realistic, 8K";
  }
  if (content_type === "images") {
    if (goal === "viral")
      return "stunning cyberpunk cityscape at night, neon reflections on wet street, cinematic wideshot, ultra detailed, 8K";
    return "ethereal fantasy landscape, glowing magical forest, volumetric golden light rays, ultra detailed, dreamlike, cinematic";
  }
  return "cinematic portrait, dramatic studio lighting, ultra realistic, stunning composition, deep shadows, 8K";
}

/* ─── Step order ──────────────────────────────────────────────────── */
// "generating" = overlay gone, waiting for image-done, button pulses
const STEPS = ["nav-spotlight", "prompt-tip", "model-tip", "generate-tip", "generating", "celebrate", "done"];

/* ─── Poll until element exists, then track rect ─────────────────── */
function useElementRect(attr) {
  const [rect, setRect] = useState(null);
  useEffect(() => {
    if (!attr) return;
    let raf;
    const measure = () => {
      const el = document.querySelector(`[data-ftg="${attr}"]`);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        raf = requestAnimationFrame(measure);
      }
    };
    measure();
    const onResize = () => {
      const el = document.querySelector(`[data-ftg="${attr}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [attr]);
  return rect;
}

/* ─── Global CSS injected while tour is active ────────────────────── */
const STYLE_ID = "ftg-global-style";
function injectStyle(css) {
  let el = document.getElementById(STYLE_ID);
  if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
  el.textContent = css;
}
function removeStyle() { document.getElementById(STYLE_ID)?.remove(); }

/* ─── Confetti ────────────────────────────────────────────────────── */
function Confetti() {
  const COLORS = ["#7A3BFF", "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#FF6FC8", "#FF9E4F"];
  const particles = useRef(
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      color: COLORS[i % COLORS.length],
      left: `${Math.random() * 100}%`,
      delay: `${(Math.random() * 1.4).toFixed(2)}s`,
      dur: `${(1.6 + Math.random() * 1.6).toFixed(2)}s`,
      size: `${Math.round(6 + Math.random() * 8)}px`,
      rot: `${Math.round(Math.random() * 360)}deg`,
      isCircle: Math.random() > 0.5,
    }))
  ).current;
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10002 }}>
      <style>{`@keyframes ftg-fall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}`}</style>
      {particles.map((p) => (
        <div key={p.id} style={{
          position: "absolute", top: 0, left: p.left,
          width: p.size, height: p.size, background: p.color,
          borderRadius: p.isCircle ? "50%" : "2px",
          transform: `rotate(${p.rot})`,
          animation: `ftg-fall ${p.dur} ${p.delay} ease-in forwards`,
        }} />
      ))}
    </div>
  );
}

/* ═══ NAV SPOTLIGHT ═══════════════════════════════════════════════ */
function NavSpotlight({ isMobile, skip }) {
  const navRect = useElementRect("image-nav");

  // Wait until we have the rect so we can anchor precisely
  if (!navRect) return (
    <motion.div key="nav-spotlight-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="fixed inset-0" style={{ zIndex: 130, background: "rgba(0,0,0,0.84)", pointerEvents: "none" }}>
      <button onClick={skip} style={{ pointerEvents: "auto" }}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition">
        <X size={13} /> Skip tour
      </button>
    </motion.div>
  );

  // Position of the label+arrow relative to the Image button
  const GAP = 16; // px between arrow tip and element

  let instructionStyle = {};
  let arrowEl = null;

  if (!isMobile) {
    // Desktop: instruction card sits to the RIGHT of the sidebar element
    const cardLeft = navRect.right + GAP + 40; // 40 = arrow width
    const cardTop  = navRect.top + navRect.height / 2;
    instructionStyle = {
      position: "fixed",
      left: cardLeft,
      top: cardTop,
      transform: "translateY(-50%)",
      zIndex: 132,
      pointerEvents: "none",
    };
    // Arrow SVG: drawn from card-left pointing LEFT to element right edge
    arrowEl = (
      <svg style={{
        position: "fixed",
        left: navRect.right + GAP,
        top: cardTop - 10,
        zIndex: 132,
        pointerEvents: "none",
      }} width="44" height="20" viewBox="0 0 44 20" fill="none">
        <path d="M42 10 C30 10 12 10 4 10" stroke="#7A3BFF" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M8 5 L2 10 L8 15" stroke="#7A3BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  } else {
    // Mobile: instruction card sits ABOVE the element, centred on it
    const cardCenterX = navRect.left + navRect.width / 2;
    const cardBottom  = window.innerHeight - navRect.top + GAP + 44; // 44 = arrow height
    instructionStyle = {
      position: "fixed",
      left: cardCenterX,
      bottom: cardBottom,
      transform: "translateX(-50%)",
      zIndex: 132,
      pointerEvents: "none",
      textAlign: "center",
    };
    // Arrow SVG: pointing DOWN toward the element
    arrowEl = (
      <svg style={{
        position: "fixed",
        left: cardCenterX - 14,
        bottom: window.innerHeight - navRect.top + GAP,
        zIndex: 132,
        pointerEvents: "none",
      }} width="28" height="40" viewBox="0 0 28 40" fill="none">
        <path d="M14 4 C14 4 14 26 14 32" stroke="#7A3BFF" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M6 28 L14 36 L22 28" stroke="#7A3BFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }

  return (
    <motion.div key="nav-spotlight" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
      className="fixed inset-0" style={{ zIndex: 130, background: "rgba(0,0,0,0.84)", pointerEvents: "auto" }}>

      {/* Skip */}
      <button onClick={skip}
        className="absolute top-5 right-5 flex items-center gap-1.5 text-white/30 hover:text-white/60 text-xs transition"
        style={{ zIndex: 133 }}>
        <X size={13} /> Skip tour
      </button>

      {/* Instruction text — anchored to the element */}
      <div style={instructionStyle}>
        <p style={{ color: "#fff", fontWeight: 800, fontSize: isMobile ? 20 : 18, margin: 0, lineHeight: 1.2, whiteSpace: "nowrap" }}>
          Create your first image
        </p>
        <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, margin: "5px 0 0", whiteSpace: "nowrap" }}>
          {isMobile ? 'Tap "Image" in the menu below' : 'Click "Image" in the sidebar'}
        </p>
      </div>

      {/* Anchored arrow */}
      {arrowEl}
    </motion.div>
  );
}

/* ═══ TOOLTIP OVERLAY + CARD ═══════════════════════════════════════ */
const TOOLTIP_MAP = {
  "prompt-tip": {
    attr: "prompt",
    title: "Type your prompt here",
    body: "Describe exactly what you want — lighting, mood, style, subject. The more specific, the better the result.",
    cta: "Got it →",
  },
  "model-tip": {
    attr: "model",
    title: "Switch your AI model",
    body: "Each model has a unique style. Upgrade your plan to unlock premium models with sharper, faster results.",
    cta: "Next →",
  },
  "generate-tip": {
    attr: "generate",
    title: "Hit Generate!",
    body: "Everything's ready. Hit Generate and watch your image come to life.",
    cta: "Let's go! 🔥",
    pulse: true,
  },
};

const TIP_W    = 252;
const TIP_GAP  = 14;
const BOT_NAV  = 80; // mobile bottom nav height + safe area buffer

function TooltipStep({ step, advance, skip }) {
  const cfg  = TOOLTIP_MAP[step];
  const rect = useElementRect(cfg?.attr);

  if (!cfg || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Try right of element first, then below, then above
  let tipStyle = {};

  const fitsRight   = rect.right + TIP_GAP + TIP_W < vw - 8;
  const fitsBelow   = rect.bottom + TIP_GAP + 160  < vh - BOT_NAV;
  const fitsAbove   = rect.top   - TIP_GAP - 160   > 60;

  if (fitsRight) {
    tipStyle = {
      top:       rect.top + rect.height / 2,
      left:      rect.right + TIP_GAP,
      transform: "translateY(-50%)",
    };
  } else if (fitsBelow) {
    tipStyle = {
      top:       rect.bottom + TIP_GAP,
      left:      Math.min(Math.max(rect.left, 8), vw - TIP_W - 8),
    };
  } else {
    // Above — safe on mobile when generate button is near bottom nav
    tipStyle = {
      bottom:    vh - rect.top + TIP_GAP,
      left:      Math.min(Math.max(rect.left + rect.width / 2 - TIP_W / 2, 8), vw - TIP_W - 8),
    };
  }

  return createPortal(
    <>
      {/* Dark overlay — blocks all interaction except tooltip */}
      <motion.div
        key={`${step}-overlay`}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{
          position: "fixed", inset: 0, zIndex: 9995,
          background: "rgba(0,0,0,0.82)",
          backdropFilter: "blur(3px)",
          pointerEvents: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      />

      {/* Floating tooltip card */}
      <motion.div
        key={`${step}-tip`}
        initial={{ opacity: 0, scale: 0.88, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "fixed",
          ...tipStyle,
          zIndex: 9997,
          width: TIP_W,
          background: "linear-gradient(145deg,#0D0620,#1A0533)",
          border: "1px solid rgba(122,59,255,0.4)",
          boxShadow: "0 0 0 1px rgba(122,59,255,0.1), 0 24px 60px rgba(0,0,0,0.9)",
          borderRadius: 16,
          overflow: "hidden",
          pointerEvents: "auto",
        }}
      >
        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#7A3BFF,transparent)" }} />
        <div style={{ padding: "16px 16px 14px" }}>
          <p style={{ margin: "0 0 6px", color: "#fff", fontWeight: 700, fontSize: 14 }}>{cfg.title}</p>
          <p style={{ margin: "0 0 14px", color: "rgba(255,255,255,0.55)", fontSize: 12, lineHeight: 1.55 }}>{cfg.body}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={skip}
              style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, background: "none", border: "none", cursor: "pointer" }}>
              Skip
            </button>
            <button onClick={advance}
              style={{
                padding: "7px 14px", borderRadius: 9,
                background: "linear-gradient(135deg,#7A3BFF,#9D6BFF)",
                color: "#fff", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
              }}>
              {cfg.cta}
            </button>
          </div>
        </div>
      </motion.div>
    </>,
    document.body
  );
}

/* ═══ CELEBRATE ═══════════════════════════════════════════════════ */
function Celebrate({ onDone }) {
  return (
    <>
      <Confetti />
      <motion.div key="celebrate" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center px-6"
        style={{ zIndex: 10001, background: "rgba(0,0,0,0.78)", backdropFilter: "blur(8px)" }}>
        <motion.div initial={{ scale: 0.65, y: 40 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 20 }} className="text-center max-w-xs">
          <motion.div animate={{ scale: [1, 1.2, 0.95, 1.1, 1], rotate: [0, -8, 8, -4, 0] }}
            transition={{ duration: 0.9, delay: 0.15 }}
            style={{ fontSize: 72, marginBottom: 20, display: "inline-block" }}>🔥</motion.div>
          <motion.h2 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ color: "#fff", fontSize: 32, fontWeight: 800, lineHeight: 1.15, marginBottom: 10,
              textShadow: "0 0 40px rgba(122,59,255,0.9)" }}>
            First image done!
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 15, marginBottom: 28 }}>
            You&apos;re officially a Zyvo creator 🚀
          </motion.p>
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={onDone}
            style={{
              padding: "14px 36px", borderRadius: 16,
              background: "linear-gradient(135deg,#7A3BFF,#9D6BFF)",
              boxShadow: "0 8px 32px rgba(122,59,255,0.55)",
              color: "#fff", fontWeight: 700, fontSize: 15, border: "none", cursor: "pointer",
            }}>
            Keep creating →
          </motion.button>
        </motion.div>
      </motion.div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN ORCHESTRATOR
═══════════════════════════════════════════════════════════════════ */
export default function FirstGenFlow() {
  const [step, setStep]                 = useState("idle");
  const [isMobile, setIsMobile]         = useState(() => window.innerWidth < 1024);
  const location    = useLocation();
  const navigate    = useNavigate();
  const timerRef    = useRef(null);
  const celebFiredRef = useRef(false);

  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  /* ── fetch onboarding data + start ── */
  const startTour = useCallback(async () => {
    const { data: auth } = await supabase.auth.getSession();
    const uid = auth?.session?.user?.id;
    if (!uid) return;

    const { data } = await supabase
      .from("user_onboarding")
      .select("content_type, goal, experience")
      .eq("user_id", uid)
      .single();

    // Store prefilled prompt so Image.jsx can read it on mount
    sessionStorage.setItem("zyvo_ftg_prompt", buildPrompt(data || {}));

    celebFiredRef.current = false;
    setStep("nav-spotlight");
  }, []);

  /* ── listen for WelcomeModal signal ── */
  useEffect(() => {
    const handler = () => startTour();
    window.addEventListener("zyvo:ftg:start", handler);
    if (localStorage.getItem("zyvo_ftg_start") === "1") {
      localStorage.removeItem("zyvo_ftg_start");
      startTour();
    }
    return () => window.removeEventListener("zyvo:ftg:start", handler);
  }, [startTour]);

  /* ── nav-spotlight → prompt-tip when user navigates to image-generator ── */
  useEffect(() => {
    if (step !== "nav-spotlight") return;
    if (location.pathname !== "/workspace/image-generator") return;
    const t = setTimeout(() => setStep("prompt-tip"), 480);
    return () => clearTimeout(t);
  }, [step, location.pathname]);

  /* ── listen for first image done ── */
  useEffect(() => {
    const handler = () => {
      if (celebFiredRef.current) return;
      if (!["prompt-tip", "model-tip", "generate-tip", "generating"].includes(step)) return;
      celebFiredRef.current = true;
      setStep("celebrate");
      timerRef.current = setTimeout(() => setStep("done"), 7500);
    };
    window.addEventListener("zyvo:ftg:image-done", handler);
    return () => window.removeEventListener("zyvo:ftg:image-done", handler);
  }, [step]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  /* ── inject/remove global CSS per step ── */
  useEffect(() => {
    if (step === "idle" || step === "done") { removeStyle(); return; }

    // Map step → which element to glow
    const attrMap = {
      "prompt-tip":   "prompt",
      "model-tip":    "model",
      "generate-tip": "generate",
      "generating":   "generate",
    };
    const activeAttr = attrMap[step];

    const navSpotlightCSS = step === "nav-spotlight" ? `
      /* Elevate nav containers above overlay */
      aside { z-index: 131 !important; }
      .ftg-bottom-nav { z-index: 131 !important; }
      /* Dim all nav items except Image */
      .ftg-nav-item:not([data-ftg="image-nav"]) {
        opacity: 0.1 !important;
        pointer-events: none !important;
      }
      /* Glow + pulse on Image nav item */
      [data-ftg="image-nav"] {
        position: relative !important;
        z-index: 132 !important;
        pointer-events: auto !important;
        border-radius: 12px !important;
        box-shadow: 0 0 0 2px rgba(122,59,255,0.95), 0 0 28px rgba(122,59,255,0.6) !important;
        animation: ftg-nav-pulse 1.8s ease-in-out infinite !important;
      }
      @keyframes ftg-nav-pulse {
        0%,100% { box-shadow: 0 0 0 2px rgba(122,59,255,0.9), 0 0 28px rgba(122,59,255,0.55); }
        50%      { box-shadow: 0 0 0 4px rgba(122,59,255,0.7), 0 0 50px rgba(122,59,255,0.8); }
      }` : "";

    const tooltipHighlightCSS = activeAttr ? `
      /* Elevate highlighted element above tooltip overlay (z-9995) */
      [data-ftg="${activeAttr}"] {
        position: relative !important;
        z-index: 9996 !important;
        border-radius: 14px !important;
        box-shadow: 0 0 0 2px rgba(122,59,255,0.9), 0 0 28px rgba(122,59,255,0.4) !important;
        ${step === "generate-tip" || step === "generating" ? `
          animation: ftg-elem-pulse 1.5s ease-in-out infinite !important;
        ` : ""}
      }
      @keyframes ftg-elem-pulse {
        0%,100% { box-shadow: 0 0 0 2px rgba(122,59,255,0.9), 0 0 28px rgba(122,59,255,0.4); }
        50%      { box-shadow: 0 0 0 4px rgba(122,59,255,0.7), 0 0 48px rgba(122,59,255,0.65); }
      }` : "";

    injectStyle(navSpotlightCSS + tooltipHighlightCSS);
  }, [step]);

  /* ── advance ── */
  const advance = () => {
    setStep((s) => {
      const i = STEPS.indexOf(s);
      // generate-tip → "generating": remove overlay, let user click Generate
      if (s === "generate-tip") return "generating";
      return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : "done";
    });
  };

  const skip = () => {
    setStep("done");
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  if (step === "idle" || step === "done") return null;

  return createPortal(
    <AnimatePresence mode="wait">
      {step === "nav-spotlight" && (
        <NavSpotlight key="nav-spotlight" isMobile={isMobile} skip={skip} />
      )}

      {["prompt-tip", "model-tip", "generate-tip"].includes(step) && (
        <TooltipStep key={step} step={step} advance={advance} skip={skip} />
      )}

      {/* "generating": no UI — just waiting for image-done, button pulses via CSS */}

      {step === "celebrate" && (
        <Celebrate key="celebrate" onDone={() => setStep("done")} />
      )}
    </AnimatePresence>,
    document.body
  );
}
