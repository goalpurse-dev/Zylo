// src/components/FAQ.jsx
import React, { useState } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  {
    q: "Can I cancel my ZyloAI plan at any time?",
    a: "Yes. You can downgrade or cancel anytime from Settings → Billing. When you cancel, your plan remains active until the end of the current billing period and you keep any unused credits until they expire (see credit validity in your invoice). No hidden fees, no lock-ins."
  },
  {
    q: "What counts as a “credit” in ZyloAI?",
    a: "A credit is a unit we spend to run compute-heavy tasks. Generating a new clip or thumbnail uses credits; lighter actions (e.g., caption tweaks) use fewer or none. Each tool shows estimated credit cost before you run it so you can plan usage. Batch jobs scale linearly by number of outputs."
  },
  {
    q: "How long can a generated video be?",
    a: "It depends on your plan and the template. Starter supports up to 30s, Pro up to 60s, and Scale up to 120s. Longer videos require more credits and render time. For advanced workflows (stitching scenes, B-roll, voiceover) you can chain multiple segments inside the editor."
  },
  {
    q: "Is ZyloAI free?",
    a: "There’s a free tier with limited weekly credits so you can try the tools. Some premium models (e.g., higher-fidelity speech, upscale, or fast queue) are Pro/Scale only due to compute cost. You can buy one-off credit packs without upgrading your plan."
  },
  {
    q: "How do I track my credit usage?",
    a: "Go to Settings → Usage. You’ll see per-day and per-project breakdowns, plus an export-ready CSV. Each render includes a receipt with model, duration, and credit cost for auditing. We also show an in-app pill with remaining credits in real time."
  },
  {
    q: "Do you offer refunds?",
    a: "For subscription fees: refunds are not issued for partial billing periods once time has been used. For credit packs: if no credits have been consumed within 7 days of purchase, contact support and we’ll help. If there’s a platform error on our side, we’ll restore credits for affected jobs."
  },
  {
    q: "What is an “export minute”?",
    a: "Export minutes measure the encoder time used to render final media. Most exports use a tiny fraction per short, but long or multiple-pass exports (HDR, ProRes, higher bitrate) may consume more. The export panel shows an estimate before you confirm."
  },
  {
    q: "Can I monetize content made with ZyloAI?",
    a: "Yes. You keep commercial rights to outputs you create, subject to the input content being yours or licensed. Our stock/B-roll integrations flag licenses in the exporter. If you upload brand assets, make sure you own the rights or have permission."
  },
  {
    q: "Can I generate in other languages?",
    a: "Absolutely. Prompts, captions, and voiceovers support many languages (Latin and non-Latin scripts). Some voices/models are language-specific; we auto-suggest the best voice per language. You can mix multiple languages in the same project."
  },
  {
    q: "Can I import images from ChatGPT (or elsewhere) to ZyloAI?",
    a: "Yes. Drag-and-drop PNG/JPG/WebP or paste from clipboard. We preserve transparent PNGs for compositing. For very large images we’ll non-destructively downscale on canvas to keep the editor snappy; the original file stays attached for high-res exports."
  }
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={
        "group rounded-xl border border-gray-200 bg-white " +
        "hover:border-gray-300 transition overflow-hidden shadow-sm"
      }
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="
          w-full flex items-center justify-between gap-6 px-5 py-4 text-left
          bg-white text-black appearance-none
          hover:bg-gray-100 transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300/40
        "
      >
        <span className="font-medium tracking-tight">{q}</span>
        <span
          className="shrink-0 text-gray-400 group-hover:text-purple-500 transition"
        >
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-0 text-sm leading-6 text-gray-600 border-t border-gray-200">
          {a}
        </div>
      )}
    </div>
  );
}

export default function FAQ() {
  return (
    <section className="relative py-16 bg-white text-black">
      <div className="max-w-5xl mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-extrabold text-center mb-2">
          Frequently Asked{" "}
          <span className="bg-gradient-to-r from-[#7A3BFF] via-[#9B4DFF] to-[#FF57B2] bg-clip-text text-transparent">
            Questions
          </span>
        </h2>
        <p className="text-center text-gray-500 mb-10">
          Everything you need to know about ZyloAI — explained clearly and in depth.
        </p>

        <div className="space-y-3">
          {faqs.map((f, i) => (
            <Item key={i} q={f.q} a={f.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
