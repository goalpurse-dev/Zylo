import React, { useState, useEffect, useRef } from "react";
import { Plus, Minus } from "lucide-react";
import { Link } from "react-router-dom";

const faqs = [
  { q: "What is ZyloAI and who is it for?",
    a: "ZyloAI is a brand-first creative suite for ads, avatars, product photos, and enhancements. It’s built for creators, e-commerce brands, and agencies who want fast, consistent visuals without hiring a full team." },
  { q: "What can I create inside Zylo?",
    a: "Start with a Brand Workspace, then generate logos, color palettes, avatars, ad videos, product photos, and image/video enhancements. Each tool stays synced to your selected brand for consistency." },
  { q: "How do credits and pricing work?",
    a: "Each generation consumes credits based on model tier and duration/size. You can top up credits any time or subscribe to a plan with monthly credits included. Unused subscription credits roll with your plan’s rules (check your billing page)." },
  { q: "How long do generations take?",
    a: "Images usually finish in seconds, video in 5–90 seconds depending on tier/length, and heavy upscales a bit longer. If the queue is busy, jobs can take more time—but they continue processing even if you navigate away." },
  { q: "Do I own the outputs commercial rights?",
    a: "Yes. You have full commercial usage rights to assets you generate with Zylo (subject to our Terms and acceptable use). If you upload third-party content, make sure you have the rights to use it." },
  { q: "Are my brand assets private and secure?",
    a: "Your uploads (logos, product shots, brand docs) are stored in your account space. We don’t sell or share your data. You can delete assets at any time from the Library. See Privacy in Settings for details." },
  { q: "What are the differences between v1, v2, v3, v4 tiers?",
    a: "Higher tiers give better fidelity, motion/temporal stability, and fewer artifacts. v2+ adds stronger detail and consistency; v3/v4 deliver sharper results and better color/lighting control, with higher credit cost." },
  { q: "Can I upload my own products and logos?",
    a: "Absolutely. Upload products, packaging, or app screenshots and place them into scenes or ads. Avatars and ad templates can automatically pull your brand logo/colors once a brand is selected." },
  { q: "A job failed or got stuck—do I lose credits?",
    a: "If a generation fails on our side, credits auto-return or you can click Retry. If it’s stuck, refresh the page—your job state will resync. Still broken? Contact support and we’ll fix/credit you." },
  { q: "How do I contact support and how fast do you reply?",
    a: "Use the Help button in the app or email support@zylo.ai with your job ID. We reply fast—during heavy traffic it may take longer, but everything gets answered within 24 hours." }
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef(null);
  const [maxH, setMaxH] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    setMaxH(open ? contentRef.current.scrollHeight : 0);
  }, [open]);

  return (
    <div className="group rounded-xl border border-white/10 bg-white/5 hover:border-white/20 transition overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-6 px-5 py-4 text-left
                   bg-transparent text-white appearance-none hover:bg-white/5 transition-colors focus:outline-none"
      >
        <span className="font-medium tracking-tight">{q}</span>
        <span className="shrink-0 text-zinc-400 group-hover:text-purple-400 transition">
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </span>
      </button>

      {/* animated wrapper */}
      <div
        className="overflow-hidden transition-[max-height] duration-300 ease-out will-change-[max-height]"
        style={{ maxHeight: maxH }}
      >
        <div
          ref={contentRef}
          className={`px-5 pb-5 text-sm leading-6 border-t border-white/10
                      transition-all duration-300
                      ${open ? "pt-3 opacity-100 translate-y-0 text-zinc-300" : "pt-0 opacity-0 -translate-y-1 text-zinc-300"}`}
        >
          {a}
        </div>
      </div>
    </div>
  );
}

export default function FAQ() {
  return (
    <section className="relative py-16 bg-transparent text-white">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-2">
          Frequently Asked{" "}
          <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] bg-clip-text text-transparent">
            Questions
          </span>
        </h2>
        <p className="text-center text-zinc-400 mb-10">
          Everything you need to know about ZyloAI — explained clearly and in depth.
        </p>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <Item key={i} q={f.q} a={f.a} />
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 flex justify-center">
          <Link
            to="/contact"
            aria-label="Go to contact page"
            className="relative inline-flex items-center rounded-full p-[2px]
                       bg-gradient-to-r from-[#1677FF] to-[#7A3BFF]
                       hover:scale-[1.01] active:scale-[0.99] transition"
          >
            <span className="rounded-full px-5 py-2.5 bg-[#0B1117] text-white text-sm font-semibold">
              More questions?
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
