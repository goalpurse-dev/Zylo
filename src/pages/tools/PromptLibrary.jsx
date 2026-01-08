// src/pages/PromptLibrary.jsx

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

import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, X, Copy, Check } from "lucide-react";

/* ------------------------ Library seed data ------------------------ */
const CATEGORIES = [
  {
    id: "v2",
    title: "Created with v2",
    cards: [
      {
        id: "v2-neon-rain-street",
        model: "v2",
        title: "Neon rain street • cinematic",
        blurb: "Wet asphalt, neon signage reflections, umbrellas, moody frame.",
        prompt:
          "Cinematic night street scene with neon signage reflecting on wet asphalt, scattered umbrellas, light mist, high contrast, shallow depth of field, subtle film grain, moody cyberpunk tone",
        img: ex1,
      },
      {
        id: "v2-cozy-tabletop",
        model: "v2",
        title: "Cozy tabletop still life",
        blurb: "Warm tungsten light, soft shadows, tactile textures.",
        prompt:
          "Cozy tabletop still life lit with warm tungsten, soft falloff, tactile textures, ceramic mug with steam, linen cloth, shallow depth of field, tasteful bokeh highlights, editorial minimalism",
        img: ex2,
      },
      {
        id: "v2-studio-packshot",
        model: "v2",
        title: "Studio packshot 3/4",
        blurb: "Clean bg, gentle soft-box, premium clarity.",
        prompt:
          "Studio product packshot 3/4 view on clean light-gray background, gentle soft-box lighting, smooth gradient shadow, crisp edges, premium clarity, minimal reflections",
        img: ex3,
      },
      {
        id: "v2-noir-portrait",
        model: "v2",
        title: "Noir portrait • backlit",
        blurb: "Backlight silhouette, foggy alley, 1940s vibe.",
        prompt:
          "Noir character portrait in a foggy alley, strong backlight silhouette, fedora and trench coat, rim light on profile, dramatic contrast, subtle film grain, 1940s mood",
        img: ex4,
      },
      {
        id: "v2-pastel-food",
        model: "v2",
        title: "Pastel food macro",
        blurb: "Delicate colors, shallow DOF, appetizing steam.",
        prompt:
          "Photoreal food macro on pastel set, delicate color palette, appetizing steam, shallow DOF, soft natural window light, fresh textures and highlights",
        img: ex5,
      },
      {
        id: "v2-lifestyle-hands",
        model: "v2",
        title: "Lifestyle hands at golden hour",
        blurb: "Natural textures, candid framing, warm sun.",
        prompt:
          "Lifestyle product in candid hands at golden hour, warm backlight, natural textures, airy negative space, authentic editorial framing",
        img: ex6,
      },
    ],
  },

  {
    id: "v3",
    title: "Created with v3",
    cards: [
      {
        id: "v3-pixar-closeup",
        model: "v3",
        title: "Pixar-ish character close-up",
        blurb: "Soft 3D look, big eyes, friendly bounce light.",
        prompt:
          "Pixar-style 3D character portrait, big expressive eyes, warm bounce lighting, subsurface scattering, shallow depth of field, subtle rim light, clean studio background, friendly energy",
        img: v31,
      },
      {
        id: "v3-anime-hero",
        model: "v3",
        title: "Anime hero • neon city",
        blurb: "Vivid palette, light rain, dynamic angle.",
        prompt:
          "Anime hero in neon-lit city at night, light rain, dynamic angle, glossy reflections on street, vivid color grading, cinematic rim light, lively motion cues",
        img: v32,
      },
      {
        id: "v3-claymation-mascot",
        model: "v3",
        title: "Claymation mascot",
        blurb: "Soft clay texture, cute silhouette, studio light.",
        prompt:
          "Claymation mascot character with soft clay texture, tiny imperfections, studio lighting, clean pastel background, cute rounded silhouette",
        img: v33,
      },
      {
        id: "v3-lowpoly-castle",
        model: "v3",
        title: "Low-poly fantasy castle",
        blurb: "Pastel sky, fog layers, stylized trees.",
        prompt:
          "Low-poly fantasy castle on a hill, pastel sky, layered fog, stylized trees, global illumination vibe, minimalist color blocks, clean gradients",
        img: v34,
      },
      {
        id: "v3-celshade-mech",
        model: "v3",
        title: "Cel-shaded mech • hero pose",
        blurb: "Hard inked lines, flat colors, dynamic perspective.",
        prompt:
          "Cel-shaded mech robot with bold ink outlines and flat color blocks, dynamic perspective, hero stance, clean gradient background",
        img: v35,
      },
      {
        id: "v3-chibi-food",
        model: "v3",
        title: "Chibi food mascot",
        blurb: "Round forms, glossy highlights, kawaii face.",
        prompt:
          "Chibi food mascot, round proportions, glossy highlights, kawaii facial expression, clean pastel background, soft shadow",
        img: v36,
      },
    ],
  },

  {
    id: "v4",
    title: "Created with v4",
    cards: [
      {
        id: "v4-luxury-black",
        model: "v4",
        title: "Luxury product on black",
        blurb: "Deep blacks, elegant rim light, premium sheen.",
        prompt:
          "Luxury product shot on deep black backdrop, elegant rim light, controlled reflections, premium editorial style, whisper of atmospheric haze",
        img: v41,
      },
      {
        id: "v4-futuristic-hall",
        model: "v4",
        title: "Futuristic hall • volumetric",
        blurb: "Clean symmetry, glossy floor, god-rays.",
        prompt:
          "Futuristic hall interior with monumental scale, clean symmetry, glossy floor reflections, volumetric light beams, ultra-polished materials",
        img: v42,
      },
      {
        id: "v4-editorial-portrait",
        model: "v4",
        title: "Editorial portrait • soft key",
        blurb: "Neutral palette, crisp catchlight, minimal bg.",
        prompt:
          "Editorial portrait with soft key and gentle fill, crisp catchlight in eyes, neutral palette, minimal background, micro-contrast detail",
        img: v43,
      },
      {
        id: "v4-retro-synthwave",
        model: "v4",
        title: "Retro synthwave vista",
        blurb: "Chrome accents, grid horizon, neon sun.",
        prompt:
          "Retro synthwave vista with neon sun, chrome accents, magenta-cyan palette, grid horizon stretching to infinity, atmospheric haze",
        img: v44,
      },
      {
        id: "v4-elegant-packshot",
        model: "v4",
        title: "Elegant packshot • 3/4",
        blurb: "Feathered gradients, micro-shadow, crisp edges.",
        prompt:
          "Elegant 3/4 packshot on light background, feathered gradient lighting, micro-shadow, crisp edges, understated premium finish",
        img: v45,
      },
      {
        id: "v4-architectural-dusk",
        model: "v4",
        title: "Architectural dusk render",
        blurb: "Blue hour, soft interior glow, reflections.",
        prompt:
          "Photoreal architectural exterior at blue hour, soft interior glow, subtle reflections on glass, clean landscaping, wide angle lens",
        img: v46,
      },
    ],
  },
];

/* ------------------------ UI helpers ------------------------ */
function classNames(...xs) {
  return xs.filter(Boolean).join(" ");
}

function GradientBox({ className }) {
  return (
    <div
      className={classNames(
        "w-full h-full rounded-2xl border border-white/10",
        "bg-gradient-to-br from-[#111827] via-[#0b0f14] to-[#151a22]",
        className
      )}
    />
  );
}

/* Card in the row with model badge */
function PromptCard({ card, onOpen }) {
  return (
    <button
      onClick={() => onOpen(card)}
      className="flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[.02] hover:bg-white/[.04] transition"
      title={card.title}
    >
      <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 relative">
        {card.img ? (
          <img
            src={card.img}
            alt={card.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <GradientBox className="absolute inset-0" />
        )}

        {card.model && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            {card.model}
          </span>
        )}
      </div>

      <div className="p-3 text-left">
        <div className="text-[13px] font-semibold text-white/90 line-clamp-1">{card.title}</div>
        <div className="mt-1 text-[12px] text-white/60 line-clamp-2">{card.blurb}</div>
      </div>
    </button>
  );
}

/* One horizontally scrollable row with arrows */
function CategoryRow({ title, cards, onOpen }) {
  const scrollerRef = useRef(null);
  const scrollBy = (dx) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <section className="relative">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-white font-semibold">{title}</h3>
        <div className="hidden sm:flex gap-1">
          <button
            onClick={() => scrollBy(-360)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white/80 hover:bg-white/[.08]"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy(360)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white/80 hover:bg-white/[.08]"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="scrollbar-thin scrollbar-thumb-white/10 overflow-x-auto snap-x snap-mandatory">
        <div className="flex gap-3 pb-1">
          {cards.map((c) => (
            <PromptCard key={c.id} card={c} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------- Overlay with left image + right prompt -------------- */
function DetailOverlay({ card, onClose, onGenerate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm">
      <div className="mx-auto mt-10 w-full max-w-5xl rounded-2xl border border-white/10 bg-[#0b0f14] p-4 sm:p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <h4 className="text-lg font-semibold text-white">{card.title}</h4>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-white/[.04] text-white/80 hover:bg-white/[.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* LEFT: now shows the card image if available */}
          <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 relative">
            {card?.img ? (
              <img
                src={card.img}
                alt={card.title}
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            ) : (
              <GradientBox className="absolute inset-0" />
            )}
            <span className="absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] tracking-wide text-white/80">
              {(card?.model || "v2").toUpperCase()}
            </span>
          </div>

          {/* RIGHT: prompt & actions */}
          <div className="flex flex-col">
            <div className="text-sm text-white/70">{card.blurb}</div>

            <label className="mt-4 text-xs font-semibold text-white/60">Prompt</label>
            <div className="mt-1 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <textarea
                readOnly
                value={card.prompt}
                className="
                  w-full rounded-xl p-3 text-sm resize-none leading-relaxed
                  bg-white/5 border border-white/10
                  !text-white caret-white placeholder-white/60
                  outline-none focus:ring-2 focus:ring-[#7A3BFF]
                "
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.06] px-4 py-2 text-sm text-white hover:bg-white/[.1]"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy prompt"}
              </button>

              <button
                onClick={onGenerate}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2 text-sm font-semibold text-white shadow hover:opacity-95"
              >
                Generate now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* click backdrop to close */}
      <button className="absolute inset-0 -z-10 cursor-default" onClick={onClose} aria-hidden />
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */
export default function PromptLibrary() {
  const navigate = useNavigate();
  const [active, setActive] = useState(null);

  const openCard = (card) => setActive(card);
  const closeCard = () => setActive(null);

 const handleGenerate = () => {
  if (!active) return;

  const model  = active.model || "v4";     // "v2" | "v3" | "v4"
  const aspect = active.aspect || "9:16";  // default if you don't set per-card

  navigate(
    `/textimage?prompt=${encodeURIComponent(active.prompt)}&model=${encodeURIComponent(model)}&aspect=${encodeURIComponent(aspect)}`
  );
};

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/textimage"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm text-white/80 hover:bg-white/[.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Text → Image
          </Link>

        </div>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Prompt Library</h1>

        <div className="space-y-10">
          {CATEGORIES.map((cat) => (
            <CategoryRow key={cat.id} title={cat.title} cards={cat.cards} onOpen={openCard} />
          ))}
        </div>
      </div>

      {active && (
        <DetailOverlay card={active} onClose={closeCard} onGenerate={handleGenerate} />
      )}
    </main>
  );
}
