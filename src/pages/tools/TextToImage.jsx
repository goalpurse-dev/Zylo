// src/pages/tools/TextToImage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Image as ImageIcon, Monitor, Smartphone, Square, ChevronDown, Check } from "lucide-react";
import { createImageJobSimple } from "../../lib/jobs";
import { getProviderLink } from "../../lib/providers";

// v2
import ex1 from "../../assets/library/ex1.png";
import ex2 from "../../assets/library/ex2.png";
import ex3 from "../../assets/library/ex3.png";
import ex4 from "../../assets/library/ex4.png";
import ex5 from "../../assets/library/ex5.png";
import ex6 from "../../assets/library/ex6.png";
// v3
import v31 from "../../assets/library/v31.png";
import v32 from "../../assets/library/v32.png";
import v33 from "../../assets/library/v33.png";
import v34 from "../../assets/library/v34.png";
import v35 from "../../assets/library/v35.png";
import v36 from "../../assets/library/v36.png";
// v4
import v41 from "../../assets/library/v41.png";
import v42 from "../../assets/library/v42.png";
import v43 from "../../assets/library/v43.png";
import v44 from "../../assets/library/v44.png";
import v45 from "../../assets/library/v45.png";
import v46 from "../../assets/library/v46.png";

// Generations dock
import { useGenerations } from "../../components/GenerationsDock";

/* ────────────────────────────────────────────────────────────────────────── */
/*                               STATIC CONFIG                                */
/* ────────────────────────────────────────────────────────────────────────── */

const TIERS = [
  { id: "zylo-v2", label: "v2.0" },
  { id: "zylo-v3", label: "v3.0" },
  { id: "zylo-v4", label: "v4.0" },
];

const TIER_TIPS = {
  "zylo-v2": ["Fastest & cheapest", "Great for drafts & bulk gen", "Clean lighting; decent detail"],
  "zylo-v3": ["Higher fidelity & style control", "Better faces & text elements", "Solid for ads/product shots"],
  "zylo-v4": ["Flagship realism & detail", "Best for premium creatives", "Stable character/brand looks"],
};

const ASPECTS = [
  { id: "1:1",  label: "Square (1:1)",     size: "1024x1024" },
  { id: "16:9", label: "Landscape (16:9)", size: "1408x768"  },
  { id: "9:16", label: "Portrait (9:16)",  size: "768x1408"  },
];

const NEG =
  "text, letters, watermark, logo, caption, low-res, blurry, jpeg artifacts, extra fingers";

const toolKeyFromTier = (tier) =>
  tier === "zylo-v2" ? "t2i:v2" : tier === "zylo-v3" ? "t2i:v3" : "t2i:v4";

const iconForAspect = (id) =>
  id === "16:9" ? Monitor : id === "9:16" ? Smartphone : Square;

/* ────────────────────────────────────────────────────────────────────────── */
/*                                  HELPERS                                   */
/* ────────────────────────────────────────────────────────────────────────── */

function parseSize(size) {
  const m = (size || "").toLowerCase().match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/);
  if (!m) return [1024, 1024];
  return [parseInt(m[1], 10) || 1024, parseInt(m[2], 10) || 1024];
}
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                            MODERN DROPDOWN CORE                            */
/* ────────────────────────────────────────────────────────────────────────── */

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    function handler(e) {
      if (!ref.current || ref.current.contains(e.target)) return;
      onClose?.();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [ref, onClose]);
}

function Dropdown({ label, subtitle, badge, icon: Icon, children, className }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useOutsideClose(wrapRef, () => setOpen(false));

  return (
    <div ref={wrapRef} className={classNames("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={classNames(
          "group inline-flex items-center gap-3 rounded-xl px-3 py-2 w-full",
          "border border-white/15 bg-white/[.08] text-white/90",
          "backdrop-blur-md shadow-sm ring-1 ring-black/20",
          "hover:bg-white/[.12] transition"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 opacity-90" /> : null}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[13px] font-semibold">{label}</span>
          {subtitle ? (
            <span className="text-[11px] text-white/65">{subtitle}</span>
          ) : null}
        </div>
        {badge ? (
          <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold">
            {badge}
          </span>
        ) : (
          <span className="ml-auto" />
        )}
        <ChevronDown
          className={classNames(
            "h-4 w-4 ml-2 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className={classNames(
            "absolute z-30 mt-2 min-w-[260px] overflow-hidden",
            "rounded-2xl border border-white/10",
            "bg-[rgba(13,18,27,0.92)] backdrop-blur-xl",
            "shadow-2xl ring-1 ring-black/30"
          )}
          style={{
            boxShadow:
              "0 18px 50px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.03)",
          }}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}

function MenuItem({ active, title, meta, lines = [], Icon, onClick, rightBadge }) {
  return (
    <button
      role="option"
      onClick={onClick}
      className={classNames(
        "w-full text-left px-3 py-2.5 flex gap-3 items-start",
        "hover:bg-white/[.06] transition",
        active ? "bg-white/[.08]" : ""
      )}
    >
      <div className="mt-0.5">
        {Icon ? (
          <Icon className="h-4 w-4 opacity-90" />
        ) : (
          <div className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white/95">{title}</span>
          {rightBadge ? (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
              {rightBadge}
            </span>
          ) : null}
          {active ? (
            <Check className="h-4 w-4 text-white/80 ml-auto" />
          ) : null}
        </div>
        {meta ? (
          <div className="text-[11px] text-white/60">{meta}</div>
        ) : null}
        {lines.length > 0 ? (
          <ul className="mt-1 text-[11px] text-white/70 space-y-0.5 list-disc pl-4">
            {lines.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*                                 MAIN PAGE                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export default function TextToImage() {
  const navigate = useNavigate();
  const { addJob } = useGenerations();

  const [prompt, setPrompt] = useState("");
  const [tier, setTier] = useState("zylo-v4");
  const [aspect, setAspect] = useState("16:9"); // drives "Resolution" dropdown

  // (img2img placeholder)
  const [initImageFile] = useState(null);

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const q = searchParams.get("prompt");
    const m = searchParams.get("model");
    const a = searchParams.get("aspect");
    if (q) setPrompt(q);
    if (m) {
      const normalized = m.startsWith("zylo-") ? m : `zylo-${m}`;
      if (["zylo-v2", "zylo-v3", "zylo-v4"].includes(normalized)) {
        setTier(normalized);
      }
    }
    if (a && ["1:1", "16:9", "9:16"].includes(a)) setAspect(a);
  }, [searchParams]);

  const currentSize = useMemo(
    () => ASPECTS.find((x) => x.id === aspect)?.size || "1024x1024",
    [aspect]
  );

  const toolKey = useMemo(() => toolKeyFromTier(tier), [tier]);
  const providerLink = useMemo(
    () => getProviderLink(toolKey),
    [toolKey]
  );
  const credits = providerLink?.credits ?? 1;

  const tierOptions = useMemo(() => {
    return TIERS.map((t) => {
      const tk = toolKeyFromTier(t.id);
      const link = getProviderLink(tk);
      return {
        id: t.id,
        label: t.label,
        tips: TIER_TIPS[t.id] || [],
        credits: link?.credits ?? 1,
      };
    });
  }, []);

  function handleGenerate() {
    const base =
      (prompt ?? "").toString().trim() ||
      "clean studio photo of product";

    const tempId =
      (typeof crypto !== "undefined" &&
        crypto.randomUUID &&
        crypto.randomUUID()) ||
      `job_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;

    const [width, height] = parseSize(currentSize);

    const tierDefaults =
      toolKey === "t2i:v2"
        ? { steps: 4, guidance: 3.5 }
        : toolKey === "t2i:v3"
        ? { steps: 28, guidance: 4.5 }
        : {}; // Imagen 4 ignores steps/CFG

    // Push into Generations dock
    const { ok, reason } = addJob(tempId, {
      tool: "text-to-image",
      kind: "image",
      prompt: base,
      tier,
      size: currentSize,
    });

    // If hard failure (not plan limit), fall back to legacy JobProgress route
    if (!ok && reason !== "limit") {
      navigate(`/jobs/${tempId}`);
    }

    // Fire-and-forget job creation with the fixed id
    Promise.resolve(
      createImageJobSimple({
        id: tempId,
        tool: "image",
        subject: base,
        style: "Cinematic",
        negative: NEG,
        tier,
        size: currentSize,
        initImageFile,
        providerHint: {
          engine: "runware",
          mode: "t2i",
          edgeFn: providerLink.edgeFn,
          airTag: providerLink.airTag,
          settings: { width, height, ...tierDefaults },
        },
      })
    ).catch((e) =>
      console.error("createImageJobSimple failed:", e)
    );
  }

  const PROMPT_LIBRARY = [
    {
      id: "p1",
      title: "Neo Tokyo street at night",
      note: "Neon, rain, reflections, cyberpunk mood",
      img: ex1,
    },
    {
      id: "p2",
      title: "Luxury product on black",
      note: "Deep blacks, elegant rim light, premium sheen",
      img: v41,
    },
    {
      id: "p3",
      title: "Futuristic hall • volumetric",
      note: "Clean symmetry, glossy floor, god-rays",
      img: v42,
    },
    {
      id: "p4",
      title: "Editorial portrait • soft key",
      note: "Neutral palette, crisp catchlight, minimal bg",
      img: v43,
    },
    {
      id: "p5",
      title: "Claymation mascot",
      note: "Clay texture, studio light, smile",
      img: v33,
    },
    {
      id: "p6",
      title: "Retro synthwave vista",
      note: "Chrome accents, grid horizon, neon sun",
      img: v44,
    },
    {
      id: "p7",
      title: "Elegant packshot • 3/4",
      note: "Feathered gradients, micro-shadow, crisp edges",
      img: v45,
    },
    {
      id: "p8",
      title: "Architectural dusk render",
      note: "Blue hour, soft interior glow, reflections",
      img: v46,
    },
    {
      id: "p9",
      title: "Cozy tabletop still life",
      note: "Warm tungsten light, soft shadows, tactile texture",
      img: ex2,
    },
    {
      id: "p10",
      title: "Anime hero • neon city",
      note: "Vivid palette, light rain, dynamic angle",
      img: v32,
    },
    {
      id: "p11",
      title: "Pixar-ish character close-up",
      note: "Soft 3D look, big eyes, friendly bounce light",
      img: v31,
    },
    {
      id: "p12",
      title: "Lifestyle hands at golden hour",
      note: "Natural textures, candid framing, warm sun",
      img: ex6,
    },
  ];

  const rowA = PROMPT_LIBRARY.filter((_, i) => i % 2 === 0);
  const rowB = PROMPT_LIBRARY.filter((_, i) => i % 2 !== 0);

  const PromptCard = ({ item }) => (
    <div className="w-56 shrink-0">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[.02]">
        <div className="aspect-[9/16] w-full">
          {item.img ? (
            <img
              src={item.img}
              alt={item.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-[#0f141b] via-[#0b0f14] to-[#121826]" />
          )}
        </div>
      </div>
      <div className="mt-2 space-y-0.5">
        <div className="line-clamp-1 text-sm font-semibold text-white/90">
          {item.title}
        </div>
        <div className="line-clamp-2 text-xs text-white/60">
          {item.note}
        </div>
      </div>
    </div>
  );

  return (
    <main className="w-full bg-[#0b0f14] text-white py-8">
      <div className="mx-auto w-full max-w-[1180px] px-4 lg:px-2">
        <h1 className="text-3xl font-extrabold tracking-tight mb-3">
          Text to Image
        </h1>

        <section className="rounded-2xl border border-white/10 bg-[#10151d] p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col gap-3">
            {/* Prompt + CTA — stacks on mobile */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <div className="flex-1 min-w-0 rounded-xl border border-white/20 bg-white/[.06] px-3 py-1 focus-within:ring-2 focus-within:ring-[#7A3BFF]">
                <input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe…"
                  className="prompt-input h-12 w-full bg-transparent px-2 text-[15px] outline-none"
                  spellCheck={true}
                />
              </div>

              <button
                onClick={handleGenerate}
                className="w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                title={`${credits} credits`}
              >
                <ImageIcon className="h-4 w-4" />
                Generate an image
                <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                  {credits} credits
                </span>
              </button>
            </div>

            {/* ONE LINE: Model + Resolution (wraps on small screens) */}
            <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Model */}
              <Dropdown
                label={
                  tierOptions.find((t) => t.id === tier)?.label ||
                  "Select model"
                }
                subtitle="Model quality & cost"
                badge={`${credits} cr`}
              >
                {({ close }) => (
                  <div className="py-2">
                    {tierOptions.map((opt) => (
                      <MenuItem
                        key={opt.id}
                        active={opt.id === tier}
                        title={`${opt.label} • Image`}
                        lines={opt.tips}
                        rightBadge={`${opt.credits} credits`}
                        onClick={() => {
                          setTier(opt.id);
                          close();
                        }}
                      />
                    ))}
                  </div>
                )}
              </Dropdown>

              {/* Resolution (driven by aspect) */}
              <Dropdown
                label={
                  ASPECTS.find((a) => a.id === aspect)?.size ||
                  "Resolution"
                }
                subtitle={
                  ASPECTS.find((a) => a.id === aspect)?.label ||
                  "Resolution"
                }
                icon={iconForAspect(aspect)}
              >
                {({ close }) => (
                  <div className="py-2">
                    {ASPECTS.map((a) => {
                      const Icon = iconForAspect(a.id);
                      return (
                        <MenuItem
                          key={a.id}
                          active={a.id === aspect}
                          title={a.size}
                          meta={a.label}
                          Icon={Icon}
                          onClick={() => {
                            setAspect(a.id);
                            close();
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Dropdown>
            </div>
          </div>
        </section>

        {/* Prompt Library */}
        <section className="mt-8 rounded-2xl border border-white/10 bg-[#10151d] p-4 sm:p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-white/85">
              Prompt Library
            </h2>
            <Link
              to="/prompt-library"
              className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              Explore library →
            </Link>
          </div>

          <style>{`
            @keyframes zylo-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .zylo-marquee {
              display: flex;
              width: max-content;
              animation: zylo-marquee linear infinite;
            }
          `}</style>

          <div className="relative mx-auto mb-4 w-full overflow-hidden">
            <div
              className="zylo-marquee gap-4"
              style={{
                animationDuration: `${
                  Math.max(24, rowA.length * 4) * 2.0
                }s`,
              }}
            >
              {[...rowA, ...rowA].map((item, i) => (
                <PromptCard
                  key={`A-${item.id}-${i}`}
                  item={item}
                />
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full overflow-hidden">
            <div
              className="zylo-marquee gap-4"
              style={{
                animationDuration: `${
                  Math.max(24, rowB.length * 4) * 2.0
                }s`,
                animationDirection: "reverse",
              }}
            >
              {[...rowB, ...rowB].map((item, i) => (
                <PromptCard
                  key={`B-${item.id}-${i}`}
                  item={item}
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
