import { createPortal } from "react-dom";
import { X, Lock, Sparkles } from "lucide-react";
import { PLAN_LABELS } from "./api/cartoonDriveByApi";

const MODEL_COPY = {
  "cartoon-drive-v3": {
    title: "V3 is a Pro feature",
    body: "V3 renders your drive-by at 4K — sharper detail than V2's 2K. It's available starting on the Pro plan.",
  },
  "cartoon-drive-v4": {
    title: "V4 is a Generative feature",
    body: "V4 renders your drive-by at full 4K with 1080p video — the sharpest, most detailed Cartoon Drive By clip. It's available on the Generative plan.",
  },
};

export default function CartoonDriveByUpgradeModal({ open, onClose, modelId, requiredPlan }) {
  if (!open) return null;
  const copy = MODEL_COPY[modelId] ?? {
    title: "This quality needs a higher plan",
    body: "Upgrade your plan to unlock this resolution.",
  };
  const planLabel = PLAN_LABELS[requiredPlan] ?? requiredPlan;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-lime-300/[0.13] bg-[#0C0F0D] p-6 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full blur-3xl opacity-30"
          style={{ background: "radial-gradient(circle, #BEF264 0%, transparent 70%)" }}
        />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white transition"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-lime-300/20 to-lime-500/20 border border-lime-300/30">
          <Lock className="h-7 w-7 text-lime-300" />
        </div>

        <h2 className="text-center text-xl font-black text-white mb-2">{copy.title}</h2>
        <p className="text-center text-sm text-white/50 mb-6 leading-relaxed">{copy.body}</p>

        <a
          href="/workspace/pricing"
          className="flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-lime-300 to-lime-500 py-3 text-center text-[15px] font-bold text-[#071006] hover:opacity-90 transition"
        >
          <Sparkles className="h-4 w-4" />
          Upgrade to {planLabel}
        </a>
        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-sm text-white/40 hover:text-white/60 transition py-1"
        >
          Not now
        </button>
      </div>
    </div>,
    document.body
  );
}
