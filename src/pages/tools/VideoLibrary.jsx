// src/pages/PromptLibrary.jsx

import v31 from "../../assets/library/v31.mp4";
import v32 from "../../assets/library/v32.mp4";

import React, { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, X, Copy, Check } from "lucide-react";

/* ------------------------ Library seed data (VIDEO) ------------------------ */
const CATEGORIES = [
  {
    id: "v2-video",
    title: "Created with v2 (Video)",
    cards: [
      // Add your v2 .mp4 samples here as { id, model:"v2", title, blurb, prompt, src, aspect }
    ],
  },
  {
    id: "v3-video",
    title: "Created with v3 (Video)",
    cards: [
      {
        id: "v3-pixar-closeup-video",
        model: "v3",
        title: "Horses running around",
        blurb: "Realistic, happy, freedom.",
        prompt:
          "Create me video where horses are running around in beautiful mountains.",
        src: v31,
        aspect: "9:16",
      },
      {
        id: "v3-anime-hero-video",
        model: "v3",
        title: "Anime hero • neon city",
        blurb: "Vivid palette, light rain, dynamic angle.",
        prompt:
          "Anime hero in neon-lit city at night, light rain, dynamic angle, glossy reflections on street, vivid color grading, cinematic rim light, lively motion cues",
        src: v32,
        aspect: "9:16",
      },
    ],
  },
  {
    id: "v4-video",
    title: "Created with v4 (Video)",
    cards: [
      // Add your v4 .mp4 samples here as { id, model:"v4", title, blurb, prompt, src, aspect }
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

/* Card renders VIDEO */
function PromptCard({ card, onOpen }) {
  const isVideo = typeof card.src === "string" && card.src.endsWith(".mp4");
  return (
    <button
      onClick={() => onOpen(card)}
      className="flex w-[220px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[.02] hover:bg-white/[.04] transition"
      title={card.title}
    >
      <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 relative">
        {isVideo ? (
          <video
            src={card.src}
            className="absolute inset-0 h-full w-full object-cover"
            muted
            loop
            playsInline
            autoPlay
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

/* Scrollable row with optional empty state */
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

      {(!cards || cards.length === 0) ? (
        <div className="rounded-xl border border-white/10 bg-white/[.02] p-4 text-sm text-white/60">
          No samples yet — add .mp4 clips to this row.
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="scrollbar-thin scrollbar-thumb-white/10 overflow-x-auto snap-x snap-mandatory"
        >
          <div className="flex gap-3 pb-1">
            {cards.map((c) => (
              <PromptCard key={c.id} card={c} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* Overlay with left VIDEO + right prompt */
function DetailOverlay({ card, onClose, onGenerate }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  const isVideo = typeof card.src === "string" && card.src.endsWith(".mp4");

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
          <div className="aspect-[9/16] w-full overflow-hidden rounded-2xl border border-white/10 relative">
            {isVideo ? (
              <video
                src={card.src}
                className="absolute inset-0 h-full w-full object-cover"
                controls
                playsInline
                muted
                loop
              />
            ) : (
              <GradientBox className="absolute inset-0" />
            )}
            <span className="absolute bottom-2 right-2 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] tracking-wide text-white/80">
              {(card?.model || "v3").toUpperCase()}
            </span>
          </div>

          <div className="flex flex-col">
            <div className="text-sm text-white/70">{card.blurb}</div>

            <label className="mt-4 text-xs font-semibold text-white/60">Prompt</label>
            <div className="mt-1 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              <textarea
                readOnly
                value={card.prompt}
                className="w-full rounded-xl p-3 text-sm resize-none leading-relaxed bg-white/5 border border-white/10 !text-white caret-white placeholder-white/60 outline-none focus:ring-2 focus:ring-[#7A3BFF]"
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
    const model = active.model || "v3";
    const aspect = active.aspect || "9:16";
    navigate(
      `/textvideo?prompt=${encodeURIComponent(active.prompt)}&model=${encodeURIComponent(
        model
      )}&aspect=${encodeURIComponent(aspect)}`
    );
  };

  return (
    <main className="min-h-screen bg-[#0b0f14] text-white">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/textvideo"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-sm text-white/80 hover:bg-white/[.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Text → Video
          </Link>
        </div>

        <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Prompt Library (Video)</h1>

        <div className="space-y-10">
          {CATEGORIES.map((cat) => (
            <CategoryRow key={cat.id} title={cat.title} cards={cat.cards} onOpen={openCard} />
          ))}
        </div>
      </div>

      {active && <DetailOverlay card={active} onClose={closeCard} onGenerate={handleGenerate} />}
    </main>
  );
}
